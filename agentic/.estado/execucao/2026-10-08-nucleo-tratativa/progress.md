# Progress: núcleo de tratativa (intents 003, 004, 005)

Instrução do humano (2026-10-08): seguir as intents em sequência, tasks mais robustas (poucos PRs, passos pequenos em commits), tomar as decisões, sem pausas; modo automático ligado.

## Plano
- Fase 1+2 para 003 → 004 → 005 (spec, design, revisor), com decisões do questionário tomadas pelo orquestrador e registradas aqui.
- Uma task por intent (vários pares RED/GREEN na mesma branch) → um PR por intent.
- Gate 1 único para os três (aprovação humana explícita dos N3 é obrigatória; não delegável).

## Rulings
- R-01 003 Q14: Descrição e Solicitante só para o Gestor (LGPD, Advertência traz dado de RH); demais veem como null. Alternativa descartada: todos veem tudo.
- R-02 003 Menores do revisor: operação identificada pelo Status de destino; precedência autenticação > papel > existência > estado > campos; R14 vale para a regra interna; atomicidade em transição/edição/Criticidade; Título visível a todos (nota para o Gate 1); enum de Status ampliado é aditivo na /v1 (D6).
- Spec 003: revisor APROVADO (14 Menores, aplicados). Spec 004: escrita, em revisão. Spec 005: em escrita.
- R-03 004: precedência igual ao 003 com estados em cascata (Tratativa > Ação > mãe/filhas > campos); consulta de Ação exige a Tratativa e traz Subações e referência à mãe; Ações geradas pelo 009 seguem o 004 salvo decisão do 009. Revisor da spec 004: DEVOLVIDO (I1-I3) → em correção.
- R-04 005 altera 003/004 (Responsável da Ação inicia/conclui a própria; troca de Responsável só por Delegação; consulta do Gestor traz responsáveis): registrado como 'alterações de comportamento entregues por este intent' na spec 005, sem editar 003/004 (design do 003 em andamento). Spec 005: 24 regras, 86 CAs.
- Spec 004: revisor APROVADO (2ª rodada), Menores aplicados. Spec 005: revisor DEVOLVIDO (I1 comparação de matrículas; I2 CA59 do 004). R-05: matrículas comparadas sem caixa/espaços, grafia da 1ª gravação; Responsável com Tratativa errada → não encontrada; listagem sem responsáveis; Tratativa usa 'Reatribuição', Ação usa 'Delegação'; Responsável Original = primeiro, no histórico.
- Spec 005: revisor APROVADO (3ª rodada). R-06: Responsável Original pela opção (b), sem alterar o histórico do 004. Specs 003, 004 e 005 fechadas; aguardando design 003.
- R-07 Design 003: A) R31 ganha a etapa 'forma do pedido' (400 do runtime) entre papel e existência; B) recusas de estado = 409, D9 (serialização por agregado) e D10 (contrato de recusas); C) Status ausente = 400 de campo; na edição ausente não muda e null/espaços apaga; Código mal formado 404 nas actions e 400 em consultarTratativa; filtro vazio não filtra; paginação a partir de 1; action pública 'mudarCriticidade'. D) retenção/LGPD fica para o humano antes de produção.
- 2026-10-08: limite de sessão da API interrompeu a revisão do design 003 e o design 004 (sem resultado). Specs 003/004/005 e design 003 commitados na branch local agentic/projeto/specs-nucleo-tratativa (6ddf44c, 80e6f06, 114938e), sem push. Aguardando instruções do humano.
