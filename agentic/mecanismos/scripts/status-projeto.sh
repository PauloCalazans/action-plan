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
echo "### Branch principal (remota conforme o último fetch)"
remota="origin/$BRANCH_PRINCIPAL"
tem_remota=""; git rev-parse --verify -q "$remota^{commit}" >/dev/null 2>&1 && tem_remota=1
if ! git rev-parse --verify -q "$BRANCH_PRINCIPAL^{commit}" >/dev/null 2>&1; then
  echo "- (branch principal '$BRANCH_PRINCIPAL' ainda não existe)"
elif [ -z "$tem_remota" ]; then
  echo "- $BRANCH_PRINCIPAL: sem $remota"
else
  atras=$(git rev-list --count "$BRANCH_PRINCIPAL..$remota" 2>/dev/null || echo "?")
  frente=$(git rev-list --count "$remota..$BRANCH_PRINCIPAL" 2>/dev/null || echo "?")
  if [ "$atras" = "0" ] && [ "$frente" = "0" ]; then
    echo "- $BRANCH_PRINCIPAL: em dia com $remota"
  else
    [ "$atras" = "0" ] || echo "- $BRANCH_PRINCIPAL: $atras commit(s) atrás de $remota — atualize: git merge --ff-only $remota"
    [ "$frente" = "0" ] || echo "- $BRANCH_PRINCIPAL: $frente commit(s) à frente de $remota"
  fi
fi

echo
echo "### Branches à frente de $BRANCH_PRINCIPAL"
if git rev-parse --verify -q "$BRANCH_PRINCIPAL^{commit}" >/dev/null 2>&1; then
  # Conta o que não está nem na principal local nem na remota: branch integrada no remoto com a principal local
  # atrasada não aparece à frente. Upstream [gone] = remota apagada (em geral depois do merge do PR).
  git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads | while read -r b trilha; do
    [ "$b" = "$BRANCH_PRINCIPAL" ] && continue
    n=$(git rev-list --count "$b" --not "$BRANCH_PRINCIPAL" ${tem_remota:+"$remota"} 2>/dev/null || echo "?")
    if [ "$n" = "0" ]; then
      if [ -n "$tem_remota" ] && [ "$(git rev-list --count "$BRANCH_PRINCIPAL..$b" 2>/dev/null)" != "0" ]; then
        echo "- $b: integrada em $remota — atualize a principal e apague com git branch -d $b"
      fi
    elif [ "$trilha" = "[gone]" ]; then
      echo "- $b: $n commit(s) — remota apagada"
    else
      echo "- $b: $n commit(s)"
    fi
  done
else
  echo "- (branch principal '$BRANCH_PRINCIPAL' ainda não existe)"
fi

echo
echo "### Artefatos"
find agentic/projeto/intent agentic/projeto/specs -name '*.md' ! -name '_*' 2>/dev/null | sort | while read -r f; do
  s=$(grep -m1 '^\*\*Status:\*\*' "$f" | sed 's/^\*\*Status:\*\*[[:space:]]*//')
  # integrada não é um Status escrito (ciclo.md, "Status dos artefatos"): deriva do git. Task publicada cuja versão
  # na principal (local ou, desatualizada ou ausente, a remota) também está publicada foi integrada — o commit
  # docs(task): … publicada é feito na branch da task e só chega à principal pelo merge.
  case "$s" in
    publicada*)
      for p in "$BRANCH_PRINCIPAL" "origin/$BRANCH_PRINCIPAL"; do
        case "$(git show "$p:$f" 2>/dev/null | grep -m1 '^\*\*Status:\*\*')" in
          "**Status:** publicada"*) s="integrada (derivado do git) — $s"; break ;;
        esac
      done
      ;;
    pendente*)
      # em-andamento não é escrito (ciclo.md, "Status dos artefatos"): pendente com branch própria à frente da
      # principal está em andamento. Sem branch, branch inexistente ou ainda sem commit à frente: continua pendente.
      # Só conta commit além do registro do Gate 1 (docs(…): … aprovada (Gate 1)). Task empilhada (**Base:** com
      # branch existente) conta a partir da branch-base, não da principal.
      br=$(grep -m1 '^\*\*Branch:\*\*' "$f" | tr -d '\r`' | sed 's/^\*\*Branch:\*\*[[:space:]]*//; s/[[:space:]]*$//')
      base=$(grep -m1 '^\*\*Base:\*\*' "$f" | tr -d '\r`' | sed 's/^\*\*Base:\*\*[[:space:]]*//; s/[[:space:]]*$//')
      if [ -n "$br" ] && git rev-parse --verify -q "$br^{commit}" >/dev/null 2>&1; then
        if [ -n "$base" ] && git rev-parse --verify -q "$base^{commit}" >/dev/null 2>&1; then
          cmp_com="$base"
        else
          cmp_com="$BRANCH_PRINCIPAL origin/$BRANCH_PRINCIPAL"
        fi
        for p in $cmp_com; do
          git rev-parse --verify -q "$p^{commit}" >/dev/null 2>&1 || continue
          n=$(git log --format=%s "$p..$br" 2>/dev/null | grep -vc 'aprovada (Gate 1')
          [ "${n:-0}" -gt 0 ] 2>/dev/null && s="em-andamento (derivado do git)"
          break
        done
      fi
      ;;
  esac
  [ -n "$s" ] && echo "- $f: $s"
done

echo
modo="desligado"
grep -q '^enabled:[[:space:]]*true' agentic/auto-mode 2>/dev/null && modo="ligado"
echo "Modo automático: $modo"
gate1=$(sed -n 's/^gate1:[[:space:]]*//p' agentic/auto-mode 2>/dev/null | head -n 1 | tr -d '\r' | sed 's/[[:space:]]*$//')
if [ "$modo" = "ligado" ] && [ -n "$gate1" ]; then
  echo "Gate 1: delegado ao orquestrador ($gate1)"
else
  echo "Gate 1: humano"
fi
exit 0
