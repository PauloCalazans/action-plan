import cds from '@sap/cds';

const NS = 'br.com.calazanstec';

/** Valores de um enum do modelo (o valor explícito quando há, senão o nome). */
function valoresDoEnum(tipo: string): string[] {
  const def = cds.model?.definitions?.[`${NS}.${tipo}`] as { enum?: Record<string, { val?: string }> } | undefined;
  return Object.entries(def?.enum ?? {}).map(([nome, item]) => item?.val ?? nome);
}

export const criticidadesValidas = (): string[] => valoresDoEnum('Criticidade');
export const statusValidos = (): string[] => valoresDoEnum('StatusTratativa');
export const tiposAutorValidos = (): string[] => valoresDoEnum('TipoAutor');
