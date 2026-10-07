# Bootstrap: entrevista e instanciação

Você está instanciando o framework de SDLC agêntico neste projeto. **Você nunca escreve código de produto neste processo.** Ao final, o projeto terá agentes e controles específicos do seu contexto.

## Modo de respostas pré-gravadas
Se existir `docs/bootstrap-respostas.md`, use-o como respostas da entrevista: não faça perguntas, só confirme no final o que foi inferido além dele.

## Passo 0 — Pré-condições
1. O repositório tem ao menos um commit? Se não, peça ao humano: `git commit --allow-empty -m "inicial" --no-verify` (ação humana; o agente não usa `--no-verify`).
2. Crie a branch `agentic/bootstrap` (a branch principal é protegida pelos githooks).
3. Leia `.agentic/conflitos-instalacao.txt`, se existir: são arquivos do projeto que o instalador não sobrescreveu.

## Passo 1 — Leitura do projeto (projeto existente)
Antes de perguntar, leia o repositório (manifestos de dependência, configuração de build/teste, estrutura de pastas, CI, README) e prepare respostas propostas marcadas `inferido`. Pergunte só o que não conseguiu inferir; peça confirmação do que inferiu.

## Passo 2 — Entrevista
Pergunte um bloco por vez; prefira múltipla escolha com uma recomendação.

| Bloco | Perguntas |
|---|---|
| Contexto | O que é o produto? Quem usa? Qual o domínio? Projeto novo ou existente? Restrições regulatórias ou de legado? |
| Stack | Linguagens e frameworks? Gerenciador de pacotes? Comandos de instalar, build, lint, testes e verificação de arquitetura? Qual comando roda um único arquivo/classe de teste, recebendo o caminho do arquivo (`CMD_TESTE_ARQUIVO`, com `{}` no lugar do caminho; ex.: `npx jest {}`, `python -m pytest {}`; Java: wrapper que converte caminho em classe, ou vazio — opcional, vazio = RED provado pela suíte inteira)? Como a stack marca teste desabilitado? Os testes geram relatório JUnit XML (onde)? O que precisa rodar num checkout limpo antes dos testes? |
| Estrutura | Camadas/módulos e suas fronteiras? Diretórios de teste? Que ferramenta verifica fronteiras (ex.: ArchUnit, dependency-cruiser, import-linter)? |
| Risco | Caminhos protegidos? Gatilhos de escalonamento específicos da stack/domínio? Dependências sensíveis? |
| Fontes externas | Há sistema legado, API externa ou norma que os agentes devem consultar? Onde está e como se acessa (somente leitura)? |
| Operação | Branch principal? Plataforma de PR (GitHub, GitLab, Azure…)? Existe CI? Quem aprova o Gate 1 e o Gate 2? Modo automático começa ligado? |

## Passo 3 — Registro
Grave `docs/bootstrap.md` com todas as respostas, cada uma marcada `confirmado` (humano respondeu/confirmou) ou `inferido`. Re-execuções do `/bootstrap` partem deste arquivo. Depois que as proteções estão ativas, alterações em `.agentic/config`, `.agentic/auto-mode`, `.agentic/baseline-skips`, `.githooks/**`, `.claude/hooks/**`, `scripts/agentic/**` e `.gitleaksignore` (inclusive em re-execuções do /bootstrap e nos merges do Passo 5) são ação humana: proponha o conteúdo e peça ao humano que aplique.

## Passo 4 — Instanciação
1. `.agentic/config`: substitua todos os `{{...}}` (valores vazios são permitidos onde o comentário diz "degradado"). Se a stack exigir combinar etapas, `CMD_VERIFY_STACK` pode encadear comandos com `&&`.
2. `AGENTS.md`: preencha todos os `{{...}}`. Em `{{PLATAFORMA_PR}}` escreva o nome da plataforma (GitHub, GitLab, Azure…) ou `nenhuma` (integração local por fast-forward). Em `{{REGRAS_INVIOLAVEIS}}` e `{{GATILHOS_N3_STACK}}` use listas Markdown; sem itens, escreva `- Nenhum além dos genéricos.`
3. `docs/agentic/papeis/{dominio,arquiteto,testes,dev,revisor}.md`: substitua `{{CONTEXTO_STACK}}` por um bloco **específico daquele papel**: comandos que ele usa, convenções da stack relevantes para o trabalho dele, ferramentas. Curto — o contrato já diz o que fazer.
4. Para cada fonte externa: copie `docs/agentic/papeis/_oraculo.md` para `docs/agentic/papeis/oraculo-<nome>.md` e `docs/agentic/templates/agente-oraculo.md` para `.claude/agents/oraculo-<nome>.md` (o template fica fora de `.claude/agents/` de propósito: lá o Claude Code o registraria como agente), preenchendo `{{NOME_ORACULO}}`, `{{FONTE_ORACULO}}`, `{{ACESSO_ORACULO}}`. Liste-os em `{{ORACULOS}}` do `AGENTS.md` (sem oráculos: `- Nenhum.`).
5. `docs/decisoes.md` a partir de `docs/agentic/templates/decisoes.md`, com `D1 — Stack e comandos de verificação` (Verificado por: `verify.sh`) e uma decisão por ferramenta de arquitetura com o mecanismo de baseline dela.
6. Ajuste `.agentic/settings.pendente.json`: acrescente ao `permissions.allow` os comandos `CMD_*` da stack (ex.: `"Bash(npm test:*)"`), e, se a plataforma de PR não for GitHub, troque `gh pr create`/`gh pr view`/`gh pr merge` pelos equivalentes. As regras de deny de merge nunca são removidas: se a plataforma for outra ou não houver plataforma de PR, ACRESCENTE os equivalentes (ex.: `Bash(git merge:*)` para integração local) e mantenha `Bash(gh pr merge:*)`.
7. Se o projeto tem CI: gere o workflow da plataforma chamando `sh scripts/agentic/verify.sh`, e registre em `docs/decisoes.md` que ele só vale depois de **provado verde num PR de teste**.

## Passo 5 — Conflitos
Para cada arquivo em `.agentic/conflitos-instalacao.txt`, compare a versão do projeto com a do kit, que o instalador guardou em `.agentic/kit-conflitos/<mesmo caminho>` (para `.claude/settings.json`, o guardado é o template de settings do kit), mostre a diferença ao humano e proponha um merge. Aplique só o que o humano aprovar.

Projeto existente com mecanismos EQUIVALENTES aos do kit (flag própria de auto-mode, script próprio de status, registro próprio de decisões, verify próprio): não mantenha duas fontes da verdade. Proponha consolidar em uma só (a do kit ou a do projeto) e deixe o humano decidir; registre a decisão em `docs/decisoes.md`.

Ao terminar, apague `.agentic/conflitos-instalacao.txt` e o diretório `.agentic/kit-conflitos/`.

## Passo 6 — Baseline (projeto existente)
1. Rode os testes; se o relatório já mostra testes pulados, grave a contagem em `.agentic/baseline-skips` e registre em `docs/decisoes.md`.
2. Rode a ferramenta de arquitetura; se houver violações atuais, configure o baseline dela (mecanismo próprio da ferramenta) e registre.

## Passo 7 — Verificação
Rode `sh scripts/agentic/verify.sh`. Deve terminar com `VERIFY: OK`; se não, registre o motivo em `docs/bootstrap.md` (seção "Pendências") — não esconda.

## Passo 8 — Entrega
1. Stageie tudo e marque os hooks e scripts como executáveis no índice (no Windows o bit não vem do disco; sem ele, num clone Unix o git ignora os hooks em silêncio):
   `git add -A && git add --chmod=+x .githooks/pre-commit .githooks/pre-merge-commit .githooks/pre-push scripts/agentic/*.sh .claude/hooks/*.sh`
   Confira com `git ls-files -s .githooks` (modo `100755`) e faça o commit `chore: instancia o framework de SDLC agêntico` na branch `agentic/bootstrap`.
2. Peça ao humano, nesta ordem (ações humanas — permissões são do humano):
   - ainda na branch `agentic/bootstrap`, ativar as proteções: `sh scripts/agentic/ativar-protecoes.sh`;
   - commitar o settings na mesma branch: `git add .claude/settings.json && git commit -m 'chore: ativa proteções do agente'`;
   - só então integrar a branch (`git merge --ff-only agentic/bootstrap` na principal, ou via PR);
   - reiniciar a sessão e abrir o Claude Code interativamente no projeto uma vez, aceitando o diálogo de confiança do workspace (senão as regras `allow` são ignoradas e o modo auto trava em prompts; os `deny` valem de qualquer forma).
3. Rode a checagem estrutural se o framework estiver acessível: `sh <framework>/bootstrap/checa-instancia.sh .`
4. Sugira o primeiro intent: `/intent <ideia>`.

Observação: as suítes `*.Tests.sh` e o `testlib.sh` dos mecanismos não são copiados para o projeto; elas rodam no repositório do framework (`sh scripts/verify.sh` de lá).
