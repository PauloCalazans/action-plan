## Origem
- Intent: <intent/NNN-nome.md>
- Task: <docs/specs/<nome>/tasks/NNN-nome.md>

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

## Parecer do revisor
- Veredito: <APROVADO>
- Achados menores registrados: <lista ou nenhum>

## O que ficou desconfortável
- <…>

> Merge sem squash (preserva a evidência RED/GREEN). O merge é do humano.
