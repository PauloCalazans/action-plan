# Task 003: encerramento-com-aval

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** agrupada (grupo 2, executada com a task 002)
**Branch:** metodologias-e-aval-tecnico/002-aval-encerramento-metodologias

## Objetivo
Extinguir `Aberta → Encerrada`, exigir Aval aprovado vigente para encerrar (com a mensagem própria após reabertura), refletir a regra em `podeEncerrar` do App, provar o legado e migrar os testes existentes que encerram Tratativa.

## Arquivos

### Criados
- `test/apoio/encerramento.ts` (helper `encerrarComAval(enviar, codigo, opcoes)`: inicia se `Aberta`, emite Aval `Aprovado` como `validador`, encerra como `gestor`; devolve a resposta do encerramento; sem `expect(`)
- `test/apoio/legado.ts` (helper `semearTratativaEncerradaLegada()` que grava por `cds.db` uma Tratativa `Encerrada` sem `AvalesTecnicos`; exceção nomeada DC-09 ao item 5 da CONVENCOES)
- `test/metodologias-encerramento.test.ts`

### Modificados
- `srv/tratativa/ciclo-de-vida.ts` (remove `'Aberta|Encerrada'` de `TRANSICOES`; 409 próprio para encerrar de `Aberta` antes da tabela; após o 409 de Ações abertas, exige Aval aprovado vigente via `lerSituacaoAval`)
- `srv/tratativa-app-service.ts` (`podeEncerrar`/`ocultaEncerrar` = Gestor, `Em andamento`, sem Ação aberta, Aval aprovado vigente; cálculo em lote)
- `test/CONVENCOES.md` (item 15: encerrar exige `encerrarComAval`; item 5: registro da exceção DC-09 (CA32, só por `test/apoio/legado.ts`) e menção às exceções preexistentes, não migradas nesta task: `test/edicao-tratativa.test.ts:36`, `test/criticidade-gestor.test.ts:39`, `test/criacao-acoes.test.ts:52`, `test/edicao-acoes.test.ts:133-134`, `test/evidencias-consultas-download.test.ts:292`)
- `test/ajustes-revisao-tratativa.test.ts`
- `test/alertas-motor-regras.test.ts`
- `test/analitico-correcao-revisao.test.ts`
- `test/analitico-executivo-evidencias.test.ts`
- `test/analitico-gestao-metricas.test.ts`
- `test/analitico-operacional-lgpd.test.ts`
- `test/autorizacao-execucao-acoes.test.ts`
- `test/ciclo-de-vida-acoes.test.ts`
- `test/comentarios-auditoria-concorrencia.test.ts`
- `test/comentarios-tratativa.test.ts`
- `test/criticidade-gestor.test.ts`
- `test/delegacao-acoes.test.ts`
- `test/edicao-tratativa.test.ts`
- `test/evidencias-anexo.test.ts`
- `test/evidencias-anexo-complemento.test.ts`
- `test/evidencias-remocao.test.ts`
- `test/historico-consulta-unificada.test.ts`
- `test/historico-precedencia-imutabilidade.test.ts`
- `test/responsaveis-tratativa.test.ts`
- `test/transicoes-tratativa.test.ts` (encerramento direto de `Aberta` passa a esperar 409 com a mensagem da spec; `:70`, `:222-224`)
- `test/ui-acabamento.test.ts` (`podeEncerrar`/`ocultaEncerrar` em `Aberta`: `:175`, `:716`, `:720`)

### Removidos
- Nenhum.

## Interfaces
- Produz:
  - `mudarStatus` (TratativaService e App) e `encerrarTratativa` (App) com a regra nova; mensagens 409 de R8 c, R8 d e R11 d.
  - Flags `podeEncerrar`/`ocultaEncerrar` coerentes com a regra (R20, nota de UI).
  - Helpers `encerrarComAval` e `semearTratativaEncerradaLegada`.
- Consome:
  - `lerSituacaoAval` (task 002); `emitirAval`/`comoValidador` de `test/apoio/aval.ts` (task 002).

## N3 aprovados no Gate 1
- N3-3 (design): fim de `Aberta → Encerrada`, encerramento com Aval aprovado vigente, `podeEncerrar` do App e migração dos testes.

## Critérios de pronto
- **RED** (`test(red): encerramento exige aval tecnico aprovado`):
  - `test/metodologias-encerramento.test.ts`: CA18 (sem Aval → 409 `Tratativa não pode ser encerrada: exige Aval Técnico aprovado.`, status continua `Em andamento`); CA19 (Aval aprovado + encerramento posterior pelo Gestor → `Encerrada`); CA23 (após `Reprovado`, encerrar → 409); CA33 (reaberta e encerrada sem novo Aval → 409 `... exige novo Aval Técnico aprovado emitido após a reabertura.`; com Aval novo → aceita); CA42 (encerrar de `Aberta` → 409 com a mensagem da spec, por `mudarStatus` e por `encerrarTratativa` do App); CA6 (fluxo completo sem metodologia: iniciar, criar e concluir Ação, Aval, encerrar); CA32 (legado semeado continua `Encerrada` em `consultarTratativa` e `consultarAvalTecnicoTratativa` responde sem vigente); `podeEncerrar` do App (`GET /api/app/v1/Tratativas(<id>)?$select=podeEncerrar,ocultaEncerrar`) falso em `Aberta`, falso em `Em andamento` sem Aval, verdadeiro com Aval aprovado.
  - Os 21 testes existentes migrados no mesmo commit (encerram por `encerrarComAval`; asserções invertidas onde a spec inverte). Conforme CONVENCOES item 25, a migração que já passa antes do GREEN vai num commit `test(support)` separado.
- **GREEN** (`feat(green): encerramento exige aval tecnico aprovado`): `ciclo-de-vida.ts` e `tratativa-app-service.ts`.
- CAs cobertos: CA6, CA18, CA19, CA23 (bloqueio do encerramento), CA32, CA33, CA42 (encerramento de Aberta).
- `sh agentic/mecanismos/scripts/verify.sh` verde (toda a suíte, inclusive os 21 migrados).

## Questões em aberto
- Nenhuma.
