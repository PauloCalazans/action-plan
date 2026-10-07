import cds from '@sap/cds';

const NS = 'br.com.calazanstec';

/** H3/decisão 3: só a Origem é normalizada (sem espaços nas pontas, minúsculas, acentos preservados). */
export function normalizarOrigem(origem: string): string {
  return origem.trim().toLowerCase();
}

/** Devolve o Código da Tratativa já aberta para o par, ou nada. O idOrigem é comparado exatamente. */
export async function buscarPorPar(origem: string, idOrigem: string): Promise<string | undefined> {
  const linha = await cds.db.run(
    SELECT.one.from(`${NS}.ChavesOrigem`).columns('tratativa_codigo').where({
      origemNormalizada: normalizarOrigem(origem),
      idOrigem,
    }),
  );
  return linha?.tratativa_codigo;
}

/** Reserva o par para a Tratativa; false se a chave primária já existia (corrida ou repetição). */
export async function reservarPar(origem: string, idOrigem: string, codigo: string): Promise<boolean> {
  try {
    await cds.db.run(
      INSERT.into(`${NS}.ChavesOrigem`).entries({
        origemNormalizada: normalizarOrigem(origem),
        idOrigem,
        tratativa_codigo: codigo,
      }),
    );
    return true;
  } catch (erro) {
    if (await buscarPorPar(origem, idOrigem)) return false;
    throw erro;
  }
}
