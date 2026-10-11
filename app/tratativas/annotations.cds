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
      Action: 'TratativaAppService.mudarStatus'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Encerrar Tratativa',
      Action: 'TratativaAppService.mudarStatus'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Cancelar Tratativa',
      Action: 'TratativaAppService.mudarStatus'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Reabrir Tratativa',
      Action: 'TratativaAppService.mudarStatus'
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
    { $Type: 'UI.DataField', Value: codigo },
    { $Type: 'UI.DataField', Value: titulo },
    { $Type: 'UI.DataField', Value: origem },
    { $Type: 'UI.DataField', Value: idOrigem },
    { $Type: 'UI.DataField', Value: criticidade },
    { $Type: 'UI.DataField', Value: status },
    { $Type: 'UI.DataField', Value: unidade },
    { $Type: 'UI.DataField', Value: area },
    { $Type: 'UI.DataField', Value: dataPrevistaConclusao },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Criar Tratativa Avulsa',
      Action: 'TratativaAppService.criarTratativaAvulsa'
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
      { $Type: 'UI.DataField', Value: titulo },
      { $Type: 'UI.DataField', Value: descricao },
      { $Type: 'UI.DataField', Value: unidade },
      { $Type: 'UI.DataField', Value: area },
      { $Type: 'UI.DataField', Value: solicitante },
      { $Type: 'UI.DataField', Value: dataPrevistaConclusao }
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
