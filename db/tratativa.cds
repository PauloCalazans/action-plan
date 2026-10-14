// Tratativa: mínimo exigido pelo contrato de abertura e consulta (spec abertura-por-apps-de-origem).
// Genérico: nenhum nome de Origem aqui; variação vem de dados (PrazosCriticidade).
namespace br.com.calazanstec;

using { managed } from '@sap/cds/common';

/** R7: lista fechada de Criticidades. */
type Criticidade : String(10) enum {
  Baixa;
  Media   = 'Média';
  Alta;
  Critica = 'Crítica';
}

/** R7, R10, R11 (016): pareceres do Aval Técnico; somente inclusão. */
@PersonalData.EntitySemantics: 'Other'
entity AvalesTecnicos {
  key id                    : UUID;
      tratativa             : Association to one Tratativas not null;
      parecer               : ParecerAvalTecnico not null;
      @PersonalData.IsPotentiallyPersonal
      fundamentacao         : String(2000) not null;
      @PersonalData.IsPotentiallyPersonal
      validador             : String(50) not null;
      emitidoEm             : Timestamp not null;
      dataBaseVerificacao   : Timestamp;
      dataLimiteVerificacao : Date;
}

/** R13 (016): parametrização por Origem; a linha '*' é o baseline global. */
@PersonalData.EntitySemantics: 'Other'
entity ParametrosOrigem : managed {
  key origemNormalizada            : String(100);
      origem                       : String(100) not null;
      metodologiaSugerida          : FerramentaMetodologia;
      validadorPadrao              : String(100) not null;
      prazoVerificacaoEficaciaDias : Integer not null default 30 @assert.range: [1, 180];
      validadores                  : Composition of many ValidadoresOrigem on validadores.parametro = $self;
}

/** R7, R12 d (016): matrículas habilitadas como Validador Técnico na Origem. */
@PersonalData.EntitySemantics: 'Other'
entity ValidadoresOrigem {
  key ID        : UUID;
      parametro : Association to one ParametrosOrigem not null;
      @PersonalData.IsPotentiallyPersonal
      matricula : String(50) not null;
}

/** R1 (spec tratativa): Status da Tratativa; toda Tratativa nasce `Aberta` (R20 do 002). */
type StatusTratativa : String(20) enum {
  Aberta;
  EmAndamento = 'Em andamento';
  Encerrada;
  Cancelada;
}

/** Eventos de histórico do 002 e do 003 (R9, R15 da spec tratativa); o Histórico completo é do intent 008. */
type EventoHistorico : String(30) enum {
  Criacao;
  AlteracaoCriticidade;
  MudancaStatus;
  Encerramento;
  Reabertura;
  Cancelamento;
  Edicao;
  Atribuicao;
  Reatribuicao;
  InclusaoParticipante;
  RemocaoParticipante;
  InclusaoComentario;
  DefinicaoMetodologia;
  EdicaoMetodologia;
  EmissaoAvalTecnico;
}

type TipoAutor : String(20) enum {
  Aplicativo;
  Usuario;
  Sistema;
}

/** R19 (spec responsaveis-e-participantes): papel do usuário na Tratativa para a consulta Minhas Tratativas. */
type PapelUsuarioTratativa : String(30) enum {
  ResponsavelPrincipal = 'Responsável Principal';
  Participante         = 'Participante';
}

/** R4 (spec plano-de-acao): prioridade da Ação (não afeta prazo da Tratativa). */
type PrioridadeAcao : String(10) enum {
  Baixa;
  Media = 'Média';
  Alta;
}

/** R6 (spec plano-de-acao): ciclo de vida da Ação; toda Ação nasce `Pendente`. */
type StatusAcao : String(20) enum {
  Pendente;
  EmAndamento = 'Em andamento';
  Concluida   = 'Concluída';
  Cancelada;
}

/** R22 (spec plano-de-acao): eventos de histórico de Ações (intent 008 unifica). */
type EventoHistoricoAcao : String(30) enum {
  Criacao;
  MudancaStatus;
  Conclusao;
  Reabertura;
  Cancelamento;
  Edicao;
  Delegacao;
  InclusaoEvidencia;
  RemocaoEvidencia;
  DownloadEvidencia;
  InclusaoComentario;
  CriacaoAcaoComCausa;
}

/** R1 (spec alertas-e-notificacoes): modalidades de alertas de negócio. */
type TipoAlerta : String(30) enum {
  PrazoProximo;
  PrazoVencido;
  Inatividade;
  EvidenciaPendente;
}

/** R10 (spec alertas-e-notificacoes): nível da entidade associada ao alerta. */
type EntidadeAlerta : String(20) enum {
  Tratativa;
  Acao;
  VerificacaoEficacia;
}

type FerramentaMetodologia : String(20) enum {
  TresW = '3W';
  CincoPorques = '5 Porquês';
  CincoWDoisH = '5W2H';
  PdcaOitoD = 'PDCA/8D';
}

type MacrocausaCausaRaiz : String(50) enum {
  MetodoProcesso = 'Método/Processo';
  MaquinaEquipamento = 'Máquina/Equipamento';
  MaterialInsumo = 'Material/Insumo';
  MaoDeObraComportamental = 'Mão de Obra/Comportamental';
  MeioAmbienteInstalacao = 'Meio Ambiente/Instalação';
  GestaoPlanejamento = 'Gestão/Planejamento';
}

type ParecerAvalTecnico : String(20) enum {
  Aprovado;
  Reprovado;
}

/** R5 (spec alertas-e-notificacoes): canais corporativos suportados. */
type CanalNotificacao : String(20) enum {
  Email;
  Teams;
}

/** R10 (spec alertas-e-notificacoes): resultado da tentativa de envio. */
type StatusEnvioAlerta : String(20) enum {
  Sucesso;
  Falha;
}

/** R22: Código opaco (UUID v4 gerado pela plataforma). R1, R2, R7, R10, R13, R20, R23. */
@PersonalData.EntitySemantics: 'Other'
entity Tratativas {
  key codigo                : UUID;
      origem                : String(100);
      idOrigem              : String(50);
      titulo                : String(200) not null;
      descricao             : String(5000);
      unidade               : String(100);
      area                  : String(100);
      @PersonalData.IsPotentiallyPersonal
      solicitante           : String(50);
      /** R24 (spec tratativa): cópias normalizadas (trim + minúsculas, acentos preservados) para o filtro da listagem. */
      origemNormalizada     : String(100);
      unidadeNormalizada    : String(100);
      areaNormalizada       : String(100);
      criticidade           : Criticidade not null;
      status                : StatusTratativa not null default 'Aberta';
      dataCriacao           : Date not null;
      dataPrevistaConclusao : Date not null;
      criadoEm              : Timestamp not null;
      /** R1 (spec plano-de-acao): composição hierárquica de Ações da Tratativa. */
      acoes                 : Composition of many Acoes on acoes.tratativa = $self;
      /** R1, R3, R17 (spec responsaveis-e-participantes): Responsável Principal da Tratativa. */
      @PersonalData.IsPotentiallyPersonal
      responsavelPrincipal : String(50);
      metodologia          : FerramentaMetodologia;
      categoriaCausaRaiz   : MacrocausaCausaRaiz;
      @PersonalData.IsPotentiallyPersonal
      metodologiaData      : LargeString;
      @PersonalData.IsPotentiallyPersonal
      metodologiaAutor     : String(50);
      metodologiaAtualizadoEm : Timestamp;
      /** R1, R6 (spec responsaveis-e-participantes): lista de até 20 Participantes da Tratativa. */
      participantes         : Composition of many ParticipantesTratativa on participantes.tratativa = $self;
}

/** R1, R6, R17 (spec responsaveis-e-participantes): participante colaborador da Tratativa. */
@PersonalData.EntitySemantics: 'Other'
entity ParticipantesTratativa {
  key ID        : UUID;
      tratativa : Association to one Tratativas not null;
      @PersonalData.IsPotentiallyPersonal
      matricula : String(50) not null;
      sequencia : Integer not null;
      criadoEm  : Timestamp not null;
}

/**
 * R4/R15: invariante "um par (Origem, ID_Origem) tem no máximo uma Tratativa", garantido pela chave primária.
 * origemNormalizada = origem sem espaços nas pontas e em minúsculas (acentos preservados).
 */
entity ChavesOrigem {
  key origemNormalizada : String(100);
  key idOrigem          : String(50);
      tratativa         : Association to one Tratativas not null;
}

/** R10/R11: tabela global de prazos (dado de parametrização; valores iniciais em db/data). */
entity PrazosCriticidade : managed {
  key criticidade : Criticidade;
      dias        : Integer not null @assert.range: [1, 3650];
}

/** R12/R20: registro de histórico mínimo do 002. */
@PersonalData.EntitySemantics: 'Other'
entity HistoricoTratativa {
  key ID            : UUID;
      tratativa     : Association to one Tratativas not null;
      evento        : EventoHistorico not null;
      avalTecnico   : UUID;
      campo         : String(50);
      /** Pode conter a matrícula do Solicitante (R15 da spec tratativa); a Descrição nunca é copiada. */
      @PersonalData.IsPotentiallyPersonal
      valorAnterior : String(200);
      @PersonalData.IsPotentiallyPersonal
      valorNovo     : String(200);
      /** R5/R9 (spec tratativa): texto livre do Gestor na transição. */
      @PersonalData.IsPotentiallyPersonal
      justificativa : String(500);
      @PersonalData.IsPotentiallyPersonal
      autor         : String(256) not null;
      tipoAutor     : TipoAutor not null;
      quando        : Timestamp not null;
}

/** R18: registro da plataforma das credenciais de aplicativo (identidade técnica autenticada). */
entity CredenciaisAplicativo : managed {
  key usuarioTecnico : String(256);
      descricao      : String(200);
      ativa          : Boolean not null default true;
}

/** R1-R3, R14, R26 (spec plano-de-acao): tarefas e subtarefas da Tratativa. */
@PersonalData.EntitySemantics: 'Other'
entity Acoes {
  key codigo                : UUID;
      tratativa             : Association to one Tratativas not null;
      acaoMae               : Association to one Acoes;
      descricao             : String(500) not null;
      @PersonalData.IsPotentiallyPersonal
      responsavel           : String(50) not null;
      causaIdentificador    : String(30);
      @PersonalData.IsPotentiallyPersonal
      causaDescricao        : String(2000);
      prazo                 : Date not null;
      prioridade            : PrioridadeAcao not null default 'Média';
      status                : StatusAcao not null default 'Pendente';
      evidenciaObrigatoria  : Boolean not null default false;
      dataConclusao         : Date;
      criadoEm              : Timestamp not null;
      subacoes              : Composition of many Acoes on subacoes.acaoMae = $self;
      /** R1 (spec evidencias): composição de Evidências da Ação. */
      evidencias            : Composition of many Evidencias on evidencias.acao = $self;
}

/** R22, R23 (spec plano-de-acao): auditoria imutável de eventos das Ações. */
@PersonalData.EntitySemantics: 'Other'
entity HistoricoAcoes {
  key ID            : UUID;
      tratativa     : Association to one Tratativas not null;
      acao          : Association to one Acoes not null;
      evento        : EventoHistoricoAcao not null;
      campo         : String(50);
      @PersonalData.IsPotentiallyPersonal
      valorAnterior : String(200);
      @PersonalData.IsPotentiallyPersonal
      valorNovo     : String(200);
      @PersonalData.IsPotentiallyPersonal
      justificativa : String(500);
      @PersonalData.IsPotentiallyPersonal
      autor         : String(256) not null;
      tipoAutor     : TipoAutor not null;
      quando        : Timestamp not null;
      /** R12 (spec evidencias): colunas aditivas para auditoria de Evidências. */
      evidencia     : UUID;
      mimeType      : String(100);
      tamanho       : Integer;
      /** R11 (spec templates-de-acoes): metadado aditivo do template gerador da Ação, sem cópia de Descrição (LGPD). */
      template      : Association to one Templates;
      templateNome  : String(100);
}

/** R1, R2, R10 (spec evidencias): comprovação de execução de Ações/Subações. */
@PersonalData.EntitySemantics: 'Other'
entity Evidencias {
  key codigo       : UUID;
      tratativa    : Association to one Tratativas not null;
      acao         : Association to one Acoes not null;
      @PersonalData.IsPotentiallyPersonal
      nomeArquivo  : String(255) not null;
      mimeType     : String(100) not null;
      tamanho      : Integer not null;
      @PersonalData.IsPotentiallyPersonal
      descricao    : String(500);
      ativo        : Boolean not null default true;
      criadoEm     : Timestamp not null;
      @PersonalData.IsPotentiallyPersonal
      autorAnexo   : String(50) not null;
      removidoEm   : Timestamp;
      @PersonalData.IsPotentiallyPersonal
      autorRemocao : String(50);
}

/** R1, R2 (spec templates-de-acoes): Cabeçalho do template de ações. */
entity Templates {
  key id        : UUID;
      nome      : String(100) not null;
      descricao : String(500);
      ativo     : Boolean not null default true;
      itens     : Composition of many ItensTemplate on itens.template = $self;
}

/** R1, R2 (spec templates-de-acoes): Itens ordenados do template de ações. */
entity ItensTemplate {
  key id                   : UUID;
      template             : Association to one Templates not null;
      ordem                : Integer not null;
      descricao            : String(500) not null;
      prioridade           : PrioridadeAcao not null default 'Média';
      evidenciaObrigatoria : Boolean not null default false;
      prazoRelativoDias    : Integer not null;
      ordemPai             : Integer;
}

/** R1, R2 (spec comentarios): comunicação colaborativa vinculada à Tratativa ou Ação. */
@PersonalData.EntitySemantics: 'Other'
entity Comentarios {
  key codigo    : UUID;
      tratativa : Association to one Tratativas not null;
      acao      : Association to one Acoes;
      @PersonalData.IsPotentiallyPersonal
      texto     : String(2000) not null;
      @PersonalData.IsPotentiallyPersonal
      autor     : String(50) not null;
      criadoEm  : Timestamp not null;
      mencoes   : Composition of many MencoesComentario on mencoes.comentario = $self;
}

/** R2, R4 (spec comentarios): matrículas mencionadas no comentário. */
@PersonalData.EntitySemantics: 'Other'
entity MencoesComentario {
  key ID         : UUID;
      comentario : Association to one Comentarios not null;
      @PersonalData.IsPotentiallyPersonal
      matricula  : String(50) not null;
}

/** R2 (spec alertas-e-notificacoes): parâmetros globais singleton para governança de alertas. */
@PersonalData.EntitySemantics: 'Other'
entity ParametrosAlertas : managed {
  key chave                        : String(10);
      diasAntecedenciaPrazoProximo : Integer not null default 3;
      diasInatividade              : Integer not null default 15;
      emailHabilitado              : Boolean not null default true;
      teamsHabilitado              : Boolean not null default true;
      horaExecucaoUtc              : Integer not null default 8;
}

/** R6 (spec integracao-successfactors): governança do mapeamento de níveis organizacionais do SF. */
@PersonalData.EntitySemantics: 'Other'
entity ParametrosIntegracaoSF : managed {
  key chave          : String(10);
      nivelUnidadeSF : String(100) not null default 'BusinessUnit';
      nivelAreaSF    : String(100) not null default 'Department';
}

/** R10 (spec alertas-e-notificacoes): auditoria de notificações independente do histórico executivo. */
@PersonalData.EntitySemantics: 'Other'
entity AlertasEmitidos {
  key id           : UUID;
      tipo         : TipoAlerta not null;
      entidade     : EntidadeAlerta not null;
      tratativa    : Association to one Tratativas not null;
      acao         : Association to one Acoes;
      @PersonalData.IsPotentiallyPersonal
      destinatario : String(50) not null;
      canal        : CanalNotificacao not null;
      enviadoEm    : Timestamp not null;
      statusEnvio  : StatusEnvioAlerta not null;
      motivoFalha  : String(255);
      dadosAlerta  : String(1000);
}
