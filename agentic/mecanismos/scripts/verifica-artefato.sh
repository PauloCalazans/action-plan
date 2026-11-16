#!/bin/sh
# verifica-artefato.sh <spec|design|mudanca> <caminho> — barreira mecânica antes do Gate 1 e do revisor.
#   spec    <dir da spec>            regras ↔ critérios de aceite, fontes
#   design  <dir da spec>            checagens 1–7 (CA ↔ task, caminhos, branch, aprovação, N3, símbolos de Produz, contrato)
#   mudanca <documento da mudança>   regras ↔ critérios, caminhos, branch, aprovação, N3, contrato
# Roda só antes do Gate 1; artefato aprovado antes desta versão do kit não é verificado.
# Saída 0 = OK, 1 = bloqueado (todas as falhas são listadas), 2 = uso errado.
. "$(dirname "$0")/lib-agentic.sh"
cd "$agentic_raiz" || exit 1
set -f  # globs de CAMINHOS_N3 e de ## Arquivos nunca são expandidos contra o disco

modo=${1:-}
alvo=${2:-}
uso() { echo "uso: verifica-artefato.sh <spec|design|mudanca> <dir da spec | documento da mudança>" >&2; exit 2; }
case "$modo" in
  spec|design) [ -d "$alvo" ] || uso ;;
  mudanca) [ -f "$alvo" ] || uso ;;
  *) uso ;;
esac
alvo=${alvo%/}

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT INT TERM
N=0

falha() { printf 'agentic: BLOQUEADO — %s\n' "$*"; N=$((N + 1)); }
aviso() { printf 'aviso: %s\n' "$*"; }

# limpo <arquivo>: sem \r e sem comentários <!-- … --> (inclusive de várias linhas).
limpo() {
  tr -d '\r' < "$1" | awk '{
    l = $0; out = ""
    while (l != "") {
      if (inc) { i = index(l, "-->"); if (i == 0) l = ""; else { l = substr(l, i + 3); inc = 0 } }
      else { i = index(l, "<!--"); if (i == 0) { out = out l; l = "" } else { out = out substr(l, 1, i - 1); l = substr(l, i + 4); inc = 1 } }
    }
    print out }'
}
# secao <arquivo> <título>: corpo depois de "## <título>" até o próximo "## ".
secao() {
  limpo "$1" | awk -v t="## $2" 'BEGIN { n = length(t) } substr($0, 1, n) == t { on = 1; next } /^## / { on = 0 } on'
}
# campo <arquivo> <nome>: valor de **<nome>:** sem crases.
campo() {
  limpo "$1" | sed -n "s/^\*\*$2:\*\*[[:space:]]*//p" | head -n 1 | sed 's/`//g;s/[[:space:]]*$//'
}
# entradas <arquivo>: caminhos/padrões de ## Arquivos.
entradas() {
  secao "$1" Arquivos | sed -n 's/^[[:space:]]*-[[:space:]]*`\{0,1\}\([^` ]*\)`\{0,1\}.*/\1/p'
}
# tabela <arquivo> <seção> <prefixo> <coluna awk>: "<1ª coluna>|<coluna>" das linhas cuja 1ª coluna começa com o prefixo.
tabela() {
  secao "$1" "$2" | awk -F'|' -v p="$3" -v c="$4" '
    function t(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    t($2) ~ "^" p { print t($2) "|" t($c) }'
}
# regras <arquivo>: "R1|fonte|estado" (colunas 4 e 5 do awk, com $1 vazio).
regras() {
  secao "$1" Regras | awk -F'|' '
    function t(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    t($2) ~ /^R[0-9]+$/ { print t($2) "|" t($4) "|" t($5) }'
}
# cas <arquivo>: ids em $T/cas.ids e pares "CAn Rm" em $T/cas.pares.
cas() {
  secao "$1" 'Critérios de aceite' | grep -E '^- CA[0-9]+ \(' > "$T/cas.linhas"
  sed 's/^- \(CA[0-9]*\) (.*/\1/' "$T/cas.linhas" > "$T/cas.ids"
  : > "$T/cas.pares"
  while IFS= read -r l; do
    id=$(printf '%s' "$l" | sed 's/^- \(CA[0-9]*\) (.*/\1/')
    printf '%s' "$l" | sed 's/^- CA[0-9]* (\([^)]*\)).*/\1/' | grep -oE 'R[0-9]+' | while IFS= read -r r; do
      printf '%s %s\n' "$id" "$r"
    done >> "$T/cas.pares"
  done < "$T/cas.linhas"
}
cita() { grep -qE "(^|[^A-Za-z0-9])$2([^0-9]|\$)" "$1"; }
lista_tasks() { find "$alvo/tasks" -maxdepth 1 -name '*.md' 2>/dev/null | sort; }

ck_regras_cas() {  # spec e mudanca
  doc=$1
  regras "$doc" > "$T/regras"
  cas "$doc"
  cut -d'|' -f1 "$T/regras" > "$T/regras.ids"
  while IFS='|' read -r id fonte estado; do
    [ -n "$id" ] || continue
    grep -q " $id\$" "$T/cas.pares" || falha "$id sem critério de aceite ($doc)"
    if [ "$modo" = spec ] && [ "$estado" = confirmada ]; then
      case "$fonte" in Q[0-9]*) falha "$id confirmada com fonte $fonte ($doc)" ;; esac
    fi
  done < "$T/regras"
  while IFS= read -r ca; do
    [ -n "$ca" ] || continue
    grep -q "^$ca " "$T/cas.pares" || falha "$ca sem regra ($doc)"
  done < "$T/cas.ids"
  while read -r ca r; do
    [ -n "$r" ] || continue
    grep -qx "$r" "$T/regras.ids" || falha "$ca cita $r inexistente ($doc)"
  done < "$T/cas.pares"
}

ck_cas_tasks() {  # 1 (design)
  cas "$alvo/spec.md"
  secao "$alvo/design.md" 'Como isso se prova' > "$T/prova"
  : > "$T/pronto"
  lista_tasks > "$T/tasks"
  while IFS= read -r tk; do
    [ -n "$tk" ] && secao "$tk" 'Critérios de pronto' >> "$T/pronto"
  done < "$T/tasks"
  while IFS= read -r ca; do
    [ -n "$ca" ] || continue
    cita "$T/pronto" "$ca" || falha "$ca sem task que o cubra (Critérios de pronto das tasks)"
    cita "$T/prova" "$ca" || falha "$ca fora de 'Como isso se prova' ($alvo/design.md)"
  done < "$T/cas.ids"
}

# existe_ou_criado <caminho> <arquivo de padrões>
existe_ou_criado() {
  [ -e "$1" ] && return 0
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    case "$1" in $p) return 0 ;; esac
  done < "$2"
  return 1
}
# cita_caminhos <arquivo> <seção> <arquivo de padrões>
cita_caminhos() {
  secao "$1" "$2" | grep -o '`[^`]*`' | sed 's/^`//;s/`$//' | while IFS= read -r c; do
    # rota (/api/...), chave ({id}) e <placeholder> não são caminhos do repositório
    case "$c" in "<"*|"/"*|*" "*|*"{"*|*"}"*) continue ;; */*) ;; *) continue ;; esac
    # tira ::teste, #âncora e :linha[-linha]
    printf '%s\n' "$c" | sed 's/::.*$//; s/#.*$//; s/:[0-9][0-9]*\(-[0-9][0-9]*\)\{0,1\}$//'
  done | sort -u > "$T/cit"
  while IFS= read -r c; do
    [ -n "$c" ] || continue
    existe_ou_criado "$c" "$3" || falha "caminho citado inexistente e fora de ## Arquivos: $c (em '$2' de $1)"
  done < "$T/cit"
}
ck_caminhos() {  # 2
  : > "$T/pad"
  if [ "$modo" = design ]; then
    lista_tasks > "$T/tasks"
    while IFS= read -r tk; do [ -n "$tk" ] && entradas "$tk" >> "$T/pad"; done < "$T/tasks"
    while IFS= read -r tk; do [ -n "$tk" ] && cita_caminhos "$tk" Arquivos "$T/pad"; done < "$T/tasks"
    for s in 'Como isso se prova' Impacto; do cita_caminhos "$alvo/design.md" "$s" "$T/pad"; done
  else
    entradas "$alvo" > "$T/pad"
    cita_caminhos "$alvo" Arquivos "$T/pad"
    for s in Impacto 'Contrato executável'; do cita_caminhos "$alvo" "$s" "$T/pad"; done
  fi
}

case "$CMD_VALIDA_CONTRATO" in "{{"*) CMD_VALIDA_CONTRATO="" ;; esac
case "$CAMINHOS_N3" in "{{"*) CAMINHOS_N3="" ;; esac
ramo=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
ck_branch() {  # 3
  if [ "$modo" = mudanca ]; then
    b=$(campo "$alvo" Branch)
    [ -n "$b" ] && [ "$b" = "$ramo" ] || falha "**Branch:** da mudança ('$b') difere da branch atual ('$ramo')"
    return
  fi
  nome=$(basename "$alvo")
  lista_tasks > "$T/tasks"
  : > "$T/branches"
  while IFS= read -r tk; do
    [ -n "$tk" ] || continue
    b=$(campo "$tk" Branch)
    printf '%s\n' "$b" | grep -qE "^$nome/[0-9]{3}-.+\$" || falha "**Branch:** '$b' de $tk fora do formato $nome/<NNN>-<nome>"
    ! grep -qxF -- "$b" "$T/branches" || falha "**Branch:** '$b' repetida em $tk"
    printf '%s\n' "$b" >> "$T/branches"
    case "$(basename "$tk")" in
      001-*) case "$ramo" in
        "$nome"/*) [ "$b" = "$ramo" ] || falha "**Branch:** da task 001 ('$b') difere da branch do worktree ('$ramo')" ;;
      esac ;;
    esac
  done < "$T/tasks"
}

ck_sem_aprovacao() {  # 4
  doc=$1
  st=$(campo "$doc" Status)
  case "$modo" in
    design) [ "$st" = draft ] || falha "**Status:** do design é '$st', não draft ($doc)" ;;
    *) case "$st" in *aprovad*) falha "**Status:** '$st' afirma aprovação antes do Gate 1 ($doc)" ;; esac ;;
  esac
  if [ "$modo" != spec ]; then
    tabela "$doc" 'Itens N3' 'N3-' 5 | while IFS='|' read -r id dec; do
      case "$dec" in ""|"<"*) ;; *) printf '%s\n' "$id" ;; esac
    done > "$T/dec"
    while IFS= read -r id; do
      falha "Decisão do humano preenchida em $id antes do Gate 1 ($doc)"
    done < "$T/dec"
  fi
  if [ "$modo" = mudanca ]; then
    for s in Rulings 'Questões em aberto'; do
      # linha só de <placeholders> (cópia antiga do template, com o exemplo R-1 vivo) conta como vazia
      secao "$doc" "$s" | grep -v '^[[:space:]]*$' | grep -vE '^[[:space:]]*-[[:space:]]*Nenhuma\.?[[:space:]]*$' | while IFS= read -r l; do
        resto=$(printf '%s' "$l" | sed 's/<[^>]*>//g; s/R-[0-9][0-9]*//g; s/por quê//g; s/descartado//g' | tr -d '[:space:][:punct:]—')
        { [ -z "$resto" ] && printf '%s' "$l" | grep -q '<[^>]*>'; } || printf '%s\n' "$l"
      done > "$T/sec"
      ! [ -s "$T/sec" ] || falha "'$s' não está vazia antes do Gate 1 ($doc)"
    done
    if secao "$doc" Questionário | grep -qE '^[[:space:]]*Resposta'; then
      falha "resposta escrita no Questionário fora de comentário ($doc): só o orquestrador a grava, no Gate 1"
    fi
  fi
}

# n3_casa <arquivo de entradas>: imprime a primeira entrada que casa com algum glob de CAMINHOS_N3.
n3_casa() {
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    for g in $CAMINHOS_N3; do
      case "$e" in $g) printf '%s\n' "$e"; return 0 ;; esac
    done
  done < "$1"
}
ck_n3_caminhos() {  # 5
  if [ -z "$CAMINHOS_N3" ]; then
    aviso "CAMINHOS_N3 não definido em agentic/config; checagem 5 pulada"
    return
  fi
  if [ "$modo" = mudanca ]; then
    entradas "$alvo" > "$T/ent"
    achou=$(n3_casa "$T/ent")
    if [ -n "$achou" ] && ! secao "$alvo" 'Itens N3' | grep -qE '^\|[[:space:]]*N3-'; then
      falha "$achou casa com CAMINHOS_N3 e a tabela de itens N3 não tem linha ($alvo)"
    fi
    return
  fi
  lista_tasks > "$T/tasks"
  while IFS= read -r tk; do
    [ -n "$tk" ] || continue
    entradas "$tk" > "$T/ent"
    achou=$(n3_casa "$T/ent")
    if [ -n "$achou" ] && ! secao "$tk" 'N3 aprovados no Gate 1' | grep -q 'N3-'; then
      falha "$achou casa com CAMINHOS_N3 e $tk não cita item N3 em '## N3 aprovados no Gate 1'"
    fi
  done < "$T/tasks"
}

ck_produz() {  # 6
  lista_tasks > "$T/tasks"
  while IFS= read -r tk; do
    [ -n "$tk" ] || continue
    secao "$tk" Interfaces | grep -E '^[[:space:]]*-[[:space:]]*Produz:' > "$T/prod"
    while IFS= read -r l; do
      [ -n "$l" ] || continue
      printf '%s' "$l" | grep -qi nenhum && continue
      sim=$(printf '%s' "$l" | sed -n 's/^[^`]*`\([^`]*\)`.*/\1/p' | sed 's/(.*//;s/^[[:space:]]*//;s/[[:space:]]*$//')
      [ -n "$sim" ] || continue
      git grep -q -F --untracked -e "$sim" -- . ':!agentic/' ':!docs/' || falha "símbolo '$sim' de Produz em $tk não existe no contrato executável"
    done < "$T/prod"
  done < "$T/tasks"
}

ck_contrato() {  # 7
  if [ -z "$CMD_VALIDA_CONTRATO" ]; then
    aviso "CMD_VALIDA_CONTRATO não definido em agentic/config; checagem 7 pulada"
    return
  fi
  if [ "$modo" = mudanca ] && secao "$alvo" 'Contrato executável' | grep -qi 'não há'; then return; fi
  if ( set +f; eval "$CMD_VALIDA_CONTRATO" ) </dev/null > "$T/contrato.out" 2>&1; then :; else
    falha "CMD_VALIDA_CONTRATO falhou: $CMD_VALIDA_CONTRATO"
    tail -n 20 "$T/contrato.out" | sed 's/^/    | /'
  fi
}

case "$modo" in
  spec)
    if [ -f "$alvo/spec.md" ]; then ck_regras_cas "$alvo/spec.md"; ck_sem_aprovacao "$alvo/spec.md"; else falha "sem $alvo/spec.md"; fi ;;
  design)
    if [ -f "$alvo/spec.md" ] && [ -f "$alvo/design.md" ]; then
      ck_cas_tasks; ck_caminhos; ck_branch; ck_sem_aprovacao "$alvo/design.md"; ck_n3_caminhos; ck_produz; ck_contrato
    else
      falha "faltam $alvo/spec.md ou $alvo/design.md"
    fi ;;
  mudanca)
    ck_regras_cas "$alvo"; ck_caminhos; ck_branch; ck_sem_aprovacao "$alvo"; ck_n3_caminhos; ck_contrato ;;
esac

if [ "$N" -eq 0 ]; then
  echo "verifica-artefato: OK ($modo $alvo)"
  exit 0
fi
echo "verifica-artefato: BLOQUEADO ($N falha(s))"
exit 1
