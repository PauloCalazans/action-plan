# Design: abertura-por-apps-de-origem

**Spec:** agentic/projeto/specs/abertura-por-apps-de-origem/spec.md
**Status:** aprovado

Escopo técnico: modelo mínimo da Tratativa exigido pelo contrato do 002, o contrato público de abertura e consulta para aplicativos de origem, a Tratativa avulsa, a tabela global de prazos mantida pelo Administrador, o registro revogável de credenciais de aplicativo e a regra interna de alteração de Criticidade (R12). Ciclo de vida, demais Status, UI Fiori e a operação de alteração exposta a usuários ficam no intent 003.

## Decisões

1. **Modelo em `db/tratativa.cds`, namespace `br.com.calazanstec`, cinco entidades novas:** `Tratativas`, `ChavesOrigem`, `PrazosCriticidade`, `HistoricoTratativa`, `CredenciaisAplicativo`; tipos `Criticidade` (enum fechado `Baixa`, `Média`, `Alta`, `Crítica`), `StatusTratativa` (só `Aberta`), `EventoHistorico`, `TipoAutor`. `db/schema.cds` permanece. — **Por quê:** um arquivo por agregado; nada de Origem específica no modelo (AGENTS.md:36). `idOrigem` é `String(50)` simples, conforme o papel do arquiteto; a anotação `@Common.SemanticObject` é de UI e entra com o app Fiori (003). — **Verificado por:** `npm run build` (cds-typer + tsc + cds build) e o contrato executável abaixo.

2. **Código = chave `codigo : UUID`, versão 4 (aleatório), gerado pela plataforma com `cds.utils.uuid()`** (R22, CA34, CA35). — **Por quê:** v4 é o que o runtime CAP gera (medido: o esqueleto confere o nibble de versão `4` e a variante `8|9|a|b`); v4 não carrega tempo, sequência nem dados do pedido, então "não depende da ordem de criação" é propriedade da versão, não de amostra. A unicidade e o "nunca reutilizado" são **invariantes do modelo**: `codigo` é chave primária (o banco recusa duplicata) e não existe operação pública de UPDATE nem DELETE sobre `Tratativas` (sem entity set exposto). — **Verificado por:** chave primária no DDL (medido em `cds compile --to sql`); teste de amostra em T002 (dois Códigos distintos, ambos casam o regex v4, nenhum contém Origem nem ID_Origem); `$metadata` sem entity set de Tratativas (esqueleto).

3. **Unicidade do par (Origem, ID_Origem) como invariante do modelo: entidade `ChavesOrigem` com chave primária composta `(origemNormalizada, idOrigem)` e associação para a Tratativa** (R4, R15, R16). `origemNormalizada = origem.trim().toLowerCase()` (acentos preservados; `toLowerCase` sem locale); o `idOrigem` é comparado exatamente, sem normalização (H3). A Tratativa grava `origem` como veio. Na abertura com par: gera o `codigo`, insere primeiro em `ChavesOrigem`; se já existe a chave (leitura prévia ou violação de unicidade em corrida), devolve o `codigo` existente e não grava nada; senão insere a Tratativa e o histórico, na mesma transação do pedido. Avulsas não têm linha em `ChavesOrigem`. — **Por quê:** chave primária vale igual em SQLite e HANA e não depende do tratamento de `NULL` em índices únicos (avulsas sem par); a corrida entre dois pedidos idênticos é resolvida pelo banco, não pelo código. — **Verificado por:** PK composta no DDL (medido); testes de T004 (CA2, CA15-CA18) como amostra.

4. **Três serviços OData V4 públicos e um interno, com caminhos versionados `/api/<serviço>/v1`:**
   - `IntegracaoOrigemService` em `/api/integracao-origem/v1`, `@requires: 'AplicativoOrigem'`: `action abrirTratativa(...) returns ResultadoAbertura`, `function consultarPorCodigo(codigo)`, `function consultarPorOrigem(origem, idOrigem)`. **Sem entity sets** (o aplicativo não lista Tratativas).
   - `TratativaService` em `/api/tratativa/v1`, `@requires: 'authenticated-user'`: `action criarTratativaAvulsa(...)` sem `origem`/`idOrigem` na assinatura (R6, R14, "Derivado" da spec). Identidade com papel `AplicativoOrigem` é recusada com **403** `Aplicativo de origem não cria Tratativa avulsa.` (H5 = não, decisão 15).
   - `AdministracaoService` em `/api/administracao/v1`, `@requires: 'Administrador'`: `PrazosCriticidade` (READ, UPDATE) e `CredenciaisAplicativo` (READ, CREATE, UPDATE).
   - `TratativaInternaService` com `@protocol: 'none'`: `action alterarCriticidade(codigo, criticidade, autor, tipoAutor)` (R12, CA11). Sem endpoint; só é chamado em processo (`cds.connect.to(...).send(...)`).
   — **Por quê:** separar o contrato de terceiros (estável, versionado, mínimo) da superfície de usuários (que o 003 vai expandir com Fiori) e da administração; action/function em vez de entity sets dá controle total do que entra e sai (R19, R21). — **Verificado por:** esqueleto do contrato (medido: `$metadata`, 401/403, endpoints do serviço interno = `[]`).

5. **Recusa de campo desconhecido, data prevista informada e tamanho excedido fica com o runtime CAP (400), sem código próprio** (R21, CA8, CA25, CA37). — **Por quê:** medido no CAP 10.1.1: parâmetro fora da assinatura da action → `400 Property "nomeVitima" does not exist in IntegracaoOrigemService.abrirTratativa`; valor acima do tamanho → `400 ASSERT_DATA_TYPE` com `target` do campo. — **Verificado por:** esqueleto (medido) e testes de T002.

6. **Validação de negócio no domínio, com contrato de erro fixo** (R7, R13, R14): HTTP 400, `error.target` = nome do parâmetro, `error.message` cita o nome do campo de negócio. Mensagens: `O campo Título é obrigatório.` (target `titulo`), `O campo Criticidade é obrigatório.` (`criticidade`), `Criticidade inválida: use Baixa, Média, Alta ou Crítica.` (`criticidade`), `O campo Origem é obrigatório.` (`origem`), `O campo ID_Origem é obrigatório.` (`idOrigem`). Ordem: `titulo`, `criticidade` ausente, `criticidade` inválida, `origem`, `idOrigem` (aplicativo sem nenhum dos dois → `target = 'origem'`). Texto só com espaços conta como ausente. Pedido recusado não grava nada (nenhuma linha em `Tratativas`, `ChavesOrigem`, `HistoricoTratativa`). — **Por quê:** a spec exige mensagem que nomeia o campo; os parâmetros são opcionais no CDS de propósito, para o domínio controlar a mensagem (com `not null` no parâmetro o runtime responde com texto próprio). — **Verificado por:** testes de T003 (aplicativo) e T007 (avulsa).

   **Assinaturas fixas do domínio (I1):**
   ```ts
   // srv/tratativa/abertura.ts
   export type TipoAutor = 'Aplicativo' | 'Usuario' | 'Sistema';
   export interface Autor { id: string; tipo: TipoAutor }
   export interface DadosAbertura {
     origem?: string | null; idOrigem?: string | null; titulo?: string | null; criticidade?: string | null;
     descricao?: string | null; unidade?: string | null; area?: string | null; solicitante?: string | null;
   }
   export function abrirTratativa(dados: DadosAbertura, autor: Autor): Promise<{ codigo: string }>;

   // srv/tratativa/validacao.ts (T003)
   export function validarAbertura(dados: DadosAbertura, exigeOrigem: boolean): void; // lança erro {status: 400, target, message}
   ```
   `abrirTratativa` é o **único** ponto de entrada: chama `validarAbertura(dados, autor.tipo === 'Aplicativo')` antes de qualquer escrita. Com `exigeOrigem = true` (aplicativo), Origem e ID_Origem são obrigatórios; com `false` (usuário), ambos devem estar ausentes (se vierem por outro caminho, 400 com `target = 'origem'` e mensagem "Origem e ID_Origem só podem ser informados pelo aplicativo de origem."). Os handlers só montam o `Autor` e delegam: `IntegracaoOrigemService` → `{ id: req.user.id, tipo: 'Aplicativo' }`; `TratativaService` → `{ id: req.user.id, tipo: 'Usuario' }`. Nenhum handler chama `validarAbertura` diretamente. T002 cria `abrirTratativa` sem a chamada; T003 cria `validacao.ts` e acrescenta a chamada em `abertura.ts`; T007 só consome.

7. **Prazo como dado: `PrazosCriticidade` (criticidade → dias), valores iniciais 3/7/15/30 em `db/data/br.com.calazanstec-PrazosCriticidade.csv`.** Data prevista = `dataCriacao` + dias, em dias corridos, com aritmética de data civil (`YYYY-MM-DD`, sem horário, sem horário de verão). O valor é lido na criação e gravado na Tratativa; mudar a tabela não toca Tratativas existentes (R11). — **Por quê:** R10/R11 e genericidade (AGENTS.md:36). — **Verificado por:** testes de T002 (CA6, CA7, CA29, CA30, CA9).

8. **Relógio único em `srv/lib/relogio.ts`:** `agora(): Date` (`new Date()`) e `dataCivil(instante: Date): string` (data `YYYY-MM-DD` no fuso da plataforma, constante `FUSO_PLATAFORMA = 'America/Sao_Paulo'`, via `Intl.DateTimeFormat`, ver H2). Os testes fixam o instante **sem importar código de produção**, falsificando só o `Date`: `jest.useFakeTimers({ now, doNotFake: [todos os demais] })` (helper `test/apoio/relogio.ts`, criado em T002). — **Por quê:** CA6, CA7, CA11 citam datas fixas; o servidor roda em UTC e uma Tratativa criada às 22h em Brasília cairia no dia seguinte. Importar `srv/` no teste quebraria o RED por erro de compilação (módulo inexistente) em vez de asserção. — **Verificado por:** medido no rascunho (só `Date` falsificado; `cds.test` responde normalmente e o `modifiedAt` sai com o instante fixado); testes de T002 e T008; revisão (nenhum `new Date()` fora de `relogio.ts`).

9. **Histórico mínimo em `HistoricoTratativa`** (R12, R20, AGENTS.md:40): evento `Criacao` na abertura (autor = `req.user.id`, `tipoAutor` = `Aplicativo` no serviço de integração ou `Usuario` no avulso, `quando` = `relogio.agora()`); evento `AlteracaoCriticidade` grava **duas linhas** na alteração: `campo = 'criticidade'` (anterior/novo) e `campo = 'dataPrevistaConclusao'` (anterior/novo). Alteração para a mesma Criticidade não grava nada. — **Por quê:** invariante "toda alteração de Criticidade ou de Data prevista gera histórico". O Histórico completo é do intent 008; este é o mínimo que ele vai absorver. — **Verificado por:** testes de T002 (CA24), T007 (CA24 avulsa) e T008 (CA11).

10. **Credencial de aplicativo (R18): papel `AplicativoOrigem` + registro `CredenciaisAplicativo` consultado a cada pedido.** Um `before('*')` no `IntegracaoOrigemService` procura `req.user.id` em `CredenciaisAplicativo` com `ativa = true`; ausente ou inativa → o handler rejeita com status **401**; nada é gravado. O contrato afirma **só** o status 401, o corpo `Unauthorized` e a ausência de qualquer dado de Tratativa: no CAP 10.1.1 todo erro 401 é respondido por `res.sendStatus(401)` (`node_modules/@sap/cds/lib/srv/middlewares/errors.js:18-19`), então nenhuma mensagem própria chega ao cliente (achado I4 do revisor; opção (a) decidida pelo orquestrador). Emissão = Administrador cria a linha; revogação = Administrador põe `ativa = false` (`managed` registra quem e quando). — **Por quê:** a identidade técnica vem do provedor de identidade (mockado em teste; produção em H1), mas a decisão "esta credencial vale" fica na plataforma, revogável sem redeploy e testável em SQLite (CA32). 401 (e não 403) porque, para a plataforma, a credencial deixou de existir. — **Verificado por:** testes de T006 (CA19, CA20, CA32, aplicativo não registrado).

11. **Autenticação em desenvolvimento e teste: `cds.requires.auth` `[development]` `kind: mocked`** com usuários `app-origem-a`, `app-origem-b`, `app-revogado` (papel `AplicativoOrigem`), `admin` (`Administrador`) e `usuario` (sem papel), senhas vazias. — **Por quê:** testes nunca dependem de IdP real (AGENTS.md:38); medido que `cds.test` usa esse perfil. Produção não é configurada nesta spec (não há `mta.yaml` nem `xs-security.json`; ver N3-10 e H1). — **Verificado por:** esqueleto (401/403 medidos).

12. **Handlers TypeScript carregados pelo CAP sob jest com `process.env.CDS_TYPESCRIPT = 'true'` na primeira linha de `jest.config.js`.** — **Por quê:** medido no CAP 10.1.1: sem a variável, `srv/<serviço>.ts` é ignorado e a operação responde 501 (`lib/srv/factory.js` só procura `.ts` com `CDS_TYPESCRIPT`). Handlers são classes `extends cds.ApplicationService` em `srv/<serviço>.ts`, mesmo nome do `.cds`; regras de domínio em `srv/tratativa/*.ts`, sem dependência de serviços externos. — **Verificado por:** medição no rascunho (com a linha: 200; sem: 501); `npm test`.

13. **Genericidade como mecanismo:** regra `no-restricted-syntax` no `eslint.config.mjs` para `srv/**/*.ts` e `db/**/*.ts`, recusando literal ou template com `advertência|advertencia|acidente|sesmt` (sem diferenciar caixa). — **Por quê:** AGENTS.md:36 ("nenhum nome de origem no código") deixa de depender só de revisão. `.cds` e CSV não são cobertos pelo ESLint: continuam por revisão. — **Verificado por:** `npm run lint`; e prova automatizada da própria regra em `test/genericidade-lint.test.ts` (T001), que roda o ESLint do projeto em processo filho (`spawnSync(process.execPath, [<raiz>/node_modules/eslint/bin/eslint.js, '--stdin', '--stdin-filename', 'srv/fixture-genericidade.ts', '--format', 'json'])`) sobre um trecho com `'Advertência'` e `` `SESMT` `` (espera 2 achados `no-restricted-syntax`) e sobre um trecho limpo (espera 0). Medido no rascunho: 2 achados / 0. A API `ESLint` em processo não serve sob jest (carregar `eslint.config.mjs` exige `--experimental-vm-modules`; medido).

14. **Código mal formado na consulta (M1):** o runtime **não** recusa: medido que `consultarPorCodigo(codigo='abc')` chega ao handler (respondeu 501 sem handler, igual a um UUID válido). Decisão: o domínio valida o formato UUID e responde **400** `Código inválido.` com `target = 'codigo'`, antes de consultar o banco. — **Por quê:** distinguir "pedido errado" de "não encontrada" (CA23) e não depender do banco para comparar texto livre com a chave. O Código é comparado sem diferenciar caixa (R-14): a regex tem o flag `i` e o handler o converte para minúsculas antes do SELECT. `consultarPorOrigem` recusa parâmetro ausente ou só com espaços com **400** e as mensagens da decisão 6 (`target = 'origem'`, "O campo Origem é obrigatório."; `target = 'idOrigem'`, "O campo ID_Origem é obrigatório."); `consultarPorCodigo` sem `codigo` também dá 400 `Código inválido.`; nunca 500. — **Verificado por:** teste em T005.

15. **Aplicativo não cria avulsa (H5 = não, decisão do orquestrador por delegação):** `before('criarTratativaAvulsa')` no `TratativaService` recusa com **403** `Aplicativo de origem não cria Tratativa avulsa.` quando `req.user.is('AplicativoOrigem')`, sem gravar nada. — **Por quê:** derivado da nota da spec ("o aplicativo autenticado sempre envia o par; o usuário que cria avulsa nunca o envia", R13/R14). — **Verificado por:** teste em T007.

16. **Sem comunicação de saída (R5, CA3):** nenhum módulo do 002 importa cliente HTTP, SDK ou `srv/integracoes/`; `cds.requires` não declara serviço remoto. — **Verificado por:** `npm run arch` (D2) para SDKs; teste de T008 que, após criação, pedido repetido e alteração de Criticidade, confirma zero chamadas a `globalThis.fetch` e a `https.request`, e nenhum serviço `cds.RemoteService` conectado. O spy de `https` precisa do objeto real do módulo: obtê-lo com `require('node:https')` (com `// eslint-disable-next-line @typescript-eslint/no-require-imports`), não com `import * as https`, cuja cópia de namespace gerada pelo TypeScript não é o objeto que o runtime usa.

17. **LGPD:** `Tratativas.solicitante` (`String(50)`, só matrícula) e `HistoricoTratativa.autor` levam `@PersonalData.IsPotentiallyPersonal`; as entidades, `@PersonalData.EntitySemantics: 'Other'`. A consulta (R19) não devolve `solicitante`, `descricao`, `titulo` nem `autor`. Sem plugin de audit log (seria dependência nova) e sem política de retenção (questão aberta da spec). — **Verificado por:** revisão; `$metadata` de `ConsultaTratativa` (T005).

### Decisões de plataforma a registrar em `agentic/projeto/decisoes.md` (T001, depois do Gate 1)
- **D6 — Contratos de integração versionados:** vale **só para serviços cujo consumidor é um sistema de terceiros** (hoje, `IntegracaoOrigemService`): caminho `/api/<serviço>/v<n>`, só actions/functions com tipos de retorno explícitos, sem entity sets; mudança incompatível cria `v<n+1>`. Serviços consumidos pela UI própria ou pela administração (`TratativaService`, `AdministracaoService`) usam o mesmo padrão de caminho por consistência, mas não ficam presos a "sem entity sets"; mudanças neles continuam N3 pela D4.
- **D7 — Autorização de aplicativos externos:** papel `AplicativoOrigem` + registro `CredenciaisAplicativo` verificado a cada pedido; revogação pela plataforma.
- **D8 — Handlers TypeScript:** `srv/<serviço>.ts` com `CDS_TYPESCRIPT=true` nos testes; empacotamento de produção (compilação para `gen/srv`) é decisão pendente da task de deploy.

## Contrato executável

- **O que é:** os arquivos CDS abaixo (modelo, quatro serviços, dados iniciais), a configuração de autenticação mockada, a linha do `jest.config.js` e um teste-esqueleto `cds.test` que chama o OData V4 e valida a superfície e a autorização declarativa. Foi construído e medido numa cópia do repositório fora da árvore de trabalho (rascunho da sessão, `node_modules` do repositório por junção); **nada foi gravado em `db/`, `srv/`, `test/`, `package.json` ou `jest.config.js` do repositório**. As tasks transcrevem estes arquivos (cada task cita o trecho que lhe cabe). O esqueleto não é commitado: as asserções de 501 deixam de valer quando os handlers existirem; os testes das tasks o substituem.
- **Como se valida:** `npx cds compile srv --to sql` (DDL), `npm run build`, `npx jest`, `npm run lint`, `npm run arch`, na cópia com os arquivos abaixo.
- **Saída da validação (medido, 2026-10-07, CAP 10.1.1, Node 24.19.0):**
```
$ npx cds compile srv --to sql | grep -c "CREATE TABLE"
5
$ npm run build
> cds-typer "*" --outputDirectory @cds-models && tsc --noEmit && cds build --production
build completed in 8098 ms
$ npx jest --silent --verbose
PASS test/fumaca.test.ts
    √ responde a uma consulta no SQLite em memória (3 ms)
PASS test/contrato.test.ts
    √ integração expõe abrir e consultar, sem entity sets e sem alterarCriticidade (57 ms)
    √ integração: 401 sem autenticação, 403 sem papel AplicativoOrigem, 501 sem handler (48 ms)
    √ integração: campo desconhecido e tamanho excedido são recusados pelo runtime (400) (47 ms)
    √ avulsa: 401 sem autenticação; origem/idOrigem não fazem parte da assinatura (31 ms)
    √ administração: tabela padrão 3/7/15/30; admin altera; usuário comum recebe 403 (76 ms)
    √ serviço interno não tem endpoint e responde só por chamada local (1 ms)
    √ UUID gerado pelo runtime é versão 4 (aleatório)
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
$ npm run lint
> eslint .
(sem achados)
$ npm run arch
✔ no dependency violations found
```
- Medições adicionais usadas nas decisões (mesmo rascunho):
```
campo desconhecido (app):    400 Property "nomeVitima" does not exist in IntegracaoOrigemService.abrirTratativa
campo desconhecido (avulsa): 400 Property "origem" does not exist in TratativaService.criarTratativaAvulsa
tamanho excedido:            400 ASSERT_DATA_TYPE, target "origem"
sem handler:                 501 Service "IntegracaoOrigemService" has no handler for "abrirTratativa".
handler .ts sem CDS_TYPESCRIPT: 501 (ignorado);  com CDS_TYPESCRIPT=true: 200
serviço @protocol:'none':    endpoints [] ; POST/GET por HTTP -> 404
jest.useFakeTimers só Date:  PATCH 200; modifiedAt = 2026-10-07T15:00:00.000Z (instante fixado)
consultarPorCodigo(codigo='abc'): 501 (chega ao handler; o runtime NÃO valida o formato UUID) -> decisão 14
ESLint em processo filho sobre fixture: 2 achados no-restricted-syntax / trecho limpo: 0
ESLint pela API em processo sob jest: TypeError "dynamic import ... without --experimental-vm-modules"
cds build --production:      gera br.com.calazanstec-PrazosCriticidade.hdbtabledata (ver "O desconfortável")
```

### `db/tratativa.cds`
```cds
// Tratativa: mínimo exigido pelo contrato de abertura e consulta (spec abertura-por-apps-de-origem).
// Genérico: nenhum nome de Origem aqui; variação vem de dados (PrazosCriticidade).
namespace br.com.calazanstec;

using { managed } from '@sap/cds/common';

/** R7: lista fechada de Criticidades. */
type Criticidade : String(10) enum {
  Baixa;
  Media   = 'Média';
  Alta;
  Critica = 'Crítica';
}

/** R20: Status inicial; demais Status pertencem ao intent 003. */
type StatusTratativa : String(20) enum {
  Aberta;
}

/** R12/R20: eventos de histórico do 002 (o Histórico completo é do intent 008). */
type EventoHistorico : String(30) enum {
  Criacao;
  AlteracaoCriticidade;
}

type TipoAutor : String(20) enum {
  Aplicativo;
  Usuario;
  Sistema;
}

/** R22: Código opaco (UUID v4 gerado pela plataforma). R1, R2, R7, R10, R13, R20, R23. */
@PersonalData.EntitySemantics: 'Other'
entity Tratativas {
  key codigo                : UUID;
      origem                : String(100);
      idOrigem              : String(50);
      titulo                : String(200) not null;
      descricao             : String(5000);
      unidade               : String(100);
      area                  : String(100);
      @PersonalData.IsPotentiallyPersonal
      solicitante           : String(50);
      criticidade           : Criticidade not null;
      status                : StatusTratativa not null default 'Aberta';
      dataCriacao           : Date not null;
      dataPrevistaConclusao : Date not null;
      criadoEm              : Timestamp not null;
}

/**
 * R4/R15: invariante "um par (Origem, ID_Origem) tem no máximo uma Tratativa", garantido pela chave primária.
 * origemNormalizada = origem sem espaços nas pontas e em minúsculas (acentos preservados).
 */
entity ChavesOrigem {
  key origemNormalizada : String(100);
  key idOrigem          : String(50);
      tratativa         : Association to one Tratativas not null;
}

/** R10/R11: tabela global de prazos (dado de parametrização; valores iniciais em db/data). */
entity PrazosCriticidade : managed {
  key criticidade : Criticidade;
      dias        : Integer not null @assert.range: [1, 3650];
}

/** R12/R20: registro de histórico mínimo do 002. */
@PersonalData.EntitySemantics: 'Other'
entity HistoricoTratativa {
  key ID            : UUID;
      tratativa     : Association to one Tratativas not null;
      evento        : EventoHistorico not null;
      campo         : String(50);
      valorAnterior : String(200);
      valorNovo     : String(200);
      @PersonalData.IsPotentiallyPersonal
      autor         : String(256) not null;
      tipoAutor     : TipoAutor not null;
      quando        : Timestamp not null;
}

/** R18: registro da plataforma das credenciais de aplicativo (identidade técnica autenticada). */
entity CredenciaisAplicativo : managed {
  key usuarioTecnico : String(256);
      descricao      : String(200);
      ativa          : Boolean not null default true;
}
```

### `db/data/br.com.calazanstec-PrazosCriticidade.csv`
```
criticidade;dias
Crítica;3
Alta;7
Média;15
Baixa;30
```

### `srv/integracao-origem-service.cds` (contrato público; T002 cria com `abrirTratativa` e `ResultadoAbertura`; T005 acrescenta as duas functions e `ConsultaTratativa`)
```cds
using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Contrato público para aplicativos de origem (R3, R4, R5, R9, R13-R16, R18, R19, R21-R23).
 * Sem entity sets: o aplicativo não lista Tratativas; só abre e consulta por Código ou par.
 */
@path    : '/api/integracao-origem/v1'
@requires: 'AplicativoOrigem'
service IntegracaoOrigemService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  /** R19: somente estes campos; sem Descrição, sem pessoas. */
  type ConsultaTratativa {
    codigo                : UUID;
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
  }

  action   abrirTratativa(origem : String(100), idOrigem : String(50), titulo : String(200), criticidade : String(10),
                          descricao : String(5000), unidade : String(100), area : String(100),
                          solicitante : String(50)) returns ResultadoAbertura;

  function consultarPorCodigo(codigo : UUID)                          returns ConsultaTratativa;
  function consultarPorOrigem(origem : String(100), idOrigem : String(50)) returns ConsultaTratativa;
}
```

### `srv/tratativa-service.cds`
```cds
/** Tratativa avulsa por usuário autenticado (R6, R17). Sem Origem nem ID_Origem por assinatura. */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  action criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                              unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;
}
```

### `srv/administracao-service.cds`
```cds
using { br.com.calazanstec as m } from '../db/tratativa';

/** Administração da plataforma (R11, R18): tabela de prazos e credenciais de aplicativo. */
@path    : '/api/administracao/v1'
@requires: 'Administrador'
service AdministracaoService {

  /** R11: o Administrador só altera os dias; a lista de Criticidades é fixa (R7). */
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'UPDATE'], to: 'Administrador' }]
  entity PrazosCriticidade     as projection on m.PrazosCriticidade;

  /** R18: emissão (CREATE) e revogação (UPDATE ativa = false) da credencial de cada aplicativo. */
  @Capabilities: { DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'CREATE', 'UPDATE'], to: 'Administrador' }]
  entity CredenciaisAplicativo as projection on m.CredenciaisAplicativo;
}
```

### `srv/tratativa-interna-service.cds`
```cds
/**
 * Operações internas do 002, sem exposição por protocolo algum (CA11: "operação interna do serviço,
 * sem operação pública"). A operação exposta a usuários é do intent 003.
 */
@protocol: 'none'
service TratativaInternaService {
  /** R12: recalcula a Data prevista desde a criação original e registra histórico. */
  action alterarCriticidade(codigo : UUID, criticidade : String(10), autor : String(256), tipoAutor : String(20));
}
```

### `package.json` (só o bloco `cds`)
```json
"cds": {
  "requires": {
    "auth": {
      "[development]": {
        "kind": "mocked",
        "users": {
          "app-origem-a": { "password": "", "roles": ["AplicativoOrigem"] },
          "app-origem-b": { "password": "", "roles": ["AplicativoOrigem"] },
          "app-revogado": { "password": "", "roles": ["AplicativoOrigem"] },
          "admin":        { "password": "", "roles": ["Administrador"] },
          "usuario":      { "password": "", "roles": [] }
        }
      }
    }
  }
}
```

### `jest.config.js` (primeira linha)
```js
process.env.CDS_TYPESCRIPT = 'true'; // CAP carrega srv/<serviço>.ts sob jest (design abertura-por-apps-de-origem, decisão 12)
```

### `eslint.config.mjs` (bloco acrescentado ao array exportado)
```js
{
  files: ['srv/**/*.ts', 'db/**/*.ts'],
  rules: {
    'no-restricted-syntax': ['error',
      { selector: 'Literal[value=/advert[eê]ncia|acidente|sesmt/i]', message: 'Genericidade (AGENTS.md:36): nome de Origem/área no código.' },
      { selector: 'TemplateElement[value.raw=/advert[eê]ncia|acidente|sesmt/i]', message: 'Genericidade (AGENTS.md:36): nome de Origem/área no código.' },
    ],
  },
},
```

### Esqueleto `test/contrato.test.ts` (medido; não é commitado)
```ts
import cds from '@sap/cds';

const { GET, POST, PATCH } = cds.test(__dirname + '/..');
const ok = { validateStatus: () => true };
const comoApp = { auth: { username: 'app-origem-a', password: '' }, ...ok };
const comoUsuario = { auth: { username: 'usuario', password: '' }, ...ok };
const comoAdmin = { auth: { username: 'admin', password: '' }, ...ok };
const INTEGRACAO = '/api/integracao-origem/v1';
const AVULSA = '/api/tratativa/v1';
const ADMIN = '/api/administracao/v1';
const corpoValido = { origem: 'Origem X', idOrigem: 'REG-1', titulo: 'Título', criticidade: 'Alta' };

describe('contrato: abertura-por-apps-de-origem', () => {
  it('integração expõe abrir e consultar, sem entity sets e sem alterarCriticidade', async () => {
    const { data, status } = await GET(`${INTEGRACAO}/$metadata`, comoApp);
    expect(status).toBe(200);
    expect(data).toMatch(/Action Name="abrirTratativa"/);
    expect(data).toMatch(/Function Name="consultarPorCodigo"/);
    expect(data).toMatch(/Function Name="consultarPorOrigem"/);
    expect(data).not.toMatch(/EntitySet /);
    expect(data).not.toMatch(/alterarCriticidade/);
  });

  it('integração: 401 sem autenticação, 403 sem papel AplicativoOrigem, 501 sem handler', async () => {
    expect((await POST(`${INTEGRACAO}/abrirTratativa`, corpoValido, ok)).status).toBe(401);
    expect((await POST(`${INTEGRACAO}/abrirTratativa`, corpoValido, comoUsuario)).status).toBe(403);
    expect((await POST(`${INTEGRACAO}/abrirTratativa`, corpoValido, comoApp)).status).toBe(501);
    expect((await GET(`${INTEGRACAO}/consultarPorOrigem(origem='a',idOrigem='1')`, comoApp)).status).toBe(501);
  });

  it('integração: campo desconhecido e tamanho excedido são recusados pelo runtime (400)', async () => {
    const extra = await POST(`${INTEGRACAO}/abrirTratativa`, { ...corpoValido, nomeVitima: 'X' }, comoApp);
    expect(extra.status).toBe(400);
    expect(extra.data.error.message).toMatch(/nomeVitima/);
    const prevista = await POST(`${INTEGRACAO}/abrirTratativa`, { ...corpoValido, dataPrevistaConclusao: '2026-12-01' }, comoApp);
    expect(prevista.status).toBe(400);
    const longo = await POST(`${INTEGRACAO}/abrirTratativa`, { ...corpoValido, origem: 'X'.repeat(101) }, comoApp);
    expect(longo.status).toBe(400);
    expect(longo.data.error.target).toBe('origem');
  });

  it('avulsa: 401 sem autenticação; origem/idOrigem não fazem parte da assinatura', async () => {
    expect((await POST(`${AVULSA}/criarTratativaAvulsa`, { titulo: 't', criticidade: 'Alta' }, ok)).status).toBe(401);
    const { data } = await GET(`${AVULSA}/$metadata`, comoUsuario);
    expect(data).toMatch(/Action Name="criarTratativaAvulsa"/);
    expect(data).not.toMatch(/Name="origem"/);
    const comOrigem = await POST(`${AVULSA}/criarTratativaAvulsa`, { titulo: 't', criticidade: 'Alta', origem: 'X' }, comoUsuario);
    expect(comOrigem.status).toBe(400);
  });

  it('administração: tabela padrão 3/7/15/30; admin altera; usuário comum recebe 403', async () => {
    const { data } = await GET(`${ADMIN}/PrazosCriticidade`, comoAdmin);
    const dias = Object.fromEntries(data.value.map((p: { criticidade: string; dias: number }) => [p.criticidade, p.dias]));
    expect(dias).toEqual({ 'Crítica': 3, Alta: 7, 'Média': 15, Baixa: 30 });
    expect((await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias: 5 }, comoAdmin)).status).toBe(200);
    expect((await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias: 1 }, comoUsuario)).status).toBe(403);
    expect((await POST(`${ADMIN}/CredenciaisAplicativo`, { usuarioTecnico: 'app-x', descricao: 'teste' }, comoAdmin)).status).toBe(201);
    expect((await PATCH(`${ADMIN}/CredenciaisAplicativo('app-x')`, { ativa: false }, comoAdmin)).status).toBe(200);
    expect((await POST(`${ADMIN}/CredenciaisAplicativo`, { usuarioTecnico: 'app-y' }, comoApp)).status).toBe(403);
  });

  it('serviço interno não tem endpoint e responde só por chamada local', async () => {
    const interno = await cds.connect.to('TratativaInternaService');
    expect((interno as unknown as { endpoints: unknown[] }).endpoints).toEqual([]);
    await expect(interno.send('alterarCriticidade', { codigo: cds.utils.uuid(), criticidade: 'Alta' }))
      .rejects.toMatchObject({ status: 501 });
  });

  it('UUID gerado pelo runtime é versão 4 (aleatório)', () => {
    expect(cds.utils.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
```

### Contrato de erros (todas as operações públicas)
| Situação | HTTP | Observação |
|---|---|---|
| Sem autenticação | 401 | runtime (`@requires`); corpo `Unauthorized` |
| Autenticado sem o papel do serviço | 403 | runtime |
| Aplicativo não registrado ou credencial revogada | 401 | handler (decisão 10); corpo `Unauthorized` (o CAP descarta a mensagem em todo 401); nenhum dado de Tratativa; nada gravado |
| Identidade com papel `AplicativoOrigem` em `criarTratativaAvulsa` | 403 | handler (decisão 15); `Aplicativo de origem não cria Tratativa avulsa.` |
| Campo desconhecido / tamanho excedido | 400 | runtime (decisão 5) |
| Obrigatório ausente, Criticidade inválida, Origem sem ID_Origem e vice-versa | 400 | domínio (decisão 6), `target` = parâmetro |
| Consulta sem resultado | 404 | `Tratativa não encontrada.` |
| Código mal formado na consulta | 400 | domínio (decisão 14), `Código inválido.`, `target = 'codigo'` — o runtime não valida (medido) |
| Abertura aceita (nova ou repetida) | 200 | corpo `{ "codigo": "<uuid>" }` |

## Tasks
| Task | Objetivo | Branch |
|---|---|---|
| tasks/001-modelo-e-administracao.md | Modelo persistido, tabela de prazos e serviço de administração com autorização do Administrador | abertura-por-apps-de-origem/001-modelo-e-administracao |
| tasks/002-abertura-por-aplicativo.md | Action `abrirTratativa`: Código UUID v4, Status `Aberta`, prazo pela tabela, histórico de criação | abertura-por-apps-de-origem/002-abertura-por-aplicativo |
| tasks/003-validacao-da-abertura.md | Obrigatórios, Criticidade válida e par Origem/ID_Origem, com mensagem que nomeia o campo | abertura-por-apps-de-origem/003-validacao-da-abertura |
| tasks/004-idempotencia-por-par.md | 1 para 1 pelo par normalizado via `ChavesOrigem` | abertura-por-apps-de-origem/004-idempotencia-por-par |
| tasks/005-consulta-pelo-aplicativo.md | Functions de consulta por Código e por par, campos restritos, 404 | abertura-por-apps-de-origem/005-consulta-pelo-aplicativo |
| tasks/006-credencial-revogavel.md | Verificação do registro de credenciais em todo pedido do aplicativo | abertura-por-apps-de-origem/006-credencial-revogavel |
| tasks/007-tratativa-avulsa.md | Action `criarTratativaAvulsa` para usuário autenticado | abertura-por-apps-de-origem/007-tratativa-avulsa |
| tasks/008-alteracao-de-criticidade.md | Regra interna R12 (recálculo e histórico) e prova de ausência de comunicação de saída | abertura-por-apps-de-origem/008-alteracao-de-criticidade |

Ordem: 001 → 002 → (003, 004 em qualquer ordem) → 005 (depende de 004) → 006 (depende de 005) → 007 (depende de 003) → 008 (depende de 004 e de 007: o teste de CA11 confere o `$metadata` de `/api/tratativa/v1`). Cada task sai da principal depois que a anterior de que depende foi integrada.

## Itens N3 (aprovação no Gate 1)
| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | Modelo persistido novo em `db/tratativa.cds` (cinco tabelas: `Tratativas`, `ChavesOrigem`, `PrazosCriticidade`, `HistoricoTratativa`, `CredenciaisAplicativo`) e dados iniciais `db/data/br.com.calazanstec-PrazosCriticidade.csv`. Só criação de tabelas; nada implantado no HANA ainda, então não há migração destrutiva. | `db/*.cds` (papel arquiteto; AGENTS.md "Gatilhos") | aprovado (humano:2026-10-08) |
| N3-2 | R11/CA10: papel `Administrador`; `AdministracaoService` com `@requires: 'Administrador'`; `PrazosCriticidade` só READ/UPDATE, `CredenciaisAplicativo` só READ/CREATE/UPDATE (`@restrict`). Não-Administrador recebe 403. | segurança/autorização | aprovado (humano:2026-10-08) |
| N3-3 | R17/CA31 e H5: `TratativaService` com `@requires: 'authenticated-user'` (não autenticado → 401); identidade com papel `AplicativoOrigem` é recusada com 403 em `criarTratativaAvulsa` (decisão 15), nada gravado. | segurança/autorização | aprovado (humano:2026-10-08) |
| N3-4 | R18/CA19/CA20/CA32: autorização do aplicativo por papel `AplicativoOrigem` (`@requires` no `IntegracaoOrigemService`) mais verificação, a cada pedido, de `req.user.id` ativo em `CredenciaisAplicativo`; ausente/revogado → 401 com corpo `Unauthorized`, sem dado de Tratativa e sem gravar. Emissão e revogação pelo Administrador (N3-2). O mecanismo que produz a identidade em produção (H1) foi adiado ao intent 014 e fica fora destas tasks. | segurança/autenticação; contrato público | aprovado (humano:2026-10-08) |
| N3-5 | `package.json` → `cds.requires.auth` `[development]`: `kind: mocked` com cinco usuários de teste e senhas vazias (só desenvolvimento e teste; nenhuma credencial real). Nenhuma outra mudança em `cds.requires`. | `cds.requires` no `package.json` | aprovado (humano:2026-10-08) |
| N3-6 | R19: contrato público de consulta — `GET /api/integracao-origem/v1/consultarPorCodigo(codigo=<uuid>)` e `consultarPorOrigem(origem='…',idOrigem='…')`, retorno `ConsultaTratativa` (`codigo`, `origem`, `idOrigem`, `criticidade`, `status`, `dataCriacao`, `dataPrevistaConclusao`); 404 `Tratativa não encontrada.`; 400 `Código inválido.` para Código mal formado (decisão 14); só a Origem é normalizada no par (R15, H3); sem vínculo aplicativo × Origem. | contrato público; LGPD | aprovado (humano:2026-10-08) |
| N3-7 | R21/R22: contrato público de abertura — `POST /api/integracao-origem/v1/abrirTratativa` com exatamente `origem` (≤100), `idOrigem` (≤50), `titulo` (≤200), `criticidade`, `descricao` (≤5000), `unidade` (≤100), `area` (≤100), `solicitante` (≤50); retorno `{ codigo }` com UUID v4 opaco; 200 na criação e na repetição; contrato de erros da seção acima; caminho versionado `/v1` (D6). Os limites de tamanho são técnicos (a spec não os fixa) e passam a fazer parte do contrato. | contrato público | aprovado (humano:2026-10-08) |
| N3-8 | R23/LGPD: `solicitante` guarda só a matrícula (`String(50)`, `@PersonalData.IsPotentiallyPersonal`); `HistoricoTratativa.autor` e `createdBy`/`modifiedBy` (`managed`) guardam o ID do usuário; nenhum nome nem e-mail no contrato. Sem audit log de acesso e sem retenção nesta spec (questão aberta da spec). | LGPD | aprovado (humano:2026-10-08) |
| N3-9 | Dependência nova: **nenhuma**. Medido: build, testes, lint e arch passam com as dependências atuais. `xs-security.json` e `mta.yaml`: **não criados** nesta spec. | dependência nova; deploy | aprovado (humano:2026-10-08) |
| N3-10 | Autenticação de produção (registrado, **não executado** nestas tasks): `cds.requires.auth` `[production]`, `xs-security.json` (papéis `Administrador`, `AplicativoOrigem`), provável dependência `@sap/xssec` e bindings. Adiado ao intent de deploy (014) por H1; aprovar aqui só o adiamento. | `cds.requires`, `xs-security.json`, dependência nova, deploy | aprovado (humano:2026-10-08) |
| N3-11 | Contrato OData de usuários (D4): `POST /api/tratativa/v1/criarTratativaAvulsa` com exatamente `titulo` (≤200), `criticidade` (≤10), `descricao` (≤5000), `unidade` (≤100), `area` (≤100), `solicitante` (≤50); retorno `{ codigo }` UUID v4; 200 na criação; erros da seção "Contrato de erros" (inclui 403 para aplicativo). | contrato público (D4: consumidores externos usam o OData do CAP) | aprovado (humano:2026-10-08) |
| N3-12 | Contrato OData de administração (D4): `/api/administracao/v1` com entity sets `PrazosCriticidade` (chave `criticidade`; `dias` 1..3650; READ e PATCH; sem POST/DELETE) e `CredenciaisAplicativo` (chave `usuarioTecnico`; `descricao`, `ativa`; campos `managed`; READ, POST e PATCH; sem DELETE). | contrato público (D4) | aprovado (humano:2026-10-08) |

## Como isso se prova
| CA | Prova | Task / arquivo de teste |
|---|---|---|
| CA1 | POST `abrirTratativa` ("Advertência", "ADV-001", `Alta`) → 200 com `codigo` | T002 `test/abertura-aplicativo.test.ts` |
| CA2 | repetição → mesmo `codigo`; 1 linha em `Tratativas` e em `ChavesOrigem` para o par | T004 `test/idempotencia.test.ts` |
| CA3 | spies em `fetch`/`https.request` com zero chamadas; nenhum `cds.RemoteService` conectado; `npm run arch` | T008 `test/sem-comunicacao-de-saida.test.ts` |
| CA4 | POST `criarTratativaAvulsa` como `usuario` → 200 com `codigo`; `origem`/`idOrigem` nulos | T007 `test/tratativa-avulsa.test.ts` |
| CA5 | Criticidade "Urgente" → 400 `target: criticidade`; nada gravado | T003 `test/validacao-abertura.test.ts` (aplicativo); T007 (avulsa) |
| CA6, CA7, CA29, CA30 | instante fixado em 2026-10-07 (Brasília): Crítica → 2026-10-10, Baixa → 2026-11-06, Alta → 2026-10-14, Média → 2026-10-22 | T002 `test/abertura-aplicativo.test.ts` |
| CA8 | corpo com `dataPrevistaConclusao` → 400; nada gravado | T002 |
| CA9 | admin PATCH `Alta` = 5; nova `Alta` usa 5; a anterior mantém a data | T002 `test/prazos-parametrizados.test.ts` |
| CA10 | `usuario` e `app-origem-a` → 403 no PATCH de prazos | T001 `test/administracao.test.ts` |
| CA11 | `TratativaInternaService.alterarCriticidade` (Baixa → Crítica em 2026-10-20) → data 2026-10-10 e duas linhas de histórico; `$metadata` dos três serviços públicos sem `alterarCriticidade` | T008 `test/alteracao-criticidade.test.ts` |
| CA12, CA28 | sem `titulo` / sem `criticidade` → 400, mensagem cita "Título" / "Criticidade" | T003 (aplicativo); T007 (avulsa) |
| CA13 | só obrigatórios → linha com `descricao`, `unidade`, `area`, `solicitante` nulos | T002 |
| CA14, CA27 | só `idOrigem` / só `origem` → 400 com `target`; nada gravado. Também: aplicativo sem nenhum dos dois → 400 `target = 'origem'` (derivado de R13/R14) | T003 |
| CA15, CA16, CA17, CA18 | par com outra Origem cria outra; `"  advertência "` devolve a existente; `"Advertencia"` cria outra; repetição com `Baixa` mantém `Alta` | T004 |
| CA19 | sem autenticação → 401 na abertura (T002); aplicativo não registrado → 401 (T006) | T002, T006 |
| CA20, CA32 | consulta sem credencial / credencial revogada → 401 com corpo `Unauthorized`, sem nenhum valor da Tratativa; abertura revogada não grava | T006 `test/credencial-aplicativo.test.ts` |
| CA21, CA22, CA23 | consulta por Código e por par devolve exatamente as 7 chaves; inexistente → 404; Código mal formado → 400 (decisão 14) | T005 `test/consulta-aplicativo.test.ts` |
| CA38 (R17 esclarecida; H5) | `app-origem-a` em `criarTratativaAvulsa` → 403; nada gravado | T007 `test/tratativa-avulsa.test.ts` |
| CA24 | `status = 'Aberta'` e linha `Criacao` com `autor` e `tipoAutor` (`Aplicativo` em T002, `Usuario` em T007) | T002, T007 |
| CA25, CA37 | `nomeVitima` / `nomeSolicitante` / `emailSolicitante` → 400; nada gravado | T002 |
| CA26 | Origem "Auditoria de Qualidade" abre sem configuração | T002 |
| CA31 | avulsa sem autenticação → 401; nada gravado | T007 |
| CA33 | duas avulsas iguais → dois `codigo` distintos | T007 |
| CA34 | amostra: dois Códigos distintos e v4; invariante: chave primária (decisão 2) | T002 |
| CA35 | regex v4 + Código não contém Origem nem ID_Origem; "não depende da ordem" = propriedade da v4 (decisão 2) | T002 |
| CA36 | `solicitante` gravado = matrícula; `Tratativas` não tem elemento de nome/e-mail (via `cds.model`) | T002 |
| Genericidade (R9) | regra ESLint (decisão 13) provada por `test/genericidade-lint.test.ts` + CA26 | T001, T002 |

Todas as consultas de verificação de "nada gravado" leem o banco direto no teste (`SELECT.from('br.com.calazanstec.Tratativas')` via `cds.db`), sem operação pública.

## O que não muda
- `db/schema.cds`, `srv/index.ts`, `test/fumaca.test.ts`, `.dependency-cruiser.cjs`, `tsconfig.json` e o conjunto de dependências do `package.json`.
- Nenhuma integração externa (`srv/integracoes/` não é criado); nenhum `app/`; nenhum `mta.yaml` ou `xs-security.json`.
- Fronteiras D2: `db/` não depende de `srv/`; o domínio em `srv/tratativa/` não importa SDK externo.
- Conceitos do papel do arquiteto que pertencem a outros intents não são criados aqui: `metodologiaData`, `Acoes`, `HistoricoAcoes`, `delegarAcao`, `submeterParaAval`, `darAvalSESMT` (004 e seguintes); `@Common.SemanticObject` em `idOrigem` entra com o app Fiori (003).

## O desconfortável, declarado
- **Produção sem autenticação definida.** As tasks deixam o sistema correto e testado com autenticação mockada; não há configuração de produção (N3-10; H1 adiado ao intent 014). Implantar no BTP antes disso é inseguro. Como o `CredenciaisAplicativo` é chaveado por `req.user.id`, o valor que o provedor de produção põe nesse campo para um token técnico ainda não foi medido (inferido).
- **Seed da tabela de prazos no HANA:** medido que `cds build --production` gera `br.com.calazanstec-PrazosCriticidade.hdbtabledata`; no HDI esse artefato tende a reimpor o CSV a cada deploy, apagando ajustes do Administrador (R11) — inferido, não medido em HANA. Decisão adiada ao intent 014, antes do primeiro deploy (H4).
- **Empacotamento TypeScript de produção:** `cds build` copia os `.ts` sem compilar; o runtime de produção não carrega `.ts`. Vale também para o scaffold atual; fica para a task de deploy (D8).
- **Corrida em pedidos idênticos simultâneos:** a garantia é a chave primária de `ChavesOrigem` (decisão 3); o teste de T004 com pedidos paralelos é amostra fraca, porque o SQLite em memória serializa as escritas.
- **Fuso horário da data civil** fixado como constante de plataforma (`America/Sao_Paulo`, H2) em `relogio.ts`; uma operação em outro fuso verá a data civil de Brasília.
- **ID_Origem comparado exatamente** (H3): `"123"` e `" 123 "` são registros diferentes e geram Tratativas diferentes. Só a Origem é normalizada.
- **Genericidade em `.cds` e CSV** continua por revisão; a regra ESLint cobre só `.ts`.
- **Histórico mínimo** (`HistoricoTratativa`) será absorvido ou migrado pelo intent 008; até lá não há leitura pública dele.
- **Sem log de acesso a dado pessoal** (sem `@cap-js/audit-logging`); a anotação `@PersonalData` só documenta.

## Decisões H1–H5 (tomadas pelo orquestrador por delegação do humano, 2026-10-07; registro em `agentic/.estado/execucao/2026-10-07-abertura-por-apps-de-origem/progress.md`)
- **H1 — adiado ao intent de deploy (014).** Mecanismo de credencial de aplicativo em produção; recomendação registrada: SAP Cloud Identity Services, um client por aplicativo de origem. A revogação imediata continua pelo registro `CredenciaisAplicativo` em qualquer opção. N3-10 fica registrado e não executado.
- **H2 — `America/Sao_Paulo`.** Fuso da Data de criação e da Data prevista (decisão 8).
- **H3 — não.** Só a Origem é normalizada (trim e minúsculas); o ID_Origem é comparado exatamente (decisão 3).
- **H4 — adiado ao intent 014.** Carga inicial da tabela de prazos no HANA sem sobrescrever ajustes do Administrador.
- **H5 — não.** Identidade com papel `AplicativoOrigem` é recusada com 403 ao criar avulsa (decisão 15; N3-3; caso de teste em T007). Derivado da nota da spec sobre R13/R14.
- **M9 —** `managed` (quem e quando) basta como trilha de alteração da tabela de prazos e das credenciais no MVP.
- **I4 — opção (a):** manter 401 para credencial ausente/revogada; o contrato afirma só status 401, corpo `Unauthorized` e nenhum dado de Tratativa (decisão 10).
- **Registro da delegação:** a delegação do humano ao orquestrador foi registrada como Ruling em `progress.md`. Os itens N3-1 a N3-12, a R17 esclarecida e as decisões H1–H5 e I4 foram aprovados pelo humano no Gate 1 em 2026-10-08, item a item.
- **Spec:** o `dominio` registra a decisão 15 na spec (R17 esclarecida e CA38: aplicativo recebe 403 ao criar avulsa); este design e a T007 já referenciam CA38.
