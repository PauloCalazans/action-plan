# Princípios do SDLC agêntico

Estes princípios regem todo papel, artefato e mecanismo. Cada um diz como é verificado. Regra sem verificação mecânica é declarada "por revisão", nunca descrita como garantida.

## 1. Prompt orienta, mecanismo controla
Instrução escrita é orientação; só um mecanismo determinístico consegue dizer "não". Toda regra do processo declara `Verificado por:` com o mecanismo que a garante ou com "por revisão".
**Verificado por:** revisão (o `revisor` rejeita regra nova sem `Verificado por:`).

## 2. Erro repetido duas vezes vira mecanismo
Quando o mesmo erro acontece pela segunda vez, a correção é um controle mecânico (hook, script, teste, permissão) — não uma terceira instrução em prosa. Controle que nunca pega nada é candidato a remoção.
**Verificado por:** revisão.

## 3. Estado é derivado, nunca escrito à mão
O estado do projeto (o que está em andamento, o que foi aprovado) vem do git e dos campos `**Status:**` dos artefatos. É exibido no início de cada sessão por `agentic/mecanismos/scripts/status-projeto.sh`. Números (contagens, totais) são gerados por script.
**Verificado por:** `status-projeto.sh` (hook de início de sessão); `verifica-decisoes.sh` (toda referência `D<n>` existe em `decisoes.md` e nenhuma decisão da base some).

## 4. Afirmações técnicas são medidas ou inferidas
Toda afirmação sobre comportamento do sistema é marcada `medido` (há saída/execução que comprova) ou `inferido` (dedução ainda não comprovada). Nada é declarado funcionando sem a saída vista.
**Verificado por:** `verify.sh` para o que é testável; revisão para o resto.

## 5. O agente nunca integra e nunca altera as próprias permissões
Merge na branch principal e permissões do agente pertencem ao humano.
**Verificado por:** `deny` de `gh pr merge` e de edição de `.claude/settings*.json`, `.claude/hooks/**`, `agentic/config`, `agentic/auto-mode`, `agentic/baseline-skips`, `agentic/mecanismos/githooks/**`, `agentic/mecanismos/scripts/**`, `.gitleaksignore`; `pre-push` e `pre-merge-commit` bloqueiam a branch protegida; `verify.sh` falha se os githooks estiverem desligados no clone (`core.hooksPath`).

## 6. Memória enxuta
`AGENTS.md` e `CLAUDE.md` são mapa e regras. Narrativa de ciclo vai para documentos datados; decisões vão para `agentic/projeto/decisoes.md`.
**Verificado por:** revisão.

## 7. Erros pequenos, visíveis e reversíveis
Cada task ou mudança é executada num worktree isolado (antes do Gate 1 da trilha padrão, intent, spec, design, tasks, decisões novas e o esqueleto do contrato executável são escritos na árvore principal, sem commit); tasks têm escopo declarado; descartar uma execução ruim deve ser barato.
**Verificado por:** `verifica-escopo.sh` (escopo); revisão (isolamento por worktree).
