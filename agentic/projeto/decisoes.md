# Registro de decisões

Cada decisão vale para o projeto inteiro até ser revogada. Nunca apague uma decisão: mova-a para "Decisões revogadas" com a data e o motivo.

## Vigentes

### D1 — Stack e comandos de verificação
- **Decisão:** Backend SAP CAP em Node.js + TypeScript (cds-typer), HANA Cloud em produção, testes com jest + `cds.test` em SQLite em memória, relatório JUnit via jest-junit em `reports/junit/`. Comandos expostos como scripts npm: `build` (cds-typer + `tsc --noEmit` + `cds build`), `lint` (ESLint + `@sap/eslint-plugin-cds`), `test` (jest), `arch` (dependency-cruiser). `CMD_VERIFY_STACK = npm run build && npm run lint && npm test && npm run arch`.
- **Por quê:** stack padrão SAP para BTP; TypeScript dá tipos do modelo CDS aos handlers; SQLite em memória torna os testes rápidos e independentes de HANA.
- **Consequência:** a primeira task (scaffold, trilha rápida) cria `package.json` com esses scripts; até lá o `verify.sh` falha (pendência registrada em `agentic/projeto/bootstrap.md`). Recursos exclusivos de HANA exigem nova decisão.
- **Verificado por:** `verify.sh`
- **Data:** 2026-10-06

### D2 — Fronteiras de arquitetura com dependency-cruiser
- **Decisão:** `npm run arch` roda `depcruise` com `.dependency-cruiser.cjs`: `app/` não importa `srv/`; `db/` não depende de `srv/` nem `app/`; SDKs/clients externos (SuccessFactors, e-mail, Teams) só em `srv/integracoes/`.
- **Por quê:** manter o núcleo genérico (Origem/Tratativa) isolado das integrações e da UI.
- **Consequência:** baseline pelo mecanismo da ferramenta (`depcruise --output-type baseline > .dependency-cruiser-known-violations.json`); projeto novo, baseline vazio — não criar sem decisão.
- **Verificado por:** `verify.sh` (via `npm run arch`)
- **Data:** 2026-10-06

### D3 — PRs no GitHub, sem CI por enquanto
- **Decisão:** PRs criados com `gh pr create`; merge sempre humano (Gate 2), sem squash. Não há CI: a verificação é o `verify.sh` local + githooks.
- **Por quê:** escolha do mantenedor para o início do projeto.
- **Consequência:** ao adotar CI, o workflow chama `sh agentic/mecanismos/scripts/verify.sh` e só passa a valer depois de provado verde num PR de teste (nova decisão).
- **Verificado por:** por revisão
- **Data:** 2026-10-06

### D4 — Frontend Fiori elements no repositório
- **Decisão:** a UI é Fiori elements/UI5 em `app/<app>/`, dirigida por anotações CDS, publicada no SAP Build Work Zone. SAP Build Apps (citado na proposta) fica fora deste repositório.
- **Por quê:** UI versionada e testável junto com o serviço; menos acoplamento a ferramenta low-code.
- **Consequência:** consumidores externos (Build Apps, Power BI/SAC) usam o OData do CAP; mudanças nesse contrato são N3.
- **Verificado por:** por revisão
- **Data:** 2026-10-06

### D5 — Gates e modo automático
- **Decisão:** Gate 1 e Gate 2 aprovados por Paulo Calazans; `agentic/auto-mode` começa com `enabled: false`.
- **Por quê:** acompanhar as primeiras tasks antes de liberar o encadeamento automático.
- **Consequência:** ligar o modo automático é ação humana e ganha uma nova decisão.
- **Verificado por:** por revisão
- **Data:** 2026-10-06

### D6 — Contratos de integração versionados
- **Decisão:** vale só para serviços cujo consumidor é um sistema de terceiros (hoje, `IntegracaoOrigemService`): caminho `/api/<serviço>/v<n>`, só actions/functions com tipos de retorno explícitos, sem entity sets; mudança incompatível cria `v<n+1>`. Serviços consumidos pela UI própria ou pela administração (`TratativaService`, `AdministracaoService`) usam o mesmo padrão de caminho por consistência, mas não ficam presos a "sem entity sets"; mudanças neles continuam N3 pela D4.
- **Por quê:** terceiros dependem de um contrato estável e mínimo; a UI própria precisa evoluir com liberdade.
- **Consequência:** mudança incompatível em serviço de terceiros exige nova versão do caminho.
- **Verificado por:** por revisão
- **Data:** 2026-10-07

### D7 — Autorização de aplicativos externos
- **Decisão:** papel `AplicativoOrigem` + registro `CredenciaisAplicativo` verificado a cada pedido; revogação pela plataforma.
- **Por quê:** a decisão "esta credencial vale" fica na plataforma, revogável sem redeploy e testável em SQLite.
- **Consequência:** emissão e revogação são feitas pelo Administrador em `AdministracaoService`.
- **Verificado por:** testes da spec abertura-por-apps-de-origem (`test/administracao.test.ts` e os da task de credenciais)
- **Data:** 2026-10-07

### D8 — Handlers TypeScript
- **Decisão:** handlers em `srv/<serviço>.ts` com `CDS_TYPESCRIPT=true` nos testes; empacotamento de produção (compilação para `gen/srv`) é decisão pendente da task de deploy.
- **Por quê:** o CAP só carrega `.ts` sob jest com essa variável (medido no CAP 10.1.1).
- **Consequência:** a task de deploy decide como compilar os handlers para produção.
- **Verificado por:** `npm test`
- **Data:** 2026-10-07

### D9 — Serialização por agregado
- **Decisão:** toda operação que lê uma Tratativa para decidir e depois escreve sobre ela (e, nos intents seguintes, sobre Ações e Responsáveis dela) começa com `bloquearTratativa(codigo)` (`srv/tratativa/bloqueio.ts`: `SELECT ... FOR UPDATE` sem `.one` e sem `LIMIT`) na transação do pedido, e bloqueia a Tratativa antes de qualquer outra linha; nenhuma decisão usa leitura anterior ao bloqueio.
- **Por quê:** no HANA o isolamento padrão é READ COMMITTED; sem bloqueio, dois pedidos simultâneos leem o mesmo estado e ambos gravam (dois Encerramentos, Criticidade e Data prevista de pedidos diferentes). Bloquear sempre a Tratativa primeiro evita ciclo de bloqueios entre operações.
- **Consequência:** 004 e 005 bloqueiam a Tratativa antes de tocar Ações ou Responsáveis; o SQLite dos testes não emite `FOR UPDATE` (o pool de 1 conexão já serializa), então a prova automatizada é estrutural e o comportamento no HANA é conferido no primeiro deploy (intent 014).
- **Verificado por:** espião `cds.db.before` (`test/apoio/banco-espiao.ts`, `bloqueiaAntesDeEscrever`) nos testes das etapas 1, 3 e 4 da task tratativa/001 (CA45, CA46, CA72); medição do renderizador SQL genérico registrada no design da spec tratativa (decisão 6)
- **Data:** 2026-10-07

### D10 — Contrato de recusas dos serviços de usuário
- **Decisão:** nos serviços consumidos por usuários (hoje, `TratativaService`), a recusa segue esta precedência e estes códigos: 401 autenticação, 403 papel (inclui identidade `AplicativoOrigem`), 400 forma do pedido recusada pelo runtime (campo fora da assinatura, valor de tipo errado), 404 Tratativa inexistente, **409 estado** (transição não permitida, Tratativa que não pode ser alterada), 400 campo inválido com `target` = parâmetro. Ressalva (R31): para o aplicativo de origem nas functions do serviço de usuários, o 400 de forma pode vir antes do 403 de papel, porque o runtime valida os parâmetros antes do `before('*')` que recusa o aplicativo (ex.: `tamanhoPagina='abc'` → 400).
- **Por quê:** R31 da spec tratativa fixa a ordem papel → existência → estado → campos; 409 separa "o pedido é válido mas o estado atual não permite" de "o dado está errado" (400), e a forma do pedido é verificada pelo runtime CAP antes do handler.
- **Consequência:** 004 e 005 reutilizam os códigos, as mensagens de estado do 003 e o `recusar(status, message, target)` de `srv/tratativa/recusa.ts`; validação de tamanho fica no domínio, depois do estado (parâmetros `String` sem tamanho nas actions).
- **Verificado por:** CA73 (etapa 1), CA29 (etapa 3), CA30 (etapa 4) e os casos de R31 das etapas 1, 3 e 4 da task tratativa/001 (papel antes de estado, estado antes de campo); contrato de erros do design da spec tratativa
- **Data:** 2026-10-07

### D11 — Delegação do Gate 1 ao orquestrador e composição do time
- **Decisão:** Paulo Calazans delega o **Gate 1** ao orquestrador (`agentic/auto-mode` passa a `enabled: true`). O orquestrador aprova intent, spec, design e os itens N3 previstos, cria branch e worktree e encadeia tasks e PRs sem pedir confirmação. O **Gate 2 (merge) continua exclusivamente humano**: o agente nunca faz merge. O orquestrador é a sessão Claude Code (Opus 5.5) no canvas Maestri. Composição dos papéis:

  | Papel | Agente | Modelo |
  |---|---|---|
  | `dominio` (Lyra) | Antigravity | Gemini 3.8 Flash, esforço medium |
  | `arquiteto` (Vigia) | Antigravity | Gemini 3.8 Flash, esforço medium |
  | `testes` (Sonda) | Kiro CLI | DeepSeek 3.2 |
  | `dev` (Forja) | Kiro CLI | Claude Sonnet 4.5 |
  | `revisor` (Revisor) | Antigravity | Gemini 3.8 Flash, esforço high |

  Os scripts determinísticos (`verify.sh`, `verifica-red.sh`, git) rodam no terminal Shell. `testes`, `dev` e `revisor` começam cada nova task com o contexto limpo.
- **Por quê:** as primeiras tasks (002, 003) passaram pelo Gate 1 humano; Paulo acompanhou e optou por delegar o Gate 1 para acelerar o encadeamento, mantendo o controle no merge. A delegação existia só na memória da sessão e nos `progress.md`; esta decisão a torna persistente. A composição equilibra custo e qualidade por decisão do humano.
- **Consequência:** o orquestrador registra uma Ruling no `progress.md` a cada decisão não prevista. Com o revisor num modelo Flash, o orquestrador trata veredito APROVADO com ceticismo e confere no Shell o que for determinístico (verify, escopo, RED) antes do Gate 1 e do PR. Reverter a delegação (`enabled: false`) ou mudar a composição é ação humana e gera nova decisão.
- **Verificado por:** por revisão; estado em `agentic/auto-mode`, nos `progress.md` das frentes e no `maestri list` do canvas.
- **Data:** 2026-10-08
- **Histórico:** entre ~22:40 e a retomada de 2026-10-08, a orquestração ficou temporariamente com uma sessão Kiro, que montou a fila de revisões (`agentic/.estado/execucao/2026-10-08-fila-despacho-revisoes.md`); a composição acima substitui a dessa transição.

## Decisões revogadas

<nenhuma>
