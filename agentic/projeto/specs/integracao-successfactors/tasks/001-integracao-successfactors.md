# Task 001: integracao-successfactors

**Spec:** agentic/projeto/specs/integracao-successfactors/spec.md  
**Status:** em-andamento  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** integracao-successfactors/001-integracao-successfactors

## Objetivo
Entregar o intent 011 implementando a integração corporativa em modo estritamente somente leitura com o SAP SuccessFactors para consulta de colaboradores, gestores e estrutura organizacional (Unidades e Áreas), dividida em 4 etapas sequenciais RED/GREEN:
1. **Modelo de parametrização, governança e portas desacopladas:** modelo persistido relacional aditivo `ParametrosIntegracaoSF` em `db/tratativa.cds` (com baseline sem CSV), portas `ProvedorPessoasAdapter` e `ProvedorEstruturaAdapter` configuradas em `package.json` (`cds.requires`) com dublês em `test/apoio/`, operações de governança `consultarParametrosIntegracaoSF` em `TratativaService` e `AdministracaoService` (Gestor e Administrador) e `atualizarParametrosIntegracaoSF` em `AdministracaoService` (exclusivo Administrador), validações de limites e recusa estática de `AplicativoOrigem` (R1, R6, R11, R12, R13; CA9-CA11a, CA20, CA23, CA24a);
2. **Porta de diretório de pessoas, cache em memória e integração com alertas:** módulo de cache volátil em memória com TTL de 15 minutos em `srv/integracoes/cache-pessoas.ts`, implementação da porta `DiretorioPessoasAdapter` em `srv/alertas/` (registrada em `cds.requires`) consumida pelo intent 010 para resolução de e-mails de notificações, tratamento de inativos/não encontrados e garantia de zero replicação de pessoas em repouso no banco (R2, R3, R10; CA4, CA5, CA21, CA22);
3. **Serviço `IntegracaoPessoasService`, consulta e busca de colaboradores:** superfície OData V4 em `srv/integracao-pessoas-service.cds` expondo `consultarColaborador` e `buscarColaboradores` com ordenação alfabética determinística por nome (desempate por matrícula) e paginação por fatia, atributos mínimos funcionais sob LGPD, validação de formato de matrícula, imutabilidade dos dados de abertura da Tratativa, recusa 403 para `AplicativoOrigem` e 401 para requisições anônimas, e sinalização de colaboradores desligados sem reatribuição automática (R1, R2, R4, R5, R7, R9, R11, R14; CA1-CA3, CA6-CA8, CA12, CA15-CA18, CA20, CA23, CA24, CA26);
4. **Estrutura organizacional, resiliência graciosa e precedência D10 estendida:** operação `listarEstruturaOrganizacional` com contrato hierárquico explícito de Unidades com Áreas ativas aninhadas, bloqueio 403 para `AplicativoOrigem` e 401 para anônimos, comportamento degradado com timeout de 5s e retorno HTTP 503 com `target: integracao` diante de falha externa sem cache, continuidade operacional de atribuições e delegações via validação puramente sintática de matrículas, e consolidação da matriz de erros da Decisão D10 diferenciando functions e actions (R8, R9, R11, R12; CA13, CA14, CA19, CA20, CA23, CA25).

---

## Arquivos
- `package.json`
- `db/tratativa.cds`
- `srv/integracao-pessoas-service.cds`
- `srv/integracao-pessoas-service.ts`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/administracao-service.cds`
- `srv/administracao-service.ts`
- `srv/integracoes/portas-sf.ts`
- `srv/integracoes/provedor-pessoas-adapter.ts`
- `srv/integracoes/provedor-estrutura-adapter.ts`
- `srv/integracoes/parametros-sf.ts`
- `srv/integracoes/cache-pessoas.ts`
- `srv/alertas/diretorio-pessoas-adapter.ts`
- `test/apoio/pessoas-espiao.ts`
- `test/apoio/estrutura-espiao.ts`
- `test/apoio/integracao-pessoas.ts`
- `test/sf-parametros-governanca.test.ts`
- `test/sf-diretorio-alertas-cache.test.ts`
- `test/sf-consulta-colaboradores.test.ts`
- `test/sf-estrutura-resiliencia-d10.test.ts`

---

## Interfaces

- **Produz:**
  - Configuração em `package.json`: inclusão de bindings de `cds.requires` para `ProvedorPessoasAdapter`, `ProvedorEstruturaAdapter` e `DiretorioPessoasAdapter` com perfil de testes apontando para `test/apoio/` e implementações locais.
  - Entidade persistida em `db/tratativa.cds`:
    * `ParametrosIntegracaoSF`: singleton com `nivelUnidadeSF` e `nivelAreaSF`.
  - Serviço público em `srv/integracao-pessoas-service.cds` (`/api/integracao-pessoas/v1`):
    * `function consultarColaborador(matricula : String) returns DetalheColaborador;`
    * `function buscarColaboradores(termo : String, codigoUnidade : String, codigoArea : String, apenasAtivos : Boolean, tamanhoPagina : Integer, pagina : Integer) returns many ItemColaborador;`
    * `function listarEstruturaOrganizacional() returns many ItemUnidadeEstrutura;`
  - Extensões públicas em serviços existentes:
    * Em `TratativaService`: `function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;` (Gestor e Administrador).
    * Em `AdministracaoService`: `function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;` e `action atualizarParametrosIntegracaoSF(...) returns DetalheParametrosIntegracaoSF;` (exclusivo Administrador).
  - Tipos públicos estruturados: `DetalheColaborador`, `ItemColaborador`, `ItemUnidadeEstrutura`, `ItemAreaEstrutura`, `DetalheParametrosIntegracaoSF`.
  - Módulos em `srv/integracoes/`:
    * `portas-sf.ts`: interfaces tipadas para consumo do provedor de pessoas e estrutura.
    * `provedor-pessoas-adapter.ts` e `provedor-estrutura-adapter.ts`: adaptadores de serviço CAP.
    * `parametros-sf.ts`: inicialização e consulta programática do singleton de parâmetros organizacionais.
    * `cache-pessoas.ts`: gerenciador de cache volátil em memória com TTL de 15 minutos.
  - Implementação da porta em `srv/alertas/`:
    * `diretorio-pessoas-adapter.ts`: adaptador consumido pelo serviço de alertas (010 R6) resolvendo e-mails corporativos via provedor/cache.
  - Helpers de teste em `test/apoio/`:
    * `pessoas-espiao.ts` e `estrutura-espiao.ts`: dublês em memória configurados via `cds.requires` com injeção de falhas (sem asserções).
    * `integracao-pessoas.ts`: utilitários de invocação OData às operações de integração e acesso a portas (sem asserções).
  - Quatro novas suítes de teste de integração baseadas em Jest e `cds.test`.

- **Consome:**
  - Entidades persistidas: `Tratativas`, `Acoes`, `HistoricoTratativa`, `HistoricoAcoes`.
  - Módulos existentes:
    * `srv/tratativa/recusa.ts`: função `recusar` para lançamento de erros padronizados com status e `target`.
    * `srv/tratativa/consulta.ts`: função `codigoValido` para validação de identificadores.
  - Helpers de teste em `test/apoio/`:
    * `usuarios.ts` (`comoAdmin`, `comoGestor`, `comoUsuario`, `comoApp`, `semAuth`).
    * `tratativas.ts` (`criarAvulsa`, `abrirPorApp`).
    * `acoes.ts` (`criarAcao`, `delegarAcao`).
    * `responsaveis.ts` (`atribuirResponsavelPrincipal`).
    * `banco.ts` (`linhas`).

---

## Regras para todas as etapas

- **Commits sequenciais por etapa:** cada etapa é composta estritamente por um commit `test(red): <etapa> …` (contendo exclusivamente arquivos em `test/` e, se necessário, este arquivo de task) seguido por um commit `feat(green): <etapa> …` (contendo a implementação correspondente).
- **Arquivo de teste novo por RED:** cada etapa RED introduz exatamente UM novo arquivo de teste (`test/*.test.ts`) que falha estritamente no commit RED.
- **Proibição de alteração em testes anteriores:** nunca alterar, relaxar ou desabilitar testes criados em commits anteriores.
- **Helpers de teste sem asserções:** nenhum helper em `test/apoio/` pode conter chamadas a `expect(`. Todas as asserções pertencem aos arquivos de teste.
- **Testes não importam `srv/`:** a execução dos testes interage com a aplicação exclusivamente via chamadas OData HTTP (`cds.test().get(...)` ou `.post(...)`), consultas diretas à base de dados via helper `linhas(...)` ou portas/adaptadores internos registrados em `cds.requires` via `cds.connect.to(...)` com dublês em `test/apoio/`. Nenhum arquivo de teste importa diretamente módulos de `srv/`.
- **Preservação de contratos existentes:** o tipo `DetalheTratativa` permanece com exatamente 12 chaves, e os entity sets existentes de `AdministracaoService` e `TratativaService` mantêm suas restrições e comportamento originais.
- **Zero replicação de pessoas em repouso:** nenhuma tabela física relacional de colaboradores é persistida no banco de dados (`db/`).
- **Verificação obrigatória:** executar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## Itens N3 (aguardam aprovação no Gate 1)

- N3-1 (design): Inclusão da entidade `ParametrosIntegracaoSF` em `db/tratativa.cds` sem replicação física de cadastro de colaboradores no banco de dados (minimização LGPD; R2, R3, R6).
- N3-2 (design): Criação de `IntegracaoPessoasService` e expansão de `AdministracaoService` e `TratativaService` com grants somados diretamente no CDS e recusa estática de `AplicativoOrigem` com HTTP 403 no início do handler no `before('*')` (R6, R9, R11).
- N3-3 (design): Configuração formal em `package.json` (`cds.requires`) das portas desacopladas `ProvedorPessoasAdapter`, `ProvedorEstruturaAdapter` e `DiretorioPessoasAdapter` com dublês em memória em `test/apoio/`, garantindo que os testes nunca dependam de instâncias reais do SF ou rede externa (AGENTS.md:38, R1, R13).
- N3-4 (design): Implementação de cache volátil em memória (TTL 15 min) e conexão da porta `DiretorioPessoasAdapter` para resolução real de e-mails no serviço de notificações do intent 010 (R3, R10).
- N3-5 (design): Continuidade operacional de atribuições e delegações através de validação puramente sintática de matrículas (005 R3) mesmo diante de falha do SF, impedindo paralisação fabril (R8).
- N3-6 (design): Precedência consolidada de recusas baseada na Decisão D10 estendida com HTTP 503 (`target: integracao`), diferenciando functions e actions (R12).

---

## Etapas

### Etapa 1: Modelo de parametrização, governança e portas desacopladas
- **Critérios de aceite:** CA9, CA10, CA11, CA11a, CA20, CA23, CA24a.
- **Itens N3:** N3-1, N3-2, N3-3, N3-6.
- **Descrição:**
  1. Adicionar a entidade singleton `ParametrosIntegracaoSF` em `db/tratativa.cds` com os campos `nivelUnidadeSF` e `nivelAreaSF`.
  2. Implementar a inicialização programática do singleton em `srv/integracoes/parametros-sf.ts` com os valores padrão `'BusinessUnit'` e `'Department'` caso o registro não exista, sem criação de arquivos CSV em `db/data/`.
  3. Declarar as portas `ProvedorPessoasPort` e `ProvedorEstruturaPort` em `srv/integracoes/portas-sf.ts` e suas implementações base em `srv/integracoes/provedor-pessoas-adapter.ts` e `srv/integracoes/provedor-estrutura-adapter.ts`.
  4. Configurar as portas em `package.json` (`cds.requires`) e implementar os dublês em memória `test/apoio/pessoas-espiao.ts` e `test/apoio/estrutura-espiao.ts` (sem asserções).
  5. Expandir `TratativaService` (em `srv/tratativa-service.cds` e `srv/tratativa-service.ts`) e `AdministracaoService` (em `srv/administracao-service.cds` e `srv/administracao-service.ts`) declarando a function `consultarParametrosIntegracaoSF` e a action `atualizarParametrosIntegracaoSF` com seus respectivos `@restrict`, somando grants sem sobrescrever permissões existentes.
  6. Implementar a validação de papel e recusa estática de `AplicativoOrigem` com HTTP 403 no início do handler no `before('*')`, e as validações de limites D10 em `atualizarParametrosIntegracaoSF` (campos obrigatórios, não vazios após trim e até 100 caracteres com target).
- **Arquivo de teste novo:** `test/sf-parametros-governanca.test.ts`.

---

### Etapa 2: Porta de diretório de pessoas, cache em memória e integração com alertas
- **Critérios de aceite:** CA4, CA5, CA21, CA22.
- **Itens N3:** N3-1, N3-3, N3-4.
- **Descrição:**
  1. Implementar o gerenciador de cache volátil em memória `srv/integracoes/cache-pessoas.ts` com TTL de 15 minutos (900.000 ms), armazenando dados de colaboradores consultados do provedor.
  2. Implementar e registrar em `package.json` (`cds.requires`) a porta `DiretorioPessoasAdapter` em `srv/alertas/diretorio-pessoas-adapter.ts` para consultar o cache / `ProvedorPessoasAdapter`. Nos testes, acionamento via `cds.connect.to('DiretorioPessoasAdapter')` ou helper em `test/apoio/integracao-pessoas.ts`, sem importar `srv/`:
     - Colaborador ativo encontrado: devolve `{ email: colab.email, teamsId: colab.email }`;
     - Colaborador inativo ou inexistente: devolve `null` (não resolvido), permitindo ao serviço de alertas (010 R6) marcar `statusEnvio = Falha` em `AlertasEmitidos` sem abortar o lote;
     - Segunda chamada dentro do TTL: devolve diretamente do cache em memória sem invocar o provedor externo.
  3. Garantir que nenhuma tabela relacional de dados de pessoas é criada ou persistida em repouso no banco de dados (`db/`).
- **Arquivo de teste novo:** `test/sf-diretorio-alertas-cache.test.ts`.

---

### Etapa 3: Serviço `IntegracaoPessoasService`, consulta e busca de colaboradores
- **Critérios de aceite:** CA1, CA2, CA3, CA6, CA7, CA8, CA12, CA15, CA16, CA17, CA18, CA20, CA23, CA24, CA26.
- **Itens N3:** N3-2, N3-6.
- **Descrição:**
  1. Declarar o serviço `IntegracaoPessoasService` em `srv/integracao-pessoas-service.cds` (`@path: '/api/integracao-pessoas/v1'`) com `@requires: 'authenticated-user'`.
  2. Implementar as functions `consultarColaborador` e `buscarColaboradores` em `srv/integracao-pessoas-service.ts`:
     - Recusa imediata de `AplicativoOrigem` com HTTP 403 (`Acesso negado.`) no hook `before('*')` (CA20) e recusa de anônimos com HTTP 401 (CA23);
     - `consultarColaborador`: valida matrícula na etapa 4 (não vazia, sem espaços, sem @; 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`), consulta provedor/cache; inexistente retorna 404 `Colaborador não encontrado.`; retorna estritamente os atributos mínimos funcionais;
     - `buscarColaboradores`: aplica filtros (`termo` até 100 caracteres, `codigoUnidade`, `codigoArea`, `apenasAtivos`), valida paginação (`tamanhoPagina` de 1 a 200, `pagina` >= 1), e aplica ordenação determinística alfabética ascendente por `nome` (A-Z) com desempate por `matricula` ascendente;
     - Vedação de atributos sensíveis (salário, CPF, avaliações) no payload de retorno;
     - Garantir que a identidade do usuário logado via token Launchpad/XSUAA é preservada sem consulta síncrona ao SF no login (005 R4);
     - Garantir que dados de abertura (`Unidade`, `Área`, `Solicitante`) permanecem imutáveis na Tratativa e prevalecem sobre dados do SF;
     - Garantir que colaboradores desligados (`situacao = 'Inativo'`) mantêm tratativas e ações previamente vinculadas intactas sem reatribuição automática.
- **Arquivo de teste novo:** `test/sf-consulta-colaboradores.test.ts`.

---

### Etapa 4: Estrutura organizacional, resiliência graciosa e precedência D10 estendida
- **Critérios de aceite:** CA13, CA14, CA19, CA20, CA23, CA25.
- **Itens N3:** N3-2, N3-5, N3-6.
- **Descrição:**
  1. Implementar a function `listarEstruturaOrganizacional` em `IntegracaoPessoasService`:
     - Recusa imediata de `AplicativoOrigem` com HTTP 403 (`Acesso negado.`) no hook `before('*')` (CA20) e recusa de anônimos com HTTP 401 (CA23);
     - Consulta `ProvedorEstruturaAdapter` utilizando os níveis vigentes de `ParametrosIntegracaoSF`;
     - Retorna coleção estruturada hierárquica `many ItemUnidadeEstrutura` com `codigoUnidade`, `nomeUnidade` e `areas: [{ codigoArea, nomeArea }]`;
     - Ordenação determinística das Unidades por `nomeUnidade` ASC (desempate por `codigoUnidade` ASC) e das Áreas aninhadas por `nomeArea` ASC (desempate por `codigoArea` ASC).
  2. Implementar a resiliência a falhas com degradação graciosa:
     - Configurar timeout padrão de 5 segundos nas chamadas aos adaptadores;
     - Diante de falha de rede/timeout sem cache prévio, as consultas retornam HTTP 503 com a mensagem `Serviço de pessoas temporariamente indisponível. Tente novamente mais tarde.` e `target: integracao`;
     - Comprovar que atribuições de responsáveis e delegações de ações operam normalmente com validação puramente sintática de matrículas mesmo com o SF fora do ar.
  3. Validar a cadeia completa de precedência de recusas da Decisão D10 estendida com HTTP 503.
- **Arquivo de teste novo:** `test/sf-estrutura-resiliencia-d10.test.ts`.

---

## Critérios de pronto

1. Todos os 28 Critérios de Aceite (CA1 a CA26, incluindo CA11a e CA24a) implementados e cobertos pelas 4 suítes de teste de integração.
2. Cada etapa possui seu par sequencial de commits `test(red):` e `feat(green):`, com exatamente um novo arquivo de teste por etapa RED.
3. Nenhum teste de commits anteriores quebrado, relaxado ou alterado.
4. Helpers de teste em `test/apoio/` livres de asserções (`expect(`).
5. Nenhum arquivo de teste importa código da camada `srv/`.
6. Preservação estrita dos contratos anteriores: `consultarTratativa` permanece com 12 chaves e `AdministracaoService` mantém o comportamento de `PrazosCriticidade`, `CredenciaisAplicativo` e parâmetros de alertas.
7. Zero persistência física de cadastro de colaboradores no banco de dados (`db/`).
8. Verificação limpa e completa de `sh agentic/mecanismos/scripts/verify.sh` reportando sucesso nos testes, lint, build e arquitetura.
