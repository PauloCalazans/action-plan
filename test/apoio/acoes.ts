import { type Envia } from './tratativas';

// Funções POST do cds.test para as actions de Ação; devolvem a resposta HTTP crua (sem asserções).
const BASE = '/api/tratativa/v1';

export function criarAcao(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown) {
  return POST(`${BASE}/Tratativas(${tratativa})/criarAcao`, dados, como);
}

export function criarSubacao(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown) {
  return POST(`${BASE}/Tratativas(${tratativa})/criarSubacao`, dados, como);
}
