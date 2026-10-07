# Ciclo de desenvolvimento agêntico

Leia antes de qualquer trabalho. Princípios: `docs/agentic/principios.md`. Papéis: `docs/agentic/papeis/`.

## Escolha a trilha

- **Trilha padrão** — funcionalidade nova ou qualquer mudança de comportamento observável.
- **Trilha enxuta** — mudança pequena de comportamento que cabe numa única task e não aciona nenhum gatilho N3 (contrato público, segurança/autenticação/autorização, migração destrutiva, dependência nova, caminho protegido, gatilhos da stack em `AGENTS.md`).
- **Trilha rápida** — `chore`, `docs`, ferramental, correção sem mudança de comportamento: branch → `verify` → PR → Gate 2.

Na dúvida, trilha padrão.

## Trilha padrão

| # | Fase | Papel | Artefato | Verificação |
|---|---|---|---|---|
| 0 | Intenção | humano + `dominio` | `intent/NNN-<nome>.md` | — |
| 1 | Especificação | `dominio` | `docs/specs/<nome>/spec.md` + questionário de decisão | `revisor` modo `spec` |
| 2 | Design | `arquiteto` | `design.md` + contrato executável + `tasks/NNN-<nome>.md` | `revisor` modo `design` |
| G1 | **Gate 1** | humano | aprova intent + spec + design; responde o questionário; aprova os itens N3 do design um a um | — |
| 3 | RED | `testes` | testes falhando, sem código de produção (o documento da task pode ser atualizado no mesmo commit); commit `test(red): …` | `verifica-red.sh` |
| 4 | GREEN + REFACTOR | `dev` | commits `feat(green): …` e `refactor: …` | `verify.sh` |
| 5 | Revisão | `revisor` modo `diff` | parecer com achados Crítico / Importante / Menor | — |
| 6 | Publicação | orquestrador | push + PR pelo template `docs/agentic/templates/pr.md` | — |
| G2 | **Gate 2** | humano | merge **sem squash** (preserva a evidência RED/GREEN) | merge negado ao agente |

- Achado **Crítico** ou **Importante** devolve o trabalho ao papel autor; a revisão roda de novo no diff corrigido.
- Achados **Menores** ficam registrados e são tratados na revisão final da branch, antes da publicação.
- **Gate 1 não aceita hipótese:** toda regra da spec chega ao Gate 1 com estado `confirmada`. O questionário de decisão existe para que o humano resolva todas as dúvidas de uma vez, antes da implementação.
- **Registro do Gate 1:** depois da aprovação humana, o orquestrador cria a branch e o worktree da primeira task, e o primeiro commit da branch é `docs(spec): <nome> aprovada (Gate 1)`, com intent, spec, design e tasks (`**Status:** aprovado` em intent, spec e design). A principal é protegida para todos, então o registro vive na branch, não nela. As tasks seguintes da mesma spec saem da principal depois que a primeira é integrada.
- **Gate 2 sem plataforma de PR:** o orquestrador deixa a branch rebaseada na principal; o humano integra com `git merge --ff-only <branch>` (fast-forward não cria commit de merge, não dispara hooks e preserva os commits RED/GREEN).

## Trilha enxuta

Mantém RED provado, revisor independente, escopo verificado e os dois gates humanos; troca intent + spec + design + task por **um documento** (`docs/agentic/templates/mudanca.md`, gravado em `docs/specs/<nome>/tasks/001-<nome>.md`, onde os scripts leem `**Branch:**` e `## Arquivos`).

`/mudanca <descrição>` → `arquiteto` em modo enxuto escreve o documento → **Gate 1** (o humano aprova o documento; nenhuma hipótese) → `testes` RED → `dev` GREEN/REFACTOR → `verify` → `revisor` modo `diff` (revisa o código **e** confere se a trilha enxuta cabia) → publicação → **Gate 2** → worktree removido.

- **Elegibilidade:** a mudança cabe numa única task e não aciona nenhum gatilho N3. Na dúvida, trilha padrão.
- **Registro do Gate 1:** o commit `docs(mudanca): <nome> aprovada (Gate 1)` com o documento, primeiro commit da branch (criada com o worktree depois da aprovação). Sem ele a branch não carrega o documento e o `verify` não verifica o escopo.
- **Promoção:** se surgir gatilho N3 ou o `revisor` julgar a classificação errada, pare; o trabalho sobe para a trilha padrão e o documento enxuto vira rascunho do intent. Registre uma Ruling.

## Escalonamento N3

Pare a execução e chame o humano — mesmo fora de um gate — quando a mudança envolver:
- contrato público (API, schema publicado, formato de arquivo consumido por terceiros);
- segurança, autenticação ou autorização;
- migração destrutiva de dados;
- dependência nova;
- caminho protegido;
- qualquer gatilho adicional listado em `AGENTS.md` (seção "Gatilhos de escalonamento").

**Itens N3 previstos no design:** o `arquiteto` lista em `design.md` ("Itens N3 (aprovação no Gate 1)") todo gatilho N3 já visível no desenho, e o humano aprova cada item explicitamente no Gate 1. A task cita em "N3 aprovados no Gate 1" os itens que usa. Item previsto no design e aprovado no Gate 1 não exige nova parada; só N3 novo (fora da lista) interrompe a execução.

`Verificado por:` revisão (o `revisor` em modo `design` confere que todo gatilho N3 visível está na lista; em modo `diff`, que toda mudança N3 do diff está em "N3 aprovados no Gate 1" da task). Nenhum mecanismo impede o agente de seguir sem escalar — esta é uma limitação declarada.

## Regras de fluxo

- **Isolamento:** um worktree por sessão/trilha, dentro do repositório: `git worktree add .agentic/worktrees/<nome> -b <branch>`, onde `<nome>` é a branch com `/` trocado por `-` (ex.: `pedidos/001-criar` → `.agentic/worktrees/pedidos-001-criar`). O diretório é ignorado pelo `.gitignore` e as regras `deny` valem nele (variantes `**/`). Nunca duas sessões no mesmo diretório. Subagentes recebem caminhos absolutos do worktree. Depois que o humano integrar (Gate 2), o orquestrador remove o worktree com `git worktree remove .agentic/worktrees/<nome>` e a branch com `git branch -d <branch>` (só `-d`, nunca `-D`). O estado `integrada` não é escrito: deriva do git (branch contida na principal / removida). Se o `-d` recusar, atualize antes a principal local — nunca `-D`.
- **Escopo:** cada task declara `## Arquivos`. `verify.sh` falha se a branch tocar arquivo fora da lista. Ampliar o escopo exige atualizar a lista num commit `docs(task): …` — visível na revisão e no Gate 2.
- **Divergência spec × código:** pare, registre em "Questões em aberto" da spec e corrija via commit `docs(spec): …` no mesmo PR.
- **Verificação:** `sh scripts/agentic/verify.sh` é o ponto único. Ninguém afirma sucesso sem ter visto a saída.
- **Commits:** `test(red):`, `feat(green):`, `refactor:`, `fix:`, `docs(spec):`, `docs(task):`, `chore:`. Um commit por passo do ciclo.
- **Status dos artefatos** (`**Status:**`, lido por `status-projeto.sh`): no Gate 1 o humano aprova e intent, spec e design passam de `draft` a `aprovado`; `/nova-task` põe a task em `em-andamento`; com a revisão aprovada, o orquestrador a põe em `em-revisão` e, ao publicar (fase 6), em `publicada`; `integrada` não é um Status escrito (ninguém commita na principal protegida): deriva do git — branch contida na principal ou removida.
- **Modo automático:** se `.agentic/auto-mode` contém `enabled: true`, o orquestrador encadeia tasks e publica PRs sem pedir confirmação. Nunca faz merge.

## Orquestração

O orquestrador é a sessão principal — não é um papel. Ele:
1. lê `status-projeto` (injetado no início da sessão) e escolhe a próxima task;
2. cria o worktree e o registro de execução em `.agentic/execucao/<AAAA-MM-DD>-<nome>/`:
   - `progress.md` — task atual, SHA base, próximo passo (permite retomar uma sessão interrompida);
   - `task-N-brief.md` — o que o papel recebe (task, contrato, caminhos absolutos, comandos);
   - `task-N-relatorio.md` — o que o papel devolveu (`FEITO` / `FEITO_COM_RESSALVAS` / `BLOQUEADO`) e o parecer do revisor;
3. despacha cada papel com o brief; nunca implementa ele mesmo;
4. registra uma **Ruling** em `progress.md` sempre que decide algo não previsto no plano (o quê, por quê, alternativa descartada);
5. escolhe o modelo por tipo de trabalho: forte para `arquiteto` e `revisor`; médio para `dominio`, `testes`, `dev`; leve quando o brief já contém o código completo (transcrição).

## Interfaces para versões futuras (não implementadas)

- **Incidente → intent:** um incidente gera `intent/NNN-<nome>.md` com `Origem: incidente <id>`.
- **Release:** um gate de release consome as evidências do PR (RED/GREEN, saída do `verify`, parecer do revisor).
