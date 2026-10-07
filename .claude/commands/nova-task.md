---
description: Inicia a execução de uma task aprovada no Gate 1 (RED → GREEN → revisão → PR).
---
Task: $ARGUMENTS

Trilha enxuta: o /mudanca já criou a branch, o worktree e o commit docs(mudanca): — pule os passos 1 e 2 e continue no worktree existente.

1. Trilha padrão: confira que o commit `docs(spec): <nome> aprovada (Gate 1)` existe, na branch da task ou já integrado na principal (`git log --grep` na branch/principal), e que spec e design estão com `**Status:** aprovado` nele; `**Status:**` só na árvore de trabalho não basta. Se o documento tem `**Trilha:** enxuta`, confira em vez disso que o commit `docs(mudanca):` existe na branch (registro do Gate 1). Se não, pare e diga o que falta.
2. Leia o `**Branch:**` da task e crie o worktree dentro do repositório: `git worktree add .agentic/worktrees/<nome> -b <branch>`, com `<nome>` = branch com `/` trocado por `-`.
3. Marque a task `**Status:** em-andamento` e crie `.agentic/execucao/<AAAA-MM-DD>-<nome>/progress.md` com a task, o SHA base e o próximo passo.
4. Conduza as fases 3 a 6 de `docs/agentic/ciclo.md` como orquestrador: despache `testes`, depois `dev`, depois `revisor` (modo `diff`), sempre com caminhos absolutos do worktree no brief. Registre brief, relatório e Rulings no diretório de execução.
5. Se `AGENTS.md` declara que não há plataforma de PR (`Plataforma de PR: nenhuma`): não faça push nem PR — rebase a branch na principal e avise o humano para integrar com `git merge --ff-only <branch>`. Caso contrário: se `.agentic/auto-mode` contém `enabled: true`, publique o PR sem pedir confirmação; senão, pergunte antes do push. Nunca faça merge.
6. Depois que o humano integrar (Gate 2), rode `git worktree remove .agentic/worktrees/<nome>` e `git branch -d <branch>` (só `-d`, nunca `-D`). Não edite o Status: `integrada` deriva do git. Se o `-d` recusar, atualize antes a principal local; nunca use `-D`.
