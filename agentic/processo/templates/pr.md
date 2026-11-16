## Origem
- Intent: <agentic/projeto/intent/NNN-nome.md>
- Task: <agentic/projeto/specs/<nome>/tasks/NNN-nome.md>
- Gate 1: <humano | delegado, D<n>>
- Empilhado sobre: <nenhum | PR anterior — integre nesta ordem>

## Evidência
- RED: <sha> — saída mostrando a falha (resumo)
- GREEN: <sha>
- `verify.sh`:
```
<últimas linhas da saída, incluindo VERIFY: OK>
```

## Tamanho e sensibilidade
- Arquivos alterados: <n> · Linhas: +<a> −<r>
- Caminhos sensíveis tocados: <nenhum | lista>
- Supressões novas (`agentic:permitir-segredo`, skips no baseline…): <nenhuma | lista com justificativa>

## Decisões do orquestrador
<!-- Rulings da seção "## Rulings" da task. No último PR de uma série empilhada, inclua as das tasks anteriores da mesma spec. -->
- R-<n> (<fase>): <o quê> — por quê: <…> — descartado: <…> <!-- promovida: D<n> -->
<!-- ou: - Nenhuma. -->

## Parecer do revisor
- Veredito: <APROVADO>
- Rodadas: <uma por rodada de todos os modos da task: r<k> <modo>: <veredito> · C n I n M n · causas: <valor>=<n> …>
- Achados menores registrados: <lista ou nenhum>
- Parecer: <local, em agentic/.estado/execucao/ | sem plataforma de PR: agentic/projeto/specs/<nome>/pareceres/<NNN>-diff.md>

## O que ficou desconfortável
- <…>

> Merge sem squash (preserva a evidência RED/GREEN). O merge é do humano.
