# Design: metodologias-e-aval-tecnico

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** aprovado

Escopo técnico: diagnóstico de causa raiz por metodologia (3W, 5 Porquês, 5W2H, PDCA/8D) gravado na Tratativa, derivação de Ações a partir da análise, Aval Técnico (Verificação de Eficácia) como condição universal de encerramento, papel `ValidadorTecnico` com designação por Origem, prazo de verificação com alertas, indicadores de eficácia e a interface Fiori elements correspondente.

**Base de código:** o 016 empilha sobre a 015 (branch `acabamento-ui-fiori/001-acabamento-ui-fiori`, HEAD `dca72ac`). Todo arquivo, entidade, serviço, operação, tipo e linha citados abaixo foram conferidos nesse worktree. Arquivos que ainda não existem aparecem como **(novo)** e estão em "Criados" na task correspondente.

**Revisão r1 (DEVOLVIDO):** este documento substitui a versão r1. O mapa achado → correção está na seção "Mapa dos achados da revisão r1"; as escolhas novas estão em "Decisões de correção (r1)".

**Revisão r2 (DEVOLVIDO, `agentic/.estado/execucao/2026-10-13-metodologias/revisao-design-parecer-2.md`):** corrigidos N-I01, N-I02 e N-M01..N-M10. Rulings aplicados: R-07 (DV-01..04 resolvidas na spec) e R-08 (DV-05; CA34 com 400; `validadorPadrao` descritivo). Escolhas novas em "Decisões de correção (r2)"; mapa em "Mapa dos achados da revisão r2".

**Revisão r3 (DEVOLVIDO, `agentic/.estado/execucao/2026-10-13-metodologias/revisao-design-parecer-3.md`):** corrigidos R3-I01 e R3-M01..R3-M05. Ruling aplicado: R-10 (máscara genérica com fail-closed, cobrindo também os campos da 015; o vazamento pré-existente é corrigido no 016). Escolha nova em "Decisões de correção (r3)" (DC-17) e task nova `tasks/000-mascara-lgpd-app.md`, antecipada; mapa em "Mapa dos achados da revisão r3".

**Ruling R-11 (delegação do humano, `agentic/.estado/execucao/2026-10-13-metodologias/progress.md:30`):** os campos que a DC-17 deixava em `FORA_DA_MASCARA` (`Comentarios.texto/autor/mencoes[].matricula`, `Evidencias.nomeArquivo/descricao/autorAnexo/autorRemocao`, `Historico.valorAnterior/valorNovo/justificativa/autor`) passam a seguir no `TratativaAppService` as mesmas regras de acesso e mascaramento das specs `evidencias`, `comentarios` e `historico-e-auditoria`. Escolha nova DC-18 (task 000, mesmo módulo); `FORA_DA_MASCARA` deixa de existir.

**Revisão r4 (DEVOLVIDO, `agentic/.estado/execucao/2026-10-13-metodologias/revisao-design-parecer-4.md`) e Ruling R-13 (delegação do humano, `progress.md:32`):** corrigidos I4-01 e M4-01..M4-04, todos dentro da DC-18 (marcados "r4"), da task 000 e da task 007; mapa em "Mapa dos achados da revisão r4".

**Revisão r5 (DEVOLVIDO, `agentic/.estado/execucao/2026-10-13-metodologias/revisao-design-parecer-5.md`) e Ruling R-14 (delegação do humano, `progress.md:34`):** corrigidos I5-01 (DC-19, nova: `$filter`, `$orderby`, `$apply`/`$compute` e `$search` deixam de contornar a leitura e a máscara do App) e M5-01..M5-03; mapa em "Mapa dos achados da revisão r5".

**Revisão r6 (DEVOLVIDO, `agentic/.estado/execucao/2026-10-13-metodologias/revisao-design-parecer-6.md`) e Ruling R-15 (delegação do humano, `progress.md:36`):** corrigidos I6-01 (DC-19: a varredura cobre só a query do cliente, síncrona e antes de qualquer injeção, no primeiro `before('READ', …)` registrado), M6-01 ("Acesso negado." ao ordenar/filtrar coluna decidida, declarado) e M6-02 (formas aceitas pela varredura listadas); mapa em "Mapa dos achados da revisão r6".

---

## Decisões de correção (r5)

| # | Achado | Decisão | Alternativa descartada | Fonte |
|---|---|---|---|---|
| DC-19 | I5-01 (R-14) | **Predicados, ordenação, agrupamento, colunas calculadas e busca não contornam a leitura nem a máscara do App: para não-Gestor, `restricaoDeLeitura` varre toda expressão da query, e a busca exclui os campos pessoais por `@cds.search`.** Hoje (DC-18, r4) a guarda olha só `SELECT.from.ref`, e a máscara só zera os valores devolvidos. Um predicado sobre campo mascarado ou sobre entidade restrita filtra as linhas pelo valor escondido e o revela pela presença da linha ou pela ordem. Exemplos como não-Gestor: `Tratativas?$filter=comentarios/any(c:contains(c/texto,'…'))` e `comentarios/any(c:c/autor eq 'M1001')` (contornam a `comentarios/spec.md` R3/R7); `historico/any(h:contains(h/justificativa,'…'))`; `evidencias/any(e:e/autorAnexo eq 'M1001')`; `$filter=solicitante eq 'M2002'`; `contains(descricao,'…')`; `$orderby=responsavelPrincipal`; `Acoes?$filter=responsavel eq 'M1001'`; `Participantes?$filter=matricula eq 'M2002'`; `$search=M2002` (o projeto não tem `@cds.search`, então a busca padrão cobre todo `cds.String` da entidade). No Node.js o CAP não autoriza associações usadas em `where`: isso só existe no Java. **Forma CQN varrida (conferida):** (1) cds-mcp "Expression Notation (CXN) > References": `{ref:[..._segment]}`, com `_segment = string \| {id, args, where, groupBy, having, orderBy, limit}`. (2) cds-mcp "Query Notation (CQN) > SELECT": `from`, `columns`, `where`, `having`, `groupBy`, `orderBy`. (3) cds-mcp "CXL > Infix Filters > Applied to exists Predicate": `exists books[stock > 100]`, aninhável. (4) cds-mcp "Serving OData APIs > Feature Overview": lambda `any`/`all` suportado no Node.js; `$search` usa `@cds.search`; `$search` dentro de `$expand` é N/A no Node.js. (5) Gramática instalada no worktree (`@sap/cds` 10.1.1, `node_modules/@sap/cds/libx/odata/parse/grammar.peggy`). Em `:836-865`, `nav/any(x:pred)` vira `['exists', {ref:[...nav, {id, where: pred}]}]`, com o prefixo `x/` removido: as refs internas são relativas ao alvo da coleção. `any()` vazio vira `['exists', {ref:[...]}]`. `all(x:pred)` vira `['not', 'exists', {ref:[..., {id, where:['not', {xpr: pred}]}]}]`. Uma lambda aninhada vira `exists` dentro do `where` do segmento. `$orderby` recusa lambda (`:891`). As opções de `$expand` (`$filter`, `$orderby`, `$select`, `$expand`, `$apply`) ficam na própria coluna `{ref, expand, where, orderBy, limit}` do nível (`:698-711`). `$apply` vira `where`/`groupBy`/`having`/colunas agregadas e pode embrulhar a query em `SELECT.from.SELECT` (`:204-240`). `$compute` vira colunas `{xpr\|func, as}`. (6) `@cap-js/db-service` 3.1.1 (`lib/search.js`, `_getSearchableColumns`): a busca padrão usa os elementos `cds.String` não virtuais nem calculados, inclusive as FKs geradas; `LargeString` fica fora. `@cds.search.<el>: false` tira só `<el>` e mantém o padrão para os demais. Uma associação só entra na busca se for anotada. **Mecanismo (task 000, mesmo módulo e mesmo `before`):** para não-Gestor, `restricaoDeLeitura` percorre, além dos segmentos de `from.ref` (DC-18):<br>• o `where` de cada segmento de `from.ref`;<br>• `where`, `having`, `groupBy` e `orderBy` da raiz;<br>• toda coluna que não é ref simples nem `'*'`, isto é, as colunas `xpr`/`func` de `$compute`/`$apply`;<br>• em cada coluna `{ref, expand}`, em qualquer profundidade, os `where`, `having`, `groupBy`, `orderBy` e colunas calculadas do nível, com o alvo da expansão como base;<br>• `from.SELECT` (subconsulta do `$apply`), como uma query.<br>Dentro de cada expressão, desce por `xpr`, `func.args`, `list` e pelos modificadores (`where`, `having`, `groupBy`, `orderBy`) de todo segmento `{id, ...}` de ref, com o alvo do segmento como base. Para cada `{ref}`, resolve os segmentos a partir da entidade base e responde `req.reject(403, 'Acesso negado.')` quando:<br>(a) um segmento é associação ou composição cujo `_target` tem regra `soGestor` ou `porVinculo`;<br>(b) o último segmento é elemento de `campos` fora de `filtraveis` (abaixo), ou elemento com `@PersonalData.IsPotentiallyPersonal` de entidade sem regra (fail-closed, a mesma regra padrão do `after`);<br>(c) a ref não resolve no modelo, ou o nó de expressão tem forma desconhecida (fail-closed).<br>**"Exceto o último segmento do caminho, já filtrado":** a base das refs da raiz é o último segmento de `from.ref` (`req.target`), que a DC-18 já filtra (`porVinculo`) ou libera pela navegação (`/Tratativas(<id>)/comentarios`). Esse segmento não conta como travessia, e as refs relativas a ele passam só pelo critério (b). Por isso `M2002` em `/Tratativas(<id>)/comentarios?$filter=contains(texto,'…')` continua 200, porque `texto` é filtrável em `Comentarios`. Já `mencoes/any(...)` nessa navegação responde 403: o alvo é `soGestor`, e pela R7 só o Gestor vê menções. **`filtraveis`** (campo opcional novo de `RegraMascara`; o padrão é `liberados`) é o subconjunto de `liberados` que pode aparecer em predicado, ordenação, agrupamento, coluna calculada e busca. `Historico` declara `filtraveis: []`: `valorAnterior`/`valorNovo` só são liberados linha a linha (fora de `CAMPOS_MATRICULA`), e `Historico?$filter=valorNovo eq 'M2002'` revelaria a matrícula pela presença da linha. Os campos que a 007 libera por vínculo, linha a linha (`metodologiaData`, `Acoes.causaDescricao`, `AvalesTecnicos.fundamentacao`), já ficam fora de `liberados` e, portanto, de `filtraveis`. **Busca:** `srv/tratativa-app-service.cds` anota em cada entidade do App `@cds.search: { <campo>: false, ... }` para todo campo de `campos` fora de `filtraveis` com tipo `cds.String` ou `cds.LargeString`: `Tratativas` (`descricao`, `solicitante`, `responsavelPrincipal`), `Acoes` (`responsavel`), `Participantes` (`matricula`), `Evidencias` (`autorAnexo`, `autorRemocao`), `Historico` (`autor`, `justificativa`, `valorAnterior`, `valorNovo`) e o alvo de `mencoes` (`matricula`). `Comentarios` não precisa, porque `texto` e `autor` são filtráveis. Nenhum `@cds.search` inclui associação. A task 007 acrescenta `metodologiaAutor`, `metodologiaData`, `Acoes.causaDescricao`, `AvalesTecnicos.validador` e `AvalesTecnicos.fundamentacao`. `Colaboradores` não leva anotação: o `on('READ')` próprio consome `SELECT.search` e busca no `IntegracaoPessoasService` (`srv/tratativa-app-service.ts:128-155`, termo em `:135`); sem regra, a entidade é `livre`. A anotação é estática e vale também para o Gestor: a busca livre do List Report do Gestor deixa de achar texto em `descricao`, `solicitante` e `responsavelPrincipal`. Ele continua filtrando por esses campos com `$filter` ("Adaptar filtros"), que para ele não muda. **Guarda CSN ampliada:** a lista `FILTRAVEIS` do teste (espelho de `filtraveis`) está contida em `LIBERADOS`. Todo elemento de `DECIDIDOS` fora de `FILTRAVEIS` com tipo `cds.String`/`cds.LargeString` tem `@cds.search.<elemento>` = `false` na entidade do App, e nenhuma chave `@cds.search.<x>` verdadeira aponta associação. **Recuo da R-14:** se o RED de `$search` mostrar que a anotação não tirou o campo da busca, a `restricaoDeLeitura` recusa `$search` com 403 ao não-Gestor nas entidades com regra (`Colaboradores` fica fora). **Alvo e ordem da varredura (r6, I6-01, R-15):** a varredura cobre **só a query do cliente**. Ela roda de forma síncrona no início de `restricaoDeLeitura`, antes de qualquer `await` e de qualquer injeção: antes da guarda de segmentos (que faz `SELECT.one`), antes do `filtroVinculo` do último segmento (a subconsulta `acao_codigo in (SELECT … WHERE lower(trim(responsavel)) = …)` de `Evidencias` e da navegação `/Tratativas(<id>)/comentarios`) e antes da disjunção do Validador habilitado da task 007. `restringirLeitura` é registrada como o **primeiro** `before('READ', …)` do `init` do `TratativaAppService`, logo depois do `before('*')` de `AplicativoOrigem` (`srv/tratativa-app-service.ts:88-90`, que não toca a query). Assim ela vem antes do `before('READ', 'Tratativas')` de `status` (`:93-100`), do `before('READ', 'MinhasAcoes')` (`:273-277`, que injeta `codigoAcao in {SELECT …}`), do `MinhasTratativas` (`:279-290`), da injeção de `campo` em `Historico` (000) e do `garantirChaves` (007). Motivo: os `before` rodam em paralelo (`Promise.all`, `node_modules/@sap/cds/lib/srv/srv-dispatch.js:46-47`), mas o `map` chama cada handler em ordem de registro, e o trecho síncrono do primeiro termina antes de o segundo começar. O primeiro handler, sem `await` antes da varredura, vê a query exatamente como o parser e os genéricos síncronos do CAP a deixaram (`handle_paging`/`handle_sorting`, `libx/_runtime/common/Service.js:77-80`, que rodam antes dos `before`). Um nó `{SELECT}` dentro de expressão vinda do cliente é recusado com 403 (critério c): o parser OData não o produz, então só pode ser injeção, e a ordem acima garante que nenhuma injeção do próprio serviço é vista. `from.SELECT` do `$apply` continua percorrido como query, porque não é expressão. **Alternativa considerada:** varrer uma cópia de `req.query` tirada na entrada. Descartada: a cópia também precisa ser tirada no trecho síncrono do primeiro handler (a mesma dependência de ordem), exige clonar em profundidade a árvore CQN a cada leitura do não-Gestor e deixa duas árvores para manter coerentes; a varredura síncrona direta tem o mesmo efeito sem a cópia. **Formas aceitas (r6, M6-02):** a lista fechada está no contrato da task 000; o que não está nela cai no critério (c). Aliases do `$apply` (`aggregate(... as s)`, `groupby(...)` seguido de `filter(s ...)`/`having`) não resolvem no modelo e dão 403 ao não-Gestor, o que é aceito. **Usos legítimos conferidos:**<br>• SelectionFields do List Report (`origem`, `criticidade`, `status`, `unidade`, `area`; `app/tratativas/annotations.cds:81-87`): nenhum é campo decidido;<br>• filtros e ordenações de `MinhasAcoes`/`MinhasTratativas` (`codigoTratativa`, `statusAcao`, `prazo`, `dataPrevistaConclusao`; `test/ui-minhas-pendencias.test.ts:168-229`): entidades sem regra, sem elemento decidido;<br>• `$filter=tratativa_codigo eq …` dos RED da 000 e da 007: FK, não decidida;<br>• tabelas da Object Page: navegação pela chave com `$select`/`$count`/`$orderby` padrão, sem predicado sobre campo decidido (a medição de rede da 000 confere);<br>• Gestor: nada é varrido. | (a) Reescrever o predicado sobre campo escondido (comparar com `null`): muda em silêncio a semântica do filtro do cliente e é frágil em funções (`contains`, `tolower`). (b) `@Capabilities.FilterRestrictions`/`SortRestrictions`: o cds-mcp não documenta que o runtime Node as imponha; tratadas como orientação ao cliente (inferência). Já o `@restrict` com associações em `where` só é autorizado no Java. (c) Recusar `$search` a todo não-Gestor: quebra a busca do List Report de quem não é Gestor; a R-14 manda anotar e só recusar se a anotação falhar. (d) Reescrever a busca por usuário (trocar `SELECT.search` por `contains` nos campos permitidos): preservaria a busca do Gestor, mas reimplementa a semântica de busca do CAP (tokenização, busca fuzzy do HANA). | R-14; cds-mcp `search_docs`: "Expression Notation (CXN) > References"; "Query Notation (CQN) > SELECT"; "CDS Expression Language (CXL) > Infix Filters > Applied to exists Predicate" e "Path Expressions > In exists Predicates"; "Serving OData APIs > Feature Overview"; "Generic Service Providers > Searching Data > The @cds.search Annotation" e "> Excluding Fields" (`@cds.search: { isbn: false }`); "CAP-level Authorization > Deep Authorizations in Java > Associations" (autorização de entidades associadas usadas no statement, só no Java) e "Limitations in Node.js". Código instalado no worktree: `@sap/cds` 10.1.1 `libx/odata/parse/grammar.peggy:204-240`, `:690-711`, `:836-865`, `:891`; `@cap-js/db-service` 3.1.1 `lib/search.js` (`DEFAULT_SEARCHABLE_TYPE = 'cds.String'`, `_getSearchableColumns`). |

---

## Decisões de correção (r3)

| # | Achado | Decisão | Alternativa descartada | Fonte |
|---|---|---|---|---|
| DC-17 | R3-I01 (R-10) | **Máscara LGPD genérica no `TratativaAppService`: percorre a árvore do resultado em qualquer nível de `$expand`, decide o vínculo fail-closed e corrige o vazamento pré-existente da 015.** Hoje as máscaras ficam em `after READ` por entidade alvo (`srv/tratativa-app-service.ts:102-126` para `Tratativas`, `:165-169` para `Participantes`, `:171-175` para `Acoes`). Uma leitura cuja entidade alvo é outra devolve os dados sem máscara a quem não é Gestor. As associações do App que voltam a `Tratativas`/`Acoes` são `Acoes.tratativa` e `Acoes.acaoMae` (`srv/tratativa-app-service.cds:145`, `:153`), `Participantes.tratativa` (`:162`) e `Evidencias`, `Comentarios`, `Historico` (`:168-175`, projeções inteiras com `tratativa`/`acao`; `db/tratativa.cds:168`, `:243-244`, `:285-286`). Exemplos: `GET /Historico?$expand=tratativa` devolve `descricao`/`solicitante`/`responsavelPrincipal` e `GET /Acoes(<id>)?$expand=acaoMae` devolve `acaoMae.responsavel`. **Mecanismo:** (1) módulo novo `srv/tratativa/mascara-app.ts` (task 000) com `REGRAS_MASCARA`, indexado pelo nome da entidade do serviço (`TratativaAppService.Tratativas`, `.Acoes`, `.Participantes`; a task 007 acrescenta `.AvalesTecnicos` e os campos novos), e com `aplicarMascaras(entidade, resultado, contexto)`, síncrona e pura, que aplica a regra da entidade a cada linha e desce por todo elemento de associação ou composição presente na linha (objeto ou array), usando `elemento._target` como entidade do nível seguinte, em qualquer profundidade; (2) `this.after('READ', '*', async function mascararLeitura(resultado, req) {...})` no `TratativaAppService`: parte de `req.target` (a raiz, inclusive na navegação `/Tratativas(<id>)/acoes`), monta o `contexto` e chama `aplicarMascaras`. **Regras por papel** (iguais às da 015, sem mudança de contrato para leitura direta): `Tratativas` com não-Gestor recebe `descricao`, `solicitante` e `responsavelPrincipal` como `null` e `participantes` como `[]` quando a lista vem no resultado (`:118-121`); `Participantes` com não-Gestor recebe `matricula` como `null` (`:168`); `Acoes` com não-Gestor recebe `responsavel` como `null` (`:123`, `:174`). **Regras por vínculo** (task 007): `metodologiaData` e `Acoes.causaDescricao` ficam `null` sem vínculo diagnóstico (DC-15); `metodologiaAutor` e `AvalesTecnicos.validador` ficam `null` para não-Gestor; `AvalesTecnicos.fundamentacao` fica `null` para quem não é Gestor nem Validador habilitado; `AvalesTecnicos.vigente` vem de `lerSituacaoAval`. **Vínculo fail-closed:** o código da Tratativa de um nó é `codigo` (nó `Tratativas`) ou `tratativa_codigo` (nós `Acoes` e `AvalesTecnicos`). Quando o código falta na linha, todo campo que depende de vínculo é mascarado (`null`) e `vigente` vem `null`, nunca um valor herdado ou adivinhado. Para que quem tem vínculo não perca o dado, um `this.before('READ', '*', function garantirChaves(req) {...})` (task 007, só para não-Gestor) percorre `req.query.SELECT.columns` e as colunas `{ ref, expand }` aninhadas e acrescenta `{ ref: ['tratativa_codigo'] }` nos níveis de `Acoes`/`AvalesTecnicos` e `{ ref: ['codigo'] }` no de `Tratativas` quando o nível não pede `*` nem a coluna (mesmo padrão da injeção de `status`, `:98-99`). **Contexto em lote:** um primeiro percurso junta os códigos de Tratativa da árvore inteira; depois vêm uma chamada a `tratativasComVinculoDiagnostico(req, codigos)` (task 004), uma a `tratativasComValidadorHabilitado(req, codigos)` (task 002) e uma a `lerSituacaoAval(codigos)` (task 002); um segundo percurso aplica. Para o Gestor nenhuma consulta extra roda. **As máscaras por entidade deixam de existir:** o bloco de máscara de `after('READ', 'Tratativas')` (`:116-124`) e os `after('READ', 'Participantes')`/`'Acoes'` (`:164-175`) saem, e a raiz passa pelas mesmas funções (`mascararTratativa`, `mascararParticipante`, `mascararAcao`, mais `mascararAvalTecnico` na 007). O `after('READ', 'Tratativas')` fica só com as flags, cujos campos não se cruzam com os mascarados, porque os `after` rodam em paralelo. **Guarda estrutural:** o RED da task 000 lê o CSN de `cds.load(['srv','app'])` e exige que todo elemento com `@PersonalData.IsPotentiallyPersonal`, mais `Tratativas.descricao` (sem a anotação no `db`, mas mascarada desde a 015), de toda entidade do `TratativaAppService` esteja na lista constante `DECIDIDOS` do teste (espelha os `campos` de `REGRAS_MASCARA`, isto é, os elementos pessoais cuja decisão está na regra; a r4 acrescenta `LIBERADOS`, ver DC-18 (M4-04); a lista `FORA_DA_MASCARA` foi eliminada pela DC-18/R-11). Os testes não importam `srv/` (`test/CONVENCOES.md:3`), então as listas ficam no teste e o revisor de diff confere que espelham o módulo. Um campo pessoal novo sem decisão quebra o teste; a task 007 atualiza as listas no mesmo commit do RED. **Prova do fail-closed:** por HTTP, `GET /Acoes?$select=causaDescricao` devolve `null` ao `usuario` e o texto ao `M1001` (prova a injeção da chave). Com a injeção ativa, nenhuma requisição OData chega a uma linha sem chave, e o teste não pode chamar o módulo direto; por isso o ramo "chave ausente → máscara" é item obrigatório da revisão de diff da 007 (inclusive para `vigente = null`). | (a) Recusar `$expand` cruzado com 400: quebra `test/ui-tratativas.test.ts:213` (`Acoes(<id>)?$expand=acaoMae`, caminho da Object Page) e exige uma lista de caminhos que envelhece a cada associação nova. (b) Manter as máscaras por entidade e acrescentar os caminhos conhecidos: contornável (R3-I01). (c) Herdar o código da Tratativa do nó pai: correto para `acoes`/`avalesTecnicos` sob `Tratativas`, mas exige regra por aresta; a injeção de `tratativa_codigo` mais o fail-closed cobre todos os casos com uma regra só. | R-10; cds-mcp `search_docs`: "Core Services > srv.on, before, after()" (argumento `entity`: "String `*` to register a handler for *all* potential events or entities"); "Core Services > srv.after (request)" ("all `.after` handlers are executed in parallel, which can lead to race conditions"); "Events and Requests > cds.Request > .target" ("For OData navigation requests along associations, `msg.target` refers to the last target"); "Reflecting CDS Models > cds.Association > ._target" ("A reference to the association's resolved linked target definition") e "cds.struct > .elements"; "CAP-level Authorization > Limitations in Node.js" (expandidos não são verificados); "CDL > Annotations > Annotation Propagation" (`@PersonalData` do `db` chega aos elementos da projeção) |
| DC-18 | R-11 (antes "O desconfortável" 9 a) | **`Evidencias`, `Comentarios` (com `mencoes`) e `Historico` no `TratativaAppService` seguem as regras de acesso e mascaramento das specs aprovadas; `FORA_DA_MASCARA` deixa de existir.** Hoje as três são projeções inteiras, sem `@restrict` e sem handler (`srv/tratativa-app-service.cds:168-175`), alcançáveis por leitura direta, por navegação (composições `evidencias` e `comentarios` e associação `historico` de `Tratativas`, `:34-36`) e por `$expand`; entregam todo campo a qualquer autenticado. No `TratativaService` só `Comentarios` é entidade, com `@restrict: [{ grant: ['READ'], to: 'GestorTratativa' }]` (`srv/tratativa-service.cds:297-300`; 403 ao `usuario` em `test/comentarios-tratativa.test.ts:124-127`); Evidências e Histórico saem só pelas functions, com vínculo e máscara (`srv/tratativa/evidencias-consultas.ts:149-176`; `srv/tratativa/historico-autorizacao.ts:23`, `:61-84`, `:88-107`). **Regras por entidade, para não-Gestor (o Gestor não muda; o Aplicativo de Origem já é recusado pelo `before('*')`, `srv/tratativa-app-service.ts:88-90`):** **(1) `Comentarios` e o alvo auto-exposto da composição `mencoes` (`MencoesComentario`, `db/tratativa.cds:292`, `:297-301`):** leitura pela coleção `/Comentarios`, pela chave `/Comentarios(<c>)`, por `/Comentarios(<c>)/mencoes` ou por qualquer caminho que comece em `Comentarios` (`/Comentarios(<c>)/tratativa`, M4-02) → 403 `Acesso negado.`, o mesmo código do `TratativaService.Comentarios`. **Exceção única (r4, M4-03, R-13): a navegação `/Tratativas(<id>)/comentarios`** (inclusive `/$count` e `/comentarios(<c>)`) recebe na própria query o filtro da `comentarios/spec.md` R7 a/b, o mesmo das functions `listarComentariosTratativa`/`listarComentariosAcao` (`srv/tratativa/comentarios-consulta.ts:104-120`, `:165-170`): `(acao_codigo is null and tratativa_codigo in <Tratativas em que o usuário é Responsável Principal ou Participante>)` (R7 a; mesma lista do Histórico, `['']` quando vazia) `or acao_codigo in (SELECT codigo FROM Acoes WHERE lower(trim(responsavel)) = <matrícula>)` (R7 b; o Responsável da mãe vê só a mãe, o da Subação só a Subação, porque cada Comentário aponta a própria Ação). Quem passa o filtro recebe `texto`, `autor` e `criadoEm` (a exceção LGPD da R7, "texto, data/hora e matrícula do autor") e `mencoes` `[]` (R7, só o Gestor vê as menções); quem não passa recebe `[]` com 200 (R7 a/b "a lista vem vazia", R8, R13 etapa 6). A composição `Tratativas.comentarios` (`srv/tratativa-app-service.cds:35`) traz os comentários diretos e os de Ação, por isso as duas cláusulas. Fonte: `comentarios/spec.md` R3 ("leitura direta (GET) ou expansão OData ($expand) sobre a entidade de comentários por usuário que não seja Gestor de Tratativa receba código HTTP 403 (ou tenha os comentários omitidos da resposta), impedindo que navegações OData contornem as regras de menor privilégio e visibilidade estipuladas na regra R7": a navegação filtrada não contorna a R7, aplica-a) e R7 a/b. Pelo `$expand` (`Tratativas?$expand=comentarios`), onde nenhuma anotação nem `before` da entidade expandida roda, a lista vem `[]`: é a forma "omitidos da resposta" que a própria R3 admite. **(2) `Evidencias`:** a leitura cuja entidade alvo é `Evidencias` (coleção, chave, `/Tratativas(<id>)/evidencias`) recebe na própria query `ativo = true` e `acao_codigo in (SELECT codigo FROM Acoes WHERE lower(trim(responsavel)) = <matrícula normalizada>)`: só as Evidências ativas das Ações ou Subações das quais o usuário é o Responsável atual; mãe e Subação ficam separadas porque cada Evidência aponta a própria Ação. **Validador Técnico habilitado (r4, I4-01, R-13; task 007):** a disjunção ganha `or tratativa_codigo in <Tratativas cuja Origem habilita o usuário>`, calculada por `tratativasComValidadorHabilitado(req, candidatos)` (task 002, a mesma cadeia de DC-01/DC-16: lista da Origem, senão lista `*`, senão qualquer `ValidadorTecnico`), só quando `req.user.is('ValidadorTecnico')`; `candidatos` são o código da chave do caminho quando ele parte de `Tratativas(<id>)` ou de `Evidencias(<codigo>)` (este lido por um SELECT), e nos demais casos os `tratativa_codigo` distintos de `Evidencias` com `ativo = true`; conjunto vazio vira `['']`. O Validador habilitado lê todas as Evidências ativas da Tratativa, inclusive `$count`. Fonte: spec do 016 R7 d, R20 f e CA44 ("listar as Evidências vinculadas à Tratativa e suas Ações"), como no `TratativaService` (task 002). `autorAnexo` e `autorRemocao` vêm `null` para todo não-Gestor, inclusive o Validador; `nomeArquivo` e `descricao` ficam com valor para quem passa o filtro (`liberados`, M4-04). Sem vínculo: lista vazia, e a leitura por chave responde 404 (não revela existência). Fonte: `evidencias/spec.md` R11 a/b (o Responsável vê só a sua Ação; Responsável Principal, Participantes e terceiros recebem lista vazia; CA45-CA47) e R11 c (matrícula de quem anexou e de quem removeu só ao Gestor); `ativo: true` como nas functions (`evidencias-consultas.ts:161`). Pelo `$expand`: `[]`. **(3) `Historico` (`HistoricoTratativa`: só eventos diretos da Tratativa, sem coluna de Ação, `db/tratativa.cds:166-181`):** a leitura cuja entidade alvo é `Historico` (coleção, chave, `/Tratativas(<id>)/historico`) recebe na query `tratativa_codigo in` (Tratativas em que o usuário é o Responsável Principal ou Participante, comparação `lower(trim(...))`, vínculo lido no momento da consulta), exatamente o ramo `codigoAcao === null` de `filtrarPorAutorizacao` (`historico-autorizacao.ts:72-84`). Quem é só Responsável de Ação não vê linha desta entidade (os eventos de Ação estão em `HistoricoAcoes`, que o App não expõe). `autor` e `justificativa` vêm `null`; `valorAnterior` e `valorNovo` vêm `null` quando `campo`, sem caixa, está em {`solicitante`, `responsavelprincipal`, `participante`, `responsavel`} (o conjunto `CAMPOS_MATRICULA`, `historico-autorizacao.ts:23`). Fail-closed: `campo` ausente da linha → `valorAnterior` e `valorNovo` `null`; para quem tem vínculo não perder o dado, o `before` acrescenta `{ ref: ['campo'] }` quando o nível pede `valorAnterior` ou `valorNovo` sem `campo` nem `*` (padrão da injeção de `status`, `srv/tratativa-app-service.ts:93-100`). Sem vínculo: lista vazia com 200, e a leitura por chave responde 404. Fonte: `historico-e-auditoria/spec.md` R5 b.1 (Responsável Principal e Participantes recebem os eventos diretos), b.4 (vínculo no momento da consulta), b.5 (sem vínculo, lista vazia, "não gerando erro 403") e c (`autor`, `justificativa` e `valorAnterior`/`valorNovo` de campo de matrícula como `null`). Pelo `$expand`: `[]`. **Por que restringir na leitura direta e omitir no `$expand`:** no Node.js as regras de segurança só valem para a entidade alvo do pedido (na navegação, o último alvo, `req.target`); no `$expand` não há query própria da entidade expandida onde pôr o filtro de vínculo, e decidir o vínculo linha a linha no `after` dependeria de colunas (`acao_codigo`, `tratativa_codigo`) que o cliente pode não pedir. Omitir é fail-closed. Para Evidências e Histórico é mais restrito que as functions: quem tem vínculo lê pela coleção, pela chave, pela navegação e pelas functions do `TratativaService`, não pelo `$expand`. O filtro entra na query, não no `after`, então `$count`, `$top`/`$skip` e a paginação ficam coerentes (padrão de `MinhasAcoes`, `srv/tratativa-app-service.ts:273-277`). **Seções da Object Page (r4, M4-01):** as tabelas de Evidências, Comentários e Histórico (`app/tratativas/annotations.cds:139-155`) chegam por requisição de navegação própria (`Tratativas(<id>)/evidencias?...`), não por `$expand` do pai, e por isso recebem o filtro de vínculo e não o `[]` do `$expand`. Fonte: ui5-mcp 1.136.23 `sap.ui.model.odata.v4.ODataModel#bindList` ("The binding creates its own data service request if it is absolute or if it has any parameters ... or if it is relative and has a context created via #createBindingContext or if it has sorters or filters"); a tabela do Fiori elements tem parâmetros (`$count`, `$select`), ordena e pagina; o app usa `autoExpandSelect: true` e `operationMode: Server` (`app/tratativas/webapp/manifest.json:60-66`). É inferência documentada; a task 000 mede a rede da Object Page como `M1001` e `M2002` (item obrigatório da verificação visual e da revisão de diff). **Recuo declarado, se a medição mostrar a seção vinda por `$expand`:** aplicar o filtro de vínculo também no `$expand`, no `after`, linha a linha, com as colunas de vínculo injetadas no nível expandido pelo mesmo mecanismo da DC-17 (`acao_codigo`, `tratativa_codigo`, `ativo` em Evidências; `tratativa_codigo` e `campo` em Histórico; `acao_codigo` e `tratativa_codigo` em Comentários), em vez de `[]`; o `$count` aninhado dessa forma não fica coerente, e o recuo fica registrado no relatório da 000. **Caminho inteiro (r4, M4-02):** a regra vale para cada entidade presente nos segmentos de `req.query.SELECT.from.ref`, não só para `req.target`. Fonte: cds-mcp "Events and Requests > cds.Request > .query" (o pedido capturado como CQN, `{SELECT:{from:{ref:[...]}}}`) e "> .path" (`Books(201)/author` → `AdminService.Books/author`: o caminho guarda os segmentos de navegação, `req.target` só o último). O primeiro segmento é a entidade do serviço; o seguinte é `elements[<id do segmento>]._target` do anterior; cada segmento é texto ou `{ id, where }` (a chave). Para todo segmento **antes do último**: entidade `soGestor` → 403 `Acesso negado.`; entidade `porVinculo` → um `SELECT.one` da entidade com a chave do segmento e o filtro de vínculo; sem linha → 404 (não revela existência, como a leitura por chave); entidade `livre` → nada. O último segmento segue a regra já descrita (filtro na query). Exemplos como `usuario`: `/Evidencias(<E3>)/acao` → 404; `/Historico(<ID>)/tratativa` → 404; `/Comentarios(<c>)/tratativa` → 403. O segmento `Tratativas(<id>)/comentarios` é a exceção de (1): conta como `porVinculo` com o filtro da R7 a/b. **Mecanismo, no módulo da DC-17 (task 000):** `RegraMascara` ganha `leitura: 'livre' \| 'porVinculo' \| 'soGestor'` (padrão `'livre'`), `aninhada: 'mascarar' \| 'omitir'` (padrão `'mascarar'`), `filtroVinculo?(req, matricula): Promise<expr>` (obrigatório em `porVinculo`), `navegacaoPorVinculo?: { origem, elemento }` (só em `Comentarios`: `TratativaAppService.Tratativas`/`comentarios`, com `filtroVinculo` da R7 a/b) e **`liberados?: string[]` (r4, M4-04)**. **`campos` passa a significar "elementos pessoais decididos"** (todo elemento pessoal da entidade cuja decisão está na regra) e `liberados` ⊆ `campos` são os que ficam com valor para quem passa a leitura: `Evidencias.nomeArquivo`/`descricao`, `Comentarios.texto`/`autor` (só alcançáveis pela navegação filtrada) e, no Histórico, `valorAnterior`/`valorNovo` fora de `CAMPOS_MATRICULA`; os demais de `campos` vêm `null` ao não-Gestor. `REGRAS_MASCARA` ganha `TratativaAppService.Evidencias`, `.Comentarios`, `.Historico` e o alvo auto-exposto de `mencoes` (nome lido do CSN). `restricaoDeLeitura(req)` (async, exportada) roda num `this.before('READ', '*', async function restringirLeitura(req) {...})`: para o Gestor, sai; percorre os segmentos de `req.query.SELECT.from.ref` como acima; no último, `soGestor` → `req.reject(403, 'Acesso negado.')`, `porVinculo` (ou a navegação liberada) → `where` na query e, no Histórico, a injeção de `campo`. Em `aplicarMascaras`, todo nó aninhado cujo alvo tem `aninhada: 'omitir'` vira `[]` (para-muitos) ou `null` (para-um). **Fail-closed em execução:** elemento com `@PersonalData.IsPotentiallyPersonal` de entidade do App sem regra vem `null` para não-Gestor (regra padrão, não exceção). **Guarda CSN:** sem `FORA_DA_MASCARA`, todo elemento pessoal (mais `Tratativas.descricao`) de toda entidade do App, inclusive a auto-exposta, tem de estar em `DECIDIDOS` (espelho de `campos`), e `LIBERADOS` (espelho de `liberados`) tem de estar contido em `DECIDIDOS`; o RED HTTP confere que os liberados vêm com valor e os demais `null`. **Exceção declarada da guarda (M4-04): `Colaboradores`** (`srv/tratativa-app-service.cds:116-121`; `matricula`, `nome`, `email`, sem `@PersonalData` e sem persistência própria, `on('READ')` sobre o `IntegracaoPessoasService`, `srv/tratativa-app-service.ts:128-155`) é ajuda de valor para escolher matrícula nas actions; fica fora de `REGRAS_MASCARA` e da guarda, e a frase "nenhum campo pessoal do App sem regra" vale para as entidades com `@PersonalData` (ver "O desconfortável" 9 d). **Object Page (r4, M4-03):** a seção Comentários fica visível a todos: a navegação filtrada devolve ao Responsável Principal, aos Participantes e aos Responsáveis de Ação os comentários a que têm direito e `[]` aos demais, sem 403 na tela; a `@UI.Hidden: ocultaResponsaveis` que a r3 previa na `ComentariosFacet` sai do escopo da task 000. Os botões "Comentar" seguem a `comentarios/spec.md` R13 etapa 6 (`srv/tratativa-app-service.cds:82`, `:85`), e agora quem comenta também lê. | (a) `@restrict` com `where` nas projeções (`acao.responsavel = $user`; `exists tratativa.participantes[matricula = $user]`): declarativo e suportado, mas compara por igualdade exata, e a plataforma compara matrícula sem caixa e sem espaços (`srv/tratativa/identidade.ts`, `matriculasIguais`; `MinhasAcoes`/`MinhasTratativas` usam `lower(trim(...))`); e também não cobre o `$expand`. (b) Filtrar por vínculo no `after`, inclusive no `$expand`: quebra `$count` e paginação na leitura direta e, no `$expand`, depende de colunas não pedidas. (c) 403 também em Evidências e Histórico: mais simples, mas contraria R11 (lista vazia) e R5 b.5 ("não gerando erro 403"). (d) Mascarar `Comentarios.texto/autor` em vez de recusar: a R3 manda 403 ou omitir, e o `TratativaService` recusa; uma linha com texto `null` não tem base na spec. (e) Manter `FORA_DA_MASCARA`: é o que a R-11 revoga. | R-11; `comentarios/spec.md` R3, R7; `evidencias/spec.md` R11 a-c; `historico-e-auditoria/spec.md` R5 b.1, b.4, b.5, c; cds-mcp `search_docs`: "CAP-level Authorization > Limitations in Node.js" ("the security annotations **are only evaluated on the target entity of the request** ... Restrictions of (recursively) expanded or inlined entities of a `READ` request aren't checked"); "Events and Requests > cds.Request > .target" (na navegação, o último alvo); "CAP-level Authorization > Instance-Based Access Control > Association Paths" e "Exists Predicate" (alternativa a); "CAP-level Authorization > Static Access Control > Events to Auto-Exposed Entities" ("implicitly auto-exposed entities cannot be accessed directly, which means only access via a navigation path ... is allowed": `mencoes` só por navegação, coberta pela regra do alvo); "Core Services > srv.before (request)" e "srv.after (request)" (os `after` correm em paralelo; o `before` de restrição só escreve `where` e colunas, o `after` de máscara só escreve valores); r4 (R-13): `comentarios/spec.md` R7 a/b, R8, R13 etapa 6 e `srv/tratativa/comentarios-consulta.ts:104-120`, `:165-170` (M4-03); spec do 016 R7 d, R20 f, CA44 e task 002 `tratativasComValidadorHabilitado` (I4-01); ui5-mcp 1.136.23 `ODataModel#bindList` (M4-01); cds-mcp "cds.Request > .query" e "> .path" (M4-02) |

---

## Decisões de correção (r2)

| # | Achado | Decisão | Alternativa descartada | Fonte |
|---|---|---|---|---|
| DC-10 | N-I01 | **(Substituída pela DC-17 na r3: a máscara passou a ser genérica, em qualquer entidade alvo e em qualquer nível, e os `after` por entidade saíram. O texto abaixo fica como registro da r2.)** **Máscara LGPD também nos dados expandidos.** O `after('READ', 'Tratativas')` (`srv/tratativa-app-service.ts:102-126`) já mascara `linha.participantes` e `linha.acoes[].responsavel` expandidos (`:121-124`); ganha, no mesmo laço: `linha.avalesTecnicos[]` (zera `fundamentacao` para quem não é Gestor nem Validador habilitado; zera `validador` para não-Gestor; calcula `vigente`) e `linha.acoes[].causaDescricao` (zera quando o usuário não tem vínculo com a Tratativa, DC-15). Os `after('READ', 'AvalesTecnicos')` e `after('READ', 'Acoes')` cobrem a navegação (`/Tratativas(<id>)/avalesTecnicos`, `/Tratativas(<id>)/acoes`) e a leitura direta. As duas rotas chamam as mesmas funções de máscara (`mascararAvalesTecnicos`, `mascararCausaDescricao`, em `srv/tratativa-app-service.ts`), para não divergirem. RED nos dois caminhos (navegação e `$expand`). | Confiar no `after` da entidade alvo (contornável por `$expand`). | cds-mcp `search_docs` "CAP-level Authorization > Limitations in Node.js": "security annotations are only evaluated on the target entity of the request ... Restrictions of (recursively) expanded or inlined entities of a `READ` request aren't checked"; padrão existente `srv/tratativa-app-service.ts:121-124` |
| DC-11 | N-I02 | **Destinatários sem lista (DV-05).** Sem nenhuma lista de Validadores (nem da Origem nem a padrão `*`), `PrazoProximo` e `PrazoVencido` de `VerificacaoEficacia` vão ao `responsavelPrincipal` da Tratativa. Não existe enumeração de detentores do papel `ValidadorTecnico` (`DiretorioPessoasPort` só tem `resolverPessoa(matricula)`, `srv/alertas/portas.ts:9-11`; papéis XSUAA não são enumeráveis em runtime). Com lista: `PrazoProximo` aos Validadores da lista efetiva; `PrazoVencido` aos Validadores + cópia ao `responsavelPrincipal`. Destinatários deduplicados pelo `Set` existente (`srv/alertas/motor-regras.ts:66`). Tratativa sem lista e sem Responsável Principal não gera alerta de verificação (declarado). | (b) Porta nova de enumeração de papel no diretório (N3 de integração, sem API conhecida). | R-08 (orquestrador por delegação do humano); spec R12 d e R20 d (texto atual: "Quando a Origem não possui lista própria e a lista padrão corporativa também está vazia, os alertas ... são enviados ao `Responsável Principal`") |
| DC-12 | N-M06 | **CA34: identificador inválido → 400.** As três actions ligadas novas (`emitirAvalTecnico`, `definirMetodologia`, `derivarAcaoDaMetodologia`) validam a chave da URL com `codigoValido` (`srv/tratativa/consulta.ts:13`) **antes** de `bloquearTratativa` e recusam com `recusar(400, 'Código inválido.', 'codigo')` (R18 etapa 4). Hoje a chave mal formada de action ligada cai em `bloquearTratativa` e vira 404 `Tratativa não encontrada.` (`test/ciclo-de-vida-acoes.test.ts:412-420`; CONVENCOES item 10). As functions novas validam `codigoTratativa` da mesma forma (`target: codigoTratativa`). A task 002 registra a exceção no item 10 de `test/CONVENCOES.md` ("nas actions ligadas do 016, chave mal formada dá 400"). Operações existentes não mudam. | Manter 404 (contraria CA34; CONVENCOES item 23 manda prevalecer a spec). | R-08; spec CA34 e R18 etapa 4 |
| DC-13 | N-M07 | **Handlers da seção ligados por `ExtensionAPI#byId` + `attachPress` (caminho primário).** O fragmento declara só controles com IDs estáveis (sem atributo `press`); a extensão os liga em `routing.onAfterBinding`, uma vez por instância (marcador `this._ligado`). IDs: `metodologiaFerramenta`, `metodologiaCategoria`, `metodologiaSalvar`, `metodologiaRemover` e um botão de derivação por item derivável `metodologiaDerivar-<chave>` (ex.: `metodologiaDerivar-porque1`). A ligação declarativa `press=".extension..."` sai do design. | `press=".extension...MetodologiaExtension.onSalvar"` (resolução não documentada no MCP). | ui5-mcp `get_api_reference` `sap.fe.core.ExtensionAPI#byId` ("Access a control by its ID ... ID of the control without view and section prefix"); `sap.m.Button#attachPress` ("Attaches event handler `fnFunction` to the press event") |
| DC-14 | N-M09 | **Taxa de Eficácia = primeiro Aval da Tratativa em todo o histórico, filtrado pelo período.** Para cada Tratativa, o primeiro Aval é o de menor `emitidoEm` em todo `AvalesTecnicos` (não só no período); a Tratativa entra no indicador quando esse primeiro Aval caiu no período; é eficaz quando ele é `Aprovado`. **Onde agrega:** no banco, por duas consultas CQL com `GROUP BY tratativa_codigo` e `min(emitidoEm)` (função agregada portável): (1) primeiro Aval de cada Tratativa, com `having` no período; (2) primeiro Aval `Aprovado` de cada Tratativa. Em TS, só a comparação por Tratativa (`primeiroAprovado == primeiro`) sobre uma linha por Tratativa e a divisão. Tempo Médio (corrigido na r3, R3-M02): as linhas de `AvalesTecnicos` são filtradas no banco pelo período; a diferença em dias corridos e a média ficam em TS. **Motivo:** a diferença tem de ser entre **datas civis no fuso da plataforma** (`dataCivil`, `FUSO_PLATAFORMA = 'America/Sao_Paulo'`, `srv/lib/relogio.ts:2`, `:16-18`), a mesma régua de `dataLimiteVerificacao` (DC-04) e de CA39. `days_between(x,y)` é portável (cds-mcp "CAP-Level Database Support > Standard Functions > Date / Time Functions"), mas opera sobre os `Timestamp` gravados em UTC: um Aval emitido às 22h em São Paulo (01h UTC do dia seguinte) contaria um dia a mais. Converter para o fuso no banco exigiria função de fuso, que não está na lista portável. De `consultarTempoMedioResolucao` (`srv/analitico-service.ts:221-236`) só se segue o padrão de filtrar no banco e calcular em TS; a unidade é outra (lá, diferença de instantes em ms dividida por 86400000; aqui, dias entre datas civis). | (a) Média e contagem toda em TS lendo todas as linhas (contraria "agregação no banco" de R15). (b) `avg(days_between(dataBaseVerificacao, emitidoEm))` no banco (erra a data civil perto da meia-noite, ver motivo). | cds-mcp `search_docs` "CAP-Level Database Support > Aggregate Functions" (`min(x)`, `count(x)` portáveis) e "Standard Functions > Date / Time Functions" (`days_between(x,y) -> number`) |
| DC-15 | N-M10 | **Causa no diálogo de derivação e visibilidade da causa.** O parâmetro `causaIdentificador` de `derivarAcaoDaMetodologia` no App recebe `@Common.FieldControl: #ReadOnly` (preenchido por `parameterValues`, visível e não editável no diálogo); o servidor revalida a chave (400). `Acoes.causaDescricao` segue a mesma regra de `metodologiaData`: visível ao Gestor, ao responsável de Ação/Subação da Tratativa (inclusive o Responsável da própria Ação) e ao Validador habilitado; `null` para os demais (R16 b). A regra mora numa função só, `tratativasComVinculoDiagnostico(req, codigos): Promise<Set<string>>` em `srv/tratativa/metodologia.ts` (task 004), usada por `consultarMetodologiaTratativa` e pelas máscaras do App (task 007, DC-17). **Recuos, em ordem (r3, R3-M04):** (1) se `causaIdentificador` não aparecer somente leitura, `@UI.Hidden: true` no parâmetro, **desde que** o servidor continue recebendo o valor de `parameterValues` (a verificação visual confere a derivação concluída com `causaIdentificador` gravado, não só o diálogo); (2) se o parâmetro oculto chegar vazio ao servidor (400 `causaIdentificador`), a seção abandona o diálogo padrão: abre um `sap.m.Dialog` próprio no fragmento, ligado a um `JSONModel` `derivacao` (Causa de origem como `sap.m.Text`, Descrição, Responsável, Prazo, Prioridade, Evidência), e envia com `invokeAction('TratativaAppService.derivarAcaoDaMetodologia', { contexts, parameterValues: [todos os seis parâmetros], skipParameterDialog: true, label })`. O recuo 2 preserva a revisão pelo Gestor (R6 a, CA14), porque o diálogo próprio mostra todos os campos antes do envio. | `@UI.Hidden` no parâmetro como caminho primário (o Gestor perderia a referência à causa que está derivando); máscara de `causaDescricao` só para Gestor (escondia a causa do Responsável da Ação). | cds-mcp `search_docs` "Declarative Constraints > Field Control" (`Common.FieldControl` `ReadOnly`; documentado em Property, não em parâmetro de action: verificação visual da task 007); ui5-mcp `get_api_reference` 1.136.23 `sap.fe.core.controllerextensions.EditFlow#invokeAction` (`parameterValues`: "An optional array of objects representing the action parameters, where each object has a name of string type and a value"; `skipParameterDialog`: "Skips the action parameter dialog if values are provided for all of them in parameterValues") |
| DC-16 | N-M05 | **Origem para a habilitação.** `bloquearTratativa` não devolve `origem` (`srv/tratativa/bloqueio.ts:17-20`). `usuarioEhValidadorHabilitado(req, codigoTratativa)` (`srv/tratativa/validador-tecnico.ts`, novo) lê `Tratativas.origemNormalizada` (coluna existente, `db/tratativa.cds:120`) num SELECT próprio, na mesma transação e depois do bloqueio; `bloqueio.ts` não muda. `origemNormalizada` nula (Tratativa avulsa) ou sem linha em `ParametrosOrigem` usa a linha `*`. | Acrescentar `origem` a `TratativaBloqueada` (mexe na interface usada por todas as operações de ciclo de vida). | arquiteto |

---

## Decisões de correção (r1)

| # | Achado | Decisão | Alternativa descartada | Fonte |
|---|---|---|---|---|
| DC-01 | I-06 | **Designação do Validador por Origem em tabela administrada.** Nova entidade `ValidadoresOrigem` (matrículas por `ParametrosOrigem`), mantida pelo Administrador no `AdministracaoService`. Pode emitir Aval (e consultar/baixar Evidências) quem tem o papel XSUAA `ValidadorTecnico` **e** (a) sua matrícula está na lista da Origem da Tratativa, ou (b) a Origem não tem lista própria e a matrícula está na lista da linha baseline `*`, ou (c) nenhuma das duas listas tem matrícula (validador genérico, R13 d). A verificação roda em código na etapa 6 da D10. "Validador designado para a Tratativa" (R7 c, R12 d) é lido como "Validador habilitado para a Origem da Tratativa" (redação de R18 etapa 6); não existe designação individual por Tratativa (ver Divergência DV-01). | Atributo XSUAA `origem` na role (exige uma role collection por Origem no BTP, Origens são texto livre vindo dos apps e o mocked de teste não carrega atributos hoje); designação individual por Tratativa (nenhuma regra da spec define a operação). | arquiteto, aprovado pelo orquestrador por delegação do humano (N3-5) |
| DC-02 | I-07 | **Discriminador novo `EntidadeAlerta.VerificacaoEficacia`.** Os alertas de prazo de eficácia usam `tipo` `PrazoProximo`/`PrazoVencido` (R12 c, R20 d) com `entidade = 'VerificacaoEficacia'`, o que os separa na chave de idempotência (`srv/alertas/processamento.ts:169`) e na consulta `listarAlertasEmitidos`. **Destinatários (atualizado na r2, DC-11/DV-05):** Validadores da lista efetiva da Origem (lista da Origem, ou lista `*`); em `PrazoVencido`, cópia ao `responsavelPrincipal` da Tratativa (o "líder da ocorrência" que já recebe os alertas de Tratativa em 010 R4 c). Sem nenhuma lista, `PrazoProximo` e `PrazoVencido` vão ao `responsavelPrincipal` (R-08). O papel global `GestorTratativa` não é enumerável e 010 R4 f veda notificação individual ao Gestor (DV-02, resolvida na spec pela R-07). Resolução de e-mail/Teams continua pela porta `DiretorioPessoasPort.resolverPessoa(matricula)` (`srv/alertas/portas.ts:9-11`), sem porta nova. | Novo `TipoAlerta` (contraria R20 d, que nomeia os tipos); reaproveitar `entidade = 'Tratativa'` (colide com o `PrazoVencido` da Tratativa). | arquiteto, aprovado pelo orquestrador por delegação do humano (N3-6) |
| DC-03 | I-08 | **Fundamentação fica só em `AvalesTecnicos`; o histórico referencia.** `HistoricoTratativa` ganha a coluna `avalTecnico : UUID` (mesmo padrão de `HistoricoAcoes.evidencia : UUID`, `db/tratativa.cds:231`). O evento `EmissaoAvalTecnico` grava `campo = 'parecer'`, `valorNovo = <parecer>` e `avalTecnico = <id>`. `consultarHistoricoTratativa` passa a devolver `detalhe.fundamentacao : String(2000)` (campo aditivo em `DetalheEventoHistorico`, `srv/tratativa-service.cds:369-377`), lido de `AvalesTecnicos` e mascarado para não-Gestor como `justificativa` já é. `DefinicaoMetodologia`/`EdicaoMetodologia` gravam `campo = 'metodologia'` e a ferramenta em `valorAnterior`/`valorNovo` (nunca o texto da análise). `CriacaoAcaoComCausa` (em `HistoricoAcoes`) grava `campo = 'causa'`, `valorNovo = <causaIdentificador>` e `justificativa = <rótulo canônico do item>` (ex.: `5 Porquês — Porquê 2`); o texto da causa fica em `Acoes.causaDescricao`. A derivação grava **dois** eventos no mesmo instante: `Criacao` (contrato 004 R22 preservado) e `CriacaoAcaoComCausa` (M-09). Os quatro eventos entram em `CATALOGO_EVENTOS` (`srv/tratativa/historico-catalogo.ts:10-21`) na task 001. | Ampliar `HistoricoTratativa.justificativa` para 2000 (migração de coluna existente e exposição do texto no `Historico` do App, `srv/tratativa-app-service.cds:175`, sem máscara); copiar a fundamentação em coluna nova do histórico (texto duplicado, duas fontes). | arquiteto, aprovado pelo orquestrador por delegação do humano (N3-1, N3-6) |
| DC-04 | I-09 | **Prazo calculado sob demanda, sem coluna persistida.** `dataBase` = maior entre (a) o instante do último evento `Conclusao`/`Cancelamento` de Ação da Tratativa em `HistoricoAcoes` (cobre Ação Cancelada, que não grava `dataConclusao`, `srv/tratativa/acoes-ciclo-de-vida.ts:141`) e (b) o instante da última entrada em `Em andamento` (`HistoricoTratativa` com `evento = 'MudancaStatus'` e `valorNovo = 'Em andamento'`, ou `evento = 'Reabertura'`); sem Ações, só (b) (D-r1-03). `dataLimite` = `dataCivil(dataBase)` + `ParametrosOrigem.prazoVerificacaoEficaciaDias` da Origem (linha `*` quando não há linha da Origem). Calculado por `srv/tratativa/aval-tecnico.ts` (novo) a cada consulta/rotina: alterar `ParametrosOrigem`, reabrir Ação ou Tratativa recalcula sozinho. Na emissão, `AvalesTecnicos` guarda `dataBaseVerificacao` e `dataLimiteVerificacao` (fato histórico, usado pelo indicador R15 b). A etapa de verificação está "ativa" (gera alerta) quando a Tratativa está `Em andamento`, sem Ação aberta, sem exigência pendente de nova Ação pós-reprovação e sem Aval aprovado vigente. | Coluna `Tratativas.dataLimiteAvalTecnico` recalculada por gatilhos (quatro pontos de escrita espalhados e risco de dessincronia, M-10). | arquiteto, aprovado pelo orquestrador por delegação do humano |
| DC-05 | M-10 | **Fonte de verdade única do Aval vigente: `AvalesTecnicos` (append-only) + eventos `Reabertura`.** Sem `ativo`, `reaberturaRevogou`, `avalRevogadoNaReabertura` nem `avalVigente*` em `Tratativas`. Aval vigente = o registro mais recente da Tratativa com `emitidoEm` posterior ao último `Reabertura` (ou qualquer um, se nunca houve reabertura). Encerrar exige vigente com `parecer = 'Aprovado'`. Exigência de nova Ação (R11 b): se o registro mais recente da Tratativa (em qualquer ciclo) é `Reprovado`, só se emite de novo quando existe Ação ou Subação com `criadoEm` > `emitidoEm` desse registro e status `Concluída`/`Cancelada`. Coerência transacional: a emissão roda depois de `bloquearTratativa` (`srv/tratativa/bloqueio.ts:15-25`, `SELECT ... FOR UPDATE`), igual às demais operações de ciclo de vida. | Colunas cacheadas na Tratativa (estado redundante sem regra de coerência, achado M-10). | arquiteto, aprovado pelo orquestrador por delegação do humano |
| DC-06 | I-03 | **Autorização das operações novas segue o padrão do repositório:** grant em `authenticated-user` no `@restrict` de `TratativaService.Tratativas` (`srv/tratativa-service.cds:308-319`) e o papel verificado em código com `recusar(403, 'Acesso negado.')`, como `aplicarTemplateTratativa` (`srv/tratativa-service.ts:58-60`). Parâmetros das actions **sem tamanho** (convenção D10, `srv/tratativa-service.cds:305`); o domínio valida o tamanho na etapa 9. | `@restrict ... to: 'ValidadorTecnico'` (o runtime responde `Forbidden` fixo e antes da existência, quebrando R18 e CA34). | cds-mcp `search_docs` "@restrict": "`grant` accepts all standard CDS events ... as well as action and function names" |
| DC-07 | I-11 | **RED só com o que o Jest executa:** estrutura de arquivos, `$metadata`, CSN de `cds.load(['srv','app'])` (padrão `test/ui-acabamento.test.ts:725-745`) e HTTP com `cds.test`. `run_manifest_validation` e o comportamento do Fiori no navegador ficam como evidência do design e "Verificação visual" de cada etapa. | `run_manifest_validation` como RED (não roda no `verify`). | test/CONVENCOES.md item 19 |
| DC-08 | I-02 | **Migração dos testes existentes na task do encerramento (003).** 20 arquivos encerram Tratativa por operação e 1 (`test/ui-acabamento.test.ts`) afirma `podeEncerrar` em `Aberta`; todos estão em "Modificados" da task 003, com o helper novo `test/apoio/encerramento.ts`. Lista na seção "Testes existentes que mudam de contrato". | Espalhar a migração por tasks (o `verify` de cada uma quebraria). | arquiteto |
| DC-09 | CA32 | **Teste de legado com semeadura direta no banco.** Uma Tratativa "encerrada antes da vigência" é inalcançável pela API depois da task 003 (CONVENCOES item 23). O helper novo `test/apoio/legado.ts` grava a Tratativa `Encerrada` sem `AvalesTecnicos` por `cds.db`, exceção explícita ao item 5 de `test/CONVENCOES.md`, registrada no próprio arquivo de convenções pela task 003. **Não é a única (corrigido na r2, N-M03):** já gravam no banco, antes do 016, `test/edicao-tratativa.test.ts:36`, `test/criticidade-gestor.test.ts:39`, `test/criacao-acoes.test.ts:52`, `test/edicao-acoes.test.ts:133-134` e `test/evidencias-consultas-download.test.ts:292` (todos `cds.db.run(UPDATE ... status ...)`). A task 003 registra DC-09 como exceção nomeada e lista esses cinco como exceções preexistentes, sem migrá-los (fora do escopo). | Não provar CA32. | arquiteto, aprovado pelo orquestrador por delegação do humano |

---

## Decisões

1. **Modelo híbrido: colunas estruturadas + `metodologiaData : LargeString` em `Tratativas` (R1-R3, R15 c, R16) [N3-1, N3-4].** Ferramenta (`metodologia`), categoria (`categoriaCausaRaiz`), autor e instante da última alteração são colunas; os campos do formulário ficam em JSON em `metodologiaData`, como pede o contrato do papel (`agentic/processo/papeis/arquiteto.md:37`). O Pareto (R15 c) agrega por `GROUP BY categoriaCausaRaiz` em view CDS, sem função JSON de banco. Chaves do JSON por ferramenta (contrato fixo validado por `srv/tratativa/metodologia-validacao.ts`, novo):
   - `3W`: `oQue` (5-500), `onde` (3-200), `quando` (3-200).
   - `5 Porquês`: `problema` (5-500), `porque1` (5-500), `porque2`..`porque5` (opcionais, até 500), `conclusao` (5-1000).
   - `5W2H`: `oQue`, `porQue`, `como` (obrigatórios, até 500), `onde`, `quando`, `quem` (obrigatórios, até 200), `quantoCusta` (opcional, até 200).
   - `PDCA/8D`: `planejar`, `executar`, `checar`, `agir` (obrigatórios, até 2000).
   - Espaços nas pontas removidos antes da validação; chave desconhecida para a ferramenta → 400 `target: dados`; obrigatório ausente ou fora do limite → 400 com `target` igual à chave (ex.: `porque1`) e mensagem com o rótulo de negócio (ex.: `O campo Porquê 1 é obrigatório.`, `O campo O que aceita de 5 a 500 caracteres.`), CA3 e CA36.
   - **Por quê:** Pareto e Aderência por agregação SQL nas colunas; formulário variável sem quatro tabelas; um único ponto de máscara LGPD (`metodologiaData`).
   - **Verificado por:** CSN em `test/metodologias-modelo-seguranca.test.ts` (task 001); HTTP em `test/metodologias-diagnostico.test.ts` (task 004).

2. **Operações de metodologia no `TratativaService` (R1-R6, R14, R18, R21 a) [N3-6].** Actions ligadas `definirMetodologia(ferramenta, categoriaCausaRaiz, dados, confirmarSubstituicao)` e `derivarAcaoDaMetodologia(causaIdentificador, descricao, responsavel, prazo, prioridade, evidenciaObrigatoria)`; function `consultarMetodologiaTratativa(codigoTratativa)`. Precedência (R18):
   - Etapa 4 da R18 nas três actions ligadas (DC-12): chave da URL fora do formato UUID → 400 `Código inválido.` `target: codigo`, antes do 404.
   - `definirMetodologia`: 401 → 403 Aplicativo (`before('*')` existente, `srv/tratativa-service.ts:35-46`) → 400 runtime → 400 chave (DC-12) → 404 (`bloquearTratativa`) → 403 se não for `GestorTratativa` nem responsável de Ação/Subação da Tratativa (R4) → 409 `exigirAlteravel` (`srv/tratativa/bloqueio.ts:28-32`, CA11/CA12) → 409 substituição de ferramenta distinta sem `confirmarSubstituicao = true` (CA7) → 400 campos (CA3, CA35, CA36). Ferramenta ausente com metodologia existente e confirmação = remoção (R5 "exclusão"); sem metodologia, ferramenta ausente = 400 `O campo Ferramenta é obrigatório.`. Eventos: primeira definição ou troca de ferramenta → `DefinicaoMetodologia`; mesma ferramenta ou remoção → `EdicaoMetodologia` (DC-03).
   - `derivarAcaoDaMetodologia`: … 404 → 403 se não for `GestorTratativa` (R6, CA43) → 409 `exigirAlteravel` → 409 `Tratativa não possui metodologia associada.` → 400 `causaIdentificador` que não é chave preenchida da análise atual → validações existentes de Ação (`srv/tratativa/acoes-validacao.ts`, `validarMatricula`). `causaDescricao` é lido do JSON no servidor (não é parâmetro). Cria a Ação por `criarAcaoComCausa` (nova exportação em `srv/tratativa/acoes-criacao.ts`, reaproveitando `criar` de `:36-77`) e grava `Criacao` + `CriacaoAcaoComCausa` (DC-03). Nenhuma Ação nasce em `definirMetodologia` (R6 a: criação nunca automática).
   - `consultarMetodologiaTratativa`: 200 sempre com `DetalheMetodologia`; sem metodologia, todos os campos `null` (R21 a "resposta vazia/nula", mantendo o item 7 de CONVENCOES); `codigoTratativa` mal formado → 400 `Código inválido.` (DC-12). `dados` mascarado (`null`) para quem não tem vínculo diagnóstico (Gestor, responsável de Ação/Subação da Tratativa ou Validador habilitado; função `tratativasComVinculoDiagnostico`, DC-15); `autor` mascarado para não-Gestor (R16 b).
   - `Acoes.causaDescricao` (gravado na derivação) segue a mesma regra de vínculo diagnóstico (DC-15): o Responsável da Ação derivada vê a causa da sua Ação.
   - **Verificado por:** `test/metodologias-diagnostico.test.ts` (task 004).

3. **Aval Técnico: entidade, emissão, consulta, histórico e Evidências (R7, R9-R11, R14, R16 b, R21 b) [N3-1, N3-4, N3-5, N3-6].**
   - Entidade `AvalesTecnicos` (append-only; nenhum serviço a expõe para escrita) com `parecer`, `fundamentacao`, `validador`, `emitidoEm`, `dataBaseVerificacao`, `dataLimiteVerificacao`. Vigência derivada (DC-05).
   - `emitirAvalTecnico(parecer, fundamentacao)` (action ligada, `TratativaService`): 401 → 403 Aplicativo → 400 runtime → 400 `Código inválido.` chave mal formada (DC-12, CA34) → 404 → 403 Validador não habilitado para a Origem (DC-01, origem lida por DC-16; CA17) → 409 `Tratativa <Status> não pode ser alterada.` → 409 `Aval Técnico exige que a Tratativa esteja em status Em andamento.` (CA42) → 409 Ações abertas (CA20) → 409 nova Ação pós-reprovação (CA24) → 400 `parecer` (CA22) → 400 `fundamentacao` 20-2000 após trim (CA21). Grava `AvalesTecnicos` e o evento `EmissaoAvalTecnico` na mesma transação, depois de `bloquearTratativa`.
   - `consultarAvalTecnicoTratativa(codigoTratativa)`: vigente, `dataBaseVerificacao`, `dataLimiteVerificacao` (DC-04) e o histórico de pareceres com `vigente`. `fundamentacao` mascarada para quem não é Gestor nem Validador habilitado (CA41); `validador` (matrícula) mascarado para não-Gestor.
   - Evidências: `listarEvidenciasAcao`, `listarEvidenciasTratativa` e `baixarEvidencia` (`srv/tratativa/evidencias-consultas.ts:126-178, 187-243, 251-328`) passam a aceitar o Validador habilitado na etapa 6 (hoje `ehGestor || ehResponsavel`, `:149-155`, `:201`, `:285-291`); o Validador vê todas as Evidências da Tratativa com `autorAnexo = null`; o download grava `DownloadEvidencia` com a matrícula dele (CA44).
   - Histórico: `srv/tratativa/historico.ts` (`LinhaHistorico.avalTecnico`), `srv/tratativa/historico-consulta.ts` (coluna `avalTecnico`, junção com `AvalesTecnicos` para `detalhe.fundamentacao`) e `srv/tratativa/historico-autorizacao.ts` (`mascararDetalhe` zera `fundamentacao` para não-Gestor).
   - **Por quê:** fonte única (DC-05), precedência D10 (DC-06) e menor privilégio (R16 b).
   - **Verificado por:** `test/metodologias-aval-tecnico.test.ts` (task 002).

4. **Encerramento exige Aval aprovado vigente; fim de `Aberta → Encerrada` (R8, R11 a/d, R17, R18 etapa 8, R20 a/b) [N3-3].** Em `srv/tratativa/ciclo-de-vida.ts`:
   - remove `'Aberta|Encerrada'` de `TRANSICOES` (`:16`);
   - antes da consulta à tabela, `status = 'Aberta'` e destino `Encerrada` → 409 `Tratativa em status Aberta não pode ser encerrada diretamente: deve transitar para Em andamento e receber Aval Técnico aprovado.` (achado "conferido" do parecer: mensagem própria antes de `TRANSICOES`);
   - mantém o 409 de Ações abertas (`:40-46`) e, depois dele, exige Aval aprovado vigente: sem vigente aprovado → 409 `Tratativa não pode ser encerrada: exige Aval Técnico aprovado.`, ou `... exige novo Aval Técnico aprovado emitido após a reabertura.` quando a Tratativa tem evento `Reabertura` (CA18, CA33);
   - a reabertura não grava nada novo: a revogação decorre de DC-05 (R11 d);
   - Tratativas legadas encerradas não são tocadas (R17 a, CA32; nenhuma validação retroativa).
   - Telas: `podeEncerrar` em `srv/tratativa-app-service.ts:109` passa a `gestor && status === 'Em andamento' && sem Ação aberta && Aval aprovado vigente` (R20 nota de UI), calculado em lote para as linhas lidas.
   - **Verificado por:** `test/metodologias-encerramento.test.ts` (task 003) e os 21 testes migrados.

5. **Parametrização por Origem e designação de Validadores na Administração (R13, R19) [N3-5].** `ParametrosOrigem` (chave `origemNormalizada`, normalizada por `normalizarTexto` de `srv/tratativa/normalizacao.ts:2-6`; linha baseline `*` semeada em `db/data/br.com.calazanstec-ParametrosOrigem.csv`, sem nome de departamento) e `ValidadoresOrigem`. No `AdministracaoService`: projeções `@readonly` `ParametrosOrigem` e `ValidadoresOrigem` com `@restrict` a `Administrador` (M-05; o `before('*')` de `srv/administracao-service.ts:37-49` já recusa o Gestor porque os eventos novos não entram na lista de exceções) e as actions `atualizarParametrosOrigem`, `incluirValidadorOrigem`, `removerValidadorOrigem`. Tela: nova visão `ParametrosOrigem` no List Report da Administração e Object Page, no mesmo padrão de `ParametrosAlertas` (`app/administracao/annotations.cds:110-166`, `app/administracao/webapp/manifest.json` `routing`).
   - **`validadorPadrao` é rótulo descritivo (R-08, N-M04):** texto livre (ex.: `Inspetor da Qualidade`, CA27) que identifica o papel ou a equipe responsável pela validação na Origem (R13 b). Não tem efeito de autorização nem de destinatário de alerta; quem emite e quem recebe é decidido só por `ValidadoresOrigem` e pelo papel `ValidadorTecnico` (DC-01, DC-11).
   - **Lista padrão corporativa = `ValidadoresOrigem` da linha `*` de `ParametrosOrigem`.** O Administrador a mantém pelas mesmas actions, com `origem = '*'`: `incluirValidadorOrigem({ origem: '*', matricula })`, `removerValidadorOrigem({ origem: '*', matricula })`; `atualizarParametrosOrigem({ origem: '*', ... })` altera o baseline (prazo, rótulo). `normalizarTexto('*')` devolve `'*'`, então a chave casa com a linha semeada. Na tela, a linha "Padrão global" aparece na lista de `ParametrosOrigem` e sua Object Page mostra a tabela `validadores`. O CSV semeia a linha `*` **sem** Validadores: até o Administrador incluir alguém, vale R7 c "na ausência de qualquer lista" (qualquer `ValidadorTecnico` emite; alertas ao Responsável Principal, DC-11).
   - A spec atual já nomeia a lista padrão corporativa em R13 b e no fecho de R13 ("lista de Validadores da Origem, depois lista padrão corporativa e, somente quando ambas estiverem vazias, qualquer colaborador investido no papel `Validador Técnico`"); a linha `*` é a implementação dessa lista.
   - **Verificado por:** `test/metodologias-parametros-alertas.test.ts` (task 005).

6. **Alertas de verificação de eficácia (R12, R20 d) [N3-6].** Nova regra em `srv/alertas/regra-verificacao-eficacia.ts` (novo), chamada por `avaliarAlertas` (`srv/alertas/motor-regras.ts:86-186`): para cada Tratativa com etapa de verificação ativa (DC-04), `dataLimite - hoje <= diasAntecedenciaPrazoProximo` → `PrazoProximo` aos Validadores da lista efetiva; `dataLimite < hoje` → `PrazoVencido` aos Validadores da lista efetiva + `responsavelPrincipal` (DC-02), com `entidade = 'VerificacaoEficacia'`. Sem nenhuma lista (nem da Origem nem `*`), os dois tipos vão ao `responsavelPrincipal` (DC-11, DV-05). `validadoresEfetivos(origemNormalizada)` (task 002) devolve `{ lista: string[], fonte: 'Origem' | 'Padrao' | 'Nenhuma' }` para a regra distinguir "lista vazia" de "sem lista". O reenvio diário vem da idempotência diária existente (a chave contém o dia, `processamento.ts:169`). `AlertaGerado` ganha `entidade: 'VerificacaoEficacia'` e `prazo?: string` (data limite) para a mensagem (`montarMensagem`, `processamento.ts:43-56`), que continua neutra (010 R7). Sem encerramento automático.
   - **Verificado por:** `test/metodologias-parametros-alertas.test.ts` (task 005).

7. **Indicadores no `AnaliticoService` (R15, R20 e).** Padrão do serviço (`srv/analitico-service.cds:8-75`, views em `srv/analitico/*.cds`): view nova `ParetoCausasRaizesView` em `srv/analitico/eficacia.cds` (novo, `GROUP BY categoriaCausaRaiz`) exposta como `ParetoCausasRaizes`; functions `consultarTaxaEficacia`, `consultarTempoMedioVerificacaoEficacia` e `consultarAderenciaMetodologica` (`periodoInicio`, `periodoFim`, validados por `validarFiltros` de `srv/analitico/filtros.ts:34`). Taxa (DC-14): universo = Tratativas cujo **primeiro Aval em todo o histórico** (menor `emitidoEm` em `AvalesTecnicos`) foi emitido no período; taxa = % desse universo em que o primeiro Aval é `Aprovado`; universo vazio → `0`. Uma Tratativa reprovada antes do período e aprovada dentro dele não entra (o primeiro Aval está fora do período) e nunca conta como eficaz. Agregação no banco (`GROUP BY` + `min`), comparação e divisão em TS. Tempo médio: média de `dataCivil(emitidoEm) - dataCivil(dataBaseVerificacao)` (dias corridos) dos Avales emitidos no período; filtro no banco, diferença entre datas civis no fuso da plataforma e média em TS (DC-14: `days_between` é portável, mas conta sobre os instantes UTC). Aderência: % das Tratativas com `dataCriacao` no período que têm `metodologia` preenchida (CA40). Acesso pelo `before('*')` existente (`srv/analitico-service.ts:78-83`).
   - **Verificado por:** `test/metodologias-indicadores.test.ts` (task 006).

8. **Interface Fiori elements v4 (R16 a, R20 nota, CA14, CA31) [N3-4, N3-7].**
   - **Projeção do App (I-04):** a projeção existente `TratativaAppService.Tratativas` (`srv/tratativa-app-service.cds:9-37`) é **editada no lugar** (não estendida): novas colunas `metodologia`, `categoriaCausaRaiz`, `metodologiaData`, `metodologiaAutor`, `metodologiaAtualizadoEm`; flags `podeDefinirMetodologia`/`ocultaDefinirMetodologia`, `podeDerivarAcao`/`ocultaDerivarAcao`, `podeEmitirAval`/`ocultaEmitirAval` (literal `false as ... : Boolean`, padrão das flags existentes); associação `avalesTecnicos : Association to many AvalesTecnicos on avalesTecnicos.tratativa = $self` (padrão de `historico`, `:36`). Fonte: cds-mcp `search_docs` "Extending Views and Projections": projeção só se estende com `extend <entity> with columns { ... }` (colunas, calculados, associações não gerenciadas); como as actions também mudam, a edição direta evita duas definições.
   - **Regex do before READ (I-04):** `srv/tratativa-app-service.ts:97` passa a `/^(pode|oculta)(Iniciar|Encerrar|Cancelar|Reabrir|EmitirAval|DefinirMetodologia|DerivarAcao)$/` e garante `status`, `origem` e `codigo` quando uma flag é pedida (evita a regressão R-18 da 015).
   - **Máscara LGPD genérica (I-05, N-I01, R3-I01, DC-17, DC-15):** a task 000 troca as máscaras por entidade (`srv/tratativa-app-service.ts:116-124`, `:164-175`) por `after('READ', '*')` sobre `srv/tratativa/mascara-app.ts`, que percorre a árvore do resultado em qualquer nível de `$expand` e a partir de qualquer entidade alvo (`Tratativas`, `Acoes`, `Participantes`, `Evidencias`, `Comentarios`, `Historico`, `AvalesTecnicos`), com as regras da 015 (`descricao`, `solicitante`, `responsavelPrincipal`, `participantes`, `Participantes.matricula`, `Acoes.responsavel`). A task 007 acrescenta às regras: `metodologiaData` (`null` sem vínculo diagnóstico, `tratativasComVinculoDiagnostico`), `metodologiaAutor` (`null` para não-Gestor), `AvalesTecnicos.fundamentacao` (`null` para quem não é Gestor nem Validador habilitado), `AvalesTecnicos.validador` (`null` para não-Gestor), `AvalesTecnicos.vigente` (`lerSituacaoAval`) e `Acoes.causaDescricao` (`null` sem vínculo diagnóstico). A decisão de vínculo é fail-closed: sem `codigo`/`tratativa_codigo` na linha, o campo é mascarado. O `before('READ', '*')` da 007 acrescenta essas colunas ao `$select` de cada nível para quem não é Gestor. Não há mais `after('READ', 'AvalesTecnicos')` nem `after('READ', 'Acoes')` próprios: a raiz passa pelo mesmo percurso. **R-11 (DC-18):** `Evidencias`, `Comentarios` (com `mencoes`) e `Historico` seguem as regras das specs `evidencias` R11, `comentarios` R3/R7 e `historico-e-auditoria` R5: com `Comentarios` ou `mencoes` como entidade alvo, o não-Gestor recebe 403; com `Evidencias` ou `Historico` como alvo, a query ganha o filtro de vínculo e a máscara zera `autorAnexo`/`autorRemocao` e `autor`/`justificativa`/`valorAnterior`/`valorNovo` de matrícula; pelo `$expand`, as três vêm `[]` ao não-Gestor. Não há mais campo pessoal fora da máscara. **R-14 (DC-19):** o mesmo `before` varre `where`/`having`/`groupBy`/`orderBy`, as colunas calculadas e as opções de cada nível do `$expand`, e recusa com 403 o que atravessa entidade restrita ou termina em campo pessoal não filtrável. `@cds.search` tira esses campos da busca.
   - **Actions do App:** `definirMetodologia` (`@requires: 'authenticated-user'`, `@Core.OperationAvailable: in.podeDefinirMetodologia`), `derivarAcaoDaMetodologia` (`@requires: 'GestorTratativa'`, `in.podeDerivarAcao`, `prazo : Date` como `criarAcao` do App, M-04), `emitirAvalTecnico` (`@requires: 'ValidadorTecnico'`, `in.podeEmitirAval`), parâmetros sem tamanho. `@Common.SideEffects` com `in/` (padrão `app/tratativas/annotations.cds:398-405`); as quatro actions de status passam a incluir também as flags novas.
   - **Seção customizada só para o formulário da metodologia** (contrato do papel, `arquiteto.md:40`): `content.body.sections.MetodologiaSection` no `manifest.json` do app (`template`, `title`, `position` com `anchor: "PlanoAcaoFacet"`), fragmento `ext/fragment/MetodologiaSection.fragment.xml` com `sap.ui.layout.form.Form` + `ColumnLayout` (`columnsM="2" columnsL="3" columnsXL="4"`), controles ligados a um `JSONModel` local `metodologia`, e extensão de controller `ext/controller/MetodologiaExtension.js` registrada em `sap.ui5.extends.extensions["sap.ui.controllerExtensions"]["sap.fe.templates.ObjectPage.ObjectPageController"]` (M-07).
     - Carga: `override.routing.onAfterBinding(contexto)` lê `contexto.requestProperty([...])` e preenche o `JSONModel`. Fonte: ui5-mcp `get_api_reference` `sap.fe.core.controllerextensions.Routing#onAfterBinding` ("intercept the routing event after binding a page") e `sap.ui.model.odata.v4.Context#requestObject` ("it is **not** possible to cause additional property requests" com `requestObject`, por isso `requestProperty`).
     - Gravação: `this.base.getExtensionAPI().getEditFlow().invokeAction('TratativaAppService.definirMetodologia', { contexts, parameterValues, skipParameterDialog: true, label })`, depois `ExtensionAPI.refresh()`. Fonte: ui5-mcp `sap.fe.core.PageController#getExtensionAPI`, `sap.fe.core.ExtensionAPI#getEditFlow`, `EditFlow#invokeAction` (`parameterValues`: "array of objects ... name ... value"; `skipParameterDialog`: "Skips the action parameter dialog if values are provided for all of them"), `sap.fe.templates.ObjectPage.ExtensionAPI#refresh`.
     - Derivação com revisão (CA14, R6 a): por item preenchido, `invokeAction('TratativaAppService.derivarAcaoDaMetodologia', { contexts, parameterValues: [causaIdentificador, descricao sugerida], label })` **sem** `skipParameterDialog`: o Fiori abre o diálogo da action para o Gestor revisar Descrição e preencher Responsável, Prazo, Prioridade e Evidência (mesma fonte). `causaIdentificador` aparece no diálogo **somente leitura** (`@Common.FieldControl: #ReadOnly` no parâmetro, DC-15), com `@title: 'Causa de origem'`; o servidor revalida (400 se não for chave preenchida da análise atual). Recuos de DC-15, em ordem: `@UI.Hidden: true` no parâmetro, desde que o valor de `parameterValues` chegue ao servidor; se não chegar, um `sap.m.Dialog` próprio da seção (`JSONModel` `derivacao`) com envio por `invokeAction(..., { contexts, parameterValues, skipParameterDialog: true, label })` (ui5-mcp `EditFlow#invokeAction`).
     - Substituição (R3): ferramenta diferente da gravada → `sap.m.MessageBox.confirm` antes de enviar `confirmarSubstituicao = true`.
     - **Ligação dos handlers (DC-13, caminho primário):** o fragmento declara os controles com IDs estáveis e **sem** atributo `press`; em `routing.onAfterBinding`, a extensão faz `this.base.getExtensionAPI().byId('metodologiaSalvar').attachPress(this.onSalvar, this)` (idem `metodologiaRemover`, `metodologiaDerivar-<chave>`; `attachChange` no `sap.m.Select` `metodologiaFerramenta` para trocar o `FormContainer` visível), uma vez por instância. Fonte: ui5-mcp `get_api_reference` `sap.fe.core.ExtensionAPI#byId` ("Access a control by its ID ... without view and section prefix") e `sap.m.Button#attachPress`. Se `byId` devolver `undefined` (seção ainda não instanciada), a ligação é refeita no próximo `onAfterBinding`; a verificação visual da task 007 confirma.
     - **Controles de lista (R3-M03):** `metodologiaFerramenta` é `sap.m.Select` (a spec não define placeholder para a ferramenta); `metodologiaCategoria` é `sap.m.ComboBox`, porque precisa exibir o placeholder de "Categoria da Causa Raiz" e `sap.m.Select` não tem `placeholder`. `sap.m.ComboBox` estende `sap.m.ComboBoxBase` → `sap.m.ComboBoxTextField`, que estende `sap.m.InputBase` (dona de `placeholder`). Fonte: ui5-mcp `get_api_reference` 1.136.23 `sap.m.ComboBox` ("extends":"sap.m.ComboBoxBase"), `sap.m.ComboBoxTextField` ("extends":"sap.m.InputBase"), `sap.m.InputBase#placeholder`; r3 `sap.m.Select` sem `placeholder`. O ComboBox aceita texto livre, então a extensão envia `getSelectedKey()` (vazio quando o texto digitado não casa com um item) e o servidor recusa valor fora do catálogo (400 `target: categoriaCausaRaiz`, task 004).
     - Regras do MCP seguidas: `Form` + `ColumnLayout`, nunca `SimpleForm`; 2/3/4 colunas M/L/XL; dependências por `sap.ui.define` e `core:require`; sem script inline; textos e placeholders em `i18n.properties` (ui5-mcp `get_guidelines`, seções 1 e 4).
     - Biblioteca: `sap.ui.layout` em `sap.ui5.dependencies.libs` do manifest e em `framework.libraries` de `app/tratativas/ui5.yaml` (M-06). Fonte: ui5-mcp `get_api_reference` `sap.ui.layout.form.ColumnLayout` (`"library":"sap.ui.layout"`).
   - **Aval na Object Page:** botão de cabeçalho `Emitir Aval Técnico` em `UI.Identification` com `@UI.Hidden: ocultaEmitirAval`; diálogo padrão da action com `parecer` (`Common.ValueListWithFixedValues` em `ValoresParecerAval`) e `fundamentacao` (`@UI.Placeholder` LGPD); facet `AvaliacoesTecnicasFacet` com `avalesTecnicos/@UI.LineItem`. Entidades de valores `ValoresFerramentaMetodologia`, `ValoresMacrocausa`, `ValoresParecerAval` lidas por `valoresEnum` (`srv/tratativa-app-service.ts:70-76`).
   - **Placeholders (R16 a, CA31):** os 12 textos da spec (`spec.md`, bloco "Placeholders autoexplicativos", logo após a tabela de regras) viram chaves de `app/tratativas/webapp/i18n/i18n.properties` (fragmento) e `@UI.Placeholder` (parâmetros de action), **literalmente iguais** aos da spec; o RED compara por igualdade (N-M08), não por palavra-chave. O texto "Porquês 2 a 5" vale para os quatro campos `porque2`..`porque5`, e o texto 5W2H vale para os sete campos; `Categoria da Causa Raiz` (placeholder do `sap.m.ComboBox` `metodologiaCategoria`) e `Parecer` (`@UI.Placeholder` do parâmetro com lista de valores) usam o texto da spec. O app declara só o locale `""` (`manifest.json` `supportedLocales`), então não há outros arquivos de idioma a sincronizar. Na spec atual, todo campo de texto livre (3W, 5 Porquês, 5W2H, PDCA/8D, Fundamentação) traz a vedação de nomes ou dados sensíveis exigida por R16 a; Categoria e Parecer são seleções, sem texto livre.
   - **Verificado por:** `test/mascara-lgpd-app.test.ts` (task 000: regras da 015 por `$expand` cruzado e guarda CSN); `test/ui-metodologias-aval.test.ts` (task 007), verificação visual por etapa; os testes genéricos de rótulo/placeholder de `test/ui-acabamento.test.ts:645-845` passam a cobrir as actions e entidades novas automaticamente.

9. **Papel `ValidadorTecnico` (R7) [N3-2].** `xs-security.json`: escopo `$XSAPPNAME.ValidadorTecnico`, role template `ValidadorTecnico`, role collection `ActionPlan_ValidadorTecnico` (descrições sem nome de departamento: `test/publicacao-descritores.test.ts` CA14 recusa `SESMT|Qualidade|RH|Compliance` em `xs-security.json`). `package.json` `[test]` e `[papeis]`: usuários `validador` e `validador-b` com `roles: ["ValidadorTecnico"]` (fonte: cds-mcp "Mocked Authentication", `users.<id>.roles`). Matrícula do mocked = id do usuário (`obterMatriculaUsuario` devolve `req.user.id`, `srv/tratativa/identidade.ts:17-19`), por isso não há `M9001` (M-09). `test/apoio/auth-dev.js`: persona `validador: ['ValidadorTecnico']` em `PERSONAS` (só `[development]`).

---

## Contrato executável

- **O que é:** os blocos CDS abaixo (edições em arquivos existentes e arquivos novos), os tipos TypeScript gerados por `cds-typer` a partir deles e os testes RED de cada task.
- **Como se valida:** `npx cds compile srv app --to edmx` / `npm run build` (inclui `cds-typer`) e `sh agentic/mecanismos/scripts/verify.sh`; RED por `verifica-red.sh`.
- **Saída da validação (medido):**
```
run_manifest_validation (ui5-mcp) sobre cópia de app/tratativas/webapp/manifest.json
com sap.ui.layout em libs, sap.ui.controllerExtensions e content.body.sections.MetodologiaSection:
{"isValid":true,"errors":[]}
```
  `cds build`/`cds-typer` **não foram executados nesta rodada** (o brief da correção r1 proíbe build e servidor). A compilação é medida no RED da task 001 (modelo) e de cada task que toca `srv/*.cds`, e o log vai para o relatório da task. Os blocos seguem só construções já compiladas no repositório (enum com valor, `managed`, `@assert.range`, `Composition of many ... on ... = $self`, `false as x : Boolean`, `Association to many ... on ... = $self` em projeção, `@restrict` com lista de grants, parâmetros `LargeString` e sem tamanho).

### 1. `db/tratativa.cds` (task 001; edições no lugar)

```cds
// Tipos novos (após PrazosCriticidade ou junto aos demais tipos):
/** R1 (016): ferramentas homologadas de análise de causa. */
type FerramentaMetodologia : String(20) enum {
  TresW        = '3W';
  CincoPorques = '5 Porquês';
  CincoWDoisH  = '5W2H';
  Pdca8D       = 'PDCA/8D';
}

/** R2 e (016): catálogo de macrocausas (Categoria da Causa Raiz). */
type MacrocausaCausaRaiz : String(50) enum {
  MetodoProcesso          = 'Método/Processo';
  MaquinaEquipamento      = 'Máquina/Equipamento';
  MaterialInsumo          = 'Material/Insumo';
  MaoDeObraComportamental = 'Mão de Obra/Comportamental';
  MeioAmbienteInstalacao  = 'Meio Ambiente/Instalação';
  GestaoPlanejamento      = 'Gestão/Planejamento';
}

/** R10 a (016): parecer do Aval Técnico. */
type ParecerAvalTecnico : String(10) enum {
  Aprovado;
  Reprovado;
}

// EventoHistorico (:24-37) ganha, ao final da lista:
//   DefinicaoMetodologia;
//   EdicaoMetodologia;
//   EmissaoAvalTecnico;
// EventoHistoricoAcao (:67-79) ganha: CriacaoAcaoComCausa;
// EntidadeAlerta (:90-93) ganha: VerificacaoEficacia;

// Tratativas (:109-135) ganha, ao final:
      /** R1-R3, R16 (016): análise de causa (no máximo uma por Tratativa). */
      metodologia             : FerramentaMetodologia;
      categoriaCausaRaiz      : MacrocausaCausaRaiz;
      @PersonalData.IsPotentiallyPersonal
      metodologiaData         : LargeString;
      @PersonalData.IsPotentiallyPersonal
      metodologiaAutor        : String(50);
      metodologiaAtualizadoEm : Timestamp;

// HistoricoTratativa (:166-183) ganha, ao final:
      /** R14 c (016): referência ao Aval Técnico do evento EmissaoAvalTecnico (DC-03). */
      avalTecnico   : UUID;

// Acoes (:194-210) ganha, ao final:
      /** R6 b (016): vínculo auditável à causa da metodologia. */
      causaIdentificador    : String(30);
      @PersonalData.IsPotentiallyPersonal
      causaDescricao        : String(2000);

// Entidades novas (fim do arquivo):
/** R7, R10, R11 (016): pareceres do Aval Técnico; somente inclusão (DC-05). */
@PersonalData.EntitySemantics: 'Other'
entity AvalesTecnicos {
  key id                    : UUID;
      tratativa             : Association to one Tratativas not null;
      parecer               : ParecerAvalTecnico not null;
      @PersonalData.IsPotentiallyPersonal
      fundamentacao         : String(2000) not null;
      @PersonalData.IsPotentiallyPersonal
      validador             : String(50) not null;
      emitidoEm             : Timestamp not null;
      dataBaseVerificacao   : Timestamp;
      dataLimiteVerificacao : Date;
}

/** R13 (016): parametrização por Origem; a linha '*' é o baseline global (dado, não código). */
@PersonalData.EntitySemantics: 'Other'
entity ParametrosOrigem : managed {
  key origemNormalizada            : String(100);
      origem                       : String(100) not null;
      metodologiaSugerida          : FerramentaMetodologia;
      validadorPadrao              : String(100) not null;
      prazoVerificacaoEficaciaDias : Integer not null default 30 @assert.range: [1, 180];
      validadores                  : Composition of many ValidadoresOrigem on validadores.parametro = $self;
}

/** R7, R12 d (016): matrículas habilitadas como Validador Técnico na Origem (DC-01). */
@PersonalData.EntitySemantics: 'Other'
entity ValidadoresOrigem {
  key ID        : UUID;
      parametro : Association to one ParametrosOrigem not null;
      @PersonalData.IsPotentiallyPersonal
      matricula : String(50) not null;
}
```

`db/data/br.com.calazanstec-ParametrosOrigem.csv` (novo):
```
origemNormalizada;origem;validadorPadrao;prazoVerificacaoEficaciaDias
*;Padrão global;Validador Técnico;30
```

### 2. `srv/tratativa-service.cds` (tasks 002 e 004; edições no lugar)

```cds
  // Tipos novos dentro de `service TratativaService { ... }`:
  /** R21 a (016). */
  type DetalheMetodologia {
    ferramenta         : String(20);
    categoriaCausaRaiz : String(50);
    dados              : LargeString;
    autor              : String(50);
    atualizadoEm       : Timestamp;
  }

  /** R21 b (016). */
  type ItemAvalTecnico {
    id            : UUID;
    parecer       : String(10);
    fundamentacao : String(2000);
    validador     : String(50);
    emitidoEm     : Timestamp;
    vigente       : Boolean;
  }

  type DetalheAvalTecnico {
    vigente               : ItemAvalTecnico;
    dataBaseVerificacao   : Timestamp;
    dataLimiteVerificacao : Date;
    historico             : many ItemAvalTecnico;
  }

  type ResultadoAvalTecnico {
    id      : UUID;
    parecer : String(10);
  }

  /** R21 (016): leitura para qualquer usuário autenticado (Aplicativo recusado pelo before('*')). */
  function consultarMetodologiaTratativa(codigoTratativa : UUID) returns DetalheMetodologia;   // task 004
  function consultarAvalTecnicoTratativa(codigoTratativa : UUID) returns DetalheAvalTecnico;   // task 002

  // @restrict de Tratativas (:308-319) ganha um privilégio (DC-06; papel verificado em código):
  //   { grant: ['emitirAvalTecnico'], to: 'authenticated-user' },                          // task 002
  //   { grant: ['definirMetodologia', 'derivarAcaoDaMetodologia'], to: 'authenticated-user' } // task 004

  // Bloco `actions { ... }` de Tratativas (:320-366) ganha (parâmetros sem tamanho, D10):
    /** R7, R9-R11, R18 (016). */
    action emitirAvalTecnico(parecer : String, fundamentacao : String) returns ResultadoAvalTecnico;     // task 002
    /** R1-R5, R18 (016). */
    action definirMetodologia(ferramenta : String, categoriaCausaRaiz : String, dados : LargeString,
                              confirmarSubstituicao : Boolean);                                          // task 004
    /** R6, R18 (016). */
    action derivarAcaoDaMetodologia(causaIdentificador : String, descricao : String, responsavel : String,
                                    prazo : String, prioridade : String, evidenciaObrigatoria : String)
      returns ResultadoCriacaoAcao;                                                                      // task 004

  // DetalheEventoHistorico (:369-377) ganha (task 002, DC-03):
    fundamentacao : String(2000);
```

### 3. `srv/administracao-service.cds` (task 005)

```cds
  /** R13 (016). */
  type DetalheParametrosOrigem {
    origem                       : String(100);
    metodologiaSugerida          : String(20);
    validadorPadrao              : String(100);
    prazoVerificacaoEficaciaDias : Integer;
    validadores                  : many String;
  }

  @restrict: [{ grant: '*', to: 'Administrador' }]
  action atualizarParametrosOrigem(origem : String, metodologiaSugerida : String, validadorPadrao : String,
                                   prazoVerificacaoEficaciaDias : Integer) returns DetalheParametrosOrigem;

  @restrict: [{ grant: '*', to: 'Administrador' }]
  action incluirValidadorOrigem(origem : String, matricula : String) returns DetalheParametrosOrigem;

  @restrict: [{ grant: '*', to: 'Administrador' }]
  action removerValidadorOrigem(origem : String, matricula : String) returns DetalheParametrosOrigem;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ParametrosOrigem as projection on m.ParametrosOrigem;

  @readonly
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: '*', to: 'Administrador' }]
  entity ValidadoresOrigem as projection on m.ValidadoresOrigem;
```

### 4. `srv/analitico/eficacia.cds` (novo) e `srv/analitico-service.cds` (task 006)

```cds
// srv/analitico/eficacia.cds
using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.eficacia;

/** R15 c (016): Pareto por macrocausa, agregado no banco. */
view ParetoCausasRaizesView as
  select from m.Tratativas {
    key categoriaCausaRaiz : String(50),
        count(*) as total : Integer
  }
  where categoriaCausaRaiz is not null
  group by categoriaCausaRaiz;
```

```cds
// srv/analitico-service.cds: novo `using` e, dentro do serviço:
using { br.com.calazanstec.analitico.eficacia as ef } from './analitico/eficacia';

  @readonly
  entity ParetoCausasRaizes as projection on ef.ParetoCausasRaizesView;

  type RetornoTaxaEficacia { taxaPercentual : Decimal(5,2); }
  type RetornoTempoMedioVerificacao { mediaDias : Decimal(5,1); }
  type RetornoAderenciaMetodologica { percentual : Decimal(5,2); }

  function consultarTaxaEficacia(periodoInicio : String, periodoFim : String) returns RetornoTaxaEficacia;
  function consultarTempoMedioVerificacaoEficacia(periodoInicio : String, periodoFim : String) returns RetornoTempoMedioVerificacao;
  function consultarAderenciaMetodologica(periodoInicio : String, periodoFim : String) returns RetornoAderenciaMetodologica;
```

### 5. `srv/tratativa-app-service.cds` (tasks 003 e 007; edição da projeção existente)

```cds
  // Projeção Tratativas (:9-37): novas colunas e associação (task 007), antes de `acoes`:
        metodologia,
        categoriaCausaRaiz,
        metodologiaData,
        metodologiaAutor,
        metodologiaAtualizadoEm,
        false as podeDefinirMetodologia   : Boolean,
        false as ocultaDefinirMetodologia : Boolean,
        false as podeDerivarAcao          : Boolean,
        false as ocultaDerivarAcao        : Boolean,
        false as podeEmitirAval           : Boolean,
        false as ocultaEmitirAval         : Boolean,
        avalesTecnicos : Association to many AvalesTecnicos on avalesTecnicos.tratativa = $self,

  // Bloco actions da projeção (:37-86) ganha:
    @requires: 'authenticated-user'
    @Core.OperationAvailable: in.podeDefinirMetodologia
    action definirMetodologia(ferramenta : String, categoriaCausaRaiz : String, dados : LargeString,
                              confirmarSubstituicao : Boolean);

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: in.podeDerivarAcao
    action derivarAcaoDaMetodologia(causaIdentificador : String, descricao : String, responsavel : String,
                                    prazo : Date, prioridade : String, evidenciaObrigatoria : String)
      returns ResultadoCriacaoAcao;

    @requires: 'ValidadorTecnico'
    @Core.OperationAvailable: in.podeEmitirAval
    action emitirAvalTecnico(parecer : String, fundamentacao : String);

  // Projeção Acoes (:143-157) ganha as colunas causaIdentificador, causaDescricao.
  // MinhasAcoes (:180) não ganha as colunas (fora do escopo; sem exposição nova da causa).

  // app/tratativas/annotations.cds (task 007), parâmetro da derivação (DC-15):
  //   derivarAcaoDaMetodologia(causaIdentificador @title: 'Causa de origem' @Common.FieldControl: #ReadOnly, ...);

  // Entidades novas no serviço:
  @readonly
  entity AvalesTecnicos as projection on m.AvalesTecnicos {
    key id,
        tratativa,
        parecer,
        fundamentacao,
        validador,
        emitidoEm,
        false as vigente : Boolean
  };

  @readonly
  entity ValoresFerramentaMetodologia { key codigo : String(20); descricao : String(50); }

  @readonly
  entity ValoresMacrocausa { key codigo : String(50); descricao : String(50); }

  @readonly
  entity ValoresParecerAval { key codigo : String(10); descricao : String(50); }
```

### 6. `app/tratativas/webapp/manifest.json` (task 007; validado acima)

```json
"sap.ui5": {
  "dependencies": { "libs": { "sap.fe.templates": {}, "sap.m": {}, "sap.ui.core": {}, "sap.ui.layout": {} } },
  "extends": { "extensions": { "sap.ui.controllerExtensions": {
    "sap.fe.templates.ObjectPage.ObjectPageController": {
      "controllerName": "br.com.calazanstec.actionplan.tratativas.ext.controller.MetodologiaExtension"
    } } } },
  "routing": { "targets": { "TratativasObjectPage": { "options": { "settings": {
    "contextPath": "/Tratativas",
    "content": { "body": { "sections": { "MetodologiaSection": {
      "template": "br.com.calazanstec.actionplan.tratativas.ext.fragment.MetodologiaSection",
      "title": "{i18n>diagnosticSection}",
      "position": { "placement": "After", "anchor": "PlanoAcaoFacet" }
    } } } } } } } } }
}
```

---

## Testes existentes que mudam de contrato

Conferido por varredura (`grep` de `'Encerrada'`, `mudarStatus`, `encerrarTratativa`, `podeEncerrar` em `test/*.ts`), excluindo os arquivos que só gravam `Encerrada` direto no banco (`criacao-acoes`, `edicao-acoes`, `evidencias-consultas-download`), os que só leem texto de anotação (`ui-tratativas`, `templates-aplicacao`) e `test/consultas-responsabilidade.test.ts`, cuja ocorrência de `Encerrada` (`:215-216`) é só o nome do `describe`/`it`: o teste conclui a Ação e consulta `minhasAcoes`, sem encerrar a Tratativa (N-M02). O parecer r1 citou 18; a varredura achou 21 (4 a mais: `alertas-motor-regras` `:450`, `analitico-operacional-lgpd` `:44-50`/`:151`, `autorizacao-execucao-acoes` `:214`/`:362`, `responsaveis-tratativa` `:85`/`:429`/`:451`; `ui-tratativas` sai porque só confere texto em `:142-146`).

**Máscara genérica (DC-17, task 000), varredura da r3:** `grep -n "expand" test/*.ts` e `grep -ln "api/app/v1" test/*.ts` no worktree. Só `test/ui-tratativas.test.ts` usa `$expand` no App: `:213` (`Acoes(<id>)?$expand=acaoMae` como Gestor, sem máscara, inalterado) e `:306-309` (`Tratativas(<id>)?$expand=participantes,acoes` como `usuario`, espera `matricula` e `responsavel` `null`; a regra `participantes = []` e `responsavel = null` se mantém). Os outros arquivos que leem o App (`test/ui-acabamento.test.ts`, `test/ui-launchpad-governanca.test.ts`, `test/ui-minhas-pendencias.test.ts`) não leem campo mascarado por `$expand`: `MinhasAcoes`/`MinhasTratativas` não projetam `responsavel`, `solicitante` nem `descricao` da Tratativa (`srv/tratativa-app-service.cds:180-210`). As leituras diretas como não-Gestor (`test/ui-tratativas.test.ts:290-330`, CA21) mantêm o resultado. **Nenhum teste existente muda de contrato com a DC-17**; `test/ui-tratativas.test.ts` fica como regressão, sem edição. A injeção de `tratativa_codigo`/`codigo` (task 007) roda só para não-Gestor e acrescenta uma coluna à resposta, como a injeção de `status` existente (`srv/tratativa-app-service.ts:98-99`); nenhum teste existente compara a lista exata de propriedades de uma leitura de `Acoes` ou `Tratativas` como não-Gestor (conferido nos quatro arquivos por `grep` de `Object.keys`/`toEqual({`; a única comparação de chaves de resposta, `test/ui-acabamento.test.ts:204`, é de `Colaboradores`, entidade sem regra de máscara e sem injeção).

**Regras de Evidências, Comentários e Histórico no App (DC-18, task 000), varredura da R-11:** `grep -ln "api/app/v1" test/*.ts` (`ui-acabamento`, `ui-launchpad-governanca`, `ui-minhas-pendencias`, `ui-tratativas`) e `grep -nE "/(Comentarios|Evidencias|Historico|MencoesComentario)\b|/(comentarios|evidencias|historico)\b|expand=[a-z,]*(comentarios|evidencias|historico|mencoes)" test/*.ts` no worktree. Só `test/ui-tratativas.test.ts` lê essas entidades no App, e sempre como `gestor`: `:231` e `:237` (`Evidencias(<id>)`, inclusive a removida), `:252` e `:262` (`Comentarios(<id>)`); o Gestor não muda, então as quatro leituras ficam como regressão. `:180-190` (CA10-CA12) só confere texto de anotação (`Target: 'comentarios/@UI.LineItem'` e `annotate TratativaAppService.Comentarios`); a seção Comentários não muda de anotação (a `@UI.Hidden` prevista na r3 saiu na r4). `test/comentarios-tratativa.test.ts:124-127` lê o `TratativaService` (`/api/tratativa/v1/Comentarios` → 403), que a DC-18 não toca; serve de referência do código. Nenhum teste existente lê `Evidencias`, `Comentarios`, `mencoes` ou `Historico` do App como não-Gestor, por navegação ou por `$expand`. **Nenhum teste existente muda de contrato com a DC-18**; a mudança de contrato (o não-Gestor deixa de ler essas entidades sem regra no App) só é provada pelo RED novo da task 000.

**Revisão r4 (R-13), varredura refeita no worktree:** `grep -ln "api/app/v1" test/*.ts` (os mesmos quatro arquivos); `grep -nE "/(Comentarios|Evidencias|Historico|MencoesComentario)\b|/(comentarios|evidencias|historico|mencoes|acao|tratativa)\b|expand=[a-z,]*(comentarios|evidencias|historico|mencoes)" test/*.ts` (no App, só `test/ui-tratativas.test.ts:231`, `:237`, `:252`, `:262`, leituras por chave como `gestor`; nenhuma navegação a partir de `Evidencias`, `Comentarios` ou `Historico`, nenhuma navegação `/comentarios` como não-Gestor); `grep -n "ComentariosFacet\|ocultaResponsaveis" test/*.ts` (só `test/ui-tratativas.test.ts:333` e `:335`, da `ResponsaveisFacet`, que não muda); `grep -rn "DEV_USER\|auth-dev\|PERSONAS" test/*.ts` (`test/ui-acabamento.test.ts:349-405` confere o padrão `gestor`, `admin`, `leitor-analitico` e a persona inexistente → `gestor`, sem lista exata de `PERSONAS`; as personas `M1001` e `M2002` que a task 000 acrescenta não mudam esse contrato). As regras novas (navegação de Comentários com R7 a/b, segmentos do caminho, Validador em Evidências na 007, `DECIDIDOS`/`LIBERADOS` na guarda nova) só alcançam o não-Gestor ou o teste novo. **Nenhum teste existente muda de contrato com a r4.**

**Revisão r5 (R-14, DC-19), varredura no worktree:** `grep -ln "api/app/v1" test/*.ts` (os mesmos quatro arquivos) e `grep -nE '\$(filter|search|orderby|apply|compute)' test/ui-acabamento.test.ts test/ui-launchpad-governanca.test.ts test/ui-minhas-pendencias.test.ts test/ui-tratativas.test.ts`. As únicas ocorrências estão em `test/ui-minhas-pendencias.test.ts` (CA13 `:147-193`, `MinhasAcoes`: `$filter` por `codigoTratativa` e `statusAcao`, `$orderby=prazo desc`; CA15 `:195-233`, `MinhasTratativas`: `$filter` por `codigoTratativa`, `$orderby=dataPrevistaConclusao`), como `M1001`. São entidades sem regra (`livre`), sem associação a entidade restrita e sem elemento decidido nas refs, então passam pela varredura sem mudança. Nenhum teste existente usa `$search`, `$apply` ou `$compute` no App; o único uso de busca é o `on('READ', 'Colaboradores')`, que não recebe anotação nem varredura com efeito. **Nenhum teste existente muda de contrato com a DC-19.** A busca livre do Gestor fica mais estreita ("O desconfortável" 9 f), mas nenhum teste a cobre.

| Arquivo | Por que muda | Task |
|---|---|---|
| `test/ui-acabamento.test.ts` | lista exata de usuários mocked (`:353-355`) | 001 |
| `test/ajustes-revisao-tratativa.test.ts` | encerra por `mudarStatus` (`:36`) | 003 |
| `test/alertas-motor-regras.test.ts` | encerra a partir de `Aberta` (`:450`) | 003 |
| `test/analitico-correcao-revisao.test.ts` | `mudar(..., 'Encerrada')` (`:35-80`) | 003 |
| `test/analitico-executivo-evidencias.test.ts` | `encerrar` (`:33-35`) | 003 |
| `test/analitico-gestao-metricas.test.ts` | `encerrar` (`:29-31`) | 003 |
| `test/analitico-operacional-lgpd.test.ts` | `novaTratativa(..., 'Encerrada')` de `Aberta` (`:44-50`, `:151`) | 003 |
| `test/autorizacao-execucao-acoes.test.ts` | `:214`, `:362` | 003 |
| `test/ciclo-de-vida-acoes.test.ts` | `:235-267`, `:381`, `:469`, `:477` | 003 |
| `test/comentarios-auditoria-concorrencia.test.ts` | `:111`, `:166`, `:205` | 003 |
| `test/comentarios-tratativa.test.ts` | `:260`, `:375` | 003 |
| `test/criticidade-gestor.test.ts` | encerra de `Aberta` (`:230`) | 003 |
| `test/delegacao-acoes.test.ts` | `:242`, `:436` | 003 |
| `test/edicao-tratativa.test.ts` | `:214` | 003 |
| `test/evidencias-anexo.test.ts` | `:285` | 003 |
| `test/evidencias-anexo-complemento.test.ts` | `:279`, `:342` | 003 |
| `test/evidencias-remocao.test.ts` | `:248` | 003 |
| `test/historico-consulta-unificada.test.ts` | `:209` | 003 |
| `test/historico-precedencia-imutabilidade.test.ts` | `:116-121`, `:172`, `:226`, `:253` | 003 |
| `test/responsaveis-tratativa.test.ts` | `:85`, `:429`, `:451` | 003 |
| `test/transicoes-tratativa.test.ts` | encerramento direto e asserções invertidas (`:70`, `:222-224`) | 003 |
| `test/ui-acabamento.test.ts` | `podeEncerrar` em `Aberta` (`:175`, `:716`, `:720`) | 003 |
| `test/alertas-motor-regras.test.ts`, `test/alertas-despacho-idempotencia.test.ts` | só se a regra nova gerar alerta extra num cenário com asserção exata (filtrar por `entidade`) | 005 (escopo permitido) |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| tasks/000-mascara-lgpd-app.md | Máscara LGPD genérica do `TratativaAppService` (DC-17): `after('READ', '*')` sobre `srv/tratativa/mascara-app.ts`, regras da 015 em qualquer nível de `$expand` e a partir de qualquer entidade alvo; fim das máscaras por entidade; guarda CSN de campos pessoais. Corrige o vazamento pré-existente da 015. DC-18 (R-11): regras de acesso e máscara de `Evidencias`, `Comentarios`/`mencoes` e `Historico` iguais às das specs, sem `FORA_DA_MASCARA`; r4 (R-13): regra em todo segmento do caminho, navegação de Comentários com a R7 a/b, `DECIDIDOS`/`LIBERADOS`, medição de rede da Object Page; r5 (R-14, DC-19): varredura de `where`/`having`/`groupBy`/`orderBy`/colunas calculadas/`$expand` e `@cds.search` sem campos pessoais. | metodologias-e-aval-tecnico/000-mascara-lgpd-app |
| tasks/001-modelo-seguranca-base.md | Modelo persistido (tipos, colunas, `AvalesTecnicos`, `ParametrosOrigem`, `ValidadoresOrigem`, baseline `*`), catálogo de eventos do histórico, papel `ValidadorTecnico` (xs-security, mocked, persona dev). | metodologias-e-aval-tecnico/001-modelo-seguranca-base |
| tasks/002-aval-tecnico-emissao.md | `emitirAvalTecnico`, `consultarAvalTecnicoTratativa`, vigência e prazo (DC-04/05), designação (DC-01), histórico com fundamentação, Evidências para o Validador. | metodologias-e-aval-tecnico/002-aval-tecnico-emissao |
| tasks/003-encerramento-com-aval.md | Fim de `Aberta → Encerrada`, encerramento exige Aval aprovado vigente, revogação na reabertura, `podeEncerrar` do App, legado, migração dos 21 testes. | metodologias-e-aval-tecnico/003-encerramento-com-aval |
| tasks/004-metodologias-causa-raiz.md | `definirMetodologia`, `derivarAcaoDaMetodologia`, `consultarMetodologiaTratativa`, validação por ferramenta, autoria, histórico. | metodologias-e-aval-tecnico/004-metodologias-causa-raiz |
| tasks/005-parametrizacao-origem-alertas.md | `ParametrosOrigem`/`ValidadoresOrigem` no `AdministracaoService` e na tela de Administração; alertas de verificação de eficácia. | metodologias-e-aval-tecnico/005-parametrizacao-origem-alertas |
| tasks/006-indicadores-eficacia.md | Pareto, Taxa de Eficácia, Tempo Médio de Verificação e Aderência no `AnaliticoService`. | metodologias-e-aval-tecnico/006-indicadores-eficacia |
| tasks/007-ui-fiori-metodologias-aval.md | App de Tratativas: projeção, flags, máscaras, actions, SideEffects, seção customizada da metodologia, diálogo do Aval, facet de avaliações. | metodologias-e-aval-tecnico/007-ui-fiori-metodologias-aval |

Ordem: 000 → 001 → 002 → 003 → 004 → 005 → 006 → 007. A 000 é antecipada e independente do modelo do 016: corrige um vazamento que já está em produção na 015, entra no primeiro PR da pilha e deixa a 007 só acrescentando regras ao mecanismo pronto. Fica numa task própria (e não numa etapa da 007) para não esperar seis tasks e para que o revisor de diff veja a mudança de segurança isolada. A 003 vem antes da 004 para que os testes da metodologia (CA11, CA13) já nasçam com o encerramento novo.

---

## Itens N3 (aprovação no Gate 1)

| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | Modelo persistido (`db/tratativa.cds`), só aditivo: entidades `AvalesTecnicos`, `ParametrosOrigem`, `ValidadoresOrigem`; colunas `Tratativas.metodologia/categoriaCausaRaiz/metodologiaData/metodologiaAutor/metodologiaAtualizadoEm`, `Acoes.causaIdentificador/causaDescricao`, `HistoricoTratativa.avalTecnico`; valores novos em `EventoHistorico`, `EventoHistoricoAcao`, `EntidadeAlerta`; baseline `db/data/br.com.calazanstec-ParametrosOrigem.csv`. Sem remoção nem alteração de coluna existente. | migração de dados (HDI aditiva) | APROVADO (humano, Gate 1, 2026-10-13) |
| N3-2 | Segurança: escopo `$XSAPPNAME.ValidadorTecnico`, role template `ValidadorTecnico`, role collection `ActionPlan_ValidadorTecnico` (`xs-security.json`); usuários mocked `validador` e `validador-b` em `[test]` e `[papeis]` (`package.json`); persona `validador` só em `[development]` (`test/apoio/auth-dev.js`); grants `authenticated-user` para `emitirAvalTecnico`, `definirMetodologia`, `derivarAcaoDaMetodologia` com papel em código (DC-06); `@requires` das actions do App. | segurança/autorização | APROVADO (humano, Gate 1, 2026-10-13) |
| N3-3 | Mudança de contrato do ciclo de vida: fim de `Aberta → Encerrada`; encerramento (`mudarStatus` com `Encerrada` e `encerrarTratativa` do App) exige Aval aprovado vigente; `podeEncerrar` do App muda; 20 testes existentes migram e 1 tem asserção invertida. | contrato público | APROVADO (humano, Gate 1, 2026-10-13) |
| N3-4 | LGPD: `@PersonalData.IsPotentiallyPersonal` em `metodologiaData`, `metodologiaAutor`, `causaDescricao`, `AvalesTecnicos.fundamentacao/validador`, `ValidadoresOrigem.matricula`; máscaras em `consultarMetodologiaTratativa`, `consultarAvalTecnicoTratativa`, `consultarHistoricoTratativa`; `causaDescricao` restrita ao vínculo diagnóstico (DC-15); placeholders R16 a; mensagens de alerta neutras. **Máscara genérica do App (DC-17, R-10):** `after('READ', '*')` que mascara em qualquer nível de `$expand` e a partir de qualquer entidade alvo, com decisão de vínculo fail-closed, cobrindo os campos novos do 016 (task 007) **e corrigindo o vazamento pré-existente da 015** (task 000): hoje `Historico`/`Participantes`/`Evidencias`/`Comentarios`/`Acoes` com `$expand=tratativa` ou `$expand=acao`/`acaoMae` devolvem `descricao`, `solicitante`, `responsavelPrincipal` e `Acoes.responsavel` a quem não é Gestor. Os `after READ` por entidade saem. **Evidências, Comentários e Histórico no App (DC-18, R-11):** o não-Gestor recebe 403 na coleção, na chave e nos caminhos que partem de `Comentarios`/`mencoes` (como `TratativaService.Comentarios`), e na navegação `/Tratativas(<id>)/comentarios` só os comentários que a `comentarios/spec.md` R7 a/b autoriza, com `mencoes` `[]` (r4, M4-03); lista filtrada por vínculo com matrícula, autoria e justificativa mascaradas em `Evidencias` (inclusive para o Validador Técnico habilitado, task 007, r4 I4-01) e `Historico`; a regra vale em todo segmento do caminho (r4, M4-02); e `[]` pelo `$expand`. Muda a autorização de leitura do App (hoje qualquer autenticado lê as três); a seção Comentários da Object Page continua visível. Nenhum campo pessoal fica fora da máscara: a guarda CSN exige regra para todo campo `@PersonalData` do App, e campo sem regra vem `null` ao não-Gestor ("O desconfortável" 9). **Predicados e busca (DC-19, R-14, r5):** para o não-Gestor, `$filter` (inclusive lambdas `any`/`all`), `$orderby`, `$apply`, `$compute` e as opções aninhadas no `$expand` respondem 403 `Acesso negado.` quando atravessam `Comentarios`, `mencoes`, `Evidencias` ou `Historico` (ou outra entidade `soGestor`/`porVinculo`) ou quando terminam em campo pessoal não filtrável (`descricao`, `solicitante`, `responsavelPrincipal`, `Acoes.responsavel`, `Participantes.matricula`, autoria, justificativa e valores do Histórico, `mencoes.matricula`). `@cds.search` nas projeções do App tira esses campos da busca livre, inclusive para o Gestor, que continua filtrando por eles. A busca de `Colaboradores` não muda. | dados pessoais | APROVADO (humano, Gate 1, 2026-10-13) |
| N3-5 | Autorização por designação administrada: `ValidadoresOrigem` decide quem emite Aval e quem consulta/baixa Evidências de uma Tratativa (DC-01); Evidências deixam de ser só de Gestor e Responsável da Ação (`srv/tratativa/evidencias-consultas.ts`); Administrador mantém a designação. | autorização | APROVADO (humano, Gate 1, 2026-10-13) |
| N3-6 | Contrato público aditivo: operações novas em `TratativaService`, `AdministracaoService`, `AnaliticoService`; campo `fundamentacao` em `DetalheEventoHistorico`; valor `VerificacaoEficacia` em `AlertasEmitidos.entidade` e no retorno de `listarAlertasEmitidos`; colunas e entidades novas no `TratativaAppService`. | contrato público | APROVADO (humano, Gate 1, 2026-10-13) |
| N3-7 | Biblioteca UI5 nova no app de Tratativas: `sap.ui.layout` (manifest e `ui5.yaml`) e primeiro código de extensão (`webapp/ext/`). | dependência nova | APROVADO (humano, Gate 1, 2026-10-13) |

---

## Como isso se prova

| CA | Prova | Task |
|---|---|---|
| R16 b como base do App (máscara das specs anteriores, sem CA próprio no 016; regressão de `test/ui-tratativas.test.ts` CA21); DC-18: `evidencias` R11 a-c, `comentarios` R3 e R7 a/b (navegação `/Tratativas(<id>)/comentarios`, r4), `historico-e-auditoria` R5 b-c aplicadas ao App, em todo segmento do caminho (r4); DC-19 (r5): `$filter`/`$orderby`/`$apply`/`$compute`/`$search` sem contornar a leitura nem a máscara | HTTP + CSN `test/mascara-lgpd-app.test.ts` | 000 |
| CA16 (credencial do papel); estrutura de persistência de R13 (sem CA próprio) | CSN, `xs-security.json`, `package.json`, persona | 001 |
| CA16, CA17, CA20, CA21, CA22, CA23 (parecer reprovado gravado, Tratativa segue Em andamento), CA24, CA25, CA28, CA29, CA34, CA39 (data limite), CA41, CA42 (emissão em Aberta), CA44, CA45 (aval) | HTTP `test/metodologias-aval-tecnico.test.ts` | 002 |
| CA6 (fluxo completo sem metodologia), CA18, CA19, CA23 (encerramento bloqueado), CA32, CA33, CA42 (encerrar de Aberta) | HTTP `test/metodologias-encerramento.test.ts` | 003 |
| CA1-CA5, CA7-CA15, CA35, CA36, CA38, CA43, CA45 (metodologia) | HTTP `test/metodologias-diagnostico.test.ts` | 004 |
| CA17 (lista da Origem que não inclui o usuário), CA26, CA27, CA37; DV-05 (sem lista, alertas ao Responsável Principal) | HTTP + rotina de alertas `test/metodologias-parametros-alertas.test.ts` | 005 |
| CA30, CA39 (tempo médio), CA40 | HTTP `test/metodologias-indicadores.test.ts` | 006 |
| CA14 (revisão na tela), CA18/CA19 (botão), CA31 (igualdade com os 12 textos), CA41 (App: navegação, `$expand` a partir de qualquer entidade e fail-closed, DC-17), CA42 (botões), CA44 (App: Validador habilitado lê as Evidências da Tratativa, DC-18 r4) | CSN/`$metadata`/HTTP `test/ui-metodologias-aval.test.ts` + verificação visual | 007 |

CA13 da spec (edição após reabertura) é da task 004; a task 001 só prova a estrutura de persistência (M-01).

---

## O que não muda

- Contrato de 12 chaves de `consultarTratativa` (`DetalheTratativa`, `srv/tratativa-service.cds:36-49`) e o formato de item de `consultarHistoricoTratativa` (só o objeto `detalhe` ganha `fundamentacao`).
- Encerrar continua exigindo todas as Ações e Subações finalizadas (`srv/tratativa/ciclo-de-vida.ts:40-46`), agora antes da exigência do Aval.
- Histórico append-only; nenhuma operação altera ou remove `AvalesTecnicos`.
- Aplicativo de Origem recusado em todo o `TratativaService` e no `TratativaAppService` pelos `before('*')` existentes.
- Nenhuma dependência npm nova; fronteiras do dependency-cruiser intactas (`app/` não importa `srv/`).
- Nenhum nome de departamento em código, descritor ou dado semeado (R19; `test/genericidade-lint.test.ts`, `test/publicacao-descritores.test.ts` CA14).

---

## O desconfortável, declarado

1. **Encerrar fica mais caro para todos.** Toda Tratativa precisa de `Em andamento` e de um Aval aprovado; 20 testes antigos migram para o helper `encerrarComAval` e um teste de transição inverte a asserção. É a decisão 7 do humano e D-r1-01.
2. **Validador habilitado por Origem, não por Tratativa** (DV-01, já na spec pela R-07). Sem lista configurada (o CSV semeia a linha `*` vazia), qualquer `ValidadorTecnico` emite e **nenhum Validador é avisado do prazo**: `PrazoProximo` e `PrazoVencido` vão só ao Responsável Principal (DC-11, DV-05). Para que Validadores recebam alertas, o Administrador precisa cadastrar a lista `*` ou a da Origem.
3. **"Cópia ao Gestor" chega ao Responsável Principal** (DV-02). Tratativa sem Responsável Principal não recebe a cópia; se também não houver lista de Validadores, a verificação vencida não gera alerta algum (só aparece nas consultas e na tela).
4. **Aval aprovado sobrevive a Ação criada depois dele.** A spec não manda revogar; o encerramento continua bloqueado enquanto a Ação estiver aberta, e libera quando ela fecha sem novo parecer.
5. **Seção customizada.** O formulário da metodologia é o único código de extensão do app (fragmento + extensão de controller). Os handlers são ligados por `ExtensionAPI#byId` + `attachPress` (DC-13); o momento em que os controles da seção existem frente a `onAfterBinding` não é documentado no MCP, por isso a ligação é idempotente e repetida a cada binding, e a verificação visual confirma. Concluir uma Ação pela linha da tabela não atualiza as flags de Aval sem atualizar a página (SideEffects com caminho para a Tratativa pai não confirmado no MCP). `@Common.FieldControl: #ReadOnly` em parâmetro de action (DC-15) também só é confirmado na verificação visual; se falhar, há dois recuos em ordem (`@UI.Hidden` e, se o valor oculto não chegar ao servidor, diálogo próprio com `invokeAction` + `skipParameterDialog`), e o segundo acrescenta código de extensão.
6. **Exceções de convenção de teste.** CA32 semeia uma Tratativa legada direto no banco (DC-09; cinco testes antigos já faziam o mesmo, N-M03). As actions ligadas do 016 respondem 400 para chave mal formada, ao contrário das existentes (404, CONVENCOES item 10): exceção registrada pela task 002 (DC-12).
7. **Prazo recalculado.** Alterar o prazo de uma Origem muda na hora a data limite de todas as verificações em curso (DC-04): é o comportamento escolhido, não um efeito colateral.
8. **Indicadores em parte calculados em TS.** A Taxa de Eficácia agrega no banco e só compara/divide em TS; o Tempo Médio filtra no banco e faz a média em TS, como os indicadores existentes do `AnaliticoService` (DC-14). R15 pede "agregação no banco". `days_between` é portável, mas conta sobre instantes UTC; a régua do 016 é a data civil no fuso da plataforma (`srv/lib/relogio.ts:2`), então a diferença e a média ficam em TS.
9. **Máscara genérica: limites declarados (DC-17, DC-18).** (a) **Os campos que ficavam em `FORA_DA_MASCARA` seguem as specs (DC-18, R-11).** O que resta declarado: (a.1) pelo `$expand`, Evidências, Comentários e Histórico vêm `[]` também para quem tem vínculo (inclusive o Validador habilitado), o que é mais restrito que as functions; esse usuário lê pela coleção (Comentários: só pela navegação), pela chave, pela navegação e pelas functions do `TratativaService`. Que as seções da Object Page usam navegação, e não `$expand`, é inferência do ui5-mcp (`ODataModel#bindList`, r4 M4-01); a task 000 mede a rede como `M1001` e `M2002`, e o recuo declarado (filtro de vínculo no `$expand`, no `after`, com colunas injetadas) tem `$count` aninhado incoerente. (a.2) Sem vínculo, a leitura por chave de Evidência ou de evento de Histórico responde 404, não 403 (o filtro está na query; coerente com "lista vazia" de R11 e R5 b.5); o mesmo vale quando o caminho atravessa uma delas (`/Evidencias(<E>)/acao`, `/Historico(<ID>)/tratativa`, r4 M4-02), ao custo de um `SELECT.one` por segmento intermediário `porVinculo`; um caminho que parte de `Comentarios` responde 403. (a.3) **Comentários (r4, M4-03):** a seção fica visível; pela navegação `/Tratativas(<id>)/comentarios` o Responsável Principal e os Participantes leem os comentários diretos e o Responsável de Ação ou Subação os da própria Ação, com `texto` e `autor` (exceção LGPD da `comentarios/spec.md` R7) e `mencoes` `[]`; os demais recebem `[]`. A coleção `/Comentarios` e a chave `/Comentarios(<c>)` continuam 403 ao não-Gestor, então a navegação é o único caminho de leitura no App, e ela repete a regra das functions. (a.4) Responsável Principal e Participantes passam a ver no App só os eventos diretos da própria Tratativa, sem autoria nem justificativa; o Responsável de Ação deixa de ver a lista de Evidências das Ações alheias. Antes viam tudo. (a.5) **Validador Técnico habilitado em Evidências (r4, I4-01, task 007):** lê todas as Evidências ativas da Tratativa, sem `autorAnexo`/`autorRemocao`. Na coleção sem chave, os candidatos são os `tratativa_codigo` distintos das Evidências ativas, e `tratativasComValidadorHabilitado` roda sobre eles a cada leitura do Validador: custo proporcional ao número de Tratativas com Evidência, aceito porque o filtro precisa ficar na query para `$count` e paginação. Sem lista na Origem nem na `*`, qualquer `ValidadorTecnico` lê as Evidências de toda Tratativa (R7 c). (b) A coluna injetada (`tratativa_codigo`/`codigo`) aparece na resposta do não-Gestor mesmo sem ter sido pedida, como `status` hoje; não é dado pessoal. (c) Os `after` rodam em paralelo (cds-mcp "srv.after"): as flags e as máscaras não escrevem os mesmos campos, e a RED da 000 confere flags e máscaras na mesma leitura. (d) **Exceção declarada da guarda (r4, M4-04): `Colaboradores`** (`srv/tratativa-app-service.cds:116-121`) expõe `matricula`, `nome` e `email` a qualquer autenticado do App, sem `@PersonalData` e sem regra em `REGRAS_MASCARA`. É a ajuda de valor de matrícula das actions do App, servida pelo `IntegracaoPessoasService` (`srv/tratativa-app-service.ts:128-155`) e anterior ao 016; a guarda CSN não a vê porque procura `@PersonalData`. Fica fora do escopo da máscara por decisão, não por esquecimento. (e) **Predicados e busca (r5, DC-19, R-14):** o não-Gestor recebe 403 em `$filter`, `$orderby`, `$apply` e `$compute` que tocam entidade restrita ou campo pessoal não filtrável, inclusive em opções aninhadas no `$expand`. Isso vale mesmo quando ele tem vínculo: o Responsável Principal não filtra a lista de Tratativas por `historico/any(...)`, e o Participante não filtra o Histórico por `valorNovo` (`filtraveis: []`). Nos campos liberados de uma navegação já filtrada, o filtro é livre (`/Tratativas(<id>)/comentarios?$filter=contains(texto,…)`). Recusar com 403, em vez de devolver lista vazia, avisa o cliente de que o filtro foi negado, em vez de responder um "nada encontrado" enganoso. O critério é estrutural (o campo ou a entidade), não depende do valor procurado e não revela dado. (f) **Busca livre mais estreita para todos (DC-19):** `@cds.search` é estático, então o Gestor também perde, na busca do List Report, os acertos em `descricao`, `solicitante` e `responsavelPrincipal` (e nos campos pessoais das demais entidades do App). O filtro por esses campos continua disponível a ele. Preservar a busca do Gestor exigiria reescrever a busca por usuário (DC-19, alternativa d). A varredura também tem custo: uma passada pela árvore da query por leitura do não-Gestor, proporcional ao tamanho da query, sem acesso ao banco. (g) **"Acesso negado." na tela ao ordenar ou filtrar coluna decidida (r6, M6-01, R-15):** o não-Gestor que, na tela, ordena ou filtra uma coluna decidida recebe a mensagem "Acesso negado." (403 da varredura). Isso vale para `Acoes.responsavel` no Plano de Ação, `Evidencias.autorAnexo`, as colunas de `Historico` (`filtraveis: []`), as de `AvalesTecnicos` decididas na 007 (`validador`, `fundamentacao`) `Participantes.matricula` na tabela de Participantes (`app/tratativas/annotations.cds:175-181`) e, no List Report, a ordenação ou o filtro (inclusive em "Adaptar filtros") por `descricao`, `solicitante` e `responsavelPrincipal` (`app/tratativas/annotations.cds:176-240`); a regra geral vale para qualquer coluna decidida não filtrável (r7, M7-01). O carregamento padrão das tabelas não dispara a recusa, e a verificação visual da 000 e da 007 confere os dois lados. **Não** se usa `@Capabilities.SortRestrictions`/`FilterRestrictions` para esconder a ordenação ou o filtro: a anotação é estática e tiraria a ordenação e o filtro também do Gestor, para quem nada muda.

---

## Divergências com a spec

O arquiteto não edita a spec. Estado de cada divergência:

- **DV-01 (R7 c/d, R12 d, CA17, CA44): RESOLVIDA pela R-07.** A spec passou a usar "habilitado para a Origem da Tratativa" com lista por Origem, lista padrão e ausência de lista (R7 c); o design segue com `ValidadoresOrigem` (DC-01).
- **DV-02 (R12 d, R20 d, CA37): RESOLVIDA pela R-07.** A cópia de `PrazoVencido` vai ao Responsável Principal; o Gestor não recebe notificação individual (010 R4 f).
- **DV-03 (R12 a, R15 b): RESOLVIDA pela R-07.** Data base = a mais recente entre a conclusão/cancelamento da última Ação e a última entrada em `Em andamento` (DC-04).
- **DV-04 (R11 b): RESOLVIDA pela R-07.** "Nova Ação corretiva" inclui Subações criadas depois da reprovação (R18 etapa 8).
- **DV-05 (R12 d, R20 d, CA26, CA37): RESOLVIDA pela R-08.** A spec atual diz que, sem lista da Origem e com a lista padrão vazia, `PrazoProximo` e `PrazoVencido` vão ao Responsável Principal ("não há envio a todos os detentores do papel `Validador Técnico`, pois esse conjunto não é enumerável"). O design segue com DC-11.
- **Pendências da R-08 ao domínio: resolvidas na spec.** R13 b e o fecho de R13 citam a lista padrão corporativa (N-M04); todos os placeholders de texto livre trazem a vedação de nomes/dados sensíveis (N-M08). Nenhuma divergência aberta.

---

## Mapa dos achados da revisão r1

| Achado | Resolvido em |
|---|---|
| I-01 | Nomes reais em todo o documento: `srv/tratativa/ciclo-de-vida.ts`, `srv/tratativa/evidencias-consultas.ts`, `srv/tratativa/acoes-criacao.ts`, `srv/alertas/motor-regras.ts` e `srv/alertas/processamento.ts`, `AnaliticoService`; tasks 002-007 |
| I-02 | Seção "Testes existentes que mudam de contrato" (21 arquivos) e DC-08; tasks 001, 003, 005 |
| I-03 | DC-06; Contrato executável §2; tasks 002 e 004 |
| I-04 | Decisão 8 (edição da projeção, regex); Contrato executável §5; task 007 |
| I-05 | Decisão 8 (máscaras), Decisões 2 e 3; Contrato §1 (`@PersonalData`); N3-4; tasks 002, 004, 007 |
| I-06 | DC-01; Decisão 5; N3-5; DV-01; tasks 001, 002, 005 |
| I-07 | DC-02; Decisão 6; N3-6; DV-02; task 005 |
| I-08 | DC-03; Decisão 3; task 001 (catálogo) e 002 (histórico) |
| I-09 | DC-04; DV-03; tasks 002 e 005 |
| I-10 | Decisão 7; Contrato §4; task 006 |
| I-11 | DC-07; RED de cada etapa da task 007 |
| M-01 | "Como isso se prova" (CA13 só na 004); task 001 |
| M-02 | Decisões 6, 8 e DC-06 citam o cds-mcp `search_docs` desta rodada |
| M-03 | Decisão 8: seções customizadas são de `sap.fe.templates.ObjectPage` (manifest `content.body.sections`), não de `sap.uxap.ObjectPageLayout` |
| M-04 | `prazo : String` no `TratativaService` (como `criarAcao`, `srv/tratativa-service.cds:329`) e `prazo : Date` no App (como `srv/tratativa-app-service.cds:67`) |
| M-05 | Decisão 5: projeções e actions de `ParametrosOrigem` só para `Administrador`; sem functions de consulta abertas ao Gestor |
| M-06 | Decisão 8 e Contrato §6: `sap.ui.layout` no manifest e no `ui5.yaml`; N3-7 |
| M-07 | Decisão 8: extensão registrada em `sap.ui.controllerExtensions`, `JSONModel` local `metodologia`, `invokeAction` com `parameterValues`/`skipParameterDialog` |
| M-08 | `podeEncerrar` muda na task 003 (cita N3-3); rota/página de `ParametrosOrigem` em `app/administracao/webapp/manifest.json` na task 005 |
| M-09 | Decisão 9 (matrícula = id do usuário, sem `M9001`); DC-03 (derivação grava `Criacao` e `CriacaoAcaoComCausa`) |
| M-10 | DC-05 |

---

## Mapa dos achados da revisão r2

| Achado | Resolvido em |
|---|---|
| N-I01 | DC-10; Decisão 8 (máscara no `after READ` de `Tratativas` para `avalesTecnicos[]` e `acoes[].causaDescricao`, mais navegação); N3-4; task 007 etapa 1 (RED por navegação e por `$expand`) |
| N-I02 | DC-11 e DC-02 (texto atualizado); Decisão 6; "O desconfortável" 2 e 3; DV-05; task 002 (`validadoresEfetivos` com `fonte`) e task 005 (RED sem lista → Responsável Principal) |
| N-M01 | "Divergências com a spec": DV-01..04 resolvidas pela R-07; DV-05 pela R-08 |
| N-M02 | "Testes existentes que mudam de contrato": exclusão declarada de `test/consultas-responsabilidade.test.ts` (`:215-216`) |
| N-M03 | DC-09 corrigida (cinco testes já gravam no banco, com linhas); task 003 |
| N-M04 | Decisão 5 (`validadorPadrao` rótulo; lista `*` mantida pelas actions com `origem = '*'`); task 005 |
| N-M05 | DC-16 (SELECT de `origemNormalizada` em `validador-tecnico.ts`; avulsa usa `*`); task 002 |
| N-M06 | DC-12 (400 para chave mal formada, exceção ao item 10 da CONVENCOES); Decisões 2 e 3; tasks 002 e 004; CA17 na task 005 |
| N-M07 | DC-13; Decisão 8; task 007 etapa 2 |
| N-M08 | Decisão 8 (igualdade literal com os textos da spec, que já trazem a vedação); task 007 etapas 2 e 3 |
| N-M09 | DC-14; Decisão 7; "O desconfortável" 8; task 006 |
| N-M10 | DC-15; Decisões 2 e 8; Contrato §5 (anotação do parâmetro); tasks 004 e 007 |

---

## Mapa dos achados da revisão r3

| Achado | Resolvido em |
|---|---|
| R3-I01 | DC-17 (nova; DC-10 marcada como substituída); Decisão 8 (máscara genérica); N3-4; "Testes existentes que mudam de contrato" (varredura: nenhum muda); "O desconfortável" 9; task 000 (nova, antecipada: mecanismo, regras da 015, RED por `$expand` cruzado e guarda CSN); task 002 (`tratativasComValidadorHabilitado` em lote); task 007 etapa 1 (regras novas, `before('READ', '*')` com colunas garantidas, RED com `Historico?$expand=tratativa(...;$expand=avalesTecnicos)`, `Acoes(<id>)?$expand=acaoMae`, `Participantes?$expand=tratativa`, `Acoes?$select=causaDescricao` como `usuario` e como `M1001`) |
| R3-M01 | Avisos superados removidos ou atualizados: DC-11 (fonte = texto atual de R12 d/R20 d), Decisão 5 (R13 já cita a lista padrão), Decisão 8 (aviso N-M08 removido; a spec já veda nomes nos placeholders), "O desconfortável" 9 (substituído), DV-05 e pendências (resolvidas), mapa r2 N-M08 |
| R3-M02 | DC-14 (motivo = fuso da data civil; `days_between` citado do cds-mcp como portável e descartado; só o padrão filtro-no-banco de `analitico-service.ts:221-236` é seguido); Decisão 7; "O desconfortável" 8; task 006 |
| R3-M03 | Decisão 8 ("Controles de lista": `metodologiaCategoria` = `sap.m.ComboBox`, cadeia até `sap.m.InputBase` confirmada no ui5-mcp); task 007 (Interfaces e RED da etapa 2) |
| R3-M04 | DC-15 (dois recuos em ordem; o segundo com `sap.m.Dialog` próprio + `invokeAction` com `parameterValues` e `skipParameterDialog: true`); Decisão 8; "O desconfortável" 5; task 007 etapa 2 (verificação visual) |
| R3-M05 | Task 005 (CA37 sem lista: `PrazoVencido` ao Responsável Principal no primeiro dia e de novo no segundo dia, relógio avançado) |

---

## Mapa do Ruling R-11

| Ruling | Resolvido em |
|---|---|
| R-11 | DC-18 (nova); DC-17 (guarda só com `DECIDIDOS`, espelho de `campos`, e `LIBERADOS`, espelho de `liberados`, nomes vigentes desde a r4/M4-04; a r5 acrescenta `FILTRAVEIS`, DC-19); Decisão 8; N3-4; "Testes existentes que mudam de contrato" (varredura da R-11: nenhum muda); "Como isso se prova" (linha da 000); "O desconfortável" 9 (a); task 000 (regras por entidade, RED como `usuario` por entidade e caminho, regressão como `gestor`, guarda sem `FORA_DA_MASCARA`, `@UI.Hidden` na seção Comentários); task 007 (o caminho `Historico?$expand=tratativa(...)` do RED passa a rodar como o Participante `M2002`, porque o `usuario` recebe `Historico` vazio) |

---

## Mapa dos achados da revisão r4

Ruling R-13 (delegação do humano, `agentic/.estado/execucao/2026-10-13-metodologias/progress.md:32`).

| Achado | Resolvido em |
|---|---|
| I4-01 | DC-18 regra (2) (Validador habilitado por `tratativasComValidadorHabilitado`, inclusive "sem lista → qualquer `ValidadorTecnico`"; `autorAnexo`/`autorRemocao` `null`); N3-4; "Como isso se prova" (linha da 007, CA44 no App); "O desconfortável" 9 a.1 e a.5; task 000 (tabela de regras: nota da 007); task 007 (Arquivos, Interfaces, RED como `validador` e `validador-b`) |
| M4-01 | DC-18 ("Seções da Object Page": fonte ui5-mcp `ODataModel#bindList`, recuo declarado: filtro de vínculo no `$expand` com colunas injetadas); "O desconfortável" 9 a.1; task 000 (personas `M1001`/`M2002` em `test/apoio/auth-dev.js`, medição de rede na verificação visual e item obrigatório da revisão de diff, recuo) |
| M4-02 | DC-18 ("Caminho inteiro": segmentos de `req.query.SELECT.from.ref`, cds-mcp `.query`/`.path`; 404 em `porVinculo`, 403 em `soGestor`); "O desconfortável" 9 a.2; task 000 (`restricaoDeLeitura`, RED com `/Evidencias(<E3>)/acao`, `/Comentarios(<c>)/tratativa`, `/Historico(<ID>)/tratativa` como `usuario`) |
| M4-03 | DC-18 regra (1) (navegação `/Tratativas(<id>)/comentarios` com o filtro da `comentarios/spec.md` R7 a/b; 403 na coleção, na chave e nos caminhos que partem de `Comentarios`) e "Object Page" (a `@UI.Hidden` da `ComentariosFacet` sai); N3-4; "O desconfortável" 9 a.3; task 000 (sem edição de `app/tratativas/annotations.cds`; RED como `M9999` Responsável Principal, `M2002` Participante, `M1001` Responsável de Ação e `usuario`) |
| M4-04 | DC-17 e DC-18 (`campos` = elementos pessoais decididos; `liberados`; guarda com `DECIDIDOS` e `LIBERADOS`, que substitui o nome `MASCARADOS`); "O desconfortável" 9 d (`Colaboradores` como exceção declarada); task 000 (Interfaces e guarda CSN); task 007 (listas da guarda) |

## Mapa dos achados da revisão r5

| Achado | Onde foi resolvido |
|---|---|
| I5-01 | DC-19 (nova; R-14): varredura de `where`/`having`/`groupBy`/`orderBy`, das colunas calculadas, das opções de cada nível do `$expand` e de `from.SELECT`; critérios (a) travessia de alvo `soGestor`/`porVinculo`, (b) campo de `campos` fora de `filtraveis` ou `@PersonalData` sem regra, (c) forma desconhecida; forma CQN conferida no cds-mcp e na gramática instalada; `filtraveis` (`Historico: []`); `@cds.search` com exclusões; guarda `FILTRAVEIS`; usos legítimos conferidos. Também na Decisão 8, em N3-4, em "Testes existentes que mudam de contrato" (varredura r5: nenhum muda), em "Como isso se prova" (linha da 000), em "O desconfortável" 9 (e) e (f), na task 000 (interfaces, `@cds.search`, RED como `usuario`, `M1001`, `M2002` e `gestor`, guarda) e na task 007 (campos novos em `@cds.search` e na guarda) |
| M5-01 | Task 007, "N3 aprovados no Gate 1": N3-5 (Evidências lidas pelo Validador Técnico habilitado no App, DC-01/DC-18 r4) |
| M5-02 | Task 000, `restricaoDeLeitura`: entidade sem regra é `livre` na guarda de caminho e na varredura de travessia; o fail-closed de `@PersonalData` sem regra fica no `after` (`aplicarMascaras`) e, na varredura, só como término de ref (critério b da DC-19) |
| M5-03 | Mapa do Ruling R-11: `MASCARADOS` trocado por `DECIDIDOS`/`LIBERADOS` (mais `FILTRAVEIS`, DC-19) |

## Mapa dos achados da revisão r6

| Achado | Onde foi resolvido |
|---|---|
| I6-01 | DC-19, "Alvo e ordem da varredura" (R-15): só a query do cliente, síncrona no início de `restricaoDeLeitura`, antes de qualquer `await` e injeção (`filtroVinculo`, disjunção do Validador da 007, `MinhasAcoes`/`MinhasTratativas`, `status`, `campo`, `garantirChaves`); `restringirLeitura` como primeiro `before('READ', …)` do `init`; `{SELECT}` em expressão recusado; alternativa (cópia de `req.query`) descartada com justificativa. Task 000: "Modificados" (ordem de registro), interface `restricaoDeLeitura` (ordem e alvo), RED "DC-19, o que continua 200" (`M1001` em `/Evidencias?$filter=tratativa_codigo eq <id>`, `M2002` em `/Tratativas(<id>)/comentarios`, CA13/CA15 sem edição), item novo da revisão de diff. Task 007: `garantirChaves` registrado depois de `restringirLeitura` |
| M6-01 | "O desconfortável" 9 (g), sem `@Capabilities.SortRestrictions`/`FilterRestrictions`; verificação visual da task 000 e da task 007 (Etapas 1 e 3) |
| M6-02 | Task 000, interface `restricaoDeLeitura`, "Formas aceitas pela varredura" (folhas `val`, operadores em texto, `param`, `sort`/`nulls`, `orderBy` `implicit: true` de `generic/sorting.js:39-46`, coluna `$count` de `grammar.peggy:583`) e aliases do `$apply` → 403 ao não-Gestor; DC-19 aponta para a lista |
