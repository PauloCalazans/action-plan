# Design: comentarios

**Spec:** agentic/projeto/specs/comentarios/spec.md  
**Status:** aprovado

Escopo técnico: comunicação colaborativa, alinhamento técnico e registro de decisões por meio de Comentários vinculados à Tratativa e às Ações ou Subações no `TratativaService` (`/api/tratativa/v1`), contemplando:
1. Modelo relacional persistido aditivo em `db/tratativa.cds` composto pela entidade `Comentarios` e pela composição `MencoesComentario` (1 a 2.000 caracteres de texto, até 10 menções a matrículas), anotações `@PersonalData`, e novos valores no catálogo de eventos de histórico (`InclusaoComentario`);
2. Duas operações de escrita dedicadas vinculadas à entidade `Tratativas`: `comentarTratativa(texto, mencoes)` para comunicação da Tratativa como um todo e `comentarAcao(acao, texto, mencoes)` para alinhamentos técnicos locais da Ação ou Subação;
3. Duas funções públicas estruturadas de listagem: `listarComentariosTratativa(tratativa, tamanhoPagina, pagina)` e `listarComentariosAcao(tratativa, acao, tamanhoPagina, pagina)`, retornando lista direta (`many ItemComentario`), ordenadas cronologicamente de forma crescente (desempate por UUID), paginadas conforme o padrão do intent 003 (`tamanhoPagina` validado antes de `pagina`);
4. Autorização dinâmica e menor privilégio sob LGPD: grant `authenticated-user` no `@restrict`, rejeição imediata de `AplicativoOrigem` no `before('*')`, e verificação de autorização no domínio (Gestor, Responsável Principal e Participantes na Tratativa; Gestor e Responsável na respectiva Ação/Subação). Terceiros recebem HTTP 403 na escrita e lista vazia `[]` com HTTP 200 nas listagens (etapa 6 da D10, avaliada antes dos parâmetros de paginação);
5. Exceção consciente e justificada à LGPD (Rulings R-01 e R-02 em `.estado/execucao/2026-10-08-comentarios/progress.md:11-12`): exibição de texto, data/hora e matrícula do autor para todos os participantes autorizados para viabilizar a colaboração mútua, enquanto a lista de menções (`mencoes`) vem estritamente `null` para quem não é `GestorTratativa`; orientação de governança de uso quanto a dados sensíveis com risco residual assumido no Gate 1;
6. Serialização pessimista por Tratativa via `bloquearTratativa(codigo)` antes de qualquer leitura ou escrita (decisão D9), garantindo consistência contra encerramentos simultâneos;
7. Auditoria imutável via evento `InclusaoComentario` em `HistoricoTratativa` e `HistoricoAcoes`, sem duplicação do texto do comentário no histórico (LGPD);
8. "Última atividade" da Tratativa (para apoio a alertas do intent 010) calculada estritamente como valor DERIVADO em tempo de leitura, sem persistência de novas colunas em `Tratativas`;
9. Preservação rigorosa de todos os contratos públicos existentes (002–006), mantendo intacto o tipo `DetalheTratativa` com 12 chaves e nenhuma alteração nos testes RED de chaves exatas.

---

## Decisões

1. **Modelo relacional persistido aditivo em `db/tratativa.cds`** (R1, R2, R3, R4, R10, R15; N3-1; Q1, Q2, Q3, Q4, Q10).
   - Novas entidades relacionais no namespace `br.com.calazanstec`:
     ```cds
     /** R1, R2 (spec comentarios): comunicação colaborativa vinculada à Tratativa ou Ação. */
     @PersonalData.EntitySemantics: 'Other'
     entity Comentarios {
       key codigo    : UUID;
           tratativa : Association to one Tratativas not null;
           acao      : Association to one Acoes;
           @PersonalData.IsPotentiallyPersonal
           texto     : String(2000) not null;
           @PersonalData.IsPotentiallyPersonal
           autor     : String(50) not null;
           criadoEm  : Timestamp not null;
           mencoes   : Composition of many MencoesComentario on mencoes.comentario = $self;
     }

     /** R2, R4 (spec comentarios): matrículas mencionadas no comentário. */
     @PersonalData.EntitySemantics: 'Other'
     entity MencoesComentario {
       key ID         : UUID;
           comentario : Association to one Comentarios not null;
           @PersonalData.IsPotentiallyPersonal
           matricula  : String(50) not null;
     }
     ```
   - Extensão dos tipos enumerados de eventos de histórico:
     * `EventoHistorico`: inclusão do valor `InclusaoComentario`.
     * `EventoHistoricoAcao`: inclusão do valor `InclusaoComentario`.
   - **Tamanho e semântica de autor:** `Comentarios.autor` utiliza `String(50)` em estrito alinhamento ao formato padrão de matrículas da plataforma (005 R3).
   - **Proteção contra acesso direto OData (R3, CA9, M5):**
     * A entidade `Comentarios` é projetada no serviço como `@readonly` com anotação `@restrict: [{ grant: ['READ'], to: 'GestorTratativa' }]`.
     * Requisições PUT, PATCH e DELETE recebem HTTP **405** (Method Not Allowed) nativo do CAP.
     * Tentativas de consulta direta via GET em `/Comentarios` ou navegação via `$expand` por usuários que não sejam `GestorTratativa` são recusadas com HTTP **403**, impedindo contorno da visibilidade da regra R7.
   — **Por quê:** modela comentários diretos de Tratativa (`acao == null`) e comentários locais de Ação/Subação (`acao != null`) na mesma estrutura relacional normalizada, viabiliza deduplicação e busca de menções em tabela indexada, e protege os dados contra operações de exclusão ou alteração.
   — **Verificado por:** compilação SQL limpa (`cds compile --to sql`); novo `CREATE TABLE` de `Comentarios` e `MencoesComentario`; `npm run build`.

2. **Superfície do `TratativaService`: duas actions bound e duas functions estruturadas** (R1, R7, R8, R15; D4, D6; N3-2; Q1, Q7, Q8).
   - Sintaxe CDS compilável em `srv/tratativa-service.cds`:
     ```cds
     // Declarado diretamente em srv/tratativa-service.cds (dentro do service TratativaService):

     type ItemComentario {
       codigo   : UUID;
       texto    : String(2000);
       autor    : String(50);
       criadoEm : Timestamp;
       mencoes  : many String;
     }

     type ResultadoComentario {
       codigo : UUID;
     }

     @readonly
     @restrict: [{ grant: ['READ'], to: 'GestorTratativa' }]
     entity Comentarios as projection on m.Comentarios;

     function listarComentariosTratativa(
       tratativa     : UUID,
       tamanhoPagina : Integer,
       pagina        : Integer
     ) returns many ItemComentario;

     function listarComentariosAcao(
       tratativa     : UUID,
       acao          : UUID,
       tamanhoPagina : Integer,
       pagina        : Integer
     ) returns many ItemComentario;

     // Na entidade Tratativas existente:
     // Os grants 'comentarTratativa' e 'comentarAcao' são somados diretamente ao elemento
     // { grant: [...], to: 'authenticated-user' } já existente no @restrict de Tratativas.
     // As actions são declaradas diretamente no bloco actions { ... } de Tratativas:
     // action comentarTratativa(texto : String, mencoes : many String) returns ResultadoComentario;
     // action comentarAcao(acao : UUID, texto : String, mencoes : many String) returns ResultadoComentario;
     ```
   - **Autorização declarativa e filtro de aplicativo:**
     * Os grants `'comentarTratativa'` e `'comentarAcao'` são somados diretamente ao elemento `{ grant: [...], to: 'authenticated-user' }` já existente no `@restrict` da entidade `Tratativas` em `srv/tratativa-service.cds`, permitindo que o handler avalie a autorização dinâmica no domínio (Passo 6).
     * O handler `before('*')` já existente em `srv/tratativa-service.ts` intercepta `AplicativoOrigem` e recusa com HTTP **403** `Aplicativo de origem não usa este serviço.` no início do handler (Passo 3), antes de checar forma ou existência (CA25, CA40, CA56).
   - **Preservação de contratos existentes:**
     * `consultarTratativa` permanece inalterado com exatamente 12 chaves (CA64, Ruling R-02 da spec 005). Nenhum campo novo é introduzido em `DetalheTratativa`, `ItemListagem`, `DetalheAcao`, `ItemEstruturaAcao` ou `DetalheResponsaveis`, resguardando testes RED de chaves exatas.
   — **Por quê:** cumpre a gramática CAP, viabiliza autorização fina no domínio e mantém a estabilidade de contratos anteriores.
   — **Verificado por:** compilação `cds compile srv --to csn` e asserções de `$metadata`.

3. **Autorização dinâmica, papéis corporativos e menor privilégio** (R5, R7; N3-2; Q5, Q7).
   - O domínio em `srv/tratativa/comentarios-inclusao.ts` e `comentarios-consulta.ts` avalia permissões no Passo 6 da D10:
     * **Em `comentarTratativa` (inclusão na Tratativa):**
       - É `GestorTratativa`? Permissão concedida.
       - É o `responsavelPrincipal` da Tratativa? Permissão concedida.
       - É um dos `participantes` da Tratativa (conforme `ParticipantesTratativa`)? Permissão concedida.
       - Terceiros, Responsáveis de Ação sem papel na Tratativa e demais usuários recebem HTTP **403** (CA20, CA24).
     * **Em `comentarAcao` (inclusão na Ação ou Subação):**
       - É `GestorTratativa`? Permissão concedida.
       - É o `responsavel` da respectiva Ação/Subação (`usuarioAutenticadoEhMatricula(req, acao.responsavel)`)? Permissão concedida.
       - Responsável Principal e Participantes da Tratativa (sem papel de Gestor ou executor daquela Ação) recebem HTTP **403** (CA21, CA22).
       - Responsável de outra Ação e terceiros recebem HTTP **403** (CA23, CA24).
     * **Nas listagens (`listarComentariosTratativa` e `listarComentariosAcao`):**
       - Usuários autorizados no respectivo nível recebem os comentários com HTTP 200.
       - Usuários desvinculados recebem lista vazia `[]` com HTTP 200 (não gerando erro 403, em estrito respeito ao menor privilégio sob LGPD; CA33, CA37).
       - Na Delegação (005 R8 / Ruling R-07), o vínculo é avaliado no instante da requisição: o antigo Responsável perde acesso à Ação (403 para comentar e `[]` para listar) e o novo Responsável assume o acesso total (CA65).
   — **Por quê:** garante que a colaboração seja focada e pertinente a cada contexto operacional sem vazamento de dados de ocorrências.
   — **Verificado por:** testes de matriz de permissões em `test/comentarios-tratativa.test.ts` e `test/comentarios-acao.test.ts` (CA15–CA25, CA33, CA37, CA65).

4. **Exceção consciente e justificada à LGPD (Rulings R-01 e R-02)** (R7, R15(d); LGPD; N3-3; Q7; I1, I2 do parecer 2).
   - **Escopo exato da exceção aprovada no Gate 1:**
     * Aplica-se estritamente à visualização de: **Texto do comentário**, **Data e hora da criação** e **Matrícula do autor** (`autor`).
     * Esses 3 campos são exibidos a todos os usuários autorizados a ler o respectivo comentário (Gestor, Responsável Principal e Participantes na Tratativa; Gestor e Responsável da Ação na Ação; CA31, CA32, CA34, CA35).
   - **Ocultação mandatória de Menções sob LGPD (005 R17):**
     * O campo `mencoes` é devolvido preenchido com a lista de matrículas **exclusivamente ao `GestorTratativa`** (CA31, CA34).
     * Para qualquer outro usuário autorizado (Responsável Principal, Participantes, Responsável da Ação), o campo `mencoes` retorna estritamente **`null`** (CA32, CA35, CA35a).
   - **Consequência declarada:** ao visualizar a autoria dos comentários, um Participante pode identificar quem são o Responsável Principal e os demais Participantes que comentaram na Tratativa (uma consequência consciente da colaboração corporativa).
   - **Mitigação e risco residual declarado:**
     * A mitigação adotada é uma **orientação de governança de uso** nos placeholders e documentação para que os usuários não insiram fotos de acidentes, laudos ocupacionais ou relatos sensíveis no texto dos comentários (devendo encaminhá-los como Evidências do intent 006 com leitura restrita).
     * A plataforma não realiza inspeção nem detecção técnica automática por regex sobre o texto (Q16).
     * Declara-se expressamente o **risco residual** de que qualquer dado sensível digitado no texto livre permanecerá legível a todos os autorizados de forma permanente pela imutabilidade (R3), risco este aceito no Gate 1 como premissa de negócio.
   — **Por quê:** viabiliza o diálogo e o reconhecimento das contribuições técnicas sem violar a reserva de visibilidade de menções a terceiros.
   — **Verificado por:** testes de visibilidade de menções e autoria em `test/comentarios-tratativa.test.ts` e `test/comentarios-acao.test.ts` (CA31, CA32, CA34, CA35, CA35a).

5. **Serialização por agregado (D9), estados alteráveis e imutabilidade absoluta** (R3, R6, R12; Decisão D9; Q3, Q6, Q12; M1 do parecer 2).
   - **Serialização por Tratativa (D9):**
     * As actions `comentarTratativa` e `comentarAcao` invocam `bloquearTratativa(codigoTratativa)` em `srv/tratativa/bloqueio.ts` (`SELECT ... FOR UPDATE` no banco de dados na transação do pedido) **antes de qualquer outra leitura ou escrita**.
     * Nenhuma avaliação de estado, existência de Ação ou validação de campos ocorre antes do bloqueio pessimista.
     * Concorrência com encerramento (CA52a, M1): duas requisições simultâneas terminam de forma serializada: ou o comentário é processado antes e o encerramento o vê, ou o encerramento ocorre antes e o comentário é recusado na etapa 7 com HTTP **409** `Tratativa Encerrada não pode ser alterada.`.
   - **Estados exigidos:**
     * `comentarTratativa`: exige Tratativa `Aberta` ou `Em andamento`. Se `Encerrada` ou `Cancelada`, recusa na etapa 7 com 409 `Tratativa <Status> não pode ser alterada.` (CA26, CA27, CA60).
     * `comentarAcao`: exige Tratativa `Aberta` ou `Em andamento` e Ação `Pendente` ou `Em andamento`. Se Ação `Concluída` ou `Cancelada`, recusa na etapa 8 com 409 `Ação <Status> não pode ser alterada.` (CA28, CA29, CA61).
     * Consultas de leitura permanecem livres mesmo após encerramento da Tratativa ou conclusão da Ação (CA38, CA53).
   - **Imutabilidade e sem DELETE (R3, CA9):**
     * Comentários nunca são editados ou apagados. Não há endpoints de alteração nem exclusão física ou lógica.
   — **Por quê:** cumpre rigorosamente a decisão arquitetural corporativa D9 e garante congelamento jurídico de ocorrências encerradas.
   — **Verificado por:** testes de concorrência e bloqueio em `test/comentarios-auditoria-concorrencia.test.ts` (CA26–CA30, CA51, CA52, CA52a, CA53).

6. **Validação de Texto, limites e tratamento estruturado de Menções** (R2, R4; LGPD; Q2, Q4; M2 do parecer 1).
   - **Validação de Texto (Passo 9):**
     * Executa `trim()` nas pontas antes de validar e persistir (CA6).
     * Vazio após trim: recusa com HTTP **400** `O campo Texto do comentário é obrigatório.`, `target: texto` (CA7).
     * Comprimento superior a 2.000 caracteres: recusa com HTTP **400** `O campo Texto do comentário aceita no máximo 2000 caracteres.`, `target: texto` (CA8).
     * Exatamente 2.000 caracteres: aceito com sucesso (CA5).
   - **Validação de Menções (Passo 9):**
     * Se o array `mencoes` for omitido ou vazio, grava sem menções.
     * Cada matrícula é validada com base na regra 005 R3 (`validarMatricula` em `srv/tratativa/validacao-matricula.ts`): 1 a 50 caracteres, sem espaços no meio, remove espaços nas pontas e sem `@` no valor. Formato inválido recusa com HTTP **400** `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, `target: mencoes` (CA11).
     * **Deduplicação case-insensitive (M2):** a lista é deduplicada sem diferenciar maiúsculas de minúsculas (`m1001` equivale a `M1001`), preservando a grafia da primeira ocorrência informada (CA13).
     * Limite: máximo de 10 menções distintas após deduplicação. Mais de 10 recusa com HTTP **400** `Limite de 10 menções por comentário atingido.`, `target: mencoes` (CA12).
   — **Por quê:** garante consistência com o validador de colaboradores da plataforma e protege a integridade dos metadados.
   — **Verificado por:** testes em `test/comentarios-tratativa.test.ts` (CA5–CA14).

7. **Ordenação, paginação padronizada e precedência de menor privilégio** (R8; Q8; M3, M4 do parecer 2).
   - **Ordenação (CA41, CA42):**
     * Retorno sempre em ordem cronológica crescente (`criadoEm ASC`).
     * Desempate determinístico: em caso de carimbos idênticos, desempata pela ordem alfabética ascendente do Código UUID (`codigo ASC`).
   - **Paginação simples (R8, I1 da 4ª rodada):**
     * Retorno direto em coleção simples `many ItemComentario` (sem envelope de metadados).
     * Parâmetros: `tamanhoPagina` (padrão 50, intervalo 1 a 200) e `pagina` (padrão 1, `>= 1`).
     * **Ordem de validação de paginação (Passo 9, M3):**
       - `tamanhoPagina` validado antes de `pagina` (alinhado a 003 R25).
       - `tamanhoPagina` fora de 1..200 -> HTTP **400** `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina` (CA44).
       - `pagina` < 1 -> HTTP **400** `O campo Página deve ser 1 ou maior.`, `target: pagina` (CA44a).
       - Se ambos inválidos: devolve 400 nomeando `tamanhoPagina` (CA44b).
   - **Precedência do menor privilégio sobre paginação (CA33a, M4):**
     * Se um usuário sem vínculo com a Tratativa ou Ação efetuar a consulta informando paginação inválida (ex.: `pagina = 0` ou `tamanhoPagina = -1`), a verificação de acesso no Passo 6 é acionada antes e devolve HTTP **200** com lista vazia `[]` imediatamente, sem acusar erro 400.
   — **Por quê:** elimina o risco de expor a existência de dados sensíveis ou contagens a terceiros e mantém uniformidade com o intent 003.
   — **Verificado por:** testes de paginação e privilégio em `test/comentarios-tratativa.test.ts` (CA33a, CA41–CA44b).

8. **Auditoria imutável via `InclusaoComentario` e proteção LGPD** (R10, R15(a); N3-3; Q10).
   - Cada comentário gravado gera uma linha de histórico imutável:
     * Comentário de Tratativa: inserido em `HistoricoTratativa` com evento `InclusaoComentario`, `campo: 'comentario'`, `valorNovo: codigoComentario`, `autor: req.user.id`, `tipoAutor: 'Usuario'`, `quando: criadoEm` (CA46).
     * Comentário de Ação: inserido em `HistoricoAcoes` com evento `InclusaoComentario`, `campo: 'comentario'`, `valorNovo: codigoComentario`, associado ao `acao_codigo` da Ação/Subação (CA47).
     * **Proteção LGPD:** o texto do comentário nunca é duplicado nem copiado na tabela de histórico de auditoria (R10).
     * Requisições recusadas não gravam histórico (CA48).
   — **Por quê:** garante rastreabilidade total de auditoria sem redundância e em estrito cumprimento da LGPD.
   — **Verificado por:** inspeção direta nas tabelas de histórico em `test/comentarios-auditoria-concorrencia.test.ts` (CA46, CA47, CA48, CA63).

9. **Atividade recente derivada para alertas do Intent 010 (sem coluna persistida)** (R9; Q9; M2 do parecer 2).
   - **Regra R9 e CA45:**
     * A postagem de comentário conta como atividade recente da ocorrência.
     * **Nenhuma coluna nova** (como `ultimaInteracao` ou `ultimaAtualizacao`) é criada na entidade `Tratativas` (preservando o esquema HDI sem migração de banco de dados no HANA Cloud; AGENTS.md:64).
     * O serviço de alertas do intent 010 calculará a data de última atividade em tempo de leitura derivando o valor máximo entre a tabela de histórico e a tabela de comentários:
       `ultimaAtividade = max(max(historico.quando), max(comentarios.criadoEm))`.
   — **Por quê:** evita dispersão de atualizações em múltiplos pontos da aplicação e elimina riscos de concorrência na entidade raiz.
   — **Verificado por:** conferência do esquema CDS e testes em `test/comentarios-auditoria-concorrencia.test.ts` (CA45).

10. **Precedência consolidada de 9 etapas e catálogo de erros HTTP** (R13; Decisão D10; Ruling R-03; Q13).
    - Ordem rigorosa das 9 etapas para inclusão e consulta de comentários:
      1. **Autenticação (401):** usuário anônimo -> 401 (CA54).
      2. **Forma no runtime (400):** JSON malformado, tipo inválido ou envio de campos desconhecidos fora da assinatura (ex.: campos de anexo ou arquivo) -> 400 do runtime antes do handler (CA49, CA55).
      3. **Aplicativo de origem (403):** interceptado no início do handler no `before('*')` -> 403 `Aplicativo de origem não usa este serviço.` antes de validar formato no domínio ou existência (CA25, CA40, CA56).
      4. **Forma dos parâmetros de identificador no domínio (400):** parâmetro `acao` ausente ou com formato malformado no payload de `comentarAcao` ou na function `listarComentariosAcao` -> 400 `Código inválido.`, `target: acao`; parâmetro `tratativa` malformado nas functions `listarComentariosTratativa` e `listarComentariosAcao` -> 400 `Código inválido.`, `target: tratativa` (CA4, CA67). Na bound action `comentarTratativa`, a Tratativa é identificada exclusivamente pela chave da entidade na URL; se a chave na URL estiver malformada ou não existir, responde 404 `Tratativa não encontrada.` (etapa 5 / D10).
      5. **Existência (404):** Tratativa inexistente (404 `Tratativa não encontrada.`, CA57); Ação inexistente ou de outra Tratativa (404 `Ação não encontrada.`, CA58, CA59). Nas consultas, recurso inexistente -> 404.
      6. **Autorização dinâmica de papel e menor privilégio:**
         - Em `comentarTratativa`: usuário não é Gestor, nem Responsável Principal, nem Participante da Tratativa -> 403 (CA20, CA24).
         - Em `comentarAcao`: usuário não é Gestor nem Responsável da respectiva Ação/Subação -> 403 (CA21, CA22, CA23, CA24).
         - Nas listagens (`listarComentarios*`): usuário sem vínculo correspondente -> retorna lista vazia `[]` com HTTP **200** (CA33, CA37, CA33a).
      7. **Estado da Tratativa (409):** Tratativa `Encerrada` ou `Cancelada` -> 409 `Tratativa <Status> não pode ser alterada.` (CA26, CA27, CA60).
      8. **Estado da Ação (409):** (em `comentarAcao`) Ação `Concluída` ou `Cancelada` -> 409 `Ação <Status> não pode ser alterada.` (CA28, CA29, CA61).
      9. **Campos e parâmetros no domínio (400):**
         - Texto vazio após trim -> 400 `O campo Texto do comentário é obrigatório.`, `target: texto` (CA7).
         - Texto > 2.000 caracteres -> 400 `O campo Texto do comentário aceita no máximo 2000 caracteres.`, `target: texto` (CA8).
         - Menção com matrícula inválida -> 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, `target: mencoes` (CA11).
         - Menções > 10 distintas -> 400 `Limite de 10 menções por comentário atingido.`, `target: mencoes` (CA12).
         - `tamanhoPagina` < 1 ou > 200 -> 400 `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina` (CA44).
         - `pagina` < 1 -> 400 `O campo Página deve ser 1 ou maior.`, `target: pagina` (CA44a).
   — **Por quê:** garante previsibilidade estrita de segurança, alinhamento absoluto à decisão D10 e isolamento contra vazamento de metadados.
   — **Verificado por:** testes de precedência cobrindo todas as etapas e combinações (CA4, CA7, CA8, CA11, CA12, CA20–CA29, CA33a, CA44–CA44b, CA49, CA54–CA61, CA67).

---

## Contrato executável

### 1. Modelo CDS (`db/tratativa.cds`)

```cds
namespace br.com.calazanstec;

// Extensão de tipos enumerados:
// Em EventoHistorico: acrescenta InclusaoComentario
// Em EventoHistoricoAcao: acrescenta InclusaoComentario

/** R1, R2 (spec comentarios): comunicação colaborativa vinculada à Tratativa ou Ação. */
@PersonalData.EntitySemantics: 'Other'
entity Comentarios {
  key codigo    : UUID;
      tratativa : Association to one Tratativas not null;
      acao      : Association to one Acoes;
      @PersonalData.IsPotentiallyPersonal
      texto     : String(2000) not null;
      @PersonalData.IsPotentiallyPersonal
      autor     : String(50) not null;
      criadoEm  : Timestamp not null;
      mencoes   : Composition of many MencoesComentario on mencoes.comentario = $self;
}

/** R2, R4 (spec comentarios): matrículas mencionadas no comentário. */
@PersonalData.EntitySemantics: 'Other'
entity MencoesComentario {
  key ID         : UUID;
      comentario : Association to one Comentarios not null;
      @PersonalData.IsPotentiallyPersonal
      matricula  : String(50) not null;
}
```

### 2. Serviço CDS (`srv/tratativa-service.cds`)

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

// Declarado diretamente no service TratativaService em srv/tratativa-service.cds:

type ItemComentario {
  codigo   : UUID;
  texto    : String(2000);
  autor    : String(50);
  criadoEm : Timestamp;
  mencoes  : many String;
}

type ResultadoComentario {
  codigo : UUID;
}

@readonly
@restrict: [{ grant: ['READ'], to: 'GestorTratativa' }]
entity Comentarios as projection on m.Comentarios;

function listarComentariosTratativa(
  tratativa     : UUID,
  tamanhoPagina : Integer,
  pagina        : Integer
) returns many ItemComentario;

function listarComentariosAcao(
  tratativa     : UUID,
  acao          : UUID,
  tamanhoPagina : Integer,
  pagina        : Integer
) returns many ItemComentario;

// Na entidade Tratativas existente:
// Os grants 'comentarTratativa' e 'comentarAcao' são somados diretamente ao elemento
// { grant: [...], to: 'authenticated-user' } já existente no @restrict de Tratativas.
// As actions são declaradas diretamente no bloco actions { ... } da entidade Tratativas:
//
// action comentarTratativa(
//   texto   : String,
//   mencoes : many String
// ) returns ResultadoComentario;
//
// action comentarAcao(
//   acao    : UUID,
//   texto   : String,
//   mencoes : many String
// ) returns ResultadoComentario;
```

### 3. Tabela Consolidada de Precedência e Erros HTTP

| Operação | Verificação | Quem / Etapa | HTTP | Mensagem de erro | Target |
|---|---|---|---|---|---|
| Todas | Autenticação | Runtime (1) | 401 | (Padrão CAP / Express) | - |
| Todas | Forma no runtime: JSON malformado / campos desconhecidos | Runtime (2) | 400 | (Padrão CAP) | - |
| Todas | Papel Aplicativo de Origem | Handler `before('*')` (3) | 403 | `Aplicativo de origem não usa este serviço.` | - |
| `comentarAcao` / `listarComentariosAcao` | Parâmetro `acao` ausente ou malformado no payload (action) ou query (function) | Domínio (4) | 400 | `Código inválido.` | `acao` |
| `listarComentariosTratativa` / `listarComentariosAcao` | Parâmetro `tratativa` ausente ou malformado na URL da function | Domínio (4) | 400 | `Código inválido.` | `tratativa` |
| `comentarTratativa` / `comentarAcao` | Chave da Tratativa na URL malformada ou inexistente | Runtime / Domínio (5) | 404 | `Tratativa não encontrada.` | - |
| `listarComentarios*` | Tratativa inexistente | Domínio (5) | 404 | `Tratativa não encontrada.` | - |
| `comentarAcao` / `listarComentariosAcao` | Ação inexistente ou pertencente a outra Tratativa | Domínio (5) | 404 | `Ação não encontrada.` | - |
| `comentarTratativa` | Usuário não é Gestor, Responsável Principal nem Participante | Domínio (6) | 403 | Forbidden | - |
| `comentarAcao` | Usuário não é Gestor nem Responsável da Ação | Domínio (6) | 403 | Forbidden | - |
| `listarComentarios*` | Usuário sem papel correspondente na Tratativa ou Ação | Domínio (6) | 200 | Devolve lista vazia `[]` | - |
| `comentar*` | Tratativa Encerrada ou Cancelada | Domínio (7) | 409 | `Tratativa <Status> não pode ser alterada.` | - |
| `comentarAcao` | Ação Concluída ou Cancelada | Domínio (8) | 409 | `Ação <Status> não pode ser alterada.` | - |
| `comentar*` | Texto do comentário vazio após trim | Domínio (9) | 400 | `O campo Texto do comentário é obrigatório.` | `texto` |
| `comentar*` | Texto do comentário > 2.000 caracteres | Domínio (9) | 400 | `O campo Texto do comentário aceita no máximo 2000 caracteres.` | `texto` |
| `comentar*` | Menção com formato de matrícula inválido | Domínio (9) | 400 | `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` | `mencoes` |
| `comentar*` | Mais de 10 menções distintas | Domínio (9) | 400 | `Limite de 10 menções por comentário atingido.` | `mencoes` |
| `listarComentarios*` | `tamanhoPagina` < 1 ou > 200 | Domínio (9) | 400 | `O campo Tamanho da página aceita de 1 a 200.` | `tamanhoPagina` |
| `listarComentarios*` | `pagina` < 1 | Domínio (9) | 400 | `O campo Página deve ser 1 ou maior.` | `pagina` |
| `mudarStatusAcao` (Concluída) | Comentários presentes não satisfazem Evidência obrigatória | Domínio (10) | 409 | `Ação com Evidência obrigatória não pode ser concluída sem Evidência.` | - |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-comentarios.md` | Entregar o intent 007 completo em 3 etapas sequenciais RED/GREEN: comentários na Tratativa (R1-R4, R7, R8, R13), comentários em Ações e Subações (R1, R5, R6, R7, R11, R13) e auditoria imutável, concorrência D9 e atividade recente derivada (R9, R10, R12, R14, R15). | `comentarios/001-comentarios` |

---

## Itens N3 (aprovação no Gate 1)

| # | Item | Gatilho | Decisão do humano |
|---|---|---|---|
| N3-1 | Criação das entidades `Comentarios` e `MencoesComentario` em `db/tratativa.cds`, e extensão dos enums de histórico com `InclusaoComentario`. | Alteração no modelo persistido (`db/*.cds`). | Delegado ao Orquestrador (D11); aprovado no Gate 1 |
| N3-2 | Concessão de autorização e roles CDS: grant `authenticated-user` nas actions com avaliação de papéis no domínio, e bloqueio de GET direto em `Comentarios` para não-Gestor. | Segurança e autorização (`@restrict`, papéis corporativos). | Delegado ao Orquestrador (D11); aprovado no Gate 1 |
| N3-3 | Exceção consciente às regras 005 R17 e 006 R11 sob LGPD: texto, data/hora e autor visíveis aos autorizados; lista de menções mascarada como `null` para não-Gestores; orientação de uso com risco residual declarado de permanência do texto; histórico gravado sem o texto do comentário. | Dados pessoais (LGPD). | Delegado ao Orquestrador (D11); aprovado no Gate 1 |
| N3-4 | Precedência consolidada de recusas em 9 etapas com devolução de lista vazia `[]` com HTTP 200 para usuários desvinculados na etapa 6 antes de parâmetros de paginação. | Contrato de erros e convenção corporativa D10. | Delegado ao Orquestrador (D11); aprovado no Gate 1 |

---

## Como isso se prova

- **CA1 (R1):** inclusão de comentário direto na Tratativa em Tratativa Aberta vincula à Tratativa com `acao` null. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA2 (R1):** inclusão de comentário na Ação vincula à Ação e à Tratativa. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA3 (R1):** inclusão de comentário na Subação vincula à Subação. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA4 (R1, R13):** bound action `comentarTratativa` com chave na URL malformada ou inexistente devolve 404 `Tratativa não encontrada.`; `comentarAcao` sem informar parâmetro `acao` no payload recusa na etapa 4 com 400 `Código inválido.`, `target: acao`. *Verificado por: testes nas Etapas 1 e 2.*
- **CA5 (R2):** comentário com exatamente 2.000 caracteres aceito com sucesso. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA6 (R2):** texto com espaços nas pontas gravado com trim. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA7 (R2):** texto vazio ou só espaços recusa com 400 `O campo Texto do comentário é obrigatório.`, `target: texto`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA8 (R2):** texto com 2.001 caracteres recusa com 400 `O campo Texto do comentário aceita no máximo 2000 caracteres.`, `target: texto`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA9 (R3):** PUT/PATCH/DELETE recusa com 405; GET direto ou expand na entidade de comentários por não-gestor recusa com 403. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA10 (R4):** menções válidas gravadas como metadado. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA11 (R4):** menção com formato de e-mail ou nome recusa com 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.`, `target: mencoes`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA12 (R4):** 11 menções distintas recusa com 400 `Limite de 10 menções por comentário atingido.`, `target: mencoes`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA13 (R4):** menções duplicadas case-insensitive deduplicadas mantendo a primeira grafia. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA14 (R4):** inclusão de comentários não dispara e-mails nem integrações externas. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA15 (R5):** Gestor comenta na Tratativa e em qualquer Ação. *Verificado por: testes nas Etapas 1 e 2.*
- **CA16 (R5):** Responsável Principal comenta na Tratativa com sucesso. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA17 (R5):** Participante comenta na Tratativa com sucesso. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA18 (R5):** Responsável da Ação comenta na sua própria Ação com sucesso. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA19 (R5):** Responsável da Subação comenta na sua Subação com sucesso. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA20 (R5):** Responsável de Ação tentando comentar na Tratativa recusa com 403. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA21 (R5):** Responsável Principal tentando comentar em Ação alheia recusa com 403. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA22 (R5):** Participante tentando comentar em Ação alheia recusa com 403. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA23 (R5):** Responsável de uma Ação tentando comentar em outra recusa com 403. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA24 (R5):** usuário comum sem papel recebe 403 para comentar na Tratativa ou Ação. *Verificado por: testes nas Etapas 1 e 2.*
- **CA25 (R5, R13):** Aplicativo de origem recebe 403 na etapa 3 no início do handler. *Verificado por: testes nas Etapas 1 e 2.*
- **CA26 (R6):** Tratativa Encerrada recusa comentário com 409 `Tratativa Encerrada não pode ser alterada.`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA27 (R6):** Tratativa Cancelada recusa comentário com 409 `Tratativa Cancelada não pode ser alterada.`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA28 (R6):** Ação Concluída recusa comentário com 409 `Ação Concluída não pode ser alterada.`. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA29 (R6):** Ação Cancelada recusa comentário com 409 `Ação Cancelada não pode ser alterada.`. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA30 (R6):** Ação Concluída reaberta aceita novos comentários. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA31 (R7):** Gestor consultando comentários da Tratativa recebe autor e mencoes preenchidas. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA32 (R7):** Responsável Principal e Participante consultando comentários da Tratativa recebem autor preenchido e mencoes como null sob LGPD. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA33 (R7):** Responsável de Ação e terceiros consultando comentários da Tratativa recebem lista vazia `[]` com HTTP 200. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA33a (R7, R13):** usuário sem vínculo com parâmetros de paginação inválidos recebe lista vazia `[]` com HTTP 200 (etapa 6 precede etapa 9). *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA34 (R7):** Gestor consultando comentários da Ação recebe autor e mencoes preenchidas. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA35 (R7):** Responsável da Ação consultando comentários da Ação recebe autor preenchido e mencoes como null sob LGPD. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA35a (R7):** qualquer não-Gestor recebe mencoes como null sob LGPD. *Verificado por: testes nas Etapas 1 e 2.*
- **CA36 (R7):** Responsável de Subação consulta comentários da Subação com sucesso; consultando Ação mãe recebe lista vazia `[]`. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA37 (R7):** Responsável Principal e Participantes consultando comentários de Ação recebem lista vazia `[]` com HTTP 200. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA38 (R7):** Tratativa Encerrada/Cancelada e Ação Concluída/Cancelada permitem leitura de comentários. *Verificado por: testes nas Etapas 1 e 2.*
- **CA39 (R7):** consulta de comentários não gera histórico nem logs. *Verificado por: testes nas Etapas 1 e 2.*
- **CA40 (R7):** Aplicativo de origem recebe 403 em consultas de comentários. *Verificado por: testes nas Etapas 1 e 2.*
- **CA41 (R8):** comentários ordenados em ordem cronológica crescente. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA42 (R8):** desempate cronológico por Código UUID. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA43 (R8):** paginação padrão com 50 itens devolvendo lista direta simples. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA44 (R8, R13):** tamanhoPagina fora de 1..200 recusa com 400 `O campo Tamanho da página aceita de 1 a 200.`, `target: tamanhoPagina`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA44a (R8, R13):** pagina < 1 recusa com 400 `O campo Página deve ser 1 ou maior.`, `target: pagina`. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA44b (R8, R13):** tamanhoPagina inválido e pagina inválida recusa tamanhoPagina na etapa 9. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA45 (R9):** comentário conta como atividade recente para alertas sem criação de novas colunas em Tratativas. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA46 (R10):** inclusão na Tratativa gera histórico imutável `InclusaoComentario` na origem `Tratativa` sem o texto. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA47 (R10):** inclusão na Ação gera histórico imutável `InclusaoComentario` na origem `Acao` sem o texto. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA48 (R10):** pedidos recusados não gravam histórico. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA49 (R11, R13):** payload com campos desconhecidos recusa com 400 do runtime na etapa 2. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA50 (R11):** comentários visíveis de forma uniforme entre os autorizados, sem comentários privados. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA51 (R12):** falha simulada dispara rollback total. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA52 (R12):** inclusões simultâneas serializadas via lock pessimista D9 na Tratativa. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA52a (R12):** inclusão simultânea com encerramento da Tratativa é serializada pela D9. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA53 (R12):** consultas de leitura não adquirem lock pessimista na Tratativa. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA54 (R13):** não autenticado recebe 401. *Verificado por: testes nas Etapas 1 e 2.*
- **CA55 (R13):** JSON malformado recusa com 400 do runtime na etapa 2. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA56 (R13):** Aplicativo de origem com código malformado recebe 403 na etapa 3. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA57 (R13):** Tratativa inexistente recusa com 404. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA58 (R13):** Ação inexistente recusa com 404. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA59 (R13):** Ação pertencente a outra Tratativa recusa com 404. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA60 (R13):** texto longo para Tratativa Encerrada recebe 409 (estado na etapa 7 precede campos na etapa 9). *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA61 (R13):** texto longo para Ação Concluída recebe 409 (estado na etapa 8 precede campos na etapa 9). *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA62 (R14):** genericidade de Origem. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA63 (R15):** evento `InclusaoComentario` registrado formalmente no catálogo de histórico. *Verificado por: teste em `test/comentarios-auditoria-concorrencia.test.ts` (Etapa 3).*
- **CA64 (R15):** `consultarTratativa` mantém estritamente 12 chaves. *Verificado por: teste em `test/comentarios-tratativa.test.ts` (Etapa 1).*
- **CA65 (R5, R7):** Delegação transfere acesso de postar e listar do antigo para o novo Responsável. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA66 (R11):** Ação com evidência obrigatória não conclui apenas com comentários. *Verificado por: teste em `test/comentarios-acao.test.ts` (Etapa 2).*
- **CA67 (R13):** parâmetro `acao` malformado no payload de `comentarAcao` ou parâmetro `tratativa` malformado nas functions de consulta recusa com 400 `Código inválido.` nomeando o respectivo parâmetro (etapa 4); chave da Tratativa malformada na URL de `comentarTratativa` devolve 404 `Tratativa não encontrada.`. *Verificado por: testes nas Etapas 1 e 2.*

---

## O que não muda

- Os contratos públicos e tipos de retorno existentes de 002 a 006 permanecem 100% inalterados (`DetalheTratativa` com 12 chaves, `ItemListagem`, `DetalheAcao`, `ItemEstruturaAcao`, `DetalheResponsaveis`, `ItemMinhasAcoes`, `DetalheEvidencia`).
- Comentários contêm estritamente texto e menções estruturadas: não suportam anexos nem upload de arquivos (arquivos pertencem exclusivamente à spec 006 de Evidências).
- Comentários não satisfazem a pré-condição de Evidência obrigatória para conclusão de Ações (004 R14, 006 R8).
- A entidade `Tratativas` não ganha nenhuma coluna física nova para controle de atividade recente.
- Não há comentários privados nem regras departamentais hardcoded (AGENTS.md:36).
- Os testes automatizados rodam isolados com SQLite em memória (`cds.test`), sem dependências externas.

---

## O desconfortável, declarado

- **Exceção à privacidade de autoria (LGPD) e risco residual de texto:** para possibilitar a comunicação corporativa entre os membros que atuam na ocorrência, a matrícula do autor, o texto e a data/hora dos comentários são expostos a todos os autorizados daquele nível (Gestor, Responsável Principal, Participantes e Responsáveis de Ação). Como consequência consciente, ao ver o autor, um Participante descobre quem são o Responsável Principal e os demais Participantes. Como a plataforma não inspeciona o texto livre por regex, eventual dado sensível digitado no corpo do comentário ficará acessível de forma imutável a todos os autorizados, constituindo risco residual aceito formalmente no Gate 1.
- **Imutabilidade estrita sem correção ou expurgo no MVP:** não é permitida edição ou exclusão de comentários. Caso uma informação incorreta seja publicada, uma retificação formal deve ser postada em novo comentário subsequente. Regras corporativas de expurgo ou retenção legal (LGPD) ficam encaminhadas para decisão humana antes da produção (intent 014).

**Registro do Gate 1 (2026-10-09):** decisões e itens N3 aprovados pelo orquestrador, por delegação do humano (D11), inclusive a exceção LGPD declarada na spec (texto, data/hora e autor visíveis a quem lê). Rulings em `agentic/.estado/execucao/2026-10-08-comentarios/progress.md`. Branch empilhada sobre `evidencias/001-evidencias`.
