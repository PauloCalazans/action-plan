using { br.com.calazanstec as m } from '../db/tratativa';

/** Administração da plataforma (R11, R18): tabela de prazos e credenciais de aplicativo. */
@path    : '/api/administracao/v1'
// Mantém requisições autenticadas até o hook para padronizar a recusa de AplicativoOrigem.
@requires: ['authenticated-user', 'Administrador', 'GestorTratativa']
service AdministracaoService {

  /** R11: o Administrador só altera os dias; a lista de Criticidades é fixa (R7). */
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'UPDATE'], to: 'Administrador' }]
  entity PrazosCriticidade     as projection on m.PrazosCriticidade;

  /** R18: emissão (CREATE) e revogação (UPDATE ativa = false) da credencial de cada aplicativo. */
  @Capabilities: { DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'CREATE', 'UPDATE'], to: 'Administrador' }]
  entity CredenciaisAplicativo as projection on m.CredenciaisAplicativo;

  // --- Templates de Ações (spec templates-de-acoes, etapa 1: gestão cadastral) ---

  type ItemTemplateInput {
    ordem                : Integer;
    descricao            : String;
    prioridade           : String;
    evidenciaObrigatoria : Boolean;
    prazoRelativoDias    : Integer;
    ordemPai             : Integer;
  }

  type ResultadoCriacaoTemplate {
    id : UUID;
  }

  type ResultadoAtivacaoTemplate {
    id    : UUID;
    ativo : Boolean;
  }

  type DetalheItemTemplate {
    id                   : UUID;
    ordem                : Integer;
    descricao            : String(500);
    prioridade           : m.PrioridadeAcao;
    evidenciaObrigatoria : Boolean;
    prazoRelativoDias    : Integer;
    ordemPai             : Integer;
  }

  type DetalheTemplate {
    id        : UUID;
    nome      : String(100);
    descricao : String(500);
    ativo     : Boolean;
    itens     : many DetalheItemTemplate;
  }

  type ItemListagemTemplate {
    id              : UUID;
    nome            : String(100);
    descricao       : String(500);
    ativo           : Boolean;
    quantidadeItens : Integer;
  }

  /** Resultado vazio para ações sem retorno de domínio, garantindo HTTP 200 (não 204). */
  type ResultadoVazio {
    ok : Boolean;
  }

  /** R1-R4, R14 (spec templates-de-acoes): cria template com cabeçalho e de 1 a 30 itens. */
  action criarTemplate(
    nome      : String,
    descricao : String,
    itens     : many ItemTemplateInput
  ) returns ResultadoCriacaoTemplate;

  /** R3, R8 (spec templates-de-acoes): atualiza nome, descrição e substitui itens para aplicações futuras. */
  action editarTemplate(
    id        : UUID,
    nome      : String,
    descricao : String,
    itens     : many ItemTemplateInput
  ) returns ResultadoVazio;

  /** R4 (spec templates-de-acoes): ativação lógica idempotente. */
  action ativarTemplate(
    id : UUID
  ) returns ResultadoAtivacaoTemplate;

  /** R4 (spec templates-de-acoes): desativação lógica idempotente (sem exclusão física). */
  action desativarTemplate(
    id : UUID
  ) returns ResultadoAtivacaoTemplate;

  /** R12 (spec templates-de-acoes): lista templates administrativos, incluindo inativos, com paginação. */
  function listarTemplates(
    ativo         : String,
    tamanhoPagina : Integer,
    pagina        : Integer
  ) returns many ItemListagemTemplate;

  /** R12 (spec templates-de-acoes): consulta de detalhe do template com itens ordenados por ordem. */
  function consultarTemplate(
    template : UUID
  ) returns DetalheTemplate;

  type DetalheParametrosAlertas {
    diasAntecedenciaPrazoProximo : Integer;
    diasInatividade              : Integer;
    emailHabilitado              : Boolean;
    teamsHabilitado              : Boolean;
    horaExecucaoUtc              : Integer;
  }

  type DetalheParametrosIntegracaoSF {
    nivelUnidadeSF : String(100);
    nivelAreaSF    : String(100);
  }

  /** R6 (spec integracao-successfactors): consulta por Gestor ou Administrador. */
  @restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]
  function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;

  /** R6 (spec integracao-successfactors): atualização exclusiva do Administrador. */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action atualizarParametrosIntegracaoSF(
    nivelUnidadeSF : String,
    nivelAreaSF    : String
  ) returns DetalheParametrosIntegracaoSF;

  type RelatorioProcessamentoAlertas {
    ocorrenciasAvaliadas : Integer;
    alertasGerados       : Integer;
    notificacoesEnviadas : Integer;
    falhas               : Integer;
  }

  type ItemAlertaEmitido {
    id           : UUID;
    tipo         : m.TipoAlerta;
    entidade     : m.EntidadeAlerta;
    tratativa    : UUID;
    acao         : UUID;
    destinatario : String(50);
    canal        : m.CanalNotificacao;
    enviadoEm    : Timestamp;
    statusEnvio  : m.StatusEnvioAlerta;
    motivoFalha  : String(255);
    dadosAlerta  : String(1000);
  }

  /** R3: consulta os parâmetros vigentes por Administrador ou Gestor de Tratativa. */
  @restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]
  function consultarParametrosAlertas() returns DetalheParametrosAlertas;

  /** R3: atualização dos parâmetros de alertas, exclusiva do Administrador. */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action atualizarParametrosAlertas(
    diasAntecedenciaPrazoProximo : Integer,
    diasInatividade              : Integer,
    emailHabilitado              : Boolean,
    teamsHabilitado              : Boolean,
    horaExecucaoUtc              : Integer
  ) returns DetalheParametrosAlertas;

  type DetalheParametrosOrigem {
    origem                       : String(100);
    metodologiaSugerida          : String(20);
    validadorPadrao              : String(100);
    prazoVerificacaoEficaciaDias : Integer;
    validadores                  : many String(50);
  }

  /** R13 (016): cria ou atualiza a parametrização da Origem (`*` é o baseline global), exclusivo do Administrador. */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action atualizarParametrosOrigem(
    origem                       : String,
    metodologiaSugerida          : String,
    validadorPadrao              : String,
    prazoVerificacaoEficaciaDias : Integer
  ) returns DetalheParametrosOrigem;

  /** R7, R12 d (016): inclui um Validador Técnico na lista da Origem (`*` para a lista padrão). */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action incluirValidadorOrigem(
    origem    : String,
    matricula : String
  ) returns DetalheParametrosOrigem;

  /** R7, R12 d (016): remove um Validador Técnico da lista da Origem (`*` para a lista padrão). */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action removerValidadorOrigem(
    origem    : String,
    matricula : String
  ) returns DetalheParametrosOrigem;

  /** R12: execução sob demanda do processamento dos alertas, exclusiva do Administrador. */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action executarProcessamentoAlertas() returns RelatorioProcessamentoAlertas;

  /** R11: consulta paginada de alertas emitidos para Administrador e Gestor de Tratativa. */
  @restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]
  function listarAlertasEmitidos(
    tratativa     : UUID,
    tipo          : String,
    destinatario  : String,
    statusEnvio   : String,
    tamanhoPagina : Integer,
    pagina        : Integer
  ) returns many ItemAlertaEmitido;

  /** R6, Ruling R-04: projeções somente leitura para consumo pelo Fiori elements. */
  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity Templates as projection on m.Templates;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ParametrosAlertas as projection on m.ParametrosAlertas;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ParametrosIntegracaoSF as projection on m.ParametrosIntegracaoSF;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ParametrosOrigem as projection on m.ParametrosOrigem;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ValidadoresOrigem as projection on m.ValidadoresOrigem;
}
