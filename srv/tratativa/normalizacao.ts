/** R24: trim + minúsculas (acentos preservados); vazio vira null. Igual nos dois bancos, ao contrário do `lower()` do SQL. */
export function normalizarTexto(valor?: string | null): string | null {
  if (typeof valor !== 'string') return null;
  const normalizado = valor.trim().toLowerCase();
  return normalizado === '' ? null : normalizado;
}
