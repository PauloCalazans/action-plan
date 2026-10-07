import cds from '@sap/cds';
import { buscarPorPar } from './chave-origem';

const NS = 'br.com.calazanstec';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConsultaTratativa {
  codigo: string; origem: string | null; idOrigem: string | null; criticidade: string;
  status: string; dataCriacao: string; dataPrevistaConclusao: string;
}

/** Decisão 14: o runtime não valida o formato do UUID; quem chama responde 400 quando falso. */
export const codigoValido = (codigo: string): boolean => UUID.test(codigo);

/** R19: só os sete campos públicos (LGPD, N3-6/N3-8); nunca lista Tratativas. */
export async function consultarPorCodigo(codigo: string): Promise<ConsultaTratativa | undefined> {
  return cds.db.run(
    SELECT.one
      .from(`${NS}.Tratativas`)
      .columns('codigo', 'origem', 'idOrigem', 'criticidade', 'status', 'dataCriacao', 'dataPrevistaConclusao')
      .where({ codigo }),
  );
}

export async function consultarPorOrigem(origem: string, idOrigem: string): Promise<ConsultaTratativa | undefined> {
  const codigo = await buscarPorPar(origem, idOrigem);
  return codigo ? consultarPorCodigo(codigo) : undefined;
}
