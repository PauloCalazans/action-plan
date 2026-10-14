import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import { normalizarMatricula } from './identidade';

const NS = 'br.com.calazanstec';
const PADRAO = '*';

interface LinhaTratativa {
  codigo: string;
  origemNormalizada: string | null;
}

interface LinhaParametro {
  origemNormalizada: string;
}

interface LinhaValidador {
  parametro_origemNormalizada: string;
  matricula: string;
}

interface ValidadoresPorOrigem {
  origem: Map<string, string[]>;
  padrao: string[];
}

async function lerValidadores(origens: string[]): Promise<ValidadoresPorOrigem> {
  const parametros = origens.length
    ? ((await cds.db.run(
        SELECT.from(`${NS}.ParametrosOrigem`)
          .columns('origemNormalizada')
          .where({ origemNormalizada: { in: origens } }),
      )) as LinhaParametro[])
    : [];
  const origensExistentes = parametros.map((linha) => linha.origemNormalizada);
  const linhas = origensExistentes.length
    ? ((await cds.db.run(
        SELECT.from(`${NS}.ValidadoresOrigem`)
          .columns('parametro_origemNormalizada', 'matricula')
          .where({ parametro_origemNormalizada: { in: origensExistentes } }),
      )) as LinhaValidador[])
    : [];

  const origem = new Map<string, string[]>();
  for (const linha of linhas) {
    const chave = linha.parametro_origemNormalizada;
    const lista = origem.get(chave) ?? [];
    lista.push(normalizarMatricula(linha.matricula));
    origem.set(chave, lista);
  }
  return {
    origem,
    padrao: origem.get(PADRAO) ?? [],
  };
}

function efetivos(origemNormalizada: string | null, validadores: ValidadoresPorOrigem): {
  lista: string[];
  fonte: 'Origem' | 'Padrao' | 'Nenhuma';
} {
  const listaOrigem = origemNormalizada ? validadores.origem.get(origemNormalizada) ?? [] : [];
  if (listaOrigem.length) return { lista: listaOrigem, fonte: 'Origem' };
  if (validadores.padrao.length) return { lista: validadores.padrao, fonte: 'Padrao' };
  return { lista: [], fonte: 'Nenhuma' };
}

export async function validadoresEfetivos(origemNormalizada: string | null): Promise<{
  lista: string[];
  fonte: 'Origem' | 'Padrao' | 'Nenhuma';
}> {
  const origens = [...new Set([...(origemNormalizada ? [origemNormalizada] : []), PADRAO])];
  return efetivos(origemNormalizada, await lerValidadores(origens));
}

export async function usuarioEhValidadorHabilitado(req: Request, codigoTratativa: string): Promise<boolean> {
  if (!req.user.is('ValidadorTecnico')) return false;
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('origemNormalizada').where({ codigo: codigoTratativa }),
  )) as { origemNormalizada: string | null } | undefined;
  if (!tratativa) return false;
  const { lista } = await validadoresEfetivos(tratativa.origemNormalizada);
  return lista.length === 0 || lista.includes(normalizarMatricula(req.user.id));
}

export async function tratativasComValidadorHabilitado(req: Request, codigos: string[]): Promise<Set<string>> {
  if (!req.user.is('ValidadorTecnico') || codigos.length === 0) return new Set();

  const tratativas = (await cds.db.run(
    SELECT.from(`${NS}.Tratativas`)
      .columns('codigo', 'origemNormalizada')
      .where({ codigo: { in: [...new Set(codigos)] } }),
  )) as LinhaTratativa[];
  const origens = [...new Set([
    PADRAO,
    ...tratativas.map((tratativa) => tratativa.origemNormalizada).filter((origem): origem is string => !!origem),
  ])];
  const validadores = await lerValidadores(origens);
  const matricula = normalizarMatricula(req.user.id);
  const habilitadas = new Set<string>();

  for (const tratativa of tratativas) {
    const { lista } = efetivos(tratativa.origemNormalizada, validadores);
    if (lista.length === 0 || lista.includes(matricula)) habilitadas.add(tratativa.codigo);
  }
  return habilitadas;
}
