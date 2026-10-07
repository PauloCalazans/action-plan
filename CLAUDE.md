# CLAUDE.md

Leia `AGENTS.md` — é a fonte de verdade para qualquer agente neste repositório.

Específico do Claude Code:
- Papéis em `.claude/agents/` são adaptadores finos de `agentic/processo/papeis/`; a regra vive no contrato, não aqui.
- Comandos: `/intent`, `/nova-task`, `/verify`, `/status`, `/bootstrap`.
- O estado do projeto é injetado no início da sessão por `agentic/mecanismos/scripts/status-projeto.sh`; não o reescreva aqui.
- Plugins de processo (por exemplo, superpowers) ficam desligados: o processo deste projeto é `agentic/processo/ciclo.md`.
