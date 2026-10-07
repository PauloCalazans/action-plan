# Intent: Tratativa

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** draft
**Origem:** ideia

## Problema
Não existe um registro único e padronizado da ocorrência que gera a necessidade de ação. Cada área registra à sua maneira, o que impede acompanhar prazos, criticidade e situação de forma comparável (fonte: humano:2026-10-07, proposta anexada, seção Visão Geral e seção Componentes da Solução, item 2 Tratativa).

## Resultado proposto
Existe a **Tratativa**: o registro principal da solução, que pode nascer de um registro de um aplicativo de Origem (abertura por API, intent 002) ou ser criada avulsa, sem origem (humano:2026-10-07), e que concentra a ocorrência e é o ponto ao qual se ligam Ações, Evidências, Comentários, Histórico, Indicadores e Responsáveis (fonte: humano:2026-10-07, proposta anexada, seção Modelo Conceitual).

```text
Origem
    │
    ▼
Tratativa
    ├── Plano de Ação
    ├── Evidências
    ├── Comentários
    ├── Histórico
    ├── Indicadores
    └── Responsáveis
```

### Campos sugeridos (humano:2026-10-07, proposta anexada, seção Componentes da Solução, item 2)
- Código
- Título
- Descrição
- Origem (campo texto, opcional; humano:2026-10-07, ver intent 002)
- ID do registro de origem (ID_Origem, opcional; ver intent 002)
- Unidade
- Área
- Criticidade
- Data de criação
- Data prevista de conclusão
- Status
- Responsável
- Solicitante

### Regras relacionadas vindas da proposta
- Criticidade, Origem, ID_Origem, abertura por API (idempotente, 1 para 1), consulta de status pela API, Tratativa avulsa e prazo estão no intent 002. Resumo: a Criticidade (`Baixa`, `Média`, `Alta`, `Crítica`) é informada na abertura; o prazo é em dias corridos desde a criação, e a Data prevista de conclusão é derivada da Criticidade por tabela global parametrizável (3/7/15/30; decidido, spec do 002). Não há parametrização de prazo por Origem. A Criticidade pode ser alterada depois (o 002 define a regra: recálculo desde a criação original e histórico; a operação exposta a usuários e quem a usa são do 003).
- MVP: as Tratativas virão dos três aplicativos "Registro de Acidente + FIA", "Notificação de Risco de Acidente" e "Advertência", mais as avulsas. Tipos de ocorrência ficam nesses aplicativos e fora do escopo; não há Tipo.
- Genérico: os campos acima valem para qualquer Origem; nenhum campo é exclusivo do SESMT (seções MVP SESMT e Diferencial Estratégico).
- Encerramento e reabertura da Tratativa são eventos auditáveis (seção Histórico e Auditoria; detalhado no intent 008).

## Usuários e sistemas afetados
- SESMT, gestores, responsáveis por Ações e aprovadores (os usuários citados na seção Comentários) — abrem, acompanham e encerram Tratativas conforme papéis a definir.
- Solicitante e Responsável — papéis da Tratativa.
- SAP SuccessFactors — possível fonte de Unidade, Área, Solicitante e Responsável (intent 011).

## Restrições e não-escopo
- Restrição: modelo genérico; só vale o que for comum a todas as Origens. Não há cadastro de Origens nem Tipo no MVP (intent 002).
- Fora de escopo: Ações (004), Responsáveis e Participantes (005), Evidências (006), Comentários (007), Histórico (008), alertas (010), indicadores/dashboards (012).
- Fora de escopo: workflow de aprovação (a proposta diz "Sem necessidade de workflow", seção Responsabilidade).

## Critérios de aceite de negócio
- Uma Tratativa pode ser aberta pelo aplicativo de origem (intent 002) ou criada avulsa; traz Título, Descrição, Unidade, Área, Criticidade e Solicitante (quem preenche cada campo está em aberto).
- A Tratativa recebe um Código e uma Data de criação, e uma Data prevista de conclusão em dias corridos desde a criação, calculada pela Criticidade (decidido na spec do 002).
- É possível consultar e filtrar Tratativas por Origem (texto), ID_Origem, Criticidade, Status, Unidade e Área.
- Mudança de Status, Responsável e prazo, encerramento e reabertura ficam registrados (intent 008).

## Questões abertas
- (Bloqueante para 003) Quais são os Status possíveis da Tratativa e as transições permitidas (por exemplo, aberta, em andamento, encerrada, reaberta)? A proposta só cita Status, "Encerramento" e "Reabertura".
- O que é "Unidade" (planta, filial, empresa, centro de custo?) e o que é "Área" (departamento, setor?)? São a estrutura organizacional do SuccessFactors? Há hierarquia entre elas?
- (Resolvido, humano:2026-10-07, spec do 002) O Código é um UUID opaco gerado pela plataforma; não é sequencial nem tem prefixo de Origem. Falta apenas, se desejado, um identificador legível para o usuário, a decidir aqui.
- A Data prevista de conclusão é calculada (decidido no 002: data de criação + prazo da Criticidade, o app não a informa). Pode ser ajustada diretamente, fora da Criticidade? Quem altera e com que justificativa?
- Quais campos o usuário completa na plataforma depois da abertura (Unidade, Área, Responsável, Descrição)? O 002 decidiu que na abertura só Título e Criticidade são obrigatórios (mais Origem e ID_Origem para apps).
- Os usuários editam a Tratativa na plataforma, ou só completam o que o aplicativo enviou? (Quem cria a avulsa está decidido no 002: qualquer usuário autenticado; a restrição por papel fica aqui.)
- Solicitante é o autor do registro no aplicativo de origem, ou outra pessoa? (Na abertura ele é identificado só pela matrícula/ID, sem nome nem e-mail, decidido no 002; o nome virá do SuccessFactors no 011.)
- Quem pode alterar a Criticidade e como a operação é exposta ao usuário? (o 002 decidiu que ela pode ser alterada, com recálculo do prazo e histórico)
- Um Responsável da Tratativa é o mesmo que "Responsável Principal" do intent 005?
- Campos obrigatórios na abertura estão decididos no 002 (Título e Criticidade; Origem e ID_Origem para apps) e o contrato aceita só esses campos. Falta decidir se algum campo adicional será obrigatório depois da abertura.
- Condições para encerrar a Tratativa (todas as Ações concluídas? evidências obrigatórias? algum aval?). A proposta cita "Aprovadores" mas não define aprovação.
- Metodologia de análise de causa (3W, 5 Porquês, 5W2H, PDCA) e Aval Técnico fazem parte do escopo? A proposta não os menciona.
- Dados pessoais (vítima de acidente, colaboradores): a Descrição pode conter dados sensíveis (LGPD). Há política de retenção e acesso restrito?
- Uma Tratativa pode ser cancelada ou excluída?
- Uma Tratativa pode agrupar vários registros de origem? (hoje 1 para 1 por registro: um registro gera no máximo uma Tratativa; a recíproca não foi dita.)
