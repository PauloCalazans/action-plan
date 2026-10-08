# Princípios do SDLC agêntico

Estes princípios regem todo papel, artefato e mecanismo. Cada um diz **por que existe** e **como é verificado**. Regra sem verificação mecânica é declarada como "por revisão" — nunca descrita como garantida.

## 1. Prompt orienta, mecanismo controla
Instrução escrita é orientação; só um mecanismo determinístico consegue dizer "não". Toda regra do processo declara `Verificado por:` com o mecanismo que a garante ou com "por revisão".
**Por quê:** agentes seguem prompts na maior parte do tempo, não sempre. Uma regra que só existe em texto falha justamente quando mais importa.
**Verificado por:** revisão (o `revisor` rejeita regra nova sem `Verificado por:`).

## 2. Erro repetido duas vezes vira mecanismo
Quando o mesmo erro acontece pela segunda vez, a correção é um controle mecânico (hook, script, teste, permissão) — não uma terceira instrução em prosa. Controle que nunca pega nada é candidato a remoção.
**Por quê:** reforçar texto que já falhou não muda o resultado; e controle inútil é cerimônia que custa tempo de toda execução.
**Verificado por:** revisão.

## 3. Estado é derivado, nunca escrito à mão
O estado do projeto (o que está em andamento, o que foi aprovado) vem do git e dos campos `**Status:**` dos artefatos. É exibido no início de cada sessão por `agentic/mecanismos/scripts/status-projeto.sh`. Números (contagens, totais) são gerados por script.
**Por quê:** estado escrito à mão envelhece em um dia e passa a mentir para a próxima sessão.
**Verificado por:** `status-projeto.sh` (hook de início de sessão).

## 4. Afirmações técnicas são medidas ou inferidas
Toda afirmação sobre comportamento do sistema é marcada `medido` (há saída/execução que comprova) ou `inferido` (dedução ainda não comprovada). Nada é declarado funcionando sem a saída vista.
**Por quê:** a confiança do agente não é evidência; inferências promovidas a fatos sem medição viram defeitos difíceis de rastrear.
**Verificado por:** `verify.sh` para o que é testável; revisão para o resto.

## 5. O agente nunca integra e nunca altera as próprias permissões
Merge na branch principal e permissões do agente pertencem ao humano.
**Por quê:** o ponto de integração é onde o humano responde pela decisão; um agente que amplia as próprias permissões elimina o controle que deveria limitá-lo.
**Verificado por:** `deny` de `gh pr merge` e de edição de `.claude/settings*.json`, `.claude/hooks/**`, `agentic/config`, `agentic/auto-mode`, `agentic/baseline-skips`, `agentic/mecanismos/githooks/**`, `agentic/mecanismos/scripts/**`, `.gitleaksignore`; `pre-push` e `pre-merge-commit` bloqueiam a branch protegida.

## 6. Memória enxuta
`AGENTS.md` e `CLAUDE.md` são mapa e regras. Narrativa de ciclo vai para documentos datados; decisões vão para `agentic/projeto/decisoes.md`.
**Por quê:** memória que vira changelog consome contexto a cada sessão e acumula contradições.
**Verificado por:** revisão.

## 7. Erros pequenos, visíveis e reversíveis
Cada sessão trabalha num worktree isolado; tasks têm escopo declarado; descartar uma execução ruim deve ser barato.
**Por quê:** todo commit de agente é tratado como não confiável até o repositório dar motivo para confiar.
**Verificado por:** `verifica-escopo.sh` (escopo); revisão (isolamento por worktree).
