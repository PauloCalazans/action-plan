import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';
import { mudarStatus } from './tratativa/ciclo-de-vida';

/** Contrato dos usuários: só monta o Autor e delega ao domínio (decisões 6, 14 e 15). */
export default class TratativaService extends cds.ApplicationService {
  async init() {
    // Decisão 3 (design tratativa): aplicativo de origem é recusado em todo o serviço, antes de qualquer gravação.
    // Registrado antes de qualquer outro handler.
    this.before('*', (req) => {
      if (!req.user.is('AplicativoOrigem')) return;
      req.reject(
        403,
        req.event === 'criarTratativaAvulsa'
          ? 'Aplicativo de origem não cria Tratativa avulsa.'
          : 'Aplicativo de origem não usa este serviço.',
      );
    });
    this.on('criarTratativaAvulsa', (req) =>
      abrirTratativa(req.data as DadosAbertura, { id: req.user.id, tipo: 'Usuario' }),
    );
    this.on('mudarStatus', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await mudarStatus(String(codigo).toLowerCase(), req.data, { id: req.user.id, tipo: 'Usuario' });
    });
    return super.init();
  }
}
