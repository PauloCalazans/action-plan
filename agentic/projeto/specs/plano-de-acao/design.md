# Design: plano-de-acao

**Spec:** agentic/projeto/specs/plano-de-acao/spec.md  
**Status:** aprovado

Escopo técnico: Ações e Subações hierárquicas (estrutura analítica em dois níveis) vinculadas à Tratativa no `TratativaService` (`/api/tratativa/v1`), campos e formatos (Descrição, Responsável, Prazo, Prioridade, Status, Evidência obrigatória, Data de conclusão), ciclo de vida e transições de Ação gerenciadas pelo Gestor, regras de integridade entre mãe e filhas, condição de encerramento da Tratativa estendida (todas as Ações e Subações finalizadas), edição de Ações com histórico por campo (sem edição de Responsável, R19/R20), consulta da estrutura e detalhe com proteção LGPD do Responsável (omitido como `null` para quem não é Gestor), e preparação dos pontos de extensão para o intent 005. Tudo no backend CAP TypeScript, persistência aditiva no modelo CDS e banco SQLite em memória / HANA Cloud. Sem UI Fiori (intent 013), sem upload de arquivos de evidência (006), sem workflow de aprovação.

---

## Decisões

1. **Modelo persistido: mudança estritamente aditiva em `db/tratativa.cds`** (R1, R2, R3, R4, R6, R14, R22, R26).
   - `type PrioridadeAcao : String(10) enum { Baixa; Media = 'Média'; Alta; }`.
   - `type StatusAcao : String(20) enum { Pendente; EmAndamento = 'Em andamento'; Concluida = 'Concluída'; Cancelada; }`.
   - `type EventoHistoricoAcao : String(30) enum { Criacao; MudancaStatus; Conclusao; Reabertura; Cancelamento; Edicao; }`.
   - `entity Acoes`: chave primária `codigo : UUID`, associação `tratativa : Association to one Tratativas not null`, auto-associação `acaoMae : Association to one Acoes`, `descricao : String(500) not null`, `@PersonalData.IsPotentiallyPersonal responsavel : String(50) not null`, `prazo : Date not null`, `prioridade : PrioridadeAcao not null default 'Média'`, `status : StatusAcao not null default 'Pendente'`, `evidenciaObrigatoria : Boolean not null default false`, `dataConclusao : Date`, `criadoEm : Timestamp not null`, e composição `subacoes : Composition of many Acoes on subacoes.acaoMae = $self`.
   - `entity HistoricoAcoes`: chave `ID : UUID`, `tratativa : Association to one Tratativas not null`, `acao : Association to one Acoes not null`, `evento : EventoHistoricoAcao not null`, `campo : String(50)`, `@PersonalData.IsPotentiallyPersonal valorAnterior : String(200)`, `@PersonalData.IsPotentiallyPersonal valorNovo : String(200)`, `@PersonalData.IsPotentiallyPersonal justificativa : String(500)`, `@PersonalData.IsPotentiallyPersonal autor : String(256) not null`, `tipoAutor : TipoAutor not null`, `quando : Timestamp not null`.
   - `entity Tratativas`: ganha a composição aditiva `acoes : Composition of many Acoes on acoes.tratativa = $self`.
   — **Por quê:** modela a estrutura analítica relacional sem alterar colunas existentes no HANA Cloud (sem risco de migração destrutiva HDI). A composição em `Tratativas` e em `Acoes` estabelece a semântica CDS de pertencimento e integridade referencial. `criadoEm` garante a ordenação estável (R25). `evidenciaObrigatoria` como `Boolean` no banco é eficiente e portável, sendo convertida para `sim`/`não` na camada de serviço/domínio (R14).
   — **Verificado por:** `cds compile --to sql` (só comandos `CREATE TABLE` de `Acoes` e `HistoricoAcoes`); `npm run build`; testes das etapas 1 a 4.

2. **Superfície do `TratativaService`: leitura por functions com tipo explícito e escrita por actions ligadas ao entity set-âncora `Tratativas`** (R1, R2, R18, R19, R20, R25, R26; D4, D6, D9; Ruling R-07).
   - Functions de leitura:
     * `function consultarEstruturaAcoes(tratativa : UUID) returns many ItemEstruturaAcao;` (R25)
     * `function consultarAcao(tratativa : UUID, codigo : UUID) returns DetalheAcao;` (R25)
   - Actions ligadas a `Tratativas` (URL: `POST /api/tratativa/v1/Tratativas(<codigoTratativa>)/<action>`):
     * `action criarAcao(descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;` (R1, R3, R4, R5, R14)
     * `action criarSubacao(acaoMae : UUID, descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;` (R2, R12)
     * `action mudarStatusAcao(acao : UUID, status : String, justificativa : String);` (R6, R8, R9, R11, R12)
     * `action editarAcao(acao : UUID, descricao : String, prazo : String, prioridade : String, evidenciaObrigatoria : String);` (R19, R20; Ruling R-07)
   — **Por quê:** ao vincular as actions a `Tratativas(<codigoTratativa>)`, a chave do agregado raiz está na URL e é conhecida imediatamente. Isso garante três propriedades vitais: (a) o bloqueio pessimista D9 (`bloquearTratativa(codigoTratativa)`) é executado antes de qualquer outra leitura; (b) a verificação de pertencimento da Ação à Tratativa informada (CA98; revisao-design-parecer-2.md M-b) é natural e à prova de ambiguidades; (c) a assinatura de `editarAcao` não aceita `codigo`, `tratativa`, `acaoMae`, `responsavel`, `status` nem `dataConclusao`, fazendo com que o runtime OData V4 recuse tentativas de enviá-los com HTTP 400 "Property does not exist" (CA64, CA67, CA68; Ruling R-07). Além disso, as novas operações aplicam `toLowerCase()` na chave da URL e nos parâmetros de Código estrutural (`acao`, `acaoMae`, `codigo`, `tratativa`), exatamente como `srv/tratativa-service.ts:33`, garantindo consistência com UUIDs enviados em maiúsculas (revisao-design-parecer-2.md M-c). Para leitura, functions com tipos estruturados evitam qualquer entity set público de Ações, eliminando riscos de vazamento por `$expand` ou navegação (R25, R26).
   — **Verificado por:** testes de contrato OData V4 e casos das etapas 1 a 4.

3. **Papel `GestorTratativa` e recusa de `AplicativoOrigem`** (R18, R27; CA59, CA60, CA61, CA62).
   - As actions de Ações recebem `@restrict: [{ grant: ['criarAcao', 'criarSubacao', 'mudarStatusAcao', 'editarAcao'], to: 'GestorTratativa' }]` no entity set `Tratativas`. Usuário sem o papel (incluindo `AplicativoOrigem`) recebe 403 Forbidden diretamente do runtime CAP, antes de qualquer handler da aplicação (CA59, CA60, CA61).
   - Nas functions `consultarEstruturaAcoes` e `consultarAcao`, o serviço exige `@requires: 'authenticated-user'`. O handler `before('*')` já existente no `TratativaService` intercepta chamadas com papel `AplicativoOrigem` devolvendo 403 com a mensagem de domínio `Aplicativo de origem não usa este serviço.` (R27, CA61).
   - Usuários anônimos recebem 401 Unauthorized do runtime em todos os endpoints (CA62).
   — **Por quê:** centraliza a autorização declarativa no CAP; nenhum aplicativo de terceiros acessa ou manipula Ações (R27); preserva a segurança declarada corporativa (D7, D10).
   — **Verificado por:** testes de autorização (401, 403) nas etapas 1 a 4.

4. **Precedência das recusas (R29) e extensão da decisão D10 com "relação inválida"** (R2, R6, R8, R9, R11, R12, R16, R17, R19, R20, R21, R29; D10; Ruling R-06, Ruling R-07).
   A ordem das verificações em toda operação sobre Ação segue estritamente:
   1. **Autenticação (401):** usuário não autenticado.
   2. **Papel (403):** falta do papel `GestorTratativa` (runtime `@restrict` nas actions, sem mensagem do handler) e identidade `AplicativoOrigem` (`before('*')` nas functions).
   3. **Forma do pedido e formato de códigos (400):**
      - Campos desconhecidos fora da assinatura OData (ex.: `status` ou `dataConclusao` na criação, CA14; campos não permitidos na edição como `responsavel`, `codigo`, `tratativa`, `acaoMae`, `status`, `dataConclusao`, CA64, CA67, CA68; Ruling R-07) são recusados com 400 pelo runtime CAP.
      - Valor de tipo JSON errado (runtime `ASSERT_DATA_TYPE`, ex.: booleano em campo String como `evidenciaObrigatoria: true`, ou texto em parâmetro `Integer` como `tamanhoPagina='abc'` do 003; fracionário chega ao domínio) é recusado com 400 pelo runtime CAP antes de qualquer verificação de existência ou estado (revisao-design-parecer-2.md I9, Ruling R-06 M-i).
      - Parâmetros de Código estrutural (`tratativa` nas functions, `acao`, `acaoMae`, `codigo` nas actions ou functions): o runtime CAP não valida UUID em parâmetros. Todo parâmetro de Código das novas operações é validado no domínio ANTES de qualquer busca de existência, como etapa 3 da R29: 400 `Código inválido.` com `target` = nome do parâmetro (`target: tratativa`, `target: acao`, `target: acaoMae`, `target: codigo`), reaproveitando `codigoValido` de `srv/tratativa/consulta.ts` (revisao-design-parecer.md I1, revisao-design-parecer-2.md M-a). Parâmetros `acao` e `acaoMae` ausentes ou `null` nas actions são avaliados como `String(x)` no domínio, devolvendo 400 `Código inválido.` com `target` do parâmetro (padrão do 003, Ruling R-06 M-j). O Código na CHAVE da entidade na URL (`Tratativas(<codigoTratativa>)/<action>`), por sua vez, é tratado na etapa 4 (existência): chave inexistente ou malformada devolve 404 `Tratativa não encontrada.`, idêntico às actions de 003 (revisao-design-parecer-2.md I9).
   4. **Existência completa (404):**
      - Tratativa inexistente ou com chave malformada na URL (`bloquearTratativa(codigoTratativa)`), ou Tratativa inexistente em functions → 404 `Tratativa não encontrada.` (revisao-design-parecer-2.md I9).
      - Ação inexistente → 404 `Ação não encontrada.`.
      - Ação mãe inexistente em `criarSubacao` → 404 `Ação não encontrada.`.
      - Ação informada não pertence à Tratativa informada (em actions ou em `consultarAcao`) → 404 `Ação não encontrada.`.
      Toda a existência (Tratativa, Ação/mãe e relação de pertencimento) é avaliada antes de qualquer verificação de estado da Tratativa ou da Ação (409). Uma Ação inexistente ou que não pertence à Tratativa recebe 404 mesmo que a Tratativa esteja `Encerrada` ou `Cancelada` (revisao-design-parecer.md I2, revisao-design-parecer-2.md I10, R29).
   5. **Estado da Tratativa (409):**
      - Tratativa `Encerrada` ou `Cancelada` em qualquer escrita sobre Ação (R17) → 409 `Tratativa <Status> não pode ser alterada.`.
      - No encerramento da Tratativa (`mudarStatus` de 003): transição da própria Tratativa avaliada primeiro (R4 do 003, 409) e, se válida, verificação de ações pendentes (R16, 409 `Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.`). A verificação R16 (etapa 5) precede a validação de tamanho e obrigatoriedade da justificativa (etapa 8, revisao-design-parecer.md M4).
   6. **Estado da Ação e Transição:**
      - Em `editarAcao`: Ação `Concluída` ou `Cancelada` (R19) → 409 `Ação <Status> não pode ser alterada.`.
      - Em `mudarStatusAcao`:
        * **Status de destino ausente (400):** status de destino ausente, nulo ou só espaços → 400 `O campo Status é obrigatório.`, `target: status` (exceção nomeada da R29 da spec, como no 003 `agentic/projeto/specs/tratativa/design.md:61`: sem destino não há par de transição a avaliar; revisao-design-parecer.md I3, revisao-design-parecer-2.md M-f). O estado da Tratativa precede o status ausente (CA106; Ruling R-06 I13).
        * **Par de transição fora da tabela (409):** transição não permitida ou para o mesmo status (R7, R8) → 409 `Transição não permitida: de <Status atual> para <Status pedido>.` (`target: status`).
   7. **Relação entre mãe e filhas:**
      - **Relação estrutural inválida permanente (400):** tentativa de criar Subação sob uma Subação (R2) → 400 `Uma Subação não pode ter Subações.`.
      - **Estado da mãe/filhas (409):** criação ou reabertura de Subação com mãe `Concluída` ou `Cancelada` (R12) → 409 `A Ação mãe está <Status> e não aceita esta alteração.`; conclusão ou cancelamento de mãe com Subações abertas (R11) → 409 `A Ação possui Subações não concluídas nem canceladas.`.
   8. **Campos validados pelo domínio (400 com `target`):**
      - `justificativa` ausente/vazia ao cancelar ou reabrir → 400 `O campo Justificativa é obrigatório para cancelar e reabrir.` (`target: justificativa`); tamanho > 500 → 400 `O campo Justificativa aceita no máximo 500 caracteres.` (`target: justificativa`).
      - `descricao` ausente, nula ou só com espaços → 400 `O campo Descrição é obrigatório.` (`target: descricao`); tamanho > 500 → 400 `O campo Descrição aceita no máximo 500 caracteres.` (`target: descricao`).
      - `responsavel` ausente, nulo ou só com espaços → 400 `O campo Responsável é obrigatório.` (`target: responsavel`); tamanho > 50 → 400 `O campo Responsável aceita no máximo 50 caracteres.` (`target: responsavel`) na criação (em `editarAcao` `responsavel` não existe na assinatura, R19/R20; Ruling R-07).
      - `prazo` ausente, nulo ou malformado → 400 `O campo Prazo é obrigatório.` / `Prazo inválido: use o formato AAAA-MM-DD.` (`target: prazo`); prazo anterior a hoje (na criação ou quando alterado na edição) → 400 `Prazo não pode ser anterior a hoje.` (`target: prazo`).
      - `prioridade` nula ou só espaços na edição → 400 `O campo Prioridade é obrigatório.` (`target: prioridade`); na criação, `null` assume o padrão `Média`, enquanto string vazia `""` ou contendo apenas espaços recusa com 400 `Prioridade inválida: use Baixa, Média ou Alta.` (`target: prioridade`); valor fora da lista (`Baixa`, `Média`, `Alta`) → 400 `Prioridade inválida: use Baixa, Média ou Alta.` (`target: prioridade`) (revisao-design-parecer-2.md I11).
      - `evidenciaObrigatoria` nula ou só espaços na edição → 400 `O campo Evidência obrigatória é obrigatório.` (`target: evidenciaObrigatoria`); na criação, `null` assume o padrão `"não"`, enquanto string vazia `""` ou contendo apenas espaços recusa com 400 `Evidência obrigatória inválida: use Sim ou Não.` (`target: evidenciaObrigatoria`); valor fora da lista (`Sim`, `Não`) → 400 `Evidência obrigatória inválida: use Sim ou Não.` (`target: evidenciaObrigatoria`) (revisao-design-parecer-2.md I11).
      - Na edição (`editarAcao`): chave ausente não altera o campo; `null` ou só espaços em `descricao`, `prazo`, `prioridade` ou `evidenciaObrigatoria` recusa com 400 `O campo <Nome> é obrigatório.` com `target` do campo, e nada muda (nenhum desses campos é apagável; revisao-design-parecer.md I8). O campo `responsavel` não é editável e seu envio é recusado pelo runtime CAP com 400 campo desconhecido (R19, R20, CA68; Ruling R-07).
   — **Por quê:** garante previsibilidade absoluta no contrato de API. R2 é uma relação inválida estrutural imutável (árvore de 2 níveis), logo responde 400 antes das checagens de estado volátil (409). Parâmetros livres de negócio evitam que o runtime emita 400 genérico antes das checagens de estado e existência.
   — **Verificado por:** testes CA90 a CA98, CA104, CA105 e CA106 na suíte automatizada.

5. **Parâmetros de negócio sem tipo restritivo e padronização de Evidência obrigatória** (R3, R4, R5, R14, R21; CA7, CA15, CA17, CA46, CA100, CA101, CA105).
   - Na assinatura das actions OData, `prazo`, `prioridade` e `evidenciaObrigatoria` são declarados como `String`.
   - **Evidência obrigatória (R14):** no contrato público, os valores textuais aceitos são exclusivamente `"sim"` e `"não"` (comparação sem diferenciar maiúsculas/minúsculas e após `trim()`). Se omitida (`undefined`) ou enviada como `null` na criação, assume o padrão `"não"`. String vazia `""` ou contendo apenas espaços recusa com 400 `Evidência obrigatória inválida: use Sim ou Não.`, `target: 'evidenciaObrigatoria'`. Qualquer outro valor (ex.: `"talvez"`, `"1"`, `"true"`) recusa com o mesmo 400 (revisao-design-parecer-2.md I11). No banco é gravado como `Boolean` (`true` para sim, `false` para não), na leitura sempre devolvido como `"sim"` ou `"não"`, e no histórico de auditoria é gravado como `"sim"` ou `"não"` em `valorAnterior`/`valorNovo` (revisao-design-parecer-2.md M-e).
   - **Prazo (R3, R21):** string ISO `AAAA-MM-DD`. Validado com regex e data civil real (rejeita datas inexistentes como `"2026-02-30"` ou texto livre `"amanhã"` com 400, `target: 'prazo'`). Na criação ou alteração, comparado com a data civil corrente (`dataCivil(agora())`): data anterior recusa com 400 `Prazo não pode ser anterior a hoje.`, `target: 'prazo'`. Reenviar o mesmo prazo já gravado não revalida contra hoje (CA20).
   - **Prioridade (R4):** aceita exatamente `"Baixa"`, `"Média"`, `"Alta"`, seguindo a mesma regra de comparação de Criticidade de 003 (`srv/tratativa/criticidade.ts`). Não há normalização de `"Media"` sem acento: qualquer outro valor (incluindo `"Media"`) recusa com 400 `Prioridade inválida: use Baixa, Média ou Alta.`, `target: 'prioridade'` (revisao-design-parecer.md I7). Se omitida (`undefined`) ou enviada como `null` na criação, assume o padrão `"Média"`. String vazia `""` ou contendo apenas espaços recusa com 400 `Prioridade inválida: use Baixa, Média ou Alta.`, `target: 'prioridade'` (revisao-design-parecer-2.md I11).
   — **Por quê:** atende às regras R4, R14 e R21 da spec plano-de-acao e à precedência D10, garantindo que o runtime não barre requisições antes do estado e permitindo mensagens amigáveis com `target` explícito.
   — **Verificado por:** CA7, CA15, CA17, CA46, CA100, CA101, CA105.

6. **Serialização por agregado (D9) com bloqueio pessimista na Tratativa** (R24; CA77, CA78).
   - Toda operação de escrita sobre Ação (`criarAcao`, `criarSubacao`, `mudarStatusAcao`, `editarAcao`) e a transição de encerramento da Tratativa iniciam chamando `await bloquearTratativa(codigoTratativa)` (`SELECT ... FOR UPDATE` via `srv/tratativa/bloqueio.ts`) na transação ativa do pedido.
   - Nenhuma leitura de Ação ou tomada de decisão ocorre antes de obter o bloqueio da Tratativa.
   - Operações simultâneas sobre a mesma Tratativa (ex.: dois encerramentos, criação simultânea com encerramento de Tratativa, duas conclusões da mesma Ação) são serializadas no banco de dados.
   — **Por quê:** D9 e R24; impede condições de corrida entre o encerramento da Tratativa e a criação/modificação de Ações (CA78) e evita múltiplos históricos concorrentes em transições de Ações (CA77). Bloquear a Tratativa primeiro impede qualquer ciclo de lock entre tabelas.
   — **Verificado por:** espião `cds.db.before` (`bloqueiaAntesDeEscrever`) em testes de concorrência com `Promise.all` (CA77, CA78).

7. **Atomicidade e registro de auditoria imutável em `HistoricoAcoes`** (R22, R23, R24; CA69, CA70, CA71, CA72, CA74, CA75, CA76, CA99).
   - Gravação dos dados da Ação e das linhas de `HistoricoAcoes` na mesma transação CAP (`cds.db.tx`). Falha em qualquer etapa dispara rollback total (CA76, CA99).
   - Reutiliza a infraestrutura existente de `srv/tratativa/historico.ts`: parametriza `registrarHistorico` (revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g) para aceitar a entidade de destino (`HistoricoTratativa` ou `HistoricoAcoes`) e as colunas de chave/associação, mantendo compatibilidade retroativa com a assinatura usada por `criticidade.ts` e `edicao.ts`, a mesma validação de autor (`validarAutor`, R20 do 003) e mesmo instante temporal `quando` para todas as linhas da mesma operação, sem duplicação de funções.
   - Eventos gravados:
     * `Criacao`: registro inicial com `autor`, `tipoAutor = 'Usuario'`, `quando`. A Descrição da Ação não é gravada no histórico (R23, LGPD).
     * `MudancaStatus` (iniciar), `Conclusao` (concluir), `Reabertura` (reabrir), `Cancelamento` (cancelar): gravam `campo = 'status'`, `valorAnterior`, `valorNovo`, e `justificativa` (aparada ou null).
     * `Edicao`: uma linha por campo efetivamente alterado (`descricao`, `prazo`, `prioridade`, `evidenciaObrigatoria`). Se o valor enviado for idêntico ao já gravado, nenhuma linha é gerada (CA72). No histórico de `evidenciaObrigatoria`, grava `"sim"` e `"não"` em `valorAnterior`/`valorNovo` (revisao-design-parecer-2.md M-e). O campo `responsavel` não é editável neste intent (R19, R20; Ruling R-07) e não gera histórico de `Edicao`.
     * **LGPD (R23):** para o campo `descricao`, a linha de histórico grava `campo = 'descricao'`, mantendo `valorAnterior = null` e `valorNovo = null` para não persistir dados sensíveis (CA74).
   — **Por quê:** conformidade com AGENTS.md:40 (todo evento auditável gera histórico, nunca alteração silenciosa) e conformidade LGPD da spec.
   — **Verificado por:** testes das etapas 1, 3 e 4 com asserções diretas no banco de dados (`linhas('HistoricoAcoes')`).

8. **Ciclo de vida e transições de Ação** (R6, R7, R8, R9, R10, R11, R12, R13; CA22-CA27, CA29-CA41, CA45, CA88, CA89, CA106; Ruling R-06).
   - Operação identificada unicamente pelo Status de destino enviado em `mudarStatusAcao(acao, status, justificativa)`.
   - Tabela fixa de transições no domínio (`srv/tratativa/acoes-ciclo-de-vida.ts`):
     * `Pendente` → `Em andamento`: evento `MudancaStatus`, justificativa opcional.
     * `Pendente` → `Concluída`: evento `Conclusao`, justificativa opcional, `dataConclusao = dataCivil(agora())`.
     * `Pendente` → `Cancelada`: evento `Cancelamento`, justificativa obrigatória.
     * `Em andamento` → `Concluída`: evento `Conclusao`, justificativa opcional, `dataConclusao = dataCivil(agora())`.
     * `Em andamento` → `Cancelada`: evento `Cancelamento`, justificativa obrigatória.
     * `Concluída` → `Em andamento`: evento `Reabertura`, justificativa obrigatória, `dataConclusao = null`.
   - `Cancelada` é estado final (sem saída).
   - Ordem no handler de transição (`mudarStatusAcao`):
     1. Parâmetro de Código da Ação válido no domínio (ausente, null ou malformado → 400 `Código inválido.`, `target: acao`; revisao-design-parecer.md I1, Ruling R-06 M-j).
     2. Bloquear Tratativa pela chave da URL (404 `Tratativa não encontrada.` se chave inexistente ou malformada; revisao-design-parecer-2.md I9).
     3. Localizar Ação e checar pertencimento à Tratativa (404 `Ação não encontrada.` se inexistente ou se pertencer a outra Tratativa; a existência completa precede qualquer 409; revisao-design-parecer.md I2).
     4. Verificar se a Tratativa é alterável R17 (409 `Tratativa <Status> não pode ser alterada.`).
     5. Validar se o Status de destino foi informado: ausente, nulo ou só espaços → 400 `O campo Status é obrigatório.`, `target: status` (exceção nomeada da R29 da spec, como no 003 `agentic/projeto/specs/tratativa/design.md:61`: sem destino não há par de transição a avaliar; revisao-design-parecer.md I3, revisao-design-parecer-2.md M-f). O estado da Tratativa precede o status ausente (CA106; Ruling R-06 I13).
     6. Avaliar par de transição na tabela fixa: destino igual ao atual ou par inválido/saída de Cancelada → 409 `Transição não permitida: de <Status atual> para <Status pedido>.` (`target: status`).
     7. Verificar integridade mãe-filhas:
        - Conclusão ou cancelamento de mãe com Subações abertas (R11) → 409 `A Ação possui Subações não concluídas nem canceladas.`.
        - Reabertura de Subação com mãe Concluída ou Cancelada (R12) → 409 `A Ação mãe está <Status> e não aceita esta alteração.`.
     8. Validar justificativa no domínio (via módulo neutro `srv/tratativa/justificativa.ts`, revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g): ausente/vazia em cancelamento ou reabertura → 400 `O campo Justificativa é obrigatório para cancelar e reabrir.`, `target: justificativa`; tamanho > 500 → 400 `O campo Justificativa aceita no máximo 500 caracteres.`, `target: justificativa`.
    — **Por quê:** segue a mesma arquitetura consolidada em 003, preservando a semântica de negócio sem ambiguidade.
    — **Verificado por:** etapa 3 da task.

9. **Hierarquia analítica em dois níveis e regras de integridade mãe-filhas** (R2, R11, R12, R13; CA4, CA5, CA38, CA39, CA40, CA41, CA42, CA43, CA44, CA45, CA102).
   - Criação de Subação (`criarSubacao`) exige que a mãe tenha `acaoMae === null`. Se a mãe já for uma Subação, o pedido é recusado com 400 `Uma Subação não pode ter Subações.` (R2, CA5, CA94).
   - Ordem explícita no handler de criação de Subação (`criarSubacao`):
     1. Parâmetro `acaoMae` válido no domínio (ausente, null ou malformado → 400 `Código inválido.`, `target: acaoMae`; revisao-design-parecer.md I1, Ruling R-06 M-j).
     2. Bloquear Tratativa pela chave da URL (404 `Tratativa não encontrada.` se inexistente ou com chave malformada na URL; revisao-design-parecer-2.md I9).
     3. Mãe existe e pertence à Tratativa informada (404 `Ação não encontrada.`; a existência completa precede qualquer 409, inclusive mãe inexistente em Tratativa `Encerrada` ou `Cancelada` recebendo 404; revisao-design-parecer-2.md I10).
     4. Verificar se a Tratativa é alterável R17 (409 `Tratativa <Status> não pode ser alterada.`).
     5. Relação estrutural R2: tentativa de criar Subação sob Subação (profundidade > 2) → 400 `Uma Subação não pode ter Subações.`.
     6. Estado da mãe R12: mãe `Concluída` ou `Cancelada` → 409 `A Ação mãe está <Status> e não aceita esta alteração.` (CA42, CA44, CA95; implementado no GREEN da etapa 3).
     7. Validação dos campos no domínio (400 com `target`).
   - Subação só pode ser criada ou reaberta se a Ação mãe estiver `Pendente` ou `Em andamento`. Se a mãe estiver `Concluída` ou `Cancelada`, recusa com 409 `A Ação mãe está <Status> e não aceita esta alteração.` (R12, CA42, CA43, CA44).
   - Ação mãe só pode ser concluída ou cancelada se todas as suas Subações estiverem em `Concluída` ou `Cancelada`. Caso contrário, recusa com 409 `A Ação possui Subações não concluídas nem canceladas.` (R11, CA38, CA40).
   - Ação mãe nunca é concluída automaticamente quando as filhas concluem (CA41); transições de filhas não alteram status da mãe e vice-versa (R13, CA45, CA102).
   — **Por quê:** modela rigorosamente a proposta original e evita efeitos colaterais em cascata indesejados.
   — **Verificado por:** etapa 1 e etapa 3.

10. **Encerramento da Tratativa estendido (R16)** (R16; CA50, CA51, CA52, CA53, CA54, CA55, CA104).
    - Em `srv/tratativa/ciclo-de-vida.ts`, na função `mudarStatus` da Tratativa, quando o destino for `Encerrada`:
      1. A transição da própria Tratativa é validada primeiro conforme a tabela de 003 (`TRANSICOES`). Tratativa `Cancelada` recusa com 409 `Transição não permitida: de Cancelada para Encerrada.` (R4 do 003 precede R16, CA104).
      2. Se a transição for válida (`Aberta` → `Encerrada` ou `Em andamento` → `Encerrada`), executa consulta atômica na tabela `Acoes` para a Tratativa: se houver qualquer Ação com `status NOT IN ('Concluída', 'Cancelada')`, recusa com 409 `Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.`. Esta verificação R16 (etapa 5 da D10) antecede estritamente a validação de tamanho e obrigatoriedade da justificativa (etapa 8 da D10, revisao-design-parecer.md M4).
      3. Se não houver Ações cadastradas para a Tratativa, ou se todas estiverem `Concluída` ou `Cancelada`, o encerramento prossegue com sucesso (CA52, CA54).
    - Cancelar ou reabrir a Tratativa não consulta as Ações (R16, CA55).
    — **Por quê:** implementa a lacuna explicitamente deixada pelo 003 (R7) sem quebrar nenhuma suíte de teste pré-existente (Tratativa sem ações encerra idêntica a antes).
    — **Verificado por:** etapa 3 e suíte regressiva do 003 (`npm test`).

11. **Edição de Ações (`editarAcao`)** (R19, R20; CA20, CA21, CA28, CA56, CA58, CA59, CA61, CA62, CA63, CA64, CA65, CA66, CA67, CA68, CA71, CA72, CA97, CA99, CA100, CA101, CA105; Ruling R-06, Ruling R-07).
    - Ordem de precedência em `editarAcao`:
      1. Parâmetro de Código da Ação válido no domínio (ausente, null ou malformado → 400 `Código inválido.`, `target: acao`; revisao-design-parecer.md I1, Ruling R-06 M-j).
      2. Bloquear Tratativa pela chave da URL (404 `Tratativa não encontrada.` se chave inexistente ou malformada; revisao-design-parecer-2.md I9).
      3. Localizar Ação e checar pertencimento à Tratativa (404 `Ação não encontrada.` se inexistente ou de outra Tratativa; a existência completa precede qualquer 409; revisao-design-parecer.md I2).
      4. Tratativa alterável R17 (409 `Tratativa <Status> não pode ser alterada.`).
      5. Ação alterável R19 (409 `Ação <Status> não pode ser alterada.` se Concluída ou Cancelada; CA65).
      6. Validação dos campos informados no domínio (400 com `target`).
    - Regras dos campos na edição:
      * Chave ausente (`undefined`) no payload não altera o campo correspondente.
      * Campos obrigatórios não são apagáveis: enviar `null` ou string vazia/só com espaços em `descricao`, `prazo`, `prioridade` ou `evidenciaObrigatoria` recusa com 400 `O campo <Nome> é obrigatório.` com `target` do campo (`descricao`, `prazo`, `prioridade`, `evidenciaObrigatoria`), mantendo os valores originais intactos no banco (revisao-design-parecer.md I8).
      * Campos não permitidos (`codigo`, `tratativa`, `acaoMae`, `responsavel`, `status`, `dataConclusao`) são recusados pelo runtime CAP com 400 antes do handler (CA64, CA67, CA68; Ruling R-07). O Responsável é definido na criação e trocado apenas pela delegação no intent 005 (R20).
      * Reenvio de valores idênticos aos gravados gera 204 sem alteração no banco e sem histórico (CA72).
    — **Por quê:** mantém o padrão estabelecido na edição da Tratativa (decisão 9 do 003), garantindo integridade dos dados e impedindo valores nulos em colunas obrigatórias.
    — **Verificado por:** etapa 4 da task.

12. **Consulta da estrutura e detalhe com proteção LGPD do Responsável** (R25, R26; CA79-CA84, CA103).
    - `consultarEstruturaAcoes(tratativa)`: parâmetro `tratativa` é obrigatório (ausente ou nulo → 400 `O campo Tratativa é obrigatório.`, `target: tratativa`; malformado → 400 `Código inválido.`, `target: tratativa`; revisao-design-parecer.md M5, revisao-design-parecer.md I1). Tratativa inexistente → 404 `Tratativa não encontrada.`. Devolve a lista de Ações de primeiro nível ordenadas por `criadoEm ASC, codigo ASC`, cada uma contendo a lista aninhada de `subacoes` na mesma ordenação.
    - `consultarAcao(tratativa, codigo)`: parâmetros `tratativa` e `codigo` são obrigatórios (ausentes → 400 `O campo Tratativa é obrigatório.` / `O campo Código é obrigatório.`; malformados → 400 `Código inválido.` com `target: tratativa` ou `target: codigo`; revisao-design-parecer.md I1). Devolve os campos da Ação, `acaoMae` (UUID da mãe ou null) e `subacoes` aninhadas. Tratativa inexistente → 404 `Tratativa não encontrada.`. Ação inexistente ou pertencente a outra Tratativa → 404 `Ação não encontrada.` (revisao-design-parecer-2.md I12).
    - **Proteção LGPD:** o campo `responsavel` é retornado com o valor da matrícula apenas se `req.user.is('GestorTratativa')` for verdadeiro. Para qualquer outro usuário autenticado, o campo `responsavel` é devolvido estritamente como `null` em todos os níveis (tanto no primeiro nível quanto nas Subações aninhadas).
    — **Por quê:** R25 e R26 da spec, garantindo privacidade e conformidade LGPD sem alterar a tipagem OData V4 do payload.
    — **Verificado por:** etapa 2 da task (CA83, CA84).

13. **Pontos de extensão para o intent 005 (Responsáveis e Participantes)** (spec 005 R3, R20, R27, R28; Ruling R-07).
    - No intent 004, a matrícula do Responsável é definida obrigatoriamente na criação da Ação (R3) e não é editável em `editarAcao` (R19, R20; Ruling R-07); o envio de `responsavel` na edição é recusado pelo runtime CAP como campo desconhecido (400, CA68). No intent 005, a troca de Responsável será realizada pela action dedicada `delegarAcao` com justificativa obrigatória.
    - A autorização para executar transições em Ações no 004 é exclusiva do `GestorTratativa` via `@restrict` declarativo no CDS. A concessão de permissão ao Responsável (Executor) para iniciar e concluir suas próprias Ações (R28 do 005) exigirá adequação do `@restrict` do CDS em `srv/tratativa-service.cds` no intent 005.
    — **Por quê:** delimita estritamente o escopo do intent 004 sem antecipar abstrações desnecessárias (YAGNI, revisao-design-parecer.md M1), deixando clara a evolução futura.
    — **Verificado por:** análise estrutural de contratos e revisão de código.

14. **Arquitetura modular em `srv/tratativa/` e handlers delegadores finos**:
    - `srv/tratativa/acoes-validacao.ts`: funções puras de validação de campos (`validarDescricao`, `validarResponsavel`, `validarPrazo`, `validarPrioridade`, `validarEvidenciaObrigatoria`).
    - `srv/tratativa/justificativa.ts`: módulo neutro contendo a função compartilhada `validarJustificativa` (a lógica inline de validação de justificativa em `srv/tratativa/ciclo-de-vida.ts:37-43` é extraída para este módulo sem alterar o comportamento do 003), reaproveitada por Ações e Tratativa, evitando acoplamento entre `ciclo-de-vida.ts` e `acoes-*` (revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g, Ruling R-06 M-m).
    - `srv/tratativa/acoes-criacao.ts`: lógica de criação de Ações e Subações com bloqueio D9 e validação prévia de formato de código (`codigoValido`).
    - `srv/tratativa/acoes-ciclo-de-vida.ts`: máquina de estados, regras mãe-filha e transições com ordem estrita de precedência.
    - `srv/tratativa/acoes-edicao.ts`: edição atômica com validação de campos (sem `responsavel`, Ruling R-07) e histórico seletivo.
    - `srv/tratativa/acoes-consulta.ts`: montagem da estrutura em árvore e projeção de visibilidade LGPD.
    - `srv/tratativa/dominios.ts`: funções auxiliares de valores válidos de enum (`prioridadesValidas`, `statusAcaoValidos`).
    - `srv/tratativa/historico.ts`: função `registrarHistorico` parametrizada (entidade e colunas de associação opcionais, com padrão para Tratativa) para atender `HistoricoTratativa` e `HistoricoAcoes` sem duplicação de código e mantendo a assinatura atual compatível com `criticidade.ts` e `edicao.ts` (revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g).
    - Handlers em `srv/tratativa-service.ts` limitam-se a aplicar `toLowerCase()` na chave da URL e nos parâmetros de Código estrutural (`acao`, `acaoMae`, `codigo`, `tratativa`), extrair parâmetros, mapear autor `{ id: req.user.id, tipo: 'Usuario' }` e delegar ao domínio (revisao-design-parecer-2.md M-c).
    — **Por quê:** máxima testabilidade unitária e isolamento de responsabilidades, em linha com D8 e o padrão do 003.
    — **Verificado por:** `npm run build`, `npm run arch` e `npm test`.

15. **Ausência de comunicação externa e dependências adicionais** (R27, R28; CA86).
    - Nenhuma chamada HTTP externa, integração com SAP SuccessFactors ou sistema de mensageria (Teams/e-mail) é introduzida neste intent. Nenhuma dependência nova no `package.json`.
    — **Por quê:** AGENTS.md:38 e D2.
    — **Verificado por:** `npm run arch` e teste de ausência de comunicação externa na etapa 4 (`test/sem-comunicacao-de-saida-acoes.test.ts`).

---

### Decisões de plataforma a registrar em `agentic/projeto/decisoes.md`

Texto da **D10 revisada**, a substituir a entrada D10 em `agentic/projeto/decisoes.md` (na seção "Vigentes"):

```markdown
### D10 — Contrato de recusas dos serviços de usuário
- **Decisão:** nos serviços consumidos por usuários (hoje, `TratativaService`), a recusa segue esta precedência e estes códigos HTTP:
  1. **401 Autenticação:** usuário não autenticado.
  2. **403 Papel:** falta do papel exigido no CDS (`@restrict`, ex.: `GestorTratativa`) e identidade técnica de integração (`AplicativoOrigem` via `before('*')` nas functions). Nas actions protegidas por `@restrict`, a tentativa de chamada por identidade sem o papel recebe 403 `Forbidden` diretamente do runtime CAP.
  3. **400 Forma do pedido e formato de códigos:**
     - Campos fora da assinatura OData (runtime, ex.: campos proibidos em criação/edição como `responsavel` em `editarAcao`).
     - Valor de tipo JSON errado (runtime `ASSERT_DATA_TYPE`, ex.: booleano em campo String como `evidenciaObrigatoria: true`, ou texto em parâmetro Integer como `tamanhoPagina='abc'` do 003; fracionário chega ao domínio), recusado com 400 antes de existência ou estado (revisao-design-parecer-2.md I9, Ruling R-06 M-i).
     - Parâmetros de Código estrutural malformados, ausentes ou nulos (`acao`, `acaoMae`, `codigo` nas actions ou functions, e parâmetro `tratativa` nas functions), validados no domínio antes de qualquer consulta ao banco com 400 `Código inválido.` e `target` com o nome do parâmetro (reaproveitando `codigoValido` de `srv/tratativa/consulta.ts`; `acao` e `acaoMae` ausentes ou `null` avaliados como `String(x)`; revisao-design-parecer.md I1, revisao-design-parecer-2.md M-a, Ruling R-06 M-j). Código malformado na CHAVE da entidade na URL (ex.: `Tratativas(xyz)/...`) é tratado na etapa 4 como inexistência (404 `Tratativa não encontrada.`), idêntico às actions de 003 (revisao-design-parecer-2.md I9).
  4. **404 Existência:** recurso ou relação de pertencimento não encontrado (Tratativa inexistente ou com chave malformada na URL, Ação inexistente, Ação mãe inexistente, ou Ação não pertencente à Tratativa informada). A existência completa é verificada antes de qualquer avaliação de estado da Tratativa ou da Ação (409; revisao-design-parecer-2.md I9, I10, I12).
  5. **409 Estado da Tratativa:** estado impede alteração (R17: Tratativa `Encerrada` ou `Cancelada`) ou impede encerramento (R16: Tratativa com Ações não finalizadas, avaliado após a transição da Tratativa R4 de 003 e antes da validação de tamanho da justificativa).
  6. **409 Estado da Ação e Transição:**
     - Em edição: Ação finalizada impede alteração (R19: `Concluída` ou `Cancelada`).
     - Em transição de status:
       * Exceção nomeada (R29 da spec): Status de destino ausente ou só com espaços recusa com 400 `O campo Status é obrigatório.`, `target: status` (sem destino não há par de transição a avaliar; revisao-design-parecer.md I3, revisao-design-parecer-2.md M-f). O estado da Tratativa precede o status ausente (CA106; Ruling R-06 I13).
       * Transição não permitida ou para o mesmo status (R7, R8) recusa com 409 `Transição não permitida: de <Status atual> para <Status pedido>.`, `target: status`.
  7. **Relação entre entidades:**
     - **400 Relação estrutural inválida permanente:** pedido viola regra hierárquica imutável (R2: Subação de Subação).
     - **409 Estado de entidades relacionadas:** estado da mãe impede alteração da filha (R12), ou filhas abertas impedem conclusão/cancelamento da mãe (R11).
  8. **400 Campo inválido (domínio):** validação semântica com `target` = parâmetro (Justificativa ausente/longa; Descrição ausente/nula/longa; Responsável ausente/nulo/longo na criação; Prazo ausente/nulo/malformado/anterior a hoje; Prioridade nula/inválida; Evidência obrigatória nula/inválida; na criação, Prioridade e Evidência obrigatória omitidas ou `null` assumem valor padrão, enquanto `""` ou só espaços recusam com 400 citando o campo; na edição, campos obrigatórios com `null` ou só espaços em `descricao`, `prazo`, `prioridade`, `evidenciaObrigatoria` recusam com 400 `O campo <Nome> é obrigatório.`, pois nenhum campo é apagável e `responsavel` não é editável; revisao-design-parecer-2.md I11, M-e, Ruling R-07).
  Ressalva: para o aplicativo de origem nas functions do serviço de usuários, o 400 de forma pode vir antes do 403 de papel devido à validação prévia de parâmetros pelo runtime CAP.
- **Por quê:** consolida a hierarquia de checagens de negócio (R31 da spec tratativa e R29 da spec plano-de-acao). O código 409 separa conflito de estado de ciclo de vida de dados incorretos (400). Uma relação hierárquica fisicamente inválida (subação de subação em modelo de 2 níveis) é uma violação estrutural estática (400) que precede validações de estado volátil (409).
- **Consequência:** intents 004 e 005 reutilizam esta ordem unificada, os códigos HTTP e a função `recusar(status, message, target)` de `srv/tratativa/recusa.ts`. Parâmetros de negócio livres são validados na etapa 8, garantindo que checagens de existência e estado precedam erros de campo.
- **Verificado por:** testes das etapas de 003 (CA73) e 004 (CA90 a CA98, CA104, CA105, CA106); contrato de erros dos designs de tratativa e plano-de-acao.
- **Data:** 2026-10-08
```

---

## Contrato executável

- **O que é:** diff do modelo em `db/tratativa.cds`, especificação CDS completa de `srv/tratativa-service.cds`, e contrato de erros completo das operações de Ações.
- **Como se valida (medições a repetir pelo revisor):**
  1. `cds compile db srv --to sql`: confirmar que apenas comandos `CREATE TABLE` de `Acoes` e `HistoricoAcoes` são gerados; a tabela `Tratativas` permanece inalterada (mudança puramente aditiva).
  2. `cds compile db --to hdbtable`: compilação sem avisos ou erros para HDI do HANA Cloud.
  3. `npm run build`: compilação TypeScript limpa.
  4. `npx jest`: execução das suítes de teste de 002 e 003 sem regressão (198/198 testes verdes).
  5. `npm run lint` e `npm run arch`: nenhuma violação de linter ou fronteiras arquiteturais.
  6. Verificação de rejeições de runtime vs domínio:
     - Gestor envia campos inexistentes (`status` ou `dataConclusao` em `criarAcao`; `codigo`, `tratativa`, `acaoMae`, `responsavel` em `editarAcao`) → 400 `Property "<x>" does not exist in <action>` do runtime, mesmo com Tratativa inexistente.
     - Envio de tipo JSON incorreto (ex.: booleano `evidenciaObrigatoria: true` em vez de string) → 400 `Value true is not a valid String` (`ASSERT_DATA_TYPE`) do runtime CAP, antes de existência e estado (revisao-design-parecer-2.md I9).
     - Usuário sem papel com payload inválido em Tratativa inexistente → 403 do runtime (papel precede forma, CA90).
     - Usuário anônimo → 401 do runtime.
     - Strings de parâmetros livres (`prazo: 'amanhã'`, `prioridade: 'Urgente'`, `evidenciaObrigatoria: 'talvez'`) chegam intactas ao handler para validação de domínio com `target`.
     - Código UUID malformado ou nulo em parâmetros (`acaoMae: 'xyz'` ou `null` em `criarSubacao`, `codigo: 'abc'` em `consultarAcao`, `acao: 'xyz'` ou `null` em `mudarStatusAcao`/`editarAcao`, parâmetro `tratativa: 'xyz'` nas functions) atinge o handler (pois o runtime não valida formato de UUID) e é rejeitado na etapa 3 da R29 com 400 `Código inválido.` e `target` correspondente, antes de buscar existência no banco. Código malformado na CHAVE da URL (`POST Tratativas(xyz)/criarAcao`) é tratado na etapa 4 como inexistência, resultando em 404 `Tratativa não encontrada.`, idêntico ao 003 (revisao-design-parecer-2.md I9, Ruling R-06 M-j).
     - Chave e parâmetros de código em maiúsculas (`Tratativas(<UUID MAIÚSCULO>)/...`) são convertidos para minúsculas via `toLowerCase()`, evitando 404 espúrio (revisao-design-parecer-2.md M-c).
     - `$expand=acoes` e `GET /Acoes` → 400 e 404 (sem vazamento por navegação OData).
     - Encerrar Tratativa sem Ações → 204.

### `db/tratativa.cds` (diff sobre o atual)

```diff
+/** R4 (spec plano-de-acao): prioridade da Ação (não afeta prazo da Tratativa). */
+type PrioridadeAcao : String(10) enum {
+  Baixa;
+  Media = 'Média';
+  Alta;
+}
+
+/** R6 (spec plano-de-acao): ciclo de vida da Ação; toda Ação nasce `Pendente`. */
+type StatusAcao : String(20) enum {
+  Pendente;
+  EmAndamento = 'Em andamento';
+  Concluida   = 'Concluída';
+  Cancelada;
+}
+
+/** R22 (spec plano-de-acao): eventos de histórico de Ações (intent 008 unifica). */
+type EventoHistoricoAcao : String(30) enum {
+  Criacao;
+  MudancaStatus;
+  Conclusao;
+  Reabertura;
+  Cancelamento;
+  Edicao;
+}
+
 @@ entity Tratativas
        criadoEm              : Timestamp not null;
+      /** R1 (spec plano-de-acao): composição hierárquica de Ações da Tratativa. */
+      acoes                 : Composition of many Acoes on acoes.tratativa = $self;
 }
+
+/** R1-R3, R14, R26 (spec plano-de-acao): tarefas e subtarefas da Tratativa. */
+@PersonalData.EntitySemantics: 'Other'
+entity Acoes {
+  key codigo                : UUID;
+      tratativa             : Association to one Tratativas not null;
+      acaoMae               : Association to one Acoes;
+      descricao             : String(500) not null;
+      @PersonalData.IsPotentiallyPersonal
+      responsavel           : String(50) not null;
+      prazo                 : Date not null;
+      prioridade            : PrioridadeAcao not null default 'Média';
+      status                : StatusAcao not null default 'Pendente';
+      evidenciaObrigatoria  : Boolean not null default false;
+      dataConclusao         : Date;
+      criadoEm              : Timestamp not null;
+      subacoes              : Composition of many Acoes on subacoes.acaoMae = $self;
+}
+
+/** R22, R23 (spec plano-de-acao): auditoria imutável de eventos das Ações. */
+@PersonalData.EntitySemantics: 'Other'
+entity HistoricoAcoes {
+  key ID            : UUID;
+      tratativa     : Association to one Tratativas not null;
+      acao          : Association to one Acoes not null;
+      evento        : EventoHistoricoAcao not null;
+      campo         : String(50);
+      @PersonalData.IsPotentiallyPersonal
+      valorAnterior : String(200);
+      @PersonalData.IsPotentiallyPersonal
+      valorNovo     : String(200);
+      @PersonalData.IsPotentiallyPersonal
+      justificativa : String(500);
+      @PersonalData.IsPotentiallyPersonal
+      autor         : String(256) not null;
+      tipoAutor     : TipoAutor not null;
+      quando        : Timestamp not null;
+}
```

### `srv/tratativa-service.cds` (arquivo completo)

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Serviço dos usuários da plataforma (spec abertura-por-apps-de-origem R6/R17; spec tratativa R1-R31; spec plano-de-acao R1-R29).
 * Leitura por functions com tipo de retorno explícito (R23-R26); ciclo de vida por actions ligadas à
 * Tratativa (R2, R12, R18; 004 R1, R2, R6, R19), só para o papel GestorTratativa (R8, R18). Aplicativo de origem é recusado com 403.
 */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  /** R1/R2 (004): resultado da criação de Ação ou Subação. */
  type ResultadoCriacaoAcao {
    codigo : UUID;
  }

  /** R25 (003): exatamente estes dez campos na listagem (sem Descrição e sem Solicitante). */
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

  /** R26 (003): campos da listagem mais Descrição e Solicitante; os dois vêm null para quem não é Gestor (R23). */
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

  /** R2/R25 (004): item de Subação dentro da árvore (sem subações aninhadas). */
  type ItemSubacaoEstrutura {
    codigo                : UUID;
    descricao             : String(500);
    responsavel           : String(50);
    prazo                 : Date;
    prioridade            : m.PrioridadeAcao;
    status                : m.StatusAcao;
    evidenciaObrigatoria  : String(3);
    dataConclusao         : Date;
  }

  /** R25 (004): item de Ação de primeiro nível na árvore, com coleção de Subações aninhadas. */
  type ItemEstruturaAcao {
    codigo                : UUID;
    descricao             : String(500);
    responsavel           : String(50);
    prazo                 : Date;
    prioridade            : m.PrioridadeAcao;
    status                : m.StatusAcao;
    evidenciaObrigatoria  : String(3);
    dataConclusao         : Date;
    subacoes              : many ItemSubacaoEstrutura;
  }

  /** R25 (004): detalhe completo de uma Ação ou Subação consultada por Código. */
  type DetalheAcao {
    codigo                : UUID;
    descricao             : String(500);
    responsavel           : String(50);
    prazo                 : Date;
    prioridade            : m.PrioridadeAcao;
    status                : m.StatusAcao;
    evidenciaObrigatoria  : String(3);
    dataConclusao         : Date;
    acaoMae               : UUID;
    subacoes              : many ItemSubacaoEstrutura;
  }

  action   criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                                unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;

  /** R24/R25 (003): filtros combinados; página padrão 50, máximo 200; pagina começa em 1. */
  function listarTratativas(origem : String, idOrigem : String, criticidade : String, status : String,
                            unidade : String, area : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemListagem;

  /** R26 (003): consulta pelo Código; inexistente → 404. */
  function consultarTratativa(codigo : UUID) returns DetalheTratativa;

  /** R25 (004): consulta a estrutura hierárquica completa de Ações e Subações de uma Tratativa. */
  function consultarEstruturaAcoes(tratativa : UUID) returns many ItemEstruturaAcao;

  /** R25 (004): consulta uma Ação ou Subação pelo Código dela e da Tratativa. */
  function consultarAcao(tratativa : UUID, codigo : UUID) returns DetalheAcao;

  /**
   * Âncora das operações de ciclo de vida (Tratativas e Ações). Só a chave é exposta; não há leitura,
   * criação, alteração nem exclusão pelo entity set.
   * Parâmetros de negócio sem restrição de tamanho/tipo no CDS: o domínio valida tamanho e formato após papel, existência e estado (D10, R29).
   */
  @readonly
  @restrict: [{
    grant: [
      'mudarStatus',
      'editar',
      'mudarCriticidade',
      'criarAcao',
      'criarSubacao',
      'mudarStatusAcao',
      'editarAcao'
    ],
    to   : 'GestorTratativa'
  }]
  entity Tratativas as projection on m.Tratativas { key codigo } actions {
    /** 003 R2/R4/R5: a operação é identificada pelo Status de destino. */
    action mudarStatus(status : String, justificativa : String);
    /** 003 R12/R13/R15: só estes campos; ausente = não muda; null ou só espaços = apaga (Título não pode). */
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);
    /** 003 R18/R19: reutiliza a regra interna do 002 com tipo de autor Usuario. */
    action mudarCriticidade(criticidade : String);

    /** 004 R1/R3/R4/R5/R14/R18/R21: cria Ação de primeiro nível na Tratativa. */
    action criarAcao(descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    /** 004 R2/R3/R4/R5/R12/R14/R18/R21: cria Subação sob uma Ação mãe na Tratativa. */
    action criarSubacao(acaoMae : UUID, descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    /** 004 R6/R8/R9/R10/R11/R12/R18: muda o Status da Ação ou Subação. */
    action mudarStatusAcao(acao : UUID, status : String, justificativa : String);

    /** 004 R19/R20/R21: edita campos editáveis de Ação ou Subação Pendente ou Em andamento (responsavel não é editável, Ruling R-07). */
    action editarAcao(acao : UUID, descricao : String, prazo : String, prioridade : String, evidenciaObrigatoria : String);
  };
}
```

### Contrato de erros do `TratativaService` (operações do plano de ação)

| Situação | HTTP | Mensagem | `target` |
|---|---|---|---|
| Sem autenticação | 401 | runtime (`Unauthorized`) | — |
| Sem papel `GestorTratativa` nas actions de Ação (incluindo `AplicativoOrigem`) | 403 | runtime (`Forbidden`) | — |
| Identidade `AplicativoOrigem` nas functions de Ação (`consultarEstruturaAcoes`, `consultarAcao`) | 403 | `Aplicativo de origem não usa este serviço.` | — |
| Campo fora da assinatura (ex.: `status` na criação; `codigo`, `tratativa`, `acaoMae`, `responsavel`, `status` na edição) | 400 | runtime (`Property "<x>" does not exist in <action>`) | runtime |
| Valor de tipo JSON incompatível com a tipagem CDS (ex.: `evidenciaObrigatoria: true` booleano) | 400 | runtime (`ASSERT_DATA_TYPE`) | runtime |
| Parâmetro de Código estrutural malformado, ausente ou nulo (`acao`, `acaoMae`, `codigo` nas actions ou functions; `tratativa` malformada nas functions) | 400 | `Código inválido.` | `tratativa`, `acao`, `acaoMae` ou `codigo` |
| Tratativa inexistente ou com chave malformada na URL (action ou function de Ação) | 404 | `Tratativa não encontrada.` | — |
| Ação inexistente, ou mãe inexistente em `criarSubacao` | 404 | `Ação não encontrada.` | — |
| Ação informada não pertence à Tratativa informada (action ou `consultarAcao`) | 404 | `Ação não encontrada.` | — |
| Parâmetro `tratativa` ausente em `consultarEstruturaAcoes` ou `consultarAcao` | 400 | `O campo Tratativa é obrigatório.` | `tratativa` |
| Parâmetro `codigo` ausente em `consultarAcao` | 400 | `O campo Código é obrigatório.` | `codigo` |
| Escrita de Ação sobre Tratativa `Encerrada` ou `Cancelada` | 409 | `Tratativa <Status> não pode ser alterada.` | — |
| Encerramento de Tratativa com Ações/Subações abertas | 409 | `Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.` | — |
| Edição de Ação `Concluída` ou `Cancelada` | 409 | `Ação <Status> não pode ser alterada.` | — |
| Transição de Ação fora de R6 ou para o mesmo status | 409 | `Transição não permitida: de <atual> para <pedido>.` | `status` |
| Criação de Subação sob outra Subação (profundidade > 2) | 400 | `Uma Subação não pode ter Subações.` | — |
| Criação ou reabertura de Subação sob mãe `Concluída`/`Cancelada` | 409 | `A Ação mãe está <Status> e não aceita esta alteração.` | — |
| Conclusão ou cancelamento de mãe com Subações abertas | 409 | `A Ação possui Subações não concluídas nem canceladas.` | — |
| Parâmetro `status` ausente ou só com espaços em `mudarStatusAcao` | 400 | `O campo Status é obrigatório.` | `status` |
| Justificativa ausente/vazia em cancelar ou reabrir Ação | 400 | `O campo Justificativa é obrigatório para cancelar e reabrir.` | `justificativa` |
| Justificativa com mais de 500 caracteres | 400 | `O campo Justificativa aceita no máximo 500 caracteres.` | `justificativa` |
| Descrição ausente, nula ou só com espaços (criação ou edição) | 400 | `O campo Descrição é obrigatório.` | `descricao` |
| Descrição com mais de 500 caracteres | 400 | `O campo Descrição aceita no máximo 500 caracteres.` | `descricao` |
| Responsável ausente, nulo ou só com espaços na criação | 400 | `O campo Responsável é obrigatório.` | `responsavel` |
| Responsável com mais de 50 caracteres na criação | 400 | `O campo Responsável aceita no máximo 50 caracteres.` | `responsavel` |
| Prazo ausente, nulo ou em formato inválido (criação ou edição) | 400 | `O campo Prazo é obrigatório.` / `Prazo inválido: use o formato AAAA-MM-DD.` | `prazo` |
| Prazo anterior à data civil de hoje (na criação ou quando alterado na edição) | 400 | `Prazo não pode ser anterior a hoje.` | `prazo` |
| Prioridade nula ou só com espaços na edição | 400 | `O campo Prioridade é obrigatório.` | `prioridade` |
| Prioridade vazia/só espaços na criação, ou fora de Baixa, Média, Alta (criação ou edição) | 400 | `Prioridade inválida: use Baixa, Média ou Alta.` | `prioridade` |
| Evidência obrigatória nula ou só com espaços na edição | 400 | `O campo Evidência obrigatória é obrigatório.` | `evidenciaObrigatoria` |
| Evidência obrigatória vazia/só espaços na criação, ou fora de Sim, Não (criação ou edição) | 400 | `Evidência obrigatória inválida: use Sim ou Não.` | `evidenciaObrigatoria` |
| Action aceita (`criarAcao`, `criarSubacao`) | 200 | `{ "codigo": "<uuid>" }` | — |
| Action aceita (`mudarStatusAcao`, `editarAcao`) | 204 | sem corpo | — |
| Falha interna na gravação de dados ou histórico (rollback) | 500 | erro do runtime | — |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-acoes-hierarquicas.md` | Entregar o intent 004 completo em quatro etapas sequenciais RED/GREEN: criação de Ações/Subações com integridade, consulta da estrutura em árvore com omissão LGPD de Responsável, ciclo de vida e condição de encerramento da Tratativa, e edição com histórico de auditoria por campo | `plano-de-acao/001-acoes-hierarquicas` |

---

## Itens N3 (aprovação no Gate 1)

| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | `db/tratativa.cds`: `PrioridadeAcao`, `StatusAcao`, `EventoHistoricoAcao`; entidades `Acoes` e `HistoricoAcoes`; composição aditiva `acoes` em `Tratativas`. Mudança estritamente aditiva; nada implantado no HANA; sem migração destrutiva HDI. | `db/*.cds` | aprovado (Gate 1, 2026-10-08, orquestrador por delegação do humano) |
| N3-2 | Papel `GestorTratativa`: `@restrict` nas actions de Ação (`criarAcao`, `criarSubacao`, `mudarStatusAcao`, `editarAcao`) em `TratativaService`. Não-Gestor recebe 403 Forbidden. | segurança/autorização | aprovado (Gate 1, 2026-10-08, orquestrador por delegação do humano) |
| N3-3 | Bloqueio de `AplicativoOrigem` (R27): aplicativo técnico é recusado com 403 em qualquer endpoint de Ações (via `@restrict` nas actions e `before('*')` nas functions). Nenhuma alteração no contrato público `/api/integracao-origem/v1`. | autorização / contrato de terceiros | aprovado (Gate 1, 2026-10-08, orquestrador por delegação do humano) |
| N3-4 | Contrato OData de usuários (D4), `/api/tratativa/v1`: novas actions ligadas e functions de leitura; tipos `ItemEstruturaAcao`, `ItemSubacaoEstrutura`, `DetalheAcao`, `ResultadoCriacaoAcao`; contrato de erros estendido conforme tabela. | contrato público (D4) | aprovado (Gate 1, 2026-10-08, orquestrador por delegação do humano) |
| N3-5 | Validação do campo `Evidência obrigatória` (R14) e assimetria em relação à Prioridade: `Evidência obrigatória` é tolerante a caixa e espaços (aceita `"sim"` e `"não"` com trim e case-insensitive, padrão `"não"`; no histórico de auditoria grava `"sim"`/`"não"`), enquanto `Prioridade` exige correspondência exata de caracteres (`"Baixa"`, `"Média"`, `"Alta"`, padrão `"Média"`, idêntica à Criticidade de 003). Qualquer outro texto recusa com 400 nomeando o campo (revisao-design-parecer-2.md M-e). | contrato público | aprovado (Gate 1, 2026-10-08, orquestrador por delegação do humano) |
| N3-6 | LGPD e Dados Pessoais: anotação `@PersonalData.IsPotentiallyPersonal` na matrícula do Responsável (`responsavel` em `Acoes` e valores em `HistoricoAcoes`). Responsável devolvido apenas ao `GestorTratativa` (retornado como `null` para qualquer outro usuário na estrutura e no detalhe). Descrição da Ação nunca é copiada no histórico de auditoria (sempre `null` em `valorAnterior`/`valorNovo`). | LGPD | aprovado (Gate 1, 2026-10-08, orquestrador por delegação do humano) |
| N3-7 | Dependências e infraestrutura: nenhuma dependência npm adicionada; `mta.yaml` e `xs-security.json` inalterados. | dependência / infraestrutura | aprovado (Gate 1, 2026-10-08, orquestrador por delegação do humano) |

---

## Como isso se prova

Mapeamento completo dos 106 Critérios de Aceite da spec para as quatro etapas da task:

| CA | Prova | Etapa / Arquivo de teste |
|---|---|---|
| CA1, CA3 | Gestor cria Ação em Tratativa `Aberta` com Descrição, Responsável e Prazo → 200 `{ codigo }`, status `Pendente`, UUID único e Tratativa inalterável | 1 `test/criacao-acoes.test.ts` |
| CA4, CA6 | Gestor cria Ação 1 com Subações 1.1 e 1.2 e Ação 2 sem filhas → Subações pertencem à mesma Tratativa da mãe e têm mesmos campos | 1 |
| CA5, CA94 | Tentativa de criar Subação sob Subação → 400 `Uma Subação não pode ter Subações.` | 1 |
| CA7 | Criação só com Descrição, Responsável e Prazo (ou com Prioridade/Evidência omitidas ou null) → Prioridade default `Média`, Evidência obrigatória `"não"`, sem Data de conclusão; string vazia ou só espaços recusa com 400 nomeando o campo | 1 |
| CA8, CA9, CA10 | Descrição ausente, só com espaços ou com 501 caracteres → 400 citando `descricao`; 500 caracteres aceito | 1 |
| CA11, CA12 | Responsável ausente ou com 51 caracteres → 400 citando `responsavel`; 50 caracteres aceito | 1 |
| CA13, CA105 (criação) | Prazo ausente, malformado ("2026-02-30", "amanhã") → 400 citando `prazo` | 1 |
| CA14 | Pedido de criação enviando `status` ou `dataConclusao` → 400 runtime campo desconhecido | 1 |
| CA15 | Prioridade "Urgente" ou "Media" sem acento → 400 citando `prioridade`; `Alta` aceita | 1 |
| CA16 | Prioridade da Ação não altera Criticidade nem prazo da Tratativa | 1 |
| CA17 | Prazo anterior à data de hoje → 400 `Prazo não pode ser anterior a hoje.`; hoje aceito | 1 |
| CA18, CA19 | Prazo da Ação não limitado pela data prevista da Tratativa nem pelo prazo da mãe | 1 |
| CA46, CA100 (criação) | Evidência obrigatória `"sim"` aceita e devolvida; valor `"talvez"` recusado com 400 citando `evidenciaObrigatoria` | 1 |
| CA48 | Criar Ação não altera status da Tratativa | 1 |
| CA56 (criação), CA57 | Criar Ação em Tratativa `Encerrada` ou `Cancelada` → 409 `Tratativa <Status> não pode ser alterada.` | 1 |
| CA59 (criação), CA61 (criação), CA62 (criação) | Criação por usuário comum (403 runtime), aplicativo de origem (403 runtime), não autenticado (401 runtime) | 1 |
| CA69, CA75 | Criação gera histórico de `Criacao` com autor, `tipoAutor = 'Usuario'`, sem copiar a Descrição | 1 |
| CA76 (criação) | Falha injetada no `INSERT` de `HistoricoAcoes` → rollback completo da Ação criada | 1 |
| CA87 (criação) | Criação de Ações funciona identicamente em Tratativa de aplicativo e avulsa | 1 |
| CA90, CA96, CA97 (mãe inexistente) | Precedência D10 em criação: 401 anônimo, 403 não-gestor, 400 forma e código estrutural ausente/nulo/malformado (`acaoMae`), 404 Tratativa/mãe inexistente | 1 |
| CA2 | Tratativa sem Ações → `consultarEstruturaAcoes` devolve lista vazia `[]` | 2 `test/consulta-estrutura-acoes.test.ts` |
| CA61 (consulta), CA62 (consulta) | Consulta de estrutura ou Ação por aplicativo de origem (403 `Aplicativo de origem não usa este serviço.`) e não autenticado (401 runtime) | 2 |
| CA79 | Consulta de estrutura devolve Ação 1 com Subações 1.1 e 1.2 aninhadas e Ação 2 sem subações na ordem de criação | 2 |
| CA80 | `consultarAcao` com código de Ação traz campos, referência à mãe vazia e lista de Subações | 2 |
| CA81 | Tratativa inexistente → 404 `Tratativa não encontrada.`; Ação inexistente ou Ação de outra Tratativa → 404 `Ação não encontrada.` | 2 |
| CA82 | Ordenação estável por `criadoEm ASC, codigo ASC` | 2 |
| CA83 | Usuário autenticado sem papel Gestor consulta estrutura ou Ação por código → `responsavel` vem `null` em todos os níveis | 2 |
| CA84 | GestorTratativa consulta estrutura ou Ação por código → `responsavel` vem preenchido em todos os níveis | 2 |
| CA85 | Consulta do aplicativo (R19 do 002) permanece com sete campos e nada de Ações | 2 |
| CA103 | Consulta de Subação traz código da mãe; consulta sem o parâmetro da Tratativa recusa com 400 citando `tratativa`; código malformado recusa com 400 `Código inválido.` | 2 |
| CA22, CA23, CA24, CA25, CA26 | Transições válidas de Ação via `mudarStatusAcao` → 204, status alterado no banco | 3 `test/ciclo-de-vida-acoes.test.ts` |
| CA27 | Ação `Cancelada` não aceita transição de saída → 409 `Transição não permitida: de Cancelada para <pedido>.` | 3 |
| CA29, CA30, CA31 | Transição para o mesmo status ou proibida → 409 e status inalterado | 3 |
| CA32, CA33, CA34 | Justificativa ausente/vazia/501 chars em cancelar/reabrir → 400 citando `justificativa`; opcional em iniciar/concluir | 3 |
| CA35, CA36 | Conclusão grava data do dia em `dataConclusao`; reabertura apaga `dataConclusao` para null | 3 |
| CA37 | Pedido de conclusão enviando `dataConclusao` no corpo → 400 runtime campo desconhecido | 3 |
| CA38, CA39, CA40 | Concluir ou cancelar mãe com Subações abertas → 409 `A Ação possui Subações não concluídas nem canceladas.`; filhas concluídas/canceladas aceito | 3 |
| CA41, CA45, CA102 | Ação mãe não conclui automaticamente; transições de filhas não alteram status da mãe | 3 |
| CA42, CA44, CA95 | Criar Subação sob mãe `Concluída` ou `Cancelada` (atingidas via `mudarStatusAcao`) → 409 `A Ação mãe está <Status> e não aceita esta alteração.` | 3 |
| CA43 | Reabrir Subação com mãe `Concluída` → 409; após reabrir a mãe, reabertura da Subação aceita | 3 |
| CA47 | Ação com Evidência obrigatória "sim" conclui sem bloqueio neste intent (bloqueio fica para o 006) | 3 |
| CA49 | Tratativa não conclui nem muda status automaticamente quando Ações são concluídas | 3 |
| CA50, CA51, CA53 | Encerramento de Tratativa com Ação ou Subação aberta → 409 `Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.` | 3 |
| CA52, CA54 | Encerramento de Tratativa com todas as Ações finalizadas ou sem nenhuma Ação → 204 aceito | 3 |
| CA55 | Cancelamento de Tratativa com Ações abertas aceito sem alterar status das Ações | 3 |
| CA56 (transição) | Transição de Ação em Tratativa `Encerrada` ou `Cancelada` → 409 `Tratativa <Status> não pode ser alterada.` | 3 |
| CA58 (reabertura) | Reabrir Tratativa reabilita transições de Ações | 3 |
| CA59 (transição), CA60, CA61 (transição), CA62 (transição) | Permissão: só Gestor executa transições; usuário comum (403 runtime), aplicativo (403 runtime), anônimo (401) | 3 |
| CA70, CA73, CA88, CA89 | Histórico de transições: `MudancaStatus`, `Conclusao`, `Reabertura`, `Cancelamento`, com valores e justificativa | 3 |
| CA76 (transição) | Falha injetada no `INSERT` de `HistoricoAcoes` durante transição → rollback atômico do status da Ação | 3 |
| CA77 + D9 | Duas conclusões simultâneas da mesma Ação → 204 e 409 `de Concluída para Concluída`, exatamente um histórico; bloqueio prévio visível | 3 |
| CA78 + D9 | Encerramento de Tratativa e criação de Ação simultâneos → resultado consistente com R16/R17 | 3 |
| CA87 (conclusão) | Conclusão de Ações funciona identicamente em Tratativa de aplicativo e avulsa | 3 |
| CA91, CA92, CA93 | Precedência D10 em transição: código ausente/nulo/malformado (400), Tratativa inexistente (404), Ação inexistente (404), estado da Tratativa (409), destino ausente (400), par fora da tabela (409), relação mãe-filhas (409), justificativa (400) | 3 |
| CA97 (transição), CA98, CA104 | Ação inexistente (404), Ação de outra Tratativa (404); Ação inexistente em Tratativa Encerrada (404 antes de 409); Tratativa Cancelada recusa com 409 de transição antes de R16 (CA104) | 3 |
| CA106 | Precedência em transição sem destino: Ação Cancelada em Tratativa Aberta sem destino (ou só espaços) → 400 `O campo Status é obrigatório.`; mesmo pedido em Tratativa Encerrada → 409 `Tratativa Encerrada não pode ser alterada.` (estado da Tratativa precede destino ausente) | 3 |
| CA20, CA21 | Reenviar o mesmo prazo passado não revalida contra hoje; atraso não é Status | 4 `test/edicao-acoes.test.ts` |
| CA28 | Tentativa de exclusão de Ação não possui endpoint | 4 |
| CA56 (edição), CA58 (edição) | Edição em Tratativa `Encerrada` ou `Cancelada` → 409; após reabrir a Tratativa, aceito | 4 |
| CA59 (edição), CA61 (edição), CA62 (edição) | Edição por usuário comum (403 runtime), aplicativo (403 runtime), anônimo (401) | 4 |
| CA63 | Edição dos quatro campos editáveis (Descrição, Prazo, Prioridade, Evidência obrigatória) grava novos valores sem alterar o Responsável | 4 |
| CA64, CA67, CA68 | Envio de campos não permitidos (`codigo`, `tratativa`, `acaoMae`, `responsavel`, `status`, `dataConclusao`) → 400 runtime campo desconhecido | 4 |
| CA65 | Edição em Ação `Concluída` ou `Cancelada` → 409 `Ação <Status> não pode ser alterada.` | 4 |
| CA66 | Edição enviando `null` ou só espaços em campos obrigatórios → 400 com `target` do campo e nada altera | 4 |
| CA71 | Edição que altera só o Prazo grava histórico de `Edicao` apenas para o campo Prazo | 4 |
| CA72 | Edição reenviando os mesmos valores → 204 sem alteração no banco e sem histórico | 4 |
| CA74 | Edição de Descrição grava histórico sem copiar texto anterior nem novo (`null`) | 4 |
| CA76 (edição), CA99 | Falha injetada no histórico da edição → rollback atômico de todos os campos | 4 |
| CA86 | Nenhuma comunicação externa de saída durante operações de Ação | 4 `test/sem-comunicacao-de-saida-acoes.test.ts` |
| CA97 (edição) | Ação inexistente na edição devolve 404 `Ação não encontrada.`; Ação inexistente em Tratativa Encerrada devolve 404 (existência precede 409) | 4 |
| CA100 (edição) | Evidência obrigatória na edição: `"sim"` e `"não"` aceitos; valor inválido (ex.: `"talvez"`) recusa com 400 `target: evidenciaObrigatoria` | 4 |
| CA101 | Alterar prazo para data anterior a hoje → 400 `Prazo não pode ser anterior a hoje.`; hoje ou futuro aceito | 4 |
| CA105 (edição) | Prazo malformado na edição ("2026-02-30", "amanhã") → 400 citando `prazo` | 4 |

---

## O que não muda

- Serviços existentes `IntegracaoOrigemService`, `AdministracaoService`, `TratativaInternaService`.
- Comportamento de abertura de tratativas (avulsa e por aplicativo do 002).
- Contrato da consulta do aplicativo (`/api/integracao-origem/v1`), mantendo rigorosamente os 7 campos.
- Implementação e regras de Criticidade e Prazos do 002 e 003.
- Usuários e credenciais de desenvolvimento em `package.json`.
- Arquivos de configuração de build, lint, jest e dependências arquiteturais (`eslint.config.mjs`, `jest.config.js`, `.dependency-cruiser.cjs`, `tsconfig.json`).
- Suíte completa de testes de 002 e 003, que continua executando e passando 100% verde.

---

## O desconfortável, declarado

- **Bloqueio pessimista no HANA vs SQLite:** assim como em 003, o SQLite em memória utilizado pelos testes automatizados não executa `FOR UPDATE` nativamente (a serialização ocorre via conexão única). A prova de bloqueio é garantida estruturalmente pelo espião do banco (`test/apoio/banco-espiao.ts`, `bloqueiaAntesDeEscrever`). A confirmação em escala de banco distribuído HANA Cloud ocorrerá no deploy (intent 014).
- **Duas functions para leitura em vez de OData Navigation:** Fiori elements padrão consome estruturas analíticas navegando por `$expand`. No entanto, como o MVP não possui interface Fiori (intent 013) e para blindar categoricamente a matrícula do Responsável contra vazamentos (R25, R26), adotamos functions dedicadas com projeção estrita. No intent 013, caso Fiori Elements exija anotações de hierarquia OData (`@Hierarchy`), uma nova decisão de arquitetura desenhará anotações analíticas com controle de colunas por perfil.
- **Evidência obrigatória sem bloqueio real no 004:** o intent 004 apenas armazena e expõe o indicador `"sim"`/`"não"`. O bloqueio efetivo de conclusão ("não concluir sem evidência anexada") depende do intent 006, ficando explicitamente adiado conforme especificado em R14.
- **`@restrict` do CDS e permissão do executor no intent 005:** no intent 004, as actions de Ação possuem `@restrict` concedendo permissão exclusivamente ao papel `GestorTratativa`. No intent 005, a regra R28 (permitir que o Responsável/Executor inicie e conclua sua própria Ação) exigirá alterar o `@restrict` do CDS em `srv/tratativa-service.cds`, pois o runtime CAP barra usuários sem o papel com 403 antes de alcançar os handlers da aplicação (revisao-design-parecer.md M1).
- **Dupla composição da Subação (`Tratativas.acoes` e `Acoes.subacoes`):** no modelo CDS persistido, uma Subação pertence simultaneamente à composição de Ações da Tratativa e à composição `subacoes` da Ação mãe. No intent 004 isso não produz conflito porque não há mutações profundas em cascata pelo OData genérico (as mutações ocorrem via actions imperativas com bloqueio pessimista). Contudo, no intent 013 (Fiori elements e draft habilitado), composições múltiplas ou recursivas da mesma entidade podem exigir atenção especial ou ajustes na modelagem do draft (revisao-design-parecer.md M8).

---

## Decisões que exigem o humano (Gate 1)

- **A — Validação de parâmetros de negócio como String:** Prazo, Prioridade e Evidência obrigatória trafegam como `String` sem validação estrutural restritiva do runtime CDS, sendo validados na camada de domínio (etapa 8 da R29) para garantir a ordem das mensagens e permitir indicação precisa de `target`.
- **B — HTTP 409 vs 400 para regras de integridade mãe-filha:** a tentativa de criar Subação sob Subação (profundidade > 2) é classificada como erro estrutural imutável (400), enquanto restrições baseadas no estado atual da mãe ou filhas (R11, R12) respondem com conflito de estado (409).
- **C — LGPD: omissão do Responsável para não-gestores:** o campo `responsavel` é mantido na estrutura da resposta mas preenchido como `null` para qualquer usuário que não tenha o papel `GestorTratativa`.

**Registro do Gate 1 (2026-10-08):** decisões A, B e C e itens N3-1 a N3-7 aprovados pelo orquestrador, por delegação do humano (Gate 1 delegado por inteiro, incluindo N3). Rulings R-01 a R-08 em `agentic/.estado/execucao/2026-10-08-plano-de-acao/progress.md`.
