---
description: Mostra o estado derivado do projeto (branches, worktrees, artefatos, modo automático).
---
Rode `sh agentic/mecanismos/scripts/status-projeto.sh` e apresente o resultado. Se houver task `em-andamento` (escrita ou `derivado do git`), aponte o próximo passo segundo `agentic/processo/ciclo.md`. A remota é a do último fetch (o script não acessa a rede): se a principal estiver atrás, ofereça `git fetch` e `git merge --ff-only origin/<principal>`; branch `integrada em origin/…` sai com `git branch -d` depois disso (nunca `-D`).
