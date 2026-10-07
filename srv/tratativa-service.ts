import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';

/** Contrato dos usuários: só monta o Autor e delega ao domínio (decisões 6 e 15). */
export default class TratativaService extends cds.ApplicationService {
  async init() {
    // Decisão 15: aplicativo de origem não cria avulsa; recusa antes de qualquer gravação.
    this.before('criarTratativaAvulsa', (req) => {
      if (req.user.is('AplicativoOrigem')) req.reject(403, 'Aplicativo de origem não cria Tratativa avulsa.');
    });
    this.on('criarTratativaAvulsa', (req) =>
      abrirTratativa(req.data as DadosAbertura, { id: req.user.id, tipo: 'Usuario' }),
    );
    return super.init();
  }
}
