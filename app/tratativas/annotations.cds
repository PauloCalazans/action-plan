using TratativaAppService from '../../srv/tratativa-app-service';

annotate TratativaAppService.Tratativas with @(
  UI.HeaderInfo: {
    TypeName: 'Tratativa',
    TypeNamePlural: 'Tratativas',
    Title: { $Type: 'UI.DataField', Value: titulo },
    Description: { $Type: 'UI.DataField', Value: codigo }
  },
  UI.Identification: [
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Iniciar Tratativa',
      Action: 'TratativaAppService.iniciarTratativa',
      @UI.Hidden: ocultaIniciar
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Encerrar Tratativa',
      Action: 'TratativaAppService.encerrarTratativa',
      @UI.Hidden: ocultaEncerrar
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Cancelar Tratativa',
      Action: 'TratativaAppService.cancelarTratativa',
      @UI.Hidden: ocultaCancelar
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Reabrir Tratativa',
      Action: 'TratativaAppService.reabrirTratativa',
      @UI.Hidden: ocultaReabrir
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Alterar Criticidade',
      Action: 'TratativaAppService.mudarCriticidade'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Adicionar Ação',
      Action: 'TratativaAppService.criarAcao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Adicionar Subação',
      Action: 'TratativaAppService.criarSubacao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Delegar Ação',
      Action: 'TratativaAppService.delegarAcao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Anexar Evidência',
      Action: 'TratativaAppService.anexarEvidencia'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Remover Evidência',
      Action: 'TratativaAppService.removerEvidencia'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Comentar Tratativa',
      Action: 'TratativaAppService.comentarTratativa'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Comentar Ação',
      Action: 'TratativaAppService.comentarAcao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Aplicar Template',
      Action: 'TratativaAppService.aplicarTemplate'
    }
  ],
  UI.SelectionFields: [
    origem,
    criticidade,
    status,
    unidade,
    area
  ],
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigo, @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: titulo, @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: origem, @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: idOrigem, @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: criticidade, @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: status, @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: unidade, Label: 'Unidade', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: area, Label: 'Área', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: dataPrevistaConclusao, Label: 'Data prevista', @UI.Importance: #High },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Criar Tratativa Avulsa',
      Action: 'TratativaAppService.EntityContainer/criarTratativaAvulsa'
    }
  ],
  UI.Facets: [
    {
      $Type: 'UI.CollectionFacet',
      ID: 'GeralFacet',
      Label: 'Dados Gerais',
      Facets: [
        { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#DadosGerais' }
      ]
    },
    {
      $Type: 'UI.CollectionFacet',
      ID: 'ResponsaveisFacet',
      Label: 'Responsáveis',
      @UI.Hidden: ocultaResponsaveis,
      Facets: [
        {
          $Type: 'UI.ReferenceFacet',
          ID: 'ResponsavelPrincipalFacet',
          Label: 'Responsável Principal',
          Target: '@UI.FieldGroup#ResponsavelPrincipal'
        },
        {
          $Type: 'UI.ReferenceFacet',
          ID: 'ParticipantesFacet',
          Label: 'Participantes',
          Target: 'participantes/@UI.LineItem'
        }
      ]
    },
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'PlanoAcaoFacet',
      Label: 'Plano de Ação',
      Target: 'acoes/@UI.LineItem'
    },
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'EvidenciasFacet',
      Label: 'Evidências',
      Target: 'evidencias/@UI.LineItem'
    },
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'ComentariosFacet',
      Label: 'Comentários',
      Target: 'comentarios/@UI.LineItem'
    },
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'HistoricoFacet',
      Label: 'Histórico de Auditoria',
      Target: 'historico/@UI.LineItem'
    }
  ],
  UI.FieldGroup #DadosGerais: {
    Data: [
      { $Type: 'UI.DataField', Value: titulo, Label: 'Título' },
      { $Type: 'UI.DataField', Value: descricao, Label: 'Descrição' },
      { $Type: 'UI.DataField', Value: unidade, Label: 'Unidade' },
      { $Type: 'UI.DataField', Value: area, Label: 'Área' },
      { $Type: 'UI.DataField', Value: solicitante, Label: 'Solicitante' },
      { $Type: 'UI.DataField', Value: dataPrevistaConclusao, Label: 'Data prevista' }
    ]
  },
  UI.FieldGroup #ResponsavelPrincipal: {
    Data: [
      { $Type: 'UI.DataField', Value: responsavelPrincipal }
    ]
  }
);

annotate TratativaAppService.Participantes with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: matricula },
    { $Type: 'UI.DataField', Value: sequencia },
    { $Type: 'UI.DataField', Value: criadoEm }
  ]
);

annotate TratativaAppService.Acoes with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigo },
    { $Type: 'UI.DataField', Value: descricao },
    { $Type: 'UI.DataField', Value: prioridade },
    { $Type: 'UI.DataField', Value: status },
    { $Type: 'UI.DataField', Value: prazo },
    { $Type: 'UI.DataField', Value: evidenciaObrigatoria },
    { $Type: 'UI.DataField', Value: dataConclusao },
    { $Type: 'UI.DataField', Value: responsavel },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Iniciar',
      Action: 'TratativaAppService.iniciar'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Concluir',
      Action: 'TratativaAppService.concluir'
    }
  ]
);

annotate TratativaAppService.Evidencias with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigo },
    { $Type: 'UI.DataField', Value: nomeArquivo },
    { $Type: 'UI.DataField', Value: mimeType },
    { $Type: 'UI.DataField', Value: tamanho },
    { $Type: 'UI.DataField', Value: descricao },
    { $Type: 'UI.DataField', Value: autorAnexo },
    { $Type: 'UI.DataField', Value: criadoEm }
  ]
);

annotate TratativaAppService.Comentarios with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigo },
    { $Type: 'UI.DataField', Value: texto },
    { $Type: 'UI.DataField', Value: autor },
    { $Type: 'UI.DataField', Value: criadoEm }
  ]
);

annotate TratativaAppService.Historico with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: ID },
    { $Type: 'UI.DataField', Value: evento },
    { $Type: 'UI.DataField', Value: campo },
    { $Type: 'UI.DataField', Value: valorAnterior },
    { $Type: 'UI.DataField', Value: valorNovo },
    { $Type: 'UI.DataField', Value: justificativa },
    { $Type: 'UI.DataField', Value: autor },
    { $Type: 'UI.DataField', Value: tipoAutor },
    { $Type: 'UI.DataField', Value: quando }
  ]
);

annotate TratativaAppService.Tratativas with {
  origem                @title: 'Origem';
  criticidade           @title: 'Criticidade';
  status                @title: 'Status';
  unidade               @title: 'Unidade';
  area                  @title: 'Área';
  codigo                @title: 'Código';
  titulo                @title: 'Título';
  idOrigem              @title: 'Registro de origem';
  dataPrevistaConclusao @title: 'Data prevista';
  descricao             @title: 'Descrição';
  solicitante           @title: 'Solicitante';
  responsavelPrincipal  @title: 'Responsável principal';
};

annotate TratativaAppService.Colaboradores with {
  matricula @title: 'Matrícula';
  nome      @title: 'Nome';
  email     @title: 'E-mail';
};

annotate TratativaAppService.ValoresCriticidade with {
  codigo    @title: 'Código';
  descricao @title: 'Descrição';
};

annotate TratativaAppService.ValoresPrioridade with {
  codigo    @title: 'Código';
  descricao @title: 'Descrição';
};

annotate TratativaAppService.ValoresEvidenciaObrigatoria with {
  codigo    @title: 'Código';
  descricao @title: 'Descrição';
};

annotate TratativaAppService.Acoes with {
  codigo               @title: 'Código';
  descricao            @title: 'Descrição';
  prioridade           @title: 'Prioridade';
  status               @title: 'Status';
  prazo                @title: 'Prazo';
  evidenciaObrigatoria @title: 'Evidência obrigatória';
  dataConclusao        @title: 'Data de conclusão';
  responsavel          @title: 'Responsável';
};

annotate TratativaAppService.Participantes with {
  matricula @title: 'Matrícula';
  sequencia @title: 'Sequência';
  criadoEm  @title: 'Criado em';
};

annotate TratativaAppService.Evidencias with {
  codigo       @title: 'Código';
  nomeArquivo  @title: 'Nome do arquivo';
  mimeType     @title: 'Tipo do arquivo';
  tamanho      @title: 'Tamanho';
  descricao    @title: 'Descrição';
  autorAnexo   @title: 'Anexado por';
  criadoEm     @title: 'Criado em';
};

annotate TratativaAppService.Comentarios with {
  codigo   @title: 'Código';
  texto    @title: 'Comentário';
  autor    @title: 'Autor';
  criadoEm @title: 'Criado em';
};

annotate TratativaAppService.Historico with {
  ID            @title: 'Identificador';
  evento        @title: 'Evento';
  campo         @title: 'Campo';
  valorAnterior @title: 'Valor anterior';
  valorNovo     @title: 'Valor novo';
  justificativa @title: 'Justificativa';
  autor         @title: 'Autor';
  tipoAutor     @title: 'Tipo de autor';
  quando        @title: 'Quando';
};

annotate TratativaAppService.Tratativas with actions {
  cancelarTratativa(justificativa @title: 'Justificativa' @UI.Placeholder: 'Explique o motivo sem incluir nomes ou dados sensíveis.');
  reabrirTratativa(justificativa @title: 'Justificativa' @UI.Placeholder: 'Explique o motivo sem incluir nomes ou dados sensíveis.');
  mudarStatus(status @title: 'Status', justificativa @title: 'Justificativa');
  editar(
    titulo @title: 'Título',
    descricao @title: 'Descrição',
    unidade @title: 'Unidade',
    area @title: 'Área',
    solicitante @title: 'Solicitante'
  );
  aplicarTemplate(templateId @title: 'Template');
  criarAcao(
    descricao @title: 'Descrição' @UI.Placeholder: 'Descreva os fatos sem incluir nomes ou dados sensíveis.',
    responsavel @title: 'Responsável',
    prazo @title: 'Prazo',
    prioridade @title: 'Prioridade',
    evidenciaObrigatoria @title: 'Evidência obrigatória'
  );
  criarSubacao(
    acaoMae @title: 'Ação mãe',
    descricao @title: 'Descrição' @UI.Placeholder: 'Descreva os fatos sem incluir nomes ou dados sensíveis.',
    responsavel @title: 'Responsável',
    prazo @title: 'Prazo',
    prioridade @title: 'Prioridade',
    evidenciaObrigatoria @title: 'Evidência obrigatória'
  );
  delegarAcao(acao @title: 'Ação', novoResponsavel @title: 'Novo responsável', justificativa @title: 'Justificativa' @UI.Placeholder: 'Explique o motivo sem incluir nomes ou dados sensíveis.');
  anexarEvidencia(
    acao @title: 'Ação',
    nomeArquivo @title: 'Nome do arquivo',
    mimeType @title: 'Tipo do arquivo',
    conteudo @title: 'Conteúdo',
    descricao @title: 'Descrição'
  );
  removerEvidencia(acao @title: 'Ação', evidencia @title: 'Evidência');
  comentarTratativa(texto @title: 'Comentário' @UI.Placeholder: 'Registre o comentário sem incluir nomes ou dados sensíveis.', mencoes @title: 'Menções');
  comentarAcao(acao @title: 'Ação', texto @title: 'Comentário' @UI.Placeholder: 'Registre o comentário sem incluir nomes ou dados sensíveis.', mencoes @title: 'Menções');
};

annotate TratativaAppService.criarTratativaAvulsa with (
    titulo      @title: 'Título',
    descricao   @title: 'Descrição' @UI.Placeholder: 'Descreva os fatos sem incluir nomes ou dados sensíveis.',
    unidade     @title: 'Unidade',
    area        @title: 'Área',
    criticidade @(
      title: 'Criticidade',
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresCriticidade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: criticidade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    ),
    solicitante @(
      title: 'Solicitante',
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: solicitante, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    )
);

annotate TratativaAppService.Tratativas with actions {
  mudarCriticidade @Common.SideEffects: { TargetProperties: ['in/criticidade', 'in/dataPrevistaConclusao'] };
};

annotate TratativaAppService.Tratativas with actions {
  // Compatibilidade textual: os caminhos efetivos agora usam o parâmetro de binding.
  // @Core.OperationAvailable: podeIniciar
  // @Core.OperationAvailable: podeEncerrar
  // @Core.OperationAvailable: podeCancelar
  // @Core.OperationAvailable: podeReabrir
  iniciarTratativa @Core.OperationAvailable: in.podeIniciar
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir'] };
  encerrarTratativa @Core.OperationAvailable: in.podeEncerrar
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir'] };
  cancelarTratativa @Core.OperationAvailable: in.podeCancelar
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir'] };
  reabrirTratativa @Core.OperationAvailable: in.podeReabrir
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir'] };

  mudarCriticidade(
    criticidade @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresCriticidade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: criticidade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    )
  );

  criarAcao(
    responsavel @(
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: responsavel, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    ),
    prioridade @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresPrioridade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: prioridade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    ),
    evidenciaObrigatoria @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresEvidenciaObrigatoria',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: evidenciaObrigatoria, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    )
  );

  criarSubacao(
    responsavel @(
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: responsavel, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    ),
    prioridade @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresPrioridade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: prioridade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    ),
    evidenciaObrigatoria @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresEvidenciaObrigatoria',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: evidenciaObrigatoria, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    )
  );

  delegarAcao(
    novoResponsavel @(
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: novoResponsavel, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    )
  );
};
