# Mudança: <nome>

**Status:** pendente
<!-- pendente | em-revisão | publicada  (em-andamento e integrada não são escritos: derivam do git) -->
**Branch:** <nome>/001-<nome>
**Trilha:** enxuta
<!-- Autoria (agentic/processo/ciclo.md, "Trilha enxuta"): o `arquiteto` escreve as seções; as respostas do Questionário, a coluna "Decisão do humano", "Questões em aberto" e "Rulings" são só do orquestrador. Ninguém escreve aprovação neste documento: o Gate 1 é o commit `docs(mudanca): <nome> aprovada (Gate 1)`. -->

## Problema e resultado
<2–4 linhas: o que incomoda hoje e como o comportamento deve ficar>

## Regras
<!-- Regra que depende de pergunta do Questionário leva `Q<n>` como fonte até a resposta; no Gate 1 toda regra tem fonte definitiva (nenhuma hipótese). -->
| # | Regra | Fonte |
|---|---|---|
| R1 | <regra> | humano:<AAAA-MM-DD> \| oráculo:<arquivo>:<linha> \| plano:<arquivo>:<linha> \| decisão:D<n> \| Q<n> (antes da resposta) |

## Critérios de aceite
- CA1 (R1): dado <contexto>, quando <ação>, então <resultado observável>
<!-- Anote cada critério: `CA<n> (<R…>): <texto> → test: <arquivo>::<nome>` (mais de um teste: separe por `; `). O arquivo anotado precisa ser tocado por um commit test(red):. -->

## Arquivos
- `<caminho/exato>`
- `<diretorio/*>`

## Impacto
<!-- Toda linha `medido` (das buscas do `## Impacto` do brief, conferida no trecho, com arquivo:linha). Sem impacto fora dos arquivos novos: escreva `- Nenhum (só arquivos novos).` -->
| Alterado (símbolo, rota, schema, regra) | Quem usa hoje (arquivo:linha, medido) | Em ## Arquivos de | Teste existente afetado | Regra de outra spec → emenda |
|---|---|---|---|---|
| <símbolo alterado> | <arquivo:linha> | <task NNN> | <teste ou "nenhum"> | <spec e regra, ou "nenhuma"> |

## Contrato executável
<!-- Quando a mudança cria ou altera interface: esqueleto escrito no worktree, dentro de ## Arquivos, sem commit até o Gate 1; entra no commit `chore: contrato executável`. Sem interface nova: "- Não há." -->
- O que é: <interfaces/tipos/constantes/rotas>
- Como se valida: `<comando>`
- Saída da validação (medido):
```
<saída>
```
- Declaração de corpos: <!-- todo corpo do contrato que não é o stub da stack, com o porquê; esperado: vazia ou só acesso trivial a dado -->
  - Nenhum.

## Itens N3 (aprovação no Gate 1)
<!-- Só acréscimo a contrato público (nada removido, renomeado ou com tipo ou semântica alterados). Qualquer outro gatilho N3: a mudança não cabe na trilha enxuta. Sem itens: deixe a tabela sem linhas. A última coluna é preenchida pelo orquestrador com a decisão do humano no Gate 1. -->
| # | Item | Por que é só acréscimo | Decisão do humano |
|---|---|---|---|
| N3-1 | <o que é acrescentado ao contrato público> | <…> | <aprovado em AAAA-MM-DD, ou recusado> |

## Decisões novas
<!-- Decisão que vale além desta mudança: escrita também em agentic/projeto/decisoes.md no worktree (e no AGENTS.md, se mexe em gatilho N3), com os arquivos em ## Arquivos. O humano aprova cada uma no Gate 1. -->
- D<n> — <título>: <decisão> — por quê: <…>
<!-- ou: - Nenhuma. -->

## Fora de escopo
- <o que esta mudança não faz>

## Questionário
<!-- O `arquiteto` escreve a pergunta, as opções e a recomendação; nunca a resposta. O orquestrador leva ao humano no Gate 1 e grava a resposta abaixo de cada pergunta. -->
1. Q1: <pergunta objetiva> — opções: (a) <…> (b) <…>. Recomendação: <…>, porque <…>.
   <!-- Resposta (humano:AAAA-MM-DD): <opção> — <trecho da mensagem do humano>
        Gate 1 delegado: Resposta (Gate 1 delegado, D<n>): <opção> — <motivo> -->
<!-- ou: - Nenhuma. -->

## Questões em aberto
<!-- Só o orquestrador escreve: dúvida surgida depois do Gate 1, com data e quem resolveu. O Gate 1 só aceita este campo vazio. -->
- Nenhuma.

## Rulings
<!-- Só o orquestrador escreve, depois do Gate 1: decisões não previstas neste documento (agentic/processo/ciclo.md, "Rulings"). Ruling não aprova N3. -->
- Nenhuma.
<!-- Quando houver, uma linha por ruling: - R-1 (<fase>): <o quê> — por quê: <…> — descartado: <alternativa> -->
