import { type Envia, type Resposta } from './tratativas';

const BASE = '/api/tratativa/v1';

// Funções GET do cds.test para a leitura; sem `tratativa` (null) a URL omite o parâmetro.
export type Consulta = (url: string, opcoes?: unknown) => Promise<Resposta>;

// Helper para action atribuirResponsavelPrincipal
export function atribuirResponsavelPrincipal(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/atribuirResponsavelPrincipal`, dados, como);
}

// Helper para action incluirParticipante
export function incluirParticipante(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/incluirParticipante`, dados, como);
}

// Helper para action removerParticipante
export function removerParticipante(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/removerParticipante`, dados, como);
}

// Helper para function consultarResponsaveis
export function consultarResponsaveis(GET: Consulta, tratativa: string, como: unknown): Promise<Resposta> {
  return GET(`${BASE}/consultarResponsaveis(tratativa=${tratativa})`, como);
}

// Helper para function consultarTratativa (já existe em tratativas.ts, mas refazemos para manter consistência)
export function consultarTratativa(GET: Consulta, tratativa: string, como: unknown): Promise<Resposta> {
  return GET(`${BASE}/consultarTratativa(codigo=${tratativa})`, como);
}

// Helper para function listarTratativas
export function listarTratativas(GET: Consulta, params: Record<string, unknown> = {}, como: unknown): Promise<Resposta> {
  const parametros = Object.entries(params)
    .map(([chave, valor]) => `${chave}=${valor}`)
    .join(',');
  const url = parametros ? `${BASE}/listarTratativas(${parametros})` : `${BASE}/listarTratativas()`;
  return GET(url, como);
}

// Helper para action delegarAcao
export function delegarAcao(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/delegarAcao`, dados, como);
}

// Helper para function minhasAcoes
export async function minhasAcoes(GET: Consulta, params: Record<string, unknown> = {}, como: unknown): Promise<Resposta> {
  const parametros = Object.entries(params)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([chave, valor]) => `${chave}=${encodeURIComponent(String(valor))}`)
    .join(',');
  const url = parametros ? `${BASE}/minhasAcoes(${parametros})` : `${BASE}/minhasAcoes()`;
  const r = await GET(url, como);
  // Extrair .value do OData many se presente
  const dataValue = r.data?.value !== undefined ? r.data.value : r.data;
  return {
    status: r.status,
    data: dataValue
  };
}

// Helper para function minhasTratativas
export async function minhasTratativas(GET: Consulta, params: Record<string, unknown> = {}, como: unknown): Promise<Resposta> {
  const parametros = Object.entries(params)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([chave, valor]) => `${chave}=${encodeURIComponent(String(valor))}`)
    .join(',');
  const url = parametros ? `${BASE}/minhasTratativas(${parametros})` : `${BASE}/minhasTratativas()`;
  const r = await GET(url, como);
  // Extrair .value do OData many se presente
  const dataValue = r.data?.value !== undefined ? r.data.value : r.data;
  return {
    status: r.status,
    data: dataValue
  };
}