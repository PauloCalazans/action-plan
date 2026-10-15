# Intent: Ver o anexo da Evidência na tela de Tratativas

**Autor:** Paulo Calazans
**Sponsor:** Paulo Calazans
**Data:** 2026-10-14
**Status:** aprovado
**Origem:** ideia (feedback de uso do humano na tela de Tratativas)

## Problema
Na seção Evidências da tela de Tratativas, o usuário vê apenas os dados descritivos de cada Evidência (nome do arquivo, tipo, tamanho, descrição etc.) e não consegue abrir nem baixar o arquivo anexado. O download já existe como operação de negócio do serviço da Tratativa (intent 006), mas nenhum caminho da interface o aciona. Na prática o anexo é gravado e não pode ser conferido pela tela, o que esvazia o propósito da Evidência como comprovação (Gestor, Responsável da Ação e Validador Técnico precisam ver o documento ou a foto).

Fonte: humano, 2026-10-14 ("aparentemente não há como ver um anexo nas evidências?"), confirmado por conferência da tela e do serviço.

## Resultado proposto
1. Na tabela de Evidências da Tratativa, o nome do arquivo de cada Evidência listada é um link. Ao acioná-lo, o arquivo abre no navegador quando o tipo é exibível (imagem, PDF, texto) e, nos demais tipos, é baixado com o nome original. O tipo e o nome entregues são os gravados na Evidência.
2. Valem exatamente as regras do download já existente: somente Evidência ativa; somente quem já pode baixar (Gestor de Tratativa, Responsável da Ação ou Validador Técnico habilitado); quem não pode é recusado (acesso direto fora do vínculo, com a mensagem `Acesso negado.`). Na tabela, quem vê a linha já pode abrir o arquivo (a visibilidade das linhas já segue o vínculo), então o link aparece em toda linha visível. Abrir é permitido em qualquer status da Tratativa e da Ação, e a segregação entre Ação mãe e Subação se mantém.
3. Todo acesso ao arquivo grava antes o registro de auditoria `DownloadEvidencia`, como no download existente; se a auditoria falhar, o arquivo não é entregue.
4. Nada mais muda: anexar, remover, a lista (continua só com Evidências ativas) e o download existente ficam iguais.

Fonte das decisões: humano, 2026-10-14 (pedido e trilha padrão); orquestrador, Gate 1 delegado (detalhes acima).

## Usuários e sistemas afetados
- **Gestor de Tratativa:** passa a abrir os anexos das Evidências pela tela.
- **Responsável da Ação (Executor):** abre os anexos das Evidências da própria Ação.
- **Validador Técnico habilitado:** abre os anexos para emitir o Aval Técnico, como já lhe é permitido.
- **Demais usuários (Responsável de outra Ação, Responsável Principal, Participante, usuário comum):** continuam sem acesso ao arquivo.
- **Aplicativo de origem:** sem alteração.
- **Tela de Tratativas e serviço do aplicativo:** afetados. O serviço de regras de negócio da Tratativa e sua operação de download não são alterados.
- **Intents relacionados:** 006 (Evidências), 013 (Interface e acesso corporativo), 016 (Aval Técnico), 017 (Ações nas entidades, que deixou o download fora do escopo).

## Restrições e não-escopo
- Restrição: LGPD. Anexos são dados sensíveis (saúde, imagens de colaboradores). Nenhuma exposição nova além do que o download existente já permite; o conteúdo do arquivo não aparece em listagens nem em consultas expandidas; todo acesso é auditado antes da entrega (orquestrador, Gate 1 delegado).
- Restrição: autorização preservada integralmente; quem não baixava continua sem baixar (orquestrador, Gate 1 delegado).
- Restrição: a entrega segue a trilha padrão do processo, por envolver autorização, dados pessoais de anexos e contrato de serviço (humano, 2026-10-14).
- Fora de escopo: mudança em Anexar ou Remover Evidência; mudança na lista de Evidências (continua só ativas); mudança no download existente do serviço da Tratativa; Minhas Pendências e Administração (não listam Evidências); visualização embutida em tela própria (pré-visualização dentro da página); download em lote; novos papéis, novas permissões, novos formatos ou limites; deploy real.

## Critérios de aceite de negócio
- O Gestor, na tabela de Evidências, abre uma imagem (PNG), um PDF e um texto (TXT) do dado de demonstração (`test/demo/arquivos`) pela tela, e o conteúdo exibido é o gravado.
- Um tipo não exibível (por exemplo CSV) é baixado com o nome original.
- Usuário sem vínculo com a Ação (por exemplo `usuario` numa Ação da Tratativa M1001) é recusado com 403 e não recebe o arquivo.
- Evidência removida (inativa) não é entregue: resposta 404.
- Após abrir um anexo, o histórico da Ação passa a ter um evento `DownloadEvidencia`.
- Se a gravação da auditoria falhar, o arquivo não é entregue.
- A suíte de testes existente da spec 006 continua passando sem alteração.

## Questões abertas
- Nenhuma. As decisões foram tomadas pelo humano e pelo orquestrador (Gate 1 delegado), em 2026-10-14.
