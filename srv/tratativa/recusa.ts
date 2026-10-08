/** Recusa com status HTTP, código e, quando há, o campo (`target`); contrato de erros do design tratativa (D10). */
export function recusar(status: number, message: string, target?: string): never {
  throw Object.assign(new Error(message), { status, code: status, ...(target ? { target } : {}) });
}
