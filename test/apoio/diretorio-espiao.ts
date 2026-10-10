import cds from '@sap/cds';

type Pessoa = { email: string; teamsId: string };

const pessoas = new Map<string, Pessoa>();
const matriculasComFalha = new Set<string>();

async function resolverPessoa(matricula: string): Promise<Pessoa | null> {
  const chave = matricula.toLowerCase();
  if (matriculasComFalha.has(chave)) return null;
  return pessoas.get(chave) ?? {
    email: `${chave}@empresa.com`,
    teamsId: `${chave}@empresa.com`,
  };
}

export function definirPessoaDiretorio(matricula: string, pessoa: Pessoa): void {
  pessoas.set(matricula.toLowerCase(), pessoa);
  matriculasComFalha.delete(matricula.toLowerCase());
}

export function simularFalhaMatricula(matricula: string): void {
  matriculasComFalha.add(matricula.toLowerCase());
}

export function limparDiretorio(): void {
  pessoas.clear();
  matriculasComFalha.clear();
}

export default class DiretorioEspiao extends cds.Service {
  init() {
    this.on('resolverPessoa', (req) => resolverPessoa(req.data.matricula));
    return super.init();
  }
}
