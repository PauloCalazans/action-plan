# Task 001: historico-e-auditoria

**Spec:** agentic/projeto/specs/historico-e-auditoria/spec.md  
**Status:** em-andamento  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** historico-e-auditoria/001-historico-e-auditoria

## Objetivo
Entregar o intent 008 unificando a consulta da trilha de auditoria e do histórico de Tratativas e Ações em modo estritamente somente-leitura (read-only) sobre a base das specs integradas (002 a 007), dividida em 4 etapas sequenciais RED/GREEN:
1. **Consulta unificada, catálogo canônico e ordenação determinística:** superfície CDS em `TratativaService` (`consultarHistoricoTratativa`), unificação das tabelas existentes (`HistoricoTratativa` e `HistoricoAcoes`), catalogação canônica de origens e eventos sem regravação, desempate temporal multidimensional sem alteração de esquema HDI, paginação direta `returns many ItemHistorico` e preservação do contrato de 12 chaves de `consultarTratativa` (R1, R2, R4, R6, R14; CA1-CA4, CA7, CA8, CA17-CA20, CA54, CA55);
2. **Filtros avançados e validações de paginação:** filtros combináveis por `tipoEvento`, `codigoAcao` (validação de formato, existência e pertinência), `periodoInicio`, `periodoFim` (validação ISO 8601 e intervalo) e limites de paginação (`tamanhoPagina` de 1 a 200, `pagina >= 1`) com mensagens de erro e alvos (`target`) nominais (R6, R7; CA21-CA34);
3. **Autorização dinâmica, segregação de menor privilégio e mascaramento LGPD:** permissões em tempo de execução para `GestorTratativa` (visão irrestrita), `Responsável Principal` e `Participantes` (somente eventos diretos de Tratativa), `Responsável da Ação` (somente eventos da própria Ação com segregação entre mãe e filhas), múltiplos papéis, efeito dinâmico da Delegação, retorno de lista vazia `[]` para desvinculados com HTTP 200, e mascaramento estrito de `autor: null`, `justificativa: null` e matrículas de colaboradores em detalhes para não-Gestores (R5, R8, R9; CA9-CA15, CA27a, CA35-CA42);
4. **Precedência consolidada D10, imutabilidade absoluta e integridade:** precedência de recusas em 7 etapas da decisão D10 comprovando que existência (404) precede filtros (400) e filtros precedem retorno por vínculo (200 / `[]`), rejeição imediata de `AplicativoOrigem` (403), imutabilidade absoluta contra PUT/PATCH/DELETE (405/404), integridade da reabertura append-only e suporte temporal aos indicadores analíticos do intent 012 (R3, R10, R11, R12, R13; CA5, CA6, CA16, CA43-CA53).

---

## Arquivos
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/tratativa/historico-consulta.ts`
- `srv/tratativa/historico-catalogo.ts`
- `srv/tratativa/historico-autorizacao.ts`
- `test/apoio/historico.ts`
- `test/historico-consulta-unificada.test.ts`
- `test/historico-filtros-paginacao.test.ts`
- `test/historico-autorizacao-lgpd.test.ts`
- `test/historico-precedencia-imutabilidade.test.ts`
- `test/historico-paginacao-restrita.test.ts`

---

## Interfaces

- **Produz:**
  - Superfície CDS compilável declarada em `TratativaService` (`/api/tratativa/v1`):
    * Function pública `consultarHistoricoTratativa(tratativa, tipoEvento, codigoAcao, periodoInicio, periodoFim, tamanhoPagina, pagina) returns many ItemHistorico`.
    * Tipos estruturados públicos: `ItemHistorico` (com `tipoAutor : m.TipoAutor`) e `DetalheEventoHistorico`.
  - Módulos de domínio em `srv/tratativa/`:
    * `historico-consulta.ts`: orquestração da consulta, leitura direta nas tabelas existentes, unificação de eventos, ordenação determinística e paginação via fatia.
    * `historico-catalogo.ts`: validação e catálogo canônico de eventos e origens (`Tratativa`, `Acao`, `Responsaveis`, `Evidencia`, `Comentario`).
    * `historico-autorizacao.ts`: regras dinâmicas de menor privilégio, avaliação de vínculos em tempo de consulta, segregação de Ações e mascaramento condicional LGPD.
  - Helper de teste em `test/apoio/historico.ts` contendo funções auxiliares para chamada OData à consulta de histórico e montagem de cenários de teste (estritamente sem asserções).
  - Quatro novas suítes completas de teste de integração baseadas em Jest e `cds.test`.

- **Consome:**
  - Entidades persistidas de histórico em `db/tratativa.cds` (modo estritamente read-only): `HistoricoTratativa` e `HistoricoAcoes`.
  - Entidades do ciclo de vida: `Tratativas`, `Acoes`, `ParticipantesTratativa`.
  - Módulos de domínio e infraestrutura existentes:
    * `srv/tratativa/recusa.ts`: função `recusar` para lançamento de erros padronizados com mensagem e `target`.
    * `srv/tratativa/consulta.ts`: função `codigoValido` para validação sintática de UUIDs.
    * `srv/tratativa/identidade.ts`: helper `usuarioAutenticadoEhMatricula` para verificação de identidade funcional.
  - Helpers de teste em `test/apoio/`:
    * `usuarios.ts` (`comoGestor`, `comoUsuario`, `comoApp`, `semAuth`).
    * `tratativas.ts` (`criarAvulsa`, `abrirPorApp`, `mudarStatus`, `sufixoUnico`).
    * `acoes.ts` (`criarAcao`, `criarSubacao`, `mudarStatusAcao`).
    * `responsaveis.ts` (`atribuirResponsavelPrincipal`, `incluirParticipante`, `delegarAcao`).
    * `banco.ts` (`linhas`).

---

## Regras para todas as etapas

- **Commits sequenciais por etapa:** cada etapa é composta rigorosamente por um commit `test(red): <etapa> …` (contendo exclusivamente arquivos em `test/` e, se necessário, este arquivo de task) seguido por um commit `feat(green): <etapa> …` (contendo os arquivos de implementação em `srv/`).
- **Arquivo de teste novo por RED:** cada etapa RED introduz exatamente UM novo arquivo de teste (`test/*.test.ts`) que falha estritamente no commit RED.
- **Proibição de alteração em testes anteriores:** nunca alterar, relaxar ou desabilitar testes criados em commits anteriores.
- **Helpers de teste sem asserções:** o arquivo `test/apoio/historico.ts` e quaisquer outros helpers não podem conter chamadas a `expect(`. Todas as validações pertencem aos arquivos de teste.
- **Testes não importam `srv/`:** a execução dos testes interage com a aplicação exclusivamente via chamadas OData HTTP (`cds.test().get(...)` ou `.post(...)`) ou consultas diretas à base de dados via helper `linhas(...)`.
- **Preservação de contratos existentes (Ruling R-02):** `consultarTratativa` e `DetalheTratativa` permanecem com suas 12 chaves originais sem modificação.
- **Zero alteração de DDL:** nenhuma nova tabela ou coluna é introduzida em `db/tratativa.cds`.
- **Verificação obrigatória:** executar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## N3 aprovados no Gate 1

- N3-1 (design): Superfície pública do `TratativaService` com a nova function `consultarHistoricoTratativa` retornando lista direta `many ItemHistorico` sem envelopamento e preservação estrita do contrato de 12 chaves de `consultarTratativa` (Ruling R-02).
- N3-2 (design): Regras de autorização dinâmica e menor privilégio sob LGPD na leitura do histórico: Gestor com acesso irrestrito; Responsável Principal e Participantes acessam apenas eventos diretos da Tratativa; Responsável da Ação acessa apenas eventos da sua Ação; usuários sem vínculo recebem HTTP 200 com lista vazia `[]`; e rejeição imediata de `AplicativoOrigem` com HTTP 403 (R5, Q5).
- N3-3 (design): Política de proteção de dados pessoais (LGPD): mascaramento obrigatório de `autor: null`, `justificativa: null` e de matrículas em `valorAnterior`/`valorNovo` de colaboradores (`Solicitante`, `Responsável Principal`, `Participante`, `Responsável`) para qualquer usuário que não seja `GestorTratativa` (R5, R8, Q8).
- N3-4 (design): Precedência consolidada de recusas e contrato de erros em 7 etapas (decisão D10, R12), garantindo que validação semântica de filtros (etapa 6) precede a autorização por menor privilégio (etapa 7), e existência (etapa 5) precede validação de filtros.
- N3-5 (design): Critério determinístico de desempate temporal por dados já gravados no modelo persistido (`quando` ASC, `origem` ASC, `tipoEvento` ASC, `id` ASC) sem alteração de esquema HDI nem colunas sequenciais no banco de dados (R6, B2).
- N3-6 (design): Manutenção de histórico permanente append-only no MVP sem registro de logs de acesso a cada consulta de leitura (RAL), delegando a definição final de prazos de guarda e retenção legal para decisão do humano antes de produção (Q15).

---

## Etapas

### Etapa 1: Consulta unificada, catálogo de origens e ordenação determinística
- **Critérios de aceite:** CA1, CA2, CA3, CA4, CA7, CA8, CA17, CA18, CA19, CA20, CA54, CA55.
- **Itens N3:** N3-1, N3-5.
- **Descrição:**
  1. Definir os tipos estruturados `DetalheEventoHistorico` e `ItemHistorico` (com `tipoAutor : m.TipoAutor`) e a function pública `consultarHistoricoTratativa` diretamente em `srv/tratativa-service.cds`.
  2. Implementar `srv/tratativa/historico-catalogo.ts` com o catálogo canônico de eventos e mapeamento de origens (`Tratativa`, `Acao`, `Responsaveis`, `Evidencia`, `Comentario`).
  3. Implementar `srv/tratativa/historico-consulta.ts` realizando leituras paralelas em `HistoricoTratativa` e `HistoricoAcoes` filtradas por `tratativa_codigo`, normalizando os eventos para `ItemHistorico` (com `codigoAcao: null` para eventos de Tratativa e UUID para eventos de Ação).
  4. Implementar a ordenação cronológica crescente com o desempate determinístico multidimensional: `quando` ASC, `origem` ASC, `tipoEvento` ASC, `id` ASC.
  5. Implementar a paginação por fatia (`limit(tamanhoPagina, (pagina - 1) * tamanhoPagina)`) retornando diretamente a lista `many ItemHistorico` sem metadados de envelopamento.
  6. Validar a existência da Tratativa no banco de dados (retornando 404 `Tratativa não encontrada.` quando inexistente).
  7. Garantir que a consulta é idempotente e estritamente de leitura, preservando integralmente `consultarTratativa` com 12 chaves.
- **Arquivo de teste novo:** `test/historico-consulta-unificada.test.ts`.

---

### Etapa 2: Filtros avançados e validações de paginação
- **Critérios de aceite:** CA21, CA22, CA22a, CA23, CA24, CA25, CA26, CA27, CA28, CA29, CA30, CA31, CA32, CA33, CA34.
- **Itens N3:** <nenhum>.
- **Descrição:**
  1. Implementar a validação do parâmetro `tipoEvento` contra os nomes do catálogo canônico de R2; valores inválidos recusam com 400 `Tipo de evento inválido.` (`target: tipoEvento`).
  2. Implementar a validação sintática do filtro `codigoAcao` (UUID válido na etapa 4; inválido recusa com 400 `Código de ação inválido.` com `target: codigoAcao`).
  3. Implementar a validação de existência e pertinência de `codigoAcao` na etapa 5 (Ação inexistente ou pertencente a outra Tratativa recusa com 404 `Ação não encontrada.` com `target: codigoAcao`).
  4. Implementar validação e filtragem por `periodoInicio` e `periodoFim` (validação de formato ISO 8601 com 400 `Data inválida.`; validação de consistência temporal `inicio > fim` com 400 `Período inválido: a data inicial não pode ser posterior à data final.` com `target: periodoInicio`).
  5. Implementar validações de limites de paginação: `tamanhoPagina < 1 || tamanhoPagina > 200` recusa com 400 `O campo Tamanho da página aceita de 1 a 200.` (`target: tamanhoPagina`); `pagina < 1` recusa com 400 `O campo Página deve ser 1 ou maior.` (`target: pagina`).
  6. Aplicar os filtros combinados sobre a lista de eventos consolidada antes da ordenação e do particionamento por página.
- **Arquivo de teste novo:** `test/historico-filtros-paginacao.test.ts`.

---

### Etapa 3: Autorização dinâmica, segregação de menor privilégio e mascaramento LGPD
- **Critérios de aceite:** CA9, CA10, CA11, CA12, CA12a, CA13, CA14, CA15, CA27a, CA35, CA36, CA37, CA38, CA39, CA40, CA41, CA42.
- **Itens N3:** N3-2, N3-3.
- **Descrição:**
  1. Implementar o módulo `srv/tratativa/historico-autorizacao.ts` para avaliar dinamicamente os vínculos do usuário chamador com a Tratativa:
     - Papel `GestorTratativa`: autorização total sobre eventos de Tratativa e de todas as Ações, sem mascaramento;
     - `Responsável Principal` e `Participantes` da Tratativa: autorização concedida exclusivamente para eventos diretos da Tratativa (`codigoAcao === null`);
     - `Responsável da Ação`: autorização concedida exclusivamente para eventos de sua própria Ação;
     - Segregação estrita entre Ação mãe e Subações: Responsável da mãe não vê eventos das Subações (CA12a); Responsável da Subação não vê eventos da Ação mãe (CA12);
     - Acúmulo de papéis: retorno da união exata dos eventos permitidos por seus vínculos (CA13);
     - Avaliação dinâmica de vínculo e efeito imediato na Delegação: o antigo responsável perde o acesso à Ação imediatamente na consulta seguinte, enquanto o novo responsável passa a visualizá-la (CA14);
     - Responsável da Ação 1 filtrando por `codigoAcao` da Ação 2 da mesma Tratativa: retorna HTTP 200 com lista vazia `[]` (CA27a);
     - Usuários autenticados sem nenhum vínculo: retornam HTTP 200 com lista vazia `[]` (CA15).
  2. Implementar a política de mascaramento LGPD para qualquer usuário que não seja `GestorTratativa`:
     - O campo `autor` é entregue como `null`;
     - O campo `justificativa` é entregue como `null`;
     - No objeto `detalhe`: os campos `valorAnterior` e `valorNovo` são entregues como `null` sempre que o campo alterado for uma matrícula de colaborador (`Solicitante`, `Responsável Principal`, `Participante`, `Responsável`).
  3. Garantir conformidade com as regras de minimização de dados: textos de descrição, nomes de arquivos/binários de evidências e textos de comentários nunca são expostos no histórico.
- **Arquivo de teste novo:** `test/historico-autorizacao-lgpd.test.ts`.

---

### Etapa 4: Precedência consolidada D10, imutabilidade absoluta e integridade
- **Critérios de aceite:** CA5, CA6, CA16, CA43, CA44, CA45, CA46, CA47, CA48, CA49, CA50, CA51, CA52, CA53.
- **Itens N3:** N3-4, N3-6.
- **Descrição:**
  1. Garantir a imutabilidade absoluta das entidades de histórico: rejeição de chamadas PUT, PATCH e DELETE com 405 (Method Not Allowed) ou 404 (CA5).
  2. Comprovar que transações e requisições de negócio recusadas não gravam nenhum registro de histórico (CA6).
  3. Implementar a cadeia completa de precedência em 7 etapas da decisão D10 em `srv/tratativa-service.ts`:
     - Etapa 1: Não autenticado → HTTP 401 (CA47);
     - Etapa 2: Parâmetros malformados no runtime CAP → HTTP 400 antes do handler (CA48);
     - Etapa 3: `AplicativoOrigem` → HTTP 403 (rejeitado pelo handler `before('*')` existente com `Aplicativo de origem não usa este serviço.`) no início do handler antes de consultar o banco (CA16, CA49);
     - Etapa 4: Parâmetro `tratativa` ausente, nulo ou com formato inválido → HTTP 400 `Código inválido.` (`target: tratativa`) (CA50, CA51);
     - Etapa 5: Existência da Tratativa/Ação no banco → HTTP 404 (CA52 comprova que existência precede filtros semânticos);
     - Etapa 6: Validação semântica de filtros e paginação → HTTP 400 (CA53 comprova que validação de filtros precede o retorno por vínculo);
     - Etapa 7: Vínculo e autorização na leitura → HTTP 200 (Gestor, vinculados ou lista vazia `[]`).
  4. Validar integridade da reabertura append-only: reabertura de Tratativa preserva o encerramento anterior e reabertura de Ação preserva a conclusão anterior sem cascata automática sobre Ações concluídas (CA43, CA44, CA45).
  5. Garantir a disponibilidade dos carimbos de tempo precisos para suporte aos indicadores analíticos do intent 012 (CA46).
- **Arquivo de teste novo:** `test/historico-precedencia-imutabilidade.test.ts`.

---

## Critérios de pronto

1. Todos os 58 Critérios de Aceite (CA1 a CA55, incluindo CA12a, CA22a e CA27a) implementados e cobertos pelas 4 suítes de teste de integração.
2. Cada etapa possui seu commit `test(red):` e `feat(green):` correspondente, com exatamente um arquivo de teste novo por etapa RED.
3. Nenhum teste de commits anteriores quebrado, relaxado ou alterado.
4. Helpers de teste em `test/apoio/` livres de asserções (`expect(`).
5. Nenhum arquivo de teste importa a camada `srv/`.
6. Preservação estrita dos contratos anteriores: `consultarTratativa` permanece com exatamente 12 chaves.
7. Zero novas tabelas ou colunas adicionadas a `db/tratativa.cds`.
8. Verificação limpa e completa de `sh agentic/mecanismos/scripts/verify.sh` reportando sucesso nos testes, lint, build e arquitetura.
