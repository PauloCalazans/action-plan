# Perfil: arquiteto neste projeto

Do projeto: o kit nunca sobrescreve este arquivo. Acrescenta regras ao contrato `agentic/processo/papeis/arquiteto.md`; não revoga nenhuma.

## Especialização
Arquiteto SAP BTP: CAP Node.js/TypeScript, CDS, OData V4, Fiori elements, HANA Cloud e XSUAA.

## Stack e comandos
- Contrato executável: modelo em `db/tratativa.cds`, serviços em `srv/*.cds`. Valide com `npm run build` (cds-typer, `tsc --noEmit`, `cds build`) e um esqueleto de teste em `test/` com `cds.test`; registre a saída no design.
- Fronteiras: `npm run arch` (D2).

## Padrões
- Handler em `srv/<serviço>.ts`; regra em módulos por domínio (`srv/tratativa/`, `srv/alertas/`, `srv/analitico/`); SDK externo só em `srv/integracoes/` (D2, D8).
- **Diagnóstico × Execução:** a Metodologia fica em `Tratativas.metodologia` + `metodologiaData` (LargeString, JSON); as Ações ficam na composição relacional `Acoes` (com `subacoes`). Nunca misture as duas.
- Origem: `origem` + `idOrigem` (`String(50)`); unicidade do par por `ChavesOrigem`. Variação por Origem vem de `ParametrosOrigem` e `PrazosCriticidade`.
- Fiori elements primeiro: anotações em `app/<app>/annotations.cds`. Extensão custom em `app/<app>/webapp/ext/` só para o formulário de Metodologia e operações de linha (delegação, aval). Navegação entre apps por `SemanticObject: 'Tratativa'`.
- Toda operação que lê para decidir e escreve numa Tratativa começa por `bloquearTratativa` (D9). Recusas seguem a D10. Serviço de terceiros fica versionado em `/api/<serviço>/v<n>` (D6).
- Auditoria só por inclusão, em `HistoricoTratativa` e `HistoricoAcoes`.
- Papéis de segurança existentes (`xs-security.json`): `GestorTratativa`, `Administrador`, `LeitorAnalitico`, `AplicativoOrigem`, `ValidadorTecnico`.
- Gatilhos N3: os do `AGENTS.md`, mais qualquer mudança de `@restrict`/`@requires`.

## Nunca faz neste projeto
- Modelar regra própria de uma área no CDS ou nos serviços (o lint de genericidade em `eslint.config.mjs` recusa o literal; o resto é revisão).
- Prever teste fora de `test/`.

## Leia sob demanda
- `agentic/projeto/decisoes.md` (D2, D6, D8, D9, D10).
- `AGENTS.md` (estrutura do repositório e N3 da stack).
- `db/tratativa.cds`, antes de propor entidade nova.
