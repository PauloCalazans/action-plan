# Intent: Plano de Ação com ações hierárquicas

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** aprovado
**Origem:** ideia

## Problema
Uma ocorrência normalmente exige várias providências, às vezes decompostas em passos menores, e hoje não há forma padronizada de planejá-las, acompanhar prazos e prioridades e saber o que está concluído (fonte: humano:2026-10-07, proposta anexada, seção Componentes da Solução, item 3 Plano de Ação, e seção Estrutura Analítica).

## Resultado proposto
Cada Tratativa (intent 003) pode ter uma ou várias **Ações**, e cada Ação pode ser decomposta em **Subações**, formando uma estrutura analítica. O Plano de Ação é apenas o mecanismo de execução vinculado a uma Origem; não é a entidade central (seção Visão Geral).

### Campos da Ação (humano:2026-10-07, proposta anexada, seção Componentes da Solução, item 3)
- Descrição da ação
- Responsável
- Prazo
- Prioridade
- Status
- Evidência obrigatória
- Data conclusão

### Regra de multiplicidade
"Uma tratativa poderá possuir uma ou várias ações" (mesma seção).

### Estrutura Analítica (humano:2026-10-07, proposta anexada, seção Estrutura Analítica)
As ações poderão ser organizadas hierarquicamente:

```text
Tratativa
    ├── Ação 1
    │     ├── Subação 1.1
    │     └── Subação 1.2
    │
    └── Ação 2
```

### Relação com outros intents
- Evidência obrigatória conecta com o intent 006 (Evidências) e com o alerta "Evidência pendente" (intent 010).
- Responsável da Ação conecta com o intent 005.
- Ações podem nascer de um Template (intent 009).
- Mudança de Status, Responsável, prazo e inclusão de evidência são auditados (intent 008).
- Genérico: nada específico do SESMT; as Ações das Tratativas dos três apps de origem do MVP e das avulsas (ver intent 002) usam o mesmo modelo.

## Usuários e sistemas afetados
- Responsáveis por Ações — executam, atualizam Status e anexam Evidências.
- SESMT e gestores — planejam e acompanham.
- Aprovadores — papel citado na proposta, sem atribuição definida.

## Restrições e não-escopo
- Restrição: hierarquia de Ações é parte do modelo desde o início (a proposta usa "poderão ser organizadas hierarquicamente").
- Fora de escopo: Responsáveis e Participantes em detalhe (005), Evidências (006), Comentários (007), Histórico (008), Templates (009), alertas (010).
- Fora de escopo: workflow de aprovação (seção Responsabilidade: "Sem necessidade de workflow").

## Critérios de aceite de negócio
- Uma Tratativa pode ter uma ou várias Ações, cada uma com Descrição, Responsável, Prazo, Prioridade, Status, indicação de Evidência obrigatória e Data de conclusão.
- Uma Ação pode ter Subações, representadas como no exemplo da proposta (Ação 1 com Subação 1.1 e 1.2; Ação 2 sem filhas).
- É possível ver a estrutura completa de uma Tratativa (Ações e Subações).
- Uma Ação marcada com Evidência obrigatória não pode ser dada como concluída sem a Evidência (a confirmar nas Questões abertas).

## Questões abertas
- Quais são os Status possíveis da Ação e as transições permitidas? Não constam na proposta.
- Quais são os valores de Prioridade? Qual a diferença entre Prioridade (da Ação) e Criticidade (da Tratativa)?
- O Prazo da Ação é livre ou limitado pela Data prevista de conclusão da Tratativa? E o da Subação em relação ao da Ação mãe?
- Quantos níveis de Subação são permitidos (apenas dois, como no exemplo, ou ilimitado)?
- A Ação mãe é concluída automaticamente quando as Subações estão concluídas, ou manualmente? O Status da Tratativa depende das Ações?
- Cada Subação tem os mesmos campos da Ação (Responsável, Prazo, Evidência obrigatória)?
- "Evidência obrigatória" é um indicador sim/não por Ação? O bloqueio ao concluir é regra? Pode ser definida por Origem/Template?
- A Data conclusão é informada pelo usuário ou registrada automaticamente?
- Uma Ação pode ser reaberta? Pode ser cancelada ou excluída? Pode ser movida entre Tratativas?
- Ação em Tratativas encerradas: pode ser alterada?
- A delegação (reatribuir a responsabilidade com justificativa, termo do vocabulário do domínio) é desejada? A proposta não a menciona.
