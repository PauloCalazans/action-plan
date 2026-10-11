# Task: 001-acabamento-ui-fiori

**Spec:** agentic/projeto/specs/acabamento-ui-fiori/spec.md
**Design:** agentic/projeto/specs/acabamento-ui-fiori/design.md
**Status:** em-andamento
**Branch:** acabamento-ui-fiori/001-acabamento-ui-fiori

## Arquivos

### Criados
- `app/index.html` (Fiori Launchpad Sandbox unificado com os 3 tiles pelos intents e navegação hash)
- `app/sandbox.js` (configuração externa desacoplada do sandbox UShell sem script inline)
- `app/tratativas/webapp/Component.js`
- `app/tratativas/webapp/index.html` (sandbox individual com `resources/sap-ui-core.js` local, ComponentSupport, sem CDN e sem script inline)
- `app/minhas-pendencias/webapp/Component.js`
- `app/minhas-pendencias/webapp/index.html` (sandbox individual com `resources/sap-ui-core.js` local, ComponentSupport, sem CDN e sem script inline)
- `app/administracao/webapp/Component.js`
- `app/administracao/webapp/index.html` (sandbox individual com `resources/sap-ui-core.js` local, ComponentSupport, sem CDN e sem script inline)
- `test/ui-acabamento.test.ts`

### Modificados
- `package.json` (raiz: inclusão da devDependency `cds-plugin-ui5: "0.9.3"` e configuração de perfis de autenticação em `cds.requires.auth`: `[development]` como `kind: "dummy"`, `[test]` como `kind: "mocked"` com os 7 usuários mocked pré-existentes, e `[papeis]` como `kind: "mocked"`)
- `app/tratativas/ui5.yaml` (projeto UI5 Tooling: framework SAPUI5 1.120.0 e custom task `ui5-task-zipper` gerando `brcomcalazanstecactionplantratativas.zip`)
- `app/tratativas/package.json` (remoção da flag `--archive` inexistente no UI5 CLI 4 e adição da devDependency `ui5-task-zipper: "^3.1.3"`)
- `app/minhas-pendencias/ui5.yaml` (projeto UI5 Tooling: framework SAPUI5 1.120.0 e custom task `ui5-task-zipper` gerando `brcomcalazanstecactionplanminhaspendencias.zip`)
- `app/minhas-pendencias/package.json` (remoção da flag `--archive` inexistente no UI5 CLI 4 e adição da devDependency `ui5-task-zipper: "^3.1.3"`)
- `app/administracao/ui5.yaml` (projeto UI5 Tooling: framework SAPUI5 1.120.0 e custom task `ui5-task-zipper` gerando `brcomcalazanstecactionplanadministracao.zip`)
- `app/administracao/package.json` (remoção da flag `--archive` inexistente no UI5 CLI 4 e adição da devDependency `ui5-task-zipper: "^3.1.3"`)
- `srv/tratativa/prazo.ts` (tratamento defensivo de ausência de prazos com recusa 400 sem `TypeError`)
- `srv/tratativa-app-service.cds` (remoção de data discricionária em `criarTratativaAvulsa`, tipagem `Date` em prazos de ações, ações dedicadas de status com flags `pode<Acao>` e `oculta<Acao>`, `@Core.OperationAvailable`, projeção `Colaboradores` e domínios fixos)
- `srv/tratativa-app-service.ts` (handlers das ações dedicadas de transição, resolução de flags de status e visibilidade, compatibilidade de `Date` com validação de string, leitura de `Colaboradores` e listas de valores fixos)
- `app/tratativas/annotations.cds` (Action Import `EntityContainer/criarTratativaAvulsa`, botões dedicados de status com `@UI.Hidden: oculta<Acao>`, labels em Dados Gerais, colunas com `@UI.Importance: #High`, anotações canônicas de ações e Value Helps/dropdowns em criarTratativaAvulsa, mudarCriticidade, criarAcao, criarSubacao e delegarAcao)
- `app/tratativas/webapp/i18n/i18n.properties` (catálogo completo de textos pt-BR e placeholders LGPD)
- `app/minhas-pendencias/annotations.cds` (rótulos amigáveis pt-BR em colunas e filtros)
- `app/minhas-pendencias/webapp/i18n/i18n.properties` (textos e rótulos pt-BR)
- `app/administracao/annotations.cds` (rótulos pt-BR e botões operacionais "Salvar Parâmetros" e "Executar Processamento Manual" via `EntityContainer/` em Parâmetros de Alertas com popup nativo de resultado)
- `app/administracao/webapp/i18n/i18n.properties` (textos, abas e rótulos pt-BR)
- `test/ui-tratativas.test.ts` (atualização de asserções textuais de Action Import com `EntityContainer/` e ações dedicadas de status)
- `test/ui-administracao.test.ts` (atualização de asserções textuais de Action Import com `EntityContainer/`)

> **Substituição de testes legados:** Os testes estruturais existentes da etapa 2 em `test/ui-acabamento.test.ts` (implementados sob a abordagem anterior de CDN pública e flag `--archive`) serão integralmente substituídos na execução da Etapa 2 por asserções estruturais estáticas que validam o padrão CAP/BAS (`cds-plugin-ui5`, `resources/sap-ui-core.js` local, ausência de CDN, ausência de scripts inline, launchpad sandbox unificado com 3 intents, `ui5-task-zipper` e perfis de auth no `package.json`).

---

## Interfaces

```cds
// srv/tratativa-app-service.cds (trechos aditivos e modificados)
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
        false as ocultaResponsaveis : Boolean,
        false as podeIniciar        : Boolean,
        false as podeEncerrar       : Boolean,
        false as podeCancelar       : Boolean,
        false as podeReabrir        : Boolean,
        false as ocultaIniciar      : Boolean,
        false as ocultaEncerrar     : Boolean,
        false as ocultaCancelar     : Boolean,
        false as ocultaReabrir      : Boolean,
        acoes         : Composition of many Acoes on acoes.tratativa = $self,
        participantes : Composition of many Participantes on participantes.tratativa = $self,
        evidencias    : Composition of many Evidencias on evidencias.tratativa = $self,
        comentarios   : Composition of many Comentarios on comentarios.tratativa = $self,
        historico     : Association to many Historico on historico.tratativa = $self
  } actions {
    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeIniciar
    action iniciarTratativa();

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeEncerrar
    action encerrarTratativa();

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeCancelar
    action cancelarTratativa(
      @Common.Label: 'Justificativa do cancelamento'
      justificativa : String(500)
    );

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeReabrir
    action reabrirTratativa(
      @Common.Label: 'Justificativa da reabertura'
      justificativa : String(500)
    );

    @requires: 'GestorTratativa'
    action mudarStatus(status : String, justificativa : String);

    @requires: 'GestorTratativa'
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);

    @requires: 'GestorTratativa'
    action mudarCriticidade(
      @Common.Label: 'Nova criticidade'
      criticidade : m.Criticidade
    );

    @requires: 'GestorTratativa'
    action aplicarTemplate(templateId : UUID);

    @requires: 'GestorTratativa'
    action criarAcao(
      @Common.Label: 'Descrição da ação'
      descricao            : String,
      @Common.Label: 'Responsável'
      responsavel          : String,
      @Common.Label: 'Prazo limite'
      prazo                : Date,
      @Common.Label: 'Prioridade'
      prioridade           : String,
      @Common.Label: 'Evidência obrigatória'
      evidenciaObrigatoria : String
    ) returns ResultadoCriacaoAcao;

    @requires: 'GestorTratativa'
    action criarSubacao(
      @Common.Label: 'Ação superior'
      acaoMae              : UUID,
      @Common.Label: 'Descrição da subação'
      descricao            : String,
      @Common.Label: 'Responsável'
      responsavel          : String,
      @Common.Label: 'Prazo limite'
      prazo                : Date,
      @Common.Label: 'Prioridade'
      prioridade           : String,
      @Common.Label: 'Evidência obrigatória'
      evidenciaObrigatoria : String
    ) returns ResultadoCriacaoAcao;

    @requires: 'GestorTratativa'
    action delegarAcao(
      @Common.Label: 'Ação'
      acao            : UUID,
      @Common.Label: 'Novo responsável'
      novoResponsavel : String,
      @Common.Label: 'Justificativa'
      justificativa   : String
    );

    @requires: 'authenticated-user'
    action anexarEvidencia(acao : UUID, nomeArquivo : String, mimeType : String, conteudo : String, descricao : String) returns DetalheEvidencia;

    @requires: 'authenticated-user'
    action removerEvidencia(acao : UUID, evidencia : UUID);

    @requires: 'authenticated-user'
    action comentarTratativa(texto : String, mencoes : many String) returns ResultadoComentario;

    @requires: 'authenticated-user'
    action comentarAcao(acao : String, texto : String, mencoes : many String) returns ResultadoComentario;
  };

  action criarTratativaAvulsa(
    @Common.Label: 'Título da tratativa'
    titulo      : String(200),
    @Common.Label: 'Descrição detalhada'
    descricao   : String(5000),
    @Common.Label: 'Criticidade'
    criticidade : m.Criticidade,
    @Common.Label: 'Unidade corporativa'
    unidade     : String(100),
    @Common.Label: 'Área operacional'
    area        : String(100),
    @Common.Label: 'Colaborador solicitante'
    solicitante : String(50)
  ) returns Tratativas;

  @readonly
  entity Colaboradores {
    @Common.Label: 'Matrícula funcional'
    key matricula : String(50);
    @Common.Label: 'Nome completo'
        nome      : String(100);
    @Common.Label: 'E-mail corporativo'
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
  entity ValoresEvidenciaObrigatoria {
    key codigo    : String(10);
        descricao : String(50);
  }
}

// app/tratativas/annotations.cds (anotações canônicas de ações e ValueLists)
annotate TratativaAppService with actions {
  criarTratativaAvulsa(
    criticidade @(
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
};

annotate TratativaAppService.Tratativas with actions {
  iniciarTratativa @Core.OperationAvailable: podeIniciar;
  encerrarTratativa @Core.OperationAvailable: podeEncerrar;
  cancelarTratativa @Core.OperationAvailable: podeCancelar;
  reabrirTratativa @Core.OperationAvailable: podeReabrir;

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
```

```javascript
// app/<app>/webapp/Component.js
sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
  "use strict";

  return AppComponent.extend("br.com.calazanstec.actionplan.<appName>.Component", {
    metadata: {
      manifest: "json"
    }
  });
});
```

```html
<!-- app/<app>/webapp/index.html (Sandbox individual local sem CDN e sem script inline) -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><Título da Aplicação> - Sandbox</title>
  <style>
    html, body, #content, #container {
      height: 100%;
      margin: 0;
    }
  </style>
  <script
    id="sap-ui-bootstrap"
    src="resources/sap-ui-core.js"
    data-sap-ui-libs="sap.ui.core,sap.fe.templates"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-language="pt-BR"
    data-sap-ui-resourceroots='{ "br.com.calazanstec.actionplan.<appName>": "./" }'
    data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
    data-sap-ui-compatVersion="edge"
    data-sap-ui-async="true"
    data-sap-ui-frameOptions="allow">
  </script>
</head>
<body class="sapUiBody" id="content">
  <div
    id="container"
    data-sap-ui-component
    data-name="br.com.calazanstec.actionplan.<appName>"
    data-id="container"
    data-settings='{ "id" : "<appName>" }'>
  </div>
</body>
</html>
```

```html
<!-- app/index.html (Fiori Launchpad Sandbox unificado sem script inline) -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plataforma de Ação - Fiori Launchpad</title>
  <script src="sandbox.js"></script>
  <script
    id="sap-ui-bootstrap"
    src="resources/sap-ui-core.js"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-language="pt-BR"
    data-sap-ui-compatVersion="edge"
    data-sap-ui-async="true"
    data-sap-ui-on-init="module:sap/ushell/shells/sandbox/fioriSandbox"
    data-sap-ui-frameOptions="allow">
  </script>
</head>
<body class="sapUiBody" id="canvas">
  <div id="canvas" class="sapUiBody"></div>
</body>
</html>
```

```javascript
// app/sandbox.js (Configuração externa desacoplada do Fiori Launchpad Sandbox sem inline script)
window["sap-ushell-config"] = {
  defaultRenderer: "fiori2",
  renderers: {
    fiori2: {
      applications: {
        "Tratativa-manage": {
          title: "Gestão de Tratativas",
          subtitle: "Plataforma de Ação",
          icon: "sap-icon://task",
          additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.tratativas",
          applicationType: "URL",
          url: "./tratativas/webapp"
        },
        "MinhasPendencias-display": {
          title: "Minhas Pendências",
          subtitle: "Ações e Ocorrências",
          icon: "sap-icon://user-edit",
          additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.minhaspendencias",
          applicationType: "URL",
          url: "./minhas-pendencias/webapp"
        },
        "AdministracaoPlataforma-manage": {
          title: "Administração da Plataforma",
          subtitle: "Parâmetros e Alertas",
          icon: "sap-icon://settings",
          additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.administracao",
          applicationType: "URL",
          url: "./administracao/webapp"
        }
      }
    }
  },
  services: {
    NavTargetResolution: {
      config: {
        enableClientSideTargetResolution: true
      }
    }
  }
};
```

```json
// package.json (raiz: dependência cds-plugin-ui5 e perfis de auth [development], [test], [papeis])
{
  "cds": {
    "requires": {
      "auth": {
        "[development]": {
          "kind": "dummy"
        },
        "[test]": {
          "kind": "mocked",
          "users": {
            "app-origem-a": { "password": "", "roles": ["AplicativoOrigem"] },
            "app-origem-b": { "password": "", "roles": ["AplicativoOrigem"] },
            "app-revogado": { "password": "", "roles": ["AplicativoOrigem"] },
            "admin": { "password": "", "roles": ["Administrador"] },
            "usuario": { "password": "", "roles": [] },
            "gestor": { "password": "", "roles": ["GestorTratativa"] },
            "leitor-analitico": { "password": "", "roles": ["LeitorAnalitico"] }
          }
        },
        "[papeis]": {
          "kind": "mocked",
          "users": {
            "app-origem-a": { "password": "", "roles": ["AplicativoOrigem"] },
            "app-origem-b": { "password": "", "roles": ["AplicativoOrigem"] },
            "app-revogado": { "password": "", "roles": ["AplicativoOrigem"] },
            "admin": { "password": "", "roles": ["Administrador"] },
            "usuario": { "password": "", "roles": [] },
            "gestor": { "password": "", "roles": ["GestorTratativa"] },
            "leitor-analitico": { "password": "", "roles": ["LeitorAnalitico"] }
          }
        },
        "[production]": {
          "kind": "xsuaa"
        }
      }
    }
  },
  "devDependencies": {
    "cds-plugin-ui5": "0.9.3"
  }
}
```

```yaml
# app/<app>/ui5.yaml (Projeto UI5 Tooling com framework SAPUI5 e custom task ui5-task-zipper)
specVersion: "4.0"
metadata:
  name: br.com.calazanstec.actionplan.<appName>
type: application
framework:
  name: SAPUI5
  version: "1.120.0"
  libraries:
    - name: sap.m
    - name: sap.ui.core
    - name: sap.fe.templates
    - name: themelib_sap_horizon
builder:
  customTasks:
    - name: ui5-task-zipper
      afterTask: generateVersionInfo
      configuration:
        archiveName: <archiveName>
        additionalFiles:
          - xs-app.json
resources:
  configuration:
    paths:
      webapp: webapp
```

```json
// app/<app>/package.json (Script build sem a flag --archive e devDependency ui5-task-zipper)
{
  "name": "action-plan-<appName>",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "ui5 build --config=ui5.yaml --clean-dest"
  },
  "devDependencies": {
    "@ui5/cli": "^4.0.0",
    "ui5-task-zipper": "^3.1.3"
  }
}
```

---

## Regras para todas as etapas

- **R1: Componentes SAPUI5, Sandbox Launchpad e Execução Local no Padrão CAP/BAS:** Toda aplicação em `app/` possui `Component.js` estendendo `sap.fe.core.AppComponent` e arquivo `webapp/index.html` com bootstrap local em `resources/sap-ui-core.js` e `ComponentSupport` sem scripts inline nem CDN externa. A raiz de `app/` possui `app/index.html` e `app/sandbox.js` configurando o Fiori Launchpad Sandbox com os 3 tiles pelos intents (`Tratativa-manage`, `MinhasPendencias-display`, `AdministracaoPlataforma-manage`) e navegação por hash. A execução local é unificada via `cds watch` na raiz com o plugin `cds-plugin-ui5` e estratégia de autenticação `'dummy'` em `[development]` (sem diálogo de login), reservando perfil `'mocked'` para testes manuais de papéis (`[papeis]`) e para a suíte automatizada sob `cds.test` (`[test]`). O empacotamento MTA/HTML5 da spec 014 é realizado via custom task `ui5-task-zipper` sem a flag inválida `--archive`.
- **R2: Internacionalização e Rótulos em pt-BR:** 100% dos textos expostos na interface (entidades, campos, colunas, filtros, ações e parâmetros) utilizam rótulos claros em Português do Brasil, eliminando identificadores técnicos em camelCase.
- **R3: Action Import "Criar Tratativa Avulsa":** Declarado como Action Import no EntityContainer (`TratativaAppService.EntityContainer/criarTratativaAvulsa`), abrindo modal com parâmetros canônicos (sem data discricionária) e acessível a qualquer usuário autenticado.
- **R4: Tipagem Semântica e Ajudas Visuais:** Prazos como `Date` (`Edm.Date`), recebidos no backend como string ISO `'YYYY-MM-DD'` compatíveis com `validarPrazo`, listas suspensas com `@Common.ValueListWithFixedValues` (Criticidade em tratativas e mudarCriticidade; Prioridade e Evidência Obrigatória em criarAcao e criarSubacao) e Value Help de colaboradores (`Colaboradores`) em criarTratativaAvulsa, criarAcao, criarSubacao e delegarAcao consumindo SuccessFactors exclusivamente para leitura sob a LGPD.
- **R5: Visibilidade e Habilitação de Transições de Status:** Botões de cabeçalho dedicados para cada ação de ciclo de vida da spec 003, governados declarativamente por `@Core.OperationAvailable: pode<Acao>` na definição das ações bound e `@UI.Hidden: oculta<Acao>` em `UI.Identification` com flags `oculta<Acao> = !pode<Acao>` declaradas na entidade `Tratativas`, com justificativa obrigatória em Cancelar e Reabrir.
- **R6: Completude Visual e Funcional:** Dados Gerais com etiquetas identificadoras, colunas Unidade/Área/Data prevista visíveis sem corte e botões "Salvar Parâmetros" e "Executar Processamento Manual" operacionais na Administração via `EntityContainer/`, com popup nativo de resultado para o tipo complexo `RelatorioProcessamentoAlertas` sem necessidade de código customizado.
- **R7: Robustez e Resiliência do Backend:** Consulta de prazos de criticidade (`diasDoPrazo`) trata bases com tabela `PrazosCriticidade` não inicializada com recusa 400 estruturada, sem lançar `TypeError` e sem interromper o servidor.
- **R8: Proteção LGPD e Menor Privilégio:** Value Help restrito a atributos corporativos não sensíveis, placeholders de conscientização contra dados de saúde em campos de texto livre e mascaramento de campos nulos para não gestores.
- **R9: Generalidade e Ausência de Regras Departamentais:** Nenhuma tela, coluna, texto ou ajuda apresenta termos específicos do SESMT ou de áreas isoladas (AGENTS.md:36).
- **R10: Verificação em Duas Camadas:** Esteira automatizada headless sob `cds.test` com SQLite em memória (`verify.sh`) sem navegador real (AGENTS.md:38), combinada com inspeção visual guiada no portal do Maestri documentada em cada etapa.

---

## Itens N3 (aguardam aprovação no Gate 1)

- **N3-1 (R7, Achado 8):** Tratamento defensivo em `srv/tratativa/prazo.ts` com recusa 400 estruturada (`Prazo não configurado para a criticidade informada.`, `target: criticidade`) quando `PrazosCriticidade` estiver vazia.
- **N3-2 (R3, Achado 3):** Ajuste no Action Import `TratativaAppService.EntityContainer/criarTratativaAvulsa` e remoção do parâmetro discricionário `dataPrevistaConclusao`.
- **N3-3 (R4, Achado 4):** Exposição da entidade `Colaboradores` em `TratativaAppService` para Value Help conectada ao SuccessFactors em modo estritamente leitura sob LGPD.
- **N3-4 (R5, Achado 5):** Ações dedicadas de status (`iniciarTratativa`, `encerrarTratativa`, `cancelarTratativa`, `reabrirTratativa`) com controle declarativo `@Core.OperationAvailable`.
- **N3-5 (R10):** Protocolo de testes headless na esteira de engenharia e roteiro de verificação visual no portal do Maestri.

---

## Etapa 1: Robustez do backend e contratos de serviço (`diasDoPrazo`, tipagem Date, listas de valores e Value Help SF)

**CAs cobertos:** CA5, CA7, CA9, CA13, CA14, CA16.
**Itens N3 envolvidos:** N3-1, N3-2, N3-3, N3-4, N3-5.

### Verificação visual no navegador (portal do Maestri)
- O orquestrador valida via navegador/chamadas HTTP que o endpoint `/api/app/v1/$metadata` expõe os novos tipos: parâmetro `prazo` como `Edm.Date`, entidade `Colaboradores` (com campos `matricula`, `nome`, `email`, sem CPF), entidades `ValoresCriticidade`, `ValoresPrioridade` e `ValoresEvidenciaObrigatoria`, e que chamadas de abertura de tratativa em base com prazos não cadastrados retornam recusa HTTP 400 estruturada sem interrupção do servidor Node.js.

### RED
Criar bloco de testes em `test/ui-acabamento.test.ts` verificando:
- Chamada a `diasDoPrazo` com tabela `PrazosCriticidade` vazia não lança `TypeError` e devolve recusa 400 estruturada com `target: 'criticidade'` e mensagem `Prazo não configurado para a criticidade informada.` (CA13).
- Metadados de `TratativaAppService` não contêm o parâmetro `dataPrevistaConclusao` na action `criarTratativaAvulsa` (CA5).
- Parâmetro `prazo` nas actions `criarAcao` e `criarSubacao` tipado como data (`Edm.Date`), compatível em runtime com a validação `validarPrazo` (CA7, Achado 5).
- Anotações `Common.ValueList` e `Common.ValueListWithFixedValues` nos parâmetros de ações (`ValoresCriticidade`, `ValoresPrioridade`, `ValoresEvidenciaObrigatoria` e `Colaboradores`) (CA7, Achado 3).
- Entidade `Colaboradores` expõe no OData unicamente `matricula`, `nome` e `email`, sem campos de CPF ou dados sensíveis (CA14).
- Ações dedicadas de status (`iniciarTratativa`, `encerrarTratativa`, `cancelarTratativa`, `reabrirTratativa`) presentes nos metadados com `@Core.OperationAvailable: pode<Acao>`, e com justificativa obrigatória em Cancelar e Reabrir (CA9, Achado 2).
- Entidade `Tratativas` expõe as propriedades booleanas `pode<Acao>` e `oculta<Acao>` (`ocultaIniciar`, `ocultaEncerrar`, `ocultaCancelar`, `ocultaReabrir`) para controle dinâmico de UI (CA9, Achado 1).

### GREEN
- Refatorar `diasDoPrazo` em `srv/tratativa/prazo.ts` tratando `prazo` ausente com `recusar(400, 'Prazo não configurado para a criticidade informada.', 'criticidade')`.
- Atualizar `srv/tratativa-app-service.cds` removendo `dataPrevistaConclusao` de `criarTratativaAvulsa`, ajustando `prazo : Date` em `criarAcao`/`criarSubacao`, adicionando as ações dedicadas de status com `@Core.OperationAvailable: pode<Acao>`, declarando na entidade `Tratativas` as propriedades `pode<Acao>` e `oculta<Acao>`, e expondo as entidades `Colaboradores`, `ValoresCriticidade`, `ValoresPrioridade`, `ValoresEvidenciaObrigatoria`.
- Implementar em `srv/tratativa-app-service.ts` os handlers para as novas ações de status, cálculo das flags `pode<Acao>` e `oculta<Acao> = !pode<Acao>` no hook `after('READ', 'Tratativas')`, repasse do parâmetro `prazo : Date` (recebido como string ISO `'YYYY-MM-DD'`) mantendo compatibilidade com `validarPrazo`, e handlers de `READ` para `Colaboradores` (delegando a `buscarColaboradores` da spec 011 / cache) e domínios fixos.

---

## Etapa 2: Componentes SAPUI5, sandbox Fiori launchpad e execução local no padrão CAP/BAS

**CAs cobertos:** CA1, CA2, CA16.
**Itens N3 envolvidos:** N3-5.

### Verificação visual no navegador (portal do Maestri)
- O orquestrador inicia o servidor CAP na raiz do projeto via `cds watch` (perfil padrão de desenvolvimento com estratégia de autenticação `'dummy'`).
- Abre no navegador corporativo (portal do Maestri) o endereço `http://localhost:4004/` (ou `http://localhost:4004/app/index.html` ou `/index.html`):
  - A página abre diretamente sem solicitar usuário/senha (sem diálogo nem modal de login HTTP Basic).
  - Exibe o Fiori Launchpad Sandbox com os 3 tiles configurados via `app/sandbox.js`:
    1. "Gestão de Tratativas" (intent `#Tratativa-manage`)
    2. "Minhas Pendências" (intent `#MinhasPendencias-display`)
    3. "Administração da Plataforma" (intent `#AdministracaoPlataforma-manage`)
  - O orquestrador clica nos tiles e comprova a navegação entre os 3 apps no padrão Fiori Launchpad:
    - O clique em "Gestão de Tratativas" navega para `#Tratativa-manage` e renderiza o List Report de Tratativas.
    - O clique em "Minhas Pendências" navega para `#MinhasPendencias-display` e renderiza a tela com as abas de pendências.
    - O clique em "Administração da Plataforma" navega para `#AdministracaoPlataforma-manage` e renderiza a tela administrativa.
    - A transição entre os apps ocorre via hash navigation sem recarregamento completo da casca (shell).
  - Todas as aplicações carregam recursos locais providos pelo `cds-plugin-ui5` em `resources/sap-ui-core.js`, sem qualquer dependência ou requisição para CDNs externas.
  - O orquestrador valida também a abertura individual de cada aplicação em suas URLs locais (`/tratativas/webapp/index.html`, `/minhas-pendencias/webapp/index.html` e `/administracao/webapp/index.html`), comprovando o carregamento autônomo com tema Horizon via `ComponentSupport`.

### RED
Criar/atualizar bloco de testes automatizados estruturais estáticos em `test/ui-acabamento.test.ts` (sem invocar comandos npm dentro do Jest e sem abrir navegador real na esteira de engenharia), substituindo os testes legados que exigiam CDN externa ou a flag `--archive`:
- **CA1 [estrutural - Component.js]:** valida que cada uma das três aplicações (`app/tratativas/webapp/`, `app/minhas-pendencias/webapp/`, `app/administracao/webapp/`) possui o arquivo `Component.js` estendendo `sap.fe.core.AppComponent` e declarando `metadata: { manifest: "json" }`.
- **CA1 [estrutural - index.html por app]:** valida que `webapp/index.html` de cada aplicação referencia `src="resources/sap-ui-core.js"` local, configura `data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"`, tema `sap_horizon`, tag container `<div data-sap-ui-component ...>`, NÃO contém referências a CDN externa (`https://ui5.sap.com` ou `https://sapui5.hana.ondemand.com`) e NÃO contém scripts inline (`<script>...</script>` com corpo executável).
- **CA1 [estrutural - Launchpad Sandbox unificado]:** valida que existem `app/index.html` e `app/sandbox.js`; que `app/index.html` importa `<script src="sandbox.js"></script>`, carrega `resources/sap-ui-core.js` local, inicializa `sap/ushell/shells/sandbox/fioriSandbox` e NÃO contém scripts inline nem referências a CDN; e que `app/sandbox.js` define `window["sap-ushell-config"]` configurando os 3 intents (`Tratativa-manage`, `MinhasPendencias-display`, `AdministracaoPlataforma-manage`) com os IDs de componentes e títulos corretos.
- **CA1 [estrutural - Dependências e perfis no package.json raiz]:** valida que `package.json` na raiz declara `cds-plugin-ui5` (versão `"0.9.3"`) em `devDependencies`; que `cds.requires.auth` define `[development]` com `kind: "dummy"`, `[test]` com `kind: "mocked"` contendo o dicionário com os 7 usuários mocked pré-existentes, e `[papeis]` com `kind: "mocked"`.
- **CA1 e CA16 [estrutural - UI5 Tooling e ui5-task-zipper]:** valida que `ui5.yaml` de cada app declara `framework: { name: "SAPUI5", version: "1.120.0" }` e a custom task `ui5-task-zipper` configurada para gerar o arquivo zip com o nome esperado pelo `mta.yaml`; e que `package.json` de cada app declara `ui5-task-zipper` (versão `"^3.1.3"`) em `devDependencies` e script `build` sem a flag inválida `--archive` (`ui5 build --config=ui5.yaml --clean-dest`).

### GREEN
- Atualizar `package.json` na raiz do projeto: adicionar `"cds-plugin-ui5": "0.9.3"` às `devDependencies`, configurar `cds.requires.auth` com `[development]: { "kind": "dummy" }`, `[test]: { "kind": "mocked", "users": { ... } }` e `[papeis]: { "kind": "mocked", "users": { ... } }`.
- Criar `app/sandbox.js` definindo a configuração externa `window["sap-ushell-config"]` com os 3 intents dos manifestos (`Tratativa-manage`, `MinhasPendencias-display`, `AdministracaoPlataforma-manage`).
- Criar `app/index.html` com o bootstrap do Fiori Launchpad Sandbox UShell consumindo `sandbox.js` e `resources/sap-ui-core.js` local, sem scripts inline.
- Atualizar `app/tratativas/webapp/index.html`, `app/minhas-pendencias/webapp/index.html` e `app/administracao/webapp/index.html` substituindo a URL da CDN por `resources/sap-ui-core.js` local, garantindo `ComponentSupport` e ausência de scripts inline.
- Atualizar `app/tratativas/ui5.yaml`, `app/minhas-pendencias/ui5.yaml` e `app/administracao/ui5.yaml` configurando framework SAPUI5 versão `1.120.0` e custom task `ui5-task-zipper` com `archiveName` alinhado ao `mta.yaml`.
- Atualizar `app/tratativas/package.json`, `app/minhas-pendencias/package.json` e `app/administracao/package.json` adicionando `"ui5-task-zipper": "^3.1.3"` às `devDependencies` e ajustando o script `build` para `ui5 build --config=ui5.yaml --clean-dest` (sem `--archive`).
- Manter os arquivos `Component.js` em cada app herdando de `sap.fe.core.AppComponent`.

---

## Etapa 3: Rótulos amigáveis pt-BR, internacionalização e acabamento de `app/tratativas/`

**CAs cobertos:** CA3, CA4, CA6, CA8, CA10, CA15, CA16.
**Itens N3 envolvidos:** N3-2, N3-3, N3-4, N3-5.

### Verificação visual no navegador (portal do Maestri)
- O orquestrador acessa a aplicação Gestão de Tratativas (`/tratativas/webapp/index.html`) no navegador e valida:
  1. **Lista de Tratativas:** barra de filtros e cabeçalhos de tabela exibem rótulos em pt-BR (Código, Título, Origem, ID na Origem, Criticidade, Status, Unidade, Área, Data Prevista de Conclusão); colunas Unidade, Área e Data prevista visíveis sem corte em desktop.
  2. **Criar Tratativa Avulsa:** botão na barra de ferramentas abre diálogo modal com Título, Criticidade (com dropdown), Descrição, Unidade, Área e Solicitante (com Value Help); nenhum campo de data discricionária é exibido; preenchimento e clique em Criar salva e inclui a ocorrência na lista.
  3. **Object Page e Ciclo de Vida:** seção "Dados Gerais" exibe valores rotulados com suas etiquetas identificadoras; botões de transição de status aparecem conforme a máquina de estados:
     - Em `Aberta`: botões "Iniciar Tratativa", "Encerrar Tratativa" e "Cancelar Tratativa" visíveis; "Reabrir Tratativa" ausente.
     - Ao clicar em "Iniciar Tratativa": status muda para `Em andamento`, botões "Encerrar Tratativa" e "Cancelar Tratativa" aparecem.
     - Ao clicar em "Cancelar Tratativa": diálogo solicita Justificativa obrigatória com placeholder orientativo contra dados sensíveis; após confirmação, status passa a `Cancelada` e nenhum botão de transição permanece visível.
  4. **Adicionar Ação:** diálogo exibe seletor de calendário no campo Prazo, dropdowns em Prioridade e Evidência Obrigatória, e ícone de pesquisa no campo Responsável abrindo Value Help de colaboradores do SuccessFactors.

### RED
Criar bloco de testes em `test/ui-acabamento.test.ts` e ajustar asserções pré-existentes em `test/ui-tratativas.test.ts` verificando:
- Inexistência de identificadores técnicos em camelCase nas anotações de `app/tratativas/` (todos os campos com `@Common.Label` ou `@title` em pt-BR) (CA3).
- Declaração do botão "Criar Tratativa Avulsa" apontando para `TratativaAppService.EntityContainer/criarTratativaAvulsa` (CA5).
- Ajuste das asserções em `test/ui-tratativas.test.ts`: linha 129 para `EntityContainer/criarTratativaAvulsa` e linha 141 para as ações dedicadas de status (`iniciarTratativa`, `encerrarTratativa`, `cancelarTratativa`, `reabrirTratativa`) com `@UI.Hidden: oculta<Acao>` em substituição a `mudarStatus` (Achado 4).
- Anotações `@UI.LineItem` de Tratativas contendo colunas Unidade, Área e Data prevista com `@UI.Importance: #High` (CA11).
- Anotações `@UI.FieldGroup#DadosGerais` contendo labels em todos os DataFields (CA11).
- Anotações dos botões de transição em `@UI.Identification` com `@UI.Hidden: oculta<Acao>` condicionados às flags de status da Tratativa, sem `@Core.OperationAvailable` dentro do DataField (CA9, Achados 1 e 2).
- Anotações canônicas de Value Help e dropdowns nos parâmetros das ações via `annotate ... with actions { ... }` para `criarTratativaAvulsa`, `mudarCriticidade`, `criarAcao`, `criarSubacao` e `delegarAcao` (CA7, Achado 3).
- Presença de placeholders com orientação contra dados sensíveis em `i18n.properties` (CA15).

### GREEN
- Atualizar `app/tratativas/annotations.cds` com Action Import no EntityContainer, `@UI.Importance: #High` nas colunas, rótulos explícitos em `FieldGroup#DadosGerais`, botões dedicados de transição em `@UI.Identification` com `@UI.Hidden: oculta<Acao>` (sem `@Core.OperationAvailable` dentro do DataField), e anotações canônicas no escopo de ações com `@Common.ValueList` / `@Common.ValueListWithFixedValues` em `criarTratativaAvulsa`, `mudarCriticidade`, `criarAcao`, `criarSubacao` e `delegarAcao`.
- Atualizar `app/tratativas/webapp/i18n/i18n.properties` com todos os textos amigáveis em pt-BR e placeholders LGPD.
- Atualizar `test/ui-tratativas.test.ts` alinhando as asserções de texto com a nova convenção canônica (`EntityContainer/` e ações dedicadas de status) (Achado 4).

---

## Etapa 4: Acabamento de `app/minhas-pendencias/` e `app/administracao/`

**CAs cobertos:** CA3, CA4, CA11, CA12, CA16.
**Itens N3 envolvidos:** N3-4, N3-5.

### Verificação visual no navegador (portal do Maestri)
- O orquestrador acessa as aplicações de Minhas Pendências e Administração no navegador e valida:
  1. **Minhas Pendências (`/minhas-pendencias/webapp/index.html`):** abas "Minhas Ações" e "Minhas Tratativas" exibem cabeçalhos de colunas e filtros inteiramente traduzidos em pt-BR sem identificadores técnicos.
  2. **Administração (`/administracao/webapp/index.html`):** aba "Parâmetros de Alertas" exibe os botões "Salvar Parâmetros" e "Executar Processamento Manual" visíveis na barra de ferramentas / cabeçalho; ao clicar em "Salvar Parâmetros", os dados são persistidos e confirmação (Toast) é exibida; ao clicar em "Executar Processamento Manual", o processamento é executado imediatamente exibindo o diálogo/popup nativo do Fiori elements v4 com o resumo de alertas gerados (`RelatorioProcessamentoAlertas`) sem código customizado (Achado 6).

### RED
Criar bloco de testes em `test/ui-acabamento.test.ts` e ajustar asserções pré-existentes em `test/ui-administracao.test.ts` verificando:
- Inexistência de camelCase nas anotações e i18n de `app/minhas-pendencias/` e `app/administracao/` (CA3).
- Aba Parâmetros de Alertas em `app/administracao/annotations.cds` declara botões para `atualizarParametrosAlertas` ("Salvar Parâmetros") e `executarProcessamentoAlertas` ("Executar Processamento Manual") via `EntityContainer` (CA11).
- Ajuste das asserções em `test/ui-administracao.test.ts` (linhas 104-105) para `AdministracaoService.EntityContainer/atualizarParametrosAlertas` e `AdministracaoService.EntityContainer/executarProcessamentoAlertas` (Achado 4).
- Textos em pt-BR em `app/minhas-pendencias/webapp/i18n/i18n.properties` e `app/administracao/webapp/i18n/i18n.properties` (CA3).

### GREEN
- Atualizar `app/minhas-pendencias/annotations.cds` e `app/minhas-pendencias/webapp/i18n/i18n.properties` com rótulos amigáveis em pt-BR para todas as colunas e filtros de Minhas Ações e Minhas Tratativas.
- Atualizar `app/administracao/annotations.cds` incluindo os botões `UI.DataFieldForAction` para `atualizarParametrosAlertas` e `executarProcessamentoAlertas` em `LineItem` e `Identification` via `EntityContainer/`, e atualizar `app/administracao/webapp/i18n/i18n.properties` com todos os textos amigáveis em pt-BR.
- Atualizar `test/ui-administracao.test.ts` alinhando as asserções de texto para a sintaxe `EntityContainer/` (Achado 4).

---

## Critérios de Pronto

1. Todos os 16 critérios de aceite (CA1 a CA16) atendidos integralmente.
2. Cada aplicação em `app/` possui `Component.js` e `index.html` locais (sem CDN e sem script inline), o launchpad sandbox unificado `app/index.html` e `app/sandbox.js` provê navegação entre os 3 apps por intents, o servidor local opera via `cds-plugin-ui5` com auth dummy em desenvolvimento, e o empacotamento MTA utiliza `ui5-task-zipper`.
3. 100% dos textos expostos na interface possuem rótulos em pt-BR sem identificadores técnicos em camelCase.
4. Botão "Criar Tratativa Avulsa" abre diálogo canônico com persistência síncrona para qualquer usuário autenticado.
5. Diálogos oferecem DatePicker para datas, dropdowns para campos discretos e Value Help para colaboradores via SuccessFactors sob a LGPD.
6. Transições de status da Tratativa seguem o ciclo de vida oficial da spec 003 com visibilidade condicional e justificativa obrigatória em Cancelar e Reabrir.
7. Administração disponibiliza botões "Salvar Parâmetros" e "Executar Processamento Manual" operacionais.
8. Rotina `diasDoPrazo` em `srv/tratativa/prazo.ts` trata defensivamente ausência de prazos com recusa 400 sem `TypeError`.
9. `npm run lint`, `npm test` e `npm run arch` passam com retorno zero no `verify.sh`, sem navegadores reais na esteira.
