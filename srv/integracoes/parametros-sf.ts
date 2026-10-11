import cds from '@sap/cds';

const TABELA = 'br.com.calazanstec.ParametrosIntegracaoSF';
const CHAVE_GLOBAL = 'GLOBAL';

export type DadosParametrosIntegracaoSF = {
  nivelUnidadeSF: string;
  nivelAreaSF: string;
};

type RegistroParametrosIntegracaoSF = DadosParametrosIntegracaoSF & { chave: string };

const PADRAO: DadosParametrosIntegracaoSF = {
  nivelUnidadeSF: 'BusinessUnit',
  nivelAreaSF: 'Department',
};

async function obterRegistro(): Promise<RegistroParametrosIntegracaoSF> {
  const existente = await cds.db.run(
    SELECT.one.from(TABELA).where({ chave: CHAVE_GLOBAL }),
  ) as RegistroParametrosIntegracaoSF | undefined;
  if (existente) return existente;

  const inicial = { chave: CHAVE_GLOBAL, ...PADRAO };
  await cds.db.run(INSERT.into(TABELA).entries(inicial));
  return inicial;
}

export async function consultarParametrosIntegracaoSF(): Promise<DadosParametrosIntegracaoSF> {
  const parametros = await obterRegistro();
  return {
    nivelUnidadeSF: parametros.nivelUnidadeSF,
    nivelAreaSF: parametros.nivelAreaSF,
  };
}

export async function atualizarParametrosIntegracaoSF(
  parametros: DadosParametrosIntegracaoSF,
): Promise<DadosParametrosIntegracaoSF> {
  await obterRegistro();
  await cds.db.run(
    UPDATE(TABELA).set(parametros).where({ chave: CHAVE_GLOBAL }),
  );
  return consultarParametrosIntegracaoSF();
}
