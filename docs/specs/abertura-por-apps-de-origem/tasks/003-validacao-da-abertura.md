# Task 003: validacao-da-abertura

**Spec:** docs/specs/abertura-por-apps-de-origem/spec.md
**Status:** publicada
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/003-validacao-da-abertura

## Objetivo
Recusar a abertura com dado obrigatório ausente, Criticidade fora da lista ou par Origem/ID_Origem incompleto, com HTTP 400, `target` do campo e mensagem que nomeia o campo, sem gravar nada (R7, R13, R14).

## Arquivos
- `srv/tratativa/validacao.ts`
- `srv/tratativa/abertura.ts`
- `test/validacao-abertura.test.ts`

Nenhum outro arquivo: os handlers não mudam, porque a validação vive dentro de `abrirTratativa` e a exigência do par deriva de `autor.tipo` (design, decisão 6). Os apoios de teste de T001/T002 são só consumidos.

## Interfaces
- Produz: `srv/tratativa/validacao.ts` — `validarAbertura(dados: DadosAbertura, exigeOrigem: boolean): void` (assinatura fixa em `design.md` › decisão 6), que lança erro com `status: 400`, `target` (nome do parâmetro) e a mensagem fixa da decisão 6. Ordem: `titulo`, `criticidade` ausente, `criticidade` inválida, `origem`, `idOrigem`. Texto só com espaços = ausente. Com `exigeOrigem = true`, `origem` e `idOrigem` são obrigatórios (sem nenhum dos dois → `target = 'origem'`); com `false`, ambos devem estar ausentes (senão 400, `target = 'origem'`).
- Altera: `srv/tratativa/abertura.ts` — primeira instrução de `abrirTratativa` passa a ser `validarAbertura(dados, autor.tipo === 'Aplicativo')`, antes de qualquer leitura de prazo ou escrita. A assinatura de `abrirTratativa` não muda.
- Consome: `abrirTratativa`, `DadosAbertura`, `Autor` (T002); `test/apoio/*` (T001, T002).

## RED (papel `testes`)
`test/validacao-abertura.test.ts` (com `registrarCredenciais()` no `beforeAll`; sem importar `srv/`), todos via `POST /api/integracao-origem/v1/abrirTratativa` como `app-origem-a`:
- CA12: sem `titulo` → 400, `error.target = 'titulo'`, mensagem contém `Título`; também com `titulo: '   '`.
- CA28: sem `criticidade` → 400, `target = 'criticidade'`, mensagem contém `Criticidade`.
- CA5: `criticidade: 'Urgente'` → 400, `target = 'criticidade'`.
- CA14: `idOrigem` sem `origem` → 400, `target = 'origem'`.
- CA27: `origem` sem `idOrigem` → 400, `target = 'idOrigem'`.
- M5 (derivado de R13/R14: o aplicativo sempre envia o par): sem `origem` e sem `idOrigem` → 400, `target = 'origem'`.
- Em todos: nenhuma linha nova em `Tratativas`, `ChavesOrigem` e `HistoricoTratativa`.
Falha esperada no RED: status 500 ou 200 (sem validação, o banco recusa `NOT NULL` ou aceita o valor) onde se espera 400 com `target`.

## GREEN (papel `dev`)
Implementar `validarAbertura` e chamá-la em `abrirTratativa`. Os valores válidos de Criticidade vêm do tipo `Criticidade` do modelo (R7), não de uma lista repetida no código.

## N3 aprovados no Gate 1
- N3-7 (design): contrato de erros da abertura.

## Critérios de pronto
- CA5, CA12, CA14, CA27, CA28; aplicativo sem o par recusado.
- `sh scripts/agentic/verify.sh` verde.

## Questões em aberto
- Nenhuma.
