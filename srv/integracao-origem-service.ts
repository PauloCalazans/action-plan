import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';

/** Contrato público dos aplicativos de origem: só monta o Autor e delega ao domínio. */
export default class IntegracaoOrigemService extends cds.ApplicationService {
  async init() {
    this.on('abrirTratativa', (req) =>
      abrirTratativa(req.data as DadosAbertura, { id: req.user.id, tipo: 'Aplicativo' }),
    );
    return super.init();
  }
}
