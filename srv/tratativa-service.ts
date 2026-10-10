import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';
import { consultarAcao, consultarEstruturaAcoes } from './tratativa/acoes-consulta';
import { editarAcao, type CamposEdicaoAcao } from './tratativa/acoes-edicao';
import { mudarStatusAcao } from './tratativa/acoes-ciclo-de-vida';
import { criarAcao, criarSubacao, type DadosCriacaoAcao } from './tratativa/acoes-criacao';
import { delegarAcao } from './tratativa/acoes-delegacao';
import { mudarStatus } from './tratativa/ciclo-de-vida';
import { alterarCriticidade } from './tratativa/criticidade';
import { editarTratativa } from './tratativa/edicao';
import { obterMatriculaUsuario } from './tratativa/identidade';
import { consultarTratativa, listarTratativas, type FiltrosListagem } from './tratativa/listagem';
import { atribuirResponsavelPrincipal, incluirParticipante, removerParticipante, consultarResponsaveis } from './tratativa/responsaveis-tratativa';
import { minhasAcoes, minhasTratativas } from './tratativa/consultas-responsabilidade';
import { anexarEvidencia, type DadosAnexoEvidencia } from './tratativa/evidencias-anexo';
import { removerEvidencia, type DadosRemocaoEvidencia } from './tratativa/evidencias-remocao';
import { listarPendenciasEvidenciasTratativa, listarEvidenciasAcao, listarEvidenciasTratativa, baixarEvidencia } from './tratativa/evidencias-consultas';
import { comentarTratativa, comentarAcao, type DadosComentarioTratativa, type DadosComentarioAcao } from './tratativa/comentarios-inclusao';
import { listarComentariosTratativa, listarComentariosAcao } from './tratativa/comentarios-consulta';
import { consultarHistoricoUnificado } from './tratativa/historico-consulta';
import { filtrarPorAutorizacao, mascarar } from './tratativa/historico-autorizacao';

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
    // Decisão 2: o entity set é só âncora das actions; leitura é pelas functions.
    this.before('READ', 'Tratativas', (req) => req.reject(405, 'Use as functions listarTratativas e consultarTratativa.'));
    this.on('listarTratativas', (req) => listarTratativas(req.data as FiltrosListagem));
    this.on('consultarTratativa', (req) =>
      consultarTratativa((req.data as { codigo?: string }).codigo, req.user.is('GestorTratativa')),
    );
    this.on('criarTratativaAvulsa', (req) =>
      abrirTratativa(req.data as DadosAbertura, { id: obterMatriculaUsuario(req), tipo: 'Usuario' }),
    );
    this.on('mudarStatus', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await mudarStatus(String(codigo).toLowerCase(), req.data, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });
    this.on('editar', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await editarTratativa(String(codigo).toLowerCase(), req.data, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });
    this.on('mudarCriticidade', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await alterarCriticidade(String(codigo).toLowerCase(), (req.data as { criticidade?: string }).criticidade, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });
    // 004 R25: leitura da estrutura e do detalhe; `responsavel` só para o GestorTratativa (LGPD).
    this.on('consultarEstruturaAcoes', (req) => {
      const { tratativa } = req.data as { tratativa?: string };
      return consultarEstruturaAcoes(tratativa, req.user.is('GestorTratativa'));
    });
    this.on('consultarAcao', (req) => {
      const { tratativa, codigo } = req.data as { tratativa?: string; codigo?: string };
      return consultarAcao(tratativa, codigo, req.user.is('GestorTratativa'));
    });
    // 004 R1/R2: `acaoMae` passa como texto (String) para que ausente ou null vire 'undefined'/'null' e seja recusado como Código inválido.
    this.on('criarAcao', 'Tratativas', (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      return criarAcao(String(codigo).toLowerCase(), req.data as DadosCriacaoAcao, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });
    // 004 R6-R12: `acao` passa como texto (String), pelo mesmo motivo de `acaoMae`: ausente ou null vira 'Código inválido.'.
    // 005 R11, R16, R28: autorização dinâmica implementada no domínio; passa Request completo.
    this.on('mudarStatusAcao', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { acao, status, justificativa } = req.data as { acao?: string; status?: string; justificativa?: string };
      await mudarStatusAcao(req, String(codigo).toLowerCase(), String(acao).toLowerCase(), { status, justificativa });
    });
    // 004 R19/R20 (Ruling R-07): `acao` é tirado dos campos; o runtime já recusou qualquer campo fora da assinatura.
    this.on('editarAcao', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { acao, ...campos } = req.data as { acao?: string } & CamposEdicaoAcao;
      await editarAcao(String(codigo).toLowerCase(), String(acao).toLowerCase(), campos, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });
    this.on('criarSubacao', 'Tratativas', (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { acaoMae, ...dados } = req.data as DadosCriacaoAcao & { acaoMae?: string | null };
      return criarSubacao(String(codigo).toLowerCase(), String(acaoMae).toLowerCase(), dados, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });
    // 005 R17, R26 (Ruling R-02): consulta de responsáveis exclusiva para o Gestor (403 estático do runtime para não-gestores).
    this.on('consultarResponsaveis', (req) => {
      const { tratativa } = req.data as { tratativa?: string };
      return consultarResponsaveis(String(tratativa).toLowerCase());
    });
    // 005 R7, R14: atribuição ou reatribuição de Responsável Principal.
    this.on('atribuirResponsavelPrincipal', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { responsavelPrincipal, justificativa } = req.data as { responsavelPrincipal?: string; justificativa?: string };
      await atribuirResponsavelPrincipal(String(codigo).toLowerCase(), responsavelPrincipal!, justificativa, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });
    // 005 R9, R14: inclusão de participante.
    this.on('incluirParticipante', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { participante } = req.data as { participante?: string };
      await incluirParticipante(String(codigo).toLowerCase(), participante!, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });
    // 005 R9, R14: remoção de participante.
    this.on('removerParticipante', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { participante } = req.data as { participante?: string };
      await removerParticipante(String(codigo).toLowerCase(), participante!, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });
    // 005 R18, R20: consulta de Ações sob responsabilidade do colaborador.
    this.on('minhasAcoes', (req) => {
      const { status, matricula, tamanhoPagina, pagina } = req.data as {
        status?: string;
        matricula?: string;
        tamanhoPagina?: number;
        pagina?: number;
      };
      return minhasAcoes(req, status, matricula, tamanhoPagina, pagina);
    });
    // 005 R19, R20: consulta de Tratativas em que o colaborador é Responsável Principal ou Participante.
    this.on('minhasTratativas', (req) => {
      const { status, matricula, tamanhoPagina, pagina } = req.data as {
        status?: string;
        matricula?: string;
        tamanhoPagina?: number;
        pagina?: number;
      };
      return minhasTratativas(req, status, matricula, tamanhoPagina, pagina);
    });
    // 005 R8, R14, R29, R30: delegação de Ação com justificativa obrigatória.
    this.on('delegarAcao', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { acao, novoResponsavel, justificativa } = req.data as {
        acao?: string;
        novoResponsavel?: string;
        justificativa?: string;
      };
      await delegarAcao(
        String(codigo).toLowerCase(),
        String(acao).toLowerCase(),
        novoResponsavel!,
        justificativa!,
        { id: obterMatriculaUsuario(req), tipo: 'Usuario' },
      );
    });
    // 006 R1-R7, R12-R14: anexa arquivo de Evidência à Ação ou Subação.
    this.on('anexarEvidencia', 'Tratativas', (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      return anexarEvidencia(req, String(codigo).toLowerCase(), req.data as DadosAnexoEvidencia, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });
    // 006 R1, R6, R7, R10, R12, R13: remove logicamente Evidência da Ação ou Subação.
    this.on('removerEvidencia', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await removerEvidencia(req, String(codigo).toLowerCase(), req.data as DadosRemocaoEvidencia, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });
    // 006 R9, R17 (etapa 3): lista Ações com evidência obrigatória sem Evidências ativas.
    this.on('listarPendenciasEvidenciasTratativa', (req) => {
      const { tratativa } = req.data as { tratativa?: string };
      return listarPendenciasEvidenciasTratativa(req, String(tratativa).toLowerCase());
    });
    // 006 R11 (etapa 4): lista Evidências ativas de uma Ação ou Subação.
    this.on('listarEvidenciasAcao', (req) => {
      const { tratativa, acao } = req.data as { tratativa?: string; acao?: string };
      return listarEvidenciasAcao(req, String(tratativa).toLowerCase(), String(acao).toLowerCase());
    });
    // 006 R11 (etapa 4): lista todas as Evidências ativas da Tratativa.
    this.on('listarEvidenciasTratativa', (req) => {
      const { tratativa } = req.data as { tratativa?: string };
      return listarEvidenciasTratativa(req, String(tratativa).toLowerCase());
    });
    // 006 R11, R12 (etapa 4): baixa Evidência com conteúdo em Base64 e auditoria prévia.
    this.on('baixarEvidencia', (req) => {
      const { tratativa, acao, evidencia } = req.data as { tratativa?: string; acao?: string; evidencia?: string };
      return baixarEvidencia(req, String(tratativa).toLowerCase(), String(acao).toLowerCase(), String(evidencia).toLowerCase());
    });
    // comentarios R1-R4, R7, R8, R13 (etapa 1): inclui comentário direto na Tratativa.
    this.on('comentarTratativa', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      return comentarTratativa(req, String(codigo).toLowerCase(), req.data as DadosComentarioTratativa);
    });
    // comentarios R7, R8, R13 (etapa 1): lista comentários diretos da Tratativa.
    this.on('listarComentariosTratativa', (req) => {
      const { tratativa, tamanhoPagina, pagina } = req.data as {
        tratativa?: string;
        tamanhoPagina?: number;
        pagina?: number;
      };
      return listarComentariosTratativa(req, String(tratativa).toLowerCase(), tamanhoPagina, pagina);
    });
    // comentarios R1, R5, R6, R7, R11, R13 (etapa 2): inclui comentário na Ação ou Subação.
    this.on('comentarAcao', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      return comentarAcao(req, String(codigo).toLowerCase(), req.data as DadosComentarioAcao);
    });
    // comentarios R1, R5, R7, R13 (etapa 2): lista comentários de uma Ação ou Subação.
    this.on('listarComentariosAcao', (req) => {
      const { tratativa, acao, tamanhoPagina, pagina } = req.data as {
        tratativa?: string;
        acao?: string;
        tamanhoPagina?: number;
        pagina?: number;
      };
      return listarComentariosAcao(req, String(tratativa).toLowerCase(), String(acao).toLowerCase(), tamanhoPagina, pagina);
    });
    // historico-e-auditoria R1, R4, R6, R7 (etapas 1-2): consulta unificada de histórico, somente leitura.
    this.on('consultarHistoricoTratativa', async (req) => {
      const { tratativa, tipoEvento, codigoAcao, periodoInicio, periodoFim, tamanhoPagina, pagina } = req.data as {
        tratativa?: string;
        tipoEvento?: string;
        codigoAcao?: string;
        periodoInicio?: string;
        periodoFim?: string;
        tamanhoPagina?: number;
        pagina?: number;
      };
      const itens = await consultarHistoricoUnificado(tratativa, {
        tipoEvento, codigoAcao, periodoInicio, periodoFim, tamanhoPagina, pagina,
      });
      const autorizados = await filtrarPorAutorizacao(req, itens);
      return autorizados.map((item) => mascarar(req, item));
    });
    return super.init();
  }
}
