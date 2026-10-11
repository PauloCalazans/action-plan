# Design: interface-e-acesso-corporativo

**Spec:** agentic/projeto/specs/interface-e-acesso-corporativo/spec.md
**Status:** aprovado

Escopo técnico: ponto de entrada único e interface de usuário corporativa padrão SAP Fiori elements baseada em metadados e anotações declarativas CDS (`app/<app>/annotations.cds`), consumindo o novo serviço de aplicação Fiori `TratativaAppService` (`/api/app/v1`) com projeções legíveis OData v4 sobre as entidades do domínio, sem alterar os serviços transacionais anteriores (em especial o `TratativaService`, que preserva suas restrições e entity set-âncora). O portal corporativo é o SAP Build Work Zone (Launchpad corporativo; D4), responsável exclusivo pela autenticação e pelo fornecimento de identidade via token corporativo JWT/XSUAA (não existe tela, formulário nem fluxo de login dentro da aplicação). O aplicativo trata unicamente de autorização baseada em papéis corporativos (`@requires`, `@restrict`, XSUAA; N3). A interface organiza-se em três aplicações Fiori padronizadas utilizando o floorplan nativo List Report / Object Page (LR/OP), sem customizações de UI freestyle: (1) `app/tratativas/` (Gestão de Tratativas: LR com filtros e OP com seções Dados Gerais, Responsáveis visível exclusivamente ao Gestor, Plano de Ação hierárquico em 2 níveis, Evidências, Comentários e Histórico de Auditoria); (2) `app/minhas-pendencias/` (Minhas Pendências: abas "Minhas Ações" e "Minhas Tratativas" conforme 005 R18/R19 com botões de linha para iniciar/concluir ação própria); (3) `app/administracao/` (Administração da Plataforma: abas para Templates de Ações 009, Parâmetros de Alertas 010 com disparo manual e Estrutura Organizacional SF 011, consumindo diretamente o serviço existente `AdministracaoService`). A UI opera em modo estritamente direto e síncrono (`draft: false`, D9). A interface respeita a LGPD e menor privilégio (campos nulos ocultados, placeholders de conscientização; AGENTS.md:66). As regras de negócio e validações residem 100% no backend (a UI não cria regras próprias e propaga mensagens D10). Verificação automatizada headless com `cds.test` e linters, sem navegador real (AGENTS.md:38).

---

## Decisões

1. **Criação do serviço dedicado de interface `TratativaAppService` (`/api/app/v1`)** (R2, R3, R4, R5, R6; N3-1; Ruling R-01, Ruling R-03; D4, D6).
   - O serviço transacional `TratativaService` (`/api/tratativa/v1`) foi desenhado na spec 003 como um serviço estritamente ancorado em actions ligadas com `READ` recusado com HTTP 405 (`Use as functions listarTratativas e consultarTratativa.`), sem expor entity sets navegáveis de Ações, Evidências ou Comentários (exigência mandatória de testes RED anteriores).
   - O SAP Fiori elements (List Report e Object Page) exige entity sets OData v4 legíveis com suporte a `$select`, `$filter`, `$expand` e metadados de navegação para montar as páginas e facetas.
   - **Solução arquitetural:** Criar `TratativaAppService` em `srv/tratativa-app-service.cds` e `srv/tratativa-app-service.ts` (`@path: '/api/app/v1'`), contendo projeções declarativas somente leitura das entidades persistidas do modelo (`Tratativas`, `Acoes`, `Participantes`, `Evidencias`, `Comentarios`, `Historico`, `MinhasAcoes`, `MinhasTratativas`), além da action `criarTratativaAvulsa`. As entidades e rotinas administrativas de governança não são duplicadas aqui; residem e são consumidas diretamente do serviço existente `AdministracaoService` (`/api/administracao/v1`) conforme os designs aprovados em 009, 010 e 011 (Ruling R-03).
   - As actions de escrita ligadas às entidades do `TratativaAppService` (`mudarStatus`, `editar`, `mudarCriticidade`, `aplicarTemplate` em `Tratativas`; `iniciar` e `concluir` em `Acoes` e `MinhasAcoes`) delegam diretamente às mesmas funções de domínio e bloqueio pessimista por agregado (`bloquearTratativa`; D9), sem duplicar nenhuma regra de negócio.
   — **Por quê:** atende integralmente à exigência técnica do Fiori elements sem quebrar contratos OData de terceiros, sem duplicar superfícies de administração e sem violar testes RED existentes do `TratativaService`.
   — **Verificado por:** testes de compilação CDS e testes de integração de leitura/execução via `cds.test` (CA3, CA4, CA5, CA6).

2. **Estrutura de aplicações Fiori elements em `app/` sem importação de `srv/` (R2, R11; D2, D4)**
   - Três aplicações Fiori elements padronizadas em `app/`:
     - `app/tratativas/`: List Report e Object Page para gestão completa do ciclo de vida.
     - `app/minhas-pendencias/`: List Report com abas (IconTabBar) para produtividade do colaborador.
     - `app/administracao/`: List Report e Object Page com abas para governança de templates, alertas e SF.
   - Cada aplicação possui sua pasta `webapp/` contendo `manifest.json`, `i18n/i18n.properties` e arquivo `annotations.cds` na raiz do app.
   - O arquivo central `app/services.cds` carrega as anotações das 3 aplicações:
     ```cds
     using from './tratativas/annotations';
     using from './minhas-pendencias/annotations';
     using from './administracao/annotations';
     ```
   - Fronteira arquitetural rigorosa: nenhum arquivo em `app/` importa arquivos TypeScript ou JavaScript de `srv/` ou `db/`. Todas as conexões aos serviços são declaradas via metadados OData e anotações CDS.
   — **Por quê:** cumpre a decisão D4 e a regra inviolável de arquitetura D2 verificada pelo dependency-cruiser (`npm run arch`).
   — **Verificado por:** `npm run arch`; compilação do modelo CDS (`npm run build`); testes das etapas 1 a 4.

3. **Ponto de entrada único e autenticação exclusiva pelo SAP Build Work Zone (R1, R7; D4; N3: autorização)**
   - **Autenticação corporativa e Elo Managed App Router ↔ CAP:**
     - A autenticação federada é provida 100% pelo SAP Build Work Zone / SAP Cloud Identity Services (IAS) / XSUAA corporativo.
     - Nenhuma tela, formulário, rota ou diálogo de login existe dentro da aplicação (005 R4; AGENTS.md:11,52).
     - **Fluxo de execução em nuvem:**
       1. O colaborador corporativo autentica-se no Identity Provider corporativo (SAP Cloud Identity Services - IAS ou IdP corporativo federado via SAML 2.0 / OpenID Connect) conectado ao XSUAA da subaccount BTP.
       2. No launchpad do SAP Build Work Zone, o usuário clica no tile da aplicação. O **managed approuter** (Application Router gerenciado pelo Work Zone) carrega os artefatos estáticos da aplicação a partir do HTML5 Application Repository (`action-plan-html5-host`).
       3. Cada aplicação Fiori em `app/` possui seu descritor de rotas `xs-app.json` e declara a propriedade `sap.cloud.service: "br.com.calazanstec.actionplan"` em seu `manifest.json`.
       4. Quando a aplicação UI efetua chamadas OData para as rotas `/api/...`, o managed approuter consulta as rotas declaradas no `xs-app.json` do app e despacha as requisições para a **destination** do backend CAP (`action-plan-srv-api`).
       5. A destination do backend é provisionada no BTP Destination Service configurada com `HTML5.ForwardAuthToken=true` e `authentication: "ForwardAuthToken"`, repassando de forma transparente o token JWT corporativo emitido pelo XSUAA no cabeçalho HTTP `Authorization: Bearer <token>`.
       6. O serviço CAP Node.js/TypeScript em Cloud Foundry (`action-plan-srv`) recebe a requisição e valida a assinatura criptográfica e os escopos do token JWT utilizando `@sap/xssec` e `cds.requires.auth = "xsuaa"` sob o perfil `[production]`.
       7. Sob os perfis de desenvolvimento local e execução de testes (`[development]` e `[test]`), a autenticação opera em modo `kind: "mocked"` (SQLite em memória; `package.json`), preservando 100% dos testes automatizados sem dependência de infraestrutura externa ou rede.
     - Requisições sem token válido ou com token expirado são rejeitadas com código HTTP 401 (`Unauthorized`).

   - **Origem da Matrícula Funcional (`obterMatriculaUsuario`; N3: autorização):**
     - O módulo `srv/tratativa/identidade.ts` é o ponto único canônico de resolução de identidade (`obterMatriculaUsuario(req)`) e comparação (`usuarioAutenticadoEhMatricula`), desenhado para isolar regras de negócio da infraestrutura de login.
     - **Diagnóstico técnico no BTP:** Em ambientes corporativos reais integrados com IAS/XSUAA, a propriedade `req.user.id` do CAP devolve o identificador primário de login (Subject/NameID — tipicamente o e-mail corporativo como `nome.sobrenome@empresa.com` ou o User UUID do IAS), e não a matrícula funcional do colaborador (ex.: `"M1001"` ou `"12345678"`).
     - **Opções arquiteturais avaliadas:**
       * **Opção A (Recomendada): Atributo customizado "matricula" no IAS/XSUAA propagado no JWT:**
         - O SAP Cloud Identity Services (IAS) mapeia a matrícula do colaborador (campo `employeeId`) para o atributo de usuário corporativo. O descritor `xs-security.json` declara formalmente o atributo de usuário:
           ```json
           "attributes": [
             {
               "name": "matricula",
               "description": "Matrícula funcional do colaborador",
               "valueType": "string"
             }
           ]
           ```
         - O token JWT emitido pelo XSUAA passa a conter a claim de atributo, e a função `obterMatriculaUsuario(req)` em `srv/tratativa/identidade.ts` passa a ler:
           ```typescript
           export function obterMatriculaUsuario(req: cds.Request): string {
             return req.user.attr?.matricula?.[0] || req.user.id;
           }
           ```
         - *Prós:* Não adiciona nenhuma chamada de rede ou latência em tempo de execução; a matrícula vem assinada e verificada criptograficamente no próprio token JWT; utiliza o padrão oficial do SAP BTP para propagação de atributos corporativos; fallback gracioso para `req.user.id` mantendo compatibilidade total com testes mockados.
         - *Contras:* Requer configuração de attribute mapping no IAS e na subaccount do SAP BTP durante a implantação física de infraestrutura.
       * **Opção B: Configuração do `user_name` como matrícula no IdP/IAS:**
         - O Identity Provider corporativo (IAS) é configurado para utilizar a matrícula funcional como o Subject Name Identifier (`user_name` do token JWT), de modo que `req.user.id` já corresponda diretamente à matrícula sem alteração de código.
         - *Prós:* Nenhuma alteração necessária no código em `srv/tratativa/identidade.ts`.
         - *Contras:* Torna a matrícula o identificador global obrigatório no IdP para todos os serviços da subaccount, o que frequentemente conflita com o padrão de autenticação corporativo onde o e-mail corporativo é o identificador de login preferencial e chave de auditoria para outros sistemas SAP.
       * **Opção C: Resolução dinâmica via SAP SuccessFactors a partir do e-mail:**
         - Ao receber uma requisição autenticada, `obterMatriculaUsuario` extrai o e-mail de login do usuário (`req.user.id` ou claim `email`) e realiza uma consulta síncrona à API de colaboradores do SAP SuccessFactors (`srv/integracoes/successfactors/`, intent 011) para resolver a matrícula (`userId`).
         - *Prós:* Não exige configuração customizada de atributos no token JWT nem modificação nas configurações do IAS.
         - *Contras:* Introduz sobrecarga e latência de rede externa a cada requisição (ou demanda camada adicional e complexa de cache em memória/Redis); cria dependência em tempo de execução com a disponibilidade contínua do SuccessFactors para autenticação básica; viola o desacoplamento arquitetural da plataforma.
     - **Recomendação e Escalabilidade N3:** A **Opção A** é a solução arquitetural recomendada por aliar desempenho, segurança e aderência aos padrões SAP BTP. Este item é formalizado como **Gatilho N3 (N3-5)** para homologação e decisão final humana no Gate 1.
     - **Ambiente de Testes:** Nos testes automatizados e em desenvolvimento local (`[development]` e `[test]`), o CAP utiliza `cds.requires.auth = "mocked"` com os usuários mockados definidos em `package.json` (`admin`, `gestor`, `usuario`, etc.), onde `req.user.id` representa diretamente a matrícula funcional, garantindo que 100% dos testes automatizados continuem executando verdes sem modificações.

   - **Credencial Técnica de Máquina (`AplicativoOrigem` por OAuth2 Client Credentials):**
     - O escopo `$XSAPPNAME.AplicativoOrigem` é emitido exclusivamente para sistemas externos autenticados via fluxo OAuth2 Client Credentials (machine-to-machine) no mesmo XSUAA da subaccount (002 R18, D7).
     - Essa credencial técnica destina-se unicamente ao consumo do serviço de integração transacional `IntegracaoOrigemService` (`/api/integracao-origem/v1`).
     - **Bloqueio Irrestrito na Camada de UI (HTTP 403):** Requisições portando exclusivamente a credencial técnica `AplicativoOrigem` são sumariamente rejeitadas com código HTTP 403 (`Acesso negado.`) ao tentar acessar qualquer endpoint ou serviço OData consumido pelas aplicações de interface (`TratativaAppService` sob `/api/app/v1` e `AdministracaoService` sob `/api/administracao/v1`). A credencial técnica não possui nenhum tile, nenhum inbound e nenhuma permissão visual ou operacional nas telas Fiori.
   — **Por quê:** cumpre o padrão arquitetural SAP BTP com managed approuter e destination protegida; estabelece rastreabilidade de matrícula corporativa; garante separação rígida entre usuários humanos e integrações de máquina.
   — **Verificado por:** CA1, CA2, CA20; testes de integração automatizados em `test/ui-tratativas.test.ts`, `test/ui-minhas-pendencias.test.ts`, `test/ui-administracao.test.ts` e `test/ui-launchpad-governanca.test.ts` via `cds.test`.

4. **Arquitetura estritamente direta e síncrona sem Draft CAP (`draft: false`) (R3; D9)**
   - Nenhuma entidade consumida pela UI é anotada com `@odata.draft.enabled`.
   - Todas as operações de criação, edição ou transição executam de forma direta e atômica via requisições POST, PATCH ou actions ligadas.
   - A ausência de draft elimina tabelas temporárias de rascunho no banco de dados e impede retenção prolongada de locks pessimistas por agregado (decisão D9).
   - Preserva a simplicidade da composição hierárquica de Ações e Subações (004), prevenindo conflitos de rascunhos aninhados.
   — **Por quê:** conformidade com D9 (serialização por agregado com bloqueio pessimista imediato) e garantia de determinismo operacional.
   — **Verificado por:** CA5; testes de persistência direta sem tabelas `_drafts`.

5. **Metadados e anotações da tela de Gestão de Tratativas (`app/tratativas/`) (R4, R8, R9; I2, I3, M1)**
   - `List Report`:
     - `@UI.SelectionFields`: filtros por `origem`, `criticidade`, `status`, `unidade`, `area` (003 R24).
     - `@UI.LineItem`: colunas Código, Título, Origem, ID_Origem, Criticidade, Status, Unidade, Área e Data prevista de conclusão; ordenação padrão por `dataPrevistaConclusao asc`.
     - Botão de cabeçalho da tabela: `UI.DataFieldForAction` para "Criar Tratativa Avulsa" acionando a action `TratativaAppService.criarTratativaAvulsa` (M1).
   - `Object Page`:
     - `@UI.HeaderInfo`: Título da tratativa, criticidade e status.
     - `@UI.HeaderFacets`: badges de status, unidade, área, solicitante (se autorizado) e prazo.
     - Botões de cabeçalho declarados em `@UI.Identification` (I2; CA7, CA8): `mudarStatus` ("Iniciar", "Encerrar", "Cancelar", "Reabrir"), `mudarCriticidade` ("Alterar Criticidade") e `aplicarTemplate` ("Aplicar Template"), vinculados declarativamente e habilitados exclusivamente para o `Gestor de Tratativa`.
     - Seções (`@UI.Facets`):
       1. `Dados Gerais`: formulário de campos cadastrais editáveis pelo Gestor (`editar`), sem o campo de responsável principal (alocado na faceta dedicada).
       2. `Responsáveis`: CollectionFacet visível exclusivamente ao Gestor de Tratativa (`@UI.Hidden: ocultaResponsaveis`; I3, Ruling R-02, CA21), agrupando o FieldGroup do Responsável Principal (`responsavelPrincipal`) e a tabela de Participantes (`Target: 'participantes/@UI.LineItem'`). Para usuários sem o papel `GestorTratativa`, a seção é ocultada condicionalmente na UI e os dados são retornados como `null`/`[]` pelo backend sob LGPD.
       3. `Plano de Ação`: visualização hierárquica de 2 níveis (Ações e Subações via auto-associação `acaoMae`; 004 R25) com colunas Descrição, Prioridade, Status, Prazo, Evidência obrigatória, Conclusão e Responsável (visível para Gestor); botões `UI.DataFieldForAction` para "Adicionar Ação", "Adicionar Subação", "Delegar", "Iniciar", "Concluir" e "Aplicar Template".
       4. `Evidências`: tabela com lista de evidências anexadas (`Target: 'evidencias/@UI.LineItem'`; 006 R11); botões `UI.DataFieldForAction` para "Anexar Evidência" e download de arquivo.
       5. `Comentários`: linha do tempo de comentários com campo de texto e menções (`Target: 'comentarios/@UI.LineItem'`; 007).
       6. `Histórico de Auditoria`: tabela cronológica de eventos de auditoria com autor, data/hora e justificativa (`Target: 'historico/@UI.LineItem'`; 008).
   — **Por quê:** provê a visão holística operacional da tratativa em alinhamento rigoroso com as specs 002 a 009, garantindo exibição de botões de cabeçalho via `@UI.Identification` e salvaguarda LGPD na faceta de responsáveis.
   — **Verificado por:** CA6 a CA12, CA21; testes de renderização de anotações e chamadas OData na etapa 1.

6. **Metadados e anotações da tela de Minhas Pendências (`app/minhas-pendencias/`) (R5)**
   - Floorplan List Report configurado com `IconTabBar` separando duas visões pessoais:
     - Aba 1 ("Minhas Ações"): consome `TratativaAppService.MinhasAcoes`; colunas Código da Ação, Código e Título da Tratativa, Status da Tratativa, Descrição, Prioridade, Status da Ação, Prazo, Evidência obrigatória e Data de conclusão; botões de linha `UI.DataFieldForAction` para "Iniciar" e "Concluir" com execução síncrona imediata.
     - Aba 2 ("Minhas Tratativas"): consome `TratativaAppService.MinhasTratativas`; colunas Código, Título, Origem, ID_Origem, Criticidade, Status, Meu Papel (resolvido dinamicamente como "Responsável Principal" ou "Participante" conforme 005 R19 e CA15), Unidade, Área e Data prevista; navegação direta para a Object Page de `app/tratativas/`.
   - Acesso irrestrito a qualquer colaborador autenticado (`authenticated-user`).
   — **Por quê:** centraliza a execução produtiva do colaborador sem exigir buscas na lista geral.
   — **Verificado por:** CA13 a CA15; testes de chamada OData e botões de ação na etapa 2.

7. **Metadados e anotações da tela de Administração (`app/administracao/`) consumindo diretamente `AdministracaoService` (R6; N3: autorização e contrato aditivo; Ruling R-03, Ruling R-04, I1)**
   - A aplicação `app/administracao/` consome diretamente o serviço de administração existente `AdministracaoService` (`/api/administracao/v1`), sem projeções `@readonly` duplicadas em `TratativaAppService` (Ruling R-03).
   - O `AdministracaoService` (designs 009–011) foi originalmente concebido baseado em actions/functions e sem entity sets para as entidades de parametrização. Para viabilizar a leitura e renderização nativas pelo SAP Fiori elements sem quebrar contratos, o intent 013 acrescenta a `srv/administracao-service.cds` projeções SOMENTE LEITURA (`@readonly`, `@Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }`, `@restrict: [{ grant: '*', to: 'Administrador' }]`) das entidades `Templates`, `ParametrosAlertas` e `ParametrosIntegracaoSF` sobre o modelo persistido em `db/tratativa.cds` (`m.Templates`, `m.ParametrosAlertas`, `m.ParametrosIntegracaoSF`), com acesso restrito exclusivamente ao papel `Administrador` (Ruling R-04).
   - As escritas continuam sendo executadas unicamente pelas actions e functions já desenhadas em 009, 010 e 011 (`criarTemplate`, `editarTemplate`, `ativarTemplate`, `desativarTemplate`, `atualizarParametrosAlertas`, `executarProcessamentoAlertas`, `atualizarParametrosIntegracaoSF`), que são anotadas na UI como botões de linha ou de cabeçalho (`UI.DataFieldForAction`).
   - Aplicação e entidades com acesso exclusivo ao papel corporativo `Administrador` (HTTP 403 para outros papéis corporativos e credenciais técnicas).
   - Abas administrativas configuradas no `manifest.json` / floorplan consumindo as entidades e actions reais dos designs 009, 010 e 011:
     - Aba 1 ("Templates de Ações"): List Report e Object Page sobre `AdministracaoService.Templates` (009 R12), com botões `UI.DataFieldForAction` para o ciclo de vida ("Criar Template" - `criarTemplate`, "Editar" - `editarTemplate`, "Ativar" - `ativarTemplate` e "Desativar" - `desativarTemplate`); Object Page com Facet conectada a FieldGroup para detalhes e itens ordenados.
     - Aba 2 ("Parâmetros de Alertas"): formulário sobre `AdministracaoService.ParametrosAlertas` com `UI.Facets` conectadas a `UI.FieldGroup #Configuracao` (010 R3), botão "Salvar Parâmetros" acionando `atualizarParametrosAlertas` e botão de acionamento manual no cabeçalho "Executar Processamento Manual" acionando `executarProcessamentoAlertas` (010 R9).
     - Aba 3 ("Estrutura Organizacional"): formulário sobre `AdministracaoService.ParametrosIntegracaoSF` com `UI.Facets` conectadas a `UI.FieldGroup #Mapeamento` (011 R6) e botão "Salvar Mapeamento" acionando `atualizarParametrosIntegracaoSF`.
   — **Por quê:** centraliza a governança corporativa da plataforma consumindo diretamente as operações já existentes e desenhadas em 009, 010 e 011 sem duplicação de superfícies e com ações operacionais ativas, provendo entity sets legíveis exigidos pelo compilador CDS e Fiori elements sem violar os contratos de escrita.
   — **Verificado por:** CA16, CA16a, CA16b, CA17; testes automatizados `test/ui-administracao.test.ts` (`cds.test`) comprovando leitura das projeções pelo Administrador (HTTP 200) e recusa com HTTP 403 para os demais papéis na etapa 3.

8. **Mapeamento de Inbounds e Catálogo do SAP Build Work Zone (R7; N3: autorização)**
   - **Modelo Work Zone Standard via HTML5 Content Provider (Channel Manager):**
     - Substitui completamente o modelo obsoleto de arquivo de portal estático (`app/portal-config.json`) pelo modelo oficial do SAP Build Work Zone Standard Edition.
     - Cada aplicação Fiori elements em `app/` declara suas intenções semânticas de navegação cross-app diretamente na seção `sap.app.crossNavigation.inbounds` do seu respectivo `webapp/manifest.json`:
       * `app/tratativas/webapp/manifest.json`:
         - SemanticObject: `Tratativa`, Action: `manage`
         - Título: "Gestão de Tratativas", Subtítulo: "Ciclo de vida e planos de ação"
         - Ícone: `sap-icon://task`
       * `app/minhas-pendencias/webapp/manifest.json`:
         - SemanticObject: `MinhasPendencias`, Action: `display`
         - Título: "Minhas Pendências", Subtítulo: "Ações e tratativas sob minha responsabilidade"
         - Ícone: `sap-icon://user-edit`
       * `app/administracao/webapp/manifest.json`:
         - SemanticObject: `AdministracaoPlataforma`, Action: `manage`
         - Título: "Administração", Subtítulo: "Templates, alertas e integrações"
         - Ícone: `sap-icon://settings`
     - **Tile externo "Dashboards e Indicadores":** Configurado diretamente como URL/aplicação de link externo no site do Work Zone, apontando para o workspace do Power BI corporativo ou SAP Analytics Cloud (012 R9), sem necessidade de código HTML5 no repositório.
     - **Descoberta via Channel Manager:** O SAP Build Work Zone descobre automaticamente as aplicações publicadas no HTML5 Application Repository através do HTML5 Content Provider configurado no Channel Manager, mapeando as declarações `sap.app.crossNavigation.inbounds` para os apps do catálogo de conteúdo do launchpad.

   - **Governança de Visibilidade no Site vs Autorização Efetiva no Backend:**
     - **Configuração de Visibilidade no Site:** A disponibilização visual dos tiles para os colaboradores é realizada no Site Editor do Work Zone, vinculando os papéis do site (**Site Roles**) às **Role Collections** corporativas do BTP XSUAA:
       * Tile "Minhas Pendências": visível a todos os usuários corporativos autenticados (`Everyone` / `authenticated-user`).
       * Tile "Gestão de Tratativas": visível a todos os usuários autenticados com papel de negócio (com proteção de dados sensíveis e mascaramento LGPD conforme R8 para não-Gestores).
       * Tile "Administração": visível exclusivamente para usuários associados à Role Collection `ActionPlan_Administrador` (papel corporativo `'Administrador'`).
       * Tile "Dashboards e Indicadores": visível exclusivamente para usuários associados às Role Collections com perfil analítico ou de gestão (`ActionPlan_Gestor`, `ActionPlan_Administrador` e `ActionPlan_LeitorAnalitico`; 012 R10). Oculto para usuários comuns.
       * `AplicativoOrigem`: credencial de máquina sem nenhum tile no Work Zone e sem nenhum papel de site associado.
     - **Autorização Real no Backend:** A visibilidade do tile no launchpad constitui apenas ergonomia de navegação no portal corporativo. A segurança e a autorização de verdade residem de forma inegociável nas regras declarativas `@restrict` e `@requires` dos serviços SAP CAP (`srv/*-service.cds`). Mesmo na eventualidade de uma configuração divergente no site do Work Zone, qualquer requisição OData disparada sem a devida role collection corporativa no token JWT é bloqueada pelo runtime do CAP com HTTP 403 (`Acesso negado.`).

   - **Unificação de Nomenclatura do Papel Administrador:**
     - O papel corporativo da plataforma é estritamente unificado como `'Administrador'` em todas as instâncias do sistema, eliminando a designação redundante `'AdministradorPlataforma'`.
     - Esta padronização assegura alinhamento total entre a modelagem CDS (`srv/administracao-service.cds` com `@restrict: [{ grant: '*', to: 'Administrador' }]`), o arquivo de configuração de desenvolvimento (`package.json` com `auth.[development].users.admin.roles = ["Administrador"]`), o descritor de segurança BTP (`xs-security.json` com scope `$XSAPPNAME.Administrador` e role-template `Administrador`) e as Role Collections corporativas (`ActionPlan_Administrador`).
   — **Por quê:** adota a arquitetura oficial do SAP Build Work Zone Standard Edition baseada em inbounds e Channel Manager, elimina arquivos legados de portal e mantém consistência terminológica e separação rígida entre visibilidade visual e autorização efetiva.
   — **Verificado por:** CA18, CA19, CA19a, CA19b, CA20; testes automatizados em `test/ui-launchpad-governanca.test.ts` e testes de autorização direta OData via `cds.test`.

9. **Proteção de Dados, Menor Privilégio e LGPD no Serviço de UI (R8; [LGPD])**
   - No `TratativaAppService`, a máscara LGPD é aplicada no hook `after('READ')`:
     * Para usuários que não possuam papel `GestorTratativa`: `solicitante = null`, `descricao = null`, `responsavelPrincipal = null`, lista de `participantes = []`, e na entidade `Acoes` o campo `responsavel = null`.
   - Na UI, campos que retornam como `null` do backend são mapeados com regras de ocultação ou exibição neutra ("-").
   - A seção de Responsáveis da Tratativa é renderizada exclusivamente para o `GestorTratativa` (oculta para usuários comuns conforme 005 R17/R26 e CA21).
   - Placeholders padronizados de conscientização em todos os campos de texto livre (justificativas, descrições, comentários), orientando contra a inserção de nomes e dados sensíveis de saúde via `@UI.Placeholder: '{@i18n>placeholderAvisoLGPD}'`.
   — **Por quê:** cumprimento rigoroso de AGENTS.md:66 e das diretrizes da LGPD sem criar regras de negócio no frontend.
   — **Verificado por:** CA21, CA22; testes de mascaramento e anotações na etapa 1.

10. **Tratamento de Mensagens e Recusas Estruturadas (R9; D10)**
    - A interface do usuário utiliza os componentes padrão do Fiori elements (Message Popover, MessageBox, MessageStrip) para exibir na íntegra as mensagens de erro retornadas pelo backend.
    - Quando a resposta do backend trouxer a indicação de `target`, o controle correspondente na tela recebe o estado visual de erro (`ValueState = Error`).
    - Notificações de sucesso não bloqueantes (Message Toast) para respostas HTTP 200/201/204.
    — **Por quê:** garante feedback transparente e imediato ao operador, respeitando a decisão D10.
    — **Verificado por:** CA23, CA24; testes de propagação de erro e estado visual nas etapas 1 e 2.

---

## Contrato de Serviços e Anotações UI

### 1. `srv/tratativa-app-service.cds`
```cds
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
  };
}
```

### 2. `srv/administracao-service.cds` (extensão aditiva para UI - Ruling R-04)
```cds
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

### 3. `app/tratativas/annotations.cds`
```cds
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
```

### 4. `app/minhas-pendencias/annotations.cds`
```cds
using TratativaAppService from '../../srv/tratativa-app-service';

annotate TratativaAppService.MinhasAcoes with @(
  UI.HeaderInfo: {
    TypeName: 'Minha Ação',
    TypeNamePlural: 'Minhas Ações'
  },
  UI.SelectionFields: [ statusAcao ],
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigoAcao },
    { $Type: 'UI.DataField', Value: codigoTratativa },
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
    { $Type: 'UI.DataField', Value: tituloTratativa },
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
```

### 5. `app/administracao/annotations.cds`
```cds
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
```

### 6. `app/tratativas/xs-app.json` e manifesto (inbounds e serviço de nuvem)
```json
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
// app/tratativas/webapp/manifest.json (trecho de crossNavigation e sap.cloud)
{
  "sap.app": {
    "id": "br.com.calazanstec.actionplan.tratativas",
    "type": "application",
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

### 7. `app/minhas-pendencias/xs-app.json` e manifesto (inbounds e serviço de nuvem)
```json
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
// app/minhas-pendencias/webapp/manifest.json (trecho de crossNavigation e sap.cloud)
{
  "sap.app": {
    "id": "br.com.calazanstec.actionplan.minhaspendencias",
    "type": "application",
    "crossNavigation": {
      "inbounds": {
        "MinhasPendencias-display": {
          "semanticObject": "MinhasPendencias",
          "action": "display",
          "title": "{{appTitle}}",
          "subTitle": "{{appSubTitle}}",
          "icon": "sap-icon://user-edit"
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

### 8. `app/administracao/xs-app.json` e manifesto (inbounds e serviço de nuvem)
```json
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
// app/administracao/webapp/manifest.json (trecho de crossNavigation e sap.cloud)
{
  "sap.app": {
    "id": "br.com.calazanstec.actionplan.administracao",
    "type": "application",
    "crossNavigation": {
      "inbounds": {
        "AdministracaoPlataforma-manage": {
          "semanticObject": "AdministracaoPlataforma",
          "action": "manage",
          "title": "{{appTitle}}",
          "subTitle": "{{appSubTitle}}",
          "icon": "sap-icon://settings"
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

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-interface-e-acesso-corporativo.md` | Entregar o intent 013 em 4 etapas sequenciais RED/GREEN: criação do serviço TratativaAppService e aplicação app/tratativas/ com xs-app.json (R1-R4, R8-R12); aplicação app/minhas-pendencias/ com xs-app.json (R5); aplicação app/administracao/ com xs-app.json (R6); governança de acesso no SAP Build Work Zone via inbounds e Channel Manager, papel Administrador unificado e bloqueio 403 para credencial técnica AplicativoOrigem (R7). | `interface-e-acesso-corporativo/001-interface-e-acesso-corporativo` |

---

## Itens N3 (aguardam aprovação no Gate 1)

| Item | Origem | Impacto | Justificativa e Mitigação |
|---|---|---|---|
| N3-1 | R2, R4 | Criação do serviço de interface `TratativaAppService` (`/api/app/v1`) com projeções legíveis OData v4. | Permite que o SAP Fiori elements opere com leitura navegável sem quebrar o contrato do `TratativaService` (que recusa READ no entity set de chave). |
| N3-2 | R1, R7 | Papéis corporativos XSUAA, inbounds nos manifest.json e catálogo no SAP Build Work Zone (`authenticated-user`, `GestorTratativa`, `Administrador`, `LeitorAnalitico`, bloqueio total de `AplicativoOrigem` na UI). | Garante governança de acesso unificada e menor privilégio visual no launchpad corporativo, mantendo autorização mandatória no backend via `@restrict`. |
| N3-3 | R8 | Mascaramento LGPD aplicado no serviço de UI com entrega de `null` para campos protegidos e placeholders de conscientização. | Assegura que colaboradores sem perfil de gestão não visualizem dados pessoais desnecessários (`AGENTS.md:66`). |
| N3-4 | R6, Ruling R-04 | Extensão aditiva do contrato público de `AdministracaoService` (`srv/administracao-service.cds`) com projeções somente leitura (`Templates`, `ParametrosAlertas`, `ParametrosIntegracaoSF`) restritas ao Administrador. | Exposição de entity sets OData v4 legíveis requerida pelo compilador CDS e SAP Fiori elements para renderizar as telas administrativas em `app/administracao/`, preservando mutações nas actions prévias de 009, 010 e 011. |
| N3-5 | R1, R7 | Origem da matrícula funcional corporativa no SAP BTP (IAS/XSUAA vs `req.user.id`). Opção A recomendada: atributo customizado `matricula` no IAS/XSUAA propagado no JWT e consumido por `obterMatriculaUsuario`. | No BTP, `req.user.id` retorna o identificador de login (e-mail ou UUID) em vez da matrícula. A Opção A provê a matrícula via claim assinada sem sobrecarga de rede. Aguarda deliberação no Gate 1 humano. Testes locais e desenvolvimento mantêm `auth = "mocked"` com SQLite em memória. |

---

## O que não muda

- O serviço `TratativaService` (`/api/tratativa/v1`) e o `IntegracaoOrigemService` permanecem estritamente intactos, preservando a assinatura de functions e o comportamento fechado de seus entity sets. O `AdministracaoService` preserva integralmente todas as suas actions e functions desenhadas nos intents 009, 010 e 011, recebendo estritamente de forma aditiva as 3 projeções somente leitura (`Templates`, `ParametrosAlertas`, `ParametrosIntegracaoSF`) necessárias para a renderização do Fiori elements (Ruling R-04).
- O aplicativo não possui tela nem mecanismo interno de login: a identidade é 100% delegada ao SAP Build Work Zone / IAS via JWT corporativo.
- A governança de visibilidade de tiles no Work Zone opera como mera ergonomia de navegação no site; a segurança e autorização reais residem inegociável e exclusivamente nas regras `@restrict` e `@requires` do backend CAP.
- O escopo técnico `AplicativoOrigem` é emitido via OAuth2 client credentials e não possui acesso a nenhum serviço ou tela da UI (retornando HTTP 403).
- Nenhuma regra de negócio é duplicada no frontend: toda operação de escrita delega às rotinas existentes de domínio.
- Nenhuma entidade utiliza draft do CAP no MVP (`draft: false`).
- A suíte de testes automatizados e o ambiente de desenvolvimento local continuam utilizando `cds.requires.auth = "mocked"` em memória via SQLite, preservando integralmente os usuários mockados e a execução headless sem dependência de rede ou serviços BTP reais.

---

## O desconfortável, declarado

1. **Separação entre serviço transacional de domínio e serviço de aplicação Fiori:**
   O `TratativaService` foi modelado nos intents anteriores sob o padrão D6 com entity set fechado `{ key codigo }` e leitura exclusivamente via functions (`listarTratativas`, `consultarTratativa`). Como o SAP Fiori elements LR/OP não consegue operar nativamente sobre functions para renderizar tabelas e detalhes, a criação de `TratativaAppService` foi a solução necessária para conciliar a exigência do Fiori sem regredir os testes RED já congelados.

2. **Operação síncrona sem Draft no Fiori elements:**
   A adoção de `draft: false` simplifica a integridade e respeita a serialização por agregado D9, mas implica que edições na UI são persistidas imediatamente a cada clique de ação ou salvamento, sem o recurso de rascunhos em segundo plano nativo do Fiori elements v4.

---

## Arquivos Envolvidos

- `srv/tratativa-app-service.cds`
- `srv/tratativa-app-service.ts`
- `srv/administracao-service.cds`
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

---

## Correção (autenticação, 2026-10-10)

1. **Elo Managed Approuter ↔ CAP detalhado:** Especificou o fluxo completo de autenticação corporativa em produção (login no IAS/XSUAA, abertura do app no Work Zone a partir do HTML5 Application Repository, resolução de rotas pelo managed approuter via `xs-app.json` de cada app, encaminhamento para a destination `action-plan-srv-api` com `HTML5.ForwardAuthToken=true` e validação do token JWT pelo backend CAP com `cds.requires.auth = "xsuaa"`). Adicionou as especificações de `xs-app.json` por app e `sap.cloud.service` nos `manifest.json`.
2. **Modelo de Tiles do SAP Build Work Zone atualizado:** Substituiu o descritor legado `app/portal-config.json` pelo modelo Work Zone Standard Edition baseado em `sap.app.crossNavigation.inbounds` no `manifest.json` de cada aplicação, integração via HTML5 Content Provider (Channel Manager) e visibilidade governada por Site Roles vinculadas às Role Collections do BTP. Formalizou que a visibilidade do tile é configuração do site corporativo, enquanto a autorização mandatória é garantida no backend pelo CAP via `@restrict`.
3. **Origem da matrícula funcional analisada (Item N3-5):** Diagnosticou a divergência em nuvem onde `req.user.id` retorna o identificador de login (e-mail ou UUID) em vez da matrícula. Apresentou análise técnica de três alternativas (Opção A: atributo `matricula` no IAS/XSUAA propagado no JWT e consumido em `obterMatriculaUsuario`; Opção B: `user_name` como matrícula no IdP; Opção C: resolução em runtime pelo SuccessFactors). Recomendou a Opção A e registrou como item N3 para deliberação humana no Gate 1. Garantiu a continuidade integral dos usuários mockados em desenvolvimento e testes sob `auth = "mocked"`.
4. **Nomenclatura do papel administrativo unificada:** Unificou todas as ocorrências do papel administrativo em `'Administrador'` (eliminando `'AdministradorPlataforma'`), mantendo conformidade estrita com `srv/administracao-service.cds`, `package.json` e `xs-security.json`.
5. **Credencial técnica M2M restrita com teste negativo:** Detalhou que a identidade técnica `AplicativoOrigem` opera exclusivamente por OAuth2 Client Credentials no mesmo XSUAA corporativo para integrações de backend (`IntegracaoOrigemService`) e adicionou explicitamente o requisito e teste negativo garantindo recusa sumária com HTTP 403 em todos os endpoints e serviços da UI.
6. **Encadeamento opcional em `obterMatriculaUsuario` (Achado 2):** Ajustou a função `obterMatriculaUsuario` para utilizar encadeamento opcional também no atributo (`req.user.attr?.matricula?.[0] || req.user.id`), prevenindo erro fatal de `TypeError` em ambientes de desenvolvimento local e testes automatizados sob `auth = "mocked"` onde `req.user.attr` é `undefined`.
7. **Correção do path de `IntegracaoOrigemService` (Achado 3):** Corrigiu a menção ao path do serviço de integração transacional de `/api/origem/v1` para `/api/integracao-origem/v1`, alinhando ao path real exposto em `srv/integracao-origem-service.cds`.

## Decisão do humano — N3-5 e papéis, 2026-10-10

- **N3-5 (origem da matrícula): mantém a Opção A** como mapeada acima (atributo `matricula` no IAS propagado no token e lido por `obterMatriculaUsuario`). O humano aceita o **débito técnico** de depender do IAS para isso e vai verificar a viabilidade de habilitá-lo; com o IAS, basta preencher a matrícula no campo disponível. O desenho não muda por enquanto.
- **SuccessFactors só como value help** nos campos de pessoa (`buscarColaboradores` da 011); não participa do login.
- **Papéis** por roles/role collections do XSUAA, mapeados nas roles atuais (genéricas, sem nome de departamento): gestor/encarregado → `GestorTratativa`; técnico/engenheiro de segurança → `GestorTratativa`; operador administrativo → `Administrador`. O nome do cargo fica só na role collection da empresa.
