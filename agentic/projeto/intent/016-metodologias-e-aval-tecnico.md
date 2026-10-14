# Intent: Metodologias de análise de causa e Aval Técnico

**Autor:** Paulo Calazans
**Sponsor:** Paulo Calazans
**Data:** 2026-10-13
**Status:** aprovado
**Origem:** ideia (lacuna de escopo apontada pelo humano: "foi uma falha grande não ter coberto essa funcionalidade")

## Problema
Hoje as Tratativas são abertas e seguem diretamente para a elaboração de Ações sem uma etapa estruturada de Diagnóstico / Investigação para aprofundamento das causas fundamentais da ocorrência. Essa ausência de instrumental formal de análise de causa raiz compromete a eficácia das contramedidas, levando a Ações superficiais e ao risco de reincidência de acidentes, falhas operacionais e desvios.

Além disso, não existe um elo formal e auditável que conecte as causas identificadas às Ações criadas no Plano de Ação, nem um marco de validação técnica especializada antes do encerramento da ocorrência. O encerramento ocorre sem que um especialista técnico (por exemplo, do SESMT ou da área técnica responsável) avalie se as Ações implementadas e as Evidências apresentadas de fato eliminaram o perigo ou resolveram a causa raiz.

Essa lacuna foi identificada pelo humano como uma falha de escopo relevante que ficou de fora das especificações iniciais (003 e 004) e dos intents subsequentes, exigindo cobertura formal para assegurar rigor metodológico e eficácia prática na resolução de ocorrências corporativas.

## Resultado proposto
Disponibilizar na plataforma corporativa de Tratativas duas capacidades integradas ao ciclo de vida da ocorrência:

1. **Diagnóstico / Investigação estruturado por Metodologias de causa raiz:**
   Apoiar a investigação da ocorrência por meio de metodologias consagradas de análise:
   - **3W** (What, Where, When / O que, Onde, Quando)
   - **5 Porquês** (investigação encadeada de causa raiz)
   - **5W2H** (What, Why, Where, When, Who, How, How much)
   - **PDCA / 8D** (ciclo estruturado de planejamento, execução, checagem e ação corretiva / 8 disciplinas)

2. **Geração de Ações a partir da análise de causa:**
   Possibilitar que itens identificados durante a aplicação da Metodologia (como linhas de contramedida do 5W2H ou causas-chave dos 5 Porquês) sejam convertidos diretamente em Ações no Plano de Ação, vinculadas à causa identificada, com revisão e validação prévia dos dados pelo usuário antes da efetivação.

3. **Verificação de Eficácia / Aval Técnico na etapa de Encerramento:**
   Estruturar um marco formal de validação técnica por especialista (papel Validador Técnico / SESMT), avaliando se as Ações concluídas e as Evidências apresentadas foram comprovadamente eficazes antes de permitir o encerramento definitivo da Tratativa.

O sistema mantém seu modelo genérico e extensível para qualquer Origem corporativa (SESMT, Qualidade, RH, Compliance, CSC, Sustentabilidade), tratando especificidades de cada área por meio de parametrização da Origem e não por regras fixas no código central.

### Decisões Confirmadas do Humano (2026-10-13)
As seguintes decisões foram confirmadas diretamente pelo humano (fonte: "humano, 2026-10-13", estado `confirmada`):
1. **Metodologias no escopo:** As ferramentas homologadas no escopo são: 5 Porquês, 5W2H, 3W e PDCA/8D (todas suportadas).
2. **Caráter sempre opcional da Metodologia:** O uso de Metodologia é estritamente opcional. Nenhuma etapa ou transição de status da Tratativa ou do Plano de Ação é bloqueada pela ausência de preenchimento de análise de causa.
3. **Ações originadas da análise:** Itens levantados durante a análise de causa (por exemplo, linhas do 5W2H) podem originar Ações do Plano de Ação, vinculadas à causa identificada, com revisão prévia pelo usuário antes da criação definitiva.
4. **Aval Técnico integrado ao escopo:** A Verificação de Eficácia / Aval Técnico compõe o escopo deste intent (016), juntamente com o Diagnóstico, atuando na etapa de Encerramento da Tratativa.
5. **Quantidade de metodologias por Tratativa:** Apenas uma metodologia por Tratativa (escolha exclusiva).
6. **Emissor do Aval Técnico:** O Aval Técnico é emitido pelo Técnico de Segurança / Equipe SESMT (registrada divergência levada ao Questionário para Origens não-SESMT).
7. **Exigência do Aval Técnico para Encerramento:** Aval Técnico sempre obrigatório para encerrar qualquer Tratativa.
8. **Desdobramento de Aval Técnico reprovado:** Parecer reprovado faz a Tratativa voltar a Em andamento, com encerramento bloqueado, justificativa obrigatória no Histórico e novas Ações corretivas exigidas.

## Usuários e sistemas afetados
- **Gestor de Tratativa:** conduz a Tratativa, preenche ou apoia o preenchimento da Metodologia, transforma causas em Ações e submete a ocorrência para encerramento e validação técnica.
- **Validador Técnico / SESMT:** especialista com papel de negócio designado para emitir o parecer do Aval Técnico / Verificação de Eficácia no Encerramento.
- **Responsável Original e Responsável Atual (Executor):** participam da investigação, executam as Ações derivadas da análise de causa e apresentam Evidências para subsidiar o Aval Técnico.
- **Solicitante / Aplicativo de Origem:** acompanha o parecer técnico e a comprovação de eficácia das medidas adotadas para o evento gerador.
- **Leitor Analítico / Consumo Analítico:** consome dados de causas raízes recorrentes, tempo de validação e taxas de eficácia.
- **Intents relacionados:**
  - 003 (Abertura e gestão de tratativas): etapas e regras de encerramento da Tratativa.
  - 004 (Plano de ação): criação e amarração das Ações derivadas da análise.
  - 005 (Responsáveis e participantes): atribuição do papel de validação técnica.
  - 006 (Evidências): suporte documental comprobatório para o Aval Técnico.
  - 008 (Histórico e auditoria): rastreabilidade de diagnósticos e emissão de aval.
  - 010 (Alertas e notificações): lembretes e prazos de avaliação de eficácia.
  - 012 (Dashboards e indicadores): métricas de eficácia e causas recorrentes.

## Restrições e não-escopo
- **Restrição:** Conformidade com a LGPD: campos de texto livre da análise e do parecer técnico não devem conter dados sensíveis ou exposições de pessoas; orientações e restrições de privacidade devem ser aplicadas.
- **Restrição:** Auditoria plena: nenhuma emissão de Aval Técnico, aprovação, reprovação ou modificação de diagnóstico ocorre de forma silenciosa; todo evento gera registro de histórico com autor e data.
- **Restrição:** Genericidade: nenhuma regra de negócio pode ser vinculada a nomes fixos de departamentos. Ajustes específicos do SESMT devem operar como parametrização da Origem.
- **Fora de escopo:**
  - Metodologias não homologadas nesta fase (ex.: Diagrama de Ishikawa / Espinha de Peixe, BowTie, FMEA).
  - Assinatura digital externa com certificado ICP-Brasil (a autenticação do usuário na plataforma atesta a responsabilidade).
  - Escrita de dados de volta no sistema do Aplicativo de Origem.

## Critérios de aceite de negócio
- O usuário com permissão pode associar e preencher uma metodologia homologada (3W, 5 Porquês, 5W2H, PDCA/8D) em uma Tratativa aberta ou em andamento.
- A Tratativa pode ser conduzida e encerrada sem qualquer preenchimento de Metodologia, garantindo o caráter opcional da funcionalidade.
- A partir dos apontamentos da análise de causa, o usuário pode selecionar itens e disparar a criação de Ações no Plano de Ação, mantendo vínculo com a causa raiz e permitindo edição dos atributos (descrição, responsável, prazo) antes da gravação.
- O especialista técnico habilitado pode emitir o Aval Técnico no Encerramento com parecer (Aprovado ou Reprovado) e fundamentação textual obrigatória.
- O encerramento da Tratativa fica bloqueado até a emissão de Aval Técnico com parecer favorável (Aval Técnico sempre obrigatório).
- Em caso de Aval Técnico reprovado, a Tratativa não é encerrada e volta a Em andamento, com encerramento bloqueado, justificativa obrigatória no Histórico e novas Ações corretivas exigidas.

## Questões abertas (com o Questionário de Decisão)
As questões a seguir representam regras que compõem o Questionário de Decisão, todas deliberadas e decididas no alinhamento do Gate 1 em 2026-10-13 conforme detalhado abaixo, sem apagar o histórico das opções avaliadas:

### Questionário de Decisão

1. **Autoria e permissão de preenchimento da análise de causa [Hipótese 1]**
   - *Pergunta:* Quais papéis de usuário possuem permissão para criar e editar a análise de causa na Tratativa?
   - *Opções:*
     - (a) (Recomendada) Gestor de Tratativa e Responsáveis pelas Ações (preenchimento colaborativo), cabendo ao Gestor a consolidação final.
     - (b) Apenas o Gestor de Tratativa.
     - (c) Qualquer participante autenticado associado à Tratativa.
   - *Recomendação e justificativa:* **(a)**, estimulando a colaboração entre os responsáveis técnicos e operacionais na identificação das causas sob coordenação do Gestor.
   - *Decisão:* Opção (a) confirmada. Fonte: "orquestrador por delegação do humano no Gate 1, 2026-10-13". Estado: confirmada.

2. **Ciclo de vida e momento de edição da análise [Hipótese 2]**
   - *Pergunta:* Até que fase da Tratativa a análise de metodologia pode ser modificada?
   - *Opções:*
     - (a) (Recomendada) Editável enquanto a Tratativa estiver nos status Aberta ou Em andamento; bloqueada permanentemente para edição após o Encerramento ou Cancelamento da Tratativa.
     - (b) Bloqueada para novas edições assim que a primeira Ação do Plano de Ação for concluída.
     - (c) Livremente editável a qualquer tempo, mesmo após o Encerramento.
   - *Recomendação e justificativa:* **(a)**, garantindo a integridade dos registros históricos de ocorrências já encerradas, ao mesmo tempo em que permite refinamentos diagnósticos durante a execução das Ações.
   - *Decisão:* Opção (a) confirmada. Fonte: "orquestrador por delegação do humano no Gate 1, 2026-10-13". Estado: confirmada.

3. **Versionamento e rastreabilidade da análise no Histórico [Hipótese 3]**
   - *Pergunta:* Qual o nível de detalhamento do registro de alterações da análise no Histórico e Auditoria?
   - *Opções:*
     - (a) (Recomendada) Registro sintético de auditoria (evento indicando criação ou alteração da Metodologia com autor e data/hora), mantendo o estado final consolidado da análise.
     - (b) Versionamento com gravação de cópia completa (snapshot) a cada salvamento da análise, com comparativo textual.
     - (c) Sem registro no Histórico durante a edição, gravando apenas o fechamento da análise no encerramento.
   - *Recomendação e justificativa:* **(a)**, consistente com a diretriz do intent 008, oferecendo plena rastreabilidade de quem realizou a análise sem complexidade de snapshots intermediários.
   - *Decisão:* Opção (a) confirmada. Fonte: "orquestrador por delegação do humano no Gate 1, 2026-10-13". Estado: confirmada.

4. **Prazo de avaliação e notificações do Aval Técnico [Hipótese 4]**
   - *Pergunta:* A etapa de Verificação de Eficácia possui prazo próprio de conclusão e integração com alertas?
   - *Opções:*
     - (a) (Recomendada) Sim, possui prazo específico de verificação de eficácia (SLA de avaliação contado a partir da conclusão das Ações), integrado ao serviço de Alertas e Notificações (intent 010) para alertar o Validador Técnico.
     - (b) Não, a avaliação deve ser feita no mesmo dia da conclusão das Ações, sem prazo próprio.
     - (c) Sem prazo e sem notificações de pendência para o Validador.
   - *Recomendação e justificativa:* **(a)**, porque a verificação de eficácia frequentemente demanda um período de maturação operacional (ex.: 30 dias após implementação) para constatar a ausência de novos desvios.
   - *Decisão:* Opção (a) confirmada. Fonte: "orquestrador por delegação do humano no Gate 1, 2026-10-13". Estado: confirmada.

5. **Alimentação de Indicadores e Consumo Analítico [Hipótese 5]**
   - *Pergunta:* Quais métricas decorrentes do Diagnóstico e do Aval Técnico devem ser consolidadas nos indicadores (intent 012)?
   - *Opções:*
     - (a) (Recomendada) Métricas analíticas de: Taxa de Eficácia (% de Tratativas com Aval Técnico aprovado na primeira validação), Tempo Médio de Verificação de Eficácia e Pareto de Causas Raízes mais incidentes.
     - (b) Apenas indicador de volume bruto de análises preenchidas.
     - (c) Nenhum dado analítico gerado para essas etapas.
   - *Recomendação e justificativa:* **(a)**, gerando subsídios para gestão preventiva e detecção de fragilidades crônicas na organização.
   - *Decisão:* Opção (a) confirmada. Fonte: "orquestrador por delegação do humano no Gate 1, 2026-10-13". Estado: confirmada.

6. **Parametrização por Origem para Metodologias e Aval [Hipótese 6]**
   - *Pergunta:* Como as regras de análise e de validação devem ser configuradas para as diferentes Origens?
   - *Opções:*
     - (a) (Recomendada) Cadastro de parametrização da Origem contendo: Metodologia sugerida por padrão, papel/validador responsável pelo Aval Técnico e Prazo padrão de verificação de eficácia (a exigência do Aval deixa de ser parametrizável, sendo sempre mandatória para todas as Origens).
     - (b) Regras fixas no código para o SESMT e genéricas para os demais.
     - (c) Sem parametrização, decidindo manualmente caso a caso em cada ocorrência.
   - *Recomendação e justificativa:* **(a)**, pois a exigência do Aval Técnico deixa de ser parametrizável (é sempre obrigatória para encerrar qualquer Tratativa), mas o validador e o prazo de verificação continuam parametrizáveis por Origem, em estrito cumprimento da regra inviolável de que particularidades departamentais são dados de parametrização da Origem, nunca código fixo.
   - *Decisão:* Opção (a) confirmada. Fonte: "orquestrador por delegação do humano no Gate 1, 2026-10-13". Estado: confirmada.

7. **Privacidade e Proteção de Dados Pessoais (LGPD) [Hipótese 7] [LGPD]**
   - *Pergunta:* Como resguardar a privacidade em descrições livres de análise de causa e pareceres de validação técnica?
   - *Opções:*
     - (a) (Recomendada) Apresentação de instruções visuais e placeholders autoexplicativos alertando que a análise deve focar em falhas de processo e condições operacionais, evitando identificação de pessoas ou dados sensíveis, associado a controle de acesso restrito.
     - (b) Bloqueio textual automático de termos e nomes pelo sistema.
     - (c) Sem diretrizes ou salvaguardas de privacidade nos campos textuais.
   - *Recomendação e justificativa:* **(a)**, orientando preventivamente os usuários finais com placeholders claros sem risco de bloqueios indevidos por filtros automáticos de linguagem.
   - *Decisão:* Opção (a) confirmada. Fonte: "orquestrador por delegação do humano no Gate 1, 2026-10-13". Estado: confirmada.

8. **Quem emite o Aval nas Tratativas de Origens que não são SESMT? [Hipótese 8] [N3]**
   - *Pergunta:* Quem emite o Aval nas Tratativas de Origens que não são SESMT?
   - *Contexto / Divergência:* A regra do contrato estabelece que especificidades departamentais são parametrização da Origem (modelo genérico e extensível para Qualidade, RH etc.), mas o humano definiu o emissor como Equipe SESMT e o Aval como obrigatório para todas as Origens.
   - *Opções:*
     - (a) (Recomendada) Um papel de negócio genérico 'Validador Técnico', atribuído por padrão à Equipe SESMT e configurável por Origem (preserva a decisão do humano para o SESMT e a regra de genericidade).
     - (b) A Equipe SESMT valida as Tratativas de todas as Origens.
     - (c) Outra.
   - *Recomendação e justificativa:* **(a)**, pois preserva a decisão do humano de validação pela Equipe SESMT nas ocorrências de segurança, mantendo a regra inviolável de genericidade para que outras Origens (Qualidade, RH) configurem seus respectivos validadores técnicos.
   - *Decisão:* Opção (a) confirmada: papel de negócio genérico 'Validador Técnico', atribuído por padrão à Equipe SESMT (Técnico de Segurança) e configurável por Origem. Fonte: "humano, 2026-10-13". Estado: confirmada.
