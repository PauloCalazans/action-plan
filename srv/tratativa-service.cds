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

  action   criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                                unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;

  /** R24/R25: filtros combinados; página padrão 50, máximo 200; pagina começa em 1. */
  function listarTratativas(origem : String, idOrigem : String, criticidade : String, status : String,
                            unidade : String, area : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemListagem;

  /** R26: consulta pelo Código; inexistente → 404. */
  function consultarTratativa(codigo : UUID) returns DetalheTratativa;

  /** R17, R26 (005; Ruling R-02): consulta de responsáveis exclusiva para o Gestor. */
  @restrict: [{ grant: '*', to: 'GestorTratativa' }]
  function consultarResponsaveis(tratativa : UUID) returns DetalheResponsaveis;

  /** R25 (004): consulta a estrutura hierárquica completa de Ações e Subações de uma Tratativa. */
  function consultarEstruturaAcoes(tratativa : UUID) returns many ItemEstruturaAcao;

  /** R25 (004): consulta uma Ação ou Subação pelo Código dela e da Tratativa. */
  function consultarAcao(tratativa : UUID, codigo : UUID) returns DetalheAcao;

  /**
   * Âncora das operações de ciclo de vida (R2, R12, R18). Só a chave é exposta; não há leitura,
   * criação, alteração nem exclusão pelo entity set (R11; leitura pelas functions acima).
   * Parâmetros sem tamanho de propósito: o domínio valida tamanho depois de papel, existência e estado (R31).
   */
  @readonly
  @restrict: [
    { grant: ['mudarStatus', 'editar', 'mudarCriticidade', 'criarAcao', 'criarSubacao', 'editarAcao', 'atribuirResponsavelPrincipal', 'incluirParticipante', 'removerParticipante', 'delegarAcao'], to: 'GestorTratativa' },
    { grant: ['mudarStatusAcao'], to: 'authenticated-user' }
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
  };
}
