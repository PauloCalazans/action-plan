// Orquestrador da action removerEvidencia: remoção lógica com auditoria imutável.
// R1, R6, R7, R10, R12, R13 (spec evidencias).

import cds from '@sap/cds';
import type { Autor } from './abertura';
import type { Request } from '@sap/cds';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { obterMatriculaUsuario, usuarioAutenticadoEhMatricula } from './identidade';
import { registrarHistorico } from './historico';
import { recusar } from './recusa';
import { agora } from '../lib/relogio';

const NS = 'br.com.calazanstec';

export interface DadosRemocaoEvidencia {
  acao: string;
  evidencia: string;
}

/**
 * Orquestrador da action removerEvidencia.
 * Precedência conforme D10 (spec 006 R14):
 * 1. Autenticação (401 runtime)
 * 2. Forma no runtime (400 runtime)
 * 3. Aplicativo de origem (403 antes do domínio - tratado no before('*') do serviço)
 * 4. Forma de identificador no domínio (400 código inválido)
 * 5. Existência da Tratativa (404) - com bloqueio D9
 * 6. Existência da Ação dentro da Tratativa (404)
 * 7. Autorização dinâmica (403)
 * 8. Estado da Tratativa (409 Encerrada/Cancelada)
 * 9. Estado da Ação (409 Concluída/Cancelada)
 * 10. Existência da Evidência ativa na Ação (404)
 */
export async function removerEvidencia(
  req: Request,
  codigoTratativa: string,
  dados: DadosRemocaoEvidencia,
  autor: Autor,
): Promise<void> {
  // Etapa 4: Forma de identificador no domínio (antes do bloqueio D9)
  if (!dados.acao || !codigoValido(dados.acao)) {
    recusar(400, 'Código inválido.', 'acao');
  }

  if (!dados.evidencia || !codigoValido(dados.evidencia)) {
    recusar(400, 'Código inválido.', 'evidencia');
  }

  // Etapa 5: Existência da Tratativa - bloqueio D9 serializa acesso
  const tratativa = await bloquearTratativa(codigoTratativa);

  // Etapa 6: Existência da Ação dentro da Tratativa
  const acao = await cds.db.run(
    SELECT.one
      .from(`${NS}.Acoes`)
      .columns('codigo', 'tratativa_codigo', 'responsavel', 'status')
      .where({ codigo: dados.acao, tratativa_codigo: codigoTratativa }),
  );

  if (!acao) {
    recusar(404, 'Ação não encontrada.');
  }

  // Etapa 7: Autorização dinâmica - Gestor OU Responsável da Ação
  const ehGestor = req.user.is('GestorTratativa');
  const ehResponsavel = usuarioAutenticadoEhMatricula(req, acao.responsavel);

  if (!ehGestor && !ehResponsavel) {
    recusar(403, 'Forbidden');
  }

  // Etapa 8: Estado da Tratativa
  exigirAlteravel(tratativa);

  // Etapa 9: Estado da Ação
  if (acao.status === 'Concluída' || acao.status === 'Cancelada') {
    recusar(409, `Ação ${acao.status} não pode ser alterada.`);
  }

  // Etapa 10: Existência da Evidência ativa vinculada à Ação informada
  const evidencia = await cds.db.run(
    SELECT.one
      .from(`${NS}.Evidencias`)
      .columns('codigo', 'acao_codigo', 'tratativa_codigo', 'ativo', 'mimeType', 'tamanho')
      .where({ codigo: dados.evidencia, acao_codigo: dados.acao, ativo: true }),
  );

  if (!evidencia) {
    recusar(404, 'Evidência não encontrada.');
  }

  // Remoção lógica: marca ativo=false, data e autor da remoção
  const instante = agora();
  const matriculaAutor = obterMatriculaUsuario(req);

  await cds.db.run(
    UPDATE.entity(`${NS}.Evidencias`)
      .set({
        ativo: false,
        removidoEm: instante.toISOString(),
        autorRemocao: matriculaAutor,
      })
      .where({ codigo: dados.evidencia }),
  );

  // Registrar histórico de remoção (R12: metadados sem nome de arquivo)
  await registrarHistorico(
    codigoTratativa,
    autor,
    [
      {
        evento: 'RemocaoEvidencia',
        evidencia: dados.evidencia,
        mimeType: evidencia.mimeType,
        tamanho: evidencia.tamanho,
      },
    ],
    instante,
    dados.acao,
  );
}
