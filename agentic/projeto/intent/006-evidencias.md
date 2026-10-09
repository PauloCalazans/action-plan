# Intent: Evidências

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** aprovado
**Origem:** ideia

## Problema
A comprovação de que uma ação foi feita (foto da correção, relatório, laudo) fica espalhada em e-mails e pastas, sem vínculo com a ação e com a ocorrência (fonte: humano:2026-10-07, proposta anexada, seção Componentes da Solução, item 4 Evidências).

## Resultado proposto
É possível anexar **Evidências** às Ações, e elas permanecem vinculadas à Ação e à Tratativa (mesma seção). Tipos de arquivo a anexar, conforme a proposta:

- Fotos
- PDFs
- Relatórios
- Planilhas
- Arquivos diversos

Regras vindas da proposta:
- Ação com "Evidência obrigatória" (campo da Ação, seção Componentes da Solução, item 3) exige Evidência.
- A inclusão de Evidências é um evento auditável (seção Histórico e Auditoria).
- "Evidência pendente" é uma das regras de alerta (seção Regras de Negócio / Alertas).
- Genérico: serve a qualquer Origem; no MVP valem para Tratativas dos três apps de origem (Registro de Acidente + FIA, Notificação de Risco de Acidente, Advertência) e para as avulsas.

## Usuários e sistemas afetados
- Responsáveis por Ações — anexam.
- SESMT, gestores e aprovadores — consultam e conferem.
- Intents 004 (Ação), 008 (Histórico), 010 (Alertas).

## Restrições e não-escopo
- Restrição: Evidências podem conter imagens de pessoas ou dados de saúde/acidente; tratar como dado pessoal/sensível (`AGENTS.md`, gatilhos N3 de LGPD).
- Fora de escopo: edição do conteúdo dos arquivos, assinatura digital, integração com sistemas de documentos externos (não constam da proposta).

## Critérios de aceite de negócio
- O responsável anexa Fotos, PDFs, Relatórios, Planilhas e outros arquivos a uma Ação.
- Cada Evidência aparece na Ação e na Tratativa correspondentes.
- A inclusão fica registrada no Histórico, com quem anexou e quando.
- Uma Ação com Evidência obrigatória e sem Evidência é sinalizada como pendente.

## Questões abertas
- Limites de tamanho, quantidade e formatos permitidos de arquivo?
- Pode-se anexar Evidência diretamente à Tratativa (sem Ação) ou apenas à Ação?
- Evidências podem ser removidas ou substituídas? Por quem? Isso deve ficar no Histórico?
- Evidência exige validação por alguém (Aval Técnico)? A proposta não diz.
- Período de retenção e regras de acesso (LGPD, imagens de pessoas, acidentes)?
- Evidência obrigatória é uma por Ação ou uma quantidade/tipo mínimo?
- Onde o arquivo fica guardado (a decisão técnica cabe ao arquiteto, mas há requisito corporativo de armazenamento)?
