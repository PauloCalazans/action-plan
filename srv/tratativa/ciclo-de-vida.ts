import cds from '@sap/cds';
import { agora } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa } from './bloqueio';
import { registrarHistorico, validarAutor } from './historico';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';
const MAX_JUSTIFICATIVA = 500;

interface Transicao { evento: string; justificativaObrigatoria: boolean }

/** R2-R5, R9: tabela fixa de transições, chave `<de>|<para>` (design tratativa, decisão 8). */
const TRANSICOES: Record<string, Transicao> = {
  'Aberta|Em andamento': { evento: 'MudancaStatus', justificativaObrigatoria: false },
  'Aberta|Encerrada': { evento: 'Encerramento', justificativaObrigatoria: false },
  'Aberta|Cancelada': { evento: 'Cancelamento', justificativaObrigatoria: true },
  'Em andamento|Encerrada': { evento: 'Encerramento', justificativaObrigatoria: false },
  'Em andamento|Cancelada': { evento: 'Cancelamento', justificativaObrigatoria: true },
  'Encerrada|Em andamento': { evento: 'Reabertura', justificativaObrigatoria: true },
};

/** Muda o Status identificando a operação pelo destino; Criticidade e Data prevista não mudam (R6). */
export async function mudarStatus(
  codigo: string,
  pedido: { status?: string | null; justificativa?: string | null },
  autor: Autor,
): Promise<void> {
  validarAutor(autor);
  const tratativa = await bloquearTratativa(codigo);

  // Decisão 8: ausente ou só espaços é 400; o valor enviado não é aparado (com espaços nas pontas fica fora da lista, 409).
  const destino = typeof pedido.status === 'string' ? pedido.status : '';
  if (!destino.trim()) recusar(400, 'O campo Status é obrigatório.', 'status');

  const transicao = TRANSICOES[`${tratativa.status}|${destino}`];
  if (!transicao) recusar(409, `Transição não permitida: de ${tratativa.status} para ${destino}.`, 'status');

  const justificativa = typeof pedido.justificativa === 'string' ? pedido.justificativa.trim() : '';
  if (transicao.justificativaObrigatoria && !justificativa) {
    recusar(400, 'O campo Justificativa é obrigatório para cancelar e reabrir.', 'justificativa');
  }
  if (justificativa.length > MAX_JUSTIFICATIVA) {
    recusar(400, `O campo Justificativa aceita no máximo ${MAX_JUSTIFICATIVA} caracteres.`, 'justificativa');
  }

  await cds.db.run(UPDATE(`${NS}.Tratativas`).set({ status: destino }).where({ codigo }));
  await registrarHistorico(
    codigo,
    autor,
    [{ evento: transicao.evento, campo: 'status', valorAnterior: tratativa.status, valorNovo: destino, justificativa: justificativa || null }],
    agora(),
  );
}
