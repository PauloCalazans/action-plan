# Task: 001-publicacao-corporativa

**Spec:** agentic/projeto/specs/publicacao-corporativa/spec.md
**Design:** agentic/projeto/specs/publicacao-corporativa/design.md
**Status:** publicada
**Branch:** publicacao-corporativa/001-publicacao-corporativa

## Arquivos

### Criados
- `mta.yaml`
- `xs-security.json`
- `app/tratativas/package.json`
- `app/tratativas/ui5.yaml`
- `app/minhas-pendencias/package.json`
- `app/minhas-pendencias/ui5.yaml`
- `app/administracao/package.json`
- `app/administracao/ui5.yaml`
- `test/publicacao-descritores.test.ts`
- `test/publicacao-seguranca-destinations.test.ts`
- `test/publicacao-build-producao.test.ts`
- `test/publicacao-governanca-promocao.test.ts`

### Modificados
- `package.json`
- `package-lock.json` (só a entrada raiz do js-yaml como devDependency, mesma versão 4.3.2 já resolvida; Ruling R-02)
- `tsconfig.cdsbuild.json` (configuração da compilação TypeScript do cds build para gen/srv — outDir/exclude; Ruling R-04)
- `.gitignore`

## Interfaces

```yaml
# mta.yaml (resumo estrutural de módulos e recursos)
_schema-version: '3.1'
ID: action-plan
version: 1.0.0
modules:
  - name: action-plan-srv
    type: nodejs
    path: gen/srv
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}
  - name: action-plan-db
    type: hdb
    path: gen/db
  - name: action-plan-tratativas
    type: html5
    path: app/tratativas
    build-parameters:
      builder: custom
      build-result: dist
      supported-platforms: []
      commands:
        - npm install
        - npm run build
  - name: action-plan-minhas-pendencias
    type: html5
    path: app/minhas-pendencias
    build-parameters:
      builder: custom
      build-result: dist
      supported-platforms: []
      commands:
        - npm install
        - npm run build
  - name: action-plan-administracao
    type: html5
    path: app/administracao
    build-parameters:
      builder: custom
      build-result: dist
      supported-platforms: []
      commands:
        - npm install
        - npm run build
  - name: action-plan-app-deployer
    type: com.sap.application.content
    path: .
    requires:
      - name: action-plan-html5-host
        parameters:
          content-target: true
      - name: action-plan-auth
    build-parameters:
      build-result: resources
      requires:
        - artifacts: [brcomcalazanstecactionplantratativas.zip]
          name: action-plan-tratativas
          target-path: resources/
        - artifacts: [brcomcalazanstecactionplanminhaspendencias.zip]
          name: action-plan-minhas-pendencias
          target-path: resources/
        - artifacts: [brcomcalazanstecactionplanadministracao.zip]
          name: action-plan-administracao
          target-path: resources/
resources:
  - name: action-plan-hdi
    type: com.sap.xs.hdi-container
  - name: action-plan-auth
    type: org.cloudfoundry.managed-service
  - name: action-plan-destination
    type: org.cloudfoundry.managed-service
    parameters:
      config:
        init_data:
          instance:
            destinations:
              - Name: action-plan-srv-api
                Authentication: ForwardAuthToken
                HTML5.ForwardAuthToken: true
  - name: action-plan-html5-host
    type: org.cloudfoundry.managed-service
```

```json
// xs-security.json (resumo estrutural de atributos, escopos e coleções)
{
  "xsappname": "action-plan",
  "tenant-mode": "dedicated",
  "attributes": [
    { "name": "matricula", "description": "Matrícula funcional", "valueType": "string" }
  ],
  "scopes": [
    { "name": "$XSAPPNAME.GestorTratativa" },
    { "name": "$XSAPPNAME.Administrador" },
    { "name": "$XSAPPNAME.LeitorAnalitico" },
    { "name": "$XSAPPNAME.AplicativoOrigem" }
  ],
  "role-collections": [
    { "name": "ActionPlan_Gestor" },
    { "name": "ActionPlan_Administrador" },
    { "name": "ActionPlan_LeitorAnalitico" }
  ],
  "oauth2-configuration": {
    "redirect-uris": [
      "https://*.launchpad.cfapps.*.hana.ondemand.com/**"
    ]
  }
}
```

## Regras
- R1: Estrutura declarativa do descritor de deploy Multi-Target Application (`mta.yaml`) contendo 6 módulos gerenciados (`action-plan-db`, `action-plan-srv`, 3 módulos `html5` das aplicações em `app/` com builders customizados gerando artefatos zip, e o módulo deployer `action-plan-app-deployer` com `path: .` e `content-target: true`) e 4 recursos gerenciados obrigatórios (`action-plan-hdi`, `action-plan-auth`, `action-plan-destination` com destination `action-plan-srv-api` e `HTML5.ForwardAuthToken=true`, `action-plan-html5-host`), viabilizando a integração com o Channel Manager do SAP Build Work Zone Standard Edition via `mbt build`.
- R2: Segurança declarativa e catálogo de escopos corporativos (`xs-security.json`) contendo atributo de usuário `matricula` para propagação da matrícula funcional, 4 escopos corporativos formais, 3 Role Collections oficiais, restrição de `redirect-uris` ao domínio do Work Zone Launchpad (`https://*.launchpad.cfapps.*.hana.ondemand.com/**`) e isolamento da credencial técnica M2M `AplicativoOrigem` (bloqueada na UI com HTTP 403).
- R3: Configuração declarativa de destinations (`SuccessFactors`, `ServicoNotificacoes`) diretamente sob `cds.requires` e preservação integral dos usuários mockados em `[development]`.
- R4: Vedação absoluta de versionamento de credenciais e segredos (`default-env.json`, `.env`, `.cdsrc-private.json`, service keys) e bloqueio no `.gitignore`.
- R5: Critérios verificáveis de empacotamento local e ausência de deploy real (`npm run build`, `npm run lint`, `npm test` verde em SQLite em memória; AGENTS.md:38). Testes nunca importam `srv/`.
- R6: Governança de ambientes de nuvem (DEV, QA, PRD) com promoção e deploy estritamente manuais por humanos (AGENTS.md:33, AGENTS.md:65, D11).
- R7: Escopo de acesso corporativo transversal sem segregação de perfis por Unidade ou Área no MVP, preservando contratos canônicos de 10 campos na listagem e 12 no detalhe.
- R8: Governança de migração HDI no SAP HANA Cloud: migrações aditivas automáticas e migrações destrutivas como Gatilho N3 com plano controlado.
- R9: Generalidade e não exclusividade de infraestrutura corporativa (AGENTS.md:36).

## Itens N3 (aguardam aprovação no Gate 1)
- N3-1: Descritor de empacotamento MTA (`mta.yaml`) com 6 módulos gerenciados e 4 recursos gerenciados BTP (`action-plan-hdi`, `action-plan-auth`, `action-plan-destination` com destination gerenciada `action-plan-srv-api` e `HTML5.ForwardAuthToken=true`, `action-plan-html5-host`), além dos descritores de empacotamento em `app/` (`package.json`, `ui5.yaml`).
- N3-2: Descritor de segurança XSUAA (`xs-security.json`), escopos corporativos, atributo `matricula` (Opção A para resolução de matrícula no IAS/XSUAA), credencial técnica M2M `AplicativoOrigem` via OAuth2 client credentials, role collections (`ActionPlan_Gestor`, `ActionPlan_Administrador`, `ActionPlan_LeitorAnalitico`) e restrição de `redirect-uris` ao domínio do Work Zone Launchpad.
- N3-3: Destinos lógicos (`SuccessFactors`, `ServicoNotificacoes`) e configuração de perfis em `cds.requires` (`[production]` com `hana` e `xsuaa`), preservando usuários mockados em `[development]`.
- N3-4: Bloqueio estrito de segredos e credenciais no repositório (`default-env.json`, `.env`, `.cdsrc-private.json`, chaves BTP) e regras do `.gitignore`.
- N3-5: Governança de promoção e deploy: proibição de deploy autônomo por IA, promoção manual DEV/QA/PRD reservada ao humano (AGENTS.md:33, AGENTS.md:65, D11).
- N3-6: Governança de migração HDI no HANA Cloud: plano de migração para mudanças destrutivas em produção (AGENTS.md:64).

---

## Etapa 1: Descritores declarativos de deploy e segurança (`mta.yaml` e `xs-security.json`)
CAs cobertos: CA1, CA3, CA4, CA14.
Itens N3 envolvidos: N3-1, N3-2.

### RED
Criar `test/publicacao-descritores.test.ts` verificando:
- Presença e validade estrutural de `mta.yaml` com os 6 módulos (`action-plan-db`, `action-plan-srv`, `action-plan-tratativas`, `action-plan-minhas-pendencias`, `action-plan-administracao`, `action-plan-app-deployer` com `path: .`, `content-target: true` e `requires` dos zips) e 4 recursos gerenciados (`action-plan-hdi`, `action-plan-auth`, `action-plan-destination`, `action-plan-html5-host`), comprovando configuração da destination gerenciada `action-plan-srv-api` com `HTML5.ForwardAuthToken=true` (CA1).
- Presença e validade dos descritores de empacotamento em `app/` (`package.json` com script de build/archive e `ui5.yaml` em `tratativas`, `minhas-pendencias`, `administracao`) para compilação HTML5 via `mbt build` (CA1).
- Validade de esquema de `xs-security.json` contendo o atributo de usuário `matricula`, os escopos `GestorTratativa`, `Administrador`, `LeitorAnalitico` e `AplicativoOrigem` (CA3), e `redirect-uris` restrito ao domínio do launchpad (`https://*.launchpad.cfapps.*.hana.ondemand.com/**`) sob `oauth2-configuration` (CA3).
- Role Collections declaradas `ActionPlan_Gestor`, `ActionPlan_Administrador` e `ActionPlan_LeitorAnalitico` com referências corretas (CA4).
- Neutralidade corporativa sem nomes exclusivos de departamentos em `mta.yaml` e `xs-security.json` (CA14).
- Regra de isolamento: testes nunca importam arquivos de `srv/`.

### GREEN
- Criar `mta.yaml` com a especificação canônica MTA 3.1 contendo os 6 módulos e 4 recursos gerenciados.
- Criar `app/tratativas/package.json`, `app/tratativas/ui5.yaml`, `app/minhas-pendencias/package.json`, `app/minhas-pendencias/ui5.yaml`, `app/administracao/package.json` e `app/administracao/ui5.yaml`.
- Criar `xs-security.json` com os atributos, escopos, role-templates, role-collections e `redirect-uris` restrito da plataforma.

---

## Etapa 2: Configuração de Destinations declarativas, isolamento de segredos e governança do Git (`package.json`, `.gitignore`)
CAs cobertos: CA5, CA6, CA7, CA8, CA12.
Itens N3 envolvidos: N3-3, N3-4.

### RED
Criar `test/publicacao-seguranca-destinations.test.ts` verificando:
- Configurações de destinations em `package.json` utilizando a sintaxe direta `cds.requires.<Servico>` com nomes lógicos (`SuccessFactors`, `ServicoNotificacoes`) no perfil `[production]`, sem senhas ou URLs fixas (CA5).
- Preservação integral dos usuários mockados (`auth.[development].users`) comprovada via `cds.env` por perfil (CA6).
- Execução de testes automatizados com dublês em memória sem chamadas reais a destinations do SAP BTP (CA6).
- Ausência total de arquivos sensíveis rastreados no Git (`default-env.json`, `.env`, `.cdsrc-private.json`, chaves privadas, service keys) (CA7).
- Regras explícitas de bloqueio no `.gitignore` cobrindo segredos corporativos e pastas de build (`gen/`) (CA8).
- Acesso e gestão operacional transversal para `GestorTratativa` sem segregação de Unidade/Área, mantendo as 10 chaves canônicas da listagem e 12 no detalhe (CA12).
- Regra de isolamento: testes nunca importam arquivos de `srv/`.

### GREEN
- Atualizar `package.json` configurando os blocos de destinations sob o perfil `[production]` em `cds.requires`, mantendo `auth.[development].users` intacto.
- Atualizar `.gitignore` assegurando as regras de bloqueio preventivo de credenciais e diretórios gerados.

---

## Etapa 3: Prontidão de compilação corporativa e build de produção (`npm run build`, `gen/db`, `gen/srv`)
CAs cobertos: CA2, CA9, CA10, CA13.
Itens N3 envolvidos: N3-1, N3-6.

### RED
Criar `test/publicacao-build-producao.test.ts` verificando:
- Geração correta dos artefatos de build para produção em `gen/db/` (HANA Cloud HDI) e `gen/srv/` (Node.js runtime) sob `cds build --production` (CA2).
- Execução com sucesso (retorno zero) do pipeline de compilação local `npm run build` (CA9).
- Ausência de violações de fronteiras arquiteturais via `npm run arch` (CA10).
- Recriação íntegra do esquema relacional em SQLite sob `cds.test` (CA13).
- Regra de isolamento: testes nunca importam arquivos de `srv/`.

### GREEN
- Ajustar scripts e configurações de build no `package.json` para suportar `cds build --production` com sucesso gerando `gen/db` e `gen/srv` em conformidade com o MTA.

---

## Etapa 4: Governança de promoção entre ambientes e bloqueio de automação de deploy
CAs cobertos: CA11.
Itens N3 envolvidos: N3-5.

### RED
Criar `test/publicacao-governanca-promocao.test.ts` verificando:
- Garantia de que scripts e comandos de deploy autônomo por agentes de IA e merge na branch principal são estritamente bloqueados e proibidos na esteira (CA11).
- Validação documental das regras de promoção manual entre ambientes (DEV, QA, PRD) sob responsabilidade exclusiva do mantenedor humano (CA11).
- Regra de isolamento: testes nunca importam arquivos de `srv/`.

### GREEN
- Validar documentalmente nos testes em `test/publicacao-governanca-promocao.test.ts` e assegurar no `package.json` que não há scripts de deploy autônomo em nuvem ou comandos que violem AGENTS.md:33, AGENTS.md:65 ou D11.

---

## Critérios de Pronto
1. Todos os 14 critérios de aceite (CA1 a CA14) cobertos pelas 4 etapas.
2. Cada etapa RED possui um arquivo de teste novo e dedicado em `test/`.
3. Descritores `mta.yaml` e `xs-security.json` sintaticamente válidos e compatíveis com ferramentas SAP BTP.
4. `.gitignore` bloqueia preventivamente todos os padrões de segredos corporativos.
5. `package.json` preserva integralmente `auth.[development].users`, garantindo que os testes existentes (002–013) continuem executando verdes.
6. `npm run build`, `npm run lint`, `npm test` e `npm run arch` passam sem erros no `verify.sh`.
