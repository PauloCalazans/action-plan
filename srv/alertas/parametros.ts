import cds from '@sap/cds';

const NS = 'br.com.calazanstec';
const TABELA = `${NS}.ParametrosAlertas`;
const CHAVE_GLOBAL = 'GLOBAL';

export type DadosParametrosAlertas = {
  diasAntecedenciaPrazoProximo: number;
  diasInatividade: number;
  emailHabilitado: boolean;
  teamsHabilitado: boolean;
  horaExecucaoUtc: number;
};

type RegistroParametrosAlertas = DadosParametrosAlertas & { chave: string };

const PADRAO: DadosParametrosAlertas = {
  diasAntecedenciaPrazoProximo: 3,
  diasInatividade: 15,
  emailHabilitado: true,
  teamsHabilitado: true,
  horaExecucaoUtc: 8,
};

async function obterRegistro(): Promise<RegistroParametrosAlertas> {
  const existente = await cds.db.run(
    SELECT.one.from(TABELA).where({ chave: CHAVE_GLOBAL }),
  ) as RegistroParametrosAlertas | undefined;
  if (existente) return existente;

  const inicial = { chave: CHAVE_GLOBAL, ...PADRAO };
  await cds.db.run(INSERT.into(TABELA).entries(inicial));
  return inicial;
}

export async function consultarParametrosAlertas(): Promise<DadosParametrosAlertas> {
  const parametros = await obterRegistro();
  return {
    diasAntecedenciaPrazoProximo: parametros.diasAntecedenciaPrazoProximo,
    diasInatividade: parametros.diasInatividade,
    emailHabilitado: parametros.emailHabilitado,
    teamsHabilitado: parametros.teamsHabilitado,
    horaExecucaoUtc: parametros.horaExecucaoUtc,
  };
}

export async function atualizarParametrosAlertas(
  parametros: DadosParametrosAlertas,
): Promise<DadosParametrosAlertas> {
  await obterRegistro();
  await cds.db.run(
    UPDATE(TABELA).set(parametros).where({ chave: CHAVE_GLOBAL }),
  );
  return consultarParametrosAlertas();
}
