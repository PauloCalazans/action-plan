---
description: Inicia a Fase 0 — captura uma ideia, ticket ou incidente como intent.md.
---
Despache o subagente `dominio` para conduzir a entrevista de intenção com o humano sobre: $ARGUMENTS

Ele deve usar `docs/agentic/templates/intent.md` e gravar `intent/NNN-<nome>.md` com `**Status:** draft` (NNN = próximo número livre em `intent/`). Ao final, mostre o caminho e pergunte se o humano aprova o intent para seguir à especificação (`docs/agentic/ciclo.md`).
