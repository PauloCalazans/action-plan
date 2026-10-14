# Task 005: parametrizacao-origem-alertas

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** em-andamento
**Branch:** metodologias-e-aval-tecnico/005-admin-indicadores-ui

> **Grupo 3 (decisão do humano, 2026-10-13):** esta task e a(s) task(s) 006, 007 são executadas num único ciclo (um RED, um GREEN, uma revisão de diff) e publicadas num único PR, nesta branch. O escopo do grupo é a união dos "## Arquivos" abaixo; RED, GREEN e critérios de cada task incorporada continuam no documento dela.


## Objetivo
Expor a parametrização por Origem e a designação de Validadores (inclusive a lista padrão corporativa, linha `*`) no `AdministracaoService` e na tela de Administração, e gerar os alertas de prazo da verificação de eficácia (DC-02, DC-04, DC-11).

## Arquivos

### Criados
- `srv/administracao/parametros-origem.ts` (`atualizarParametrosOrigem`, `incluirValidadorOrigem`, `removerValidadorOrigem`; validações e mensagens)
- `srv/alertas/regra-verificacao-eficacia.ts` (regra de `PrazoProximo`/`PrazoVencido` com `entidade = 'VerificacaoEficacia'`; destinatários por `validadoresEfetivos`: com lista, Validadores (+ `responsavelPrincipal` no `PrazoVencido`); `fonte = 'Nenhuma'`, só `responsavelPrincipal` nos dois tipos, DC-11/DV-05)
- `test/metodologias-parametros-alertas.test.ts`

### Modificados
- `srv/administracao-service.cds` (tipo `DetalheParametrosOrigem`; actions; projeções `ParametrosOrigem` e `ValidadoresOrigem`)
- `srv/administracao-service.ts` (handlers)
- `srv/alertas/motor-regras.ts` (`AlertaGerado.entidade` aceita `VerificacaoEficacia`, `prazo?`; `avaliarAlertas` chama a regra nova)
- `srv/alertas/processamento.ts` (prazo da mensagem vem de `alerta.prazo` quando presente; rótulo do tipo indica verificação de eficácia)
- `app/administracao/annotations.cds` (`@title` dos parâmetros novos; `SelectionPresentationVariant#ParametrosOrigem`, `LineItem`, `Identification`, `Facets` e `FieldGroup`; LineItem de `ValidadoresOrigem`; `@title` dos elementos)
- `app/administracao/webapp/manifest.json` (visão `ParametrosOrigem` em `views.paths`, navegação, rota e target `ParametrosOrigemObjectPage`)
- `test/alertas-motor-regras.test.ts` e `test/alertas-despacho-idempotencia.test.ts` (só se a regra nova gerar alerta extra num cenário com asserção exata; o ajuste é filtrar por `entidade`)

### Removidos
- Nenhum.

### Apoio de teste do grupo 3
- `test/apoio/grupo3.ts` (helpers de coleção OData e de erro tipado do grupo 3; sem `expect(`)
- `test/grupo3-suporte.test.ts` (prova que `AdministracaoService`, `AnaliticoService` e `TratativaAppService` estão expostos em OData V4)

### Débito D-01 (execução local, R-19)
- `srv/tratativa/evidencias-storage.ts` (`import()` do módulo de armazenamento por `pathToFileURL(...).href`; hoje `anexarEvidencia` falha na execução local Windows com ERR_UNSUPPORTED_ESM_URL_SCHEME)
- `test/evidencias-storage-carregamento.test.ts` (prova que o módulo é carregado a partir de um caminho absoluto)

### Incorporado da task 006 (006-indicadores-eficacia)
### Criados
- `srv/analitico/eficacia.cds` (view `ParetoCausasRaizesView`)
- `test/metodologias-indicadores.test.ts`

### Modificados
- `srv/analitico-service.cds` (`using` da view; entidade `ParetoCausasRaizes`; tipos e functions `consultarTaxaEficacia`, `consultarTempoMedioVerificacaoEficacia`, `consultarAderenciaMetodologica`)
- `srv/analitico-service.ts` (handlers das três functions; Taxa: duas consultas CQL agregadas no banco, `GROUP BY tratativa_codigo` com `min(emitidoEm)` (todas) e `min(emitidoEm)` de `parecer = 'Aprovado'`, comparação por Tratativa e divisão em TS; Tempo Médio: filtro por período no banco; diferença em dias corridos entre `dataCivil(emitidoEm)` e `dataCivil(dataBaseVerificacao)` no fuso da plataforma (`srv/lib/relogio.ts:2`, `:16-18`) e média em TS. `days_between` (portável) não é usado porque conta sobre os instantes UTC; de `consultarTempoMedioResolucao` (`srv/analitico-service.ts:221-236`, que usa ms) só se segue o padrão de filtrar no banco; DC-14)

### Removidos
- Nenhum.

### Incorporado da task 007 (007-ui-fiori-metodologias-aval)
### Criados
- `app/tratativas/webapp/ext/fragment/MetodologiaSection.fragment.xml`
- `app/tratativas/webapp/ext/controller/MetodologiaExtension.js`
- `app/tratativas/webapp/ext/controller/MetodologiaExtension.controller.js`
- `test/ui-metodologias-aval.test.ts`

### Modificados
- `srv/tratativa-app-service.cds` (r5, DC-19: a `@cds.search` da task 000 ganha `metodologiaAutor: false` e `metodologiaData: false` em `Tratativas`, `causaDescricao: false` em `Acoes` e `validador: false` e `fundamentacao: false` em `AvalesTecnicos`; edição da projeção `Tratativas` em `:9-37` e do bloco de actions em `:37-86`; colunas `causaIdentificador`/`causaDescricao` em `Acoes`; entidades `AvalesTecnicos`, `ValoresFerramentaMetodologia`, `ValoresMacrocausa`, `ValoresParecerAval`; Contrato §5)
- `srv/tratativa-app-service.ts` (regex do before READ em `:97` e `status`/`origem`/`codigo` garantidos para as flags; `this.before('READ', '*', function garantirChaves(req) {...})`, registrado **depois** de `restringirLeitura` da task 000 (r6, I6-01: a varredura vê só a query do cliente), só para não-Gestor, que acrescenta `tratativa_codigo` nos níveis de `Acoes`/`AvalesTecnicos` e `codigo` no de `Tratativas` em `req.query.SELECT.columns` e nas colunas `{ ref, expand }` aninhadas (DC-17); `mascararLeitura` (task 000) passa a montar o contexto em lote com `tratativasComVinculoDiagnostico`, `tratativasComValidadorHabilitado` e `lerSituacaoAval`; flags novas no after READ de `Tratativas`; handlers das três actions delegando a `srv/tratativa/metodologia.ts` e `srv/tratativa/aval-tecnico.ts`; `valoresEnum` para as três listas)
- `srv/tratativa/mascara-app.ts` (task 000; `ContextoMascara` ganha `vinculoDiagnostico`, `validadorHabilitado`, `situacaoAval`; `REGRAS_MASCARA` ganha `TratativaAppService.AvalesTecnicos` (`mascararAvalTecnico`) e os campos `metodologiaData`, `metodologiaAutor`, `Acoes.causaDescricao`; código da Tratativa do nó ausente → campo de vínculo `null` e `vigente` `null`, fail-closed; `filtroVinculo` de `TratativaAppService.Evidencias` ganha a disjunção do Validador Técnico habilitado, r4 I4-01; r5, DC-19: os campos novos entram em `campos` e ficam fora de `liberados` e de `filtraveis`, então a varredura da task 000 recusa com 403 o predicado, a ordenação e o agrupamento sobre eles para o não-Gestor, sem código novo de varredura; `AvalesTecnicos` não é `soGestor` nem `porVinculo`, e `avalesTecnicos/any(...)` só passa com campo não decidido)
- `test/mascara-lgpd-app.test.ts` (task 000; a lista `DECIDIDOS` da guarda CSN ganha `metodologiaData`, `metodologiaAutor`, `causaDescricao`, `AvalesTecnicos.fundamentacao`, `AvalesTecnicos.validador`; `LIBERADOS` não muda, porque nenhum desses fica com valor por regra de leitura (o vínculo os libera por linha, não por entidade); mudança de contrato prevista pela guarda, no mesmo commit do RED; `FILTRAVEIS` não muda; a parte da guarda que confere `@cds.search.<campo> = false` passa a exigir os cinco campos novos de tipo `String`/`LargeString`, r5 DC-19)
- `app/tratativas/annotations.cds` (`causaIdentificador` de `derivarAcaoDaMetodologia` com `@title: 'Causa de origem'` e `@Common.FieldControl: #ReadOnly`, DC-15; botão `Emitir Aval Técnico` em `UI.Identification` com `@UI.Hidden: ocultaEmitirAval`; facet `AvaliacoesTecnicasFacet`; `LineItem` e `@title` de `AvalesTecnicos`; `@title` das colunas novas de `Tratativas` e `Acoes`; parâmetros das três actions com `@title`, `@UI.Placeholder` LGPD e Value Lists; `@Core.OperationAvailable` e `@Common.SideEffects` das actions novas; flags novas nos SideEffects das quatro actions de status)
- `app/tratativas/webapp/manifest.json` (`sap.ui.layout` em `libs`; `sap.ui.controllerExtensions`; `content.body.sections.MetodologiaSection`; Contrato §6)
- `app/tratativas/ui5.yaml` (`sap.ui.layout` em `framework.libraries`)
- `app/tratativas/webapp/i18n/i18n.properties` (título da seção, rótulos e os 12 placeholders da spec, com o texto literal da spec)

### Removidos
- Nenhum.

## Interfaces
- Produz:
  - `POST /api/administracao/v1/atualizarParametrosOrigem` `{ origem, metodologiaSugerida, validadorPadrao, prazoVerificacaoEficaciaDias }`, `incluirValidadorOrigem`/`removerValidadorOrigem` `{ origem, matricula }` → `DetalheParametrosOrigem`; `GET .../ParametrosOrigem` e `.../ValidadoresOrigem`, só para `Administrador`.
  - `validadorPadrao` é rótulo descritivo sem efeito de autorização nem de destinatário (decisão 5, R-08). A lista padrão corporativa é `ValidadoresOrigem` da linha `*`, mantida pelo Administrador com `origem = '*'` nas mesmas actions (`normalizarTexto('*') = '*'`); a linha `*` aparece na visão `ParametrosOrigem` como "Padrão global".
  - Validações: `origem` obrigatória até 100; `validadorPadrao` obrigatório até 100; `metodologiaSugerida` vazia ou do catálogo; prazo de 1 a 180 (`O campo Prazo de verificação aceita de 1 a 180.`); matrícula por `validarMatricula`.
  - Alertas `PrazoProximo`/`PrazoVencido` com `entidade = 'VerificacaoEficacia'` em `AlertasEmitidos`.
- Consome:
  - `lerSituacaoAval` e `validadoresEfetivos` (task 002); `normalizarTexto`, `validarMatricula`.

## N3 aprovados no Gate 1
- N3-5 (design): designação de Validadores por Origem mantida pelo Administrador.
- N3-6 (design): actions novas do `AdministracaoService` e valor `VerificacaoEficacia` em `AlertasEmitidos`.
- N3-4 (design): conteúdo neutro das mensagens e matrícula dos Validadores restrita ao Administrador.

## Critérios de pronto

### Etapa 1: serviço de Administração e alertas
- **RED** (`test(red): parametrizacao por origem e alertas de eficacia`), em `test/metodologias-parametros-alertas.test.ts`:
  - CA27: Administrador configura `Qualidade` com `PDCA/8D`, `Inspetor da Qualidade`, 45 dias; `GET ParametrosOrigem` devolve os valores. Gestor e `usuario` recebem 403 `Acesso negado.` em consulta e alteração; prazo 0 ou 181 → 400.
  - CA17 (R7 c/e): Origem com lista que contém só `validador` → `validador-b` (tem o papel, não está na lista) e `gestor` recebem 403 `Acesso negado.` ao emitir Aval numa Tratativa dessa Origem; `validador-b` também recebe 403 ao baixar Evidência; `validador` emite.
  - Lista padrão (`*`): Administrador inclui `validador-b` com `origem = '*'`; numa Tratativa de Origem sem lista própria e numa avulsa, `validador-b` emite e `validador` recebe 403; `removerValidadorOrigem({ origem: '*', matricula: 'validador-b' })` volta ao caso sem lista. Sem nenhuma lista, qualquer `ValidadorTecnico` emite (R7 c). `validadorPadrao` alterado não muda quem emite (rótulo, R-08).
  - Habilitação em lote (DC-17, `tratativasComValidadorHabilitado` da task 002): com Avales emitidos em Tratativas de duas Origens, uma com lista `[validador]` e outra com lista `[validador-b]`, `consultarAvalTecnicoTratativa` traz a `fundamentacao` a `validador` só na primeira e a `validador-b` só na segunda.
  - Prazo da Origem: Origem com 45 dias muda `dataLimiteVerificacao` de `consultarAvalTecnicoTratativa`.
  - CA26: verificação ativa vencendo em 2 dias → rotina (`executarRotinaAlertas`, `test/apoio/alertas.ts`) gera `PrazoProximo`/`VerificacaoEficacia` para o Validador da lista (e não para o Responsável Principal).
  - CA37: verificação vencida → `PrazoVencido` ao Validador e ao Responsável Principal, de novo no dia seguinte (reenvio diário), sem mudar o status da Tratativa.
  - DV-05 (R-08) e CA37 sem lista (R3-M05): sem nenhuma lista (Origem sem lista e linha `*` vazia), `PrazoProximo` e `PrazoVencido` vão ao Responsável Principal e a nenhum outro destinatário; com a verificação vencida, a rotina gera `PrazoVencido`/`VerificacaoEficacia` ao Responsável Principal no primeiro dia e, com o relógio avançado um dia (CONVENCOES itens 21-22), de novo no segundo dia, numa segunda linha de `AlertasEmitidos` (chave de idempotência diária, `srv/alertas/processamento.ts:169`); rodar a rotina duas vezes no mesmo dia não duplica; o status da Tratativa não muda; sem lista e sem Responsável Principal, nenhum alerta `VerificacaoEficacia` para a Tratativa.
  - Sem alerta quando há Aval aprovado vigente, Ação aberta ou exigência pós-reprovação pendente.
- **GREEN** (`feat(green): parametrizacao por origem e alertas de eficacia`): serviço, handlers, regra e anotações de rótulo (o teste genérico de rótulos de `test/ui-acabamento.test.ts:645-688` cobre o `AdministracaoService`).

### Etapa 2: tela de Administração
- **RED** (`test(red): tela de parametros por origem`): `manifest.json` tem `ParametrosOrigemObjectPage` em `targets` e numa rota, e a visão `ParametrosOrigem` em `views.paths` (padrão de `test/ui-administracao.test.ts:187-202`); CSN: `AdministracaoService.ParametrosOrigem` tem `@UI.LineItem`, `@UI.Identification` com `atualizarParametrosOrigem`, `incluirValidadorOrigem`, `removerValidadorOrigem`, e `@title` em todos os elementos.
- **GREEN** (`feat(green): tela de parametros por origem`): `app/administracao/annotations.cds` e `app/administracao/webapp/manifest.json`.
- **Verificação visual:** `cds watch` na raiz, persona `admin` (`DEV_USER=admin`), app Administração no portal do Maestri: abrir a visão "Parâmetros por Origem", criar `Qualidade` (PDCA/8D, 45 dias), incluir e remover um Validador, conferir a tabela atualizada; abrir a linha "Padrão global" (`*`) e incluir/remover um Validador da lista padrão.

- CAs cobertos: CA17 (lista da Origem que não inclui o usuário), CA26, CA27, CA37; designação de DC-01; destinatários de DC-11 (DV-05).
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Nenhuma.
