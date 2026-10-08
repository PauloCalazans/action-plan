import { type Envia, type Resposta } from './tratativas';

// Funções POST do cds.test para as actions de Ação; devolvem a resposta HTTP crua (sem asserções).
const BASE = '/api/tratativa/v1';

export function criarAcao(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown) {
  return POST(`${BASE}/Tratativas(${tratativa})/criarAcao`, dados, como);
}

export function criarSubacao(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown) {
  return POST(`${BASE}/Tratativas(${tratativa})/criarSubacao`, dados, como);
}

// Transição de Ação (R6-R12): `dados` leva o Código da Ação em `acao`, o Status de destino e a justificativa.
export function mudarStatusAcao(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown) {
  return POST(`${BASE}/Tratativas(${tratativa})/mudarStatusAcao`, dados, como);
}

// Funções GET do cds.test para a leitura de Ações; sem `tratativa` (null) a URL omite o parâmetro.
export type Consulta = (url: string, opcoes?: unknown) => Promise<Resposta>;

export function consultarEstruturaAcoes(GET: Consulta, tratativa: string | null, como: unknown) {
  const parametro = tratativa === null ? '' : `tratativa=${tratativa}`;
  return GET(`${BASE}/consultarEstruturaAcoes(${parametro})`, como);
}

export function consultarAcao(GET: Consulta, tratativa: string | null, codigo: string | null, como: unknown) {
  const parametros = [
    tratativa === null ? null : `tratativa=${tratativa}`,
    codigo === null ? null : `codigo=${codigo}`,
  ].filter(Boolean);
  return GET(`${BASE}/consultarAcao(${parametros.join(',')})`, como);
}
