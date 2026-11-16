---
description: Roda a verificação completa do projeto e reporta. Nunca conserta.
---
Rode `sh agentic/mecanismos/scripts/verify.sh $ARGUMENTS` e reporte a saída: etapas que passaram, etapas que falharam e as mensagens relevantes.

Não conserte nada neste comando — reportar é o trabalho. Aceita `--rapido` (nível do laço: stack rápida, sem `skip`); sem ele, é o completo. Nunca afirme sucesso sem ter visto `VERIFY: OK` (completo) ou `VERIFY RÁPIDO: OK` (`--rapido`) na saída.
