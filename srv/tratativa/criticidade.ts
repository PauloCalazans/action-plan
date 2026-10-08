import cds from '@sap/cds';
import { agora } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { criticidadesValidas } from './dominios';
import { registrarHistorico, validarAutor } from './historico';
import { diasDoPrazo, somarDiasCorridos } from './prazo';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

/**
 * R12, R14, R18-R20: nova Criticidade recalcula a Data prevista desde a criação original e grava o histórico.
 * Ordem da decisão 10: autor, bloqueio (404), estado (409), Criticidade (400), mesma Criticidade, recálculo.
 */
export async function alterarCriticidade(codigo: string, nova: string | null | undefined, autor: Autor): Promise<void> {
  validarAutor(autor);
  const tratativa = await bloquearTratativa(codigo);
  exigirAlteravel(tratativa);
  if (typeof nova !== 'string' || !criticidadesValidas().includes(nova)) {
    recusar(400, 'Criticidade inválida: use Baixa, Média, Alta ou Crítica.', 'criticidade');
  }
  if (tratativa.criticidade === nova) return;

  const novaData = somarDiasCorridos(tratativa.dataCriacao, await diasDoPrazo(nova));
  await cds.db.run(UPDATE(`${NS}.Tratativas`).set({ criticidade: nova, dataPrevistaConclusao: novaData }).where({ codigo }));
  await registrarHistorico(
    codigo,
    autor,
    [
      { evento: 'AlteracaoCriticidade', campo: 'criticidade', valorAnterior: tratativa.criticidade, valorNovo: nova },
      { evento: 'AlteracaoCriticidade', campo: 'dataPrevistaConclusao', valorAnterior: tratativa.dataPrevistaConclusao, valorNovo: novaData },
    ],
    agora(),
  );
}
