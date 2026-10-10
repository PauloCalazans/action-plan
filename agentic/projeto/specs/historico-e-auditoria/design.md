# Design: historico-e-auditoria

**Spec:** agentic/projeto/specs/historico-e-auditoria/spec.md  
**Status:** aprovado

Escopo técnico: consolidação e consulta unificada, em modo estritamente somente-leitura (read-only), da trilha de auditoria e do histórico de ocorrências e planos de ação no `TratativaService` (`/api/tratativa/v1`), compreendendo:
1. Operação pública de leitura dedicada `consultarHistoricoTratativa(tratativa, tipoEvento, codigoAcao, periodoInicio, periodoFim, tamanhoPagina, pagina)` retornando coleção direta (`many ItemHistorico`), sem envelopamento (`totalRegistros` e `temMais` não existem), preservando integralmente o contrato público de `consultarTratativa` e o tipo `DetalheTratativa` com 12 chaves e sem coleções (Ruling R-02);
2. Catálogo canônico unificado consolidando eventos auditáveis gerados por todas as entidades e origens do sistema (Tratativa, Ação, Responsáveis, Evidência e Comentário) com seus identificadores e nomes de origem preservados intactos, sem renomeações nem migrações de dados legados;
3. Ordenação estritamente cronológica crescente por instante do evento (`quando` / `dataHora`) com desempate determinístico multidimensional baseado em dados já persistidos (`quando` ASC, `origem` ASC, `tipoEvento` ASC, `id` ASC), sem nenhuma coluna nova no banco de dados e sem impacto de migração HDI no HANA Cloud (Ruling R-02, B2);
4. Paginação por parâmetros `pagina` (padrão 1, base 1) e `tamanhoPagina` (padrão 50, intervalo 1 a 200) com deslocamento via `limit(tamanhoPagina, (pagina - 1) * tamanhoPagina)` no padrão consolidado do intent 003;
5. Filtros combináveis por `tipoEvento` (validado contra o catálogo canônico de nomes originais), `codigoAcao` (com validação de existência e pertinência à Tratativa), `periodoInicio` e `periodoFim` (formato ISO 8601 com verificação de precedência temporal);
6. Autorização dinâmica por menor privilégio e proteção de dados pessoais (LGPD): `GestorTratativa` possui visão integral irrestrita; `Responsável Principal` e `Participantes` acessam exclusivamente eventos diretos da Tratativa; `Responsável da Ação` acessa exclusivamente eventos de sua própria Ação (com segregação estrita entre Ação mãe e Subações); acúmulo de papéis recebe a união de eventos; avaliação de vínculo no instante da consulta (efeito imediato na Delegação de Ação); e terceiros sem vínculo recebem lista vazia `[]` com HTTP 200;
7. Mascaramento LGPD estrito para não-Gestores: campos de autoria (`autor: null`), justificativas em texto livre (`justificativa: null`) e valores anterior e novo (`valorAnterior: null`, `valorNovo: null`) de campos contendo matrículas de colaboradores (`Solicitante`, `Responsável Principal`, `Participante` e `Responsável`) são entregues como `null`;
8. Imutabilidade absoluta: histórico estritamente append-only, sem suporte a rotas PUT, PATCH ou DELETE, e sem regravação silenciosa;
9. Precedência fixa de recusas em 7 etapas com códigos HTTP padronizados conforme a decisão D10, garantindo que existência (etapa 5) precede filtros semânticos (etapa 6), e validação de filtros precede autorização dinâmica por menor privilégio (etapa 7).

---

## Decisões

1. **Modelo de persistência: zero alteração no esquema de banco e desempate puramente determinístico** (R1, R6, R14; N3-5; Q1, Q6; B2, Parecer 2).
   - Nenhuma nova coluna, tabela ou entidade persistida é adicionada ao modelo `db/tratativa.cds`. As tabelas existentes `HistoricoTratativa` e `HistoricoAcoes` (e suas extensões de 004, 005, 006 e 007) são reutilizadas de forma estritamente somente-leitura.
   - **Desempate determinístico (B2):** em caso de múltiplos eventos registrados com o mesmo carimbo de data/hora (`quando`), a ordenação de desempate aplica a seguinte sequência fixa e imutável baseada exclusivamente em dados já persistidos:
     1. `dataHora` (`quando`) ASC (ordem cronológica crescente);
     2. `origem` ASC (ordem alfabética: `'Acao'`, `'Comentario'`, `'Evidencia'`, `'Responsaveis'`, `'Tratativa'`);
     3. `tipoEvento` ASC (ordem alfabética pelo nome canônico do evento);
     4. `id` ASC (identificador primário UUID em ordem lexicográfica crescente).
   - **Limite do modelo explicitado:** eventos distintos gerados na mesma transação ou no mesmo milissegundo podem não ser ordenados na ordem física de tempo de CPU da máquina, mas possuem ordenação 100% reproduzível e estável em qualquer banco de dados (SQLite ou HANA Cloud).
   — **Por quê:** adicionar colunas de sequência transacional às tabelas já integradas (`HistoricoTratativa`, `HistoricoAcoes`) violaria a compatibilidade do esquema HDI no HANA Cloud e forçaria migrações retroativas perigosas. A ordenação por quatro critérios existentes garante determinação matemática sem tocar em DDL.
   — **Verificado por:** `cds compile --to sql` sem novos comandos DDL; testes de ordenação determinística e empates em instantes idênticos (CA18, CA19).

2. **Estratégia de consulta: agregação e normalização no domínio vs View CDS com UNION** (R1, R4, R6, R14; Q1, Q4, Q6).
   - Adotada a **agregação e normalização no domínio TypeScript** (`srv/tratativa/historico-consulta.ts`), realizando leituras paralelas estruturadas em `HistoricoTratativa` e `HistoricoAcoes` filtradas pela Tratativa (`tratativa_codigo`), unificando e mapeando os registros em memória.
   - **Análise comparativa:**
     * *View CDS com UNION ALL (Descartada):* exigiria unificar esquemas divergentes (`HistoricoAcoes` possui `evidencia`, `mimeType`, `tamanho` introduzidos no 006, enquanto `HistoricoTratativa` não possui; `HistoricoAcoes` possui `acao_codigo` e `HistoricoTratativa` não possui). No SQLite e no HANA, projeções de `UNION ALL` com colunas nulas tipadas e expressões `CASE WHEN` para derivar `origem` aumentam a complexidade de compilação, dificultam a montagem do tipo complexo `detalhe` e não eliminam a necessidade de mascaramento condicional LGPD no runtime Node.js.
     * *Agregação no Domínio (Adotada):* Tratativas são entidades delimitadas; o volume de histórico por Tratativa típica é de dezenas a poucas centenas de registros. A consulta direta com índices por chave estrangeira (`tratativa_codigo`) executa em tempo sub-milissegundo no SQLite e no HANA. O mapeamento em memória provê controle absoluto sobre o mascaramento dinâmico LGPD, paginação exata via slice, e montagem imutável do objeto `detalhe`.
   — **Por quê:** garante portabilidade perfeita entre SQLite (`cds.test`) e SAP HANA Cloud sem divergências de SQL DDL, viabiliza o mascaramento estrito por campo exigido pela LGPD e isola o contrato de auditoria.
   — **Verificado por:** testes de integração com múltiplos eventos de todas as origens (CA1, CA54, CA55) e verificação de consultas limpas via `cds.db.run`.

3. **Superfície do `TratativaService`: function dedicada sem envelopamento** (R1, R4, R6, R14; D4, D6; N3-1; Q1, Q4, Q6; B1, Parecer 2).
   - Assinatura no CDS em `srv/tratativa-service.cds`:
     ```cds
     function consultarHistoricoTratativa(
       tratativa     : UUID,
       tipoEvento    : String,
       codigoAcao    : UUID,
       periodoInicio : String,
       periodoFim    : String,
       tamanhoPagina : Integer,
       pagina        : Integer
     ) returns many ItemHistorico;
     ```
   - **Formato uniforme de resposta (B1):** a função retorna diretamente uma coleção de itens (`returns many ItemHistorico`), exatamente no mesmo padrão de `listarTratativas` do 003 e `minhasAcoes` do 005. Não existem propriedades estruturadas de envelopamento (`totalRegistros` e `temMais`).
   - Usuários sem vínculo com a Tratativa recebem lista vazia `[]` com HTTP 200 (em perfeita consonância com o retorno `many`).
   - **Preservação de contratos anteriores (Ruling R-02):** `consultarTratativa` e o tipo `DetalheTratativa` do intent 003 permanecem 100% inalterados com suas 12 chaves originais.
   — **Por quê:** a plataforma adota o retorno direto `many` para listagens OData V4 em CAP. Envelopes ad-hoc criariam inconsistência estrutural e exigiriam cálculo de contagem de registros que poderia vazar informações a usuários não autorizados sob LGPD.
   — **Verificado por:** compilação do CDS (`npm run build`); testes de conferência de chaves exatas no retorno e estabilidade de testes legados (CA8, CA20).

4. **Catálogo canônico e preservação dos nomes de origem** (R2, R10, R14; Q2, Q10; I1, Parecer 1).
   - Mapeamento estrito sem renomeação nem modificação de dados gravados:
     * **Origem `Tratativa`:** eventos `Criacao`, `AlteracaoCriticidade`, `MudancaStatus`, `Encerramento`, `Reabertura`, `Cancelamento`, `Edicao` gravados em `HistoricoTratativa`.
     * **Origem `Acao`:** eventos `Criacao`, `MudancaStatus`, `Conclusao`, `Reabertura`, `Cancelamento`, `Edicao` gravados em `HistoricoAcoes`.
     * **Origem `Responsaveis`:** eventos `AtribuicaoResponsavelPrincipal`, `ReatribuicaoResponsavelPrincipal`, `InclusaoParticipante`, `RemocaoParticipante` (gravados em `HistoricoTratativa`) e `DelegacaoAcao` (gravado em `HistoricoAcoes`). *Nota técnica de normalização:* registros persistidos pelas specs anteriores como `Atribuicao` ou `Reatribuicao` são mapeados canonicamente para `AtribuicaoResponsavelPrincipal` e `ReatribuicaoResponsavelPrincipal`; `Delegacao` é mapeado canonicamente para `DelegacaoAcao`.
     * **Origem `Evidencia`:** eventos `InclusaoEvidencia`, `RemocaoEvidencia`, `DownloadEvidencia` gravados em `HistoricoAcoes`.
     * **Origem `Comentario`:** evento `InclusaoComentario` gravado em `HistoricoTratativa` (comentário de Tratativa) ou em `HistoricoAcoes` (comentário de Ação/Subação).
   - `Encerramento`, `Conclusao`, `Reabertura` e `Cancelamento` são eventos próprios e distintos de `MudancaStatus`.
   - O campo `codigoAcao` é retornado como `null` para eventos de nível de Tratativa e preenchido com o UUID da Ação/Subação para eventos vinculados a Ações.
   — **Por quê:** cumpre a exigência de que o histórico unificado não reescreve nem invalida a base de dados existente, permitindo filtragem precisa pelo nome canônico original do evento.
   — **Verificado por:** testes de consulta filtrando por tipos específicos de evento e conferência de `origem` e `codigoAcao` (CA2, CA3, CA4, CA23, CA24, CA25).

5. **Autorização dinâmica, segregação de menor privilégio e mascaramento LGPD** (R5, R8, R9; N3-2, N3-3; Q5, Q8, Q9; I2, I5, Parecer 1; m2, m3, Parecer 2).
   - **Regras de Visibilidade (R5):**
     * `GestorTratativa`: visibilidade total sobre todos os eventos da Tratativa e de todas as Ações e Subações. Campos `autor`, `justificativa` e matrículas em detalhes são entregues integralmente.
     * `Responsável Principal` e `Participantes` da Tratativa: acessam exclusivamente os eventos diretos da Tratativa (`codigoAcao === null`). Não visualizam eventos de Ações (exceção consciente à 005 R17 e 007 R7).
     * `Responsável da Ação`: acessa exclusivamente os eventos de sua respectiva Ação.
     * *Segregação hierárquica (m2, CA12, CA12a):* o Responsável da Ação mãe NÃO visualiza eventos das Subações filhas; o Responsável de uma Subação NÃO visualiza eventos da Ação mãe nem de Subações irmãs.
     * *Acúmulo de papéis (I5, CA13):* se o usuário acumular papéis (ex.: Participante da Tratativa e Responsável pela Ação 1), ele recebe a **união** dos eventos autorizados por seus vínculos.
     * *Avaliação dinâmica e Delegação (I5, CA14):* o vínculo é avaliado em tempo de execução com base no estado atual da base de dados. Após uma `DelegacaoAcao`, o antigo responsável perde imediatamente o acesso aos eventos da Ação; o novo responsável delegado passa a acessá-los.
     * *Usuário sem vínculo (CA15):* recebe HTTP 200 com lista vazia `[]`.
     * *Aplicativo de Origem (CA16):* recebe HTTP 403 (rejeitado pelo handler `before('*')` já existente em `TratativaService` com a mensagem literal `Aplicativo de origem não usa este serviço.`) no início do handler.
   - **Mascaramento LGPD para não-Gestores (I2, R5c, R8e):**
     * `autor`: entregue como `null`;
     * `justificativa`: entregue como `null` (texto livre potencialmente pessoal);
     * No objeto `detalhe`: se o campo alterado referenciar matrícula de colaboradores (`Solicitante`, `Responsável Principal`, `Participante`, `Responsável`), os campos `valorAnterior` e `valorNovo` são entregues como `null`.
     * O histórico nunca armazena o texto de Descrições (003 R15, 004 R23), nomes de arquivos/binários de Evidência (006 R12) ou textos de Comentários (007 R10).
   — **Por quê:** garante conformidade rigorosa com o princípio de necessidade e minimização de dados da LGPD (Art. 6º da Lei 13.709/2018), impedindo vazamento de dados disciplinares, relatos médicos ou identidades funcionais a colaboradores não autorizados.
   — **Verificado por:** testes de acesso por Gestor, Responsável Principal, Participante, Responsável de Ação e terceiros, com validação de campos mascarados como `null` (CA9, CA10, CA11, CA12, CA12a, CA13, CA14, CA15, CA36, CA41).

6. **Precedência consolidada de recusas e validação de parâmetros (Decisão D10)** (R6, R7, R12; N3-4; Q6, Q7, Q12; I4, Parecer 1).
   - Ordem estrita de validação em 7 etapas:
     1. **Autenticação:** usuário não autenticado → HTTP 401 do runtime CAP;
     2. **Forma do pedido no runtime:** parâmetros com tipos primitivos incompatíveis ou JSON malformado → HTTP 400 do framework CAP antes do handler;
     3. **Aplicativo de origem:** identidade técnica com role `AplicativoOrigem` → HTTP 403 no início do handler no `before('*')` (`Aplicativo de origem não usa este serviço.`) antes de qualquer consulta ao banco (Ruling R-03);
     4. **Forma dos parâmetros de identificador no domínio:**
        - Parâmetro obrigatório `tratativa` ausente, vazio ou não-UUID → HTTP 400 `Código inválido.` (`target: tratativa`);
        - Parâmetro opcional `codigoAcao` com formato inválido (não-UUID) → HTTP 400 `Código de ação inválido.` (`target: codigoAcao`);
     5. **Existência da entidade no domínio:**
        - Tratativa inexistente no banco de dados → HTTP 404 `Tratativa não encontrada.` (`target: tratativa`);
        - Ação informada em `codigoAcao` inexistente no banco ou não pertencente à Tratativa → HTTP 404 `Ação não encontrada.` (`target: codigoAcao`);
     6. **Validação semântica de filtros e paginação no domínio:**
        - `tipoEvento` presente mas fora do catálogo de nomes canônicos de R2 → HTTP 400 `Tipo de evento inválido.` (`target: tipoEvento`);
        - `periodoInicio` presente mas inválido (não parseável para data ISO 8601 válida) → HTTP 400 `Data inválida.` (`target: periodoInicio`);
        - `periodoFim` presente mas inválido → HTTP 400 `Data inválida.` (`target: periodoFim`);
        - `periodoInicio` e `periodoFim` válidos mas `periodoInicio > periodoFim` → HTTP 400 `Período inválido: a data inicial não pode ser posterior à data final.` (`target: periodoInicio`);
        - `tamanhoPagina` presente mas fora de 1..200 (<= 0 ou > 200) → HTTP 400 `O campo Tamanho da página aceita de 1 a 200.` (`target: tamanhoPagina`);
        - `pagina` presente mas <= 0 → HTTP 400 `O campo Página deve ser 1 ou maior.` (`target: pagina`);
     7. **Vínculo e autorização na leitura:**
        - Se o usuário não possui vínculo com a Tratativa (nem é Gestor, nem Principal, nem Participante, nem Responsável de Ação), a requisição é respondida com **HTTP 200** e uma lista vazia `[]` (menor privilégio sob LGPD, sem acusar 403).
        - Se o usuário possui vínculo, a lista de eventos é filtrada para entregar exclusivamente os eventos autorizados para seus papéis, aplicando o mascaramento LGPD sobre os registros devolvidos.
   — **Por quê:** consolida a hierarquia de checagens da decisão D10, provê mensagens consistentes e previsíveis para a interface e assegura que erros semânticos (400) sejam reportados antes de mascarar a resposta por menor privilégio.
   — **Verificado por:** testes de precedência cobrindo todas as 7 etapas e mensagens de erro literais com targets padronizados (CA7, CA16, CA21, CA22, CA22a, CA26, CA28, CA29, CA30, CA32, CA33, CA34, CA47, CA48, CA49, CA50, CA51, CA52, CA53).

7. **Imutabilidade absoluta, auditoria sem RAL e persistência append-only** (R3, R11; AGENTS.md:40; N3-6; Q3, Q11; Q15).
   - O histórico da plataforma é estritamente **append-only**:
     * Não existem operações OData de inserção direta, alteração ou exclusão sobre o histórico (tentativas de PUT, PATCH ou DELETE recebem HTTP 405 Method Not Allowed ou 404);
     * Eventos de reabertura (de Tratativa ou de Ação) adicionam um novo evento `Reabertura` mantendo intactos os eventos anteriores de `Encerramento` ou `Conclusao` (CA43, CA44, CA45);
     * Requisições de negócio rejeitadas ou com erro transacional não gravam registros de histórico (CA6).
   - **Auditoria de leitura (RAL) no MVP (N3-6):**
     * Em alinhamento às decisões tomadas nos intents 003, 005 e 007, a leitura e consulta de histórico não gera novos logs ou registros de histórico no banco de dados. Políticas formais de retenção temporal definitiva e auditoria de consultas (Read Access Logging) ficam encaminhadas para decisão do humano antes da implantação em produção (intent 014).
   — **Por quê:** garante conformidade probatória em auditorias periciais, previne sobrecarga do banco de dados e respeita o escopo transacional do MVP.
   — **Verificado por:** testes de recusa de métodos de escrita sobre histórico (CA5) e verificação de invariância da base após consultas (CA17).

---

## Contrato executável

### CDS do `TratativaService` (`srv/tratativa-service.cds`)

```cds
// Declarado diretamente dentro de service TratativaService em srv/tratativa-service.cds:

/** R1, R8 (spec historico-e-auditoria): detalhe estruturado do evento de histórico. */
type DetalheEventoHistorico {
  campo         : String(50);
  valorAnterior : String(200);
  valorNovo     : String(200);
  justificativa : String(500);
  evidencia     : UUID;
  mimeType      : String(100);
  tamanho       : Integer;
}

/** R1, R2, R6 (spec historico-e-auditoria): item unificado da trilha de auditoria. */
type ItemHistorico {
  id              : UUID;
  codigoTratativa : UUID;
  codigoAcao      : UUID;
  origem          : String(20);
  tipoEvento      : String(50);
  detalhe         : DetalheEventoHistorico;
  dataHora        : Timestamp;
  autor           : String(256);
  tipoAutor       : m.TipoAutor;
}

/** R1, R4, R6, R7, R12 (spec historico-e-auditoria): consulta unificada de histórico da Tratativa. */
function consultarHistoricoTratativa(
  tratativa     : UUID,
  tipoEvento    : String,
  codigoAcao    : UUID,
  periodoInicio : String,
  periodoFim    : String,
  tamanhoPagina : Integer,
  pagina        : Integer
) returns many ItemHistorico;
```

### Contrato de Erros e Precedência (D10)

| Etapa | Verificação | Quem valida | Código HTTP | Mensagem de erro | Target |
|---|---|---|---|---|---|
| 1 | Autenticação | Runtime CAP | 401 | - | - |
| 2 | Forma do pedido no runtime | Runtime CAP | 400 | Mensagem do framework | - |
| 3 | Aplicativo de origem | Handler (`before('*')`) | 403 | `Aplicativo de origem não usa este serviço.` | - |
| 4 | Identificador `tratativa` ausente/inválido | Domínio | 400 | `Código inválido.` | `tratativa` |
| 4 | Identificador `codigoAcao` formato inválido | Domínio | 400 | `Código de ação inválido.` | `codigoAcao` |
| 5 | Existência da Tratativa | Domínio | 404 | `Tratativa não encontrada.` | `tratativa` |
| 5 | Existência da Ação ou pertinência à Tratativa | Domínio | 404 | `Ação não encontrada.` | `codigoAcao` |
| 6 | `tipoEvento` fora do catálogo canônico | Domínio | 400 | `Tipo de evento inválido.` | `tipoEvento` |
| 6 | `periodoInicio` com data malformada | Domínio | 400 | `Data inválida.` | `periodoInicio` |
| 6 | `periodoFim` com data malformada | Domínio | 400 | `Data inválida.` | `periodoFim` |
| 6 | `periodoInicio` posterior a `periodoFim` | Domínio | 400 | `Período inválido: a data inicial não pode ser posterior à data final.` | `periodoInicio` |
| 6 | `tamanhoPagina < 1` ou `tamanhoPagina > 200` | Domínio | 400 | `O campo Tamanho da página aceita de 1 a 200.` | `tamanhoPagina` |
| 6 | `pagina < 1` | Domínio | 400 | `O campo Página deve ser 1 ou maior.` | `pagina` |
| 7 | Vínculo e autorização na leitura | Domínio | 200 | Lista de itens autorizados (ou `[]` para desvinculados) | - |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-historico-e-auditoria.md` | Entregar o intent 008 completo em 4 etapas sequenciais RED/GREEN: consulta unificada e ordenação (R1, R2, R4, R6, R7, R14); filtros avançados e paginação (R6, R7, R10); autorização dinâmica e mascaramento LGPD (R5, R8, R9); precedência consolidada D10, imutabilidade e integridade (R3, R11, R12, R13). | `historico-e-auditoria/001-historico-e-auditoria` |

---

## Itens N3 (aprovação no Gate 1)

| Item | Origem | Impacto | Justificativa e Mitigação |
|---|---|---|---|
| N3-1 | R4, R6 | Superfície pública do `TratativaService` com function `consultarHistoricoTratativa` retornando lista direta `many ItemHistorico`. | Padroniza a leitura de listas no CAP sem envelopamento (`totalRegistros`/`temMais`), preservando o contrato de 12 chaves de `consultarTratativa` de 003 (Ruling R-02). |
| N3-2 | R5 | Autorização dinâmica de leitura por menor privilégio no domínio (Gestor, Responsável Principal, Participantes, Responsável de Ação). | Exceção consciente às regras de não ampliação para permitir que Responsável Principal e Participantes acompanhem o histórico direto da Tratativa com mascaramento LGPD, e desvinculados recebam `[]` com HTTP 200. |
| N3-3 | R5c, R8e | Mascaramento obrigatório LGPD de `autor: null`, `justificativa: null` e matrículas em detalhes como `null` para não-Gestores. | Assegura proteção estrita de dados pessoais e relatos sensíveis sob a LGPD (Lei 13.709/2018). |
| N3-4 | R12 | Precedência consolidada de recusas em 7 etapas baseada na decisão D10. | Fixa precedência onde existência (404) precede filtros semânticos (400), e filtros semânticos precedem retorno de dados por vínculo (200 / `[]`). |
| N3-5 | R6 | Desempate determinístico multidimensional por dados já persistidos (`quando`, `origem`, `tipoEvento`, `id`) sem novas colunas no banco. | Evita migrações de DDL e riscos no HDI do HANA Cloud (B2), aceitando o limite de que eventos simultâneos podem não refletir ordem de tempo físico exata. |
| N3-6 | R3, R5d | Histórico permanente append-only no MVP sem registro de logs de acesso na leitura. | Encaminha definição final de prazos normativos de guarda, retenção e eventual auditoria de leitura (RAL) para decisão humana antes da produção (intent 014). |

---

## Como isso se prova

Mapeamento completo dos 58 Critérios de Aceite (CA1 a CA55, incluindo CA12a, CA22a e CA27a) nas 4 etapas de implementação da task:

- **Etapa 1 (Consulta unificada, catálogo de origens e ordenação determinística):**
  - CA1: Gestor recebe lista integrada de eventos em ordem cronológica com HTTP 200.
  - CA2: Cada item retornado contém obrigatoriamente `id`, `codigoTratativa`, `codigoAcao`, `origem`, `tipoEvento`, `detalhe`, `dataHora`, `autor`, `tipoAutor`.
  - CA3: Eventos diretos de Tratativa, Responsáveis e Comentário da Tratativa trazem `codigoAcao: null`.
  - CA4: Eventos de Ação, Delegação, Evidência e Comentário de Ação trazem `codigoAcao` preenchido.
  - CA7: Consulta com Tratativa inexistente resulta em 404 `Tratativa não encontrada.`.
  - CA8: `consultarTratativa` de 003 permanece inalterado com exatamente 12 chaves.
  - CA17: Consulta de histórico é idempotente e não grava novos registros de histórico.
  - CA18: Múltiplos eventos são retornados em ordem cronológica crescente de `dataHora`.
  - CA19: Eventos com mesmo `dataHora` desempatam por `quando`, `origem`, `tipoEvento`, `id`.
  - CA20: Paginação padrão devolve fatia de 50 itens sem envelope; página 2 devolve os itens seguintes.
  - CA54: Comportamento idêntico para qualquer Origem ("Registro de Acidente", "Auditoria de Qualidade", avulsa).
  - CA55: Consulta do Gestor unifica eventos de todas as origens presentes na mesma Tratativa.

- **Etapa 2 (Filtros avançados e validações de paginação):**
  - CA21: `tamanhoPagina = 201` recusa com 400 `O campo Tamanho da página aceita de 1 a 200.` (`target: tamanhoPagina`).
  - CA22: `tamanhoPagina <= 0` recusa com 400 `O campo Tamanho da página aceita de 1 a 200.` (`target: tamanhoPagina`).
  - CA22a: `pagina <= 0` recusa com 400 `O campo Página deve ser 1 ou maior.` (`target: pagina`).
  - CA23: Filtro `tipoEvento = 'MudancaStatus'` isola apenas eventos desse tipo.
  - CA24: Filtro `tipoEvento = 'Encerramento'` isola eventos de encerramento da Tratativa.
  - CA25: Filtro `tipoEvento = 'Reabertura'` isola eventos de reabertura.
  - CA26: Filtro `tipoEvento` fora do catálogo recusa com 400 `Tipo de evento inválido.` (`target: tipoEvento`).
  - CA27: Filtro `codigoAcao` com Ação válida isola apenas os eventos da referida Ação.
  - CA28: Filtro `codigoAcao` inexistente recusa com 404 `Ação não encontrada.` (`target: codigoAcao`).
  - CA29: Filtro `codigoAcao` pertencente a outra Tratativa recusa com 404 `Ação não encontrada.` (`target: codigoAcao`).
  - CA30: Filtro `codigoAcao` com formato inválido (não-UUID) recusa na etapa 4 com 400 `Código de ação inválido.` (`target: codigoAcao`).
  - CA31: Filtro de período inclusivo retorna apenas eventos no intervalo `periodoInicio` a `periodoFim`.
  - CA32: `periodoInicio` inválido recusa com 400 `Data inválida.` (`target: periodoInicio`).
  - CA33: `periodoFim` inválido recusa com 400 `Data inválida.` (`target: periodoFim`).
  - CA34: `periodoInicio` posterior a `periodoFim` recusa com 400 `Período inválido: a data inicial não pode ser posterior à data final.` (`target: periodoInicio`).

- **Etapa 3 (Autorização dinâmica, segregação de menor privilégio e mascaramento LGPD):**
  - CA9: Gestor tem visão irrestrita com `autor`, `justificativa` e matrículas preenchidas.
  - CA10: Responsável Principal e Participante recebem apenas eventos diretos da Tratativa com dados sensíveis mascarados como `null`.
  - CA11: Responsável da Ação recebe apenas eventos de sua própria Ação com dados sensíveis mascarados como `null`.
  - CA12: Responsável da Subação recebe apenas eventos de sua Subação (não vê Ação mãe nem irmãs).
  - CA12a: Responsável da Ação mãe recebe apenas eventos da Ação mãe (não vê Subações filhas).
  - CA13: Múltiplos papéis recebem a união dos eventos autorizados com dados sensíveis mascarados.
  - CA14: Delegação de Ação retira acesso do antigo responsável e concede ao novo no momento da consulta.
  - CA15: Usuário sem vínculo recebe lista vazia `[]` com HTTP 200.
  - CA27a: Responsável da Ação 1 filtrando por `codigoAcao` da Ação 2 recebe HTTP 200 com lista vazia `[]`.
  - CA35: Evento `Edicao` de Descrição registra que o campo mudou sem gravar texto da descrição.
  - CA36: Evento `Edicao` de Solicitante consultado por não-Gestor traz `valorAnterior: null` e `valorNovo: null`.
  - CA37: Eventos de Evidência nunca expõem nome de arquivo nem conteúdo binário.
  - CA38: Evento `InclusaoComentario` identifica código do comentário sem duplicar texto livre.
  - CA39: Evento `DownloadEvidencia` registra auditoria de download com data, autor e evidência.
  - CA40: Eventos `Cancelamento` e `Reabertura` consultados pelo Gestor contêm justificativa preenchida.
  - CA41: Eventos com justificativa consultados por não-Gestor trazem `justificativa: null`.
  - CA42: Alteração de Criticidade e edição de Prazo registram valores sem exigir justificativa.

- **Etapa 4 (Precedência consolidada D10, imutabilidade absoluta e integridade):**
  - CA5: Tentativas de PUT, PATCH ou DELETE sobre registros de histórico são recusadas com 405/404.
  - CA6: Requisições de negócio recusadas nunca gravam histórico.
  - CA16: Aplicativo de origem recebe HTTP 403 na etapa 3 no início do handler.
  - CA43: Reabertura de Tratativa preserva Encerramento e adiciona Reabertura de forma append-only.
  - CA44: Reabertura de Ação preserva Conclusão e adiciona Reabertura de forma append-only.
  - CA45: Reabertura de Tratativa mantém Ações concluídas em Concluída (sem cascata).
  - CA46: Eventos de Criacao e Encerramento fornecem carimbos precisos para cálculo de indicadores em 012.
  - CA47: Usuário não autenticado recebe HTTP 401 na etapa 1.
  - CA48: Parâmetros malformados no runtime recebem HTTP 400 na etapa 2 antes do handler.
  - CA49: Aplicativo de origem com `tratativa` malformada recebe HTTP 403 antes de validações de domínio.
  - CA50: Parâmetro `tratativa` ausente ou null recusa no domínio na etapa 4 com 400 `Código inválido.` (`target: tratativa`).
  - CA51: Parâmetro `tratativa` malformado recusa no domínio na etapa 4 com 400 `Código inválido.` (`target: tratativa`).
  - CA52: Tratativa inexistente combinada com filtro inválido recusa na etapa 5 com 404 `Tratativa não encontrada.` (existência precede filtros).
  - CA53: Usuário sem vínculo combinando filtro inválido recusa na etapa 6 com 400 `Tipo de evento inválido.` (filtros precedem retorno por menor privilégio).

---

## O que não muda

- Os contratos públicos das funções e ações dos intents anteriores (002 a 007) permanecem estritamente intactos.
- `consultarTratativa` e o tipo `DetalheTratativa` de 003 mantêm rigorosamente suas 12 chaves originais sem adições de coleções ou histórico (Ruling R-02).
- Nenhuma alteração estrutural destrutiva ou aditiva é feita no modelo persistido de `db/tratativa.cds`.
- Nenhuma operação de gravação de histórico existente é modificada; o intent opera como consumidor unificado somente-leitura.
- A imutabilidade do histórico é absoluta: nenhuma funcionalidade de retificação, edição ou exclusão de registros é introduzida.

---

## O desconfortável, declarado

1. **Limite de desempate temporal por dados já persistidos (B2):**
   Optou-se deliberadamente por não introduzir colunas adicionais de numeração sequencial transacional (`sequencia : Integer`) nas tabelas `HistoricoTratativa` e `HistoricoAcoes` para evitar alterações de DDL em esquemas HDI já aprovados. Consequentemente, para múltiplos eventos gerados com o mesmo carimbo exato de milissegundo, a ordenação de desempate segue critérios determinísticos lexicográficos (`quando`, `origem`, `tipoEvento`, `id`). Isso significa que a ordem retornada entre esses eventos simultâneos é estritamente estável e reproduzível, mas pode não refletir a exata microssegunda física de execução transacional no banco. Esse compromisso foi analisado e aceito no Gate 1 para proteger a estabilidade do modelo de dados.

2. **Agregação e mascaramento em memória no Node.js:**
   A unificação dos registros de `HistoricoTratativa` e `HistoricoAcoes` e a aplicação das regras dinâmicas de mascaramento LGPD ocorrem no domínio da aplicação antes do slice de paginação. Para o volume transacional esperado por Tratativa corporativa (ordem de dezenas a centenas de eventos ao longo de meses), o impacto computacional é insignificante (< 5 ms). No entanto, caso uma Tratativa corporativa atípica acumule milhares de eventos de auditoria ao longo de anos, uma futura otimização com view nativa indexada ou particionamento analítico poderá ser demandada no intent 012/014.

**Registro do Gate 1 (2026-10-09):** decisões e itens N3 aprovados pelo orquestrador, por delegação do humano (D11). Rulings em `agentic/.estado/execucao/2026-10-08-historico-e-auditoria/progress.md`. Branch empilhada sobre `comentarios/001-comentarios`.
