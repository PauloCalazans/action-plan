import cds from '@sap/cds';

async function enviarMensagem(
  _destinatarioTeamsId: string,
  _titulo: string,
  _corpo: string,
): Promise<void> {
  void [_destinatarioTeamsId, _titulo, _corpo];
  throw new Error('Adaptador de Teams de produção não configurado.');
}

export default class TeamsAdapter extends cds.Service {
  init() {
    this.on('enviarMensagem', (req) => enviarMensagem(
      req.data.destinatarioTeamsId,
      req.data.titulo,
      req.data.corpo,
    ));
    return super.init();
  }
}
