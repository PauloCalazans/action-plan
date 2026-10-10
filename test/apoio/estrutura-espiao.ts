import cds from '@sap/cds';

type DadosUnidadeSF = {
  codigoUnidade: string;
  nomeUnidade: string;
  areas: Array<{
    codigoArea: string;
    nomeArea: string;
    ativa: boolean;
  }>;
};

type ModoFalha = 'falha' | 'timeout' | null;

let estrutura: DadosUnidadeSF[] = [];
let modoFalha: ModoFalha = null;

function falharSeConfigurado(): void {
  if (modoFalha === 'timeout') throw new Error('Timeout simulado no provedor SuccessFactors de estrutura.');
  if (modoFalha === 'falha') throw new Error('Falha simulada no provedor SuccessFactors de estrutura.');
}

export function definirEstrutura(dados: DadosUnidadeSF[]): void {
  estrutura = dados;
}

export function simularFalhaProvedor(): void {
  modoFalha = 'falha';
}

export function simularTimeoutProvedor(): void {
  modoFalha = 'timeout';
}

export function limparProvedor(): void {
  estrutura = [];
  modoFalha = null;
}

export default class EstruturaEspiao extends cds.Service {
  init() {
    this.on('listarEstrutura', () => {
      falharSeConfigurado();
      return estrutura;
    });
    return super.init();
  }
}
