# Spec: <nome>

**Intent:** agentic/projeto/intent/<NNN-nome>.md
**Status:** draft

## Regras
| # | Regra | Fonte | Estado |
|---|---|---|---|
| R1 | <regra de negócio> | <humano:AAAA-MM-DD \| oráculo:arquivo:linha \| plano:arquivo:linha \| decisão:Dn> | <confirmada \| hipótese> |

## Critérios de aceite
- CA1 (R1): <dado … quando … então …>

## Invariantes (o que não muda)
- <comportamento existente que deve permanecer>

## Fora de escopo
- <item>

## Questionário de decisão
1. <pergunta objetiva derivada de uma hipótese> — opções: (a) <…> (b) <…>. Recomendação: <…>, porque <…>.
   <!-- Gate 1 delegado: coberto pelo plano, a regra passa a confirmada com Fonte plano:<arquivo>:<linha>; não coberto, Resposta (Gate 1 delegado, D<n>): <opção> — <motivo>, e a regra passa a confirmada com Fonte decisão:D<n>. -->

## Questões em aberto
- <dúvida surgida durante a execução — registrar data e quem resolveu>

## Divergências
- <spec × código, legado ou spec aprovada × proposta, com a pergunta do Questionário (`Q<n>`) e, depois do Gate 1, a resolução>
