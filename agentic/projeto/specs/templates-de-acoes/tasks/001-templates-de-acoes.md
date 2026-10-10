# Task 001: templates-de-acoes

**Spec:** agentic/projeto/specs/templates-de-acoes/spec.md  
**Status:** em-andamento  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** templates-de-acoes/001-templates-de-acoes

## Objetivo
Entregar o intent 009 inteiro numa branch empilhada sobre as bases anteriores, dividida em três etapas sequenciais RED/GREEN: (1) Gestão cadastral de templates e itens no serviço de administração com validações de integridade e hierarquia de dois níveis (R1-R4, R14, R15(b)); (2) Consultas públicas padronizadas de listagem e detalhe com ordenação e visibilidade por papel (R12, R15(c)); (3) Aplicação manual atômica de template a Tratativa com serialização pessimista D9, cálculo dinâmico de prazos relativos em UTC, atribuição de responsáveis, preservação estrita de ordem, autonomia de ações e auditoria imutável (R5-R11, R13, R15(a), R16), conforme desenhado em `agentic/projeto/specs/templates-de-acoes/design.md`.

## Arquivos
- `db/tratativa.cds`
- `srv/administracao-service.cds`
- `srv/administracao-service.ts`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/templates/templates-validacao.ts`
- `srv/templates/templates-cadastro.ts`
- `srv/templates/templates-consulta.ts`
- `srv/templates/templates-aplicacao.ts`
- `srv/tratativa/historico.ts`
- `test/apoio/templates.ts`
- `test/templates-gestao.test.ts`
- `test/templates-consultas.test.ts`
- `test/templates-aplicacao.test.ts`

## Interfaces
- **Produz:**
  - `AdministracaoService` (`/api/administracao/v1`) com as actions `criarTemplate`, `editarTemplate`, `ativarTemplate`, `desativarTemplate` e as functions `listarTemplates` e `consultarTemplate`. Toda anotação de autorização é somada aditivamente às declarações existentes do serviço.
  - `TratativaService` (`/api/tratativa/v1`) com as functions `listarTemplates`, `consultarTemplate` e a action ligada a `Tratativas` `aplicarTemplateTratativa(template, responsavelPadrao, atribuicoes)` com grant SOMADO diretamente ao elemento existente `{ grant: [...], to: 'GestorTratativa' }` no `@restrict` da entidade `Tratativas` em `srv/tratativa-service.cds` (Ruling R-02 da 009; sem `annotate` para não substituir os grants de 003–007).
  - Modelo persistido em `db/tratativa.cds`: entidades `Templates` e `ItensTemplate`, composição em `Templates`, e extensões aditivas opcionais em `HistoricoAcoes` (`template`, `templateNome`).
  - Módulos de domínio em `srv/templates/`: `templates-validacao.ts`, `templates-cadastro.ts`, `templates-consulta.ts` e `templates-aplicacao.ts`.
  - Contrato de erros consolidado estendendo a decisão D10 (mensagens literais, `target` específico para cada parâmetro e códigos HTTP 400, 401, 403, 404, 409; chave da Tratativa na URL da action ligada devolve 404 quando inexistente/malformada; parâmetro `template` validado no payload com 400 `Código inválido.`, `target: template`).
- **Consome:**
  - `AdministracaoService` existente (002; `@requires: 'Administrador'`).
  - `TratativaService` existente (002–006; `@requires: 'authenticated-user'`).
  - Infraestrutura consolidada:
    * `bloquearTratativa` e `exigirAlteravel` (`srv/tratativa/bloqueio.ts`; decisão D9).
    * `recusar` (`srv/tratativa/recusa.ts`; decisão D10).
    * `registrarHistorico`, `validarAutor` e `LinhaHistorico` (`srv/tratativa/historico.ts`).
    * `validarMatricula` (`srv/tratativa/validacao-matricula.ts`; padrão 005 R3).
    * `codigoValido` (`srv/tratativa/consulta.ts`).
    * `agora`, `dataCivil` (`srv/lib/relogio.ts`).
  - Helpers de teste em `test/apoio/`: `usuarios.ts` (`comoAdmin`, `comoGestor`, `comoUsuario`, `comoApp`, `semAuth`), `banco.ts` (`linhas`), `tratativas.ts` (`criarAvulsa`, `abrirPorApp`, `mudarStatus`, `sufixoUnico`), `acoes.ts` (`consultarEstruturaAcoes`).

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
- N3-1 (design): Alterações no modelo persistido em `db/tratativa.cds` (`Templates`, `ItensTemplate`, extensão aditiva em `HistoricoAcoes`).
- N3-2 (design): Concessão de autorização e roles CDS (`@requires: 'Administrador'` e actions em `AdministracaoService`; `@restrict` somado para `GestorTratativa` em `aplicarTemplateTratativa` em `TratativaService`, sem sobrescrever anotações existentes).
- N3-3 (design): Proteção de dados pessoais e privacidade LGPD (mascaramento de matrícula `responsavel` nas ações geradas na consulta por não-gestores; exclusão estrita de Descrições do registro de auditoria `Criacao`).
- N3-4 (design): Precedência consolidada de recusas com verificação de papel estático na etapa 2 com HTTP 403 antes de forma e existência (D10, 004 R29, 005 R16).

---

## Etapa 1 — Gestão Cadastral de Templates no Serviço de Administração (`criarTemplate`, `editarTemplate`, `desativarTemplate`, `ativarTemplate`)
**CAs:** CA1, CA2, CA3, CA4, CA5, CA6, CA6a, CA6b, CA7, CA8, CA8a, CA8b, CA8c, CA9, CA10, CA11, CA11a, CA21, CA22 (gestão), CA23 (gestão), CA24a, CA33.  
**Itens N3 utilizados:** N3-1, N3-2, N3-4.

**RED (papel `testes`)** — commit `test(red): gestão cadastral de templates no serviço de administração com regras de integridade e hierarquia (R1-R4, R14, R15(b))`:
- `test/apoio/templates.ts` (novo, sem `expect`): helpers para invocações OData V4:
  * `criarTemplate(POST, dados, como)`
  * `editarTemplate(POST, dados, como)`
  * `ativarTemplate(POST, id, como)`
  * `desativarTemplate(POST, id, como)`
  * `listarTemplatesAdmin(GET, params, como)`
  * `consultarTemplateAdmin(GET, id, como)`
  * `listarTemplates(GET, params, como)`
  * `consultarTemplate(GET, template, como)`
  * `aplicarTemplate(POST, tratativa, dados, como)`
- `test/templates-gestao.test.ts` (novo):
  * CA1: Administrador cria template válido com 4 itens via `criarTemplate` -> 200 `{ id }`, ativo = true e 4 itens persistidos no banco.
  * CA2: criação de template com hierarquia válida de dois níveis (mãe na ordem 1 com ordemPai null, e filhas nas ordens 2 e 3 com ordemPai = 1).
  * CA3: tentativa de criar item com `ordemPai` referenciando outro item que já é subitem recusa na etapa 7 com 400 `Uma Subação não pode ter Subações.`, `target: itens`.
  * CA4: tentativa de criar item com `ordemPai` referenciando ordem inexistente ou auto-referência (`ordemPai == ordem`) recusa na etapa 7 com 400 `Ordem dos itens inválida.`, `target: itens`.
  * CA5: tentativa de criar template com nome já existente recusa na etapa 6 com 409 `Já existe um template com este nome.`, `target: nome`.
  * CA6: tentativa de criar template com nome vazio ou apenas espaços recusa na etapa 7 com 400 `O campo Nome do template é obrigatório.`, `target: nome`.
  * CA6a: nome com 101 caracteres recusa na etapa 7 com 400 `O campo Nome do template aceita no máximo 100 caracteres.`, `target: nome`; 100 caracteres aceito.
  * CA6b: descrição com 501 caracteres recusa na etapa 7 com 400 `O campo Descrição do template aceita no máximo 500 caracteres.`, `target: descricao`; 500 caracteres aceito; vazia/espaços grava null.
  * CA7: lista de itens vazia (`[]`) recusa na etapa 7 com 400 `O template deve conter pelo menos um item.`, `target: itens`.
  * CA8: lista com 31 itens recusa na etapa 7 com 400 `O template aceita no máximo 30 itens.`, `target: itens`; 30 itens aceito.
  * CA8a: itens com ordens duplicadas ou fora da faixa de 1..30 recusam com 400 `Ordem dos itens inválida.`, `target: itens`.
  * CA8b: item com descrição vazia ou com 501 caracteres recusa com 400 `O campo Descrição da ação aceita no máximo 500 caracteres.`, `target: itens`.
  * CA8c: item com prioridade inválida (diferente de Baixa, Média, Alta) recusa com 400 `Prioridade inválida.`, `target: itens`.
  * CA9: item com prazo relativo igual a 0 ou superior a 365 dias recusa na etapa 7 com 400 `O prazo relativo deve ser de 1 a 365 dias.`, `target: prazoRelativoDias`.
  * CA10: `editarTemplate` atualiza nome, descrição e substitui itens para aplicações futuras sem retroagir em ações já criadas; colisão de nome com outro template existente recusa com 409; `id` inexistente recusa na etapa 5 com 404 `Template não encontrado.`, `target: id`; `id` malformado recusa na etapa 4 com 400 `Código inválido.`, `target: id` (M4).
  * CA11: `desativarTemplate` define `ativo = false`; chamado sobre template já inativo retorna 200 de forma idempotente sem alterar dados.
  * CA11a: `ativarTemplate` define `ativo = true`; chamado sobre template já ativo retorna 200 de forma idempotente.
  * CA21: usuário comum ou Gestor de Tratativa tentando criar, editar, desativar ou ativar template recebe 403 `Acesso negado.` na etapa 2 antes de qualquer validação de formato ou de verificação de existência.
  * CA22 (gestão): identidade de Aplicativo de origem tentando executar operações cadastrais de templates recebe 403 `Acesso negado.` na etapa 2.
  * CA23 (gestão): usuário não autenticado recebe 401 na etapa 1.
  * CA24a: criação, edição, ativação e desativação de template não geram registros de histórico na tabela de auditoria da plataforma (AGENTS.md:40).
  * CA33: cadastro do modelo de referência "Condição Insegura" com seus 4 itens (ordem 1 a 4 com prioridades Alta e Média, prazos relativos 2, 5, 15, 20 dias e evidência obrigatória true nos itens 3 e 4) via chamada à API `criarTemplate` aceito com sucesso sem necessidade de carga CSV em `db/data/`.
- Falha esperada no RED: actions `criarTemplate`, `editarTemplate`, `desativarTemplate`, `ativarTemplate` inexistentes no `AdministracaoService` (404/501).

**GREEN (papel `dev`)** — commit `feat(green): gestão cadastral de templates no serviço de administração (R1-R4, R14, R15(b))`:
- Adição das entidades `Templates` e `ItensTemplate` em `db/tratativa.cds`.
- Declaração dos tipos e actions em `srv/administracao-service.cds`.
- Criação de `srv/templates/templates-validacao.ts` com validação de cabeçalho, itens e hierarquia.
- Criação de `srv/templates/templates-cadastro.ts` com regras de criação, edição, ativação e desativação.
- Implementação de `srv/administracao-service.ts` delegando para o domínio com validação estática de papel na etapa 2.

---

## Etapa 2 — Consultas e Visibilidade de Templates (`listarTemplates`, `consultarTemplate`)
**CAs:** CA19a, CA19b (consulta), CA22 (consulta), CA23 (consulta), CA26, CA26a, CA26b, CA27, CA30, M3.  
**Itens N3 utilizados:** N3-2, N3-4.

**RED (papel `testes`)** — commit `test(red): consultas de templates com visibilidade por papel, ordenação e paginação (R12, R15(c))`:
- `test/templates-consultas.test.ts` (novo):
  * CA26: usuário comum listando templates via `listarTemplates` recebe apenas templates com `ativo = true`, ordenados em ordem alfabética ascendente de Nome, com `id`, `nome`, `descricao`, `ativo` e `quantidadeItens`.
  * CA26a: Administrador e Gestor de Tratativa listando templates com filtro `ativo = false` ou `todos` recebem templates inativos; usuários comuns enviando esse filtro continuam recebendo apenas ativos.
  * CA27: consulta de detalhe via `consultarTemplate` por Administrador, Gestor ou usuário comum para template ativo retorna dados do cabeçalho e seus itens em ordem crescente do campo `ordem`.
  * CA26b: usuário comum consultando template com `ativo = false` via `consultarTemplate` recebe 404 `Template não encontrado.`, `target: template`; Gestor e Administrador consultando o mesmo template recebem os dados com sucesso.
  * CA19a: consulta de template via `consultarTemplate` informando Identificador inexistente recusa na etapa 5 com 404 `Template não encontrado.`, `target: template`.
  * CA19b (consulta): `consultarTemplate` informando identificador malformado (não UUID) recusa na etapa 4 com 400 `Código inválido.`, `target: template`.
  * CA30: `listarTemplates` com `tamanhoPagina = 201` recusa na etapa 6 com 400 `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina`; valor 200 aceito; valor 0 ou negativo recusa.
  * M3: `listarTemplates` com `pagina = 0` ou negativo recusa na etapa 6 com 400 `O campo Página deve ser 1 ou maior.`, `target: pagina`; valor padrão 1 assumido quando omitido.
  * CA22 (consulta): Aplicativo de origem tentando consultar ou listar templates recebe 403 `Acesso negado.` na etapa 2 no início do handler.
  * CA23 (consulta): usuário não autenticado recebe 401 na etapa 1.
  * Consulta é estritamente somente-leitura e não grava histórico.
- Falha esperada no RED: functions `listarTemplates` e `consultarTemplate` inexistentes nos serviços (404/501).

**GREEN (papel `dev`)** — commit `feat(green): consultas de templates com ordenação, visibilidade e paginação (R12, R15(c))`:
- Declaração de `listarTemplates` e `consultarTemplate` com tipos estruturados em `srv/tratativa-service.cds` e `srv/administracao-service.cds`.
- Criação de `srv/templates/templates-consulta.ts` implementando a lógica de ordenação por nome, ordenação de itens por `ordem`, visibilidade condicional baseada em papéis (`Administrador`, `GestorTratativa` vs usuário comum) e paginação padronizada.
- Handlers registrados em `srv/tratativa-service.ts` e `srv/administracao-service.ts`.

---

## Etapa 3 — Aplicação de Template em Tratativa (`aplicarTemplateTratativa`) com serialização D9, cálculo de prazos e auditoria
**CAs:** CA12, CA13, CA14, CA14a, CA15, CA16, CA16a, CA16b, CA17, CA18, CA19, CA19b (aplicação), CA20, CA21a, CA22 (aplicação), CA23 (aplicação), CA24, CA25, CA25a, CA28, CA29, CA31, CA32.  
**Itens N3 utilizados:** N3-1, N3-2, N3-3, N3-4.

**RED (papel `testes`)** — commit `test(red): aplicação atômica de template a Tratativa com serialização D9, cálculo de prazos e auditoria (R5-R11, R13, R15(a), R16)`:
- `test/templates-aplicacao.test.ts` (novo):
  * CA13: Gestor aplica template "Condição Insegura" em Tratativa Aberta no dia 2026-10-08 informando `responsavelPadrao = "M1001"` -> gera exatamente 4 Ações com status Pendente, responsável M1001 e prazos calculados dinamicamente em UTC: `2026-10-10`, `2026-10-13`, `2026-10-23` e `2026-10-28`.
  * CA14: aplicação de template contendo itens pai e subitens gera Ações e Subações com `acaoMae` apontando para o UUID gerado da respectiva mãe no mesmo lote.
  * CA14a: estrutura analítica consultada via `consultarEstruturaAcoes` (004 R25) preserva rigorosamente a sequência de `ordem` do template, com carimbos `criadoEm` distintos e estritamente crescentes, e a Ação mãe precedendo suas Subações.
  * CA15: aplicação opera de forma estritamente idêntica sobre Tratativas avulsas e com origem externa.
  * CA16: aplicação enviando lista de `atribuicoes` atribui o responsável especificado ao item correspondente e `responsavelPadrao` aos demais.
  * CA16a: `atribuicoes` com ordens duplicadas recusa na etapa 8 com 400 `Ordem de atribuição duplicada.`, `target: atribuicoes`.
  * CA16b: `atribuicoes` com ordem inexistente no template aplicado recusa na etapa 8 com 400 `Item de template inválido.`, `target: atribuicoes`.
  * CA17: matrícula informada com espaços no meio ou formato de e-mail recusa na etapa 8 com 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, nomeando o campo (`responsavelPadrao` ou `atribuicoes`); espaços nas pontas são removidos antes de validar e gravar (005 R3).
  * CA18: aplicação informando chave de Tratativa inexistente na URL recusa na etapa 5 com 404 `Tratativa não encontrada.`.
  * CA19: aplicação informando Identificador de Template inexistente no payload recusa na etapa 5 com 404 `Template não encontrado.`, `target: template`.
  * CA31: requisição informando chave de Tratativa inexistente na URL combinada com Template inexistente no payload recusa com 404 `Tratativa não encontrada.`, comprovando precedência de existência da Tratativa sobre Template na etapa 5.
  * CA19b (aplicação): parâmetro `template` malformado (não UUID) no payload de `aplicarTemplateTratativa` recusa na etapa 4 com 400 `Código inválido.`, `target: template`.
  * CA20: aplicação em Tratativa Encerrada ou Cancelada recusa na etapa 6 com 409 `Tratativa <Status> não pode ser alterada.`, `target: status`.
  * CA12: aplicação de template com `ativo = false` recusa na etapa 7 com 409 `Template inativo não pode ser aplicado.`, `target: template`.
  * CA21a: usuário autenticado sem papel de Gestor de Tratativa tentando aplicar template recusa na etapa 2 com 403 `Acesso negado.` antes de checar formato ou existência.
  * CA22 (aplicação): Aplicativo de origem tentando aplicar template recusa na etapa 2 com 403 `Acesso negado.`.
  * CA32: Aplicativo de origem tentando aplicar com tratativa malformada na URL recebe 403 na etapa 2 antes de validar formato ou existência.
  * CA23 (aplicação): usuário não autenticado recebe 401 na etapa 1.
  * CA24: aplicação com sucesso de template de 4 itens grava exatamente 4 eventos imutáveis de `Criacao` na origem `Acao` no histórico da Tratativa, vinculados a cada ação gerada, com autor igual ao Gestor autenticado, data/hora, metadado do template gerador (`template: { id, nome }`) e estrita exclusão do texto de Descrição sob LGPD.
  * CA25: Ações geradas comportam-se autonomamente, aceitando edição pelo Gestor (004 R19) e início pelo Responsável (005 R11).
  * CA25a: Ação gerada com `evidenciaObrigatoria = true` bloqueia conclusão sem evidências ativas com 409 `Ação com Evidência obrigatória não pode ser concluída sem Evidência.` (006 R8, M1).
  * CA28: falha de gravação simulada no banco dispara rollback transacional atômico completo, não deixando Ações, Subações nem histórico órfãos.
  * CA29: consulta de estrutura das Ações geradas por usuário sem papel de Gestor devolve campo Responsável como `null` sob LGPD (004 R26, 005 R17).
- Falha esperada no RED: action `aplicarTemplateTratativa` inexistente no `TratativaService` (404/501).

**GREEN (papel `dev`)** — commit `feat(green): aplicação atômica de template a Tratativa com serialização D9, cálculo de prazos e auditoria (R5-R11, R13, R15(a), R16)`:
- Declaração da action ligada `aplicarTemplateTratativa` em `srv/tratativa-service.cds` com seu grant SOMADO diretamente ao elemento existente `{ grant: [...], to: 'GestorTratativa' }` no `@restrict` da entidade `Tratativas` (Ruling R-02 da 009; sem `annotate` para não substituir os grants de 003–007).
- Extensão de `HistoricoAcoes` em `db/tratativa.cds` com `template` e `templateNome`.
- Extensão de `LinhaHistorico` em `srv/tratativa/historico.ts` para persistência dos metadados de template na criação.
- Implementação de `srv/templates/templates-aplicacao.ts`:
  * Bloqueio pessimista da Tratativa via `bloquearTratativa(codigoTratativa)` (decisão D9).
  * Verificação de estado alterável da Tratativa e situação ativa do Template.
  * Validação de `responsavelPadrao` e `atribuicoes` conforme 005 R3.
  * Cálculo dinâmico de prazos adicionando `prazoRelativoDias` à data civil de aplicação em UTC.
  * Atribuição de carimbos `criadoEm` distintos e estritamente crescentes para preservação da ordem analítica (004 R25).
  * Persistência prioritária das Ações mãe antes das Subações para integridade referencial.
  * Gravação atômica dos registros de histórico de `Criacao`.
- Registro do handler em `srv/tratativa-service.ts`.

---

## Critérios de pronto
- Todos os 47 critérios de aceite (CA1 a CA33 com derivações) cobertos e testados.
- Testes automatizados executando limpos via jest + `cds.test` com banco SQLite em memória.
- Preservação integral dos contratos e tipos existentes das specs anteriores (002–006) sem quebra de chaves exatas.
- Zero dependência de arquivos CSV em `db/data/` (AGENTS.md:36).
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
<nenhuma>
