#!/bin/sh
# ativar-protecoes.sh — AÇÃO HUMANA: instala agentic/.estado/settings.pendente.json como .claude/settings.json.
# Permissões do agente pertencem ao humano (princípio 5); por isso o agente não faz este passo.
. "$(dirname "$0")/lib-agentic.sh"
cd "$agentic_raiz" || exit 1
[ -f agentic/.estado/settings.pendente.json ] || { echo "Não há agentic/.estado/settings.pendente.json (rode bootstrap/instalar.sh)."; exit 1; }
if [ -f .claude/settings.json ]; then
  echo "Já existe .claude/settings.json — não sobrescrito."
  echo "Faça o merge manual de agentic/.estado/settings.pendente.json (permissions.deny, hooks, enabledPlugins) e rode de novo depois de remover o pendente."
  exit 1
fi
mkdir -p .claude
cp agentic/.estado/settings.pendente.json .claude/settings.json
echo "Proteções ativadas em .claude/settings.json."
echo "Commite agora (ação humana): git add .claude/settings.json && git commit -m 'chore: ativa proteções do agente'"
echo "Depois integre a branch, reinicie a sessão e abra o Claude Code interativamente neste projeto uma vez, aceitando o diálogo de confiança do workspace (sem isso as regras permissions.allow são ignoradas e o modo auto trava em prompts)."
