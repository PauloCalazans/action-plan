# Task: 001-interface-e-acesso-corporativo

**Spec:** agentic/projeto/specs/interface-e-acesso-corporativo/spec.md
**Design:** agentic/projeto/specs/interface-e-acesso-corporativo/design.md
**Status:** em-andamento
**Branch:** interface-e-acesso-corporativo/001-interface-e-acesso-corporativo

## Arquivos

### Criados
- `srv/tratativa-app-service.cds`
- `srv/tratativa-app-service.ts`
- `app/services.cds`
- `app/tratativas/annotations.cds`
- `app/tratativas/xs-app.json`
- `app/tratativas/webapp/manifest.json`
- `app/tratativas/webapp/i18n/i18n.properties`
- `app/minhas-pendencias/annotations.cds`
- `app/minhas-pendencias/xs-app.json`
- `app/minhas-pendencias/webapp/manifest.json`
- `app/minhas-pendencias/webapp/i18n/i18n.properties`
- `app/administracao/annotations.cds`
- `app/administracao/xs-app.json`
- `app/administracao/webapp/manifest.json`
- `app/administracao/webapp/i18n/i18n.properties`
- `test/ui-tratativas.test.ts`
- `test/ui-minhas-pendencias.test.ts`
- `test/ui-administracao.test.ts`
- `test/ui-launchpad-governanca.test.ts`

### Modificados
- `srv/administracao-service.cds`

## Interfaces

```cds
// srv/tratativa-app-service.cds
using { br.com.calazanstec as m } from '../db/tratativa';

@path    : '/api/app/v1'
@requires: 'authenticated-user'
service TratativaAppService {

  @readonly
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
        false as ocultaResponsaveis : Boolean, // Resolvido no hook after('READ'): true para não-Gestores sob LGPD (Ruling R-02, CA21)
        acoes         : Composition of many Acoes on acoes.tratativa = $self,
        participantes : Composition of many Participantes on participantes.tratativa = $self,
        evidencias    : Composition of many Evidencias on evidencias.tratativa = $self,
        comentarios   : Composition of many Comentarios on comentarios.tratativa = $self,
        historico     : Association to many Historico on historico.tratativa = $self
  } actions {
    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action mudarStatus(status : String, justificativa : String);

    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);

    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action mudarCriticidade(criticidade : m.Criticidade);

    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action aplicarTemplate(templateId : UUID);
  };

  action criarTratativaAvulsa(
    titulo                : String(200),
    descricao             : String(5000),
    criticidade           : m.Criticidade,
    unidade               : String(100),
    area                  : String(100),
    solicitante           : String(50),
    dataPrevistaConclusao : Date
  ) returns Tratativas;

  @readonly
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
        acaoMae
  } actions {
    action iniciar();
    action concluir();
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
  entity Evidencias as projection on m.Evidencias;

  @readonly
  entity Comentarios as projection on m.Comentarios;

  @readonly
  entity Historico as projection on m.HistoricoTratativa;

  // Visões pessoais para "Minhas Pendências"
  @readonly
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
        'Responsável' as meuPapel : String(20) // Resolvido dinamicamente no hook after('READ') distinguindo 'Responsável Principal' vs 'Participante' (005 R19, CA15)
}
```

```cds
// srv/administracao-service.cds (projeções aditivas somente leitura para UI - Ruling R-04)
using { br.com.calazanstec as m } from '../db/tratativa';

extend service AdministracaoService with {
  /** R6, Ruling R-04: Projeções somente leitura para consumo pelo Fiori elements em app/administracao/ */
  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity Templates             as projection on m.Templates;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ParametrosAlertas     as projection on m.ParametrosAlertas;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ParametrosIntegracaoSF as projection on m.ParametrosIntegracaoSF;
}
```

```cds
// app/services.cds
using from './tratativas/annotations';
using from './minhas-pendencias/annotations';
using from './administracao/annotations';
```

```json
// app/<app>/xs-app.json (padrao para tratativas, minhas-pendencias e administracao)
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/api/(.*)$",
      "target": "/api/$1",
      "destination": "action-plan-srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": false
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

```json
// app/<app>/webapp/manifest.json (trecho de declaracao sap.cloud e sap.app.crossNavigation)
{
  "sap.app": {
    "crossNavigation": {
      "inbounds": {
        "Tratativa-manage": {
          "semanticObject": "Tratativa",
          "action": "manage",
          "title": "{{appTitle}}",
          "subTitle": "{{appSubTitle}}",
          "icon": "sap-icon://task"
        }
      }
    }
  },
  "sap.cloud": {
    "public": true,
    "service": "br.com.calazanstec.actionplan"
  }
}
```

## Regras
- R1: Ponto de entrada único e autenticação exclusiva pelo SAP Build Work Zone (elo Managed App Router ↔ CAP via destination `action-plan-srv-api` com `HTML5.ForwardAuthToken=true`; validação de JWT via `cds.requires.auth = "xsuaa"` em produção e `mocked` em desenvolvimento; sem tela de login; opções de origem da matrícula funcional em N3-5).
- R2: Estrutura de aplicações Fiori elements em `app/` (três aplicações LR/OP: `app/tratativas/`, `app/minhas-pendencias/`, `app/administracao/`), consumindo `TratativaAppService` para operações de ocorrências/pendências e `AdministracaoService` diretamente para administração corporativa.
- R3: Arquitetura sem rascunhos (Direct Sync / `draft: false`), preservando atomicidade, locks pessimistas por agregado (D9) e evitando complexidade de subações.
- R4: Tela de Gestão de Tratativas (`app/tratativas/`: LR com filtros, botão de criação avulsa e OP com botões de cabeçalho via `@UI.Identification`, seções Dados Gerais, Responsáveis via CollectionFacet oculta condicionalmente a não-gestores, Plano de Ação hierárquico via `acaoMae`, Evidências, Comentários e Histórico).
- R5: Tela de Minhas Pendências (`app/minhas-pendencias/`: LR com IconTabBar para "Minhas Ações" e "Minhas Tratativas" com cálculo dinâmico de "Meu Papel" e botões rápidos de iniciar/concluir ação própria).
- R6: Tela de Administração (`app/administracao/`: LR/OP com abas "Templates de Ações", "Parâmetros de Alertas" com disparo manual e "Estrutura Organizacional" SF, consumindo diretamente o `AdministracaoService` estendido aditivamente em `srv/administracao-service.cds` com projeções somente leitura `Templates`, `ParametrosAlertas` e `ParametrosIntegracaoSF` restritas ao Administrador, e suas actions reais para mutações conforme Rulings R-03 e R-04).
- R7: Mapeamento de intenções semânticas em `sap.app.crossNavigation.inbounds` nos `manifest.json` das aplicações, integração com SAP Build Work Zone via HTML5 Content Provider (Channel Manager) e visibilidade governada por Site Roles vinculadas a Role Collections do BTP; unificação do papel corporativo `'Administrador'` (eliminando `'AdministradorPlataforma'`); autorização efetiva no backend via `@restrict`; bloqueio integral HTTP 403 para credencial técnica `AplicativoOrigem`.
- R8: Proteção de dados e menor privilégio na UI (LGPD): ocultação de campos nulos (`solicitante`, `descricao`, `responsavelPrincipal`, `participantes`, `responsavel`) e placeholders de conscientização em texto livre.
- R9: Contrato de exibição de erros e mensagens do backend (D10): fidelidade textual em MessageBox/Popover e estado visual de erro (`ValueState = Error`) no `target`.
- R10: Idioma oficial pt-BR em `i18n.properties`, acessibilidade WCAG 2.1 AA e responsividade.
- R11: Verificação automatizada estritamente headless com `npm run lint` e testes sob `cds.test` em memória; proibição de navegadores reais (AGENTS.md:38).
- R12: Generalidade e ausência de regras departamentais ou vocabulário exclusivo de área na UI (AGENTS.md:36).

## Itens N3 (aguardam aprovação no Gate 1)
- N3-1: Criação do serviço de interface `TratativaAppService` (`/api/app/v1`) com projeções legíveis OData v4 sem alterar `TratativaService`.
- N3-2: Papéis corporativos XSUAA, inbounds nos `manifest.json` e catálogo no SAP Build Work Zone (`authenticated-user`, `GestorTratativa`, `Administrador`, `LeitorAnalitico`, bloqueio total de `AplicativoOrigem` na UI).
- N3-3: Mascaramento LGPD aplicado no serviço de UI com entrega de `null` para campos protegidos e placeholders de conscientização em campos de texto livre.
- N3-4: Extensão aditiva do contrato público de `AdministracaoService` (`srv/administracao-service.cds`) com projeções somente leitura (`Templates`, `ParametrosAlertas`, `ParametrosIntegracaoSF`) restritas ao papel `Administrador` para consumo pelo Fiori elements (Ruling R-04).
- N3-5: Origem da matrícula funcional corporativa no SAP BTP (IAS/XSUAA vs `req.user.id`). Opção A recomendada: atributo customizado `matricula` no IAS/XSUAA propagado no JWT e consumido por `obterMatriculaUsuario`. Aguarda deliberação no Gate 1 humano. Testes locais e desenvolvimento mantêm `auth = "mocked"` com SQLite em memória.

---

## Etapa 1: Aplicação `app/tratativas/` e serviço `TratativaAppService`
CAs cobertos: CA1, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10, CA11, CA12, CA21, CA22, CA23, CA24, CA25, CA26, CA27, CA27a, CA28.
Itens N3 envolvidos: N3-1, N3-2, N3-3.

### RED
Criar `test/ui-tratativas.test.ts` verificando:
- Rejeição HTTP 401 sem token de autenticação (CA1).
- Estrutura de arquivos em `app/tratativas/` com manifesto, i18n em pt-BR e anotações CDS declarativas (CA3, CA25).
- Ausência de importação de `srv/` a partir de `app/` (CA4).
- Operação direta sem tabelas `_drafts` (CA5).
- Metadados do List Report contendo colunas e filtros padronizados ordenados por data prevista crescente, e botão de cabeçalho "Criar Tratativa Avulsa" via `UI.DataFieldForAction` apontando para `TratativaAppService.criarTratativaAvulsa` (CA6, M1).
- Botões de transição e edição do cabeçalho habilitados para Gestor e ocultos/desabilitados para outros usuários declarados via anotação `@UI.Identification` (CA7, CA8, I2).
- Renderização hierárquica em 2 níveis no Plano de Ação referenciando `acaoMae` (CA9).
- Facets e anotações `@UI.LineItem` de Responsáveis (`participantes`), Evidências, Comentários e Histórico de Auditoria (CA10, CA11, CA12).
- Mascaramento de campos nulos e proteção da seção de Responsáveis exibida exclusivamente para Gestor (`responsavelPrincipal` agrupado em `ResponsaveisFacet` via CollectionFacet com anotação declarativa de ocultação `@UI.Hidden: ocultaResponsaveis`; `responsavelPrincipal` e lista de `participantes` ocultos/nulos para usuários comuns sob LGPD; 005 R17/R26, CA21, I3).
- Presença de placeholders de conscientização contra dados sensíveis (CA22).
- Propagação fiel de erros do backend e mapeamento de `target` com estado de erro visual (CA23, CA24).
- Operabilidade por teclado (WCAG 2.1 AA) e ausência de termos departamentais (CA26, CA28).
- Execução headless sem acionamento de navegadores reais (CA27, CA27a).

### GREEN
- Criar `srv/tratativa-app-service.cds` com `Tratativas` (incluindo `ocultaResponsaveis` e action `criarTratativaAvulsa`), `Acoes` (vinculando `acaoMae`), `Participantes`, `Evidencias`, `Comentarios` e `Historico`, e handler `srv/tratativa-app-service.ts`.
- Criar `app/services.cds` e `app/tratativas/annotations.cds` contendo `@UI.Identification` no cabeçalho da Object Page, Facets completas (`GeralFacet` sem responsável principal, `ResponsaveisFacet` como CollectionFacet com `@UI.Hidden: ocultaResponsaveis` agrupando `responsavelPrincipal` e `participantes`, `PlanoAcaoFacet`, `EvidenciasFacet`, `ComentariosFacet`, `HistoricoFacet`) e blocos `@UI.LineItem` (com `criarTratativaAvulsa`) para todas as entidades relacionadas.
- Criar `app/tratativas/xs-app.json` roteando `/api/(.*)` para a destination do backend `action-plan-srv-api` com `authenticationType: "xsuaa"`.
- Criar `app/tratativas/webapp/manifest.json` com configuração LR/OP para `TratativaAppService.Tratativas`, declarando `sap.cloud.service` e a intenção semântica em `sap.app.crossNavigation.inbounds` (`Tratativa-manage`).
- Criar `app/tratativas/webapp/i18n/i18n.properties` com textos e mensagens em pt-BR.

---

## Etapa 2: Aplicação `app/minhas-pendencias/` (Visão Pessoal do Colaborador)
CAs cobertos: CA2, CA13, CA14, CA15, CA25, CA26, CA27, CA27a.
Itens N3 envolvidos: N3-1, N3-2.

### RED
Criar `test/ui-minhas-pendencias.test.ts` verificando:
- Autenticação e execução via identidade corporativa sem tela de login (CA2).
- Listagem da aba "Minhas Ações" filtrando exclusivamente ações sob responsabilidade do usuário autenticado (CA13).
- Acionamento direto do botão de linha "Iniciar" passando status da ação a `Em andamento` (CA14).
- Listagem da aba "Minhas Tratativas" com resolução dinâmica da coluna "Meu Papel" distinguindo "Responsável Principal" vs "Participante" e navegação para a Tratativa (CA15, 005 R19).
- Textos em pt-BR via `i18n.properties` e acessibilidade WCAG 2.1 AA (CA25, CA26).
- Validação estática de linter e execução headless sob `cds.test` (CA27, CA27a).

### GREEN
- Criar `app/minhas-pendencias/annotations.cds` com definições de UI para `MinhasAcoes` e `MinhasTratativas`.
- Implementar em `srv/tratativa-app-service.ts` o hook `after('READ', 'MinhasTratativas', ...)` para resolver dinamicamente o valor de `meuPapel`.
- Criar `app/minhas-pendencias/xs-app.json` roteando `/api/(.*)` para a destination do backend `action-plan-srv-api` com `authenticationType: "xsuaa"`.
- Criar `app/minhas-pendencias/webapp/manifest.json` com configuração de abas (IconTabBar) apontando para `TratativaAppService`, declarando `sap.cloud.service` e a intenção semântica em `sap.app.crossNavigation.inbounds` (`MinhasPendencias-display`).
- Criar `app/minhas-pendencias/webapp/i18n/i18n.properties`.
- Registrar anotações em `app/services.cds`.

---

## Etapa 3: Aplicação `app/administracao/` (Administração da Plataforma)
CAs cobertos: CA16, CA16a, CA16b, CA17, CA25, CA26, CA27, CA27a.
Itens N3 envolvidos: N3-1, N3-2, N3-4.

### RED
Criar `test/ui-administracao.test.ts` verificando:
- Consumo direto de `AdministracaoService` por `app/administracao/` com suporte a OData v4 legível (Ruling R-03, Ruling R-04, I1).
- Leitura OData v4 das projeções `Templates`, `ParametrosAlertas` e `ParametrosIntegracaoSF` em `AdministracaoService` autorizada com sucesso (HTTP 200) para o papel `Administrador` e rejeitada com código HTTP 403 para os demais papéis (`authenticated-user`, `GestorTratativa` e `AplicativoOrigem`) via `cds.test` (Ruling R-04).
- Aba "Templates de Ações" com listagem de templates ativos/inativos e botões de ciclo de vida (`criarTemplate`, `editarTemplate`, `ativarTemplate`, `desativarTemplate`) (CA16).
- Aba "Parâmetros de Alertas" com formulário de configuração global conectado via `UI.Facets`, ação de salvar (`atualizarParametrosAlertas`) e botão de acionamento manual de alertas no cabeçalho (`executarProcessamentoAlertas`) (CA16a, 010 R9).
- Aba "Estrutura Organizacional" com mapeamento SF (`nivelUnidadeSF`, `nivelAreaSF`) conectado via `UI.Facets` e ação de atualização (`atualizarParametrosIntegracaoSF`) (CA16b, 011 R6).
- Bloqueio de acesso com código HTTP 403 para Gestor de Tratativa ou usuário comum sem papel Administrador (CA17).
- Textos em pt-BR, suporte a teclado WCAG e execução headless sem navegador real (CA25, CA26, CA27, CA27a).

### GREEN
- Atualizar `srv/administracao-service.cds` adicionando as projeções somente leitura `Templates`, `ParametrosAlertas` e `ParametrosIntegracaoSF` restritas exclusivamente ao papel `Administrador` (`@restrict: [{ grant: '*', to: 'Administrador' }]`; Ruling R-04).
- Criar `app/administracao/annotations.cds` com anotações apontando diretamente para `AdministracaoService` (`Templates`, `ParametrosAlertas` e `ParametrosIntegracaoSF`), contendo Facets com FieldGroups e botões `UI.DataFieldForAction` para as actions reais (Ruling R-03, Ruling R-04, I1).
- Criar `app/administracao/xs-app.json` roteando `/api/(.*)` para a destination do backend `action-plan-srv-api` com `authenticationType: "xsuaa"`.
- Criar `app/administracao/webapp/manifest.json` com configuração de navegação e abas administrativas apontando diretamente para `AdministracaoService` (`/api/administracao/v1`), declarando `sap.cloud.service` e a intenção semântica em `sap.app.crossNavigation.inbounds` (`AdministracaoPlataforma-manage`).
- Criar `app/administracao/webapp/i18n/i18n.properties`.
- Registrar anotações em `app/services.cds`.

---

## Etapa 4: Governança do Launchpad Work Zone, Inbounds semânticos e Bloqueio de Aplicativo Técnico
CAs cobertos: CA18, CA19, CA19a, CA19b, CA20, CA27, CA27a.
Itens N3 envolvidos: N3-1, N3-2.

### RED
Criar `test/ui-launchpad-governanca.test.ts` verificando:
- Declaração de `sap.cloud.service: "br.com.calazanstec.actionplan"` e intenções semânticas em `sap.app.crossNavigation.inbounds` em cada `manifest.json` (`Tratativa-manage` em tratativas, `MinhasPendencias-display` em minhas-pendencias, `AdministracaoPlataforma-manage` em administracao) para integração com o Channel Manager do SAP Build Work Zone.
- Presença e configuração dos arquivos `xs-app.json` em cada aplicação roteando `/api/(.*)` para a destination `action-plan-srv-api` com `authenticationType: "xsuaa"`.
- Mapeamento de governança de acesso por Role Collections corporativas no Work Zone:
  * Usuário comum autenticado (`authenticated-user`): acesso permitido a "Minhas Pendências" e "Gestão de Tratativas" (consulta com mascaramento LGPD conforme R8), e bloqueado para "Administração" (HTTP 403) (CA18).
  * Administrador da plataforma (`Administrador`): acesso autorizado a "Minhas Pendências", "Gestão de Tratativas" e "Administração" (HTTP 200) (CA19).
  * Gestor de Tratativa (`GestorTratativa`): acesso autorizado a "Minhas Pendências" e "Gestão de Tratativas", bloqueado para "Administração" (HTTP 403) (CA19a).
  * Leitor Analítico (`LeitorAnalitico`): acesso a "Minhas Pendências", bloqueado para "Administração" (HTTP 403) (CA19b).
- Bloqueio integral com código HTTP 403 (`Acesso negado.`) para identidade técnica de máquina `AplicativoOrigem` (OAuth2 client credentials) ao tentar acessar qualquer rota de UI ou endpoint OData consumido por `app/` (`TratativaAppService` sob `/api/app/v1` e `AdministracaoService` sob `/api/administracao/v1`) (CA20).
- Verificação de linters e testes sob `cds.test` em memória (CA27, CA27a).

### GREEN
- Assegurar que os arquivos `webapp/manifest.json` e `xs-app.json` das três aplicações estejam configurados com os inbounds semânticos, `sap.cloud.service` e rotas de destination correspondentes.
- Assegurar regras declarativas de autorização no backend CAP rejeitando `AplicativoOrigem` com HTTP 403 nas camadas de interface e restringindo a administração exclusivamente ao papel `'Administrador'`.

---

## Critérios de Pronto
1. Todos os 32 critérios de aceite (CA1 a CA28, incluindo CA16a, CA16b, CA19a, CA19b, CA27a) cobertos pelas 4 etapas.
2. Cada etapa RED possui um arquivo de teste novo e dedicado em `test/`.
3. Todos os arquivos de `app/` seguem estritamente anotações CDS e manifests Fiori elements consumindo `TratativaAppService` (para tratativas e minhas-pendencias) e `AdministracaoService` (para administração, com projeções aditivas somente leitura e actions reais; Rulings R-03 e R-04) sem importação de `srv/`.
4. Linters (`npm run lint`), arquitetura (`npm run arch`) e testes (`npm test`) passam sem erros no `verify.sh`.
