# Task: 001-acabamento-ui-fiori

**Spec:** agentic/projeto/specs/acabamento-ui-fiori/spec.md
**Design:** agentic/projeto/specs/acabamento-ui-fiori/design.md
**Status:** em-andamento
**Branch:** acabamento-ui-fiori/001-acabamento-ui-fiori

## Arquivos

### Criados
- `app/tratativas/webapp/Component.js`
- `app/tratativas/webapp/index.html`
- `app/minhas-pendencias/webapp/Component.js`
- `app/minhas-pendencias/webapp/index.html`
- `app/administracao/webapp/Component.js`
- `app/administracao/webapp/index.html`
- `test/ui-acabamento.test.ts`

### Modificados
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
<!-- app/<app>/webapp/index.html (Sandbox local) -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><Título da Aplicação> - Sandbox</title>
  <script
    id="sap-ui-bootstrap"
    src="https://ui5.sap.com/1.120.0/resources/sap-ui-core.js"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-resourceroots='{ "br.com.calazanstec.actionplan.<appName>": "./" }'
    data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"
    data-sap-ui-compatVersion="edge"
    data-sap-ui-async="true"
    data-sap-ui-frameOptions="trusted">
  </script>
</head>
<body class="sapUiBody" id="content">
  <div
    data-sap-ui-component
    data-name="br.com.calazanstec.actionplan.<appName>"
    data-id="container"
    data-settings='{ "id" : "<appName>" }'>
  </div>
</body>
</html>
```

---

## Regras para todas as etapas

- **R1: Componentes SAPUI5 e Execução Local Autônoma:** Toda aplicação em `app/` possui `Component.js` estendendo `sap.fe.core.AppComponent` e arquivo `index.html` com bootstrap sandbox local Fiori. O empacotamento MTA/HTML5 da spec 014 não pode ser quebrado.
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

## Etapa 2: Componentes SAPUI5 autônomos (`Component.js`) e sandbox local (`index.html`)

**CAs cobertos:** CA1, CA2, CA16.
**Itens N3 envolvidos:** N3-5.

### Verificação visual no navegador (portal do Maestri)
- O orquestrador abre no navegador corporativo (portal do Maestri) as três URLs locais de sandbox:
  - `http://localhost:4004/tratativas/webapp/index.html`
  - `http://localhost:4004/minhas-pendencias/webapp/index.html`
  - `http://localhost:4004/administracao/webapp/index.html`
- Comprova que cada aplicação carrega com sucesso como aplicação SAPUI5 Fiori elements v4 autônoma com tema Horizon e casca visual completa, sem necessidade de acessar através do preview genérico `$fiori-preview` do CAP.

### RED
Criar bloco de testes em `test/ui-acabamento.test.ts` verificando:
- Presença e conteúdo válido dos arquivos `Component.js` estendendo `sap.fe.core.AppComponent` nas três aplicações (`app/tratativas/webapp/`, `app/minhas-pendencias/webapp/` e `app/administracao/webapp/`) (CA1).
- Presença e estrutura válida dos arquivos `index.html` em cada aplicação contendo bootstrap UI5 via CDN com `ComponentSupport` e tema Horizon (CA1).
- Validação estática de que a configuração do `mta.yaml`, `ui5.yaml` e `package.json` de cada app permanece íntegra para o empacotamento MTA/HTML5 (CA1, CA16).

### GREEN
- Criar `app/tratativas/webapp/Component.js` e `app/tratativas/webapp/index.html`.
- Criar `app/minhas-pendencias/webapp/Component.js` e `app/minhas-pendencias/webapp/index.html`.
- Criar `app/administracao/webapp/Component.js` e `app/administracao/webapp/index.html`.
- Garantir que `ui5 build` continue gerando os zips sem erros e que os arquivos estáticos sejam servidos pelo CAP.

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
2. Cada aplicação em `app/` possui `Component.js` e `index.html` operacionais e carrega de forma autônoma como app SAPUI5.
3. 100% dos textos expostos na interface possuem rótulos em pt-BR sem identificadores técnicos em camelCase.
4. Botão "Criar Tratativa Avulsa" abre diálogo canônico com persistência síncrona para qualquer usuário autenticado.
5. Diálogos oferecem DatePicker para datas, dropdowns para campos discretos e Value Help para colaboradores via SuccessFactors sob a LGPD.
6. Transições de status da Tratativa seguem o ciclo de vida oficial da spec 003 com visibilidade condicional e justificativa obrigatória em Cancelar e Reabrir.
7. Administração disponibiliza botões "Salvar Parâmetros" e "Executar Processamento Manual" operacionais.
8. Rotina `diasDoPrazo` em `srv/tratativa/prazo.ts` trata defensivamente ausência de prazos com recusa 400 sem `TypeError`.
9. `npm run lint`, `npm test` e `npm run arch` passam com retorno zero no `verify.sh`, sem navegadores reais na esteira.
