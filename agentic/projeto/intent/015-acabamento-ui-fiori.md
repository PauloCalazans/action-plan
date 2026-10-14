# Intent: Acabamento da UI Fiori

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-11
**Status:** aprovado
**Origem:** teste visual

## Problema
Durante a verificação visual das aplicações no navegador (registrada em `agentic/.estado/execucao/2026-10-11-teste-visual-ui/achados.md`), constatou-se que a camada de interface necessita de acabamento e usabilidade para operação corporativa real:
1. As aplicações em `app/` não possuem `Component.js` nem arquivo de entrada local (`index.html`/sandbox), carregando apenas via preview genérico do CAP e não como aplicações SAPUI5 completas no navegador ou no SAP Build Work Zone;
2. Ausência de rótulos amigáveis em português (`@title`/`@Common.Label`), fazendo com que filtros, colunas, formulários e parâmetros de ações apresentem identificadores técnicos internos (`codigo`, `idOrigem`, `evidenciaObrigatoria`, etc.);
3. O botão de criação de ocorrências avulsas ("Criar Tratativa Avulsa") no List Report não dispara a criação devido ao direcionamento incorreto da action não ligada no Fiori elements v4;
4. Os diálogos de ações exibem campos sem tipagem ou ajudas de entrada (datas tratadas como strings sem seletor de calendário, ausência de listas fixas de valores para criticidade, prioridade, status e evidência obrigatória, e falta de ajuda de pesquisa de pessoas integrada ao SuccessFactors);
5. As transições de status da Tratativa não implementam a visibilidade e habilitação dinâmica por status previstas na spec 003 (exibindo apenas "Reabrir Tratativa" mesmo para ocorrências abertas);
6. A seção de Dados Gerais na Object Page apresenta valores sem identificação clara e a tabela de ocorrências corta colunas essenciais como Unidade, Área e Data prevista de conclusão;
7. A tela de Administração não disponibiliza os botões de ação "Salvar Parâmetros" e "Executar Processamento Manual" previstos no design da spec 013;
8. No backend, uma requisição para tratativa sem prazo configurado para a criticidade causa falha não tratada em `srv/tratativa/prazo.ts`, derrubando o servidor.

## Resultado proposto
As três aplicações Fiori elements corporativas (`app/tratativas/`, `app/minhas-pendencias/`, `app/administracao/`) operam de forma completa, robusta e polida:
- Executam como aplicações SAPUI5 autônomas tanto em ambiente de desenvolvimento local (sandbox) quanto quando empacotadas para o SAP Build Work Zone, preservando a estrutura da spec 014;
- Exibem 100% dos textos, rótulos, filtros, colunas e parâmetros em Português do Brasil (pt-BR), eliminando identificadores técnicos da tela;
- O botão "Criar Tratativa Avulsa" executa a abertura para qualquer colaborador autenticado com diálogo completo e persistência funcional (com parâmetros canônicos de 002, sem data prevista discricionária);
- Diálogos de ações oferecem controles amigáveis: seletor de calendário para datas, listas de valores suspensas (dropdowns) para criticidade (em tratativas), prioridade e obrigatoriedade de evidência (em ações), e ajuda de pesquisa de colaboradores (Value Help consumindo dados do SuccessFactors em modo somente leitura);
- Botões de mudança de status da Tratativa ("Iniciar", "Encerrar", "Cancelar", "Reabrir") aparecem e habilitam-se dinamicamente conforme o status atual da ocorrência, com encerramento direto de Aberta, justificativa obrigatória no cancelamento e na reabertura, e nenhum botão de transição em Cancelada;
- Telas completas e legíveis: Dados Gerais identificados com rótulos, tabela de gestão com colunas Unidade/Área/Data prevista visíveis, e tela de Administração com botões operacionais para salvar configurações e disparar alertas manualmente;
- O backend recusa de forma segura e controlada (sem interrupção do processo do servidor) qualquer operação caso não haja prazo configurado para a criticidade.

## Usuários e sistemas afetados
- Usuários da plataforma, Gestores de Tratativa e Administradores da plataforma: ganho substancial de produtividade com navegação fluida, formulários intuitivos e vocabulário claro em português.
- Aplicações Fiori elements em `app/` e serviços backend CAP (`TratativaAppService`, `AdministracaoService`).
- Integração SAP SuccessFactors: consumida na interface estritamente como ajuda de pesquisa (Value Help) para busca de colaboradores.

## Restrições e não-escopo
- Restrição: a interface Fiori elements expõe exclusivamente as regras de negócio consolidadas nas specs 003 a 011, sem criar lógica de negócio própria no frontend.
- Restrição: o SAP SuccessFactors é utilizado apenas como fonte de leitura para ajuda de pesquisa (Value Help), sem nenhuma escrita externa.
- Restrição: preservação do modelo de empacotamento MTA e HTML5 Application Repository especificado no intent 014.
- Restrição: a esteira de verificação automatizada (`verify.sh`) nunca depende de navegadores reais nem de conexão externa de rede (AGENTS.md:38).
- Fora de escopo: execução física de deploy no SAP BTP, telas internas de login/autenticação no aplicativo (centralizadas no Launchpad/Work Zone), alteração da matriz de papéis corporativos ou regras de negócio inéditas.

## Critérios de aceite de negócio
- Cada aplicação Fiori elements carrega como componente SAPUI5 executável em ambiente local e no empacotamento corporativo.
- Nenhuma tela, coluna, filtro ou diálogo de ação exibe nomes técnicos em camelCase; todos os elementos apresentam rótulos em pt-BR.
- A ação "Criar Tratativa Avulsa" abre diálogo estruturado com parâmetros canônicos (sem data discricionária) e conclui a criação com sucesso a partir da tela de Gestão de Tratativas para qualquer colaborador autenticado.
- Diálogos de ações dispõem de calendário para campos de data, listas fixas de opções para enums (prioridade e evidência em ações; criticidade em tratativas) e lista de colaboradores para seleção de responsáveis.
- A Object Page da Tratativa exibe apenas os botões de mudança de status aplicáveis ao status atual da ocorrência (incluindo encerramento a partir de Aberta e nenhum botão em Cancelada), exigindo justificativa para cancelamento e reabertura.
- A tela de Tratativas exibe Dados Gerais com rótulos e colunas Unidade, Área e Data prevista visíveis; a Administração oferece botões para salvar parâmetros e acionar processamento imediato.
- Requisições que envolvam criticidade sem prazo cadastrado recebem resposta de recusa estruturada com mensagem descritiva sem derrubar o servidor.

## Questões abertas
- Nenhuma questão aberta remanescente. As definições funcionais e de usabilidade foram detalhadas a partir dos achados visuais e deliberadas por delegação ao orquestrador (D11).
