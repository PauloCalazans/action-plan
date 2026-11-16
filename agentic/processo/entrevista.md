# Bootstrap: entrevista e instanciação

Você está instanciando o framework de SDLC agêntico neste projeto. **Você nunca escreve código de produto neste processo.** Ao final, o projeto terá agentes e controles específicos do seu contexto.

## Modo de respostas pré-gravadas
Se existir `agentic/projeto/bootstrap-respostas.md`, use-o como respostas da entrevista: não faça perguntas, só confirme no final o que foi inferido além dele.

## Passo 0 — Pré-condições
1. O repositório tem ao menos um commit? Se não, peça ao humano: `git commit --allow-empty -m "inicial" --no-verify` (ação humana; o agente não usa `--no-verify`).
2. Crie a branch `agentic/bootstrap` (a branch principal é protegida pelos githooks).
3. Leia `agentic/.estado/conflitos-instalacao.txt`, se existir: são arquivos do projeto que o instalador não sobrescreveu.

## Passo 1 — Leitura do projeto (projeto existente)
Antes de perguntar, leia o repositório (manifestos de dependência, configuração de build/teste, estrutura de pastas, CI, README) e prepare respostas propostas marcadas `inferido`. Pergunte só o que não conseguiu inferir; peça confirmação do que inferiu.

## Passo 2 — Entrevista
Pergunte um bloco por vez; prefira múltipla escolha com uma recomendação.

| Bloco | Perguntas |
|---|---|
| Contexto | O que é o produto? Quem usa? Qual o domínio? Projeto novo ou existente? Restrições regulatórias ou de legado? |
| Stack | Linguagens e frameworks? Gerenciador de pacotes? Comandos de instalar, build, lint, testes e verificação de arquitetura? Qual comando roda um único arquivo/classe de teste, recebendo o caminho do arquivo (`CMD_TESTE_ARQUIVO`, com `{}` no lugar do caminho; ex.: `npx jest {}`, `python -m pytest {}`; Java: wrapper que converte caminho em classe, ou vazio — opcional, vazio = RED provado pela suíte inteira)? Como a stack marca teste desabilitado? Os testes geram relatório JUnit XML (onde)? O que precisa rodar num checkout limpo antes dos testes? Qual o comando rápido do laço: lint e testes tocados (`CMD_VERIFY_RAPIDO`, opcional, vazio = o `verify.sh --rapido` usa o `CMD_VERIFY_STACK`)? Qual comando valida o contrato executável (esqueleto compila, arquitetura respeitada; `CMD_VALIDA_CONTRATO`, opcional, vazio = checagem pulada com aviso)? Quais caminhos (globs separados por espaço) são gatilho N3 (`CAMINHOS_N3`, opcional, vazio = checagem pulada com aviso)? |
| Estrutura | Camadas/módulos e suas fronteiras? Diretórios de teste? Que ferramenta verifica fronteiras (ex.: ArchUnit, dependency-cruiser, import-linter)? |
| Risco | Caminhos protegidos? Gatilhos de escalonamento específicos da stack/domínio? Dependências sensíveis? |
| Fontes externas | Há sistema legado, API externa ou norma que os agentes devem consultar? Onde está e como se acessa (somente leitura)? |
| Operação | Branch principal? Plataforma de PR (GitHub, GitLab, Azure…)? Existe CI? Quem aprova o Gate 1 e o Gate 2? Modo automático começa ligado? O humano delega o Gate 1 ao orquestrador (com que plano, para quais specs, com quais itens N3)? |
| Time | Os papéis rodam num só produto ou num orquestrador externo com vários produtos? Quais produtos e modelos estão disponíveis, com que cota ou licença? Algum é o GitHub Copilot? |

## Passo 3 — Registro
Grave `agentic/projeto/bootstrap.md` com todas as respostas, cada uma marcada `confirmado` (humano respondeu/confirmou) ou `inferido`. Re-execuções do `/bootstrap` partem deste arquivo. Depois que as proteções estão ativas, alterações em `agentic/config`, `agentic/auto-mode`, `agentic/baseline-skips`, `agentic/mecanismos/githooks/**`, `.claude/hooks/**`, `agentic/mecanismos/scripts/**` e `.gitleaksignore` (inclusive em re-execuções do /bootstrap e nos merges do Passo 5) são ação humana: proponha o conteúdo e peça ao humano que aplique.

## Passo 4 — Instanciação
1. `agentic/config`: substitua todos os `{{...}}` (valores vazios são permitidos onde o comentário diz "degradado", "Opcional", "Vazio = …" ou "Vazio se …"). Se a stack exigir combinar etapas, `CMD_VERIFY_STACK` pode encadear comandos com `&&`.
2. `AGENTS.md`: preencha todos os `{{...}}`. Em `{{PLATAFORMA_PR}}` escreva o nome da plataforma (GitHub, GitLab, Azure…) ou `nenhuma` (integração local por fast-forward). Em `{{REGRAS_INVIOLAVEIS}}` e `{{GATILHOS_N3_STACK}}` use listas Markdown; sem itens, escreva `- Nenhum além dos genéricos.`
3. Perfis dos papéis: preencha `agentic/projeto/papeis/{dominio,arquiteto,testes,dev,revisor}.md` (o instalador os criou de `agentic/processo/templates/perfil-papel.md`). Cada perfil é **específico daquele papel**: especialização, comandos que ele usa, padrões da stack relevantes para o trabalho dele, proibições do projeto. Os contratos em `agentic/processo/papeis/` são do kit e não se editam: o perfil acrescenta regras, nunca revoga. A persona também não vai para `.claude/agents/` nem `.github/agents/`, que continuam ponteiros finos (veja `docs/portabilidade.md` do kit).
   - Curto: meta de 30 a 40 linhas. Árvore de pastas, convenções de teste detalhadas e outros textos longos ficam num doc do projeto, citado em "Leia sob demanda".
   - Todo caminho citado entre crases precisa existir: o `checa-instancia.sh` confere.
   - Perfil do `arquiteto` (e o do `revisor`, em "Padrões"): diga qual é o **stub da stack** do contrato executável (ex.: `throw new UnsupportedOperationException("GREEN da task NNN")`, `raise NotImplementedError("GREEN da task NNN")`) e quais corpos triviais o projeto aceita. Evite texto que convide a implementar ("entrega o código pronto", "assinatura + invariante"): no contrato, invariante vai documentada, não implementada.
   - Padrão de stack que já falhou duas vezes sai do perfil e vira checagem no `CMD_VERIFY_STACK` (princípio 2): por exemplo, um grep que falha quando o código traz condicional de regra de negócio fixa, ou um lint que falha com texto de interface fora do i18n. Proponha o comando ao humano (o `agentic/config` é ação humana) e registre em `decisoes.md`.
   - **Instância antiga** (contratos com `## Contexto da stack` ou reescritos à mão): o reinstalador lista os contratos em `conflitos-instalacao.txt` e guarda a versão do kit em `agentic/.estado/kit-conflitos/`. Para cada papel: (a) mova para o perfil todo conteúdo que é do projeto; (b) restaure o contrato do kit; (c) confira por diff que nenhuma regra sumiu: cada linha removida do contrato antigo (`git diff` do contrato) está no contrato do kit ou no perfil, e cada caminho citado existe. Mostre ao humano o mapa "regra antiga → onde ficou" antes do commit. Regra do kit que a reescrita tinha perdido volta com o contrato restaurado; aponte-a ao humano.
4. Para cada fonte externa: copie `agentic/processo/papeis/_oraculo.md` para `agentic/processo/papeis/oraculo-<nome>.md` e `agentic/processo/templates/agente-oraculo.md` para `.claude/agents/oraculo-<nome>.md` (com o Copilot instalado, também `agentic/processo/templates/agente-oraculo-copilot.md` para `.github/agents/oraculo-<nome>.agent.md`), preenchendo `{{NOME_ORACULO}}`, `{{FONTE_ORACULO}}`, `{{ACESSO_ORACULO}}`. Liste-os em `{{ORACULOS}}` do `AGENTS.md` (sem oráculos: `- Nenhum.`).
5. `agentic/projeto/decisoes.md` a partir de `agentic/processo/templates/decisoes.md`, com `D1 — Stack e comandos de verificação` (Verificado por: `verify.sh`) e uma decisão por ferramenta de arquitetura com o mecanismo de baseline dela.
6. Ajuste `agentic/.estado/settings.pendente.json`: acrescente ao `permissions.allow` os comandos `CMD_*` da stack (ex.: `"Bash(npm test:*)"`), e, se a plataforma de PR não for GitHub, troque `gh pr create`/`gh pr view`/`gh pr merge` pelos equivalentes. As regras de deny de merge nunca são removidas: se a plataforma for outra ou não houver plataforma de PR, ACRESCENTE os equivalentes (ex.: `Bash(git merge:*)` para integração local) e mantenha `Bash(gh pr merge:*)`.
7. Se o projeto tem CI: gere o workflow da plataforma chamando `git config core.hooksPath agentic/mecanismos/githooks` e depois `sh agentic/mecanismos/scripts/verify.sh`, e registre em `agentic/projeto/decisoes.md` que ele só vale depois de **provado verde num PR de teste**.
8. Time: com orquestrador externo ou mais de um produto, monte a proposta pela seção "Orquestrador externo ou mais de um produto" de `agentic/processo/modelos.md` e grave em `decisoes.md` a composição que o humano escolher. Com um só produto, confira o `model:` de `.claude/agents/*.md` contra a tabela de níveis do mesmo arquivo. Se o GitHub Copilot faz parte do time e `.github/copilot-instructions.md` não existe, peça ao humano que rode `sh <kit>/bootstrap/instalar.sh . --copilot` e complete o passo da stack em `.github/workflows/copilot-setup-steps.yml`.

9. Gate 1 delegado: se o humano delegar, grave em `agentic/projeto/decisoes.md` a decisão `D<n> — Delegação do Gate 1` pelo modelo comentado do template (plano em `agentic/projeto/planos/`, escopo, itens N3) e proponha ao humano `enabled: true` e `gate1: D<n>` em `agentic/auto-mode` (ação humana). Sem delegação, `gate1:` fica vazio.

## Passo 5 — Conflitos
O instalador grava `agentic/processo/.kit-manifesto` (sha256 de cada arquivo do kit instalado). Numa reinstalação, arquivo do kit intacto desde a instalação anterior recebe a versão nova sem merge; só o que foi editado na instância vira conflito.

Para cada arquivo em `agentic/.estado/conflitos-instalacao.txt`, compare a versão do projeto com a do kit, que o instalador guardou em `agentic/.estado/kit-conflitos/<mesmo caminho>` (para `.claude/settings.json`, o guardado é o template de settings do kit), mostre a diferença ao humano e proponha um merge. Aplique só o que o humano aprovar.

Projeto existente com mecanismos EQUIVALENTES aos do kit (flag própria de auto-mode, script próprio de status, registro próprio de decisões, verify próprio): não mantenha duas fontes da verdade. Proponha consolidar em uma só (a do kit ou a do projeto) e deixe o humano decidir; registre a decisão em `agentic/projeto/decisoes.md`.

Ao terminar, apague `agentic/.estado/conflitos-instalacao.txt` e o diretório `agentic/.estado/kit-conflitos/`.

## Passo 6 — Baseline (projeto existente)
1. Rode os testes; se o relatório já mostra testes pulados, grave a contagem em `agentic/baseline-skips` e registre em `agentic/projeto/decisoes.md`.
2. Rode a ferramenta de arquitetura; se houver violações atuais, configure o baseline dela (mecanismo próprio da ferramenta) e registre.

## Passo 7 — Verificação
Rode `sh agentic/mecanismos/scripts/verify.sh`. Deve terminar com `VERIFY: OK`; se não, registre o motivo em `agentic/projeto/bootstrap.md` (seção "Pendências") — não esconda.

## Passo 8 — Entrega
1. Stageie tudo e marque os hooks e scripts como executáveis no índice:
   `git add -A && git add --chmod=+x agentic/mecanismos/githooks/pre-commit agentic/mecanismos/githooks/pre-merge-commit agentic/mecanismos/githooks/pre-push agentic/mecanismos/scripts/*.sh .claude/hooks/*.sh`
   Confira com `git ls-files -s agentic/mecanismos/githooks` (modo `100755`) e faça o commit `chore: instancia o framework de SDLC agêntico` na branch `agentic/bootstrap`.
2. Peça ao humano, nesta ordem (ações humanas — permissões são do humano):
   - ainda na branch `agentic/bootstrap`, ativar as proteções: `sh agentic/mecanismos/scripts/ativar-protecoes.sh`;
   - commitar o settings na mesma branch: `git add .claude/settings.json && git commit -m 'chore: ativa proteções do agente'`;
   - só então integrar a branch (`git merge --ff-only agentic/bootstrap` na principal, ou via PR);
   - reiniciar a sessão e abrir o Claude Code interativamente no projeto uma vez, aceitando o diálogo de confiança do workspace.
3. Rode a checagem estrutural se o framework estiver acessível: `sh <framework>/bootstrap/checa-instancia.sh .`
4. Sugira o primeiro intent: `/intent <ideia>`.

Observação: as suítes `*.Tests.sh` e o `testlib.sh` dos mecanismos não são copiados para o projeto; elas rodam no repositório do framework (`sh scripts/verify.sh` de lá).
