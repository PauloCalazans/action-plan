using { br.com.calazanstec as m } from '../db/tratativa';

@path    : '/api/app/v1'
@requires: 'authenticated-user'
service TratativaAppService {

  @readonly
  @cds.redirection.target
  entity Tratativas as projection on m.Tratativas {
    key codigo,
        titulo,
        descricao,
        origem,
        idOrigem,
        criticidade,
        status,
        unidade,
        area,
        solicitante,
        responsavelPrincipal,
        dataCriacao,
        dataPrevistaConclusao,
        metodologia,
        categoriaCausaRaiz,
        metodologiaData,
        metodologiaAutor,
        metodologiaAtualizadoEm,
        false as ocultaResponsaveis : Boolean,
        false as podeIniciar        : Boolean,
        false as podeEncerrar       : Boolean,
        false as podeCancelar       : Boolean,
        false as podeReabrir        : Boolean,
        false as ocultaIniciar      : Boolean,
        false as ocultaEncerrar     : Boolean,
        false as ocultaCancelar     : Boolean,
        false as ocultaReabrir      : Boolean,
        false as podeDefinirMetodologia    : Boolean,
        false as ocultaDefinirMetodologia  : Boolean,
        false as podeDerivarAcao           : Boolean,
        false as ocultaDerivarAcao         : Boolean,
        false as podeEmitirAval            : Boolean,
        false as ocultaEmitirAval          : Boolean,
        false as podeCriarAcao             : Boolean,
        false as ocultaGestaoAcoes         : Boolean,
        false as podeComentarTratativa     : Boolean,
        false as ocultaComentarTratativa   : Boolean,
        false as ocultaOperacoesDeAcao     : Boolean,
        acoes         : Composition of many Acoes on acoes.tratativa = $self,
        participantes : Composition of many Participantes on participantes.tratativa = $self,
        evidencias    : Composition of many Evidencias on evidencias.tratativa = $self,
        comentarios   : Composition of many Comentarios on comentarios.tratativa = $self,
        historico     : Association to many Historico on historico.tratativa = $self,
        avalesTecnicos : Association to many AvalesTecnicos on avalesTecnicos.tratativa = $self
  } actions {
    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeIniciar
    action iniciarTratativa();

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeEncerrar
    action encerrarTratativa();

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeCancelar
    action cancelarTratativa(justificativa : String(500));

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeReabrir
    action reabrirTratativa(justificativa : String(500));

    @requires: 'GestorTratativa'
    action mudarStatus(status : String, justificativa : String);

    @requires: 'GestorTratativa'
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);

    @requires: 'GestorTratativa'
    action mudarCriticidade(criticidade : m.Criticidade);

    @requires: 'GestorTratativa'
    action aplicarTemplate(templateId : UUID);

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeCriarAcao
    action criarAcao(descricao : String, responsavel : String, prazo : Date, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeComentarTratativa
    action comentarTratativa(texto : String, mencoes : many String) returns ResultadoComentario;

    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeDefinirMetodologia
    action definirMetodologia(ferramenta : String, categoriaCausaRaiz : String, dados : LargeString, confirmarSubstituicao : Boolean);

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeDerivarAcao
    action derivarAcaoDaMetodologia(causaIdentificador : String, descricao : String, responsavel : String, prazo : Date, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    @requires: 'ValidadorTecnico'
    @Core.OperationAvailable: in.podeEmitirAval
    action emitirAvalTecnico(parecer : String, fundamentacao : String);
  };

  type ResultadoCriacaoAcao {
    codigo : UUID;
  }

  type ResultadoComentario {
    codigo : UUID;
  }

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

  type FormatoEvidencia {
    extensao : String(10);
    tipos    : many String(100);
  }

  type RegrasAnexoEvidencia {
    tamanhoMaximo : Integer;
    formatos      : many FormatoEvidencia;
  }

  @requires: 'authenticated-user'
  function regrasAnexoEvidencia() returns RegrasAnexoEvidencia;

  action criarTratativaAvulsa(
    titulo                : String(200),
    descricao             : String(5000),
    criticidade           : m.Criticidade,
    unidade               : String(100),
    area                  : String(100),
    solicitante           : String(50)
  ) returns Tratativas;

  @readonly
  entity Colaboradores {
    key matricula : String(50);
        nome      : String(100);
        email     : String(100);
  }

  @readonly
  entity ValoresCriticidade {
    key codigo    : String(10);
        descricao : String(50);
  }

  @readonly
  entity ValoresPrioridade {
    key codigo    : String(10);
        descricao : String(50);
  }

  @readonly
  entity ValoresFerramentaMetodologia {
    key codigo    : String(20);
        descricao : String(50);
  }

  @readonly
  entity ValoresMacrocausa {
    key codigo    : String(50);
        descricao : String(50);
  }

  @readonly
  entity ValoresParecerAval {
    key codigo    : String(20);
        descricao : String(50);
  }

  @readonly
  entity ValoresEvidenciaObrigatoria {
    key codigo    : String(10);
        descricao : String(50);
  }

  @readonly
  @cds.redirection.target
  entity Acoes as projection on m.Acoes {
    key codigo,
        tratativa,
        descricao,
        prioridade,
        status,
        prazo,
        evidenciaObrigatoria,
        dataConclusao,
        responsavel,
        causaIdentificador,
        causaDescricao,
        acaoMae.codigo as acaoMae_codigo,
        acaoMae : Association to Acoes on acaoMae.codigo = $self.acaoMae_codigo,
        false as ocultaOperacoesDaLinha : Boolean,
        false as podeCriarSubacao       : Boolean,
        false as podeDelegar            : Boolean,
        false as podeAnexarEvidencia    : Boolean,
        false as podeComentarAcao       : Boolean,
        false as podeIniciarAcao        : Boolean,
        false as podeConcluirAcao       : Boolean
  } actions {
    @Core.OperationAvailable: in.podeIniciarAcao
    action iniciar();

    @Core.OperationAvailable: in.podeConcluirAcao
    action concluir();

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeCriarSubacao
    action criarSubacao(descricao : String, responsavel : String, prazo : Date, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeDelegar
    action delegarAcao(novoResponsavel : String, justificativa : String);

    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeAnexarEvidencia
    action anexarEvidencia(nomeArquivo : String, mimeType : String, conteudo : String, descricao : String) returns DetalheEvidencia;

    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeComentarAcao
    action comentarAcao(texto : String, mencoes : many String) returns ResultadoComentario;
  };

  @readonly
  entity AvalesTecnicos as projection on m.AvalesTecnicos {
    key id,
        tratativa,
        parecer,
        fundamentacao,
        validador,
        emitidoEm,
        false as vigente : Boolean
  };

  @readonly
  entity Participantes as projection on m.ParticipantesTratativa {
    key ID,
        tratativa,
        matricula,
        sequencia,
        criadoEm
  };

  @readonly
  entity Evidencias as projection on m.Evidencias {
    *,
    false as ocultaRemover : Boolean,
    false as podeRemover   : Boolean
  } actions {
    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeRemover
    action removerEvidencia();
  };

  @readonly
  entity Comentarios as projection on m.Comentarios;

  @readonly
  entity Historico as projection on m.HistoricoTratativa;

  @readonly
  @cds.redirection.target: false
  @cds.query.limit: { default: 50, max: 200 }
  entity MinhasAcoes as projection on m.Acoes {
    key codigo as codigoAcao,
        tratativa.codigo as codigoTratativa,
        tratativa.titulo as tituloTratativa,
        tratativa.status as statusTratativa,
        descricao,
        prioridade,
        status as statusAcao,
        prazo,
        evidenciaObrigatoria,
        dataConclusao
  } actions {
    action iniciar();
    action concluir();
  };

  @readonly
  @cds.redirection.target: false
  @cds.query.limit: { default: 50, max: 200 }
  entity MinhasTratativas as projection on m.Tratativas {
    key codigo as codigoTratativa,
        titulo as tituloTratativa,
        origem,
        idOrigem,
        criticidade,
        status as statusTratativa,
        unidade,
        area,
        dataPrevistaConclusao,
        'Responsável' as meuPapel : String(30)
  };
}

annotate TratativaAppService.Tratativas with @cds.search: {
  descricao: false,
  solicitante: false,
  responsavelPrincipal: false,
  metodologiaAutor: false,
  metodologiaData: false
};

annotate TratativaAppService.Acoes with @cds.search: {
  responsavel: false,
  causaDescricao: false
};

annotate TratativaAppService.AvalesTecnicos with @cds.search: {
  validador: false,
  fundamentacao: false
};

annotate TratativaAppService.Participantes with @cds.search: {
  matricula: false
};

annotate TratativaAppService.Evidencias with @cds.search: {
  autorAnexo: false,
  autorRemocao: false
};

annotate TratativaAppService.Historico with @cds.search: {
  autor: false,
  justificativa: false,
  valorAnterior: false,
  valorNovo: false
};

annotate TratativaAppService.MencoesComentario with @cds.search: {
  matricula: false
};
