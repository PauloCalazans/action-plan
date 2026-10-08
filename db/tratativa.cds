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
