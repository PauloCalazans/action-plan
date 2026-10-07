import cds from '@sap/cds';
import { agora } from '../lib/relogio';
import type { Autor } from './abertura';
import { diasDoPrazo, somarDiasCorridos } from './prazo';

const NS = 'br.com.calazanstec';

function recusar(status: number, message: string, target?: string): never {
  throw Object.assign(new Error(message), { status, code: status, ...(target ? { target } : {}) });
}

function criticidadesValidas(): string[] {
  const def = cds.model?.definitions?.[`${NS}.Criticidade`] as { enum?: Record<string, { val?: string }> } | undefined;
  return Object.entries(def?.enum ?? {}).map(([nome, item]) => item?.val ?? nome);
}

/** R12: nova Criticidade recalcula a Data prevista desde a criação original e grava o histórico. */
export async function alterarCriticidade(codigo: string, nova: string, autor: Autor): Promise<void> {
  if (typeof nova !== 'string' || !criticidadesValidas().includes(nova)) {
    recusar(400, 'Criticidade inválida: use Baixa, Média, Alta ou Crítica.', 'criticidade');
  }
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('criticidade', 'dataCriacao', 'dataPrevistaConclusao').where({ codigo }),
  )) as { criticidade: string; dataCriacao: string; dataPrevistaConclusao: string } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');
  if (tratativa.criticidade === nova) return;

  const novaData = somarDiasCorridos(tratativa.dataCriacao, await diasDoPrazo(nova));
  const quando = agora().toISOString();
  await cds.db.run(UPDATE(`${NS}.Tratativas`).set({ criticidade: nova, dataPrevistaConclusao: novaData }).where({ codigo }));

  const linha = (campo: string, valorAnterior: string, valorNovo: string) => ({
    ID: cds.utils.uuid(),
    tratativa_codigo: codigo,
    evento: 'AlteracaoCriticidade',
    campo,
    valorAnterior,
    valorNovo,
    autor: autor.id,
    tipoAutor: autor.tipo,
    quando,
  });
  await cds.db.run(
    INSERT.into(`${NS}.HistoricoTratativa`).entries([
      linha('criticidade', tratativa.criticidade, nova),
      linha('dataPrevistaConclusao', tratativa.dataPrevistaConclusao, novaData),
    ]),
  );
}
