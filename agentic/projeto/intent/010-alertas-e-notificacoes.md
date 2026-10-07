# Intent: Alertas e notificações

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** draft
**Origem:** ideia

## Problema
Prazos vencem e evidências ficam pendentes sem que ninguém seja avisado, porque o acompanhamento depende de cobrança manual (fonte: humano:2026-10-07, proposta anexada, seção Regras de Negócio / Alertas).

## Resultado proposto
Regras de alerta executadas automaticamente pela aplicação, que notificam as pessoas envolvidas. Alertas citados pela proposta:

- Prazo próximo do vencimento
- Prazo vencido
- Ausência de atualização
- Evidência pendente

Canais de notificação:
- E-mail
- Microsoft Teams

A proposta previa regras de alerta próprias por Origem ("Cada origem poderá possuir regras próprias"). Em 2026-10-07 o humano decidiu que no MVP a Origem é só um campo texto, sem cadastro nem parametrização por Origem (intent 002); se as regras de alerta variam pela Origem fica em aberto (Questões abertas). Nada é fixo para o SESMT.

## Usuários e sistemas afetados
- Responsáveis, Participantes, gestores e SESMT — recebem.
- E-mail corporativo e Microsoft Teams — canais.
- Intents 004 (prazos e Evidência obrigatória), 005 (destinatários), 006, 007 e 008.

## Restrições e não-escopo
- Restrição: execução automática, sem acionamento manual.
- Restrição: os testes nunca dependem de e-mail ou Teams reais (`AGENTS.md`).
- Fora de escopo: outros canais (SMS, push); workflow de escalonamento (a proposta não prevê).

## Critérios de aceite de negócio
- Quando o prazo está próximo do vencimento, o responsável é notificado.
- Quando o prazo vence, o responsável (e, se previsto, gestor) é notificado.
- Quando uma Tratativa/Ação fica sem atualização pelo período definido, é gerado alerta.
- Quando há Evidência obrigatória pendente, é gerado alerta.
- A notificação chega por e-mail e Teams, conforme parametrização.

## Questões abertas
- Antecedência de "próximo do vencimento" (em dias corridos ou úteis)? Quantos avisos?
- Período de "ausência de atualização": o que conta como atualização (status, comentário, evidência)? Quantos dias?
- "Evidência pendente": alerta quando? (no prazo, após conclusão sem evidência?)
- As regras de alerta (antecedência, período sem atualização) são globais ou variam pela Origem (texto) ou Criticidade? Sem cadastro de Origens nem Tipo no MVP (intent 002). Prazos em dias corridos (confirmado). O alerta de prazo depende da hipótese do prazo (tabela global ou data informada) do intent 002.
- Quem recebe cada alerta (Responsável, Participantes, gestor, SESMT)? Há escalonamento ao gestor se vencer?
- A notificação é por e-mail, Teams ou ambos, ou por preferência do usuário? Teams por mensagem direta ou canal?
- Frequência e repetição (diária, uma vez), horário de envio, e janelas de silêncio?
- Os alertas aplicam-se à Tratativa, à Ação ou a ambas?
- Idioma, conteúdo e modelo das mensagens?
- Notificação também em eventos como atribuição de responsável ou comentário?
- Dados pessoais nas mensagens (LGPD)?
- Business Rules (item da seção Arquitetura BTP) seria usado para estas regras? A proposta lista mas não explica o uso; confirmar se há essa expectativa de negócio (parametrização por área administrada pelo usuário de negócio).
