# Task <NNN>: <nome>

**Spec:** agentic/projeto/specs/<nome>/spec.md
**Status:** pendente
<!-- pendente | em-revisão | publicada  (em-andamento e integrada não são escritos: derivam do git) -->
**Branch:** <spec>/<NNN>-<nome>
<!-- Branch empilhada (modo automático, só com plataforma de PR, task anterior ainda não integrada): acrescente a linha **Base:** <branch da task anterior>. -->

## Objetivo
<uma frase>

## Arquivos
- `<caminho/exato>`
- `<diretorio/*>`

## Interfaces
- Produz: <símbolos, assinaturas, rotas que outras tasks usam>
- Consome: <o que vem de tasks anteriores>

## N3 aprovados no Gate 1
<!-- Itens da seção "Itens N3 (aprovação no Gate 1)" do design que esta task usa. Mudança N3 fora desta lista exige parar e chamar o humano. -->
- N3-<n> (design): <item>
<!-- ou: - Nenhum. -->

## Critérios de pronto
- <critério de aceite da spec coberto por esta task>
<!-- Anote cada critério: `CA<n> (<R…>): <texto> → test: <arquivo>::<nome>` (mais de um teste: separe por `; `). O arquivo anotado precisa ser tocado por um commit test(red):. -->
- `sh agentic/mecanismos/scripts/verify.sh` verde

## Questões em aberto
- <…>

## Rulings
<!-- Decisões do orquestrador não previstas na spec, no design ou nesta task (agentic/processo/ciclo.md, "Rulings"). -->
- R-1 (<fase>): <o quê> — por quê: <…> — descartado: <alternativa>
<!-- ou: - Nenhuma. -->
