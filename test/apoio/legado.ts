import cds from '@sap/cds';
import { join } from 'node:path';
import { criarAvulsa, type Envia } from './tratativas';

const RAIZ = join(__dirname, '..', '..');
const { POST } = cds.test(RAIZ);
const enviar = POST as unknown as Envia;

export async function semearTratativaEncerradaLegada(): Promise<string> {
  const criada = await criarAvulsa(enviar, { titulo: `Tratativa legada ${Date.now()}` });
  if (criada.status !== 200) {
    throw new Error(`Falha ao criar Tratativa legada: HTTP ${criada.status}.`);
  }
  const codigo = criada.data.codigo as string;
  await cds.db.run(
    UPDATE.entity('br.com.calazanstec.Tratativas')
      .set({ status: 'Encerrada' })
      .where({ codigo }),
  );
  return codigo;
}
