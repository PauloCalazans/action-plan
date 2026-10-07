# Task 005: consulta-pelo-aplicativo

**Spec:** docs/specs/abertura-por-apps-de-origem/spec.md
**Status:** em-andamento
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/005-consulta-pelo-aplicativo

## Objetivo
Permitir ao aplicativo consultar uma Tratativa pelo Código ou pelo par (Origem, ID_Origem), recebendo só os sete campos de R19, e "não encontrada" (404) quando não existe.

## Arquivos
- `srv/integracao-origem-service.cds`
- `srv/integracao-origem-service.ts`
- `srv/tratativa/consulta.ts`
- `test/consulta-aplicativo.test.ts`

## Interfaces
- Produz:
  - Acrescenta ao `IntegracaoOrigemService` o tipo `ConsultaTratativa` e as functions `consultarPorCodigo(codigo : UUID)` e `consultarPorOrigem(origem : String(100), idOrigem : String(50))` — transcrição de `design.md` › "`srv/integracao-origem-service.cds`".
  - `srv/tratativa/consulta.ts`: `consultarPorCodigo(codigo: string)` e `consultarPorOrigem(origem: string, idOrigem: string)` devolvem `{ codigo, origem, idOrigem, criticidade, status, dataCriacao, dataPrevistaConclusao } | undefined`; o par usa `normalizarOrigem` (T004). O handler responde 404 `Tratativa não encontrada.` quando `undefined`. `consultarPorCodigo` valida antes o formato UUID (regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, sem diferenciar caixa) e responde 400 `Código inválido.` com `target = 'codigo'` (decisão 14: o runtime não valida, medido).
- Consome: `normalizarOrigem`, `buscarPorPar` (T004); dados criados por `abrirTratativa` (T002).

## RED (papel `testes`)
`test/consulta-aplicativo.test.ts` (com `registrarCredenciais()`; sem importar `srv/`):
- CA21: abrir e consultar pelo Código → 200 com **exatamente** as chaves `codigo`, `origem`, `idOrigem`, `criticidade`, `status`, `dataCriacao`, `dataPrevistaConclusao` (ignorando anotações `@odata.*`); valores iguais aos gravados; sem `descricao`, `titulo`, `solicitante`, `autor`.
- CA22: consultar pelo par → mesmos campos e valores; também com Origem variando caixa/espaços nas pontas (R15).
- CA23: Código v4 aleatório inexistente → 404 com mensagem `Tratativa não encontrada.`; par inexistente → 404.
- Decisão 16: `consultarPorCodigo(codigo='abc')` → 400, `error.target = 'codigo'`, mensagem `Código inválido.`.
- `$metadata` do serviço: `ConsultaTratativa` só com as sete propriedades (LGPD, N3-6).
Falha esperada no RED: 404 de rota inexistente / ausência do tipo onde se espera 200 com os campos.

## GREEN (papel `dev`)
Transcrever o trecho do CDS e implementar as duas functions. Nenhuma consulta lista Tratativas.

## N3 aprovados no Gate 1
- N3-6 (design): contrato público de consulta.
- N3-8 (design): consulta não revela dado pessoal.

## Critérios de pronto
- CA21, CA22, CA23; Código mal formado → 400.
- `sh scripts/agentic/verify.sh` verde.

## Questões em aberto
- Nenhuma.
