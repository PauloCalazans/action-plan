# Task 006: indicadores-eficacia

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** agrupada (grupo 3, executada com a task 005)
**Branch:** metodologias-e-aval-tecnico/005-admin-indicadores-ui

## Objetivo
Publicar no `AnaliticoService` o Pareto de Causas Raízes, a Taxa de Eficácia, o Tempo Médio de Verificação de Eficácia e a Aderência Metodológica (R15, R20 e).

## Arquivos

### Criados
- `srv/analitico/eficacia.cds` (view `ParetoCausasRaizesView`)
- `test/metodologias-indicadores.test.ts`

### Modificados
- `srv/analitico-service.cds` (`using` da view; entidade `ParetoCausasRaizes`; tipos e functions `consultarTaxaEficacia`, `consultarTempoMedioVerificacaoEficacia`, `consultarAderenciaMetodologica`)
- `srv/analitico-service.ts` (handlers das três functions; Taxa: duas consultas CQL agregadas no banco, `GROUP BY tratativa_codigo` com `min(emitidoEm)` (todas) e `min(emitidoEm)` de `parecer = 'Aprovado'`, comparação por Tratativa e divisão em TS; Tempo Médio: filtro por período no banco; diferença em dias corridos entre `dataCivil(emitidoEm)` e `dataCivil(dataBaseVerificacao)` no fuso da plataforma (`srv/lib/relogio.ts:2`, `:16-18`) e média em TS. `days_between` (portável) não é usado porque conta sobre os instantes UTC; de `consultarTempoMedioResolucao` (`srv/analitico-service.ts:221-236`, que usa ms) só se segue o padrão de filtrar no banco; DC-14)

### Removidos
- Nenhum.

## Interfaces
- Produz:
  - `GET /api/analitico/v1/ParetoCausasRaizes` (`categoriaCausaRaiz`, `total`; agregação no banco).
  - `GET /api/analitico/v1/consultarTaxaEficacia(periodoInicio='AAAA-MM-DD',periodoFim='AAAA-MM-DD')` → `{ taxaPercentual }`; idem `consultarTempoMedioVerificacaoEficacia` → `{ mediaDias }` e `consultarAderenciaMetodologica` → `{ percentual }`.
- Consome:
  - Colunas `metodologia`, `categoriaCausaRaiz` (task 001), `AvalesTecnicos.emitidoEm`/`dataBaseVerificacao` (task 002), definição de metodologia (task 004) e `emitirAval` de `test/apoio/aval.ts` no preparo.

## N3 aprovados no Gate 1
- N3-6 (design): operações novas do `AnaliticoService`.

## Critérios de pronto
- **RED** (`test(red): indicadores de eficacia e causas raizes`), em `test/metodologias-indicadores.test.ts` (relógio fixado em período exclusivo e asserção por delta, CONVENCOES itens 21-22):
  - CA30: Pareto agrupado pelas macrocausas, com os totais das Tratativas do teste; `usuario` sem papel analítico recebe 403.
  - CA40: 10 Tratativas no período, 7 com metodologia → `percentual = 70`.
  - Taxa de Eficácia (DC-14: primeiro Aval da Tratativa em todo o histórico, filtrado pelo período): no período, duas Tratativas com primeiro Aval `Aprovado` e uma com primeiro `Reprovado` (depois aprovada no mesmo período) → 66,67. Uma quarta Tratativa reprovada **antes** do período e aprovada **dentro** dele não entra no universo (o resultado continua 66,67); universo vazio → 0.
  - CA39 (parte do indicador): Tratativa sem Ações iniciada em 2026-10-13 com Aval em 2026-10-23 → `mediaDias = 10`.
  - Data civil (DC-14): Tratativa iniciada em 2026-10-13 às 10h (São Paulo) com Aval em 2026-10-23 às 22h30 (São Paulo; 2026-10-24 01h30 UTC) → `mediaDias = 10`, e não 11.
  - Período invertido → 400 `target: periodoInicio` (`validarFiltros`).
- **GREEN** (`feat(green): indicadores de eficacia e causas raizes`).
- CAs cobertos: CA30, CA39 (tempo médio), CA40.
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Nenhuma.
