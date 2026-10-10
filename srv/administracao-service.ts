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

/**
 * Administração da plataforma (R11, R18, e spec templates-de-acoes R1-R4, R14, R15(b)).
 * `@requires: 'Administrador'` no serviço (administracao-service.cds) já recusa com 403 qualquer
 * usuário sem o papel Administrador — incluindo AplicativoOrigem — antes de forma e existência (CA21, CA22).
 */
export default class AdministracaoService extends cds.ApplicationService {
  async init() {
    // CA21, CA22, CA23 (spec templates-de-acoes R15(b)): papel estático verificado antes de forma e
    // existência, com a mensagem exata "Acesso negado." (o @requires: 'Administrador' do serviço já
    // recusa com 403 em outro texto; aqui padronizamos a mensagem para os CAs de templates).
    this.before('*', (req) => {
      if (req.user.is('Administrador')) return;
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
    return super.init();
  }
}
