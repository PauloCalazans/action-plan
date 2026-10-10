# Task 001: alertas-e-notificacoes

**Spec:** agentic/projeto/specs/alertas-e-notificacoes/spec.md  
**Status:** em-andamento  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** alertas-e-notificacoes/001-alertas-e-notificacoes

## Objetivo
Entregar o intent 010 implementando o monitoramento proativo de prazos, inatividade e evidências pendentes com notificações multicanal (E-mail e Microsoft Teams) em arquitetura desacoplada, dividida em 4 etapas sequenciais RED/GREEN:
1. **Modelo persistido, baseline de parâmetros, portas desacopladas e governança administrativa:** inclusão das entidades `ParametrosAlertas` e `AlertasEmitidos` e tipos enumerados em `db/tratativa.cds`, inicialização programática de baseline sem CSV, configuração das portas `EmailAdapter`, `TeamsAdapter` e `DiretorioPessoasAdapter` em `package.json` (`cds.requires`) com dublês em `test/apoio/`, operações `consultarParametrosAlertas` e `atualizarParametrosAlertas` em `AdministracaoService`, validações semânticas de limites e precedência D10 com recusa estática de `AplicativoOrigem` (R2, R3, R5, R6, R13, R15; CA1-CA10, CA37, CA39, CA40, CA63, CA64);
2. **Serviço interno `RotinaAlertasService`, motor de regras e cálculo derivado de prazos e inatividade:** serviço interno sem protocolo `RotinaAlertasService` (`@protocol: 'none'`), motor autônomo em TypeScript avaliando as 4 modalidades de alerta (`PrazoProximo`, `PrazoVencido`, `Inatividade`, `EvidenciaPendente`), identificação de destinatários por papel (`Responsável da Ação`, `Responsável Principal`, `Participantes`), cálculo dinâmico da última atividade a partir de `criadoEm` de `Tratativas`, `quando` de `HistoricoTratativa`/`HistoricoAcoes` e `criadoEm` de `Comentarios` (sem colunas físicas em `Tratativas`), congelamento de registros finalizados e universalidade para qualquer Origem, permitindo que os testes disparem a rotina via `cds.connect.to('RotinaAlertasService')` sem importar `srv/` (R1, R4, R8, R9, R16; CA11-CA33, CA66);
3. **Despacho multicanal, formatação LGPD, idempotência diária UTC e execução sob demanda:** despacho isolado por adaptadores habilitados, mensagens individuais 1:1 no Teams, formatação neutra sob LGPD (pt-BR sem descrições detalhadas nem laudos), chave de idempotência diária estritamente em UTC (`instante.toISOString().slice(0, 10)`) em `AlertasEmitidos`, isolamento transacional de falhas de envio e endpoint de execução manual `executarProcessamentoAlertas` em `AdministracaoService` restrito ao Administrador (R5, R7, R9, R10, R12, R14; CA34-CA36, CA38, CA41-CA48, CA59-CA62);
4. **Consulta e auditoria de notificações emitidas, filtros, paginação e precedência consolidada D10:** endpoint `listarAlertasEmitidos` para Administrador e Gestor de Tratativa com ordenação cronológica decrescente, paginação por fatia, filtros combináveis por Tratativa, tipo, destinatário e status de envio, e cadeia completa de precedência D10 com validação de formato (400), existência (404), limites (400) e recusa imediata de `AplicativoOrigem` (403) (R11, R13, R15; CA49-CA58, CA65).

---

## Arquivos
- `package.json`
- `db/tratativa.cds`
- `srv/administracao-service.cds`
- `srv/administracao-service.ts`
- `srv/rotina-alertas-service.cds`
- `srv/rotina-alertas-service.ts`
- `srv/alertas/portas.ts`
- `srv/alertas/email-adapter.ts`
- `srv/alertas/teams-adapter.ts`
- `srv/alertas/diretorio-pessoas-adapter.ts`
- `srv/alertas/parametros.ts`
- `srv/alertas/motor-regras.ts`
- `srv/alertas/processamento.ts`
- `srv/alertas/consulta-alertas.ts`
- `test/apoio/email-espiao.ts`
- `test/apoio/teams-espiao.ts`
- `test/apoio/diretorio-espiao.ts`
- `test/apoio/alertas.ts`
- `test/alertas-parametros-governanca.test.ts`
- `test/alertas-motor-regras.test.ts`
- `test/alertas-despacho-idempotencia.test.ts`
- `test/alertas-consulta-auditoria.test.ts`

---

## Interfaces

- **Produz:**
  - Configuração em `package.json`: inclusão de bindings de `cds.requires` para `EmailAdapter`, `TeamsAdapter` e `DiretorioPessoasAdapter` com perfil de testes apontando para `test/apoio/`.
  - Entidades persistidas em `db/tratativa.cds`:
    * `ParametrosAlertas`: singleton com `diasAntecedenciaPrazoProximo`, `diasInatividade`, `emailHabilitado`, `teamsHabilitado`, `horaExecucaoUtc`.
    * `AlertasEmitidos`: registro com `tipo`, `entidade`, `tratativa`, `acao`, `destinatario`, `canal`, `enviadoEm`, `statusEnvio`, `motivoFalha`, `dadosAlerta`.
    * Tipos enumerados: `TipoAlerta`, `EntidadeAlerta`, `CanalNotificacao`, `StatusEnvioAlerta`.
  - Serviço interno sem protocolo em `srv/rotina-alertas-service.cds` (`@protocol: 'none'`):
    * `action executar(agora : Timestamp) returns AdministracaoService.RelatorioProcessamentoAlertas;`
  - Operações públicas em `AdministracaoService` (`/api/administracao/v1`):
    * `function consultarParametrosAlertas() returns DetalheParametrosAlertas;`
    * `action atualizarParametrosAlertas(diasAntecedenciaPrazoProximo : Integer, diasInatividade : Integer, emailHabilitado : Boolean, teamsHabilitado : Boolean, horaExecucaoUtc : Integer) returns DetalheParametrosAlertas;`
    * `action executarProcessamentoAlertas() returns RelatorioProcessamentoAlertas;`
    * `function listarAlertasEmitidos(tratativa : UUID, tipo : String, destinatario : String, statusEnvio : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemAlertaEmitido;`
  - Tipos públicos estruturados: `DetalheParametrosAlertas`, `RelatorioProcessamentoAlertas`, `ItemAlertaEmitido`.
  - Módulos de domínio em `srv/alertas/`:
    * `portas.ts`: interfaces tipadas para os adaptadores de mensageria e diretório.
    * `email-adapter.ts`, `teams-adapter.ts`, `diretorio-pessoas-adapter.ts`: implementações de serviço CAP das portas.
    * `parametros.ts`: leitura com inicialização de baseline (sem CSV) e atualização com validações de limites D10.
    * `motor-regras.ts`: avaliação autônoma das condições de prazo, inatividade, pendência de evidência e resolução de destinatários.
    * `processamento.ts`: orquestração do lote com relógio injetável, controle de idempotência diária UTC, despacho resiliente e formatação neutra LGPD.
    * `consulta-alertas.ts`: consulta paginada de alertas emitidos com ordenação decrescente e precedência D10.
  - Helpers de teste em `test/apoio/`:
    * `email-espiao.ts`, `teams-espiao.ts`, `diretorio-espiao.ts`: dublês em memória configurados via `cds.requires` (sem asserções).
    * `alertas.ts`: funções auxiliares para chamada OData às operações administrativas, acionamento interno via `cds.connect.to('RotinaAlertasService')` e consulta direta ao banco.
  - Quatro novas suítes de teste de integração baseadas em Jest e `cds.test`.

- **Consome:**
  - Entidades persistidas: `Tratativas` (`criadoEm`), `Acoes`, `HistoricoTratativa`, `HistoricoAcoes`, `Comentarios` (`criadoEm`), `Evidencias`.
  - Módulos existentes:
    * `srv/tratativa/recusa.ts`: função `recusar` para lançamento de erros padronizados com status e `target`.
    * `srv/tratativa/consulta.ts`: função `codigoValido` para validação de formato UUID.
    * `srv/lib/relogio.ts`: utilitários `agora()` e `dataCivil()`. *Atenção arquitetural:* a composição da chave de idempotência diária opera estritamente sobre a data civil no **fuso UTC** (`instante.toISOString().slice(0, 10)`), sendo vedado o uso de `dataCivil()` de `relogio.ts` para esse fim (pois formata no fuso de Brasília).
  - Helpers de teste em `test/apoio/`:
    * `usuarios.ts` (`comoAdmin`, `comoGestor`, `comoUsuario`, `comoApp`, `semAuth`).
    * `tratativas.ts` (`criarAvulsa`, `abrirPorApp`, `mudarStatus`).
    * `acoes.ts` (`criarAcao`, `criarSubacao`, `mudarStatusAcao`).
    * `responsaveis.ts` (`atribuirResponsavelPrincipal`, `incluirParticipante`, `delegarAcao`).
    * `banco.ts` (`linhas`).

---

## Regras para todas as etapas

- **Commits sequenciais por etapa:** cada etapa é composta estritamente por um commit `test(red): <etapa> …` (contendo exclusivamente arquivos em `test/` e, se necessário, este arquivo de task) seguido por um commit `feat(green): <etapa> …` (contendo a implementação correspondente).
- **Arquivo de teste novo por RED:** cada etapa RED introduz exatamente UM novo arquivo de teste (`test/*.test.ts`) que falha estritamente no commit RED.
- **Proibição de alteração em testes anteriores:** nunca alterar, relaxar ou desabilitar testes criados em commits anteriores.
- **Helpers de teste sem asserções:** nenhum helper em `test/apoio/` pode conter chamadas a `expect(`. Todas as asserções pertencem aos arquivos de teste.
- **Testes não importam `srv/`:** a execução dos testes interage com a aplicação exclusivamente via chamadas OData HTTP (`cds.test().get(...)` ou `.post(...)`), chamadas a serviços internos sem protocolo (`cds.connect.to('RotinaAlertasService').send(...)`), ou consultas diretas à base de dados via helper `linhas(...)`.
- **Preservação de contratos existentes:** o tipo `DetalheTratativa` permanece com exatamente 12 chaves, e os entity sets existentes de `AdministracaoService` (`PrazosCriticidade`, `CredenciaisAplicativo`) mantêm suas restrições e comportamento originais.
- **Sem arquivos CSV em `db/data/`:** a carga inicial de baseline dos parâmetros é realizada programaticamente pelo domínio caso o registro singleton não exista.
- **Verificação obrigatória:** executar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## Itens N3 (aguardam aprovação no Gate 1)

- N3-1 (design): Adição das entidades `ParametrosAlertas` e `AlertasEmitidos` e tipos enumerados em `db/tratativa.cds` de forma estritamente aditiva, com baseline programático sem uso de arquivos CSV em `db/data/` (R2, R10).
- N3-2 (design): Expansão de `AdministracaoService` para `@requires: ['Administrador', 'GestorTratativa']` com grants somados diretamente no CDS (preservando permissões existentes) e recusa imediata de `AplicativoOrigem` com HTTP 403 no início do handler no `before('*')` (R3, R9, R11, R13).
- N3-3 (design): Configuração formal em `package.json` (`cds.requires`) das portas desacopladas (`EmailAdapter`, `TeamsAdapter`, `DiretorioPessoasAdapter`) com dublês de teste em memória em `test/apoio/`, garantindo que os testes nunca dependam de serviços externos reais de SMTP ou Graph API (AGENTS.md:38, R5; Ruling R-02 I1).
- N3-4 (design): Resolução provisória de pessoas no MVP baseada em resolução padrão determinística `<matricula>@empresa.com` via `DiretorioPessoasAdapter`, preparando o acoplamento futuro ao SAP SuccessFactors no intent 011 sem duplicar tabelas de pessoas (R6).
- N3-5 (design): Salvaguarda de dados pessoais sob LGPD no conteúdo de notificações: textos neutros contendo apenas Tipo, Código, Título, Prazo e URL, sem descrições detalhadas, laudos ou anexos de evidência (AGENTS.md:66, R7).
- N3-6 (design): Precedência consolidada de recusas em 8 etapas baseada na decisão D10, comprovando validação de papel antes de consultas ao banco e limites numéricos nomeando campos no target (R15).
- N3-7 (design): Serviço interno sem protocolo `RotinaAlertasService` (`srv/rotina-alertas-service.cds`, `@protocol: 'none'`) para execução automatizada de lote desacoplada do agendador de nuvem (Job Scheduler), acionado via `cds.connect.to('RotinaAlertasService')` com relógio determinístico injetável `agora : Timestamp` (R9; Ruling R-02 I2).
- N3-8 (design): Registro de notificações exclusivamente em entidade dedicada `AlertasEmitidos`, sem poluir a tabela de histórico executivo da ocorrência (`HistoricoTratativa`), encaminhando política formal de guarda legal e expurgo para o intent 014 (AGENTS.md:40, R10).

---

## Etapas

### Etapa 1: Modelo persistido, baseline de parâmetros, portas desacopladas e governança administrativa
- **Critérios de aceite:** CA1, CA2, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10, CA37, CA39, CA40, CA63, CA64.
- **Itens N3:** N3-1, N3-2, N3-3, N3-4, N3-6.
- **Descrição:**
  1. Adicionar os tipos enumerados `TipoAlerta`, `EntidadeAlerta`, `CanalNotificacao` e `StatusEnvioAlerta` e as entidades `ParametrosAlertas` e `AlertasEmitidos` em `db/tratativa.cds`.
  2. Implementar a inicialização programática do registro singleton em `srv/alertas/parametros.ts` caso não exista na base de dados (`diasAntecedenciaPrazoProximo = 3`, `diasInatividade = 15`, `emailHabilitado = true`, `teamsHabilitado = true`, `horaExecucaoUtc = 8`), sem criação de arquivos CSV em `db/data/`.
  3. Declarar as portas `EmailPort`, `TeamsPort` e `DiretorioPessoasPort` em `srv/alertas/portas.ts` e suas implementações base em `srv/alertas/email-adapter.ts`, `srv/alertas/teams-adapter.ts` e `srv/alertas/diretorio-pessoas-adapter.ts`.
  4. Configurar as portas em `package.json` (`cds.requires`) e implementar os dublês em memória `test/apoio/email-espiao.ts`, `test/apoio/teams-espiao.ts` e `test/apoio/diretorio-espiao.ts` (sem asserções).
  5. Expandir `AdministracaoService` em `srv/administracao-service.cds` com `@requires: ['Administrador', 'GestorTratativa']`, declarando as operações `consultarParametrosAlertas` e `atualizarParametrosAlertas` com seus respectivos `@restrict`, preservando os grants existentes de `PrazosCriticidade` e `CredenciaisAplicativo`.
  6. Criar `srv/administracao-service.ts` com hook `before('*')` rejeitando `AplicativoOrigem` com HTTP 403 (`Acesso negado.`) e implementando as validações D10 para `atualizarParametrosAlertas`: limites de 1..30 para antecedência, 1..90 para inatividade e 0..23 para hora UTC, com mensagem e target.
  7. Garantir que alterações de parâmetros não gravam registros em `HistoricoTratativa`.
- **Arquivo de teste novo:** `test/alertas-parametros-governanca.test.ts`.

---

### Etapa 2: Serviço interno `RotinaAlertasService`, motor de regras e cálculo derivado de prazos e inatividade
- **Critérios de aceite:** CA11, CA12, CA13, CA14, CA15, CA16, CA17, CA18, CA19, CA20, CA21, CA22, CA23, CA24, CA25, CA26, CA27, CA28, CA29, CA30, CA31, CA32, CA33, CA66.
- **Itens N3:** N3-1, N3-7.
- **Descrição:**
  1. Declarar o serviço interno sem protocolo `RotinaAlertasService` em `srv/rotina-alertas-service.cds` (`@protocol: 'none'`) expondo a action `executar(agora : Timestamp) returns AdministracaoService.RelatorioProcessamentoAlertas`, e criar seu handler em `srv/rotina-alertas-service.ts` delegando a execução para a orquestração do lote em `srv/alertas/processamento.ts`.
  2. Implementar o motor de avaliação de regras em `srv/alertas/motor-regras.ts` recebendo a data de referência da avaliação (`dataRef` baseada no carimbo `agora` fornecido):
     - `PrazoProximo`: para Ações/Subações com status `Pendente`/`Em andamento` com prazo em até `diasAntecedenciaPrazoProximo` dias à frente (notifica `Responsável da Ação`), e para Tratativas `Aberta`/`Em andamento` com data prevista de conclusão no mesmo intervalo (notifica `Responsável Principal`, omitindo se não houver);
     - `PrazoVencido`: para Ações/Subações com prazo anterior a `dataRef` (notifica `Responsável da Ação` e `Responsável Principal`), e para Tratativas com data prevista anterior a `dataRef` (notifica `Responsável Principal`);
     - `Inatividade`: cálculo dinâmico da última atividade a partir de `max(criadoEm da Tratativa, max(quando de HistoricoTratativa e HistoricoAcoes), max(criadoEm de Comentarios))`; se inativa há mais de `diasInatividade` dias, notifica `Responsável Principal`, ou `Participantes` se não houver RP;
     - `EvidenciaPendente`: para Ações com `evidenciaObrigatoria = true`, zero evidências ativas anexadas e prazo vencido ou na janela de prazo próximo (notifica `Responsável da Ação`, somando o `Responsável Principal` se vencida).
  3. Implementar a exclusão estrita de registros finalizados: Tratativas `Encerrada`/`Cancelada` e Ações `Concluída`/`Cancelada` nunca geram alertas.
  4. Persistir os alertas identificados na entidade `AlertasEmitidos` de modo que os testes em `test/alertas-motor-regras.test.ts` possam invocar `cds.connect.to('RotinaAlertasService').send('executar', { agora })` e validar os alertas gerados via `linhas('AlertasEmitidos')`, sem que os testes precisem importar a camada `srv/` (Ruling R-02 I2).
  5. Garantir universalidade absoluta: nenhuma regra ou texto varia por Origem externa ou área de negócio (AGENTS.md:36).
- **Arquivo de teste novo:** `test/alertas-motor-regras.test.ts`.

---

### Etapa 3: Despacho multicanal, formatação LGPD, idempotência diária UTC e execução sob demanda
- **Critérios de aceite:** CA34, CA35, CA36, CA38, CA41, CA42, CA43, CA44, CA45, CA46, CA47, CA48, CA59, CA60, CA61, CA62.
- **Itens N3:** N3-2, N3-3, N3-5, N3-7.
- **Descrição:**
  1. Completar `srv/alertas/processamento.ts` integrando o despacho multicanal efetivo:
     - Relógio determinístico: utiliza `agora` injetado recebido pela rotina;
     - Idempotência diária estritamente em UTC: consulta `AlertasEmitidos` pela chave composta `(tipoAlerta, entidade, tratativaId, acaoId, destinatario, canal, dataEnvioYMD)` onde `dataEnvioYMD = agora.toISOString().slice(0, 10)`, omitindo envios com sucesso prévio no mesmo dia civil UTC;
     - Condicionamento por canais habilitados: submete envios apenas para canais ativos em `ParametrosAlertas` (`emailHabilitado`, `teamsHabilitado`);
     - Envio Microsoft Teams: restrito a notificação direta individual 1:1 ao colaborador via `TeamsAdapter`;
     - Formatação neutra LGPD: monta assunto e corpo em pt-BR contendo apenas Tipo, Código e Título da Tratativa, Código da Ação, Prazo em DD/MM/AAAA e URL direta segura, omitindo estritamente descrições detalhadas, comentários e anexos;
     - Resiliência a falhas: captura exceções de rede em adaptadores, persiste `statusEnvio = Falha` com `motivoFalha` em `AlertasEmitidos` e prossegue com os demais alertas do lote sem rollback no banco e sem afetar as ocorrências;
     - Auditoria: toda emissão grava linha em `AlertasEmitidos` e nenhuma linha em `HistoricoTratativa`.
  2. Conectar a action `executarProcessamentoAlertas` em `AdministracaoService`, garantindo restrição estrita ao papel `Administrador` (Gestor de Tratativa e demais usuários recebem HTTP 403; Aplicativo de origem recebe HTTP 403 no `before('*')`).
  3. Garantir total autonomia de código: zero dependência de SAP Build Process Automation / Business Rules.
- **Arquivo de teste novo:** `test/alertas-despacho-idempotencia.test.ts`.

---

### Etapa 4: Consulta e auditoria de notificações emitidas, filtros, paginação e precedência consolidada D10
- **Critérios de aceite:** CA49, CA50, CA51, CA52, CA53, CA54, CA55, CA56, CA57, CA58, CA65.
- **Itens N3:** N3-2, N3-6, N3-8.
- **Descrição:**
  1. Implementar o módulo `srv/alertas/consulta-alertas.ts` e a function pública `listarAlertasEmitidos` em `AdministracaoService`:
     - Autorização: restrita a `Administrador` e `GestorTratativa` (usuários sem papel recebem HTTP 403; Aplicativo de origem recebe HTTP 403 verificado no `before('*')`);
     - Precedência D10:
       * Etapa 2: Aplicativo de origem ou sem papel → HTTP 403 no início do handler antes de consultar o banco;
       * Etapa 4: Parâmetro `tratativa` com UUID malformado → HTTP 400 `Código inválido.` (`target: tratativa`);
       * Etapa 5: Tratativa informada inexistente no banco → HTTP 404 `Tratativa não encontrada.` (`target: tratativa`);
       * Etapa 8: Validação de limites: `tamanhoPagina` fora de 1..200 → HTTP 400 `O campo Tamanho da página aceita de 1 a 200.` (`target: tamanhoPagina`); `pagina < 1` → HTTP 400 `O campo Página deve ser 1 ou maior.` (`target: pagina`); validação de `tamanhoPagina` precede `pagina`.
     - Filtros opcionais aplicados sobre `AlertasEmitidos`: `tratativa`, `tipo`, `destinatario`, `statusEnvio`;
     - Ordenação cronológica decrescente (`enviadoEm DESC`);
     - Paginação por fatia: `limit(tamanhoPagina, (pagina - 1) * tamanhoPagina)`;
     - Retorno direto `many ItemAlertaEmitido` sem envelopamento; busca sem registros devolve lista vazia `[]` com HTTP 200; consulta estritamente read-only.
- **Arquivo de teste novo:** `test/alertas-consulta-auditoria.test.ts`.

---

## Critérios de pronto

1. Todos os 66 Critérios de Aceite (CA1 a CA66) implementados e cobertos pelas 4 suítes de teste de integração.
2. Cada etapa possui seu par sequencial de commits `test(red):` e `feat(green):`, com exatamente um novo arquivo de teste por etapa RED.
3. Nenhum teste de commits anteriores quebrado, relaxado ou alterado.
4. Helpers de teste em `test/apoio/` livres de asserções (`expect(`).
5. Nenhum arquivo de teste importa código da camada `srv/`.
6. Preservação estrita dos contratos anteriores: `consultarTratativa` permanece com 12 chaves e `AdministracaoService` mantém o comportamento de `PrazosCriticidade` e `CredenciaisAplicativo`.
7. Parâmetros de alerta inicializados programaticamente sem criação de arquivos CSV em `db/data/`.
8. Verificação limpa e completa de `sh agentic/mecanismos/scripts/verify.sh` reportando sucesso nos testes, lint, build e arquitetura.
