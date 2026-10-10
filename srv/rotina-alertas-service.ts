import cds from '@sap/cds';
import { processarAlertas } from './alertas/processamento';

export default class RotinaAlertasService extends cds.ApplicationService {
  async init() {
    this.on('executar', (req) => processarAlertas(new Date(req.data.agora)));
    return super.init();
  }
}
