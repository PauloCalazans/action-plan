using TratativaAppService from '../../srv/tratativa-app-service';

annotate TratativaAppService.MinhasAcoes with @(
  UI.SelectionPresentationVariant #MinhasAcoes: {
    Text: 'Minhas Ações',
    SelectionVariant: { SelectOptions: [] },
    PresentationVariant: { Visualizations: ['@UI.LineItem'] }
  },
  UI.HeaderInfo: {
    TypeName: 'Minha Ação',
    TypeNamePlural: 'Minhas Ações'
  },
  UI.SelectionFields: [ statusAcao ],
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigoAcao },
    {
      $Type: 'UI.DataFieldWithIntentBasedNavigation',
      Value: codigoTratativa,
      SemanticObject: 'Tratativa',
      Action: 'manage'
    },
    { $Type: 'UI.DataField', Value: tituloTratativa },
    { $Type: 'UI.DataField', Value: statusTratativa },
    { $Type: 'UI.DataField', Value: descricao },
    { $Type: 'UI.DataField', Value: prioridade },
    { $Type: 'UI.DataField', Value: statusAcao },
    { $Type: 'UI.DataField', Value: prazo },
    { $Type: 'UI.DataField', Value: evidenciaObrigatoria },
    { $Type: 'UI.DataField', Value: dataConclusao },
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

annotate TratativaAppService.MinhasTratativas with @(
  UI.SelectionPresentationVariant #MinhasTratativas: {
    Text: 'Minhas Tratativas',
    SelectionVariant: { SelectOptions: [] },
    PresentationVariant: { Visualizations: ['@UI.LineItem'] }
  },
  UI.HeaderInfo: {
    TypeName: 'Minha Tratativa',
    TypeNamePlural: 'Minhas Tratativas'
  },
  UI.SelectionFields: [ statusTratativa ],
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigoTratativa },
    {
      $Type: 'UI.DataFieldWithIntentBasedNavigation',
      Value: tituloTratativa,
      SemanticObject: 'Tratativa',
      Action: 'manage'
    },
    { $Type: 'UI.DataField', Value: origem },
    { $Type: 'UI.DataField', Value: idOrigem },
    { $Type: 'UI.DataField', Value: criticidade },
    { $Type: 'UI.DataField', Value: statusTratativa },
    { $Type: 'UI.DataField', Value: meuPapel },
    { $Type: 'UI.DataField', Value: unidade },
    { $Type: 'UI.DataField', Value: area },
    { $Type: 'UI.DataField', Value: dataPrevistaConclusao }
  ]
);

annotate TratativaAppService.MinhasAcoes with {
  statusAcao           @title: 'Status da ação';
  codigoAcao           @title: 'Código da ação';
  codigoTratativa      @title: 'Código da tratativa';
  tituloTratativa      @title: 'Título da tratativa';
  statusTratativa      @title: 'Status da tratativa';
  descricao            @title: 'Descrição';
  prioridade           @title: 'Prioridade';
  prazo                @title: 'Prazo';
  evidenciaObrigatoria @title: 'Evidência obrigatória';
  dataConclusao        @title: 'Data de conclusão';
};

annotate TratativaAppService.MinhasTratativas with {
  statusTratativa       @title: 'Status da tratativa';
  codigoTratativa       @title: 'Código da tratativa';
  tituloTratativa       @title: 'Título da tratativa';
  origem                @title: 'Origem';
  idOrigem              @title: 'Registro de origem';
  criticidade           @title: 'Criticidade';
  meuPapel              @title: 'Meu papel';
  unidade               @title: 'Unidade';
  area                  @title: 'Área';
  dataPrevistaConclusao @title: 'Data prevista';
};
