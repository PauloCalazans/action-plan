---
description: Inicia a Fase 0 — captura uma ideia, ticket ou incidente como intent.md.
---
Pedido: $ARGUMENTS

Você é o orquestrador. Crie o registro de execução em `agentic/.estado/execucao/<AAAA-MM-DD>-<nome>/` e despache o `dominio` com um brief montado por `agentic/processo/templates/brief.md`, com o pedido acima. As perguntas que ele devolver no relatório, você faz ao humano nesta sessão e repassa as respostas, com a data, no brief seguinte (`agentic/processo/ciclo.md`, "Resposta do humano"); o `dominio` nunca conversa direto com o humano.

O `dominio` usa `agentic/processo/templates/intent.md` e grava `agentic/projeto/intent/NNN-<nome>.md` com `**Status:** draft` (NNN = próximo número livre em `agentic/projeto/intent/`). Ao final, mostre o caminho e pergunte se pode seguir à especificação; isso não aprova o intent, que é aprovado no Gate 1 junto com spec e design (`agentic/processo/ciclo.md`). Com o Gate 1 delegado (`agentic/auto-mode` com `enabled: true` e `gate1: D<n>`, intent coberto pela decisão), siga à especificação sem perguntar; a aprovação do intent acontece no Gate 1 delegado.
