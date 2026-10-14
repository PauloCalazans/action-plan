using AdministracaoService from '../../srv/administracao-service';

annotate AdministracaoService.criarTemplate with (
  nome      @title: 'Nome',
  descricao @title: 'Descrição',
  itens     @title: 'Itens'
);

annotate AdministracaoService.editarTemplate with (
  id        @title: 'Template',
  nome      @title: 'Nome',
  descricao @title: 'Descrição',
  itens     @title: 'Itens'
);

annotate AdministracaoService.ativarTemplate with (id @title: 'Template');

annotate AdministracaoService.desativarTemplate with (id @title: 'Template');

annotate AdministracaoService.listarTemplates with (
  ativo         @title: 'Ativo',
  tamanhoPagina @title: 'Tamanho da página',
  pagina        @title: 'Página'
);

annotate AdministracaoService.consultarTemplate with (template @title: 'Template');

annotate AdministracaoService.atualizarParametrosIntegracaoSF with (
  nivelUnidadeSF @title: 'Nível da unidade no SF',
  nivelAreaSF    @title: 'Nível da área no SF'
);

annotate AdministracaoService.atualizarParametrosAlertas with @Common.SideEffects: {
  TargetEntities: ['/AdministracaoService.EntityContainer/ParametrosAlertas']
};

annotate AdministracaoService.atualizarParametrosAlertas with (
  diasAntecedenciaPrazoProximo @title: 'Dias de antecedência do prazo',
  diasInatividade              @title: 'Dias de inatividade',
  emailHabilitado              @title: 'E-mail habilitado',
  teamsHabilitado              @title: 'Teams habilitado',
  horaExecucaoUtc              @title: 'Hora de execução (UTC)'
);

annotate AdministracaoService.listarAlertasEmitidos with (
  tratativa     @title: 'Tratativa',
  tipo          @title: 'Tipo',
  destinatario  @title: 'Destinatário',
  statusEnvio   @title: 'Status do envio',
  tamanhoPagina @title: 'Tamanho da página',
  pagina        @title: 'Página'
);

annotate AdministracaoService.Templates with @(
  UI.SelectionPresentationVariant #Templates: {
    Text: 'Templates de Ações',
    SelectionVariant: { SelectOptions: [] },
    PresentationVariant: { Visualizations: ['@UI.LineItem'] }
  },
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
  UI.SelectionPresentationVariant #ParametrosAlertas: {
    Text: 'Parâmetros de Alertas',
    SelectionVariant: { SelectOptions: [] },
    PresentationVariant: { Visualizations: ['@UI.LineItem'] }
  },
  UI.HeaderInfo: {
    TypeName: 'Parâmetros de Alertas',
    TypeNamePlural: 'Parâmetros de Alertas'
  },
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: diasAntecedenciaPrazoProximo },
    { $Type: 'UI.DataField', Value: diasInatividade },
    { $Type: 'UI.DataField', Value: emailHabilitado },
    { $Type: 'UI.DataField', Value: teamsHabilitado },
    { $Type: 'UI.DataField', Value: horaExecucaoUtc },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Salvar Parâmetros',
      Action: 'AdministracaoService.EntityContainer/atualizarParametrosAlertas'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Executar Processamento Manual',
      Action: 'AdministracaoService.EntityContainer/executarProcessamentoAlertas'
    }
  ],
  UI.Identification: [
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Salvar Parâmetros',
      Action: 'AdministracaoService.EntityContainer/atualizarParametrosAlertas'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Executar Processamento Manual',
      Action: 'AdministracaoService.EntityContainer/executarProcessamentoAlertas'
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
  UI.SelectionPresentationVariant #ParametrosIntegracaoSF: {
    Text: 'Estrutura Organizacional',
    SelectionVariant: { SelectOptions: [] },
    PresentationVariant: { Visualizations: ['@UI.LineItem'] }
  },
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
      Action: 'AdministracaoService.EntityContainer/atualizarParametrosIntegracaoSF'
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

annotate AdministracaoService.Templates with {
  id        @title: 'Identificador';
  nome      @title: 'Nome';
  descricao @title: 'Descrição';
  ativo     @title: 'Ativo';
};

annotate AdministracaoService.ParametrosAlertas with {
  diasAntecedenciaPrazoProximo @title: 'Dias de antecedência do prazo';
  diasInatividade              @title: 'Dias de inatividade';
  emailHabilitado              @title: 'E-mail habilitado';
  teamsHabilitado              @title: 'Teams habilitado';
  horaExecucaoUtc              @title: 'Hora de execução (UTC)';
};

annotate AdministracaoService.ParametrosIntegracaoSF with {
  nivelUnidadeSF @title: 'Nível da unidade no SF';
  nivelAreaSF    @title: 'Nível da área no SF';
};
