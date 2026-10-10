import cds from '@sap/cds';
import {
  criarTemplate,
  editarTemplate,
  ativarTemplate,
  desativarTemplate,
  consultarTemplateAdministrativo,
  type DadosTemplate,
} from './templates/templates-cadastro';
import { listarTemplates, type FiltrosListagemTemplates } from './templates/templates-consulta';
import {
  atualizarParametrosAlertas,
  consultarParametrosAlertas,
  type DadosParametrosAlertas,
} from './alertas/parametros';
import { processarAlertas } from './alertas/processamento';

/**
 * Administração da plataforma (R11, R18, spec templates-de-acoes R1-R4, R14, R15(b), e
 * spec alertas-e-notificacoes R2, R3, R13, R15).
 */
export default class AdministracaoService extends cds.ApplicationService {
  async init() {
    this.on('error', (err, req) => {
      const status = 'status' in err ? err.status : 'code' in err ? err.code : undefined;
      if ((status === 403 || status === '403') && !req.user.is('Administrador')) {
        err.message = 'Acesso negado.';
      }
    });
    // Aplicativos de origem são recusados antes de qualquer consulta ou escrita do domínio.
    this.before('*', (req) => {
      if (req.user.is('AplicativoOrigem')) req.reject(403, 'Acesso negado.');
      if (req.user.is('Administrador')) return;
      if (req.user.is('GestorTratativa') && req.event === 'consultarParametrosAlertas') return;
      req.reject(403, 'Acesso negado.');
    });
    this.on('criarTemplate', (req) => criarTemplate(req.data as DadosTemplate));
    this.on('editarTemplate', async (req) => {
      const { id, ...dados } = req.data as DadosTemplate & { id?: string };
      await editarTemplate(id, dados);
      return { ok: true };
    });
    this.on('ativarTemplate', (req) => ativarTemplate((req.data as { id?: string }).id));
    this.on('desativarTemplate', (req) => desativarTemplate((req.data as { id?: string }).id));
    this.on('listarTemplates', (req) => listarTemplates(req.data as FiltrosListagemTemplates, true));
    this.on('consultarTemplate', (req) => consultarTemplateAdministrativo((req.data as { template?: string }).template));
    this.on('consultarParametrosAlertas', () => consultarParametrosAlertas());
    this.on('atualizarParametrosAlertas', (req) => {
      const parametros = req.data as DadosParametrosAlertas;
      type CampoNumerico = keyof Pick<
        DadosParametrosAlertas,
        'diasAntecedenciaPrazoProximo' | 'diasInatividade' | 'horaExecucaoUtc'
      >;
      const limites: Array<{
        campo: CampoNumerico;
        minimo: number;
        maximo: number;
        mensagem: string;
      }> = [
        {
          campo: 'diasAntecedenciaPrazoProximo',
          minimo: 1,
          maximo: 30,
          mensagem: 'O campo Dias de antecedência aceita de 1 a 30.',
        },
        {
          campo: 'diasInatividade',
          minimo: 1,
          maximo: 90,
          mensagem: 'O campo Dias de inatividade aceita de 1 a 90.',
        },
        {
          campo: 'horaExecucaoUtc',
          minimo: 0,
          maximo: 23,
          mensagem: 'O campo Hora de execução aceita de 0 a 23.',
        },
      ];
      for (const limite of limites) {
        const valor = parametros[limite.campo];
        if (valor < limite.minimo || valor > limite.maximo) {
          req.reject(400, limite.mensagem, limite.campo);
        }
      }
      return atualizarParametrosAlertas(parametros);
    });
    this.on('executarProcessamentoAlertas', async () => processarAlertas(new Date(), { modoManual: true }));
    return super.init();
  }
}
