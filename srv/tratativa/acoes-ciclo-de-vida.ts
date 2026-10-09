import cds from '@sap/cds';
import { agora, dataCivil } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { registrarHistorico, validarAutor } from './historico';
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

interface AcaoAlvo { codigo: string; status: string; acaoMae_codigo: string | null }

/**
 * Ordem da decisão 8 do design: Código da Ação (400), bloqueio D9 (404), existência e pertencimento (404),
 * Tratativa alterável (409), destino (400), par na tabela (409), regras mãe-filhas (409), justificativa (400),
 * e atualização com histórico na mesma transação.
 */
export async function mudarStatusAcao(
  codigoTratativa: string,
  codigoAcao: string,
  pedido: { status?: string | null; justificativa?: string | null },
  autor: Autor,
): Promise<void> {
  if (!codigoValido(codigoAcao)) recusar(400, 'Código inválido.', 'acao');
  validarAutor(autor);
  const tratativa = await bloquearTratativa(codigoTratativa);
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'status', 'acaoMae_codigo')
      .where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as AcaoAlvo | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');
  exigirAlteravel(tratativa);

  // Decisão 8 (Ruling R-06 I13): ausente, nulo ou só espaços é 400; o valor enviado não é aparado (espaços nas pontas caem na tabela).
  const destino = typeof pedido.status === 'string' ? pedido.status : '';
  if (!destino.trim()) recusar(400, 'O campo Status é obrigatório.', 'status');

  const transicao = TRANSICOES[`${acao.status}|${destino}`];
  if (!transicao) recusar(409, `Transição não permitida: de ${acao.status} para ${destino}.`, 'status');

  // R11: concluir ou cancelar mãe exige todas as Subações finalizadas.
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

  const justificativa = validarJustificativa(pedido.justificativa, transicao.justificativaObrigatoria);

  const instante = agora();
  const dataConclusao = transicao.evento === 'Conclusao' ? dataCivil(instante) : transicao.evento === 'Reabertura' ? null : undefined;
  await cds.db.run(
    UPDATE(`${NS}.Acoes`)
      .set({ status: destino, ...(dataConclusao === undefined ? {} : { dataConclusao }) })
      .where({ codigo: codigoAcao }),
  );
  await registrarHistorico(
    codigoTratativa,
    autor,
    [{ evento: transicao.evento, campo: 'status', valorAnterior: acao.status, valorNovo: destino, justificativa: justificativa || null }],
    instante,
    codigoAcao,
  );
}
