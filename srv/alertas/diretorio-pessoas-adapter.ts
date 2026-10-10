import cds from '@sap/cds';
import type { DadosColaboradorSF } from '../integracoes/portas-sf';
import { obterColaboradorEmCache, guardarColaboradorEmCache } from '../integracoes/cache-pessoas';

function paraPessoaAtiva(colaborador: DadosColaboradorSF | null): { email: string; teamsId: string } | null {
  if (!colaborador || colaborador.situacao !== 'Ativo') return null;
  return { email: colaborador.email, teamsId: colaborador.email };
}

async function resolverPessoa(matricula: string): Promise<{ email: string; teamsId: string } | null> {
  const emCache = obterColaboradorEmCache(matricula);
  if (emCache) return paraPessoaAtiva(emCache);

  try {
    const provedor = await cds.connect.to('ProvedorPessoasAdapter');
    const colaborador = await provedor.send('obterColaborador', { matricula }) as DadosColaboradorSF | null;
    if (colaborador) guardarColaboradorEmCache(colaborador);
    return paraPessoaAtiva(colaborador);
  } catch {
    return paraPessoaAtiva(obterColaboradorEmCache(matricula) ?? null);
  }
}

export default class DiretorioPessoasAdapter extends cds.Service {
  init() {
    this.on('resolverPessoa', (req) => resolverPessoa(req.data.matricula));
    return super.init();
  }
}
