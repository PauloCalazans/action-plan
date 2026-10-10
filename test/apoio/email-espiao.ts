import cds from '@sap/cds';

type EnvioEmail = {
  destinatario: string;
  assunto: string;
  corpo: string;
};

const envios: EnvioEmail[] = [];
let falharProximo = false;

async function enviarEmail(destinatario: string, assunto: string, corpo: string): Promise<void> {
  if (falharProximo) {
    falharProximo = false;
    throw new Error('falha simulada no envio de e-mail');
  }
  envios.push({ destinatario, assunto, corpo });
}

export function limparEnviosEmail(): void {
  envios.length = 0;
  falharProximo = false;
}

export function obterEnviosEmail(): EnvioEmail[] {
  return [...envios];
}

export function falharProximoEmail(): void {
  falharProximo = true;
}

export default class EmailEspiao extends cds.Service {
  init() {
    this.on('enviarEmail', (req) => enviarEmail(
      req.data.destinatario,
      req.data.assunto,
      req.data.corpo,
    ));
    return super.init();
  }
}
