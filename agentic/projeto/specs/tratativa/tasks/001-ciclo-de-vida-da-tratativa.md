# Task 001: ciclo-de-vida-da-tratativa

**Spec:** agentic/projeto/specs/tratativa/spec.md
**Status:** pendente
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** tratativa/001-ciclo-de-vida-da-tratativa

## Objetivo
Entregar o intent 003 inteiro numa branch, em quatro etapas sequenciais RED/GREEN: transições de Status, consulta e listagem para usuários, edição, e alteração de Criticidade pelo Gestor com os ajustes de robustez da regra interna (autor, serialização, campo nas recusas), conforme `agentic/projeto/specs/tratativa/design.md`.

## Arquivos
- `jest.config.js`
- `agentic/projeto/decisoes.md`
- `db/tratativa.cds`
- `package.json`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/tratativa-interna-service.ts`
- `srv/tratativa/abertura.ts`
- `srv/tratativa/criticidade.ts`
- `srv/tratativa/recusa.ts`
- `srv/tratativa/dominios.ts`
- `srv/tratativa/normalizacao.ts`
- `srv/tratativa/bloqueio.ts`
- `srv/tratativa/historico.ts`
- `srv/tratativa/ciclo-de-vida.ts`
- `srv/tratativa/edicao.ts`
- `srv/tratativa/listagem.ts`
- `test/apoio/usuarios.ts`
- `test/apoio/banco-espiao.ts`
- `test/apoio/tratativas.ts`
- `test/transicoes-tratativa.test.ts`
- `test/consulta-listagem-tratativa.test.ts`
- `test/edicao-tratativa.test.ts`
- `test/criticidade-gestor.test.ts`
- `test/sem-comunicacao-de-saida-ciclo.test.ts`

## Interfaces
- Produz:
  - `TratativaService` (`/api/tratativa/v1`) com o CDS da seção "`srv/tratativa-service.cds` (arquivo completo)" do design, acrescentado por etapa: `Tratativas` + `mudarStatus` (etapa 1), `ItemListagem`, `DetalheTratativa`, `listarTratativas`, `consultarTratativa` (etapa 2), `editar` (etapa 3), `mudarCriticidade` (etapa 4). O `@restrict` do entity set lista, em cada etapa, só as actions já existentes. Ao final o arquivo é idêntico ao do design.
  - Domínio com as assinaturas fixas da decisão 14 do design (`recusa.ts`, `dominios.ts`, `normalizacao.ts`, `bloqueio.ts`, `historico.ts`, `ciclo-de-vida.ts`, `edicao.ts`, `listagem.ts`; `criticidade.ts` alterado).
  - Contrato de erros da seção "Contrato de erros do `TratativaService`" do design (mensagens exatas, `target`, HTTP).
  - Decisões de plataforma D9 e D10 em `agentic/projeto/decisoes.md` (texto da seção "Decisões de plataforma a registrar" do design).
  - Para os intents 004 e 005: `bloquearTratativa`, `exigirAlteravel`, `validarAutor`, `registrarHistorico`, `recusar` e o papel `GestorTratativa`.
- Consome (002, já integrado): `abrirTratativa`, `Autor`, `TipoAutor` (`srv/tratativa/abertura.ts`); `somarDiasCorridos`, `diasDoPrazo` (`prazo.ts`); `agora`, `dataCivil` (`srv/lib/relogio.ts`); `TratativaInternaService.alterarCriticidade`; helpers de teste `test/apoio/banco.ts`, `credenciais.ts`, `relogio.ts`, `usuarios.ts`.

## Regras para todas as etapas
- **Commits por etapa:** `test(red): <etapa> …` só com arquivos de `test/` (e, se preciso, este documento); depois `feat(green): <etapa> …` só com produção. `refactor:` opcional depois do GREEN. Nunca alterar um teste de commit `test(red):` (inclusive os do 002).
- **Cada RED cria um arquivo de teste novo** (listado na etapa): o `verifica-red.sh` prova cada RED por arquivo e exige que cada arquivo de teste tocado falhe no commit RED.
- **Helpers em `test/apoio/` não contêm `expect(`** (o `verifica-red.sh` trataria o helper como arquivo de teste e tentaria rodá-lo). As asserções ficam nos `*.test.ts`.
- **Testes não importam `srv/`** (RED falha por asserção, não por compilação). O serviço interno é obtido por `cds.connect.to('TratativaInternaService')`, sempre dentro de `expect(...).resolves`/`.rejects` (M13 do 002).
- **"Nada muda / nenhum histórico"** é conferido lendo o banco com `linhas(...)` de `test/apoio/banco.ts`, antes e depois.
- **Massa isolada por sufixo único** (`Date.now()` + contador) em Origem, ID_Origem, Unidade ou Título, porque o banco em memória é compartilhado pelos testes do mesmo arquivo.
- Rodar `sh agentic/mecanismos/scripts/verify.sh` ao fim de cada GREEN (obrigatório ao fim da etapa 4).

## Etapa 0 — `chore:` tempo limite global do jest
- `jest.config.js`: acrescentar `testTimeout: 60000, // a primeira subida do cds.test passa de 5 s (design tratativa, decisão 15)` depois de `testMatch` (design, seção "`jest.config.js`"). Commit `chore: testTimeout global de 60 s no jest (design tratativa, decisão 15)`. Sem RED (correção de ferramental, sem mudança de comportamento).

## Etapa 1 — Status e transições (`mudarStatus`)
**CAs:** CA2, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10, CA11, CA12, CA13, CA14, CA15, CA16, CA17, CA18 (transições), CA19 (transições), CA20, CA21, CA22, CA23 (escrita), CA46, CA47 (Justificativa), CA64, CA66, CA67, CA68, CA73, CA77.

**RED (papel `testes`)** — commit `test(red): transições de Status da Tratativa pelo Gestor (R1-R10, R21, R29, R31)`:
- `test/apoio/usuarios.ts`: acrescentar `export const comoGestor = como('gestor');` (sem mudar os existentes).
- `test/apoio/banco-espiao.ts` (novo, sem `expect`): `instalarEspiao()` registra uma vez `cds.db.before('*', …)` e devolve `{ comandos, limpar(), falharEm(evento, entidade), naoFalhar() }`; cada comando = `{ evento: req.event, entidade: req.target?.name, forUpdate: Boolean(req.query?.SELECT?.forUpdate) }`; `falharEm('CREATE', 'br.com.calazanstec.HistoricoTratativa')` faz o hook lançar `Error('falha simulada')` enquanto ativo. Função pura `bloqueiaAntesDeEscrever(comandos): boolean` = o primeiro comando cuja entidade é `br.com.calazanstec.Tratativas` é `READ` com `forUpdate` e nenhum `UPDATE`/`CREATE`/`DELETE` vem antes dele. Chamar `instalarEspiao()` num `beforeAll` depois de `cds.test(...)` (medido no rascunho).
- `test/apoio/tratativas.ts` (novo, sem `expect`): helpers que devolvem a resposta HTTP crua, recebendo as funções `POST`/`GET` do `cds.test` do arquivo: `criarAvulsa(POST, dados?)`, `abrirPorApp(POST, dados?)` e `mudarStatus(POST, codigo, corpo, como)` (URL `/api/tratativa/v1/Tratativas(<codigo>)/mudarStatus`).
- `test/transicoes-tratativa.test.ts` (novo):
  - CA2-CA6, CA14, CA16: `comoGestor` → 204 e Status novo no banco para cada par válido; iniciar sem justificativa; encerrar `Aberta` direto; cancelar `Aberta` e `Em andamento` com justificativa; reabrir com justificativa.
  - CA7-CA10: `Cancelada` → reabrir/iniciar/encerrar; `Em andamento` → `Em andamento`; `Encerrada` → `Cancelada`; `Em andamento` → `Aberta`: 409, mensagem exata `Transição não permitida: de <atual> para <pedido>.`, `target = 'status'`, Status e contagem de histórico inalterados.
  - CA11-CA13: sem justificativa, `'   '`, 501 caracteres → 400 `target = 'justificativa'`, mensagem contém `Justificativa`; nada muda.
  - CA15: `fixarInstante('2026-10-07T12:00:00-03:00')`, avulsa `Alta` (→ 2026-10-14), iniciar, encerrar; `fixarInstante('2026-10-20T10:00:00-03:00')`, reabrir → `Em andamento`, `criticidade = 'Alta'`, `dataPrevistaConclusao = '2026-10-14'`.
  - CA17, CA18, CA19, CA68: `comoUsuario`, `comoAdmin`, `comoApp` (com `registrarCredenciais()`) → 403; `semAuth` → 401; Status e histórico inalterados.
  - CA20, CA21, CA77: linha de histórico com `campo = 'status'`, `valorAnterior`, `valorNovo`, `autor = 'gestor'`, `tipoAutor = 'Usuario'`, `quando` = instante fixado, `justificativa` informada (aparada) ou `null`; `evento` = `MudancaStatus` (Aberta→Em andamento), `Encerramento`, `Reabertura`, `Cancelamento`; `Aberta`→`Encerrada` sem justificativa aceita; `Aberta`→`Cancelada` sem justificativa recusada.
  - CA22: `falharEm('CREATE', HistoricoTratativa)` → status ≥ 500; Status inalterado; nenhum histórico novo; depois `naoFalhar()`.
  - CA23: `DELETE`, `PATCH` em `Tratativas(<codigo>)` e `POST` em `Tratativas` como `comoGestor` e `comoAdmin` → 405; a Tratativa continua no banco.
  - CA46 + D9: dois `mudarStatus` simultâneos (`Promise.all`) para `Encerrada` numa `Em andamento` → statuses `[204, 409]` em qualquer ordem, o 409 com `Transição não permitida: de Encerrada para Encerrada.`, um único `Encerramento`; e, num pedido isolado, `bloqueiaAntesDeEscrever(comandos)` verdadeiro.
  - CA64: `abrirPorApp`, Gestor encerra, `GET /api/integracao-origem/v1/consultarPorCodigo(codigo=<c>)` como `comoApp` → sete chaves (sem `@odata…`) e `status = 'Encerrada'`.
  - CA66: Origem `Auditoria de Qualidade` e avulsa → iniciar e encerrar → 204 nas duas.
  - CA67: Aberta → Em andamento → Encerrada → Em andamento → Cancelada (instantes crescentes com `fixarInstante`) → quatro linhas de transição em ordem de `quando` com eventos `MudancaStatus`, `Encerramento`, `Reabertura`, `Cancelamento`.
  - CA73: `comoUsuario` cancela `Encerrada` sem justificativa → 403; `comoGestor` → 409 `Transição não permitida: de Encerrada para Cancelada.` (não 400).
  - Status ausente: `{}` → 400 `O campo Status é obrigatório.`, `target = 'status'`.
- Falha esperada no RED: `gestor` não existe no perfil mockado (401) e a rota `Tratativas(...)/mudarStatus` não existe.

**GREEN (papel `dev`)** — commit `feat(green): transições de Status da Tratativa com bloqueio e histórico (R1-R10, R21)`:
- `db/tratativa.cds`: o diff inteiro da seção "`db/tratativa.cds` (diff sobre o atual)" do design (todas as colunas e valores de enum, mesmo os usados só nas etapas 2-3: um único passo de modelo, N3-1).
- `package.json`: usuário `gestor` (design, seção "`package.json`"; preservar os demais e as quebras de linha do arquivo).
- `srv/tratativa-service.cds`: entity set `Tratativas` (`@readonly`, `{ key codigo }`) com `mudarStatus` e `@restrict` com `grant: ['mudarStatus']`.
- `srv/tratativa-service.ts`: `before('*')` registrado **antes** de qualquer outro handler: `AplicativoOrigem` → 403 (`criarTratativaAvulsa`: `Aplicativo de origem não cria Tratativa avulsa.`; demais eventos: `Aplicativo de origem não usa este serviço.`), substituindo o `before('criarTratativaAvulsa')` atual; `on('mudarStatus', 'Tratativas')` → `mudarStatus(String(req.params[0].codigo).toLowerCase(), req.data, { id: req.user.id, tipo: 'Usuario' })`.
- `srv/tratativa/recusa.ts`, `dominios.ts`, `bloqueio.ts`, `historico.ts`, `ciclo-de-vida.ts` com as assinaturas e a ordem das decisões 6, 7, 8, 11 e 14 do design. `bloquearTratativa` usa `SELECT.from(...).where({ codigo }).forUpdate()` sem `.one`/`limit`.
- `agentic/projeto/decisoes.md`: D9 e D10 (texto do design).

## Etapa 2 — Consulta e listagem (`listarTratativas`, `consultarTratativa`)
**CAs:** CA1, CA23 (leitura), CA47 (filtro de Status), CA48, CA49, CA50, CA51, CA52, CA53, CA54, CA55, CA56, CA57, CA58, CA59, CA60, CA61, CA62, CA63, CA69, CA70, CA71.

**RED** — commit `test(red): consulta e listagem de Tratativas para usuários (R23-R28)`:
- `test/consulta-listagem-tratativa.test.ts` (novo), via `GET /api/tratativa/v1/listarTratativas(...)` (parâmetros com `encodeURIComponent`) e `consultarTratativa(codigo=<c>)`:
  - CA1: avulsa recém-criada → `status = 'Aberta'`.
  - CA48, CA70: `comoUsuario` lista com e sem filtros → itens sem as chaves `descricao`/`solicitante`, `titulo` presente; consulta → `descricao` e `solicitante` `null`.
  - CA61, CA69: `comoGestor` consulta Tratativa com Descrição e Solicitante → doze chaves (sem `@odata…`) com os valores; nenhuma chave de histórico.
  - CA49: `comoApp` (credencial registrada) → 403 nas duas functions.
  - CA50: Código aleatório → 404 `Tratativa não encontrada.`; `codigo=abc` → 400 `target = 'codigo'`.
  - CA51-CA54, CA71: massa própria (sufixo único em ID_Origem e Unidade) com Origens `Advertência` e outra, Criticidades, Status (via `mudarStatus`), Unidades `Planta A`/outras e Áreas `Manutenção`/outras; filtros: Origem `"  advertência "` → todos os itens com `origem` igual a `Advertência` ignorando caixa e espaços, e inclui os da massa; Origem `Advertencia` → nenhum da massa; Criticidade `Alta` + Status `Aberta` → só os que cumprem as duas; ID_Origem + Unidade + Área → só a combinação; Unidade `"  planta a "` + Área `MANUTENÇÃO` → encontra; Área `Manutencao` → não encontra; ID_Origem em outra caixa → não encontra.
  - CA55, CA47: `status='Pendente'` → 400 `target = 'status'`; `criticidade='Urgente'` → 400 `target = 'criticidade'`.
  - CA56: sem filtro (paginando até o fim) inclui uma avulsa e uma de aplicativo criadas no teste.
  - CA57, CA58: `fixarInstante` no mesmo dia: `Crítica`, `Alta`, `Baixa` com Unidade única → ordem por Data prevista; `Baixa` em 2026-10-07 e `Média` em 2026-10-22 (mesma Data prevista 2026-11-06) → a de 2026-10-07 primeiro.
  - CA59: 120 avulsas com Unidade única; filtro por essa Unidade sem `tamanhoPagina` → 50; `pagina=2` → 50; `pagina=3` → 20; sem repetição de Código; `tamanhoPagina=201` → 400 `target = 'tamanhoPagina'`; `pagina=0` → 400 `target = 'pagina'`.
  - CA60: chaves de cada item (sem `@odata…`) = exatamente as dez de `ItemListagem`.
  - CA62, CA63: o detalhe não tem chave além das doze (nenhum número sequencial); `origem`/`idOrigem` são `string` ou `null` (nunca array); `$metadata` do `DetalheTratativa` sem `Collection(`.
  - CA23 (leitura): `GET Tratativas` e `GET Tratativas(<codigo>)` como `comoGestor` → 405.
- Falha esperada no RED: functions inexistentes (404) e leitura do entity set respondendo 200.

**GREEN** — commit `feat(green): consulta e listagem de Tratativas com Descrição e Solicitante só para o Gestor (R23-R28)`:
- `srv/tratativa-service.cds`: `ItemListagem`, `DetalheTratativa`, `listarTratativas`, `consultarTratativa` (texto do design).
- `srv/tratativa-service.ts`: `before('READ', 'Tratativas')` → 405 `Use as functions listarTratativas e consultarTratativa.`; `on('listarTratativas')` → `listarTratativas(req.data)`; `on('consultarTratativa')` → `consultarTratativa(req.data.codigo, req.user.is('GestorTratativa'))`.
- `srv/tratativa/normalizacao.ts`, `srv/tratativa/listagem.ts` (decisões 12, 13 e 14).
- `srv/tratativa/abertura.ts`: gravar `origemNormalizada`, `unidadeNormalizada`, `areaNormalizada` com `normalizarTexto` no `INSERT` de `Tratativas` (nada mais muda).

## Etapa 3 — Edição (`editar`)
**CAs:** CA17-CA19 (edição), CA24, CA25, CA26, CA27, CA28, CA29, CA31, CA32, CA33, CA34, CA35, CA47 (Título), CA72, CA74.

**RED** — commit `test(red): edição de Tratativa pelo Gestor com histórico por campo (R12-R17)`:
- `test/edicao-tratativa.test.ts` (novo), via `POST /api/tratativa/v1/Tratativas(<c>)/editar`:
  - CA24: Gestor altera os cinco campos → 204; `consultarTratativa` como Gestor devolve os novos; filtro da listagem pela Unidade e Área novas (com outra caixa) encontra a Tratativa.
  - CA25: `unidade: null` apaga; `area: '   '` apaga.
  - CA26, CA47: `titulo: null` e `titulo: '  '` → 400 `target = 'titulo'`, mensagem contém `Título`; Título anterior permanece.
  - CA27 e tamanhos: Título 201, Descrição 5001, Unidade 101, Área 101, Solicitante 51 → 400 com `target` do campo; nada muda.
  - CA28, CA34: cada um de `codigo`, `origem`, `idOrigem`, `dataCriacao`, `status`, `criticidade`, `dataPrevistaConclusao` → 400; nada muda.
  - CA29: `Encerrada` → 409 `Tratativa Encerrada não pode ser alterada.`; o mesmo com Título de 201 caracteres (estado antes de campo); `Cancelada` → `Tratativa Cancelada não pode ser alterada.`; inexistente → 404.
  - CA31: só Unidade `Planta A` → `Planta B` → exatamente uma linha `Edicao` com `campo = 'unidade'`, valores, `autor = 'gestor'`, `tipoAutor = 'Usuario'`, `quando`.
  - CA32: reenvio dos mesmos valores e corpo vazio → 204, nenhuma linha nova.
  - CA33: Descrição alterada → linha `campo = 'descricao'` com `valorAnterior` e `valorNovo` `null`.
  - CA35: avulsa criada por `usuario` sem Solicitante → `solicitante` `null` (diferente de `usuario`); Gestor define o Solicitante → linha `Edicao` com a matrícula.
  - CA17-CA19 (edição): `comoUsuario`, `comoApp` → 403; `semAuth` → 401; nada muda.
  - CA72 + D9: `editar` (Título) e `mudarStatus(Encerrada)` simultâneos numa `Em andamento` → ou (204, 204) com o Título novo e `Edicao` antes de `Encerramento` por `quando`/ordem, ou (409 da edição, 204) com o Título antigo e nenhuma `Edicao`; nunca Título novo com `Edicao` posterior ao `Encerramento`; e `bloqueiaAntesDeEscrever` verdadeiro num `editar` isolado.
  - CA74: `falharEm('CREATE', HistoricoTratativa)` numa edição de Título e Unidade → status ≥ 500; nenhum dos dois muda; nenhuma linha nova.
- Falha esperada no RED: action `editar` inexistente.

**GREEN** — commit `feat(green): edição de Tratativa pelo Gestor com histórico por campo (R12-R17)`:
- `srv/tratativa-service.cds`: action `editar`; `@restrict` com `['mudarStatus', 'editar']`.
- `srv/tratativa-service.ts`: `on('editar', 'Tratativas')` → `editarTratativa(codigo, req.data, autor)`.
- `srv/tratativa/edicao.ts` (decisão 9).

## Etapa 4 — Criticidade pelo Gestor e robustez da regra interna (`mudarCriticidade`)
**CAs:** CA18, CA19 (Criticidade), CA30, CA36, CA37, CA38, CA39, CA40, CA41, CA42, CA43, CA44, CA45, CA47 (Criticidade, Tipo de autor, Autor), CA65, CA75, CA76.

**RED** — commit `test(red): alteração de Criticidade pelo Gestor e validação de autor na regra interna (R14, R18-R22)`:
- `test/criticidade-gestor.test.ts` (novo):
  - CA36: `fixarInstante('2026-10-07T12:00:00-03:00')` avulsa `Baixa`; `fixarInstante('2026-10-20T10:00:00-03:00')` Gestor `mudarCriticidade` `Crítica` → 204; `dataPrevistaConclusao = '2026-10-10'`; duas linhas `AlteracaoCriticidade` (`criticidade` e `dataPrevistaConclusao`) com valores, `autor = 'gestor'`, `tipoAutor = 'Usuario'`, `quando`.
  - CA37: `Em andamento` → aceito. CA38: mesma Criticidade → 204 e nenhuma linha.
  - CA39, CA18, CA19: `comoUsuario`, `comoApp` → 403; `semAuth` → 401; Criticidade inalterada.
  - CA40, CA41, CA47: `Urgente` e corpo sem `criticidade` → 400 `Criticidade inválida: use Baixa, Média, Alta ou Crítica.`, `target = 'criticidade'`; nada gravado.
  - CA30: `Cancelada` → 409 `Tratativa Cancelada não pode ser alterada.`; também com `Urgente` (estado antes de campo).
  - CA42-CA44, CA47 (serviço interno, `cds.connect.to('TratativaInternaService')`): `tipoAutor: 'Robô'` → `rejects.toMatchObject({ status: 400, target: 'tipoAutor' })` e mensagem contém `Tipo de autor`; `autor: ''` e `autor: '  '` → `{ status: 400, target: 'autor' }`; `Sistema` com autor válido → `resolves`, histórico `tipoAutor = 'Sistema'`; nada gravado nas recusas.
  - CA76: Tratativa `Encerrada` e `Cancelada` (via `mudarStatus`) → regra interna com `Sistema` → `rejects.toMatchObject({ status: 409 })` e mensagem `Tratativa <Status> não pode ser alterada.`; nada gravado.
  - CA45 + D9: `Baixa`; `Promise.all` de `mudarCriticidade` `Alta` e `Crítica` → ambos 204; Criticidade final e Data prevista coerentes (`Alta` com +7 ou `Crítica` com +3 dias sobre `dataCriacao`); quatro linhas `AlteracaoCriticidade` em cadeia (a linha `criticidade` com `valorAnterior = 'Baixa'` é a primeira; a outra tem `valorAnterior` igual ao `valorNovo` da primeira e `valorNovo` igual à Criticidade final; o mesmo para as datas); `bloqueiaAntesDeEscrever` verdadeiro num `mudarCriticidade` isolado e numa chamada isolada da regra interna.
  - CA75: `falharEm('CREATE', HistoricoTratativa)` → status ≥ 500; Criticidade e Data prevista inalteradas.
- `test/sem-comunicacao-de-saida-ciclo.test.ts` (novo), CA65: mesmo padrão de `test/sem-comunicacao-de-saida.test.ts` (`https` por `require('node:https')` com o comentário de ESLint; `fetch` filtrado para fora de localhost) durante `mudarStatus`, `editar` e `mudarCriticidade` de uma Tratativa aberta por aplicativo → zero chamadas externas; todas as operações 204.
- Falha esperada no RED: action `mudarCriticidade` inexistente; a regra interna aceita `Robô`, autor vazio e Tratativa encerrada, e não pede `forUpdate`.

**GREEN** — commit `feat(green): alteração de Criticidade pelo Gestor reutilizando a regra interna com bloqueio, R14 e R20 (R18-R22)`:
- `srv/tratativa-service.cds`: action `mudarCriticidade`; `@restrict` com as três actions (arquivo final = design).
- `srv/tratativa-service.ts`: `on('mudarCriticidade', 'Tratativas')` → `alterarCriticidade(codigo, req.data.criticidade, autor)` (função de domínio, mesma transação).
- `srv/tratativa/criticidade.ts`: ordem da decisão 10 (`validarAutor` → `bloquearTratativa` → `exigirAlteravel` → Criticidade → mesma Criticidade → recálculo → `registrarHistorico`), usando `recusar` e `criticidadesValidas` compartilhados.
- `srv/tratativa-interna-service.ts`: só se o tipo dos argumentos precisar acompanhar a nova assinatura (sem regra no handler).
- Ao final: `sh agentic/mecanismos/scripts/verify.sh` verde, inclusive toda a suíte do 002.

## N3 aprovados no Gate 1
- N3-1 (design): colunas e valores de enum novos em `db/tratativa.cds` (etapa 1).
- N3-2 (design): papel `GestorTratativa` e `@restrict` das actions ligadas (etapas 1, 3, 4).
- N3-3 (design): usuário mockado `gestor` no `package.json` (etapa 1).
- N3-4 (design): `AplicativoOrigem` recusado com 403 em todo o `TratativaService` (etapas 1, 2).
- N3-5 (design): contrato OData de usuários em `/api/tratativa/v1` (etapas 1-4).
- N3-6 (design): novos valores de `status` na consulta do aplicativo `/v1` (etapa 1, CA64).
- N3-7 (design): Descrição e Solicitante só para o Gestor; histórico com matrícula e justificativa (etapas 1-3).
- N3-8 (design): nenhuma dependência nova.

## Critérios de pronto
- Etapa 1: CA2-CA23 (transições e escrita), CA46, CA47 (Justificativa), CA64, CA66, CA67, CA68, CA73, CA77.
- Etapa 2: CA1, CA23 (leitura), CA47 (Status), CA48-CA63, CA69, CA70, CA71.
- Etapa 3: CA17-CA19 (edição), CA24-CA29, CA31-CA35, CA47 (Título), CA72, CA74.
- Etapa 4: CA18, CA19, CA30, CA36-CA45, CA47 (Criticidade, Autor, Tipo de autor), CA65, CA75, CA76.
- Os 77 CAs da spec cobertos (mapa em "Como isso se prova" do design); suíte do 002 inalterada e verde.
- Quatro pares `test(red):`/`feat(green):` na branch, cada RED provado pelo `verifica-red.sh`.
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Itens A a D de "Decisões que exigem o humano (Gate 1)" do design; se o Gate 1 mudar A (R31) ou C, ajustar os casos correspondentes antes do RED da etapa afetada.
