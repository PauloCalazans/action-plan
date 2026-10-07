#!/bin/sh
# verifica-red.sh [base] — prova que cada commit test(red):
#   (1) não tocou código de produção: só DIRS_TESTE; documentação sob docs/ e intent/ é isenta (o
#       documento da task pode ser atualizado no mesmo commit);
#   (2) falhava de fato, num worktree isolado no commit RED: com CMD_TESTE_ARQUIVO configurado, roda o
#       comando para CADA arquivo de teste tocado pelo RED (arquivo sob DIRS_TESTE com asserção) e exige
#       que cada um falhe; sem ele, roda CMD_TESTE (suíte inteira) e exige falha — modo degradado;
#   (3) não teve asserções removidas depois, POR ARQUIVO: para cada arquivo de teste tocado pelo RED, o
#       número de linhas que casam MARCADOR_ASSERCAO em HEAD não pode ser menor que no RED (arquivo
#       removido em HEAD conta zero). Arquivos não tocados pelo RED não entram na comparação.
. "$(dirname "$0")/lib-agentic.sh"
cd "$agentic_raiz" || exit 1
base=${1:-$(agentic_base)}
[ -n "$base" ] || agentic_falha "sem base de comparação (a branch principal '$BRANCH_PRINCIPAL' existe?)"
git rev-parse --verify -q "$base^{commit}" >/dev/null || agentic_falha "base inválida: $base"

reds=$(git log --format=%H --grep='^test(red):' "$base..HEAD") || agentic_falha "falha ao listar commits"
if [ -z "$reds" ]; then
  echo "verifica-red: nenhum commit test(red): na branch"
  exit 0
fi
[ -n "$CMD_TESTE" ] || agentic_falha "CMD_TESTE não configurado em .agentic/config"
[ -n "$MARCADOR_ASSERCAO" ] || agentic_falha "MARCADOR_ASSERCAO vazio em .agentic/config — não há como comparar asserções"
[ -n "$(printf '%s' "$DIRS_TESTE" | tr -d '[:space:]')" ] || agentic_falha "DIRS_TESTE vazio em .agentic/config"
if [ -z "$CMD_TESTE_ARQUIVO" ]; then
  echo "degradado: CMD_TESTE_ARQUIVO não configurado — RED provado pela suíte inteira"
fi

# conta_assercoes <rev> <arquivo>: imprime o número de linhas com asserção no arquivo naquela revisão
# (0 se o arquivo não existe nela); retorna 1 se o git grep falhar.
conta_assercoes() {
  ca_saida=$(git -c core.quotepath=off grep -c -E -e "$MARCADOR_ASSERCAO" "$1" -- ":(literal)$2" 2>/dev/null)
  ca_rc=$?
  [ "$ca_rc" -le 1 ] || return 1 # 1 = nenhuma ocorrência (ou arquivo ausente); > 1 = erro
  printf '%s\n' "$ca_saida" | awk -F: 'NF { s += $NF } END { print s + 0 }'
}

# comando_arquivo <arquivo>: CMD_TESTE_ARQUIVO com cada {} trocado pelo caminho entre aspas simples.
comando_arquivo() {
  cf_q="'$(printf '%s' "$1" | sed "s/'/'\\\\''/g")'"
  cf_resto=$CMD_TESTE_ARQUIVO
  cf_saida=""
  while :; do
    case "$cf_resto" in
      *"{}"*)
        cf_saida="$cf_saida${cf_resto%%\{\}*}$cf_q"
        cf_resto=${cf_resto#*\{\}} ;;
      *) break ;;
    esac
  done
  printf '%s%s' "$cf_saida" "$cf_resto"
}

# avalia_rc <rc> <rotulo> <comando>: interpreta o código de saída de uma execução de teste no RED.
avalia_rc() {
  case $1 in
    0)
      echo "agentic: BLOQUEADO — os testes PASSAVAM no RED $curto ($2): não é evidência de RED."
      status=1 ;;
    126|127)
      echo "agentic: BLOQUEADO — comando de teste não encontrado/não executável no RED $curto (código $1): $3"
      status=1 ;;
    *)
      echo "RED $curto: falhava ($2) (ok)" ;;
  esac
}

status=0
lista=$(mktemp) || agentic_falha "mktemp falhou"
for c in $reds; do
  curto=$(git rev-parse --short "$c")

  arquivos=$(git -c core.quotepath=off diff-tree --no-commit-id --name-only -r "$c") \
    || { rm -f "$lista"; agentic_falha "falha ao listar arquivos do RED $curto"; }
  : > "$lista" # arquivos de teste tocados pelo RED que têm asserção no RED, um por linha
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    dentro=1
    teste=1
    # Documentação não é código de produção: os scripts só leem docs/specs/*/tasks/*.md e intent/.
    case "$f" in docs/*|intent/*) dentro=0 ;; esac
    set -f
    for d in $DIRS_TESTE; do
      case "$f" in "$d"*) dentro=0; teste=0 ;; esac
    done
    set +f
    if [ "$dentro" -ne 0 ]; then
      echo "agentic: BLOQUEADO — RED $curto toca arquivo fora dos diretórios de teste (código de produção): $f"
      status=1
    elif [ "$teste" -eq 0 ]; then
      n=$(conta_assercoes "$c" "$f") || { rm -f "$lista"; agentic_falha "falha ao contar asserções no RED $curto (git grep com erro; MARCADOR_ASSERCAO='$MARCADOR_ASSERCAO')"; }
      [ "$n" -gt 0 ] && printf '%s\n' "$f" >> "$lista"
    fi
  done <<EOT
$arquivos
EOT

  if [ -n "$CMD_TESTE_ARQUIVO" ] && [ ! -s "$lista" ]; then
    echo "agentic: BLOQUEADO — RED $curto não toca nenhum arquivo de teste com asserção ('$MARCADOR_ASSERCAO'): não há o que provar por arquivo."
    status=1
  fi

  wt=$(mktemp -d)
  rmdir "$wt"
  git worktree add -q --detach "$wt" "$c" || { rm -f "$lista"; agentic_falha "não foi possível criar worktree para $curto"; }
  # Entre worktree add e remove não há saída via agentic_falha: o worktree é sempre removido.
  if [ -n "$CMD_PREPARAR_TESTE" ] && ! ( cd "$wt" && eval "$CMD_PREPARAR_TESTE" ) >/dev/null 2>&1; then
    echo "agentic: BLOQUEADO — CMD_PREPARAR_TESTE falhou no RED $curto; não há evidência."
    status=1
  elif [ -n "$CMD_TESTE_ARQUIVO" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      cmd=$(comando_arquivo "$f")
      ( cd "$wt" && eval "$cmd" ) >/dev/null 2>&1
      avalia_rc $? "$f" "$cmd"
    done < "$lista"
  else
    ( cd "$wt" && eval "$CMD_TESTE" ) >/dev/null 2>&1
    avalia_rc $? "suíte inteira" "$CMD_TESTE"
  fi
  git worktree remove --force "$wt"

  while IFS= read -r f; do
    [ -n "$f" ] || continue
    a_red=$(conta_assercoes "$c" "$f") || { rm -f "$lista"; agentic_falha "falha ao contar asserções no RED $curto (git grep com erro; MARCADOR_ASSERCAO='$MARCADOR_ASSERCAO')"; }
    a_head=$(conta_assercoes HEAD "$f") || { rm -f "$lista"; agentic_falha "falha ao contar asserções em HEAD (git grep com erro; MARCADOR_ASSERCAO='$MARCADOR_ASSERCAO')"; }
    if [ "$a_head" -lt "$a_red" ]; then
      echo "agentic: BLOQUEADO — asserções diminuíram desde o RED $curto em $f: $a_red -> $a_head"
      status=1
    fi
  done < "$lista"
done
rm -f "$lista"
exit $status
