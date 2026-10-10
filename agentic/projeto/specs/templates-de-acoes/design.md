# Design: templates-de-acoes

**Spec:** agentic/projeto/specs/templates-de-acoes/spec.md  
**Status:** aprovado

Escopo técnico: governança, parametrização, consulta e aplicação de Templates de Ações na plataforma de tratativas e planos de ação no SAP BTP, contemplando:
1. Modelo relacional persistido aditivo em `db/tratativa.cds` composto pelo cabeçalho `Templates` e pela composição `ItensTemplate` (máximo de 30 itens, hierarquia estrita de dois níveis com auto-referência e subitens de subitens proibidos, e prazos relativos de 1 a 365 dias), além de vínculo auditável aditivo opcional em `HistoricoAcoes`;
2. Governança administrativa no `AdministracaoService` (`/api/administracao/v1`) restrita exclusivamente ao papel corporativo `Administrador` para criação (`criarTemplate`), edição (`editarTemplate`), ativação (`ativarTemplate`) e desativação lógica (`desativarTemplate`), sem exclusão física (sem DELETE) e sem geração de registros de histórico (AGENTS.md:40);
3. Aplicação manual atômica no `TratativaService` (`/api/tratativa/v1`) via action bound `aplicarTemplateTratativa` restrita ao papel `GestorTratativa`, com serialização por agregado via bloqueio pessimista `bloquearTratativa` (decisão D9), cálculo dinâmico de prazos relativos em UTC, atribuição de Responsável padrão e mapeamento personalizado por item (005 R3), preservação rigorosa da ordem sequencial (`ordem` de 1 a N) na consulta analítica (004 R25) via carimbos de criação (`criadoEm`) distintos e estritamente crescentes no lote, persistência prioritária de Ações mãe antes das Subações, autonomia integral das Ações geradas (regidas por 004, 005 e bloqueio de conclusão por Evidência obrigatória de 006 R8) e gravação de histórico imutável `Criacao` com contextualização do template gerador (`template: { id, nome }`) sem cópia de texto descritivo sob LGPD (004 R23);
4. Consultas públicas estruturadas (`listarTemplates` e `consultarTemplate`) disponíveis em `TratativaService` para usuários autenticados (com visibilidade de inativos restrita a Administrador e Gestor de Tratativa) e espelhadas em `AdministracaoService`, com paginação uniforme (50 por página, máximo 200, página >= 1) e ordenação alfabética por Nome;
5. Contrato uniforme de recusas e erros HTTP estendendo a decisão D10 (com avaliação estática de papéis corporativos na etapa 2 antes de forma e existência, e rejeição imediata do `AplicativoOrigem` com 403 `Acesso negado.`);
6. Ausência mandatória de carga CSV em `db/data/` (prevenindo sobrescrita destrutiva em deploys HDI no SAP HANA Cloud; AGENTS.md:36), viabilizando o modelo de referência "Condição Insegura" via API de administração.

---

## Decisões

1. **Modelo relacional persistido aditivo em `db/tratativa.cds` e ausência de carga CSV** (R1, R2, R14; AGENTS.md:36; N3-1; Q1, Q2, Q4, Q5, Q8).
   - Novas entidades relacionais no namespace `br.com.calazanstec`:
     ```cds
     /** R1, R2 (spec templates-de-acoes): Cabeçalho do template de ações. */
     entity Templates {
       key id        : UUID;
           nome      : String(100) not null;
           descricao : String(500);
           ativo     : Boolean not null default true;
           itens     : Composition of many ItensTemplate on itens.template = $self;
     }

     /** R1, R2 (spec templates-de-acoes): Itens ordenados do template de ações. */
     entity ItensTemplate {
       key id                   : UUID;
           template             : Association to one Templates not null;
           ordem                : Integer not null;
           descricao            : String(500) not null;
           prioridade           : PrioridadeAcao not null default 'Média';
           evidenciaObrigatoria : Boolean not null default false;
           prazoRelativoDias    : Integer not null;
           ordemPai             : Integer;
     }
     ```
   - Extensão aditiva na entidade `HistoricoAcoes` em `db/tratativa.cds`:
     ```cds
     template     : Association to one Templates;
     templateNome : String(100);
     ```
   - **Ausência de carga CSV em `db/data/` (R14, I7):**
     * Nenhum arquivo `.csv` é incluído em `db/data/` para templates. No SAP HANA Cloud, tabelas carregadas por `.hdbtabledata` são sobrescritas ou recriadas a cada deploy HDI, o que destruiria templates customizados, edições e desativações efetuadas pelo Administrador da plataforma.
     * O template de referência da proposta ("Condição Insegura", com seus 4 itens estruturados) é criado e mantido via API administrativa (`criarTemplate`), garantindo reprodutibilidade em testes automatizados e em produção sem acoplamento a código estático (AGENTS.md:36).
   — **Por quê:** modela a estrutura de parametrização relacional com cabeçalho e composição de 1 a 30 itens, viabiliza integridade referencial nativa no banco de dados e resguarda a imutabilidade do modelo em deploys contínuos. A extensão em `HistoricoAcoes` é estritamente aditiva (colunas opcionais nulas), garantindo compatibilidade retroativa total com intents anteriores (002–006) e permitindo auditar com precisão o template gerador.
   — **Verificado por:** compilação SQL limpa (`cds compile --to sql`); novo `CREATE TABLE` de `Templates` e `ItensTemplate`; `npm run build`.

2. **Superfície do `AdministracaoService`: gestão cadastral exclusiva pelo papel `Administrador`** (R3, R4, R13, R15(b); N3-2; Q6).
   - O serviço existente `AdministracaoService` (`/api/administracao/v1`, `@requires: 'Administrador'`) em `srv/administracao-service.cds` recebe diretamente as actions de gestão de templates e funções de consulta:
     ```cds
     // Declarado diretamente no serviço existente AdministracaoService em srv/administracao-service.cds:

     type ItemTemplateInput {
       ordem                : Integer;
       descricao            : String(500);
       prioridade           : String(10);
       evidenciaObrigatoria : Boolean;
       prazoRelativoDias    : Integer;
       ordemPai             : Integer;
     }

     type ResultadoCriacaoTemplate {
       id : UUID;
     }

     type ResultadoAtivacaoTemplate {
       id    : UUID;
       ativo : Boolean;
     }

     action criarTemplate(
       nome      : String,
       descricao : String,
       itens     : many ItemTemplateInput
     ) returns ResultadoCriacaoTemplate;

     action editarTemplate(
       id        : UUID,
       nome      : String,
       descricao : String,
       itens     : many ItemTemplateInput
     );

     action ativarTemplate(
       id : UUID
     ) returns ResultadoAtivacaoTemplate;

     action desativarTemplate(
       id : UUID
     ) returns ResultadoAtivacaoTemplate;

     function listarTemplates(
       ativo         : String,
       tamanhoPagina : Integer,
       pagina        : Integer
     ) returns many ItemListagemTemplate;

     function consultarTemplate(
       template : UUID
     ) returns DetalheTemplate;
     ```
   - **Autorização estática e recusa no início do handler (D10, 004 R29, 005 R16):**
     * Usuários sem o papel `Administrador` ou requisições autenticadas de `AplicativoOrigem` são recusados na etapa 2 com HTTP **403** `Acesso negado.` antes de qualquer validação de formato ou de verificação de existência no banco (CA21, CA22).
     * Toda anotação de autorização em `AdministracaoService` é adicionada aditivamente ao serviço existente, preservando as declarações vigentes.
   - **Desativação lógica sem exclusão física (R4):**
     * Não existe operação DELETE para templates. A desativação altera `ativo = false` e a ativação altera `ativo = true`. Ambas retornam HTTP **200** de forma idempotente quando executadas sobre templates que já se encontram no estado desejado (CA11, CA11a).
   - **Ausência de histórico de auditoria (R3(d), R4, CA24a):**
     * Operações cadastrais de templates são parametrizações administrativas de configuração e não constam no rol taxativo de eventos auditáveis da plataforma fixado em AGENTS.md:40 ("status, responsável, prazo, evidência, encerramento, reabertura"). Portanto, nenhuma linha de histórico é gravada em criação, edição, ativação ou desativação.
   — **Por quê:** centraliza a governança corporativa no serviço administrativo já existente no projeto, evita criação desnecessária de novas roles no XSUAA e preserva o histórico imutável sem poluição de dados cadastrais.
   — **Verificado por:** testes em `test/templates-gestao.test.ts` (CA1–CA11a, CA21, CA22, CA24a, CA33).

3. **Superfície do `TratativaService`: aplicação do template na Tratativa e consultas operacionais** (R5, R6, R7, R8, R12, R15(a,c); N3-2; Q1, Q3, Q10).
   - Declarações diretas em `srv/tratativa-service.cds`:
     ```cds
     // Em srv/tratativa-service.cds (dentro do service TratativaService):

     type ItemListagemTemplate {
       id              : UUID;
       nome            : String(100);
       descricao       : String(500);
       ativo           : Boolean;
       quantidadeItens : Integer;
     }

     type DetalheItemTemplate {
       id                   : UUID;
       ordem                : Integer;
       descricao            : String(500);
       prioridade           : m.PrioridadeAcao;
       evidenciaObrigatoria : Boolean;
       prazoRelativoDias    : Integer;
       ordemPai             : Integer;
     }

     type DetalheTemplate {
       id        : UUID;
       nome      : String(100);
       descricao : String(500);
       ativo     : Boolean;
       itens     : many DetalheItemTemplate;
     }

     type AtribuicaoItemTemplate {
       ordem       : Integer;
       responsavel : String(50);
     }

     type ResultadoAplicacaoTemplate {
       totalAcoesCriadas : Integer;
     }

     function listarTemplates(
       ativo         : String,
       tamanhoPagina : Integer,
       pagina        : Integer
     ) returns many ItemListagemTemplate;

     function consultarTemplate(
       template : UUID
     ) returns DetalheTemplate;

     // Na entidade Tratativas existente:
     // O grant 'aplicarTemplateTratativa' é SOMADO diretamente ao elemento existente
     // { grant: [...], to: 'GestorTratativa' } no @restrict da entidade Tratativas (Ruling R-02 da 009).
     // A action é declarada diretamente dentro do bloco actions { ... } de entity Tratativas:
     //
     // action aplicarTemplateTratativa(
     //   template          : UUID,
     //   responsavelPadrao : String,
     //   atribuicoes       : many AtribuicaoItemTemplate
     // ) returns ResultadoAplicacaoTemplate;
     ```
   - **Autorização declarativa e verificação estática (Ruling R-02 da 009):**
     * `aplicarTemplateTratativa` é concedida exclusivamente ao `GestorTratativa` somando seu grant diretamente ao array `@restrict` já existente de `Tratativas` em `srv/tratativa-service.cds` (nunca utilizando `annotate` que sobrescreveria os grants de 003–007). Idem para `AdministracaoService`, onde qualquer anotação de segurança deve ser somada aditivamente ao serviço existente. Chamadas por usuários sem o papel `GestorTratativa` ou por `AplicativoOrigem` recebem HTTP **403** `Acesso negado.` verificado na etapa 2, antes de checar forma de parâmetros ou existência de recursos (CA21a, CA22, CA32).
   - **Preservação rigorosa de contratos públicos existentes (002–006):**
     * Nenhum campo novo é introduzido nos tipos de retorno existentes (`DetalheTratativa`, `ItemListagem`, `DetalheAcao`, `ItemEstruturaAcao`, `DetalheResponsaveis`, `ItemMinhasAcoes`, `DetalheEvidencia`). Todos os testes RED que realizam asserções de chaves exatas continuam 100% íntegros e inalterados.
   — **Por quê:** respeita a convenção de que ações do ciclo de vida da Tratativa são vinculadas à entidade `Tratativas`, garante integridade de contratos prévios e expõe consultas limpas e tipadas para o frontend Fiori elements.
   — **Verificado por:** compilação `cds compile srv --to csn`; asserções de `$metadata` OData V4; testes em `test/templates-consultas.test.ts` e `test/templates-aplicacao.test.ts`.

4. **Hierarquia estrita de dois níveis e integridade de itens no Template** (R1, R2; Q4, Q8).
   - O domínio em `srv/templates/templates-validacao.ts` valida a estrutura hierárquica do template:
     * Quantidade de itens: de 1 a 30 itens. Lista vazia (`[]`) recusa na etapa 7 com HTTP **400** `O template deve conter pelo menos um item.`, `target: itens` (CA7). Mais de 30 itens recusa com HTTP **400** `O template aceita no máximo 30 itens.`, `target: itens` (CA8).
     * Sequencialidade e unicidade de `ordem`: cada item possui `ordem` inteiro positivo de 1 a 30. Valores fora da faixa ou números de ordem duplicados no mesmo template recusam com HTTP **400** `Ordem dos itens inválida.`, `target: itens` (CA8a).
     * Dois níveis hierárquicos (R2):
       - Item de primeiro nível: `ordemPai == null`.
       - Subitem: `ordemPai` preenchido com o valor de `ordem` de um item de primeiro nível existente no mesmo template.
       - Tentativa de auto-referência (`ordemPai == ordem`) ou referência a ordem inexistente recusa com HTTP **400** `Ordem dos itens inválida.`, `target: itens` (CA4).
       - Tentativa de subitem de subitem (`ordemPai` referenciando um item que já possui `ordemPai` preenchido) recusa com HTTP **400** e a mensagem exata `Uma Subação não pode ter Subações.`, `target: itens` (CA3).
     * Validação de campos de item:
       - `descricao`: 1 a 500 caracteres, não vazio após trim. Inválido recusa com HTTP **400** `O campo Descrição da ação aceita no máximo 500 caracteres.`, `target: itens` (CA8b).
       - `prioridade`: deve pertencer a `Baixa`, `Média`, `Alta` (padrão `Média`). Inválido recusa com HTTP **400** `Prioridade inválida.`, `target: itens` (CA8c).
       - `prazoRelativoDias`: inteiro positivo de 1 a 365. Fora da faixa recusa com HTTP **400** `O prazo relativo deve ser de 1 a 365 dias.`, `target: prazoRelativoDias` (CA9).
       - `evidenciaObrigatoria`: booleano (`true` ou `false`, padrão `false`).
   — **Por quê:** replica fielmente a regra mandante da plataforma de profundidade máxima de dois níveis (004 R2), prevenindo inconsistências relacionais em tempo de parametrização.
   — **Verificado por:** testes de validação hierárquica em `test/templates-gestao.test.ts` (CA2, CA3, CA4, CA7, CA8, CA8a, CA8b, CA8c, CA9).

5. **Serialização por agregado (D9), atomicidade transacional e estado da Tratativa** (R9, R10; Decisão D9; Q9).
   - **Serialização por Tratativa (D9):**
     * A action `aplicarTemplateTratativa` inicia sua execução invocando `bloquearTratativa(codigoTratativa)` em `srv/tratativa/bloqueio.ts` (`SELECT ... FOR UPDATE` no banco de dados na transação do pedido).
     * A leitura e o lock pessimista da Tratativa ocorrem antes de qualquer consulta ao Template e antes de qualquer persistência de Ação, serializando requisições concorrentes e eliminando race conditions (inclusive com encerramento simultâneo da Tratativa).
   - **Estado exigido da Tratativa (R9):**
     * Tratativa com Status `Encerrada` ou `Cancelada` é recusada na etapa 6 com HTTP **409** e a mensagem `Tratativa <Status> não pode ser alterada.`, `target: status` (CA20).
     * Aplicação só é aceita em Tratativas com Status `Aberta` ou `Em andamento`.
   - **Estado do Template (R4):**
     * Template inativo (`ativo == false`) é recusado na etapa 7 com HTTP **409** e a mensagem `Template inativo não pode ser aplicado.`, `target: template` (CA12).
   - **Atomicidade e Rollback (R10):**
     * Toda a operação (criação de Ações, Subações e linhas de histórico) roda na transação atômica do pedido.
     * Caso ocorra falha inesperada ou simulação de erro de gravação, o CAP executa rollback total automático: nenhuma Ação, Subação nem registro de histórico permanece persistido, e a Tratativa permanece inalterada (CA28).
   — **Por quê:** cumpre a decisão arquitetural corporativa D9 e garante consistência relacional total do plano de ação.
   — **Verificado por:** testes com Tratativa encerrada/cancelada e injeção de falha transacional em `test/templates-aplicacao.test.ts` (CA12, CA20, CA28).

6. **Atribuição de Responsáveis com validação 005 R3 e proteção LGPD** (R6; LGPD; N3-3; Q3).
   - **Impessoalidade do Template:**
     * O Template não possui nem grava matrículas pré-fixadas (R3).
   - **Parâmetro `responsavelPadrao` obrigatório:**
     * O Gestor informa obrigatoriamente `responsavelPadrao` ao aplicar o template.
   - **Parâmetro opcional `atribuicoes`:**
     * Permite mapear itens específicos (`[{ ordem: 2, responsavel: "M1002" }]`).
     * Se `atribuicoes` contiver números de `ordem` duplicados, recusa na etapa 8 com HTTP **400** `Ordem de atribuição duplicada.`, `target: atribuicoes` (CA16a).
     * Se contiver número de `ordem` inexistente no Template aplicado, recusa na etapa 8 com HTTP **400** `Item de template inválido.`, `target: atribuicoes` (CA16b).
   - **Validação de formato de matrícula conforme 005 R3 (I3):**
     * Toda matrícula informada (`responsavelPadrao` ou item de `atribuicoes`) passa pelo validador consolidado da plataforma: 1 a 50 caracteres, sem espaços no meio, remove espaços nas pontas antes de validar e gravar, e sem caractere `@`.
     * Formato inválido recusa com HTTP **400** e a mensagem exata `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, com `target: responsavelPadrao` ou `target: atribuicoes` (CA17).
   - **Proteção de visibilidade LGPD (004 R26, 005 R17):**
     * Na consulta subsequente da estrutura analítica de Ações (`consultarEstruturaAcoes`), o campo `responsavel` é revelado integralmente apenas ao `GestorTratativa`; para os demais usuários autenticados, é mascarado como `null` sob LGPD (CA29).
   — **Por quê:** garante conformidade com a LGPD e consistência absoluta com o contrato de dados de colaboradores da spec 005.
   — **Verificado por:** testes em `test/templates-aplicacao.test.ts` (CA16, CA16a, CA16b, CA17, CA29).

7. **Geração das Ações, cálculo dinâmico de prazos e preservação estrita da ordem** (R7; I5; Q3, Q7; M11).
   - **Cálculo de Prazo Relativo em UTC (R7(f), M11):**
     * Data base da aplicação obtida em UTC: `hoje = dataCivil(agora())` (AAAA-MM-DD).
     * Para cada item, `prazo = dataCivil(adicionarDiasUTC(agora(), item.prazoRelativoDias))`.
     * Como `prazoRelativoDias >= 1`, o Prazo resultante é estritamente posterior a hoje, cumprindo 004 R5. Exemplo medido no CA13 com base em `2026-10-08`: itens com prazos relativos de 2, 5, 15 e 20 dias geram exatamente `2026-10-10`, `2026-10-13`, `2026-10-23` e `2026-10-28`.
   - **Preservação estrita da ordem e hierarquia (R7(h), I5):**
     * A consulta analítica de Ações da plataforma (004 R25) ordena os registros por `criadoEm ASC, codigo ASC`.
     * Para que a árvore de Ações e Subações reflita rigorosamente a mesma sequência do Template (`ordem` de 1 a N), a criação em lote atribui carimbos `criadoEm` distintos e estritamente crescentes para cada item gerado no lote:
       `instanteItem = new Date(baseInstante.getTime() + item.ordem * 1000)`.
     * **Integridade referencial imediata:** todas as Ações mãe (`ordemPai == null`) são instanciadas e persistidas no banco antes de qualquer de suas Subações (`ordemPai != null`), mapeando seus Códigos UUID gerados para preenchimento de `acaoMae_codigo`.
     * O resultado consultado via `consultarEstruturaAcoes` devolve as Ações mãe ordenadas por `ordem` e as Subações aninhadas sob suas respectivas mães ordenadas por `ordem` (CA14a).
   - **Status e valores iniciais:**
     * Todas as Ações e Subações nascem com Status `Pendente` (004 R6) e `dataConclusao = null`.
   — **Por quê:** resolve o risco de desordenação por empate de UUID (identificado na 1ª rodada de revisão), garantindo estabilidade e previsibilidade visual e operacional.
   — **Verificado por:** testes em `test/templates-aplicacao.test.ts` (CA13, CA14, CA14a).

8. **Autonomia das Ações geradas e integração com bloqueio de Evidência da spec 006** (R8; I4; M1).
   - Uma vez geradas, as Ações comportam-se como entidades normais do plano de ação:
     * Podem ser editadas pelo Gestor (004 R19), iniciadas e concluídas pelo Responsável ou Gestor (004 R6, 005 R11), canceladas ou reabertas com justificativa (004 R6, R9), e ter o seu Responsável delegado (005 R8).
     * **Bloqueio de conclusão por Evidência obrigatória (006 R8, CA25a, M1):**
       Itens configurados no Template com `evidenciaObrigatoria = true` (como os itens 3 e 4 do modelo Condição Insegura) copiam essa indicação para a Ação gerada. Na tentativa de transicionar para `Concluída` sem que haja evidências válidas ativas anexadas, o pedido é bloqueado na etapa 10 com HTTP **409** e a mensagem exata:
       `Ação com Evidência obrigatória não pode ser concluída sem Evidência.` (harmonizada conforme 006 R8 e M1 do parecer 2).
     * Edições ou desativações posteriores do Template não afetam retroativamente Ações já geradas (CA10, CA25).
   — **Por quê:** estabelece desacoplamento sadio entre modelo de parametrização e instâncias executadas, mantendo a conformidade mandatória de auditoria de evidências.
   — **Verificado por:** testes em `test/templates-aplicacao.test.ts` (CA10, CA25, CA25a).

9. **Auditoria imutável na aplicação e ausência de histórico cadastral** (R3(d), R4, R11; AGENTS.md:40; N3-3; Q11).
   - **Histórico na aplicação (R11, CA24):**
     * Cada Ação e Subação gerada gera um registro imutável em `HistoricoAcoes` com o evento canônico `Criacao` na origem `Acao` (004 R22, 008 R2).
     * O autor gravado é a matrícula do `GestorTratativa` autenticado (`tipoAutor: 'Usuario'`).
     * Metadados do template gerador (`template: { id, nome }`) são associados à linha de histórico através das novas colunas `template_id` e `templateNome`.
     * **Proteção LGPD:** a Descrição da Ação é estritamente omitida do registro de histórico na criação (004 R23).
     * Falhas ou recusas de aplicação nunca gravam histórico (AGENTS.md:40).
   - **Ausência de histórico em operações cadastrais (R3(d), R4, CA24a):**
     * `criarTemplate`, `editarTemplate`, `ativarTemplate` e `desativarTemplate` não gravam registros de histórico de auditoria por não pertencerem ao rol de eventos auditáveis de AGENTS.md:40.
   — **Por quê:** harmoniza os princípios de rastreabilidade de ações em campo com a integridade da tabela de auditoria e conformidade estrita com a LGPD.
   — **Verificado por:** inspeção da tabela `HistoricoAcoes` em `test/templates-aplicacao.test.ts` (CA24, CA24a).

10. **Consultas de Templates: ordenação, paginação padronizada e visibilidade por papel** (R12; M3; Q10).
    - **Listagem (`listarTemplates`):**
      * Retorna `id`, `nome`, `descricao`, `ativo` e `quantidadeItens`, ordenada alfabeticamente por `nome ASC` (CA26).
      * Parâmetros de paginação padronizados: `tamanhoPagina` (padrão 50, aceita 1 a 200; valor < 1 ou > 200 recusa na etapa 6 com HTTP **400** `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina`, CA30) e `pagina` (padrão 1, aceita >= 1; valor < 1 recusa com HTTP **400** `O campo Página deve ser 1 ou maior.`, `target: pagina`, M3).
      * Deslocamento no banco: `limit(tamanhoPagina, (pagina - 1) * tamanhoPagina)`.
      * **Visibilidade por papel (M7):**
        - Usuários comuns sem papel de Administrador ou Gestor recebem apenas templates com `ativo = true` (filtros para inativos são ignorados).
        - `Administrador` e `GestorTratativa` podem filtrar por `ativo = 'true'`, `'false'` ou `'todos'` (CA26a).
    - **Detalhe (`consultarTemplate`):**
      * Recebe `template: UUID` e devolve cabeçalho com a lista de itens ordenada por `ordem ASC` (CA27).
      * Se o template não existir: recusa na etapa 5 com HTTP **404** `Template não encontrado.`, `target: template` (CA19a).
      * Se o identificador for malformado (não UUID): recusa na etapa 4 com HTTP **400** `Código inválido.`, `target: template` (CA19b).
      * Se o template for inativo (`ativo = false`) e consultado por usuário comum: recusa com HTTP **404** `Template não encontrado.`, `target: template` (CA26b).
      * `consultarTemplate` e `listarTemplates` são somente-leitura e não gravam histórico.
   — **Por quê:** garante alinhamento estrito ao padrão de paginação e consultas corporativas da plataforma (003 R24/R25, 005 R18/R19, 007 R8, 008 R6).
   — **Verificado por:** testes em `test/templates-consultas.test.ts` (CA19a, CA19b, CA26, CA26a, CA26b, CA27, CA30, M3).

11. **Contrato consolidado de precedência de recusas e padronização de targets** (R13, R15; D10; Ruling R-03; M4; Q12).
    - Ordem rigorosa das etapas de recusa em conformidade com D10, 004 R29 e 005 R16, onde a checagem de papel estático é realizada na **etapa 2**, antes de formato de identificador no domínio e antes de existência de recursos no banco:
      * **Em `aplicarTemplateTratativa` (R15(a)):**
        1. Autenticação (401).
        2. Autorização / Papel estático: usuário sem `GestorTratativa` ou identidade `AplicativoOrigem` -> HTTP **403** `Acesso negado.` verificado no início do handler antes de forma e existência (CA21a, CA22, CA32).
        3. Forma no runtime: JSON malformado ou campos desconhecidos -> HTTP 400 do framework.
        4. Forma de parâmetros no domínio: parâmetro `template` ausente ou malformado (não UUID) no payload -> HTTP **400** `Código inválido.`, `target: template` (CA19b). Como `aplicarTemplateTratativa` é uma bound action ligada à Tratativa, o código da Tratativa vem exclusivamente na URL; se a chave na URL estiver malformada ou inexistente, devolve 404 `Tratativa não encontrada.` na etapa 5.
        5. Existência no domínio: chave da Tratativa na URL inexistente -> HTTP **404** `Tratativa não encontrada.` (CA18); Template informado no payload inexistente -> HTTP **404** `Template não encontrado.`, `target: template` (CA19). Tratativa inexistente combinada com Template inexistente devolve 404 da Tratativa (CA31).
        6. Estado da Tratativa: `Encerrada` ou `Cancelada` -> HTTP **409** `Tratativa <Status> não pode ser alterada.`, `target: status` (CA20).
        7. Estado do Template: `ativo == false` -> HTTP **409** `Template inativo não pode ser aplicado.`, `target: template` (CA12).
        8. Campos e parâmetros semânticos: `responsavelPadrao` inválido -> 400 (`target: responsavelPadrao`, CA17); `atribuicoes` com matrícula inválida -> 400 (`target: atribuicoes`); ordem inexistente em atribuições -> 400 `Item de template inválido.`, `target: atribuicoes` (CA16b); ordem duplicada em atribuições -> 400 `Ordem de atribuição duplicada.`, `target: atribuicoes` (CA16a).
      * **Nas operações cadastrais (`criarTemplate`, `editarTemplate`, `desativarTemplate`, `ativarTemplate`) (R15(b)):
        1. Autenticação (401).
        2. Autorização / Papel estático: usuário sem `Administrador` ou `AplicativoOrigem` -> HTTP **403** `Acesso negado.` verificado na etapa 2 antes de forma e existência (CA21, CA22).
        3. Forma no runtime (400).
        4. Forma de identificador no domínio: parâmetro `id` malformado em edição/ativação/desativação -> HTTP **400** `Código inválido.`, `target: id` (M4).
        5. Existência no domínio: Template inexistente -> HTTP **404** `Template não encontrado.`, `target: id` (M4).
        6. Conflito de unicidade: Nome já existente em outro template -> HTTP **409** `Já existe um template com este nome.`, `target: nome` (CA5).
        7. Validação de campos e itens: Nome vazio -> 400 (`target: nome`, CA6); Nome > 100 -> 400 (`target: nome`, CA6a); Descrição > 500 -> 400 (`target: descricao`, CA6b); itens vazios -> 400 (`target: itens`, CA7); itens > 30 -> 400 (`target: itens`, CA8); ordem inválida/duplicada/subitem de subitem -> 400 (`target: itens`, CA3, CA4, CA8a); descrição de item inválida -> 400 (`target: itens`, CA8b); prioridade inválida -> 400 (`target: itens`, CA8c); prazo relativo fora de 1..365 -> 400 (`target: prazoRelativoDias`, CA9).
      * **Nas consultas (`listarTemplates`, `consultarTemplate`) (R15(c)):
        1. Autenticação (401).
        2. Papel estático: `AplicativoOrigem` -> HTTP **403** `Acesso negado.`.
        3. Forma no runtime (400).
        4. Forma de identificador no domínio: `template` malformado -> HTTP **400** `Código inválido.`, `target: template` (CA19b).
        5. Existência e visibilidade: Template inexistente (ou inativo para usuário comum) -> HTTP **404** `Template não encontrado.`, `target: template` (CA19a, CA26b).
        6. Paginação: `tamanhoPagina` fora de 1..200 -> 400 (`target: tamanhoPagina`, CA30); `pagina` < 1 -> 400 (`target: pagina`, M3).
   - **Padronização de `target` (M4 do parecer 2):**
     * Em operações administrativas, o identificador do template é nomeado `id` (`target: id`).
     * Em operações de usuário (`consultarTemplate`, `aplicarTemplateTratativa`), o parâmetro do template é nomeado `template` (`target: template`) e a Tratativa é identificada pela URL (`Tratativa não encontrada.` sem target).
   — **Por quê:** estabelece previsibilidade contratual rigorosa e previne vazamento de dados de existência de recursos em chamadas não autorizadas.
   — **Verificado por:** testes de precedência cobrindo todas as etapas e targets (CA12, CA16a, CA16b, CA17, CA18, CA19, CA19a, CA19b, CA20, CA21, CA21a, CA22, CA23, CA30, CA31, CA32, M3, M4).

---

## Contrato executável

### 1. Modelo CDS (`db/tratativa.cds`)

```cds
namespace br.com.calazanstec;

/** R1, R2 (spec templates-de-acoes): Cabeçalho do template de ações. */
entity Templates {
  key id        : UUID;
      nome      : String(100) not null;
      descricao : String(500);
      ativo     : Boolean not null default true;
      itens     : Composition of many ItensTemplate on itens.template = $self;
}

/** R1, R2 (spec templates-de-acoes): Itens ordenados do template de ações. */
entity ItensTemplate {
  key id                   : UUID;
      template             : Association to one Templates not null;
      ordem                : Integer not null;
      descricao            : String(500) not null;
      prioridade           : PrioridadeAcao not null default 'Média';
      evidenciaObrigatoria : Boolean not null default false;
      prazoRelativoDias    : Integer not null;
      ordemPai             : Integer;
}

// Extensão aditiva em HistoricoAcoes:
//   template     : Association to one Templates;
//   templateNome : String(100);
```

### 2. Serviço de Administração (`srv/administracao-service.cds`)

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

// Declarado diretamente no serviço existente AdministracaoService em srv/administracao-service.cds:
// (Preservando as anotações existentes @path: '/api/administracao/v1' e @requires: 'Administrador')

type ItemTemplateInput {
  ordem                : Integer;
  descricao            : String(500);
  prioridade           : String(10);
  evidenciaObrigatoria : Boolean;
  prazoRelativoDias    : Integer;
  ordemPai             : Integer;
}

type ResultadoCriacaoTemplate {
  id : UUID;
}

type ResultadoAtivacaoTemplate {
  id    : UUID;
  ativo : Boolean;
}

type ItemListagemTemplate {
  id              : UUID;
  nome            : String(100);
  descricao       : String(500);
  ativo           : Boolean;
  quantidadeItens : Integer;
}

type DetalheItemTemplate {
  id                   : UUID;
  ordem                : Integer;
  descricao            : String(500);
  prioridade           : m.PrioridadeAcao;
  evidenciaObrigatoria : Boolean;
  prazoRelativoDias    : Integer;
  ordemPai             : Integer;
}

type DetalheTemplate {
  id        : UUID;
  nome      : String(100);
  descricao : String(500);
  ativo     : Boolean;
  itens     : many DetalheItemTemplate;
}

action criarTemplate(
  nome      : String,
  descricao : String,
  itens     : many ItemTemplateInput
) returns ResultadoCriacaoTemplate;

action editarTemplate(
  id        : UUID,
  nome      : String,
  descricao : String,
  itens     : many ItemTemplateInput
);

action ativarTemplate(
  id : UUID
) returns ResultadoAtivacaoTemplate;

action desativarTemplate(
  id : UUID
) returns ResultadoAtivacaoTemplate;

function listarTemplates(
  ativo         : String,
  tamanhoPagina : Integer,
  pagina        : Integer
) returns many ItemListagemTemplate;

function consultarTemplate(
  template : UUID
) returns DetalheTemplate;
```

### 3. Serviço de Tratativa (`srv/tratativa-service.cds`)

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

// Declarado diretamente no service TratativaService em srv/tratativa-service.cds:

type ItemListagemTemplate {
  id              : UUID;
  nome            : String(100);
  descricao       : String(500);
  ativo           : Boolean;
  quantidadeItens : Integer;
}

type DetalheItemTemplate {
  id                   : UUID;
  ordem                : Integer;
  descricao            : String(500);
  prioridade           : m.PrioridadeAcao;
  evidenciaObrigatoria : Boolean;
  prazoRelativoDias    : Integer;
  ordemPai             : Integer;
}

type DetalheTemplate {
  id        : UUID;
  nome      : String(100);
  descricao : String(500);
  ativo     : Boolean;
  itens     : many DetalheItemTemplate;
}

type AtribuicaoItemTemplate {
  ordem       : Integer;
  responsavel : String(50);
}

type ResultadoAplicacaoTemplate {
  totalAcoesCriadas : Integer;
}

function listarTemplates(
  ativo         : String,
  tamanhoPagina : Integer,
  pagina        : Integer
) returns many ItemListagemTemplate;

function consultarTemplate(
  template : UUID
) returns DetalheTemplate;

// Na entidade Tratativas existente:
// O grant 'aplicarTemplateTratativa' é SOMADO diretamente ao elemento existente
// { grant: [...], to: 'GestorTratativa' } no @restrict da entidade Tratativas (Ruling R-02 da 009).
// A action é declarada diretamente dentro do bloco actions { ... } de entity Tratativas:
//
// action aplicarTemplateTratativa(
//   template          : UUID,
//   responsavelPadrao : String,
//   atribuicoes       : many AtribuicaoItemTemplate
// ) returns ResultadoAplicacaoTemplate;
```

### 4. Tabela Consolidada de Precedência e Erros HTTP

| Operação | Verificação | Quem / Etapa | HTTP | Mensagem de erro | Target |
|---|---|---|---|---|---|
| Todas | Autenticação | Runtime (1) | 401 | (Padrão CAP / Express) | - |
| Todas | Papel estático (`Administrador` em gestão; `GestorTratativa` em aplicação; recusa de `AplicativoOrigem`) | Domínio / Handler (2) | 403 | `Acesso negado.` | - |
| Todas | Forma no runtime (JSON malformado / tipo incompatível na raiz) | Runtime (3) | 400 | (Padrão CAP) | - |
| `aplicarTemplateTratativa` | Parâmetro `template` ausente ou malformado (não UUID) no payload | Domínio (4) | 400 | `Código inválido.` | `template` |
| `editarTemplate`, `ativarTemplate`, `desativarTemplate` | `id` ausente ou malformado (não UUID) | Domínio (4) | 400 | `Código inválido.` | `id` |
| `consultarTemplate` | `template` ausente ou malformado (não UUID) | Domínio (4) | 400 | `Código inválido.` | `template` |
| `aplicarTemplateTratativa` | Chave da Tratativa na URL inexistente ou malformada | Runtime / Domínio (5) | 404 | `Tratativa não encontrada.` | - |
| `aplicarTemplateTratativa` | Template inexistente no banco de dados | Domínio (5) | 404 | `Template não encontrado.` | `template` |
| `editarTemplate`, `ativarTemplate`, `desativarTemplate` | Template inexistente | Domínio (5) | 404 | `Template não encontrado.` | `id` |
| `consultarTemplate` | Template inexistente (ou inativo para usuário comum) | Domínio (5) | 404 | `Template não encontrado.` | `template` |
| `aplicarTemplateTratativa` | Tratativa Encerrada ou Cancelada | Domínio (6) | 409 | `Tratativa <Status> não pode ser alterada.` | `status` |
| `criarTemplate`, `editarTemplate` | Conflito de unicidade: Nome já existente em outro template | Domínio (6) | 409 | `Já existe um template com este nome.` | `nome` |
| `listarTemplates` | `tamanhoPagina` < 1 ou > 200 | Domínio (6) | 400 | `O campo Tamanho da página aceita de 1 a 200.` | `tamanhoPagina` |
| `listarTemplates` | `pagina` < 1 | Domínio (6) | 400 | `O campo Página deve ser 1 ou maior.` | `pagina` |
| `aplicarTemplateTratativa` | Template inativo (`ativo == false`) | Domínio (7) | 409 | `Template inativo não pode ser aplicado.` | `template` |
| `criarTemplate`, `editarTemplate` | Nome vazio ou só espaços | Domínio (7) | 400 | `O campo Nome do template é obrigatório.` | `nome` |
| `criarTemplate`, `editarTemplate` | Nome > 100 caracteres | Domínio (7) | 400 | `O campo Nome do template aceita no máximo 100 caracteres.` | `nome` |
| `criarTemplate`, `editarTemplate` | Descrição > 500 caracteres | Domínio (7) | 400 | `O campo Descrição do template aceita no máximo 500 caracteres.` | `descricao` |
| `criarTemplate`, `editarTemplate` | Lista de itens vazia (`[]`) | Domínio (7) | 400 | `O template deve conter pelo menos um item.` | `itens` |
| `criarTemplate`, `editarTemplate` | Lista com mais de 30 itens | Domínio (7) | 400 | `O template aceita no máximo 30 itens.` | `itens` |
| `criarTemplate`, `editarTemplate` | Subitem de subitem (ordemPai aponta para item com ordemPai) | Domínio (7) | 400 | `Uma Subação não pode ter Subações.` | `itens` |
| `criarTemplate`, `editarTemplate` | Ordem duplicada, fora de 1..30, ordemPai inexistente ou auto-referência | Domínio (7) | 400 | `Ordem dos itens inválida.` | `itens` |
| `criarTemplate`, `editarTemplate` | Descrição de item vazia ou > 500 caracteres | Domínio (7) | 400 | `O campo Descrição da ação aceita no máximo 500 caracteres.` | `itens` |
| `criarTemplate`, `editarTemplate` | Prioridade de item diferente de Baixa, Média, Alta | Domínio (7) | 400 | `Prioridade inválida.` | `itens` |
| `criarTemplate`, `editarTemplate` | Prazo relativo de item fora de 1..365 | Domínio (7) | 400 | `O prazo relativo deve ser de 1 a 365 dias.` | `prazoRelativoDias` |
| `aplicarTemplateTratativa` | `responsavelPadrao` com formato inválido (espaços no meio ou e-mail) | Domínio (8) | 400 | `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` | `responsavelPadrao` |
| `aplicarTemplateTratativa` | Matrícula inválida em item de `atribuicoes` | Domínio (8) | 400 | `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` | `atribuicoes` |
| `aplicarTemplateTratativa` | `atribuicoes` com número de ordem inexistente no template | Domínio (8) | 400 | `Item de template inválido.` | `atribuicoes` |
| `aplicarTemplateTratativa` | `atribuicoes` com números de ordem duplicados | Domínio (8) | 400 | `Ordem de atribuição duplicada.` | `atribuicoes` |
| `mudarStatusAcao` (Concluída) | Ação gerada com `evidenciaObrigatoria = true` sem evidências ativas | Domínio (10) | 409 | `Ação com Evidência obrigatória não pode ser concluída sem Evidência.` | - |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-templates-de-acoes.md` | Entregar o intent 009 completo em 3 etapas sequenciais RED/GREEN: gestão cadastral administrativa (R1-R4), consultas padronizadas (R12) e aplicação atômica em Tratativa com serialização D9, cálculo de prazos e auditoria (R5-R11, R13-R16). | `templates-de-acoes/001-templates-de-acoes` |

---

## Itens N3 (aprovação no Gate 1)

| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | Criação das entidades `Templates` e `ItensTemplate` em `db/tratativa.cds`, e extensão aditiva de `HistoricoAcoes` com `template` e `templateNome`. | Alteração no modelo persistido (`db/*.cds`). | Delegado ao Orquestrador (D11); aprovado no Gate 1 |
| N3-2 | Concessão de autorização e roles CDS: `@requires: 'Administrador'` e actions em `AdministracaoService`; `@restrict` somado para `GestorTratativa` em `aplicarTemplateTratativa` em `TratativaService`. | Segurança e autorização (`@restrict`, papéis corporativos). | Delegado ao Orquestrador (D11); aprovado no Gate 1 |
| N3-3 | Ocultação LGPD de matrículas para não-gestores nas Ações geradas e exclusão mandatória de Descrições do registro de auditoria `Criacao`. | Dados pessoais (LGPD). | Delegado ao Orquestrador (D11); aprovado no Gate 1 |
| N3-4 | Precedência consolidada de recusas com verificação de papel estático na etapa 2 com HTTP 403 antes de forma e existência (D10, 004 R29, 005 R16). | Contrato de erros e convenção corporativa D10. | Delegado ao Orquestrador (D11); aprovado no Gate 1 |

---

## Como isso se prova

- **CA1 (R1, R3):** Administrador cria Template com 4 itens válidos via `criarTemplate` -> persistido com UUID, `ativo = true`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA2 (R1, R2):** criação de template com mãe e duas subações aceita com hierarquia de 2 níveis. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA3 (R2):** subitem de subitem recusado com 400 `Uma Subação não pode ter Subações.`, `target: itens`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA4 (R2):** item com ordemPai inexistente ou auto-referência recusado com 400 `Ordem dos itens inválida.`, `target: itens`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA5 (R3):** nome já existente recusado com 409 `Já existe um template com este nome.`, `target: nome`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA6 (R3):** nome vazio ou só espaços recusado com 400 `O campo Nome do template é obrigatório.`, `target: nome`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA6a (R1, R15):** nome > 100 caracteres recusado com 400 `O campo Nome do template aceita no máximo 100 caracteres.`, `target: nome`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA6b (R1, R15):** descrição > 500 caracteres recusado com 400 `O campo Descrição do template aceita no máximo 500 caracteres.`, `target: descricao`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA7 (R1):** lista de itens vazia recusada com 400 `O template deve conter pelo menos um item.`, `target: itens`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA8 (R1):** mais de 30 itens recusado com 400 `O template aceita no máximo 30 itens.`, `target: itens`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA8a (R1, R15):** ordem duplicada ou fora de 1..30 recusada com 400 `Ordem dos itens inválida.`, `target: itens`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA8b (R1, R15):** descrição de item vazia ou > 500 recusada com 400 `O campo Descrição da ação aceita no máximo 500 caracteres.`, `target: itens`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA8c (R1, R15):** prioridade fora de Baixa/Média/Alta recusada com 400 `Prioridade inválida.`, `target: itens`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA9 (R1):** prazo relativo 0 ou > 365 dias recusado com 400 `O prazo relativo deve ser de 1 a 365 dias.`, `target: prazoRelativoDias`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA10 (R3, R8):** edição de template atualiza para futuras aplicações sem alterar ações já criadas. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA11 (R4):** desativação define `ativo = false`; idempotência devolve 200 sem alterar dados. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA11a (R4):** ativação define `ativo = true`; idempotência devolve 200. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA12 (R4):** aplicação de template inativo recusada com 409 `Template inativo não pode ser aplicado.`, `target: template`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA13 (R5, R7):** aplicação de "Condição Insegura" em Tratativa Aberta no dia 2026-10-08 gera 4 Ações com prazos 2026-10-10, 2026-10-13, 2026-10-23 e 2026-10-28 e status Pendente. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA14 (R5, R7):** aplicação de template com mãe e subações gera Ações com `acaoMae` apontando para o UUID gerado da mãe. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA14a (R7):** estrutura consultada (004 R25) preserva a ordem sequencial do template com mãe precedendo subações. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA15 (R5):** aplicação em Tratativa avulsa funciona de forma idêntica a Tratativa com origem. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA16 (R6):** aplicação com `atribuicoes` atribui matrícula personalizada ao item especificado e padrão aos demais. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA16a (R6, R15):** `atribuicoes` com ordem duplicada recusa com 400 `Ordem de atribuição duplicada.`, `target: atribuicoes`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA16b (R6, R15):** `atribuicoes` com ordem inexistente no template recusa com 400 `Item de template inválido.`, `target: atribuicoes`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA17 (R6):** matrícula com espaços no meio ou e-mail recusa com 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`; espaços nas pontas são aparados com trim (005 R3). *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA18 (R5, R15):** Tratativa inexistente (chave na URL) na aplicação recusa na etapa 5 com 404 `Tratativa não encontrada.`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA19 (R5, R15):** Template inexistente no payload na aplicação recusa na etapa 5 com 404 `Template não encontrado.`, `target: template`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA19a (R12, R15):** `consultarTemplate` inexistente recusa com 404 `Template não encontrado.`, `target: template`. *Verificado por: teste em `test/templates-consultas.test.ts` (Etapa 2).*
- **CA19b (R12, R15):** identificador `template` malformado no payload de aplicação ou na consulta `consultarTemplate` recusa com 400 `Código inválido.`, `target: template`. *Verificado por: teste em `test/templates-consultas.test.ts` (Etapa 2) e `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA20 (R9):** Tratativa Encerrada ou Cancelada na aplicação recusa com 409 `Tratativa <Status> não pode ser alterada.`, `target: status`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA21 (R3, R15):** usuário sem papel de Administrador tentando gerenciar templates recusa na etapa 2 com 403 `Acesso negado.`. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA21a (R5, R15):** usuário sem papel de Gestor tentando aplicar template recusa na etapa 2 com 403 `Acesso negado.`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA22 (R13, R15):** Aplicativo de origem tentando gerenciar, aplicar ou consultar templates recusa na etapa 2 com 403 `Acesso negado.`. *Verificado por: testes nas Etapas 1, 2 e 3.*
- **CA23 (R15):** usuário não autenticado recebe 401 na etapa 1. *Verificado por: testes nas Etapas 1, 2 e 3.*
- **CA24 (R11):** 4 eventos `Criacao` gravados na origem `Acao` no histórico com metadado do template e sem texto de Descrição sob LGPD. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA24a (R3, R4, R11):** operações cadastrais não gravam registros de histórico (AGENTS.md:40). *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*
- **CA25 (R8):** Ações geradas por template aceitam edição (004 R19) e início (005 R11) normalmente. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA25a (R8):** Ação com `evidenciaObrigatoria = true` gerada por template bloqueia conclusão sem evidências com 409 `Ação com Evidência obrigatória não pode ser concluída sem Evidência.`. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA26 (R12):** usuário comum listando templates recebe apenas ativos ordenados alfabeticamente por Nome. *Verificado por: teste em `test/templates-consultas.test.ts` (Etapa 2).*
- **CA26a (R12):** Gestor ou Administrador listando com `ativo = false` ou `todos` recebe templates inativos. *Verificado por: teste em `test/templates-consultas.test.ts` (Etapa 2).*
- **CA26b (R12):** usuário comum consultando template inativo recebe 404 `Template não encontrado.`, `target: template`. *Verificado por: teste em `test/templates-consultas.test.ts` (Etapa 2).*
- **CA27 (R12):** detalhe do template devolve cabeçalho e itens em ordem crescente de `ordem`. *Verificado por: teste em `test/templates-consultas.test.ts` (Etapa 2).*
- **CA28 (R10):** falha simulada na gravação dispara rollback completo atômico. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA29 (R6):** consulta de Ações por usuário sem papel de Gestor devolve `responsavel: null` sob LGPD. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA30 (R12):** `listarTemplates` com `tamanhoPagina = 201` recusa com 400 `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina`. *Verificado por: teste em `test/templates-consultas.test.ts` (Etapa 2).*
- **CA31 (R15):** chave da Tratativa na URL inexistente combinada com Template inexistente no payload devolve 404 `Tratativa não encontrada.` na etapa 5. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA32 (R15):** Aplicativo de origem tentando aplicar template com chave de Tratativa malformada na URL recebe 403 na etapa 2 antes da validação de formato e existência. *Verificado por: teste em `test/templates-aplicacao.test.ts` (Etapa 3).*
- **CA33 (R14):** criação do template de referência "Condição Insegura" via API de administração aceita sem carga CSV. *Verificado por: teste em `test/templates-gestao.test.ts` (Etapa 1).*

---

## O que não muda

- Os contratos públicos e tipos de retorno existentes de 002 a 006 permanecem 100% inalterados (`DetalheTratativa`, `ItemListagem`, `DetalheAcao`, `ItemEstruturaAcao`, `DetalheResponsaveis`, `ItemMinhasAcoes`, `DetalheEvidencia`).
- Não há cadastro nem parametrização por Origem e não há Tipo no MVP (002 R1, AGENTS.md:36).
- SuccessFactors permanece estritamente como sistema de somente-leitura.
- Nenhuma Ação gerada mantém acoplamento permanente com o template gerador: após a aplicação, comportam-se como ações comuns do plano de ação (004, 005, 006).
- Os testes automatizados mantêm isolamento com SQLite em memória (`cds.test`), sem dependências externas reais de serviços corporativos (AGENTS.md:38).

---

## O desconfortável, declarado

- **Ausência de versionamento histórico de templates:** no MVP, editar um template substitui sua lista de itens para aplicações futuras sem manter um histórico versionado (V1, V2) na base. Essa simplificação é deliberada e declarada (R3(c), Q6), resguardando que nenhuma ação gerada no passado seja retroativamente modificada.
- **Carimbos de tempo espaçados para ordenação analítica em lote:** para que a árvore de Ações de 004 R25 preserve estritamente a ordem sequencial dos itens do template (`ordem` 1 a N) sem alteração de esquema ou dependência de índices adicionais em tabelas já homologadas, os instantes `criadoEm` das ações geradas no mesmo lote são calculados com incrementos crescentes de 1 segundo a partir do instante base (`agora() + ordem * 1000 ms`).
- **Templates cadastrados via API sem pré-carga CSV:** em ambientes novos ou bancos limpos, os templates precisam ser cadastrados via chamada OData administrativa (`criarTemplate`). Não haverá arquivos CSV em `db/data/`, eliminando categoricamente o risco de o mecanismo `.hdbtabledata` do HANA Cloud sobrescrever ou restaurar templates alterados ou desativados em deploys subsequentes.

**Registro do Gate 1 (2026-10-10):** decisões e itens N3 aprovados pelo orquestrador, por delegação do humano (D11). Rulings em `agentic/.estado/execucao/2026-10-08-templates-de-acoes/progress.md`. Branch empilhada sobre `historico-e-auditoria/001-historico-e-auditoria`.
