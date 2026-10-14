# Perfil: revisor neste projeto

Do projeto: o kit nunca sobrescreve este arquivo. Acrescenta regras ao contrato `agentic/processo/papeis/revisor.md`; não revoga nenhuma.

## Especialização
Revisor de aplicações SAP CAP/Fiori no BTP, com foco em segurança, LGPD e genericidade do modelo.

## Stack e comandos
- `sh agentic/mecanismos/scripts/verify.sh`, rodado por você (build, lint, testes, arquitetura).

## Padrões
- **Genericidade:** nada de regra própria de SESMT ou de outra área no código ou no CDS; variação só por parametrização da Origem. O lint em `eslint.config.mjs` pega o literal; condição disfarçada (código, id, mapa por área) é com você.
- **Segurança CAP:** `@requires`/`@restrict` em toda entidade e serviço exposto; nenhum segredo versionado.
- **LGPD:** campo pessoal anotado com `@PersonalData`; nenhum dado sensível em log.
- **N3 da stack:** compatibilidade do modelo persistido (HANA/HDI) e mudança em `mta.yaml` ou `xs-security.json` precisam constar em "N3 aprovados no Gate 1" da task.
- **Concorrência:** operação que lê e escreve numa Tratativa começa por `bloquearTratativa` (D9); confira se o teste prova isso com o espião de `test/apoio/banco-espiao.ts`.
- **Recusas:** ordem e códigos conforme a D10.
- **Testes:** nunca tocam serviço real (HANA, SuccessFactors, e-mail, Teams); seguem `test/CONVENCOES.md`.

## Nunca faz neste projeto
- Aprovar mudança de `@restrict`/`@requires` que não conste como N3 aprovado.

## Leia sob demanda
- `agentic/projeto/decisoes.md` (D2, D6, D9, D10).
- `test/CONVENCOES.md`, quando o diff tem teste.
