# Intent: Templates de ações

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** aprovado
**Origem:** ideia

## Problema
Para ocorrências recorrentes (por exemplo, uma Condição Insegura), as mesmas Ações precisam ser recriadas manualmente a cada vez, com risco de esquecer etapas (fonte: humano:2026-10-07, proposta anexada, seção Templates).

## Resultado proposto
É possível criar **Templates**, modelos reutilizáveis de Ações, e aplicá-los a uma Tratativa para gerar as Ações de uma vez. Exemplo da proposta:

```text
Template:
Condição Insegura

Ações geradas:
1. Avaliar local
2. Definir correção
3. Executar correção
4. Validar correção
```

Relacionamento com a parametrização: na proposta, Templates eram regras próprias de cada Origem (seção Cadastro de Origens). Em 2026-10-07 o humano decidiu que no MVP a Origem é um campo texto, sem cadastro nem parametrização por Origem, e que não há Tipo (intent 002). Se e como o Template varia com a Origem está em aberto. Os apps do MVP são "Registro de Acidente + FIA", "Notificação de Risco de Acidente" e "Advertência". "Condição Insegura" é o único exemplo de Template na proposta; ela era um tipo de ocorrência, hoje dentro de um aplicativo de origem, e a relação com as três Origens está em aberto.

Os Templates podem se beneficiar da estrutura hierárquica (Ação e Subações, intent 004), a confirmar.

## Usuários e sistemas afetados
- Administrador/SESMT — cria e mantém Templates.
- Responsáveis por Ações — recebem as Ações geradas.
- Intents 002 (Origem e abertura por apps externos), 004 (Ação).

## Restrições e não-escopo
- Restrição: genérico; Template pertence à parametrização, não ao núcleo.
- Fora de escopo: Templates para apps de origem além dos três do MVP.

## Critérios de aceite de negócio
- Um usuário autorizado cria um Template com uma lista ordenada de Ações.
- O Template do exemplo da proposta ("Condição Insegura", 4 Ações) pode ser criado e aplicado a uma Tratativa, gerando as 4 Ações.
- O Template pode ser aplicado a uma Tratativa (a forma de seleção, por Origem ou manual, está em aberto).
- Alterar um Template não altera Ações já geradas.

## Questões abertas
- Sem cadastro de Origens nem Tipo, como um Template é escolhido: manualmente pelo usuário após a abertura, automaticamente pelo texto da Origem, ou por dado enviado pelo app? Há Tratativas avulsas (sem Origem) que usam Template?
- Como distinguir Templates dentro de um mesmo app (por exemplo, "Condição Insegura" versus outras ocorrências do mesmo app), já que a classificação fica no app?
- Quais atributos o Template define para cada Ação (Responsável padrão, prazo relativo à Criticidade, Prioridade, Evidência obrigatória)?
- O Template pode conter Subações?
- Há Templates previstos para os três apps do MVP (Registro de Acidente + FIA, Notificação de Risco de Acidente, Advertência)? Quais Ações?
- Quem pode criar, editar e desativar Templates? Há versionamento?
- As Ações geradas podem ser editadas ou removidas depois?
