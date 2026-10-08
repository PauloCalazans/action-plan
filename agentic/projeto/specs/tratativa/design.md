# Design: tratativa

**Spec:** agentic/projeto/specs/tratativa/spec.md
**Status:** aprovado

Escopo técnico: ciclo de vida da Tratativa para usuários (Status e transições, edição, alteração de Criticidade pelo Gestor), consulta e listagem para usuários, papel `GestorTratativa`, e os três ajustes de robustez herdados do 002 (autor e tipo de autor validados, serialização por Tratativa, campo indicado nas recusas). Tudo no `TratativaService` (`/api/tratativa/v1`) e no domínio `srv/tratativa/`. Sem UI Fiori (intent 013), sem Ações (004), sem leitura do histórico (008).

## Decisões

1. **Modelo: mudança só aditiva em `db/tratativa.cds`** (R1, R5, R9, R15, R24; spec "Questões em aberto" LGPD).
   - `StatusTratativa` ganha `EmAndamento = 'Em andamento'`, `Encerrada`, `Cancelada` (cabe em `String(20)`); `default 'Aberta'` permanece.
   - `EventoHistorico` ganha `MudancaStatus`, `Encerramento`, `Reabertura`, `Cancelamento`, `Edicao`.
   - `HistoricoTratativa` ganha `justificativa : String(500)`; `valorAnterior`, `valorNovo` e `justificativa` recebem `@PersonalData.IsPotentiallyPersonal` (a edição do Solicitante grava a matrícula nesses campos; a justificativa é texto livre).
   - `Tratativas` ganha `origemNormalizada`, `unidadeNormalizada`, `areaNormalizada` (`String(100)`, opcionais), cópias `trim().toLowerCase()` (acentos preservados) gravadas pela plataforma na abertura e na edição, nunca expostas.
   — **Por quê:** as colunas novas são a forma portátil de cumprir R24: medido que o `lower()` do SQLite só converte ASCII (`lower('MANUTENÇÃO')` → `manutenÇÃo`), então comparar no banco com `lower(trim(x))` falharia CA71 nos testes e se comportaria diferente no HANA; normalizar em JS e comparar por igualdade vale igual nos dois bancos. Nada foi implantado no HANA: não há migração destrutiva. — **Verificado por:** `cds compile --to sql` (medido: só `ADD` de 3 colunas em `Tratativas` e 1 em `HistoricoTratativa`; 5 tabelas, como antes); `npm run build`; testes das etapas 1 a 4.

2. **Superfície do `TratativaService`: leitura por functions, ciclo de vida por actions ligadas a um entity set-âncora** (R2, R12, R13, R18, R23-R26; D4, D6).
   - `function listarTratativas(origem, idOrigem, criticidade, status, unidade, area, tamanhoPagina, pagina) returns many ItemListagem` (R24, R25).
   - `function consultarTratativa(codigo) returns DetalheTratativa` (R26).
   - `entity Tratativas as projection on m.Tratativas { key codigo }`, `@readonly`, com as actions ligadas `mudarStatus(status, justificativa)`, `editar(titulo, descricao, unidade, area, solicitante)` e `mudarCriticidade(criticidade)`; chamadas como `POST /api/tratativa/v1/Tratativas(<codigo>)/<action>` (medido: com e sem o prefixo `TratativaService.`; resposta 204 sem corpo).
   - Leitura do entity set (`GET Tratativas`, `Tratativas(<codigo>)`, `$count`) é recusada pelo handler com **405** `Use as functions listarTratativas e consultarTratativa.` (medido: sem handler, o `@restrict` só com actions deixa o `READ` aberto a todo autenticado e devolveria a lista de Códigos).
   — **Por quê:** a action ligada põe a chave na URL, então o corpo de `editar` só aceita os cinco campos editáveis e o runtime recusa Código, Origem, ID_Origem, Data de criação, Status, Criticidade e Data prevista como campo desconhecido (CA28, CA34; medido: `400 Property "codigo" does not exist in editar`); uma action não ligada precisaria do Código no corpo e CA28 não se cumpriria. A leitura por functions com tipo de retorno explícito (padrão do 002) dá controle total do que sai: a listagem tem dez campos e as chaves `descricao` e `solicitante` ficam ausentes do item para todos, inclusive o Gestor (CA48, CA60, CA70); o detalhe tem doze e os dois vêm `null` para quem não é Gestor (R23, CA48, CA69; ver item C). Filtros com a semântica de R24 (sem caixa, sem espaços, recusa de valor fora da lista, página máxima recusada e não truncada) não cabem no `$filter`/`$top` do OData sem reescrever a CQN. Os nomes `mudarStatus`/`mudarCriticidade` (e não `alterar…`) são obrigatórios: o teste do 002 `test/alteracao-criticidade.test.ts` (commit `test(red):`, intocável) exige que o `$metadata` de `/api/tratativa/v1` não contenha `alterarCriticidade` (medido: falha com o nome `alterarCriticidade`; passa com `mudarCriticidade`). Isso também separa no contrato a regra interna (sem endpoint) da operação pública do Gestor. — **Verificado por:** esqueleto (medido); testes das etapas.

3. **Papel `GestorTratativa` e recusa do aplicativo** (R8, R23, CA17-CA19, CA39, CA49).
   - `@restrict: [{ grant: ['mudarStatus', 'editar', 'mudarCriticidade'], to: 'GestorTratativa' }]` no entity set (medido: `usuario`, `admin` e `app-origem-a` → 403; `gestor` chega ao handler).
   - `before('*')` no `TratativaService`: identidade com papel `AplicativoOrigem` → **403**; em `criarTratativaAvulsa` a mensagem continua `Aplicativo de origem não cria Tratativa avulsa.` (decisão 15 do 002), nos demais eventos `Aplicativo de origem não usa este serviço.` (medido: `listarTratativas` como `app-origem-a` → 403 com a mensagem).
   - `listarTratativas` e `consultarTratativa` ficam com o `@requires: 'authenticated-user'` do serviço; `verOcultos = req.user.is('GestorTratativa')`.
   - Usuário mockado `gestor` com `roles: ["GestorTratativa"]` no perfil `[development]` do `package.json`; nenhum outro usuário muda.
   — **Por quê:** papel genérico, não SESMT (AGENTS.md:36); atribuição a pessoas em produção é do intent 014 (N3-10 do 002 continua adiado). — **Verificado por:** esqueleto (401/403/501 medidos) e testes das etapas.

4. **Precedência das recusas (R31) mapeada a mecanismos, com uma camada do runtime declarada:**
   | Ordem | Verificação | Quem | HTTP |
   |---|---|---|---|
   | 1 | autenticação | runtime (`@requires`) | 401 |
   | 2 | papel | runtime (`@restrict` nas actions) e `before('*')` (aplicativo) | 403 |
   | 2a | forma do pedido: campo fora da assinatura, valor de tipo errado (ex.: `titulo: 5`, `tamanhoPagina='abc'`) | runtime | 400 |
   | 3 | existência da Tratativa | domínio (leitura com bloqueio, decisão 6) | 404 `Tratativa não encontrada.` |
   | 4 | estado (R14, R4) | domínio | **409** |
   | 5 | campos (R5, R12, R19, R22) | domínio | 400 com `target` |
   Os parâmetros das actions ligadas são `String` **sem tamanho** de propósito: o runtime não verifica tamanho neles (medido: título com 201 e com 6000 caracteres chegam ao handler), então o tamanho é verificado no passo 5, depois do estado (ex.: Tratativa `Encerrada` + Título de 201 caracteres → 409, não 400). — **Por quê:** os passos 1, 2 e 3-5 seguem R31 literalmente. O passo 2a é do runtime CAP e acontece antes do handler (medido: Gestor + campo desconhecido → 400 mesmo para Tratativa inexistente; aplicativo + `tamanhoPagina='abc'` → 400 antes do 403 do handler; usuário sem papel + campo desconhecido → 403, papel continua antes). Ver "Decisões que exigem o humano", item A. — **Verificado por:** esqueleto (medido) e CA73 e casos de R31 nas etapas 1, 3 e 4.

5. **Limites de tamanho (validados no domínio, mensagem nomeia o campo):** Título 200, Descrição 5000, Unidade 100, Área 100, Solicitante 50 (R12; iguais aos da abertura), Justificativa 500 (R5), todos contados em `string.length` depois de remover espaços nas pontas no caso da Justificativa e sobre o valor enviado nos demais. Mensagem: `O campo <Nome> aceita no máximo <n> caracteres.`, `target` = parâmetro. — **Por quê:** R12/R5 e decisão 4. — **Verificado por:** CA13, CA27 e casos por campo nas etapas 1 e 3.

6. **Serialização por Tratativa (R21): bloqueio pessimista de linha, `SELECT ... FOR UPDATE`, como primeira leitura de toda operação de ciclo de vida, na transação do pedido.**
   - Função única `bloquearTratativa(codigo)` em `srv/tratativa/bloqueio.ts`: `SELECT.from(Tratativas).where({ codigo }).forUpdate()` (sem `.one` e sem `limit`: o Código é chave, e assim o SQL fica `... WHERE codigo = ? FOR UPDATE`, sem combinar `LIMIT` com `FOR UPDATE` no HANA). Devolve a linha ou recusa 404. Toda decisão (estado, valores anteriores, histórico) usa a linha bloqueada; nenhuma operação lê a Tratativa antes dela.
   - Usada por `mudarStatus`, `editar`, `mudarCriticidade` e pela regra interna `alterarCriticidade` do 002. Cada operação bloqueia uma única linha de `Tratativas` e depois escreve nessa linha e insere em `HistoricoTratativa`: não há ciclo de bloqueios, logo não há deadlock entre elas. Regra para os intents seguintes (004, 005): bloquear a Tratativa primeiro (decisão de plataforma D9 abaixo).
   - Medido no CAP 10.1.1: o renderizador SQL genérico (`@cap-js/db-service`, base do `@cap-js/hana`) produz `... WHERE "$T".codigo = ? ... FOR UPDATE`; o do SQLite remove a cláusula (`forUpdate() { return '' }` em `@cap-js/sqlite/lib/SQLiteService.js`). Nos testes a serialização vem do pool de 1 conexão do SQLite em memória (medido: dois `mudarStatus` simultâneos para `Encerrada`, com espera de 50 ms entre leitura e escrita → 204 e 409 `Transição não permitida: de Encerrada para Encerrada.`, um único Encerramento).
   — **Por quê:** no HANA o isolamento padrão é READ COMMITTED; sem bloqueio, duas transações leem o mesmo Status e ambas gravam (dois Encerramentos, ou Criticidade e Data prevista de pedidos diferentes). `FOR UPDATE` faz a segunda esperar o commit da primeira e ler o valor já gravado. Alternativa descartada: UPDATE condicional (`where status = <lido>`) com contagem de linhas, porque cobre transições mas não edição nem a cadeia de histórico da Criticidade, e criaria uma recusa "tente de novo" que a spec não tem. — **Verificado por:** (a) **prova estrutural, independente do banco**, em cada etapa: um espião `cds.db.before('*')` (helper `test/apoio/banco-espiao.ts`) registra os comandos do pedido e o teste exige que, entre `BEGIN` e `COMMIT`, o primeiro comando sobre `br.com.calazanstec.Tratativas` seja `READ` com `forUpdate` e que nenhum `UPDATE`/`CREATE` venha antes dele (medido: a sequência observada é `BEGIN, READ(forUpdate=true), UPDATE, CREATE, COMMIT`, todos com o mesmo `cds.context.id`); (b) amostras funcionais CA45, CA46 e CA72 com pedidos simultâneos (fracas no SQLite, que já serializa); (c) o renderizador genérico emite `FOR UPDATE` (medição acima, registrada aqui, não teste). O comportamento real no HANA não é medido nesta spec (ver "O desconfortável").

7. **Atomicidade (R10): toda operação roda na transação do pedido.** Os handlers e o domínio usam `cds.db.run`/`SELECT`/`UPDATE`/`INSERT` dentro do contexto do pedido; o CAP junta essas chamadas à transação raiz e faz rollback se qualquer passo lança erro (medido: falha injetada no `CREATE` de `HistoricoTratativa` → 500, Status continua `Aberta`, só o histórico de criação existe; o mesmo via `TratativaInternaService.send` fora de pedido HTTP → Criticidade continua `Baixa`). A ordem dentro de cada operação é: bloquear, validar, `UPDATE` de todos os campos de uma vez, `INSERT` de todas as linhas de histórico de uma vez. — **Verificado por:** CA22, CA74, CA75 com o helper `falharEm('CREATE', 'HistoricoTratativa')` de `test/apoio/banco-espiao.ts` (um `cds.db.before` controlado por flag, registrado uma vez por arquivo).

8. **Transições (R2-R7, R9): operação identificada pelo Status de destino.** Tabela fixa no domínio (`srv/tratativa/ciclo-de-vida.ts`):
   | De | Para | Evento | Justificativa |
   |---|---|---|---|
   | `Aberta` | `Em andamento` | `MudancaStatus` | opcional |
   | `Aberta` | `Encerrada` | `Encerramento` | opcional |
   | `Aberta` | `Cancelada` | `Cancelamento` | obrigatória |
   | `Em andamento` | `Encerrada` | `Encerramento` | opcional |
   | `Em andamento` | `Cancelada` | `Cancelamento` | obrigatória |
   | `Encerrada` | `Em andamento` | `Reabertura` | obrigatória |
   Ordem em `mudarStatus`: bloquear (404) → `status` ausente ou só espaços → 400 `O campo Status é obrigatório.` (`target: status`) → par fora da tabela (inclui o mesmo Status, `Cancelada` como origem e qualquer valor fora da lista, ex.: `Pendente`) → **409** `Transição não permitida: de <atual> para <pedido>.` (`target: status`) → justificativa obrigatória ausente/só espaços → 400 `O campo Justificativa é obrigatório para cancelar e reabrir.` → justificativa com mais de 500 caracteres (após `trim`) → 400 `O campo Justificativa aceita no máximo 500 caracteres.` (ambos `target: justificativa`) → `UPDATE status` + uma linha de histórico (`evento` da tabela, `campo = 'status'`, `valorAnterior`, `valorNovo`, `justificativa` aparada ou `null`, `autor = req.user.id`, `tipoAutor = 'Usuario'`, `quando = agora()`). Criticidade e Data prevista não mudam em nenhuma transição (R6). Sem pré-condição de Ações (R7). — **Por quê:** R2, R4, R5, R9; o Status ausente é verificado antes do estado porque sem destino não há par a avaliar (interpretação; ver item C). — **Verificado por:** etapa 1.

9. **Edição (R12, R13, R15, R17): `editar` com semântica "ausente não muda; `null` ou só espaços apaga".** O handler passa `req.data` como veio (medido: chave ausente não aparece em `req.data`; `null` explícito aparece). Ordem: bloquear (404) → R14 (`Encerrada`/`Cancelada`) → 409 `Tratativa <Status> não pode ser alterada.` → campos na ordem `titulo`, `descricao`, `unidade`, `area`, `solicitante`: `titulo` presente e `null`/só espaços → 400 `O campo Título é obrigatório.`; tamanho (decisão 5). Valor gravado: como enviado; só espaços → `null` nos opcionais. Campo "realmente alterado" = valor final diferente do gravado (comparação exata de texto). Sem campo alterado → 204 sem `UPDATE` nem histórico (CA32). Com alteração: um `UPDATE` com todos os campos alterados (e `unidadeNormalizada`/`areaNormalizada` quando Unidade/Área mudam) e uma linha `Edicao` por campo (`campo` = nome do elemento: `titulo`, `descricao`, `unidade`, `area`, `solicitante`; `valorAnterior`/`valorNovo`; para `descricao` ambos `null`, R15). A plataforma nunca preenche o Solicitante sozinha (R17). — **Verificado por:** etapa 3.

10. **Alteração de Criticidade pública reutiliza a regra interna** (R14, R18-R20, R22). `mudarCriticidade` chama a mesma função de domínio `alterarCriticidade(codigo, criticidade, { id: req.user.id, tipo: 'Usuario' })` de `srv/tratativa/criticidade.ts` que o `TratativaInternaService` usa (mesma transação; sem passar pelo serviço interno). A função passa a ter esta ordem: `validarAutor` (R20; equivale à autenticação do chamador interno) → bloquear (404) → R14 → 409 `Tratativa <Status> não pode ser alterada.` (vale também para `tipoAutor = 'Sistema'`, CA76) → Criticidade ausente ou fora da lista → 400 `Criticidade inválida: use Baixa, Média, Alta ou Crítica.` (`target: criticidade`, R19) → mesma Criticidade: nada → recálculo e duas linhas `AlteracaoCriticidade` (como no 002). Os testes do 002 continuam válidos (medido: suíte do 002 inteira verde com o novo contrato). — **Verificado por:** etapa 4 e a suíte do 002.

11. **Autor e tipo de autor (R20) no domínio:** `validarAutor(autor)` em `srv/tratativa/historico.ts`: `autor.id` ausente ou só espaços → 400 `O campo Autor é obrigatório.` (`target: autor`); `autor.tipo` fora de `Aplicativo`, `Usuario`, `Sistema` (lidos do tipo `TipoAutor` do modelo) → 400 `Tipo de autor inválido: use Aplicativo, Usuario ou Sistema.` (`target: tipoAutor`). Chamada no início de `mudarStatus`, `editarTratativa` e `alterarCriticidade`, e de novo dentro de `registrarHistorico` (guarda do invariante). A abertura do 002 não muda nesse ponto: seus autores vêm sempre de `req.user.id`. — **Verificado por:** CA42-CA44 (etapa 4).

12. **Listagem (R24, R25):** ordem de verificação depois do papel: `criticidade` informada e fora da lista → 400 `Criticidade inválida: use Baixa, Média, Alta ou Crítica.` → `status` informado e fora da lista → 400 `Status inválido: use Aberta, Em andamento, Encerrada ou Cancelada.` → `tamanhoPagina` (padrão 50) fora de 1..200 → 400 `O campo Tamanho da página aceita de 1 a 200.` → `pagina` (padrão 1, começa em 1) menor que 1 → 400 `O campo Página deve ser 1 ou maior.` (cada uma com `target` = parâmetro). Filtro ausente, vazio ou só espaços não filtra. Origem, Unidade e Área: igualdade com `origemNormalizada`/`unidadeNormalizada`/`areaNormalizada` do valor `normalizarTexto(filtro)`; ID_Origem, Criticidade e Status: igualdade exata. Ordem: `dataPrevistaConclusao`, `dataCriacao`, `codigo`, todos crescentes. Página: `limit(tamanhoPagina, (pagina - 1) * tamanhoPagina)`. Colunas: as dez de `ItemListagem`. `$top`/`$skip` não fazem parte do contrato (medido: ignorados pela function). — **Verificado por:** etapa 2.

13. **Consulta (R23, R26, R27, R28):** `consultarTratativa(codigo)`: `codigo` ausente ou fora do formato UUID → 400 `Código inválido.` (`target: codigo`, mesma regra da decisão 14 do 002; o runtime não valida o formato); comparado em minúsculas; inexistente → 404 `Tratativa não encontrada.`; devolve os doze campos de `DetalheTratativa`, com `descricao` e `solicitante` `null` quando `verOcultos` é falso. Nas actions ligadas a chave vem na URL: Código mal formado é tratado como inexistente (404), sem regra própria (medido: `Tratativas(abc)/editar` chega ao handler). — **Verificado por:** etapa 2.

14. **Domínio novo em `srv/tratativa/`, handlers finos.** Assinaturas fixas (I1):
   ```ts
   // srv/tratativa/recusa.ts
   export function recusar(status: number, message: string, target?: string): never; // Error com status, code e target
   // srv/tratativa/dominios.ts — valores dos enums do modelo (cds.model)
   export function criticidadesValidas(): string[];
   export function statusValidos(): string[];
   export function tiposAutorValidos(): string[];
   // srv/tratativa/normalizacao.ts
   export function normalizarTexto(valor?: string | null): string | null; // trim + toLowerCase; '' → null
   // srv/tratativa/bloqueio.ts
   export interface TratativaBloqueada {
     codigo: string; titulo: string; descricao: string | null; unidade: string | null; area: string | null;
     solicitante: string | null; criticidade: string; status: string; dataCriacao: string; dataPrevistaConclusao: string;
   }
   export async function bloquearTratativa(codigo: string): Promise<TratativaBloqueada>; // 404 se não existe
   export function exigirAlteravel(t: TratativaBloqueada): void; // R14: 409
   // srv/tratativa/historico.ts
   export interface LinhaHistorico {
     evento: string; campo?: string | null; valorAnterior?: string | null; valorNovo?: string | null; justificativa?: string | null;
   }
   export function validarAutor(autor: Autor): void; // R20: 400 autor / tipoAutor
   export async function registrarHistorico(codigo: string, autor: Autor, linhas: LinhaHistorico[], quando: Date): Promise<void>;
   // srv/tratativa/ciclo-de-vida.ts
   export async function mudarStatus(codigo: string, pedido: { status?: string | null; justificativa?: string | null }, autor: Autor): Promise<void>;
   // srv/tratativa/edicao.ts
   export interface CamposEditaveis { titulo?: string | null; descricao?: string | null; unidade?: string | null; area?: string | null; solicitante?: string | null }
   export async function editarTratativa(codigo: string, campos: CamposEditaveis, autor: Autor): Promise<void>;
   // srv/tratativa/criticidade.ts (já existe; assinatura passa a aceitar ausente)
   export async function alterarCriticidade(codigo: string, nova: string | null | undefined, autor: Autor): Promise<void>;
   // srv/tratativa/listagem.ts
   export interface FiltrosListagem {
     origem?: string | null; idOrigem?: string | null; criticidade?: string | null; status?: string | null;
     unidade?: string | null; area?: string | null; tamanhoPagina?: number | null; pagina?: number | null;
   }
   export interface ItemListagem { codigo: string; titulo: string; origem: string | null; idOrigem: string | null; criticidade: string; status: string; unidade: string | null; area: string | null; dataCriacao: string; dataPrevistaConclusao: string }
   export interface DetalheTratativa extends ItemListagem { descricao: string | null; solicitante: string | null }
   export async function listarTratativas(filtros: FiltrosListagem): Promise<ItemListagem[]>;
   export async function consultarTratativa(codigo: string | null | undefined, verOcultos: boolean): Promise<DetalheTratativa>;
   ```
   `Autor`/`TipoAutor` continuam em `srv/tratativa/abertura.ts`. `abrirTratativa` passa a gravar as três colunas normalizadas com `normalizarTexto` (nada mais muda nela). `validacao.ts`, `chave-origem.ts`, `consulta.ts` e `prazo.ts` não mudam. Handlers de `srv/tratativa-service.ts`: montam `{ id: req.user.id, tipo: 'Usuario' }`, extraem o Código de `req.params[0].codigo` (medido: `params: [{ codigo }]`) e delegam; nenhuma regra no handler além do 403 do aplicativo e do 405 de leitura. — **Por quê:** mesmo padrão do 002 (domínio testável, handler fino). — **Verificado por:** revisão; `npm run build`.

15. **`testTimeout: 60000` no `jest.config.js`** (correção do teste instável: a primeira subida do `cds.test` passa de 5 s em máquina fria). Os `jest.setTimeout(60000)` locais dos testes existentes ficam (são de commits `test(red):`). — **Verificado por:** `npm test` (medido verde com a opção).

16. **R29: o Status novo aparece na consulta do aplicativo sem mudar o formato.** `ConsultaTratativa` continua com os mesmos sete campos (medido no `$metadata`); o único efeito no `$metadata` de `/api/integracao-origem/v1` é a anotação `Validation.AllowedValues` do campo `status`, que ganha três registros (`Em andamento`, `Encerrada`, `Cancelada`) — medido por `diff` do EDMX antes e depois. Pela D6 é mudança aditiva: não cria `/v2`. — **Verificado por:** esqueleto; CA64 (etapa 1).

17. **LGPD:** listagem sem Descrição e Solicitante; detalhe com os dois só para o Gestor; histórico nunca copia a Descrição; `justificativa`, `valorAnterior` e `valorNovo` anotados `@PersonalData.IsPotentiallyPersonal`; nenhuma leitura pública do histórico (008). Título visível a todo autenticado (questão da spec, item 14). Sem audit log de acesso e sem retenção (continua questão aberta da spec). — **Verificado por:** CA48, CA60, CA61, CA69, CA70, CA33; `$metadata` (esqueleto).

18. **Sem comunicação de saída (R29, CA65):** nenhum módulo novo importa cliente HTTP, SDK ou `srv/integracoes/`; `cds.requires` não ganha serviço remoto. — **Verificado por:** `npm run arch`; teste da etapa 4 com espiões de `fetch`/`https.request` (mesmo padrão da decisão 16 do 002).

### Decisões de plataforma a registrar em `agentic/projeto/decisoes.md` (etapa 1, GREEN)
Texto final, a copiar sem mudança depois de D8, na seção "Vigentes" (formato de D6-D8):

```markdown
### D9 — Serialização por agregado
- **Decisão:** toda operação que lê uma Tratativa para decidir e depois escreve sobre ela (e, nos intents seguintes, sobre Ações e Responsáveis dela) começa com `bloquearTratativa(codigo)` (`srv/tratativa/bloqueio.ts`: `SELECT ... FOR UPDATE` sem `.one` e sem `LIMIT`) na transação do pedido, e bloqueia a Tratativa antes de qualquer outra linha; nenhuma decisão usa leitura anterior ao bloqueio.
- **Por quê:** no HANA o isolamento padrão é READ COMMITTED; sem bloqueio, dois pedidos simultâneos leem o mesmo estado e ambos gravam (dois Encerramentos, Criticidade e Data prevista de pedidos diferentes). Bloquear sempre a Tratativa primeiro evita ciclo de bloqueios entre operações.
- **Consequência:** 004 e 005 bloqueiam a Tratativa antes de tocar Ações ou Responsáveis; o SQLite dos testes não emite `FOR UPDATE` (o pool de 1 conexão já serializa), então a prova automatizada é estrutural e o comportamento no HANA é conferido no primeiro deploy (intent 014).
- **Verificado por:** espião `cds.db.before` (`test/apoio/banco-espiao.ts`, `bloqueiaAntesDeEscrever`) nos testes das etapas 1, 3 e 4 da task tratativa/001 (CA45, CA46, CA72); medição do renderizador SQL genérico registrada no design da spec tratativa (decisão 6)
- **Data:** 2026-10-07

### D10 — Contrato de recusas dos serviços de usuário
- **Decisão:** nos serviços consumidos por usuários (hoje, `TratativaService`), a recusa segue esta precedência e estes códigos: 401 autenticação, 403 papel (inclui identidade `AplicativoOrigem`), 400 forma do pedido recusada pelo runtime (campo fora da assinatura, valor de tipo errado), 404 Tratativa inexistente, **409 estado** (transição não permitida, Tratativa que não pode ser alterada), 400 campo inválido com `target` = parâmetro. Ressalva (R31): para o aplicativo de origem nas functions do serviço de usuários, o 400 de forma pode vir antes do 403 de papel, porque o runtime valida os parâmetros antes do `before('*')` que recusa o aplicativo (ex.: `tamanhoPagina='abc'` → 400).
- **Por quê:** R31 da spec tratativa fixa a ordem papel → existência → estado → campos; 409 separa "o pedido é válido mas o estado atual não permite" de "o dado está errado" (400), e a forma do pedido é verificada pelo runtime CAP antes do handler.
- **Consequência:** 004 e 005 reutilizam os códigos, as mensagens de estado do 003 e o `recusar(status, message, target)` de `srv/tratativa/recusa.ts`; validação de tamanho fica no domínio, depois do estado (parâmetros `String` sem tamanho nas actions).
- **Verificado por:** CA73 (etapa 1), CA29 (etapa 3), CA30 (etapa 4) e os casos de R31 das etapas 1, 3 e 4 da task tratativa/001 (papel antes de estado, estado antes de campo); contrato de erros do design da spec tratativa
- **Data:** 2026-10-07
```

## Contrato executável
- **O que é:** `db/tratativa.cds` com o diff da decisão 1, `srv/tratativa-service.cds` completo (abaixo), o usuário `gestor` no `package.json`, a opção `testTimeout` do `jest.config.js` e o teste-esqueleto `test/contrato-tratativa.test.ts` (abaixo), que chama o OData V4 e valida superfície, autorização declarativa, recusa de campo desconhecido, ausência de verificação de tamanho no runtime, 405 de escrita no entity set, os sete campos da consulta do aplicativo e a leitura com `forUpdate` vista pelo banco. Construído e medido numa cópia do repositório fora da árvore de trabalho (rascunho da sessão, `git archive HEAD` + `node_modules` do repositório por junção); **nada foi gravado em `db/`, `srv/`, `test/`, `package.json` ou `jest.config.js` do repositório**. O esqueleto não é commitado (as asserções de 501 deixam de valer com os handlers); os testes das etapas o substituem.
- **Como se valida:** `npx cds compile srv --to sql`, `npm run build`, `npx jest --silent --verbose`, `npm run lint`, `npm run arch`, na cópia.
- **Saída da validação (medido, 2026-10-07, CAP 10.1.1, Node 24.19.0):**
```
$ npx cds compile srv --to sql | grep -c "CREATE TABLE"
5
$ diff ddl-antes.sql ddl-depois.sql
31a32,34
>   origemNormalizada NVARCHAR(100),
>   unidadeNormalizada NVARCHAR(100),
>   areaNormalizada NVARCHAR(100),
53a57
>   justificativa NVARCHAR(500),
$ npm run build
build completed in 3686 ms
$ npx jest --silent --verbose
PASS test/fumaca.test.ts
PASS test/prazos-parametrizados.test.ts
PASS test/validacao-abertura.test.ts
PASS test/alteracao-criticidade.test.ts
PASS test/administracao.test.ts
PASS test/tratativa-avulsa.test.ts
PASS test/idempotencia.test.ts
PASS test/sem-comunicacao-de-saida.test.ts
PASS test/credencial-aplicativo.test.ts
PASS test/consulta-aplicativo.test.ts
PASS test/abertura-aplicativo.test.ts
PASS test/contrato-tratativa.test.ts
    √ $metadata: functions de leitura, actions ligadas e tipos de retorno (36 ms)
    √ autenticação e papel: 401 anônimo; 403 sem GestorTratativa; Gestor chega ao handler (501) (227 ms)
    √ CA28/CA34: campo fora da assinatura de editar → 400 do runtime; sem papel → 403 antes da forma (221 ms)
    √ R31: tamanho não é verificado pelo runtime nas actions ligadas (chega ao handler) (31 ms)
    √ CA23: não há criação, alteração nem exclusão pelo entity set (405) (94 ms)
    √ R29: a consulta do aplicativo mantém os sete campos (21 ms)
    √ decisão 6: bloqueio por Tratativa visível ao banco (forUpdate na leitura) e transação do pedido (2 ms)
PASS test/genericidade-lint.test.ts
Test Suites: 13 passed, 13 total
Tests:       87 passed, 87 total
$ npm run lint
> eslint .
(sem achados)
$ npm run arch
✔ no dependency violations found (13 modules, 25 dependencies cruised)
```
- Medições adicionais usadas nas decisões (mesmo rascunho, com handlers-sonda descartados depois):
```
action ligada sem e com prefixo:       POST Tratativas(<uuid>)/mudarStatus -> 204; .../TratativaService.mudarStatus -> 204
req.params na action ligada:           [{ "codigo": "<uuid>" }]
chave ausente x null em editar:        {unidade:null} -> req.data = { unidade: null }; {} -> req.data = {}
usuario + campo desconhecido:          403 (papel antes da forma);  anônimo + campo desconhecido: 401
gestor + campo desconhecido:           400 Property "codigo" does not exist in editar (antes do handler)
gestor + titulo: 5:                    400 ASSERT_DATA_TYPE target titulo (antes do handler)
app + tamanhoPagina='abc':             400 "Value abc is not a valid Integer" (antes do before('*') do handler)
titulo com 201 e 6000 caracteres:      chega ao handler (parâmetro String sem tamanho)
Tratativa inexistente na action:       chega ao handler (o runtime não verifica existência)
Tratativas(abc)/editar:                chega ao handler com codigo 'abc'
READ do entity set sem handler:        200 com a lista de Códigos para qualquer autenticado -> decisão 2 (405)
DELETE/PATCH/POST no entity set:       405 ENTITY_IS_READ_ONLY (gestor e admin)
espião cds.db.before na action:        BEGIN, READ(forUpdate=true), UPDATE, CREATE, COMMIT, mesmo cds.context.id
falha injetada no CREATE do histórico: 500; status continua Aberta; histórico só com Criacao (rollback)
falha injetada via serviço interno:    rejeita; Criticidade continua Baixa (rollback)
dois mudarStatus simultâneos:          204 e 409 "Transição não permitida: de Encerrada para Encerrada."; 1 Encerramento
SQL genérico, variante com .one:       SELECT ... FROM br_com_calazanstec_Tratativas as "$T" WHERE "$T".codigo = ? LIMIT ? FOR UPDATE
SQL genérico, sem .one (decisão 6):    SELECT ... FROM br_com_calazanstec_Tratativas as "$T" WHERE "$T".codigo = ? FOR UPDATE
SQL do SQLite:                         a mesma consulta, sem FOR UPDATE
SQLite lower('MANUTENÇÃO'):            'manutenÇÃo' (só ASCII); JS 'MANUTENÇÃO'.toLowerCase() = 'manutenção'
$metadata IntegracaoOrigemService:     só a anotação AllowedValues de status ganha 3 registros
nome alterarCriticidade no serviço:    quebra test/alteracao-criticidade.test.ts (002) -> nome mudarCriticidade
```

### `db/tratativa.cds` (diff sobre o atual)
```diff
-/** R20: Status inicial; demais Status pertencem ao intent 003. */
+/** R1 (spec tratativa): Status da Tratativa; toda Tratativa nasce `Aberta` (R20 do 002). */
 type StatusTratativa : String(20) enum {
   Aberta;
+  EmAndamento = 'Em andamento';
+  Encerrada;
+  Cancelada;
 }
 
-/** R12/R20: eventos de histórico do 002 (o Histórico completo é do intent 008). */
+/** Eventos de histórico do 002 e do 003 (R9, R15 da spec tratativa); o Histórico completo é do intent 008. */
 type EventoHistorico : String(30) enum {
   Criacao;
   AlteracaoCriticidade;
+  MudancaStatus;
+  Encerramento;
+  Reabertura;
+  Cancelamento;
+  Edicao;
 }
@@ entity Tratativas
       @PersonalData.IsPotentiallyPersonal
       solicitante           : String(50);
+      /** R24 (spec tratativa): cópias normalizadas (trim + minúsculas, acentos preservados) para o filtro da listagem. */
+      origemNormalizada     : String(100);
+      unidadeNormalizada    : String(100);
+      areaNormalizada       : String(100);
       criticidade           : Criticidade not null;
@@ entity HistoricoTratativa
       campo         : String(50);
+      /** Pode conter a matrícula do Solicitante (R15 da spec tratativa); a Descrição nunca é copiada. */
+      @PersonalData.IsPotentiallyPersonal
       valorAnterior : String(200);
+      @PersonalData.IsPotentiallyPersonal
       valorNovo     : String(200);
+      /** R5/R9 (spec tratativa): texto livre do Gestor na transição. */
+      @PersonalData.IsPotentiallyPersonal
+      justificativa : String(500);
       @PersonalData.IsPotentiallyPersonal
       autor         : String(256) not null;
```

### `srv/tratativa-service.cds` (arquivo completo)
```cds
using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Serviço dos usuários da plataforma (spec abertura-por-apps-de-origem R6/R17; spec tratativa R1-R31).
 * Leitura por functions com tipo de retorno explícito (R23-R26); ciclo de vida por actions ligadas à
 * Tratativa (R2, R12, R18), só para o papel GestorTratativa (R8). Aplicativo de origem é recusado com 403.
 */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  /** R25: exatamente estes dez campos na listagem (sem Descrição e sem Solicitante). */
  type ItemListagem {
    codigo                : UUID;
    titulo                : String(200);
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    unidade               : String(100);
    area                  : String(100);
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
  }

  /** R26: campos da listagem mais Descrição e Solicitante; os dois vêm null para quem não é Gestor (R23). */
  type DetalheTratativa {
    codigo                : UUID;
    titulo                : String(200);
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    unidade               : String(100);
    area                  : String(100);
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
    descricao             : String(5000);
    solicitante           : String(50);
  }

  action   criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                                unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;

  /** R24/R25: filtros combinados; página padrão 50, máximo 200; pagina começa em 1. */
  function listarTratativas(origem : String, idOrigem : String, criticidade : String, status : String,
                            unidade : String, area : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemListagem;

  /** R26: consulta pelo Código; inexistente → 404. */
  function consultarTratativa(codigo : UUID) returns DetalheTratativa;

  /**
   * Âncora das operações de ciclo de vida (R2, R12, R18). Só a chave é exposta; não há leitura,
   * criação, alteração nem exclusão pelo entity set (R11; leitura pelas functions acima).
   * Parâmetros sem tamanho de propósito: o domínio valida tamanho depois de papel, existência e estado (R31).
   */
  @readonly
  @restrict: [{ grant: ['mudarStatus', 'editar', 'mudarCriticidade'], to: 'GestorTratativa' }]
  entity Tratativas as projection on m.Tratativas { key codigo } actions {
    /** R2/R4/R5: a operação é identificada pelo Status de destino. */
    action mudarStatus(status : String, justificativa : String);
    /** R12/R13/R15: só estes campos; ausente = não muda; null ou só espaços = apaga (Título não pode). */
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);
    /** R18/R19: reutiliza a regra interna do 002 com tipo de autor Usuario. */
    action mudarCriticidade(criticidade : String);
  };
}
```

### `package.json` (só o usuário acrescentado em `cds.requires.auth["[development]"].users`; preservar os demais e as quebras de linha do arquivo)
```json
"gestor": { "password": "", "roles": ["GestorTratativa"] }
```

### `jest.config.js` (linha acrescentada depois de `testMatch`)
```js
  testTimeout: 60000, // a primeira subida do cds.test passa de 5 s (design tratativa, decisão 15)
```

### Esqueleto `test/contrato-tratativa.test.ts` (medido; não é commitado)
```ts
import cds from '@sap/cds';

const { GET, POST, PATCH, DELETE } = cds.test(__dirname + '/..');
const ok = { validateStatus: () => true };
const como = (username: string) => ({ auth: { username, password: '' }, ...ok });
const gestor = como('gestor');
const usuario = como('usuario');
const app = como('app-origem-a');
const admin = como('admin');
const B = '/api/tratativa/v1';

let codigo = '';
beforeAll(async () => {
  await cds.db.run(
    UPSERT.into('br.com.calazanstec.CredenciaisAplicativo').entries([{ usuarioTecnico: 'app-origem-a', ativa: true }]),
  );
  const r = await POST(`${B}/criarTratativaAvulsa`, { titulo: 'T', criticidade: 'Alta', unidade: 'Planta A' }, usuario);
  expect(r.status).toBe(200);
  codigo = r.data.codigo;
});

const propriedades = (xml: string, tipo: string) => {
  const m = xml.match(new RegExp(`<(?:ComplexType|EntityType) Name="${tipo}">([\\s\\S]*?)</(?:ComplexType|EntityType)>`));
  expect(m).not.toBeNull();
  return [...(m as RegExpMatchArray)[1].matchAll(/<Property Name="(\w+)"/g)].map((p) => p[1]).sort();
};

describe('contrato: tratativa (003)', () => {
  it('$metadata: functions de leitura, actions ligadas e tipos de retorno', async () => {
    const { status, data } = await GET(`${B}/$metadata`, usuario);
    expect(status).toBe(200);
    const xml = String(data);
    expect(xml).toMatch(/<Function Name="listarTratativas" IsBound="false"/);
    expect(xml).toMatch(/<Function Name="consultarTratativa" IsBound="false"/);
    for (const a of ['mudarStatus', 'editar', 'mudarCriticidade']) expect(xml).toMatch(new RegExp(`<Action Name="${a}" IsBound="true"`));
    expect(propriedades(xml, 'Tratativas')).toEqual(['codigo']);
    expect(propriedades(xml, 'ItemListagem')).toEqual(
      ['area', 'codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'idOrigem', 'origem', 'status', 'titulo', 'unidade'],
    );
    expect(propriedades(xml, 'DetalheTratativa')).toEqual(
      ['area', 'codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'descricao', 'idOrigem', 'origem',
        'solicitante', 'status', 'titulo', 'unidade'],
    );
  });

  it('autenticação e papel: 401 anônimo; 403 sem GestorTratativa; Gestor chega ao handler (501)', async () => {
    const acoes: [string, Record<string, unknown>][] = [
      ['mudarStatus', { status: 'Em andamento' }],
      ['editar', { titulo: 'Novo' }],
      ['mudarCriticidade', { criticidade: 'Baixa' }],
    ];
    for (const [acao, corpo] of acoes) {
      const url = `${B}/Tratativas(${codigo})/${acao}`;
      expect((await POST(url, corpo, ok)).status).toBe(401);
      expect((await POST(url, corpo, usuario)).status).toBe(403);
      expect((await POST(url, corpo, app)).status).toBe(403);
      expect((await POST(url, corpo, admin)).status).toBe(403);
      expect((await POST(url, corpo, gestor)).status).toBe(501);
    }
    expect((await GET(`${B}/listarTratativas()`, ok)).status).toBe(401);
    expect((await GET(`${B}/listarTratativas()`, usuario)).status).toBe(501);
    expect((await GET(`${B}/consultarTratativa(codigo=${codigo})`, usuario)).status).toBe(501);
  });

  it('CA28/CA34: campo fora da assinatura de editar → 400 do runtime; sem papel → 403 antes da forma', async () => {
    for (const campo of ['codigo', 'origem', 'idOrigem', 'dataCriacao', 'status', 'criticidade', 'dataPrevistaConclusao']) {
      const r = await POST(`${B}/Tratativas(${codigo})/editar`, { [campo]: 'x' }, gestor);
      expect(r.status).toBe(400);
      expect(r.data.error.message).toMatch(new RegExp(`Property "${campo}" does not exist`));
      expect((await POST(`${B}/Tratativas(${codigo})/editar`, { [campo]: 'x' }, usuario)).status).toBe(403);
    }
  });

  it('R31: tamanho não é verificado pelo runtime nas actions ligadas (chega ao handler)', async () => {
    const r = await POST(`${B}/Tratativas(${codigo})/editar`, { titulo: 'x'.repeat(201) }, gestor);
    expect(r.status).toBe(501);
    const j = await POST(`${B}/Tratativas(${codigo})/mudarStatus`, { status: 'Cancelada', justificativa: 'x'.repeat(501) }, gestor);
    expect(j.status).toBe(501);
  });

  it('CA23: não há criação, alteração nem exclusão pelo entity set (405)', async () => {
    for (const quem of [gestor, admin]) {
      expect((await DELETE(`${B}/Tratativas(${codigo})`, quem)).status).toBe(405);
      expect((await PATCH(`${B}/Tratativas(${codigo})`, { titulo: 'x' }, quem)).status).toBe(405);
      expect((await POST(`${B}/Tratativas`, { titulo: 'x' }, quem)).status).toBe(405);
    }
  });

  it('R29: a consulta do aplicativo mantém os sete campos', async () => {
    const xml = String((await GET('/api/integracao-origem/v1/$metadata', app)).data);
    expect(propriedades(xml, 'ConsultaTratativa')).toEqual(
      ['codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'idOrigem', 'origem', 'status'],
    );
  });

  it('decisão 6: bloqueio por Tratativa visível ao banco (forUpdate na leitura) e transação do pedido', async () => {
    const vistos: { evento: string; forUpdate: boolean }[] = [];
    cds.db.before('*', (req) => {
      const q = req.query as { SELECT?: { forUpdate?: unknown } } | undefined;
      vistos.push({ evento: req.event, forUpdate: Boolean(q?.SELECT?.forUpdate) });
    });
    await cds.db.tx(async (tx) => {
      await tx.run(SELECT.from('br.com.calazanstec.Tratativas').where({ codigo }).forUpdate());
    });
    expect(vistos.map((v) => v.evento)).toEqual(['BEGIN', 'READ', 'COMMIT']);
    expect(vistos[1].forUpdate).toBe(true);
  });
});
```

### Contrato de erros do `TratativaService` (operações desta spec)
| Situação | HTTP | Mensagem | `target` |
|---|---|---|---|
| Sem autenticação | 401 | runtime | — |
| Sem papel `GestorTratativa` nas actions ligadas | 403 | runtime (`Forbidden`) | — |
| Identidade `AplicativoOrigem` em `listarTratativas` e `consultarTratativa` | 403 | `Aplicativo de origem não usa este serviço.` (handler, `before('*')`) | — |
| Identidade `AplicativoOrigem` em `criarTratativaAvulsa` | 403 | `Aplicativo de origem não cria Tratativa avulsa.` (mensagem do 002) | — |
| Identidade `AplicativoOrigem` nas actions ligadas (`mudarStatus`, `editar`, `mudarCriticidade`) | 403 | runtime (`Forbidden`): o `@restrict` recusa antes do handler, por falta do papel `GestorTratativa` | — |
| Campo fora da assinatura; valor de tipo errado | 400 | runtime (`Property "<x>" does not exist in <action>`; `ASSERT_DATA_TYPE`) | runtime |
| Leitura do entity set `Tratativas` | 405 | `Use as functions listarTratativas e consultarTratativa.` | — |
| Criar, alterar ou excluir pelo entity set | 405 | runtime (`ENTITY_IS_READ_ONLY`) | — |
| Tratativa inexistente (action ligada; consulta) | 404 | `Tratativa não encontrada.` | — |
| Código ausente ou mal formado em `consultarTratativa` | 400 | `Código inválido.` | `codigo` |
| Transição fora de R2 (inclui mesmo Status e valor fora da lista) | 409 | `Transição não permitida: de <atual> para <pedido>.` | `status` |
| Edição ou Criticidade em `Encerrada`/`Cancelada` | 409 | `Tratativa <Status> não pode ser alterada.` | — |
| Status ausente em `mudarStatus` | 400 | `O campo Status é obrigatório.` | `status` |
| Justificativa ausente/só espaços em cancelar ou reabrir | 400 | `O campo Justificativa é obrigatório para cancelar e reabrir.` | `justificativa` |
| Tamanho excedido (Justificativa, Título, Descrição, Unidade, Área, Solicitante) | 400 | `O campo <Nome> aceita no máximo <n> caracteres.` | parâmetro |
| Título apagado na edição | 400 | `O campo Título é obrigatório.` | `titulo` |
| Criticidade ausente ou fora da lista (alteração e filtro) | 400 | `Criticidade inválida: use Baixa, Média, Alta ou Crítica.` | `criticidade` |
| Status fora da lista no filtro | 400 | `Status inválido: use Aberta, Em andamento, Encerrada ou Cancelada.` | `status` |
| Tamanho de página fora de 1..200 | 400 | `O campo Tamanho da página aceita de 1 a 200.` | `tamanhoPagina` |
| Página menor que 1 | 400 | `O campo Página deve ser 1 ou maior.` | `pagina` |
| Regra interna: autor vazio / tipo de autor fora da lista | 400 | `O campo Autor é obrigatório.` / `Tipo de autor inválido: use Aplicativo, Usuario ou Sistema.` | `autor` / `tipoAutor` |
| Action aceita | 204 | sem corpo | — |
| Falha de gravação (rollback) | 500 | erro do runtime | — |

## Tasks
| Task | Objetivo | Branch |
|---|---|---|
| tasks/001-ciclo-de-vida-da-tratativa.md | Intent 003 inteiro em uma branch e quatro etapas RED/GREEN: transições, consulta e listagem, edição, alteração de Criticidade pelo Gestor com os ajustes de robustez | tratativa/001-ciclo-de-vida-da-tratativa |

Uma única task, por diretriz do humano (2026-10-08: tasks mais robustas, poucos PRs). As etapas são sequenciais na mesma branch; cada uma tem um commit `test(red):` com arquivo de teste próprio e um `feat(green):`, o que mantém o `verifica-red.sh` provando cada RED por arquivo.

## Itens N3 (aprovação no Gate 1)
| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | `db/tratativa.cds`: `StatusTratativa` com `Em andamento`, `Encerrada`, `Cancelada`; `EventoHistorico` com `MudancaStatus`, `Encerramento`, `Reabertura`, `Cancelamento`, `Edicao`; `HistoricoTratativa.justificativa String(500)`; `Tratativas.origemNormalizada`, `unidadeNormalizada`, `areaNormalizada` (`String(100)`). Só acréscimos; nada implantado no HANA; sem migração destrutiva. | `db/*.cds` | aprovado (Gate 1, 2026-10-07) |
| N3-2 | Papel novo `GestorTratativa`: `@restrict` nas actions ligadas `mudarStatus`, `editar`, `mudarCriticidade` (R8); não-Gestor → 403. Atribuição do papel a pessoas e `xs-security.json` continuam adiados ao intent 014 (N3-10 do 002). | segurança/autorização | aprovado (Gate 1, 2026-10-07) |
| N3-3 | `package.json` → `cds.requires.auth["[development]"]`: usuário mockado `gestor` com papel `GestorTratativa`, senha vazia (só desenvolvimento e teste). Nenhuma outra mudança em `cds.requires`. | `cds.requires` no `package.json` | aprovado (Gate 1, 2026-10-07) |
| N3-4 | Identidade `AplicativoOrigem` recusada com 403 em todo o `TratativaService` (listagem, consulta e actions), além da avulsa já recusada (R23, CA18, CA49). | autorização | aprovado (Gate 1, 2026-10-07) |
| N3-5 | Contrato OData de usuários (D4), `/api/tratativa/v1`: `listarTratativas(...)` → `ItemListagem[]` (dez campos); `consultarTratativa(codigo)` → `DetalheTratativa` (doze campos, Descrição e Solicitante null para não-Gestor); entity set `Tratativas` só com a chave, `@readonly`, leitura recusada com 405; actions ligadas `mudarStatus(status, justificativa)`, `editar(titulo, descricao, unidade, area, solicitante)`, `mudarCriticidade(criticidade)` → 204; limites de tamanho da decisão 5 e contrato de erros acima (inclui 409 para estado). | contrato público (D4) | aprovado (Gate 1, 2026-10-07) |
| N3-6 | R29: `IntegracaoOrigemService` `/v1` passa a devolver `Em andamento`, `Encerrada` e `Cancelada` no campo `status` de `consultarPorCodigo`/`consultarPorOrigem`; formato inalterado (sete campos); no `$metadata` só a anotação `Validation.AllowedValues` do `status` ganha três valores. Aditivo pela D6, sem `/v2`. | contrato público de terceiros | aprovado (Gate 1, 2026-10-07) |
| N3-7 | LGPD: Descrição e Solicitante só para o Gestor (null para os demais; ausentes da listagem); Título visível a todo autenticado; histórico grava matrícula do Solicitante em `valorAnterior`/`valorNovo` e a justificativa em texto livre (`@PersonalData.IsPotentiallyPersonal`), nunca o texto da Descrição. Sem audit log e sem retenção (questão aberta da spec). | LGPD | aprovado (Gate 1, 2026-10-07) |
| N3-8 | Dependência nova: **nenhuma** (medido: build, testes, lint e arch verdes com as dependências atuais). `mta.yaml` e `xs-security.json`: não criados. | dependência nova; deploy | aprovado (Gate 1, 2026-10-07) |

## Como isso se prova
Etapa = etapa da task 001; arquivo de teste novo por etapa. "Nada muda" é conferido lendo o banco direto (`test/apoio/banco.ts`).

| CA | Prova | Etapa / arquivo |
|---|---|---|
| CA1 | avulsa recém-criada → `consultarTratativa` devolve `status = 'Aberta'` | 2 `test/consulta-listagem-tratativa.test.ts` |
| CA2-CA6, CA14, CA16 | `mudarStatus` como `gestor` para cada par válido → 204 e Status novo no banco; iniciar sem justificativa aceito; encerrar sem Ações aceito | 1 `test/transicoes-tratativa.test.ts` |
| CA7-CA10 | pares inválidos → 409 com a mensagem exata, Status inalterado, nenhum histórico novo | 1 |
| CA11-CA13 | justificativa ausente, só espaços, 501 caracteres → 400 `target: justificativa`, nada muda | 1 |
| CA15 | `fixarInstante` 2026-10-07 (Alta → 2026-10-14), encerrar, reabrir em 2026-10-20 → Criticidade e Data prevista inalteradas | 1 |
| CA17, CA18 (transições), CA19 (transições) | `usuario`, `admin`, `app-origem-a` → 403; anônimo → 401; Status inalterado | 1 |
| CA20, CA21, CA77 | linha de histórico com `campo = 'status'`, anterior, novo, autor `gestor`, `tipoAutor = 'Usuario'`, `quando`, justificativa; eventos `MudancaStatus`/`Encerramento`/`Reabertura`/`Cancelamento` derivados do par | 1 |
| CA22 | `falharEm('CREATE', 'HistoricoTratativa')` → 500; Status inalterado; nenhum histórico novo | 1 |
| CA23 | `DELETE`/`PATCH`/`POST` no entity set como `gestor` e `admin` → 405; Tratativa existe | 1 |
| CA46 + D9 | dois `mudarStatus` simultâneos para `Encerrada` → um 204, um 409 `de Encerrada para Encerrada`, um único Encerramento; espião: `READ(forUpdate)` antes de toda escrita | 1 |
| CA64 | aplicativo abre, Gestor encerra, `consultarPorCodigo` → sete campos e `status = 'Encerrada'` | 1 |
| CA66 | Origem "Auditoria de Qualidade" e avulsa: iniciar e encerrar iguais | 1 |
| CA67 | Aberta → Em andamento → Encerrada → Em andamento → Cancelada; quatro históricos de transição em ordem de `quando` (`fixarInstante` crescente) | 1 |
| CA68 | recusas por papel, R4 e justificativa → nenhum histórico novo | 1 |
| CA73 | `usuario` cancela Encerrada sem justificativa → 403; `gestor` → 409 (não 400) | 1 |
| CA47 (Justificativa) | `target: justificativa` | 1 |
| CA48, CA69, CA70 | `usuario` lista com e sem filtros (itens sem as chaves `descricao`/`solicitante`) e consulta (`descricao`/`solicitante` null, Título visível); `gestor` lista também sem as chaves e consulta com valores | 2 |
| CA19 (leitura) | anônimo em `listarTratativas` e `consultarTratativa` → 401 | 2 |
| CA49 | `app-origem-a` em `listarTratativas` e `consultarTratativa` → 403 | 2 |
| CA50 | Código inexistente → 404; Código `abc` → 400 `target: codigo` | 2 |
| CA51-CA54, CA71 | massa com sufixo único; filtros por Origem `"  advertência "` / `"Advertencia"`, Criticidade + Status, ID_Origem + Unidade + Área, Unidade `"  planta a "` e Área `"MANUTENÇÃO"` / `"Manutencao"` | 2 |
| CA55, CA47 (Status) | filtro `status='Pendente'` → 400 `target: status`; `criticidade='Urgente'` → 400 `target: criticidade` | 2 |
| CA56 | sem filtro inclui avulsas e de aplicativo | 2 |
| CA57, CA58 | `fixarInstante`: três Criticidades no mesmo dia → ordem por Data prevista; mesma Data prevista com Datas de criação diferentes (Baixa em D, Média em D+15) → a mais antiga primeiro | 2 |
| CA59 | 120 avulsas; sem `tamanhoPagina` → 50 itens; páginas seguintes sem repetição até o fim; `tamanhoPagina=201` → 400 `target: tamanhoPagina` | 2 |
| CA60 | chaves de cada item (sem `@odata`) = exatamente as dez | 2 |
| CA61, CA62, CA63 | Gestor recebe doze campos, sem histórico, sem número sequencial; `origem`/`idOrigem` são texto (não lista); `$metadata` de `DetalheTratativa` sem `Collection(` | 2 |
| CA23 (leitura) | `GET Tratativas`, `Tratativas(<codigo>)` → 405 | 2 |
| CA24, CA25 | `editar` dos cinco campos → `consultarTratativa` como Gestor devolve os novos; `unidade: null` apaga; filtro por Unidade nova encontra (colunas normalizadas) | 3 `test/edicao-tratativa.test.ts` |
| CA26, CA27, CA47 (Título) | `titulo: '  '` → 400 `target: titulo`; 201 caracteres → 400; nada muda | 3 |
| CA28, CA34 | sete campos não editáveis → 400 runtime; nada muda | 3 |
| CA29 | Encerrada → 409 `Tratativa Encerrada não pode ser alterada.`; também com Título de 201 caracteres (estado antes de campo) | 3 |
| CA31-CA33 | só Unidade → uma linha `Edicao` com valores; reenvio igual → nenhuma linha; Descrição → linha sem texto (`valorAnterior`/`valorNovo` null) | 3 |
| CA35 | avulsa sem Solicitante → `solicitante` null e diferente do usuário criador | 3 |
| CA17-CA19 (edição) | `usuario`, `app-origem-a` → 403; anônimo → 401 | 3 |
| CA72 + D9 | `editar` e `mudarStatus(Encerrada)` simultâneos → estado final coerente com o histórico (Título editado e depois encerrada, ou encerrada e edição 409); espião `READ(forUpdate)` antes de toda escrita | 3 |
| CA74 | falha no `CREATE` do histórico numa edição de Título e Unidade → nenhum campo muda, nenhum histórico | 3 |
| CA30, CA76 | Cancelada → `mudarCriticidade` 409 `Tratativa Cancelada não pode ser alterada.`; regra interna com `Sistema` em Encerrada/Cancelada → 409, nada gravado | 4 `test/criticidade-gestor.test.ts` |
| CA36-CA38 | Baixa em 2026-10-07 → Crítica em 2026-10-20 → 2026-10-10 e duas linhas `tipoAutor = 'Usuario'`; Em andamento aceita; mesma Criticidade → nada | 4 |
| CA39, CA18/CA19 (Criticidade) | `usuario`, `app-origem-a` → 403; anônimo → 401 | 4 |
| CA40, CA41, CA47 (Criticidade) | `Urgente` e ausente → 400 com a mensagem exata, `target: criticidade` | 4 |
| CA42-CA44, CA47 (Autor, Tipo de autor) | `TratativaInternaService.send` com `tipoAutor: 'Robô'` → 400 `target: tipoAutor`; `autor: ''` → 400 `target: autor`; `Sistema` válido → aceito, histórico `Sistema` | 4 |
| CA45 + D9 | `Alta` e `Crítica` simultâneas sobre Baixa → Criticidade e Data prevista coerentes (7 ou 3 dias desde a criação); quatro linhas em cadeia; espião `READ(forUpdate)` também na regra interna | 4 |
| CA75 | falha no `CREATE` do histórico em `mudarCriticidade` → Criticidade e Data prevista inalteradas | 4 |
| CA65 | espiões `fetch`/`https.request` durante `mudarStatus`, `editar` e `mudarCriticidade` de Tratativa de aplicativo → zero chamadas externas | 4 `test/sem-comunicacao-de-saida-ciclo.test.ts` |
| Genericidade (R30) | regra ESLint existente; CA66 | 1 |

## O que não muda
- `IntegracaoOrigemService` (`.cds` e `.ts`), `AdministracaoService`, `TratativaInternaService.cds`, `srv/lib/*`, `srv/tratativa/validacao.ts`, `chave-origem.ts`, `consulta.ts`, `prazo.ts`, `db/schema.cds`, o CSV de prazos, `.dependency-cruiser.cjs`, `eslint.config.mjs`, `tsconfig.json` e as dependências do `package.json`.
- Todos os testes existentes ficam como estão (são de commits `test(red):` do 002); a suíte inteira do 002 passa com o contrato novo (medido).
- `criarTratativaAvulsa`: assinatura, mensagens e comportamento do 002 (só a recusa do aplicativo passa a vir do `before('*')` comum, com a mesma mensagem).
- Sem `app/` nem anotações Fiori (`@Common.SemanticObject` em `idOrigem` fica para o intent 013); sem `srv/integracoes/`; sem `mta.yaml`/`xs-security.json`.
- Conceitos de outros intents continuam fora: `metodologiaData`, `Acoes`, `HistoricoAcoes`, `delegarAcao`, `submeterParaAval`, `darAvalSESMT` (004 em diante; Metodologia e Aval Técnico estão fora do escopo do 003 por R7).

## O desconfortável, declarado
- **Bloqueio não medido no HANA.** A prova automatizada mostra que toda operação pede `forUpdate` antes de escrever e que o renderizador genérico emite `FOR UPDATE`; não há HANA nos testes (AGENTS.md:38) e o `@cap-js/hana` não está instalado, então a cláusula exata no HANA e a releitura do valor confirmado depois da espera são inferidas. O teste de concorrência no SQLite é amostra fraca (pool de 1 conexão já serializa). Verificar no primeiro deploy (intent 014) com dois pedidos simultâneos reais. Sem `WAIT n`: a espera usa o tempo limite de bloqueio padrão do HANA.
- **R31 com uma camada a mais.** Campo fora da assinatura e valor de tipo errado são recusados pelo runtime depois do papel e antes de existência e estado (decisão 4, item A abaixo). Um aplicativo que manda `tamanhoPagina='abc'` recebe 400 em vez de 403.
- **Colunas normalizadas redundantes.** `origemNormalizada`, `unidadeNormalizada` e `areaNormalizada` precisam ser mantidas por todo código que grava Origem, Unidade ou Área (hoje: `abrirTratativa` e `editarTratativa`). Um caminho novo de escrita que esqueça delas quebra o filtro; os testes de filtro depois de editar (etapa 3) cobrem os dois caminhos atuais. `ChavesOrigem.origemNormalizada` (002) continua sendo a chave do par; a coluna nova de `Tratativas` serve só ao filtro.
- **Entity set só como âncora.** `Tratativas` existe no `$metadata` mas não é legível (405); uma UI Fiori elements (intent 013) vai precisar de leitura por entity set e revisitará este contrato (N3 pela D4).
- **Contagem de caracteres em `string.length`** (unidades UTF-16): um emoji conta 2. O banco (`NVARCHAR`) conta caracteres; o limite do domínio é o mais restritivo dos dois, nunca o mais frouxo.
- **Status ausente antes do estado** (decisão 8): `mudarStatus` sem `status` numa Tratativa `Cancelada` responde 400 (campo), não 409.
- **Histórico de transição em `campo`/`valorAnterior`/`valorNovo`** (`campo = 'status'`), sem colunas próprias de Status anterior/novo; o intent 008 pode reorganizar.
- **Sem audit log de acesso** à Descrição e ao Solicitante; `@PersonalData` só documenta.

## Decisões que exigem o humano (Gate 1)
- **A — R31 e a forma do pedido. Já aplicado na spec:** a R31 tem a etapa "forma do pedido" entre papel e existência, com a ressalva do aplicativo nas functions; nada a decidir. Registro: o runtime CAP recusa campo fora da assinatura e valor de tipo errado (400) antes do handler, portanto antes de existência e estado (e, para o aplicativo nas functions, antes do 403 do handler). Alternativa descartada: aceitar qualquer campo no handler para ordenar a recusa, o que desfaz a recusa estrutural de CA28 (a garantia de que Código, Origem e Status não são editáveis viria só do código).
- **B — HTTP 409 para recusas de estado** (R4, R14) e registro das decisões de plataforma D9 e D10 em `agentic/projeto/decisoes.md` (D10 vale também para 004 e 005, que copiam as mensagens do 003). Decisão de design; o orquestrador pode decidir.
- **C — Interpretações de design** (o orquestrador pode decidir): Descrição e Solicitante na leitura: na listagem as chaves `descricao` e `solicitante` ficam **ausentes** do item para todos, inclusive o Gestor (`ItemListagem` não tem os campos); na consulta por Código vêm com valor para o Gestor e **`null`** para os demais (`DetalheTratativa` sempre com doze chaves) — alinhado à correção de R23, CA48 e CA70 feita pelo `dominio` na spec (o texto anterior dizia "omitidos" sem distinguir os dois casos); Status ausente é campo (400) antes do estado; na edição, chave ausente não muda e `null`/só espaços apaga; Código mal formado é 404 nas actions ligadas e 400 em `consultarTratativa` (mesma regra do 002); filtro vazio não filtra; `pagina` começa em 1.
- **D — LGPD (continua aberto, herdado):** retenção, anonimização e log de acesso a Descrição, Solicitante, justificativa e histórico antes de produção.
