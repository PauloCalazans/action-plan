import { recusar } from './recusa';

export const MAX_JUSTIFICATIVA = 500;

/**
 * Justificativa do pedido de transição (Tratativa e Ação): aparada; obrigatória em cancelar e reabrir; até 500 caracteres.
 * Módulo neutro compartilhado: Tratativa (003) e Ações (004) não se importam entre si (revisao-design-parecer.md M3).
 * R7, R8 (spec responsaveis-e-participantes): parametrização de mensagens por operação.
 * @param valor - Justificativa fornecida
 * @param operacao - Operação sendo executada (string com texto ou boolean para compatibilidade)
 * @returns Justificativa aparada ou string vazia
 */
export function validarJustificativa(valor: unknown, operacao: string | boolean = 'para cancelar e reabrir'): string {
  const justificativa = typeof valor === 'string' ? valor.trim() : '';
  
  // Compatibilidade com boolean (uso antigo)
  if (typeof operacao === 'boolean') {
    if (operacao && !justificativa) {
      recusar(400, 'O campo Justificativa é obrigatório para cancelar e reabrir.', 'justificativa');
    }
  } else {
    // Uso novo com string de operação
    if (operacao !== 'opcional' && !justificativa) {
      recusar(400, `O campo Justificativa é obrigatório ${operacao}.`, 'justificativa');
    }
  }
  
  if (justificativa.length > MAX_JUSTIFICATIVA) {
    recusar(400, `O campo Justificativa aceita no máximo ${MAX_JUSTIFICATIVA} caracteres.`, 'justificativa');
  }
  return justificativa;
}
