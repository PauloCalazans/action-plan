# Design: responsaveis-e-participantes

**Spec:** agentic/projeto/specs/responsaveis-e-participantes/spec.md  
**Status:** aprovado

Escopo técnico: gestão de responsáveis e participantes em Tratativas e Ações no `TratativaService` (`/api/tratativa/v1`), compreendendo: (1) Responsável Principal e Participantes da Tratativa (atribuição, reatribuição e manutenção de participantes com limite e unicidade, consultados exclusivamente pelo Gestor via function dedicada `consultarResponsaveis`); (2) Delegação de Ações e Subações como único mecanismo de troca de Responsável com justificativa obrigatória (definido na criação no 004 e trocado exclusivamente por `delegarAcao` no 005); (3) autorização dinâmica e execução de Ações pelo Responsável da Ação (iniciar e concluir sua própria Ação com precedência em 9 etapas); (4) módulo neutro de identidade ("usuário autenticado ↔ matrícula"); (5) consultas estruturadas "Minhas Ações" e "Minhas Tratativas" com paginação, ordenação e consulta administrativa por colaborador para o Gestor; (6) visibilidade e proteção LGPD (consulta `consultarResponsaveis` restrita ao Gestor; `consultarTratativa` mantido com 12 chaves inalterado; omissão de matrículas para não-gestores e bloqueio contra vazamentos relacionais); (7) auditoria imutável de responsabilidade em `HistoricoTratativa` e `HistoricoAcoes`. Base empilhada sobre o intent 004 (`plano-de-acao`). Sem UI Fiori (intent 013), sem integração SAP SuccessFactors (011), sem notificações por e-mail/Teams (010), sem workflow burocrático de aprovação.

---

## Decisões

1. **Modelo persistido: mudança puramente aditiva em `db/tratativa.cds`** (R1, R2, R3, R5, R6, R14, R17, R25, R26, R27; N3-1).
   - `Tratativas` recebe:
     * `@PersonalData.IsPotentiallyPersonal responsavelPrincipal : String(50);` (opcional, nasce `null`; gravação da grafia informada após `trim()`).
     * `participantes : Composition of many ParticipantesTratativa on participantes.tratativa = $self;` (composição hierárquica aditiva).
   - Nova entidade `ParticipantesTratativa`:
     * Chave primária técnica `key ID : UUID;`
     * Associação obrigatória `tratativa : Association to one Tratativas not null;`
     * `@PersonalData.IsPotentiallyPersonal matricula : String(50) not null;`
     * `sequencia : Integer not null;` (número sequencial incremental por Tratativa garantindo ordenação estável por `criadoEm ASC, sequencia ASC` mesmo com instante fixo nos testes, R6/CA16; M4).
      * `criadoEm : Timestamp not null;` (para manter a ordenação estável por ordem de inserção, R6/CA16).
   - Atualização do enum `EventoHistorico` (Tratativa):
     * Adicionados: `Atribuicao`, `Reatribuicao`, `InclusaoParticipante`, `RemocaoParticipante`.
   - Atualização do enum `EventoHistoricoAcao` (Ação):
     * Adicionado: `Delegacao`.
   - Novo enum de apoio para consultas:
     * `type PapelUsuarioTratativa : String(30) enum { ResponsavelPrincipal = 'Responsável Principal'; Participante = 'Participante'; }`.
   — **Por quê:** modela a lista de até 20 participantes como entidade dependente relacional com integridade referencial por composição CDS. Campos de matrícula recebem anotação de dados pessoais (`@PersonalData.IsPotentiallyPersonal`). Nenhuma coluna existente no HANA Cloud é alterada ou removida, eliminando risco de migração destrutiva HDI.
   — **Verificado por:** `cds compile db srv --to sql` (só comandos `CREATE TABLE` de `ParticipantesTratativa` e comando aditivo `CREATE TABLE com a coluna nova` `responsavelPrincipal` em `Tratativas`); `npm run build`.

2. **Superfície do `TratativaService`: actions ligadas a `Tratativas` e functions estruturadas** (R1, R7, R8, R9, R18, R19, R20, R25, R26, R29; D4, D6, D9; N3-4).
   - **Ação `editarAcao` (R29):** a action `editarAcao` já foi definida sem o parâmetro `responsavel` no intent 004 (Ruling R-07); o intent 005 mantém a assinatura inalterada. Tentativas de enviar `responsavel` continuam recusadas pelo runtime CAP com HTTP 400 `Property "responsavel" does not exist in editarAcao` (CA29, CA93).
   - **Novas actions ligadas ao entity set-âncora `Tratativas`** (URL: `POST /api/tratativa/v1/Tratativas(<codigoTratativa>)/<action>`):
     * `action atribuirResponsavelPrincipal(responsavelPrincipal : String, justificativa : String);` (R7, R14)
     * `action incluirParticipante(participante : String);` (R9, R14)
     * `action removerParticipante(participante : String);` (R9, R14)
     * `action delegarAcao(acao : UUID, novoResponsavel : String, justificativa : String);` (R8, R14)
   - **Novas functions de consulta** (URL: `GET /api/tratativa/v1/<function>(...)`):
     * `function minhasAcoes(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasAcoes;` (R18, R20)
     * `function minhasTratativas(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasTratativas;` (R19, R20)
   - **Nova function de consulta de responsáveis (R17, R26; Ruling R-02):**
     * `function consultarResponsaveis(tratativa : UUID) returns DetalheResponsaveis;`
     * Tipo estruturado associado:
       ```cds
       type DetalheResponsaveis {
         responsavelPrincipal : String(50);
         participantes        : many String;
       }
       ```
     * Anotação de segurança declarativa: `@restrict: [{ grant: ['consultarResponsaveis'], to: 'GestorTratativa' }]`.
     * Para não-gestores (inclusive o próprio Responsável Principal ou Participantes), a chamada é rejeitada estaticamente pelo runtime CAP com HTTP 403 Forbidden.
      * **Precedência de validação:**
        1. Autenticação (401 runtime).
        2. Papel estático: apenas `GestorTratativa` (403 Forbidden estático do runtime CAP para não-gestores, inclusive Responsável Principal ou Participantes, mesmo com parâmetro `tratativa` omitido ou malformado; Ruling R-02).
        3. Código malformado ou ausente: parâmetro `tratativa` ausente ou com `codigoValido(tratativa) === false` recusa com 400 `Código inválido.`, `target: tratativa`.
        4. Existência: Tratativa inexistente no banco recusa com 404 `Tratativa não encontrada.`.
        5. Sucesso (200): retorna `DetalheResponsaveis` com os dados ou `responsavelPrincipal: null` e `participantes: []` (lista vazia quando sem registros).
     * Quando não houver registros: retorna `responsavelPrincipal: null` e `participantes: []` (lista vazia).
     * `DetalheTratativa` e `consultarTratativa` permanecem 100% INTACTOS (preservando estritamente os testes RED do intent 003, com exatamente as 12 chaves originais e nenhuma coleção).
   — **Por quê:** actions ligadas garantem a obtenção da chave raiz da Tratativa na URL para execução imediata do bloqueio pessimista D9 (`bloquearTratativa`). Functions explícitas impedem a exposição de entity sets diretos, prevenindo vazamento de dados pessoais de colaboradores por consultas OData genéricas ou `$expand`.
   — **Verificado por:** testes de contrato OData V4 e asserções de `$metadata`.

3. **Ponto único de identidade: isolamento "usuário autenticado ↔ matrícula" (R4)** (R4, R11, R18, R19, R20; N3-2; Decisão B delegada).
   - Criação do módulo `srv/tratativa/identidade.ts`:
     * `obterMatriculaUsuario(req: cds.Request): string`: extrai a matrícula do usuário autenticado (`req.user.id`). Toda obtenção da identidade do usuário no sistema (nas consultas "minhas", no autor do histórico e na comparação com o Responsável da Ação) deve invocar estritamente esta função.
     * `normalizarMatricula(matricula?: string | null): string`: aplica `trim().toLowerCase()`, retornando string vazia para nulos.
     * `matriculasIguais(m1?: string | null, m2?: string | null): boolean`: compara duas matrículas de forma case-insensitive e trim-insensitive (`normalizarMatricula(m1) === normalizarMatricula(m2)`).
     * `usuarioAutenticadoEhMatricula(req: cds.Request, matricula: string): boolean`: compara a matrícula de `obterMatriculaUsuario(req)` com a matrícula gravada através de `matriculasIguais`.
   - **Premissa de identidade:** não há tela de login nem autenticação proprietária no backend; a identidade provém do Launchpad/XSUAA. Hoje o ID do token (`req.user.id`) representa a matrícula.
   - **Isolamento de integração futura:** os intents 011 (SuccessFactors) e 014 (identidade corporativa BTP) alterarão exclusivamente as funções deste módulo, sem impacto em nenhuma regra de negócio do domínio.
   - **Identidade técnica:** identidades com papel `AplicativoOrigem` (mockadas nos testes como `app-origem-a`) nunca são convertidas em colaborador e nunca assumem papel de responsabilidade (R4, CA12).
   — **Por quê:** cumpre a exigência mandatória da spec R4 e do brief, garantindo que a ligação entre usuário e matrícula resida em um único ponto testável (Decisão B, aguardando ratificação no Gate 1).
   — **Verificado por:** testes automatizados com variações de caixa ("M1001" vs "m1001") e espaços nas pontas (CA10, CA11, CA12, CA100).

4. **Formato e validação semântica de Matrícula (R3, R27)** (R3, R7, R8, R9, R20, R27; CA6, CA7, CA8, CA9, CA90, CA99).
   - Função pura `validarMatricula(valor: any, nomeCampo: string): string` em `srv/tratativa/validacao-matricula.ts`:
     * O valor deve ser do tipo string.
     * Espaços nas pontas são aparados via `trim()`.
     * Comprimento deve possuir entre 1 e 50 caracteres (`length >= 1 && length <= 50`).
     * Não pode conter espaços no meio (rejeita múltiplos nomes como "Ana Lima", "Maria Silva").
     * Não pode conter o caractere `@` (rejeita e-mails corporativos como "maria@empresa.com").
     * Em caso de violação: emite HTTP 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` com `target` associado ao parâmetro informado (`responsavelPrincipal`, `participante`, `novoResponsavel` ou `matricula`).
     * Retorna a string com a grafia original aparada (a primeira gravação define a grafia no banco).
   - **Na criação de Ações e Subações (R27):** mantém as mensagens semânticas do 004 para `responsavel` ausente/vazio (`O campo Responsável é obrigatório.`) e comprimento > 50 (`O campo Responsável aceita no máximo 50 caracteres.`). A mensagem `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` aplica-se exclusivamente quando houver espaços no meio ou caractere `@` (R27, CA90; I2, M8).
   - **Sem validação externa:** qualquer matrícula no formato é aceita (inclusive terceiros e colaboradores desligados, R21, CA82, CA83).
   — **Por quê:** impede o armazenamento indevido de nomes completos e e-mails de pessoas físicas nos campos de chave de colaborador, alinhando a arquitetura às diretrizes de privacidade e LGPD da plataforma.
   — **Verificado por:** testes das etapas 1, 2 e 4 (CA6–CA9, CA90, CA99).

5. **Autorização dinâmica e precedência para transições de Ação (R11, R12, R16, R28)** (R11, R12, R16, R28; CA37–CA45, CA91, CA95, CA104, CA106–CA110, CA113–CA115; N3-2; Decisão A delegada).
   - **Mudança no `@restrict` do CDS em `srv/tratativa-service.cds`:**
     * `mudarStatusAcao` não possui `@restrict` estático para `GestorTratativa`, pois o Responsável da Ação deve ter permissão de iniciar e concluir sua própria Ação (R11).
     * O entity set `Tratativas` concede `mudarStatusAcao` para `authenticated-user`.
     * A identidade técnica `AplicativoOrigem` é interceptada após a validação de forma do pedido e antes de qualquer verificação de existência no banco (Ruling R-03; CA107).
   - **Precedência detalhada de etapas em `mudarStatusAcao` (exceção de R16/R28; Ruling R-03, Ruling R-04, I1):**
     1. **Autenticação (401):** usuário anônimo (runtime).
     2. **Forma do pedido pelo runtime CAP (400 runtime):**
        - Campos desconhecidos fora da assinatura (runtime).
        - Tipo JSON incompatível (runtime `ASSERT_DATA_TYPE`).
        - "Forma inválida" refere-se estritamente a campos desconhecidos ou incompatibilidade de tipo no runtime (I1, Ruling R-04).
     3. **Aplicativo de origem (403):** identidade técnica `AplicativoOrigem` recebe 403 `Aplicativo de origem não usa este serviço.` do handler `before('*')` existente após a validação de forma de runtime e antes de verificar existência no banco (não revela se a Ação existe ou não, mantendo o comportamento de 004 CA61; se o parâmetro `acao` contiver código malformado como `acao: 'xyz'` ou `null`, o app recebe 403 do `before('*')` antes do domínio; CA107; Ruling R-03, Ruling R-04, I1).
      4. **Formato de códigos pelo domínio (400):** parâmetro `acao` com código malformado (`codigoValido(acao) === false` → 400 `Código inválido.`, `target: acao`; avaliado no início do handler no domínio, após o filtro de app e antes da existência no banco; CA113).
     5. **Existência completa (404):**
        - Chave da Tratativa na URL malformada ou inexistente → 404 `Tratativa não encontrada.`.
        - Ação inexistente → 404 `Ação não encontrada.`.
        - Ação informada não pertence à Tratativa informada → 404 `Ação não encontrada.` (CA104, CA106).
     6. **Autorização dinâmica (403):**
        - O usuário possui o papel `GestorTratativa`? Se sim, a autorização é CONCEDIDA.
        - Se NÃO for `GestorTratativa`:
          * O usuário autenticado é o Responsável da Ação (avaliado via `usuarioAutenticadoEhMatricula(req, acao.responsavel)`)? Se não for, emite 403 Forbidden imediato (CA11, CA42, CA95).
          * Se for o Responsável da Ação: a permissão é avaliada estritamente pelo par (Status de destino, Status atual da Ação lido na etapa 5):
            - Destino `Concluída`: permitido (para Ação `Pendente`, `Em andamento`, `Concluída` ou `Cancelada`; para `Concluída` e `Cancelada`, a permissão é concedida nesta etapa e o fluxo segue para a recusa de estado 409 da etapa 8; CA44, CA115).
            - Destino `Em andamento`: permitido SE a Ação estiver `Pendente` ou `Em andamento` (se já estiver `Em andamento`, segue para 409 da etapa 8; se estiver `Concluída` ou `Cancelada`, pedir `Em andamento` constitui reabertura não autorizada e é recusado com 403 Forbidden; CA40, CA108, CA109).
            - Qualquer outro destino (`Cancelada`, `Pendente`, ausente ou fora da lista): recusado com 403 Forbidden na autorização dinâmica, ANTES de qualquer verificação de estado da Tratativa (CA40, CA110).
        - A autorização dinâmica precede o estado da Tratativa.
     7. **Estado da Tratativa (409):** Tratativa `Encerrada` ou `Cancelada` → 409 `Tratativa <Status> não pode ser alterada.` (CA43, R10).
     8. **Estado da Ação e Transição (409/400):**
        - Para o Gestor: se o status de destino estiver ausente ou só com espaços, emite 400 `O campo Status é obrigatório.`, `target: status` (M5; posicionado após o estado da Tratativa e antes da avaliação do par de transição).
        - Par de transição para o mesmo status ou proibido na tabela de ciclo de vida → 409 `Transição não permitida: de <Status atual> para <Status pedido>.` (`target: status`; CA44, CA109, CA115).
     9. **Relação mãe e filhas (409):** conclusão de mãe com Subações abertas → 409 `A Ação possui Subações não concluídas nem canceladas.` (CA41).
     10. **Campos validados pelo domínio (400):** justificativa opcional para iniciar/concluir; se fornecida com mais de 500 caracteres após `trim()`, recusa com 400 `O campo Justificativa aceita no máximo 500 caracteres.`, `target: justificativa`.
   - **Operações estáticas de Ação (R16 geral):** criar Ação, criar Subação, editar Ação e delegar Ação mantêm a checagem estática de papel `GestorTratativa` no `@restrict` do CDS (etapa 2), antes da existência (CA59, CA114).
   — **Por quê:** implementa com exatidão a decisão Q14 e os CAs acordados na spec, assegurando que o executor possa avançar seu trabalho diário sem permitir reabertura, cancelamento ou desvios de governança (Decisão A, aguardando ratificação no Gate 1).
   — **Verificado por:** testes da etapa 3 cobrindo exaustivamente a matriz de transições e papéis (CAs 37–45, 91, 95, 104, 106–110, 113–115).

6. **Regras de estado de Participantes e Responsável Principal como 409 (R5, R6, R10, R22, R24; D10)** (R5, R6, R7, R9, R10, R22, R24; CA13, CA14, CA17, CA18, CA19, CA23, CA96, CA97, CA98, CA101).
   - Precedência em `atribuirResponsavelPrincipal`, `incluirParticipante` e `removerParticipante`:
     1. Autenticação (401).
     2. Papel estático: apenas `GestorTratativa` (403 via `@restrict`).
     3. Forma do pedido (400) e tipo JSON incorreto.
     4. Existência da Tratativa: chave malformada na URL ou não encontrada → 404 `Tratativa não encontrada.`.
     5. Estado da Tratativa (409):
        - Tratativa `Encerrada` ou `Cancelada` (R10) → 409 `Tratativa <Status> não pode ser alterada.`.
        - **Recusas de estado específicas (enquadradas como 409 pela D10):**
          * R5 (mesma pessoa): atribuir como Responsável Principal quem já é Participante na mesma Tratativa, ou incluir como Participante o Responsável Principal atual → 409 `Responsável Principal e Participante não podem ser a mesma pessoa.` com `target` associado ao parâmetro informado (`responsavelPrincipal` ou `participante`; CA13, CA14, CA96). A restrição é avaliada via `matriculasIguais`.
          * R6 (limite de 20): ao tentar incluir participante quando a lista de participantes já contém 20 matrículas distintas → 409 `Limite de 20 Participantes atingido.`, `target: participante` (CA19).
     6. **Idempotência (sem erro e sem gravação de histórico):**
        - Atribuir a mesma matrícula já gravada como Responsável Principal: 204 sem efeito e sem histórico (CA23, CA98).
        - Incluir participante já presente na lista: verificado ANTES do limite de 20 (R6, CA97; I5); resulta em 204 sem efeito e sem histórico.
        - Remover matrícula que não consta como participante: 204 sem efeito e sem histórico (CA18).
     7. **Campos validados pelo domínio (400):**
        - Matrícula inválida por R3 → 400 `target: responsavelPrincipal` ou `target: participante`.
        - Justificativa em `atribuirResponsavelPrincipal` (R7): se for primeira atribuição (quando `responsavelPrincipal === null`), justificativa é opcional; se for Reatribuição (troca de matrícula), justificativa é obrigatória (vazia/só espaços → 400 `O campo Justificativa é obrigatório para reatribuir.`; > 500 chars → 400 `O campo Justificativa aceita no máximo 500 caracteres.`, ambos `target: justificativa`), reaproveitando `validarJustificativa(valor, 'reatribuir')` de `srv/tratativa/justificativa.ts` (I4).
   — **Por quê:** respeita a D10 corporativa ("pedido semanticamente válido que o estado atual da entidade impede de executar é 409"), assegurando operações seguras contra duplicação acidental de chamadas.
   — **Verificado por:** testes da etapa 1 (CA13, CA14, CA17, CA18, CA19, CA23, CA96, CA97, CA98, CA101).

7. **Delegação de Ações e substituição da edição de Responsável (R8, R10, R22, R24, R29, R30)** (R8, R10, R22, R24, R29, R30; CA26–CA31, CA35, CA53, CA57, CA61, CA92, CA93, CA94, CA105).
   - **Nova action `delegarAcao(acao, novoResponsavel, justificativa)`:**
     * Exclusiva do `GestorTratativa` (`@restrict` estático no CDS; Responsável da Ação não pode delegar a própria Ação, CA30).
     * Precedência:
       1. 401 Autenticação.
       2. 403 Papel estático (`GestorTratativa`).
       3. 400 Forma do pedido e parâmetro de código `acao` malformado (`codigoValido(acao) === false` → 400 `Código inválido.`, `target: acao`). A validação de formato de parâmetro antecede o bloqueio pessimista D9 (M4).
       4. Bloqueio pessimista D9 e 404 Existência completa (Tratativa inexistente/malformada URL → 404; Ação inexistente ou de outra Tratativa → 404).
       5. 409 Estado da Tratativa (R10): Tratativa `Encerrada` ou `Cancelada` → 409 `Tratativa <Status> não pode ser alterada.` (CA34, CA61, CA105).
       6. 409 Estado da Ação (R10): Ação `Concluída` ou `Cancelada` → 409 `Ação <Status> não pode ser alterada.` (CA35).
       7. Idempotência: delegar para a mesma matrícula já gravada (`matriculasIguais(novoResponsavel, acao.responsavel)`) resulta em 204 sem alteração e sem histórico (CA31).
       8. 400 Campos validados:
          - `novoResponsavel` validado por R3: 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, `target: novoResponsavel` (M3).
          - `justificativa`: obrigatória (vazia ou só espaços → 400 `O campo Justificativa é obrigatório para delegar.`, `target: justificativa`; > 500 chars → 400 `O campo Justificativa aceita no máximo 500 caracteres.`, `target: justificativa`; CA27), reaproveitando `validarJustificativa(valor, 'delegar')` de `srv/tratativa/justificativa.ts` (I4).
   - **Ação `editarAcao` sem responsável (R29, R30):**
     * O campo `responsavel` já não existe na assinatura de `editarAcao` desde o intent 004 (Ruling R-07). O intent 005 não altera a assinatura de `editarAcao`.
     * Enviar `responsavel` na edição continua resultando em 400 runtime campo desconhecido (CA29, CA93).
     * Histórico de `Edicao` nunca registra alterações de responsável (R30, CA94). A troca de responsável ocorre exclusivamente pela action `delegarAcao` com histórico de `Delegacao`.
   — **Por quê:** unifica o ciclo de vida do responsável sob auditoria formal com justificativa e preserva a integridade de dados.
   — **Verificado por:** testes da etapa 2 (CA26–CA31, CA35, CA53, CA57, CA61, CA92, CA93, CA94, CA105).

8. **Visibilidade e Proteção LGPD (R17, R26; Ruling R-02)** (R17, R26; CA1, CA63, CA64, CA65, CA66, CA88, CA89, CA111; N3-6; Decisão C delegada).
   - **Na consulta de Tratativa por Código (`consultarTratativa`):**
     * Permanece 100% INTACTA com o contrato do intent 003: exatamente as 12 chaves originais, sem campos de responsáveis e sem coleções (preservando estritamente os testes RED de 003; C1).
     * Campos `descricao` e `solicitante` continuam retornando `null` para quem não é Gestor (CA66, CA89).
   - **Na nova consulta dedicada de Responsáveis (`consultarResponsaveis`):**
     * Exclusiva para o `GestorTratativa` (`@restrict: [{ grant: ['consultarResponsaveis'], to: 'GestorTratativa' }]`).
     * Para o Gestor: retorna `responsavelPrincipal` (matrícula gravada ou `null`) e `participantes` (lista de matrículas `string[]`, retornando `[]` quando vazia; CA1, CA64).
     * Para qualquer outro usuário autenticado (incluindo o próprio Responsável Principal ou Participantes): o acesso é negado estaticamente com HTTP 403 Forbidden pelo runtime CAP (Ruling R-02, CA63, CA89, CA111). Precedência detalhada: 401 Autenticação → 403 Papel estático → 400 Código inválido. (parâmetro `tratativa` ausente/malformado) → 404 Tratativa não encontrada. → 200 Sucesso.
   - **Na estrutura e detalhe de Ações (`consultarEstruturaAcoes`, `consultarAcao`):**
     * O campo `responsavel` continua retornando a matrícula apenas para o `GestorTratativa` e `null` para os demais usuários autenticados (CA65, 004 R25/R26).
   - **Na listagem geral de Tratativas (`listarTratativas`):**
     * As chaves `responsavelPrincipal` e `participantes` não existem no tipo `ItemListagem` (ausentes do JSON para todos, inclusive o Gestor; CA63, CA88).
   - **Prevenção de vazamento relacional (M6):**
     * Nenhuma entidade de banco é exposta como entity set OData legível com `READ`. Não há suporte a `$expand` de participantes ou responsáveis em nenhuma rota (retorna 400).
     * Tentativas de navegação OData para a composição de participantes ou GET direto em `ParticipantesTratativa` devolvem 400/404, garantindo isolamento total de dados pessoais (M6).
   — **Por quê:** cumpre a decisão de governança R-02, eliminando qualquer risco de quebra de contrato com testes anteriores e protegendo dados pessoais de colaboradores contra vazamento relacional (Decisão C, aguardando ratificação no Gate 1).
   — **Verificado por:** testes de leitura, verificação de 403 estático para não-gestores e testes de não-vazamento relacional (CA1, CA63, CA64, CA65, CA66, CA88, CA89, CA111).

9. **Consultas "Minhas Ações" e "Minhas Tratativas" (R18, R19, R20)** (R18, R19, R20; CA67–CA81, CA83, CA100, CA112; N3-4).
   - Duas functions no `TratativaService`:
     ```cds
     function minhasAcoes(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasAcoes;
     function minhasTratativas(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasTratativas;
     ```
   - **Precedência e validações:**
     1. Autenticação (401).
     2. Aplicativo de origem (403 via `before('*')`).
     3. Parâmetro `matricula`:
        * Se o usuário NÃO possui o papel `GestorTratativa`:
          - Se informar `matricula` diferente da sua própria (comparada via `matriculasIguais(matricula, obterMatriculaUsuario(req))`), recusa com 403 Forbidden na etapa 2 (papel estático precede validação de formato; CA80, CA112).
          - Se informar a sua própria matrícula, a consulta é aceita (CA80).
        * Se o usuário possui o papel `GestorTratativa`:
          - Se `matricula` informada for malformada por R3 (espaços no meio, e-mail, > 50 chars), recusa com 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, `target: matricula` (CA81, CA112).
          - Se for válida, consulta os registros daquela matrícula específica (CA79). Se não houver vínculos, retorna lista vazia `[]` sem erro (CA81).
        * Se `matricula` for omitida: utiliza a matrícula do usuário autenticado via `obterMatriculaUsuario(req)`.
     4. Parâmetro `status`:
        * Se informado e não vazio/espaços:
          - Em `minhasAcoes`: deve pertencer aos valores válidos de `StatusAcao` (`Pendente`, `Em andamento`, `Concluída`, `Cancelada`). Caso contrário, 400 `Status inválido: use Pendente, Em andamento, Concluída ou Cancelada.`, `target: status` (CA70).
          - Em `minhasTratativas`: deve pertencer aos valores válidos de `StatusTratativa` (`Aberta`, `Em andamento`, `Encerrada`, `Cancelada`). Caso contrário, 400 `Status inválido: use Aberta, Em andamento, Encerrada ou Cancelada.`, `target: status` (CA77).
        * Se omitido: traz todos os status.
     5. Paginação:
        * A paginação de `minhasAcoes` e `minhasTratativas` reaproveita a função helper de cálculo de paginação extraída de `srv/tratativa/listagem.ts` (função pura `extrairPaginacao(tamanhoPagina, pagina)` exportada por `listagem.ts`), garantindo consistência com `listarTratativas` e preservando 100% inalterado o comportamento de 003 (I2, M9).
        * `tamanhoPagina`: padrão 50; se < 1 ou > 200, 400 `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina` (CA71).
        * `pagina`: padrão 1; se < 1, 400 `O campo Página deve ser 1 ou maior.`, `target: pagina`.
   - **Campos retornados e ordenação:**
     * `minhasAcoes`: busca Ações e Subações em que `responsavel` coincide com a matrícula alvo. Traz `codigo` (da Ação), `codigoTratativa`, `tituloTratativa`, `statusTratativa`, `descricao`, `prioridade`, `status`, `prazo`, `evidenciaObrigatoria`, `dataConclusao`, `acaoMae` (UUID ou `null`). **Não traz `responsavel`** (CA67). Ordenação: `prazo ASC, criadoEm ASC, codigo ASC` (CA68). Inclui Ações de Tratativas `Encerrada` ou `Cancelada` com o status visível (CA72).
     * `minhasTratativas`: busca Tratativas em que a matrícula alvo é `responsavelPrincipal` OU consta na composição `participantes`. Traz exatamente os dez campos de `ItemListagem` do 003 mais `meuPapel` (`Responsável Principal` ou `Participante`). **Não traz Descrição, Solicitante, Responsável Principal nem Participantes** (CA74, CA75). Tratativa onde o usuário é apenas Responsável de Ação não entra aqui (CA76). Ordenação: `dataPrevistaConclusao ASC, dataCriacao ASC, codigo ASC` (CA78).
   - **Nota de R29:** por se tratarem de functions, parâmetros estruturais com tipos JSON inválidos enviados por aplicativos externos podem receber 400 de forma do runtime CAP antes do 403 do handler (declarado e em conformidade).
   — **Por quê:** oferece ao colaborador visão clara de suas obrigações e permite ao Gestor redistribuir pendências (R20, R21, CA83) para suporte a auditorias e aos futuros indicadores do intent 012.
   — **Verificado por:** testes da etapa 4 (CA67–CA81, CA83, CA100, CA112).

10. **Auditoria imutável e Histórico parametrizado (R14, R15)** (R14, R15; CA51–CA58, CA102, CA103; N3-6).
    - Reutilização da infraestrutura de `srv/tratativa/historico.ts` com a função parametrizada `registrarHistorico`:
      * Em `HistoricoTratativa`:
        - `Atribuicao`: campo `responsavelPrincipal`, valorAnterior `null`, valorNovo matrícula, justificativa opcional informada ou `null` (CA51, CA102).
        - `Reatribuicao`: campo `responsavelPrincipal`, valorAnterior matrícula anterior, valorNovo matrícula nova, justificativa obrigatória (CA52).
        - `InclusaoParticipante`: campo `participante`, valorAnterior `null`, valorNovo matrícula, justificativa `null` (CA54).
        - `RemocaoParticipante`: campo `participante`, valorAnterior matrícula, valorNovo `null`, justificativa `null` (CA54).
      * Em `HistoricoAcoes`:
        - `Delegacao`: campo `responsavel`, valorAnterior matrícula anterior, valorNovo matrícula nova, justificativa obrigatória (CA53).
    - `autor`: `obterMatriculaUsuario(req)`, `tipoAutor`: `'Usuario'`.
    - `quando`: data e hora correntes obtidas de `agora()` (`srv/lib/relogio.ts`).
    - **Atomicidade (R15):** toda gravação de histórico roda na mesma transação CAP (`cds.db.tx`). Falha em qualquer etapa acarreta rollback total (CA56).
    - **Responsável Original (R14, CA103):** é derivado analiticamente das cadeias de histórico:
      * Na Tratativa: valor novo do primeiro evento de `Atribuicao` em `HistoricoTratativa`.
      * Na Ação: valor anterior da primeira `Delegacao` em `HistoricoAcoes` ou, se nunca delegada, o `responsavel` vigente.
   — **Por quê:** cumpre a regra inviolável de AGENTS.md:40 ("todo evento auditável gera registro de histórico — nunca alteração silenciosa").
   — **Verificado por:** testes das etapas 1 e 2 (CA51–CA58, CA102, CA103).

11. **Serialização por agregado D9 com bloqueio pessimista** (R15; CA57, CA58, CA105).
    - Toda operação de escrita sobre Tratativa (`atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante`) ou Ação (`delegarAcao`, `mudarStatusAcao`) executa o bloqueio pessimista D9 `await bloquearTratativa(codigoTratativa)` (`srv/tratativa/bloqueio.ts`: `SELECT ... FOR UPDATE`) na transação do pedido, imediatamente após as validações de forma e formato de códigos estruturais (a validação de parâmetros como `codigoValido` antecede o bloqueio D9; M4).
    - Duas Delegações simultâneas ou duas Reatribuições simultâneas são serializadas no banco, formando uma cadeia contínua de histórico (CA57).
    - Duas inclusões concorrentes do mesmo participante resultam em uma única inserção idempotente e um único registro de histórico (CA58).
    — **Por quê:** mantém a diretriz corporativa D9, evitando deadlocks e inconsistências de estado no HANA Cloud.
    — **Verificado por:** testes de concorrência com `Promise.all` e espião `bloqueiaAntesDeEscrever` (CA57, CA58).

12. **Arquitetura modular em `srv/tratativa/` e handlers delegadores finos**:
    - `srv/tratativa/identidade.ts`: funções puras de manipulação de matrícula e identidade (`obterMatriculaUsuario`, `normalizarMatricula`, `matriculasIguais`, `usuarioAutenticadoEhMatricula`).
    - `srv/tratativa/validacao-matricula.ts`: validação semântica do formato de matrícula R3 (`validarMatricula`).
    - `srv/tratativa/justificativa.ts`: função pura parametrizada `validarJustificativa(valor, operacao)` aceitando mensagens específicas por operação (`para cancelar e reabrir` padrão de 003, `para reatribuir` R7, `para delegar` R8; I4).
    - `srv/tratativa/responsaveis-tratativa.ts`: lógica de domínio para `atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante` e a function `consultarResponsaveis` (I4).
    - `srv/tratativa/acoes-delegacao.ts`: lógica de domínio para `delegarAcao`.
    - `srv/tratativa/acoes-criacao.ts`: implementa diretamente a validação semântica de matrícula na criação de Ações e Subações (R27; invocando `validarMatricula` para o campo `responsavel`), preservando intactas as mensagens semânticas do 004 para ausente/vazio e comprimento > 50, sem modificar nem tocar `srv/tratativa/acoes-validacao.ts` (M5).
    - `srv/tratativa/consultas-responsabilidade.ts`: implementação das functions `minhasAcoes` e `minhasTratativas`, reutilizando o helper de paginação extraído de `listagem.ts` (I2).
    - `srv/tratativa/acoes-ciclo-de-vida.ts`: atualização de `mudarStatusAcao` para suportar a autorização dinâmica e precedência detalhada de etapas (R11, R16, R28; I1).
    - `srv/tratativa/listagem.ts`: refatorado de forma neutra para extrair e exportar a função helper pura de cálculo de paginação (`extrairPaginacao`), reutilizada por `consultas-responsabilidade.ts`, preservando 100% inalterado o comportamento e contrato de `listarTratativas` e `consultarTratativa` de 003 (I2).
    - `srv/tratativa/acoes-consulta.ts`: permanece inalterado (a consulta `consultarTratativa` não muda no 005; Ruling R-02, C1).
    - Handlers em `srv/tratativa-service.ts`: aplicação de `toLowerCase()` na chave da URL e em parâmetros estruturais (`acao`), mapeamento de autor `{ id: obterMatriculaUsuario(req), tipo: 'Usuario' }` e delegação ao domínio.
    — **Por quê:** promove alta manutenibilidade, separação de responsabilidades e desacoplamento das camadas.
    — **Verificado por:** `npm run build`, `npm run lint` e `npm run arch`.

13. **Ausência de comunicação externa e dependências adicionais** (R13, R23; CA50, CA85).
    - Nenhuma comunicação externa (HTTP, e-mail, Teams, SuccessFactors) é realizada pelas operações deste intent.
    - Nenhuma dependência externa nova adicionada ao `package.json`.
    — **Por quê:** conformidade com D2 e AGENTS.md:38.
    — **Verificado por:** `npm run arch` e teste de ausência de comunicação externa na etapa 1 (CA50, CA85).

---

### Decisões de plataforma a registrar em `agentic/projeto/decisoes.md`

Nenhuma nova decisão D de nível de plataforma é necessária: as decisões D1 a D10 vigentes (incluindo D9 sobre serialização por agregado e D10 sobre o contrato de recusas) cobrem integralmente as necessidades deste intent. O enquadramento de R5 e R6 como 409 segue rigorosamente o princípio estabelecido na D10 ("pedido semanticamente válido que o estado atual da entidade impede de executar é 409").

---

## Contrato executável

- **O que é:** diff do modelo em `db/tratativa.cds`, especificação CDS completa de `srv/tratativa-service.cds`, e contrato de erros completo das operações de Responsáveis e Participantes.
- **Como se valida (medições a repetir pelo revisor):**
  1. `cds compile db srv --to sql`: confirmar que apenas comandos `CREATE TABLE` de `ParticipantesTratativa` e `CREATE TABLE com a coluna nova` `responsavelPrincipal` em `Tratativas` são gerados; sem alterações destrutivas.
  2. `cds compile db --to hdbtable`: compilação limpa para HANA HDI.
  3. `npm run build`: compilação TypeScript e modelos cds-typer limpos.
  4. `npx jest`: execução de todas as suítes de teste de 002, 003 e 004 sem regressão.
  5. `npm run lint` e `npm run arch`: nenhuma violação de linter ou fronteiras arquiteturais.

### `db/tratativa.cds` (diff sobre o estado pós-004)

```diff
+/** R19 (spec responsaveis-e-participantes): papel do usuário na Tratativa para a consulta Minhas Tratativas. */
+type PapelUsuarioTratativa : String(30) enum {
+  ResponsavelPrincipal = 'Responsável Principal';
+  Participante         = 'Participante';
+}

 @@ type EventoHistorico
    Reabertura;
    Cancelamento;
    Edicao;
+   Atribuicao;
+   Reatribuicao;
+   InclusaoParticipante;
+   RemocaoParticipante;
 }

 @@ type EventoHistoricoAcao
    Reabertura;
    Cancelamento;
    Edicao;
+   Delegacao;
 }

 @@ entity Tratativas
        criadoEm              : Timestamp not null;
        /** R1 (spec plano-de-acao): composição hierárquica de Ações da Tratativa. */
        acoes                 : Composition of many Acoes on acoes.tratativa = $self;
+       /** R1, R3, R17 (spec responsaveis-e-participantes): Responsável Principal da Tratativa. */
+       @PersonalData.IsPotentiallyPersonal
+       responsavelPrincipal : String(50);
+       /** R1, R6 (spec responsaveis-e-participantes): lista de até 20 Participantes da Tratativa. */
+       participantes         : Composition of many ParticipantesTratativa on participantes.tratativa = $self;
 }

+/** R1, R6, R17 (spec responsaveis-e-participantes): participante colaborador da Tratativa. */
+@PersonalData.EntitySemantics: 'Other'
+entity ParticipantesTratativa {
+  key ID        : UUID;
+      tratativa : Association to one Tratativas not null;
+      @PersonalData.IsPotentiallyPersonal
+      matricula : String(50) not null;
+      sequencia : Integer not null;
+      criadoEm  : Timestamp not null;
+}
```

### `srv/tratativa-service.cds` (arquivo completo)

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Serviço dos usuários da plataforma (specs 002, 003, 004 e 005).
 * Leitura por functions com tipo de retorno explícito; ciclo de vida por actions ligadas à Tratativa.
 * Gestão de responsáveis, delegação e consultas por colaborador.
 */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  type ResultadoCriacaoAcao {
    codigo : UUID;
  }

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

  /** R17, R26 (005; Ruling R-02): estrutura de responsáveis e participantes para o Gestor. */
  type DetalheResponsaveis {
    responsavelPrincipal : String(50);
    participantes        : many String;
  }

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

  /** R18 (005): item de Ação retornado pela consulta Minhas Ações (sem campo responsavel). */
  type ItemMinhasAcoes {
    codigo               : UUID;
    codigoTratativa      : UUID;
    tituloTratativa      : String(200);
    statusTratativa      : m.StatusTratativa;
    descricao            : String(500);
    prioridade           : m.PrioridadeAcao;
    status               : m.StatusAcao;
    prazo                : Date;
    evidenciaObrigatoria : String(3);
    dataConclusao        : Date;
    acaoMae              : UUID;
  }

  /** R19 (005): item de Tratativa retornado pela consulta Minhas Tratativas (dez campos de ItemListagem + meuPapel). */
  type ItemMinhasTratativas {
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
    meuPapel              : m.PapelUsuarioTratativa;
  }

  action   criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                                unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;

  function listarTratativas(origem : String, idOrigem : String, criticidade : String, status : String,
                            unidade : String, area : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemListagem;

  function consultarTratativa(codigo : UUID) returns DetalheTratativa;

  /** R17, R26 (005; Ruling R-02): consulta de responsáveis exclusiva para o Gestor. */
  @restrict: [{ grant: ['consultarResponsaveis'], to: 'GestorTratativa' }]
  function consultarResponsaveis(tratativa : UUID) returns DetalheResponsaveis;

  function consultarEstruturaAcoes(tratativa : UUID) returns many ItemEstruturaAcao;

  function consultarAcao(tratativa : UUID, codigo : UUID) returns DetalheAcao;

  /** R18, R20 (005): lista Ações e Subações sob responsabilidade do colaborador. */
  function minhasAcoes(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasAcoes;

  /** R19, R20 (005): lista Tratativas em que o colaborador é Responsável Principal ou Participante. */
  function minhasTratativas(status : String, matricula : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemMinhasTratativas;

  @readonly
  @restrict: [
    {
      grant: [
        'mudarStatus',
        'editar',
        'mudarCriticidade',
        'criarAcao',
        'criarSubacao',
        'editarAcao',
        'atribuirResponsavelPrincipal',
        'incluirParticipante',
        'removerParticipante',
        'delegarAcao'
      ],
      to   : 'GestorTratativa'
    },
    {
      grant: ['mudarStatusAcao'],
      to   : 'authenticated-user'
    }
  ]
  entity Tratativas as projection on m.Tratativas { key codigo } actions {
    action mudarStatus(status : String, justificativa : String);
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);
    action mudarCriticidade(criticidade : String);

    action criarAcao(descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;
    action criarSubacao(acaoMae : UUID, descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;

    /** R11, R16, R28 (005): autorização dinâmica no domínio (Gestor OU Responsável da Ação). */
    action mudarStatusAcao(acao : UUID, status : String, justificativa : String);

    /** R19/R20 do 004: edição comum sem o campo responsavel (Ruling R-07). */
    action editarAcao(acao : UUID, descricao : String, prazo : String, prioridade : String, evidenciaObrigatoria : String);

    /** R7, R14 (005): primeira atribuição ou reatribuição de Responsável Principal da Tratativa. */
    action atribuirResponsavelPrincipal(responsavelPrincipal : String, justificativa : String);

    /** R9, R14 (005): inclusão de participante na Tratativa (até 20). */
    action incluirParticipante(participante : String);

    /** R9, R14 (005): remoção de participante da Tratativa. */
    action removerParticipante(participante : String);

    /** R8, R14 (005): delegação do Responsável da Ação ou Subação com justificativa obrigatória. */
    action delegarAcao(acao : UUID, novoResponsavel : String, justificativa : String);
  };
}
```

### Contrato de erros do `TratativaService` (operações do intent 005)

| Situação | HTTP | Mensagem | `target` |
|---|---|---|---|
| Sem autenticação | 401 | runtime (`Unauthorized`) | — |
| Sem papel `GestorTratativa` em operações exclusivas do Gestor | 403 | runtime (`Forbidden`) | — |
| Usuário sem papel `GestorTratativa` consulta `consultarResponsaveis` | 403 | runtime (`Forbidden`) | — |
| Identidade `AplicativoOrigem` em qualquer endpoint do serviço (em `mudarStatusAcao`: após forma e antes da existência; R-03) | 403 | `Aplicativo de origem não usa este serviço.` | — |
| Usuário não-gestor tenta iniciar/concluir Ação de outra pessoa | 403 | `Forbidden` | — |
| Responsável de Ação tenta cancelar, reabrir ou enviar destino proibido | 403 | `Forbidden` | — |
| Usuário não-gestor consulta `minhasAcoes` ou `minhasTratativas` informando outra matrícula | 403 | `Forbidden` | — |
| Campo fora da assinatura (ex.: `responsavel` em `editarAcao`) | 400 | runtime (`Property "<x>" does not exist in <action>`) | runtime |
| Tipo JSON incorreto (ex.: booleano em campo de texto) | 400 | runtime (`ASSERT_DATA_TYPE`) | runtime |
| Parâmetro de Código estrutural malformado (`acao`, `acaoMae`, `codigo`, `tratativa`) | 400 | `Código inválido.` | parâmetro |
| Tratativa inexistente ou com chave malformada na URL | 404 | `Tratativa não encontrada.` | — |
| Ação inexistente ou de outra Tratativa | 404 | `Ação não encontrada.` | — |
| Matrícula inválida por R3 (espaços no meio, e-mail `@`, tamanho > 50) | 400 | `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` | `responsavelPrincipal`, `participante`, `novoResponsavel` ou `matricula` |
| Operação de responsabilidade sobre Tratativa `Encerrada` ou `Cancelada` | 409 | `Tratativa <Status> não pode ser alterada.` | — |
| Delegação sobre Ação `Concluída` ou `Cancelada` | 409 | `Ação <Status> não pode ser alterada.` | — |
| Responsável Principal e Participante são a mesma pessoa (R5) | 409 | `Responsável Principal e Participante não podem ser a mesma pessoa.` | `responsavelPrincipal` ou `participante` |
| Limite de 20 Participantes atingido (R6) | 409 | `Limite de 20 Participantes atingido.` | `participante` |
| Status ausente ou só espaços em `mudarStatusAcao` pelo Gestor (M5) | 400 | `O campo Status é obrigatório.` | `status` |
| Transição de Ação inválida ou para o mesmo status (R7/R8 de 004) | 409 | `Transição não permitida: de <Status atual> para <Status pedido>.` | `status` |
| Conclusão de Ação mãe com Subações abertas (R11 de 004) | 409 | `A Ação possui Subações não concluídas nem canceladas.` | — |
| Justificativa ausente em Reatribuição (R7) | 400 | `O campo Justificativa é obrigatório para reatribuir.` | `justificativa` |
| Justificativa ausente em Delegação (R8) | 400 | `O campo Justificativa é obrigatório para delegar.` | `justificativa` |
| Justificativa com mais de 500 caracteres | 400 | `O campo Justificativa aceita no máximo 500 caracteres.` | `justificativa` |
| Status fora da lista permitida no filtro de `minhasAcoes` | 400 | `Status inválido: use Pendente, Em andamento, Concluída ou Cancelada.` | `status` |
| Status fora da lista permitida no filtro de `minhasTratativas` | 400 | `Status inválido: use Aberta, Em andamento, Encerrada ou Cancelada.` | `status` |
| Tamanho de página fora de 1..200 em `minhasAcoes` ou `minhasTratativas` | 400 | `O campo Tamanho da página aceita de 1 a 200.` | `tamanhoPagina` |
| Página menor que 1 em `minhasAcoes` ou `minhasTratativas` | 400 | `O campo Página deve ser 1 ou maior.` | `pagina` |
| Action aceita com retorno (`criarAcao`, `criarSubacao`) | 200 | `{ "codigo": "<uuid>" }` | — |
| Action aceita sem retorno (`atribuir...`, `incluir...`, `remover...`, `delegar...`, `mudarStatus...`) | 204 | sem corpo | — |
| Falha interna na gravação de dados ou histórico (rollback) | 500 | erro do runtime | — |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-responsaveis-e-participantes.md` | Entrega completa do intent 005 em uma branch única e quatro etapas RED/GREEN sequenciais: (1) Responsável Principal e Participantes da Tratativa; (2) Delegação de Ações com justificativa obrigatória e histórico dedicado; (3) Autorização dinâmica para iniciar e concluir Ações; (4) Consultas "Minhas Ações" / "Minhas Tratativas" e Visibilidade LGPD. | `responsaveis-e-participantes/001-responsaveis-e-participantes` |

Uma única task atômica e robusta conforme a diretriz de governança do projeto, garantindo PR empilhado sobre a branch do 004 e histórico de commits `test(red):` e `feat(green):` validados por arquivo via `verifica-red.sh`.

---

## Itens N3 (aprovados no Gate 1, 2026-10-08, orquestrador por delegação do humano — D11)

| # | Item | Gatilho | Previsão / Encaminhamento |
|---|---|---|---|
| N3-1 | Alteração aditiva em `db/tratativa.cds`: `Tratativas.responsavelPrincipal String(50)`, composição `participantes`, entidade `ParticipantesTratativa`, enums `PapelUsuarioTratativa`, `EventoHistorico` e `EventoHistoricoAcao`. Sem impacto destrutivo no banco. | `db/*.cds` | Mudança estritamente aditiva; validada por compilação SQL/HDI. |
| N3-2 | Ajuste de autorização em `TratativaService`: flexibilização de `@restrict` de `mudarStatusAcao` para `authenticated-user` com validação de domínio em 9 etapas; `@restrict` exclusivo para `GestorTratativa` em `consultarResponsaveis`; módulo único `srv/tratativa/identidade.ts` associando ID do token à matrícula (etapas 1-4 da task; M7). | segurança / autorização | Isolamento de identidade em ponto único para troca indolor pelos intents 011/014. |
| N3-3 | Recusa 403 para identidade técnica `AplicativoOrigem` em todas as rotas e actions do `TratativaService` (em `mudarStatusAcao`: após forma válida e antes da existência; R-03). | contrato público / segurança | Preserva o isolamento de integrações externas de terceiros. |
| N3-4 | Superfície pública do `TratativaService` (`/api/tratativa/v1`): novas actions `atribuirResponsavelPrincipal`, `incluirParticipante`, `removerParticipante`, `delegarAcao`, e functions `consultarResponsaveis`, `minhasAcoes`, `minhasTratativas`; preservação das mensagens semânticas do 004 em `criarAcao` (M8). | contrato público OData | Padronização com D4, D6 e contrato de erros unificado D10. |
| N3-5 | Padrão textual e formato restritivo de Matrícula (R3): texto de 1 a 50 caracteres sem espaços no meio e sem `@`. | regras de domínio / LGPD | Prevenção contra injeção de nomes completos ou e-mails em chaves de colaborador. |
| N3-6 | LGPD: consulta `consultarResponsaveis` restrita ao Gestor; `DetalheTratativa` intacto com 12 chaves; `@PersonalData.IsPotentiallyPersonal` em todas as colunas de matrícula; sem vazamento por navegação OData ($expand e GET direto devolvem 400/404; M6). | LGPD | Proteção rígida de dados pessoais de colaboradores conforme normas corporativas. |
| N3-7 | Ausência de novas dependências e deploy inalterado: zero dependências adicionadas no `package.json`; sem criação de `mta.yaml` ou `xs-security.json`. | infraestrutura / deploy | Verificado por `npm run arch` e scripts de verificação. |

---

## Como isso se prova

Tabela completa de mapeamento de todos os 115 Critérios de Aceite da spec para as provas automatizadas nas etapas da task 001.

| CA | Prova Automatizada | Etapa / Arquivo de Teste |
|---|---|---|
| CA1 | Gestor consulta consultarResponsaveis pelo Código da Tratativa recém-aberta → responsavelPrincipal vem null e participantes vem lista vazia `[]` (Ruling R-02); precedência: 401 → 403 estático → 400 código malformado/ausente → 404 inexistente → 200 (M3) | Etapa 1 (`test/responsaveis-tratativa.test.ts`) |
| CA2 | Atribuir segundo Responsável Principal constitui troca (Reatribuição) e a Tratativa permanece com um único | Etapa 1 |
| CA3 | Ação não possui endpoint/opção de inclusão de participantes | Etapa 2 (`test/delegacao-acoes.test.ts`) |
| CA4 | Tratativa sem Responsável Principal é iniciada e encerrada com sucesso pelo Gestor | Etapa 1 |
| CA5 | Abertura por app enviando Responsável Principal ou Participantes é recusada como campo desconhecido | Etapa 1 |
| CA6 | Atribuir "M1001" grava o valor com sucesso | Etapa 1 |
| CA7 | Atribuir "Maria Silva", e-mail ou valor vazio recusa com 400 nomeando Responsável Principal | Etapa 1 |
| CA8 | Atribuir " M1001 " grava "M1001" (trim); valor com 51 caracteres recusa com 400 | Etapa 1 |
| CA9 | Incluir participante com e-mail recusa nomeando Participante; delegar com nome recusa nomeando novoResponsavel | Etapa 1 e Etapa 2 |
| CA10 | Usuário autenticado com ID "m1001" inicia Ação cujo Responsável é "M1001" (comparação sem caixa) | Etapa 3 (`test/autorizacao-execucao-acoes.test.ts`) |
| CA11 | Usuário autenticado com ID "M2002" tenta iniciar Ação de "M1001" → 403 Forbidden | Etapa 3 |
| CA12 | Identidade técnica mockada "app-origem-a" autenticada não executa Ação mesmo com matrícula gravada "app-origem-a" (M1) | Etapa 3 |
| CA13 | Participante "M3003" atribuído como Responsável Principal → 409 mesma pessoa | Etapa 1 |
| CA14 | Responsável Principal "M1001" incluído como Participante → 409 mesma pessoa | Etapa 1 |
| CA15 | "M1001" Responsável de Ação e Participante da mesma Tratativa coexistem sem recusa | Etapa 1 |
| CA16 | Inclusão de "M3003" e "M4004" preserva a ordem exata de inserção via sequencia (`criadoEm ASC, sequencia ASC`), mesmo com instante congelado nos testes (M4) | Etapa 1 |
| CA17 | Incluir participante já presente resulta em 204 idempotente sem duplicação e sem histórico | Etapa 1 |
| CA18 | Remover participante inexistente resulta em 204 idempotente sem histórico | Etapa 1 |
| CA19 | Incluir 21º participante recusa com 409 `Limite de 20 Participantes atingido.`; com 19 aceita o 20º | Etapa 1 |
| CA20 | Primeira atribuição sem justificativa é aceita | Etapa 1 |
| CA21 | Reatribuição com justificativa é aceita e grava novo valor | Etapa 1 |
| CA22 | Reatribuição sem justificativa, só espaços ou com 501 caracteres recusa com 400 citando Justificativa | Etapa 1 |
| CA23 | Atribuir a mesma matrícula já gravada resulta em 204 sem histórico | Etapa 1 |
| CA24 | Não existe operação para deixar Tratativa sem Responsável Principal após atribuído | Etapa 1 |
| CA25 | Usuário sem papel de Gestor (inclusive o Resp Principal) tenta atribuir/trocar → 403 | Etapa 1 |
| CA26 | Gestor delega Ação com justificativa → Responsável passa ao novo colaborador | Etapa 2 |
| CA27 | Delegar sem justificativa recusa com 400 citando Justificativa | Etapa 2 |
| CA28 | Delegar Subação funciona identicamente preservando o Responsável da mãe | Etapa 2 |
| CA29 | Edição comum da Ação (`editarAcao`) enviando campo responsavel recusa com 400 campo desconhecido | Etapa 2 |
| CA30 | Responsável da Ação sem papel de Gestor tenta delegar a própria Ação → 403 | Etapa 2 |
| CA31 | Delegar para a mesma matrícula já gravada resulta em 204 sem histórico | Etapa 2 |
| CA32 | Gestor inclui e remove participantes sem justificativa com sucesso | Etapa 1 |
| CA33 | Usuário sem papel de Gestor tenta incluir ou remover participante → 403 | Etapa 1 |
| CA34 | Atribuir, incluir ou remover participante em Tratativa Encerrada/Cancelada → 409 Tratativa não pode ser alterada (Etapa 1); delegar em Tratativa Encerrada/Cancelada → 409 (Etapa 2) | Etapa 1 e Etapa 2 |
| CA35 | Delegar Ação Concluída ou Cancelada recusa com 409 Ação não pode ser alterada | Etapa 2 |
| CA36 | Atribuir Responsável Principal em Tratativa reaberta é aceito | Etapa 1 |
| CA37 | Responsável "M1001" de Ação Pendente inicia → Em andamento, histórico MudancaStatus com autor M1001 | Etapa 3 |
| CA38 | Responsável conclui Ação Em andamento → Concluída e data de conclusão preenchida | Etapa 3 |
| CA39 | Responsável conclui Ação Pendente diretamente sem iniciar → aceito | Etapa 3 |
| CA40 | Responsável da Ação tenta cancelar (destino Cancelada) ou reabrir → 403 na etapa 5 | Etapa 3 |
| CA41 | Responsável de Ação com Subação pendente tenta concluir → 409 Subações não concluídas | Etapa 3 |
| CA42 | Responsável da mãe "M1001" tenta iniciar Subação de "M2002" → 403; M2002 inicia com sucesso | Etapa 3 |
| CA43 | Responsável de Ação em Tratativa Encerrada tenta concluir → 409 Tratativa Encerrada não pode ser alterada | Etapa 3 |
| CA44 | Responsável de Ação Concluída pede Concluída de novo → autorização etapa 5 concedida, 409 etapa 7 | Etapa 3 |
| CA45 | Responsável conclui sem justificativa com sucesso; Gestor continua podendo iniciar e concluir | Etapa 3 |
| CA46 | Responsável Principal da Tratativa sem papel Gestor tenta transições, edição ou criar Ação → 403 | Etapa 1 |
| CA47 | Participante da Tratativa tenta escrita em atribuir, incluir ou remover → 403 (Etapa 1); tenta delegar Ação → 403 (Etapa 2) | Etapa 1 e Etapa 2 |
| CA48 | Aplicativo de origem tenta atribuir, incluir, remover ou consultar responsáveis → 403 (Etapa 1); tenta delegar Ação → 403 (Etapa 2); tenta minhasAcoes/minhasTratativas → 403 (Etapa 4) | Etapa 1, 2, 4 |
| CA49 | Consulta do aplicativo (/v1) mantém sete campos e não devolve responsáveis | Etapa 1 |
| CA50 | Operações de responsabilidade não realizam comunicação de saída externa | Etapa 1 |
| CA51 | Registro de histórico de Atribuição com campo responsavelPrincipal, autor e valorNovo | Etapa 1 |
| CA52 | Registro de histórico de Reatribuição com valorAnterior, valorNovo e justificativa | Etapa 1 |
| CA53 | Registro de histórico de Delegação com Tratativa, Ação, valores e justificativa | Etapa 2 |
| CA54 | Registros de histórico de InclusaoParticipante e RemocaoParticipante | Etapa 1 |
| CA55 | Pedidos recusados não gravam histórico (atribuição/inclusão/remoção na Etapa 1; delegação na Etapa 2; transição do responsável na Etapa 3; I3) | Etapa 1, Etapa 2 e Etapa 3 |
| CA56 | Falha no histórico dispara rollback transacional total dos dados (atribuição/inclusão/remoção na Etapa 1; delegação na Etapa 2; transição do responsável na Etapa 3; I3) | Etapa 1, Etapa 2 e Etapa 3 |
| CA57 | Duas Delegações simultâneas formam cadeia contínua de histórico | Etapa 2 |
| CA58 | Duas inclusões simultâneas do mesmo participante resultam em registro único | Etapa 1 |
| CA59 | Não-gestor delegando Ação inexistente recebe 403 (papel estático precede existência) | Etapa 2 |
| CA60 | Gestor atribuindo a Tratativa inexistente recebe 404 Tratativa não encontrada | Etapa 1 |
| CA61 | Gestor delegando sem justificativa em Tratativa Encerrada recebe 409 Tratativa Encerrada (estado precede campos) | Etapa 2 |
| CA62 | Pedido sem autenticação em qualquer operação recebe 401 | Etapa 1 a 4 |
| CA63 | Não-gestor consultando consultarResponsaveis recebe 403 Forbidden do runtime; listagem geral não traz chaves de responsáveis (Ruling R-02) | Etapa 1 |
| CA64 | Gestor consultando consultarResponsaveis recebe responsavelPrincipal preenchido e lista participantes (Ruling R-02) | Etapa 1 |
| CA65 | Não-gestor consultando estrutura de Ações recebe responsavel null; Gestor recebe preenchido | Etapa 4 (`test/consultas-responsabilidade.test.ts`) |
| CA66 | Responsável Principal ou Participante não-gestor consultando Tratativa (consultarTratativa) recebe Descrição e Solicitante null (12 chaves do 003 mantidas) | Etapa 1 |
| CA67 | "minhas Ações" retorna itens com campos esperados e sem campo responsavel | Etapa 4 |
| CA68 | "minhas Ações" ordenação por Prazo crescente e empate por criação crescente | Etapa 4 |
| CA69 | "minhas Ações" filtro por Status funciona corretamente | Etapa 4 |
| CA70 | "minhas Ações" filtro por Status inválido recusa com 400 citando Status | Etapa 4 |
| CA71 | "minhas Ações" paginação padrão 50; mais de 200 recusa com 400 tamanho da página | Etapa 4 |
| CA72 | "minhas Ações" exibe Ação de Tratativa Cancelada com status visível | Etapa 4 |
| CA73 | Ação delegada desaparece de "minhas Ações" do anterior e aparece para o novo | Etapa 4 |
| CA74 | "minhas Tratativas" devolve item com meuPapel Responsável Principal ou Participante | Etapa 4 |
| CA75 | "minhas Tratativas" devolve dez campos + meuPapel, sem Descrição, Solicitante nem Responsáveis | Etapa 4 |
| CA76 | Usuário que só é Responsável de Ação não vê a Tratativa em "minhas Tratativas" | Etapa 4 |
| CA77 | "minhas Tratativas" filtro Status válido aceito; inválido recusa com 400 | Etapa 4 |
| CA78 | "minhas Tratativas" ordenação por data prevista e paginação de 50 | Etapa 4 |
| CA79 | Gestor consulta "minhas Ações" com matrícula de outro colaborador → recebe as Ações dele | Etapa 4 |
| CA80 | Não-gestor consultando com matrícula de outro → 403; com a própria → 200 | Etapa 4 |
| CA81 | Gestor consultando matrícula sem vínculos → lista vazia; formato inválido → 400 citando Matrícula | Etapa 4 |
| CA82 | Delegação para matrícula inexistente ou colaborador desligado é aceita sem consulta externa | Etapa 2 |
| CA83 | Gestor redistribui pendências de colaborador desligado via consulta R20 e delegação | Etapa 4 |
| CA84 | Ausência de papel aprovador: atribuição imediata pelo Gestor (Etapa 1) e delegação imediata pelo Gestor (Etapa 2) | Etapa 1 e Etapa 2 |
| CA85 | Delegação não dispara notificações externas | Etapa 2 |
| CA86 | Atribuição (Etapa 1), delegação (Etapa 2) e execução pelo responsável (Etapa 3) funcionam identicamente em Tratativa de app e avulsa | Etapa 1 a 3 |
| CA87 | Edição comum da Tratativa enviando responsavelPrincipal/participantes recusa com 400 campo desconhecido | Etapa 1 |
| CA88 | Gestor listando Tratativas recebe itens sem responsavelPrincipal nem participantes | Etapa 1 |
| CA89 | Não-gestor consultando Tratativa pelo Código recebe Descrição e Solicitante como null (12 chaves do 003); consulta consultarResponsaveis recebe 403 | Etapa 1 |
| CA90 | Criação de Ação com matrícula inválida por espaços no meio ou @ recusa com 400 citando Responsável (R27); ausente/vazio ou > 50 usa mensagens do 004; com válida aceita | Etapa 2 |
| CA91 | Responsável de Ação Em andamento conclui com sucesso (CA60 do 004 substituído); cancelar dá 403 | Etapa 3 |
| CA92 | Edição comum de Ação altera campos preservando o Responsável | Etapa 2 |
| CA93 | Edição comum de Ação com campo responsavel recusa com 400 campo desconhecido | Etapa 2 |
| CA94 | Delegação gera histórico de Delegação e nenhum histórico de edição de campo Responsável | Etapa 2 |
| CA95 | Não-gestor que não é o Responsável da Ação recebe 403 em qualquer transição (CA59 do 004 restrito) | Etapa 3 |
| CA96 | Atribuir "m3003 " como Responsável Principal quando já é participante recusa 409 mesma pessoa | Etapa 1 |
| CA97 | Participante "m3003" incluído novamente com caixa/espaços diferentes não duplica e conta uma vez | Etapa 1 |
| CA98 | Atribuir " m1001 " para quem já é Responsável Principal não altera e preserva grafia | Etapa 1 |
| CA99 | Matrícula com exatamente 50 caracteres é aceita com sucesso | Etapa 1 |
| CA100 | Gestor consultando "minhas Ações" com "m1001 " encontra Ações gravadas como "M1001" | Etapa 4 |
| CA101 | Remover participante em Tratativa Encerrada recusa com 409 Tratativa Encerrada | Etapa 1 |
| CA102 | Primeira atribuição com justificativa opcional grava a justificativa no histórico | Etapa 1 |
| CA103 | Responsável Original sai analiticamente do histórico em ordem cronológica | Etapa 2 |
| CA104 | Responsável informando Ação de outra Tratativa ao concluir recebe 404 (existência precede autorização) | Etapa 3 |
| CA105 | Tratativa Encerrada com Ação Concluída ao delegar recebe 409 Tratativa Encerrada (Tratativa precede Ação) | Etapa 2 |
| CA106 | Não-gestor tenta iniciar/concluir Ação inexistente com formato válido → 404 (existência precede autorização) | Etapa 3 |
| CA107 | Aplicativo de origem tenta iniciar/concluir Ação: com payload de forma inválida (campo desconhecido ou tipo incompatível) recebe 400 runtime; com forma válida (inclusive se o código acao for malformado) recebe 403 na etapa 3 antes de verificar existência (Ruling R-03, Ruling R-04; I1) | Etapa 3 |
| CA108 | Responsável de Ação Concluída pedindo Em andamento recebe 403 na etapa 6 (tentativa de reabrir) | Etapa 3 |
| CA109 | Responsável de Ação Em andamento pedindo Em andamento recebe 409 etapa 8; Cancelada pedindo Em andamento recebe 403 etapa 6 | Etapa 3 |
| CA110 | Responsável de Ação em Tratativa Encerrada pedindo Cancelada recebe 403 na etapa 6 (autorização precede estado da Tratativa) | Etapa 3 |
| CA111 | Gestor consultando consultarResponsaveis em Tratativa sem participantes recebe `[]` (lista vazia); não-gestor recebe 403 (Ruling R-02) | Etapa 1 |
| CA112 | Não-gestor informando Matrícula em formato inválido em minhas Ações/Tratativas recebe 403 na etapa 2; Gestor recebe 400 na etapa 8 | Etapa 4 |
| CA113 | Não-gestor tentando iniciar/concluir: campos desconhecidos/tipo recebem 400 runtime na etapa 2; com código acao malformado recebe 400 Código inválido. na etapa 4 antes de existência (404) e autorização (403; I1) | Etapa 3 |
| CA114 | Responsável tenta editar descrição, criar subação ou delegar em Ação inexistente → 403 papel estático etapa 2 | Etapa 3 |
| CA115 | Responsável de Ação Cancelada pedindo Concluída → autorização concedida etapa 6, 409 Transição não permitida etapa 8 | Etapa 3 |
| M6 | Verificação de não-vazamento relacional LGPD: $expand de participantes em consultarTratativa, navegação OData para ParticipantesTratativa e GET direto na entidade devolvem 400/404 | Etapa 1 (`test/responsaveis-tratativa.test.ts`) |

---

## O que não muda

- Os serviços `IntegracaoOrigemService`, `AdministracaoService` e `TratativaInternaService`.
- O contrato de abertura de Tratativas pelo aplicativo de origem (`/api/integracao-origem/v1` continua recebendo e devolvendo os mesmos campos, sem dados de responsáveis).
- O ciclo de vida da Tratativa gerenciado pelo Gestor (Status, encerramento condicionado a Ações concluídas, cancelamento e reabertura).
- A consulta `consultarTratativa` e o tipo `DetalheTratativa` do intent 003 permanecem 100% inalterados (exatamente as 12 chaves originais, sem coleções e sem campos de responsáveis; Ruling R-02).
- A estrutura analítica de Ações em dois níveis (Ação e Subação, regras de integridade mãe-filhas permanentes).
- Os parâmetros livres e as mensagens de validação semântica estabelecidos em 003 e 004.
- Nenhum teste de commit `test(red):` dos intents anteriores (002, 003 e 004) é contrariado, alterado ou desabilitado (incluindo o alinhamento estrito com os testes de CA59, CA60 e CA61 do intent 004 conforme Ruling R-08). Registra-se que os testes do intent 004 (localizados em `agentic/.estado/worktrees/plano-de-acao-001-acoes-hierarquicas/agentic/projeto/specs/plano-de-acao/`) usam forma válida para o aplicativo de origem (em conformidade com CA61) e dados de `responsavel` no formato de R3 (sem espaços no meio e sem `@`), garantindo plena interoperabilidade sem qualquer quebra com R27 e com o runtime CAP (M6).

---

## O desconfortável, declarado

- **Autorização dinâmica fora do `@restrict`:** o CAP não provê suporte nativo em CDL para regras de autorização dinâmicas baseadas no registro do banco (ex.: "usuário autenticado igual ao valor da coluna `responsavel`"). Por isso, o `@restrict` em `mudarStatusAcao` concede acesso a `authenticated-user` e a autorização de domínio em 9 etapas é implementada no handler TypeScript.
- **Proteção LGPD via function segregada (`consultarResponsaveis`):** em vez de embutir responsáveis no `DetalheTratativa` com campos nulos (o que violaria os testes RED do 003 e exigiria lidar com coleções serializadas pelo CAP), os responsáveis e participantes são consultados exclusivamente por `consultarResponsaveis`, onde não-gestores recebem 403 Forbidden estático do runtime CAP (Ruling R-02).
- **Sem validação externa de pessoas:** até o intent 011 (SuccessFactors), a plataforma não confere se a matrícula existe na folha de pagamento corporativa. Qualquer texto de 1 a 50 caracteres no formato válido é aceito (inclusive colaboradores desligados ou terceiros).

---

## Decisões que exigem o humano (Gate 1)

1. **Decisão A — Autorização dinâmica de `mudarStatusAcao` no `@restrict` do CDS vs Domínio:**
   - **Contexto:** o CAP não suporta restrição dinâmica por linha do banco via anotação declarativa no CDS.
   - **Decisão:** `mudarStatusAcao` é anotado com `{ grant: ['mudarStatusAcao'], to: 'authenticated-user' }` no CDS, enquanto a recusa de `AplicativoOrigem` ocorre na etapa 3 após forma válida e antes da existência (Ruling R-03), e a validação do Responsável Atual ocorre na etapa 5 após a leitura de existência no banco (etapa 4).
   - **Recomendação:** Ratificação pelo humano no Gate 1.

2. **Decisão B — Ponto único de identidade no token (R4):**
   - **Contexto:** a suposição `req.user.id = matrícula` é uma convenção técnica necessária até os intents 011 e 014.
   - **Decisão:** centralização em `srv/tratativa/identidade.ts` com `obterMatriculaUsuario(req)` e comparação case/trim-insensitive.
   - **Recomendação:** Ratificação pelo humano no Gate 1.

3. **Decisão C — LGPD, visibilidade segregada e retenção:**
   - **Contexto:** necessidade de isolar dados pessoais de colaboradores (matrículas de responsáveis e participantes) sem quebrar os testes RED do intent 003.
   - **Decisão:** segregação de responsáveis em function dedicada `consultarResponsaveis` restrita ao Gestor (`@restrict`), mantendo `consultarTratativa` intacto (Ruling R-02). O armazenamento de matrículas em logs de histórico e tabelas de participantes segue a política corporativa de retenção a ser definida para o ambiente produtivo.
   - **Recomendação:** Ratificação pelo humano no Gate 1.

**Registro do Gate 1 (2026-10-08):** decisões A, B e C e itens N3-1 a N3-7 aprovados pelo orquestrador, por delegação do humano (D11). Rulings em `agentic/.estado/execucao/2026-10-08-responsaveis-e-participantes/progress.md`. Branch empilhada sobre `plano-de-acao/001-acoes-hierarquicas` (PR #14).
