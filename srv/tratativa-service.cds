using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Serviço dos usuários da plataforma (spec abertura-por-apps-de-origem R6/R17; spec tratativa R1-R31).
 * Leitura por functions com tipo de retorno explícito (R23-R26); ciclo de vida por actions ligadas à
 * Tratativa (R2, R12, R18), só para o papel GestorTratativa (R8). Aplicativo de origem é recusado com 403.
 */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  /** R1/R2 (004): resultado da criação de Ação ou Subação. */
  type ResultadoCriacaoAcao {
    codigo : UUID;
  }

  type ResultadoAvalTecnico {
    id      : UUID;
    parecer : String;
  }

  type ItemAvalTecnico {
    id            : UUID;
    parecer       : String;
    fundamentacao : String(2000);
    validador     : String(50);
    emitidoEm     : Timestamp;
    vigente       : Boolean;
  }

  type DetalheAvalTecnico {
    vigente               : ItemAvalTecnico;
    dataBaseVerificacao   : Date;
    dataLimiteVerificacao : Date;
    historico             : many ItemAvalTecnico;
  }

  type DetalheMetodologia {
    metodologia       : String(20);
    categoriaCausaRaiz: String(50);
    dados             : LargeString;
    autor             : String(50);
    atualizadoEm      : Timestamp;
  }

  /** R25: exatamente estes dez campos na listagem (sem Descrição e sem Solicitante). */
  type ItemListagem {
    codigo                : UUID;
    titulo                : String(200);
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    unidade               : String(100);
    area                  : String(100);
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
  }

  /** R26: campos da listagem mais Descrição e Solicitante; os dois vêm null para quem não é Gestor (R23). */
  type DetalheTratativa {
    codigo                : UUID;
    titulo                : String(200);
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    unidade               : String(100);
    area                  : String(100);
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
    descricao             : String(5000);
    solicitante           : String(50);
  }

  type DetalheParametrosIntegracaoSF {
    nivelUnidadeSF : String(100);
    nivelAreaSF    : String(100);
  }

  /**
   * R6 (spec integracao-successfactors): leitura restrita ao Gestor e Administrador.
   * O grant authenticated-user permite ao handler devolver "Acesso negado." em vez do
   * "Forbidden" fixo do @restrict, seguindo o padrão de aplicarTemplateTratativa.
   */
  @restrict: [{ grant: '*', to: 'authenticated-user' }]
  function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;

  /** R17, R26 (005; Ruling R-02): estrutura de responsáveis e participantes para o Gestor. */
  type DetalheResponsaveis {
    responsavelPrincipal : String(50);
    participantes        : many String;
  }

  /** R2/R25 (004): item de Subação dentro da árvore (sem subações aninhadas). */
  type ItemSubacaoEstrutura {
    codigo                : UUID;
    descricao             : String(500);
    responsavel           : String(50);
    prazo                 : Date;
    prioridade            : m.PrioridadeAcao;
    status                : m.StatusAcao;
    evidenciaObrigatoria  : String(3);
    dataConclusao         : Date;
  }

  /** R25 (004): item de Ação de primeiro nível na árvore, com coleção de Subações aninhadas. */
  type ItemEstruturaAcao {
    codigo                : UUID;
    descricao             : String(500);
    responsavel           : String(50);
    prazo                 : Date;
    prioridade            : m.PrioridadeAcao;
    status                : m.StatusAcao;
    evidenciaObrigatoria  : String(3);
    dataConclusao         : Date;
    subacoes              : many ItemSubacaoEstrutura;
  }

  /** R25 (004): detalhe completo de uma Ação ou Subação consultada por Código. */
  type DetalheAcao {
    codigo                : UUID;
    descricao             : String(500);
    responsavel           : String(50);
    prazo                 : Date;
    prioridade            : m.PrioridadeAcao;
    status                : m.StatusAcao;
    evidenciaObrigatoria  : String(3);
    dataConclusao         : Date;
    acaoMae               : UUID;
    subacoes              : many ItemSubacaoEstrutura;
  }

  /** R18 (005): item de Ação retornado pela consulta Minhas Ações (sem campo responsavel). */
  type ItemMinhasAcoes {
    codigo               : UUID;
    codigoTratativa      : UUID;
    tituloTratativa      : String(200);
    statusTratativa      : m.StatusTratativa;
    descricao            : String(500);
    prioridade           : m.PrioridadeAcao;
    status               : m.StatusAcao;
    prazo                : Date;
    evidenciaObrigatoria : String(3);
    dataConclusao        : Date;
    acaoMae              : UUID;
  }

  /** R19 (005): item de Tratativa retornado pela consulta Minhas Tratativas (dez campos de ItemListagem + meuPapel). */
  type ItemMinhasTratativas {
    codigo                : UUID;
    titulo                : String(200);
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    unidade               : String(100);
    area                  : String(100);
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
    meuPapel              : m.PapelUsuarioTratativa;
  }

  /** R1, R12 (006): detalhe da Evidência anexada. */
  type DetalheEvidencia {
    codigo      : UUID;
    acao        : UUID;
    nomeArquivo : String(255);
    mimeType    : String(100);
    tamanho     : Integer;
    descricao   : String(500);
    criadoEm    : Timestamp;
    autorAnexo  : String(50);
  }

  /** R9, I8 (006): item de Ação com pendência de Evidência obrigatória. */
  type ItemPendenciaEvidenciaTratativa {
    acao        : UUID;
    descricao   : String(500);
    responsavel : String(50);
    status      : String(20);
  }

  /** R11 (006): item de Evidência retornado pela listagem por Ação. */
  type ItemEvidencia {
    codigo      : UUID;
    nomeArquivo : String(255);
    mimeType    : String(100);
    tamanho     : Integer;
    descricao   : String(500);
    criadoEm    : Timestamp;
    autorAnexo  : String(50);
  }

  /** R11 (006): item de Evidência retornado pela listagem por Tratativa (com código da Ação). */
  type ItemEvidenciaTratativa {
    codigo      : UUID;
    acao        : UUID;
    nomeArquivo : String(255);
    mimeType    : String(100);
    tamanho     : Integer;
    descricao   : String(500);
    criadoEm    : Timestamp;
    autorAnexo  : String(50);
  }

  /** R11, R12 (006): detalhe do download de Evidência com conteúdo em Base64. */
  type DetalheDownloadEvidencia {
    codigo      : UUID;
    nomeArquivo : String(255);
    mimeType    : String(100);
    tamanho     : Integer;
    conteudo    : String;
  }

  /** R2, R15 (comentarios): item retornado pelas listagens de comentários (mencoes null sob LGPD para não-Gestor). */
  type ItemComentario {
    codigo   : UUID;
    texto    : String(2000);
    autor    : String(50);
    criadoEm : Timestamp;
    mencoes  : many String;
  }

  /** R1 (comentarios): resultado da inclusão de comentário na Tratativa ou Ação. */
  type ResultadoComentario {
    codigo : UUID;
  }

  // --- Templates de Ações (spec templates-de-acoes, etapa 2: consultas e visibilidade) ---

  /** R12 (spec templates-de-acoes): item da listagem pública de templates. */
  type ItemListagemTemplate {
    id              : UUID;
    nome            : String(100);
    descricao       : String(500);
    ativo           : Boolean;
    quantidadeItens : Integer;
  }

  /** R1, R2, R12 (spec templates-de-acoes): item de detalhe de template, ordenado por ordem. */
  type DetalheItemTemplate {
    id                   : UUID;
    ordem                : Integer;
    descricao            : String(500);
    prioridade           : m.PrioridadeAcao;
    evidenciaObrigatoria : Boolean;
    prazoRelativoDias    : Integer;
    ordemPai             : Integer;
  }

  /** R12 (spec templates-de-acoes): detalhe de template com cabeçalho e itens ordenados por ordem. */
  type DetalheTemplate {
    id        : UUID;
    nome      : String(100);
    descricao : String(500);
    ativo     : Boolean;
    itens     : many DetalheItemTemplate;
  }

  /** R6 (spec templates-de-acoes): atribuição personalizada de responsável a um item do template, por ordem. */
  type AtribuicaoItemTemplate {
    ordem       : Integer;
    responsavel : String(50);
  }

  /** R5, R7 (spec templates-de-acoes): resultado da aplicação de template na Tratativa. */
  type ResultadoAplicacaoTemplate {
    totalAcoesCriadas : Integer;
  }

  action   criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                                unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;

  /** R12 (spec templates-de-acoes): lista templates ordenados por nome; visibilidade de inativos por papel. */
  function listarTemplates(ativo : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemListagemTemplate;

  /** R12 (spec templates-de-acoes): consulta de detalhe do template com itens ordenados por ordem. */
  function consultarTemplate(template : UUID) returns DetalheTemplate;

  /** R24/R25: filtros combinados; página padrão 50, máximo 200; pagina começa em 1. */
  function listarTratativas(origem : String, idOrigem : String, criticidade : String, status : String,
                            unidade : String, area : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemListagem;

  /** R26: consulta pelo Código; inexistente → 404. */
  function consultarTratativa(codigo : UUID) returns DetalheTratativa;

  function consultarAvalTecnicoTratativa(codigoTratativa : UUID) returns DetalheAvalTecnico;

  function consultarMetodologiaTratativa(codigoTratativa : UUID) returns DetalheMetodologia;

  /** R17, R26 (005; Ruling R-02): consulta de responsáveis exclusiva para o Gestor. */
  @restrict: [{ grant: '*', to: 'GestorTratativa' }]
  function consultarResponsaveis(tratativa : UUID) returns DetalheResponsaveis;

  /** R25 (004): consulta a estrutura hierárquica completa de Ações e Subações de uma Tratativa. */
  function consultarEstruturaAcoes(tratativa : UUID) returns many ItemEstruturaAcao;

  /** R25 (004): consulta uma Ação ou Subação pelo Código dela e da Tratativa. */
  function consultarAcao(tratativa : UUID, codigo : UUID) returns DetalheAcao;

  /** R18, R20 (005): lista Ações e Subações sob responsabilidade do colaborador. */
  function minhasAcoes(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasAcoes;

  /** R19, R20 (005): lista Tratativas em que o colaborador é Responsável Principal ou Participante. */
  function minhasTratativas(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasTratativas;

  /** R9, R17 (006): lista Ações com evidência obrigatória sem Evidências ativas. */
  function listarPendenciasEvidenciasTratativa(tratativa : UUID) returns many ItemPendenciaEvidenciaTratativa;

  /** R11 (006): lista Evidências ativas de uma Ação ou Subação. */
  function listarEvidenciasAcao(tratativa : UUID, acao : UUID) returns many ItemEvidencia;

  /** R11 (006): lista todas as Evidências ativas da Tratativa. */
  function listarEvidenciasTratativa(tratativa : UUID) returns many ItemEvidenciaTratativa;

  /** R11, R12 (006): baixa Evidência com conteúdo em Base64 e auditoria prévia. */
  function baixarEvidencia(tratativa : UUID, acao : UUID, evidencia : UUID) returns DetalheDownloadEvidencia;

  /** R7, R8, R13 (comentarios): lista comentários diretos da Tratativa, paginados e ordenados cronologicamente. */
  function listarComentariosTratativa(tratativa : UUID, tamanhoPagina : Integer, pagina : Integer) returns many ItemComentario;

  /** R1, R5, R7, R13 (comentarios): lista comentários de Ação ou Subação, paginados e ordenados cronologicamente. */
  function listarComentariosAcao(tratativa : UUID, acao : UUID, tamanhoPagina : Integer, pagina : Integer) returns many ItemComentario;

  /** R3, R7 (comentarios): projeção somente leitura; escrita direta recusa com 405, leitura por não-Gestor recusa com 403. */
  @readonly
  @restrict: [{ grant: ['READ'], to: 'GestorTratativa' }]
  entity Comentarios as projection on m.Comentarios;

  /**
   * Âncora das operações de ciclo de vida (R2, R12, R18). Só a chave é exposta; não há leitura,
   * criação, alteração nem exclusão pelo entity set (R11; leitura pelas functions acima).
   * Parâmetros sem tamanho de propósito: o domínio valida tamanho depois de papel, existência e estado (R31).
   */
  @readonly
  @restrict: [
    { grant: ['mudarStatus', 'editar', 'mudarCriticidade', 'criarAcao', 'criarSubacao', 'editarAcao', 'atribuirResponsavelPrincipal', 'incluirParticipante', 'removerParticipante', 'delegarAcao'], to: 'GestorTratativa' },
    { grant: ['mudarStatusAcao'], to: 'authenticated-user' },
    { grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' },
    { grant: ['comentarTratativa', 'comentarAcao'], to: 'authenticated-user' },
    // R5, R15(a) (spec templates-de-acoes); Ruling (desvio de N3-2/R-02): grant em 'authenticated-user'
    // em vez de somado a GestorTratativa porque o enforcement estático de @restrict do runtime CAP
    // rejeita com a mensagem fixa "Forbidden" (não customizável), incompatível com "Acesso negado."
    // exigido pelo contrato D10 (CA21a); a restrição ao papel GestorTratativa é feita em código
    // (srv/tratativa-service.ts, before('aplicarTemplateTratativa')), mesmo padrão de mudarStatusAcao/delegarAcao.
    { grant: ['aplicarTemplateTratativa', 'emitirAvalTecnico', 'definirMetodologia', 'derivarAcaoDaMetodologia'], to: 'authenticated-user' }
  ]
  entity Tratativas as projection on m.Tratativas { key codigo } actions {
    /** R2/R4/R5: a operação é identificada pelo Status de destino. */
    action mudarStatus(status : String, justificativa : String);
    /** R12/R13/R15: só estes campos; ausente = não muda; null ou só espaços = apaga (Título não pode). */
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);
    /** R18/R19: reutiliza a regra interna do 002 com tipo de autor Usuario. */
    action mudarCriticidade(criticidade : String);

    /** 004 R1/R3/R4/R5/R14/R18/R21: cria Ação de primeiro nível na Tratativa. */
    action criarAcao(descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    /** 004 R2/R3/R4/R5/R12/R14/R18/R21: cria Subação sob uma Ação mãe na Tratativa. */
    action criarSubacao(acaoMae : UUID, descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    /** 004 R6/R8/R9/R10/R11/R12/R18: muda o Status da Ação ou Subação. */
    action mudarStatusAcao(acao : UUID, status : String, justificativa : String);

    /** 004 R19/R20/R21: edita campos editáveis de Ação ou Subação Pendente ou Em andamento (responsavel não é editável, Ruling R-07). */
    action editarAcao(acao : UUID, descricao : String, prazo : String, prioridade : String, evidenciaObrigatoria : String);

    /** R7, R14 (005): primeira atribuição ou reatribuição de Responsável Principal da Tratativa. */
    action atribuirResponsavelPrincipal(responsavelPrincipal : String, justificativa : String);

    /** R9, R14 (005): inclusão de participante na Tratativa (até 20). */
    action incluirParticipante(participante : String);

    /** R9, R14 (005): remoção de participante da Tratativa. */
    action removerParticipante(participante : String);

    /** R8, R14, R29, R30 (005): delegação de Ação com justificativa obrigatória e histórico dedicado. */
    action delegarAcao(acao : UUID, novoResponsavel : String, justificativa : String);

    /** R1-R7, R12-R14 (006): anexa arquivo de Evidência à Ação ou Subação. */
    action anexarEvidencia(acao : UUID, nomeArquivo : String, mimeType : String, conteudo : String, descricao : String) returns TratativaService.DetalheEvidencia;

    /** R1, R6, R7, R10, R12, R13 (006): remove logicamente Evidência da Ação ou Subação. */
    action removerEvidencia(acao : UUID, evidencia : UUID);

    /** R1-R4, R7, R8, R13 (comentarios): inclui comentário direto na Tratativa. */
    action comentarTratativa(texto : String, mencoes : many String) returns ResultadoComentario;

    /** R1, R5, R6, R7, R11, R13 (comentarios): inclui comentário na Ação ou Subação. */
    action comentarAcao(acao : String, texto : String, mencoes : many String) returns ResultadoComentario;

    /** R5-R11, R13, R15(a), R16 (spec templates-de-acoes): aplica Template de Ações na Tratativa (D9, UTC). */
    action aplicarTemplateTratativa(template : UUID, responsavelPadrao : String, atribuicoes : many AtribuicaoItemTemplate) returns ResultadoAplicacaoTemplate;

    action emitirAvalTecnico(parecer : String, fundamentacao : String);

    action definirMetodologia(ferramenta : String, categoriaCausaRaiz : String, dados : LargeString,
                              confirmarSubstituicao : Boolean);

    action derivarAcaoDaMetodologia(causaIdentificador : String, descricao : String, responsavel : String,
                                    prazo : String, prioridade : String, evidenciaObrigatoria : String)
      returns ResultadoCriacaoAcao;
  };

  /** R1, R8 (spec historico-e-auditoria): detalhe estruturado do evento de histórico. */
  type DetalheEventoHistorico {
    campo         : String(50);
    valorAnterior : String(200);
    valorNovo     : String(200);
    justificativa : String(500);
    evidencia     : UUID;
    mimeType      : String(100);
    tamanho       : Integer;
    fundamentacao : String(2000);
  }

  /** R1, R2, R6 (spec historico-e-auditoria): item unificado da trilha de auditoria. */
  type ItemHistorico {
    id              : UUID;
    codigoTratativa : UUID;
    codigoAcao      : UUID;
    origem          : String(20);
    tipoEvento      : String(50);
    detalhe         : DetalheEventoHistorico;
    dataHora        : Timestamp;
    autor           : String(256);
    tipoAutor       : m.TipoAutor;
  }

  /** R1, R4, R6, R7, R12 (spec historico-e-auditoria): consulta unificada de histórico da Tratativa. */
  function consultarHistoricoTratativa(
    tratativa     : UUID,
    tipoEvento    : String,
    codigoAcao    : UUID,
    periodoInicio : String,
    periodoFim    : String,
    tamanhoPagina : Integer,
    pagina        : Integer
  ) returns many ItemHistorico;
}
