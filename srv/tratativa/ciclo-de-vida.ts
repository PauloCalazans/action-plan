import cds from '@sap/cds';
import { agora } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa } from './bloqueio';
import { lerSituacaoAval } from './aval-tecnico';
import { registrarHistorico, validarAutor } from './historico';
import { validarJustificativa } from './justificativa';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

interface Transicao { evento: string; justificativaObrigatoria: boolean }

/** R2-R5, R9: tabela fixa de transições, chave `<de>|<para>` (design tratativa, decisão 8). */
const TRANSICOES: Record<string, Transicao> = {
  'Aberta|Em andamento': { evento: 'MudancaStatus', justificativaObrigatoria: false },
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

  if (tratativa.status === 'Aberta' && destino === 'Encerrada') {
    recusar(
      409,
      'Tratativa em status Aberta não pode ser encerrada diretamente: deve transitar para Em andamento e receber Aval Técnico aprovado.',
      'status',
    );
  }
  const transicao = TRANSICOES[`${tratativa.status}|${destino}`];
  if (!transicao) recusar(409, `Transição não permitida: de ${tratativa.status} para ${destino}.`, 'status');

  // R16 (004): encerrar exige todas as Ações e Subações concluídas ou canceladas; vem antes da justificativa (M4).
  if (destino === 'Encerrada') {
    const abertas = await cds.db.run(
      SELECT.one.from(`${NS}.Acoes`).columns('codigo')
        .where({ tratativa_codigo: codigo, status: { 'not in': ['Concluída', 'Cancelada'] } }),
    );
    if (abertas) recusar(409, 'Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.');
    const situacao = (await lerSituacaoAval([codigo])).get(codigo);
    if (!situacao?.aprovadoVigente) {
      const mensagem = situacao?.houveReabertura
        ? 'Tratativa não pode ser encerrada: exige novo Aval Técnico aprovado emitido após a reabertura.'
        : 'Tratativa não pode ser encerrada: exige Aval Técnico aprovado.';
      recusar(409, mensagem);
    }
  }

  const justificativa = validarJustificativa(pedido.justificativa, transicao.justificativaObrigatoria);

  await cds.db.run(UPDATE(`${NS}.Tratativas`).set({ status: destino }).where({ codigo }));
  await registrarHistorico(
    codigo,
    autor,
    [{ evento: transicao.evento, campo: 'status', valorAnterior: tratativa.status, valorNovo: destino, justificativa: justificativa || null }],
    agora(),
  );
}
