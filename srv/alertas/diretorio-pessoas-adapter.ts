import cds from '@sap/cds';

async function resolverPessoa(matricula: string): Promise<{ email: string; teamsId: string }> {
  const endereco = `${matricula.toLowerCase()}@empresa.com`;
  return { email: endereco, teamsId: endereco };
}

export default class DiretorioPessoasAdapter extends cds.Service {
  init() {
    this.on('resolverPessoa', (req) => resolverPessoa(req.data.matricula));
    return super.init();
  }
}
