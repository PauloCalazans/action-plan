import cds from '@sap/cds';
import { randomUUID } from 'node:crypto';

// Semeia direto no banco já servido pelo cds.test do arquivo de teste (sem segundo servidor).
// Cenário: Tratativa já Encerrada antes do 016, sem Aval.
export async function semearTratativaEncerradaLegada(): Promise<string> {
  const codigo = randomUUID();
  const hoje = new Date().toISOString();
  await cds.db.run(
    INSERT.into('br.com.calazanstec.Tratativas').entries({
      codigo,
      titulo: `Tratativa legada ${Date.now()}`,
      criticidade: 'Média',
      status: 'Encerrada',
      dataCriacao: hoje.slice(0, 10),
      dataPrevistaConclusao: hoje.slice(0, 10),
      criadoEm: hoje,
    }),
  );
  return codigo;
}
