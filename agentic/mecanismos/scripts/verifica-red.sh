#!/bin/sh
# verifica-red.sh [base] — prova que cada commit test(red):
#   (1) não tocou código de produção: só DIRS_TESTE; documentação sob docs/ e agentic/projeto/ é isenta (o
#       documento da task pode ser atualizado no mesmo commit);
#   (2) falhava de fato, num worktree isolado no commit RED: com CMD_TESTE_ARQUIVO configurado, roda o
#       comando para CADA arquivo de teste tocado pelo RED (arquivo sob DIRS_TESTE com asserção) e exige
#       que cada um falhe; sem ele, roda CMD_TESTE (suíte inteira) e exige falha — modo degradado;
#   (3) não teve asserções removidas depois, POR ARQUIVO: para cada arquivo de teste tocado pelo RED, o
#       número de linhas que casam MARCADOR_ASSERCAO em HEAD não pode ser menor que no RED (arquivo
#       removido em HEAD conta zero). Arquivos não tocados pelo RED não entram na comparação.
#       Exceção: remoção autorizada, quando uma Ruling, decisão ou emenda de spec tirou o comportamento que as
#       asserções provavam. Um commit da branch declara, num trailer,
#         Assercoes-removidas: <arquivo> <n> [em <sha>] (<R-n | D<n> | Emenda n>)
#       as n asserções removidas no commit X (<sha>, ou o próprio commit do trailer). O trailer só conta se:
#       X vem depois do RED e não depois do commit do trailer; a referência foi acrescentada sob agentic/projeto/
#       entre a base e o pai de X (registrada antes da remoção). O crédito de X é no máximo a queda de asserções
#       do arquivo em X, mesmo com várias declarações; o limite passa a ser (asserções no RED - créditos).
#   (4) cache: a prova de (2) é guardada por SHA do RED e assinatura dos comandos de teste, e reaproveitada (ver
#       "Cache (4)" mais abaixo); AGENTIC_RED_SEM_CACHE=1 ignora a leitura. (1) e (3) rodam sempre.
#   (5) vínculo CA → teste: cada CA da task (AGENTIC_TASK, exportada pelo verify.sh, inclusive com --task; ou a
#       task de **Branch:** igual à branch atual) tem "→ test: <arquivo>::<nome>" e o arquivo é tocado por commit
#       RED; task sem nenhuma anotação só avisa; sem task (trilha rápida), não checa. Task com CA e nenhum commit
#       RED bloqueia quando a branch tem código além de docs só de documentação, chore e test: só de teste (GREEN sem RED), salvo
#       task de remoção de comportamento (trailer Assercoes-removidas:).
. "$(dirname "$0")/lib-agentic.sh"
cd "$agentic_raiz" || exit 1
if [ -n "${1:-}" ]; then
  base=$(git merge-base HEAD "$1") || agentic_falha "base inválida: $1"
else
  base=$(agentic_base)
fi
[ -n "$base" ] || agentic_falha "sem base de comparação (a branch principal '$BRANCH_PRINCIPAL' existe?)"
git rev-parse --verify -q "$base^{commit}" >/dev/null || agentic_falha "base inválida: $base"

reds=$(git log --format=%H --grep='^test(red):' "$base..HEAD") || agentic_falha "falha ao listar commits"
# Task da branch: AGENTIC_TASK (exportada pelo verify.sh, inclusive com --task) ou **Branch:** igual ao HEAD.
vinc_task=""
if [ -n "${AGENTIC_TASK:-}" ] && [ -f "$AGENTIC_TASK" ]; then
  vinc_task=$AGENTIC_TASK
else
  vinc_br=$(git symbolic-ref --short -q HEAD)
  if [ -n "$vinc_br" ]; then
    for vinc_f in agentic/projeto/specs/*/tasks/*.md; do
      [ -f "$vinc_f" ] || continue
      vinc_b=$(sed -n 's/^\*\*Branch:\*\*[[:space:]]*//p' "$vinc_f" | head -n 1 | tr -d '\r`' | sed 's/[[:space:]]*$//')
      [ "$vinc_b" = "$vinc_br" ] && { vinc_task=$vinc_f; break; }
    done
  fi
fi
# ref_registrada <rev> <ref>: a referência aparece numa linha acrescentada sob agentic/projeto/ entre a base e <rev>.
ref_registrada() {
  git -c core.quotepath=off diff "$base" "$1" -- agentic/projeto/ 2>/dev/null | sed -n 's/^+//p' | grep -v '^++ ' \
    | grep -qE "(^|[^[:alnum:]])$2([^[:alnum:]]|$)"
}

# CAs da task (mesma definição para "GREEN sem RED" e para o vínculo).
vinc_ca=""
if [ -n "$vinc_task" ]; then
  # Seção "Critérios de pronto" (task) ou, sem ela, "Critérios de aceite" (mudança); sem \r, backticks e comentários HTML.
  vinc_secao=""
  for vinc_t in 'Critérios de pronto' 'Critérios de aceite'; do
    vinc_secao=$(tr -d '\r`' < "$vinc_task" | awk -v t="## $vinc_t" '
      BEGIN { achou = 0 }
      /^## / { if (dentro) exit; dentro = ($0 == t); if (dentro) achou = 1; next }
      dentro {
        l = $0
        while (1) {
          if (com) { i = index(l, "-->"); if (!i) { l = ""; break } l = substr(l, i + 3); com = 0 }
          i = index(l, "<!--"); if (!i) break
          j = index(substr(l, i + 4), "-->")
          if (j) l = substr(l, 1, i - 1) substr(l, i + 4 + j + 2); else { l = substr(l, 1, i - 1); com = 1 }
        }
        print l
      }')
    [ -z "$(printf '%s' "$vinc_secao" | grep -E 'CA[0-9]+')" ] || break
  done
  vinc_ca=$(printf '%s\n' "$vinc_secao" | grep -E '^[[:space:]]*[-*]?[[:space:]]*(\[[ xX]\][[:space:]]*)?CA[0-9]+')
fi
if [ -z "$reds" ]; then
  # GREEN sem RED: task com CA e algum commit desta branch que ainda não está na principal (sem merges; o que um
  # merge da principal trouxe não conta, o que um merge de sub-branch trouxe conta) e que não é registro (docs),
  # contrato executável (chore) nem teste (test: só com arquivos de teste ou documentação). Task de remoção de
  # comportamento (trailer Assercoes-removidas:) não tem RED por construção ("Remoção de comportamento" no ciclo).
  if [ -n "$vinc_ca" ]; then
    gr_nao=""
    for gr_p in "$BRANCH_PRINCIPAL" "origin/$BRANCH_PRINCIPAL"; do
      git rev-parse --verify -q "$gr_p^{commit}" >/dev/null 2>&1 && gr_nao="$gr_nao $gr_p"
    done
    gr_commits=$(git log --no-merges --format=%H "$base..HEAD" ${gr_nao:+--not $gr_nao})
    gr_remocao=""; gr_green=""
    for c in $gr_commits; do
      # Remoção só vale com a referência registrada sob agentic/projeto/ antes do commit (ciclo, "Remoção de comportamento").
      for gr_ref in $(git log -1 --format='%(trailers:key=Assercoes-removidas,valueonly)' "$c" | sed -n 's/.*(\([^)]*\)).*/\1/p'); do
        ref_registrada "$c^" "$gr_ref" && gr_remocao=1
      done
      gr_s=$(git log -1 --format=%s "$c")
      case "$gr_s" in
        chore:*|chore\(*) continue ;; # contrato executável: o esqueleto é conferido pelo revisor (limite declarado)
        docs:*|docs\(*|test:*|test\(*)
          # docs só com documentação (*.md, docs/, agentic/projeto/); test: também com arquivos de teste.
          gr_tipo=${gr_s%%[(:]*}
          gr_prod=$(git -c core.quotepath=off diff-tree --no-commit-id --name-only -r "$c" | while IFS= read -r f; do
            case "$f" in docs/*|agentic/projeto/*|*.md) continue ;; esac
            gr_t=""
            if [ "$gr_tipo" = test ]; then
              set -f; for d in $DIRS_TESTE; do case "$f" in "$d"*) gr_t=1 ;; esac; done; set +f
            fi
            [ -n "$gr_t" ] || echo "$f"
          done)
          [ -n "$gr_prod" ] && gr_green="$gr_green ${c%"${c#???????}"}" ;;
        *) gr_green="$gr_green ${c%"${c#???????}"}" ;;
      esac
    done
    if [ -n "$gr_green" ] && [ -z "$gr_remocao" ]; then
      echo "agentic: BLOQUEADO — a task $vinc_task tem CA e a branch tem código sem nenhum test(red): (commits:$gr_green)"
      exit 1
    fi
  fi
  echo "verifica-red: nenhum commit test(red): na branch"
  exit 0
fi
[ -n "$CMD_TESTE" ] || agentic_falha "CMD_TESTE não configurado em agentic/config"
[ -n "$MARCADOR_ASSERCAO" ] || agentic_falha "MARCADOR_ASSERCAO vazio em agentic/config — não há como comparar asserções"
[ -n "$(printf '%s' "$DIRS_TESTE" | tr -d '[:space:]')" ] || agentic_falha "DIRS_TESTE vazio em agentic/config"
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

# ignora_trailer <portador> <motivo> <linha>: explica por que uma declaração não conta (em stderr).
ignora_trailer() {
  echo "verifica-red: trailer Assercoes-removidas ignorado em $(git rev-parse --short "$1") ($2): $3" >&2
}

# removidas_autorizadas <rev-red> <arquivo>: créditos de remoção autorizada do arquivo para esse RED, a partir
# dos trailers "Assercoes-removidas:" dos commits <rev-red>..HEAD (regras no cabeçalho, etapa 3).
removidas_autorizadas() {
  ra_tmp=$(mktemp) || return 1
  git -c core.quotepath=off log --format='@@%H%n%(trailers:key=Assercoes-removidas,valueonly,unfold)' "$1..HEAD" 2>/dev/null \
    | tr -d '\r' | while IFS= read -r ra_l; do
    case "$ra_l" in
      @@*) ra_portador=${ra_l#@@}; continue ;;
      "$2 "*) ;;
      *) continue ;;
    esac
    ra_l=$(printf '%s' "$ra_l" | sed 's/[[:space:]]*$//')
    case "$ra_l" in *"("*")") ;; *) ignora_trailer "$ra_portador" "sem (<ref>) no fim" "$ra_l"; continue ;; esac
    ra_ref=${ra_l##*\(}; ra_ref=${ra_ref%\)}
    ra_resto=$(printf '%s' "${ra_l%\(*}" | sed 's/[[:space:]]*$//')
    ra_x=$ra_portador
    ra_ant=${ra_resto% *}
    if [ "${ra_ant##* }" = em ]; then
      ra_x=${ra_resto##* }
      ra_resto=${ra_ant% *}
    fi
    ra_n=${ra_resto##* }
    [ "${ra_resto% *}" = "$2" ] || continue # outro arquivo com o mesmo prefixo
    case "$ra_n" in ""|*[!0-9]*) ignora_trailer "$ra_portador" "número inválido" "$ra_l"; continue ;; esac
    case "$ra_ref" in
      R-[0-9]*) ra_num=${ra_ref#R-} ;;
      D[0-9]*) ra_num=${ra_ref#D} ;;
      "Emenda "[0-9]*) ra_num=${ra_ref#Emenda } ;;
      *) ra_num=x ;;
    esac
    case "$ra_num" in *[!0-9]*) ignora_trailer "$ra_portador" "referência não é R-n, D<n> nem Emenda n" "$ra_l"; continue ;; esac
    if ! ra_xc=$(git rev-parse --verify -q "$ra_x^{commit}"); then
      ignora_trailer "$ra_portador" "commit $ra_x inexistente" "$ra_l"; continue
    fi
    if [ "$ra_xc" = "$(git rev-parse "$1")" ] || ! git merge-base --is-ancestor "$1" "$ra_xc" \
      || ! git merge-base --is-ancestor "$ra_xc" "$ra_portador"; then
      ignora_trailer "$ra_portador" "a remoção não está entre o RED $curto e o commit do trailer" "$ra_l"; continue
    fi
    if ! ref_registrada "$ra_xc^" "$ra_ref"; then
      ignora_trailer "$ra_portador" "$ra_ref não foi registrada sob agentic/projeto/ antes da remoção" "$ra_l"; continue
    fi
    printf '%s %s\n' "$ra_xc" "$ra_n" >> "$ra_tmp"
  done
  ra_total=0
  for ra_xc in $(cut -d' ' -f1 "$ra_tmp" | sort -u); do
    ra_decl=$(awk -v x="$ra_xc" '$1 == x { s += $2 } END { print s + 0 }' "$ra_tmp")
    ra_antes=$(conta_assercoes "$ra_xc^" "$2") && ra_depois=$(conta_assercoes "$ra_xc" "$2") || ra_antes=0 ra_depois=0
    ra_queda=$((ra_antes - ra_depois))
    [ "$ra_decl" -gt "$ra_queda" ] && ra_decl=$ra_queda
    [ "$ra_decl" -gt 0 ] && ra_total=$((ra_total + ra_decl))
  done
  rm -f "$ra_tmp"
  echo "$ra_total"
}

# Cache (4): uma prova legítima (o teste falhou no RED) é guardada em <git-common-dir>/agentic/red-provados, uma
# linha "<sha do RED> <assinatura> <arquivo>" (modo degradado: arquivo = *suite*). A assinatura é o hash de
# CMD_PREPARAR_TESTE, CMD_TESTE_ARQUIVO e CMD_TESTE, então mudar qualquer um invalida a prova. O diretório comum
# é compartilhado entre worktrees. Nunca se guarda RED que passava, comando não encontrado nem preparo com falha.
# A recusa de produção e a contagem de asserções rodam sempre. AGENTIC_RED_SEM_CACHE=1 ignora a leitura.
cache_dir=$(git rev-parse --git-common-dir 2>/dev/null | tr -d '\r')
case "$cache_dir" in
  "") cache_arq="" ;; # sem diretório comum: cache desligado (nem leitura nem gravação)
  /*|?:*) cache_arq="$cache_dir/agentic/red-provados" ;;
  *) cache_dir="$agentic_raiz/$cache_dir"; cache_arq="$cache_dir/agentic/red-provados" ;;
esac
assinatura=$(printf '%s\n%s\n%s\n' "$CMD_PREPARAR_TESTE" "$CMD_TESTE_ARQUIVO" "$CMD_TESTE" | git hash-object --stdin) || cache_arq=""

# red_provado <sha> <arquivo>: 0 se há prova guardada com a assinatura atual (e o cache não está desligado).
red_provado() {
  [ "${AGENTIC_RED_SEM_CACHE:-}" = 1 ] && return 1
  [ -n "$cache_arq" ] && [ -f "$cache_arq" ] || return 1
  RP_SHA=$1 RP_SIG=$assinatura RP_ARQ=$2 awk '
    BEGIN { sha = ENVIRON["RP_SHA"]; sig = ENVIRON["RP_SIG"]; arq = ENVIRON["RP_ARQ"] }
    { sub(/\r$/, "") }
    $1 == sha && $2 == sig && substr($0, length(sha) + length(sig) + 3) == arq { ok = 1 }
    END { exit ok ? 0 : 1 }' "$cache_arq"
}

# guarda_prova <sha> <arquivo>: acrescenta a prova ao cache (falha de gravação não derruba a verificação).
guarda_prova() {
  [ -n "$cache_arq" ] || return 0
  mkdir -p "$cache_dir/agentic" 2>/dev/null || return 0
  printf '%s %s %s\n' "$1" "$assinatura" "$2" >> "$cache_arq" 2>/dev/null
  return 0
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

# avalia_rc <rc> <rotulo> <comando> <chave-do-cache>: interpreta o código de saída de uma execução de teste no RED;
# só a falha legítima é guardada no cache.
avalia_rc() {
  case $1 in
    0)
      echo "agentic: BLOQUEADO — os testes PASSAVAM no RED $curto ($2): não é evidência de RED."
      status=1 ;;
    126|127)
      echo "agentic: BLOQUEADO — comando de teste não encontrado/não executável no RED $curto (código $1): $3"
      status=1 ;;
    *)
      echo "RED $curto: falhava ($2) (ok)"
      # rc >= 124 é timeout (124) ou sinal (>= 128): execução interrompida não é prova permanente.
      [ "$1" -ge 124 ] || guarda_prova "$c" "$4" ;;
  esac
}

status=0
lista=$(mktemp) || agentic_falha "mktemp falhou"
pend=$(mktemp) || { rm -f "$lista" "$pend"; agentic_falha "mktemp falhou"; }
for c in $reds; do
  curto=$(git rev-parse --short "$c")

  arquivos=$(git -c core.quotepath=off diff-tree --no-commit-id --name-only -r "$c") \
    || { rm -f "$lista" "$pend"; agentic_falha "falha ao listar arquivos do RED $curto"; }
  : > "$lista" # arquivos de teste tocados pelo RED que têm asserção no RED, um por linha
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    dentro=1
    teste=1
    # Documentação não é código de produção: os scripts só leem agentic/projeto/specs/*/tasks/*.md e agentic/projeto/intent/.
    case "$f" in docs/*|agentic/projeto/*) dentro=0 ;; esac
    set -f
    for d in $DIRS_TESTE; do
      case "$f" in "$d"*) dentro=0; teste=0 ;; esac
    done
    set +f
    if [ "$dentro" -ne 0 ]; then
      echo "agentic: BLOQUEADO — RED $curto toca arquivo fora dos diretórios de teste (código de produção): $f"
      status=1
    elif [ "$teste" -eq 0 ]; then
      n=$(conta_assercoes "$c" "$f") || { rm -f "$lista" "$pend"; agentic_falha "falha ao contar asserções no RED $curto (git grep com erro; MARCADOR_ASSERCAO='$MARCADOR_ASSERCAO')"; }
      [ "$n" -gt 0 ] && printf '%s\n' "$f" >> "$lista"
    fi
  done <<EOT
$arquivos
EOT

  if [ -n "$CMD_TESTE_ARQUIVO" ] && [ ! -s "$lista" ]; then
    echo "agentic: BLOQUEADO — RED $curto não toca nenhum arquivo de teste com asserção ('$MARCADOR_ASSERCAO'): não há o que provar por arquivo."
    status=1
  fi

  # Filtra o que já foi provado neste SHA com esta assinatura; o resto precisa subir o worktree.
  : > "$pend"
  if [ -n "$CMD_TESTE_ARQUIVO" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      if red_provado "$c" "$f"; then
        echo "RED $curto: já provado ($f) (ok)"
      else
        printf '%s\n' "$f" >> "$pend"
      fi
    done < "$lista"
  elif red_provado "$c" '*suite*'; then
    echo "RED $curto: já provado (*suite*) (ok)"
  else
    echo '*suite*' > "$pend"
  fi

  if [ -s "$pend" ]; then
    wt=$(mktemp -d)
    rmdir "$wt"
    git worktree add -q --detach "$wt" "$c" || { rm -f "$lista" "$pend"; agentic_falha "não foi possível criar worktree para $curto"; }
    # Entre worktree add e remove não há saída via agentic_falha: o worktree é sempre removido.
    # Toda execução de teste recebe </dev/null: um comando que lê stdin não pode consumir a lista de arquivos.
    if [ -n "$CMD_PREPARAR_TESTE" ] && ! ( cd "$wt" && eval "$CMD_PREPARAR_TESTE" ) >/dev/null 2>&1 </dev/null; then
      echo "agentic: BLOQUEADO — CMD_PREPARAR_TESTE falhou no RED $curto; não há evidência."
      status=1
    elif [ -n "$CMD_TESTE_ARQUIVO" ]; then
      while IFS= read -r f; do
        [ -n "$f" ] || continue
        cmd=$(comando_arquivo "$f")
        ( cd "$wt" && eval "$cmd" ) >/dev/null 2>&1 </dev/null
        avalia_rc $? "$f" "$cmd" "$f"
      done < "$pend"
    else
      ( cd "$wt" && eval "$CMD_TESTE" ) >/dev/null 2>&1 </dev/null
      avalia_rc $? "suíte inteira" "$CMD_TESTE" '*suite*'
    fi
    git worktree remove --force "$wt"
  fi

  while IFS= read -r f; do
    [ -n "$f" ] || continue
    a_red=$(conta_assercoes "$c" "$f") || { rm -f "$lista" "$pend"; agentic_falha "falha ao contar asserções no RED $curto (git grep com erro; MARCADOR_ASSERCAO='$MARCADOR_ASSERCAO')"; }
    a_head=$(conta_assercoes HEAD "$f") || { rm -f "$lista" "$pend"; agentic_falha "falha ao contar asserções em HEAD (git grep com erro; MARCADOR_ASSERCAO='$MARCADOR_ASSERCAO')"; }
    [ "$a_head" -lt "$a_red" ] || continue
    rem=$(removidas_autorizadas "$c" "$f") || { rm -f "$lista" "$pend"; agentic_falha "mktemp falhou"; }
    if [ "$a_head" -lt $((a_red - rem)) ]; then
      sufixo=""
      [ "$rem" -gt 0 ] && sufixo=" (removidas autorizadas: $rem)"
      echo "agentic: BLOQUEADO — asserções diminuíram desde o RED $curto em $f: $a_red -> $a_head$sufixo"
      status=1
    else
      echo "verifica-red: $f: $a_red -> $a_head desde o RED $curto, com $rem removidas autorizadas por trailer (ok)"
    fi
  done < "$lista"
done

# --- Vínculo CA -> teste (task da branch): cada CA da seção precisa de "→ test: <arquivo>::<nome>", e o arquivo
# anotado precisa ter sido tocado por um commit RED. Task sem nenhuma anotação (anterior a esta versão do kit)
# só gera aviso; branch sem task (trilha rápida) não é checada.
# (vinc_task é resolvida antes da lista de commits RED.)
if [ -n "$vinc_task" ]; then
  if [ -n "$vinc_ca" ]; then
    vinc_ann=$(printf '%s\n' "$vinc_ca" | grep -c '→ test:')
    if [ "$vinc_ann" -eq 0 ]; then
      echo "aviso: task sem anotação → test: (anterior a esta versão do kit) — vínculo CA → teste não verificado"
    else
      vinc_tocados=$(for c in $reds; do git -c core.quotepath=off diff-tree --no-commit-id --name-only -r "$c"; done | sort -u)
      printf '%s\n' "$vinc_ca" | while IFS= read -r vinc_l; do
        vinc_id=$(printf '%s' "$vinc_l" | grep -oE 'CA[0-9]+' | head -n 1)
        case "$vinc_l" in
          *"→ test:"*) ;;
          *) echo "agentic: BLOQUEADO — $vinc_id sem → test: na task $vinc_task"; continue ;;
        esac
        vinc_resto=${vinc_l#*→ test:}
        printf '%s\n' "$vinc_resto" | awk '{gsub(/; /,"\n")}1' | while IFS= read -r vinc_i; do
          vinc_a=${vinc_i%%::*}
          vinc_a=$(printf '%s' "$vinc_a" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
          [ -n "$vinc_a" ] || { echo "agentic: BLOQUEADO — $vinc_id com → test: sem arquivo na task $vinc_task"; continue; }
          printf '%s\n' "$vinc_tocados" | grep -qxF -- "$vinc_a" \
            || echo "agentic: BLOQUEADO — $vinc_a anotado em $vinc_id não foi tocado por commit test(red):"
        done
      done > "$lista"
      if [ -s "$lista" ]; then cat "$lista"; status=1; fi
    fi
  fi
fi
rm -f "$lista" "$pend"
exit $status
