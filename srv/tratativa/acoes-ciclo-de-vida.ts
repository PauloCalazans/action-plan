import cds from '@sap/cds';
import { agora, dataCivil } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { registrarHistorico } from './historico';
import { obterMatriculaUsuario, usuarioAutenticadoEhMatricula } from './identidade';
import { validarJustificativa } from './justificativa';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

const PENDENTE = 'Pendente';
const EM_ANDAMENTO = 'Em andamento';
const CONCLUIDA = 'Concluída';
const CANCELADA = 'Cancelada';
const FINAIS = [CONCLUIDA, CANCELADA];

interface Transicao { evento: string; justificativaObrigatoria: boolean }

/** R6-R9: tabela fixa de transições de Ação, chave `<de>|<para>`; Cancelada não tem saída. */
const TRANSICOES: Record<string, Transicao> = {
  [`${PENDENTE}|${EM_ANDAMENTO}`]: { evento: 'MudancaStatus', justificativaObrigatoria: false },
  [`${PENDENTE}|${CONCLUIDA}`]: { evento: 'Conclusao', justificativaObrigatoria: false },
  [`${PENDENTE}|${CANCELADA}`]: { evento: 'Cancelamento', justificativaObrigatoria: true },
  [`${EM_ANDAMENTO}|${CONCLUIDA}`]: { evento: 'Conclusao', justificativaObrigatoria: false },
  [`${EM_ANDAMENTO}|${CANCELADA}`]: { evento: 'Cancelamento', justificativaObrigatoria: true },
  [`${CONCLUIDA}|${EM_ANDAMENTO}`]: { evento: 'Reabertura', justificativaObrigatoria: true },
};

interface AcaoAlvo { 
  codigo: string; 
  status: string; 
  acaoMae_codigo: string | null; 
  responsavel: string;
  evidenciaObrigatoria: boolean;
}

/**
 * R11, R16, R28 (005): autorização dinâmica para execução de Ações.
 * Precedência detalhada de etapas:
 * 1. Autenticação (401 runtime)
 * 2. Forma do pedido (400 runtime CAP: campos desconhecidos, tipo JSON incompatível)
 * 3. Aplicativo de origem (403 do before(*) antes de checar existência, mesmo com código malformado; Ruling R-03)
 * 4. Formato de código (400 domínio: codigoValido(acao) antes do bloqueio D9)
 * 5. Existência completa (404: Tratativa ou Ação inexistente/não pertence)
 * 6. Autorização dinâmica (403): Gestor sempre OK; Responsável da Ação pode Concluída sempre,
 *    Em andamento se Pendente/Em andamento; outros destinos 403
 * 7. Estado da Tratativa (409: Encerrada/Cancelada)
 * 8. Estado da Ação e Transição (409/400: status ausente 400 para Gestor; par proibido 409)
 * 9. Relação mãe-filhas (409: concluir mãe com subações abertas)
 * 10. Evidência obrigatória (409: Conclusao com evidenciaObrigatoria=true e zero evidências ativas; R8, R15 do 006)
 * 11. Justificativa (400)
 */
export async function mudarStatusAcao(
  req: cds.Request,
  codigoTratativa: string,
  codigoAcao: string,
  pedido: { status?: string | null; justificativa?: string | null },
): Promise<void> {
  // Etapa 4: formato de código (antes do bloqueio D9)
  if (!codigoValido(codigoAcao)) recusar(400, 'Código inválido.', 'acao');
  
  // Etapa 5: bloqueio D9 e existência
  const tratativa = await bloquearTratativa(codigoTratativa);
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'status', 'acaoMae_codigo', 'responsavel', 'evidenciaObrigatoria')
      .where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as AcaoAlvo | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');

  // Etapa 6: autorização dinâmica
  const ehGestor = req.user.is('GestorTratativa');
  const destino = typeof pedido.status === 'string' ? pedido.status : '';
  
  if (!ehGestor) {
    const ehResponsavel = usuarioAutenticadoEhMatricula(req, acao.responsavel);
    if (!ehResponsavel) {
      recusar(403, 'Acesso negado.');
    }
    // Responsável da Ação: avaliar pelo destino e status atual
    if (destino === CONCLUIDA) {
      // Pode concluir de qualquer status (continua para etapa 8 validar par)
    } else if (destino === EM_ANDAMENTO) {
      // Pode pedir Em andamento se Pendente ou Em andamento
      if (acao.status !== PENDENTE && acao.status !== EM_ANDAMENTO) {
        recusar(403, 'Acesso negado.');
      }
    } else {
      // Qualquer outro destino (Cancelada, Pendente, ausente, inválido) → 403
      recusar(403, 'Acesso negado.');
    }
  }

  // Etapa 7: estado da Tratativa
  exigirAlteravel(tratativa);

  // Etapa 8: estado da Ação e Transição
  // Para o Gestor: validar status vazio ANTES de verificar a transição
  if (ehGestor && !destino.trim()) {
    recusar(400, 'O campo Status é obrigatório.', 'status');
  }
  
  const transicao = TRANSICOES[`${acao.status}|${destino}`];
  if (!transicao) recusar(409, `Transição não permitida: de ${acao.status} para ${destino}.`, 'status');

  // Etapa 9: relação mãe-filhas
  if (FINAIS.includes(destino)) {
    const abertas = await cds.db.run(
      SELECT.one.from(`${NS}.Acoes`).columns('codigo')
        .where({ acaoMae_codigo: codigoAcao, status: { 'not in': FINAIS } }),
    );
    if (abertas) recusar(409, 'A Ação possui Subações não concluídas nem canceladas.');
  }

  // R12: reabrir Subação exige mãe não finalizada.
  if (transicao.evento === 'Reabertura' && acao.acaoMae_codigo) {
    const mae = (await cds.db.run(
      SELECT.one.from(`${NS}.Acoes`).columns('status').where({ codigo: acao.acaoMae_codigo }),
    )) as { status: string };
    if (FINAIS.includes(mae.status)) recusar(409, `A Ação mãe está ${mae.status} e não aceita esta alteração.`);
  }

  // Etapa 10: evidência obrigatória (R8, R15 do 006; substitui 004:R14 via Ruling R-10)
  if (transicao.evento === 'Conclusao' && acao.evidenciaObrigatoria) {
    const evidenciasAtivas = (await cds.db.run(
      SELECT.one.from(`${NS}.Evidencias`).columns('count(*) as total')
        .where({ acao_codigo: codigoAcao, ativo: true }),
    )) as { total: number } | undefined;
    const contagem = evidenciasAtivas?.total ?? 0;
    if (contagem === 0) {
      recusar(409, 'Ação com Evidência obrigatória não pode ser concluída sem Evidência.');
    }
  }

  // Justificativa
  const justificativa = validarJustificativa(pedido.justificativa, transicao.justificativaObrigatoria);

  // Atualização e histórico
  const instante = agora();
  const dataConclusao = transicao.evento === 'Conclusao' ? dataCivil(instante) : transicao.evento === 'Reabertura' ? null : undefined;
  await cds.db.run(
    UPDATE(`${NS}.Acoes`)
      .set({ status: destino, ...(dataConclusao === undefined ? {} : { dataConclusao }) })
      .where({ codigo: codigoAcao }),
  );
  
  const autor: Autor = { id: obterMatriculaUsuario(req), tipo: 'Usuario' };
  await registrarHistorico(
    codigoTratativa,
    autor,
    [{ evento: transicao.evento, campo: 'status', valorAnterior: acao.status, valorNovo: destino, justificativa: justificativa || null }],
    instante,
    codigoAcao,
  );
}
