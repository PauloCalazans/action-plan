# Intent: Histórico e auditoria

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** draft
**Origem:** ideia

## Problema
Sem registro confiável das mudanças, não é possível saber quem alterou prazo, responsável ou status, nem comprovar o tratamento dado a uma ocorrência em uma auditoria (fonte: humano:2026-10-07, proposta anexada, seção Componentes da Solução, item 6 Histórico e Auditoria).

## Resultado proposto
Toda ocorrência relevante na vida de uma Tratativa e de suas Ações gera um registro de **Histórico**, nunca uma alteração silenciosa. A proposta exige registrar:

- Alteração de status
- Mudança de responsável
- Alteração de prazo
- Inclusão de evidências
- Encerramento
- Reabertura

O Histórico integra o modelo conceitual da Tratativa (seção Modelo Conceitual). Genérico: vale para qualquer Origem. Intents que geram eventos: 003, 004, 005, 006 (e 007, a confirmar).

## Usuários e sistemas afetados
- SESMT, gestores e auditores internos — consultam.
- Todos os usuários que alteram dados — têm suas ações registradas.

## Restrições e não-escopo
- Restrição: o registro cobre ao menos os seis eventos da lista.
- Restrição: o Histórico registra dados pessoais (quem fez); tratar conforme LGPD.
- Fora de escopo: auditoria técnica de acesso ao sistema e logs de infraestrutura.

## Critérios de aceite de negócio
- Cada um dos seis eventos gera um registro com quem, quando, o que mudou (valor anterior e novo) e, quando houver, a justificativa.
- O Histórico de uma Tratativa pode ser consultado em ordem cronológica e não pode ser alterado por usuários.
- Não é possível alterar status, responsável ou prazo sem que o registro seja gerado.

## Questões abertas
- Quais outros eventos devem ser registrados (criação, mudança de Criticidade, Participantes, comentários, exclusões)?
- A mudança de responsável ou prazo exige justificativa obrigatória?
- Por quanto tempo o Histórico é mantido? Quem pode consultá-lo?
- O Histórico serve também aos indicadores (por exemplo, tempo médio de resolução)? (intent 012)
- Reabertura: quem pode reabrir e em que condições? O que acontece com as Ações já concluídas?
- Há exigência normativa específica (por exemplo, auditorias de segurança) para formato ou retenção do registro?
