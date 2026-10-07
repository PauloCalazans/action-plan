// Relógio único da plataforma (design abertura-por-apps-de-origem, decisão 8).
export const FUSO_PLATAFORMA = 'America/Sao_Paulo';

const formatoCivil = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_PLATAFORMA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function agora(): Date {
  return new Date();
}

/** Data civil `YYYY-MM-DD` do instante no fuso da plataforma. */
export function dataCivil(instante: Date): string {
  return formatoCivil.format(instante);
}
