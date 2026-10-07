#!/bin/sh
# verify.sh [--task <task.md>] — ponto único de verificação do projeto. Só reporta; nunca conserta.
# Etapas: stack (CMD_VERIFY_STACK) → escopo → skip → red.
dir=$(cd "$(dirname "$0")" && pwd)
. "$dir/lib-agentic.sh"
cd "$agentic_raiz" || exit 1

task=""
[ "${1:-}" = "--task" ] && task=${2:-}
[ -n "$CMD_VERIFY_STACK" ] || agentic_falha "CMD_VERIFY_STACK não configurado em .agentic/config (rode /bootstrap)"

mkdir -p .agentic
lock=".agentic/verify.lock"
if ! mkdir "$lock" 2>/dev/null; then
  pid=$(cat "$lock/pid" 2>/dev/null)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "verify já em execução (pid $pid)"
    exit 3
  fi
  rm -rf "$lock"
  mkdir "$lock" || exit 3
fi
echo $$ > "$lock/pid"
trap 'rm -rf "$lock"' EXIT INT TERM

falhas=""
etapa() {
  nome=$1; shift
  echo; echo "== $nome"
  if "$@"; then echo "-- $nome: OK"; else echo "-- $nome: FALHOU"; falhas="$falhas $nome"; fi
}

etapa stack sh -c "$CMD_VERIFY_STACK"

if [ -z "$task" ]; then
  branch=$(git symbolic-ref --short -q HEAD)
  [ -n "$branch" ] && task=$(grep -l "^\*\*Branch:\*\*[[:space:]]*$branch[[:space:]]*$" docs/specs/*/tasks/*.md 2>/dev/null | head -n 1)
fi
if [ -n "$task" ]; then
  etapa escopo sh "$dir/verifica-escopo.sh" "$task"
else
  if [ -n "$(ls docs/specs/*/tasks/*.md 2>/dev/null | head -n 1)" ]; then
    echo; echo "aviso: nenhuma task com **Branch:** ${branch:-?} — escopo não verificado (trilha rápida?)"
  fi
  echo; echo "== escopo: nenhuma task associada à branch (trilha rápida) — pulado"
fi

etapa skip sh "$dir/verifica-skip.sh"
etapa red sh "$dir/verifica-red.sh"

echo
if [ -z "$falhas" ]; then
  echo "VERIFY: OK"
else
  echo "VERIFY: FALHOU em:$falhas"
  exit 1
fi
