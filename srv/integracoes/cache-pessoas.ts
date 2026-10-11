import type { DadosColaboradorSF } from './portas-sf';

const TTL_CACHE_PESSOAS_MS = 15 * 60 * 1000;

const colaboradores = new Map<string, { dado: DadosColaboradorSF; expiraEm: number }>();

export function obterColaboradorEmCache(matricula: string): DadosColaboradorSF | undefined {
  const entrada = colaboradores.get(matricula);
  if (!entrada) return undefined;

  if (entrada.expiraEm <= Date.now()) {
    colaboradores.delete(matricula);
    return undefined;
  }

  return entrada.dado;
}

export function guardarColaboradorEmCache(colaborador: DadosColaboradorSF): void {
  colaboradores.set(colaborador.matricula, {
    dado: colaborador,
    expiraEm: Date.now() + TTL_CACHE_PESSOAS_MS,
  });
}
