# Spec: abertura-por-apps-de-origem

**Intent:** agentic/projeto/intent/002-abertura-por-apps-de-origem.md
**Status:** aprovado

Escopo: contrato de abertura e de consulta de Tratativas por aplicativos externos (Origens), a Tratativa avulsa e o mínimo de Tratativa que esse contrato exige (Código, Origem, ID_Origem, Criticidade, Data de criação, Data prevista de conclusão, Status inicial). Ciclo de vida, demais campos e transições de Status pertencem ao intent 003.

Papéis: `Aplicativo de origem` (sistema externo que abre e consulta), `Solicitante` (colaborador que pediu a Tratativa, campo opcional), `Usuário da plataforma` (cria Tratativa avulsa), `Administrador da plataforma` (mantém a tabela de prazos, ver R11).

## Regras
| # | Regra | Fonte | Estado |
|---|---|---|---|
| R1 | A Origem é um texto opcional da Tratativa que identifica o aplicativo externo cujo registro a motivou. Não existe cadastro (tela nem lista) de Origens nem Tipo. | humano:2026-10-07 (intent 002, itens 1 e 6) | confirmada |
| R2 | A Tratativa guarda o ID_Origem, o código textual do registro no aplicativo de origem. | humano:2026-10-07 (intent 002, item 2) | confirmada |
| R3 | O aplicativo de origem abre uma Tratativa enviando o ID_Origem e dados básicos; a plataforma gera um Código único para a Tratativa (R22) e o devolve ao aplicativo. | humano:2026-10-07 (intent 002, item 3) | confirmada |
| R4 | Cada registro de origem gera no máximo uma Tratativa. Repetir o pedido de abertura para o mesmo registro devolve o Código da Tratativa existente e não cria outra. | humano:2026-10-07 (intent 002, item 4) | confirmada |
| R5 | A plataforma não envia status ao aplicativo de origem; o aplicativo consulta a Tratativa quando precisar. | humano:2026-10-07 (intent 002, item 5) | confirmada |
| R6 | Uma Tratativa avulsa pode ser criada sem Origem e sem ID_Origem. O 1 para 1 de R4 vale apenas quando há registro de origem. | humano:2026-10-07 (intent 002, item 6) | confirmada |
| R7 | Toda Tratativa tem uma Criticidade (`Baixa`, `Média`, `Alta`, `Crítica`), informada na abertura pelo aplicativo de origem ou, na avulsa, por quem a cria. Valor fora dessa lista recusa a abertura. | humano:2026-10-07 (intent 002, item 7); humano:2026-10-07 (confirmada a leitura "informada na abertura") | confirmada |
| R8 | O prazo é contado em dias corridos desde a data de criação da Tratativa. Não há parametrização de prazo por Origem. | humano:2026-10-07 (intent 002, item 8) | confirmada |
| R9 | O contrato de abertura e consulta é o mesmo para qualquer Origem; nenhum nome de Origem ou regra específica de uma área é fixo no núcleo. Variação vem de dados de parametrização. | humano:2026-10-07 (intent 002, Genericidade); oráculo:AGENTS.md:36 | confirmada |
| R10 | A Data prevista de conclusão é derivada da Criticidade por uma tabela global parametrizável: Crítica 3, Alta 7, Média 15, Baixa 30 dias corridos, somados à data de criação. O aplicativo não informa a data prevista. | humano:2026-10-07 (questionário respondido) | confirmada |
| R11 | Só o Administrador da plataforma altera a tabela de prazos de R10, e a alteração vale apenas para Tratativas criadas depois dela; as já existentes mantêm a Data prevista de conclusão. | humano:2026-10-07 (questionário respondido) | confirmada |
| R12 | A Criticidade pode ser alterada depois da abertura. O 002 entrega a regra; a operação de alteração exposta a usuários e quem pode usá-la ficam no intent 003. A alteração recalcula a Data prevista de conclusão como data de criação original mais os dias da nova Criticidade e gera registro de histórico (valor anterior, valor novo, quem alterou, quando). | humano:2026-10-07 (questionário respondido); histórico de prazo: oráculo:AGENTS.md:40 | confirmada |
| R13 | Dados básicos da abertura. Obrigatórios: Título e Criticidade (mais Origem e ID_Origem quando vier de aplicativo, ver R14). Opcionais: Descrição, Unidade, Área e Solicitante. Falta de dado obrigatório recusa a abertura, com mensagem que nomeia o campo, e nada é criado. | humano:2026-10-07 (questionário respondido) | confirmada |
| R14 | Origem e ID_Origem andam juntos: ou ambos preenchidos (abertura por aplicativo) ou ambos vazios (avulsa). Um só dos dois recusa a abertura. | humano:2026-10-07 (questionário respondido) | confirmada |
| R15 | A unicidade de R4 é do par (Origem, ID_Origem): o mesmo ID_Origem em Origens diferentes gera Tratativas diferentes. O texto da Origem é gravado como veio, mas a comparação do par ignora diferença de maiúsculas/minúsculas e espaços nas pontas. Acentos distintos contam como Origens distintas. | humano:2026-10-07 (questionário respondido) | confirmada |
| R16 | Em pedido repetido (R4) com dados diferentes dos da primeira abertura, a Tratativa existente não é alterada e o Código dela é devolvido. | humano:2026-10-07 (questionário respondido) | confirmada |
| R17 | Qualquer usuário autenticado da plataforma pode criar Tratativa avulsa. Aplicativo de origem não é "usuário da plataforma": só usuários criam avulsa; o pedido de um aplicativo de origem autenticado para criar avulsa é recusado (acesso negado, mensagem "Aplicativo de origem não cria Tratativa avulsa.") e nada é criado. | humano:2026-10-07 (questionário respondido, quem cria avulsa); esclarecimento: orquestrador por delegação do humano, 2026-10-07; derivado de spec.md:8 e da nota R13/R14 | confirmada |
| R18 | O aplicativo de origem se identifica por uma credencial própria, emitida e revogável pela plataforma. Pedido de abertura ou consulta sem credencial válida é recusado, nada é criado e nenhum dado de Tratativa é revelado. | humano:2026-10-07 (questionário respondido; segurança, N3) | confirmada |
| R19 | O aplicativo consulta uma Tratativa pelo Código ou pelo par (Origem, ID_Origem) e recebe somente: Código, Origem, ID_Origem, Criticidade, Status, Data de criação e Data prevista de conclusão. A consulta não devolve Descrição nem nomes de pessoas. Consulta de Tratativa inexistente devolve "não encontrada". Sem vínculo entre aplicativo e Origem no MVP: quem informa o Código ou o par corretos consulta. | humano:2026-10-07 (questionário respondido, inclusive a sub-pergunta; contrato público, N3; LGPD) | confirmada |
| R20 | Toda Tratativa nasce com Status `Aberta` e a criação gera registro de histórico (quem criou: aplicativo ou usuário, e quando). Os demais Status e as transições pertencem ao intent 003. | humano:2026-10-07 (questionário respondido); histórico: oráculo:AGENTS.md:40 | confirmada |
| R21 | O contrato de abertura aceita apenas os campos de R13. Campo desconhecido recusa o pedido. Dados pessoais além da matrícula do Solicitante (R23), por exemplo nome de vítima ou de advertido, não fazem parte do contrato. | humano:2026-10-07 (questionário respondido; LGPD) | confirmada |
| R22 | O Código da Tratativa é um UUID, opaco (sem significado embutido, sem prefixo de Origem), gerado pela plataforma e devolvido ao aplicativo na abertura. | humano:2026-10-07 | confirmada |
| R23 | Na abertura, o Solicitante (opcional) é identificado somente pela matrícula/ID do colaborador, sem nome nem e-mail; o nome virá do SuccessFactors no intent 011. | humano:2026-10-07 (LGPD; SuccessFactors) | confirmada |

Derivado de R13 e R14 (não é decisão nova): o aplicativo autenticado sempre envia o par (Origem, ID_Origem); o usuário que cria avulsa nunca o envia.

Placeholders autoexplicativos dos campos preenchidos por quem cria a Tratativa avulsa (e que o aplicativo de origem também usa como referência):
- Título: "Resuma em uma frase o que aconteceu ou o que precisa ser corrigido".
- Criticidade: "Escolha o nível de risco: Baixa, Média, Alta ou Crítica (define o prazo previsto)".
- Descrição (opcional): "Descreva a ocorrência. Evite incluir nomes de pessoas ou dados sensíveis".
- Unidade (opcional): "Informe a unidade onde ocorreu".
- Área (opcional): "Informe a área responsável ou afetada".
- Solicitante (opcional): "Informe a matrícula (ID) do colaborador que está pedindo esta Tratativa; não digite nome nem e-mail".

## Critérios de aceite
- CA1 (R1, R2, R3): dado um aplicativo autenticado, quando ele abre uma Tratativa com Origem "Advertência", ID_Origem "ADV-001", Título e Criticidade `Alta`, então a plataforma cria a Tratativa e devolve um Código.
- CA2 (R4): dado que já existe a Tratativa do par ("Advertência", "ADV-001"), quando o aplicativo repete o pedido, então recebe o mesmo Código e continua existindo uma única Tratativa para o par.
- CA3 (R5): dado uma Tratativa aberta por um aplicativo, quando ocorre um evento do 002 (a criação, a alteração de Criticidade pela regra R12 ou um pedido repetido de abertura, R16), então a plataforma não faz nenhuma comunicação de saída ao aplicativo; ele só vê o estado ao consultar (CA21).
- CA4 (R6, R17): dado um usuário autenticado, quando ele cria uma Tratativa com Título e Criticidade e sem Origem nem ID_Origem, então a Tratativa é criada com Código.
- CA5 (R7): dado um pedido de abertura com Criticidade "Urgente", quando a plataforma o recebe, então recusa o pedido e não cria Tratativa.
- CA6 (R8, R10): dado uma tabela de prazos padrão e uma Tratativa `Crítica` criada em 2026-10-07, quando ela é criada, então a Data prevista de conclusão é 2026-10-10.
- CA7 (R10): dado uma Tratativa `Baixa` criada em 2026-10-07, então a Data prevista de conclusão é 2026-11-06.
- CA8 (R10, R8): dado o aplicativo informar uma data prevista no pedido, quando a plataforma o recebe, então recusa o pedido por campo desconhecido (R21) e não aceita data informada.
- CA9 (R11): dado uma Tratativa `Alta` já criada e que o Administrador altere o prazo de `Alta` de 7 para 5 dias, quando uma nova Tratativa `Alta` é criada, então a nova usa 5 dias e a existente mantém a Data prevista de conclusão original.
- CA10 (R11): dado um usuário que não é Administrador da plataforma, quando ele tenta alterar a tabela de prazos, então a alteração é recusada.
- CA11 (R12): dado uma Tratativa `Baixa` criada em 2026-10-07, quando a Criticidade passa a `Crítica` em 2026-10-20, então a Data prevista de conclusão passa a 2026-10-10 e o histórico registra valor anterior, valor novo, autor e data. Verificação no 002: no nível da regra, por uma operação interna do serviço, sem operação pública; a operação exposta a usuários é do 003.
- CA12 (R13): dado um pedido de abertura sem Título, quando a plataforma o recebe, então recusa com mensagem que cita o campo Título e não cria Tratativa.
- CA13 (R13): dado um pedido com apenas Título, Criticidade, Origem e ID_Origem, quando a plataforma o recebe, então cria a Tratativa sem Descrição, Unidade, Área e Solicitante.
- CA14 (R14): dado um pedido com ID_Origem e sem Origem, quando a plataforma o recebe, então recusa o pedido e não cria Tratativa.
- CA15 (R15): dado que existe a Tratativa de ("Advertência", "123"), quando outro aplicativo abre com ("Notificação de Risco de Acidente", "123"), então é criada uma segunda Tratativa com Código diferente.
- CA16 (R15): dado que existe a Tratativa de ("Advertência", "123"), quando se abre com ("  advertência ", "123"), então é devolvido o Código existente e nada é criado.
- CA17 (R15): dado que existe a Tratativa de ("Advertência", "123"), quando se abre com ("Advertencia", "123"), então é criada outra Tratativa, porque os acentos diferem.
- CA18 (R16): dado que existe a Tratativa de ("Advertência", "ADV-001") com Criticidade `Alta`, quando o pedido é repetido com Criticidade `Baixa`, então o Código existente é devolvido e a Criticidade continua `Alta`.
- CA19 (R18): dado um pedido de abertura sem credencial válida, quando a plataforma o recebe, então recusa o pedido e não cria Tratativa.
- CA20 (R18): dado um pedido de consulta sem credencial válida, quando a plataforma o recebe, então recusa o pedido e não revela dado algum da Tratativa.
- CA21 (R19): dado uma Tratativa existente, quando o aplicativo consulta pelo Código, então recebe Código, Origem, ID_Origem, Criticidade, Status, Data de criação e Data prevista de conclusão, sem Descrição e sem nomes de pessoas.
- CA22 (R19): dado uma Tratativa existente, quando o aplicativo consulta pelo par (Origem, ID_Origem), então recebe os mesmos campos de CA21.
- CA23 (R19): dado um Código ou par que não corresponde a nenhuma Tratativa, quando o aplicativo consulta, então recebe "não encontrada".
- CA24 (R20): dado uma abertura aceita, quando a Tratativa é criada, então seu Status é `Aberta` e existe um registro de histórico de criação com o autor (aplicativo ou usuário) e a data.
- CA25 (R21): dado um pedido com um campo fora da lista de R13 (por exemplo, "nomeVitima"), quando a plataforma o recebe, então recusa o pedido e não cria Tratativa.
- CA26 (R9): dado um aplicativo com Origem "Auditoria de Qualidade", que não é um dos três do MVP, quando ele abre uma Tratativa pelo mesmo contrato, então a abertura funciona sem nenhuma configuração específica dessa Origem.
- CA27 (R14): dado um pedido de aplicativo com Origem e sem ID_Origem, quando a plataforma o recebe, então recusa o pedido e não cria Tratativa.
- CA28 (R7, R13): dado um pedido de abertura sem Criticidade, quando a plataforma o recebe, então recusa com mensagem que cita o campo Criticidade e não cria Tratativa.
- CA29 (R10): dado uma Tratativa `Alta` criada em 2026-10-07, então a Data prevista de conclusão é 2026-10-14.
- CA30 (R10): dado uma Tratativa `Média` criada em 2026-10-07, então a Data prevista de conclusão é 2026-10-22.
- CA31 (R17): dado um usuário não autenticado, quando ele tenta criar uma Tratativa avulsa, então o pedido é recusado e nada é criado.
- CA32 (R18): dado um aplicativo cuja credencial foi revogada, quando ele envia um pedido de abertura ou de consulta, então o pedido é recusado, nada é criado e nenhum dado é revelado.
- CA33 (R6): dado um usuário que cria duas Tratativas avulsas com os mesmos Título e Criticidade, então são criadas duas Tratativas distintas, porque o 1 para 1 só vale com registro de origem.
- CA34 (R3, R22): dadas duas aberturas aceitas de registros diferentes, então os Códigos devolvidos são UUIDs válidos, diferentes entre si, e nenhum Código é reutilizado.
- CA35 (R22): dado um Código devolvido na abertura, então ele não contém a Origem nem o ID_Origem e não depende da ordem de criação.
- CA36 (R23): dado um pedido com Solicitante informado por matrícula, quando a plataforma o recebe, então a Tratativa é criada guardando só a matrícula.
- CA37 (R23, R21): dado um pedido com nome ou e-mail do Solicitante, quando a plataforma o recebe, então recusa o pedido (campo desconhecido) e não cria Tratativa.
- CA38 (R17): dado um aplicativo de origem autenticado, quando ele pede criar uma Tratativa avulsa, então o pedido é recusado com acesso negado (403) e nada é criado.

## Invariantes (o que não muda)
- Um par (Origem, ID_Origem) preenchido tem no máximo uma Tratativa.
- O Código de uma Tratativa nunca muda nem é reaproveitado.
- A Data de criação nunca muda.
- Toda alteração de Criticidade ou de Data prevista de conclusão gera histórico; nunca é silenciosa.
- A plataforma nunca inicia comunicação de status com o aplicativo de origem.
- Nenhuma regra ou campo é exclusivo de uma área ou Origem.

## Fora de escopo
- Cadastro, tela ou lista de Origens e qualquer parametrização por Origem; Tipo.
- Devolução automática de status ao aplicativo de origem.
- Construção ou alteração dos aplicativos de origem e os tipos de ocorrência definidos neles.
- Demais campos da Tratativa (o formato do Código está decidido em R22), Status além do inicial, transições, encerramento, reabertura, edição, cancelamento (intent 003).
- Operação de alteração de Criticidade exposta a usuários e quem pode usá-la (intent 003); o 002 entrega apenas a regra R12 (recálculo do prazo e histórico).
- Ações (004), Responsáveis (005), Evidências (006), Comentários (007), Histórico em si (008), Templates (009), alertas (010), integração SuccessFactors (011), indicadores (012).
- Política de retenção e acesso a dados pessoais (LGPD), a tratar em intent próprio ou no 003.
- Conversão de Tratativas existentes caso o cadastro de Origens venha depois.

## Questionário de decisão
Marcação: [LGPD] envolve dados pessoais; [N3] envolve contrato público, segurança ou autorização, com aprovação explícita no Gate 1.

**Respostas (humano:2026-10-07):** o humano aceitou a opção recomendada nas 12 perguntas, inclusive a sub-pergunta da 10, e confirmou R7. Resumo: 1(a) tabela global 3/7/15/30; 2(a) só o Administrador, valendo para novas Tratativas; 3(a) Criticidade mutável, prazo desde a criação original, com histórico (o 002 entrega a regra; a operação exposta a usuários e quem a usa ficam no 003); 4(a) obrigatórios Título e Criticidade (mais Origem e ID_Origem para apps); 5(a) Origem e ID_Origem andam juntos; 6(a) par sem diferenciar caixa nem espaços nas pontas; 7(a) repetição devolve o existente sem alterar; 8(a) qualquer usuário autenticado cria avulsa; 9(a) credencial própria por aplicativo; 10(a) consulta restrita aos campos listados, e quem informa Código ou par corretos consulta; 11(a) Status inicial `Aberta`; 12(a) campo desconhecido recusa o pedido. As perguntas abaixo ficam como registro; a recomendação de cada uma foi a escolhida. Itens [N3] (2, 4, 8, 9, 10, 12) ainda exigem aprovação explícita no Gate 1, item a item; o Solicitante (4 e 12) também é [LGPD].

1. (R10) Como se obtém a Data prevista de conclusão? — opções: (a) derivada da Criticidade por tabela global 3/7/15/30 dias corridos desde a criação; (b) informada pelo aplicativo na abertura; (c) tabela global, com o aplicativo podendo informar uma data própria. Recomendação: (a), porque o humano disse que não há prazo por Origem e a Criticidade já vem na abertura, o que mantém o contrato simples e comparável entre áreas.
2. (R11) Quem altera a tabela de prazos e a mudança vale para quais Tratativas? — opções: (a) só o Administrador da plataforma, valendo apenas para novas Tratativas; (b) Administrador, recalculando também as abertas; (c) a tabela é fixa, sem alteração. Recomendação: (a), porque não muda prazos já combinados com responsáveis e mantém a parametrização exigida pelo modelo genérico. [N3: autorização do Administrador]
3. (R12) A Criticidade pode mudar depois da abertura? — opções: (a) sim, o prazo é recalculado desde a criação original, com histórico; (b) sim, o prazo é recalculado desde a data da alteração, com histórico; (c) não, é imutável. Recomendação: (a), porque preserva a regra "dias corridos desde a criação" (R8) e dá o mesmo prazo a quem já nasceu com aquela Criticidade; fica a ressalva de que uma Tratativa já vencida pode ficar atrasada de imediato. Quem pode alterar fica para o intent 003. Resposta: (a); o 002 entrega a regra (recálculo e histórico), verificada por operação interna do serviço, e a operação exposta a usuários e quem a usa ficam no 003.
4. (R13) Quais dados básicos são obrigatórios na abertura? — opções: (a) Título e Criticidade, mais Origem e ID_Origem para aplicativos; Descrição, Unidade, Área e Solicitante opcionais; (b) (a) mais Descrição obrigatória; (c) (a) mais Solicitante obrigatório. Recomendação: (a), porque Unidade e Área ainda dependem do SuccessFactors (intent 011) e nem todo aplicativo sabe quem é o Solicitante; o que faltar é completado na plataforma (intent 003). [SuccessFactors] [LGPD: Solicitante] [N3: formato do contrato público de abertura]
5. (R14) Origem e ID_Origem podem vir sozinhos? — opções: (a) andam juntos, ambos ou nenhum; (b) Origem sozinha é aceita (sem 1 para 1); (c) ID_Origem sozinho é aceito. Recomendação: (a), porque o 1 para 1 depende do par e uma Origem sem registro é equivalente a avulsa.
6. (R15) Qual é a chave de unicidade e como tratar variações de escrita da Origem? — opções: (a) par (Origem, ID_Origem), comparando sem diferenciar maiúsculas/minúsculas nem espaços nas pontas; (b) par exato, sem normalização; (c) só o ID_Origem. Recomendação: (a), porque evita duplicar por digitação trivial sem cadastro de Origens. Atenção: "Advertencia" e "Advertência" continuam Origens distintas nos indicadores; a alternativa é lista de valores aceitos, que é cadastro e foi adiado pelo humano.
7. (R16) Pedido repetido com dados diferentes. — opções: (a) devolve o Código existente e não altera nada; (b) devolve o existente e atualiza os dados; (c) recusa com erro de conflito. Recomendação: (a), porque o humano definiu "devolve a existente", e alteração de dados pelo aplicativo abriria caminho de mudança silenciosa; mudanças passam pela plataforma.
8. (R17) Quem cria Tratativa avulsa? — opções: (a) qualquer usuário autenticado; (b) só SESMT e gestores; (c) só um papel específico de criação. Recomendação: (a), porque o modelo é genérico e a restrição por papel é de autorização, a definir junto com o intent 003; (b) e (c) obrigam a fixar papéis já no MVP. [N3: autorização]
9. (R18) Como o aplicativo se autentica? — opções: (a) credencial própria por aplicativo, emitida e revogável pela plataforma; (b) credencial única compartilhada por todos os aplicativos; (c) em nome de um usuário humano. Recomendação: (a), porque permite revogar um aplicativo sem afetar os outros e identifica o autor no histórico, sem cadastro de Origens (a credencial identifica o aplicativo, não a Origem em texto). [N3: segurança, contrato público]
10. (R19) O que a consulta devolve e quem pode consultar o quê? — opções: (a) Código, Origem, ID_Origem, Criticidade, Status, Data de criação e Data prevista, sem Descrição nem nomes; (b) (a) mais Responsável; (c) a Tratativa completa. Recomendação: (a), porque cobre a necessidade do aplicativo (saber a situação e o prazo) e minimiza dados pessoais. Sub-pergunta: qualquer aplicativo autenticado pode consultar qualquer Tratativa, ou só as que abriu? Recomendação: a que informar o par ou Código corretos, no MVP, pois sem cadastro de Origens não há como vincular o aplicativo ao texto da Origem. [LGPD] [N3: contrato público]
11. (R20) Qual é o Status inicial? — opções: (a) `Aberta` para qualquer Tratativa, com histórico de criação; (b) `Aberta` para a de aplicativo e `Rascunho` para a avulsa; (c) o aplicativo escolhe o Status inicial. Recomendação: (a), porque é o mínimo que o 002 exige e o conjunto completo de Status é decidido no intent 003.
12. (R21) O contrato aceita campos além dos básicos? — opções: (a) não, campo desconhecido recusa o pedido, e dados pessoais além da identificação do Solicitante ficam fora; (b) campos extras são ignorados; (c) campos livres extras são guardados. Recomendação: (a), porque a Advertência traz dados sensíveis de RH e a Descrição pode conter nomes de vítimas; guardar só o necessário reduz o risco, e a política de retenção e acesso fica para decisão própria. [LGPD: Solicitante e dados pessoais] [N3: formato do contrato público de abertura]

## Questões em aberto
- Política de retenção, anonimização e log de acesso a dados pessoais (Advertência e Registro de Acidente): fora deste escopo, precisa de decisão do humano antes de produção. [LGPD]
- O Solicitante é o autor do registro no aplicativo ou outra pessoa? (A identificação por matrícula está decidida em R23.) Depende do intent 003 e da integração SuccessFactors (011).
- O formato do Código (UUID, R22) é item N3 do contrato público de abertura e segue para aprovação explícita no Gate 1 como decisão já tomada; não há mais dúvida aberta.
- Se o cadastro de Origens vier depois, como converter as Tratativas com Origem em texto (intent 002, evolução futura).
- Templates (009) e alertas (010) valem para todas as Tratativas ou variam pelo texto da Origem? A decidir nesses intents.

## Divergências
- Proposta × decisão do humano: a proposta descrevia Origem como área/processo com Tipos, tela de cadastro e regras e prazos próprios por Origem. Prevalece a decisão do humano de 2026-10-07 (Origem é campo de texto de um aplicativo externo, sem Tipo, sem cadastro, sem prazo por Origem); `AGENTS.md:6-8,36` já está alinhado.
- Prazo: a proposta trazia prazos parametrizados por Origem; o humano removeu a parametrização por Origem e manteve os valores 3/7/15/30 como referência. Como esses valores viram tabela global parametrizável (R10) está resolvido pela resposta 1(a) do humano de 2026-10-07; a alternativa da data prevista informada na abertura, que o intent oferecia, foi descartada.
- Spec × design (ciclo.md:61), resolvida em 2026-10-07: o design (decisão 15) recusa a criação de avulsa por identidade de aplicativo de origem, enquanto R17 dizia só "qualquer usuário autenticado" e a spec não dizia se um aplicativo podia criar avulsa. Resolução, pelo orquestrador por delegação do humano ausente: aplicativo de origem não é "usuário da plataforma" (spec.md:8) e só abre Tratativa com o par (nota R13/R14); R17 foi esclarecida e o CA38 cobre o caso.
