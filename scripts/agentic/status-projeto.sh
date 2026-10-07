#!/bin/sh
# status-projeto.sh — estado do projeto DERIVADO do git e dos campos **Status:**.
# Nada aqui é escrito à mão. Executado no início de cada sessão (hook SessionStart).
. "$(dirname "$0")/lib-agentic.sh"
cd "$agentic_raiz" || exit 0

echo "## Estado do projeto (derivado — não edite à mão)"
echo "Branch atual: $(git symbolic-ref --short -q HEAD || echo '(detached)')"

echo
echo "### Worktrees"
git worktree list 2>/dev/null

echo
echo "### Branches à frente de $BRANCH_PRINCIPAL"
if git rev-parse --verify -q "$BRANCH_PRINCIPAL" >/dev/null; then
  git for-each-ref --format='%(refname:short)' refs/heads | while read -r b; do
    [ "$b" = "$BRANCH_PRINCIPAL" ] && continue
    n=$(git rev-list --count "$BRANCH_PRINCIPAL..$b" 2>/dev/null || echo "?")
    [ "$n" = "0" ] || echo "- $b: $n commit(s)"
  done
else
  echo "- (branch principal '$BRANCH_PRINCIPAL' ainda não existe)"
fi

echo
echo "### Artefatos"
find intent docs/specs -name '*.md' ! -name '_*' 2>/dev/null | sort | while read -r f; do
  s=$(grep -m1 '^\*\*Status:\*\*' "$f" | sed 's/^\*\*Status:\*\*[[:space:]]*//')
  [ -n "$s" ] && echo "- $f: $s"
done

echo
modo="desligado"
grep -q '^enabled:[[:space:]]*true' .agentic/auto-mode 2>/dev/null && modo="ligado"
echo "Modo automático: $modo"
exit 0
