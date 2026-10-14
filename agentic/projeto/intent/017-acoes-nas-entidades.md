# Intent: Ações nas entidades relacionadas e anexo por seleção de arquivo

**Autor:** Paulo Calazans
**Sponsor:** Paulo Calazans
**Data:** 2026-10-14
**Status:** aprovado
**Origem:** ideia (feedback de usabilidade do humano após uso da tela de Tratativas)

## Problema
Na tela de Tratativas, todas as ações operacionais estão concentradas no cabeçalho da Tratativa, embora a maioria delas atue sobre uma entidade relacionada (uma Ação do Plano de Ação ou uma Evidência). Consequências para o usuário:
1. Para Criar Subação, Delegar Ação, Anexar Evidência, Remover Evidência e Comentar Ação, o diálogo pede o código (identificador) da Ação ou da Evidência, que o usuário precisa descobrir, copiar e digitar. Isso é lento, sujeito a erro e incompatível com um uso corporativo corrente.
2. O diálogo de Anexar Evidência não aceita arquivo: pede o conteúdo como texto digitado, junto com nome e tipo do arquivo. Na prática não é possível anexar um arquivo real (foto, PDF, planilha), o que esvazia a Evidência prevista no intent 006.

Fonte: humano, 2026-10-14 ("as ações ficaram todas concentradas no nível da tratativa sendo que a maioria delas envolve uma entidade relacionada" e "não aceita arquivos, não existe fileupload no diálogo").

## Resultado proposto
1. **Ações junto da entidade a que se referem.** O usuário seleciona o registro e aciona a operação sobre ele; o sistema atribui o código do registro selecionado, e o usuário nunca digita identificador. Mapeamento confirmado pelo humano em 2026-10-14:
   - Sobre a **Ação** selecionada no Plano de Ação: Criar Subação, Delegar Ação, Anexar Evidência e Comentar Ação.
   - Sobre a **Evidência** selecionada na seção Evidências: Remover Evidência.
   - Continuam no nível da **Tratativa**: Criar Ação (botão na barra da tabela do Plano de Ação) e Comentar Tratativa (botão na seção Comentários).
   - O cabeçalho da Tratativa passa a conter somente o que é da Tratativa (mudanças de status, criticidade, Metodologia, Aval Técnico, aplicação de template etc.).
2. **Anexar Evidência com escolha de arquivo.** O diálogo permite ao usuário escolher o arquivo no seu equipamento; nome, tipo e conteúdo vêm do arquivo escolhido, sem digitação. A Descrição continua opcional.
3. **Contrato do serviço do aplicativo enxuto.** As versões dessas operações ligadas à Tratativa e que exigem o código como parâmetro deixam de existir no serviço que atende a interface do aplicativo, porque esse serviço atende somente a interface.
4. **Nada muda nas regras de negócio nem nas permissões.** As regras de Ação, Subação, Delegação, Evidência e Comentário (specs de plano de ação, responsáveis e participantes, evidências e comentários) seguem iguais. Cada usuário pode exatamente o que podia antes, nem mais nem menos.

### Decisões confirmadas do humano (2026-10-14)
1. Os limites da spec de evidências continuam valendo com o arquivo escolhido no diálogo: formatos aceitos, 10 MB por arquivo e 10 Evidências ativas por Ação.
2. Sem linha selecionada, as operações de linha ficam indisponíveis (desabilitadas).
3. Os botões de linha seguem o padrão do aplicativo: ficam ocultos para quem não tem o papel e desabilitados quando o status da linha não permite a operação. O servidor continua recusando de qualquer forma.
4. Criar Subação sobre uma Subação continua recusada pela regra atual do plano de ação.
5. Comentar Ação grava o comentário na Ação selecionada e segue a spec de comentários.

## Usuários e sistemas afetados
- **Gestor de Tratativa:** cria Ações, Subações, delega, comenta, anexa e remove Evidências diretamente na linha correspondente.
- **Responsável da Ação (Executor):** anexa e remove Evidência da própria Ação e comenta, a partir da linha da sua Ação, sem precisar informar código.
- **Usuário da plataforma (qualquer autenticado):** comenta a Tratativa e as Ações, conforme as regras já vigentes.
- **Aplicativo de origem:** sem alteração (continua sem acesso a estas operações).
- **Interface da tela de Tratativas e serviço do aplicativo:** afetados. O serviço de regras de negócio da Tratativa (usado por outros consumidores) não é alterado.
- **Intents relacionados:** 004 (Plano de ação), 005 (Responsáveis e participantes), 006 (Evidências), 007 (Comentários), 013 (Interface e acesso corporativo), 015 (Acabamento da UI) e 016 (metodologias e Aval Técnico; esta entrega parte do trabalho do grupo 3 do 016).

## Restrições e não-escopo
- Restrição: nenhuma regra de negócio é criada nem alterada; a interface apenas muda onde e como a operação é acionada (humano, 2026-10-14).
- Restrição: autorização preservada integralmente. Quem podia executar cada operação antes continua podendo; quem não podia continua sem poder. A mudança de local de uma operação não pode ampliar nem reduzir permissões (humano, 2026-10-14). Toda nova forma de acionar uma operação precisa manter a exigência de papel que ela já tinha.
- Restrição: LGPD. Anexos podem conter dados sensíveis de saúde e imagens de colaboradores; as regras de formato, tamanho, visibilidade, download e auditoria do intent 006 continuam valendo sem afrouxamento. A escolha de arquivo na interface não pode expor o conteúdo a quem hoje não o vê.
- Restrição: a entrega segue a trilha padrão do processo (a modalidade enxuta foi recusada por envolver contrato de serviço, autorização e dados pessoais de anexos).
- Fora de escopo: alteração das regras de negócio do serviço da Tratativa; novas operações, novos papéis ou novas permissões; mudança dos limites de formato, tamanho e quantidade de Evidência; download de Evidência pela interface (não faz parte do pedido); deploy real.

## Critérios de aceite de negócio
- Na seção Plano de Ação, selecionada uma Ação, o usuário aciona Criar Subação, Delegar Ação, Anexar Evidência e Comentar Ação sem digitar nenhum código; a operação incide sobre a Ação selecionada.
- Na seção Evidências, selecionada uma Evidência, o usuário aciona Remover Evidência sem digitar código.
- Criar Ação está na barra da tabela do Plano de Ação e Comentar Tratativa está na seção Comentários; nenhum dos dois pede código da Tratativa.
- O cabeçalho da Tratativa não exibe mais Criar Subação, Delegar Ação, Anexar Evidência, Remover Evidência nem Comentar Ação.
- Nenhum diálogo de operação sobre Ação ou Evidência apresenta campo para código de Ação ou de Evidência.
- O diálogo de Anexar Evidência oferece escolha de arquivo; ao escolher um arquivo, nome, tipo e conteúdo são obtidos dele e a Evidência fica anexada à Ação selecionada, com Descrição opcional.
- Um arquivo de tipo não permitido, vazio ou acima do limite é recusado com a mesma mensagem que já existia para essa condição.
- Os mesmos usuários que antes eram aceitos continuam aceitos e os mesmos que eram recusados continuam recusados (por exemplo, usuário comum sem papel na Ação continua sem poder anexar nem remover Evidência, e somente o Gestor de Tratativa continua podendo criar Subação e delegar).
- Os eventos de histórico e as demais regras das operações permanecem idênticos aos anteriores.
- Sem linha selecionada, as operações de linha aparecem desabilitadas. Os botões de linha ficam ocultos para quem não tem o papel e desabilitados quando o status da linha não permite a operação.
- Os limites de Evidência (formatos, 10 MB, 10 ativas por Ação) valem para o arquivo escolhido no diálogo.
- Criar Subação sobre uma Subação continua recusada; Comentar Ação grava na Ação selecionada.
- O serviço do aplicativo deixa de oferecer as versões dessas operações ligadas à Tratativa com código como parâmetro; o serviço de regras de negócio da Tratativa segue inalterado.

## Questões abertas
- Nenhuma. As cinco questões levantadas foram respondidas pelo humano em 2026-10-14 (ver "Decisões confirmadas do humano"). Detalhes de apresentação ainda não decididos são tratados como hipóteses no Questionário de decisão da spec `acoes-nas-entidades`.
