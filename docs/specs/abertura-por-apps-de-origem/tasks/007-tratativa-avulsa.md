# Task 007: tratativa-avulsa

**Spec:** docs/specs/abertura-por-apps-de-origem/spec.md
**Status:** publicada
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/007-tratativa-avulsa

## Objetivo
Permitir a usuário autenticado (que não seja aplicativo de origem) criar Tratativa avulsa, sem Origem nem ID_Origem, com as mesmas regras de Criticidade, prazo, Status e histórico (R6, R17; H5).

## Arquivos
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `test/tratativa-avulsa.test.ts`

## Interfaces
- Produz: `TratativaService` em `/api/tratativa/v1` (`design.md` › "`srv/tratativa-service.cds`"), `@requires: 'authenticated-user'`.
  - `before('criarTratativaAvulsa')`: se `req.user.is('AplicativoOrigem')`, rejeita com 403 `Aplicativo de origem não cria Tratativa avulsa.` (decisão 15).
  - `on('criarTratativaAvulsa')`: `return abrirTratativa(req.data, { id: req.user.id, tipo: 'Usuario' })`. **Não** chama `validarAbertura` diretamente: `abrirTratativa` valida com `exigeOrigem = (autor.tipo === 'Aplicativo') = false` (decisão 6, assinaturas fixas).
- Consome: `abrirTratativa`, `Autor` (T002) com a validação interna de T003.

## RED (papel `testes`)
`test/tratativa-avulsa.test.ts` (sem importar `srv/`), via `POST /api/tratativa/v1/criarTratativaAvulsa`:
- CA4: `usuario` cria com `titulo` e `criticidade` → 200 com `codigo`; `origem` e `idOrigem` nulos; nenhuma linha em `ChavesOrigem`.
- CA31: sem autenticação → 401; nenhuma linha nova.
- CA38 (R17 esclarecida; H5): `app-origem-a` (papel `AplicativoOrigem`, credencial ativa via `registrarCredenciais()`) → 403 com mensagem `Aplicativo de origem não cria Tratativa avulsa.`; nenhuma linha nova.
- CA33: duas avulsas com mesmos Título e Criticidade → dois Códigos distintos e duas linhas.
- CA24 (avulsa): `status = 'Aberta'`; histórico `Criacao` com `autor = 'usuario'` e `tipoAutor = 'Usuario'`.
- CA12 (avulsa): sem `titulo` → 400 com `target = 'titulo'`, mensagem contém `Título`.
- CA28 (avulsa): sem `criticidade` → 400 com `target = 'criticidade'`, mensagem contém `Criticidade`.
- CA5 (avulsa): `criticidade: 'Urgente'` → 400 com `target = 'criticidade'`.
- R14/R21 (avulsa): corpo com `origem` ou `idOrigem` → 400 (fora da assinatura).
- CA6 (avulsa, amostra): com `fixarInstante('2026-10-07T12:00:00-03:00')`, `Crítica` → `2026-10-10`.
- Em todos os casos recusados: nenhuma linha nova em `Tratativas` e `HistoricoTratativa`.
Falha esperada no RED: 404 (serviço inexistente) onde se espera 200/400/401/403.

## GREEN (papel `dev`)
Transcrever o CDS e implementar o handler reutilizando o domínio; nenhuma regra duplicada.

## N3 aprovados no Gate 1
- N3-3 (design): `@requires: 'authenticated-user'` e recusa 403 de identidade `AplicativoOrigem`.
- N3-8 (design): `autor` do histórico é o ID do usuário.
- N3-11 (design): contrato OData de `POST /api/tratativa/v1/criarTratativaAvulsa`.

## Critérios de pronto
- CA4, CA31, CA33, CA38; CA5, CA6, CA12, CA24 e CA28 na avulsa.
- `sh scripts/agentic/verify.sh` verde.

## Questões em aberto
- Nenhuma (H5 decidido: aplicativo não cria avulsa).
