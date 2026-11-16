# Design: <nome>

**Spec:** agentic/projeto/specs/<nome>/spec.md
**Status:** draft

## Decisões
<!-- numere 1, 2, 3… sem o prefixo `D`: o prefixo é das decisões do projeto (agentic/projeto/decisoes.md) -->
1. <decisão> — **Por quê:** <…> — **Verificado por:** <mecanismo | por revisão>

## Contrato executável
- O que é: <interfaces/tipos/schemas/rotas criados>
- Como se valida: `<comando>`
- Saída da validação (medido):
```
<saída>
```
- Declaração de corpos: <!-- todo corpo do contrato que não é o stub da stack, com o porquê; esperado: vazia ou só acesso trivial a dado -->
  - Nenhum.

## Impacto
<!-- Toda linha `medido` (das buscas do `## Impacto` do brief, conferida no trecho, com arquivo:linha). Sem impacto fora dos arquivos novos: escreva `- Nenhum (só arquivos novos).` -->
| Alterado (símbolo, rota, schema, regra) | Quem usa hoje (arquivo:linha, medido) | Em ## Arquivos de | Teste existente afetado | Regra de outra spec → emenda |
|---|---|---|---|---|
| <símbolo alterado> | <arquivo:linha> | <task NNN> | <teste ou "nenhum"> | <spec e regra, ou "nenhuma"> |

## Tasks
| Task | Objetivo | Branch |
|---|---|---|
| tasks/001-<nome>.md | <…> | <spec>/001-<nome> |

## Itens N3 (aprovação no Gate 1)
<!-- Todo gatilho N3 (agentic/processo/ciclo.md, "Escalonamento N3"; AGENTS.md, "Gatilhos de escalonamento") já visível neste design. Sem itens: deixe a tabela sem linhas. O humano aprova CADA item explicitamente no Gate 1; item aprovado aqui não exige nova parada durante a task — só N3 novo, fora desta lista, interrompe. -->
| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | <o que muda> | <contrato público, segurança, migração destrutiva, dependência nova, caminho protegido ou gatilho da stack> | <aprovado em AAAA-MM-DD, ou recusado> |

## Como isso se prova
- <qual teste/verificação demonstra cada critério de aceite>

## O que não muda
- <componentes e comportamentos preservados>

## O desconfortável, declarado
- <risco, limitação ou aposta que o leitor deve conhecer>
