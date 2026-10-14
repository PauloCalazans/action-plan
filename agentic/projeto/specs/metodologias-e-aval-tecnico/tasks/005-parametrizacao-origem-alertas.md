# Task 005: parametrizacao-origem-alertas

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** draft
**Branch:** metodologias-e-aval-tecnico/005-parametrizacao-origem-alertas

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
