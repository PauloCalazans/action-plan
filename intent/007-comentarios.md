# Intent: Comentários

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** draft
**Origem:** ideia

## Problema
A comunicação sobre uma ocorrência e suas ações se dá fora da ferramenta (e-mail, mensagens), e o raciocínio e as decisões se perdem (fonte: humano:2026-10-07, proposta anexada, seção Componentes da Solução, item 5 Comentários).

## Resultado proposto
Registro colaborativo de **Comentários** entre:

- SESMT
- Gestores
- Responsáveis
- Aprovadores

"Com histórico permanente" (mesma seção): comentários não são apagados nem alterados silenciosamente.

O Comentário integra o modelo conceitual da Tratativa (seção Modelo Conceitual). Genérico: serve a qualquer Origem; no MVP é usado pelos mesmos papéis nas Tratativas dos três apps de origem do MVP e nas avulsas (ver intent 002).

## Usuários e sistemas afetados
- SESMT, gestores, responsáveis por Ações, aprovadores.
- Intent 008 (Histórico) e intent 010 (alerta "Ausência de atualização" pode considerar comentários).

## Restrições e não-escopo
- Restrição: histórico permanente; nada se perde.
- Fora de escopo: chat em tempo real, videoconferência (não constam da proposta).

## Critérios de aceite de negócio
- Um usuário dos quatro papéis cita um comentário em uma Tratativa.
- Os comentários aparecem em ordem cronológica com autor e data/hora.
- Um comentário, uma vez registrado, permanece no histórico.

## Questões abertas
- Os Comentários ficam na Tratativa, na Ação ou em ambas?
- Pode-se editar ou apagar um comentário? "Histórico permanente" significa que nunca, ou que as versões ficam guardadas?
- Há menção a pessoas (@) com notificação (intent 010)?
- Comentários aceitam anexos? (Se sim, são Evidências?)
- Há comentários privados (visíveis só ao SESMT)?
- Quem pode comentar em Tratativa encerrada?
- Comentário conta como "atualização" para o alerta de "Ausência de atualização"?
- Dados pessoais: comentários podem conter dados pessoais; retenção e acesso (LGPD)?
