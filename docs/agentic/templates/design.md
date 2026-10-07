# Design: <nome>

**Spec:** docs/specs/<nome>/spec.md
**Status:** draft

## Decisões
1. <decisão> — **Por quê:** <…> — **Verificado por:** <mecanismo | por revisão>

## Contrato executável
- O que é: <interfaces/tipos/schemas/rotas criados>
- Como se valida: `<comando>`
- Saída da validação (medido):
```
<saída>
```

## Tasks
| Task | Objetivo | Branch |
|---|---|---|
| tasks/001-<nome>.md | <…> | <spec>/001-<nome> |

## Itens N3 (aprovação no Gate 1)
<!-- Todo gatilho N3 (docs/agentic/ciclo.md, "Escalonamento N3"; AGENTS.md, "Gatilhos de escalonamento") já visível neste design. Sem itens: deixe a tabela sem linhas. O humano aprova CADA item explicitamente no Gate 1; item aprovado aqui não exige nova parada durante a task — só N3 novo, fora desta lista, interrompe. -->
| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | <o que muda> | <contrato público, segurança, migração destrutiva, dependência nova, caminho protegido ou gatilho da stack> | <aprovado em AAAA-MM-DD, ou recusado> |

## Como isso se prova
- <qual teste/verificação demonstra cada critério de aceite>

## O que não muda
- <componentes e comportamentos preservados>

## O desconfortável, declarado
- <risco, limitação ou aposta que o leitor deve conhecer>
