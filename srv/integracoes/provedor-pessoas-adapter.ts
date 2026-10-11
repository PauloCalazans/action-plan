import cds from '@sap/cds';

export default class ProvedorPessoasAdapter extends cds.Service {
  init() {
    this.on('obterColaborador', () => {
      throw new Error('O provedor SuccessFactors de pessoas não está configurado.');
    });
    this.on('buscarColaboradores', () => {
      throw new Error('O provedor SuccessFactors de pessoas não está configurado.');
    });
    return super.init();
  }
}
