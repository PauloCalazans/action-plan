# Task 001: responsaveis-e-participantes

**Spec:** agentic/projeto/specs/responsaveis-e-participantes/spec.md  
**Status:** em-andamento  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** responsaveis-e-participantes/001-responsaveis-e-participantes

## Objetivo
Entregar o intent 005 inteiro numa branch empilhada sobre o intent 004, em quatro etapas sequenciais RED/GREEN: (1) Responsável Principal e Participantes da Tratativa com integridade, bloqueio D9 e histórico de auditoria; (2) Delegação de Ações com justificativa obrigatória e histórico dedicado; (3) Autorização dinâmica de 9 etapas para execução de Ações pelo Responsável; (4) Consultas estruturadas "Minhas Ações" e "Minhas Tratativas" com paginação, ordenação e proteção de visibilidade LGPD, conforme desenhado em `agentic/projeto/specs/responsaveis-e-participantes/design.md`.

## Arquivos
- `db/tratativa.cds`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/tratativa/identidade.ts`
- `srv/tratativa/validacao-matricula.ts`
- `srv/tratativa/justificativa.ts`
- `srv/tratativa/responsaveis-tratativa.ts`
- `srv/tratativa/acoes-delegacao.ts`
- `srv/tratativa/consultas-responsabilidade.ts`
- `srv/tratativa/acoes-ciclo-de-vida.ts`
- `srv/tratativa/acoes-criacao.ts`
- `srv/tratativa/listagem.ts`
- `test/apoio/responsaveis.ts`
- `test/responsaveis-tratativa.test.ts`
- `test/responsaveis-tratativa-ca88.test.ts`
- `test/delegacao-acoes.test.ts`
- `test/autorizacao-execucao-acoes.test.ts`
- `test/consultas-responsabilidade.test.ts`

## Interfaces
- **Produz:**
  - `TratativaService` (`/api/tratativa/v1`) com o CDS completo da seção "Contrato executável" do design:
    * Novas actions ligadas ao entity set `Tratativas`: `atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante`, `delegarAcao`.
    * Nova function `consultarResponsaveis(tratativa : UUID)` exclusiva para `GestorTratativa` (`@restrict`) retornando `DetalheResponsaveis` (Ruling R-02; `DetalheTratativa` e `consultarTratativa` mantidos com 12 chaves intactos).
    * Ajuste de `@restrict` em `mudarStatusAcao` para `authenticated-user` com validação de autorização dinâmica de 9 etapas no domínio.
    * Novas functions de leitura: `minhasAcoes` e `minhasTratativas` com tipos estruturados `ItemMinhasAcoes` e `ItemMinhasTratativas`.
  - Modelo persistido em `db/tratativa.cds`: `responsavelPrincipal` e composição `participantes` em `Tratativas`, entidade `ParticipantesTratativa` (com coluna `sequencia`), enums `PapelUsuarioTratativa`, e novos eventos em `EventoHistorico` e `EventoHistoricoAcao`.
  - Módulos de domínio em `srv/tratativa/`: `identidade.ts`, `validacao-matricula.ts`, `justificativa.ts`, `responsaveis-tratativa.ts`, `acoes-delegacao.ts`, `consultas-responsabilidade.ts`, e extensões de `acoes-ciclo-de-vida.ts`, `acoes-criacao.ts` e `listagem.ts`.
  - Contrato de erros unificado (mensagens exatas, `target`, HTTP 400, 401, 403, 404, 409).
- **Consome:**
  - `TratativaService` e infraestrutura do intent 004 (`plano-de-acao`).
  - Módulos reutilizados: `bloquearTratativa` (`bloqueio.ts`), `recusar` (`recusa.ts`), `registrarHistorico` (`historico.ts`), `validarJustificativa` (`justificativa.ts`), `codigoValido` (`consulta.ts`), `agora`, `dataCivil` (`srv/lib/relogio.ts`), helper de paginação extraído de `listagem.ts`.
  - Helpers de teste em `test/apoio/`: `usuarios.ts` (`comoGestor`, `comoUsuario`, `comoApp`, `semAuth`), `banco.ts` (`linhas`), `banco-espiao.ts` (`instalarEspiao`, `bloqueiaAntesDeEscrever`), `tratativas.ts`, `acoes.ts`.

## Regras para todas as etapas
- **Commits por etapa:** `test(red): <etapa> …` somente com arquivos de `test/` (e este arquivo de task); depois `feat(green): <etapa> …` com a implementação de produção. Nunca alterar testes de commits RED anteriores.
- **Arquivo de teste novo por RED:** o script `verifica-red.sh` valida o RED por arquivo novo e exige que os testes novos falhem estritamente no commit RED.
- **Helpers em `test/apoio/` sem asserções:** nenhum helper pode conter chamadas a `expect(`. Todas as asserções pertencem aos arquivos `*.test.ts`.
- **Testes não importam `srv/`:** a interação dos testes de integração ocorre exclusivamente via chamadas OData V4 (`POST`, `GET` do `cds.test`) ou leitura direta do banco via `linhas(...)` de `test/apoio/banco.ts`.
- **Isolamento de concorrência e massa:** utilizar `sufixoUnico()` em títulos e identificadores para evitar colisão no banco compartilhado da mesma suíte.
- **Verificação obrigatória:** rodar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## Etapa 1 — Responsável Principal e Participantes da Tratativa (`atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante`, `consultarResponsaveis`)
**CAs:** CA1, CA2, CA4, CA5, CA6, CA7, CA8, CA9 (participante), CA13, CA14, CA15, CA16, CA17, CA18, CA19, CA20, CA21, CA22, CA23, CA24, CA25, CA32, CA33, CA34 (atribuir/incluir/remover), CA36, CA46, CA47 (atribuir/incluir/remover), CA48 (atribuir/incluir/remover/consultarResponsaveis), CA49, CA50, CA51, CA52, CA54, CA55, CA56, CA58, CA60, CA62 (tratativa), CA63, CA64, CA66, CA84 (atribuição), CA86 (atribuição), CA87, CA88, CA89, CA96, CA97, CA98, CA99, CA101, CA102, CA111, M6.  
**Itens N3 utilizados:** N3-1, N3-2, N3-3, N3-4, N3-5, N3-6, N3-7.

**RED (papel `testes`)** — commit `test(red): atribuição e participantes da Tratativa com regras de integridade e histórico (R1-R7, R9, R10, R14, R15, R17)`:
- `test/apoio/responsaveis.ts` (novo, sem `expect`): helpers para invocação OData V4:
  * `atribuirResponsavelPrincipal(POST, tratativa, dados, como)`
  * `incluirParticipante(POST, tratativa, dados, como)`
  * `removerParticipante(POST, tratativa, dados, como)`
  * `consultarResponsaveis(GET, tratativa, como)`
  * `consultarTratativa(GET, tratativa, como)`
  * `listarTratativas(GET, params, como)`
- `test/responsaveis-tratativa.test.ts` (novo):
  * CA1: Tratativa recém-aberta consultada pelo Gestor via `consultarResponsaveis` → `responsavelPrincipal = null`, `participantes = []` (Ruling R-02); testes de precedência: não-gestor com parâmetro omitido/malformado recebe 403 Forbidden estático do runtime; Gestor com `tratativa` ausente ou malformado recebe 400 `Código inválido.`, `target: tratativa`; Gestor com Tratativa inexistente recebe 404 `Tratativa não encontrada.` (M3).
  * CA2: atribuir segundo Responsável Principal constitui troca (Reatribuição) e a Tratativa permanece com um único.
  * CA4: Tratativa sem Responsável Principal é iniciada e encerrada com sucesso pelo Gestor.
  * CA5: abertura por app enviando `responsavelPrincipal` ou `participantes` recusa como campo desconhecido.
  * CA6, CA99: atribuir matrícula válida ("M1001" ou com 50 caracteres) grava com sucesso.
  * CA7, CA8: atribuir "Maria Silva", e-mail, valor vazio ou com 51 caracteres recusa com 400 nomeando Responsável Principal; valor com espaços nas pontas é gravado com trim.
  * CA9 (participante): inclusão de participante com e-mail recusa nomeando Participante.
  * CA13, CA14, CA96: atribuir participante existente como Responsável Principal, ou incluir Responsável Principal existente como participante (mesmo com variação de caixa/espaços) recusa com 409 `Responsável Principal e Participante não podem ser a mesma pessoa.` com `target` do campo.
  * CA15: ser Responsável de Ação e Participante da mesma Tratativa coexistem sem erro.
  * CA16: inclusão de participantes preserva a ordem exata de inserção via sequencia (`criadoEm ASC, sequencia ASC`), comprovada mesmo com instante congelado (`fixarInstante`) nos testes (M4).
  * CA17, CA97: incluir participante já existente (inclusive com variação de caixa) verificado ANTES do limite de 20 (R6, CA97; I5) resulta em 204 idempotente sem efeito e sem histórico.
  * CA18: remover participante inexistente resulta em 204 idempotente sem histórico.
  * CA19: inclusão do 21º participante recusa com 409 `Limite de 20 Participantes atingido.`; inclusão até 20 aceita.
  * CA20, CA102: primeira atribuição sem justificativa é aceita; justificativa opcional informada é aceita e gravada no histórico.
  * CA21, CA22: reatribuição com justificativa é aceita; sem justificativa, com espaços ou com 501 caracteres recusa com 400 citando Justificativa.
  * CA23, CA98: atribuir a mesma matrícula já gravada (inclusive com variação de caixa/espaços) resulta em 204 sem histórico e preserva a grafia.
  * CA24: não existe operação para deixar a Tratativa sem Responsável Principal após atribuído.
  * CA25, CA33, CA46, CA47 (atribuir/incluir/remover), CA62 (tratativa): chamadas por usuário sem papel de Gestor recusam com 403; anônimo com 401.
  * CA32: Gestor inclui e remove participantes sem justificativa com sucesso.
  * CA34 (atribuir/incluir/remover), CA101: atribuir, incluir ou remover participante em Tratativa `Encerrada` ou `Cancelada` recusa com 409 `Tratativa <Status> não pode ser alterada.`.
  * CA36: reatribuição em Tratativa reaberta é aceita.
  * CA48 (atribuir/incluir/remover/consultarResponsaveis), CA49, CA50: aplicativo de origem recebe 403; consulta do app não traz responsáveis; sem comunicação externa.
  * CA51, CA52, CA54: gravação correta de histórico (`Atribuicao`, `Reatribuicao`, `InclusaoParticipante`, `RemocaoParticipante`) com autor, data e justificativa.
  * CA55, CA56: pedidos recusados não gravam histórico; falha simulada no banco dispara rollback total.
  * CA58 + D9: duas inclusões simultâneas do mesmo participante resultam em registro único e lista sem duplicidade.
  * CA60: atribuir Responsável Principal a Tratativa inexistente recusa com 404 `Tratativa não encontrada.`.
  * CA63, CA64, CA111: visibilidade segregada de responsáveis via `consultarResponsaveis`: Gestor recebe dados e `[]` se vazio; não-gestor recebe 403 Forbidden estático do runtime CAP (Ruling R-02); listagem não traz essas chaves para ninguém.
  * CA66, CA89: consulta de Tratativa (`consultarTratativa`) mantém exatamente as 12 chaves do intent 003, retornando Descrição e Solicitante como null para não-gestores; `consultarResponsaveis` para não-gestores recusa com 403 (Ruling R-02).
  * CA84 (atribuição), CA86 (atribuição), CA87: sem papel aprovador; genericidade de Origem; edição comum da Tratativa (`editar`) enviando responsáveis recusa com 400 campo desconhecido.
  * M6: verificação contra vazamento relacional LGPD: `$expand` de participantes em `consultarTratativa` devolve 400; navegação OData para `ParticipantesTratativa` e GET direto na entidade devolvem 400/404.
- Falha esperada no RED: actions `atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante` e function `consultarResponsaveis` inexistentes no serviço (404/501).

**GREEN (papel `dev`)** — commit `feat(green): gestão de Responsável Principal e Participantes da Tratativa (R1-R7, R9, R10, R14, R15, R17)`:
- `db/tratativa.cds`: adicionar `responsavelPrincipal` e composição `participantes` em `Tratativas`, entidade `ParticipantesTratativa` (com coluna `sequencia : Integer not null;` M4), enums `PapelUsuarioTratativa`, e eventos `Atribuicao`, `Reatribuicao`, `InclusaoParticipante`, `RemocaoParticipante` em `EventoHistorico`.
- `srv/tratativa/identidade.ts` (novo): funções `obterMatriculaUsuario`, `normalizarMatricula`, `matriculasIguais`, `usuarioAutenticadoEhMatricula`.
- `srv/tratativa/validacao-matricula.ts` (novo): função `validarMatricula` implementando a regra R3.
- `srv/tratativa/justificativa.ts`: parametrizar `validarJustificativa(valor, operacao)` aceitando mensagens específicas por operação (`para cancelar e reabrir`, `para reatribuir`, `para delegar`; I4).
- `srv/tratativa/responsaveis-tratativa.ts` (novo): funções de domínio para atribuição, reatribuição, inclusão e remoção de participantes com bloqueio D9 (`bloquearTratativa`), desempate por `sequencia` incremental na inclusão (M4), verificações de estado R10, restrições R5 e R6 (409; idempotência antes do limite de 20, I5), validação de justificativa R7 e gravação atômica em `HistoricoTratativa`; e implementação de `consultarResponsaveis` com precedência de 5 passos (401 → 403 estático → 400 código malformado → 404 inexistente → 200; M3) retornando `responsavelPrincipal: null` e `participantes: []` quando sem registros (C2, I4).
- `srv/tratativa-service.cds`: declaração das actions `atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante` e da function `consultarResponsaveis` com `@restrict` para `GestorTratativa` e tipo `DetalheResponsaveis`.
- `srv/tratativa-service.ts`: handlers delegando para `responsaveis-tratativa.ts` aplicando `toLowerCase()` na chave da URL.

---

## Etapa 2 — Delegação de Ações com justificativa obrigatória (`delegarAcao`, R8, R10, R14, R27, R29, R30)
**CAs:** CA3, CA9 (responsável), CA26, CA27, CA28, CA29, CA30, CA31, CA34 (delegação), CA35, CA47 (delegação), CA48 (delegação), CA53, CA55, CA56, CA57, CA59, CA61, CA62 (delegação), CA82, CA84 (delegação), CA85, CA86 (delegação), CA90, CA92, CA93, CA94, CA103, CA105.  
**Itens N3 utilizados:** N3-1, N3-2, N3-3, N3-4, N3-5, N3-6, N3-7.

**RED (papel `testes`)** — commit `test(red): delegação de Ações com justificativa obrigatória e histórico (R8, R10, R14, R27, R29, R30)`:
- `test/apoio/responsaveis.ts`: adicionar helper `delegarAcao(POST, tratativa, dados, como)`.
- `test/delegacao-acoes.test.ts` (novo):
  * CA3: Ação não aceita inclusão de participantes.
  * CA9 (responsável): delegar com nome ou e-mail inválido por R3 recusa nomeando `novoResponsavel` (`target: novoResponsavel`; M3).
  * CA26, CA28: Gestor delega Ação e Subação com justificativa obrigatória → Responsável é alterado com sucesso no banco.
  * CA27: delegação sem justificativa, com espaços ou com mais de 500 caracteres recusa com 400 citando Justificativa.
  * CA29, CA93: chamada a `editarAcao` enviando o campo `responsavel` recusa com 400 runtime campo desconhecido (comportamento estabelecido no intent 004 por Ruling R-07).
  * CA30: Responsável da Ação sem papel de Gestor tenta delegar a própria Ação → 403 Forbidden.
  * CA31: delegar para a mesma matrícula já gravada resulta em 204 sem alteração e sem gravação de histórico.
  * CA34 (delegação), CA61, CA105: delegar Ação em Tratativa `Encerrada` ou `Cancelada` recusa com 409 `Tratativa <Status> não pode ser alterada.` (estado da Tratativa precede campos e estado da Ação).
  * CA35: delegar Ação `Concluída` ou `Cancelada` recusa com 409 `Ação <Status> não pode ser alterada.`.
  * CA47 (delegação): participante da Tratativa tenta delegar Ação → 403.
  * CA48 (delegação): aplicativo de origem tenta delegar Ação → 403.
  * CA53: gravação correta de histórico `Delegacao` em `HistoricoAcoes` com campos `responsavel`, `valorAnterior`, `valorNovo` e `justificativa`.
  * CA57 + D9: duas Delegações simultâneas sobre a mesma Ação resultam em histórico encadeado no banco.
  * CA55, CA56: pedidos recusados de delegação não gravam histórico (CA55); falha simulada no banco na gravação de histórico de Delegação dispara rollback transacional total dos dados (CA56; I3).
  * CA59, CA62 (delegação): usuário não-gestor delegando Ação inexistente recebe 403 na etapa 2 de papel estático (papel precede existência); anônimo recebe 401.
  * CA82, CA85: delegação para matrícula inexistente ou desligada aceita sem consulta externa; sem notificação.
  * CA84 (delegação): delegação imediata pelo Gestor sem papel aprovador.
  * CA86 (delegação): delegação funciona identicamente em Tratativa de app e avulsa.
  * CA90: criação de Ação enviando matrícula inválida por espaços no meio ou `@` recusa com 400 citando Responsável (R27); ausente/vazio ou > 50 caracteres mantêm as mensagens semânticas do 004 (`O campo Responsável é obrigatório.` / `O campo Responsável aceita no máximo 50 caracteres.`); matrícula válida aceita (I2, M8).
  * CA92, CA94: edição comum de outros campos de Ação grava histórico de `Edicao` sem tocar no Responsável e sem gerar histórico de responsável.
  * CA103: Responsável Original é derivado do histórico (valor anterior da primeira Delegação ou o vigente se nunca delegada).
- Falha esperada no RED: action `delegarAcao` inexistente.

**GREEN (papel `dev`)** — commit `feat(green): delegação de Ações com histórico e validação de matrícula (R8, R10, R14, R27, R29, R30)`:
- `db/tratativa.cds`: adicionar `Delegacao` ao enum `EventoHistoricoAcao`.
- `srv/tratativa/acoes-delegacao.ts` (novo): função de domínio `delegarAcao` com validação de formato de código `acao` com `codigoValido` antes do bloqueio D9 (M4), bloqueio pessimista D9 (`bloquearTratativa`), checagem de existência e pertencimento, estado da Tratativa e da Ação (409), validação R3 do novo responsável com `target: novoResponsavel` (M3), justificativa obrigatória via `validarJustificativa(valor, 'delegar')` de `srv/tratativa/justificativa.ts` (I4) e gravação atômica em `HistoricoAcoes`.
- `srv/tratativa/acoes-criacao.ts`: implementar a regra R27 de validação de matrícula diretamente em `acoes-criacao.ts` (invocando `validarMatricula` para o campo `responsavel`), preservando intactas as mensagens semânticas do 004 para ausente/vazio e comprimento > 50, sem modificar nem tocar `srv/tratativa/acoes-validacao.ts` (M5).
- `srv/tratativa-service.cds`: declaração da action `delegarAcao` com `@restrict` para `GestorTratativa`.
- `srv/tratativa-service.ts`: handler para `delegarAcao` aplicando `toLowerCase()` na chave da URL e no parâmetro `acao`.

---

## Etapa 3 — Autorização Dinâmica para Iniciar e Concluir Ação (`mudarStatusAcao`, R11, R16, R28)
**CAs:** CA10, CA11, CA12, CA37, CA38, CA39, CA40, CA41, CA42, CA43, CA44, CA45, CA55, CA56, CA62 (transição), CA86 (execução), CA91, CA95, CA104, CA106, CA107, CA108, CA109, CA110, CA113, CA114, CA115.  
**Itens N3 utilizados:** N3-2, N3-3, N3-4, N3-5, N3-7.

**RED (papel `testes`)** — commit `test(red): autorização dinâmica do Responsável e precedência de etapas em mudarStatusAcao (R11, R16, R28)`:
- `test/autorizacao-execucao-acoes.test.ts` (novo):
  * CA10: usuário autenticado com ID "m1001" inicia Ação de "M1001" (comparação sem caixa).
  * CA11: usuário "M2002" tenta iniciar Ação de "M1001" → 403 Forbidden.
  * CA12: identidade técnica mockada "app-origem-a" autenticada não executa Ação mesmo com matrícula gravada "app-origem-a" (M1).
  * CA37: Responsável inicia Ação Pendente → Em andamento, histórico MudancaStatus com autor M1001 e tipo de autor Usuario.
  * CA38: Responsável conclui Ação Em andamento → Concluída, data de conclusão preenchida com data corrente.
  * CA39: Responsável conclui Ação Pendente direto sem iniciar → aceito.
  * CA40, CA108: Responsável tenta pedir destino `Em andamento` para Ação `Concluída` ou `Cancelada` (tentativa de reabrir) → 403 na etapa 6.
  * CA41: Responsável tenta concluir Ação com Subação pendente → 409 Subações não concluídas.
  * CA42: Responsável da mãe tenta iniciar Subação de outro colaborador → 403; o Responsável da Subação inicia com sucesso.
  * CA43: Responsável tenta concluir Ação em Tratativa `Encerrada` → 409 Tratativa Encerrada não pode ser alterada.
  * CA44, CA109: Responsável de Ação Concluída pede Concluída de novo → autorização etapa 6 concedida, recusa com 409 etapa 8 `Transição não permitida: de Concluída para Concluída.`; pedir Em andamento em Ação já Em andamento recusa com 409 etapa 8.
  * CA45: Responsável conclui sem justificativa com sucesso; Gestor continua podendo iniciar e concluir.
  * CA55, CA56: pedidos recusados de transição pelo Responsável não gravam histórico (CA55); falha simulada no banco na gravação de histórico de MudancaStatus pelo Responsável dispara rollback transacional total do status e dos dados (CA56; I3).
  * CA86 (execução): execução de Ações pelo responsável funciona identicamente em Tratativa de app e avulsa.
  * CA91: Responsável conclui Ação Em andamento com sucesso (CA60 de 004 substituído); cancelar recusa com 403.
  * CA95: não-gestor que não é o Responsável da Ação recebe 403 em qualquer tentativa de transição (CA59 de 004 restrito).
  * CA104, CA106: existência precede autorização dinâmica: não-gestor tentando concluir Ação informando Tratativa errada ou Ação inexistente com formato válido recebe 404 (não 403).
  * CA107: aplicativo de origem tentando iniciar/concluir Ação: com payload de forma inválida (campo desconhecido ou tipo incompatível) recebe 400 runtime; com forma válida (inclusive se o parâmetro `acao` contiver código malformado como `'xyz'` ou `null`) recebe 403 na etapa 3 antes de checar existência no banco (não vaza existência da Ação; CA107, Ruling R-03, Ruling R-04, I1).
  * CA110: Responsável de Ação em Tratativa Encerrada pedindo `Cancelada` recebe 403 na etapa 6 antes do 409 de Tratativa Encerrada.
  * CA113: não-gestor tentando iniciar/concluir: campos desconhecidos/tipo recebem 400 runtime na etapa 2; com código `acao` malformado recebe 400 `Código inválido.` na etapa 4 pelo domínio antes de existência (404) e autorização (403; I1).
  * CA114: Responsável tenta editar descrição, criar subação ou delegar em Ação inexistente → 403 papel estático na etapa 2.
  * CA115: Responsável de Ação `Cancelada` pede destino `Concluída` → autorização etapa 6 concedida, recusa na etapa 8 com 409 `Transição não permitida: de Cancelada para Concluída.`.
- Falha esperada no RED: `mudarStatusAcao` rejeita o Responsável da Ação com 403 estático do runtime CAP por ausência de `GestorTratativa`.

**GREEN (papel `dev`)** — commit `feat(green): autorização dinâmica para iniciar e concluir Ação com precedência detalhada de etapas (R11, R16, R28)`:
- `srv/tratativa-service.cds`: ajustar `@restrict` no entity set `Tratativas` para conceder `mudarStatusAcao` a `authenticated-user`.
- `srv/tratativa-service.ts`: handler `before('*')` existente garante que `AplicativoOrigem` recebe 403 após forma de runtime válida e antes de verificar existência (inclusive se o parâmetro `acao` for malformado ou nulo; Ruling R-03, Ruling R-04, I1).
- `srv/tratativa/acoes-ciclo-de-vida.ts`: reestruturar `mudarStatusAcao` para implementar a precedência estrita de etapas (I1, Ruling R-04):
  1. Autenticação (401 runtime)
  2. Forma do pedido pelo runtime CAP (400 runtime: campos desconhecidos fora da assinatura, tipo JSON incompatível)
  3. Aplicativo de origem (403 handler `before('*')` antes de checar existência; inclusive se o código for malformado ou nulo; R-03, R-04, I1)
  4. Validação de formato de código no domínio (400 `Código inválido.`, `target: acao` via `codigoValido`, após app e antes da existência no banco; CA113)
  5. Existência completa de Tratativa e Ação (404)
  6. Autorização dinâmica (403): verifica se `req.user.is('GestorTratativa')` OU se o usuário é o Responsável da Ação (via `usuarioAutenticadoEhMatricula`) avaliado pelo par (destino, status atual lido na etapa 5): Concluída permitido; Em andamento permitido se Pendente ou Em andamento; qualquer outro destino → 403
  7. Estado da Tratativa (409)
  8. Estado da Ação e Transição (409/400): para o Gestor, status ausente ou vazio → 400 `O campo Status é obrigatório.`, `target: status` (M5); par proibido ou para o mesmo status → 409 `Transição não permitida: de <Status atual> para <Status pedido>.`
  9. Relação mãe-filhas (409)
  10. Validação de justificativa (400) e gravação de histórico com autor = `obterMatriculaUsuario(req)`.

---

## Etapa 4 — Consultas "Minhas Ações" e "Minhas Tratativas" e Visibilidade LGPD (`minhasAcoes`, `minhasTratativas`, R17-R20)
**CAs:** CA48 (minhas), CA65, CA67, CA68, CA69, CA70, CA71, CA72, CA73, CA74, CA75, CA76, CA77, CA78, CA79, CA80, CA81, CA83, CA100, CA112.  
**Itens N3 utilizados:** N3-1, N3-2, N3-3, N3-4, N3-5, N3-6, N3-7.

**RED (papel `testes`)** — commit `test(red): consultas Minhas Ações e Minhas Tratativas com paginação, filtros e controle LGPD (R17-R20)`:
- `test/apoio/responsaveis.ts`: adicionar helpers para as functions `minhasAcoes(GET, params, como)` e `minhasTratativas(GET, params, como)`.
- `test/consultas-responsabilidade.test.ts` (novo):
  * CA48 (minhas): aplicativo de origem tenta consultar `minhasAcoes` ou `minhasTratativas` → 403.
  * CA65: consulta de estrutura de Ações (`consultarEstruturaAcoes`) e detalhe (`consultarAcao`) devolve `responsavel = null` para não-gestores e matrícula para o Gestor.
  * CA67: `minhasAcoes` retorna exatamente os campos esperados (incluindo dados da Tratativa pai e `acaoMae`) e sem a chave `responsavel`.
  * CA68: ordenação de `minhasAcoes` por Prazo crescente e empate por criação crescente (`criadoEm ASC, codigo ASC`).
  * CA69: filtro por Status em `minhasAcoes` retorna apenas as Ações no status solicitado.
  * CA70: filtro por Status inválido em `minhasAcoes` recusa com 400 `Status inválido: use Pendente, Em andamento, Concluída ou Cancelada.`, `target: status`.
  * CA71: paginação padrão de 50 itens; solicitação com `tamanhoPagina > 200` recusa com 400 citando `tamanhoPagina`.
  * CA72: Ação sob responsabilidade em Tratativa `Cancelada` ou `Encerrada` é exibida com o status da Tratativa visível.
  * CA73: Ação delegada desaparece da consulta do colaborador anterior e passa a aparecer na consulta do novo colaborador.
  * CA74: `minhasTratativas` retorna itens com o campo `meuPapel` preenchido com `Responsável Principal` ou `Participante`.
  * CA75: `minhasTratativas` retorna os dez campos da listagem mais `meuPapel`, sem Descrição, Solicitante, Responsável Principal nem Participantes.
  * CA76: colaborador que é apenas Responsável de Ação não visualiza a Tratativa em `minhasTratativas` (aparece apenas em `minhasAcoes`).
  * CA77: filtro por Status em `minhasTratativas`: status válido aceito; status inválido (ex.: "Pendente") recusa com 400 citando `status`.
  * CA78: ordenação de `minhasTratativas` por data prevista crescente e paginação de 50.
  * CA79, CA83: Gestor consulta `minhasAcoes` informando a matrícula de outro colaborador → visualiza as Ações daquele colaborador para redistribuição.
  * CA80: usuário não-gestor consultando com a matrícula de outra pessoa recebe 403; com a própria matrícula recebe 200.
  * CA81: Gestor consultando matrícula sem vínculos recebe lista vazia `[]`; informando matrícula malformada por R3 recebe 400 citando `matricula`.
  * CA100: Gestor consulta com matrícula com espaços ou caixa diferente e encontra registros; colaborador com login "m1001" encontra Ações gravadas como "M1001".
  * CA112: não-gestor informando parâmetro `matricula` em formato inválido recebe 403 na etapa 2 de papel estático (papel precede validação de formato da etapa 8); Gestor recebe 400 da etapa 8.
- Falha esperada no RED: functions `minhasAcoes` e `minhasTratativas` inexistentes (404).

**GREEN (papel `dev`)** — commit `feat(green): consultas Minhas Ações e Minhas Tratativas com paginação e suporte ao Gestor (R17-R20)`:
- `srv/tratativa/consultas-responsabilidade.ts` (novo): implementação das funções `minhasAcoes` e `minhasTratativas` com validação de perfil (Gestor vs próprio usuário com `obterMatriculaUsuario(req)`), validação de matrícula com `validarMatricula` (R3), validação de status de filtro (400), paginação reutilizando a função helper extraída de `listagem.ts` (1..200; I2, M9), projeção de colunas com omissão de dados sensíveis e ordenação padrão.
- `srv/tratativa/listagem.ts`: extração neutra de função helper de cálculo de paginação (`extrairPaginacao(tamanhoPagina, pagina)`), reutilizada por `consultas-responsabilidade.ts`, preservando 100% inalterado o comportamento e contrato de `listarTratativas` e `consultarTratativa` de 003 (I2).
- `srv/tratativa-service.cds`: declaração dos tipos `ItemMinhasAcoes`, `ItemMinhasTratativas` e das functions `minhasAcoes` e `minhasTratativas`.
- `srv/tratativa-service.ts`: handlers delegando para `consultas-responsabilidade.ts`.
- Ao final: execução completa de `sh agentic/mecanismos/scripts/verify.sh` verde.

---

## N3 aprovados no Gate 1
- N3-1 (design): alteração aditiva em `db/tratativa.cds` com colunas e tabelas de responsáveis e participantes (etapas 1 e 2).
- N3-2 (design): módulo único de identidade `srv/tratativa/identidade.ts`, flexibilização de autorização dinâmica de `mudarStatusAcao` no `@restrict` do CDS, e `@restrict` exclusivo de `consultarResponsaveis` para `GestorTratativa` (etapas 1 a 4; M7).
- N3-3 (design): recusa 403 para identidade `AplicativoOrigem` em todas as rotas e actions do `TratativaService` (em `mudarStatusAcao`: após forma válida e antes da existência; R-03).
- N3-4 (design): novas actions e functions públicas no contrato OData V4 em `/api/tratativa/v1` (`atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante`, `delegarAcao`, `consultarResponsaveis`, `minhasAcoes`, `minhasTratativas`) e preservação das mensagens semânticas do 004 em `criarAcao` (etapas 1, 2 e 4; M8).
- N3-5 (design): padrão restritivo de formato de matrícula R3 (etapas 1, 2 e 4).
- N3-6 (design): marcações `@PersonalData` em matrículas, consulta segregada `consultarResponsaveis` e omissão de dados de responsáveis para não-gestores (etapas 1 e 4).
- N3-7 (design): manutenção de dependências e deploy inalterados (etapas 1 a 4).

---

## Critérios de pronto
- Etapa 1: CA1, CA2, CA4–CA8, CA9 (participante), CA13, CA14, CA15, CA16, CA17, CA18, CA19, CA20, CA21, CA22, CA23, CA24, CA25, CA32, CA33, CA34 (atribuir/incluir/remover), CA36, CA46, CA47 (atribuir/incluir/remover), CA48 (atribuir/incluir/remover/consultarResponsaveis), CA49, CA50, CA51, CA52, CA54, CA55, CA56, CA58, CA60, CA62 (tratativa), CA63, CA64, CA66, CA84 (atribuição), CA86 (atribuição), CA87, CA88, CA89, CA96, CA97, CA98, CA99, CA101, CA102, CA111, M6.
- Etapa 2: CA3, CA9 (responsável), CA26, CA27, CA28, CA29, CA30, CA31, CA34 (delegação), CA35, CA47 (delegação), CA48 (delegação), CA53, CA55 (delegação), CA56 (delegação), CA57, CA59, CA61, CA62 (delegação), CA82, CA84 (delegação), CA85, CA86 (delegação), CA90, CA92, CA93, CA94, CA103, CA105.
- Etapa 3: CA10, CA11, CA12, CA37, CA38, CA39, CA40, CA41, CA42, CA43, CA44, CA45, CA55 (transição), CA56 (transição), CA62 (transição), CA86 (execução), CA91, CA95, CA104, CA106, CA107, CA108, CA109, CA110, CA113, CA114, CA115.
- Etapa 4: CA48 (minhas), CA65, CA67, CA68, CA69, CA70, CA71, CA72, CA73, CA74, CA75, CA76, CA77, CA78, CA79, CA80, CA81, CA83, CA100, CA112.
- Cobertura integral dos 115 Critérios de Aceite da spec `responsaveis-e-participantes` e da verificação M6.
- Todos os testes de intents anteriores (002, 003 e 004 em `agentic/.estado/worktrees/plano-de-acao-001-acoes-hierarquicas/agentic/projeto/specs/plano-de-acao/`) mantidos íntegros e 100% verdes.
- Quatro pares de commits `test(red):` e `feat(green):` registrados sequencialmente na branch, cada RED validado pelo script `verifica-red.sh`.
- `sh agentic/mecanismos/scripts/verify.sh` passando 100% limpo ao fim da branch.

## Questões em aberto
- Nenhuma questão impeditiva técnica para execução. As decisões delegadas Decisão A (autorização dinâmica), Decisão B (ponto único de identidade) e Decisão C (LGPD e retenção) do design aguardam ratificação formal do humano no Gate 1 (M10).
