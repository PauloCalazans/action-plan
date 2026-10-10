import cds from '@sap/cds';

type EnvioTeams = {
  destinatarioTeamsId: string;
  titulo: string;
  corpo: string;
};

const envios: EnvioTeams[] = [];
let falharProximo = false;

async function enviarMensagem(destinatarioTeamsId: string, titulo: string, corpo: string): Promise<void> {
  if (falharProximo) {
    falharProximo = false;
    throw new Error('falha simulada no envio de Teams');
  }
  envios.push({ destinatarioTeamsId, titulo, corpo });
}

export function limparEnviosTeams(): void {
  envios.length = 0;
  falharProximo = false;
}

export function obterEnviosTeams(): EnvioTeams[] {
  return [...envios];
}

export function falharProximoTeams(): void {
  falharProximo = true;
}

export default class TeamsEspiao extends cds.Service {
  init() {
    this.on('enviarMensagem', (req) => enviarMensagem(
      req.data.destinatarioTeamsId,
      req.data.titulo,
      req.data.corpo,
    ));
    return super.init();
  }
}
