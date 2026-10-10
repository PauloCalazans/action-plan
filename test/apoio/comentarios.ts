import { type Envia, type Resposta } from './tratativas';

const BASE = '/api/tratativa/v1';

// Funções POST do cds.test para as actions de comentários; devolvem a resposta HTTP crua (sem asserções).

export function comentarTratativa(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/comentarTratativa`, dados, como);
}

export function comentarAcao(POST: Envia, tratativa: string, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/comentarAcao`, dados, como);
}

// Funções GET do cds.test para a leitura de comentários; devolvem a resposta HTTP crua.
export type Consulta = (url: string, opcoes?: unknown) => Promise<Resposta>;

export async function listarComentariosTratativa(GET: Consulta, params: Record<string, unknown>, como: unknown): Promise<Resposta> {
  const parametros = Object.entries(params)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([chave, valor]) => {
      // UUID sem aspas
      if (chave === 'tratativa') return `${chave}=${valor}`;
      // Inteiros sem aspas
      return `${chave}=${valor}`;
    })
    .join(',');
  const url = `${BASE}/listarComentariosTratativa(${parametros})`;
  const r = await GET(url, como);
  // Extrair .value do OData many se presente
  const dataValue = r.data?.value !== undefined ? r.data.value : r.data;
  return {
    status: r.status,
    data: dataValue
  };
}

export async function listarComentariosAcao(GET: Consulta, params: Record<string, unknown>, como: unknown): Promise<Resposta> {
  const parametros = Object.entries(params)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([chave, valor]) => {
      // UUID sem aspas
      if (chave === 'tratativa' || chave === 'acao') return `${chave}=${valor}`;
      // Inteiros sem aspas
      return `${chave}=${valor}`;
    })
    .join(',');
  const url = `${BASE}/listarComentariosAcao(${parametros})`;
  const r = await GET(url, como);
  // Extrair .value do OData many se presente
  const dataValue = r.data?.value !== undefined ? r.data.value : r.data;
  return {
    status: r.status,
    data: dataValue
  };
}
