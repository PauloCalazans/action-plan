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
      Label: 'Emitir Aval Técnico',
      Action: 'TratativaAppService.emitirAvalTecnico',
      @UI.Hidden: ocultaEmitirAval
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Alterar Criticidade',
      Action: 'TratativaAppService.mudarCriticidade'
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
      ID: 'AvaliacoesTecnicasFacet',
      Label: 'Avaliações Técnicas',
      Target: 'avalesTecnicos/@UI.LineItem'
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
    { $Type: 'UI.DataField', Value: acaoMae_codigo, Label: 'Ação mãe' }
  ]
);

annotate TratativaAppService.AvalesTecnicos with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: parecer, @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: fundamentacao },
    { $Type: 'UI.DataField', Value: validador },
    { $Type: 'UI.DataField', Value: emitidoEm },
    { $Type: 'UI.DataField', Value: vigente }
  ]
);

annotate TratativaAppService.AvalesTecnicos with {
  parecer       @title: 'Parecer';
  fundamentacao @title: 'Fundamentação';
  validador     @title: 'Validador';
  emitidoEm     @title: 'Emitido em';
  vigente       @title: 'Vigente';
};

annotate TratativaAppService.ValoresFerramentaMetodologia with {
  codigo    @title: 'Código';
  descricao @title: 'Descrição';
};

annotate TratativaAppService.ValoresMacrocausa with {
  codigo    @title: 'Código';
  descricao @title: 'Descrição';
};

annotate TratativaAppService.ValoresParecerAval with {
  codigo    @title: 'Código';
  descricao @title: 'Descrição';
};

annotate TratativaAppService.Evidencias with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigo },
    { $Type: 'UI.DataField', Value: conteudo },
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
  metodologia           @title: 'Metodologia';
  categoriaCausaRaiz    @title: 'Categoria da causa raiz';
  metodologiaData       @title: 'Análise da metodologia';
  metodologiaAutor      @title: 'Autor da metodologia';
  metodologiaAtualizadoEm @title: 'Metodologia atualizada em';
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
  causaIdentificador   @title: 'Identificador da causa';
  causaDescricao       @title: 'Causa de origem';
  acaoMae_codigo       @title: 'Ação mãe';
};

annotate TratativaAppService.Participantes with {
  matricula @title: 'Matrícula';
  sequencia @title: 'Sequência';
  criadoEm  @title: 'Criado em';
};

annotate TratativaAppService.Evidencias with {
  codigo       @title: 'Código';
  nomeArquivo  @title: 'Nome do arquivo';
  conteudo     @title: 'Nome do arquivo';
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
  comentarTratativa(texto @title: 'Comentário' @UI.Placeholder: 'Digite seu comentário sobre esta ocorrência ou ação (até 2.000 caracteres). Evite incluir nomes de pessoas ou dados sensíveis. Menções a participantes devem ser feitas no campo de menções.', mencoes @title: 'Menções');
  definirMetodologia(
    ferramenta @title: 'Ferramenta',
    categoriaCausaRaiz @title: 'Categoria da causa raiz',
    dados @title: 'Análise',
    confirmarSubstituicao @title: 'Confirmar substituição'
  );
  derivarAcaoDaMetodologia(
    causaIdentificador @title: 'Causa de origem' @Common.FieldControl: #ReadOnly,
    descricao @title: 'Descrição' @UI.Placeholder: 'Descreva os fatos sem incluir nomes ou dados sensíveis.',
    responsavel @title: 'Responsável',
    prazo @title: 'Prazo',
    prioridade @title: 'Prioridade',
    evidenciaObrigatoria @title: 'Evidência obrigatória'
  );
  emitirAvalTecnico(
    parecer @title: 'Parecer'
      @UI.Placeholder: 'Selecione Aprovado para validar a eficácia comprovada das contramedidas ou Reprovado se o desvio persistir',
    fundamentacao @title: 'Fundamentação'
      @UI.Placeholder: 'Fundamente tecnicamente a comprovação de eficácia das ações ou o motivo detalhado da reprovação (mínimo de 20 caracteres). Evite dados sensíveis'
  );
};

annotate TratativaAppService.Acoes with actions {
  criarSubacao(
    descricao @title: 'Descrição' @UI.Placeholder: 'Descreva os fatos sem incluir nomes ou dados sensíveis.',
    responsavel @title: 'Responsável',
    prazo @title: 'Prazo',
    prioridade @title: 'Prioridade',
    evidenciaObrigatoria @title: 'Evidência obrigatória'
  );
  delegarAcao(
    novoResponsavel @title: 'Novo responsável',
    justificativa @title: 'Justificativa' @UI.Placeholder: 'Explique o motivo sem incluir nomes ou dados sensíveis.'
  );
  anexarEvidencia(
    nomeArquivo @title: 'Nome do arquivo',
    mimeType @title: 'Tipo do arquivo',
    conteudo @title: 'Conteúdo',
    descricao @title: 'Descrição'
  );
  comentarAcao(
    texto @title: 'Comentário' @UI.Placeholder: 'Digite seu comentário sobre esta ocorrência ou ação (até 2.000 caracteres). Evite incluir nomes de pessoas ou dados sensíveis. Menções a participantes devem ser feitas no campo de menções.',
    mencoes @title: 'Menções'
  );
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
  iniciarTratativa @Core.OperationAvailable: in.podeIniciar
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir', 'in/podeEmitirAval', 'in/ocultaEmitirAval', 'in/podeDefinirMetodologia', 'in/ocultaDefinirMetodologia', 'in/podeDerivarAcao', 'in/ocultaDerivarAcao', 'in/podeCriarAcao', 'in/podeComentarTratativa', 'in/ocultaComentarTratativa', 'in/ocultaOperacoesDeAcao'], TargetEntities: ['in/acoes', 'in/evidencias', 'in/comentarios'] };
  encerrarTratativa @Core.OperationAvailable: in.podeEncerrar
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir', 'in/podeEmitirAval', 'in/ocultaEmitirAval', 'in/podeDefinirMetodologia', 'in/ocultaDefinirMetodologia', 'in/podeDerivarAcao', 'in/ocultaDerivarAcao', 'in/podeCriarAcao', 'in/podeComentarTratativa', 'in/ocultaComentarTratativa', 'in/ocultaOperacoesDeAcao'], TargetEntities: ['in/acoes', 'in/evidencias', 'in/comentarios'] };
  cancelarTratativa @Core.OperationAvailable: in.podeCancelar
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir', 'in/podeEmitirAval', 'in/ocultaEmitirAval', 'in/podeDefinirMetodologia', 'in/ocultaDefinirMetodologia', 'in/podeDerivarAcao', 'in/ocultaDerivarAcao', 'in/podeCriarAcao', 'in/podeComentarTratativa', 'in/ocultaComentarTratativa', 'in/ocultaOperacoesDeAcao'], TargetEntities: ['in/acoes', 'in/evidencias', 'in/comentarios'] };
  reabrirTratativa @Core.OperationAvailable: in.podeReabrir
    @Common.SideEffects: { TargetProperties: ['in/status', 'in/podeIniciar', 'in/podeEncerrar', 'in/podeCancelar', 'in/podeReabrir', 'in/ocultaIniciar', 'in/ocultaEncerrar', 'in/ocultaCancelar', 'in/ocultaReabrir', 'in/podeEmitirAval', 'in/ocultaEmitirAval', 'in/podeDefinirMetodologia', 'in/ocultaDefinirMetodologia', 'in/podeDerivarAcao', 'in/ocultaDerivarAcao', 'in/podeCriarAcao', 'in/podeComentarTratativa', 'in/ocultaComentarTratativa', 'in/ocultaOperacoesDeAcao'], TargetEntities: ['in/acoes', 'in/evidencias', 'in/comentarios'] };

  emitirAvalTecnico @Core.OperationAvailable: in.podeEmitirAval
    @Common.SideEffects: {
      TargetProperties: ['in/podeEmitirAval', 'in/ocultaEmitirAval', 'in/podeEncerrar', 'in/ocultaEncerrar'],
      TargetEntities: ['in/avalesTecnicos', 'in/historico']
    };
  definirMetodologia @Core.OperationAvailable: in.podeDefinirMetodologia
    @Common.SideEffects: {
      TargetProperties: ['in/metodologia', 'in/categoriaCausaRaiz', 'in/podeDerivarAcao', 'in/ocultaDerivarAcao'],
      TargetEntities: ['in/historico']
    };
  derivarAcaoDaMetodologia @Core.OperationAvailable: in.podeDerivarAcao
    @Common.SideEffects: {
      TargetProperties: ['in/podeEmitirAval', 'in/ocultaEmitirAval', 'in/podeEncerrar', 'in/ocultaEncerrar'],
      TargetEntities: ['in/acoes', 'in/historico']
    };

  emitirAvalTecnico(
    parecer @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresParecerAval',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: parecer, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    )
  );

  derivarAcaoDaMetodologia(
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

  mudarCriticidade(
    criticidade @(
      title: 'Nova criticidade',
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
};

annotate TratativaAppService.Acoes with actions {
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
