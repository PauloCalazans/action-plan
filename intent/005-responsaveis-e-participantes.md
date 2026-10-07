# Intent: Responsáveis e participantes

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** draft
**Origem:** ideia

## Problema
É preciso saber quem responde por cada Tratativa e Ação e quem mais participa, sem depender de um fluxo de aprovação burocrático (fonte: humano:2026-10-07, proposta anexada, seção Regras de Negócio / Responsabilidade, e seção Modelo Conceitual, que lista Responsáveis como parte da Tratativa).

## Resultado proposto
A solução define responsáveis **diretamente**, sem workflow, no formato da proposta:

```text
Responsável Principal
+
Participantes
```

(humano:2026-10-07, proposta anexada, seção Regras de Negócio / Responsabilidade.) Responsável aparece como campo da Tratativa (junto de Solicitante) e como campo da Ação (seções Componentes da Solução, itens 2 e 3).

Os papéis de usuário citados pela proposta são: SESMT, Gestores, Responsáveis, Aprovadores (seção Comentários, item 5).

Genérico: o modelo de responsabilidade é o mesmo para qualquer Origem; o SESMT (dono dos três apps de origem do MVP, ver intent 002) é apenas a primeira área.

## Usuários e sistemas afetados
- SESMT, gestores, responsáveis por Ações, aprovadores.
- SAP SuccessFactors — origem provável dos colaboradores e gestores (intent 011); somente leitura.
- Alertas e notificações (intent 010) usam responsáveis e participantes como destinatários.

## Restrições e não-escopo
- Restrição: não há workflow de atribuição ou aprovação (proposta, seção Responsabilidade).
- Restrição: pessoas vêm da integração com SuccessFactors, que é somente leitura (proposta, seção Arquitetura BTP; `AGENTS.md`).
- Fora de escopo: a integração em si (011) e o envio de notificações (010).

## Critérios de aceite de negócio
- Toda Tratativa tem um Solicitante e um Responsável; toda Ação tem um Responsável.
- Uma Tratativa/Ação tem um Responsável Principal e zero ou mais Participantes.
- A mudança de Responsável fica registrada no Histórico (intent 008).
- É possível listar o que está sob responsabilidade de uma pessoa (apoia "Pendências por responsável", intent 012).

## Questões abertas
- Os Participantes existem na Tratativa, na Ação ou em ambas? O que um Participante pode fazer (só ler/comentar, ou também executar)?
- O Responsável Principal da Tratativa é o mesmo da proposta de "Responsável" da Tratativa? Pode haver mais de um?
- Quem pode trocar o Responsável (SESMT, gestor, o próprio responsável)? É exigida justificativa (delegação)?
- Quem é "Aprovador" e onde ele atua se não há workflow? Há aprovação de encerramento (Aval Técnico) ou o papel apenas comenta?
- Perfis e permissões de acesso (quem vê o quê) não constam; precisam ser definidos, em especial por Unidade/Área e por Origem.
- Responsáveis precisam ser colaboradores ativos do SuccessFactors? E se a pessoa se desligar ou mudar de gestor, o que acontece com suas pendências?
- Pode haver Responsável externo (sem cadastro no SuccessFactors, como terceiros e fornecedores)?
- Dados pessoais (LGPD): o tratamento de dados de colaboradores exige regras de acesso, retenção e finalidade.
