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
import {
  atualizarParametrosIntegracaoSF,
  consultarParametrosIntegracaoSF,
  type DadosParametrosIntegracaoSF,
} from './integracoes/parametros-sf';
import { listarAlertasEmitidos, type FiltrosListagemAlertas } from './alertas/consulta-alertas';
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
      if (
        req.user.is('GestorTratativa')
        && [
          'consultarParametrosAlertas',
          'listarAlertasEmitidos',
          'consultarParametrosIntegracaoSF',
        ].includes(req.event)
      ) return;
      req.reject(403, 'Acesso negado.');
    });
    this.before('READ', 'ParametrosAlertas', async () => {
      await consultarParametrosAlertas();
    });
    this.before('READ', 'ParametrosIntegracaoSF', async () => {
      await consultarParametrosIntegracaoSF();
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
    this.on('consultarParametrosIntegracaoSF', () => consultarParametrosIntegracaoSF());
    this.on('atualizarParametrosIntegracaoSF', (req) => {
      const parametros = req.data as DadosParametrosIntegracaoSF;
      const limites: Array<{
        campo: keyof DadosParametrosIntegracaoSF;
        valor: unknown;
        mensagemObrigatorio: string;
        mensagemLimite: string;
      }> = [
        {
          campo: 'nivelUnidadeSF',
          valor: parametros.nivelUnidadeSF,
          mensagemObrigatorio: 'O campo Nível de unidade é obrigatório.',
          mensagemLimite: 'O campo Nível de unidade aceita no máximo 100 caracteres.',
        },
        {
          campo: 'nivelAreaSF',
          valor: parametros.nivelAreaSF,
          mensagemObrigatorio: 'O campo Nível de área é obrigatório.',
          mensagemLimite: 'O campo Nível de área aceita no máximo 100 caracteres.',
        },
      ];
      let invalido = false;
      for (const limite of limites) {
        if (typeof limite.valor !== 'string') {
          req.reject(400, limite.mensagemObrigatorio, limite.campo);
          invalido = true;
          continue;
        }
        const valor = limite.valor.trim();
        if (!valor) {
          req.reject(400, limite.mensagemObrigatorio, limite.campo);
          invalido = true;
          continue;
        }
        if (valor.length > 100) {
          req.reject(400, limite.mensagemLimite, limite.campo);
          invalido = true;
        }
      }
      if (invalido) return;
      return atualizarParametrosIntegracaoSF({
        nivelUnidadeSF: parametros.nivelUnidadeSF.trim(),
        nivelAreaSF: parametros.nivelAreaSF.trim(),
      });
    });
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
        if (valor == null || valor < limite.minimo || valor > limite.maximo) {
          req.reject(400, limite.mensagem, limite.campo);
        }
      }
      return atualizarParametrosAlertas(parametros);
    });
    this.on('executarProcessamentoAlertas', async () => processarAlertas(new Date()));
    this.on('listarAlertasEmitidos', (req) => listarAlertasEmitidos(req.data as FiltrosListagemAlertas));
    return super.init();
  }
}
