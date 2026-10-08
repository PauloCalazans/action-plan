# Intent: Projeto inicial da plataforma de tratativas

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-06
**Status:** aprovado
**Origem:** ideia

## Problema
O projeto é uma plataforma corporativa de Tratativas e Planos de Ação (`AGENTS.md`, Visão geral), mas o repositório ainda não tem nenhum projeto executável. Sem uma base inicial, nenhuma funcionalidade pode ser especificada, testada e entregue pelo ciclo agêntico (`agentic/processo/ciclo.md`). Detalhes e números do acompanhamento atual do SESMT ficam para o intent 002.

## Resultado proposto
Existe um projeto inicial que roda e passa na verificação completa (`sh agentic/mecanismos/scripts/verify.sh`), sobre o qual as primeiras funcionalidades da Origem SESMT (Acidente, Quase Acidente, Condição Insegura, Ato Inseguro, Inspeção, Auditoria de Segurança) podem ser construídas pelo ciclo normal. O projeto respeita a estrutura-alvo e as fronteiras definidas em `AGENTS.md`, e nada específico do SESMT fica fixo na base: a variação por Origem vem de parametrização.

## Usuários e sistemas afetados
- Equipe de engenharia e agentes do ciclo — passam a ter base para RED/GREEN, build, lint, testes e verificação de arquitetura.
- SESMT, gestores, responsáveis por Ações e aprovadores — usuários futuros; nesta entrega não há funcionalidade visível a eles (confirmado pelo humano, 2026-10-06).
- SAP SuccessFactors, e-mail, Teams, Power BI/SAC — fora desta entrega; integrações futuras.

## Restrições e não-escopo
- Restrição: stack já fixada em `AGENTS.md` (SAP CAP com Node.js e TypeScript, SQLite em memória nos testes, HANA Cloud no deploy, Fiori elements em `app/`).
- Restrição: nunca commitar credenciais; testes não dependem de HANA, SuccessFactors, e-mail ou Teams reais.
- Restrição: a entrega segue a trilha rápida (`chore`), como exceção à trilha padrão aceita pelo humano (2026-10-06, `agentic/projeto/decisoes.md` D1). Itens N3 (dependência nova, `cds.requires`) não passam por Gate 1: a aprovação vem da lista fechada de dependências da spec (R15), com `cds.requires` vazio, e qualquer item fora dela exige parada e aprovação humana. `mta.yaml` e `xs-security.json` ficam fora da entrega.
- Decisão do humano: o scaffold vem antes de qualquer funcionalidade; os planos seguintes (modelo, regras, alertas, dashboards) são intents próprios.
- Fora de escopo: modelo de domínio (Origem, Tratativa, Ação, Evidência), regras de criticidade e prazo, alertas, templates, dashboards; integração com SuccessFactors, e-mail, Teams, Power BI/SAC; deploy no BTP; apps Fiori; SAP Build Apps; Business Rules; Work Zone.

## Critérios de aceite de negócio
- `npm ci`, `npm run build`, `npm run lint`, `npm test` e `npm run arch` executam com sucesso em clone limpo.
- `sh agentic/mecanismos/scripts/verify.sh` termina com sucesso.
- A estrutura de diretórios corresponde à estrutura-alvo de `AGENTS.md`.
- Existe ao menos um teste de fumaça rodando com SQLite em memória.
- Nenhuma credencial ou arquivo de ambiente local é versionado.

## Questões abertas
- Nenhuma neste intent; as pendências restantes estão na spec (`agentic/projeto/specs/projeto-inicial/spec.md`, "Questões em aberto").

## Decisões do humano
- Scaffold só com `db/` e `srv/` (mais `test/` para o teste de fumaça), sem entidades de negócio; modelo Origem → Tipo → Tratativa vira o intent 002.
- `mta.yaml` e `xs-security.json` ficam para um intent de deploy, pois são N3 e não são necessários para rodar o ciclo.

## Decisões registradas
- "cap" = SAP CAP (Node.js + TypeScript).
- Sem sponsor.
- Pacote/namespace base: `br.com.calazanstec`.
- Respostas do humano (2026-10-06): ferramentas criadas do zero (jest + cds.test, dependency-cruiser, linter); entrega sem funcionalidade visível; contexto atual do SESMT fica para o intent 002; sem LGPD/SuccessFactors nesta entrega.
