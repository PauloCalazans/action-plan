# Task 001: acoes-hierarquicas

**Spec:** agentic/projeto/specs/plano-de-acao/spec.md  
**Status:** pendente  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** plano-de-acao/001-acoes-hierarquicas

## Objetivo
Entregar o intent 004 inteiro numa branch, em quatro etapas sequenciais RED/GREEN: criação de Ações e Subações com validação de integridade hierárquica e serialização por Tratativa (D9), consulta da estrutura analítica completa com omissão LGPD de dados do Responsável para não-gestores, ciclo de vida das Ações com histórico de transição e condição de encerramento da Tratativa (R16), e edição com histórico de auditoria por campo, conforme desenhado em `agentic/projeto/specs/plano-de-acao/design.md`.

## Arquivos
- `agentic/projeto/decisoes.md`
- `db/tratativa.cds`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/tratativa/dominios.ts`
- `srv/tratativa/historico.ts`
- `srv/tratativa/ciclo-de-vida.ts`
- `srv/tratativa/justificativa.ts`
- `srv/tratativa/acoes-validacao.ts`
- `srv/tratativa/acoes-criacao.ts`
- `srv/tratativa/acoes-consulta.ts`
- `srv/tratativa/acoes-ciclo-de-vida.ts`
- `srv/tratativa/acoes-edicao.ts`
- `test/apoio/acoes.ts`
- `test/criacao-acoes.test.ts`
- `test/consulta-estrutura-acoes.test.ts`
- `test/ciclo-de-vida-acoes.test.ts`
- `test/edicao-acoes.test.ts`
- `test/sem-comunicacao-de-saida-acoes.test.ts`

## Interfaces
- **Produz:**
  - `TratativaService` (`/api/tratativa/v1`) com o CDS da seção "Contrato executável" do design, acrescentado progressivamente por etapa: `criarAcao` e `criarSubacao` (etapa 1), `consultarEstruturaAcoes` e `consultarAcao` com tipos estruturados (etapa 2), `mudarStatusAcao` e condição R16 de encerramento da Tratativa (etapa 3), `editarAcao` sem `responsavel` (etapa 4). Ao final, o arquivo `srv/tratativa-service.cds` é idêntico ao do design.
  - Modelo persistido em `db/tratativa.cds`: `PrioridadeAcao`, `StatusAcao`, `EventoHistoricoAcao`, entidades `Acoes` e `HistoricoAcoes`, e composição aditiva em `Tratativas`.
  - Módulos de domínio em `srv/tratativa/`: `justificativa.ts`, `acoes-validacao.ts`, `acoes-criacao.ts`, `acoes-consulta.ts`, `acoes-ciclo-de-vida.ts`, `acoes-edicao.ts`, e extensões de `dominios.ts`, `historico.ts` e `ciclo-de-vida.ts`.
  - Contrato de erros da tabela do design (mensagens exatas, `target`, códigos HTTP 400, 401, 403, 404, 409).
  - Decisão de plataforma D10 revisada em `agentic/projeto/decisoes.md` (formato D6-D10, pronta para copiar).
  - Pontos de extensão limpos para a spec 005 (a troca de responsável será a action `delegarAcao` no 005; no 004 o responsável é definido exclusivamente na criação e não é editável, com envio em `editarAcao` rejeitado como campo desconhecido pelo runtime; revisão do `@restrict` para o executor; Ruling R-07).
- **Consome:**
  - `TratativaService` existente (002, 003).
  - Infraestrutura do 003: `bloquearTratativa` e `exigirAlteravel` (`bloqueio.ts`), `recusar` (`recusa.ts`), `validarAutor` e `LinhaHistorico` (`historico.ts`), papel `GestorTratativa` (`package.json`).
  - Utilitários existentes: `agora`, `dataCivil` (`srv/lib/relogio.ts`), `codigoValido` (`srv/tratativa/consulta.ts`).
  - Helpers de teste em `test/apoio/`: `usuarios.ts` (`comoGestor`, `comoUsuario`, `comoApp`, `semAuth`), `banco.ts` (`linhas`), `banco-espiao.ts` (`instalarEspiao`, `bloqueiaAntesDeEscrever`), `tratativas.ts` (`criarAvulsa`, `abrirPorApp`, `mudarStatus`, `sufixoUnico`).

## Regras para todas as etapas
- **Commits por etapa:** `test(red): <etapa> …` somente com arquivos de `test/` (e, se necessário, este documento de task); em seguida `feat(green): <etapa> …` com o código de produção. Nunca alterar testes de commits RED anteriores.
- **Arquivo de teste novo por RED:** o script `verifica-red.sh` valida o RED por arquivo novo e exige que os testes novos falhem estritamente no commit RED.
- **Helpers em `test/apoio/` sem asserções:** nenhum helper pode conter chamadas a `expect(`. Todas as asserções pertencem aos arquivos `*.test.ts`.
- **Testes não importam `srv/`:** a interação dos testes de integração ocorre exclusivamente via chamadas OData V4 (`POST`, `GET` do `cds.test`) ou leitura direta do banco via `linhas(...)` de `test/apoio/banco.ts`.
- **Isolamento de concorrência e massa:** utilizar `sufixoUnico()` em títulos e identificadores para evitar colisão no banco compartilhado da mesma suíte.
- **Verificação obrigatória:** rodar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## Etapa 1 — Criação de Ações e Subações (`criarAcao`, `criarSubacao`)
**CAs:** CA1, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10, CA11, CA12, CA13, CA14, CA15, CA16, CA17, CA18, CA19, CA46, CA48, CA56 (criação), CA57, CA59 (criação), CA61 (criação), CA62 (criação), CA69, CA75, CA76 (criação), CA87 (criação), CA90, CA94, CA96, CA97 (mãe inexistente), CA100 (criação), CA105 (criação).

**RED (papel `testes`)** — commit `test(red): criação de Ações e Subações com regras de integridade (R1-R5, R12, R14, R17, R18, R21-R24, R29)`:
- `test/apoio/acoes.ts` (novo, sem `expect`): helpers `criarAcao(POST, tratativa, dados, como)` e `criarSubacao(POST, tratativa, dados, como)` invocando `POST /api/tratativa/v1/Tratativas(<tratativa>)/criarAcao` e `.../criarSubacao`.
- `test/criacao-acoes.test.ts` (novo):
  - CA1, CA3: Gestor cria Ação em Tratativa `Aberta` com Descrição, Responsável e Prazo → 200 `{ codigo }`, status `Pendente`, UUID único; Tratativa não muda.
  - CA4, CA6: cria Ação 1 com Subações 1.1 e 1.2 e Ação 2 sem filhas; Subações pertencem à mesma Tratativa da mãe e gravam mesmos campos.
  - CA5, CA94: tentativa de criar Subação de uma Subação → 400 `Uma Subação não pode ter Subações.`.
  - CA7: criação sem Prioridade e sem Evidência obrigatória, ou enviando `null` em ambos → grava Prioridade `Média`, Evidência obrigatória `false` ("não"), `dataConclusao = null` (revisao-design-parecer-2.md I11).
  - Prioridade enviada com `""` ou só espaços na criação → 400 `Prioridade inválida: use Baixa, Média ou Alta.`, `target = 'prioridade'` (revisao-design-parecer-2.md I11).
  - Evidência obrigatória enviada com `""` ou só espaços na criação → 400 `Evidência obrigatória inválida: use Sim ou Não.`, `target = 'evidenciaObrigatoria'` (revisao-design-parecer-2.md I11).
  - CA8, CA9, CA10: Descrição ausente, só espaços, 501 caracteres → 400 `target = 'descricao'`; 500 caracteres aceito.
  - CA11, CA12: Responsável ausente, 51 caracteres → 400 `target = 'responsavel'`; 50 caracteres aceito.
  - CA13, CA105 (criação): Prazo ausente, formato inválido ("2026-02-30", "amanhã") → 400 `target = 'prazo'`.
  - CA14: envio de `status` ou `dataConclusao` no corpo → 400 runtime campo desconhecido.
  - CA15: Prioridade "Urgente" ou "Media" sem acento → 400 `target = 'prioridade'`; "Alta" e "Média" aceitas (revisao-design-parecer.md I7).
  - CA16: Prioridade não afeta Criticidade nem Prazo da Tratativa.
  - CA17: Prazo anterior a hoje → 400 `Prazo não pode ser anterior a hoje.`; data de hoje aceito.
  - CA18, CA19: Prazo não limitado pela data prevista da Tratativa nem pelo prazo da mãe.
  - CA46, CA100 (criação): Evidência obrigatória `"sim"` aceita; valor `"talvez"` recusado com 400 `target = 'evidenciaObrigatoria'`.
  - CA48: criar Ação em Tratativa `Aberta` não altera status da Tratativa.
  - CA56 (criação), CA57: criar Ação em Tratativa `Encerrada` ou `Cancelada` → 409 `Tratativa <Status> não pode ser alterada.`.
  - CA59 (criação), CA61 (criação), CA62 (criação): usuário comum (403 runtime), aplicativo de origem (403; o teste verifica apenas o status HTTP 403), anônimo (401 runtime).
  - CA69, CA75: histórico de `Criacao` gravado em `HistoricoAcoes` com autor, `tipoAutor = 'Usuario'`, sem a Descrição.
  - CA76 (criação): falha injetada no `INSERT` de `HistoricoAcoes` → rollback total da Ação.
  - CA87 (criação): criação funciona igualmente em Tratativa de aplicativo e avulsa.
  - CA90, CA96, CA97 (mãe inexistente): precedência D10 em criação de Ação e Subação: 401 anônimo, 403 não-gestor, 400 forma e campos desconhecidos; envio de booleano JSON em `evidenciaObrigatoria: true` em Tratativa inexistente → 400 runtime (`ASSERT_DATA_TYPE`) antes da existência (revisao-design-parecer-2.md I9); parâmetro `acaoMae` malformado, ausente ou nulo (`acaoMae: 'xyz'`, `acaoMae: null` ou omitido em `criarSubacao` → 400 `Código inválido.`, `target: acaoMae`; revisao-design-parecer.md I1, Ruling R-06 M-j); chave de Tratativa malformada na URL (`POST Tratativas('xyz')/criarAcao`) → 404 `Tratativa não encontrada.`, idêntico ao 003 (revisao-design-parecer-2.md I9); mãe inexistente ou de outra Tratativa → 404 `Ação não encontrada.`; mãe inexistente em Tratativa `Encerrada` → 404 `Ação não encontrada.` (existência completa antes de R17 409; revisao-design-parecer-2.md I10); R17 Tratativa alterável (409); R2 Subação de Subação (400 `Uma Subação não pode ter Subações.`); campos (400).
  - Teste com UUID em maiúsculas na chave da URL e em `acaoMae` tratado via `toLowerCase()` (revisao-design-parecer-2.md M-c).
- Falha esperada no RED: actions `criarAcao` e `criarSubacao` inexistentes (404/501).

**GREEN (papel `dev`)** — commit `feat(green): criação de Ações e Subações com integridade e serialização por Tratativa (R1-R5, R12, R14, R17, R18, R21-R24, R29)`:
- `db/tratativa.cds`: tipos `PrioridadeAcao`, `StatusAcao`, `EventoHistoricoAcao`, entidades `Acoes` e `HistoricoAcoes`, e composição aditiva `acoes` em `Tratativas`.
- `agentic/projeto/decisoes.md`: atualizar D10 para o texto da D10 revisada constante no design.
- `srv/tratativa/dominios.ts`: funções `prioridadesValidas()` e `statusAcaoValidos()`.
- `srv/tratativa/historico.ts`: parametrizar `registrarHistorico` para aceitar entidade e campos de referência (Tratativa ou Ação) mantendo compatibilidade retroativa com a assinatura usada por `criticidade.ts` e `edicao.ts` (revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g).
- `srv/tratativa/justificativa.ts` (novo): extração da função pura `validarJustificativa` (a lógica inline de validação de justificativa em `srv/tratativa/ciclo-de-vida.ts:37-43` é extraída para este módulo neutro compartilhado sem alterar o comportamento do 003), reaproveitada por Ações e Tratativa, evitando acoplamento entre `ciclo-de-vida.ts` e `acoes-*` (revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g, Ruling R-06 M-m).
- `srv/tratativa/acoes-validacao.ts`: validações puras de `descricao`, `responsavel`, `prazo`, `prioridade` (exata, sem normalizar "Media") e `evidenciaObrigatoria`, tratando omitido ou `null` na criação como valor padrão, e `""` ou só espaços como 400 nomeando o campo (revisao-design-parecer-2.md I11).
- `srv/tratativa/acoes-criacao.ts`: implementação de `criarAcao` e `criarSubacao` com a ordem explícita: `acaoMae` com `codigoValido` (400 `Código inválido.`, `target: acaoMae`; ausente ou null como `String(x)`; revisao-design-parecer.md I1, Ruling R-06 M-j) → `bloquearTratativa(codigoTratativa)` (404 `Tratativa não encontrada.` se inexistente ou com chave malformada na URL; revisao-design-parecer-2.md I9) → mãe existe e pertence à Tratativa (404 `Ação não encontrada.`; a existência precede qualquer 409; revisao-design-parecer-2.md I10) → Tratativa alterável R17 (409) → R2 Subação de Subação (400) → validação de campos (400) e persistência atômica com bloqueio pessimista D9.
- `srv/tratativa-service.cds`: declaração de `ResultadoCriacaoAcao`, actions `criarAcao` e `criarSubacao` ligadas a `Tratativas` com `@restrict` para `GestorTratativa`.
- `srv/tratativa-service.ts`: handlers delegando para `acoes-criacao.ts` aplicando `toLowerCase()` na chave da URL e no parâmetro `acaoMae` (revisao-design-parecer-2.md M-c).

---

## Etapa 2 — Consulta e estrutura de Ações (`consultarEstruturaAcoes`, `consultarAcao`)
**CAs:** CA2, CA61 (consulta), CA62 (consulta), CA79, CA80, CA81, CA82, CA83, CA84, CA85, CA103.

**RED** — commit `test(red): consulta da estrutura hierárquica e detalhe com proteção LGPD do Responsável (R25, R26, R27)`:
- `test/apoio/acoes.ts`: adicionar helpers `consultarEstruturaAcoes(GET, tratativa, como)` e `consultarAcao(GET, tratativa, codigo, como)`.
- `test/consulta-estrutura-acoes.test.ts` (novo):
  - CA2: Tratativa sem Ações → `consultarEstruturaAcoes` devolve `[]`.
  - CA61 (consulta), CA62 (consulta): consulta de estrutura ou Ação por aplicativo de origem recebe 403 (o teste verifica apenas o status HTTP 403); usuário anônimo recebe 401 runtime (revisao-design-parecer.md I4, revisao-design-parecer.md I6).
  - CA79: Ação 1 com Subações 1.1 e 1.2 aninhadas e Ação 2 sem filhas retornadas na ordem de criação.
  - CA80: `consultarAcao` com código de Ação traz campos, `acaoMae = null` e Subações aninhadas.
  - CA81: Tratativa inexistente → 404 `Tratativa não encontrada.`; Ação inexistente ou Ação de outra Tratativa → 404 `Ação não encontrada.` (revisao-design-parecer-2.md I12).
  - CA82: ordenação estável por `criadoEm ASC, codigo ASC`.
  - CA83: usuário autenticado sem papel Gestor → campo `responsavel` vem `null` em todos os níveis (estrutura e detalhe, inclusive nas filhas aninhadas).
  - CA84: GestorTratativa consulta → campo `responsavel` vem preenchido com a matrícula.
  - CA85: consulta do aplicativo (/v1) inalterada com 7 campos e nada sobre Ações.
  - CA103: consulta de Subação traz código da mãe; consulta sem o parâmetro da Tratativa recusa com 400 citando `tratativa` em `consultarEstruturaAcoes` e `consultarAcao` (revisao-design-parecer.md M5); código malformado (`tratativa` ou `codigo`) recusa com 400 `Código inválido.` com `target` correspondente (revisao-design-parecer.md I1).
- Falha esperada no RED: functions `consultarEstruturaAcoes` e `consultarAcao` inexistentes.

**GREEN** — commit `feat(green): consulta de estrutura e detalhe de Ações com omissão LGPD de Responsável (R25, R26, R27)`:
- `srv/tratativa-service.cds`: tipos `ItemSubacaoEstrutura`, `ItemEstruturaAcao`, `DetalheAcao`, e functions `consultarEstruturaAcoes` e `consultarAcao`.
- `srv/tratativa/acoes-consulta.ts`: funções `consultarEstruturaAcoes(codigoTratativa, verResponsavel)` e `consultarAcao(codigoTratativa, codigoAcao, verResponsavel)` com validação de presença de `tratativa` (400 `target: tratativa`; revisao-design-parecer.md M5) e validação de formato de códigos com `codigoValido` de `srv/tratativa/consulta.ts` (400 `Código inválido.`; revisao-design-parecer.md I1, revisao-design-parecer-2.md M-a) antes de buscar no banco. Tratativa inexistente devolve 404 `Tratativa não encontrada.`; Ação inexistente ou de outra Tratativa devolve 404 `Ação não encontrada.` (revisao-design-parecer-2.md I12).
- `srv/tratativa-service.ts`: handlers para `consultarEstruturaAcoes` e `consultarAcao` aplicando `toLowerCase()` nos parâmetros de código `tratativa` e `codigo` (revisao-design-parecer-2.md M-c) e passando `req.user.is('GestorTratativa')`.

---

## Etapa 3 — Ciclo de vida das Ações e Encerramento da Tratativa (`mudarStatusAcao`, R16 em `mudarStatus`)
**CAs:** CA22, CA23, CA24, CA25, CA26, CA27, CA29, CA30, CA31, CA32, CA33, CA34, CA35, CA36, CA37, CA38, CA39, CA40, CA41, CA42, CA43, CA44, CA45, CA47, CA49, CA50, CA51, CA52, CA53, CA54, CA55, CA56 (transição), CA58 (reabertura), CA59 (transição), CA60, CA61 (transição), CA62 (transição), CA70, CA73, CA76 (transição), CA77, CA78, CA87 (conclusão), CA88, CA89, CA91, CA92, CA93, CA95, CA97 (transição), CA98, CA102, CA104, CA106.

**RED** — commit `test(red): transições de Status da Ação, integridade mãe-filhas e encerramento de Tratativa (R6-R13, R16, R17, R18, R22, R24, R29)`:
- `test/apoio/acoes.ts`: adicionar helper `mudarStatusAcao(POST, tratativa, dados, como)`.
- `test/ciclo-de-vida-acoes.test.ts` (novo):
  - CA22, CA23, CA24, CA25, CA26: transições válidas de Ação via `mudarStatusAcao` → 204 e status alterado no banco.
  - CA27: Ação `Cancelada` não aceita saída → 409 `Transição não permitida: de Cancelada para <pedido>.`.
  - CA29, CA30, CA31: transição para o mesmo status ou proibida → 409 e status inalterado.
  - CA32, CA33, CA34: justificativa obrigatória em cancelar/reabrir (400 ausente/vazia/501 chars citando `justificativa`); opcional em iniciar/concluir.
  - CA35, CA36: conclusão grava data do dia em `dataConclusao`; reabertura apaga `dataConclusao` para null.
  - CA37: envio de `dataConclusao` no corpo → 400 runtime campo desconhecido.
  - CA38, CA39, CA40: concluir ou cancelar mãe com Subações abertas → 409 `A Ação possui Subações não concluídas nem canceladas.`; filhas concluídas/canceladas aceito.
  - CA41, CA45, CA102: Ação mãe não conclui automaticamente; transições de filhas não alteram status da mãe.
  - CA42, CA44, CA95: criar Subação sob mãe `Concluída` ou `Cancelada` (estados atingidos via `mudarStatusAcao`) → 409 `A Ação mãe está <Status> e não aceita esta alteração.` (revisao-design-parecer.md I5).
  - CA43: reabrir Subação com mãe `Concluída` → 409; após reabrir a mãe, reabertura da Subação aceita.
  - CA47: Ação com Evidência obrigatória "sim" conclui sem bloqueio neste intent.
  - CA49: Tratativa não conclui nem muda status automaticamente quando Ações concluem.
  - CA50, CA51, CA53: encerramento de Tratativa com Ação ou Subação aberta → 409 `Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.`.
  - CA52, CA54: encerramento de Tratativa com todas as Ações finalizadas ou sem nenhuma Ação → 204 aceito.
  - CA55: cancelamento de Tratativa com Ações abertas aceito sem alterar status das Ações.
  - CA56 (transição), CA58 (reabertura): transição de Ação em Tratativa `Encerrada` ou `Cancelada` → 409 `Tratativa <Status> não pode ser alterada.`; após reabrir a Tratativa, aceito.
  - CA59 (transição), CA60, CA61 (transição), CA62 (transição): permissão: só Gestor executa transições; usuário comum que não é o Responsável da Ação tenta transição (CA59 iniciar, CA60 concluir) em Ação existente com payload válido (403); aplicativo de origem (403; o teste verifica apenas o status HTTP 403); anônimo (401 runtime).
  - CA70, CA73, CA88, CA89: histórico de transições (`MudancaStatus`, `Conclusao`, `Reabertura`, `Cancelamento`) com valores e justificativa.
  - CA76 (transição): falha injetada no `INSERT` de `HistoricoAcoes` durante transição → rollback atômico do status da Ação (revisao-design-parecer.md I6).
  - CA77 + D9: duas conclusões simultâneas da mesma Ação → 204 e 409 `de Concluída para Concluída`, exatamente um histórico; bloqueio prévio visível.
  - CA78 + D9: encerramento de Tratativa e criação de Ação simultâneos → resultado consistente com R16/R17.
  - CA87 (conclusão): conclusão de Ações funciona identicamente em Tratativa de aplicativo e avulsa (revisao-design-parecer.md I6).
  - CA91, CA92, CA93: precedência D10 em transição: código ausente, nulo ou malformado (`acao: 'xyz'`, `acao: null` ou omitido → 400 `Código inválido.`, `target: acao`; revisao-design-parecer.md I1, Ruling R-06 M-j) → Tratativa inexistente ou com chave malformada na URL (404 `Tratativa não encontrada.`; revisao-design-parecer-2.md I9) → Ação inexistente ou de outra Tratativa (404 `Ação não encontrada.`) → estado da Tratativa (409) → Status de destino ausente ou só espaços (400 `O campo Status é obrigatório.`, `target: status`; revisao-design-parecer.md I3, revisao-design-parecer-2.md M-f) → par fora da tabela (409 `target: status`) → relação mãe-filhas R11/R12 (409) → justificativa (400).
  - CA97 (transição), CA98, CA104: Ação inexistente (404), Ação de outra Tratativa (404); Ação inexistente em Tratativa `Encerrada` recusa com 404 (existência completa antes de qualquer 409; revisao-design-parecer.md I2); no encerramento da Tratativa, Tratativa `Cancelada` recusa com 409 de transição antes de R16 (CA104); e R16 recusa com 409 antes da validação de tamanho da justificativa (revisao-design-parecer.md M4).
  - CA106: precedência em transição sem destino informado: Gestor pede mudar status de Ação `Cancelada` em Tratativa `Aberta` sem informar status de destino (ou só com espaços) → recusa com 400 `O campo Status é obrigatório.` (status ausente precede estado da Ação); mesmo pedido em Tratativa `Encerrada` → 409 `Tratativa Encerrada não pode ser alterada.` (estado da Tratativa precede status ausente; Ruling R-06 I13).
- Falha esperada no RED: action `mudarStatusAcao` inexistente; encerramento de Tratativa com ações abertas aceito sem a checagem R16.

**GREEN** — commit `feat(green): ciclo de vida de Ações com integridade mãe-filha e encerramento estendido da Tratativa (R6-R13, R16, R17, R18, R22, R24, R29)`:
- `srv/tratativa-service.cds`: action `mudarStatusAcao` ligada a `Tratativas` com `@restrict` para `GestorTratativa`.
- `srv/tratativa/acoes-criacao.ts`: implementar validação R12 em `criarSubacao` (se a mãe estiver `Concluída` ou `Cancelada` recusa com 409 `A Ação mãe está <Status> e não aceita esta alteração.`, posicionado após R2 e antes dos campos; CA42, CA44, CA95; revisao-design-parecer-2.md I10).
- `srv/tratativa/acoes-ciclo-de-vida.ts`: função `mudarStatusAcao(codigoTratativa, codigoAcao, pedido, autor)` com ordem estrita de precedência: código válido (400 `target: acao`; ausente ou null como `String(x)`; revisao-design-parecer.md I1, Ruling R-06 M-j) → bloqueio de Tratativa (404 `Tratativa não encontrada.` se inexistente ou malformada na URL; revisao-design-parecer-2.md I9) → existência e pertencimento da Ação (404; revisao-design-parecer.md I2) → Tratativa alterável R17 (409) → Status de destino ausente (400 `target: status`; revisao-design-parecer.md I3, revisao-design-parecer-2.md M-f) → par na tabela fixa (409) → regras mãe-filhas R11/R12 (409) → justificativa via `validarJustificativa` de `srv/tratativa/justificativa.ts` (400; revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g) e gravação atômica de histórico.
- `srv/tratativa/ciclo-de-vida.ts`: extensão de `mudarStatus` da Tratativa para incluir a validação R16 (409) antes da checagem de tamanho da justificativa (revisao-design-parecer.md M4), reaproveitando `validarJustificativa` de `srv/tratativa/justificativa.ts` (revisao-design-parecer.md M3, revisao-design-parecer-2.md M-g, Ruling R-06 M-m).
- `srv/tratativa-service.ts`: handler para `mudarStatusAcao` aplicando `toLowerCase()` na chave da URL e no parâmetro `acao` (revisao-design-parecer-2.md M-c).

---

## Etapa 4 — Edição de Ações e auditoria detalhada (`editarAcao`)
**CAs:** CA20, CA21, CA28, CA56 (edição), CA58 (edição), CA59 (edição), CA61 (edição), CA62 (edição), CA63, CA64, CA65, CA66, CA67, CA68, CA71, CA72, CA74, CA76 (edição), CA86, CA97 (edição), CA99, CA100 (edição), CA101, CA105 (edição).

**RED** — commit `test(red): edição de Ações pelo Gestor com auditoria de campos alterados (R5, R7, R17-R20, R22-R24, R27, R28)`:
- `test/apoio/acoes.ts`: adicionar helper `editarAcao(POST, tratativa, dados, como)`.
- `test/edicao-acoes.test.ts` (novo):
  - CA20, CA21: reenviar o mesmo prazo passado não revalida contra hoje; atraso não é Status.
  - CA28: não há operação/endpoint para excluir Ação.
  - CA56 (edição), CA58 (edição): edição em Tratativa `Encerrada` ou `Cancelada` → 409; após reabrir a Tratativa, aceito.
  - CA59 (edição), CA61 (edição), CA62 (edição): edição por usuário comum (403 runtime), aplicativo de origem (403; o teste verifica apenas o status HTTP 403), anônimo (401 runtime).
  - CA63: edição dos quatro campos editáveis (`descricao`, `prazo`, `prioridade`, `evidenciaObrigatoria`) grava novos valores sem alterar o `responsavel`.
  - CA64, CA67, CA68: envio de campos não permitidos (`codigo`, `tratativa`, `acaoMae`, `responsavel`, `status`, `dataConclusao`) → 400 runtime campo desconhecido (`Property "<x>" does not exist in editarAcao`; Ruling R-07).
  - CA65: edição em Ação `Concluída` ou `Cancelada` → 409 `Ação <Status> não pode ser alterada.`.
  - CA66: edição enviando `null` ou só espaços em campos obrigatórios (`descricao`, `prazo`, `prioridade`, `evidenciaObrigatoria`) → recusa com 400 `O campo <Nome> é obrigatório.` com `target` do campo, e nada é alterado no banco (nenhum campo é apagável; revisao-design-parecer.md I8).
  - CA71: edição que altera só o Prazo grava histórico de `Edicao` apenas para o campo Prazo (sem histórico de Responsável).
  - CA72: edição reenviando os mesmos valores → 204 sem alteração e sem histórico.
  - CA74: edição de Descrição grava histórico sem copiar texto anterior nem novo (`null`).
  - CA76 (edição), CA99: falha injetada no histórico da edição → rollback atômico de todos os campos alterados.
  - CA97 (edição): código ausente, nulo ou malformado (`acao: 'xyz'`, `acao: null` ou omitido → 400 `Código inválido.`, `target: acao`; revisao-design-parecer.md I1, Ruling R-06 M-j), Tratativa inexistente ou com chave malformada na URL (404 `Tratativa não encontrada.`; revisao-design-parecer-2.md I9), Ação inexistente (404 `Ação não encontrada.`), Ação de outra Tratativa (404 `Ação não encontrada.`); Ação inexistente em Tratativa `Encerrada` devolve 404 (existência precede 409; revisao-design-parecer-3.md M-k).
  - CA100 (edição): Evidência obrigatória na edição aceita `"sim"` e `"não"`; valor inválido (ex.: `"talvez"`) recusa com 400 `target = 'evidenciaObrigatoria'` (revisao-design-parecer.md I6).
  - CA101: alterar prazo para data anterior a hoje → 400 `Prazo não pode ser anterior a hoje.`; hoje ou futuro aceito.
  - CA105 (edição): Prazo malformado na edição ("2026-02-30", "amanhã") → 400 `target = 'prazo'` (revisao-design-parecer.md I6).
- `test/sem-comunicacao-de-saida-acoes.test.ts` (novo):
  - CA86: espiões de `fetch` e `https.request` durante operações de Ação confirmam zero chamadas externas.
- Falha esperada no RED: action `editarAcao` inexistente.

**GREEN** — commit `feat(green): edição de Ações com histórico por campo e rollback atômico (R5, R17-R20, R22-R24, R27, R28)`:
- `srv/tratativa-service.cds`: action `editarAcao` ligada a `Tratativas` com `@restrict` para `GestorTratativa` (sem parâmetro `responsavel`, Ruling R-07).
- `srv/tratativa/acoes-edicao.ts`: função `editarAcao(codigoTratativa, codigoAcao, campos, autor)` recebendo apenas `descricao`, `prazo`, `prioridade`, `evidenciaObrigatoria` com ordem estrita: validar código da Ação com `codigoValido` (400 `target: acao`; ausente ou null como `String(x)`; revisao-design-parecer.md I1, Ruling R-06 M-j) → bloquear Tratativa (404 `Tratativa não encontrada.` se inexistente ou com chave malformada na URL; revisao-design-parecer-2.md I9) → existência e pertencimento da Ação (404; revisao-design-parecer.md I2) → Tratativa alterável R17 (409) → Ação alterável R19 (409) → validação de campos informados (chave ausente não altera; `null` ou espaços em campos obrigatórios recusa com 400 e não apaga; revisao-design-parecer.md I8), persistência e auditoria seletiva.
- `srv/tratativa-service.ts`: handler para `editarAcao` aplicando `toLowerCase()` na chave da URL e no parâmetro `acao` (revisao-design-parecer-2.md M-c).
- Ao final: execução completa de `sh agentic/mecanismos/scripts/verify.sh` verde.

---

## N3 aprovados no Gate 1
- N3-1 (design): novos tipos de enum e entidades `Acoes` e `HistoricoAcoes` em `db/tratativa.cds` (etapa 1).
- N3-2 (design): papel `GestorTratativa` com `@restrict` nas actions de Ação em `TratativaService` (etapas 1, 3, 4).
- N3-3 (design): recusa 403 para identidade `AplicativoOrigem` em todas as rotas de Ações (etapas 1-4).
- N3-4 (design): superfícies e tipos do contrato OData V4 em `/api/tratativa/v1` (etapas 1-4).
- N3-5 (design): padrão textual `"sim"`/`"não"` do campo Evidência obrigatória (etapas 1, 2, 4).
- N3-6 (design): marcação `@PersonalData` na matrícula do Responsável e omissão como `null` para não-gestores; Descrição omitida do histórico (etapas 1-4).
- N3-7 (design): ausência de novas dependências e deploy inalterado (etapas 1-4).

---

## Critérios de pronto
- Etapa 1: CA1, CA3-CA19, CA46, CA48, CA56 (criação), CA57, CA59 (criação), CA61 (criação), CA62 (criação), CA69, CA75, CA76 (criação), CA87 (criação), CA90, CA94, CA96, CA97 (mãe inexistente), CA100 (criação), CA105 (criação).
- Etapa 2: CA2, CA61 (consulta), CA62 (consulta), CA79, CA80, CA81, CA82, CA83, CA84, CA85, CA103.
- Etapa 3: CA22-CA27, CA29-CA41, CA42, CA43, CA44, CA45, CA47, CA49-CA55, CA56 (transição), CA58 (reabertura), CA59 (transição), CA60, CA61 (transição), CA62 (transição), CA70, CA73, CA76 (transição), CA77, CA78, CA87 (conclusão), CA88, CA89, CA91-CA93, CA95, CA97 (transição), CA98, CA102, CA104, CA106.
- Etapa 4: CA20, CA21, CA28, CA56 (edição), CA58 (edição), CA59 (edição), CA61 (edição), CA62 (edição), CA63, CA64, CA65, CA66, CA67, CA68, CA71, CA72, CA74, CA76 (edição), CA86, CA97 (edição), CA99, CA100 (edição), CA101, CA105 (edição).
- Cobertura completa dos 106 Critérios de Aceite da spec plano-de-acao.
- Todos os testes das suítes anteriores (002 e 003) permanecem 100% verdes.
- Quatro pares `test(red):` e `feat(green):` registrados sequencialmente na branch, cada RED provado por `verifica-red.sh`.
- `sh agentic/mecanismos/scripts/verify.sh` passando 100% limpo ao fim da branch.

## Questões em aberto
- Nenhuma questão impeditiva. As decisões A a C do design e os itens N3-1 a N3-7 foram aprovados no Gate 1 (2026-10-08) pelo orquestrador, por delegação do humano.
