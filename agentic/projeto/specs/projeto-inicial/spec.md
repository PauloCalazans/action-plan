# Spec: projeto-inicial

**Intent:** agentic/projeto/intent/001-projeto-inicial.md
**Status:** aprovado

## Contexto (não são regras)
- Sem sponsor designado (humano:2026-10-06).
- Para o usuário final (SESMT, gestores, responsáveis, aprovadores) esta entrega não tem funcionalidade visível (humano:2026-10-06, questionário respondido).
- Números e descrição do processo atual do SESMT ficam para o intent 002 (humano:2026-10-06, questionário respondido). Por isso o intent não depende mais de nenhuma seção da proposta, que foi removida do repositório (commit a2c588f) com as citações retiradas de `AGENTS.md` e `agentic/processo/papeis/dominio.md` por decisão do humano em 2026-10-06.
- Dados pessoais (LGPD) e integração de pessoas via SuccessFactors não estão envolvidos nesta entrega (humano:2026-10-06, questionário respondido); o gatilho de LGPD de `AGENTS.md:66` passa a valer quando houver entidades.
- Vocabulário: o contrato do papel `dominio` proíbe nomear stack. Esta spec referencia `AGENTS.md` e `agentic/projeto/decisoes.md` por linha; nomes de pacotes aparecem apenas onde são necessários: em R15 (por determinação expressa do humano, 2026-10-06, de enumerar a lista fechada de dependências N3) e em R19 (exemplos de padrões de módulo da fronteira de integrações).
- `agentic/projeto/bootstrap.md` permanece como registro histórico, sem alteração.

## Regras
| # | Regra | Fonte | Estado |
|---|---|---|---|
| R1 | O repositório passa a conter um projeto inicial executável, base para as funcionalidades da Origem SESMT serem construídas pelo ciclo normal. | humano:2026-10-06 (intent:12-13) | confirmada |
| R2 | A stack do projeto é a fixada em `AGENTS.md:11` e detalhada em `agentic/projeto/decisoes.md:8` (D1). Isso não restringe o conjunto de dependências além do que R15 já fixa como lista fechada. | humano:2026-10-06; oráculo:AGENTS.md:11; decisão:D1 | confirmada |
| R3 | O identificador base (pacote/namespace) do projeto é `br.com.calazanstec`. | humano:2026-10-06 (intent:44) | confirmada |
| R4 | O escopo estrutural desta entrega cobre os diretórios de modelo (`db/`), de serviços (`srv/`) e de testes (`test/`), conforme `AGENTS.md:43-52`. Não cria `app/`, `mta.yaml` nem `xs-security.json`. | humano:2026-10-06 (intent:38); oráculo:AGENTS.md:43-52 | confirmada |
| R5 | Esta entrega não contém nenhuma entidade de negócio (Origem, Tipo, Tratativa, Ação, Evidência, Comentário, Histórico, Responsável); o modelo Origem → Tipo → Tratativa é o intent 002. | humano:2026-10-06 (intent:38) | confirmada |
| R6 | Nada específico do SESMT é fixado na base; a variação por Origem virá de parametrização. | oráculo:AGENTS.md:36 | confirmada |
| R7 | Existe ao menos um teste de fumaça que roda contra o banco em memória previsto em `AGENTS.md:38`, sem depender de HANA Cloud, SuccessFactors, e-mail ou Teams reais. | humano:2026-10-06 (intent:31); oráculo:AGENTS.md:38 | confirmada |
| R8 | Os comandos de instalar, build, lint, testes, arquitetura e verificação completa listados em `AGENTS.md:23-28` existem e terminam com sucesso em clone limpo. | humano:2026-10-06 (intent:28-29); oráculo:AGENTS.md:23-28 | confirmada |
| R9 | As três fronteiras de `AGENTS.md:54` (`app/` não importa `srv/`; `db/` não depende de `srv/` nem `app/`; integrações externas só em `srv/integracoes/`) estão todas expressas na configuração do comando de arquitetura, mesmo sem código nos diretórios ainda ausentes. | oráculo:AGENTS.md:54; decisão:D2 | confirmada |
| R10 | Nenhuma credencial nem arquivo de ambiente local é versionado (lista em `AGENTS.md:39`). | humano:2026-10-06 (intent:32); oráculo:AGENTS.md:39 | confirmada |
| R11 | Arquivos de deploy e de segurança (`mta.yaml`, `xs-security.json`) ficam fora desta entrega e viram intent próprio de deploy. | humano:2026-10-06 (intent:39) | confirmada |
| R12 | O scaffold cria do zero as ferramentas dos comandos de build, lint, testes e arquitetura, exatamente as definidas em `agentic/projeto/decisoes.md:8` (D1) e `agentic/projeto/decisoes.md:15` (D2), incluindo a configuração de arquitetura e o relatório de testes ali descritos. Não há ferramenta a decidir. | humano:2026-10-06 (questionário respondido); decisão:D1; decisão:D2 | confirmada |
| R13 | O scaffold segue a trilha rápida (`chore`), como exceção à trilha padrão aceita pelo humano, conforme D1 (`agentic/projeto/decisoes.md:10`) e `agentic/projeto/bootstrap.md:39`. A verificação nessa trilha é: `verify.sh` verde e o checklist de PR de R16, conferido pelo humano no Gate 2, sem `revisor` em modo diff. | humano:2026-10-06 (questionário respondido); decisão:D1 | confirmada |
| R14 | Toda dependência nova e toda configuração `cds.requires` é gatilho N3 (`agentic/processo/ciclo.md:49`; `AGENTS.md:65`). Na trilha rápida não há Gate 1 por design; a aprovação vem da lista fechada de R15, e qualquer item fora dela exige parada e aprovação humana antes de entrar. | oráculo:agentic/processo/ciclo.md:49; oráculo:AGENTS.md:65; humano:2026-10-06 | confirmada |
| R15 | Lista fechada de dependências aprovadas, derivada do que D1 e D2 exigem: `@sap/cds` (runtime; versão-alvo: a estável atual no momento da execução, fixada pelo lockfile), `@sap/cds-dk` (linha de comando para `cds build`), `@cap-js/sqlite` (banco em memória), `@cap-js/cds-test`, `@cap-js/cds-types`, `@cap-js/cds-typer` (gerador de tipos), `typescript`, `jest`, `ts-jest`, `@types/node`, `@types/jest`, `eslint`, `@eslint/js`, `typescript-eslint` (inclui o parser TypeScript), `globals`, `@sap/eslint-plugin-cds`, `jest-junit` e `dependency-cruiser`. Conteúdo de `cds.requires` no manifesto do projeto: **vazio** (nenhuma chave definida pelo scaffold), pois bindings, destinations e segurança pertencem ao deploy (R11). Itens fora desta lista são N3 novos (R14). | humano:2026-10-06 (determinou a lista fechada); humano:2026-10-07 (confirmou `@sap/cds-dk` e `cds.requires` vazio); decisão:D1; decisão:D2 | confirmada |
| R16 | Checklist de PR (verificação humana no Gate 2): o PR traz a lista dos critérios que `verify.sh` não cobre, CA1, CA4, CA6, CA6b e CA7 a CA13, com a evidência de cada um, e o humano os confere. `verify.sh` cobre CA2, CA3 e a execução do CA5; a existência do teste de fumaça do CA5 também entra no checklist. | humano:2026-10-06 | confirmada |
| R17 | O arquivo de travamento de dependências (lockfile) é versionado (necessário para `npm ci`); `reports/junit/` e `@cds-models/` (`AGENTS.md:51`) ficam no `.gitignore`; o baseline `.dependency-cruiser-known-violations.json` não é criado (`agentic/projeto/decisoes.md:17`). | oráculo:AGENTS.md:23,51; decisão:D1; decisão:D2 | confirmada |
| R18 | Mecanismo de aprovação: intent e spec passam de `draft` a `aprovado` por um commit `docs(spec): projeto-inicial aprovada` na branch do scaffold, com aprovação explícita do humano, registrado como Ruling em `progress.md`. Até lá, ambos permanecem `draft`. | humano:2026-10-06 | confirmada |
| R19 | Critério do que conta como SDK/client externo para a fronteira de `srv/integracoes/`: por finalidade, todo pacote de terceiros cujo propósito é comunicar com SuccessFactors, e-mail ou Teams (`agentic/projeto/decisoes.md:15`). Como vira configuração: a regra da terceira fronteira no dependency-cruiser usa uma lista de padrões de módulo, mantida a cada pacote novo que se enquadre no critério. A lista inicial, não vazia, cobre as três finalidades (ex.: `@sap-cloud-sdk`, `nodemailer`, `@microsoft/microsoft-graph-client`) e proíbe importar esses módulos fora de `srv/integracoes/`. Os pacotes de R15 não se enquadram no critério; a lista é exercida quando um pacote assim for adicionado. | humano:2026-10-07 (questionário respondido); decisão:D2 | confirmada |

## Critérios de aceite
- CA1 (R8): Dado um clone limpo do repositório, quando se executa o comando de instalação, então termina com sucesso.
- CA2 (R8): Dado o projeto instalado, quando se executam os comandos de build, lint, testes e arquitetura de `AGENTS.md`, então cada um termina com sucesso.
- CA3 (R8): Dado o projeto instalado, quando se executa `sh agentic/mecanismos/scripts/verify.sh`, então termina com sucesso.
- CA4 (R4, R5): Dado o projeto pronto, quando se inspeciona a estrutura, então existem `db/`, `srv/` e `test/` conforme `AGENTS.md:43-52`, não existem `app/`, `mta.yaml` nem `xs-security.json`, e nenhuma entidade de negócio está definida em `db/`.
- CA5 (R7): Dado o projeto pronto, quando se executa o comando de testes, então ao menos um teste de fumaça roda contra o banco em memória e passa, sem acesso a serviços externos.
- CA6 (R9, R19): Dado o projeto pronto, quando se lê a configuração do comando de arquitetura, então as três fronteiras de `AGENTS.md:54` estão presentes como regras, e a terceira contém uma lista de padrões de módulo não vazia que cobre SuccessFactors, e-mail e Teams (R19).
- CA6b (R9, R19): Dado cada uma das três fronteiras, quando se cria temporariamente uma violação proposital e se executa o comando de arquitetura, então ele falha apontando a violação; ao remover a violação, volta a passar. Violações: arquivo em `db/` importando de `srv/`; arquivo em `app/` importando de `srv/`; arquivo em `srv/` fora de `srv/integracoes/` importando um módulo cujo nome casa com um padrão da lista de R19. Para as violações que usam `app/`, o diretório pode ser criado só para o teste e removido depois.
- CA7 (R10): Dado o repositório após a entrega, quando se listam os arquivos versionados, então nenhum arquivo de credencial ou ambiente local (service keys, `default-env.json`, `.cdsrc-private.json`, `.env`, tokens de destination) está presente.
- CA8 (R11): Dado o repositório após a entrega, quando se listam os arquivos versionados, então `mta.yaml` e `xs-security.json` não existem.
- CA9 (R3): Dado o projeto pronto, quando se consulta a identificação base do projeto, então ela usa `br.com.calazanstec`.
- CA10 (R6): Dado o conteúdo de `db/` e `srv/`, quando se busca pelos nomes das origens de `AGENTS.md:8` (Acidente, Quase Acidente, Condição Insegura, Ato Inseguro, Inspeção, Auditoria de Segurança), então nenhum aparece.
- CA11 (R14, R15): Dado o projeto pronto, quando se comparam as dependências declaradas e o `cds.requires` com R15, então todas as dependências estão na lista fechada e `cds.requires` está vazio.
- CA12 (R2, R12): Dado o projeto pronto, quando se comparam os scripts e ferramentas com `AGENTS.md:11` e `agentic/projeto/decisoes.md:8,15`, então os scripts de build, lint, testes e arquitetura têm o conteúdo de D1 e D2, sem ferramenta de verificação fora deles.
- CA13 (R17): Dado o repositório após a entrega, então o lockfile está versionado, `reports/junit/` e `@cds-models/` estão no `.gitignore` e `.dependency-cruiser-known-violations.json` não existe.

## Invariantes (o que não muda)
- Os papéis, o ciclo e os scripts em `agentic/processo/` e `agentic/mecanismos/scripts/` permanecem como estão.
- Todas as regras invioláveis de `AGENTS.md` (`AGENTS.md:32-40`) valem para esta entrega.
- Nenhum SuccessFactors, e-mail, Teams ou Power BI/SAC é tocado.

## Fora de escopo
- Modelo de domínio (Origem, Tipo, Tratativa, Ação, Evidência) — intent 002.
- Regras de Criticidade e prazo, alertas, templates de Ações, dashboards.
- Integrações com SuccessFactors, e-mail, Teams, Power BI/SAC.
- Diretório `app/` e qualquer aplicação de interface; SAP Build Apps; Business Rules; Work Zone.
- Deploy e segurança de plataforma (`mta.yaml`, `xs-security.json`) — intent de deploy futuro.
- Dados de parametrização (`db/data/`) com conteúdo de Origem.
- Estado atual do acompanhamento de ocorrências do SESMT — intent 002.

## Questionário de decisão
Perguntas 1 a 6 respondidas pelo humano em 2026-10-06, junto com as decisões de verificação e de lista de dependências (R13, R15, R16). Perguntas 7 e 8 respondidas em 2026-10-07. Nenhuma hipótese restante.
1. Ferramentas de lint, testes e arquitetura: criar tudo do zero (R12).
2. Funcionalidade visível ao usuário final: nenhuma (Contexto).
3. Contexto atual do SESMT: fica para o intent 002 (Contexto).
4. LGPD e SuccessFactors: não envolvidos (Contexto).
5. Trilha da entrega: trilha rápida mantida como exceção (R13). A recomendação original do analista era a trilha padrão; o humano decidiu diferente.
6. Proposta original: referências removidas de `AGENTS.md` e `dominio.md` (Contexto).
7. Critério de SDK externo (R19): resposta (a), por finalidade (comunicar com SuccessFactors, e-mail ou Teams).
8. Conteúdo de `cds.requires` e `@sap/cds-dk` (R15): `cds.requires` vazio e `@sap/cds-dk` incluído na lista.

## Questões em aberto
- Nenhuma.

## Divergências
- **Trilha (resolvida):** `agentic/projeto/decisoes.md:10` (D1) e `agentic/projeto/bootstrap.md:39` dizem que o scaffold é "trilha rápida" (`chore`), enquanto `agentic/processo/ciclo.md:8,49` classifica dependência nova como N3, o que apontaria para a trilha padrão. O humano aceitou a exceção em 2026-10-06 (R13). Consequências: (i) sem design nem Gate 1 próprios, a aprovação das dependências vem da lista fechada de R15 (R14); (ii) a trilha rápida não tem roteiro próprio em `agentic/processo/ciclo.md:9` (apenas "branch → verify → PR → Gate 2"), e por isso o roteiro desta entrega é R13, R16 e R18; (iii) `/mudanca` não serve, pois o `arquiteto` recusa gatilho N3 (`.claude/commands/mudanca.md:6`), logo a branch, o worktree e o PR são feitos pelo orquestrador sem esse comando; (iv) como não há `revisor` em modo diff, a conferência dos critérios do checklist de R16 (CA1, CA4, CA6, CA6b, CA7 a CA13) fica com o humano no Gate 2.
- **Proposta (resolvida):** a proposta foi removida do working tree no commit a2c588f e as citações foram removidas por decisão do humano em 2026-10-06. A spec não depende do conteúdo da proposta.
