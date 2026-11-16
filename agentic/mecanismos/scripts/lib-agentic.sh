# lib-agentic.sh — configuração e funções comuns aos hooks e scripts do framework.
# Carregar com ". lib-agentic.sh". Lê <raiz>/agentic/config sobre os padrões abaixo.
agentic_raiz=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "agentic: BLOQUEADO — fora de um repositório git" >&2
  exit 1
}

BRANCH_PRINCIPAL="main"
BRANCHES_PROTEGIDAS="main master"
DIRS_TESTE="tests/ test/"
MARCADOR_DESABILITADO=""
MARCADOR_ASSERCAO="assert|expect"
RELATORIO_TESTES=""
CMD_PREPARAR_TESTE=""
CMD_TESTE=""
CMD_TESTE_ARQUIVO=""
CMD_VERIFY_STACK=""
CMD_VERIFY_RAPIDO=""
CMD_VALIDA_CONTRATO=""
CAMINHOS_N3=""
GITLEAKS_BIN="gitleaks"

if [ -f "$agentic_raiz/agentic/config" ]; then
  . "$agentic_raiz/agentic/config"
fi

# agentic_branch_protegida <branch>: retorna 0 se a branch está em BRANCHES_PROTEGIDAS.
agentic_branch_protegida() {
  for agentic_b in $BRANCHES_PROTEGIDAS; do
    [ "$1" = "$agentic_b" ] && return 0
  done
  return 1
}

# agentic_falha <mensagem>: bloqueia com mensagem padronizada.
agentic_falha() {
  printf 'agentic: BLOQUEADO — %s\n' "$*" >&2
  exit 1
}

# agentic_base_task: imprime a ref da **Base:** da task da branch atual (branch empilhada) enquanto ela
# não estiver integrada na principal; senão, nada (quem chama cai para a principal). Nunca falha.
# Com $1 (caminho de uma task), usa essa task em vez de procurar pela branch.
agentic_base_task() {
  agentic_t=${1:-}
  if [ -z "$agentic_t" ]; then
    agentic_br=$(git symbolic-ref --short -q HEAD)
    [ -n "$agentic_br" ] || return 0
    agentic_t=$(grep -l "^\*\*Branch:\*\*[[:space:]]*$agentic_br[[:space:]]*$" agentic/projeto/specs/*/tasks/*.md 2>/dev/null | head -n 1)
  fi
  [ -n "$agentic_t" ] || return 0
  agentic_bt=$(sed -n 's/^\*\*Base:\*\*[[:space:]]*//p' "$agentic_t" | head -n 1 | tr -d '\r`' | sed 's/[[:space:]]*$//')
  [ -n "$agentic_bt" ] || return 0
  for agentic_c in "$agentic_bt" "origin/$agentic_bt"; do
    if git rev-parse --verify -q "$agentic_c^{commit}" >/dev/null; then
      agentic_pr=$(agentic_principal_ref)
      if [ -n "$agentic_pr" ] && git merge-base --is-ancestor "$agentic_c" "$agentic_pr"; then
        return 0
      fi
      printf '%s\n' "$agentic_c"
      return 0
    fi
  done
  return 0
}

# agentic_base: ponto de divergência entre HEAD e a base de comparação. Ordem: AGENTIC_BASE, a **Base:**
# da task (branch empilhada ainda não integrada) e a principal (local ou, em clone de CI, origin/).
agentic_base() {
  agentic_ref=${AGENTIC_BASE:-}
  [ -n "$agentic_ref" ] || agentic_ref=$(agentic_base_task)
  if [ -n "$agentic_ref" ]; then
    git merge-base HEAD "$agentic_ref" 2>/dev/null
    return
  fi
  git merge-base HEAD "$BRANCH_PRINCIPAL" 2>/dev/null || git merge-base HEAD "origin/$BRANCH_PRINCIPAL" 2>/dev/null
}

# agentic_principal_ref: a branch principal local ou, sem ela, a remota. Vazio se nenhuma existir.
agentic_principal_ref() {
  for agentic_p in "$BRANCH_PRINCIPAL" "origin/$BRANCH_PRINCIPAL"; do
    git rev-parse --verify -q "$agentic_p^{commit}" >/dev/null && { printf '%s\n' "$agentic_p"; return 0; }
  done
  return 1
}
