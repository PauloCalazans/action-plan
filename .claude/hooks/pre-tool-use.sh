#!/bin/sh
# pre-tool-use.sh — hook PreToolUse (Bash) MÍNIMO de propósito: bloqueia varredura de disco a partir
# da raiz, do home ou de um drive. Proteções de git vivem nos .githooks (valem para qualquer autor);
# interpretar texto de comando para isso é uma corrida que não se ganha.
entrada=$(cat)
padrao='(^|[;&|[:space:]"])(find|du|tree|ls[[:space:]]+-[A-Za-z]*R[A-Za-z]*|grep[[:space:]]+-[A-Za-z]*[rR][A-Za-z]*)([[:space:]]+[^;&|"[:space:]]+)*[[:space:]]+(/|~|[A-Za-z]:(/|\\\\)?)([[:space:]";&|]|$)'
if printf '%s' "$entrada" | grep -qE "$padrao"; then
  echo "agentic: BLOQUEADO — varredura de disco a partir da raiz/home/drive. Restrinja a busca ao repositório ou a um caminho específico." >&2
  exit 2
fi
exit 0
