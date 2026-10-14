# Task 001: modelo-seguranca-base

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** draft
**Branch:** metodologias-e-aval-tecnico/001-modelo-seguranca-base

## Objetivo
Criar o modelo persistido do 016 (tipos, colunas aditivas, `AvalesTecnicos`, `ParametrosOrigem`, `ValidadoresOrigem`, baseline `*`), catalogar os quatro eventos novos do histórico e formalizar o papel `ValidadorTecnico` (xs-security, mocked, persona de dev).

## Arquivos

### Criados
- `db/data/br.com.calazanstec-ParametrosOrigem.csv`
- `test/metodologias-modelo-seguranca.test.ts`

### Modificados
- `db/tratativa.cds`
- `srv/tratativa/historico-catalogo.ts`
- `xs-security.json`
- `package.json`
- `test/apoio/auth-dev.js`
- `test/ui-acabamento.test.ts` (lista exata de usuários mocked em `:353-355` ganha `validador` e `validador-b`)

### Removidos
- Nenhum.

## Interfaces
- Produz:
  - Tipos `br.com.calazanstec.FerramentaMetodologia`, `MacrocausaCausaRaiz`, `ParecerAvalTecnico`; valores `DefinicaoMetodologia`, `EdicaoMetodologia`, `EmissaoAvalTecnico` em `EventoHistorico`; `CriacaoAcaoComCausa` em `EventoHistoricoAcao`; `VerificacaoEficacia` em `EntidadeAlerta` (design, Contrato §1).
  - Colunas `Tratativas.metodologia`, `categoriaCausaRaiz`, `metodologiaData`, `metodologiaAutor`, `metodologiaAtualizadoEm`; `Acoes.causaIdentificador`, `causaDescricao`; `HistoricoTratativa.avalTecnico`, com `@PersonalData.IsPotentiallyPersonal` onde o design indica.
  - Entidades `AvalesTecnicos`, `ParametrosOrigem` (linha baseline `*`), `ValidadoresOrigem`.
  - `CATALOGO_EVENTOS` com `DefinicaoMetodologia`, `EdicaoMetodologia`, `EmissaoAvalTecnico` (origem `Tratativa`) e `CriacaoAcaoComCausa` (origem `Acao`).
  - Escopo `$XSAPPNAME.ValidadorTecnico`, role template `ValidadorTecnico`, role collection `ActionPlan_ValidadorTecnico` (descrições sem nome de departamento).
  - Usuários mocked `validador` e `validador-b` (`roles: ["ValidadorTecnico"]`) em `[test]` e `[papeis]`; persona `validador` em `PERSONAS` de `test/apoio/auth-dev.js`.
- Consome:
  - Modelo existente de `db/tratativa.cds` (Tratativas, Acoes, HistoricoTratativa, HistoricoAcoes).

## N3 aprovados no Gate 1
- N3-1 (design): modelo persistido aditivo e baseline de `ParametrosOrigem`.
- N3-2 (design): papel `ValidadorTecnico` em `xs-security.json`, usuários mocked e persona de dev.
- N3-4 (design): anotações `@PersonalData` dos campos novos.

## Critérios de pronto
- **RED** (`test(red): modelo e papel validador do 016`), em `test/metodologias-modelo-seguranca.test.ts`:
  - CSN de `cds.load('db')`: os tipos e valores de enum acima; as colunas novas com `@PersonalData.IsPotentiallyPersonal` em `metodologiaData`, `metodologiaAutor`, `causaDescricao`, `AvalesTecnicos.fundamentacao`, `AvalesTecnicos.validador`, `ValidadoresOrigem.matricula`; `ParametrosOrigem.prazoVerificacaoEficaciaDias` com `@assert.range [1, 180]` e default 30.
  - CSV: existe a linha `*` com prazo 30 e sem nome de departamento.
  - `xs-security.json`: escopo, role template e role collection `ValidadorTecnico` com as referências corretas; nenhuma ocorrência de `SESMT|Qualidade|RH|Compliance`.
  - `package.json`: `validador` e `validador-b` com `ValidadorTecnico` em `[test]` e `[papeis]`; `[production]` sem usuário mocked.
  - `test/apoio/auth-dev.js` com `DEV_USER=validador` injeta `ValidadorTecnico`.
  - HTTP: `consultarHistoricoTratativa(tipoEvento='EmissaoAvalTecnico')`, `'DefinicaoMetodologia'`, `'EdicaoMetodologia'` e `'CriacaoAcaoComCausa'` respondem 200 (hoje 400 `Tipo de evento inválido.`).
  - Ajuste de `test/ui-acabamento.test.ts` (lista de usuários) no mesmo commit.
- **GREEN** (`feat(green): modelo e papel validador do 016`): edições de `db/tratativa.cds`, CSV, catálogo, `xs-security.json`, `package.json`, `auth-dev.js`; `npm run build` limpo (log no relatório da task).
- CAs cobertos: CA16 (credencial do papel reconhecida pelo runtime; a emissão é da task 002); estrutura de persistência de R13 (a configuração CA27 é da task 005).
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Nenhuma.
