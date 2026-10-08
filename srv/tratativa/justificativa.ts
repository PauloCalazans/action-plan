import { recusar } from './recusa';

export const MAX_JUSTIFICATIVA = 500;

/**
 * Justificativa do pedido de transição (Tratativa e Ação): aparada; obrigatória em cancelar e reabrir; até 500 caracteres.
 * Módulo neutro compartilhado: Tratativa (003) e Ações (004) não se importam entre si (revisao-design-parecer.md M3).
 */
export function validarJustificativa(valor: unknown, obrigatoria: boolean): string {
  const justificativa = typeof valor === 'string' ? valor.trim() : '';
  if (obrigatoria && !justificativa) {
    recusar(400, 'O campo Justificativa é obrigatório para cancelar e reabrir.', 'justificativa');
  }
  if (justificativa.length > MAX_JUSTIFICATIVA) {
    recusar(400, `O campo Justificativa aceita no máximo ${MAX_JUSTIFICATIVA} caracteres.`, 'justificativa');
  }
  return justificativa;
}
