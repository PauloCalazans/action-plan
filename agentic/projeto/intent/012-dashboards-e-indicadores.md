# Intent: Dashboards, indicadores e consumo analítico

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** draft
**Origem:** ideia

## Problema
Operação, gestão e diretoria não têm uma visão consolidada das Tratativas, prazos e pendências (fonte: humano:2026-10-07, proposta anexada, seção Dashboards).

## Resultado proposto
Indicadores em três níveis, disponíveis para consumo analítico em Power BI / SAC (seção Arquitetura BTP). "Indicadores" também figura no modelo conceitual da Tratativa (seção Modelo Conceitual).

### Operacional
- Tratativas abertas
- Tratativas vencidas
- Ações em andamento
- Pendências por responsável
- Pendências por unidade

### Gestão
- Tratativas por origem
- Tratativas por criticidade
- Cumprimento de prazo
- Tempo médio de resolução
- Ranking de áreas

### Executivo
- Tendência mensal
- Volume por origem
- Principais desvios
- Backlog total
- Índice de resolução

Genérico: os indicadores valem para qualquer Origem e permitem corte por Origem; no MVP, cobrem as Tratativas dos três apps de origem (Registro de Acidente + FIA, Notificação de Risco de Acidente, Advertência) e as avulsas, sem origem (humano:2026-10-07, intent 002). Os tipos de ocorrência ficam nos apps e não há Tipo no MVP, então o corte analítico é pelo campo texto Origem (e por "sem origem").

## Usuários e sistemas afetados
- Operação/SESMT (nível operacional), gestores (gestão), diretoria (executivo).
- Power BI e SAC — consumidores dos dados.
- Intents 002, 003, 004, 008 e 011 fornecem os dados.

## Restrições e não-escopo
- Restrição: o consumo analítico não pode escrever na solução.
- Restrição: dados pessoais em indicadores agregados devem respeitar a LGPD.
- Fora de escopo: construção dos relatórios finais em cada ferramenta caso a decisão seja que a solução apenas disponibiliza os dados (ver Questões abertas).

## Critérios de aceite de negócio
- Cada um dos 15 indicadores listados pode ser obtido e consultado.
- Os indicadores podem ser filtrados por Origem, Criticidade, Unidade e Área.
- O Power BI / SAC consegue acessar os dados da solução sem cópia manual.

## Questões abertas
- Os indicadores precisam de dados que só o aplicativo de origem conhece (por exemplo, tipo de ocorrência, "principais desvios")? Se sim, a Tratativa recebe esses dados na abertura?
- Prazos são dias corridos (confirmado, humano 2026-10-07). Como Origem é texto livre, como evitar variações de grafia nos cortes por Origem (intent 002)? Como tratar Tratativas avulsas nos indicadores "por origem"?
- Definições exatas: "vencida", "cumprimento de prazo", "tempo médio de resolução" (da abertura ao encerramento?), "índice de resolução", "backlog total", "principais desvios" (por Origem? por causa? sem Tipo no MVP), "ranking de áreas" (critério).
- A solução entrega os dashboards prontos, ou apenas os dados para Power BI/SAC? Qual das duas ferramentas é a oficial (ambas?) e há também painéis dentro da solução?
- Quem acessa cada nível? Há restrição por Unidade/Área?
- Frequência de atualização dos dados (tempo real ou diária)?
- Histórico mensal: dados históricos anteriores à solução (do acompanhamento atual do SESMT) serão migrados?
- Metas e referências (por exemplo, meta de cumprimento de prazo)?
