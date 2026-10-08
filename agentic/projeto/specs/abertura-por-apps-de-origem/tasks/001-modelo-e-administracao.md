# Task 001: modelo-e-administracao

**Spec:** agentic/projeto/specs/abertura-por-apps-de-origem/spec.md
**Status:** publicada
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/001-modelo-e-administracao

## Objetivo
Criar o modelo persistido do 002, a tabela global de prazos com valores iniciais e o `AdministracaoService`, em que só o Administrador lê e altera prazos e emite/revoga credenciais de aplicativo (R10, R11, R18 — parte administrativa).

## Arquivos
- `db/tratativa.cds`
- `db/data/br.com.calazanstec-PrazosCriticidade.csv`
- `srv/administracao-service.cds`
- `package.json`
- `eslint.config.mjs`
- `agentic/projeto/decisoes.md`
- `test/administracao.test.ts`
- `test/genericidade-lint.test.ts`
- `test/apoio/usuarios.ts`

## Interfaces
- Produz:
  - Modelo `br.com.calazanstec`: `Tratativas`, `ChavesOrigem`, `PrazosCriticidade`, `HistoricoTratativa`, `CredenciaisAplicativo` e tipos `Criticidade`, `StatusTratativa`, `EventoHistorico`, `TipoAutor` — transcrição exata de `design.md` › "`db/tratativa.cds`".
  - Dados iniciais 3/7/15/30 (`design.md` › CSV).
  - `AdministracaoService` em `/api/administracao/v1` (`design.md` › "`srv/administracao-service.cds`"): `PrazosCriticidade` READ/UPDATE, `CredenciaisAplicativo` READ/CREATE/UPDATE, só papel `Administrador`.
  - Usuários mockados em `package.json` › `cds.requires.auth` `[development]` (`design.md` › "`package.json`"): `app-origem-a`, `app-origem-b`, `app-revogado`, `admin`, `usuario`.
  - Regra ESLint de genericidade (`design.md` › "`eslint.config.mjs`").
  - `test/apoio/usuarios.ts`: opções de requisição `semAuth`, `comoApp`, `comoAppB`, `comoAppRevogado`, `comoAdmin`, `comoUsuario` (todas com `validateStatus: () => true`), reutilizadas pelas tasks seguintes.
  - Entradas D6, D7, D8 em `agentic/projeto/decisoes.md` (texto em `design.md` › "Decisões de plataforma"), com data do Gate 1.
- Consome: nada (primeira task).

## RED (papel `testes`)
`test/administracao.test.ts`, via `cds.test` e HTTP, sem importar nada de `srv/`:
- GET `PrazosCriticidade` como `admin` devolve exatamente `{ Crítica: 3, Alta: 7, Média: 15, Baixa: 30 }` (R10).
- PATCH `PrazosCriticidade('Alta')` `{ dias: 5 }` como `admin` → 200 e o valor lido passa a 5 (R11).
- CA10: o mesmo PATCH como `usuario` → 403 e como `app-origem-a` → 403; sem autenticação → 401; o valor não muda.
- POST e DELETE em `PrazosCriticidade` como `admin` são recusados (status 4xx) — a lista de Criticidades é fixa (R7).
- POST `CredenciaisAplicativo` `{ usuarioTecnico: 'app-novo' }` como `admin` → 201 com `ativa = true`; PATCH `{ ativa: false }` → 200 (R18, emissão e revogação); POST como `usuario` → 403.
Falha esperada no RED: 404 (serviço inexistente) onde se espera 200/403.

`test/genericidade-lint.test.ts` (prova automatizada da regra da decisão 13; M11): roda o ESLint do projeto em processo filho — `spawnSync(process.execPath, [path.join(raiz, 'node_modules', 'eslint', 'bin', 'eslint.js'), '--stdin', '--stdin-filename', 'srv/fixture-genericidade.ts', '--format', 'json'], { cwd: raiz, input, encoding: 'utf8' })` — e lê `JSON.parse(stdout)[0].messages`:
- trecho `export const x = 'Advertência';` + ``export const y = `SESMT`;`` → exatamente 2 mensagens `no-restricted-syntax`;
- trecho `export const x = 'Auditoria';` → 0 mensagens.
Não usar a API `ESLint` em processo (medido: falha sob jest por exigir `--experimental-vm-modules`) nem `require.resolve('eslint/bin/eslint.js')` (bloqueado pelo `exports` do pacote). O arquivo fixture não existe em disco (`--stdin`). Falha esperada no RED: 0 mensagens `no-restricted-syntax` onde se esperam 2.

## GREEN (papel `dev`)
Transcrever os arquivos do design citados acima; acrescentar o bloco `cds` ao `package.json` e o bloco de genericidade ao `eslint.config.mjs`; registrar D6–D8. Sem handler TypeScript nesta task.

## N3 aprovados no Gate 1
- N3-1 (design): modelo persistido novo e dados iniciais.
- N3-2 (design): papel `Administrador` e `@requires`/`@restrict` do `AdministracaoService`.
- N3-5 (design): `cds.requires.auth` `[development]` mockado.
- N3-8 (design): anotações `@PersonalData` e `managed` (IDs de usuário).
- N3-9 (design): nenhuma dependência nova (`package.json` muda só no bloco `cds`).
- N3-12 (design): contrato OData de `/api/administracao/v1` (entity sets `PrazosCriticidade` e `CredenciaisAplicativo`).

## Critérios de pronto
- CA10; R10 (valores iniciais); R11 (alteração pelo Administrador); R18 (emissão e revogação pela plataforma).
- `npm run lint` recusa literal com nome de Origem/área em `srv/**/*.ts` (decisão 13), provado por `test/genericidade-lint.test.ts`.
- D6 registrada com o escopo delimitado a serviços consumidos por terceiros (texto do design).
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Nenhuma. H4 (seed no HANA) foi adiado ao intent 014 e não bloqueia: não há deploy nesta spec.
