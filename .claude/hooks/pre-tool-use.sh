#!/bin/sh
# pre-tool-use.sh — hook PreToolUse (Bash) MÍNIMO de propósito: bloqueia varredura de disco a partir
# da raiz, do home ou de um drive, e o desvio dos githooks. Proteções de git vivem nos agentic/mecanismos/githooks
# (valem para qualquer autor); interpretar texto de comando para reproduzi-las é uma corrida que não se ganha.
# O que os githooks não conseguem impedir é ser pulados: o deny do settings casa por prefixo e deixa passar
# "git push origin main --no-verify". Por isso, e só por isso, num comando que chama git o hook barra, por PALAVRA e
# não por análise de opções: "--no-v" (--no-verify e as abreviações que o git aceita), "hookspath", "config-env"
# e "GIT_CONFIG_" em qualquer ponto do campo "command", inclusive entre aspas; e um token -…n… no mesmo trecho
# (entre ; & | e quebra de linha) de um "git [opções globais] commit".
# Limite declarado, preferido à corrida: mensagem que cite essas palavras (ou " -n " na linha do commit) é
# barrada — reescreva a mensagem; comando montado em tempo de execução escapa.
entrada=$(cat)
bruto=$(printf '%s' "$entrada" | sed -nE 's/.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' | head -n 1 \
  | awk '{ gsub(/\\\\/, "\001"); gsub(/\\n/, "\n"); gsub(/\\t/, " "); gsub(/\\"/, "\""); gsub(/\001/, "\\"); print }')
# Continuação de linha (\ + quebra) junta o comando; git.exe conta como git.
bruto=$(printf '%s\n' "$bruto" | awk '{ if (sub(/\\$/, "")) { printf "%s ", $0 } else print }')
if printf '%s' "$bruto" | grep -qiE '(^|[^[:alnum:]_.-])git(\.exe)?([^[:alnum:]_.-]|$)'; then
  # Sem aspas (os caracteres, não o conteúdo) e um trecho de comando por linha.
  trechos=$(printf '%s\n' "$bruto" | tr -d "\"'" | tr ';&|' '\n\n\n')
  # Palavras procuradas sem aspas nem barra invertida: o shell junta --n""o-verify e --\no-verify.
  if printf '%s' "$bruto" | tr -d "\"'\\\\" | grep -qiE -- '--no-v|hookspath|config-env|GIT_CONFIG_' \
    || printf '%s\n' "$trechos" | grep -iE '(^|[^[:alnum:]_.-])git(\.exe)?([[:space:]]+((-C|-c|--git-dir|--work-tree|--namespace)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+commit([[:space:]]|$)' \
       | grep -qE '[[:space:]]-[A-Za-z]*n[A-Za-z]*([[:space:]]|$)'; then
    echo "agentic: BLOQUEADO — comando git que pula ou troca os githooks (--no-verify, commit -n, core.hooksPath, --config-env, GIT_CONFIG_). Os githooks são a proteção da branch protegida e dos segredos. Se for só texto de mensagem, reescreva-a sem essas palavras." >&2
    exit 2
  fi
fi
padrao='(^|[;&|[:space:]"])(find|du|tree|ls[[:space:]]+-[A-Za-z]*R[A-Za-z]*|grep[[:space:]]+-[A-Za-z]*[rR][A-Za-z]*)([[:space:]]+[^;&|"[:space:]]+)*[[:space:]]+(/|~|[A-Za-z]:(/|\\\\)?)([[:space:]";&|]|$)'
if printf '%s' "$entrada" | grep -qE "$padrao"; then
  echo "agentic: BLOQUEADO — varredura de disco a partir da raiz/home/drive. Restrinja a busca ao repositório ou a um caminho específico." >&2
  exit 2
fi
exit 0
