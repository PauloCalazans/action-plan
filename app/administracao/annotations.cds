using AdministracaoService from '../../srv/administracao-service';

annotate AdministracaoService.Templates with @(
  UI.HeaderInfo: {
    TypeName: 'Template de Ações',
    TypeNamePlural: 'Templates de Ações',
    Title: { $Type: 'UI.DataField', Value: nome },
    Description: { $Type: 'UI.DataField', Value: id }
  },
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: id },
    { $Type: 'UI.DataField', Value: nome },
    { $Type: 'UI.DataField', Value: descricao },
    { $Type: 'UI.DataField', Value: ativo },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Criar Template',
      Action: 'AdministracaoService.criarTemplate'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Editar',
      Action: 'AdministracaoService.editarTemplate'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Ativar',
      Action: 'AdministracaoService.ativarTemplate'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Desativar',
      Action: 'AdministracaoService.desativarTemplate'
    }
  ],
  UI.Facets: [
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'TemplateDetalheFacet',
      Label: 'Detalhes do Template',
      Target: '@UI.FieldGroup#DetalheTemplate'
    }
  ],
  UI.FieldGroup #DetalheTemplate: {
    Data: [
      { $Type: 'UI.DataField', Value: id },
      { $Type: 'UI.DataField', Value: nome },
      { $Type: 'UI.DataField', Value: descricao },
      { $Type: 'UI.DataField', Value: ativo }
    ]
  }
);

annotate AdministracaoService.ParametrosAlertas with @(
  UI.HeaderInfo: {
    TypeName: 'Parâmetros de Alertas',
    TypeNamePlural: 'Parâmetros de Alertas'
  },
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: diasAntecedenciaPrazoProximo },
    { $Type: 'UI.DataField', Value: diasInatividade },
    { $Type: 'UI.DataField', Value: emailHabilitado },
    { $Type: 'UI.DataField', Value: teamsHabilitado },
    { $Type: 'UI.DataField', Value: horaExecucaoUtc }
  ],
  UI.Identification: [
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Salvar Parâmetros',
      Action: 'AdministracaoService.atualizarParametrosAlertas'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Executar Processamento Manual',
      Action: 'AdministracaoService.executarProcessamentoAlertas'
    }
  ],
  UI.Facets: [
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'ConfiguracaoAlertasFacet',
      Label: 'Configuração de Alertas',
      Target: '@UI.FieldGroup#Configuracao'
    }
  ],
  UI.FieldGroup #Configuracao: {
    Data: [
      { $Type: 'UI.DataField', Value: diasAntecedenciaPrazoProximo },
      { $Type: 'UI.DataField', Value: diasInatividade },
      { $Type: 'UI.DataField', Value: emailHabilitado },
      { $Type: 'UI.DataField', Value: teamsHabilitado },
      { $Type: 'UI.DataField', Value: horaExecucaoUtc }
    ]
  }
);

annotate AdministracaoService.ParametrosIntegracaoSF with @(
  UI.HeaderInfo: {
    TypeName: 'Estrutura Organizacional SF',
    TypeNamePlural: 'Estrutura Organizacional SF'
  },
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: nivelUnidadeSF },
    { $Type: 'UI.DataField', Value: nivelAreaSF }
  ],
  UI.Identification: [
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Salvar Mapeamento',
      Action: 'AdministracaoService.atualizarParametrosIntegracaoSF'
    }
  ],
  UI.Facets: [
    {
      $Type: 'UI.ReferenceFacet',
      ID: 'MapeamentoSFFacet',
      Label: 'Mapeamento de Estrutura Organizacional',
      Target: '@UI.FieldGroup#Mapeamento'
    }
  ],
  UI.FieldGroup #Mapeamento: {
    Data: [
      { $Type: 'UI.DataField', Value: nivelUnidadeSF },
      { $Type: 'UI.DataField', Value: nivelAreaSF }
    ]
  }
);
