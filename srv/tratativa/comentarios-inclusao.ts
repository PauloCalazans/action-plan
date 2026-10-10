// Orquestrador da action comentarTratativa: bloqueio D9, autorização dinâmica, estado e histórico.
// R1-R4, R7, R8, R13 (spec comentarios), etapa 1 da task 001.

import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import type { Autor } from './abertura';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { registrarHistorico } from './historico';
import { obterMatriculaUsuario, usuarioAutenticadoEhMatricula, matriculasIguais } from './identidade';
import { recusar } from './recusa';
import { agora } from '../lib/relogio';
import { validarTextoComentario, validarMencoes } from './comentarios-validacao';

const NS = 'br.com.calazanstec';

export interface DadosComentarioTratativa {
  texto?: unknown;
  mencoes?: unknown;
}

export interface DadosComentarioAcao {
  acao?: unknown;
  texto?: unknown;
  mencoes?: unknown;
}

export interface ResultadoComentario {
  codigo: string;
}

interface AcaoAlvo {
  codigo: string;
  responsavel: string;
  status: string;
}

/** Grava o comentário, as menções (se houver) e o histórico `InclusaoComentario` no mesmo fluxo transacional. */
async function gravarComentario(
  codigoTratativa: string,
  codigoAcao: string | null,
  matriculaAutor: string,
  texto: string,
  mencoes: string[],
): Promise<ResultadoComentario> {
  const codigoComentario = cds.utils.uuid();
  const instante = agora();

  await cds.db.run(
    INSERT.into(`${NS}.Comentarios`).entries({
      codigo: codigoComentario,
      tratativa_codigo: codigoTratativa,
      acao_codigo: codigoAcao,
      texto,
      autor: matriculaAutor,
      criadoEm: instante.toISOString(),
    }),
  );

  if (mencoes.length > 0) {
    await cds.db.run(
      INSERT.into(`${NS}.MencoesComentario`).entries(
        mencoes.map((matricula) => ({
          ID: cds.utils.uuid(),
          comentario_codigo: codigoComentario,
          matricula,
        })),
      ),
    );
  }

  const autor: Autor = { id: matriculaAutor, tipo: 'Usuario' };
  await registrarHistorico(
    codigoTratativa,
    autor,
    [
      {
        evento: 'InclusaoComentario',
        campo: 'comentario',
        valorNovo: codigoComentario,
      },
    ],
    instante,
    codigoAcao ?? undefined,
  );

  return { codigo: codigoComentario };
}

/**
 * Precedência (D10, 9 etapas; etapas 1-3 e a existência/chave da Tratativa já tratadas pelo runtime/before/bloqueio):
 * 5. Existência da Tratativa (404, via bloquearTratativa — chave malformada ou inexistente).
 * 6. Autorização dinâmica: Gestor, Responsável Principal ou Participante da Tratativa (403 para os demais).
 * 7. Estado da Tratativa (409 Encerrada/Cancelada).
 * 9. Campos no domínio: texto (trim, obrigatório, máximo 2.000) e menções (formato, limite 10).
 */
export async function comentarTratativa(
  req: Request,
  codigoTratativa: string,
  dados: DadosComentarioTratativa,
): Promise<ResultadoComentario> {
  // Etapa 5: existência da Tratativa — bloqueio D9 serializa acesso antes de qualquer outra leitura.
  const tratativa = await bloquearTratativa(codigoTratativa);

  // Etapa 6: autorização dinâmica — Gestor, Responsável Principal ou Participante.
  const ehGestor = req.user.is('GestorTratativa');
  if (!ehGestor) {
    const responsavelPrincipal = (await cds.db.run(
      SELECT.one.from(`${NS}.Tratativas`).columns('responsavelPrincipal').where({ codigo: codigoTratativa }),
    )) as { responsavelPrincipal: string | null } | undefined;

    const ehResponsavelPrincipal =
      !!responsavelPrincipal?.responsavelPrincipal &&
      usuarioAutenticadoEhMatricula(req, responsavelPrincipal.responsavelPrincipal);

    let ehParticipante = false;
    if (!ehResponsavelPrincipal) {
      const participantes = (await cds.db.run(
        SELECT.from(`${NS}.ParticipantesTratativa`).columns('matricula').where({ tratativa_codigo: codigoTratativa }),
      )) as Array<{ matricula: string }>;
      const matriculaUsuario = obterMatriculaUsuario(req);
      ehParticipante = participantes.some((p) => matriculasIguais(matriculaUsuario, p.matricula));
    }

    if (!ehResponsavelPrincipal && !ehParticipante) {
      recusar(403, 'Forbidden');
    }
  }

  // Etapa 7: estado da Tratativa.
  exigirAlteravel(tratativa);

  // Etapa 9: campos no domínio.
  const texto = validarTextoComentario(dados.texto);
  const mencoes = validarMencoes(dados.mencoes);

  // Persistência transacional: comentário, menções e histórico no mesmo fluxo.
  const matriculaAutor = obterMatriculaUsuario(req);
  return gravarComentario(codigoTratativa, null, matriculaAutor, texto, mencoes);
}

/**
 * Precedência (D10, 9 etapas; etapas 1-3 já tratadas pelo runtime/before):
 * 4. Forma do parâmetro `acao` (400 `Código inválido.`, target `acao`) — antes do bloqueio D9.
 * 5. Existência da Tratativa (404, via bloquearTratativa) e da Ação (404 `Ação não encontrada.`,
 *    inexistente ou pertencente a outra Tratativa).
 * 6. Autorização dinâmica: Gestor ou Responsável da própria Ação/Subação (403 para os demais).
 * 7. Estado da Tratativa (409 Encerrada/Cancelada).
 * 8. Estado da Ação (409 Concluída/Cancelada).
 * 9. Campos no domínio: texto (trim, obrigatório, máximo 2.000) e menções (formato, limite 10).
 */
export async function comentarAcao(
  req: Request,
  codigoTratativa: string,
  dados: DadosComentarioAcao,
): Promise<ResultadoComentario> {
  // Etapa 4: forma do parâmetro `acao` — antes do bloqueio D9.
  const codigoAcaoBruto = dados.acao;
  if (
    codigoAcaoBruto === undefined ||
    codigoAcaoBruto === null ||
    typeof codigoAcaoBruto !== 'string' ||
    codigoAcaoBruto.trim() === '' ||
    !codigoValido(codigoAcaoBruto)
  ) {
    recusar(400, 'Código inválido.', 'acao');
  }
  const codigoAcao = (codigoAcaoBruto as string).toLowerCase();

  // Etapa 5: existência da Tratativa — bloqueio D9 serializa acesso antes de qualquer outra leitura.
  const tratativa = await bloquearTratativa(codigoTratativa);

  // Etapa 5: existência da Ação (inexistente ou de outra Tratativa).
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'responsavel', 'status')
      .where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as AcaoAlvo | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');

  // Etapa 6: autorização dinâmica — Gestor ou Responsável da própria Ação/Subação.
  const ehGestor = req.user.is('GestorTratativa');
  if (!ehGestor && !usuarioAutenticadoEhMatricula(req, acao.responsavel)) {
    recusar(403, 'Forbidden');
  }

  // Etapa 7: estado da Tratativa.
  exigirAlteravel(tratativa);

  // Etapa 8: estado da Ação.
  if (acao.status === 'Concluída' || acao.status === 'Cancelada') {
    recusar(409, `Ação ${acao.status} não pode ser alterada.`);
  }

  // Etapa 9: campos no domínio.
  const texto = validarTextoComentario(dados.texto);
  const mencoes = validarMencoes(dados.mencoes);

  // Persistência transacional: comentário, menções e histórico no mesmo fluxo.
  const matriculaAutor = obterMatriculaUsuario(req);
  return gravarComentario(codigoTratativa, codigoAcao, matriculaAutor, texto, mencoes);
}
