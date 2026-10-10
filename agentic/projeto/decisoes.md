# Registro de decisões

Cada decisão vale para o projeto inteiro até ser revogada. Nunca apague uma decisão: mova-a para "Decisões revogadas" com a data e o motivo.

## Vigentes

### D1 — Stack e comandos de verificação
- **Decisão:** Backend SAP CAP em Node.js + TypeScript (cds-typer), HANA Cloud em produção, testes com jest + `cds.test` em SQLite em memória, relatório JUnit via jest-junit em `reports/junit/`. Comandos expostos como scripts npm: `build` (cds-typer + `tsc --noEmit` + `cds build`), `lint` (ESLint + `@sap/eslint-plugin-cds`), `test` (jest), `arch` (dependency-cruiser). `CMD_VERIFY_STACK = npm run build && npm run lint && npm test && npm run arch`.
- **Por quê:** stack padrão SAP para BTP; TypeScript dá tipos do modelo CDS aos handlers; SQLite em memória torna os testes rápidos e independentes de HANA.
- **Consequência:** a primeira task (scaffold, trilha rápida) cria `package.json` com esses scripts; até lá o `verify.sh` falha (pendência registrada em `agentic/projeto/bootstrap.md`). Recursos exclusivos de HANA exigem nova decisão.
- **Verificado por:** `verify.sh`
- **Data:** 2026-10-06

### D2 — Fronteiras de arquitetura com dependency-cruiser
- **Decisão:** `npm run arch` roda `depcruise` com `.dependency-cruiser.cjs`: `app/` não importa `srv/`; `db/` não depende de `srv/` nem `app/`; SDKs/clients externos (SuccessFactors, e-mail, Teams) só em `srv/integracoes/`.
- **Por quê:** manter o núcleo genérico (Origem/Tratativa) isolado das integrações e da UI.
- **Consequência:** baseline pelo mecanismo da ferramenta (`depcruise --output-type baseline > .dependency-cruiser-known-violations.json`); projeto novo, baseline vazio — não criar sem decisão.
- **Verificado por:** `verify.sh` (via `npm run arch`)
- **Data:** 2026-10-06

### D3 — PRs no GitHub, sem CI por enquanto
- **Decisão:** PRs criados com `gh pr create`; merge sempre humano (Gate 2), sem squash. Não há CI: a verificação é o `verify.sh` local + githooks.
- **Por quê:** escolha do mantenedor para o início do projeto.
- **Consequência:** ao adotar CI, o workflow chama `sh agentic/mecanismos/scripts/verify.sh` e só passa a valer depois de provado verde num PR de teste (nova decisão).
- **Verificado por:** por revisão
- **Data:** 2026-10-06

### D4 — Frontend Fiori elements no repositório
- **Decisão:** a UI é Fiori elements/UI5 em `app/<app>/`, dirigida por anotações CDS, publicada no SAP Build Work Zone. SAP Build Apps (citado na proposta) fica fora deste repositório.
- **Por quê:** UI versionada e testável junto com o serviço; menos acoplamento a ferramenta low-code.
- **Consequência:** consumidores externos (Build Apps, Power BI/SAC) usam o OData do CAP; mudanças nesse contrato são N3.
- **Verificado por:** por revisão
- **Data:** 2026-10-06

### D5 — Gates e modo automático
- **Decisão:** Gate 1 e Gate 2 aprovados por Paulo Calazans; `agentic/auto-mode` começa com `enabled: false`.
- **Por quê:** acompanhar as primeiras tasks antes de liberar o encadeamento automático.
- **Consequência:** ligar o modo automático é ação humana e ganha uma nova decisão.
- **Verificado por:** por revisão
- **Data:** 2026-10-06

### D6 — Contratos de integração versionados
- **Decisão:** vale só para serviços cujo consumidor é um sistema de terceiros (hoje, `IntegracaoOrigemService`): caminho `/api/<serviço>/v<n>`, só actions/functions com tipos de retorno explícitos, sem entity sets; mudança incompatível cria `v<n+1>`. Serviços consumidos pela UI própria ou pela administração (`TratativaService`, `AdministracaoService`) usam o mesmo padrão de caminho por consistência, mas não ficam presos a "sem entity sets"; mudanças neles continuam N3 pela D4.
- **Por quê:** terceiros dependem de um contrato estável e mínimo; a UI própria precisa evoluir com liberdade.
- **Consequência:** mudança incompatível em serviço de terceiros exige nova versão do caminho.
- **Verificado por:** por revisão
- **Data:** 2026-10-07

### D7 — Autorização de aplicativos externos
- **Decisão:** papel `AplicativoOrigem` + registro `CredenciaisAplicativo` verificado a cada pedido; revogação pela plataforma.
- **Por quê:** a decisão "esta credencial vale" fica na plataforma, revogável sem redeploy e testável em SQLite.
- **Consequência:** emissão e revogação são feitas pelo Administrador em `AdministracaoService`.
- **Verificado por:** testes da spec abertura-por-apps-de-origem (`test/administracao.test.ts` e os da task de credenciais)
- **Data:** 2026-10-07

### D8 — Handlers TypeScript
- **Decisão:** handlers em `srv/<serviço>.ts` com `CDS_TYPESCRIPT=true` nos testes; empacotamento de produção (compilação para `gen/srv`) é decisão pendente da task de deploy.
- **Por quê:** o CAP só carrega `.ts` sob jest com essa variável (medido no CAP 10.1.1).
- **Consequência:** a task de deploy decide como compilar os handlers para produção.
- **Verificado por:** `npm test`
- **Data:** 2026-10-07

### D9 — Serialização por agregado
- **Decisão:** toda operação que lê uma Tratativa para decidir e depois escreve sobre ela (e, nos intents seguintes, sobre Ações e Responsáveis dela) começa com `bloquearTratativa(codigo)` (`srv/tratativa/bloqueio.ts`: `SELECT ... FOR UPDATE` sem `.one` e sem `LIMIT`) na transação do pedido, e bloqueia a Tratativa antes de qualquer outra linha; nenhuma decisão usa leitura anterior ao bloqueio.
- **Por quê:** no HANA o isolamento padrão é READ COMMITTED; sem bloqueio, dois pedidos simultâneos leem o mesmo estado e ambos gravam (dois Encerramentos, Criticidade e Data prevista de pedidos diferentes). Bloquear sempre a Tratativa primeiro evita ciclo de bloqueios entre operações.
- **Consequência:** 004 e 005 bloqueiam a Tratativa antes de tocar Ações ou Responsáveis; o SQLite dos testes não emite `FOR UPDATE` (o pool de 1 conexão já serializa), então a prova automatizada é estrutural e o comportamento no HANA é conferido no primeiro deploy (intent 014).
- **Verificado por:** espião `cds.db.before` (`test/apoio/banco-espiao.ts`, `bloqueiaAntesDeEscrever`) nos testes das etapas 1, 3 e 4 da task tratativa/001 (CA45, CA46, CA72); medição do renderizador SQL genérico registrada no design da spec tratativa (decisão 6)
- **Data:** 2026-10-07

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

### D10 (extensão pelo intent 006) — Extensão do contrato de recusas para arquivos e Evidências
- **Decisão:** o contrato de recusas da D10 é estendido com os códigos HTTP 413 (Payload Too Large) e 415 (Unsupported Media Type):
  1. No runtime (etapa 2 de forma do pedido): requisições HTTP cujo corpo exceda o limite configurado de 20 MB (correspondendo a arquivos acima de ~15 MB em Base64) são recusadas pelo framework com HTTP 413 antes de qualquer handler ou avaliação de papel (inclusive do Aplicativo de origem).
  2. No domínio (etapa 10 de campos, após validação de existência, autorização dinâmica e estados): arquivo vazio (0 bytes) é recusado com HTTP 400 (`target: arquivo`); formato de arquivo não permitido, extensão e tipo MIME incompatíveis ou MIME superior a 100 caracteres são recusados com HTTP 415 (`target: arquivo`); arquivo com tamanho entre 10.485.761 bytes e ~14 MB (que passa pelo runtime de 20 MB mas excede o limite de domínio de 10 MB) é recusado com HTTP 413 (`target: arquivo`).
- **Por quê:** alinha a plataforma à semântica padrão do protocolo HTTP (RFC 7231 / RFC 9110), onde 415 identifica tipos de mídia não suportados e 413 identifica cargas que excedem a capacidade aceita. Mantém a separação da D10 onde a validação de limites de tamanho do domínio ocorre na etapa de campos após o estado, prevenindo o processamento desnecessário de arquivos em ações ou tratativas em estados que já proíbem a alteração (409).
- **Consequência:** o catálogo de erros passa a prever 413 e 415; `srv/tratativa/recusa.ts` suporta esses status codes; o runtime Express/CAP é configurado com limite de 20 MB (`cds.server.body_parser.limit = '20mb'`); testes de integração cobrem a precedência exata dessas recusas.
- **Verificado por:** CA10c, CA13, CA13a, CA15, CA16, CA57b, CA58, CA59, CA59a na suíte de testes de evidências; medição do middleware de body-parser no runtime CAP.
- **Data:** 2026-10-08

## Decisões revogadas

<nenhuma>
