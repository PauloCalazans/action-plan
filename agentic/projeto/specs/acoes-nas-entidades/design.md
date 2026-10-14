# Design: acoes-nas-entidades

**Spec:** agentic/projeto/specs/acoes-nas-entidades/spec.md
**Status:** aprovado

Escopo técnico: as operações sobre Ação e Evidência passam a ser actions ligadas a `Acoes` e `Evidencias` no `TratativaAppService` (`/api/app/v1`), com o registro-alvo vindo da chave da linha. Criar Ação e Comentar Tratativa continuam ligadas a `Tratativas`, mas saem do cabeçalho e vão para as barras das tabelas. A habilitação é por linha, por indicações booleanas calculadas no servidor, sem matrícula. Anexar Evidência ganha diálogo próprio com escolha de arquivo. O `TratativaService` (`/api/tratativa/v1`) e as funções de domínio de `srv/tratativa/` não mudam de regra.

**Base de código:** empilha sobre `metodologias-e-aval-tecnico/005-admin-indicadores-ui` (worktree `agentic/.estado/worktrees/metodologias-e-aval-tecnico-005-admin-indicadores-ui`, HEAD `b58543a`). Todo arquivo e toda linha citados abaixo foram conferidos nesse worktree. Arquivos que ainda não existem aparecem como **(novo)**.

**Fontes de framework (só leitura):** o MCP do UI5 não estava disponível para este papel. As citações de Fiori elements vêm do código-fonte instalado no cache do UI5 tooling, na mesma linha de versão do app (`app/tratativas/ui5.yaml`: SAPUI5 1.136.23):
- `~/.ui5/framework/packages/@sapui5/sap.fe.core/1.136.24/src/...` (abaixo, `fe.core:`);
- `~/.ui5/framework/packages/@sapui5/sap.fe.macros/1.136.24/src/...` (`fe.macros:`);
- `~/.ui5/framework/packages/@sapui5/sap.fe.templates/1.136.24/src/...` (`fe.templates:`);
- `~/.ui5/framework/packages/@openui5/sap.ui.core/1.136.21/src/...` (`ui5.core:`).

Os fatos de `sap.ui.unified.FileUploader` (1.136.23) foram medidos pelo orquestrador no ui5-mcp. As citações de CAP vêm de `node_modules/@sap/cds` 10.1.1 do worktree.

**Revisão r1 (DEVOLVIDO, `agentic/.estado/execucao/2026-10-14-acoes-nas-entidades/revisao-design-parecer-1.md`):**
- **C1:** resolução da linha pelo último segmento, com pertencimento na contenção, e correção do `alterarStatusAcao` (decisões 1 e 2; N3-1, N3-2).
- **I1:** `SideEffects` das transições do cabeçalho e binding nos botões de página (decisão 5).
- **M1:** precedência da Evidência inativa (decisão 2).
- **M2:** `conteudo ?? ""`.
- **M3:** carga única via `vm`.
- **M4:** divergência do placeholder registrada para o relatório ("O desconfortável" 3).
- **M5:** `isDestroyed()`.
- **M6:** `eslint-disable-line no-undef` (decisão 8).

**Revisão r2 (APROVADO, `revisao-design-parecer-2.md`):** aplicados os menores que mudam o RED.
- **M2-1:** caminhos aceitos fechados e identificados por `req.query.SELECT.from.ref`, com o caso `acaoMae` no RED (decisão 2).
- **M2-2:** caminho por contenção nas Interfaces da task.
- **M2-3:** teste estático confere os bindings de Criar Ação e Comentar Tratativa.

**Gate 1 (delegado ao orquestrador):** o desenho segue a recomendação de cada uma das 9 hipóteses: R4 (a), R6 (a), R8 (a), R13 (a), R19 (a), R23 (a), R24 (a), R25 (b) e R26 (a). Se alguma for recusada, as decisões afetadas estão marcadas com a regra.

## Decisões
1. **Actions ligadas à linha no `TratativaAppService`, com as funções de domínio reaproveitadas sem mudança de regra (R1, R2, R16, R17).** Em `srv/tratativa-app-service.cds`:
   - saem de `Tratativas` as actions `criarSubacao`, `delegarAcao`, `anexarEvidencia`, `removerEvidencia` e `comentarAcao` (hoje em `:81-97`);
   - entram em `Acoes`: `criarSubacao(descricao, responsavel, prazo, prioridade, evidenciaObrigatoria)`, `delegarAcao(novoResponsavel, justificativa)`, `anexarEvidencia(nomeArquivo, mimeType, conteudo, descricao)` e `comentarAcao(texto, mencoes)`;
   - entra em `Evidencias`: `removerEvidencia()`, sem parâmetros;
   - `criarAcao` e `comentarTratativa` continuam em `Tratativas` (R16).

   Nenhum parâmetro de código sobra (`acaoMae`, `acao`, `evidencia`). Os tipos de retorno não mudam (`ResultadoCriacaoAcao`, `DetalheEvidencia`, `ResultadoComentario`). Os handlers em `srv/tratativa-app-service.ts` resolvem a linha e chamam as mesmas funções de hoje, com o código da Tratativa vindo da linha:
   - `criarSubacao(tratativa, codigoAcao, dados, autor)` (`srv/tratativa/acoes-criacao.ts:36`);
   - `delegarAcao(tratativa, codigoAcao, novoResponsavel, justificativa, autor)` (`acoes-delegacao.ts:42`);
   - `anexarEvidencia(req, tratativa, { acao: codigoAcao, ... }, autor)` (`evidencias-anexo.ts:60`);
   - `comentarAcao(req, tratativa, { acao: codigoAcao, texto, mencoes })` (`comentarios-inclusao.ts:152`);
   - `removerEvidencia(req, tratativa, { acao: acao_codigo, evidencia: codigo }, autor)` (`evidencias-remocao.ts:35`).

   Bloqueio D9, histórico na mesma transação, compensação e mensagens continuam dentro dessas funções. **Por quê:**
   - segue a forma de `Acoes.iniciar`/`concluir` (`srv/tratativa-app-service.ts:400-409`): resolver a linha e chamar a função de domínio. A resolução, porém, passa a usar o último segmento do caminho (decisão 2; r1, C1). O `alterarStatusAcao` atual lê `req.params[0]` e é corrigido nesta task;
   - nenhuma função de `srv/tratativa/` é editada além de um `export` (decisão 7).

   **Verificado por:** contrato CDS compilado (seção "Contrato executável"), CA29 e CA30 (a suíte do `TratativaService` não muda), e CA31.

2. **Resolução da linha e ordem das recusas (R14, R15) — r1, C1.** Duas funções novas em `srv/tratativa/operacoes-linha-app.ts` **(novo)**: `localizarAcaoDaLinha(req)` e `localizarEvidenciaDaLinha(req)`.

   **Dois caminhos de invocação.** O contrato aceita os dois:
   - **direto:** `POST Acoes(a)/<action>` e `POST Evidencias(e)/<action>`. Aqui `req.params` = `[{codigo:a}]`;
   - **por contenção:** `POST Tratativas(t)/acoes(a)/<action>` e `POST Tratativas(t)/evidencias(e)/<action>`. Aqui `req.params` = `[{codigo:t},{codigo:a}]`.

   O caminho por contenção é o que a interface usa. O `invokeAction` com o contexto da linha monta a operação relativa ao contexto (`fe.core: controllerextensions/editFlow/operations/ODataOperation.ts:324`), e o CAP preenche um item de `req.params` por segmento (`node_modules/@sap/cds/libx/common/utils/path.js:17-36`). O revisor mediu isso com o parser do CAP (parecer r1, C1).

   **Regras de resolução:**
   - **caminhos aceitos (r2, M2-1), e só estes:**
     - `Acoes(a)/<action>` e `Tratativas(t)/acoes(a)/<action>`;
     - `Evidencias(e)/<action>` e `Tratativas(t)/evidencias(e)/<action>`;
     - `MinhasAcoes(a)/iniciar|concluir`.
   - **qualquer outro caminho dá o mesmo 404** (fail-closed). Exemplos: `Acoes(a)/acaoMae/<action>` (forma medida pelo revisor: `req.params` também tem 1 ou 2 itens e enganaria uma checagem só por `req.params`), `Acoes(x)/tratativa/...` ou mais de 2 segmentos;
   - o handler identifica as entidades pelos segmentos de `req.query.SELECT.from.ref`, não só por `req.params`. Cada segmento é texto ou `{ id, where }`. São aceitos 1 segmento com `id` igual à entidade alvo (`TratativaAppService.Acoes`/`.Evidencias`/`.MinhasAcoes`), ou 2 segmentos com `id` `TratativaAppService.Tratativas` e depois `acoes` ou `evidencias`. As chaves vêm de `req.params`, alinhadas a esses segmentos;
   - a chave do registro-alvo é a do último segmento (`codigo`; em `MinhasAcoes`, `codigoAcao`);
   - com 2 segmentos, a chave `t` do primeiro precisa estar no formato UUID e ser igual ao `tratativa_codigo` do registro. Se não for, a resposta é o mesmo 404 `Ação não encontrada.` ou `Evidência não encontrada.` (R14 c; CA25);
   - chave do registro fora do formato UUID (`codigoValido`, `srv/tratativa/consulta.ts:13`) dá 404. O runtime não valida o formato (`consulta.ts:12`), e CONVENCOES item 10 já fixa 404 para chave de action ligada mal formada;
   - em seguida, `SELECT.one` de `Acoes` (`codigo`, `tratativa_codigo`) ou de `Evidencias` (`codigo`, `acao_codigo`, `tratativa_codigo`, `ativo`). Sem linha, ou Evidência com `ativo = false`, a resposta é o mesmo 404;
   - os códigos são devolvidos em minúsculas, como `codigoDe` faz hoje (`srv/tratativa-app-service.ts:326`).

   **Correção de defeito existente (declarada).** `alterarStatusAcao` (`srv/tratativa-app-service.ts:400-406`) lê `req.params[0]`, então hoje `Iniciar`/`Concluir` acionados pela tabela da Object Page procuram a Ação com o código da Tratativa. Como a R23 põe Iniciar/Concluir no padrão de linha, essa função passa a usar `localizarAcaoDaLinha(req)`. Em `MinhasAcoes(a)/iniciar` o caminho tem um segmento e o comportamento não muda.

   **Ordem resultante:**
   - Criar Subação e Delegar Ação têm `@requires: 'GestorTratativa'`. O CAP recusa com 403 antes do handler, então o papel estático precede a existência (R14 d; CA26).
   - Anexar, Comentar Ação e Remover têm `@requires: 'authenticated-user'`. O 404 do handler vem antes do 403 dinâmico da função de domínio (etapa 7 de `evidencias-anexo.ts:87-92`, `evidencias-remocao.ts:66-71`; `comentarios-inclusao.ts:180-183`), como pede R14 d.
   - Ação de outra Tratativa: pelo caminho por contenção, dá 404 pela regra de pertencimento acima (R14 c). Pelo caminho direto, o caso não existe, porque a Tratativa vem da própria Ação. Evidência de outra Ação também não existe, porque a Ação vem da própria Evidência.
   - **Mudança de precedência declarada (r1, M1):** Evidência inativa passa a dar 404 antes do 403 dinâmico e dos 409 de estado. Hoje, pelo parâmetro `evidencia`, ela é recusada na etapa 10 (`evidencias-remocao.ts:81-91`), depois do 403 (`:65-71`) e dos 409 (`:73-79`). Exemplos: um não-Gestor sem vínculo passa a receber 404 em vez de 403; uma Tratativa `Encerrada` com Evidência inativa dá 404 em vez de 409. A mudança alinha o código a evidencias R14 etapa 5 (`evidencias/spec.md:30`: inexistente ou inativa dá 404 antes da autorização) e a CA25. É a única recusa que muda além das de R14 a/b/c. O RED cobre esse caso. O 404 `Ação não encontrada.` de pertencimento continua dentro das funções (`acoes-criacao.ts:107-111`, `acoes-delegacao.ts:115-123`) e fica inalcançável pela linha.
   - O 400 `Código inválido.` dos parâmetros (`acoes-criacao.ts:38`, `acoes-delegacao.ts:50`, `evidencias-anexo.ts:66`, `evidencias-remocao.ts:42-48`, `comentarios-inclusao.ts:160-167`) também fica inalcançável pelo App, porque o código chega já validado (R14 a). Ele continua valendo no `TratativaService` (Divergências da spec).
   - O `AplicativoOrigem` continua recusado pelo `before('*')` (`srv/tratativa-app-service.ts:140-142`), que vale para toda action do serviço (CA28).

   **Sem `@restrict`:** as actions usam só `@requires`. Com `@restrict` com `where`, o CAP leria a instância e responderia `404`/`403` genéricos antes do handler (`node_modules/@sap/cds/libx/_runtime/common/generic/auth/restrict.js:284-297`), sem as mensagens do domínio. Por isso a autorização dinâmica continua na função de domínio (R15).

   **Corrida:** a leitura prévia acontece fora do bloqueio D9. Isso é seguro porque:
   - a Tratativa de uma Ação e a Ação de uma Evidência nunca mudam;
   - `ativo` pode mudar entre a leitura e o bloqueio, mas a função de remoção reconfere a Evidência ativa dentro do bloqueio (`evidencias-remocao.ts:81-91`), com o mesmo 404.

   **Verificado por:** CA24, CA25, CA26, CA27 e CA28 (automatizados). Cada operação de linha, e também `iniciar`/`concluir` de `Acoes`, é exercitada pelos **dois** caminhos: `Acoes(a)/...` e `Tratativas(t)/acoes(a)/...` (ou `Evidencias(e)/...` e `Tratativas(t)/evidencias(e)/...`). Os casos cobertos são:
   - Ação ou Evidência de outra Tratativa pela contenção: 404 (CA25);
   - chave `t` malformada: 404;
   - `M1001` em `Tratativas(t)/acoes(<inexistente>)/criarSubacao`: 403 antes de 404 (CA26);
   - Evidência inativa: 404 antes de 403 e de 409 (M1).

3. **Indicações por linha calculadas pelo servidor, sem matrícula (R5, R6, R8, R23).** Elementos calculados `false as <flag> : Boolean`, preenchidos no `after('READ')`, no mesmo padrão de `Tratativas.pode*`/`oculta*` (`srv/tratativa-app-service.cds:28-42`, `srv/tratativa-app-service.ts:171-215`):

   | Entidade | Flag | Valor (usuário autenticado; "alterável" = Tratativa `Aberta` ou `Em andamento`; "viva" = Ação `Pendente` ou `Em andamento`) | Regra |
   |---|---|---|---|
   | `Tratativas` | `ocultaGestaoAcoes` | não é `GestorTratativa` | R5 (Criar Ação, Criar Subação, Delegar) |
   | `Tratativas` | `podeCriarAcao` | Gestor e alterável | R5, R10 |
   | `Tratativas` | `ocultaComentarTratativa` | não é Gestor, nem Responsável Principal, nem Participante desta Tratativa | R6 b |
   | `Tratativas` | `podeComentarTratativa` | `!ocultaComentarTratativa` e alterável | R5, R10 |
   | `Tratativas` | `ocultaOperacoesDeAcao` | não é Gestor nem Responsável de nenhuma Ação desta Tratativa | R6, sem seleção (decisão 5) |
   | `Acoes` | `ocultaOperacoesDaLinha` | não é Gestor nem Responsável desta Ação | R6 a, R23 |
   | `Acoes` | `podeCriarSubacao` | Gestor, alterável, Ação viva e sem `acaoMae` | R5, R8 |
   | `Acoes` | `podeDelegar` | Gestor, alterável, Ação viva | R5 |
   | `Acoes` | `podeAnexarEvidencia`, `podeComentarAcao` | `!ocultaOperacoesDaLinha`, alterável, Ação viva. O limite de 10 Evidências não entra (R5; CA12) | R5 |
   | `Acoes` | `podeIniciarAcao` | `!ocultaOperacoesDaLinha`, alterável, Ação `Pendente` | R23 |
   | `Acoes` | `podeConcluirAcao` | `!ocultaOperacoesDaLinha`, alterável, Ação viva | R23 |
   | `Evidencias` | `ocultaRemover` | não é Gestor nem Responsável da Ação dona da Evidência | R6 c |
   | `Evidencias` | `podeRemover` | `!ocultaRemover`, `ativo`, alterável, Ação dona viva | R5, R6 c |

   **Cálculo:** `indicacoesAcoes(req, codigos)` e `indicacoesEvidencias(req, codigos)` em `srv/tratativa/operacoes-linha-app.ts` **(novo)**, chamadas por `after('READ', 'Acoes')` e `after('READ', 'Evidencias')`. Cada uma faz **uma** consulta em lote ao banco, por `codigo in (...)`, com `responsavel`, `status`, `acaoMae_codigo` e `tratativa.status`. Nunca lê da linha devolvida, porque o `after('READ', '*')` da máscara corre em paralelo e anula `responsavel` para não-Gestor (`srv/tratativa-app-service.ts:217-220`; DC-17 do 016: os `after` correm em paralelo). A comparação de matrícula usa `usuarioAutenticadoEhMatricula`/`normalizarMatricula` (`srv/tratativa/identidade.ts`), a mesma das funções de domínio. As flags de `Tratativas` entram no `after('READ', 'Tratativas')` existente, que já consulta `Acoes` por `tratativa_codigo` para não-Gestor (`:183-191`) e passa a consultar também `ParticipantesTratativa` e `responsavelPrincipal`, só para não-Gestor (R6 b).

   **Fail-closed:**
   - linha sem `codigo` fica com todas as flags `false`, ou seja, botão desabilitado;
   - no `$expand` (ex.: `Tratativas?$expand=acoes`) nenhum `after` de `Acoes` roda, e as flags ficam `false`;
   - o `before('READ', 'Tratativas')` (`:149-158`) passa a reconhecer as flags novas no regex.

   **Expressões de habilitação do servidor:** `@Core.OperationAvailable: in.<pode...>` nas actions, no padrão do cabeçalho (`srv/tratativa-app-service.cds:51-63`).

   **Verificado por:** CA12, CA14 (automatizado, prova a ausência de matrícula) e CA8, CA9, CA10, CA11, CA13, CA16, CA39 (visuais).

4. **Efeito sobre `srv/tratativa/mascara-app.ts`: nenhuma alteração de código.** As flags não têm `@PersonalData`, então não entram em `campos`/`DECIDIDOS`/`LIBERADOS` (DC-17/DC-18). A guarda CSN de `test/mascara-lgpd-app.test.ts` continua com as mesmas listas. A projeção `Evidencias { *, ... }` mantém os elementos e as anotações propagadas de `db/tratativa.cds:313-330`, e a regra `porVinculo` de `Evidencias` (leitura só das Evidências das próprias Ações para não-Gestor) continua no `before('READ', '*')` (`srv/tratativa-app-service.ts:144-146`).

   **Varredura DC-19:** uma flag em `$select` é `ref` simples fora de `campos` e passa. Em `$filter`/`$orderby`, o CAP avalia a expressão da projeção (`false`), não o valor do `after`: `$filter=podeRemover eq true` não devolve linha e não revela vínculo de ninguém. É o mesmo comportamento das flags de `Tratativas`, já em produção.

   **`@cds.search`:** as flags são `Boolean`, fora da busca padrão (`cds.String`; DC-19, `@cap-js/db-service` `lib/search.js`), então não precisam de anotação.

   **Retorno das actions:**
   - `anexarEvidencia` devolve `DetalheEvidencia` com `autorAnexo` = a matrícula do próprio solicitante, como hoje (`srv/tratativa-app-service.cds:120-129`);
   - as demais não devolvem dado pessoal.

   **Verificado por:** `test/mascara-lgpd-app.test.ts` sem mudança nas listas (CA14) e revisão de diff (nenhuma linha de `mascara-app.ts` alterada).

5. **Botões nas barras das tabelas por ações customizadas do manifest, com `visible`/`enabled` por função de módulo (R1, R3, R4, R5, R6, R10, R23).** Em `app/tratativas/webapp/manifest.json`, o alvo `TratativasObjectPage` ganha `controlConfiguration` para três tabelas:
   - `acoes/@com.sap.vocabularies.UI.v1.LineItem`: Criar Ação, Criar Subação, Delegar Ação, Anexar Evidência, Comentar Ação, Iniciar e Concluir;
   - `evidencias/@com.sap.vocabularies.UI.v1.LineItem`: Remover Evidência;
   - `comentarios/@com.sap.vocabularies.UI.v1.LineItem`: Comentar Tratativa.

   Cada ação declara `press`, `visible` e `enabled` como referência `modulo.metodo` para `br.com.calazanstec.actionplan.tratativas.ext.acoes.OperacoesLinha` **(novo)**. As ações de linha também declaram `requiresSelection: true` e `enableOnSelect: "single"`.

   **Fonte (Fiori elements 1.136):**
   - `enabled`/`visible` aceitam referência a método de módulo, chamado com `(contexto da página, contextos selecionados)` e reavaliado quando `internal>selectedContexts` muda (`fe.core: converters/controls/Common/Action.ts:582-616`, `formatters/FPMFormatter.ts:7-29`);
   - `requiresSelection` com `enableOnSelect: "single"` exige exatamente 1 linha selecionada (`Action.ts:406-430`, `numberOfSelectedContexts == 1`);
   - o `press` é carregado por `sap.ui.require` e chamado com `this` = `ExtensionAPI` (`fe.core: helpers/FPMHelper.ts:46-51`).

   **Regras das funções:**
   - `visible`, botões só de Gestor (Criar Ação, Criar Subação, Delegar): `!ocultaGestaoAcoes` da página;
   - `visible`, botões de papel dinâmico (Anexar, Comentar Ação, Iniciar, Concluir): com 1 linha selecionada, `!ocultaOperacoesDaLinha` da linha (R6 a; CA13: com A2 selecionada, os botões somem); com 0 ou 2+ linhas, `!ocultaOperacoesDeAcao` da página, para que o botão desabilitado apareça a quem pode agir em alguma linha (R3);
   - `visible`, Remover: o mesmo esquema, com `ocultaRemover` da linha;
   - Criar Ação e Comentar Tratativa dependem só da página e por isso usam **binding**, não método de módulo (r1, I1; ramo "binding" de `getManifestActionBooleanPropertyWithFormatter`, `fe.core: Action.ts:606-609`, avaliado no contexto da página, `Table.ts:1209-1216`). Criar Ação: `visible: "{= ${ocultaGestaoAcoes} !== true }"`, `enabled: "{= ${podeCriarAcao} === true }"`. Comentar Tratativa: `visible: "{= ${ocultaComentarTratativa} !== true }"`, `enabled: "{= ${podeComentarTratativa} === true }"`. O binding reage sozinho quando as propriedades da página são relidas;
   - `enabled` das ações de linha: a flag `pode...` da linha selecionada.

   **Reavaliação depois das transições do cabeçalho (r1, I1).** O formatter das ações de linha só é reavaliado quando `internal>selectedContexts` muda (`Action.ts:594-605`), e o FE refaz esse valor quando a tabela recebe dados (`fe.macros: table/delegates/TableDelegate.ts:735-748`). Por isso os `@Common.SideEffects` de `iniciarTratativa`, `encerrarTratativa`, `cancelarTratativa` e `reabrirTratativa` (`app/tratativas/annotations.cds:469-476`) ganham:
   - em `TargetProperties`: `in/podeCriarAcao`, `in/podeComentarTratativa`, `in/ocultaComentarTratativa` e `in/ocultaOperacoesDeAcao`;
   - em `TargetEntities`: `in/acoes`, `in/evidencias` e `in/comentarios`.

   Reler as tabelas recalcula as flags das linhas e reavalia os botões. Resultado: depois de Encerrar ou Cancelar, tudo fica desabilitado (R5, CA9); depois de Reabrir ou Iniciar, tudo fica habilitado de novo, sem recarregar a página. Isso evita a regressão em relação ao cabeçalho de hoje. `ocultaGestaoAcoes` depende só do papel e não precisa entrar.

   **Verificação visual obrigatória:**
   - Encerrar ou Cancelar deixa Criar Ação, Comentar Tratativa e os botões de linha desabilitados;
   - Reabrir, e Iniciar a partir de `Aberta`, deixa Criar Ação habilitado sem recarregar.

   Os valores vêm de `Context#requestProperty`. A função é assíncrona, o formatter aceita `Promise`, e a leitura tardia funciona porque o modelo usa `autoExpandSelect: true` (`app/tratativas/webapp/manifest.json:60-66`).

   **Por que não `UI.DataFieldForAction` na `UI.LineItem`:**
   - em barra de tabela, `@UI.Hidden` com caminho é avaliado no contexto da **página** e precisa começar pela navegação parceira (`fe.core: converters/controls/Common/Table.ts:1063-1092`), então não oculta por linha (R6 a, CA13);
   - Criar Ação e Comentar Tratativa são ligadas a `Tratativas`, não à entidade da tabela;
   - Anexar e Remover precisam de handler (decisões 8 e 9);
   - um mecanismo só na mesma barra evita duas lógicas de visibilidade.

   **R4 (hipótese, opção a):** `enableOnSelect: "single"` desabilita os botões de linha com 2+ linhas selecionadas, e a tabela mantém o modo de seleção padrão. CA7 fica verificável literalmente.

   **Efeito declarado:** acaba o Iniciar/Concluir em lote no Plano de Ação (Q6 da spec). Minhas Pendências (`MinhasAcoes.iniciar`/`concluir`) não muda.

   **Verificado por:** verificação visual de CA2, CA6, CA7, CA10, CA11, CA13 e CA39. O teste automatizado de manifest (decisão 11) confere a declaração.

6. **Invocação, diálogos padrão e atualização da tela (R19, R26, R27).**

   **Invocação:** os handlers chamam `this.getEditFlow().invokeAction('TratativaAppService.<acao>', { contexts: [contexto], label })`, onde `contexto` é a linha selecionada ou o contexto da página em Criar Ação e Comentar Tratativa. O diálogo de parâmetros é o padrão do Fiori elements, montado do metadado. Por isso Prazo (`Edm.Date`), as listas fixas de Prioridade e Evidência obrigatória e a ajuda de pesquisa de `Colaboradores` continuam vindo das anotações (R27, CA32). É o mesmo padrão de `onDerivar` (`app/tratativas/webapp/ext/controller/MetodologiaExtension.controller.js:197-208`, medido no 016).

   Como `iniciar`/`concluir` têm sobrecarga para `Acoes` e `MinhasAcoes`, o contexto da linha de `Acoes` escolhe a sobrecarga certa.

   **Atualização (R19):** após sucesso, o handler chama `this.refresh(caminhos)`. É `ObjectPage.ExtensionAPI#refresh`, público, com caminhos relativos à página e `""` para as propriedades da própria Tratativa (`fe.templates: ObjectPage/ExtensionAPI.ts:36-89`). Caminhos por operação:

   | Operação | Caminhos |
   |---|---|
   | Criar Ação, Criar Subação | `["", "acoes"]` (`""` atualiza `podeEncerrar` e demais flags do cabeçalho) |
   | Iniciar, Concluir | `["", "acoes"]` |
   | Delegar Ação | `["acoes"]` |
   | Anexar, Remover | `["evidencias"]` |
   | Comentar Ação, Comentar Tratativa | `["comentarios"]` |

   A Subação nova aparece como linha nova com a Ação mãe indicada. Para isso, a `UI.LineItem` de `Acoes` ganha a coluna `acaoMae_codigo` com rótulo "Ação mãe". A linha pega o código, não a matrícula; `acaoMae` não é campo pessoal.

   **Recusa:** a mensagem do servidor é exibida pelo Fiori elements, e o handler não reescreve. O `catch` ignora `Error('Dialog cancelled')` (lição medida do 016; `MetodologiaExtension.controller.js:125-130`) e não chama `refresh`, então a tela não muda (R19, CA24).

   **Seleção (R26, hipótese, opção a):**
   - Anexar e Comentar Ação não atualizam `acoes`, então a seleção da Ação permanece;
   - em Remover, a linha some da lista e a seleção cai junto. Os botões voltam a ficar desabilitados pela reavaliação de `enabled`;
   - em Delegar e Criar Subação (atualização de `acoes`), a permanência da seleção depende de `requestSideEffects` manter o contexto da linha. É verificação visual (CA42), com recuo na seção "O desconfortável".

   **Verificado por:** CA35 e CA42 (visuais) e CA32 (automatizado, metadado).

7. **Regras de anexo expostas pelo servidor; a interface não tem lista própria (R12, R13, R25).** Nova function sem vínculo `regrasAnexoEvidencia() returns RegrasAnexoEvidencia { tamanhoMaximo : Integer; formatos : many { extensao; tipos : many String } }` no `TratativaAppService`, com `@requires: 'authenticated-user'`. O handler devolve `TAMANHO_MAXIMO_ARQUIVO` e o mapa `FORMATOS_ACEITOS` de `srv/tratativa/evidencias-validacao.ts:7,13-24`, cuja única mudança é passar de `const` a `export const`, sem mudar o conteúdo nem a validação. A ordem dos tipos é a do mapa, e o primeiro tipo de cada extensão é o usado para completar o Tipo vazio (R25): `.csv` → `text/csv` (`:23`) e `.pdf` → `application/pdf`.

   **Por quê:** R13 exige "exatamente as listas e os limites de evidencias R3 e R4 (sem lista própria na interface)". Uma cópia no JS do app envelheceria em silêncio, e a function deixa uma fonte só.

   **Verificado por:** teste automatizado que compara a resposta da function com os pares aceitos pelo `anexarEvidencia` (CA20) e a montagem do pedido (decisão 8).

8. **Anexar Evidência com diálogo próprio, `sap.ui.unified.FileUploader` e montagem do pedido num módulo JS puro (R11, R13, R25; M-R3-1, M-R3-2).**

   **Diálogo padrão do FE descartado (com fonte).** O FE 1.136 tem `FileUploader` no diálogo de parâmetros, mas só para parâmetro de **tipo complexo com propriedade `Edm.Stream`** anotada com `Core.MediaType` e `Core.ContentDisposition.Filename` (`fe.macros: coreUI/OperationParameterDialog.tsx:192-198`, `:249-305`, `:447-493`). Ele não serve aqui por três motivos:
   - (a) quando o equipamento informa Tipo vazio, o FE grava `"application/octet-stream"` (`:460`). O Tipo vazio fica indistinguível de um tipo genérico declarado, e a R25 (b), completar só quando vazio, fica impossível;
   - (b) o CAP precisaria aceitar `LargeBinary` dentro de tipo complexo em parâmetro de action como `Edm.Stream` com base64 no JSON, sem documentação nem precedente no repositório;
   - (c) a montagem do pedido ficaria dentro do FE, sem função testável na esteira (M-R3-2; CA41).

   **Recuo adotado:**
   - **Fragmento** `app/tratativas/webapp/ext/fragment/AnexarEvidencia.fragment.xml` **(novo)**: `sap.m.Dialog` com `sap.ui.unified.FileUploader` (id `arquivo`; `fileType` com as extensões sem ponto e `maximumFileSize` em MB, preenchidos pela decisão 7; `placeholder` com o texto da spec), `sap.m.TextArea` (id `descricao`, `maxLength` 500, placeholder da spec), `sap.m.MessageStrip` (id `aviso`) e os botões Anexar/Cancelar. Os campos ficam ligados a um `JSONModel` `anexo` no próprio diálogo, e não há campos de texto para nome, tipo ou conteúdo (CA17).
   - **Carga:** `this.loadFragment({ id: 'anexarEvidencia', name: '...ext.fragment.AnexarEvidencia', controller: <objeto de handlers> })` (`fe.core: ExtensionAPI.ts:217-320`, público). Os handlers do XML (`press=".onConfirmar"`, `change=".onEscolherArquivo"`, `typeMissmatch=".onAviso"`, `fileSizeExceed=".onAviso"`) resolvem no objeto passado como `controller`.
   - **Resolução de IDs:** o fragmento é instanciado por `Fragment.load({ id: 'anexarEvidencia', ... })` (`fe.core: CommonUtils.ts:1370-1371`), então os controles recebem `anexarEvidencia--<id>`, **sem** prefixo da view. O código obtém o controle por `sap.ui.core.Fragment.byId('anexarEvidencia', 'arquivo')`, e não por `ExtensionAPI#byId`, que procura no escopo da view (`fe.core: ExtensionAPI.ts:122-128`). O prefixo `fe::CustomSubSection::<seção>--`, lição do 016, vale para seções customizadas, não para este diálogo. O handler guarda a instância do diálogo devolvida por `loadFragment` e só a reutiliza se `!dialogo.isDestroyed()`. Se ela estiver destruída, porque o diálogo é `addDependent` da view (`fe.core: ExtensionAPI.ts:310`), o handler carrega de novo (r1, M5).
   - **Leitura do arquivo:** no `change` do `FileUploader`, o handler pega `files[0]` (`name`, `type`, `size`) e lê com `FileReader.readAsDataURL`, usando a parte após a vírgula. É a mesma técnica do FE (`OperationParameterDialog.tsx:500-511`). `FileReader` e `sap` levam `// eslint-disable-line no-undef`, porque `eslint.config.mjs` só declara `globals.node` e `globals.jest` (r1, M6). Para um arquivo de 0 byte, o navegador pode devolver só `"data:"`, sem vírgula, e então a parte após a vírgula é `undefined`. Por isso `montarPedidoAnexo` normaliza `conteudo ?? ""` (r1, M2), e o servidor recusa com 400 `O arquivo não pode ser vazio.` (CA21).
   - **Envio:** `invokeAction('TratativaAppService.anexarEvidencia', { contexts: [linha], parameterValues, skipParameterDialog: true, label })`. É o padrão medido de `_gravar` (`MetodologiaExtension.controller.js:151-167`; DC-15 do 016: `skipParameterDialog` exige valor para todos os parâmetros). A Descrição vazia vai como `""`, que `validarDescricao` grava como `null` (`evidencias-validacao.ts:104-107`; CA18).

   **Módulo puro** `app/tratativas/webapp/ext/acoes/pedidoAnexo.js` **(novo)**: `sap.ui.define([], fabrica)` sem dependências, sem DOM nem UI5. Exporta:
   - `extensaoDe(nome)`, que devolve a extensão em minúsculas, com o ponto;
   - `avisoDoArquivo({ nome, tamanho }, regras)`, que devolve `null`, `'formato'` ou `'tamanho'` (R13: extensão fora de `regras.formatos` ou `tamanho > regras.tamanhoMaximo`);
   - `tipoParaEnvio(nome, tipoInformado, regras)`, que implementa R25 (b): devolve `tipoInformado` quando não vazio, **nunca corrigido**; quando vazio, o primeiro tipo da extensão em `regras.formatos`; se a extensão estiver fora, `""`;
   - `montarPedidoAnexo({ nome, tipo, conteudo, descricao }, regras)`, que devolve o array `parameterValues` com `nomeArquivo` = `nome` (sem sanitizar: a sanitização é do servidor, evidencias R2; CA19), `mimeType` = `tipoParaEnvio(...)`, `conteudo ?? ""` (M2) e `descricao ?? ""`.

   O handler de UI só junta arquivo, regras e Descrição e chama essas funções.

   **Aviso (R13, hipótese, opção a):** com `avisoDoArquivo` diferente de `null`, o `MessageStrip` mostra o motivo com o limite vindo das regras, e o botão Anexar fica desabilitado. Isso evita enviar até 10 MB para receber 415 ou 413. Os eventos `typeMissmatch`/`fileSizeExceed` do `FileUploader` levam ao mesmo aviso. O servidor continua sendo a verificação que vale (CA23): `.pdf` com Tipo `image/png` passa no aviso, que olha só a extensão, e é recusado com 415 pelo servidor (CA41 b).

   **M-R3-1:** se algum navegador informar `application/octet-stream` para uma extensão sem aplicativo registrado, o tipo **não** é completado, porque não está vazio, e o servidor recusa com 415. É coerente com R25. A verificação visual registra o tipo informado pelos navegadores-alvo (Edge e Chrome no Windows) para `.csv`.

   **Verificado por:** `test/acoes-nas-entidades-pedido-anexo.test.ts` **(novo)** sobre o módulo puro, no jest e sem navegador. O teste carrega o arquivo do app de **uma forma só** (r1, M3): `vm.runInNewContext(readFileSync(<caminho>, 'utf8'), { sap: { ui: { define: (_d, f) => { modulo = f(); } } } })`. Assim não há cache de módulo nem dependência do `transform` do jest; CONVENCOES proíbe importar `srv/`, não `app/`. Há um caso para `conteudo` `undefined`, que deve virar `""` (M2). Ele cobre CA41 a/b/c no lado da interface e R13. Também há o HTTP de CA18–CA22 e CA41 contra o servidor, e verificação visual de CA17, CA23 e CA41.

9. **Remover Evidência com confirmação que identifica o arquivo (R24, hipótese, opção a).** O handler `onRemover` lê `nomeArquivo` da linha selecionada (`requestProperty`) e abre `sap.m.MessageBox.confirm` com o texto i18n `removerEvidenciaConfirmar`: "Remover a evidência \"{0}\"? A remoção é lógica: a evidência deixa de aparecer e o registro permanece auditável." Só no OK ele chama `invokeAction('TratativaAppService.removerEvidencia', { contexts: [linha] })`. A action não tem parâmetros e não é crítica, então o FE não abre diálogo próprio (`fe.core: converters/annotations/DataField.ts:183-195`). No cancelamento, nada é chamado (CA40).

   **Por que não `@Common.IsActionCritical`:** o texto de confirmação do FE é fixo por action (`C_OPERATIONS_ACTION_CONFIRM_MESSAGE|<entidade>|<action>`, `fe.core: controllerextensions/editFlow/operations/Operation.ts:332-357`) e não recebe o nome do arquivo.

   **Verificado por:** verificação visual de CA4 e CA40.

10. **Cabeçalho só com o que é da Tratativa e anotações movidas (R9, R27).** Em `app/tratativas/annotations.cds`:
    - saem de `UI.Identification` as 7 entradas de `:46-80` (Criar Ação, Criar Subação, Delegar, Anexar, Remover, Comentar Tratativa, Comentar Ação). As vizinhas `mudarCriticidade` (`:41-45`) e `aplicarTemplate` (`:81-85`) ficam;
    - saem da `UI.LineItem` de `Acoes` os `DataFieldForAction` Iniciar e Concluir (`:205-214`), substituídos pelas ações do manifest (decisão 5);
    - os blocos de parâmetros de `criarSubacao`, `delegarAcao`, `anexarEvidencia`, `removerEvidencia` e `comentarAcao` passam de `annotate TratativaAppService.Tratativas with actions` (`:394-412`, `:587-631`) para `annotate TratativaAppService.Acoes with actions` e `annotate TratativaAppService.Evidencias with actions`, sem os parâmetros de código;
    - as `ValueList` de `responsavel`, `prioridade`, `evidenciaObrigatoria` (Criar Subação) e `novoResponsavel` (Delegar) ficam idênticas às de hoje (CA32).

    **Placeholders:**
    - Comentário (`comentarAcao`, `comentarTratativa`), Justificativa (`delegarAcao`), Arquivo e Descrição da Evidência (fragmento) usam os textos literais da spec (CA36);
    - a Descrição de Criar Ação e Criar Subação fica com o texto vigente "Descreva os fatos sem incluir nomes ou dados sensíveis." (R27: "os placeholders das operações movidas são os vigentes"). Ver "O desconfortável" 3.

    O restante do cabeçalho (transições, Emitir Aval, Alterar Criticidade, Aplicar Template) e a seção Metodologia não mudam.

    **Verificado por:** CA1 (visual) e teste automatizado sobre o CSN (decisão 11).

11. **Testes que migram, com caminhos exatos (R28; CA29, CA30).**

    Encontrados com `git grep -n "criarSubacao\|delegarAcao\|anexarEvidencia\|removerEvidencia\|comentarAcao" -- test` no worktree. Só os arquivos que usam `/api/app/v1` chamam as versões removidas. Os demais (`test/apoio/acoes.ts:4` e `test/apoio/evidencias.ts`) usam `/api/tratativa/v1`, que não muda (CA30).

    | Arquivo:linhas | Hoje | Passa a |
    |---|---|---|
    | `test/ui-tratativas.test.ts:194-200` | rótulo "CA9, CA10 e CA12 (Achado 4)": `Action: 'TratativaAppService.<x>'` no texto das anotações | rótulo "CA2, CA3 e CA29 (acoes-nas-entidades)": o `manifest.json` declara as ações de linha em `controlConfiguration` e o CSN não tem as 5 actions em `Tratativas` |
    | `test/ui-tratativas.test.ts:202-216` | `POST Tratativas(t)/criarSubacao {acaoMae,...}` | `POST Acoes(mae)/criarSubacao {...}`, resultado igual (CA3, CA15; substitui 013 CA9) |
    | `test/ui-tratativas.test.ts:218-240` | `Tratativas(t)/anexarEvidencia {acao,...}` e `Tratativas(t)/removerEvidencia {acao,evidencia}` | `Acoes(a)/anexarEvidencia {...}` e `Evidencias(e)/removerEvidencia {}`, resultados iguais (CA18; substitui 013 CA10) |
    | `test/ui-tratativas.test.ts:242-265` | `Tratativas(t)/comentarAcao {acao,...}` | `Acoes(a)/comentarAcao {...}`; `comentarTratativa` não muda (CA33; substitui 013 CA11) |
    | `test/ui-tratativas.test.ts:267-280` | rótulo "CA12 (Achado 4)": `Tratativas(t)/delegarAcao {acao,...}` | rótulo "CA3 e CA27 (acoes-nas-entidades)": `Acoes(a)/delegarAcao {novoResponsavel, justificativa}` |
    | `test/ui-acabamento.test.ts:129-143` | CA7 do 015: `blocoAcao(xml, 'criarSubacao')` com `prazo` `Edm.Date` | sem mudança de asserção (o nome continua único no EDMX). Rótulo acrescido "e CA32 (acoes-nas-entidades)" |
    | `test/ui-acabamento.test.ts:780-805` | R-20: placeholder lido em `TratativaAppService.Tratativas.actions[...]` | `delegarAcao`, `criarSubacao` e `comentarAcao` lidos em `TratativaAppService.Acoes.actions[...]`. Lista e regex iguais |
    | `test/mascara-lgpd-app.test.ts:61` | `Tratativas(t)/anexarEvidencia {acao,...}` | `Acoes(a)/anexarEvidencia {...}` |
    | `test/mascara-lgpd-app.test.ts:137`, `:143` | `Tratativas(t)/comentarAcao {acao,...}` | `Acoes(a)/comentarAcao {...}` |
    | `test/mascara-lgpd-app.test.ts:163` | `Tratativas(t)/removerEvidencia {acao,evidencia}` | `Evidencias(e)/removerEvidencia {}` |

    `test/ui-acabamento.test.ts:465-480` (CA7: `criarSubacao(` e `delegarAcao(` presentes no texto das anotações) continua passando, porque os blocos movidos mantêm o nome seguido de `(`, e não muda. A migração respeita CONVENCOES item 1: os helpers de `test/apoio/` não mudam, e os testes migrados usam `POST` local.

    **CAs substituídos (R28):**
    - 015 CA7 → CA32;
    - 013 CA9 → CA3, CA15, CA35;
    - 013 CA10 → CA17, CA18;
    - 013 CA11 → CA33, CA35.

    Os rótulos antigos são reapontados como na tabela (M-N3 da revisão de spec).

    **Testes novos (RED):**
    - `test/acoes-nas-entidades.test.ts` **(novo)**: HTTP no App. Cobre CA12, CA14, CA15, CA18–CA22, CA24–CA31, CA33, CA34, CA37 e CA41 (lado servidor). Também cobre o metadado de CA29 e CA32 e a declaração do manifest e das anotações (CA1, CA2 e CA6 na parte estática).
    - `test/acoes-nas-entidades-pedido-anexo.test.ts` **(novo)**: módulo puro (decisão 8).

    **Verificado por:** `sh agentic/mecanismos/scripts/verify.sh` verde (CA38).

12. **Dependência `sap.ui.unified` declarada (N3-4).** O fragmento usa `sap.ui.unified.FileUploader`. São duas declarações:
    - `"sap.ui.unified": { "lazy": false }` em `sap.ui5.dependencies.libs` de `app/tratativas/webapp/manifest.json:50-55`;
    - `- name: sap.ui.unified` em `framework.libraries` de `app/tratativas/ui5.yaml`.

    Não é pacote npm novo: é biblioteca da mesma distribuição SAPUI5 1.136.23, sem `deprecated` (medido pelo orquestrador no ui5-mcp), e já carregada de forma transitiva pelo próprio FE (`fe.macros: coreUI/OperationParameterDialog.tsx:78` importa `sap/ui/unified/FileUploader`). A declaração explícita evita depender do carregamento transitivo.

    **Verificado por:** CA17 (visual) e o teste estático do manifest (decisão 11).

## Contrato executável
- **O que é:** o `srv/tratativa-app-service.cds` novo. As mudanças, em relação a `b58543a`, foram aplicadas a uma cópia isolada do arquivo, fora do repositório, com o `using` apontando para `db/tratativa` do worktree:

```cds
// Tratativas: flags novas (decisão 3)
        false as podeCriarAcao             : Boolean,
        false as ocultaGestaoAcoes         : Boolean,
        false as podeComentarTratativa     : Boolean,
        false as ocultaComentarTratativa   : Boolean,
        false as ocultaOperacoesDeAcao     : Boolean,
// Tratativas: ficam só estas duas das 7 (R16); saem criarSubacao, delegarAcao, anexarEvidencia, removerEvidencia, comentarAcao
    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeCriarAcao
    action criarAcao(descricao : String, responsavel : String, prazo : Date, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;
    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeComentarTratativa
    action comentarTratativa(texto : String, mencoes : many String) returns ResultadoComentario;

// Regras de anexo (decisão 7)
  type FormatoEvidencia { extensao : String(10); tipos : many String(100); }
  type RegrasAnexoEvidencia { tamanhoMaximo : Integer; formatos : many FormatoEvidencia; }
  @requires: 'authenticated-user'
  function regrasAnexoEvidencia() returns RegrasAnexoEvidencia;

// Acoes
  entity Acoes as projection on m.Acoes { key codigo, ..., acaoMae,
        false as ocultaOperacoesDaLinha : Boolean,
        false as podeCriarSubacao       : Boolean,
        false as podeDelegar            : Boolean,
        false as podeAnexarEvidencia    : Boolean,
        false as podeComentarAcao       : Boolean,
        false as podeIniciarAcao        : Boolean,
        false as podeConcluirAcao       : Boolean
  } actions {
    @Core.OperationAvailable: in.podeIniciarAcao  action iniciar();
    @Core.OperationAvailable: in.podeConcluirAcao action concluir();
    @requires: 'GestorTratativa'    @Core.OperationAvailable: in.podeCriarSubacao
    action criarSubacao(descricao : String, responsavel : String, prazo : Date, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;
    @requires: 'GestorTratativa'    @Core.OperationAvailable: in.podeDelegar
    action delegarAcao(novoResponsavel : String, justificativa : String);
    @requires: 'authenticated-user' @Core.OperationAvailable: in.podeAnexarEvidencia
    action anexarEvidencia(nomeArquivo : String, mimeType : String, conteudo : String, descricao : String) returns DetalheEvidencia;
    @requires: 'authenticated-user' @Core.OperationAvailable: in.podeComentarAcao
    action comentarAcao(texto : String, mencoes : many String) returns ResultadoComentario;
  };

// Evidencias (antes: projeção inteira sem actions)
  @readonly
  entity Evidencias as projection on m.Evidencias {
    *,
    false as ocultaRemover : Boolean,
    false as podeRemover   : Boolean
  } actions {
    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeRemover
    action removerEvidencia();
  };
```

  Os handlers implementam o seguinte (assinaturas que a task produz):
  - `on('criarSubacao'|'delegarAcao'|'anexarEvidencia'|'comentarAcao', 'Acoes', ...)`: `localizarAcaoDaLinha(req)` e depois a função de domínio da decisão 1;
  - `on('removerEvidencia', 'Evidencias', ...)`: `localizarEvidenciaDaLinha(req)` e depois `removerEvidencia`;
  - `on('regrasAnexoEvidencia', ...)`: devolve as regras da decisão 7;
  - `after('READ', 'Acoes' | 'Evidencias')`: as flags da decisão 3.
  - `alterarStatusAcao` (iniciar/concluir de `Acoes` e `MinhasAcoes`): passa a resolver a linha por `localizarAcaoDaLinha(req)` (decisão 2, correção de defeito existente).

  As funções de `srv/tratativa/operacoes-linha-app.ts` **(novo)**:
  - `localizarAcaoDaLinha(req): Promise<{ codigoAcao: string; codigoTratativa: string }>` (usa o último segmento de `req.params` e, com 2 segmentos, confere o pertencimento à Tratativa do primeiro);
  - `localizarEvidenciaDaLinha(req): Promise<{ codigoEvidencia: string; codigoAcao: string; codigoTratativa: string }>`;
  - `indicacoesAcoes(req, codigos: string[]): Promise<Map<string, IndicacoesAcao>>`;
  - `indicacoesEvidencias(req, codigos: string[]): Promise<Map<string, IndicacoesEvidencia>>`;
  - `regrasAnexo(): { tamanhoMaximo: number; formatos: { extensao: string; tipos: string[] }[] }`.

  O módulo do app `app/tratativas/webapp/ext/acoes/pedidoAnexo.js` **(novo)** exporta:
  - `extensaoDe(nome: string): string`;
  - `avisoDoArquivo({ nome, tamanho }, regras): null | 'formato' | 'tamanho'`;
  - `tipoParaEnvio(nome, tipoInformado, regras): string`;
  - `montarPedidoAnexo({ nome, tipo, conteudo, descricao }, regras): Array<{ name, value }>`.

- **Como se valida:** compilação pontual da cópia isolada para EDMX, pelo `@sap/cds` 10.1.1 do worktree, com tempo-limite de 60 s:
  `timeout 60 npx cds compile <cópia>/tratativa-app-service.cds --to edmx --service TratativaAppService`. Em seguida, `grep` das actions e das anotações. Conforme a instrução do orquestrador, este papel não sobe servidor nem roda jest; o esqueleto de teste HTTP e a medição ficam com o RED da task e com o orquestrador.
- **Saída da validação (medido em 2026-10-14):**
```
exit=0   (stderr vazio; EDMX com 1396 linhas)
<Action Name="criarAcao" IsBound="true">        <Parameter Name="in" Type="TratativaAppService.Tratativas"/>
<Action Name="comentarTratativa" IsBound="true"><Parameter Name="in" Type="TratativaAppService.Tratativas"/>
<Action Name="iniciar" IsBound="true">          <Parameter Name="in" Type="TratativaAppService.Acoes"/>
<Action Name="iniciar" IsBound="true">          <Parameter Name="in" Type="TratativaAppService.MinhasAcoes"/>
<Action Name="concluir" IsBound="true">         <Parameter Name="in" Type="TratativaAppService.Acoes"/>
<Action Name="concluir" IsBound="true">         <Parameter Name="in" Type="TratativaAppService.MinhasAcoes"/>
<Action Name="criarSubacao" IsBound="true">     <Parameter Name="in" Type="TratativaAppService.Acoes"/>
    descricao Edm.String, responsavel Edm.String, prazo Edm.Date, prioridade Edm.String, evidenciaObrigatoria Edm.String
<Action Name="delegarAcao" IsBound="true">      <Parameter Name="in" Type="TratativaAppService.Acoes"/>  novoResponsavel, justificativa
<Action Name="anexarEvidencia" IsBound="true">  <Parameter Name="in" Type="TratativaAppService.Acoes"/>  nomeArquivo, mimeType, conteudo, descricao
<Action Name="comentarAcao" IsBound="true">     <Parameter Name="in" Type="TratativaAppService.Acoes"/>  texto, mencoes Collection(Edm.String)
<Action Name="removerEvidencia" IsBound="true"> <Parameter Name="in" Type="TratativaAppService.Evidencias"/>
<Function Name="regrasAnexoEvidencia" IsBound="false" IsComposable="false">
Core.OperationAvailable: in/podeCriarAcao, in/podeComentarTratativa, in/podeIniciarAcao, in/podeConcluirAcao,
                         in/podeCriarSubacao, in/podeDelegar, in/podeAnexarEvidencia, in/podeComentarAcao, in/podeRemover
<Property Name="ocultaGestaoAcoes" Type="Edm.Boolean"/>   (Tratativas)
<Property Name="ocultaOperacoesDaLinha" Type="Edm.Boolean"/> (Acoes)
<Property Name="ocultaRemover" Type="Edm.Boolean"/> <Property Name="podeRemover" Type="Edm.Boolean"/> (Evidencias)
```
  Observações conferidas na saída:
  - nenhuma das 5 actions removidas aparece ligada a `Tratativas`;
  - as sobrecargas de `MinhasAcoes.iniciar`/`concluir` ficam sem `OperationAvailable`, então Minhas Pendências não muda.

  **Pendente de medição pelo orquestrador ou pela task:** `cds build`, `@cds-models` (`npx @sap/cds-typer`) e o esqueleto HTTP (RED de `test/acoes-nas-entidades.test.ts`).

## Tasks
| Task | Objetivo | Branch |
|---|---|---|
| tasks/001-acoes-nas-entidades.md | Operações de Ação e Evidência na linha selecionada (servidor, anotações, manifest, extensão e diálogo de anexo), com a migração dos testes do App | acoes-nas-entidades/001-acoes-nas-entidades |

Uma task só. O contrato do servidor (actions novas e remoção das antigas) e a interface (cabeçalho, barras e diálogo) precisam entrar juntos. Se o servidor fosse separado, o cabeçalho ficaria apontando para actions que não existem mais. Se fossem separados ao contrário, os botões ficariam sem action para chamar.

## Itens N3 (aprovação no Gate 1)
| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | **Contrato novo do `/api/app/v1` (`TratativaAppService`).** Saem de `Tratativas` as actions `criarSubacao`, `delegarAcao`, `anexarEvidencia`, `removerEvidencia` e `comentarAcao`, que eram ligadas com código por parâmetro. Entram `Acoes.criarSubacao`, `Acoes.delegarAcao`, `Acoes.anexarEvidencia`, `Acoes.comentarAcao`, `Evidencias.removerEvidencia()` e a function `regrasAnexoEvidencia()`. Cada action de linha, e também `Acoes.iniciar`/`concluir`, é aceita por **dois caminhos**: direto (`Acoes(a)/<action>`, `Evidencias(e)/<action>`) e por contenção (`Tratativas(t)/acoes(a)/<action>`, `Tratativas(t)/evidencias(e)/<action>`). A interface usa o caminho por contenção. Entram também as propriedades calculadas `pode*`/`oculta*` em `Tratativas`, `Acoes` e `Evidencias`, e `@Core.OperationAvailable` em `criarAcao`, `comentarTratativa`, `Acoes.iniciar` e `Acoes.concluir`. Para a interface, a recusa 400 `Código inválido.` passa a ser 404 (R14), e a Evidência inativa passa a dar 404 antes de 403/409 (decisão 2, M1). Inclui a correção do defeito existente de `Acoes.iniciar`/`concluir` pela contenção (decisão 2). O `/api/tratativa/v1` não muda. O serviço atende só a interface (R16), e não há consumidor externo conhecido. | contrato público (OData do App) | aprovado pelo orquestrador por delegação do humano, 2026-10-14 (R-04) |
| N3-2 | **`@requires` e derivação do vínculo.** As actions novas têm a mesma exigência das antigas: `@requires: 'GestorTratativa'` em Criar Subação e Delegar; `'authenticated-user'` mais a verificação dinâmica (Gestor ou Responsável da Ação) dentro da função de domínio em Anexar, Comentar Ação e Remover. Nos dois caminhos o `@requires` vale antes do handler, então o 403 estático precede o 404. O vínculo deixa de vir de parâmetro e é derivado no servidor:<br>• registro-alvo: chave do **último** segmento do caminho;<br>• Tratativa: `tratativa_codigo` lido do banco para o registro;<br>• Ação de uma Evidência: `acao_codigo` lido do banco;<br>• no caminho por contenção, a chave `t` do primeiro segmento precisa ser igual ao `tratativa_codigo` do registro. Se não for, ou se `t` for malformada, a resposta é 404 (R14 c).<br>Sem `@restrict` e sem papel novo. O `AplicativoOrigem` continua barrado pelo `before('*')`. A ordem das recusas segue R14 d (decisão 2). | segurança / roles | aprovado pelo orquestrador por delegação do humano, 2026-10-14 (R-04) |
| N3-3 | **LGPD dos anexos e das indicações.** (a) As indicações de disponibilidade são booleanas, calculadas para o usuário autenticado, e não trazem matrícula nem lista de pessoas (R6; CA14). Elas revelam ao próprio usuário só o vínculo dele com a linha. (b) O arquivo é lido no navegador e enviado em base64 pelo mesmo `anexarEvidencia` de hoje. A interface não sanitiza o nome do arquivo (o servidor sanitiza, evidencias R2) e não guarda o arquivo. (c) Quem lista, vê ou baixa Evidências não muda (evidencias R11; DC-18). `autorAnexo` continua `null` para não-Gestor, e `mascara-app.ts` não muda (decisão 4). (d) Os placeholders contra dados sensíveis estão no arquivo, na Descrição, no Comentário e na Justificativa (R20). (e) R25: o Tipo do arquivo é completado só quando vem vazio, com os pares do servidor, e nunca corrigido. A defesa de evidencias R3 fica intacta. | dados pessoais (LGPD) e segurança | aprovado pelo orquestrador por delegação do humano, 2026-10-14 (R-04) |
| N3-4 | **Dependência de biblioteca UI5 `sap.ui.unified`** declarada em `app/tratativas/webapp/manifest.json` e `app/tratativas/ui5.yaml`. É da mesma distribuição SAPUI5 1.136.23, sem pacote npm novo, e já é carregada de forma transitiva pelo FE (decisão 12). | dependência nova | aprovado pelo orquestrador por delegação do humano, 2026-10-14 (R-04) |
| N3-5 | **Testes aprovados reescritos (R28).** 015 CA7 e 013 CA9, CA10 e CA11 são substituídos. 10 trechos de `test/ui-tratativas.test.ts`, `test/ui-acabamento.test.ts` e `test/mascara-lgpd-app.test.ts` são reescritos para as actions de linha, com o mesmo resultado esperado (decisão 11). | caminho protegido (testes aprovados) | aprovado pelo orquestrador por delegação do humano, 2026-10-14 (R-04) |

## Como isso se prova
- **Automatizado, em `test/acoes-nas-entidades.test.ts` (novo; HTTP no `/api/app/v1` e CSN de `cds.load(['srv','app'])`):**
  - CA12: `podeAnexarEvidencia` `true` com 10 ativas, e 409 ao anexar;
  - CA14: como `M1001` não-Gestor, `GET Tratativas(t)?$select=...flags`, `Tratativas(t)/acoes?$select=responsavel,ocultaOperacoesDaLinha,pode*` e `Tratativas(t)/evidencias?$select=autorAnexo,ocultaRemover,podeRemover`. Asserções: `responsavel` e `autorAnexo` `null`; flags só booleanas; serialização sem nenhuma matrícula (`M1001`, `M2002`, `gestor`);
  - CA15: `Acoes(subacao)/criarSubacao`, 400 `Uma Subação não pode ter Subações.`;
  - CA18–CA22 e CA41 (servidor): `Acoes(a)/anexarEvidencia`;
  - CA24 (precedência D10): 403 antes de 409, e 409 antes de 400;
  - todas as operações de linha, e `Acoes.iniciar`/`concluir`, pelos dois caminhos, direto e por contenção (decisão 2; r1, C1);
  - caminho fora dos aceitos, por exemplo `POST Acoes(sub)/acaoMae/criarSubacao` e `POST Acoes(a)/acaoMae/iniciar`, dá 404 e não executa nada (r2, M2-1);
  - CA25: 404 com chave inexistente, malformada (`xyz`) e Evidência inativa; Ação ou Evidência de outra Tratativa por `Tratativas(t)/acoes(a)/...` e `Tratativas(t)/evidencias(e)/...`; chave `t` malformada; nenhum 400 `Código inválido.`;
  - CA26: `M1001` em `Acoes(<inexistente>)/criarSubacao` e em `Tratativas(t)/acoes(<inexistente>)/criarSubacao` dá 403; em `.../anexarEvidencia`, 404;
  - M1: Evidência inativa com usuário sem vínculo dá 404, e não 403; com a Tratativa `Encerrada`, dá 404, e não 409;
  - CA27: matriz de papéis;
  - CA28: `comoApp` 403, `semAuth` 401;
  - CA29: CSN sem as 5 actions em `TratativaAppService.Tratativas.actions` e com as novas em `Acoes`/`Evidencias`;
  - CA31: `linhas('HistoricoAcoes', ...)` com o mesmo evento, e `espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes')` desfazendo tudo;
  - CA32: EDMX com `prazo` `Edm.Date`, e CSN com `ValueList` nos parâmetros de `Acoes.criarSubacao`/`delegarAcao`;
  - CA33, CA34: comentário na Ação, delegação que troca a permissão, limites de texto e menções;
  - CA37: Tratativa com Origem e Tratativa avulsa;
  - estático, sobre o manifest e as anotações: `controlConfiguration` com as 9 ações e `enableOnSelect: "single"` nas de linha (CA2, CA6, CA7). Em Criar Ação e Comentar Tratativa, `visible` e `enabled` precisam ser **exatamente** os bindings `{= ${ocultaGestaoAcoes} !== true }`/`{= ${podeCriarAcao} === true }` e `{= ${ocultaComentarTratativa} !== true }`/`{= ${podeComentarTratativa} === true }` (r2, M2-3), e `UI.Identification` sem as 7 entradas (CA1).
- **Automatizado, em `test/acoes-nas-entidades-pedido-anexo.test.ts` (novo; módulo puro, sem navegador):**
  - `tipoParaEnvio('dados.csv', '', regras)` = `text/csv` (CA41 a);
  - `tipoParaEnvio('a.pdf', 'image/png', regras)` = `image/png`, sem correção (CA41 b);
  - `tipoParaEnvio('a.exe', '', regras)` = `''` (CA41 c);
  - `avisoDoArquivo` dá `'formato'` para `.exe` e `'tamanho'` para 10.485.761 bytes, e `null` para 10.485.760 (R13);
  - `montarPedidoAnexo` devolve os 4 `parameterValues`, com Descrição vazia como `""`.

  As `regras` do teste são as devolvidas por `GET /api/app/v1/regrasAnexoEvidencia()` no mesmo arquivo, então não há lista copiada no teste.
- **Migrados:** os 10 trechos da decisão 11, com os mesmos resultados esperados (R28). CA30: a suíte do `TratativaService` roda sem nenhuma mudança.
- **Visual (navegador local, `cds watch` + FLP sandbox, como em 015 R10):**
  - CA1–CA11, CA13, CA16, CA17, CA23, CA35, CA36, CA39, CA40, CA42;
  - registro do Tipo informado por Edge e Chrome para `.csv` (M-R3-1);
  - medição de que, após Delegar ou Criar Subação, a linha continua selecionada (R26).
- **Esteira:** `sh agentic/mecanismos/scripts/verify.sh` verde, sem navegador nem rede externa (CA38).

## O que não muda
- `srv/tratativa-service.cds`, `srv/tratativa-service.ts` e todas as funções de domínio de `srv/tratativa/` (regras, mensagens, bloqueio D9, histórico, compensação). A única exceção é o `export` de `FORMATOS_ACEITOS` em `evidencias-validacao.ts`, sem mudar o valor.
- `srv/tratativa/mascara-app.ts`: regras de máscara, leitura por vínculo, varredura DC-19 e `@cds.search` (decisão 4).
- `db/tratativa.cds`: sem migração. As flags são elementos calculados da projeção do serviço.
- `xs-security.json`: sem papel novo.
- `MinhasAcoes`, `MinhasTratativas` e o app Minhas Pendências.
- Cabeçalho: transições, Emitir Aval Técnico, Alterar Criticidade e Aplicar Template, com suas flags (`app/tratativas/annotations.cds:10-45`). A exceção são os `SideEffects` das quatro transições, que ganham as flags e as navegações novas (decisão 5; r1, I1). Os demais `SideEffects` (`:464-466`, `:478-492`) não mudam.
- Seção Metodologia e `MetodologiaExtension.controller.js`, que só divide o `manifest.json` com as ações novas.
- `criarAcao` e `comentarTratativa`: mesma assinatura, mesmo `@requires` e mesmo handler. Muda só o local do botão e o `@Core.OperationAvailable`.

## O desconfortável, declarado
1. **Os botões dependem de pontos de extensão do Fiori elements lidos no código-fonte, não no MCP do UI5.** São eles: `visible`/`enabled` por método de módulo com contextos selecionados, `enableOnSelect: "single"`, `ExtensionAPI#loadFragment`/`refresh` e o `@UI.Hidden` de barra avaliado na página. O MCP do UI5 não estava disponível para este papel, e as citações são do fonte 1.136.24 no cache do UI5 tooling. A verificação visual da task confirma CA2, CA6, CA7 e CA13. **Recuo**, se a visibilidade por linha não reagir à seleção: deixar os botões de papel dinâmico sempre visíveis a quem tem `!ocultaOperacoesDeAcao`, só desabilitados na linha alheia. Esse recuo diverge de CA13 ("não aparecem") e precisaria voltar ao Gate 1 como divergência.
2. **Seleção após atualizar `acoes` (R26).** Depois de Delegar ou Criar Subação, a manutenção da seleção depende de `requestSideEffects` manter o contexto da linha. **Recuo:** depois do `refresh`, localizar o contexto de mesmo caminho em `ODataListBinding#getAllCurrentContexts` e chamar `Context#setSelected(true)`. Se nem assim, registrar em "Divergências" do relatório; R26 é hipótese.
3. **Placeholder da Descrição de Criar Ação e Criar Subação (r1, M4: divergência legítima, sem ruling).** A lista da spec traz "Descreva a ação corretiva ou preventiva de forma clara e objetiva" (veio de `acabamento-ui-fiori/spec.md:34`), sem o alerta de dados sensíveis. O código vigente usa "Descreva os fatos sem incluir nomes ou dados sensíveis." e o teste R-20 (`test/ui-acabamento.test.ts:780-805`) exige "dados sensíveis". O design fica com o texto vigente, porque R27 diz "os placeholders das operações movidas são os vigentes" e CA36 não cobre esses dois diálogos. Os demais (Comentário, Justificativa, Arquivo, Descrição da Evidência) usam os textos literais da spec. Se o Gate 1 preferir o texto da spec, o teste R-20 precisa de exceção aprovada. **Obrigatório no relatório da task, em "Divergências":** (a) a lista de placeholders da spec (`spec.md:46-51`) deve ser corrigida para a Descrição da Ação e da Subação; (b) Comentário e Justificativa trocam o texto vigente pelo literal da spec por causa de CA36. É uma mudança visível ao usuário e precisa ficar dita.
4. **Diálogo de anexo fora do padrão do FE.** O Fiori elements tem upload no diálogo de action, mas só via `Edm.Stream` em tipo complexo, e preenche Tipo vazio com `application/octet-stream`. Isso inviabiliza R25 (b) e a função testável (decisão 8). O diálogo próprio é código de UI a manter: um fragmento e um módulo de handlers. A lógica que decide (aviso, tipo, pedido) fica no módulo puro testado na esteira.
5. **Tamanho do pedido.** O conteúdo vai em base64 no JSON: 10 MB viram cerca de 13,4 MB de corpo. O limite de corpo atual (evidencias R14 etapa 2, cerca de 15 MB) comporta, e o aviso de R13 impede enviar acima de 10 MB pela interface. Envio direto ao serviço acima do limite continua recusado antes das regras, sem mensagem do domínio (Divergências da spec).
6. **Flags no `$expand` ficam `false`.** Quem ler `Tratativas?$expand=acoes` recebe as flags de `Acoes` como `false`, porque o `after` só roda na entidade alvo. A Object Page lê a tabela por navegação (`Tratativas(t)/acoes`, DC-18 M4-01), onde as flags são calculadas. É fail-closed: botão desabilitado, nunca habilitado indevidamente.
7. **Flags em `$filter` não refletem o valor calculado** (decisão 4): `$filter=podeRemover eq true` devolve vazio. Isso é aceito, porque as flags servem à tela e não a consulta. É o mesmo comportamento das flags de `Tratativas`.
8. **Fim do Iniciar/Concluir em lote no Plano de Ação** (R4 e R23, hipóteses; Q6 da spec). Se o Gate 1 escolher Q6 (b), Iniciar e Concluir saem de `enableOnSelect: "single"` e da visibilidade por linha, e voltam a `DataFieldForAction` sem flags.
9. **Custo de leitura.** A habilitação por linha adiciona uma consulta em lote por leitura de `Acoes`/`Evidencias` e mais duas no `after('READ', 'Tratativas')` para não-Gestor (Participantes e `responsavelPrincipal`). É o mesmo custo das flags do 016: uma consulta por lote, não por linha.
