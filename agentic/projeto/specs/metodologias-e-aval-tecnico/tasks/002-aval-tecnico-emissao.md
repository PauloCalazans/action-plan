# Task 002: aval-tecnico-emissao

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** draft
**Branch:** metodologias-e-aval-tecnico/002-aval-encerramento-metodologias

> **Grupo 2 (decisão do humano, 2026-10-13):** esta task e a(s) task(s) 003, 004 são executadas num único ciclo (um RED, um GREEN, uma revisão de diff) e publicadas num único PR, nesta branch. O escopo do grupo é a união dos "## Arquivos" abaixo; RED, GREEN e critérios de cada task incorporada continuam no documento dela.


### Incorporado da task 003 (003-encerramento-com-aval)
### Criados
- `test/apoio/encerramento.ts` (helper `encerrarComAval(enviar, codigo, opcoes)`: inicia se `Aberta`, emite Aval `Aprovado` como `validador`, encerra como `gestor`; devolve a resposta do encerramento; sem `expect(`)
- `test/apoio/legado.ts` (helper `semearTratativaEncerradaLegada()` que grava por `cds.db` uma Tratativa `Encerrada` sem `AvalesTecnicos`; exceção nomeada DC-09 ao item 5 da CONVENCOES)
- `test/metodologias-encerramento.test.ts`

### Modificados
- `srv/tratativa/ciclo-de-vida.ts` (remove `'Aberta|Encerrada'` de `TRANSICOES`; 409 próprio para encerrar de `Aberta` antes da tabela; após o 409 de Ações abertas, exige Aval aprovado vigente via `lerSituacaoAval`)
- `srv/tratativa-app-service.ts` (`podeEncerrar`/`ocultaEncerrar` = Gestor, `Em andamento`, sem Ação aberta, Aval aprovado vigente; cálculo em lote)
- `test/CONVENCOES.md` (item 15: encerrar exige `encerrarComAval`; item 5: registro da exceção DC-09 (CA32, só por `test/apoio/legado.ts`) e menção às exceções preexistentes, não migradas nesta task: `test/edicao-tratativa.test.ts:36`, `test/criticidade-gestor.test.ts:39`, `test/criacao-acoes.test.ts:52`, `test/edicao-acoes.test.ts:133-134`, `test/evidencias-consultas-download.test.ts:292`)
- `test/ajustes-revisao-tratativa.test.ts`
- `test/alertas-motor-regras.test.ts`
- `test/analitico-correcao-revisao.test.ts`
- `test/analitico-executivo-evidencias.test.ts`
- `test/analitico-gestao-metricas.test.ts`
- `test/analitico-operacional-lgpd.test.ts`
- `test/autorizacao-execucao-acoes.test.ts`
- `test/ciclo-de-vida-acoes.test.ts`
- `test/comentarios-auditoria-concorrencia.test.ts`
- `test/comentarios-tratativa.test.ts`
- `test/criticidade-gestor.test.ts`
- `test/delegacao-acoes.test.ts`
- `test/edicao-tratativa.test.ts`
- `test/evidencias-anexo.test.ts`
- `test/evidencias-anexo-complemento.test.ts`
- `test/evidencias-remocao.test.ts`
- `test/historico-consulta-unificada.test.ts`
- `test/historico-precedencia-imutabilidade.test.ts`
- `test/responsaveis-tratativa.test.ts`
- `test/transicoes-tratativa.test.ts` (encerramento direto de `Aberta` passa a esperar 409 com a mensagem da spec; `:70`, `:222-224`)
- `test/ui-acabamento.test.ts` (`podeEncerrar`/`ocultaEncerrar` em `Aberta`: `:175`, `:716`, `:720`)

### Removidos
- Nenhum.

### Incorporado da task 004 (004-metodologias-causa-raiz)
### Criados
- `srv/tratativa/metodologia-validacao.ts` (chaves e limites por ferramenta, decisão 1 do design; mensagens e `target`)
- `srv/tratativa/metodologia.ts` (`definirMetodologia`, `consultarMetodologia`, `derivarAcaoDaMetodologia`; autoria R4; eventos DC-03; máscara R16 b; `tratativasComVinculoDiagnostico(req, codigos): Promise<Set<string>>` = Tratativas em que o usuário é Gestor, responsável de Ação/Subação ou Validador habilitado, lida no banco em lote, DC-15)
- `test/metodologias-diagnostico.test.ts`

### Modificados
- `srv/tratativa-service.cds` (tipo `DetalheMetodologia`; function `consultarMetodologiaTratativa`; actions `definirMetodologia`, `derivarAcaoDaMetodologia`; grant `authenticated-user`)
- `srv/tratativa-service.ts` (handlers)
- `srv/tratativa/acoes-criacao.ts` (exporta `criarAcaoComCausa(codigoTratativa, dados, causa, autor)`, que reaproveita `criar` e grava `causaIdentificador`, `causaDescricao` e os eventos `Criacao` + `CriacaoAcaoComCausa`)

### Removidos
- Nenhum.

## Objetivo
Implementar a emissão e a consulta do Aval Técnico no `TratativaService`, com vigência e prazo derivados (DC-04, DC-05), designação de Validador por Origem (DC-01), evento `EmissaoAvalTecnico` com fundamentação consultável (DC-03) e acesso do Validador às Evidências, sem mudar ainda a regra de encerramento.

## Arquivos

### Criados
- `srv/tratativa/aval-tecnico.ts` (situação do Aval: vigente, aptidão, exigência pós-reprovação, `dataBase`/`dataLimite`; emissão; consulta)
- `srv/tratativa/validador-tecnico.ts` (`validadoresEfetivos(origemNormalizada)`, `usuarioEhValidadorHabilitado(req, codigoTratativa)`, `tratativasComValidadorHabilitado(req, codigos)` em lote; lê `Tratativas.origemNormalizada` num SELECT próprio depois de `bloquearTratativa`, sem alterar `srv/tratativa/bloqueio.ts`; origem nula ou sem linha em `ParametrosOrigem` usa a linha `*`, DC-16)
- `test/apoio/aval.ts` (helpers `comoValidador`, `comoValidadorB`, `emitirAval(enviar, tratativa, dados, como)`, `consultarAval(...)`; sem `expect(`)
- `test/metodologias-aval-tecnico.test.ts`

### Modificados
- `srv/tratativa-service.cds` (tipos `ItemAvalTecnico`, `DetalheAvalTecnico`, `ResultadoAvalTecnico`; function `consultarAvalTecnicoTratativa`; action `emitirAvalTecnico`; grant `authenticated-user`; `fundamentacao` em `DetalheEventoHistorico`)
- `srv/tratativa-service.ts` (handlers `emitirAvalTecnico` e `consultarAvalTecnicoTratativa`)
- `srv/tratativa/historico.ts` (`LinhaHistorico.avalTecnico`)
- `srv/tratativa/historico-consulta.ts` (coluna `avalTecnico`, `detalhe.fundamentacao` lida de `AvalesTecnicos`)
- `srv/tratativa/historico-autorizacao.ts` (`mascararDetalhe` zera `fundamentacao` para não-Gestor)
- `srv/tratativa/evidencias-consultas.ts` (`listarEvidenciasAcao`, `listarEvidenciasTratativa`, `baixarEvidencia` aceitam o Validador habilitado; `autorAnexo = null` para ele)
- `test/CONVENCOES.md` (item 10: exceção do 016, "nas actions ligadas `emitirAvalTecnico`, `definirMetodologia` e `derivarAcaoDaMetodologia`, chave mal formada dá 400 `Código inválido.` (CA34, R18 etapa 4); as actions anteriores continuam 404"; DC-12)

### Removidos
- Nenhum.

## Interfaces
- Produz:
  - `POST /api/tratativa/v1/Tratativas(<codigo>)/emitirAvalTecnico` `{ parecer, fundamentacao }` → `ResultadoAvalTecnico { id, parecer }`.
  - `GET /api/tratativa/v1/consultarAvalTecnicoTratativa(codigoTratativa=<uuid>)` → `DetalheAvalTecnico { vigente, dataBaseVerificacao, dataLimiteVerificacao, historico[] }`.
  - Em `srv/tratativa/aval-tecnico.ts`: `lerSituacaoAval(codigos: string[]): Promise<Map<string, SituacaoAval>>` (`avalVigente`, `aprovadoVigente`, `houveReabertura`, `acoesAbertas`, `exigeNovaAcao`, `aptaParaEmissao`, `dataBase`, `dataLimite`), usada pelas tasks 003, 005 e 007.
  - Em `srv/tratativa/validador-tecnico.ts`: `usuarioEhValidadorHabilitado(req, codigoTratativa): Promise<boolean>` e `validadoresEfetivos(origemNormalizada: string | null): Promise<{ lista: string[]; fonte: 'Origem' | 'Padrao' | 'Nenhuma' }>` (`fonte = 'Nenhuma'` quando nem a Origem nem a linha `*` têm matrícula; DC-11), usadas pelas tasks 004, 005 e 007.
  - Em `srv/tratativa/validador-tecnico.ts`: `tratativasComValidadorHabilitado(req, codigos: string[]): Promise<Set<string>>` (r3, DC-17): Tratativas da lista em que o usuário tem o papel `ValidadorTecnico` e está habilitado pela Origem (mesma regra de DC-01/DC-16), lidas em lote (um SELECT de `origemNormalizada` das Tratativas e um de `ValidadoresOrigem` das Origens envolvidas e da linha `*`); `usuarioEhValidadorHabilitado` delega a ela com um código. Usada pela máscara genérica do App e pelo filtro de leitura de `Evidencias` do App (task 007; r4, I4-01) e por `tratativasComVinculoDiagnostico` (task 004).
  - Recusa de etapa 4 (DC-12): chave da URL fora do formato UUID → 400 `Código inválido.` `target: codigo`, por `codigoValido` (`srv/tratativa/consulta.ts:13`) antes de `bloquearTratativa`; `codigoTratativa` mal formado em `consultarAvalTecnicoTratativa` → 400 `target: codigoTratativa`.
  - `detalhe.fundamentacao` em `consultarHistoricoTratativa`.
- Consome:
  - Modelo, catálogo e papel da task 001; `bloquearTratativa`/`exigirAlteravel` (`srv/tratativa/bloqueio.ts`), `recusar` (`srv/tratativa/recusa.ts`), `registrarHistorico` (`srv/tratativa/historico.ts`), `agora`/`dataCivil` (`srv/lib/relogio.ts`), `normalizarTexto` (`srv/tratativa/normalizacao.ts`).

## N3 aprovados no Gate 1
- N3-2 (design): grant `authenticated-user` para `emitirAvalTecnico` com papel verificado em código.
- N3-4 (design): máscaras de `fundamentacao` e `validador` na consulta e no histórico.
- N3-5 (design): Validador habilitado emite Aval e consulta/baixa Evidências.
- N3-6 (design): operações novas e `detalhe.fundamentacao`.

## Critérios de pronto
- **RED** (`test(red): emissao e consulta do aval tecnico`), em `test/metodologias-aval-tecnico.test.ts` (HTTP com `cds.test`):
  - Emissão aceita para `validador` em Tratativa `Em andamento` com Ações concluídas (CA16) e sem Ações (R9 c); recusa 403 `Acesso negado.` para `gestor` sem o papel (R7 e; o caso de CA17 com lista da Origem que não inclui o usuário é provado na task 005); 409 em `Aberta` com a mensagem da spec (CA42, parte da emissão); 409 com Ação `Em andamento` (CA20); 400 `target: fundamentacao` com 10 caracteres (CA21); 400 `target: parecer` com `Em Análise` (CA22).
  - Reprovado: Tratativa continua `Em andamento` e o histórico tem `EmissaoAvalTecnico` com `valorNovo = 'Reprovado'` (CA23, parte da emissão); nova emissão sem Ação nova finalizada → 409 com a mensagem da spec (CA24); com Ação criada depois da reprovação e concluída → aceita.
  - Precedência D10 (CA34, conferida contra a spec, CONVENCOES item 23): sem autenticação 401; `comoApp` 403; corpo com tipo inválido 400; chave mal formada (`'xyz'`) **400** `Código inválido.` (CA34 "identificador inválido → 400"; prevalece sobre o item 10 da CONVENCOES pela R-08, exceção registrada no mesmo commit); Tratativa inexistente (UUID de 5 grupos) 404; Tratativa `Encerrada` 409 (CA34) e `Cancelada` 409.
  - Habilitação pela Origem (DC-16): Tratativa aberta por `abrirPorApp` com origem cadastrada usa a lista dessa Origem; Tratativa avulsa (origem nula) usa a lista `*` (preparo da lista via `incluirValidadorOrigem` só existe na task 005; aqui, sem listas, qualquer `ValidadorTecnico` emite, R7 c).
  - Histórico (CA28): `consultarHistoricoTratativa` como Gestor traz `EmissaoAvalTecnico`, `origem: 'Tratativa'`, `detalhe.valorNovo` = parecer, `detalhe.fundamentacao` = texto, `autor` = `validador`; como Participante a `fundamentacao` vem `null`. CA29: PATCH/DELETE no histórico recusados com 404/405 sem alterar o registro (padrão `test/historico-precedencia-imutabilidade.test.ts:54-101`).
  - Lote (DC-17), sem listas: Aval emitido em duas Tratativas; `consultarAvalTecnicoTratativa` traz a `fundamentacao` a `validador` nas duas (habilitado por R7 c) e `null` a `usuario` nas duas. O caso com listas fica na task 005. Os testes não importam `srv/`, então a função de lote é provada pelo efeito.
  - Consulta (CA45, parte do aval): `consultarAvalTecnicoTratativa` traz vigente e histórico com `vigente`; para `usuario` comum a `fundamentacao` vem `null` (CA41) e o `validador` vem `null`.
  - Prazo: última Ação concluída em 2026-10-13 (relógio fixado) → `dataLimiteVerificacao = 2026-11-12` (CA25, baseline de 30 dias); Tratativa sem Ações iniciada em 2026-10-13 → `2026-11-12` (CA39, parte do prazo).
  - Evidências (CA44): `validador` lista Evidências da Tratativa e da Ação (`autorAnexo = null`) e baixa o anexo; o histórico registra `DownloadEvidencia` com autor `validador`; `usuario` comum continua com lista vazia e 403 no download.
- **GREEN** (`feat(green): emissao e consulta do aval tecnico`): módulos e handlers da lista; `npm run build` limpo; nenhum teste existente muda (encerramento ainda não exige Aval).
- CAs cobertos: CA16, CA17 (recusa sem o papel; lista da Origem na task 005), CA20, CA21, CA22, CA23 (parte da emissão), CA24, CA25, CA28, CA29, CA34, CA39 (data limite), CA41, CA42 (emissão em Aberta), CA44, CA45 (aval).
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Nenhuma.
