# Task 001: dashboards-e-indicadores

**Spec:** agentic/projeto/specs/dashboards-e-indicadores/spec.md  
**Status:** em-andamento  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** dashboards-e-indicadores/001-dashboards-e-indicadores

## Objetivo
Entregar o intent 012 disponibilizando o catálogo corporativo de métricas e indicadores de desempenho em três níveis analíticos (Operacional, Gestão e Executivo), mais o totalizador de Evidências Pendentes, com exposição estruturada via serviço OData somente leitura para consumo por ferramentas externas de visualização (Power BI e SAC), dividida em 4 etapas sequenciais RED/GREEN:
1. **Serviço analítico, papel Leitor Analítico, views operacionais e proteção LGPD:** criação do serviço `AnaliticoService` em `srv/analitico-service.cds` com configuração do novo papel `LeitorAnalitico` (`LeitorAnalitico`) em `package.json`, recusa estática de verbos de escrita (HTTP 405) e do `AplicativoOrigem` (HTTP 403), implementação das views analíticas operacionais em `srv/analitico/operacional.cds` (`TratativasAbertas`, `TratativasVencidas`, `AcoesEmAndamento` vinculada a tratativas ativas, `PendenciasPorResponsavel` para Gestor e Administrador, `PendenciasPorUnidadeArea` e `PendenciasPorUnidade`), todas com chave primária explícita, suporte a data de corte determinística, resolução do atraso perpétuo e segregação LGPD (R1, R2, R6, R10, R11; CA1-CA6, CA19, CA25-CA30);
2. **Views de gestão, histórico unificado, reaberturas e tratamento de 'Sem Origem':** implementação das views analíticas de gestão em `srv/analitico/gestao.cds` (`TratativasPorOrigem`, `TratativasPorCriticidade`, `RankingAreas`), functions analíticas com filtros temporais (`consultarCumprimentoDePrazo`, `consultarTempoMedioResolucao`), consumo de eventos do histórico de auditoria unificado considerando o último encerramento em ocorrências reabertas, padronização de tratamento para registros sem origem sob o rótulo oficial `'Sem Origem'` com normalização de maiúsculas/minúsculas/espaços, agrupamento de áreas sem preenchimento sob `'Sem Área'`, e corte temporal padronizado em UTC (R3, R7, R8; CA7-CA12, CA20-CA22);
3. **Views executivas, índice de resolução e evidências pendentes:** implementação das views executivas em `srv/analitico/executivo.cds` (`VolumePorOrigem` com total e percentual, `PrincipaisDesvios` com tratativas em atraso, `BacklogTotal` com soma de tratativas e ações ativas, `EvidenciasPendentes` com zero evidências anexadas) e functions (`consultarTendenciaMensal`, `consultarIndiceResolucao`), modelagem da taxa percentual de vazão global admitindo valores superiores a 100.00% em redução de passivo, e neutralidade absoluta de regras para qualquer Origem ou área funcional (R4, R5, R13; CA13-CA18, CA34);
4. **Exposição OData v4, paginação analítica e precedência D10:** exposição dos entity sets analíticos via protocolo OData v4 padronizado para conectores de Power BI e SAC, paginação externa via `$top` (limite máximo de 1.000) e `$skip`, e consolidação da matriz de erros da Decisão D10 no handler `srv/analitico/filtros.ts` com validações de data ISO 8601, consistência de período (`periodoInicio > periodoFim`) e criticidade (R9, R12; CA23, CA24, CA31-CA33).

---

## Arquivos
- `package.json`
- `srv/analitico-service.cds`
- `srv/analitico-service.ts`
- `srv/analitico/operacional.cds`
- `srv/analitico/gestao.cds`
- `srv/analitico/executivo.cds`
- `srv/analitico/filtros.ts`
- `test/apoio/analitico.ts`
- `test/analitico-operacional-lgpd.test.ts`
- `test/analitico-gestao-metricas.test.ts`
- `test/analitico-executivo-evidencias.test.ts`
- `test/analitico-odata-precedencia-d10.test.ts`

---

## Interfaces

- **Produz:**
  - Configuração em `package.json`: emulação do papel corporativo `LeitorAnalitico` no perfil de testes (`mocked` auth com usuário `leitor-analitico`).
  - Serviço público OData v4 em `srv/analitico-service.cds` (`/api/analitico/v1`):
    * Entities operacionais (projeções sobre `operacional.cds`): `TratativasAbertas` (key id, total), `TratativasVencidas` (key id, total), `AcoesEmAndamento` (key id, total), `PendenciasPorResponsavel` (key responsavel, total; restrita a Gestor e Administrador), `PendenciasPorUnidadeArea` (key unidade, key area, total; aberto a todos os leitores analíticos), `PendenciasPorUnidade` (key unidade, total).
    * Entities de gestão (projeções sobre `gestao.cds`): `TratativasPorOrigem` (key origem, total), `TratativasPorCriticidade` (key criticidade, total), `RankingAreas` (key area, total).
    * Entities executivas (projeções sobre `executivo.cds`): `VolumePorOrigem` (key origem, total, percentual), `PrincipaisDesvios` (key origem, totalDesvios), `BacklogTotal` (key id, total), `EvidenciasPendentes` (key id, total).
    * Functions analíticas com filtros: `consultarCumprimentoDePrazo`, `consultarTempoMedioResolucao`, `consultarTendenciaMensal`, `consultarIndiceResolucao`, `consultarTratativasVencidas`.
  - Módulos analíticos em `srv/analitico/`:
    * `operacional.cds`, `gestao.cds`, `executivo.cds`: definições das CDS Views analíticas declarativas sem criação de tabelas físicas no banco, todas com chave primária não nula.
    * `filtros.ts`: validação semântica de parâmetros textuais de período ISO 8601, período inválido e limites de `$top`.
  - Handler em `srv/analitico-service.ts`: aplicação da precedência D10, controle de acesso e bloqueio de escrita (405).
  - Helper de teste em `test/apoio/analitico.ts`: utilitários para invocação OData aos endpoints analíticos e exportação de `comoLeitorAnalitico` (sem asserções).
  - Quatro novas suítes de teste de integração baseadas em Jest e `cds.test`.

- **Consome:**
  - Entidades persistidas: `Tratativas`, `Acoes`, `HistoricoTratativa`, `Evidencias`.
  - Módulos existentes:
    * `srv/tratativa/recusa.ts`: função `recusar` para lançamento de erros com status e target.
  - Helpers de teste em `test/apoio/`:
    * `usuarios.ts` (`comoAdmin`, `comoGestor`, `comoUsuario`, `comoApp`, `semAuth`).
    * `tratativas.ts` (`criarAvulsa`, `abrirPorApp`, `mudarStatus`).
    * `acoes.ts` (`criarAcao`, `mudarStatusAcao`).
    * `banco.ts` (`linhas`).

---

## Regras para todas as etapas

- **Commits sequenciais por etapa:** cada etapa é composta estritamente por um commit `test(red): <etapa> …` (contendo exclusivamente arquivos em `test/` e, se necessário, este arquivo de task) seguido por um commit `feat(green): <etapa> …` (contendo a implementação correspondente).
- **Arquivo de teste novo por RED:** cada etapa RED introduz exatamente UM novo arquivo de teste (`test/*.test.ts`) que falha estritamente no commit RED.
- **Proibição de alteração em testes anteriores:** nunca alterar, relaxar ou desabilitar testes criados em commits anteriores.
- **Helpers de teste sem asserções:** nenhum helper em `test/apoio/` pode conter chamadas a `expect(`. Todas as asserções pertencem aos arquivos de teste.
- **Testes não importam `srv/`:** a execução dos testes interage com a aplicação exclusivamente via chamadas OData HTTP (`cds.test().get(...)` ou `.post(...)`) ou consultas diretas à base de dados via helper `linhas(...)`.
- **Zero escrita no serviço analítico:** todas as requisições POST, PUT, PATCH e DELETE contra `AnaliticoService` são rejeitadas com HTTP 405.
- **Preservação de contratos existentes:** os serviços transacionais anteriores permanecem 100% inalterados.
- **Verificação obrigatória:** executar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## Itens N3 (aguardam aprovação no Gate 1)

- N3-1 (design): Criação do novo serviço `AnaliticoService` em `srv/analitico-service.cds` com processamento declarativo somente leitura via CDS Views sem persistência física duplicada (R1, R9).
- N3-2 (design): Novo papel corporativo `Leitor Analítico` (`LeitorAnalitico`) formalizado para consumo analítico por ferramentas de BI e SAC, emulado no `package.json` para testes (R10).
- N3-3 (design): Segregação LGPD no indicador operacional de pendências com `PendenciasPorResponsavel` restrito a Gestor e Administrador, e `PendenciasPorUnidadeArea` aberto a Leitores Analíticos sem matrículas (R11).
- N3-4 (design): Precedência de recusas e limitação estrita de paginação analítica com `$top` máximo de 1.000 registros para proteção da infraestrutura de nuvem (R9, R12).

---

## Etapas

### Etapa 1: Serviço analítico, papel Leitor Analítico, views operacionais e proteção LGPD
- **Critérios de aceite:** CA1, CA2, CA3, CA4, CA5, CA6, CA19, CA25, CA26, CA27, CA28, CA29, CA30.
- **Itens N3:** N3-1, N3-2, N3-3.
- **Descrição:**
  1. Configurar o perfil de desenvolvimento em `package.json` adicionando o usuário mockado `leitor-analitico` com o papel `LeitorAnalitico`.
  2. Implementar em `test/apoio/analitico.ts` os utilitários de consulta e a função `comoLeitorAnalitico`.
  3. Declarar o serviço `AnaliticoService` em `srv/analitico-service.cds` (`@path: '/api/analitico/v1'`) com `@requires: ['GestorTratativa', 'Administrador', 'LeitorAnalitico']`.
  4. Implementar em `srv/analitico/operacional.cds` as views operacionais, todas com chave primária não nula (`key`):
     - `TratativasAbertasView`: contagem de Tratativas em `Aberta` e `Em andamento` (`key 'TOTAL' as id`, `total`);
     - `TratativasVencidasView`: contagem de Tratativas ativas com prazo de conclusão vencido na data de corte UTC (com suporte a parâmetro explícito de data de corte e teste com `'2026-10-08'`, `key 'TOTAL' as id`, `total`);
     - `AcoesEmAndamentoView`: contagem de Ações em andamento pertencentes a Tratativas ativas (`key 'TOTAL' as id`, `total`);
     - `PendenciasPorResponsavelView`: contagem de Ações pertencentes a Tratativas ativas agrupadas por matrícula do responsável, autorizada para `GestorTratativa` e `Administrador` (`@restrict: [{ grant: '*', to: ['GestorTratativa', 'Administrador'] }]`), devolvendo HTTP 403 do runtime para usuários com perfil exclusivo de `LeitorAnalitico`;
     - `PendenciasPorUnidadeAreaView`: contagem de Ações de Tratativas ativas agrupadas por Unidade e Área (`key unidade`, `key area`, `total`), aberta a todos os leitores analíticos sem exibição de matrículas (LGPD);
     - `PendenciasPorUnidadeView`: contagem de Ações de Tratativas ativas agrupadas por Unidade da Tratativa (`key unidade`, `total`).
  5. Garantir a resolução do atraso perpétuo: Ações pertencentes a Tratativas `Cancelada` (e `Encerrada`) são desconsideradas de `TratativasVencidas` e contagens de pendência.
  6. Criar `srv/analitico-service.ts` com:
     - Rejeição de verbos de escrita (POST, PUT, PATCH, DELETE) com HTTP 405 Method Not Allowed;
     - Rejeição estática de papel pelo runtime CAP (HTTP 403 para não autorizados e `AplicativoOrigem`).
- **Arquivo de teste novo:** `test/analitico-operacional-lgpd.test.ts`.

---

### Etapa 2: Views de gestão, histórico unificado, reaberturas e tratamento de 'Sem Origem'
- **Critérios de aceite:** CA7, CA8, CA9, CA10, CA11, CA12, CA20, CA21, CA22.
- **Itens N3:** N3-1.
- **Descrição:**
  1. Implementar em `srv/analitico/gestao.cds` as views de gestão:
     - `TratativasPorOrigemView`: agrupamento por origem consolidando Tratativas avulsas ou nulas sob o rótulo oficial `'Sem Origem'`, com normalização de maiúsculas/minúsculas e espaços (trim);
     - `TratativasPorCriticidadeView`: agrupamento por nível de criticidade;
     - `RankingAreasView`: ordenação decrescente de áreas por volume de tratativas ativas, agrupando nulos sob `'Sem Área'`.
  2. Implementar as functions com filtros textuais de período:
     - `consultarCumprimentoDePrazo(periodoInicio : String, periodoFim : String)`: cálculo percentual de encerramentos no prazo, consumindo o último evento de encerramento em ocorrências reabertas e excluindo canceladas;
     - `consultarTempoMedioResolucao(periodoInicio : String, periodoFim : String)`: média de dias corridos entre criação e encerramento;
  3. Garantir que todas as comparações temporais e agrupamentos utilizem o fuso horário oficial UTC.
- **Arquivo de teste novo:** `test/analitico-gestao-metricas.test.ts`.

---

### Etapa 3: Views executivas, índice de resolução e evidências pendentes
- **Critérios de aceite:** CA13, CA14, CA15, CA16, CA17, CA18, CA34.
- **Itens N3:** N3-1.
- **Descrição:**
  1. Implementar em `srv/analitico/executivo.cds` as views executivas e totalizadores:
     - `VolumePorOrigemView`: contagem e percentual por origem consolidando nulos sob `'Sem Origem'`, calculando `percentual : Decimal(5,2)` sobre o volume total;
     - `PrincipaisDesviosView`: origens com maior quantidade de ocorrências ativas em atraso (`dataPrevistaConclusao < dataCorte`) em ordem decrescente;
     - `BacklogTotalView`: soma de Tratativas ativas e Ações ativas vinculadas acumuladas na plataforma (`key 'TOTAL' as id`, `total`);
     - `EvidenciasPendentesView`: contagem de ações ativas de tratativas ativas com evidência obrigatória e zero evidências ativas anexadas (`key 'TOTAL' as id`, `total`).
  2. Implementar as functions executivas:
     - `consultarTendenciaMensal(periodoInicio : String, periodoFim : String)`: série temporal mensal (`AAAA-MM`) de tratativas criadas e encerradas;
     - `consultarIndiceResolucao(periodoInicio : String, periodoFim : String)`: taxa percentual de vazão global `(encerradas / criadas) * 100`, com caso de teste explícito comprovando valores superiores a 100.00% em redução de passivo acumulado (ex.: 10 encerradas e 5 criadas → 200.00%).
  3. Garantir total neutralidade de modelagem analítica: nenhuma regra é restrita a Origem ou área de negócio (SESMT).
- **Arquivo de teste novo:** `test/analitico-executivo-evidencias.test.ts`.

---

### Etapa 4: Exposição OData v4, paginação analítica e precedência D10
- **Critérios de aceite:** CA23, CA24, CA31, CA32, CA32a, CA33.
- **Itens N3:** N3-4.
- **Descrição:**
  1. Conectar a exposição OData v4 padronizada com suporte a `$filter`, `$select`, `$orderby` e paginação externa com `$top` e `$skip` em entity sets analíticos.
  2. Implementar em `srv/analitico/filtros.ts` a validação de filtros e precedência D10:
     - Formato ISO 8601 em datas de filtro temporal e data de corte (rejeita com 400 `Data inválida.` e respectivo target);
     - Consistência de período temporal: se `periodoInicio > periodoFim`, recusa com 400 `Período inválido: a data inicial não pode ser posterior à data final.` (`target: periodoInicio`);
     - Limite de paginação analítica: se `$top > 1000` ou `< 1`, recusa com 400 `O campo Tamanho da página aceita de 1 a 1000.` (`target: $top`);
     - Filtros válidos que não localizam ocorrências retornam lista vazia `[]` ou totalizadores zerados com HTTP 200.
- **Arquivo de teste novo:** `test/analitico-odata-precedencia-d10.test.ts`.

---

## Critérios de pronto

1. Todos os 35 Critérios de Aceite (CA1 a CA34, incluindo CA32a) implementados e cobertos pelas 4 suítes de teste de integração.
2. Cada etapa possui seu par sequencial de commits `test(red):` e `feat(green):`, com exatamente um novo arquivo de teste por etapa RED.
3. Nenhum teste de commits anteriores quebrado, relaxado ou alterado.
4. Helpers de teste em `test/apoio/` livres de asserções (`expect(`).
5. Nenhum arquivo de teste importa código da camada `srv/`.
6. Preservação estrita dos contratos anteriores: `consultarTratativa` permanece com 12 chaves e serviços transacionais mantêm suas características intactas.
7. Zero persistência física duplicada de dados analíticos no banco de dados (`db/`).
8. Verificação limpa e completa de `sh agentic/mecanismos/scripts/verify.sh` reportando sucesso nos testes, lint, build e arquitetura.
