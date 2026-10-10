# Task 001: comentarios

**Spec:** agentic/projeto/specs/comentarios/spec.md  
**Status:** publicada  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** comentarios/001-comentarios

## Objetivo
Entregar o intent 007 inteiro numa branch empilhada sobre a base consolidada dos intents anteriores (004, 005 e 006), dividida em três etapas sequenciais RED/GREEN: (1) Comentários diretos na Tratativa (`comentarTratativa` e `listarComentariosTratativa`) com modelo relacional, imutabilidade, menções, validações, serialização D9, permissões dinâmicas (Gestor, Responsável Principal, Participantes), ordenação e paginação (R1-R4, R7, R8, R13); (2) Comentários em Ações e Subações (`comentarAcao` e `listarComentariosAcao`) com permissões dinâmicas (Gestor, Responsável da Ação/Subação), segregação hierárquica, impacto da Delegação e estados alteráveis (R1, R5, R6, R7, R11, R13); (3) Auditoria imutável (`InclusaoComentario`), serialização pessimista D9 contra encerramento simultâneo, atividade recente derivada para alertas e precedência consolidada D10 em 9 etapas (R9, R10, R12, R14, R15), conforme desenhado em `agentic/projeto/specs/comentarios/design.md`.

## Arquivos
- `db/tratativa.cds`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/tratativa/comentarios-validacao.ts`
- `srv/tratativa/comentarios-inclusao.ts`
- `srv/tratativa/comentarios-consulta.ts`
- `test/apoio/comentarios.ts`
- `test/comentarios-tratativa.test.ts`
- `test/comentarios-acao.test.ts`
- `test/comentarios-auditoria-concorrencia.test.ts`

## Interfaces
- **Produz:**
  - `TratativaService` (`/api/tratativa/v1`) com o CDS completo da seção "Contrato executável" do design:
    * Novas actions ligadas à entidade `Tratativas`: `comentarTratativa(texto, mencoes)` e `comentarAcao(acao, texto, mencoes)` com grant para `authenticated-user` somado diretamente ao elemento de `authenticated-user` no `@restrict` existente da entidade `Tratativas` e avaliação dinâmica no domínio.
    * Novas functions públicas estruturadas: `listarComentariosTratativa(tratativa, tamanhoPagina, pagina)` e `listarComentariosAcao(tratativa, acao, tamanhoPagina, pagina)`.
    * Projeção `@readonly` `@restrict: [{ grant: ['READ'], to: 'GestorTratativa' }]` de `Comentarios` garantindo recusa 405 para escrita direta e 403 para leitura por não-Gestor.
  - Modelo persistido em `db/tratativa.cds`: entidades `Comentarios` e `MencoesComentario` com anotações `@PersonalData`, e novo evento `InclusaoComentario` nos enums `EventoHistorico` e `EventoHistoricoAcao`.
  - Módulos de domínio em `srv/tratativa/`: `comentarios-validacao.ts`, `comentarios-inclusao.ts`, `comentarios-consulta.ts`.
  - Contrato de erros consolidado em 9 etapas estendendo a decisão D10 (mensagens literais, `target` específico para cada parâmetro e códigos HTTP 400, 401, 403, 404, 409; chave da Tratativa na URL de bound actions devolve 404 quando inválida/não encontrada; parâmetro `acao` validado no payload com 400 `Código inválido.`, `target: acao`).
- **Consome:**
  - `TratativaService` existente (002–006; `@requires: 'authenticated-user'`).
  - Infraestrutura consolidada:
    * `bloquearTratativa` e `exigirAlteravel` (`srv/tratativa/bloqueio.ts`; decisão D9).
    * `recusar` (`srv/tratativa/recusa.ts`; decisão D10).
    * `registrarHistorico`, `validarAutor` e `LinhaHistorico` (`srv/tratativa/historico.ts`).
    * `validarMatricula` (`srv/tratativa/validacao-matricula.ts`; padrão 005 R3).
    * `usuarioAutenticadoEhMatricula` (`srv/tratativa/identidade.ts`).
    * `codigoValido` (`srv/tratativa/consulta.ts`).
    * `agora`, `dataCivil` (`srv/lib/relogio.ts`).
  - Helpers de teste em `test/apoio/`: `usuarios.ts` (`comoGestor`, `comoUsuario`, `comoApp`, `semAuth`), `banco.ts` (`linhas`), `tratativas.ts` (`criarAvulsa`, `abrirPorApp`, `mudarStatus`, `sufixoUnico`), `acoes.ts` (`criarAcao`, `criarSubacao`, `consultarEstruturaAcoes`), `responsaveis.ts` (`atribuirResponsavelPrincipal`, `incluirParticipante`, `delegarAcao`).

## Regras para todas as etapas
- **Commits por etapa:** `test(red): <etapa> …` contendo exclusivamente arquivos de `test/` (e, se necessário, este arquivo de task); seguido de `feat(green): <etapa> …` contendo o código de produção correspondente. Nunca alterar testes de commits RED anteriores.
- **Arquivo de teste novo por RED:** o mecanismo `verifica-red.sh` valida o RED por arquivo novo e exige que os testes novos falhem estritamente no commit RED.
- **Helpers em `test/apoio/` sem asserções:** nenhum helper pode conter chamadas a `expect(`. Todas as asserções pertencem estritamente aos arquivos `*.test.ts`.
- **Testes não importam `srv/`:** a interação dos testes de integração ocorre exclusivamente via requisições OData V4 (`POST`, `GET` do `cds.test`) ou leitura direta do banco via `linhas(...)` de `test/apoio/banco.ts`.
- **Preservação de contratos existentes:** nenhum tipo de retorno existente do 002–006 é modificado. Todos os testes com conferência de chaves exatas permanecem íntegros.
- **Isolamento de massa e concorrência:** utilizar `sufixoUnico()` em nomes e identificadores para prevenir colisão na base compartilhada da suíte de testes.
- **Verificação obrigatória:** executar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## N3 aprovados no Gate 1
- N3-1 (design): Criação das entidades `Comentarios` e `MencoesComentario` em `db/tratativa.cds`, e extensão dos enums de histórico com `InclusaoComentario`.
- N3-2 (design): Concessão de autorização e roles CDS: grant `authenticated-user` nas actions com avaliação de papéis no domínio, e bloqueio de GET direto em `Comentarios` para não-Gestor.
- N3-3 (design): Exceção consciente às regras 005 R17 e 006 R11 sob LGPD: texto, data/hora e autor visíveis aos autorizados; lista de menções mascarada como `null` para não-Gestores; orientação de uso com risco residual declarado de permanência do texto; histórico gravado sem o texto do comentário.
- N3-4 (design): Precedência consolidada de recusas em 9 etapas com devolução de lista vazia `[]` com HTTP 200 para usuários desvinculados na etapa 6 antes de parâmetros de paginação.

---

## Etapa 1 — Comentários na Tratativa (`comentarTratativa`, `listarComentariosTratativa`)
**CAs:** CA1, CA4 (tratativa), CA5, CA6, CA7, CA8, CA9, CA10, CA11, CA12, CA13, CA14, CA15 (tratativa), CA16, CA17, CA20, CA24 (tratativa), CA25 (tratativa), CA26, CA27, CA31, CA32, CA33, CA33a, CA35a, CA38 (tratativa), CA39, CA40 (tratativa), CA41, CA42, CA43, CA44, CA44a, CA44b, CA49, CA50, CA54, CA55, CA56, CA57, CA62, CA64, CA67 (tratativa).  
**Itens N3 utilizados:** N3-1, N3-2, N3-3, N3-4.

**RED (papel `testes`)** — commit `test(red): inclusão e consulta de comentários na Tratativa com imutabilidade, menções e visibilidade LGPD (R1-R4, R7, R8, R13)`:
- `test/apoio/comentarios.ts` (novo, sem `expect`): helpers para invocações OData V4:
  * `comentarTratativa(POST, tratativa, dados, como)`
  * `comentarAcao(POST, tratativa, dados, como)`
  * `listarComentariosTratativa(GET, params, como)`
  * `listarComentariosAcao(GET, params, como)`
- `test/comentarios-tratativa.test.ts` (novo):
  * CA1: Gestor inclui comentário válido na Tratativa Aberta via `comentarTratativa` -> 200 `{ codigo }`, persistido no banco com `acao_codigo` null e data/hora.
  * CA4 (tratativa): bound action `comentarTratativa` com chave na URL malformada ou inexistente devolve 404 `Tratativa não encontrada.`.
  * CA5: comentário com texto de exatamente 2.000 caracteres aceito com sucesso e recebe Código UUID gerado.
  * CA6: comentário com espaços nas pontas grava o texto com trim.
  * CA7: comentário com texto vazio ou contendo apenas espaços recusa na etapa 9 com 400 `O campo Texto do comentário é obrigatório.`, `target: texto`.
  * CA8: comentário com texto de 2.001 caracteres recusa na etapa 9 com 400 `O campo Texto do comentário aceita no máximo 2000 caracteres.`, `target: texto`.
  * CA9: tentativa de PUT, PATCH ou DELETE em comentários recusa com 405 Method Not Allowed; tentativa de GET direto em `/Comentarios` ou `$expand` por não-Gestor recusa com 403 Forbidden.
  * CA10: comentário informando lista de menções `["M1001", "M2002"]` persiste as matrículas no metadado de menções.
  * CA11: menção com e-mail ou nome ("usuario@empresa.com", "Ana Lima") recusa na etapa 9 com 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, `target: mencoes`.
  * CA12: comentário informando 11 menções distintas recusa na etapa 9 com 400 `Limite de 10 menções por comentário atingido.`, `target: mencoes`.
  * CA13: menções duplicadas `["M1001", "m1001", "M1001"]` são deduplicadas case-insensitive gravando a grafia da primeira ("M1001") e contando como 1 no limite.
  * CA14: inclusão de comentários não dispara e-mails nem chamadas externas a outros sistemas.
  * CA15 (tratativa): Gestor de Tratativa inclui comentário direto na Tratativa com sucesso.
  * CA16: Responsável Principal da Tratativa (sem papel de Gestor) inclui comentário direto na Tratativa com sucesso.
  * CA17: Participante da Tratativa (sem papel de Gestor) inclui comentário direto na Tratativa com sucesso.
  * CA20: Responsável de Ação (sem papel de Gestor nem na Tratativa) tentando executar `comentarTratativa` recusa na etapa 6 com 403 Forbidden.
  * CA24 (tratativa): usuário comum autenticado sem papel na Tratativa recebe 403 Forbidden para comentar na Tratativa.
  * CA25 (tratativa): Aplicativo de origem tentando executar `comentarTratativa` recebe 403 no início do handler no `before('*')`.
  * CA26: Tratativa com status `Encerrada` recusa comentário com 409 `Tratativa Encerrada não pode ser alterada.`.
  * CA27: Tratativa com status `Cancelada` recusa comentário com 409 `Tratativa Cancelada não pode ser alterada.`.
  * CA31: Gestor consultando `listarComentariosTratativa` recebe a lista completa com `texto`, `criadoEm`, `codigo`, `autor` preenchido e lista `mencoes` preenchida.
  * CA32: Responsável Principal e Participantes consultando `listarComentariosTratativa` recebem comentários com `texto`, `criadoEm`, `codigo`, `autor` preenchido e `mencoes` estritamente como `null` sob LGPD.
  * CA33: Responsável de Ação (sem vínculo na Tratativa) e terceiros autenticados consultando `listarComentariosTratativa` recebem lista vazia `[]` com HTTP 200 (menor privilégio sob LGPD).
  * CA33a: usuário sem vínculo informando parâmetros de paginação inválidos (`pagina = 0` ou `tamanhoPagina = -1`) recebe lista vazia `[]` com HTTP 200 (menor privilégio na etapa 6 precede paginação na etapa 9).
  * CA35a: qualquer usuário sem o papel de Gestor de Tratativa recebe `mencoes` como `null` sob LGPD.
  * CA38 (tratativa): consulta de comentários permitida em Tratativa Encerrada ou Cancelada (leitura livre pós-encerramento).
  * CA39: consulta de comentários não gera histórico nem logs de acesso.
  * CA40 (tratativa): Aplicativo de origem consultando comentários da Tratativa recebe 403 Forbidden.
  * CA41: comentários retornados em ordem cronológica crescente de `criadoEm`.
  * CA42: empate exato na data/hora desempata por ordem alfabética do Código UUID (`codigo ASC`).
  * CA43: paginação padrão com 50 comentários por página devolvendo coleção simples `many ItemComentario` (sem envelope).
  * CA44: `listarComentariosTratativa` com `tamanhoPagina = 201` ou menor que 1 recusa na etapa 9 com 400 `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina`.
  * CA44a: `listarComentariosTratativa` com `pagina = 0` ou negativo recusa na etapa 9 com 400 `O campo Página deve ser 1 ou maior.`, `target: pagina`.
  * CA44b: requisição informando tanto `tamanhoPagina = 201` quanto `pagina = 0` recusa nomeando `tamanhoPagina` (validado antes de `pagina`).
  * CA49: payload contendo propriedades desconhecidas (fora da assinatura da action, como campos de anexo) recusa na etapa 2 com 400 do runtime.
  * CA50: visibilidade uniforme e consistente entre os autorizados, sem comentários privados ou por área.
  * CA54: usuário não autenticado recebe 401 na etapa 1.
  * CA55: payload com JSON malformado recusa com 400 do runtime na etapa 2.
  * CA56: Aplicativo de origem com código malformado recebe 403 na etapa 3.
  * CA57: Gestor enviando comentário para Código de Tratativa inexistente recebe 404 `Tratativa não encontrada.`.
  * CA62: comportamento idêntico em Tratativas de qualquer Origem e avulsas.
  * CA64: `consultarTratativa` da spec 003 mantém exatamente as 12 chaves originais sem incluir comentários.
  * CA67 (tratativa): parâmetro `tratativa` com formato malformado na consulta `listarComentariosTratativa` recusa na etapa 4 com 400 `Código inválido.`, `target: tratativa`; chave malformada na URL de `comentarTratativa` devolve 404 `Tratativa não encontrada.`.
- Falha esperada no RED: action `comentarTratativa` e function `listarComentariosTratativa` inexistentes no serviço (404/501).

**GREEN (papel `dev`)** — commit `feat(green): inclusão e consulta de comentários na Tratativa com imutabilidade e visibilidade LGPD (R1-R4, R7, R8, R13)`:
- Adição das entidades `Comentarios` e `MencoesComentario` em `db/tratativa.cds`.
- Declaração dos tipos, action `comentarTratativa` (com grant somado diretamente ao `@restrict` existente em `Tratativas`), function `listarComentariosTratativa` e projeção `@readonly` de `Comentarios` em `srv/tratativa-service.cds`.
- Criação de `srv/tratativa/comentarios-validacao.ts` com validação de texto, trim e menções conforme 005 R3.
- Criação de `srv/tratativa/comentarios-inclusao.ts` e `srv/tratativa/comentarios-consulta.ts` implementando regras de autorização dinâmica de Tratativa, menor privilégio e mascaramento LGPD de `mencoes`.
- Registro dos handlers em `srv/tratativa-service.ts`.

---

## Etapa 2 — Comentários em Ações e Subações (`comentarAcao`, `listarComentariosAcao`)
**CAs:** CA2, CA3, CA4 (acao), CA15 (acao), CA18, CA19, CA21, CA22, CA23, CA24 (acao), CA25 (acao), CA28, CA29, CA30, CA34, CA35, CA36, CA37, CA38 (acao), CA40 (acao), CA58, CA59, CA61, CA65, CA66, CA67 (acao).  
**Itens N3 utilizados:** N3-2, N3-3, N3-4.

**RED (papel `testes`)** — commit `test(red): comentários em Ações e Subações com segregação hierárquica e controle de estados (R1, R5, R6, R7, R11, R13)`:
- `test/comentarios-acao.test.ts` (novo):
  * CA2: Responsável da Ação inclui comentário na sua Ação via `comentarAcao` -> comentário criado vinculado à Ação e à Tratativa.
  * CA3: Responsável da Subação inclui comentário na sua Subação via `comentarAcao` -> comentário vinculado à Subação.
  * CA4 (acao): chamada a `comentarAcao` sem informar o parâmetro `acao` no payload (ou com valor null/vazio) recusa na etapa 4 com 400 `Código inválido.`, `target: acao`.
  * CA15 (acao): Gestor de Tratativa comenta em qualquer Ação da Tratativa com sucesso.
  * CA18: Responsável da Ação comenta na sua própria Ação com sucesso.
  * CA19: Responsável da Subação comenta na sua Subação com sucesso.
  * CA21: Responsável Principal da Tratativa (não Gestor nem executor da Ação) tentando comentar em Ação recusa na etapa 6 com 403 Forbidden.
  * CA22: Participante da Tratativa tentando comentar em Ação recusa na etapa 6 com 403 Forbidden.
  * CA23: Responsável de uma Ação A1 tentando comentar na Ação A2 recusa com 403 Forbidden.
  * CA24 (acao): usuário comum sem papel recebe 403 Forbidden para comentar em Ação.
  * CA25 (acao): Aplicativo de origem tentando executar `comentarAcao` recebe 403 na etapa 3.
  * CA28: Ação com status `Concluída` recusa comentário com 409 `Ação Concluída não pode ser alterada.`.
  * CA29: Ação com status `Cancelada` recusa comentário com 409 `Ação Cancelada não pode ser alterada.`.
  * CA30: Ação Concluída reaberta para `Em andamento` aceita novos comentários com sucesso.
  * CA34: Gestor consultando `listarComentariosAcao` recebe os comentários da Ação com `autor` e `mencoes` preenchidas.
  * CA35: Responsável da Ação consultando `listarComentariosAcao` da sua própria Ação recebe os comentários com `autor` preenchido e `mencoes` como `null` sob LGPD.
  * CA36: Responsável de Subação consulta comentários de sua Subação com sucesso; consultando comentários da Ação mãe recebe lista vazia `[]`.
  * CA37: Responsável Principal e Participantes da Tratativa consultando comentários de Ação recebem lista vazia `[]` com HTTP 200.
  * CA38 (acao): leitura de comentários de Ação Concluída ou Cancelada permitida livremente.
  * CA40 (acao): Aplicativo de origem consultando comentários de Ação recebe 403 Forbidden.
  * CA58: Gestor comentando informando Código de Ação inexistente recebe 404 `Ação não encontrada.`.
  * CA59: Gestor comentando informando Código de Ação pertencente a outra Tratativa recebe 404 `Ação não encontrada.`.
  * CA61: Responsável enviando texto de 2.500 caracteres para Ação Concluída recebe 409 `Ação Concluída não pode ser alterada.` (estado da Ação na etapa 8 precede validação de campos na etapa 9).
  * CA65: após Delegação da Ação (005 R8 / Ruling R-07), antigo Responsável perde acesso para postar (403) e listar (`[]`); novo Responsável delegado assume acesso total para postar e listar.
  * CA66: Ação com `evidenciaObrigatoria = true` e comentários registrados recusa transição para Concluída sem evidências com 409 `Ação com Evidência obrigatória não pode ser concluída sem Evidência.`.
  * CA67 (acao): parâmetro `acao` malformado no payload de `comentarAcao` ou na consulta `listarComentariosAcao` recusa na etapa 4 com 400 `Código inválido.`, `target: acao`.
- Falha esperada no RED: action `comentarAcao` e function `listarComentariosAcao` inexistentes no serviço (404/501).

**GREEN (papel `dev`)** — commit `feat(green): comentários em Ações e Subações com segregação hierárquica e controle de estados (R1, R5, R6, R7, R11, R13)`:
- Declaração de `comentarAcao` (com grant somado diretamente ao `@restrict` existente em `Tratativas`) e `listarComentariosAcao` em `srv/tratativa-service.cds`.
- Implementação de regras de autorização de Ação, segregação de subações e reflexo de delegação em `srv/tratativa/comentarios-inclusao.ts` e `srv/tratativa/comentarios-consulta.ts`.
- Validação de estados da Ação (`Pendente`/`Em andamento`) antes de campos.
- Registro dos handlers em `srv/tratativa-service.ts`.

---

## Etapa 3 — Auditoria Imutável (`InclusaoComentario`), Concorrência D9 e Atividade Recente Derivada
**CAs:** CA45, CA46, CA47, CA48, CA51, CA52, CA52a, CA53, CA60, CA63.  
**Itens N3 utilizados:** N3-1, N3-3, N3-4.

**RED (papel `testes`)** — commit `test(red): auditoria de comentários, serialização pessimista D9 e atividade recente (R9, R10, R12, R14, R15)`:
- `test/comentarios-auditoria-concorrencia.test.ts` (novo):
  * CA45: inclusão com sucesso de comentário fica disponível para derivação de última atividade recente pelo intent 010, comprovando ausência de colunas físicas novas na entidade `Tratativas`.
  * CA46: comentário na Tratativa gera histórico imutável com evento canônico `InclusaoComentario` na origem `Tratativa` com `campo: 'comentario'`, `valorNovo: codigoComentario`, autor e data/hora, sem incluir o texto sob LGPD.
  * CA47: comentário na Ação gera histórico com evento `InclusaoComentario` na origem `Acao` associado à respectiva Ação e Tratativa, sem incluir o texto.
  * CA48: requisições de comentários recusadas não geram registros de histórico.
  * CA51: falha simulada de persistência dispara rollback total da transação sem gravação órfã de comentário.
  * CA52: duas inclusões simultâneas de comentários na mesma Tratativa são serializadas pelo lock pessimista D9, persistindo ambos com integridade.
  * CA52a: inclusão de comentário disparada simultaneamente com o encerramento da Tratativa é serializada pela D9: ou o comentário é gravado antes e o encerramento o vê, ou o encerramento conclui antes e o comentário recusa com 409 `Tratativa Encerrada não pode ser alterada.`.
  * CA53: consultas de leitura de comentários não adquirem lock pessimista na Tratativa.
  * CA60: envio de comentário com texto longo para Tratativa Encerrada recusa na etapa 7 com 409 `Tratativa Encerrada não pode ser alterada.` antes de validar tamanho do texto na etapa 9.
  * CA63: evento `InclusaoComentario` formalmente catalogado nos enums de histórico.
- Falha esperada no RED: ausência de evento `InclusaoComentario` nos enums do modelo e falha nas asserções de concorrência/auditoria.

**GREEN (papel `dev`)** — commit `feat(green): auditoria de comentários, serialização pessimista D9 e atividade recente (R9, R10, R12, R14, R15)`:
- Extensão dos enums `EventoHistorico` e `EventoHistoricoAcao` em `db/tratativa.cds`.
- Integração de `registrarHistorico` com evento `InclusaoComentario` em `srv/tratativa/comentarios-inclusao.ts`.
- Garantia de bloqueio pessimista via `bloquearTratativa(codigoTratativa)` (D9) antes de qualquer leitura ou escrita.
- Validação de precedência da etapa 7 sobre etapa 9.

---

## Critérios de pronto
- Todos os 72 critérios de aceite (CA1 a CA67, incluindo CA33a, CA35a, CA44a, CA44b, CA52a) cobertos e testados.
- Testes automatizados executando limpos via jest + `cds.test` com SQLite em memória.
- Preservação integral dos contratos públicos existentes das specs anteriores (002–006), incluindo `DetalheTratativa` com 12 chaves.
- Nenhuma coluna física criada em `Tratativas` para última atividade recente (R9).
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
<nenhuma>
