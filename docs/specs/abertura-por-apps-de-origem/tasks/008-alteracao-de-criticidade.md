# Task 008: alteracao-de-criticidade

**Spec:** docs/specs/abertura-por-apps-de-origem/spec.md
**Status:** em-andamento
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/008-alteracao-de-criticidade

## Objetivo
Entregar a regra R12 como operação interna (sem endpoint): nova Criticidade recalcula a Data prevista desde a criação original e grava histórico; e provar que nenhum evento do 002 gera comunicação de saída (R5).

## Arquivos
- `srv/tratativa-interna-service.cds`
- `srv/tratativa-interna-service.ts`
- `srv/tratativa/criticidade.ts`
- `test/alteracao-criticidade.test.ts`
- `test/sem-comunicacao-de-saida.test.ts`

## Interfaces
- Produz:
  - `TratativaInternaService` com `@protocol: 'none'` (`design.md` › "`srv/tratativa-interna-service.cds`"): `action alterarCriticidade(codigo, criticidade, autor, tipoAutor)`. Chamado só em processo: `(await cds.connect.to('TratativaInternaService')).send('alterarCriticidade', {...})`. O 003 expõe a operação a usuários chamando este serviço.
  - `srv/tratativa/criticidade.ts`: `alterarCriticidade(codigo: string, nova: string, autor: Autor): Promise<void>` — Criticidade inválida → 400 (`target = 'criticidade'`); Tratativa inexistente → 404; mesma Criticidade → nada muda e nada é gravado; senão atualiza `criticidade` e `dataPrevistaConclusao = somarDiasCorridos(dataCriacao, dias da nova)` e grava duas linhas `AlteracaoCriticidade` (`campo` `criticidade` e `dataPrevistaConclusao`, valores anterior/novo, `autor`, `tipoAutor`, `quando = agora()`), tudo numa transação. `dataCriacao` e `codigo` nunca mudam.
- Consome: `somarDiasCorridos`, `diasDoPrazo` (T002); `relogio` (T002); `abrirTratativa` e repetição (T002, T004); `TratativaService` (T007), cujo `$metadata` o teste de CA11 confere. **Depende de T004 e T007 integradas.**

## RED (papel `testes`)
Sem importar `srv/` (o serviço interno é obtido por `cds.connect.to`). Toda chamada ao serviço interno é feita como asserção, para que o RED falhe por `expect` e não por exceção solta (M13): 
  - existência do serviço: `await expect(cds.connect.to('TratativaInternaService')).resolves.toBeDefined()`;
  - chamada com sucesso: `const interno = cds.connect.to('TratativaInternaService');` e `await expect(interno.then(s => s.send('alterarCriticidade', {...}))).resolves.toBeUndefined()` (a action não tem retorno);
  - chamada com erro: `await expect(interno.then(s => s.send('alterarCriticidade', {...}))).rejects.toMatchObject({ status: 400 })` (ou `404`).
  Depois de cada `resolves`, conferir o banco.
`test/alteracao-criticidade.test.ts`:
- CA11: abre `Baixa` com `fixarInstante('2026-10-07T12:00:00-03:00')` (→ 2026-11-06); com `fixarInstante('2026-10-20T10:00:00-03:00')` altera para `Crítica` (autor `sistema-teste`, `Sistema`) → `dataPrevistaConclusao = 2026-10-10`, `dataCriacao = 2026-10-07`, `codigo` igual; duas linhas de histórico com valores `Baixa`→`Crítica` e `2026-11-06`→`2026-10-10`, autor e `quando` = instante fixado.
- Mesma Criticidade → nenhuma linha nova de histórico.
- Criticidade `Urgente` → `rejects.toMatchObject({ status: 400 })`; Código inexistente → `rejects.toMatchObject({ status: 404 })`.
- Sem operação pública: `$metadata` de `/api/integracao-origem/v1`, `/api/tratativa/v1` e `/api/administracao/v1` não contém `alterarCriticidade`; o serviço interno tem `endpoints` vazio.
`test/sem-comunicacao-de-saida.test.ts`:
- CA3: com `jest.spyOn(globalThis, 'fetch')` e `jest.spyOn(https, 'request')` — `https` obtido como objeto real do módulo: `// eslint-disable-next-line @typescript-eslint/no-require-imports` + `const https = require('node:https') as typeof import('node:https');` (não usar `import * as https`, cuja cópia de namespace não é o objeto usado pelo runtime) —, executar criação, pedido repetido (R16) e alteração de Criticidade → zero chamadas nos dois spies; nenhum serviço em `cds.services` é instância de `cds.RemoteService`.
Falha esperada no RED: asserção `expect(cds.connect.to('TratativaInternaService')).resolves` falha (serviço inexistente) e, em consequência, as asserções de `resolves`/`rejects` sobre `alterarCriticidade`.

## GREEN (papel `dev`)
Transcrever o CDS do serviço interno e implementar handler e regra. Nenhum cliente HTTP, SDK ou `srv/integracoes/`.

## N3 aprovados no Gate 1
- N3-1 (design): escrita em `Tratativas` e `HistoricoTratativa` (tabelas de T001).
- N3-8 (design): `autor` no histórico.

## Critérios de pronto
- CA3, CA11.
- `sh scripts/agentic/verify.sh` verde.

## Questões em aberto
- Nenhuma. A operação exposta a usuários e quem pode usá-la são do intent 003.
