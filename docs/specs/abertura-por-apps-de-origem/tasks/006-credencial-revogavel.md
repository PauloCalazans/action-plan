# Task 006: credencial-revogavel

**Spec:** docs/specs/abertura-por-apps-de-origem/spec.md
**Status:** em-andamento
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/006-credencial-revogavel

## Objetivo
Recusar com 401, sem gravar nem revelar nada, todo pedido ao `IntegracaoOrigemService` cuja identidade não esteja ativa em `CredenciaisAplicativo` (R18).

## Arquivos
- `srv/integracao-origem-service.ts`
- `srv/lib/credencial-aplicativo.ts`
- `test/credencial-aplicativo.test.ts`

## Interfaces
- Produz: `srv/lib/credencial-aplicativo.ts` — `credencialAtiva(usuarioTecnico: string): Promise<boolean>`; `before('*')` no `IntegracaoOrigemService` rejeita com status 401 quando falso, antes de qualquer leitura ou escrita de Tratativa (decisão 10). O cliente recebe só o status 401 com corpo `Unauthorized`: o CAP 10.1.1 responde todo 401 com `res.sendStatus(401)` e descarta qualquer mensagem (`node_modules/@sap/cds/lib/srv/middlewares/errors.js:18-19`).
- Consome: `CredenciaisAplicativo` e `AdministracaoService` (T001); `abrirTratativa` (T002); consultas (T005); `registrarCredenciais()` (T002).

## RED (papel `testes`)
`test/credencial-aplicativo.test.ts` (com `registrarCredenciais()`; sem importar `srv/`):
- CA32: `app-revogado` → abertura com status 401, corpo `Unauthorized` e nenhuma linha nova; consulta por Código e por par de uma Tratativa existente → status 401 e corpo `Unauthorized`, cujo texto não contém nenhum valor da Tratativa (Código, Origem, ID_Origem, Criticidade, datas). Não afirmar mensagem própria.
- Revogação em tempo de execução: `admin` põe `ativa = false` em `app-origem-b` pelo `AdministracaoService`; o pedido seguinte de `app-origem-b` → 401.
- Aplicativo autenticado com o papel, mas sem registro: apagar direto no banco (`cds.db`) a linha de `app-origem-b` em `CredenciaisAplicativo`; o pedido seguinte de `app-origem-b` → 401 e nenhuma linha nova. Rodar este caso por último no arquivo (ou restaurar a linha).
- CA19 e CA20: sem autenticação → 401 com corpo `Unauthorized` na abertura e nas duas consultas, sem dados (já garantido pelo runtime; regressão).
Falha esperada no RED: 200 (sem verificação de registro) onde se espera 401. O arquivo falha pelos casos de revogação; os casos sem autenticação já passam (guardas de regressão).

## GREEN (papel `dev`)
Implementar `credencialAtiva` e o `before('*')`. Nada de credencial de produção, `xs-security.json` ou dependência nova (N3-10 fica fora).

## N3 aprovados no Gate 1
- N3-4 (design): verificação do registro de credenciais a cada pedido; 401 (corpo `Unauthorized`) para ausente/revogada.

## Critérios de pronto
- CA19, CA20, CA32.
- `sh scripts/agentic/verify.sh` verde.

## Questões em aberto
- Nenhuma. H1 (mecanismo de produção) foi adiado ao intent 014 e não bloqueia: a verificação é sobre `req.user.id`, qualquer que seja o provedor.
