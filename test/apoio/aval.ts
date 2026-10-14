import { type Envia, type Resposta } from './tratativas';

const BASE = '/api/tratativa/v1';
const aceitaQualquerStatus = { validateStatus: () => true };
const como = (username: string) => ({ auth: { username, password: '' }, ...aceitaQualquerStatus });

export const comoValidador = como('validador');
export const comoValidadorB = como('validador-b');

export function emitirAval(
  POST: Envia,
  tratativa: string,
  dados: Record<string, unknown>,
  identidade: unknown,
): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/emitirAvalTecnico`, dados, identidade);
}

export function consultarAval(
  GET: (url: string, identidade?: unknown) => Promise<Resposta>,
  tratativa: string,
  identidade: unknown,
): Promise<Resposta> {
  return GET(`${BASE}/consultarAvalTecnicoTratativa(codigoTratativa=${tratativa})`, identidade);
}
