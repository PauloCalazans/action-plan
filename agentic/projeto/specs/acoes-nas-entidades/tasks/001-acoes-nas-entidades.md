# Task 001: acoes-nas-entidades

**Spec:** agentic/projeto/specs/acoes-nas-entidades/spec.md
**Status:** publicada
**Branch:** acoes-nas-entidades/001-acoes-nas-entidades

Empilhada sobre `metodologias-e-aval-tecnico/005-admin-indicadores-ui` (HEAD `b58543a`).

## Objetivo
Levar as operações sobre Ação e Evidência para a linha selecionada na Object Page de Tratativas. São três partes, todas descritas no design:
- servidor: actions ligadas a `Acoes`/`Evidencias` no `TratativaAppService` e indicações por linha sem matrícula (decisões 1–4 e 7);
- interface: barras das tabelas, diálogo de anexo com escolha de arquivo e confirmação de remoção (decisões 5, 6, 8–10 e 12);
- testes: migração dos testes do App que chamam as versões removidas (decisão 11).

## Arquivos

### Criados
- `srv/tratativa/operacoes-linha-app.ts`
- `app/tratativas/webapp/ext/acoes/OperacoesLinha.js`
- `app/tratativas/webapp/ext/acoes/pedidoAnexo.js`
- `app/tratativas/webapp/ext/fragment/AnexarEvidencia.fragment.xml`
- `test/acoes-nas-entidades.test.ts`
- `test/acoes-nas-entidades-pedido-anexo.test.ts`

### Modificados
- `srv/tratativa-app-service.cds`: exatamente o bloco do "Contrato executável" do design. Saem 5 actions de `Tratativas`. Entram as flags em `Tratativas`, `Acoes` e `Evidencias`, as actions em `Acoes`/`Evidencias`, `@Core.OperationAvailable` em `criarAcao`, `comentarTratativa`, `Acoes.iniciar`, `Acoes.concluir`, e os tipos e a function `regrasAnexoEvidencia`.
- `srv/tratativa-app-service.ts`:
  - saem os handlers `criarSubacao`/`delegarAcao`/`anexarEvidencia`/`removerEvidencia`/`comentarAcao` em `'Tratativas'` (`:328-348`, `:371`);
  - entram os handlers em `'Acoes'`/`'Evidencias'` (decisões 1 e 2), o `on('regrasAnexoEvidencia')`, e `after('READ', 'Acoes')` e `after('READ', 'Evidencias')` com as flags (decisão 3);
  - o `after('READ', 'Tratativas')` (`:171-215`) ganha as 5 flags novas;
  - o regex do `before('READ', 'Tratativas')` (`:153`) passa a reconhecer as flags novas;
  - `alterarStatusAcao` (`:400-406`) passa a usar `localizarAcaoDaLinha(req)`. É correção de defeito existente: pela tabela da Object Page, `req.params[0]` é a Tratativa (design, decisão 2; r1, C1).
- `srv/tratativa/evidencias-validacao.ts`: só `const FORMATOS_ACEITOS` vira `export const FORMATOS_ACEITOS` (`:13`). Valor e funções não mudam.
- `app/tratativas/annotations.cds` (decisão 10):
  - saem 7 entradas de `UI.Identification` (`:46-80`) e os `DataFieldForAction` Iniciar/Concluir da `UI.LineItem` de `Acoes` (`:205-214`);
  - a `UI.LineItem` de `Acoes` ganha a coluna "Ação mãe" (`acaoMae_codigo`);
  - os parâmetros das 5 actions passam para `annotate TratativaAppService.Acoes with actions` / `annotate TratativaAppService.Evidencias with actions`, sem parâmetros de código e com as `ValueList` iguais;
  - placeholders conforme a decisão 10;
  - os `@Common.SideEffects` de `iniciarTratativa`/`encerrarTratativa`/`cancelarTratativa`/`reabrirTratativa` (`:469-476`) ganham `in/podeCriarAcao`, `in/podeComentarTratativa`, `in/ocultaComentarTratativa`, `in/ocultaOperacoesDeAcao` e `TargetEntities` `in/acoes`, `in/evidencias`, `in/comentarios` (decisão 5; r1, I1).
- `app/tratativas/webapp/manifest.json`: `sap.ui.unified` em `sap.ui5.dependencies.libs` (`:50-55`) e `controlConfiguration` do alvo `TratativasObjectPage` com as 9 ações customizadas (decisão 5). Criar Ação e Comentar Tratativa usam binding (`{= ${podeCriarAcao} === true }` etc.); as 7 de linha usam método de módulo.
- `app/tratativas/ui5.yaml`: `- name: sap.ui.unified` em `framework.libraries`.
- `app/tratativas/webapp/i18n/i18n.properties`: rótulos dos 9 botões, título e textos do diálogo de anexo (placeholders literais da spec para Arquivo e Descrição da Evidência), avisos de formato e tamanho (com `{0}` para o limite), `removerEvidenciaConfirmar` (decisão 9). A terminologia é neutra (R21; `test/genericidade-lint.test.ts`).
- `test/ui-tratativas.test.ts` (`:194-200`, `:202-216`, `:218-240`, `:242-265`, `:267-280`; decisão 11, inclusive os rótulos).
- `test/ui-acabamento.test.ts` (`:129-143` só o rótulo; `:780-805` leitura do placeholder em `TratativaAppService.Acoes`).
- `test/mascara-lgpd-app.test.ts` (`:61`, `:137`, `:143`, `:163`).

### Removidos
- Nenhum arquivo.

## Interfaces
- **Produz (HTTP, `/api/app/v1`):**
  - `POST Acoes(<codigo>)/criarSubacao {descricao, responsavel, prazo, prioridade, evidenciaObrigatoria}` → `{codigo}`;
  - `POST Acoes(<codigo>)/delegarAcao {novoResponsavel, justificativa}` → 204;
  - `POST Acoes(<codigo>)/anexarEvidencia {nomeArquivo, mimeType, conteudo, descricao}` → `DetalheEvidencia`;
  - `POST Acoes(<codigo>)/comentarAcao {texto, mencoes}` → `{codigo}`;
  - `POST Evidencias(<codigo>)/removerEvidencia {}` → 204;
  - **caminho por contenção (o que a interface usa), equivalente:** `POST Tratativas(<t>)/acoes(<a>)/<criarSubacao|delegarAcao|anexarEvidencia|comentarAcao|iniciar|concluir>` e `POST Tratativas(<t>)/evidencias(<e>)/removerEvidencia`. Registro fora de `<t>`, ou `<t>` malformada, dá 404;
  - qualquer outro caminho (ex.: `Acoes(<a>)/acaoMae/<action>`) dá 404. A identificação é por `req.query.SELECT.from.ref` (design, decisão 2; r2, M2-1);
  - `GET regrasAnexoEvidencia()` → `{tamanhoMaximo, formatos:[{extensao, tipos:[...]}]}`;
  - flags `pode*`/`oculta*` da tabela da decisão 3.
- **Produz (servidor, `srv/tratativa/operacoes-linha-app.ts`):**
  - `localizarAcaoDaLinha(req)`;
  - `localizarEvidenciaDaLinha(req)`;
  - `indicacoesAcoes(req, codigos)`;
  - `indicacoesEvidencias(req, codigos)`;
  - `regrasAnexo()`.

  As assinaturas estão no "Contrato executável".
- **Produz (app):**
  - `ext/acoes/pedidoAnexo.js`: `extensaoDe`, `avisoDoArquivo`, `tipoParaEnvio`, `montarPedidoAnexo`. É puro: `sap.ui.define([], fabrica)`, sem dependências nem DOM.
  - `ext/acoes/OperacoesLinha.js`: os métodos `press`/`visible`/`enabled` referenciados no manifest (`this` = `ExtensionAPI`; argumentos `(contextoDaPagina, contextosSelecionados)`).
  - Fragmento `AnexarEvidencia`, carregado com `loadFragment({ id: 'anexarEvidencia', ... })`. Os controles são resolvidos por `sap.ui.core.Fragment.byId('anexarEvidencia', '<id>')` (ids `arquivo`, `descricao`, `aviso`).
- **Consome, sem alterar regra:**
  - `criarSubacao` (`srv/tratativa/acoes-criacao.ts:36`);
  - `delegarAcao` (`acoes-delegacao.ts:42`);
  - `anexarEvidencia` (`evidencias-anexo.ts:60`);
  - `removerEvidencia` (`evidencias-remocao.ts:35`);
  - `comentarAcao` (`comentarios-inclusao.ts:152`);
  - `mudarStatusAcao` (via `alterarStatusAcao`);
  - `codigoValido` (`consulta.ts:13`);
  - `usuarioAutenticadoEhMatricula`/`normalizarMatricula` (`identidade.ts`);
  - `TAMANHO_MAXIMO_ARQUIVO`/`FORMATOS_ACEITOS` (`evidencias-validacao.ts:7,13`).

## N3 aprovados no Gate 1
- N3-1 (design): contrato novo do `/api/app/v1`.
- N3-2 (design): `@requires` das actions de linha e derivação do vínculo pela linha.
- N3-3 (design): LGPD dos anexos e das indicações.
- N3-4 (design): dependência de biblioteca UI5 `sap.ui.unified`.
- N3-5 (design): reescrita dos testes aprovados de 013 e 015 (R28).

(Os cinco itens ficam pendentes de aprovação no Gate 1, delegado ao orquestrador. Mudança N3 fora desta lista exige parar.)

## Critérios de pronto

### Etapa 1: servidor
- **RED** (`test(red): operações de linha no serviço do app`), em `test/acoes-nas-entidades.test.ts`. Cobre CA12, CA14, CA15, CA18–CA22, CA24–CA31, CA33, CA34, CA37 e CA41 do lado do servidor, conforme "Como isso se prova" do design. Pontos obrigatórios:
  - **dois caminhos** para cada operação de linha e para `Acoes.iniciar`/`concluir`: `Acoes(a)/...` e `Tratativas(t)/acoes(a)/...`; `Evidencias(e)/removerEvidencia` e `Tratativas(t)/evidencias(e)/removerEvidencia` (r1, C1);
  - CA25 com chave `xyz` (CONVENCOES item 10), UUID inexistente de 5 grupos, Evidência inativa, Ação ou Evidência de outra Tratativa pela contenção e chave `t` malformada, sempre com a mensagem exata;
  - CA26 com `M1001` e `Acoes(00000000-0000-4000-8000-000000000000)/criarSubacao` e `Tratativas(t)/acoes(00000000-0000-4000-8000-000000000000)/criarSubacao` dando 403, e `/anexarEvidencia` dando 404;
  - M1: Evidência inativa dá 404 antes de 403 (usuário sem vínculo) e antes de 409 (Tratativa `Encerrada`);
  - M2-1: `POST Acoes(<sub>)/acaoMae/criarSubacao` e `POST Acoes(<a>)/acaoMae/iniciar` dão 404, e o banco não muda;
  - CA14: a serialização das respostas com flags não contém nenhuma matrícula do cenário;
  - CA29 no CSN de `cds.load(['srv','app'])`.
- **GREEN:** contrato CDS, handlers e `srv/tratativa/operacoes-linha-app.ts`. `srv/tratativa/mascara-app.ts` não é alterado (decisão 4; a revisão de diff confere).
- A suíte do `TratativaService` passa sem mudança de resultado esperado (CA30).

### Etapa 2: interface
- **RED** (`test(red): barras das tabelas e montagem do anexo`):
  - em `test/acoes-nas-entidades-pedido-anexo.test.ts`: o módulo puro é carregado com `vm.runInNewContext(readFileSync(<caminho>), { sap: { ui: { define: (_d, f) => { modulo = f(); } } } })`, sem navegador nem `sap.ui.require`. Esta é a única forma de carga do módulo (design, decisão 8; r1, M3). Cobre CA41 a/b/c, R13 (`.exe` → `'formato'`; 10.485.761 bytes → `'tamanho'`; 10.485.760 → `null`) e `montarPedidoAnexo`, inclusive `conteudo` `undefined` → `""` (r1, M2), com as `regras` lidas de `GET /api/app/v1/regrasAnexoEvidencia()`;
  - em `test/acoes-nas-entidades.test.ts`, parte estática:
    - `UI.Identification` sem as 7 entradas, mantidas transições, Emitir Aval, Alterar Criticidade e Aplicar Template (CA1);
    - `manifest.json` com as 9 ações em `controlConfiguration` (`acoes/`, `evidencias/`, `comentarios/@com.sap.vocabularies.UI.v1.LineItem`), `requiresSelection: true` e `enableOnSelect: "single"` nas 7 de linha (CA2, CA6, CA7); em Criar Ação, `visible` = `{= ${ocultaGestaoAcoes} !== true }` e `enabled` = `{= ${podeCriarAcao} === true }`; em Comentar Tratativa, `visible` = `{= ${ocultaComentarTratativa} !== true }` e `enabled` = `{= ${podeComentarTratativa} === true }` (r2, M2-3);
    - `sap.ui.unified` em `libs` e em `ui5.yaml`;
    - placeholders da decisão 10 no CSN (CA36, parte estática).
- **GREEN:** annotations, manifest, `ui5.yaml`, i18n, `OperacoesLinha.js`, `pedidoAnexo.js` e o fragmento. Os arquivos JS seguem o padrão de `MetodologiaExtension.controller.js` (`sap.ui.define`, `"use strict"`, `// eslint-disable-line no-undef` em todo uso de `sap` e de `FileReader`; r1, M6). A instância do diálogo só é reutilizada se `!isDestroyed()` (r1, M5).

### Etapa 3: migração (R28)
- Os 10 trechos da decisão 11 reescritos para as actions de linha, com os mesmos resultados esperados e os rótulos reapontados (`ui-tratativas.test.ts:194` e `:267` deixam de citar "CA12 (Achado 4)"). Os helpers de `test/apoio/` não mudam (CONVENCOES item 1).

### Verificação visual (navegador local, `cds watch` + FLP sandbox; relatório da task)
- Itens a verificar: CA1–CA11, CA13, CA16, CA17, CA23, CA35, CA36, CA39, CA40 e CA42, como Gestor, como `M1001` (Responsável de A1 e não de A2), como Participante e como usuário comum.
- Registrar o Tipo informado por Edge e Chrome para um `.csv` (M-R3-1) e o resultado do anexo.
- Confirmar que as operações de linha acionadas pela tabela funcionam (caminho por contenção; r1, C1), inclusive Iniciar e Concluir.
- Depois de Encerrar ou Cancelar, Criar Ação, Comentar Tratativa e os botões de linha ficam desabilitados. Depois de Reabrir, e de Iniciar a partir de `Aberta`, ficam habilitados sem recarregar a página (r1, I1).
- Registrar se a seleção da linha permanece após Delegar e Criar Subação (R26). Se não permanecer, aplicar o recuo do "O desconfortável" 2.
- Se a visibilidade por linha não reagir à seleção, parar e reportar ("O desconfortável" 1: o recuo diverge de CA13 e volta ao Gate 1).

### Relatório da task
- Em "Divergências" (r1, M4): a lista de placeholders da spec (`spec.md:46-51`) traz para a Descrição da Ação e da Subação um texto sem alerta de dados sensíveis, e o design manteve o vigente (R20, R27, teste R-20). Comentário e Justificativa passam ao texto literal da spec por causa de CA36, o que é mudança visível ao usuário.
- Declarar a correção de defeito existente em `alterarStatusAcao` (C1) e a mudança de precedência da Evidência inativa (M1).

### Esteira
- `sh agentic/mecanismos/scripts/verify.sh` verde (CA38).

## Questões em aberto
- Nenhuma além das 9 hipóteses da spec (R4, R6, R8, R13, R19, R23, R24, R25, R26) e dos itens N3-1..N3-5, pendentes do Gate 1 delegado ao orquestrador. O desenho segue a recomendação de cada hipótese. Se o Gate 1 escolher Q6 (b), a decisão 5 e o "O desconfortável" 8 indicam o ajuste.
