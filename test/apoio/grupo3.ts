export interface RespostaGrupo3 {
  status: number;
  data: unknown;
  headers?: Record<string, unknown>;
}

export interface LinhaGrupo3 {
  [campo: string]: unknown;
}

export function itensOData(dados: unknown): LinhaGrupo3[] {
  const corpo = dados as { value?: LinhaGrupo3[] };
  return Array.isArray(corpo?.value) ? corpo.value : [];
}

export function erroOData(dados: unknown): { message?: string; target?: string } {
  return (dados as { error?: { message?: string; target?: string } }).error ?? {};
}

let contadorGrupo3 = 0;

export function proximaChaveGrupo3(): string {
  contadorGrupo3 += 1;
  return `${Date.now()}-${contadorGrupo3}`;
}
