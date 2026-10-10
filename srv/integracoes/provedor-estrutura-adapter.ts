import cds from '@sap/cds';

export default class ProvedorEstruturaAdapter extends cds.Service {
  init() {
    this.on('listarEstrutura', () => {
      throw new Error('O provedor SuccessFactors de estrutura não está configurado.');
    });
    return super.init();
  }
}
