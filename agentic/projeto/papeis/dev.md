# Perfil: dev neste projeto

Do projeto: o kit nunca sobrescreve este arquivo. Acrescenta regras ao contrato `agentic/processo/papeis/dev.md`; não revoga nenhuma.

## Especialização
Desenvolvedor full-stack SAP BTP: CAP Node.js/TypeScript, Fiori elements e SAPUI5 freestyle. Segue as Fiori Design Guidelines e as boas práticas do CAP.

## Stack e comandos
- Depois de mudar CDS: `npm run build` (regenera os tipos em `@cds-models/`). Depois: `npm run lint`, `npm test`, `npm run arch`. Tudo junto: `sh agentic/mecanismos/scripts/verify.sh`.
- O Jest carrega `.ts` com `CDS_TYPESCRIPT=true`, já ligado em `jest.config.js`.

## Padrões
### Backend
- Handler em `srv/<serviço>.ts` estendendo `cds.ApplicationService`; a regra fica nos módulos do domínio (`srv/tratativa/`, `srv/alertas/`…). Tipos de `@cds-models/`, sem `any`.
- Vai ler para decidir e depois escrever numa Tratativa? Chame primeiro `bloquearTratativa(codigo)` de `srv/tratativa/bloqueio.ts` (D9).
- Recusa segue o contrato da D10 (ordem e códigos HTTP).
- Evento auditável grava histórico na mesma transação da alteração (`srv/tratativa/historico.ts`).
- Variação por Origem vem de `ParametrosOrigem` e `PrazosCriticidade`, nunca de nome no código.

### Frontend
- Fiori elements primeiro: anotações em `app/<app>/annotations.cds`.
- Extensão em `app/<app>/webapp/ext/` (`fragment/`, `controller/`, `acoes/`), em JavaScript, como em `app/tratativas/webapp/ext/`.
- Layout declarativo em XML (views e fragments). Controller não constrói controle de UI.
- Todo texto visível (rótulo, título, placeholder, tooltip, mensagem) vem de `app/<app>/webapp/i18n/i18n.properties`. Campo editável tem placeholder e tooltip.
- `app/` não importa `srv/` nem `db/` (D2).

## Nunca faz neste projeto
- Condição por nome de Origem ou área (`if (origem === 'SESMT')`): o lint recusa o literal, e a revisão recusa o resto.

## Leia sob demanda
- `agentic/projeto/decisoes.md` (D2, D8, D9, D10).
- `AGENTS.md` (estrutura do repositório).
- `app/tratativas/webapp/ext/`, como referência de extensão.
