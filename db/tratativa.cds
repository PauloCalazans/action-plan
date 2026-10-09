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
}

type TipoAutor : String(20) enum {
  Aplicativo;
  Usuario;
  Sistema;
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
      prazo                 : Date not null;
      prioridade            : PrioridadeAcao not null default 'Média';
      status                : StatusAcao not null default 'Pendente';
      evidenciaObrigatoria  : Boolean not null default false;
      dataConclusao         : Date;
      criadoEm              : Timestamp not null;
      subacoes              : Composition of many Acoes on subacoes.acaoMae = $self;
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
}
