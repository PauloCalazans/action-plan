import cds from '@sap/cds';

// Lê direto do banco (cds.db), sem passar pelos serviços. `entidade` sem o namespace.
export async function linhas(entidade: string, where?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const consulta = SELECT.from(`br.com.calazanstec.${entidade}`);
  if (where) consulta.where(where);
  return (await cds.db.run(consulta)) as Record<string, unknown>[];
}
