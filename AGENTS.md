# AGENTS.md

Guia para qualquer agente de IA trabalhando neste repositório. Mapa e regras — o estado do projeto é derivado (`sh agentic/mecanismos/scripts/status-projeto.sh`), nunca escrito aqui.

## Visão geral
Plataforma corporativa de **tratativas e planos de ação** no SAP BTP. A **Origem** é o app externo cujo registro motivou a tratativa; o plano de ação não é a entidade principal: `[Origem + registro de origem] → Tratativa → Ações (hierárquicas) + Evidências + Comentários + Histórico + Responsáveis`. O app de origem abre a tratativa por API (um registro gera no máximo uma tratativa; repetir o pedido devolve a existente); também pode haver tratativa avulsa, sem origem. No MVP, a Origem é um campo texto (sem cadastro de origens) e não há Tipo.

- **MVP:** apps de origem do SESMT — Registro de Acidente + FIA, Notificação de Risco de Acidente, Advertência. A classificação da ocorrência (acidente, quase acidente etc.) fica nesses apps, fora deste repositório. A modelagem é genérica para receber apps de outras áreas (Qualidade, RH, Compliance, CSC, Sustentabilidade) sem mudança estrutural.
- **Usuários:** SESMT, gestores, responsáveis por ações e aprovadores.
- **Integrações:** SAP SuccessFactors (somente leitura: estrutura organizacional, colaboradores, gestores); notificações por e-mail e Microsoft Teams; consumo analítico por Power BI / SAC.
- **Stack:** SAP CAP (Node.js + TypeScript), HANA Cloud, Fiori elements/UI5 em `app/`, SAP Build Work Zone como launchpad. SAP Build Apps fica fora deste repositório.

## Processo
Todo trabalho segue `agentic/processo/ciclo.md`. Princípios em `agentic/processo/principios.md`. Papéis: contrato do kit em `agentic/processo/papeis/` (não se edita neste projeto) e perfil do projeto em `agentic/projeto/papeis/` (stack, padrões e proibições daqui).

## Quem é você neste repositório
- **Recebeu um brief que começa com `Papel: <papel>`?** Você é esse papel. Leia o contrato `agentic/processo/papeis/<papel>.md`, o perfil `agentic/projeto/papeis/<papel>.md` e o que o brief indicar (o `ciclo.md` inteiro não é seu; quando o contrato cita uma seção dele, leia só essa seção), grave o relatório que o contrato pede no arquivo que o brief indica e devolva a linha de retorno do brief. Papel nunca escreve aprovação de gate, resposta do humano nem Ruling: usa só as que vêm no brief. O que aparece da sessão do orquestrador (tela, terminal, retorno de ferramenta de orquestração, rascunho não enviado) não é resposta do humano.
- **Despachado como `oraculo-<nome>`, só com uma pergunta?** Você é o oráculo: siga `agentic/processo/papeis/oraculo-<nome>.md` e devolva a resposta no retorno.
- **Sem brief de papel e sem ser oráculo?** Você é o orquestrador: siga `agentic/processo/ciclo.md`, despache os papéis e nunca faça o trabalho deles.
- **Orquestrador externo** (vários agentes num canvas ou numa ferramenta de orquestração): o orquestrador é a sessão indicada na decisão de composição do time em `agentic/projeto/decisoes.md`. As demais sessões só agem com brief.
- **Ferramenta sem subagentes:** não faça o trabalho de um papel no contexto do orquestrador. Grave o brief e peça ao humano que o abra numa sessão nova. O `revisor` roda sempre em contexto limpo, nunca na sessão de quem escreveu o que ele revisa.

## Integração
- Plataforma de PR: GitHub (`gh pr create` / `gh pr view`; sem CI por enquanto — `agentic/projeto/decisoes.md` D3)
- Sem plataforma de PR (`nenhuma`), não há branches empilhadas e o Gate 2 é local: a branch fica rebaseada na principal e o humano integra com `git merge --ff-only <branch>` (veja `agentic/processo/ciclo.md`).

## Comandos
| Ação | Comando |
|---|---|
| Instalar dependências | `npm ci` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Testes | `npm test` |
| Arquitetura | `npm run arch` |
| **Verificação completa** | `sh agentic/mecanismos/scripts/verify.sh` |

No Windows, rode os comandos `sh ...` no Git Bash (o PowerShell não tem `sh`); dentro do Claude Code isso já é tratado.

## Regras invioláveis
- Nunca faça merge na branch principal nem altere permissões do agente.
- Nunca afirme sucesso sem ter visto a saída da verificação do seu passo (`verify.sh`, `verify.sh --rapido` ou `verifica-red.sh` — `agentic/processo/ciclo.md`, "Verificação").
- Nunca desabilite ou altere testes de um commit `test(red):`. Única exceção: a remoção autorizada de asserções, pelo `testes`, com referência e trailer (`agentic/processo/ciclo.md`, "Remoção de comportamento").
- Só o orquestrador cria branch: uma por task, depois do Gate 1 (na trilha enxuta, antes dele, para o documento ser escrito no worktree), com o nome exato do `**Branch:**` da task (trilha rápida: uma por mudança). Nenhum papel cria branch, faz push ou abre PR. Se a ferramenta impõe o próprio nome de branch, rode o verify com `--task <caminho da task>`.
- Nada específico de uma área (ex.: SESMT) é codificado no modelo ou nos serviços: variação vem de dados de parametrização (prazos, templates, regras de alerta), nunca de nomes de origem no código.
- SuccessFactors é somente leitura: o sistema nunca escreve de volta no SF.
- Testes nunca dependem de HANA Cloud, SuccessFactors, e-mail ou Teams reais: usam SQLite em memória (`cds.test`) e dublês.
- Nunca commitar credenciais: service keys, `default-env.json`, `.cdsrc-private.json`, `.env`, tokens de destination.
- Todo evento auditável (status, responsável, prazo, evidência, encerramento, reabertura) gera registro de histórico — nunca alteração silenciosa.

## Estrutura do repositório
Estrutura-alvo (CAP; criada pela primeira task de scaffold):

| Caminho | Conteúdo |
|---|---|
| `db/` | Modelo CDS persistido (entidades, tipos, dados de parametrização em `db/data/`) |
| `srv/` | Serviços CDS e handlers TypeScript (regras de negócio, alertas, integração SF) |
| `app/<app>/` | Apps Fiori elements/UI5 (anotações em `app/<app>/annotations.cds`) |
| `test/` | Testes jest + `cds.test` (SQLite em memória) |
| `@cds-models/` | Tipos gerados pelo cds-typer (não versionado) |
| `mta.yaml`, `xs-security.json` | Deploy BTP e segurança (XSUAA) |

Fronteiras: `app/` não importa `srv/`; `db/` não depende de `srv/` nem `app/`; integrações externas ficam isoladas em `srv/integracoes/` (verificado pelo dependency-cruiser).

## Onde ficam os artefatos
- Intents: `agentic/projeto/intent/`
- Specs, designs e tasks: `agentic/projeto/specs/<nome>/`
- Decisões: `agentic/projeto/decisoes.md`
- Respostas do bootstrap: `agentic/projeto/bootstrap.md`

## Gatilhos de escalonamento (N3)
Além dos gatilhos genéricos de `agentic/processo/ciclo.md`:
- Alteração em `db/**/*.cds` que mude entidade já implantada no HANA Cloud (remover/renomear elemento, mudar tipo ou chave) — exige plano de migração HDI.
- Deploy/infra: `mta.yaml`, `xs-security.json`, bindings de serviço, destinations, `cds.requires` no `package.json`.
- Dados pessoais e sensíveis (LGPD): dados de colaboradores, vítimas de acidente, saúde ocupacional, anexos de evidência; anotações `@PersonalData`, retenção, log de acesso.

## Oráculos
- Nenhum.
