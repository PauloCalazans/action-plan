// Consulta listarComentariosTratativa: autorização dinâmica, menor privilégio, paginação e mascaramento LGPD.
// R7, R8, R13 (spec comentarios), etapa 1 da task 001.

import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import { codigoValido } from './consulta';
import { recusar } from './recusa';
import { usuarioAutenticadoEhMatricula, matriculasIguais, obterMatriculaUsuario } from './identidade';

const NS = 'br.com.calazanstec';
const TAMANHO_PAGINA_PADRAO = 50;
const TAMANHO_PAGINA_MAXIMO = 200;

export interface ItemComentario {
  codigo: string;
  texto: string;
  autor: string;
  criadoEm: string;
  mencoes: string[];
}

interface LinhaComentario {
  codigo: string;
  texto: string;
  autor: string;
  criadoEm: string;
}

/**
 * Precedência (D10, 9 etapas; etapas 1-3 tratadas pelo runtime/before):
 * 4. Forma do parâmetro `tratativa` no domínio (400 `Código inválido.`, target `tratativa`).
 * 5. Existência da Tratativa (404 `Tratativa não encontrada.`).
 * 6. Autorização dinâmica e menor privilégio: sem vínculo -> lista vazia `[]` com 200 (precede a etapa 9).
 * 9. Parâmetros de paginação: `tamanhoPagina` validado antes de `pagina`.
 */
export async function listarComentariosTratativa(
  req: Request,
  codigoTratativa: string,
  tamanhoPagina: unknown,
  pagina: unknown,
): Promise<ItemComentario[]> {
  // Etapa 4: forma do parâmetro `tratativa`.
  if (!codigoTratativa || !codigoValido(codigoTratativa)) {
    recusar(400, 'Código inválido.', 'tratativa');
  }

  // Etapa 5: existência da Tratativa (sem bloqueio D9: consulta não bloqueia, R12/CA53).
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo', 'responsavelPrincipal').where({ codigo: codigoTratativa }),
  )) as { codigo: string; responsavelPrincipal: string | null } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  // Etapa 6: autorização dinâmica e menor privilégio (precede a etapa 9 — CA33a).
  const ehGestor = req.user.is('GestorTratativa');
  let autorizado = ehGestor;
  if (!autorizado) {
    autorizado =
      !!tratativa.responsavelPrincipal && usuarioAutenticadoEhMatricula(req, tratativa.responsavelPrincipal);
  }
  if (!autorizado) {
    const participantes = (await cds.db.run(
      SELECT.from(`${NS}.ParticipantesTratativa`).columns('matricula').where({ tratativa_codigo: codigoTratativa }),
    )) as Array<{ matricula: string }>;
    const matriculaUsuario = obterMatriculaUsuario(req);
    autorizado = participantes.some((p) => matriculasIguais(matriculaUsuario, p.matricula));
  }
  if (!autorizado) {
    return [];
  }

  // Etapa 9: paginação — tamanhoPagina validado antes de pagina (003 R25).
  const tamanho = tamanhoPagina === undefined || tamanhoPagina === null ? TAMANHO_PAGINA_PADRAO : Number(tamanhoPagina);
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > TAMANHO_PAGINA_MAXIMO) {
    recusar(400, 'O campo Tamanho da página aceita de 1 a 200.', 'tamanhoPagina');
  }
  const paginaNumero = pagina === undefined || pagina === null ? 1 : Number(pagina);
  if (!Number.isInteger(paginaNumero) || paginaNumero < 1) {
    recusar(400, 'O campo Página deve ser 1 ou maior.', 'pagina');
  }

  // Busca ordenada: criadoEm ASC, desempate por codigo ASC (CA41, CA42).
  const comentarios = (await cds.db.run(
    SELECT.from(`${NS}.Comentarios`)
      .columns('codigo', 'texto', 'autor', 'criadoEm')
      .where({ tratativa_codigo: codigoTratativa, acao_codigo: null })
      .orderBy('criadoEm asc', 'codigo asc')
      .limit(tamanho, (paginaNumero - 1) * tamanho),
  )) as LinhaComentario[];

  if (comentarios.length === 0) return [];

  // Mascaramento LGPD: mencoes só preenchida para o GestorTratativa; demais recebem [] (CA31, CA32, CA35a;
  // coleção OData não aceita null, docs(spec) 0429f5f).
  if (!ehGestor) {
    return comentarios.map((c) => ({ ...c, mencoes: [] }));
  }

  const codigos = comentarios.map((c) => c.codigo);
  const mencoes = (await cds.db.run(
    SELECT.from(`${NS}.MencoesComentario`).columns('comentario_codigo', 'matricula').where({ comentario_codigo: codigos }),
  )) as Array<{ comentario_codigo: string; matricula: string }>;

  const mencoesPorComentario = new Map<string, string[]>();
  for (const m of mencoes) {
    const lista = mencoesPorComentario.get(m.comentario_codigo) ?? [];
    lista.push(m.matricula);
    mencoesPorComentario.set(m.comentario_codigo, lista);
  }

  return comentarios.map((c) => ({ ...c, mencoes: mencoesPorComentario.get(c.codigo) ?? [] }));
}
