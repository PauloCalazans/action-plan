# lib-agentic.sh — configuração e funções comuns aos hooks e scripts do framework.
# Carregar com ". lib-agentic.sh". Lê <raiz>/.agentic/config sobre os padrões abaixo.
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
GITLEAKS_BIN="gitleaks"

if [ -f "$agentic_raiz/.agentic/config" ]; then
  . "$agentic_raiz/.agentic/config"
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

# agentic_base: ponto de divergência entre HEAD e a branch principal.
agentic_base() {
  git merge-base HEAD "$BRANCH_PRINCIPAL" 2>/dev/null
}
