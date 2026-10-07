// Fixa só o Date (decisão 8 do design): os demais temporizadores continuam reais para o cds.test responder.
const NAO_FALSIFICAR = [
  'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
  'clearInterval', 'setTimeout', 'clearTimeout',
] as const;

export function fixarInstante(iso: string): void {
  const now = new Date(iso);
  jest.useFakeTimers({ now, doNotFake: [...NAO_FALSIFICAR] });
}

export function liberarRelogio(): void {
  jest.useRealTimers();
}
