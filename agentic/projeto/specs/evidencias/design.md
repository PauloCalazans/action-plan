# Design: evidencias

**Spec:** agentic/projeto/specs/evidencias/spec.md  
**Status:** aprovado

Escopo técnico: comprovação da execução de Ações e Subações por meio de arquivos de Evidência (fotos JPG/PNG, relatórios/documentos PDF/DOCX/DOC/TXT e planilhas XLSX/XLS/CSV de até 10 MB) no `TratativaService` (`/api/tratativa/v1`), compreendendo: (1) modelo persistido relacional aditivo em `db/tratativa.cds` para metadados de Evidência, anotações `@PersonalData` e remoção lógica; (2) abstração de armazenamento desacoplada exposta como serviço CAP (`ArmazenamentoEvidencias`), com dublê em memória isolado em `test/apoio/` para testes (sem dependências externas, configurado via `cds.requires.ArmazenamentoEvidencias`); (3) mecanismo de upload por action OData V4 bound (`anexarEvidencia`) com payload em Base64, transacionalidade atômica e compensação contra binários órfãos; (4) configuração do limite de corpo HTTP do runtime em 20 MB no Express/CAP (rejeição 413 do framework antes do handler para corpos superiores a 20 MB, correspondendo a arquivos acima de ~15 MB); (5) validação declarativa de formatos, pares MIME/extensão, sanitização de caminhos no nome do arquivo e limites de tamanho de 10 MB no domínio; (6) autorização com grant `{ grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }` no `@restrict`, recusa estática de `AplicativoOrigem` no `before('*')` e autorização dinâmica no domínio estrita ao Gestor de Tratativa e ao Responsável da respectiva Ação/Subação (via `identidade.ts` do 005); (7) visibilidade e proteção LGPD (ocultação de matrículas como `null` para quem não é Gestor, consultas dedicadas sem alterar o `consultarTratativa` de 12 chaves do 003, e download auditado com registro prévio de acesso `DownloadEvidencia` sem bloqueio da Tratativa como exceção declarada à D9); (8) auditoria imutável nos eventos `InclusaoEvidencia`, `RemocaoEvidencia` e `DownloadEvidencia` em `HistoricoAcoes` (via extensão de `LinhaHistorico` em `srv/tratativa/historico.ts`, sem gravação de binário nem de nome do arquivo); (9) ativação do bloqueio de conclusão de Ação com Evidência obrigatória (R8; 409 na etapa 10 do ciclo de vida do 004, compatibilizado com o Ruling R-10 sobre o CA47 do 004); (10) cálculo em tempo de leitura de pendências de evidência por function dedicada `listarPendenciasEvidenciasTratativa` (R9, I8; sem alterar tipos de retorno existentes do 004 e 005); e (11) consolidação da precedência de recusas estendendo a decisão D10 com os códigos HTTP 413 e 415. Base empilhada sobre os intents 004 (`plano-de-acao`) e 005 (`responsaveis-e-participantes`). Sem UI Fiori (intent 013), sem notificações (010) e sem workflow burocrático de aprovação.

---

## Decisões

1. **Modelo persistido: mudança estritamente aditiva em `db/tratativa.cds`** (R1, R2, R10, R12, R17; N3-4; Q1, Q2, Q3, Q11, Q13; I7, M4).
   - Nova entidade relacional `Evidencias` com anotações de dados pessoais e semântica de entidade:
     ```cds
     @PersonalData.EntitySemantics: 'Other'
     entity Evidencias {
       key codigo       : UUID;
       tratativa        : Association to one Tratativas not null;
       acao             : Association to one Acoes not null;
       @PersonalData.IsPotentiallyPersonal
       nomeArquivo      : String(255) not null;
       mimeType         : String(100) not null;
       tamanho          : Integer not null;
       @PersonalData.IsPotentiallyPersonal
       descricao        : String(500);
       ativo            : Boolean not null default true;
       criadoEm         : Timestamp not null;
       @PersonalData.IsPotentiallyPersonal
       autorAnexo       : String(50) not null;
       removidoEm       : Timestamp;
       @PersonalData.IsPotentiallyPersonal
       autorRemocao     : String(50);
     }
     ```
   - Extensão da entidade `Acoes`:
     * Composição aditiva: `evidencias : Composition of many Evidencias on evidencias.acao = $self;`
   - Extensão do tipo enumerado `EventoHistoricoAcao`:
     * Novos valores adicionados: `InclusaoEvidencia`, `RemocaoEvidencia`, `DownloadEvidencia`.
   - Extensão da entidade `HistoricoAcoes`:
     * Colunas opcionais aditivas para metadados de auditoria de evidência:
       ```cds
       evidencia : UUID;
       mimeType  : String(100);
       tamanho   : Integer;
       ```
   - **Tamanho de campos de autor (M4):** `autorAnexo` e `autorRemocao` em `Evidencias` usam `String(50)` alinhado ao tipo de matrícula de colaboradores (`Matricula`, padrão R3 do 005), enquanto `HistoricoAcoes.autor` permanece `String(256)` para comportar identidades genéricas da plataforma e service keys.
   — **Por quê:** modela a cardinalidade de 0 a 10 evidências ativas por Ação/Subação sem gravar binários nas tabelas relacionais (R5). Os campos `nomeArquivo` e `descricao` recebem `@PersonalData.IsPotentiallyPersonal` porque podem conter nomes de colaboradores ou dados sensíveis de ocorrências sob LGPD (I7). A remoção lógica (`ativo = false`) com data e autor preserva a trilha de auditoria sem exclusão física (AGENTS.md:40, R10). Nenhuma tabela existente sofre alteração destrutiva no HANA Cloud.
   — **Verificado por:** compilação SQL (`cds compile --to sql`); novo `CREATE TABLE` de `Evidencias` e colunas aditivas em `HistoricoAcoes`.

2. **Superfície do `TratativaService`: actions ligadas a `Tratativas`, functions estruturadas e sintaxe CDS compilável** (R1, R2, R11, R17; D4, D6, D9; N3-5; Q1, Q17; C2, I1, I8).
   - Sintaxe CDS compilável em `srv/tratativa-service.cds`:
     ```cds
     extend service TratativaService {
       type DetalheEvidencia {
         codigo       : UUID;
         acao         : UUID;
         nomeArquivo  : String(255);
         mimeType     : String(100);
         tamanho      : Integer;
         descricao    : String(500);
         criadoEm     : Timestamp;
         autorAnexo   : String(50);
       }

       type ItemEvidencia {
         codigo       : UUID;
         nomeArquivo  : String(255);
         mimeType     : String(100);
         tamanho      : Integer;
         descricao    : String(500);
         criadoEm     : Timestamp;
         autorAnexo   : String(50);
       }

       type ItemEvidenciaTratativa {
         codigo       : UUID;
         acao         : UUID;
         nomeArquivo  : String(255);
         mimeType     : String(100);
         tamanho      : Integer;
         descricao    : String(500);
         criadoEm     : Timestamp;
         autorAnexo   : String(50);
       }

       type DetalheDownloadEvidencia {
         codigo       : UUID;
         nomeArquivo  : String(255);
         mimeType     : String(100);
         tamanho      : Integer;
         conteudo     : String; // Conteúdo binário codificado em Base64
       }

       type ItemPendenciaEvidenciaTratativa {
         acao        : UUID;
         descricao   : String(500);
         responsavel : String(50);
         status      : String(20);
       }

       function listarEvidenciasAcao(
         tratativa : UUID,
         acao      : UUID
       ) returns many ItemEvidencia;

       function listarEvidenciasTratativa(
         tratativa : UUID
       ) returns many ItemEvidenciaTratativa;

       function baixarEvidencia(
         tratativa : UUID,
         acao      : UUID,
         evidencia : UUID
       ) returns DetalheDownloadEvidencia;

       function listarPendenciasEvidenciasTratativa(
         tratativa : UUID
       ) returns many ItemPendenciaEvidenciaTratativa;
     }

     extend TratativaService.Tratativas with actions {
       action anexarEvidencia(
         acao        : UUID,
         nomeArquivo : String,
         mimeType    : String,
         conteudo    : String,
         descricao   : String
       ) returns TratativaService.DetalheEvidencia;

       action removerEvidencia(
         acao        : UUID,
         evidencia   : UUID
       );
     };

     // Nota de autorização declarativa (I2):
     // Para não sobrescrever as concessões existentes ao GestorTratativa dos intents 004 e 005,
     // a regra { grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }
     // é ACRESCENTADA diretamente ao array @restrict existente da entidade Tratativas em srv/tratativa-service.cds
     // (exatamente no mesmo padrão adotado para mudarStatusAcao no 005), sem utilizar cláusula 'annotate ... with @restrict'.
     ```
   - **Autorização declarativa (C2, I2):** a regra `{ grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }` é acrescentada diretamente ao array `@restrict` existente da entidade `Tratativas` em `srv/tratativa-service.cds` (mesmo padrão adotado em `mudarStatusAcao` no 005, sem utilizar `annotate ... with @restrict` para não sobrescrever os grants do Gestor), permitindo que requisições de usuários autenticados cheguem ao handler onde a autorização dinâmica de domínio avalia se é Gestor ou o Responsável da Ação. O `before('*')` recusa `AplicativoOrigem` com 403 antes do domínio.
   - **Nomes qualificados (I1):** a action `anexarEvidencia` declara o tipo de retorno qualificado `TratativaService.DetalheEvidencia`, e o bloco de actions usa `extend TratativaService.Tratativas with actions { ... }`, resolvendo a sintaxe de compilação do CDS.
   - **Preservação de contratos existentes (I8):** nenhum campo novo é inserido em tipos existentes (`DetalheAcao`, `ItemEstruturaAcao`, `ItemMinhasAcoes`), preservando os testes com validação de chaves exatas dos intents 004 e 005. As pendências de evidência são consultadas exclusivamente pela nova function `listarPendenciasEvidenciasTratativa`.
   — **Por quê:** cumpre a gramática exata do compilador CDS do CAP, viabiliza o fluxo de autorização sem bloqueios indevidos no runtime e resguarda a estabilidade de contratos públicos anteriores.
   — **Verificado por:** compilação `cds compile srv --to csn` e asserções de `$metadata`.

3. **Armazenamento de arquivos como serviço CAP (`ArmazenamentoEvidencias`) e dublê em `test/apoio/`** (R5; N3-1; Q6; I6, I7).
   - O repositório de arquivos é configurado como um serviço CAP desacoplado:
     * O backend obtém a instância via `const storage = await cds.connect.to('ArmazenamentoEvidencias');`.
     * Métodos expostos pelo serviço de armazenamento:
       - `salvar(id: string, conteudo: Buffer): Promise<void>`
       - `obter(id: string): Promise<Buffer | null>`
       - `excluir(id: string): Promise<void>`
   - **Configuração em `package.json` (`cds.requires`):**
     * Estrutura exata com perfis `[development]` e `[test]` em `cds.requires` (alinhada à convenção de `"auth"` no `package.json`):
       ```json
       "cds": {
         "requires": {
           "ArmazenamentoEvidencias": {
             "impl": "srv/tratativa/armazenamento-evidencias",
              "[development]": {
                "impl": "test/apoio/armazenamento-espiao"
              },
              "[test]": {
                "impl": "test/apoio/armazenamento-espiao"
              }
           }
         }
       }
       ```
     
       
       
         
       
       
   - **Dublê exclusivo de testes (`test/apoio/armazenamento-espiao.ts`):**
     * Armazena os buffers em um `Map<string, Buffer>` privado.
     * Exporta funções de inspeção de teste (`limparArmazenamento()`, `contemArquivo(id)`, `falharProximoArmazenamento()`) consumidas diretamente pelos testes em `test/`, **sem que os arquivos de teste importem nenhum arquivo de `srv/`** (atendendo à regra inviolável da task; I6).
     * O dublê em memória é estritamente de teste; o uso de serviço real de arquivos (Object Store / DMS) em produção é pré-requisito de infraestrutura de N3-1, entregue como artefato no intent 014 (I7).
   — **Por quê:** atende perfeitamente à regra de testes sem serviços reais (AGENTS.md:38), isola os testes de qualquer importação proibida de `srv/`, e prepara a arquitetura para conexão transparente com Object Store ou SAP DMS no BTP.
   — **Verificado por:** testes de integração inspecionando o dublê via `test/apoio/armazenamento-espiao.ts` (CA17, CA41a, CA53).

4. **Mecanismo de Upload no CAP/OData: action bound com conteúdo Base64 e limites de tamanho** (R1, R4, R13, R14; Q6, Q15; I2).
   - **Upload via action `anexarEvidencia`:**
     * Requisição atômica `POST /Tratativas(<id>)/anexarEvidencia` contendo `acao`, `nomeArquivo`, `mimeType`, `conteudo` (Base64) e `descricao`.
     * Permite executar a precedência inteira de 10 passos na mesma requisição, serializar por Tratativa via D9 e aplicar compensação caso a transação do banco falhe.
   - **Relação entre tamanho de arquivo, Base64 e limite de corpo (I2):**
     * A codificação Base64 expande o binário em ~4/3 (fator 1,333...).
     * Com o limite de corpo HTTP configurado em 20 MB (20.971.520 bytes; Decisão 5):
       - Arquivo até 10 MB (10.485.760 bytes): corpo Base64 de ~13,3 MB <= 20 MB. Passa pelo runtime, decodificado para `Buffer` de 10 MB e aceito com sucesso (CA16).
       - Arquivo entre 10.485.761 bytes e ~14 MB: corpo Base64 entre ~13,98 MB e ~18,66 MB <= 20 MB. O runtime faz o parsing normalmente e entrega ao handler; o domínio valida o tamanho decodificado e recusa na etapa 10 com HTTP **413** `Arquivo excede o tamanho máximo permitido de 10 MB.`, `target: arquivo` (CA16, CA59a).
       - Arquivo acima de ~15 MB (ex.: 16 MB ou 19 MB): o corpo Base64 excede 20 MB. O middleware de `body-parser` do runtime recusa imediatamente na etapa 2 com HTTP **413** `Payload Too Large` antes de qualquer handler ou avaliação de existência (CA57b).
     * No CA58: arquivo com formato inválido ou com tamanho entre 10.485.761 bytes e 14 MB (corpo <= 20 MB) para Tratativa inexistente recebe 404 (existência na etapa 5 precede campos na etapa 10).
   — **Por quê:** garante transacionalidade atômica nativa sem handshakes complexos em duas etapas, respeitando a capacidade real do parser de corpo e alinhando com exatidão a fronteira entre recusa de framework e recusa de domínio.
   — **Verificado por:** testes com arquivos de 10 MB, 10.485.761 bytes, 14 MB e payloads superiores a 20 MB (CA16, CA57b, CA58, CA59a).

5. **Configuração do limite de corpo HTTP do runtime em 20 MB no Express/CAP** (R14 etapa 2, R17(f); N3-2; Q15).
   - Configuração no `package.json` sob a chave `cds.server.body_parser`:
     ```json
     {
       "cds": {
         "server": {
           "body_parser": {
             "limit": "20mb"
           }
         }
       }
     }
     ```
   - O middleware de `body-parser` do Express recusa requisições cujo corpo exceda 20 MB com HTTP **413** `Payload Too Large` no nível de framework.
   - Essa recusa ocorre na etapa 2, antes do handler da aplicação, antes de `AplicativoOrigem` e antes da existência de recursos no banco (CA57b).
   - Classificado como item N3 de infraestrutura/deploy devido à alteração no `package.json` (AGENTS.md:65).
   — **Por quê:** protege o servidor contra sobrecarga de memória em uploads abusivos, mantendo margem segura para arquivos válidos de até 10 MB em Base64.
   — **Verificado por:** teste enviando corpo superior a 20 MB comprovando HTTP 413 imediato sem acionar o handler (CA57b).

6. **Formatos, extensões e validação declarativa de arquivos corporativos** (R3; Q4).
   - Módulo `srv/tratativa/evidencias-validacao.ts`:
     * Compara a extensão de `nomeArquivo` e o `mimeType` declarado em minúsculas (`toLowerCase()`; CA14).
     * Pares aceitos: JPG/JPEG (`image/jpeg`, `image/pjpeg`), PNG (`image/png`), PDF (`application/pdf`), DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), DOC (`application/msword`), TXT (`text/plain`), XLSX (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), XLS (`application/vnd.ms-excel`), CSV (`text/csv`, `application/vnd.ms-excel`).
     * Formatos proibidos (.exe, .bat, .zip), MIME com mais de 100 caracteres (CA10c) ou extensão incompatível com MIME (CA13a) são recusados na etapa 10 com HTTP **415** e a mensagem exata:
       `Tipo de arquivo não permitido: envie imagem (JPG, PNG), PDF, documento (DOCX, DOC, TXT) ou planilha (XLSX, XLS, CSV).`, `target: arquivo` (CA13).
   — **Por quê:** bloqueia tipos de arquivos potencialmente executáveis ou maliciosos de forma declarativa e portável.
   — **Verificado por:** testes com todas as combinações válidas e recusas de tipos não suportados (CA11, CA12, CA13, CA13a, CA14).

7. **Sanitização de Nome de arquivo e limites de campos no domínio** (R2, R4; Q3, Q5).
   - **Sanitização de `nomeArquivo`:**
     * Extrai apenas o último segmento após separadores `/` ou `\` e aplica `trim()` (ex.: `../../foto.png` -> `foto.png`; CA10).
     * Se resultar vazio, recusa na etapa 10 com HTTP **400** `O campo Nome do arquivo é obrigatório.`, `target: nomeArquivo` (CA10a).
     * Se exceder 255 caracteres, recusa na etapa 10 com HTTP **400** `O campo Nome do arquivo aceita no máximo 255 caracteres.`, `target: nomeArquivo` (CA10b).
   - **Validação de `conteudo`:**
     * Vazio (0 bytes decodificados): recusa na etapa 10 com HTTP **400** `O arquivo não pode ser vazio.`, `target: arquivo` (CA15).
     * Tamanho superior a 10 MB (10.485.760 bytes): recusa na etapa 10 com HTTP **413** `Arquivo excede o tamanho máximo permitido de 10 MB.`, `target: arquivo` (CA16).
   - **Validação de `descricao`:**
     * Se nula ou apenas espaços, grava `null` (CA8). Se informada com mais de 500 caracteres após `trim()`, recusa na etapa 10 com HTTP **400** `O campo Descrição aceita no máximo 500 caracteres.`, `target: descricao` (CA9).
   — **Por quê:** higieniza caminhos contra ataques de travessia e garante integridade dos metadados de domínio.
   — **Verificado por:** testes cobrindo sanitização, limites e campos vazios (CA7–CA10b, CA15, CA16).

8. **Autorização dinâmica, grant de `@restrict` e menor privilégio** (R6, R11; N3-3; Q7, Q12; C2).
   - **Anotação `@restrict` (C2):** as actions `anexarEvidencia` e `removerEvidencia` recebem grant para `authenticated-user` em `srv/tratativa-service.cds`.
   - **Filtro de Aplicativo de Origem (Ruling R-03):** o handler `before('*')` no `TratativaService` intercepta identidades com papel `AplicativoOrigem` e recusa com HTTP **403** `Aplicativo de origem não usa este serviço.` no início do handler (Passo 3), antes da validação de código ou existência (CA24, CA57).
   - **Autorização dinâmica no domínio (Passo 6):**
     * O usuário é `GestorTratativa`? Se sim, permissão concedida.
     * Se não: o usuário autenticado é o Responsável da Ação (ou Subação)? Avaliado via `usuarioAutenticadoEhMatricula(req, acao.responsavel)`. Se for, permissão concedida.
     * Terceiros, Responsável Principal da Tratativa e Participantes da Tratativa recebem HTTP **403** Forbidden (CA20–CA23, CA45–CA47).
   - **Segregação hierárquica:** o Responsável de uma Ação mãe opera apenas sobre a mãe; o Responsável de uma Subação opera apenas sobre a Subação (CA44).
   — **Por quê:** estabelece menor privilégio rigoroso sobre arquivos com potencial de dados médicos e acidentários sensíveis sob LGPD (AGENTS.md:66).
   — **Verificado por:** testes cobrindo toda a matriz de papéis (CA18–CA24, CA43–CA47).

9. **Visibilidade e proteção LGPD em consultas e download de anexos** (R11; N3-4; Q12, Q17; M2, M3).
   - **Consultas de listagem (`listarEvidenciasAcao` e `listarEvidenciasTratativa`):**
     * Retornam apenas evidências ativas (`ativo = true`; CA40). O campo `autorRemocao` não é projetado na listagem pública (M3).
     * Gestor recebe a lista completa com `autorAnexo` preenchido (CA43, CA47a).
     * Responsável da Ação/Subação recebe apenas as evidências sob sua responsabilidade, com `autorAnexo: null` (CA7, CA44, CA47b).
     * Responsável Principal, Participantes e terceiros recebem lista vazia `[]` com HTTP 200 (CA45, CA46, CA47).
     * Aplicativo de origem recebe HTTP 403 (CA24).
   - **Download de Evidência (`baixarEvidencia`) (M2):**
     * Operação do tipo function GET com efeito colateral controlado: insere o registro `DownloadEvidencia` no histórico de acesso antes de entregar o binário (R11 d, R12 c). Se a gravação no histórico falhar, o binário não é entregue e o pedido falha com erro 500 (CA50a, CA54a).
     * Se o binário não for encontrado no repositório de arquivos (`storage.obter` devolve `null`), a operação falha com erro 500 sem entregar conteúdo.
     * Evidências com `ativo = false` retornam HTTP 404 `Evidência não encontrada.` (CA41).
     * **Exceção à decisão D9:** o download não bloqueia a Tratativa (`bloquearTratativa` não é chamado), viabilizando concorrência livre de downloads paralelos (CA54a).
     * Download e listagens permanecem permitidos em Tratativas encerradas/canceladas e Ações concluídas/canceladas (CA48, CA48a).
   — **Por quê:** assegura rastreabilidade de acessos a dados sensíveis sob LGPD sem introduzir gargalos de concorrência.
   — **Verificado por:** testes de visibilidade de matrícula, auditoria prévia de download e exceção à D9 (CA43–CA48a, CA50a, CA54a).

10. **Auditoria imutável e extensão de `srv/tratativa/historico.ts`** (R12, R17; N3-4; Q13, Q18; I4).
    - O módulo `srv/tratativa/historico.ts` é estendido para suportar as novas propriedades de auditoria de evidência na interface `LinhaHistorico`:
      ```typescript
      export interface LinhaHistorico {
        evento: string;
        campo?: string | null;
        valorAnterior?: string | null;
        valorNovo?: string | null;
        justificativa?: string | null;
        evidencia?: string | null;
        mimeType?: string | null;
        tamanho?: number | null;
      }
      ```
    - A função `registrarHistorico` mantém sua assinatura idêntica e grava `evidencia`, `mimeType` e `tamanho` quando presentes na linha para `HistoricoAcoes`.
    - Eventos gravados: `InclusaoEvidencia`, `RemocaoEvidencia` e `DownloadEvidencia`. O `nomeArquivo` e o conteúdo binário nunca são gravados no histórico (CA49, CA50, CA50a, CA51).
    - Pedidos recusados ou listagens não gravam histórico (CA50b, CA52).
   — **Por quê:** preserva a assinatura central de histórico da plataforma enquanto habilita a auditoria de arquivos sensíveis sem violar LGPD.
   — **Verificado por:** inspeção da tabela `HistoricoAcoes` em todas as operações (CA49–CA52).

11. **Atomicidade, serialização por Tratativa (D9) e compensação de arquivos órfãos** (R13; Q14).
    - `anexarEvidencia` e `removerEvidencia` invocam `bloquearTratativa(codigoTratativa)` (D9) antes de qualquer outra leitura ou escrita, serializando acessos e garantindo que o limite de 10 evidências ativas não seja violado por concorrência (CA55).
    - **Compensação transacional:** em `anexarEvidencia`, se o salvamento de metadados no banco relacional falhar após o arquivo ter sido gravado no repositório, o bloco `catch` executa `await storage.excluir(codigoEvidencia)`, impedindo que binários órfãos permaneçam no repositório (CA53).
    - Na remoção lógica: se o histórico falhar, o rollback do banco mantém `ativo = true` (CA54).
   — **Por quê:** garante consistência atômica entre a base relacional e o repositório de arquivos desacoplado.
   — **Verificado por:** testes com injeção de falha simulada e conferência no dublê de armazenamento (CA53, CA54, CA55).

12. **Bloqueio de conclusão da Ação por Evidência obrigatória e Ruling R-10** (R8, R15, R17; Q9; C1).
    - **Extensão do ciclo de vida em `srv/tratativa/acoes-ciclo-de-vida.ts`:**
      * Na transição de Status para `Concluída`, insere-se a etapa 10 de pré-condição: se `acao.evidenciaObrigatoria === true` e a contagem de evidências ativas da Ação for zero, recusa com HTTP **409** e a mensagem exata:
        `Ação com Evidência obrigatória não pode ser concluída sem Evidência.` (CA29, CA30, CA33).
      * Se possuir ao menos uma evidência ativa (`count >= 1`), conclui com sucesso (CA31).
      * Ações com `evidenciaObrigatoria === false` (padrão) concluem normalmente sem evidências (CA32).
    - **Relação com testes RED do Intent 004 e Ruling R-10 (C1):**
      * O commit RED `d407f95` do 004 continha o teste `CA47` em `test/ciclo-de-vida-acoes.test.ts:216-221`, que afirmava que uma Ação com `evidenciaObrigatoria: 'sim'` concluía sem bloqueio naquele intent (respondendo 204).
      * Pelo **Ruling R-10**, o teste `CA47` na branch do 004 está sendo ajustado para afirmar apenas a gravação e devolução de "sim" na consulta, delegando formalmente o efeito do bloqueio de conclusão ao intent 006 (mesmo padrão aplicado nas Rulings R-07 e R-08).
      * Foi realizada leitura minuciosa de todos os arquivos de teste do worktree `agentic/.estado/worktrees/plano-de-acao-001-acoes-hierarquicas/test/` (`ciclo-de-vida-acoes.test.ts`, `criacao-acoes.test.ts`, `edicao-acoes.test.ts`, `estrutura-acoes.test.ts`, `consultas-acoes.test.ts`) e da task do 005. **Nenhum outro teste existente conclui Ação com evidência obrigatória**. Portanto, com a aplicação do Ruling R-10, nenhum teste antigo é contrariado e a compatibilidade regressiva é de 100%.
   — **Por quê:** ativa a regra mandante de negócio da proposta sem quebrar a suíte de testes de intents anteriores.
   — **Verificado por:** testes de conclusão com e sem evidências (CA29–CA33, CA64–CA66, CA69).

13. **Consulta de pendências de evidência por function dedicada `listarPendenciasEvidenciasTratativa`** (R9, R17; Q10; I8).
    - Para não alterar tipos de retorno existentes do 004 (`DetalheAcao`, `ItemEstruturaAcao`) e 005 (`ItemMinhasAcoes`), cujos testes RED exigem chaves exatas (I8), as pendências de evidência são consultadas pela function pública dedicada:
      `function listarPendenciasEvidenciasTratativa(tratativa : UUID) returns many ItemPendenciaEvidenciaTratativa;`
    - Retorna a lista de Ações/Subações da Tratativa que cumprem as 3 condições de pendência: (1) `evidenciaObrigatoria === true`; (2) contagem de evidências ativas igual a zero; e (3) Status `Pendente` ou `Em andamento`.
    - **Regras de visibilidade:** idênticas às de `listarEvidenciasTratativa`:
      * Gestor vê todas as pendências da Tratativa com `responsavel` preenchido.
      * Responsável de Ação/Subação vê apenas as pendências sob sua responsabilidade, com `responsavel: null` (LGPD).
      * Demais usuários recebem lista vazia `[]`.
      * Aplicativo de origem recebe HTTP 403.
    - Se a Ação estiver `Concluída` ou `Cancelada`, ou se tiver `evidenciaObrigatoria = false`, ela não é listada como pendência (CA36, CA37).
   — **Por quê:** viabiliza a tela de pendências e o futuro disparo de alertas (010 e 013) com zero risco de quebrar contratos consolidados de intents anteriores.
   — **Verificado por:** testes em `test/evidencias-bloqueio-conclusao.test.ts` (CA34–CA38, CA68).

14. **Precedência consolidada de 10 passos e exceção de URL de Functions (GET)** (R14; D10; Ruling R-03, Ruling R-04; I3).
    - **Ordem das 10 etapas para operações de escrita (`anexarEvidencia`, `removerEvidencia`):**
      1. Autenticação (401 runtime).
      2. Forma no runtime (400 runtime ou 413 do framework para corpos HTTP > 20 MB).
      3. Aplicativo de origem: recebe 403 `Aplicativo de origem não usa este serviço.` do `before('*')` antes do domínio (Ruling R-03; CA24, CA57).
      4. Forma de identificador no domínio: parâmetro `acao` ou `evidencia` ausente/malformado -> 400 `Código inválido.`, `target: <campo>` (CA3).
      5. Existência: Tratativa inexistente (404), Ação inexistente (404), Ação não pertencente à Tratativa (404); Evidência inexistente/inativa/de outra Ação -> 404 `Evidência não encontrada.` (CA42, CA61).
      6. Autorização dinâmica: Gestor OU Responsável da Ação -> 403 para terceiros (CA20–CA23, CA62).
      7. Estado da Tratativa: Encerrada/Cancelada -> 409 `Tratativa <Status> não pode ser alterada.` (CA25, CA59, CA63).
      8. Estado da Ação: Concluída/Cancelada -> 409 `Ação <Status> não pode ser alterada.` (CA26, CA27).
      9. Estado das Evidências: limite de 10 evidências ativas atingido -> 409 `Limite de 10 evidências por Ação atingido.` (CA5, CA55).
      10. Campos no domínio: nome vazio (400), nome > 255 (400), arquivo vazio (400), formato/MIME incompatível (415), tamanho > 10 MB (413), descrição > 500 (400).
    - **Exceção de URL nas Functions (GET) (I3):**
      * Em functions OData V4 com parâmetros na URL (`baixarEvidencia`, `listarEvidencias*`), caracteres que são inválidos na sintaxe de primitivos da URL (como `"invalido!"`) são rejeitados pelo parser de URL do framework na etapa 2 com HTTP 400 antes do `before('*')`.
      * Portanto, para testar a recusa do Aplicativo de origem (403 na etapa 3) e a validação semântica de Código no domínio (400 `Código inválido.` na etapa 4) em functions, os testes utilizam identificadores malformados com caracteres válidos na URL (ex.: `"xyz"`), conforme documentado na Nota de R29 do 004 e Ruling R-04.
   — **Por quê:** documenta a realidade técnica do parser de URLs do runtime OData V4 em conformidade com as medições do revisor.
   — **Verificado por:** testes de precedência cobrindo parâmetros no corpo (POST) e na URL (GET) (CA56–CA63, CA57a, CA61b).

15. **Extensão formal da Decisão D10 no catálogo corporativo** (R4, R14, R17; N3-6; Q15; I2).
    - Texto pronto para incorporação em `agentic/projeto/decisoes.md`:
      ```markdown
      ### D10 (extensão pelo intent 006) — Extensão do contrato de recusas para arquivos e Evidências
      - **Decisão:** o contrato de recusas da D10 é estendido com os códigos HTTP 413 (Payload Too Large) e 415 (Unsupported Media Type):
        1. No runtime (etapa 2 de forma do pedido): requisições HTTP cujo corpo exceda o limite configurado de 20 MB (correspondendo a arquivos acima de ~15 MB em Base64) são recusadas pelo framework com HTTP 413 antes de qualquer handler ou avaliação de papel (inclusive do Aplicativo de origem).
        2. No domínio (etapa 10 de campos, após validação de existência, autorização dinâmica e estados): arquivo vazio (0 bytes) é recusado com HTTP 400 (`target: arquivo`); formato de arquivo não permitido, extensão e tipo MIME incompatíveis ou MIME superior a 100 caracteres são recusados com HTTP 415 (`target: arquivo`); arquivo com tamanho entre 10.485.761 bytes e ~14 MB (que passa pelo runtime de 20 MB mas excede o limite de domínio de 10 MB) é recusado com HTTP 413 (`target: arquivo`).
      - **Por quê:** alinha a plataforma à semântica padrão do protocolo HTTP (RFC 7231 / RFC 9110), onde 415 identifica tipos de mídia não suportados e 413 identifica cargas que excedem a capacidade aceita. Mantém a separação da D10 onde a validação de limites de tamanho do domínio ocorre na etapa de campos após o estado, prevenindo o processamento desnecessário de arquivos em ações ou tratativas em estados que já proíbem a alteração (409).
      - **Consequência:** o catálogo de erros passa a prever 413 e 415; `srv/tratativa/recusa.ts` suporta esses status codes; o runtime Express/CAP é configurado com limite de 20 MB (`cds.server.body_parser.limit = '20mb'`); testes de integração cobrem a precedência exata dessas recusas.
      - **Verificado por:** CA10c, CA13, CA13a, CA15, CA16, CA57b, CA58, CA59, CA59a na suíte de testes de evidências; medição do middleware de body-parser no runtime CAP.
      - **Data:** 2026-10-08
      ```
   — **Por quê:** cumpre a exigência mandatória de manter a governança de decisões corporativas sincronizada e rastreável.
   — **Verificado por:** rastreabilidade em R17(f) e tabela de alterações da spec.

---

## Contrato executável

### 1. Definições CDS (`db/tratativa.cds`)

```cds
namespace br.com.calazanstec;

// Extensão do enum existente EventoHistoricoAcao
type EventoHistoricoAcao : String(30) enum {
  Criacao;
  MudancaStatus;
  Conclusao;
  Reabertura;
  Cancelamento;
  Edicao;
  Delegacao;          // do intent 005
  InclusaoEvidencia;  // do intent 006
  RemocaoEvidencia;   // do intent 006
  DownloadEvidencia;  // do intent 006
}

// Nova entidade Evidencias
@PersonalData.EntitySemantics: 'Other'
entity Evidencias {
  key codigo       : UUID;
  tratativa        : Association to one Tratativas not null;
  acao             : Association to one Acoes not null;
  @PersonalData.IsPotentiallyPersonal
  nomeArquivo      : String(255) not null;
  mimeType         : String(100) not null;
  tamanho          : Integer not null;
  @PersonalData.IsPotentiallyPersonal
  descricao        : String(500);
  ativo            : Boolean not null default true;
  criadoEm         : Timestamp not null;
  @PersonalData.IsPotentiallyPersonal
  autorAnexo       : String(50) not null;
  removidoEm       : Timestamp;
  @PersonalData.IsPotentiallyPersonal
  autorRemocao     : String(50);
}

// Extensões aditivas em entidades existentes:
// Em entity Acoes:
//   evidencias : Composition of many Evidencias on evidencias.acao = $self;
//
// Em entity HistoricoAcoes:
//   evidencia : UUID;
//   mimeType  : String(100);
//   tamanho   : Integer;
```

### 2. Definições CDS (`srv/tratativa-service.cds`)

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

extend service TratativaService {

  type DetalheEvidencia {
    codigo       : UUID;
    acao         : UUID;
    nomeArquivo  : String(255);
    mimeType     : String(100);
    tamanho      : Integer;
    descricao    : String(500);
    criadoEm     : Timestamp;
    autorAnexo   : String(50);
  }

  type ItemEvidencia {
    codigo       : UUID;
    nomeArquivo  : String(255);
    mimeType     : String(100);
    tamanho      : Integer;
    descricao    : String(500);
    criadoEm     : Timestamp;
    autorAnexo   : String(50);
  }

  type ItemEvidenciaTratativa {
    codigo       : UUID;
    acao         : UUID;
    nomeArquivo  : String(255);
    mimeType     : String(100);
    tamanho      : Integer;
    descricao    : String(500);
    criadoEm     : Timestamp;
    autorAnexo   : String(50);
  }

  type DetalheDownloadEvidencia {
    codigo       : UUID;
    nomeArquivo  : String(255);
    mimeType     : String(100);
    tamanho      : Integer;
    conteudo     : String; // Conteúdo binário codificado em Base64
  }

  type ItemPendenciaEvidenciaTratativa {
    acao        : UUID;
    descricao   : String(500);
    responsavel : String(50);
    status      : String(20);
  }

  function listarEvidenciasAcao(
    tratativa : UUID,
    acao      : UUID
  ) returns many ItemEvidencia;

  function listarEvidenciasTratativa(
    tratativa : UUID
  ) returns many ItemEvidenciaTratativa;

  function baixarEvidencia(
    tratativa : UUID,
    acao      : UUID,
    evidencia : UUID
  ) returns DetalheDownloadEvidencia;

  function listarPendenciasEvidenciasTratativa(
    tratativa : UUID
  ) returns many ItemPendenciaEvidenciaTratativa;
}

extend TratativaService.Tratativas with actions {
  action anexarEvidencia(
    acao        : UUID,
    nomeArquivo : String,
    mimeType    : String,
    conteudo    : String,
    descricao   : String
  ) returns TratativaService.DetalheEvidencia;

  action removerEvidencia(
    acao        : UUID,
    evidencia   : UUID
  );
};

// Nota de autorização declarativa (I2):
// O grant { grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }
// é ACRESCENTADO diretamente ao array @restrict existente da entidade Tratativas em srv/tratativa-service.cds
// (como o 005 fez com mudarStatusAcao), sem utilizar cláusula 'annotate ... with @restrict'.
```

### 3. Tabela Consolidada de Precedência e Erros HTTP

| Operação | Verificação | Quem / Etapa | HTTP | Mensagem de erro | Target |
|---|---|---|---|---|---|
| Todas | Autenticação | Runtime (1) | 401 | (Padrão CAP / Express) | - |
| Todas | Tamanho do corpo HTTP > 20 MB (arquivo > ~15 MB em Base64) | Runtime (2) | 413 | `Payload Too Large` | - |
| Functions GET | Parâmetro com caracteres inválidos na URL (ex.: `invalido!`) | Runtime (2) | 400 | (Padrão CAP OData V4) | - |
| Actions POST | JSON malformado / tipo incompatível na raiz | Runtime (2) | 400 | (Padrão CAP Express) | - |
| Todas | Papel Aplicativo de Origem | Handler `before('*')` (3) | 403 | `Aplicativo de origem não usa este serviço.` | - |
| `anexarEvidencia` | Parâmetro `acao` inválido/ausente | Domínio (4) | 400 | `Código inválido.` | `acao` |
| `removerEvidencia` | Parâmetro `acao` ou `evidencia` inválido/ausente | Domínio (4) | 400 | `Código inválido.` | `acao` / `evidencia` |
| Functions GET | Parâmetro com formato malformado válido na URL (ex.: `xyz`) | Domínio (4) | 400 | `Código inválido.` | nome do campo |
| `anexar`/`remover` | Tratativa inexistente | Domínio (5) | 404 | `Tratativa não encontrada.` | - |
| `anexar`/`remover` | Ação inexistente ou de outra Tratativa | Domínio (5) | 404 | `Ação não encontrada.` | - |
| `remover`/`baixar` | Evidência inexistente, inativa ou de outra Ação | Domínio (5) | 404 | `Evidência não encontrada.` | - |
| Functions GET | Tratativa ou Ação inexistente | Domínio (5) | 404 | `Tratativa não encontrada.` / `Ação não encontrada.` | - |
| `anexar`/`remover` | Usuário não é Gestor nem Responsável da Ação | Domínio (6) | 403 | Forbidden | - |
| `baixarEvidencia` | Usuário não é Gestor nem Responsável da Ação | Domínio (6) | 403 | Forbidden | - |
| `anexar`/`remover` | Tratativa Encerrada / Cancelada | Domínio (7) | 409 | `Tratativa <Status> não pode ser alterada.` | - |
| `anexar`/`remover` | Ação Concluída / Cancelada | Domínio (8) | 409 | `Ação <Status> não pode ser alterada.` | - |
| `anexarEvidencia` | Ação já possui 10 evidências ativas | Domínio (9) | 409 | `Limite de 10 evidências por Ação atingido.` | - |
| `anexarEvidencia` | Nome do arquivo vazio após sanitização | Domínio (10) | 400 | `O campo Nome do arquivo é obrigatório.` | `nomeArquivo` |
| `anexarEvidencia` | Nome do arquivo > 255 caracteres | Domínio (10) | 400 | `O campo Nome do arquivo aceita no máximo 255 caracteres.` | `nomeArquivo` |
| `anexarEvidencia` | Arquivo vazio (0 bytes) | Domínio (10) | 400 | `O arquivo não pode ser vazio.` | `arquivo` |
| `anexarEvidencia` | Formato não permitido / MIME incompatível / MIME > 100 | Domínio (10) | 415 | `Tipo de arquivo não permitido: envie imagem (JPG, PNG), PDF, documento (DOCX, DOC, TXT) ou planilha (XLSX, XLS, CSV).` | `arquivo` |
| `anexarEvidencia` | Tamanho do arquivo entre 10.485.761 B e 14 MB | Domínio (10) | 413 | `Arquivo excede o tamanho máximo permitido de 10 MB.` | `arquivo` |
| `anexarEvidencia` | Descrição > 500 caracteres | Domínio (10) | 400 | `O campo Descrição aceita no máximo 500 caracteres.` | `descricao` |
| `mudarStatusAcao` (Concluída) | Evidência obrigatória sim e zero evidências ativas | Domínio (10) | 409 | `Ação com Evidência obrigatória não pode ser concluída sem Evidência.` | - |

---

## Como isso se prova (rastreabilidade dos CAs)

- **CA1 (R1):** anexo de PDF válido pelo Gestor em Ação de Tratativa Aberta cria Evidência vinculada à Ação e à Tratativa. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA2 (R1):** anexo de JPG válido pelo Responsável de Subação vincula Evidência diretamente à Subação. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA3 (R1, R14):** parâmetro `acao` ausente ou nulo no payload de `anexarEvidencia` resulta em 400 `Código inválido.`, `target: acao` na etapa 4. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA4 (R1):** Ação com 9 evidências ativas aceita a 10ª evidência com sucesso. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA5 (R1):** Ação com 10 evidências ativas recusa a 11ª com 409 `Limite de 10 evidências por Ação atingido.` e nada é gravado. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA6 (R1, R10):** Ação com 10 evidências em que uma foi removida logicamente possui 9 ativas e aceita nova inclusão. *Verificado por: teste em `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA7 (R2, R11):** `nomeArquivo` com espaços e `descricao` com espaços são gravados com trim; data e autor gravados; consulta devolve autor ao Gestor e null ao Responsável da Ação. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA8 (R2):** anexo sem descrição (ou só com espaços) grava `descricao = null`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA9 (R2):** descrição com 501 caracteres recusa com 400 `O campo Descrição aceita no máximo 500 caracteres.`, `target: descricao`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA10 (R2):** `nomeArquivo` com caminho (`dir/subdir/../../foto.png`) grava apenas o último segmento `foto.png`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA10a (R2):** `nomeArquivo` vazio após extração e trim recusa com 400 `O campo Nome do arquivo é obrigatório.`, `target: nomeArquivo`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA10b (R2):** `nomeArquivo` com mais de 255 caracteres recusa com 400 `O campo Nome do arquivo aceita no máximo 255 caracteres.`, `target: nomeArquivo`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA10c (R2):** MIME com mais de 100 caracteres recusa com 415, `target: arquivo`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA11 (R3):** arquivo `.pdf` com `application/pdf` aceito com sucesso. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA12 (R3):** extensões JPG, JPEG, PNG, DOCX, DOC, TXT, XLSX, XLS e CSV com MIME correspondente (incluindo pares alternativos) aceitos com sucesso. *Verificado por: teste parametrizado em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA13 (R3):** extensões `.exe`, `.bat`, `.zip` recusadas com 415 `Tipo de arquivo não permitido: envie imagem (JPG, PNG), PDF, documento (DOCX, DOC, TXT) ou planilha (XLSX, XLS, CSV).`, `target: arquivo`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA13a (R3):** arquivo `.pdf` com MIME `image/png` (incompatíveis) recusa com 415. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA14 (R3):** extensão em maiúsculas (`.PNG`, `.PDF`) aceita normalmente. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA15 (R4):** arquivo de 0 bytes recusa com 400 `O arquivo não pode ser vazio.`, `target: arquivo`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA16 (R4):** arquivo de 10.485.761 bytes recusa com 413 `Arquivo excede o tamanho máximo permitido de 10 MB.`; com 10.485.760 bytes é aceito. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA17 (R5):** metadados gravados na base relacional e binário transferido ao repositório de arquivos (sem gravação de binário na base relacional). *Verificado por: inspeção no banco e no dublê de armazenamento via `test/apoio/armazenamento-espiao.ts` em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA18 (R6):** Gestor de Tratativa anexa e remove evidências de qualquer Ação. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA19 (R6):** Responsável da Ação anexa e remove evidências da sua própria Ação. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA20 (R6):** Responsável da Ação 1 tentando anexar ou remover em Ação 2 recebe 403. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA21 (R6):** Responsável Principal da Tratativa (não Gestor nem dono da Ação) recebe 403 em anexo e remoção. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA22 (R6):** Participante da Tratativa (não Gestor nem dono da Ação) recebe 403 em anexo e remoção. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA23 (R6):** Usuário comum autenticado sem papel recebe 403 em anexo e remoção. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA24 (R6, R11, R14):** Aplicativo de origem recebe 403 em listar, anexar, remover e baixar na etapa 3 no início do handler antes da existência; corpo malformado pelo runtime devolve 400 na etapa 2. *Verificado por: testes nas Etapas 1, 2 e 4.*
- **CA25 (R7):** Tratativa Encerrada/Cancelada recusa anexo e remoção com 409 `Tratativa <Status> não pode ser alterada.`. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA26 (R7):** Ação Concluída recusa anexo e remoção com 409 `Ação Concluída não pode ser alterada.`. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA27 (R7):** Ação Cancelada recusa anexo e remoção com 409 `Ação Cancelada não pode ser alterada.`. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1) e `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA28 (R7):** Ação Concluída reaberta para Em andamento aceita novos anexos. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA29 (R8):** Gestor tentando concluir Ação com `evidenciaObrigatoria = true` sem evidências ativas recebe 409 `Ação com Evidência obrigatória não pode ser concluída sem Evidência.`. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA30 (R8):** Responsável da Ação tentando concluir a mesma Ação recebe a mesma recusa 409. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA31 (R8):** Ação com `evidenciaObrigatoria = true` contendo ao menos uma evidência ativa transita para Concluída com sucesso. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA32 (R8):** Ação com `evidenciaObrigatoria = false` conclui com sucesso sem evidências. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA33 (R8, R10):** Ação com `evidenciaObrigatoria = true` cuja única evidência foi removida logicamente recusa conclusão com 409. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA34 (R9):** Ação Pendente com `evidenciaObrigatoria = true` e zero evidências é listada em `listarPendenciasEvidenciasTratativa`. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA35 (R9):** Ação Em andamento com evidência ativa anexada não é listada como pendente em `listarPendenciasEvidenciasTratativa`. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA36 (R9):** Ação com `evidenciaObrigatoria = false` não é listada como pendente. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA37 (R9):** Ação Concluída ou Cancelada não é listada como pendente. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA38 (R9):** Consulta de pendências `listarPendenciasEvidenciasTratativa` devolve a lista de ações com pendência sob a regra de menor privilégio. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA38a (R9):** consultas existentes de detalhe da Ação, da estrutura de Ações (004) e de "Minhas Ações" (005) mantêm exatamente as chaves atuais, sem acréscimo de `evidenciaPendente` aos seus tipos de retorno (preservando testes de chaves exatas). *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA39 (R10):** remoção de Evidência grava `ativo = false`, data de remoção e matrícula do autor da remoção no banco relacional. *Verificado por: teste em `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA40 (R10):** Evidência removida logicamente não aparece na listagem padrão por Ação nem por Tratativa. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA41 (R10):** tentativa de baixar Evidência removida logicamente retorna 404 `Evidência não encontrada.`. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA41a (R10, R12):** arquivo binário da Evidência removida logicamente permanece guardado no repositório de arquivos. *Verificado por: conferência no dublê de armazenamento via `test/apoio/armazenamento-espiao.ts` em `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA42 (R10):** remoção de Evidência já removida (ou inexistente) retorna 404 `Evidência não encontrada.`. *Verificado por: teste em `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA43 (R11):** Gestor lista evidências e baixa binário, recebendo a matrícula do autor. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA44 (R11):** Responsável da Ação lista e baixa evidências com autor null; Responsável de Subação opera apenas sobre a Subação. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA45 (R11):** Responsável Principal da Tratativa recebe lista vazia em listagens e 403 em download. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA46 (R11):** Participante da Tratativa recebe lista vazia em listagens e 403 em download. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA47 (R11):** Usuário comum sem papel recebe lista vazia em listagens e 403 em download. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA47a (R11):** Gestor consultando lista por Tratativa recebe todas as evidências com código da Ação e autor preenchido. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA47b (R11):** Responsável consultando lista por Tratativa recebe apenas suas evidências com código da Ação e autor null. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA48 (R11):** Download aceito com sucesso em Tratativa Encerrada ou Cancelada. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA48a (R11, R14):** Listagens aceitas com sucesso em Tratativa Encerrada/Cancelada e Ação Concluída/Cancelada. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA49 (R12):** inclusão aceita gera histórico com evento `InclusaoEvidencia` sem copiar Nome do arquivo. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA50 (R12):** remoção aceita gera histórico com evento `RemocaoEvidencia` sem copiar Nome do arquivo. *Verificado por: teste em `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA50a (R11, R12):** download aceito gera histórico com evento `DownloadEvidencia`. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA50b (R11, R12):** consultas e listagens não geram nenhum registro de histórico. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA51 (R12):** histórico de Evidência nunca grava o conteúdo binário do arquivo. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA52 (R12):** pedidos recusados não gravam nenhum histórico. *Verificado por: testes nas Etapas 1, 2 e 4.*
- **CA53 (R13):** falha na gravação do histórico ou banco após salvar binário aciona rollback e compensação apagando binário do repositório (conferido no dublê). *Verificado por: teste com injeção de falha em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA54 (R13):** falha na gravação do histórico na remoção desfaz alteração (`ativo` permanece true). *Verificado por: teste em `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA54a (R11, R12, R13):** falha na gravação de `DownloadEvidencia` impede entrega do binário; download concorrente não bloqueia Tratativa (exceção à D9). *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA55 (R13):** duas inclusões simultâneas da 10ª evidência resultam em exatamente uma aceita e uma recusada com 409 (serialização D9). *Verificado por: teste concorrente em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA56 (R14):** usuário não autenticado recebe 401. *Verificado por: testes nas Etapas 1, 2 e 4.*
- **CA57 (R14):** aplicativo com arquivo inválido em Tratativa inexistente recebe 403 no início do handler na etapa 3; corpo malformado de runtime recebe 400 na etapa 2. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA57a (R14):** aplicativo enviando código malformado de sintaxe válida (ex.: `"xyz"`) recebe 403 no início do handler na etapa 3 antes de validar código na etapa 4. *Verificado por: testes em `test/evidencias-anexo.test.ts` (Etapa 1), `test/evidencias-remocao.test.ts` (Etapa 2) e `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA57b (R14):** requisição com corpo > 20 MB (arquivo > ~15 MB em Base64) recebe 413 do runtime na etapa 2 antes do handler. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA58 (R14):** arquivo com formato inválido ou tamanho entre 10 e 14 MB (corpo <= 20 MB) para Tratativa inexistente recebe 404 (existência na etapa 5 precede campos na etapa 10). *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA59 (R14):** arquivo com formato inválido ou tamanho entre 10 e 14 MB em Tratativa Encerrada recebe 409 `Tratativa Encerrada não pode ser alterada.` (estado na etapa 7 precede campos na etapa 10). *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA59a (R14):** arquivo de 10.485.761 bytes (até 14 MB) em Tratativa Aberta recebe 413 `Arquivo excede o tamanho máximo permitido de 10 MB.`. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA60 (R14):** arquivo válido com Tratativa ou Ação inexistente recebe 404. *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA61 (R14):** remoção de Evidência com código de outra Ação à qual não pertence recebe 404 `Evidência não encontrada.`. *Verificado por: teste em `test/evidencias-remocao.test.ts` (Etapa 2).*
- **CA61a (R14):** listagem com Tratativa ou Ação inexistente recebe 404 na etapa 5. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA61b (R14):** listagem ou download com código malformado de sintaxe válida (ex.: `"xyz"`) recebe 400 `Código inválido.` na etapa 4. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA62 (R14):** usuário sem permissão enviando anexo com descrição de 600 caracteres recebe 403 (autorização na etapa 6 precede campos na etapa 10). *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA63 (R14):** Gestor enviando anexo com descrição de 600 caracteres em Tratativa Encerrada recebe 409 `Tratativa Encerrada não pode ser alterada.` (estado na etapa 7 precede campos na etapa 10). *Verificado por: teste em `test/evidencias-anexo.test.ts` (Etapa 1).*
- **CA64 (R15):** tentativa de concluir Ação mãe com evidência obrigatória sim, zero evidências e Subação pendente recebe 409 `A Ação possui Subações não concluídas nem canceladas.` (mãe-filhas na etapa 9 precede evidência obrigatória na etapa 10). *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA65 (R15):** tentativa de concluir Ação em Tratativa Encerrada sem evidência recebe 409 `Tratativa Encerrada não pode ser alterada.` (estado da Tratativa na etapa 7 precede evidência na etapa 10). *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA66 (R15):** tentativa de concluir Ação Cancelada sem evidência recebe 409 `Transição não permitida: de Cancelada para Concluída.` (estado da Ação na etapa 8 precede evidência na etapa 10). *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA67 (R16):** limites, formatos e regras funcionam identicamente em Tratativas de aplicativos e Tratativas avulsas. *Verificado por: teste parametrizado em `test/evidencias-consultas-download.test.ts` (Etapa 4).*
- **CA68 (R17):** consulta `listarPendenciasEvidenciasTratativa` devolve ações pendentes sem alterar tipos de retorno existentes. *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA69 (R17):** tentativa de concluir Ação com `evidenciaObrigatoria = true` sem evidências ativas passa a ser recusada com 409 (substituição formal de plano-de-acao:R14). *Verificado por: teste em `test/evidencias-bloqueio-conclusao.test.ts` (Etapa 3).*
- **CA70 (R17):** lista de eventos de histórico de Ação registra `InclusaoEvidencia`, `RemocaoEvidencia` e `DownloadEvidencia`. *Verificado por: teste em `test/evidencias-consultas-download.test.ts` (Etapa 4).*

---

## O que não muda (invariantes)

- **Imutabilidade de vínculo:** uma Evidência pertence estritamente a uma única Ação e a uma única Tratativa por toda a sua existência; nunca é transferida entre Ações nem entre Tratativas.
- **Isolamento de binários:** o conteúdo binário bruto nunca é persistido nas tabelas relacionais do banco de dados (R5).
- **Auditoria imutável obrigatória:** toda inclusão e remoção de Evidência gera registro de histórico; nunca há alteração ou exclusão silenciosa na plataforma (AGENTS.md:40).
- **Rastreabilidade de acesso a dados sensíveis:** todo download de arquivo binário gera registro de histórico prévio `DownloadEvidencia`; nunca é silencioso (LGPD; AGENTS.md:66).
- **Exclusão estritamente lógica:** a remoção de Evidência na plataforma é sempre lógica (`ativo = false`) para conformidade legal.
- **Bloqueio inviolável de conclusão:** uma Ação com `evidenciaObrigatoria = true` nunca transita para o Status `Concluída` sem possuir ao menos uma Evidência ativa vinculada (R8).
- **Menor privilégio LGPD:** usuários que não sejam o Gestor de Tratativa nem o Responsável da respectiva Ação/Subação nunca têm acesso ao download nem à matrícula de quem anexou (R11).
- **Bloqueio do aplicativo de origem:** o Aplicativo de origem nunca inclui, remove, lista nem baixa arquivos de Evidência (403 estático no início do handler).
- **Generalidade corporativa:** nenhuma regra ou limite de Evidência é específico de uma área ou Origem (AGENTS.md:36).
- **Estabilidade dos testes de 004 e 005:** com a aplicação do Ruling R-10 no CA47 do 004, nenhum teste RED de intents anteriores é contrariado, garantindo 100% de estabilidade da suíte existente.

---

## O desconfortável (trade-offs)

1. **Upload em Base64 vs. Streaming binário puro:**
   - *Trade-off:* Base64 expande o tamanho dos dados em ~33%, exigindo tráfego de até ~13,3 MB na rede para um arquivo de 10 MB, e consome memória temporária no heap do Node.js durante a decodificação para `Buffer`.
   - *Por que aceitável:* viabiliza a transacionalidade atômica nativa exigida por R13 e pela D9 (lock pessimista de Tratativa, validação de existência de Ação e gravação atômica em uma única chamada HTTP), sem necessidade de entity sets abertos, estados intermediários "uploading" ou handshakes em duas etapas. Com o limite de 20 MB no body-parser, o heap do servidor suporta a operação com folga no volume esperado do MVP.
2. **Download como Function GET com efeito colateral (auditoria LGPD) e sem lock pessimista (exceção à D9) (M2):**
   - *Trade-off:* o download de Evidência executa escrita no banco (`INSERT` de `DownloadEvidencia`) dentro de uma chamada HTTP GET, e faz isso sem adquirir lock exclusivo na Tratativa (`SELECT ... FOR UPDATE`).
   - *Por que aceitável:* a escrita é estritamente append-only de auditoria de acesso sem tocar nem depender de status de negócio da Tratativa. Se adquirisse lock exclusivo na Tratativa, dois usuários baixando anexos simultaneamente seriam serializados, degradando a experiência de visualização sem nenhum ganho de consistência. Se o repositório de arquivos falhar ou devolver `null` para o arquivo, a chamada falha com 500 sem entregar conteúdo corrompido.
3. **Armazenamento de produção entregue no intent 014 (I7):**
   - *Trade-off:* o dublê em memória (`test/apoio/armazenamento-espiao.ts`) atende aos testes automatizados, mas o armazenamento de produção (Object Store / DMS com bindings BTP e `cds.requires` reais) fica como pré-requisito e entrega de infraestrutura no intent 014.
   - *Por que aceitável:* mantém a regra inviolável de testes rápidos sem serviços reais de nuvem (AGENTS.md:38) e isola o deploy de infraestrutura do escopo de regras de negócio do intent 006.

---

## Decisões que exigem o humano (Gate 1)

As decisões de requisitos Q1 a Q19 foram deliberadas pelo orquestrador por delegação do humano em 2026-10-08 e aguardam ratificação formal no Gate 1:
- **Q1 (R1):** Vínculo exclusivo de Evidência à Ação/Subação (sem evidência avulsa direta na Tratativa).
- **Q2 (R1):** Limite de 0 a 10 evidências ativas por Ação.
- **Q3 (R2):** Metadados persistidos (UUID, Tratativa, Ação, Nome sanitizado 1-255, MIME 1-100, Tamanho, Descrição até 500, Data, Matrícula).
- **Q4 (R3):** Formatos permitidos (JPG, PNG, PDF, DOCX, DOC, TXT, XLSX, XLS, CSV) com validação declarativa e recusa 415.
- **Q5 (R4):** Limite de 10 MB por arquivo e recusa 400 para arquivo vazio.
- **Q6 (R5):** Armazenamento desacoplado de binários fora do banco relacional com serviço CAP `ArmazenamentoEvidencias`.
- **Q7 (R6):** Permissão de inclusão/remoção estrita ao Gestor de Tratativa e Responsável da Ação.
- **Q8 (R7):** Estados permitidos (Tratativa Aberta/Em andamento, Ação Pendente/Em andamento).
- **Q9 (R8, R15):** Bloqueio de conclusão da Ação com Evidência obrigatória com código 409 e mensagem padronizada na etapa 10 (compatibilizado via Ruling R-10).
- **Q10 (R9):** Sinalização de pendências via function dedicada `listarPendenciasEvidenciasTratativa` (I8).
- **Q11 (R10):** Remoção estritamente lógica sem expurgo físico automático no MVP.
- **Q12 (R11):** Visibilidade de anexos e menor privilégio (matrículas ocultas como null para não-Gestor; Responsável Principal e Participantes recebem lista vazia e 403 no download).
- **Q13 (R12):** Auditoria imutável nos eventos `InclusaoEvidencia`, `RemocaoEvidencia` e `DownloadEvidencia` sem copiar Nome do arquivo para o histórico.
- **Q14 (R13):** Atomicidade, serialização D9 para escrita e download sem bloqueio pessimista como exceção à D9.
- **Q15 (R14):** Precedência de recusas com limite de corpo de 20 MB no runtime (413), exceção de URL em functions (I3) e validações de arquivo no domínio na etapa 10 (413/415).
- **Q16 (R17):** Extensão formal das specs 004 e 005 sem alteração retroativa de arquivos aprovados.
- **Q17 (R11 b):** Consulta dedicada `listarEvidenciasTratativa` preservando o contrato de 12 chaves de `consultarTratativa` de 003 intacto.
- **Q18 (R12):** Guarda temporária sob remoção lógica sem rotina de expurgo físico no MVP (retenção definitiva para o intent 014).
- **Q19 (R6):** Ausência de papel de Aprovador Técnico e workflow no MVP.

### Itens N3 (aguardam aprovação no Gate 1)
- **N3-1 (deploy/infra):** Abstração de armazenamento desacoplado de binários como serviço CAP (`ArmazenamentoEvidencias`): dublê em memória isolado em `test/apoio/` no MVP; binding e configuração de Object Store / DMS em produção entregues no intent 014 (R5; I6, I7).
- **N3-2 (deploy/infra):** Configuração do limite de corpo HTTP do runtime em 20 MB no `package.json` (`cds.server.body_parser.limit = "20mb"`), afetando a infraestrutura do servidor Express/CAP (R14; I2).
- **N3-3 (autorização/segurança):** Autorização com grant `{ grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }` no `@restrict` do CDS, recusa estática de `AplicativoOrigem` no `before('*')`, e autorização dinâmica no domínio restrita ao Gestor de Tratativa e ao Responsável da respectiva Ação/Subação (R6, R11; C2).
- **N3-4 (LGPD):** Dados pessoais e sensíveis em Evidências: laudos e fotos com `@PersonalData`, `EntitySemantics: 'Other'`, `@PersonalData.IsPotentiallyPersonal` em `nomeArquivo` e `descricao`, omissão de matrículas como `null` para não-Gestores, histórico sem nome de arquivo, auditoria mandatória prévia `DownloadEvidencia` e retenção sob remoção lógica (R2, R10, R11, R12; I7).
- **N3-5 (contrato público OData V4):** Novas actions ligadas `anexarEvidencia` e `removerEvidencia` no entity set `Tratativas`, e novas functions públicas `listarEvidenciasAcao`, `listarEvidenciasTratativa`, `baixarEvidencia` e `listarPendenciasEvidenciasTratativa` no contrato OData V4 em `/api/tratativa/v1` (R11, R17; I1, I8).
- **N3-6 (contrato de erros):** Extensão formal do catálogo de erros da decisão D10 com os códigos HTTP 413 (runtime para corpo > 20 MB e domínio para arquivo entre 10 MB e 14 MB) e 415 (domínio para formato/MIME inválido) (R4, R14, R17; I2).

**Registro do Gate 1 (2026-10-09):** decisões e itens N3 aprovados pelo orquestrador, por delegação do humano (D11). Rulings em `agentic/.estado/execucao/2026-10-08-evidencias/progress.md`. Branch empilhada sobre `responsaveis-e-participantes/001-responsaveis-e-participantes`.
