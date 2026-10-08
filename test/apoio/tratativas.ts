import { comoApp, comoUsuario } from './usuarios';

// Funções POST/GET do cds.test do arquivo; devolvem a resposta HTTP crua.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Resposta = { status: number; data: any };
export type Envia = (url: string, dados?: unknown, opcoes?: unknown) => Promise<Resposta>;

const BASE = '/api/tratativa/v1';

let contador = 0;
export const sufixoUnico = () => `${Date.now()}-${++contador}`;

export function criarAvulsa(POST: Envia, dados: Record<string, unknown> = {}): Promise<Resposta> {
  return POST(`${BASE}/criarTratativaAvulsa`, { titulo: 'Título avulso', criticidade: 'Alta', ...dados }, comoUsuario);
}

export function abrirPorApp(POST: Envia, dados: Record<string, unknown> = {}): Promise<Resposta> {
  return POST(
    '/api/integracao-origem/v1/abrirTratativa',
    { origem: 'Advertência', idOrigem: `ADV-${sufixoUnico()}`, titulo: 'Título de app', criticidade: 'Alta', ...dados },
    comoApp,
  );
}

export function mudarStatus(
  POST: Envia,
  codigo: string,
  corpo: Record<string, unknown>,
  como: unknown,
): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${codigo})/mudarStatus`, corpo, como);
}

export function editar(
  POST: Envia,
  codigo: string,
  corpo: Record<string, unknown>,
  como: unknown,
): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${codigo})/editar`, corpo, como);
}

export function mudarCriticidade(
  POST: Envia,
  codigo: string,
  corpo: Record<string, unknown>,
  como: unknown,
): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${codigo})/mudarCriticidade`, corpo, como);
}
