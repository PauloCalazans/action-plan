using TratativaAppService from '../../srv/tratativa-app-service';

annotate TratativaAppService.MinhasAcoes with @(
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
