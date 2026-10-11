# Design: acabamento-ui-fiori

**Spec:** agentic/projeto/specs/acabamento-ui-fiori/spec.md
**Status:** aprovado

Escopo técnico: acabamento visual, ergonomia operacional, internacionalização e usabilidade corporativa das aplicações SAP Fiori elements v4 em `app/` (`app/tratativas/`, `app/minhas-pendencias/`, `app/administracao/`) consumindo os serviços CAP consolidados (`TratativaAppService`, `AdministracaoService`). Resolve integralmente os oito achados apontados no teste visual em navegador (`agentic/.estado/execucao/2026-10-11-teste-visual-ui/achados.md`), assegurando: (1) autonomia e execução local isolada de cada aplicação como componente SAPUI5 (`Component.js` estendendo `sap.fe.core.AppComponent` e `index.html` com bootstrap sandbox Fiori), mantendo estritamente o empacotamento MTA/HTML5 da spec 014; (2) internacionalização e rótulos amigáveis em Português do Brasil (pt-BR) em 100% das entidades, propriedades, colunas, filtros e parâmetros de ações, banindo identificadores técnicos em camelCase; (3) Action Import canônico `TratativaAppService.EntityContainer/criarTratativaAvulsa` na barra de ferramentas do List Report de Tratativas, sem campo de data prevista discricionária e com persistência síncrona; (4) controles de entrada tipados e ajudas visuais: seletor de calendário (DatePicker) para prazos (`Edm.Date`), listas suspensas (dropdowns com `@Common.ValueListWithFixedValues`) para domínios enumerados (criticidade em tratativas; prioridade e evidência obrigatória em ações) e ajuda de pesquisa de colaboradores (Value Help consumindo dados de pessoas do SuccessFactors da spec 011 em modo estritamente leitura conforme diretriz do humano sob a LGPD); (5) botões de cabeçalho dedicados para cada transição de status da Tratativa com controle dinâmico declarativo de visibilidade/habilitação via `@Core.OperationAvailable` / flags de estado (`Aberta`, `Em andamento`, `Encerrada`, `Cancelada`), com diálogo de justificativa obrigatória em Cancelamento e Reabertura; (6) completude visual de telas: Dados Gerais rotulados, colunas Unidade/Área/Data prevista visíveis sem corte em desktop e botões "Salvar Parâmetros" e "Executar Processamento Manual" operacionais na Administração; e (7) proteção defensiva no cálculo de prazos (`diasDoPrazo` em `srv/tratativa/prazo.ts`), tratando bases com `PrazosCriticidade` não inicializada com recusa HTTP 400 controlada, impedindo falhas por `TypeError` que interrompam o servidor Node.js.

---

## Decisões

1. **Componentes SAPUI5 autônomos (`Component.js`) e sandbox local (`index.html`) por aplicação Fiori elements v4 (R1; Achado 1).**
   - O teste visual revelou que as três pastas em `app/` continham apenas `manifest.json`, `xs-app.json` e `annotations.cds`, sem `Component.js` nem `index.html`. O Fiori elements v4 requer que cada aplicação seja um componente SAPUI5 autônomo estendendo `sap.fe.core.AppComponent` para carregar nativamente em runtime, tanto em sandbox local quanto no SAP Build Work Zone corporativo.
   - **Estrutura por aplicação (`app/<app>/webapp/`):**
     - `Component.js`: declaração canônica herdando de `sap.fe.core.AppComponent`:
       ```javascript
       sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
         "use strict";
         return AppComponent.extend("br.com.calazanstec.actionplan.<appName>.Component", {
           metadata: { manifest: "json" }
         });
       });
       ```
       Onde `<appName>` corresponde ao sufixo do ID do `manifest.json` (`tratativas`, `minhaspendencias`, `administracao`).
     - `index.html`: página de sandbox Fiori local leve servida diretamente pelo servidor de desenvolvimento (`cds watch` / preview local), carregando o bootstrap do SAPUI5 via CDN oficial (`https://ui5.sap.com/1.120.0/resources/sap-ui-core.js`), configurando o tema `sap_horizon`, declarando `data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"` e renderizando o componente via tag `<div data-sap-ui-component ...>`. As requisições OData `/api/...` são direcionadas diretamente à porta local servida pelo CAP.
   - **Compatibilidade MTA e Build HTML5 (spec 014):**
     - O arquivo `xs-app.json` já declara `"welcomeFile": "/index.html"`. A inclusão de `index.html` e `Component.js` completa formalmente a raiz estática esperada pelo Application Router.
     - O comando de build do MTA em `app/<app>/package.json` (`ui5 build --config=ui5.yaml --clean-dest --archive ...`) empacota o conteúdo de `webapp/` no arquivo zip em `dist/`. `Component.js` é o ponto de entrada oficial exigido pelo builder de preload (`Component-preload.js`), garantindo compatibilidade total com o deployer no HTML5 Application Repository sem nenhuma alteração no `mta.yaml`.
   — **Por quê:** viabiliza o carregamento isolado nativo no navegador sem depender do `$fiori-preview` genérico do CAP e prepara as aplicações para o deploy corporativo no Work Zone.
   — **Verificado por:** CA1 (inspeção de arquivos estruturais) e CA2 (carregamento das URLs `/tratativas/webapp/index.html`, `/minhas-pendencias/webapp/index.html` e `/administracao/webapp/index.html`).

2. **Centralização de rótulos pt-BR em `@title` / `@Common.Label` no CDS e catálogos `i18n.properties` (R2; Achado 2).**
   - O teste visual identificou ausência de rótulos em colunas, filtros, campos e diálogos de ações, exibindo identificadores técnicos em camelCase (`codigo`, `idOrigem`, `evidenciaObrigatoria`, `responsavelPrincipal`, `dataPrevistaConclusao`, etc.).
   - **Arquitetura de textos e localização:**
     - **Catálogos `i18n.properties` (`app/<app>/webapp/i18n/i18n.properties`):** abrigam os títulos de aplicações, descrições de abas, cabeçalhos de facetas, botões de ação e mensagens de confirmação/toast, além de placeholders padronizados.
     - **Metadados CDS (`@title` e `@Common.Label`):** adicionados nas projeções de `srv/tratativa-app-service.cds` e `srv/administracao-service.cds`, bem como detalhados nos arquivos `app/<app>/annotations.cds`.
     - **Parâmetros de Ações:** todo parâmetro de action OData v4 nos serviços de interface (`criarTratativaAvulsa`, `criarAcao`, `criarSubacao`, `delegarAcao`, `anexarEvidencia`, `comentarTratativa`, `comentarAcao`, `cancelarTratativa`, `reabrirTratativa`, `mudarCriticidade`, `aplicarTemplate`) recebe anotação `@Common.Label` amigável em pt-BR. O Fiori elements v4 lê essas anotações do documento `$metadata` para nomear automaticamente os campos dos diálogos modais de entrada.
     - **Colunas e Filtros:** cabeçalhos em `@UI.LineItem` e `@UI.SelectionFields` são padronizados com textos amigáveis ("Código", "Título", "Identificador de Origem", "Criticidade", "Status", "Unidade", "Área", "Data Prevista de Conclusão", "Evidência Obrigatória", "Responsável", "Prazo").
   — **Por quê:** elimina o vazamento de termos técnicos de banco de dados para os operadores de negócio e atende ao idioma corporativo oficial (013 R10).
   — **Verificado por:** CA3 (inspeção estrutural de `@Common.Label` e `i18n.properties`) e CA4 (verificação visual das telas sem nomes técnicos).

3. **Correção do Action Import "Criar Tratativa Avulsa" via EntityContainer e remoção do parâmetro discricionário de data (R3; Achado 3) [N3-2].**
   - No SAP Fiori elements v4, ações globais (unbound actions) declaradas na barra de ferramentas da tabela (`@UI.LineItem`) devem ser referenciadas obrigatoriamente através do caminho de Action Import no EntityContainer:
     `Action: 'TratativaAppService.EntityContainer/criarTratativaAvulsa'`
     A menção anterior sem `EntityContainer/` impedia o runtime do Fiori elements de identificar a ação, resultando em um botão inoperante.
   - **Parâmetros canônicos de criação avulsa:**
     - A spec 002 (R10, CA8) e 003 (R16) definem que a Data Prevista de Conclusão de uma tratativa é sempre calculada automaticamente pelo backend através da soma dos dias da Criticidade com a data de criação. Não existe prazo discricionário fixado pelo usuário na abertura da tratativa.
     - O parâmetro `dataPrevistaConclusao` é removido da assinatura de `criarTratativaAvulsa` em `srv/tratativa-app-service.cds`.
     - O diálogo modal passa a exibir estritamente os campos canônicos: Título (obrigatório), Criticidade (obrigatório com dropdown), Descrição (opcional), Unidade (opcional), Área (opcional) e Solicitante (opcional).
   - **Acesso autenticado irrestrito:**
     - Conforme 002 R17 e 003 Q6, a criação avulsa é acessível a qualquer colaborador autenticado (`authenticated-user`), sendo bloqueada unicamente para a credencial técnica de máquina `AplicativoOrigem` (HTTP 403).
   — **Por quê:** restaura a capacidade operacional de abertura de tratativas pela interface sem violar a regra de derivação determinística de prazos.
   — **Verificado por:** CA5 (inspeção de `$metadata` e POST síncrono) e CA6 (abertura do modal no navegador e criação com sucesso).

4. **Tipagem semântica, DatePicker para prazos, listas fixas de valores (dropdowns) e Value Help do SuccessFactors (R4; Achado 4) [LGPD] [N3-3].**
   - O teste visual apontou diálogos de ações com parâmetros como strings puras sem controles ergonômicos (prazo como texto em vez de calendário; campos enumerados como texto livre; responsável sem pesquisa de colaboradores).
   - **Solução arquitetural:**
     - **Prazos como `Date` (`Edm.Date`):** parâmetros de prazo nas actions de Ação (`criarAcao`, `criarSubacao`) em `srv/tratativa-app-service.cds` passam a ser tipados explicitamente como `Date`. No schema OData v4, o tipo `Edm.Date` instrui o Fiori elements a instanciar automaticamente o seletor visual de datas (DatePicker com ícone de calendário). No runtime CAP Node.js, valores do tipo `Date` são desserializados como string no formato ISO `'YYYY-MM-DD'`, mantendo total compatibilidade com a função `validarPrazo` em `srv/tratativa/acoes-validacao.ts` (Achado 5).
     - **Listas suspensas (dropdowns) com `@Common.ValueListWithFixedValues`:**
       - Para campos discretos enumerados, são expostas no `TratativaAppService` entidades de domínio auxiliares somente leitura (`ValoresCriticidade`, `ValoresPrioridade` e `ValoresEvidenciaObrigatoria`), anotadas com `@Common.ValueListWithFixedValues: true` e `@Common.ValueList`.
       - Parâmetros de Criticidade em Tratativas (`criarTratativaAvulsa`, `mudarCriticidade`) recebem anotação de ValueList com fixed values renderizando dropdown com as opções: "Baixa", "Média", "Alta", "Crítica".
       - Parâmetros de Prioridade em Ações (`criarAcao`, `criarSubacao`) recebem anotação de ValueList com fixed values renderizando dropdown com as opções: "Baixa", "Média", "Alta" (ações não possuem criticidade; 004 R3, R14).
       - Parâmetros de Evidência Obrigatória em Ações (`criarAcao`, `criarSubacao`) recebem anotação de ValueList com fixed values renderizando dropdown com as opções: "Sim", "Não".
     - **Ajuda de Pesquisa de Colaboradores (Value Help do SuccessFactors) [LGPD]:**
       - Conforme a decisão expressa do humano de 2026-10-11, o SuccessFactors é consumido na UI estritamente em tempo de leitura para ajuda de pesquisa (Value Help), sem operações de escrita e sem exposição de dados sensíveis além da identificação corporativa.
       - A entidade `@readonly entity Colaboradores` é exposta em `TratativaAppService` contendo exclusivamente: `key matricula : String(50)`, `nome : String(100)` e `email : String(100)`.
       - No hook `on('READ', 'Colaboradores')`, o serviço consulta o provedor de pessoas do SuccessFactors (`buscarColaboradores` da spec 011 / cache de pessoas), retornando apenas colaboradores ativos ordenados por nome.
       - Campos de seleção de colaborador (`responsavel` em `criarAcao` e `criarSubacao`, `solicitante` em `criarTratativaAvulsa`, `novoResponsavel` em `delegarAcao`) recebem anotação `@Common.ValueList` apontando para `Colaboradores`, renderizando botão com ícone de pesquisa que abre o diálogo modal padrão de seleção de colaboradores.
   — **Por quê:** previne erros de digitação de prazos e matrículas, orienta o usuário com opções válidas e resguarda a LGPD consumindo o SF estritamente para consulta.
   — **Verificado por:** CA7 (inspeção de `$metadata` com `Edm.Date`, `ValueList` fixos e Value Help SF), CA8 (verificação visual no navegador) e CA14 (schema de colaboradores sem CPF nem dados sensíveis).

5. **Transições de status da Tratativa com botões de cabeçalho dedicados e controle declarativo de visibilidade/habilitação (R5; Achado 5) [N3-4].**
   - O teste visual constatou que apenas o botão "Reabrir Tratativa" aparecia na Object Page (mesmo com a Tratativa Aberta), e faltavam os botões Iniciar, Encerrar e Cancelar, bem como o controle de visibilidade por status.
   - **Diagnóstico:** no design 013, os 4 botões de status foram apontados para a mesma action genérica `TratativaAppService.mudarStatus`. O Fiori elements v4 funde ou suprime botões duplicados apontando para uma mesma operação e não consegue inferir condições de visibilidade individualizadas. Além disso, `@Core.OperationAvailable` aplica-se a operações OData v4 e não a registros `UI.DataFieldForAction`.
   - **Solução arquitetural:**
     - Projeção de ações de ciclo de vida dedicadas na entidade `Tratativas` do `TratativaAppService`:
       - `action iniciarTratativa();`
       - `action encerrarTratativa();`
       - `action cancelarTratativa(justificativa : String(500));`
       - `action reabrirTratativa(justificativa : String(500));`
       *(A action anterior `mudarStatus(status, justificativa)` é preservada no serviço para retrocompatibilidade de testes anteriores).*
     - A entidade `Tratativas` expõe flags booleanas calculadas dinamicamente no hook `after('READ')`:
       - `podeIniciar`: `true` se `status === 'Aberta'` e usuário é `GestorTratativa`;
       - `podeEncerrar`: `true` se `status in ['Aberta', 'Em andamento']` e usuário é `GestorTratativa` (003 R2, CA4);
       - `podeCancelar`: `true` se `status in ['Aberta', 'Em andamento']` e usuário é `GestorTratativa`;
       - `podeReabrir`: `true` se `status === 'Encerrada'` e usuário é `GestorTratativa`.
       - Flags de visibilidade declaradas na entidade `Tratativas`: `ocultaIniciar`, `ocultaEncerrar`, `ocultaCancelar` e `ocultaReabrir`, calculadas no hook `after('READ')` como `oculta<Acao> = !pode<Acao>`.
       - Para status `Cancelada` (estado terminal; 003 R2, R3, CA7), todas as flags `pode<Acao>` são `false` e todas as `oculta<Acao>` são `true`.
       - Para usuários sem papel `GestorTratativa`, todas as flags `pode<Acao>` são `false` e `oculta<Acao>` são `true` (003 R2, 013 R7).
     - **Controle canônico de disponibilidade e visibilidade:**
       - `@Core.OperationAvailable: pode<Acao>` é declarado diretamente nas ações bound em `srv/tratativa-app-service.cds` e no escopo de ações `annotate TratativaAppService.Tratativas with actions { ... }`, conforme o vocabulário OData v4 `Org.OData.Core.V1`.
       - Nos registros `UI.DataFieldForAction` de `UI.Identification`, os botões recebem `@UI.Hidden: oculta<Acao>`, garantindo que apenas as transições válidas apareçam no cabeçalho.
     - As ações `cancelarTratativa` e `reabrirTratativa` exigem o preenchimento obrigatório de Justificativa (texto livre de até 500 caracteres, não vazio após trim; 003 R5), abrindo diálogo modal com placeholder orientativo contra dados sensíveis.
   — **Por quê:** materializa na íntegra a máquina de estados do ciclo de vida da spec 003 na experiência visual do Fiori elements de acordo com a semântica OData v4 oficial.
   — **Verificado por:** CA9 (inspeção de `$metadata` e chamadas de transição) e CA10 (inspeção visual no navegador dos botões em cada status).

6. **Completude visual dos Dados Gerais, colunas da listagem e ações da Administração (R6; Achados 6 e 7).**
   - O teste visual identificou que Dados Gerais exibia campos sem etiquetas descritivas, colunas da lista geral sofriam corte em tela desktop (Unidade, Área e Data prevista) e a tela de Administração não exibia os botões "Salvar Parâmetros" e "Executar Processamento Manual".
   - **Solução arquitetural:**
     - **Dados Gerais com Rótulos:** cada campo dentro de `UI.FieldGroup#DadosGerais` (`titulo`, `descricao`, `unidade`, `area`, `solicitante`, `dataPrevistaConclusao`) recebe rótulo explícito e tipagem compatível, assegurando que o formulário da Object Page exiba o rótulo antes do valor.
     - **Prevenção de Corte Visual nas Colunas:** no `@UI.LineItem` de Tratativas, as colunas `unidade`, `area` e `dataPrevistaConclusao` são anotadas com `@UI.Importance: #High` e larguras padronizadas no layout responsivo Fiori elements, prevenindo que sejam colapsadas na visualização padrão de desktop.
     - **Ações da Administração:** na aplicação `app/administracao/`, a aba "Parâmetros de Alertas" declara no `@UI.LineItem` e `@UI.Identification` os botões vinculados às actions globais do `AdministracaoService`:
       - `Action: 'AdministracaoService.EntityContainer/atualizarParametrosAlertas'` ("Salvar Parâmetros");
       - `Action: 'AdministracaoService.EntityContainer/executarProcessamentoAlertas'` ("Executar Processamento Manual").
       Ao serem acionados, `atualizarParametrosAlertas` abre diálogo de parâmetros e persiste os valores com mensagem não bloqueante; `executarProcessamentoAlertas` executa imediatamente e, ao retornar a estrutura complexa `RelatorioProcessamentoAlertas`, o Fiori elements v4 exibe nativamente o popup de resultado com o resumo de alertas gerados sem requerer código customizado (Achado 6).
   — **Por quê:** garante a fidelidade visual e funcional projetada na spec 013.
   — **Verificado por:** CA11 (inspeção de anotações) e CA12 (verificação visual no navegador das colunas e dos botões administrativos).

7. **Defesa e resiliência contra ausência de prazo na tabela PrazosCriticidade (R7; Achado 8) [N3-1].**
   - O teste visual registrou que a rotina `diasDoPrazo` em `srv/tratativa/prazo.ts` acessava diretamente `(prazo as { dias: number }).dias` após consulta ao banco. Em bases locais novas ou ambientes onde a tabela `PrazosCriticidade` ainda não fora populada, a consulta retornava `undefined`/`null`, disparando uma exceção não tratada do tipo `TypeError: Cannot read properties of undefined (reading 'dias')`, provocando a queda (crash) do processo Node.js do servidor CAP.
   - **Solução arquitetural:**
     - A função `diasDoPrazo(criticidade: string)` é refatorada defensivamente:
       ```typescript
       export async function diasDoPrazo(criticidade: string): Promise<number> {
         const prazo = (await cds.db.run(
           SELECT.one.from('br.com.calazanstec.PrazosCriticidade').columns('dias').where({ criticidade }),
         )) as { dias?: number } | null | undefined;
         if (!prazo || typeof prazo.dias !== 'number') {
           recusar(400, 'Prazo não configurado para a criticidade informada.', 'criticidade');
         }
         return prazo.dias;
       }
       ```
     - A ausência de configuração de prazo é tratada como recusa de negócio controlada (decisão D10) com código HTTP 400, mensagem clara (`Prazo não configurado para a criticidade informada.`) e `target: 'criticidade'`.
     - O processo do servidor Node.js permanece íntegro, ativo e responsivo para todos os usuários da plataforma.
   — **Por quê:** cumpre o princípio fundamental de disponibilidade e estabilidade do backend corporativo, eliminando pontos de falha catastrófica.
   — **Verificado por:** CA13 (teste automatizado de requisição em base sem prazos retornando 400 sem interrupção do processo).

8. **Proteção LGPD e menor privilégio na interface (R8) [LGPD].**
   - A ajuda de pesquisa de colaboradores expõe estritamente atributos profissionais corporativos (matrícula funcional, nome completo e e-mail corporativo), vedando qualquer campo de CPF, dados médicos ou registros de saúde ocupacional (AGENTS.md:66 e 013 R8).
   - Todos os campos de digitação livre de texto (justificativas de cancelamento e de reabertura, descrição e comentários) recebem anotação `@UI.Placeholder` contendo texto orientativo alertando contra a inserção de nomes e dados pessoais sensíveis.
   - Campos mascarados como `null` pelo backend para usuários sem papel de Gestor permanecem ocultos ou exibidos como traço neutro ("-").
   — **Por quê:** garante conformidade integral com a LGPD e o menor privilégio visual na camada de apresentação.
   — **Verificado por:** CA14 (inspeção do schema de colaboradores) e CA15 (inspeção de placeholders na interface).

9. **Estratégia de verificação em duas camadas: esteira automatizada headless e verificação no navegador (R10) [N3-5].**
   - Em conformidade estrita com a regra inviolável de AGENTS.md:38, a esteira contínua de engenharia (`npm test`, `npm run lint`, `npm run arch` e `verify.sh`) NUNCA abre navegadores reais nem utiliza drivers como Selenium/Playwright/Puppeteer.
   - **Camada 1 (Automatizada - Esteira):** testes automatizados sob `cds.test` com SQLite em memória validando integridade de esquemas, compilação de anotações CDS, metadados OData `$metadata`, Action Imports, Value Lists e manifestos JSON.
   - **Camada 2 (Visual - Orquestrador no Portal do Maestri):** ao término de cada etapa, o orquestrador realiza inspeção visual guiada no navegador (portal do Maestri) para comprovar a renderização gráfica, ausência de cortes visuais e comportamento de controles de tela (DatePicker, dropdowns, modais).
   — **Por quê:** preserva a velocidade e o determinismo da esteira automatizada sem abrir mão da validação da experiência do usuário real.
   — **Verificado por:** CA16 (esteira automatizada verde) e checklist visual detalhado em cada etapa das tasks.

---

## Contratos de Serviços e Anotações UI

### 1. `srv/tratativa/prazo.ts` (Robusto contra dados ausentes)
```typescript
import cds from '@sap/cds';
import { recusar } from './recusa';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function somarDiasCorridos(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const base = Date.UTC(ano, mes - 1, dia);
  return new Date(base + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Lê da tabela PrazosCriticidade os dias da Criticidade tratando ausência defensivamente (R7, Achado 8). */
export async function diasDoPrazo(criticidade: string): Promise<number> {
  const prazo = (await cds.db.run(
    SELECT.one.from('br.com.calazanstec.PrazosCriticidade').columns('dias').where({ criticidade }),
  )) as { dias?: number } | null | undefined;
  if (!prazo || typeof prazo.dias !== 'number') {
    recusar(400, 'Prazo não configurado para a criticidade informada.', 'criticidade');
  }
  return prazo.dias;
}
```

### 2. `srv/tratativa-app-service.cds`
```cds
using { br.com.calazanstec as m } from '../db/tratativa';

@path    : '/api/app/v1'
@requires: 'authenticated-user'
service TratativaAppService {

  @readonly
  @cds.redirection.target
  entity Tratativas as projection on m.Tratativas {
    key codigo,
        titulo,
        descricao,
        origem,
        idOrigem,
        criticidade,
        status,
        unidade,
        area,
        solicitante,
        responsavelPrincipal,
        dataCriacao,
        dataPrevistaConclusao,
        false as ocultaResponsaveis : Boolean,
        // Flags calculadas no hook after('READ') para controle declarativo de transição de status (R5, Achados 1 e 2)
        false as podeIniciar        : Boolean,
        false as podeEncerrar       : Boolean,
        false as podeCancelar       : Boolean,
        false as podeReabrir        : Boolean,
        false as ocultaIniciar      : Boolean,
        false as ocultaEncerrar     : Boolean,
        false as ocultaCancelar     : Boolean,
        false as ocultaReabrir      : Boolean,
        acoes         : Composition of many Acoes on acoes.tratativa = $self,
        participantes : Composition of many Participantes on participantes.tratativa = $self,
        evidencias    : Composition of many Evidencias on evidencias.tratativa = $self,
        comentarios   : Composition of many Comentarios on comentarios.tratativa = $self,
        historico     : Association to many Historico on historico.tratativa = $self
  } actions {
    // Transições de status dedicadas (R5; Achados 2 e 5)
    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeIniciar
    action iniciarTratativa();

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeEncerrar
    action encerrarTratativa();

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeCancelar
    action cancelarTratativa(
      @Common.Label: 'Justificativa do cancelamento'
      justificativa : String(500)
    );

    @requires: 'GestorTratativa'
    @Core.OperationAvailable: podeReabrir
    action reabrirTratativa(
      @Common.Label: 'Justificativa da reabertura'
      justificativa : String(500)
    );

    // Mantida para compatibilidade
    @requires: 'GestorTratativa'
    action mudarStatus(status : String, justificativa : String);

    @requires: 'GestorTratativa'
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);

    @requires: 'GestorTratativa'
    action mudarCriticidade(
      @Common.Label: 'Nova criticidade'
      criticidade : m.Criticidade
    );

    @requires: 'GestorTratativa'
    action aplicarTemplate(templateId : UUID);

    @requires: 'GestorTratativa'
    action criarAcao(
      @Common.Label: 'Descrição da ação'
      descricao            : String,
      @Common.Label: 'Responsável'
      responsavel          : String,
      @Common.Label: 'Prazo limite'
      prazo                : Date,
      @Common.Label: 'Prioridade'
      prioridade           : String,
      @Common.Label: 'Evidência obrigatória'
      evidenciaObrigatoria : String
    ) returns ResultadoCriacaoAcao;

    @requires: 'GestorTratativa'
    action criarSubacao(
      @Common.Label: 'Ação superior'
      acaoMae              : UUID,
      @Common.Label: 'Descrição da subação'
      descricao            : String,
      @Common.Label: 'Responsável'
      responsavel          : String,
      @Common.Label: 'Prazo limite'
      prazo                : Date,
      @Common.Label: 'Prioridade'
      prioridade           : String,
      @Common.Label: 'Evidência obrigatória'
      evidenciaObrigatoria : String
    ) returns ResultadoCriacaoAcao;

    @requires: 'GestorTratativa'
    action delegarAcao(
      @Common.Label: 'Ação'
      acao            : UUID,
      @Common.Label: 'Novo responsável'
      novoResponsavel : String,
      @Common.Label: 'Justificativa'
      justificativa   : String
    );

    @requires: 'authenticated-user'
    action anexarEvidencia(acao : UUID, nomeArquivo : String, mimeType : String, conteudo : String, descricao : String) returns DetalheEvidencia;

    @requires: 'authenticated-user'
    action removerEvidencia(acao : UUID, evidencia : UUID);

    @requires: 'authenticated-user'
    action comentarTratativa(texto : String, mencoes : many String) returns ResultadoComentario;

    @requires: 'authenticated-user'
    action comentarAcao(acao : String, texto : String, mencoes : many String) returns ResultadoComentario;
  };

  type ResultadoCriacaoAcao { codigo : UUID; }
  type ResultadoComentario { codigo : UUID; }
  type DetalheEvidencia {
    codigo      : UUID;
    acao        : UUID;
    nomeArquivo : String(255);
    mimeType    : String(100);
    tamanho     : Integer;
    descricao   : String(500);
    criadoEm    : Timestamp;
    autorAnexo  : String(50);
  }

  // Criação avulsa canônica via Action Import sem prazo discricionário (R3, Achado 3)
  action criarTratativaAvulsa(
    @Common.Label: 'Título da tratativa'
    titulo      : String(200),
    @Common.Label: 'Descrição detalhada'
    descricao   : String(5000),
    @Common.Label: 'Criticidade'
    criticidade : m.Criticidade,
    @Common.Label: 'Unidade corporativa'
    unidade     : String(100),
    @Common.Label: 'Área operacional'
    area        : String(100),
    @Common.Label: 'Colaborador solicitante'
    solicitante : String(50)
  ) returns Tratativas;

  // Projeção de colaboradores para Value Help do SuccessFactors (R4, R8; Achado 4) [LGPD]
  @readonly
  entity Colaboradores {
    @Common.Label: 'Matrícula funcional'
    key matricula : String(50);
    @Common.Label: 'Nome completo'
        nome      : String(100);
    @Common.Label: 'E-mail corporativo'
        email     : String(100);
  }

  // Domínios discretos para dropdowns (ValueListWithFixedValues)
  @readonly
  entity ValoresCriticidade {
    key codigo    : String(10);
        descricao : String(50);
  }

  @readonly
  entity ValoresPrioridade {
    key codigo    : String(10);
        descricao : String(50);
  }

  @readonly
  entity ValoresEvidenciaObrigatoria {
    key codigo    : String(10);
        descricao : String(50);
  }

  @readonly
  @cds.redirection.target
  entity Acoes as projection on m.Acoes {
    key codigo,
        tratativa,
        descricao,
        prioridade,
        status,
        prazo,
        evidenciaObrigatoria,
        dataConclusao,
        responsavel,
        acaoMae
  } actions {
    action iniciar();
    action concluir();
  };

  @readonly
  entity Participantes as projection on m.ParticipantesTratativa {
    key ID,
        tratativa,
        matricula,
        sequencia,
        criadoEm
  };

  @readonly entity Evidencias as projection on m.Evidencias;
  @readonly entity Comentarios as projection on m.Comentarios;
  @readonly entity Historico as projection on m.HistoricoTratativa;

  @readonly
  @cds.redirection.target: false
  @cds.query.limit: { default: 50, max: 200 }
  entity MinhasAcoes as projection on m.Acoes {
    key codigo as codigoAcao,
        tratativa.codigo as codigoTratativa,
        tratativa.titulo as tituloTratativa,
        tratativa.status as statusTratativa,
        descricao,
        prioridade,
        status as statusAcao,
        prazo,
        evidenciaObrigatoria,
        dataConclusao
  } actions {
    action iniciar();
    action concluir();
  };

  @readonly
  @cds.redirection.target: false
  @cds.query.limit: { default: 50, max: 200 }
  entity MinhasTratativas as projection on m.Tratativas {
    key codigo as codigoTratativa,
        titulo as tituloTratativa,
        origem,
        idOrigem,
        criticidade,
        status as statusTratativa,
        unidade,
        area,
        dataPrevistaConclusao,
        'Responsável' as meuPapel : String(30)
  };
}
```

### 3. `app/tratativas/webapp/Component.js` (Componente UI5 Fiori elements v4)
```javascript
sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
  "use strict";

  return AppComponent.extend("br.com.calazanstec.actionplan.tratativas.Component", {
    metadata: {
      manifest: "json"
    }
  });
});
```

### 4. `app/tratativas/webapp/index.html` (Sandbox local com UI5 por CDN)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gestão de Tratativas - Sandbox</title>
  <script
    id="sap-ui-bootstrap"
    src="https://ui5.sap.com/1.120.0/resources/sap-ui-core.js"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-resourceroots='{ "br.com.calazanstec.actionplan.tratativas": "./" }'
    data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"
    data-sap-ui-compatVersion="edge"
    data-sap-ui-async="true"
    data-sap-ui-frameOptions="trusted">
  </script>
</head>
<body class="sapUiBody" id="content">
  <div
    data-sap-ui-component
    data-name="br.com.calazanstec.actionplan.tratativas"
    data-id="container"
    data-settings='{ "id" : "tratativas" }'>
  </div>
</body>
</html>
```
*(Estrutura idêntica adotada para `app/minhas-pendencias/webapp/` e `app/administracao/webapp/`, ajustando os respectivos namespaces e títulos).*

### 5. `app/tratativas/annotations.cds` (Trecho de transições, Action Import e Value Helps)
```cds
using TratativaAppService from '../../srv/tratativa-app-service';

annotate TratativaAppService.Tratativas with @(
  UI.HeaderInfo: {
    TypeName: 'Tratativa',
    TypeNamePlural: 'Tratativas',
    Title: { $Type: 'UI.DataField', Value: titulo },
    Description: { $Type: 'UI.DataField', Value: codigo }
  },
  UI.Identification: [
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Iniciar Tratativa',
      Action: 'TratativaAppService.iniciarTratativa',
      @UI.Hidden: ocultaIniciar
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Encerrar Tratativa',
      Action: 'TratativaAppService.encerrarTratativa',
      @UI.Hidden: ocultaEncerrar
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Cancelar Tratativa',
      Action: 'TratativaAppService.cancelarTratativa',
      @UI.Hidden: ocultaCancelar
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Reabrir Tratativa',
      Action: 'TratativaAppService.reabrirTratativa',
      @UI.Hidden: ocultaReabrir
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Alterar Criticidade',
      Action: 'TratativaAppService.mudarCriticidade'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Adicionar Ação',
      Action: 'TratativaAppService.criarAcao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Adicionar Subação',
      Action: 'TratativaAppService.criarSubacao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Delegar Ação',
      Action: 'TratativaAppService.delegarAcao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Anexar Evidência',
      Action: 'TratativaAppService.anexarEvidencia'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Remover Evidência',
      Action: 'TratativaAppService.removerEvidencia'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Comentar Tratativa',
      Action: 'TratativaAppService.comentarTratativa'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Comentar Ação',
      Action: 'TratativaAppService.comentarAcao'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Aplicar Template',
      Action: 'TratativaAppService.aplicarTemplate'
    }
  ],
  UI.SelectionFields: [
    origem,
    criticidade,
    status,
    unidade,
    area
  ],
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: codigo, Label: 'Código', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: titulo, Label: 'Título', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: origem, Label: 'Origem', @UI.Importance: #Medium },
    { $Type: 'UI.DataField', Value: idOrigem, Label: 'ID na Origem', @UI.Importance: #Medium },
    { $Type: 'UI.DataField', Value: criticidade, Label: 'Criticidade', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: status, Label: 'Status', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: unidade, Label: 'Unidade', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: area, Label: 'Área', @UI.Importance: #High },
    { $Type: 'UI.DataField', Value: dataPrevistaConclusao, Label: 'Data Prevista de Conclusão', @UI.Importance: #High },
    {
      $Type: 'UI.DataFieldForAction',
      Label: 'Criar Tratativa Avulsa',
      Action: 'TratativaAppService.EntityContainer/criarTratativaAvulsa'
    }
  ],
  UI.FieldGroup #DadosGerais: {
    Data: [
      { $Type: 'UI.DataField', Value: titulo, Label: 'Título da Tratativa' },
      { $Type: 'UI.DataField', Value: descricao, Label: 'Descrição Detalhada' },
      { $Type: 'UI.DataField', Value: unidade, Label: 'Unidade Organizacional' },
      { $Type: 'UI.DataField', Value: area, Label: 'Área Operacional' },
      { $Type: 'UI.DataField', Value: solicitante, Label: 'Colaborador Solicitante' },
      { $Type: 'UI.DataField', Value: dataPrevistaConclusao, Label: 'Data Prevista de Conclusão' }
    ]
  }
);
```

### 6. Anotações de Value Help e listas suspensas (Dropdowns)
```cds
annotate TratativaAppService with actions {
  criarTratativaAvulsa(
    criticidade @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresCriticidade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: criticidade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    ),
    solicitante @(
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: solicitante, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    )
  );
};

annotate TratativaAppService.Tratativas with actions {
  iniciarTratativa @Core.OperationAvailable: podeIniciar;
  encerrarTratativa @Core.OperationAvailable: podeEncerrar;
  cancelarTratativa @Core.OperationAvailable: podeCancelar;
  reabrirTratativa @Core.OperationAvailable: podeReabrir;

  mudarCriticidade(
    criticidade @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresCriticidade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: criticidade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    )
  );

  criarAcao(
    responsavel @(
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: responsavel, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    ),
    prioridade @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresPrioridade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: prioridade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    ),
    evidenciaObrigatoria @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresEvidenciaObrigatoria',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: evidenciaObrigatoria, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    )
  );

  criarSubacao(
    responsavel @(
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: responsavel, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    ),
    prioridade @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresPrioridade',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: prioridade, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    ),
    evidenciaObrigatoria @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList: {
        CollectionPath: 'ValoresEvidenciaObrigatoria',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: evidenciaObrigatoria, ValueListProperty: 'codigo' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'descricao' }
        ]
      }
    )
  );

  delegarAcao(
    novoResponsavel @(
      Common.ValueList: {
        CollectionPath: 'Colaboradores',
        Parameters: [
          { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: novoResponsavel, ValueListProperty: 'matricula' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'nome' },
          { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
      }
    )
  );
};
```

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-acabamento-ui-fiori.md` | Entregar o intent 015 em 4 etapas sequenciais RED/GREEN: (1) Robustez do backend e contratos de serviço (`diasDoPrazo`, tipagem Date, listas de valores e Value Help SF); (2) Componentes SAPUI5 autônomos (`Component.js`) e sandbox local (`index.html`); (3) Rótulos amigáveis pt-BR, internacionalização e acabamento de `app/tratativas/`; (4) Acabamento de `app/minhas-pendencias/` e `app/administracao/`. | `acabamento-ui-fiori/001-acabamento-ui-fiori` |

---

## Itens N3 (aguardam aprovação no Gate 1)

| Item | Origem | Impacto | Justificativa e Mitigação |
|---|---|---|---|
| N3-1 | R7, Achado 8 | Tratamento defensivo em `srv/tratativa/prazo.ts` com recusa 400 estruturada para tabela `PrazosCriticidade` não inicializada. | Previne queda catastrófica (`TypeError`) do servidor Node.js CAP sem gerar comportamento silencioso de prazos zerados. |
| N3-2 | R3, Achado 3 | Ajuste no Action Import `TratativaAppService.EntityContainer/criarTratativaAvulsa` e remoção do parâmetro discricionário `dataPrevistaConclusao`. | Corrige o acionamento no Fiori elements v4 e assegura que a data prevista seja sempre derivada do cálculo determinístico de prazos (002 R10, 003 R16). |
| N3-3 | R4, Achado 4 | Exposição da entidade `Colaboradores` em `TratativaAppService` para Value Help conectada ao SuccessFactors em modo estritamente leitura sob LGPD. | Habilita a seleção visual de colaboradores corporativos sem expor dados sensíveis além de matrícula funcional, nome e e-mail corporativo. |
| N3-4 | R5, Achado 5 | Ações dedicadas de status (`iniciarTratativa`, `encerrarTratativa`, `cancelarTratativa`, `reabrirTratativa`) com controle declarativo `@Core.OperationAvailable`. | Implementa a máquina de estados oficial da spec 003 na interface com botões individualizados e justificativa obrigatória. |
| N3-5 | R10 | Protocolo de verificação em duas camadas: esteira de engenharia headless sem navegador real e validação visual no navegador corporativo pelo Orquestrador. | Resguarda a regra inviolável de testes da plataforma (AGENTS.md:38) enquanto atesta a fidelidade gráfica e ergonomia visual. |

---

## O que não muda

- A ausência de tela de login própria permanece inegociável: toda autenticação corporativa continua delegada ao SAP Build Work Zone / XSUAA (005 R4, AGENTS.md:11,52).
- As aplicações continuam operando em modo estritamente síncrono e direto sem rascunhos CAP (`draft: false`) no MVP (013 R3, decisão D9).
- A fronteira arquitetural rígida é preservada: nenhum arquivo em `app/` importa arquivos TypeScript ou JavaScript de `srv/` ou `db/` (decisão D2, AGENTS.md:54).
- O SAP SuccessFactors opera em modo estritamente somente leitura; o sistema nunca escreve de volta no SF (AGENTS.md:37).
- A esteira automatizada de engenharia (`verify.sh`) nunca depende de navegadores reais nem de rede externa (AGENTS.md:38).
- O empacotamento MTA, os descritores `ui5.yaml` e a geração de arquivos zip em `dist/` para publicação no HTML5 Application Repository permanecem compatíveis com a spec 014.
- Nenhuma regra departamental ou vocabulário exclusivo do SESMT é codificado na interface ou nos serviços (AGENTS.md:36).

---

## O desconfortável, declarado

1. **Separação entre flags de visualização e regras de domínio:**
   Para governar a visibilidade e habilitação dos botões no Fiori elements declarativamente via `@Core.OperationAvailable`, o `TratativaAppService` expõe flags auxiliares (`podeIniciar`, `podeEncerrar`, etc.). A verdadeira segurança continua sendo garantida no backend pelos handlers que validam os estados permitidos e rejeitam transições inválidas com HTTP 409.
2. **Dependência de CDN oficial no sandbox local:**
   O arquivo `index.html` de sandbox local consome os recursos da biblioteca SAPUI5 a partir da CDN oficial da SAP (`https://ui5.sap.com`). Em ambiente corporativo com isolamento absoluto de rede externa, o desenvolvedor deve utilizar a execução integrada via preview do Work Zone ou servir o SDK UI5 localmente.

---

## Arquivos Envolvidos

- `srv/tratativa/prazo.ts`
- `srv/tratativa-app-service.cds`
- `srv/tratativa-app-service.ts`
- `app/tratativas/annotations.cds`
- `app/tratativas/webapp/Component.js`
- `app/tratativas/webapp/index.html`
- `app/tratativas/webapp/i18n/i18n.properties`
- `app/minhas-pendencias/annotations.cds`
- `app/minhas-pendencias/webapp/Component.js`
- `app/minhas-pendencias/webapp/index.html`
- `app/minhas-pendencias/webapp/i18n/i18n.properties`
- `app/administracao/annotations.cds`
- `app/administracao/webapp/Component.js`
- `app/administracao/webapp/index.html`
- `app/administracao/webapp/i18n/i18n.properties`
- `test/ui-acabamento.test.ts`
- `test/ui-tratativas.test.ts`
- `test/ui-administracao.test.ts`

---

## Correção (revisão de design 1, 2026-10-11)

Ajustes efetuados para atender integralmente ao Parecer de Revisão (`revisao-design-parecer-1.md`):
1. **Propriedades `oculta<Acao>` na entidade `Tratativas` (Achado 1):** Declaradas explicitamente em `srv/tratativa-app-service.cds` sob `Tratativas` (`ocultaIniciar`, `ocultaEncerrar`, `ocultaCancelar`, `ocultaReabrir` como `Boolean`) e sincronizadas no hook `after('READ')` (`oculta<Acao> = !pode<Acao>`), viabilizando a avaliação determinística do `@UI.Hidden` no SAP Fiori elements v4.
2. **Reposicionamento canônico de `@Core.OperationAvailable` (Achado 2):** Removido dos registros `UI.DataFieldForAction` em `app/tratativas/annotations.cds` e reposicionado na definição das ações bound em `srv/tratativa-app-service.cds` e no bloco `annotate TratativaAppService.Tratativas with actions { ... }`, respeitando o vocabulário OData v4 `Org.OData.Core.V1`.
3. **Escopo correto de ações bound e completude de ValueLists (Achado 3):** Anotações de parâmetros de ações bound reestruturadas no escopo canônico `annotate TratativaAppService.Tratativas with actions { ... }`. Adicionadas anotações `@Common.ValueList` e `@Common.ValueListWithFixedValues` em `criarSubacao` (`responsavel`, `prioridade`, `evidenciaObrigatoria`), `delegarAcao` (`novoResponsavel`) e `mudarCriticidade` (`criticidade`), além de `criarTratativaAvulsa` e `criarAcao`.
4. **Inclusão dos testes pré-existentes em `## Arquivos Envolvidos` (Achado 4):** Adicionados `test/ui-tratativas.test.ts` e `test/ui-administracao.test.ts`, documentando a adequação das asserções de Action Import (`EntityContainer/`) e das 4 ações de status dedicadas.
5. **Compatibilidade de tipagem `Date` com validação de string (Achado 5):** Esclarecido que parâmetros `Date` OData v4 são recebidos no CAP Node.js como string ISO `YYYY-MM-DD`, mantendo conformidade nativa com `validarPrazo`.
6. **Comportamento nativo de retorno em `executarProcessamentoAlertas` (Achado 6):** Esclarecido que o tipo complexo de retorno `RelatorioProcessamentoAlertas` gera diálogo nativo no Fiori elements v4 sem necessidade de código customizado.
