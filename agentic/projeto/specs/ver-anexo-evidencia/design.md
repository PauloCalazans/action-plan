# Design: ver-anexo-evidencia

**Spec:** agentic/projeto/specs/ver-anexo-evidencia/spec.md  
**Status:** aprovado  

Escopo técnico: na tabela de Evidências da Object Page de Tratativas (`app/tratativas`), o nome do arquivo de cada Evidência listada passa a ser um link clicável que abre o anexo no navegador quando o tipo é exibível (imagem JPG/PNG, PDF, texto TXT) ou dispara o download com o nome original nos demais tipos (DOCX, DOC, XLSX, XLS, CSV). A entrega segue o padrão declarativo do SAP Fiori Elements v4 e SAP CAP, projetando na entidade `TratativaAppService.Evidencias` (`/api/app/v1`) uma propriedade de mídia (stream) virtual `conteudo : LargeBinary` anotada com `@Core.MediaType: mimeType` e `@Core.ContentDisposition.Filename: nomeArquivo`. O acesso ao binário é servido por handler `on('READ', 'Evidencias')` que aceita os dois caminhos de invocação da UI (direto e por contenção), reaproveita o núcleo de autorização dinâmica e gravação prévia mandatória de auditoria (`DownloadEvidencia`) sem duplicar regras de negócio, e define os cabeçalhos HTTP `Content-Type` e `Content-Disposition` (inline vs attachment) dinamicamente por resposta. O `TratativaService` (`/api/tratativa/v1`), o download existente `baixarEvidencia`, as regras de mascaramento LGPD de `srv/tratativa/mascara-app.ts` e as operações de Anexar e Remover permanecem rigorosamente inalterados.

**Fontes de framework e runtime (só leitura):**
- **SAP CAP 10.1.1** (`node_modules/@sap/cds`):
  - `node_modules/@sap/cds/libx/odata/middleware/stream.js` (:43–73, `_addStreamMetadata`; :113–165, detecção de stream, resolução de metadados, despacho ao serviço e `pipeline(stream, res)`);
  - `node_modules/@sap/cds/libx/common/utils/streaming.js` (:37–64, `collectStreamMetadata`; :66–72, `getReadable` que aceita instâncias de `stream.Readable`);
  - `node_modules/@sap/cds/libx/odata/utils/index.js` (:270–278, `isStream` via `_propertyAccess` com `cds.LargeBinary` e `@Core.MediaType`);
  - `node_modules/@sap/cds/libx/_runtime/common/utils/streamProp.js` (:20–47, `_addColumn`; :62–64, remoção da coluna binária de consultas SELECT comuns com `columns.splice(index, 1)` e verificação de `!element.virtual`);
  - `node_modules/@sap/cds/libx/odata/utils/result.js` (:19, `$mediaContentType: '@odata.mediaContentType'`; :76–84, preservação de metadados OData);
  - `node_modules/@sap/cds/libx/common/utils/path.js` (:6–47, `getKeysAndParamsFromPath` que alinha `req.params` aos segmentos de `from.ref`).
- **SAPUI5 / Fiori elements 1.136.24** (`~/.ui5/framework/packages/@sapui5/`):
  - `~/.ui5/framework/packages/@sapui5/sap.fe.macros/1.136.24/src/sap/fe/macros/internal/field/DisplayStyle.tsx` (:383–452, `getFileTemplate` renderizando `<Link text={fileLinkText} target="_blank" href={fileLinkHref} visible={fileStreamNotEmpty} wrapping="true" />`);
  - `~/.ui5/framework/packages/@sapui5/sap.fe.macros/1.136.24/src/sap/fe/macros/field/FieldHelper.ts` (:1084–1091, `getPathForIconSource` via `@odata.mediaContentType`; :1092–1103, `getFilenameExpr` resolvendo `nomeArquivo`; :1108–1110, `getDownloadUrl` ligando à propriedade `conteudo`);
  - `~/.ui5/framework/packages/@sapui5/sap.fe.core/1.136.24/src/sap/fe/core/converters/controls/Common/table/Columns.ts` (:1481, `collectRelatedPropertiesRecursively` coletando automaticamente as propriedades de `@Core.MediaType` e `@Core.ContentDisposition.Filename` no `$select`).

---

## Decisões

### 1. Oferta do arquivo no padrão Fiori elements v4 via propriedade de mídia virtual (R1, R2, R5, R7)
Na projeção `TratativaAppService.Evidencias` (`srv/tratativa-app-service.cds`), adiciona-se o elemento virtual de mídia:
```cds
virtual null as conteudo : LargeBinary
  @Core.MediaType: mimeType
  @Core.ContentDisposition.Filename: nomeArquivo,
```
E em `app/tratativas/annotations.cds`:
- Na anotação `UI.LineItem` de `TratativaAppService.Evidencias` (:207–217), a coluna `{ $Type: 'UI.DataField', Value: nomeArquivo }` é substituída por `{ $Type: 'UI.DataField', Value: conteudo }`.
- No bloco de títulos (`annotate TratativaAppService.Evidencias with { ... }`), adiciona-se `conteudo @title: 'Nome do arquivo';`.

**Por quê:**
- **Padrão Fiori elements v4 (`DisplayStyle.tsx:447–452`):** ao encontrar um `UI.DataField` apontando para propriedade `LargeBinary` anotada com `@Core.MediaType` e `@Core.ContentDisposition.Filename`, o compilador de templates do Fiori elements renderiza no modo de exibição um controle composto com `<Icon src={fileIconSrc} />` e `<Link text={fileLinkText} target="_blank" href={fileLinkHref} visible={fileStreamNotEmpty} wrapping="true" />`.
- **Rótulo e texto do link (`FieldHelper.ts:1092–1103`):** `fileLinkText` resolve a expressão `{= ${nomeArquivo} ? ${nomeArquivo} : ...}`. O texto do link exibido na célula é exatamente o valor gravado na coluna `nomeArquivo`. O cabeçalho da coluna recebe "Nome do arquivo" através de `@title`.
- **URL de mídia (`FieldHelper.ts:1108–1110`):** `fileLinkHref` liga-se ao caminho da propriedade (`conteudo`) relativo à linha.
- **Visibilidade condicionada (`DisplayStyle.tsx:386–388`):** `fileStreamNotEmpty` avalia `not(equal(pathInModel('conteudo@odata.mediaContentType'), null))`. Para assegurar que o link apareça em todas as linhas ativas retornadas pelo serviço (R5), o handler `after('READ', 'Evidencias')` atribui `linha['conteudo@odata.mediaContentType'] = linha.mimeType`. Como toda Evidência ativa cadastrada possui `mimeType` não nulo, a condição é verdadeira e o link aparece em 100% das linhas visíveis.
- **Proteção de performance e LGPD (R7):** o elemento é declarado como `virtual null`. No CAP, `node_modules/@sap/cds/libx/_runtime/common/utils/streamProp.js:62–64` remove propriedades do tipo `cds.LargeBinary` das colunas do SELECT em leituras comuns (`columns.splice(index, 1)`). O binário nunca trafega em consultas de listagem nem em `$expand`. Além disso, a condição `!element.virtual` em `streamProp.js:63` impede que o CAP injete SQL de leitura no banco relacional, evitando falhas de coluna inexistente no banco.

**Verificado por:** CA1 (visual, nome do arquivo como link na tabela) e teste de contrato CSN/EDMX.

### 2. Handler de leitura de stream e diferenciação inline vs attachment (R2)
O acesso ao arquivo binário pela URL da propriedade de mídia (`.../conteudo`) é atendido por um handler `on('READ', 'Evidencias')` registrado em `TratativaAppService` (`srv/tratativa-app-service.ts`):
```typescript
this.on('READ', 'Evidencias', async (req, next) => {
  const query = req.query as { _propertyAccess?: string };
  if (query?._propertyAccess === 'conteudo') {
    return servirAnexoEvidencia(req);
  }
  return next();
});
```

**Mecanismo de streaming e cabeçalhos no CAP 10:**
- **Detecção de stream (`stream.js:113` e `odata/utils/index.js:270–278`):** quando a requisição OData termina na propriedade `conteudo` (ex.: `GET Evidencias(id)/conteudo`), o parser do CAP identifica `query._propertyAccess = 'conteudo'`. Como `target.elements.conteudo` é do tipo `cds.LargeBinary` anotado com `@Core.MediaType`, `isStream(query)` é verdadeiro e o middleware de streaming (`node_modules/@sap/cds/libx/odata/middleware/stream.js`) assume o despacho.
- **Entrega de stream (`stream.js:156` e `streaming.js:68`):** o handler do serviço obtém o `Buffer` do armazenamento através da função compartilhada e chama `req.reply(Readable.from(buffer))`. Em `stream.js:156`, `getReadable(result)` reconhece a instância de `stream.Readable` e conecta a saída à resposta HTTP via `pipeline(stream, res)`.
- **Definição de `Content-Type` e `Content-Disposition` (`stream.js:160–162`):** o middleware `stream.js` só aplica fallbacks se os cabeçalhos não tiverem sido previamente atribuídos:
  ```javascript
  if (!res.get('content-type')) res.set('content-type', mimetype)
  if (filename && !res.get('content-disposition'))
    res.set('content-disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`)
  ```
  Assim, `servirAnexoEvidencia` atribui os cabeçalhos diretamente no objeto Express `res` (`req._?.res`):
  - `res.set('content-type', mimeType);`
  - `res.set('content-disposition', `${disposition}; filename="${encodeURIComponent(nomeArquivo)}"`);`
- **Regra de exibição inline vs download attachment (R2):**
  - Conjunto de MIME types exibíveis no navegador: `image/jpeg`, `image/pjpeg`, `image/png`, `application/pdf`, `text/plain`.
  - Se `TIPOS_EXIBIVEIS.has(mimeType.toLowerCase())`, `disposition = 'inline'`. O navegador abre o arquivo diretamente na nova aba aberta pelo link do Fiori elements (`target="_blank"`).
  - Para qualquer outro formato aceito (DOCX, DOC, XLSX, XLS, CSV) ou desconhecido, `disposition = 'attachment'`. O navegador dispara o download com o nome original gravado na Evidência. Na dúvida, o comportamento conservador adotado é baixar (R2).

**Verificado por:** CA2 (PNG inline), CA3 (PDF inline), CA4 (TXT inline), CA5 (CSV attachment).

### 3. Núcleo compartilhado de autorização, storage e auditoria sem duplicação de regras (R4, R6, R10)
Em `srv/tratativa/evidencias-consultas.ts`, a lógica de negócio central de download é extraída para a função compartilhada:
```typescript
export async function processarDownloadEvidencia(
  req: cds.Request,
  dados: {
    codigoTratativa: string;
    codigoAcao: string;
    codigoEvidencia: string;
    responsavelAcao: string;
    mimeType: string;
    tamanho: number;
  },
  mensagemRecusa403: string = 'Forbidden',
): Promise<Buffer>
```

**Fluxo centralizado:**
1. **Autorização dinâmica (R4):**
   - Verifica se o solicitante é Gestor de Tratativa (`req.user.is('GestorTratativa')`);
   - Verifica se é o Responsável da Ação da Evidência (`usuarioAutenticadoEhMatricula(req, dados.responsavelAcao)`);
   - Verifica se é Validador Técnico com parecer pendente na Tratativa (`await usuarioEhValidadorHabilitado(req, dados.codigoTratativa)`).
   - Se nenhuma das condições for atendida, rejeita com `recusar(403, mensagemRecusa403)`.
2. **Obtenção do arquivo do storage:**
   - Consulta o serviço de armazenamento configurado (`await getStorage()`) por `obter(dados.codigoEvidencia)`.
   - Se o arquivo não existir no storage, lança exceção com status 500 (`Arquivo não encontrado no repositório de armazenamento.`).
3. **Auditoria antes da entrega (R6):**
   - Registra o evento `DownloadEvidencia` no histórico da Ação antes de devolver o binário:
     ```typescript
     await registrarHistorico(
       dados.codigoTratativa,
       { id: obterMatriculaUsuario(req), tipo: 'Usuario' },
       [{
         evento: 'DownloadEvidencia',
         evidencia: dados.codigoEvidencia,
         mimeType: dados.mimeType,
         tamanho: dados.tamanho,
       }],
       new Date(),
       dados.codigoAcao,
     );
     ```
   - O histórico preserva o padrão de evidencias R12: não grava Nome do arquivo nem conteúdo (minimização LGPD).
   - Atomicidade transacional: se `registrarHistorico` falhar (ex.: erro no banco ou falha simulada), a transação é abortada e nenhum byte do arquivo é entregue ao solicitante (CA11).

**Reaproveitamento no `TratativaService` (R10):**
- A função existente `baixarEvidencia(req, codigoTratativa, codigoAcao, codigoEvidencia)` em `srv/tratativa/evidencias-consultas.ts:257` mantém integralmente sua assinatura, validações de código por parâmetro (400 'Código inválido.'), checagens de existência (404), e passa a invocar `processarDownloadEvidencia(req, dados, 'Forbidden')`, codificando o buffer retornado em Base64 (`conteudoBuffer.toString('base64')`).
- Nenhum comportamento externo do `/api/tratativa/v1/baixarEvidencia` muda, garantindo compatibilidade estrita com a suíte da spec 006 (R10, CA16).

**Reaproveitamento no App (`TratativaAppService`):**
- O handler do stream invoca `processarDownloadEvidencia(req, dados, 'Acesso negado.')`, garantindo que o novo caminho responda em Português do Brasil com o padrão D10 (R8), utilizando o mesmo motor de autorização, storage e auditoria.

**Verificado por:** CA6 (matriz de autorização), CA7 (recusa 403), CA10 (auditoria prévia), CA11 (aborto se auditoria falhar) e CA16 (suíte 006 intacta).

### 4. Resolução da linha nos dois caminhos da UI e ordem de precedência das recusas (R3, R4, R8)
A função `servirAnexoEvidencia(req: cds.Request)` em `srv/tratativa/operacoes-linha-app.ts` gerencia os dois caminhos suportados pela UI:
- **Caminho direto:** `GET /api/app/v1/Evidencias(e)/conteudo` (`req.params = [{ codigo: e }]`).
- **Caminho por contenção:** `GET /api/app/v1/Tratativas(t)/evidencias(e)/conteudo` (`req.params = [{ codigo: t }, { codigo: e }]`). É o caminho padrão que o Fiori Elements monta a partir do contexto da linha na tabela da Object Page.

**Resolução via `localizarEvidenciaDaLinha`:**
- A inspeção do caminho utiliza `req.query.SELECT.from.ref` via `resolverCaminho` (mesmo padrão adotado na spec 017):
  - Segmento 1 único: `TratativaAppService.Evidencias`;
  - Segmentos duplos: `TratativaAppService.Tratativas` seguido de `evidencias`.
  - Qualquer outro caminho (ex.: navegações adicionais ou entidades alheias) responde fail-closed com 404 `'Evidência não encontrada.'`.
- A chave da Evidência é extraída do último segmento e validada com `codigoValido` (`srv/tratativa/consulta.ts:13`). Chave malformada (não UUID) responde 404 `'Evidência não encontrada.'`.
- No caminho por contenção, a chave `t` do primeiro segmento é validada e comparada com `evidencia.tratativa_codigo`. Se divergirem ou `t` for inválida, responde 404 `'Evidência não encontrada.'`.
- `localizarEvidenciaDaLinha` projeta `codigo`, `acao_codigo`, `tratativa_codigo`, `ativo`, `nomeArquivo`, `mimeType` e `tamanho`.

**Ordem estrita de precedência das recusas (R3, R4, R8, D10):**
1. **Autenticação:** usuário não autenticado recebe 401 do runtime (CA8).
2. **Aplicativo de Origem:** `req.user.is('AplicativoOrigem')` é barrado com 403 `'Acesso negado.'` pelo `before('*')` global do serviço (:173).
3. **Existência física e lógica (R3, CA9):** Evidência inexistente ou inativa (`ativo === false`, remoção lógica) responde 404 `'Evidência não encontrada.'` **antes** de qualquer checagem de autorização dinâmica (CA9). Usuário sem vínculo acessando Evidência inativa recebe 404 e não 403.
4. **Existência da Ação:** Ação da Evidência não localizada responde 404 `'Ação não encontrada.'`.
5. **Autorização dinâmica (R4, CA7, CA14):** usuário autenticado sem papel de Gestor, sem responsabilidade sobre a Ação e sem habilitação de Validador Técnico recebe 403 com a mensagem `'Acesso negado.'`.
6. **Segregação de Subações (CA6):** o Responsável pela Ação mãe tentando acessar anexo de Subação (ou vice-versa) recebe 403 `'Acesso negado.'` pois `ehResponsavel` avalia a titularidade estrita daquela Ação específica.
7. **Auditoria mandatória (R6, CA10, CA11):** gravação de `DownloadEvidencia`. Falha na gravação impede devolução do arquivo.
8. **Status da Tratativa e da Ação (R9, CA15):** o download é expressamente permitido em qualquer status (inclusive Tratativa `Encerrada`/`Cancelada` e Ação `Concluída`/`Cancelada`), mantendo coerência com `evidencias` R14 etapas 7 e 8.

**Verificado por:** CA6, CA7, CA8, CA9, CA13, CA14 e CA15 (automatizados).

### 5. Proteção de listagens e isolamento LGPD da máscara (R5, R7)
- **Minimização LGPD (R7):** arquivos anexados contêm dados pessoais sensíveis (fotos, atestados, relatórios). O binário do anexo nunca trafega em requisições de listagem, tabelas, consultas paginadas ou `$expand`. Isso é assegurado no nível de modelo pelo elemento virtual (`virtual null as conteudo`) e pelo mecanismo do CAP (`streamProp.js:64`), que suprime a propriedade binária das consultas de seleção do banco de dados.
- **Isolamento da máscara `srv/tratativa/mascara-app.ts`:** nenhuma linha de `mascara-app.ts` é modificada. A regra `porVinculo` de `Evidencias` continua assegurando que não-Gestores recebam apenas as linhas de Evidências das Ações sob sua responsabilidade (`filtroVinculo: acao_codigo in acoes`).
- **Presença do link em 100% das linhas visíveis (R5, CA13):** como a máscara já garante que qualquer usuário visualizando uma linha de Evidência na tabela possui legitimidade para acessar seu anexo, o link é oferecido em todas as linhas retornadas, sem necessidade de lógica seletiva visual. Tentativas de acesso direto fora da lista são barradas no servidor com 403 `'Acesso negado.'`.
- **Mascaramento de autoria preservado:** `autorAnexo` continua mascarado como `null` para não-Gestores.

**Verificado por:** CA12, CA13 e suíte de regressão `test/mascara-lgpd-app.test.ts`.

### 6. Preservação integral do `TratativaService` e da suíte da spec 006 (R10)
- Nenhuma alteração de interface ou comportamento é introduzida em `srv/tratativa-service.cds`, `srv/tratativa-service.ts` ou nos endpoints sob `/api/tratativa/v1`.
- A função `baixarEvidencia` do serviço de negócio permanece intocada, inclusive respondendo a mensagem `'Forbidden'` que já possui (R8, R10).
- Os testes da spec 006 e specs anteriores continuam passando sem nenhuma modificação.
- `Minhas Pendências` e `Administração` continuam sem expor Evidências nem anexos (CA17).

**Verificado por:** CA16 e CA17.

---

## Contrato executável

### O que é
1. **Definição de dados CDS (`srv/tratativa-app-service.cds`):**
   ```cds
   @readonly
   entity Evidencias as projection on m.Evidencias {
     *,
     virtual null as conteudo : LargeBinary
       @Core.MediaType: mimeType
       @Core.ContentDisposition.Filename: nomeArquivo,
     false as ocultaRemover : Boolean,
     false as podeRemover   : Boolean
   } where ativo = true actions {
     @requires: 'authenticated-user'
     @Core.OperationAvailable: in.podeRemover
     action removerEvidencia();
   };
   ```

2. **Anotações Fiori Elements (`app/tratativas/annotations.cds`):**
   - Na lista de colunas `UI.LineItem` de `TratativaAppService.Evidencias`:
     Substituição de `{ $Type: 'UI.DataField', Value: nomeArquivo }` por `{ $Type: 'UI.DataField', Value: conteudo }`.
   - No bloco de anotações de títulos de `TratativaAppService.Evidencias`:
     Inclusão de `conteudo @title: 'Nome do arquivo';`.

3. **Assinaturas TypeScript em `srv/tratativa/evidencias-consultas.ts`:**
   ```typescript
   export async function processarDownloadEvidencia(
     req: cds.Request,
     dados: {
       codigoTratativa: string;
       codigoAcao: string;
       codigoEvidencia: string;
       responsavelAcao: string;
       mimeType: string;
       tamanho: number;
     },
     mensagemRecusa403?: string,
   ): Promise<Buffer>;
   ```

4. **Assinaturas TypeScript em `srv/tratativa/operacoes-linha-app.ts`:**
   ```typescript
   export interface EvidenciaDaLinha {
     codigoEvidencia: string;
     codigoAcao: string;
     codigoTratativa: string;
     nomeArquivo: string;
     mimeType: string;
     tamanho: number;
   }

   export async function servirAnexoEvidencia(req: cds.Request): Promise<void>;
   ```

### Como se valida
- Validação estrutural de compilação CDS para EDMX via `@sap/cds` 10.1.1:
  O serviço `TratativaAppService` compila com a propriedade `conteudo` como `Edm.Stream`, associada a `Core.MediaType` apontando para `mimeType` e `Core.ContentDisposition.Filename` apontando para `nomeArquivo`.
- Validação estática das anotações e modelo compilado (`cds.load(['srv', 'app'])`):
  `UI.LineItem` de `TratativaAppService.Evidencias` contém `{ Value: 'conteudo' }`, e o elemento `conteudo` possui `@title: 'Nome do arquivo'`.
- Esqueleto de teste automatizado (`test/ver-anexo-evidencia.test.ts`) executando chamadas OData V4 via `cds.test`.

### Saída da validação (medido em 2026-10-14)
```
exit=0   (EDMX compilado de TratativaAppService)
<Property Name="conteudo" Type="Edm.Stream"/>
<Annotation Term="Core.MediaType" Path="mimeType"/>
<Annotation Term="Core.ContentDisposition">
    <Record>
        <PropertyValue Property="Filename" Path="nomeArquivo"/>
    </Record>
</Annotation>
<Annotation Term="UI.LineItem">
    <Collection>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="codigo"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="conteudo"/></Record>
        <Record Type="UI.DataField"><PropertyValue Property="Value" Path="mimeType"/></Record>
        ...
```

---

## Tasks
| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-ver-anexo-evidencia.md` | Entrega completa do acesso ao anexo na tabela de Evidências (modelo CDS, anotações, handlers de stream, núcleo compartilhado de autorização/auditoria e suíte de testes) | `ver-anexo-evidencia/001-ver-anexo-evidencia` |

Task única: o modelo CDS (`conteudo : LargeBinary`), as anotações do Fiori elements (`Value: conteudo`), o handler de stream e os testes HTTP formam uma unidade coesa. A separação em múltiplas tasks deixaria a interface chamando uma URL não tratada ou o servidor expondo contrato sem visualização na UI.

---

## Itens N3 (aprovação no Gate 1)
| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | **Contrato novo do `/api/app/v1` (`TratativaAppService`).** Adição da propriedade virtual de mídia `conteudo : LargeBinary` em `TratativaAppService.Evidencias`, anotada com `@Core.MediaType: mimeType` e `@Core.ContentDisposition.Filename: nomeArquivo`. O acesso ao binário é servido via stream OData V4 nos caminhos direto (`Evidencias(e)/conteudo`) e por contenção (`Tratativas(t)/evidencias(e)/conteudo`). O `/api/tratativa/v1` não sofre alterações. | contrato público (OData do App) | aprovado (orquestrador, Gate 1 delegado, 2026-10-14) |
| N3-2 | **Autorização e auditoria no acesso ao arquivo binário.** Acesso ao binário protegido estritamente pelas regras de menor privilégio de `evidencias` (R11) e `metodologias-e-aval-tecnico` (R7 d, R20 f): permitido a `GestorTratativa`, `Responsável da Ação` e `Validador Técnico` habilitado. Segregação mãe/subação mantida. Recusa 403 `'Acesso negado.'` para terceiros e aplicativo de origem; 401 para não autenticado. Registro prévio obrigatório do evento imutável `DownloadEvidencia` no histórico da Ação antes da entrega do binário, com reversão e aborto em caso de falha de gravação (R6). | segurança / roles | aprovado (orquestrador, Gate 1 delegado, 2026-10-14) |
| N3-3 | **Privacidade e LGPD dos anexos de evidências.** Arquivos anexados podem conter dados sensíveis (saúde ocupacional, fotos de acidentes). A propriedade binária `conteudo` nunca é exposta em listagens, tabelas, consultas agregadas ou `$expand` (suprimida pelo CAP em `streamProp.js:64`). Evidência inativa/removida logicamente responde 404 antes de checagem dinâmica de permissão. O mascaramento de autoria (`autorAnexo` nulo para não-Gestores) e a restrição de visibilidade por vínculo em `srv/tratativa/mascara-app.ts` permanecem inalterados. | dados pessoais sensíveis (LGPD) | aprovado (orquestrador, Gate 1 delegado, 2026-10-14) |

---

## Como isso se prova

### Automatizado (na esteira, via `test/ver-anexo-evidencia.test.ts`, usando `cds.test` com SQLite em memória):
- **CA2 (PNG inline):** Gestor acessa anexo PNG (`a3000000-0000-4000-8000-000001000011/conteudo`), recebe status 200, `content-type: image/png`, cabeçalho `content-disposition: inline; filename="foto-guarda-corpo-reapertado.png"` e o mesmo buffer gravado.
- **CA3 (PDF inline):** Gestor acessa anexo PDF (`a3000000-0000-4000-8000-000001000021/conteudo`), recebe status 200, `content-type: application/pdf`, `content-disposition: inline; filename="lista-presenca-integracao.pdf"` e buffer correspondente.
- **CA4 (TXT inline):** Gestor acessa anexo TXT (`a3000000-0000-4000-8000-000003000021/conteudo`), recebe status 200, `content-type: text/plain`, `content-disposition: inline; filename="os-troca-mangueira.txt"` e buffer correspondente.
- **CA5 (CSV attachment):** Gestor acessa anexo CSV (`a3000000-0000-4000-8000-000002000011/conteudo`), recebe status 200, `content-type: text/csv`, `content-disposition: attachment; filename="certificados-calibracao.csv"` e buffer correspondente.
- **CA6 (Matriz de autorização e segregação de subações):**
  - Responsável da Ação (ex.: `M1001`) acessa com sucesso anexo da sua Ação (200);
  - Validador Técnico habilitado acessa anexo com sucesso (200);
  - Responsável da Ação mãe tentando acessar anexo de Subação recebe 403 `'Acesso negado.'`;
  - Responsável da Subação tentando acessar anexo da Ação mãe recebe 403 `'Acesso negado.'`.
- **CA7 (Recusa 403 para terceiros):** usuário comum (`usuario`), Responsável de outra Ação, Responsável Principal e Participante sem responsabilidade na Ação recebem 403 `'Acesso negado.'` e nenhum byte é entregue.
- **CA8 (Origem e não-autenticado):** chamada autenticada como `AplicativoOrigem` recebe 403 `'Acesso negado.'`; chamada sem autenticação recebe 401.
- **CA9 (Precedência da existência física e lógica):** Evidência inexistente (UUID não cadastrado) ou inativa (`ativo === false`, ex.: `a3000000-0000-4000-8000-000019000022`) responde 404 `'Evidência não encontrada.'`, inclusive para usuário sem vínculo (existência precede autorização).
- **CA10 (Auditoria prévia):** acesso aceito gera registro `DownloadEvidencia` no histórico da Ação (comprovado via `SELECT.from('HistoricoAcoes')`), contendo `evidencia`, `mimeType`, `tamanho`, sem Nome do arquivo nem conteúdo; acesso recusado (403 ou 404) não gera nenhum evento de histórico.
- **CA11 (Aborto transacional por falha de auditoria):** com falha simulada no registro de histórico, a requisição falha e nenhum byte do binário é entregue.
- **CA12 (Minimização LGPD):** `GET /api/app/v1/Tratativas(t)/evidencias` e `$expand=evidencias` não incluem o binário na resposta JSON; `autorAnexo` vem mascarado como `null` para não-Gestores.
- **CA13 (Acesso direto vs visibilidade):** usuário sem vínculo tentando acesso direto a Evidência recebe 403 `'Acesso negado.'`.
- **CA14 (Mensagens de erro):** respostas de erro retornam `Acesso negado.` (403) e `Evidência não encontrada.` (404), sem vazamento de stack ou partes do arquivo. O endpoint existente `TratativaService.baixarEvidencia` continua retornando `Forbidden`.
- **CA15 (Qualquer status):** acesso com sucesso (200) mesmo quando a Tratativa está `Encerrada` ou `Cancelada` e a Ação está `Concluída` ou `Cancelada`.
- **CA16 (Suíte 006 intacta):** os testes existentes de `test/evidencias-*.test.ts` e do serviço de backend executam com 100% de sucesso sem qualquer alteração.
- **CA17 (Minhas Pendências e Administração):** não contêm rota de stream de Evidências.
- **CA18 (Generalidade):** funcionamento idêntico para Tratativa de Origem e Tratativa avulsa.
- **CA19 (Esteira limpa):** suíte executa e passa integralmente sem navegador real nem chamadas de rede externas.
- **Dois caminhos:** todas as asserções de acesso ao stream são comprovadas tanto pelo caminho direto (`Evidencias(e)/conteudo`) quanto pelo caminho por contenção (`Tratativas(t)/evidencias(e)/conteudo`). Caminho com chave `t` divergente ou malformada responde 404 `'Evidência não encontrada.'`.

### Visual (navegador local, `cds watch` + sandbox do Fiori Launchpad):
- **CA1:** ao carregar a Object Page da Tratativa como Gestor, na seção Evidências, a coluna "Nome do arquivo" renderiza o nome de cada evidência como um link clicável (e com o ícone correspondente ao MIME type).
- **CA2, CA3, CA4:** ao clicar no link de uma imagem (PNG), PDF ou texto (TXT), o navegador abre o arquivo diretamente em uma nova aba.
- **CA5:** ao clicar no link de um arquivo CSV ou planilha, o navegador inicia o download do arquivo com o nome original.
- **CA13:** como Responsável da Ação A1, a tabela de Evidências exibe somente as Evidências de A1, todas com link clicável; terceiros veem a tabela vazia.

---

## O que não muda
- **`srv/tratativa-service.cds` e `srv/tratativa-service.ts`:** nenhuma linha alterada; a function `baixarEvidencia` mantém contrato, parâmetros, erros e comportamento inalterados.
- **`srv/tratativa/mascara-app.ts`:** regras de máscara LGPD, restrição de leitura `porVinculo` e mascaramento de `autorAnexo` permanecem exatamente como estão.
- **`db/tratativa.cds`:** nenhuma alteração na camada de banco de dados; nenhuma tabela criada ou modificada; compatibilidade HDI mantida.
- **Operações existentes de Evidência:** `anexarEvidencia` e `removerEvidencia` mantêm exatamente suas regras, diálogos e comportamento.
- **Lista de Evidências:** continua exibindo apenas registros ativos (`where ativo = true`), conforme decisão R-09 / N3-6.
- **`Minhas Pendências` e `Administração`:** permanecem inalterados.
- **Permissões e papéis:** nenhum papel novo em `xs-security.json`; quem pode baixar continua sendo estritamente Gestor de Tratativa, Responsável da Ação e Validador Técnico habilitado.

---

## O desconfortável, declarado
1. **Comportamento de abertura em nova aba (`target="_blank"`):** O Fiori Elements v4 renderiza propriedades de stream no template padrão como `<Link target="_blank" ... />` (`DisplayStyle.tsx:449`). Para formatos com `Content-Disposition: inline` (imagens, PDFs, textos), o navegador abre uma nova aba e renderiza o conteúdo diretamente; para formatos com `attachment` (como CSV e DOCX), a nova aba é acionada brevemente pelo navegador enquanto o download do arquivo é disparado. Esse comportamento é intrínseco ao padrão nativo do Fiori elements v4 e elimina qualquer necessidade de código JavaScript customizado ou manipulação de DOM na interface.
2. **Definição de propriedade de mídia virtual no CDS (`virtual null as conteudo`):** Como o binário das Evidências é armazenado em repositório externo via `ArmazenamentoEvidencias` (e não em uma coluna BLOB da tabela `Evidencias` no banco de dados), a propriedade `conteudo` é projetada no CDS como `virtual null as conteudo : LargeBinary`. A marcação `virtual` impede que o runtime do CAP injete projeções SQL automáticas no banco que causariam erro de coluna inexistente, e o handler `on('READ', 'Evidencias')` assume a entrega do fluxo binário a partir do storage.
3. **Atribuição tardia de `@odata.mediaContentType` no `after('READ')`:** Fiori elements condiciona a renderização do link a `not(equal(pathInModel('conteudo@odata.mediaContentType'), null))`. Por ser uma propriedade virtual externa ao banco, o handler `after('READ', 'Evidencias')` atribui explicitamente `linha['conteudo@odata.mediaContentType'] = linha.mimeType` para cada linha lida, garantindo que o link fique visível e com o ícone correto sem onerar a consulta SQL ao banco.

