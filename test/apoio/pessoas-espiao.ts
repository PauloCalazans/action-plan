import cds from '@sap/cds';

type DadosColaboradorSF = {
  matricula: string;
  nome: string;
  email: string;
  codigoUnidade: string;
  codigoArea: string;
  matriculaGestor: string | null;
  situacao: 'Ativo' | 'Inativo';
};

type FiltroColaboradoresSF = {
  termo?: string;
  codigoUnidade?: string;
  codigoArea?: string;
  apenasAtivos?: boolean;
};

type ModoFalha = 'falha' | 'timeout' | null;

const colaboradores: DadosColaboradorSF[] = [];
let modoFalha: ModoFalha = null;

function falharSeConfigurado(): void {
  if (modoFalha === 'timeout') throw new Error('Timeout simulado no provedor SuccessFactors de pessoas.');
  if (modoFalha === 'falha') throw new Error('Falha simulada no provedor SuccessFactors de pessoas.');
}

export function definirColaboradores(dados: DadosColaboradorSF[]): void {
  colaboradores.splice(0, colaboradores.length, ...dados);
}

export function simularFalhaProvedor(): void {
  modoFalha = 'falha';
}

export function simularTimeoutProvedor(): void {
  modoFalha = 'timeout';
}

export function limparProvedor(): void {
  colaboradores.length = 0;
  modoFalha = null;
}

export default class PessoasEspiao extends cds.Service {
  init() {
    this.on('obterColaborador', (req) => {
      falharSeConfigurado();
      return colaboradores.find((item) => item.matricula === req.data.matricula) ?? null;
    });
    this.on('buscarColaboradores', (req) => {
      falharSeConfigurado();
      const filtro = req.data as FiltroColaboradoresSF;
      return colaboradores.filter((item) => (
        (!filtro.termo || item.nome.toLowerCase().includes(filtro.termo.toLowerCase()))
        && (!filtro.codigoUnidade || item.codigoUnidade === filtro.codigoUnidade)
        && (!filtro.codigoArea || item.codigoArea === filtro.codigoArea)
        && (!filtro.apenasAtivos || item.situacao === 'Ativo')
      ));
    });
    return super.init();
  }
}
