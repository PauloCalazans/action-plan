# Design: publicacao-corporativa

**Spec:** agentic/projeto/specs/publicacao-corporativa/spec.md
**Status:** aprovado

Escopo técnico: artefatos declarativos de empacotamento, infraestrutura como código (IaC), segurança de identidade (XSUAA), destinations e prontidão para publicação corporativa no SAP Business Technology Platform (SAP BTP; seção Arquitetura BTP da proposta). Contempla a definição estrutural e validação local estrita do descritor de deploy Multi-Target Application (`mta.yaml`), do descritor de segurança corporativa (`xs-security.json`), das configurações declarativas de destinos (`destinations`) para o SAP SuccessFactors (intent 011) e serviços de notificação E-mail/Teams (intent 010), da compilação e empacotamento do serviço CAP (`srv/`), do container persistido SAP HANA Cloud (`db/` HDI Container) e dos pacotes de interface Fiori elements em `app/` para o HTML5 Application Repository do SAP BTP. Em conformidade estrita com as regras invioláveis de AGENTS.md:38 e a missão do projeto, este intent trata EXCLUSIVAMENTE de artefatos de engenharia declarativos e dublês locais: NÃO realiza deploy real contra ambientes de nuvem, NÃO interage com APIs ativas do SAP BTP e NÃO executa conexões de rede externas em testes. Estabelece a proibição absoluta de versionamento de credenciais, tokens ou service keys (`AGENTS.md:39`). Consolida a governança de papéis e escopos formais de segurança mapeando os perfis corporativos consolidados nas specs 002 a 013 (`GestorTratativa`, `Administrador`, `LeitorAnalitico`, `AplicativoOrigem` e `UsuarioAutenticado`). Documenta os ambientes de promoção (Desenvolvimento, Homologação/QA e Produção), a governança de migração HDI e reúne as decisões que dependem de deliberação humana prévia antes da entrada efetiva em produção corporativa.

---

## Decisões

1. **Estrutura Declarativa do Descritor Multi-Target Application `mta.yaml` (R1; N3: deploy/infra)**
   - Versão do esquema MTA: `3.1`. ID da aplicação: `action-plan`. Versão: `1.0.0`.
   - Três módulos gerenciados obrigatórios:
     - `action-plan-db` (tipo `hdb`, caminho `gen/db`): build acionado por `cds build --production`, consome o recurso `action-plan-hdi`.
     - `action-plan-srv` (tipo `nodejs`, caminho `gen/srv`): build acionado por `cds build --production`, consome os recursos `action-plan-hdi`, `action-plan-auth` e `action-plan-destination`. Provê o endpoint `srv-api` sob rotas `/api/<serviço>/v1` com propriedade `srv-url: ${default-url}` (D4, D6).
     - `action-plan-app-deployer` (tipo `com.sap.application.content`, caminho `gen/app`): responsável pelo deploy dos pacotes HTML5 das aplicações de `app/` no HTML5 Application Repository, consome `action-plan-html5-host` e `action-plan-auth`.
     *(Remoção do módulo legado `action-plan-portal-content` e do recurso `action-plan-html5-runtime`: no SAP Build Work Zone Standard Edition, o conteúdo é integrado como HTML5 Content Provider através do Channel Manager, consumindo os apps publicados no `html5-apps-repo` via declarações `sap.app.crossNavigation.inbounds` em seus `manifest.json`, eliminando o modelo legado de Portal Service).*
   - Quatro recursos gerenciados obrigatórios:
     - `action-plan-hdi` (`com.sap.xs.hdi-container`, plano `hdi-shared`).
     - `action-plan-auth` (`org.cloudfoundry.managed-service`, serviço `xsuaa`, plano `application`, configurado via `xs-security.json`).
     - `action-plan-destination` (`org.cloudfoundry.managed-service`, serviço `destination`, plano `lite`). Configurado com `HTML5Runtime_enabled: true` e a destination gerenciada `action-plan-srv-api` apontando para `~{srv-api/srv-url}` com:
       * `Authentication: ForwardAuthToken`
       * `ProxyType: Internet`
       * `Type: HTTP`
       * `HTML5.ForwardAuthToken: true`
       * `HTML5.DynamicDestination: true`
     - `action-plan-html5-host` (`org.cloudfoundry.managed-service`, serviço `html5-apps-repo`, plano `app-host`).
   - **Fluxo do Elo Managed App Router ↔ CAP:**
     1. Login corporativo realizado pelo colaborador no Identity Provider corporativo (IAS ou IdP corporativo federado) autenticado via XSUAA.
     2. No launchpad corporativo do SAP Build Work Zone, o usuário clica no tile do aplicativo. O **managed approuter** do Work Zone carrega os arquivos estáticos da aplicação UI a partir do HTML5 Application Repository (`action-plan-html5-host`).
     3. Cada aplicação Fiori em `app/` possui seu descritor de rotas `xs-app.json` e declara `sap.cloud.service` e seus inbounds em `manifest.json`.
     4. Ao disparar requisições OData para rotas `/api/...`, o managed approuter consulta as rotas no `xs-app.json` do app e despacha as chamadas para a **destination** do backend CAP (`action-plan-srv-api`).
     5. A destination provisionada com `HTML5.ForwardAuthToken=true` e `Authentication: ForwardAuthToken` repassa de forma transparente o token JWT corporativo no cabeçalho HTTP `Authorization: Bearer <token>`.
     6. O serviço CAP Node.js/TypeScript em Cloud Foundry (`action-plan-srv`) recebe a requisição e valida a assinatura criptográfica e escopos do token JWT utilizando `@sap/xssec` e `cds.requires.auth = "xsuaa"` no perfil `[production]`.
     7. Sob os perfis locais `[development]` e `[test]`, o runtime utiliza `kind: "mocked"`, preservando 100% dos testes automatizados em SQLite sem dependência de serviços de nuvem reais.
   — **Por quê:** padrão oficial de implantação de aplicações CAP no SAP BTP Cloud Foundry integradas ao Work Zone e HANA Cloud, garantindo propagação segura de tokens via managed approuter.
   — **Verificado por:** CA1; validação estrutural em `test/publicacao-descritores.test.ts`.

2. **Matriz Canônica de Escopos, Atributos e Segurança Declarativa no `xs-security.json` (R2; N3: segurança/autorização)**
   - `xsappname`: `action-plan`, modo de tenancy `dedicated` (single-tenant no MVP).
   - **Atributos de usuário para matrícula funcional:**
     - Para apoiar a solução recomendada (Opção A) diagnosticada no intent 013 (onde `req.user.id` no BTP retorna e-mail ou UUID), o `xs-security.json` declara o atributo formal de usuário:
       ```json
       "attributes": [
         {
           "name": "matricula",
           "description": "Matrícula funcional do colaborador",
           "valueType": "string"
         }
       ]
       ```
     - Este atributo é alimentado via mapeamento de asserção no IAS e propagado no token JWT corporativo para consumo por `srv/tratativa/identidade.ts` (`obterMatriculaUsuario`). A definição é registrada como item N3 para deliberação no Gate 1 humano.
   - Quatro escopos corporativos formais vinculados às regras `@requires` e `@restrict`:
     - `$XSAPPNAME.GestorTratativa`: gestão operacional de tratativas, transições, delegação e planos de ação (003, 004, 005).
     - `$XSAPPNAME.Administrador`: governança de templates (009), parâmetros de alertas (010), mapeamento do SF (011) e credenciais técnicas (002). Nomenclatura unificada com a modelagem CDS e o código da plataforma.
     - `$XSAPPNAME.LeitorAnalitico`: acesso analítico somente leitura para consumo via Power BI e SAP Analytics Cloud (012 R10).
     - `$XSAPPNAME.AplicativoOrigem`: escopo técnico reservado para credenciais de máquina via OAuth2 client credentials (002 R18, D7).
   - Três Role Collections corporativas oficiais para atribuição no SAP BTP Cockpit e associação a Site Roles no Work Zone:
     - `ActionPlan_Gestor`: referencia o Role Template `GestorTratativa`.
     - `ActionPlan_Administrador`: referencia o Role Template `Administrador`.
     - `ActionPlan_LeitorAnalitico`: referencia o Role Template `LeitorAnalitico`.
   - Usuário comum autenticado recebe o papel implícito de usuário corporativo autenticado (`authenticated-user`) via SAML 2.0 / OpenID Connect no Identity Provider.
   - **Credencial técnica de máquina (`AplicativoOrigem` por OAuth2 Client Credentials):**
     - O papel `AplicativoOrigem` opera exclusivamente via fluxo M2M OAuth2 Client Credentials no mesmo XSUAA da subaccount corporativa.
     - É estritamente restrito à abertura de ocorrências via `IntegracaoOrigemService` (`/api/integracao-origem/v1`). Não possui Role Collection associada a usuários e é terminantemente bloqueado com código HTTP 403 (`Acesso negado.`) em todos os endpoints das interfaces Fiori (`TratativaAppService` e `AdministracaoService`).
   — **Por quê:** consolida e materializa a governança de autorização corporativa definida ao longo das specs 002 a 013, integrando propagação de atributos de matrícula corporativa e isolamento de credenciais M2M.
   — **Verificado por:** CA3, CA4; validação de esquema JSON em `test/publicacao-descritores.test.ts`.

3. **Isolamento de Destinations e Preservação de Perfis no `package.json` (R3; D2; N3: deploy)**
   - Destinations declarativas nomeadas logicamente, declaradas diretamente sob `cds.requires.<Servico>` (sintaxe nativa do SAP CAP):
     - `SuccessFactors`: conector HTTP REST para a API do SuccessFactors (011).
     - `ServicoNotificacoes`: conector HTTP para despacho de e-mails corporativos e notificações Microsoft Teams (010).
   - **Preservação incondicional dos usuários de teste:** A autenticação XSUAA é ativada EXCLUSIVAMENTE sob o perfil `[production]`. Sob os perfis `[development]` e `[test]`, o `package.json` mantém integralmente os usuários mockados existentes (`app-origem-a`, `app-origem-b`, `app-revogado`, `admin`, `usuario`, `gestor`), garantindo que nenhuma suíte de testes existente (002 a 013) sofra regressão.
   - Parametrização em `package.json` (`cds.requires`):
     ```json
     {
       "cds": {
         "requires": {
           "db": {
             "[production]": { "kind": "hana" },
             "[development]": { "kind": "sqlite", "credentials": { "url": ":memory:" } }
           },
           "auth": {
             "[production]": { "kind": "xsuaa" },
             "[development]": {
               "kind": "mocked",
               "users": {
                 "app-origem-a": { "roles": ["AplicativoOrigem"] },
                 "app-origem-b": { "roles": ["AplicativoOrigem"] },
                 "app-revogado": { "roles": ["AplicativoOrigem"] },
                 "admin": { "roles": ["Administrador"] },
                 "usuario": { "roles": [] },
                 "gestor": { "roles": ["GestorTratativa"] }
               }
             }
           },
           "SuccessFactors": {
             "[production]": {
               "kind": "rest",
               "credentials": { "destination": "SuccessFactors" }
             }
           },
           "ServicoNotificacoes": {
             "[production]": {
               "kind": "rest",
               "credentials": { "destination": "ServicoNotificacoes" }
             }
           }
         }
       }
     }
     ```
   — **Por quê:** mantém o isolamento das integrações externas em `srv/integracoes/` (D2), respeita a sintaxe oficial do CAP e preserva 100% da suíte de testes automatizados existente.
   — **Verificado por:** `cds env` por perfil (comprovando XSUAA em produção e mocked em desenvolvimento) e testes em `test/publicacao-seguranca-destinations.test.ts` (CA5, CA6).

4. **Vedação Absoluta de Segredos e Governança do `.gitignore` (R4; AGENTS.md:39; N3: segurança)**
   - Bloqueio estrito no `.gitignore` de arquivos sensíveis:
     - `default-env.json`, `.env`, `.cdsrc-private.json`
     - Certificados e chaves privadas (`*.pem`, `*.key`)
     - Pastas de build temporário e artefatos compilados (`gen/`, `@cds-models/`)
   - Credenciais e segredos de produção são injetados exclusivamente em tempo de execução pelos bindings de serviço gerenciados pelo Cloud Foundry.
   — **Por quê:** cumprimento incondicional da regra inviolável de segurança de AGENTS.md:39.
   — **Verificado por:** CA7, CA8; validação de ausência de arquivos e regras do git em `test/publicacao-seguranca-destinations.test.ts`.

5. **Prontidão de Compilação Local para Produção (R5; D1; D8; N3: testes)**
   - Script de compilação de produção integrado a `package.json`:
     - `cds build --production` compila o modelo CDS e handlers TypeScript para as pastas `gen/srv/` (Node.js runtime) e `gen/db/` (HANA HDI Container).
   - A validação de prontidão local exige que `npm run build`, `npm run lint` e `npm test` concluam com código de retorno zero, sem conexões externas ou logins ativos no Cloud Foundry (`cf login`).
   — **Por quê:** assegura que o código está sintática e estruturalmente pronto para implantação sem depender de infraestrutura física ativa.
   — **Verificado por:** CA2, CA9, CA10, CA13; testes de compilação em `test/publicacao-build-producao.test.ts`.

6. **Governança de Ambientes de Nuvem e Promoção Estritamente Humana (R6; AGENTS.md:33,65; D11; N3: governança)**
   - Três ambientes lógicos no SAP BTP: Desenvolvimento (`DEV`), Homologação (`QA`) e Produção (`PRD`).
   - A promoção de pacotes entre ambientes e qualquer ação de deploy em produção são de execução e aprovação exclusivamente humanas (Paulo Calazans / equipe autorizada).
   - Agentes de IA são expressamente proibidos de executar comandos de deploy em nuvem ou realizar merges automáticos na branch principal (AGENTS.md:33, AGENTS.md:65, D11).
   — **Por quê:** controle humano de mudanças críticas corporativas e conformidade com a governança do projeto.
   — **Verificado por:** CA11; validação em `test/publicacao-governanca-promocao.test.ts`.

7. **Escopo de Acesso Corporativo sem Segregação por Unidade/Área no MVP (R7)**
   - Papéis corporativos genéricos aplicáveis a toda a organização (003 R23).
   - O Gestor de Tratativa possui escopo transversal sobre ocorrências de qualquer Unidade ou Área da empresa, mantendo os contratos canônicos de 10 campos na listagem e 12 campos no detalhe.
   - Segregação de visibilidade por planta ou área é reservada para fases pós-MVP conforme decisão do humano.
   — **Por quê:** alinhamento às decisões fundacionais do projeto e simplificação da matriz de autorização inicial.
   — **Verificado por:** CA12; testes de autorização transversal e estabilidade de tipos de retorno.

8. **Governança de Migração HDI no SAP HANA Cloud (R8; AGENTS.md:64; N3: deploy/infra)**
   - Alterações aditivas em `db/**/*.cds` são aplicadas automaticamente pelo `@sap/hdi-deploy`.
   - Alterações destrutivas em produção (remoção de entidades, renomeação de colunas) constituem Gatilho N3 e exigem Plano de Migração HDI prévio elaborado por humanos.
   — **Por quê:** prevenção de perda de dados históricos e trilhas de auditoria corporativa.
   — **Verificado por:** CA13; documentação de diretrizes e validação local em `test/publicacao-build-producao.test.ts`.

9. **Neutralidade e Generalidade de Infraestrutura (R9; AGENTS.md:36)**
   - Módulos MTA, instâncias de serviço, recursos e coleções de papéis não possuem nomes específicos de departamentos (SESMT, RH, Qualidade).
   — **Por quê:** cumprimento rigoroso do princípio de reutilização corporativa de AGENTS.md:36.
   — **Verificado por:** CA14; inspeção estática de identificadores em `mta.yaml` e `xs-security.json`.

---

## Especificação dos Artefatos

### 1. `mta.yaml`
```yaml
_schema-version: '3.1'
ID: action-plan
version: 1.0.0
description: Plataforma Corporativa de Tratativas e Planos de Acao no SAP BTP

parameters:
  enable-parallel-deployments: true

build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm ci
        - npm run build

modules:
  - name: action-plan-srv
    type: nodejs
    path: gen/srv
    parameters:
      buildpack: nodejs_buildpack
    build-parameters:
      builder: npm
      ignore:
        - default-env.json
        - .env
    requires:
      - name: action-plan-hdi
      - name: action-plan-auth
      - name: action-plan-destination
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}

  - name: action-plan-db
    type: hdb
    path: gen/db
    parameters:
      buildpack: nodejs_buildpack
    requires:
      - name: action-plan-hdi

  - name: action-plan-app-deployer
    type: com.sap.application.content
    path: gen/app
    requires:
      - name: action-plan-html5-host
      - name: action-plan-auth
    build-parameters:
      build-result: resources

resources:
  - name: action-plan-hdi
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared

  - name: action-plan-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
      config:
        xsappname: action-plan
        tenant-mode: dedicated

  - name: action-plan-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite
      config:
        HTML5Runtime_enabled: true
        init_data:
          instance:
            destinations:
              - Name: action-plan-srv-api
                Description: Destination para a API CAP backend com propagacao de token JWT
                Authentication: ForwardAuthToken
                ProxyType: Internet
                Type: HTTP
                URL: ~{srv-api/srv-url}
                HTML5.ForwardAuthToken: true
                HTML5.DynamicDestination: true
            existing_destinations_policy: update
    requires:
      - name: srv-api

  - name: action-plan-html5-host
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-host
```

### 2. `xs-security.json`
```json
{
  "xsappname": "action-plan",
  "tenant-mode": "dedicated",
  "description": "Segurança corporativa para a plataforma de tratativas e planos de ação",
  "attributes": [
    {
      "name": "matricula",
      "description": "Matrícula funcional do colaborador",
      "valueType": "string"
    }
  ],
  "scopes": [
    {
      "name": "$XSAPPNAME.GestorTratativa",
      "description": "Gestor de Tratativa - Gestão operacional de ocorrências, transições e planos de ação"
    },
    {
      "name": "$XSAPPNAME.Administrador",
      "description": "Administrador da Plataforma - Parametrização global, templates, alertas e integrações"
    },
    {
      "name": "$XSAPPNAME.LeitorAnalitico",
      "description": "Leitor Analítico - Consulta a indicadores e consumo analítico via Power BI / SAC"
    },
    {
      "name": "$XSAPPNAME.AplicativoOrigem",
      "description": "Aplicativo de Origem - Identidade técnica para abertura de tratativas via API"
    }
  ],
  "role-templates": [
    {
      "name": "GestorTratativa",
      "description": "Papel de Gestor de Tratativa",
      "scope-references": [
        "$XSAPPNAME.GestorTratativa"
      ]
    },
    {
      "name": "Administrador",
      "description": "Papel de Administrador da Plataforma",
      "scope-references": [
        "$XSAPPNAME.Administrador"
      ]
    },
    {
      "name": "LeitorAnalitico",
      "description": "Papel de Leitor Analítico",
      "scope-references": [
        "$XSAPPNAME.LeitorAnalitico"
      ]
    },
    {
      "name": "AplicativoOrigem",
      "description": "Papel de Aplicativo de Origem (técnico)",
      "scope-references": [
        "$XSAPPNAME.AplicativoOrigem"
      ]
    }
  ],
  "role-collections": [
    {
      "name": "ActionPlan_Gestor",
      "description": "Coleção de regras para Gestores de Tratativa",
      "role-template-references": [
        "$XSAPPNAME.GestorTratativa"
      ]
    },
    {
      "name": "ActionPlan_Administrador",
      "description": "Coleção de regras para Administradores da Plataforma",
      "role-template-references": [
        "$XSAPPNAME.Administrador"
      ]
    },
    {
      "name": "ActionPlan_LeitorAnalitico",
      "description": "Coleção de regras para Leitores Analíticos (Power BI / SAC)",
      "role-template-references": [
        "$XSAPPNAME.LeitorAnalitico"
      ]
    }
  ],
  "oauth2-configuration": {
    "credential-types": [
      "binding-secret",
      "x509"
    ],
    "redirect-uris": [
      "https://*.cfapps.*.hana.ondemand.com/**"
    ]
  }
}
```

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-publicacao-corporativa.md` | Entregar o intent 014 em 4 etapas sequenciais RED/GREEN: descritores declarativos mta.yaml (3 módulos, 4 recursos, destination action-plan-srv-api com ForwardAuthToken) e xs-security.json com atributo matricula e escopos corporativos (R1, R2, R9); configuração de destinations e governança git (R3, R4, R7); compilação e build de produção (R5, R8); governança de promoção e bloqueio de automação de deploy (R6). | `publicacao-corporativa/001-publicacao-corporativa` |

---

## Itens N3 (aguardam aprovação no Gate 1)

| Item | Origem | Impacto | Justificativa e Mitigação |
|---|---|---|---|
| N3-1 | R1, R8 | Descritor de empacotamento MTA (`mta.yaml`) com 3 módulos gerenciados (`action-plan-db`, `action-plan-srv`, `action-plan-app-deployer`) e 4 recursos (`action-plan-hdi`, `action-plan-auth`, `action-plan-destination` com destination gerenciada `action-plan-srv-api` e `HTML5.ForwardAuthToken=true`, `action-plan-html5-host`). | Define a arquitetura oficial de empacotamento em nuvem Cloud Foundry, containers HDI e integração nativa com o Work Zone via Channel Manager. |
| N3-2 | R2 | Descritor de segurança XSUAA (`xs-security.json`), escopos corporativos, atributo `matricula` (Opção A para resolução de matrícula no IAS/XSUAA), credencial técnica M2M `AplicativoOrigem` via OAuth2 client credentials (bloqueada na UI com 403) e role collections (`ActionPlan_Gestor`, `ActionPlan_Administrador`, `ActionPlan_LeitorAnalitico`). | Normatiza a governança formal de autorização e autenticação no SAP BTP, vinculando escopos corporativos e atributos de identidade às specs 002 a 013. |
| N3-3 | R3 | Destinos lógicos (`SuccessFactors`, `ServicoNotificacoes`) e configuração de perfis em `cds.requires` (`[production]` com `hana` e `xsuaa`). | Habilita conectividade gerenciada via Destination Service em produção, mantendo dublês em memória desacoplados em testes locais (AGENTS.md:38). |
| N3-4 | R4 | Bloqueio estrito de segredos e credenciais no repositório (`default-env.json`, `.env`, `.cdsrc-private.json`, chaves BTP) e regras do `.gitignore`. | Cumprimento incondicional da regra inviolável de AGENTS.md:39 impedindo qualquer vazamento de segredos no histórico Git. |
| N3-5 | R6 | Governança de promoção e deploy: proibição de deploy autônomo por IA, promoção manual DEV/QA/PRD reservada ao humano (AGENTS.md:33, AGENTS.md:65, D11). | Garante controle humano sobre liberações em ambientes corporativos e impede alterações não autorizadas em produção. |
| N3-6 | R8 | Governança de migração HDI no HANA Cloud: plano de migração controlado para mudanças destrutivas em produção (AGENTS.md:64). | Preserva integridade de dados históricos e trilhas de auditoria contra perdas acidentais em manutenções. |

---

## O que não muda

- Nenhuma credencial, token ou service key é versionada no repositório (`AGENTS.md:39`).
- O elo Managed Approuter ↔ CAP propaga o token JWT corporativo via destination com `HTML5.ForwardAuthToken=true`, sendo validado pelo CAP via `cds.requires.auth = "xsuaa"` estritamente sob o perfil `[production]`.
- Sob os perfis `[development]` e `[test]`, o runtime mantém integralmente `cds.requires.auth = "mocked"`, garantindo que os testes automatizados nunca dependam de conexão com o SAP BTP, SAP HANA Cloud real ou rede externa (`AGENTS.md:38`).
- A credencial técnica `AplicativoOrigem` emitida por OAuth2 Client Credentials destina-se exclusivamente à integração de backend (`IntegracaoOrigemService`), permanecendo estritamente bloqueada com HTTP 403 em todos os serviços de interface Fiori.
- O agente nunca faz merge na branch principal (`AGENTS.md:33`, decisão D11) nem realiza deploy autônomo em ambientes de nuvem (`AGENTS.md:65`, decisão D11, intent 014:20).
- Toda promoção para ambientes corporativos (DEV, QA, PRD) exige deliberação e intervenção humana.
- A plataforma opera em modo single-tenant (dedicated) no MVP.
- O controle de acesso no MVP baseia-se em papéis corporativos sem segregação de dados por Unidade/Área, preservando os contratos de retorno das consultas existentes.

---

## O desconfortável, declarado

1. **Deploy real reservado ao humano antes da validação em nuvem:**
   Este intent entrega e valida 100% dos artefatos declarativos de infraestrutura como código (IaC), compilação de produção e esquemas de segurança. Todavia, a execução física de `cf deploy` contra subaccounts reais do SAP BTP é prerrogativa exclusivamente humana. Erros que dependam exclusivamente de quotas de infraestrutura física, certificados de subaccount ou conectividade de rede externa do BTP só poderão ser diagnosticados durante a promoção manual executada pelo mantenedor.

2. **Integração de catálogo no SAP Build Work Zone:**
   O empacotamento MTA publica os arquivos estáticos Fiori elements no HTML5 Application Repository (`action-plan-html5-host`). A disponibilização visual dos tiles e a criação dos catálogos no SAP Build Work Zone ocorrem por meio do Channel Manager da subaccount (HTML5 Content Provider) e configuração de Site Roles no Site Editor, não dependendo de módulos de deploy de portal legados no repositório.

---

## Arquivos Envolvidos

- `mta.yaml`
- `xs-security.json`
- `package.json`
- `.gitignore`
- `test/publicacao-descritores.test.ts`
- `test/publicacao-seguranca-destinations.test.ts`
- `test/publicacao-build-producao.test.ts`
- `test/publicacao-governanca-promocao.test.ts`

---

## Correção (autenticação, 2026-10-10)

1. **Elo Managed Approuter ↔ CAP e atualização do `mta.yaml`:** Reestruturou o descritor MTA para 3 módulos (`action-plan-srv`, `action-plan-db`, `action-plan-app-deployer`) e 4 recursos gerenciados (`action-plan-hdi`, `action-plan-auth`, `action-plan-destination`, `action-plan-html5-host`), removendo o módulo obsoleto `action-plan-portal-content` e o recurso `action-plan-html5-runtime`. Configurou no recurso `action-plan-destination` a destination gerenciada `action-plan-srv-api` com `HTML5.ForwardAuthToken: true`, viabilizando o repasse do JWT corporativo para o backend CAP com validação via `cds.requires.auth = "xsuaa"` em produção.
2. **Modelo Work Zone Standard:** Alinhou o deploy das aplicações de `app/` via HTML5 Application Repository para consumo nativo pelo Channel Manager (HTML5 Content Provider) do SAP Build Work Zone Standard Edition, eliminando arquivos e módulos de portal legados.
3. **Atributo de matrícula funcional no `xs-security.json`:** Adicionou a declaração do atributo corporativo `matricula` no `xs-security.json` em consonância com a Opção A recomendada para resolução de identidade no intent 013, mantendo o fallback para `req.user.id` e a continuidade dos usuários mockados em desenvolvimento e testes locais.
4. **Unificação do papel administrativo e credencial técnica:** Reafirmou a unificação canônica do papel `'Administrador'` e detalhou a restrição da credencial técnica M2M `AplicativoOrigem` (OAuth2 client credentials), assegurando que não possui visibilidade de tela e recebe retorno HTTP 403 em todos os endpoints de interface.
5. **Encadeamento opcional em `obterMatriculaUsuario` (Achado 2):** Alinhou a especificação de leitura do atributo de matrícula corporativa para utilizar encadeamento opcional em `attr` (`req.user.attr?.matricula?.[0] || req.user.id`), mantendo compatibilidade total com os testes mockados em memória.
6. **Correção do path de `IntegracaoOrigemService` (Achado 3):** Corrigiu a menção textual do path de `/api/origem/v1` para `/api/integracao-origem/v1` na descrição do escopo técnico M2M `AplicativoOrigem`, alinhando ao path real exposto em `srv/integracao-origem-service.cds`.
