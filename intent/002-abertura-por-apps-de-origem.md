# Intent: Origem e abertura de Tratativas por aplicativos externos

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** draft
**Origem:** ideia

## Problema
Hoje cada área trata ocorrências e ações corretivas em ferramentas isoladas, e um registro feito em um aplicativo não tem como gerar e acompanhar um plano de ação comum. A proposta defende que a entidade central é a **Origem da Tratativa**, e não o Plano de Ação (fonte: humano:2026-10-07, proposta anexada, seção Visão Geral e seção Diferencial Estratégico). O acompanhamento atual do SESMT é o ponto de partida; detalhes e números não constam da proposta.

## Resultado proposto
A plataforma funciona integrada a outros aplicativos. Uma **Origem** é um aplicativo externo cujo registro motivou um plano de ação; pode ser um aplicativo qualquer (humano:2026-10-07, "A ideia é deixar o plano integrado a outros Apps, isso que é a origem. Pode ser um app qualquer; a questão é que um registro dele motivou um plano de ação").

Conteúdo deste intent, todo por decisão do humano em 2026-10-07:

1. **Origem é um campo de texto** da Tratativa. No MVP não existe cadastro (tela nem lista) de Origens; o cadastro de Origens está fora de escopo por enquanto. Não existe Tipo.
2. **ID_Origem:** a Tratativa guarda o ID do registro do aplicativo de origem (código textual do evento gerador, termo do vocabulário do domínio; passa a fazer sentido por estas respostas, pois a proposta original não o menciona).
3. **Abertura por API:** o aplicativo de origem abre a Tratativa por chamada de serviço da plataforma, enviando o ID do registro e dados básicos, e recebe o código da Tratativa.
4. **Idempotência (1 para 1):** cada registro de origem gera no máximo uma Tratativa. Repetir o pedido de abertura para o mesmo registro devolve o código da Tratativa já existente, sem criar outra.
5. **Consulta de status pela API:** no MVP a plataforma não devolve status ao aplicativo; o aplicativo consulta pela API quando precisar.
6. **Tratativa avulsa permitida:** a origem é opcional. Quando existe registro de origem, vale o 1 para 1.
7. **Criticidade** (`Baixa`, `Média`, `Alta`, `Crítica`; proposta, seção Regras de Negócio / Criticidade): é informada na abertura, como campo da Tratativa, pelo aplicativo de origem ou, na avulsa, por quem a cria. Resposta literal do humano: "Por criticidade, isso também será informado no cadastro, é um campo no contexto do app".
8. **Prazo:** não há parametrização de prazo por Origem. Valores de referência da proposta (seção Regras de Negócio / Prazos): Crítica 3 dias, Alta 7, Média 15, Baixa 30; dias corridos contados da criação da Tratativa (humano:2026-10-07).

   **Resolvido (humano:2026-10-07, questionário da spec):** o prazo é derivado da Criticidade por uma tabela global parametrizável (3/7/15/30 dias corridos desde a criação); o aplicativo não informa a data prevista. A Criticidade é informada na abertura (confirmado).

### Origens do MVP (humano:2026-10-07)
Três aplicativos do SESMT, que preencherão o campo texto Origem: "Registro de Acidente + FIA", "Notificação de Risco de Acidente" e "Advertência". Os tipos de ocorrência (Acidente, Quase Acidente, Condição Insegura, Ato Inseguro, Inspeção, Auditoria de Segurança) ficam dentro desses aplicativos e estão fora do escopo da plataforma.

### Genericidade
Origem como texto livre e criticidade como campo mantêm a plataforma agnóstica a departamento e a aplicativo: aplicativos de outras áreas (Qualidade, RH, Compliance, CSC, Sustentabilidade, exemplos da proposta, seção Conceito Principal) usam a mesma abertura sem mudança estrutural. Nada específico do SESMT é fixo (proposta, seções MVP SESMT e Diferencial Estratégico).

### Conceito original da proposta (registro de divergência resolvida)
A proposta (seções Conceito Principal, Cadastro de Origens, Prazos e MVP SESMT) descrevia Origem como área/processo com Tipos dentro dela, uma tela administrativa de cadastro e parametrização de regras próprias por Origem ("Cada origem poderá possuir regras próprias") e prazos parametrizados. As respostas do humano de 2026-10-07 prevalecem: Origem é um app externo, campo de texto, sem Tipo, sem cadastro, sem prazo por Origem. A divergência com `AGENTS.md` está resolvida: as linhas 6, 8 e 36 do `AGENTS.md` já descrevem Origem como app externo em campo texto, sem Tipo, com tratativa avulsa permitida e o MVP com os três apps.

## Relação com o 003
O 002 é intent próprio: é um contrato de integração com sistemas externos (abertura idempotente e consulta por API, autenticação do app), item de segurança e contrato público (N3) com critérios de aceite próprios; o 003 trata do registro, do ciclo de vida e dos campos da Tratativa. O 003 referencia o 002 e não duplica as regras acima.

## Usuários e sistemas afetados
- Aplicativos de origem (Registro de Acidente + FIA, Notificação de Risco de Acidente, Advertência) — abrem Tratativas pela API, recebem o código e consultam a situação.
- Usuários da plataforma (SESMT, gestores etc.) — criam Tratativas avulsas.
- Intents que dependem deste: 003, 009, 010, 011, 012.

## Restrições e não-escopo
- Restrição: modelagem genérica; nada específico do SESMT é fixo.
- Restrição: prazos em dias corridos, a partir da criação.
- Fora de escopo: cadastro/tela/lista de Origens e qualquer parametrização por Origem no MVP.
- Fora de escopo: Tipo (e regras por Tipo) no MVP; evolução futura.
- Fora de escopo: devolução automática de status ao app de origem (o app consulta).
- Fora de escopo: construção ou alteração dos aplicativos de origem; os tipos de ocorrência definidos neles.
- Fora de escopo: registro e ciclo da Tratativa (003), Ações (004), Templates (009), alertas (010).

## Critérios de aceite de negócio
- Um aplicativo de origem abre uma Tratativa informando Origem (texto), ID do registro, Criticidade e dados básicos, e recebe o código da Tratativa.
- Um segundo pedido de abertura para o mesmo registro de origem devolve o código da Tratativa existente e não cria outra.
- Um usuário pode criar uma Tratativa avulsa, sem Origem nem registro de origem.
- O aplicativo de origem consulta a Tratativa pela API; a plataforma não envia status por conta própria.
- Cada Tratativa tem uma Criticidade (`Baixa`, `Média`, `Alta`, `Crítica`) informada na abertura.
- O prazo respeita dias corridos desde a criação (forma de obtenção sujeita à hipótese acima).
- Aplicativos de outra área usam a mesma abertura sem mudança estrutural.

## Questões abertas
Respondidas na spec `docs/specs/abertura-por-apps-de-origem/spec.md` (humano:2026-10-07), sem reabrir:
- Prazo: tabela global (3/7/15/30), alterada só pelo Administrador, valendo para novas Tratativas. A Criticidade é informada na abertura e pode ser alterada depois, com recálculo desde a criação original e histórico (a operação exposta a usuários e quem a usa ficam no 003).
- Dados básicos: obrigatórios Título e Criticidade (mais Origem e ID_Origem para apps); Descrição, Unidade, Área e Solicitante opcionais; falta de obrigatório recusa a abertura.
- Origem texto gravado como veio; a unicidade é do par (Origem, ID_Origem) sem diferenciar caixa nem espaços nas pontas; "Advertencia" e "Advertência" seguem distintas (lista de valores seria cadastro, adiado).
- Autenticação por credencial própria por app; a consulta devolve Código, Origem, ID_Origem, Criticidade, Status, Data de criação e Data prevista, e quem informa Código ou par corretos consulta.
- Avulsa: qualquer usuário autenticado.
- Código da Tratativa: UUID opaco gerado pela plataforma (humano:2026-10-07).
- Solicitante: identificado na abertura só pela matrícula/ID do colaborador, sem nome nem e-mail; o nome virá do SuccessFactors no 011 (humano:2026-10-07).

Ainda abertas:
- Templates (009) e alertas (010) eram "regras próprias de cada Origem" na proposta. Sem cadastro de Origens, valem para todas as Tratativas, ou variam pelo texto da Origem? ("Cada origem poderá possuir regras próprias" não foi respondido para além dos prazos.)
- Se o cadastro de Origens vier depois, a Tratativa existente com Origem texto será convertida? (evolução futura)
- Dados pessoais: o app pode enviar dados de pessoas (vítimas, advertidos). O que a plataforma guarda e por quanto tempo? A Advertência traz dados sensíveis de RH (LGPD).
