import cds from '@sap/cds';

async function enviarEmail(_destinatario: string, _assunto: string, _corpo: string): Promise<void> {
  void [_destinatario, _assunto, _corpo];
  throw new Error('Adaptador de e-mail de produção não configurado.');
}

export default class EmailAdapter extends cds.Service {
  init() {
    this.on('enviarEmail', (req) => enviarEmail(
      req.data.destinatario,
      req.data.assunto,
      req.data.corpo,
    ));
    return super.init();
  }
}
