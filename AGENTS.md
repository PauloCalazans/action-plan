# AGENTS.md

Guia para qualquer agente de IA trabalhando neste repositório. Mapa e regras — o estado do projeto é derivado (`sh scripts/agentic/status-projeto.sh`), nunca escrito aqui.

## Visão geral
Plataforma corporativa de **tratativas e planos de ação** no SAP BTP. A entidade central é a **Origem da Tratativa** (o processo/evento que gerou a necessidade de ação), não o plano de ação: `Origem → Tipo → Tratativa → Ações (hierárquicas) + Evidências + Comentários + Histórico + Responsáveis`. Regras por origem (prazos por criticidade, templates de ações, alertas) vêm de parametrização.

- **MVP:** origens do SESMT — Acidente, Quase Acidente, Condição Insegura, Ato Inseguro, Inspeção, Auditoria de Segurança. A modelagem é genérica para receber outras áreas (Qualidade, RH, Compliance, CSC, Sustentabilidade) sem mudança estrutural.
- **Usuários:** SESMT, gestores, responsáveis por ações e aprovadores.
- **Integrações:** SAP SuccessFactors (somente leitura: estrutura organizacional, colaboradores, gestores); notificações por e-mail e Microsoft Teams; consumo analítico por Power BI / SAC.
- **Stack:** SAP CAP (Node.js + TypeScript), HANA Cloud, Fiori elements/UI5 em `app/`, SAP Build Work Zone como launchpad. SAP Build Apps fica fora deste repositório.
- Proposta original: `Proposta Plano de Ação SESMT SSA.md`.

## Processo
Todo trabalho segue `docs/agentic/ciclo.md`. Princípios em `docs/agentic/principios.md`. Papéis em `docs/agentic/papeis/`.

## Integração
- Plataforma de PR: GitHub (`gh pr create` / `gh pr view`; sem CI por enquanto — `docs/decisoes.md` D3)
- Sem plataforma de PR (`nenhuma`), o Gate 2 é local: a branch fica rebaseada na principal e o humano integra com `git merge --ff-only <branch>` (veja `docs/agentic/ciclo.md`).

## Comandos
| Ação | Comando |
|---|---|
| Instalar dependências | `npm ci` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Testes | `npm test` |
| Arquitetura | `npm run arch` |
| **Verificação completa** | `sh scripts/agentic/verify.sh` |

No Windows, rode os comandos `sh ...` no Git Bash (o PowerShell não tem `sh`); dentro do Claude Code isso já é tratado.

## Regras invioláveis
- Nunca faça merge na branch principal nem altere permissões do agente.
- Nunca afirme sucesso sem ter visto a saída do `verify.sh`.
- Nunca desabilite ou altere testes de um commit `test(red):`.
- Nada específico de uma área (ex.: SESMT) é codificado no modelo ou nos serviços: variação por origem vem de dados de parametrização (Origem, Tipo, prazos, templates, regras de alerta).
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
- Intents: `intent/`
- Specs, designs e tasks: `docs/specs/<nome>/`
- Decisões: `docs/decisoes.md`
- Respostas do bootstrap: `docs/bootstrap.md`

## Gatilhos de escalonamento (N3)
Além dos gatilhos genéricos de `docs/agentic/ciclo.md`:
- Alteração em `db/**/*.cds` que mude entidade já implantada no HANA Cloud (remover/renomear elemento, mudar tipo ou chave) — exige plano de migração HDI.
- Deploy/infra: `mta.yaml`, `xs-security.json`, bindings de serviço, destinations, `cds.requires` no `package.json`.
- Dados pessoais e sensíveis (LGPD): dados de colaboradores, vítimas de acidente, saúde ocupacional, anexos de evidência; anotações `@PersonalData`, retenção, log de acesso.

## Oráculos
- Nenhum.
