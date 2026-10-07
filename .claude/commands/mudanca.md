---
description: Mudança pequena de comportamento pela trilha enxuta (um documento → Gate 1 → RED → GREEN → revisão → PR).
---
Mudança: $ARGUMENTS

1. Despache o `arquiteto` em modo enxuto (`agentic/processo/papeis/arquiteto.md`, seção "Modo enxuto") com a descrição acima. Se ele identificar gatilho N3 e recusar, pare e siga a trilha padrão (`/intent`).
2. Grave o documento em `agentic/projeto/specs/<nome>/tasks/001-<nome>.md` a partir de `agentic/processo/templates/mudanca.md`.
3. Mostre o documento ao humano e peça aprovação (Gate 1). Sem hipóteses: toda regra chega `confirmada` e "Questões em aberto" vazio. Sem aprovação explícita, pare. Não commite na principal (protegida): o documento fica no working tree até o passo 4.
4. Depois da aprovação, crie a branch e o worktree (`git worktree add agentic/.estado/worktrees/<nome> -b <branch>`), coloque o documento lá e commite-o como PRIMEIRO commit da branch: `docs(mudanca): <nome> aprovada (Gate 1)` — esse commit é o registro do Gate 1.
5. Prossiga como `/nova-task` (o commit `docs(mudanca):` substitui a checagem de spec e design; `em-andamento`, fases RED → GREEN → revisão → publicação, Gate 2, remoção do worktree), lembrando o `revisor` em modo `diff` de conferir a elegibilidade da trilha enxuta (critério em `agentic/processo/ciclo.md`). Classificação errada ou gatilho N3 novo: pare e promova à trilha padrão, registrando uma Ruling.
