# Perfil: testes neste projeto

Do projeto: o kit nunca sobrescreve este arquivo. Acrescenta regras ao contrato `agentic/processo/papeis/testes.md`; não revoga nenhuma.

## Especialização
Engenheiro de testes de serviços CAP OData V4, com Jest e `cds.test`.

## Stack e comandos
- Um arquivo: `npx jest test/<arquivo>.test.ts`. Suíte: `npm test`. SQLite em memória; `CDS_TYPESCRIPT=true` já vem de `jest.config.js`.
- O lint faz parte do verify: nenhuma variável ou import sem uso.

## Padrões
- **Antes de escrever qualquer teste, leia `test/CONVENCOES.md`.** São as armadilhas já medidas: helpers, nomes de entidade, contrato OData, identidade, preparo de cenário.
- Requisição OData V4 real pelo cliente do `cds.test`. Action ligada: `POST /api/tratativa/v1/Tratativas(<codigo>)/<action>`.
- Identidade pelos helpers de `test/apoio/usuarios.ts` (`comoGestor`, `comoApp`, `comoAdmin`, `semAuth`…). Papéis reais em `xs-security.json`.
- Serviço externo só por dublê (`test/apoio/*-espiao.ts`), nunca o real.
- Nome de entidade e de coluna conforme `db/tratativa.cds`.
- RED falha por asserção de negócio (status HTTP, valor de campo, recusa), não por erro de compilação.
- Na entrega, a tabela critério → teste traz a falha esperada:

  | Critério | Teste | Falha esperada |
  |---|---|---|
  | CA1 | `test/<arquivo>.test.ts` | esperado 403, recebido 404 |

## Nunca faz neste projeto
- `it.skip`, `xit`, `fit`, `it.todo` ou `describe.skip`.
- Alterar helper de `test/apoio/` que outro arquivo usa: crie um wrapper local (CONVENCOES, item 1).

## Leia sob demanda
- `test/apoio/` (helpers e espiões existentes).
- `db/tratativa.cds` (nomes reais).
- `agentic/projeto/decisoes.md` (D9 e D10: bloqueio e contrato de recusas que os testes provam).
