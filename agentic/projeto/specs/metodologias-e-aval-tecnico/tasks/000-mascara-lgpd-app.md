# Task 000: mascara-lgpd-app

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** draft
**Branch:** metodologias-e-aval-tecnico/000-mascara-lgpd-app

## Objetivo
Trocar as máscaras LGPD por entidade do `TratativaAppService` por uma máscara genérica (`after('READ', '*')`). Ela percorre a árvore do resultado em qualquer nível de `$expand` e a partir de qualquer entidade alvo, e corrige o vazamento pré-existente da 015 (`descricao`, `solicitante`, `responsavelPrincipal`, `participantes`, `Participantes.matricula`, `Acoes.responsavel`) antes de o 016 acrescentar campos (DC-17, R-10).

A mesma task aplica no App as regras de acesso e mascaramento que as specs aprovadas definem para Evidências, Comentários e Histórico (DC-18, R-11): `evidencias/spec.md` R11, `comentarios/spec.md` R3 e R7, `historico-e-auditoria/spec.md` R5. As regras valem em todo segmento do caminho OData (r4, M4-02), e a navegação `/Tratativas(<id>)/comentarios` entrega ao não-Gestor os comentários que a R7 a/b autoriza (r4, M4-03). Com isso, nenhum campo pessoal do App com `@PersonalData` fica sem regra; `Colaboradores` é a exceção declarada (design, "O desconfortável" 9 d).

A r5 (DC-19, R-14) fecha o contorno por predicado e por busca. Para o não-Gestor, `$filter` (inclusive as lambdas `any`/`all`), `$orderby`, `$apply`, `$compute` e as opções aninhadas no `$expand` não podem atravessar entidade restrita nem terminar em campo pessoal não filtrável. `$search` deixa de procurar nos campos pessoais (`@cds.search`).

## Arquivos

### Criados
- `srv/tratativa/mascara-app.ts`:
  - `REGRAS_MASCARA`;
  - `aplicarMascaras(entidade, resultado, contexto)`, síncrona e pura;
  - `restricaoDeLeitura(req)`, async;
  - `mascararTratativa`, `mascararParticipante`, `mascararAcao`, `mascararEvidencia`, `mascararComentario`, `mascararMencao`, `mascararHistorico`;
  - percurso por `elemento._target` em qualquer profundidade.
- `test/mascara-lgpd-app.test.ts`

### Modificados
- `srv/tratativa-app-service.ts`:
  - registra `this.before('READ', '*', async function restringirLeitura(req) {...})`, que chama `restricaoDeLeitura`. **Ordem (r6, I6-01, R-15):** é o **primeiro** `before('READ', …)` do `init`, logo depois do `before('*')` de `AplicativoOrigem` (`:88-90`, que não toca a query) e antes do `before('READ', 'Tratativas')` (`:93-100`), do `before('READ', 'MinhasAcoes')` (`:273-277`), do `before('READ', 'MinhasTratativas')` (`:279-290`) e da injeção de `campo` em `Historico` (abaixo). Qualquer `before('READ', …)` novo (inclusive o `garantirChaves` da 007) é registrado depois dele;
  - registra `this.after('READ', '*', async function mascararLeitura(resultado, req) {...})`;
  - remove o bloco de máscara do `after('READ', 'Tratativas')` (`:116-124`); as flags e `ocultaResponsaveis` ficam;
  - remove os `after('READ', 'Participantes')` e `after('READ', 'Acoes')` (`:164-175`).
- `srv/tratativa-app-service.cds` (r5, DC-19): `annotate` com `@cds.search: { <campo>: false, ... }` em `Tratativas` (`descricao`, `solicitante`, `responsavelPrincipal`), `Acoes` (`responsavel`), `Participantes` (`matricula`), `Evidencias` (`autorAnexo`, `autorRemocao`), `Historico` (`autor`, `justificativa`, `valorAnterior`, `valorNovo`) e no alvo auto-exposto de `Comentarios.mencoes` (`matricula`). Fonte: cds-mcp "Generic Service Providers > Searching Data > Excluding Fields" (`@cds.search: { isbn: false }` tira só o elemento e mantém a busca padrão nos demais `String`). `Comentarios` e `Colaboradores` não levam anotação. Nenhum `@cds.search` inclui associação. Nada mais muda nas projeções.
- `test/apoio/auth-dev.js`: personas `M1001` e `M2002` (`roles: []`) em `PERSONAS`, para a medição de rede da Object Page (r4, M4-01). `M1001` também serve à verificação visual da task 007.
- `app/tratativas/annotations.cds` **não** muda: a `@UI.Hidden: ocultaResponsaveis` que a r3 previa na `ComentariosFacet` saiu na r4 (M4-03), porque a navegação filtrada já devolve a cada um o que a R7 autoriza.

### Testes existentes
Varredura feita no worktree com:

```sh
grep -ln "api/app/v1" test/*.ts
grep -nE "/(Comentarios|Evidencias|Historico|MencoesComentario)\b|/(comentarios|evidencias|historico|mencoes|acao|tratativa)\b|expand=[a-z,]*(comentarios|evidencias|historico|mencoes)" test/*.ts
grep -n "expand" test/*.ts
grep -n "ComentariosFacet\|ocultaResponsaveis" test/*.ts
grep -rn "DEV_USER\|auth-dev\|PERSONAS" test/*.ts
```

Detalhes em "Testes existentes que mudam de contrato" do design. **Nenhum teste muda de contrato**, porque nenhum lê `Evidencias`, `Comentarios`, `mencoes` ou `Historico` do App como não-Gestor, por navegação ou por `$expand`, nenhum navega a partir dessas entidades (r4) e nenhum compara a lista exata de `PERSONAS`. Os testes abaixo tocam essas entidades e continuam como regressão, **sem edição**:

- `test/ui-tratativas.test.ts`:
  - `:231` e `:237`: `GET /api/app/v1/Evidencias(<id>)` como `gestor`, ativa e removida;
  - `:252` e `:262`: `GET /api/app/v1/Comentarios(<id>)` como `gestor`;
  - `:180-190` (CA10-CA12): texto de anotação (`Target: 'comentarios/@UI.LineItem'`, `annotate TratativaAppService.Comentarios`), que esta task não edita;
  - `:213`: Gestor, `$expand=acaoMae`;
  - `:290-335` (CA21): leitura direta e `$expand=participantes,acoes` como `usuario`, e `ocultaResponsaveis` da `ResponsaveisFacet` (`:333`, `:335`).
- `test/comentarios-tratativa.test.ts:124-127` (CA9): lê o `TratativaService` (`/api/tratativa/v1/Comentarios` → 403), que esta task não toca. É a referência do código 403 aplicado no App.
- `test/ui-acabamento.test.ts`, `test/ui-launchpad-governanca.test.ts` e `test/ui-minhas-pendencias.test.ts`: leem o App, mas nenhuma dessas entidades. `test/ui-acabamento.test.ts:359-405` (CA1) confere o middleware de dev com `gestor`, `admin`, `leitor-analitico` e persona inexistente → `gestor`; as personas novas não mudam isso.

**Varredura da r5 (DC-19):**

```sh
grep -nE '\$(filter|search|orderby|apply|compute)' test/ui-acabamento.test.ts test/ui-launchpad-governanca.test.ts test/ui-minhas-pendencias.test.ts test/ui-tratativas.test.ts
```

As únicas ocorrências estão em `test/ui-minhas-pendencias.test.ts`, todas como `M1001`, e continuam passando sem edição:
- CA13 (`:147-193`): `MinhasAcoes` com `$filter` por `codigoTratativa`/`statusAcao` e `$orderby=prazo desc`;
- CA15 (`:195-233`): `MinhasTratativas` com `$filter` por `codigoTratativa` e `$orderby=dataPrevistaConclusao`.

As duas entidades não têm regra, nenhuma associação a entidade restrita e nenhum elemento decidido nas refs. Nenhum teste usa `$search`, `$apply` ou `$compute` no App. **Nenhum teste muda de contrato com a DC-19.**

### Removidos
- Nenhum.

## Interfaces
- Produz:
  - `srv/tratativa/mascara-app.ts`:
    - `interface ContextoMascara { gestor: boolean }`. A task 007 a amplia com `vinculoDiagnostico: Set<string>`, `validadorHabilitado: Set<string>` e `situacaoAval: Map<string, SituacaoAval>`.
    - `REGRAS_MASCARA: Record<string, RegraMascara>`, indexado pelo nome da entidade do serviço. As chaves são `TratativaAppService.Tratativas`, `.Acoes`, `.Participantes`, `.Evidencias`, `.Comentarios`, `.Historico` e o alvo auto-exposto da composição `Comentarios.mencoes`. O dev lê do CSN o nome exato desse alvo e o teste o confere.
    - `RegraMascara`:

      ```ts
      {
        campos: string[];        // elementos pessoais decididos (r4, M4-04): todo elemento pessoal da entidade cuja decisão está na regra
        liberados?: string[];    // subconjunto de campos que fica com valor para quem passa a leitura (r4, M4-04)
        filtraveis?: string[];   // subconjunto de liberados aceito em predicado, ordenação, agrupamento, coluna calculada e busca (r5, DC-19); padrão = liberados
        leitura?: 'livre' | 'porVinculo' | 'soGestor';   // padrão 'livre'
        aninhada?: 'mascarar' | 'omitir';                // padrão 'mascarar'
        filtroVinculo?(req: cds.Request, matricula: string): Promise<unknown>;  // expressão CQN; obrigatório em 'porVinculo'
        navegacaoPorVinculo?: { origem: string; elemento: string };            // só Comentarios: Tratativas/comentarios (r4, M4-03)
        aplicar(linha, contexto, codigoTratativa?: string): void;
        codigoTratativa?(linha): string | undefined;
      }
      ```

      Os padrões deixam as regras da task 007 (`AvalesTecnicos`) sem campo novo. Os `campos` fora de `liberados` vêm `null` ao não-Gestor; os `liberados` são `Evidencias.nomeArquivo`/`descricao`, `Comentarios.texto`/`autor` e `Historico.valorAnterior`/`valorNovo` (estes só fora de `CAMPOS_MATRICULA`). `filtraveis` (r5, DC-19) fica no padrão (`= liberados`) em todas as regras, salvo em `Historico`, que declara `filtraveis: []`: `valorAnterior`/`valorNovo` só são liberados linha a linha, e filtrar por eles revelaria a matrícula pela presença da linha.
    - Não existe `FORA_DA_MASCARA` (R-11).
    - `aplicarMascaras(entidade: cds.entity, resultado: unknown, contexto: ContextoMascara): void`:
      - percorre linhas (objeto ou array) e aplica a regra da entidade;
      - desce por todo elemento de associação ou composição presente na linha, usando `elemento._target`;
      - um nó aninhado cujo alvo tem `aninhada: 'omitir'` vira `[]` (para-muitos) ou `null` (para-um), sem descer;
      - **fail-closed:** elemento com `@PersonalData.IsPotentiallyPersonal` de entidade sem regra fica `null` para não-Gestor.
    - `restricaoDeLeitura(req: cds.Request): Promise<void>`. Para o Gestor, sai. Para os demais, percorre **todos os segmentos** de `req.query.SELECT.from.ref` (r4, M4-02; cds-mcp "cds.Request > .query" e "> .path"). O primeiro segmento é a entidade do serviço; o seguinte é `elements[<id>]._target` do anterior; cada segmento é texto ou `{ id, where }`.
      - Segmento **antes do último**: `soGestor` → `req.reject(403, 'Acesso negado.')`; `porVinculo` (ou o segmento `comentarios` vindo de `Tratativas`, `navegacaoPorVinculo`) → `SELECT.one` da entidade com o `where` do segmento e `filtroVinculo`; sem linha → `req.reject(404)`; `livre` → nada.
      - **Último** segmento (`req.target`): `soGestor` → 403, salvo quando o segmento anterior é `Tratativas` e o elemento é `comentarios` (`navegacaoPorVinculo`), que recebe o filtro da `comentarios/spec.md` R7 a/b; `porVinculo` → acrescenta `filtroVinculo` à query (`req.query.where(...)`, padrão de `MinhasAcoes`, `srv/tratativa-app-service.ts:273-277`); `livre` → nada.

      - **Entidade sem regra (M5-02, r5):** na guarda de caminho, um segmento cuja entidade não está em `REGRAS_MASCARA` (por exemplo `MinhasAcoes`, `MinhasTratativas`, `Colaboradores`, `Valores*`) conta como `livre`: não recebe 403, 404 nem filtro. O fail-closed de `@PersonalData.IsPotentiallyPersonal` sem regra não fica na guarda de caminho. Ele fica no `after` (`aplicarMascaras`, que devolve `null` ao não-Gestor) e, na varredura da DC-19 abaixo, só como término de ref (critério b).
      - **Varredura de expressões (r5, DC-19, R-14). Alvo e ordem (r6, I6-01, R-15):** a varredura cobre **só a query do cliente**. Para o não-Gestor, ela é a primeira coisa que `restricaoDeLeitura` faz, de forma síncrona, antes de qualquer `await` e de qualquer injeção: antes da guarda de segmentos acima (que faz `SELECT.one`), antes do `filtroVinculo` do último segmento (a subconsulta `acao_codigo in (SELECT … )` de `Evidencias` e da navegação `/Tratativas(<id>)/comentarios`) e antes do `where` do Validador habilitado da task 007. Como os `before` rodam em paralelo (`node_modules/@sap/cds/lib/srv/srv-dispatch.js:46-47`) mas são chamados em ordem de registro, `restringirLeitura` registrada primeiro e sem `await` antes da varredura vê a query como o parser e os genéricos síncronos do CAP a deixaram (`handle_paging`/`handle_sorting`, `libx/_runtime/common/Service.js:77-80`), sem nada do `MinhasAcoes`, do `MinhasTratativas`, de `status`, de `campo` ou do `garantirChaves`. Escolha: varredura síncrona direta; a alternativa de varrer uma cópia de `req.query` tirada na entrada foi descartada (a cópia também teria de ser tirada no trecho síncrono do primeiro handler, custa um clone profundo por leitura e não remove a dependência de ordem; design, DC-19). Um nó `{ SELECT }` dentro de expressão é recusado com 403 (critério c): o parser OData não o produz. A varredura percorre:
        - o `where` de cada segmento de `from.ref`;
        - `where`, `having`, `groupBy` e `orderBy` da raiz;
        - toda coluna que não é ref simples nem `'*'` (colunas `xpr`/`func` de `$compute`/`$apply`);
        - em cada coluna `{ ref, expand }`, em qualquer profundidade, o `where`, `having`, `groupBy`, `orderBy` e as colunas calculadas do nível, com o alvo da expansão como base;
        - `from.SELECT`, quando o `$apply` embrulha a query, percorrida como query.

        Dentro de cada expressão, desce por `xpr`, `func.args`, `list` e pelos modificadores de todo segmento `{ id, where, ... }` de ref, com o alvo do segmento como base. A forma é a do `@sap/cds` 10.1.1: `nav/any(x:p)` → `['exists', { ref: [...nav, { id, where: p }] }]`, com as refs de `p` relativas ao alvo; `all` → `['not', 'exists', { ref: [..., { id, where: ['not', { xpr: p }] }] }]` (`node_modules/@sap/cds/libx/odata/parse/grammar.peggy:836-865`; cds-mcp "Expression Notation (CXN) > References" e "CXL > Infix Filters > Applied to exists Predicate").
        - Cada `{ ref }` é resolvido segmento a segmento a partir da base (`elements[<seg>]`, depois `._target` em associação ou composição), e a função chama `req.reject(403, 'Acesso negado.')` quando:
          - (a) um segmento é associação ou composição cujo `_target` tem regra `soGestor` ou `porVinculo`;
          - (b) o último segmento é elemento de `campos` fora de `filtraveis`, ou elemento com `@PersonalData.IsPotentiallyPersonal` de entidade sem regra;
          - (c) a ref não resolve, ou o nó tem forma desconhecida (fail-closed).
        - A base das refs da raiz é o último segmento de `from.ref` (`req.target`), que a guarda de segmentos filtra ou libera logo depois da varredura, no mesmo handler (r6: a ordem mudou, o critério não). Ele não conta como travessia, e as refs relativas a ele passam só por (b). Assim, `/Tratativas(<id>)/comentarios?$filter=contains(texto,'…')` passa (`texto` é filtrável).
        - **Formas aceitas pela varredura (r6, M6-02).** Lista fechada; qualquer outra forma cai no critério (c):
          - folha `{ val }` (literal);
          - operador ou palavra-chave em texto dentro de `xpr`/`where`/`having` (`'='`, `'and'`, `'or'`, `'not'`, `'in'`, `'like'`, `'is'`, `'null'`, `'exists'`, `'between'` etc.): todo item `string` do array;
          - `{ param: true, ... }` (marcador de parâmetro), aceito sem resolver a `ref`;
          - `{ ref }` resolvido pelos critérios (a)/(b); `{ xpr }`, `{ list }` e `{ func, args }` (o nome em `func` é texto, não ref), percorridos;
          - em item de `orderBy`, as chaves `sort` e `nulls` ao lado da `ref`;
          - o item de `orderBy` `{ ref: [<chave>], sort, implicit: true }` que o `handle_sorting` injeta pelas chaves antes dos `before` (`node_modules/@sap/cds/libx/_runtime/common/generic/sorting.js:39-46`; também em `from.SELECT` quando há `groupBy`): passa por (b), porque chave não é decidida;
          - a coluna `{ func: 'count', args: [{ val: 1 }], as: '$count' }` que o parser gera para `/$count` (`node_modules/@sap/cds/libx/odata/parse/grammar.peggy:583`);
          - nas colunas: `'*'`, `{ ref }` simples (com ou sem `as`), `{ ref, expand }` (o nível é percorrido) e colunas `{ xpr | func, as }` (percorridas).

          **Aliases do `$apply`** (por exemplo `aggregate(solicitante with max as s)` seguido de `filter(s eq …)`, ou `groupby(...)` com `having` sobre o alias) não resolvem no modelo e dão 403 ao não-Gestor pelo critério (c). É aceito: o List Report e a Object Page não usam `$apply` (design, DC-19, usos legítimos).
        - `SELECT.search` não é varrido. A busca não alcança os campos excluídos por `@cds.search` (ver "Modificados"). **Recuo da R-14:** se o RED de `$search` falhar com a anotação, recusar com 403 ao não-Gestor todo `SELECT.search` em entidade com regra; `Colaboradores` fica fora, porque o `on('READ')` dela consome `search` (`srv/tratativa-app-service.ts:135`).

      A matrícula vem de `normalizarMatricula(obterMatriculaUsuario(req))` (`srv/tratativa/identidade.ts`).
  - Regras para não-Gestor (DC-17 e DC-18). O Gestor não tem nada alterado.

    | Entidade | Leitura em qualquer segmento do caminho (coleção, chave, navegação) | `campos` mascarados (`null`) | `liberados` | Pelo `$expand` | Fonte |
    |---|---|---|---|---|---|
    | `Tratativas` | livre | `descricao`, `solicitante`, `responsavelPrincipal`; `participantes` vira `[]` quando vem no resultado | — | mascarar | 015, CA21 (`srv/tratativa-app-service.ts:116-124`) |
    | `Participantes` | livre | `matricula` | — | mascarar | 015 (`:165-169`) |
    | `Acoes` | livre | `responsavel` | — | mascarar | 015 (`:171-175`) |
    | `Evidencias` | `porVinculo`: `ativo = true` e `acao_codigo in (SELECT codigo FROM Acoes WHERE lower(trim(responsavel)) = <matrícula>)`. A task 007 acrescenta `or tratativa_codigo in <tratativasComValidadorHabilitado>` (r4, I4-01) | `autorAnexo`, `autorRemocao` | `nomeArquivo`, `descricao` | omitir (`[]`) | `evidencias/spec.md` R11 a, b, c; `srv/tratativa/evidencias-consultas.ts:149-176` |
    | `Comentarios` | `soGestor`: 403 `Acesso negado.` na coleção, na chave e em caminho que parte de `Comentarios`. **Navegação `/Tratativas(<id>)/comentarios`** (r4, M4-03): `(acao_codigo is null and tratativa_codigo in <Tratativas em que é Responsável Principal ou Participante; ['']  se vazia>) or acao_codigo in (SELECT codigo FROM Acoes WHERE lower(trim(responsavel)) = <matrícula>)` | `mencoes` vira `[]` | `texto`, `autor` (exceção LGPD da R7) | omitir (`[]`) | `comentarios/spec.md` R3, R7 a/b, R8, R13 etapa 6; `srv/tratativa/comentarios-consulta.ts:104-120`, `:165-170`; `srv/tratativa-service.cds:297-300` |
    | alvo de `Comentarios.mencoes` | `soGestor`: 403 `Acesso negado.` (só alcançável por navegação) | `matricula` | — | omitir (`[]`) | `comentarios/spec.md` R7 |
    | `Historico` | `porVinculo`: `tratativa_codigo in` (Tratativas com `lower(trim(responsavelPrincipal))` igual à matrícula, unidas às com Participante de `lower(trim(matricula))` igual; lista `['']` quando vazia, padrão de `MinhasTratativas`, `:279-289`) | `autor`, `justificativa`; `valorAnterior` e `valorNovo` quando `campo` sem caixa ∈ {`solicitante`, `responsavelprincipal`, `participante`, `responsavel`} **ou ausente da linha** (fail-closed) | `valorAnterior`, `valorNovo` nos demais `campo` | omitir (`[]`) | `historico-e-auditoria/spec.md` R5 b.1, b.4, b.5, c; `srv/tratativa/historico-autorizacao.ts:23`, `:72-84`, `:88-107` |

  - `before('READ', '*')`, somente em `Historico` e para não-Gestor: quando o nível pede `valorAnterior` ou `valorNovo` sem `campo` nem `*`, acrescenta `{ ref: ['campo'] }`. É o mesmo padrão da injeção de `status` (`srv/tratativa-app-service.ts:93-100`).
  - `after('READ', '*')`: parte de `req.target`, também na navegação (cds-mcp "cds.Request > .target"). Para o Gestor, sai sem percorrer.
  - Exceção declarada: `Colaboradores` (`srv/tratativa-app-service.cds:116-121`, sem `@PersonalData`, ajuda de valor) fica fora de `REGRAS_MASCARA` e da guarda (design, "O desconfortável" 9 d; r4, M4-04).
- Consome:
  - Nada do 016. Usa só o modelo e o serviço existentes da 015.
  - Usa `normalizarMatricula`/`obterMatriculaUsuario` (`srv/tratativa/identidade.ts`).
  - Não importa `historico-autorizacao.ts`: o conjunto de campos de matrícula é repetido como constante, e o revisor confere que ele é igual a `CAMPOS_MATRICULA`.

## N3 aprovados no Gate 1
- N3-4 (design): máscara genérica do App e correção do vazamento pré-existente da 015 (DC-17, R-10). Também as regras de acesso e máscara de Evidências, Comentários e Histórico no App, que mudam a autorização de leitura dessas entidades para o não-Gestor (DC-18, R-11).
- N3-4 (design), r5: varredura de predicados, ordenação, agrupamento, colunas calculadas e opções do `$expand` para não-Gestor, e `@cds.search` sem campos pessoais, que também estreita a busca livre do Gestor (DC-19, R-14).

## Critérios de pronto
- **RED** (`test(red): mascara lgpd generica do app`), em `test/mascara-lgpd-app.test.ts`. O teste usa HTTP com `cds.test` e as identidades `comoGestor`, `comoUsuario` (sem vínculo), `comoM1001`, `comoM2002` e `comoM9999`, todas de `test/apoio/usuarios`. O preparo é feito pelas operações (CONVENCOES item 5).
- **Preparo**, sempre como `gestor`:
  1. Tratativa avulsa com `descricao` e `solicitante` (padrão de `test/ui-tratativas.test.ts:318-325`).
  2. Responsável Principal `M9999` e Participante `M2002`.
  3. Ação A com responsável `M1001` e Subação S (`criarSubacao`) com responsável `M2002`.
  4. Na Tratativa: `comentarTratativa` com menção `M2002` (comentário Ct). Na Ação A: `comentarAcao` (Ca). Na Subação S: `comentarAcao` (Cs).
  5. Evidências: E1 ativa na Ação A; E2 anexada e removida na Ação A; E3 na Subação S.
  6. `mudarCriticidade`: evento de `campo` `criticidade`.
  7. Por último, `cancelarTratativa` com justificativa.

  O histórico fica com `Criacao`, a atribuição (`campo` `responsavelPrincipal`), a inclusão do Participante (`campo` `participante`), `AlteracaoCriticidade` e o cancelamento com justificativa. O teste confere no preparo, como `gestor`, os `campo` gravados.
- **DC-17: hoje vazam e passam a vir mascarados**, como `usuario`:
  - `GET /api/app/v1/Historico?$filter=tratativa_codigo eq <id>&$expand=tratativa($select=descricao,solicitante,responsavelPrincipal)`, feito como `M2002`, porque o `usuario` não tem vínculo e recebe `[]`: em toda linha, `tratativa.descricao`, `tratativa.solicitante` e `tratativa.responsavelPrincipal` vêm `null`.
  - `GET /api/app/v1/Acoes(<S>)?$expand=acaoMae`: `responsavel` e `acaoMae.responsavel` vêm `null`.
  - `GET /api/app/v1/Participantes?$filter=tratativa_codigo eq <id>&$expand=tratativa`: `matricula`, `tratativa.descricao`, `tratativa.solicitante` e `tratativa.responsavelPrincipal` vêm `null`.
  - Três níveis, como `M2002`: `GET /api/app/v1/Historico?$filter=tratativa_codigo eq <id>&$expand=tratativa($expand=acoes($expand=acaoMae),participantes)`. `acoes[].responsavel` e `acoes[].acaoMae.responsavel` vêm `null`, e `participantes` vem `[]`.
  - Leituras diretas sem mudança: `Tratativas(<id>)`, `Participantes` e `Acoes` como `usuario` continuam com os mesmos `null`.
  - Flags e máscara juntas, porque os `after` rodam em paralelo: `GET /api/app/v1/Tratativas(<id>)?$select=podeIniciar,ocultaIniciar,descricao`. Como `gestor`, os valores corretos das flags para o status e a descrição. Como `usuario`, `false`/`true` e `null`.
- **DC-18, `Comentarios` e `mencoes`:**
  - Como `usuario`, `M9999`, `M1001` e `M2002` (o vínculo não abre a coleção nem a chave): 403 em `GET /api/app/v1/Comentarios`, `GET /api/app/v1/Comentarios(<Ct>)`, `GET /api/app/v1/Comentarios(<Ct>)/mencoes` e `GET /api/app/v1/Comentarios(<Ct>)/tratativa` (r4, M4-02).
  - Navegação `GET /api/app/v1/Tratativas(<id>)/comentarios` (r4, M4-03), sempre 200:
    - como `usuario` (sem vínculo): `[]`, e `.../comentarios/$count` dá `0`;
    - como `M9999` (Responsável Principal): só Ct, com `texto` e `autor` preenchidos e `mencoes` `[]` em `.../comentarios?$expand=mencoes`;
    - como `M2002` (Participante, mencionado e Responsável da Subação S): Ct e Cs, com `texto` e `autor` preenchidos, `mencoes` `[]`, e `$count` `2`;
    - como `M1001` (só Responsável da Ação A): só Ca;
    - `GET /api/app/v1/Tratativas(<id>)/comentarios(<Ca>)` como `M2002` responde 404.
  - `GET /api/app/v1/Tratativas(<id>)?$expand=comentarios($expand=mencoes)` como `M2002`: `comentarios` vem `[]` (omitir no `$expand`).
  - Três níveis, como `usuario`: `GET /api/app/v1/Participantes?$filter=tratativa_codigo eq <id>&$expand=tratativa($expand=comentarios)`: `tratativa.comentarios` vem `[]`.
- **DC-18, `Evidencias`:**
  - Como `usuario`:
    - `GET /api/app/v1/Evidencias?$filter=tratativa_codigo eq <id>` e `GET /api/app/v1/Tratativas(<id>)/evidencias` vêm `[]`;
    - `GET /api/app/v1/Evidencias(<E1>)` e `GET /api/app/v1/Evidencias(<E3>)/acao` respondem 404 (r4, M4-02);
    - `GET /api/app/v1/Tratativas(<id>)?$expand=evidencias` traz `evidencias` `[]`.
  - Como `M1001`, Responsável da Ação A:
    - a coleção e a navegação trazem só E1;
    - `GET /api/app/v1/Evidencias/$count?$filter=tratativa_codigo eq <id>` dá `1`, o que prova que o filtro está na query;
    - em E1, `autorAnexo` e `autorRemocao` vêm `null`, e `nomeArquivo` e `descricao` vêm com valor;
    - E2 (removida) e E3 (da Subação de outro Responsável) não aparecem, e `GET /api/app/v1/Evidencias(<E3>)` responde 404;
    - `GET /api/app/v1/Evidencias(<E1>)/acao` responde 200 (vínculo no segmento intermediário) e `GET /api/app/v1/Evidencias(<E3>)/acao` responde 404 (r4, M4-02);
    - `GET /api/app/v1/Tratativas(<id>)?$expand=evidencias` traz `[]` (omitir no `$expand`, "O desconfortável" 9 a.1).
  - Como `M2002`, Responsável da Subação S: só E3.
- **DC-18, `Historico`:**
  - Como `usuario`:
    - `GET /api/app/v1/Historico?$filter=tratativa_codigo eq <id>` e `GET /api/app/v1/Tratativas(<id>)/historico` vêm `[]` com 200;
    - `GET /api/app/v1/Historico(<ID>)` e `GET /api/app/v1/Historico(<ID>)/tratativa` respondem 404 (r4, M4-02);
    - `GET /api/app/v1/Tratativas(<id>)?$expand=historico` traz `historico` `[]`.
  - Como `M1001`, que só é Responsável de Ação: a coleção vem `[]`, porque o App não expõe os eventos de Ação.
  - Como `M2002`, Participante:
    - a coleção traz os eventos da Tratativa;
    - em toda linha, `autor` e `justificativa` vêm `null`;
    - nas linhas de `campo` `responsavelPrincipal` e `participante`, `valorAnterior` e `valorNovo` vêm `null`;
    - na linha de `campo` `criticidade`, `valorNovo` vem com valor;
    - `GET /api/app/v1/Historico?$filter=tratativa_codigo eq <id>&$select=valorNovo` traz o valor de `criticidade` e `null` no de `participante`, o que prova a injeção de `campo`;
    - `GET /api/app/v1/Tratativas(<id>)?$expand=historico` traz `[]`;
    - `GET /api/app/v1/Historico(<ID>)/tratativa` responde 200 com `descricao`, `solicitante` e `responsavelPrincipal` `null`.
- **Regressão como `gestor`.** As mesmas leituras de Comentários, Evidências e Histórico respondem 200 com os valores reais:
  - `texto` e `autor` dos Comentários, e `mencoes` com `M2002`;
  - E1, E2 e E3, com `autorAnexo` e `autorRemocao` preenchidos;
  - o Histórico com `autor`, `justificativa` e `valorNovo` `M9999`/`M2002`;
  - pelo `$expand`, as listas cheias;
  - `GET /api/app/v1/Comentarios(<Ct>)/tratativa`, `GET /api/app/v1/Evidencias(<E3>)/acao` e `GET /api/app/v1/Historico(<ID>)/tratativa` respondem 200.
- **DC-19, predicados e busca (r5, R-14).** Como `usuario`, 403 `Acesso negado.` em:
  - `GET /api/app/v1/Tratativas?$filter=comentarios/any(c:contains(c/texto,'<trecho de Ct>'))` e `...comentarios/any(c:c/autor eq 'gestor')`;
  - `GET /api/app/v1/Tratativas?$filter=historico/any(h:contains(h/justificativa,'<trecho>'))`;
  - `GET /api/app/v1/Tratativas?$filter=evidencias/any(e:e/autorAnexo eq 'gestor')`;
  - `GET /api/app/v1/Tratativas?$filter=evidencias/all(e:e/ativo eq true)` (prova o ramo `all`);
  - `GET /api/app/v1/Tratativas?$filter=solicitante eq '<solicitante do preparo>'` e `...$filter=contains(descricao,'<trecho>')`;
  - `GET /api/app/v1/Tratativas?$orderby=responsavelPrincipal`;
  - `GET /api/app/v1/Tratativas?$filter=acoes/any(a:a/responsavel eq 'M1001')`;
  - `GET /api/app/v1/Acoes?$filter=responsavel eq 'M1001'` e `GET /api/app/v1/Acoes?$filter=tratativa/solicitante eq '<solicitante>'`;
  - `GET /api/app/v1/Participantes?$filter=matricula eq 'M2002'`;
  - `GET /api/app/v1/Tratativas(<id>)?$expand=acoes($filter=responsavel eq 'M1001')` (opção aninhada);
  - `GET /api/app/v1/Tratativas?$apply=groupby((solicitante))` (agrupamento) e `GET /api/app/v1/Tratativas?$apply=aggregate(solicitante with max as s)` (coluna calculada). `$compute=solicitante as s&$select=s` também é exercitado: espera 403, ou o erro 4xx/501 do próprio parser se o Node não aceitar a forma (cds-mcp "Serving OData APIs > Feature Overview": `$compute` só em subconjunto no Node.js); em nenhum caso a resposta traz o valor.

  A mesma coisa vale como `M1001` e `M2002`, que têm vínculo, para `historico/any(...)` e `evidencias/any(...)`.
- **DC-19, busca.** Como `usuario`, `GET /api/app/v1/Tratativas?$search=<token>` responde 200 e não traz a Tratativa do preparo:
  - com o token da matrícula do Solicitante, do Responsável Principal (`M9999`) ou de um trecho único da `descricao`;
  - também para `Acoes` (`$search=M1001`), `Participantes` (`$search=M2002`) e `Historico` (como `M2002`, `$search=M9999`).

  O controle positivo é `$search=<trecho do titulo>`, que traz a Tratativa. Como `gestor`, `$search=<trecho do titulo>` também traz a Tratativa. A busca do Gestor por `descricao`/`solicitante`/`responsavelPrincipal` fica mais estreita por decisão (design, "O desconfortável" 9 f) e não é asserida como regressão.
- **DC-19, o que continua 200:**
  - **Varredura não vê injeção do servidor (r6, I6-01):** `M1001` em `GET /api/app/v1/Evidencias?$filter=tratativa_codigo eq <id>` responde 200 com E1 (o `filtroVinculo` com subconsulta sobre `Acoes.responsavel` é injetado depois da varredura); `M2002` em `GET /api/app/v1/Tratativas(<id>)/comentarios` responde 200 com Ct e Cs (filtro da R7 a/b injetado depois da varredura); CA13 e CA15 de `test/ui-minhas-pendencias.test.ts` (`MinhasAcoes`, cuja subconsulta `codigoAcao in {SELECT …}` vem de outro `before`, e `MinhasTratativas`) passam **sem edição**;
  - `M2002` em `GET /api/app/v1/Tratativas(<id>)/comentarios?$filter=contains(texto,'<trecho de Ct>')` traz Ct;
  - `M2002` em `.../comentarios?$filter=autor eq 'gestor'&$orderby=criadoEm` (campos filtráveis da navegação liberada) também responde 200;
  - `M2002` em `.../comentarios?$filter=mencoes/any(m:m/matricula eq 'M2002')` responde 403 (`mencoes` é `soGestor`);
  - `M1001` em `GET /api/app/v1/Evidencias?$filter=tratativa_codigo eq <id> and contains(nomeArquivo,'<nome de E1>')` traz E1;
  - `M2002` em `GET /api/app/v1/Historico?$filter=tratativa_codigo eq <id> and campo eq 'criticidade'` traz o evento de criticidade, e `...$filter=valorNovo eq 'M2002'` responde 403 (`filtraveis: []`);
  - como `usuario`, `GET /api/app/v1/Tratativas?$filter=status eq 'Cancelada' and criticidade eq '<do preparo>'&$orderby=titulo` (SelectionFields) responde 200;
  - `GET /api/app/v1/Colaboradores?$search=<termo>` responde 200 (`srv/tratativa-app-service.ts:133-135`; o `IntegracaoPessoasService` mockado já é usado por `test/ui-acabamento.test.ts:204`).
- **DC-19, Gestor inalterado:** todos os `$filter`, `$orderby`, `$apply` e `$compute` acima respondem 200 como `gestor`, com as linhas esperadas (por exemplo, `solicitante eq '<solicitante>'` traz a Tratativa e `comentarios/any(c:c/autor eq 'gestor')` também).
- **Guarda CSN** (r4, M4-04). Em `cds.load(['srv','app'])`, todo elemento com `@PersonalData.IsPotentiallyPersonal`, mais `Tratativas.descricao`, de toda entidade de `TratativaAppService` está na lista constante `DECIDIDOS` do teste (elementos pessoais decididos, espelho de `campos`). Isso vale também para a entidade auto-exposta de `mencoes`, localizada pela origem `br.com.calazanstec.MencoesComentario`.
  - A lista constante `LIBERADOS` (espelho de `liberados`: `Evidencias.nomeArquivo`, `Evidencias.descricao`, `Comentarios.texto`, `Comentarios.autor`, `Historico.valorAnterior`, `Historico.valorNovo`) está contida em `DECIDIDOS`. Os itens de HTTP acima provam que os liberados vêm com valor a quem passa a leitura e os demais de `DECIDIDOS` vêm `null`.
  - As duas listas ficam no teste, porque os testes não importam `srv/` (`test/CONVENCOES.md:3`). O diff mostra que espelham `REGRAS_MASCARA`.
  - Nenhum elemento pessoal fica fora de `DECIDIDOS`. Um campo pessoal novo sem regra quebra o teste.
  - `Colaboradores` não tem `@PersonalData` e fica fora da guarda: exceção declarada (design, "O desconfortável" 9 d).
  - **r5 (DC-19):** a lista constante `FILTRAVEIS` (espelho de `filtraveis`: `Evidencias.nomeArquivo`, `Evidencias.descricao`, `Comentarios.texto`, `Comentarios.autor`) está contida em `LIBERADOS`. Todo elemento de `DECIDIDOS` fora de `FILTRAVEIS` com tipo `cds.String` ou `cds.LargeString` tem `@cds.search.<elemento>` igual a `false` na entidade do App (anotação achatada no CSN). Nenhuma chave `@cds.search.<x>` com valor verdadeiro aponta associação.
- **Personas de dev.** O mesmo arquivo de teste confere que `test/apoio/auth-dev.js` com `DEV_USER=M1001` injeta o usuário `M1001` sem papéis, e o mesmo para `M2002` (padrão de `test/ui-acabamento.test.ts:359-405`).
- **GREEN** (`feat(green): mascara lgpd generica do app`) em `srv/tratativa/mascara-app.ts`, `srv/tratativa-app-service.ts` e `test/apoio/auth-dev.js`. `npm run build` limpo, com o log no relatório.
- **Verificação visual e medição de rede** (r4, M4-01, obrigatória): `cds watch` na raiz, app Tratativas no portal do Maestri, uma Tratativa com Ação de `M1001`, Subação de `M2002`, `M2002` como Participante, Evidências, Comentários e Histórico (o preparo do RED serve de roteiro). Abrir a Object Page com `DEV_USER=M1001` e depois com `DEV_USER=M2002` e registrar no relatório, do log do `cds watch` (requisições internas do `$batch`) ou do painel de rede do portal, as requisições das seções Evidências, Comentários e Histórico. Esperado: requisições de navegação próprias (`Tratativas(<id>)/evidencias`, `/comentarios`, `/historico`); `M1001` vê as Evidências e o Comentário da sua Ação; `M2002` vê as da Subação, o comentário direto, o da Subação e o Histórico; nenhuma mensagem de erro na tela no carregamento. **Recusa esperada (r6, M6-01):** ainda como `M1001`, ordenar o Plano de Ação pela coluna Responsável (`Acoes.responsavel`) ou a tabela de Evidências por `autorAnexo`, e, no List Report, filtrar por `solicitante` em "Adaptar filtros": a tela mostra "Acesso negado." (design, "O desconfortável" 9 g); como `gestor`, as mesmas ações funcionam. Não há `@Capabilities.SortRestrictions`/`FilterRestrictions` (afetariam o Gestor). Registrar no relatório. **Se alguma seção vier pelo `$expand` do pai**, aplicar o recuo declarado na DC-18: filtro de vínculo também no `$expand`, no `after`, com as colunas de vínculo injetadas no nível expandido (mecanismo da DC-17), em vez de `[]`; os itens de `$expand` deste RED passam a esperar as linhas com vínculo, no mesmo commit, e o relatório registra o recuo.
- Os testes listados em "Testes existentes" passam sem edição.
- `sh agentic/mecanismos/scripts/verify.sh` verde.
- Itens obrigatórios da revisão de diff:
  - o ramo fail-closed "campo pessoal sem regra → `null`" em `aplicarMascaras`;
  - o ramo "`campo` ausente → `valorAnterior`/`valorNovo` `null`";
  - o conjunto de campos de matrícula igual ao `CAMPOS_MATRICULA` de `historico-autorizacao.ts:23`;
  - o filtro de Comentários igual à autorização de `listarComentariosTratativa`/`listarComentariosAcao` (`srv/tratativa/comentarios-consulta.ts:104-120`, `:165-170`);
  - a medição de rede da Object Page registrada no relatório (r4, M4-01) e, se houve, o recuo aplicado;
  - (r5, DC-19) a varredura cobre `where`/`having`/`groupBy`/`orderBy`, colunas calculadas, cada nível `{ ref, expand }`, `from.SELECT`, o `where` dos segmentos de `from.ref` e dos segmentos de refs, e recusa forma desconhecida (o ramo (c) não tem RED HTTP direto);
  - `FILTRAVEIS` e as exclusões de `@cds.search` espelham `filtraveis`;
  - (r6, I6-01) ordem de registro: `restringirLeitura` é o primeiro `before('READ', …)` do `init` (só o `before('*')` de `AplicativoOrigem` vem antes), e a varredura roda no início de `restricaoDeLeitura`, síncrona, antes de qualquer `await` e de qualquer injeção (`filtroVinculo`, `SELECT.one` dos segmentos, `campo` de `Historico`); `{ SELECT }` em expressão é recusado; as formas aceitas são exatamente as da lista "Formas aceitas pela varredura";
  - na medição de rede da Object Page como `M1001`/`M2002`, nenhuma requisição das seções responde 403 por causa da varredura (por exemplo, por um `$orderby` padrão sobre campo decidido).

  Nenhuma requisição OData chega aos dois primeiros ramos com a injeção e a guarda ativas.

## Questões em aberto
- Nenhuma. A R-15 decidiu o alvo e a ordem da varredura (só a query do cliente, primeiro `before('READ', …)`, síncrona) e a declaração do "Acesso negado." na tela sem `@Capabilities`. A R-14 decidiu a varredura de predicados e a busca com `@cds.search` (DC-19), com recuo declarado para `$search`. A R-11 decidiu os campos que antes estavam fora da máscara; a R-13 decidiu a navegação de Comentários (adotada, sem `@UI.Hidden`), os segmentos do caminho, `DECIDIDOS`/`LIBERADOS` e a exceção de `Colaboradores`. A forma das seções da Object Page é medida na verificação visual, com recuo declarado.
