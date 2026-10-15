# Spec: ver-anexo-evidencia

**Intent:** agentic/projeto/intent/018-ver-anexo-evidencia.md
**Status:** aprovado

Escopo: na tabela de Evidências da tela de Tratativas, permitir ao usuário abrir ou baixar o arquivo de cada Evidência listada. O nome do arquivo passa a ser um link: abre no navegador quando o tipo é exibível (imagem, PDF, texto) e, senão, baixa com o nome original. As regras de acesso, de autorização, de recusa e de auditoria são as do download já existente (spec `evidencias`, R11 e R12); esta spec apenas cria um caminho da tela até elas. Como o acesso é entregue tecnicamente é decisão do arquiteto. Não altera Anexar, Remover, a lista de Evidências, o download existente, Minhas Pendências nem Administração.

Papéis: `Gestor de Tratativa` (003), `Responsável da Ação` (005), `Validador Técnico` habilitado (016), `Responsável Principal` e `Participante` da Tratativa (005), `Usuário da plataforma` (qualquer autenticado) e `Aplicativo de origem` (002; acesso negado).

Delegação: o humano pediu a entrega e escolheu a trilha em 2026-10-14; o Gate 1 está delegado ao orquestrador, que decidiu as regras abaixo na mesma data. Não há regra como hipótese.

Coerência com as specs aprovadas: reutiliza, sem alterar, `evidencias` (R1, R2, R3, R10, R11, R12, R14), `metodologias-e-aval-tecnico` (016: R7 d e R20 f, Validador Técnico), `acoes-nas-entidades` (017: R20 e download fora do escopo), o Ruling R-09 do humano no progress.md do 017 (N3-6: a lista mostra só Evidências ativas, projeção `TratativaAppService.Evidencias where ativo = true`) e a regra de LGPD de AGENTS.md:66. As marcas [LGPD] e [N3] identificam privacidade e governança de autorização, contrato de serviço, segurança ou testes.

## Regras
| # | Regra | Fonte | Estado |
|---|---|---|---|
| R1 | Link na tabela de Evidências. Na tabela de Evidências da tela da Tratativa, o nome do arquivo de cada Evidência listada é um link que dá acesso ao arquivo daquela Evidência. A lista continua com as mesmas Evidências de hoje (somente ativas). | humano:2026-10-14 ("aparentemente não há como ver um anexo nas evidências?"; decisão 1); oráculo:agentic/.estado/execucao/2026-10-14-acoes-nas-entidades/progress.md:16 (Ruling R-09, N3-6); oráculo:srv/tratativa-app-service.cds:260 | confirmada |
| R2 | Abrir ou baixar conforme o tipo. Quando o tipo gravado é exibível pelo navegador (imagem JPG ou PNG, PDF, texto TXT), o arquivo abre no navegador; para os demais tipos aceitos (DOCX, DOC, XLSX, XLS, CSV) o arquivo é baixado. Em ambos os casos o tipo e o nome entregues são exatamente os gravados na Evidência (Tipo do arquivo e Nome do arquivo), sem conversão. Na dúvida sobre a exibição, o comportamento conservador é baixar. | humano:2026-10-14 (decisão 1); orquestrador:Gate 1 delegado (CSV e formatos de escritório são baixados) | confirmada |
| R3 | Somente Evidência ativa [LGPD]. Evidência removida (remoção lógica, evidencias R10) ou inexistente não é entregue: resposta 404 `Evidência não encontrada.`, antes de qualquer verificação de autorização dinâmica, como na precedência da operação de download existente. | humano:2026-10-14 (decisão 2); oráculo:agentic/projeto/specs/evidencias/spec.md (R11, R14) | confirmada |
| R4 | Autorização idêntica à do download existente [LGPD] [N3: autorização]. Só recebe o arquivo o `Gestor de Tratativa`, o `Responsável da Ação` a que a Evidência pertence ou o `Validador Técnico` habilitado, nas mesmas condições da spec `evidencias` R11. "Ação" inclui Subação, e a segregação entre Ação mãe e Subação se mantém para abrir: o Responsável da Ação mãe não acessa o anexo da Subação, e o Responsável da Subação não acessa o da Ação mãe (evidencias R11 d, CA44). Qualquer outro usuário autenticado (Responsável de outra Ação, Responsável Principal, Participante, usuário comum) recebe 403; o Aplicativo de origem recebe 403 e o não autenticado, 401. Esta spec não amplia nem reduz quem pode baixar. | humano:2026-10-14 (decisão 2); orquestrador:Gate 1 delegado (reuso literal da regra existente); oráculo:agentic/projeto/specs/evidencias/spec.md (R11); oráculo:agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md (R7 d, R20 f) | confirmada |
| R5 | Link em toda linha visível [LGPD]. Na tabela de Evidências, quem vê a linha já pode abrir o arquivo: pela máscara de visibilidade vigente (evidencias R11 a e b), quem não é Gestor só vê Evidências das Ações em que é Responsável, e o Gestor e o Validador Técnico veem todas. Portanto o link aparece em toda linha visível, e não existe "link em linha alheia" na tela. A recusa 403 (R4) vale para acesso direto à Evidência fora do vínculo do usuário (por endereço ou chamada direta), e a aparência do link nunca substitui a recusa do servidor. Esta spec não altera quem vê cada linha nem expõe matrícula. | orquestrador:Gate 1 delegado (consequência da máscara vigente, apontada na revisão da spec, rodada 1); oráculo:agentic/projeto/specs/evidencias/spec.md (R11); oráculo:srv/tratativa/mascara-app.ts:156-174 | confirmada |
| R6 | Auditoria antes da entrega [LGPD] [N3: segurança]. Todo acesso ao arquivo grava, antes de entregar o conteúdo, o evento `DownloadEvidencia` no histórico da Ação, com o mesmo conteúdo do download existente (sem Nome do arquivo e sem conteúdo no histórico, evidencias R12). Se a gravação da auditoria falhar, nada é entregue e o pedido falha. Não há acesso silencioso ao arquivo. | humano:2026-10-14 (decisão 2); oráculo:agentic/projeto/specs/evidencias/spec.md (R12) | confirmada |
| R7 | Conteúdo fora de listagens [LGPD]. O conteúdo do arquivo nunca aparece na lista de Evidências, em consultas expandidas nem em qualquer outra listagem; é entregue somente por acesso explícito a uma Evidência (R1), sujeito a R3, R4 e R6. Nenhuma matrícula nova (do autor do anexo ou do Responsável) é exposta a quem não é Gestor. | humano:2026-10-14 (decisão 5); oráculo:AGENTS.md:66; oráculo:agentic/projeto/specs/acoes-nas-entidades/spec.md (R20) | confirmada |
| R8 | Recusas com mensagem. O acesso novo recusado responde 403 com a mensagem em Português do Brasil `Acesso negado.` (padrão D10 dos serviços de usuário e da máscara do aplicativo) e 404 `Evidência não encontrada.`, mostradas ao usuário sem reescrita, e nenhum conteúdo parcial do arquivo é mostrado. O download existente do serviço da Tratativa permanece intocado, inclusive com a mensagem `Forbidden` que já tem (fora do escopo, R10). | orquestrador:Gate 1 delegado (M3 da revisão da spec, rodada 1); decisão:D10; oráculo:agentic/projeto/specs/acoes-nas-entidades/spec.md (R14) | confirmada |
| R9 | Qualquer status. Abrir ou baixar o arquivo é permitido em qualquer status: Tratativa `Aberta`, `Em andamento`, `Encerrada` ou `Cancelada` e Ação `Pendente`, `Em andamento`, `Concluída` ou `Cancelada`, como no download existente. Esta spec não cria exigência nem recusa por status. | oráculo:agentic/projeto/specs/evidencias/spec.md (R14 etapas 7 e 8; CA48); orquestrador:Gate 1 delegado | confirmada |
| R10 | Nada mais muda. Anexar Evidência, Remover Evidência, a lista de Evidências (somente ativas), o download existente do serviço da Tratativa, Minhas Pendências e Administração permanecem como estão. As regras de formato, tamanho e quantidade de Evidências não mudam. | humano:2026-10-14 (decisões 3 e 4) | confirmada |
| R11 | Generalidade. O comportamento vale igual para Tratativas de qualquer Origem e para as avulsas, sem rótulo ou regra exclusiva de uma área, com terminologia corporativa neutra em Português do Brasil. | oráculo:AGENTS.md:36; oráculo:agentic/projeto/specs/acabamento-ui-fiori/spec.md (R2, R9) | confirmada |
| R12 | Verificação sem navegador na esteira [N3: testes]. A conformidade é verificada pela esteira automatizada sem navegador real nem rede externa, complementada por verificação visual no navegador local. Cada critério indica a modalidade. Os testes existentes da spec 006 não são alterados; os novos são acrescentados. | humano:2026-10-14 (decisão 6); oráculo:AGENTS.md:38 | confirmada |

## Critérios de aceite
Modalidades: [automatizado] verificável pela esteira sem navegador; [visual] verificável no navegador local.

- CA1 (R1, R2) [visual]: dado o Gestor com a seção Evidências de uma Tratativa do dado de demonstração, quando observa a tabela, então o nome do arquivo de cada Evidência aparece como link.
- CA2 (R2) [automatizado e visual]: dado o Gestor e uma Evidência PNG do dado de demonstração (`test/demo/arquivos`), quando aciona o link, então recebe o mesmo conteúdo gravado, com Tipo `image/png`, e o navegador exibe a imagem.
- CA3 (R2) [automatizado e visual]: dado o Gestor e uma Evidência PDF do dado de demonstração, quando aciona o link, então recebe o conteúdo gravado com Tipo `application/pdf` e o navegador o exibe.
- CA4 (R2) [automatizado e visual]: dado o Gestor e uma Evidência TXT do dado de demonstração, quando aciona o link, então recebe o conteúdo gravado com o Tipo gravado e o navegador o exibe como texto.
- CA5 (R2) [automatizado]: dado uma Evidência de tipo não exibível (por exemplo CSV do dado de demonstração), quando o Gestor aciona o link, então o arquivo é entregue para download com o Nome do arquivo original e o Tipo gravado.
- CA6 (R4) [automatizado]: dado o Responsável da Ação a que a Evidência pertence, quando aciona o link, então recebe o arquivo; dado um `Validador Técnico` habilitado, nas mesmas condições da spec `evidencias` R11, então recebe o arquivo; dado o Responsável da Ação mãe tentando abrir o anexo de uma Subação (e o Responsável da Subação o da Ação mãe), então a resposta é 403 (segregação de evidencias R11 d, CA44).
- CA7 (R4) [automatizado]: dado o usuário `usuario` sem vínculo com a Ação, numa Ação de uma Tratativa de M1001, quando aciona o acesso ao arquivo, então a resposta é 403 e nenhum conteúdo é entregue; o mesmo vale para Responsável de outra Ação, Responsável Principal e Participante sem papel de Gestor ou de Responsável da Ação.
- CA8 (R4) [automatizado]: dado o Aplicativo de origem, então a resposta é 403; dado um usuário não autenticado, então a resposta é 401.
- CA9 (R3) [automatizado]: dado uma Evidência removida (inativa) e dado uma Evidência inexistente, quando o Gestor aciona o acesso, então a resposta é 404 `Evidência não encontrada.` e nada é entregue; dado um usuário sem vínculo e uma Evidência removida, então a resposta é 404 (existência precede a autorização dinâmica).
- CA10 (R6) [automatizado]: dado um acesso aceito, quando o histórico da Ação é consultado, então contém um novo evento `DownloadEvidencia`, sem Nome do arquivo nem conteúdo, gravado antes da entrega; dado um acesso recusado (403 ou 404), então nenhum evento `DownloadEvidencia` é gravado.
- CA11 (R6) [automatizado]: dado uma falha simulada na gravação do evento `DownloadEvidencia`, quando o Gestor aciona o acesso, então nada do conteúdo é entregue, o pedido falha e nenhum evento parcial permanece.
- CA12 (R7) [automatizado]: dado a lista de Evidências da Tratativa e uma consulta expandida das Evidências da Ação, então o conteúdo do arquivo não consta em nenhuma resposta; e dado um usuário sem papel de Gestor, então a matrícula do autor do anexo e a do Responsável continuam não aparecendo.
- CA13 (R5) [visual e automatizado]: dado o Responsável da Ação A1 (sem papel de Gestor) na tabela de Evidências, então vê somente linhas de A1 e cada uma tem o link; dado o Gestor e o Validador Técnico, então veem todas as linhas ativas, cada uma com o link; dado um usuário sem vínculo, então a tabela vem vazia. Dado o Responsável de A1 acessando diretamente a Evidência de A2 (por endereço ou chamada direta), então a resposta é 403 `Acesso negado.` (CA7).
- CA14 (R8) [automatizado e visual]: dado o acesso novo recusado, então a resposta é 403 `Acesso negado.` ou 404 `Evidência não encontrada.`, a tela mostra essa mensagem em Português do Brasil e não exibe conteúdo parcial; e o download existente do serviço da Tratativa segue respondendo como hoje (inalterado).
- CA15 (R9) [automatizado]: dado Tratativa `Encerrada` ou `Cancelada` e Ação `Concluída` ou `Cancelada`, quando o Gestor (ou quem tem vínculo) aciona o acesso ao arquivo, então tem sucesso e entrega o conteúdo, com auditoria `DownloadEvidencia`; não existe status em que o acesso seja recusado por status.
- CA16 (R10) [automatizado]: dado a suíte existente da spec 006 (anexar, remover, lista, download), então passa sem alteração de resultado esperado; e dado a lista de Evidências, então continua somente com as ativas.
- CA17 (R10) [automatizado]: dado Minhas Pendências e Administração, então não oferecem acesso a anexos e permanecem sem alteração.
- CA18 (R11) [automatizado]: dado uma Tratativa de Origem "Registro de Acidente" e uma avulsa, então o acesso ao arquivo funciona de forma idêntica.
- CA19 (R12) [automatizado]: dado a execução completa da esteira de verificação, então conclui com sucesso sem abrir navegador real nem usar rede externa.

## Invariantes (o que não muda)
- Quem pode baixar um anexo é exatamente quem já podia (Gestor de Tratativa, Responsável da Ação, Validador Técnico habilitado).
- Todo acesso ao arquivo é auditado antes da entrega; nunca é silencioso, e falha de auditoria impede a entrega.
- O histórico não guarda o Nome do arquivo nem o conteúdo.
- O conteúdo do arquivo não aparece em listagens; a matrícula do autor do anexo e a do Responsável continuam visíveis somente ao Gestor.
- Evidências removidas continuam com remoção lógica e não são entregues.
- Formatos, tamanho máximo (10 MB) e limite de 10 Evidências ativas por Ação não mudam.
- O serviço de regras de negócio da Tratativa e o download existente não mudam.

## Fora de escopo
- Alterar Anexar ou Remover Evidência, a lista de Evidências (somente ativas) ou o download existente do serviço da Tratativa.
- Minhas Pendências e Administração.
- Pré-visualização embutida em tela própria, download em lote, miniaturas.
- Novos papéis, novas permissões, novos formatos, limites ou eventos de histórico.
- Deploy real, telas de login.

## Questionário de decisão
Nenhuma regra é hipótese; não há pergunta a decidir.

## Questões em aberto
- Nenhuma.

## Divergências
- Intent 017 × esta spec: a spec `acoes-nas-entidades` lista "download de Evidência pela interface" como fora de escopo; este intent o inclui por pedido do humano em 2026-10-14. Não há conflito de regras: a 017 permanece como está.
- Oferta do link (R5): resolvida pela revisão da rodada 1. A máscara vigente só mostra a linha a quem já pode baixar, então o link aparece em toda linha visível e não há alternativa "oferta seletiva × recusa"; a recusa 403 vale só para acesso direto fora do vínculo.
- Mensagem de recusa (R8): o caminho novo responde `Acesso negado.` (padrão D10); o download existente continua com `Forbidden`, sem alteração. A diferença é intencional e fica fora do escopo.
- Tipos exibíveis (R2): o conjunto exibível adotado é imagem (JPG, PNG), PDF e TXT; CSV e formatos de escritório são baixados. Decisão conservadora do orquestrador (Gate 1 delegado).

## Alterações de comportamento entregues por este intent
- O nome do arquivo na tabela de Evidências da Tratativa passa a ser um link que abre ou baixa o anexo, para quem já podia baixá-lo, com auditoria `DownloadEvidencia` prévia.
