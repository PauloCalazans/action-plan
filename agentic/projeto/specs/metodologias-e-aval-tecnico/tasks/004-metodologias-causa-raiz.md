# Task 004: metodologias-causa-raiz

**Spec:** agentic/projeto/specs/metodologias-e-aval-tecnico/spec.md
**Status:** draft
**Branch:** metodologias-e-aval-tecnico/004-metodologias-causa-raiz

## Objetivo
Implementar no `TratativaService` a definição, edição e remoção da metodologia (3W, 5 Porquês, 5W2H, PDCA/8D), a consulta `consultarMetodologiaTratativa` e a derivação de Ação a partir de um item da análise, exclusiva do Gestor e com vínculo à causa.

## Arquivos

### Criados
- `srv/tratativa/metodologia-validacao.ts` (chaves e limites por ferramenta, decisão 1 do design; mensagens e `target`)
- `srv/tratativa/metodologia.ts` (`definirMetodologia`, `consultarMetodologia`, `derivarAcaoDaMetodologia`; autoria R4; eventos DC-03; máscara R16 b; `tratativasComVinculoDiagnostico(req, codigos): Promise<Set<string>>` = Tratativas em que o usuário é Gestor, responsável de Ação/Subação ou Validador habilitado, lida no banco em lote, DC-15)
- `test/metodologias-diagnostico.test.ts`

### Modificados
- `srv/tratativa-service.cds` (tipo `DetalheMetodologia`; function `consultarMetodologiaTratativa`; actions `definirMetodologia`, `derivarAcaoDaMetodologia`; grant `authenticated-user`)
- `srv/tratativa-service.ts` (handlers)
- `srv/tratativa/acoes-criacao.ts` (exporta `criarAcaoComCausa(codigoTratativa, dados, causa, autor)`, que reaproveita `criar` e grava `causaIdentificador`, `causaDescricao` e os eventos `Criacao` + `CriacaoAcaoComCausa`)

### Removidos
- Nenhum.

## Interfaces
- Produz:
  - `POST .../Tratativas(<codigo>)/definirMetodologia` `{ ferramenta, categoriaCausaRaiz, dados, confirmarSubstituicao }` → 204.
  - `POST .../Tratativas(<codigo>)/derivarAcaoDaMetodologia` `{ causaIdentificador, descricao, responsavel, prazo, prioridade, evidenciaObrigatoria }` → `ResultadoCriacaoAcao`.
  - `GET /api/tratativa/v1/consultarMetodologiaTratativa(codigoTratativa=<uuid>)` → `DetalheMetodologia` (campos `null` quando não há metodologia).
  - Módulos reutilizados pela task 007 (`definirMetodologia`, `derivarAcaoDaMetodologia`, `tratativasComVinculoDiagnostico`). `tratativasComVinculoDiagnostico(req, codigos)` recebe a lista inteira de uma leitura e responde com no máximo uma consulta por fonte de vínculo (Ações/Subações por responsável, habilitação em lote), porque a máscara genérica do App (DC-17) a chama uma vez por requisição.
  - Recusa de etapa 4 (DC-12): chave da URL mal formada → 400 `Código inválido.` `target: codigo` nas duas actions; `codigoTratativa` mal formado em `consultarMetodologiaTratativa` → 400 `target: codigoTratativa`.
- Consome:
  - Modelo e catálogo da task 001; `usuarioEhValidadorHabilitado` e `tratativasComValidadorHabilitado` (lote, task 002) para a máscara e para `tratativasComVinculoDiagnostico`; `encerrarComAval` (task 003) para preparar Tratativa `Encerrada` nos testes.

## N3 aprovados no Gate 1
- N3-2 (design): grant `authenticated-user` para `definirMetodologia` e `derivarAcaoDaMetodologia` com papel em código.
- N3-4 (design): máscara de `dados`/`autor` e histórico sem texto da análise.
- N3-6 (design): operações novas.

## Critérios de pronto
- **RED** (`test(red): metodologias de causa raiz e derivacao de acoes`), em `test/metodologias-diagnostico.test.ts`:
  - CA1 (3W em `Aberta` pelo Gestor e consulta), CA2 (5 Porquês com categoria `Método/Processo`), CA3 (sem `porque1` → 400 `target: porque1`), CA4 (5W2H com e sem `quantoCusta`), CA5 (PDCA/8D), CA35 (`Ishikawa` → 400 `target: ferramenta`), CA36 (3W com `oQue = 'Ab'` → 400 `target: oQue`), categoria fora do catálogo → 400 `target: categoriaCausaRaiz`.
  - CA6 (parte da metodologia): Tratativa sem metodologia abre, cria e conclui Ações normalmente.
  - CA7 (troca de ferramenta sem confirmação → 409 com a mensagem da spec; com `confirmarSubstituicao = true` → aceita).
  - CA8 (responsável de Ação, ex.: `M1001`, edita), CA9 (`usuario` sem vínculo → 403), CA10 (`comoApp` → 403).
  - CA11 (`Encerrada` → 409 `Tratativa Encerrada não pode ser alterada.`, preparada com `encerrarComAval`), CA12 (`Cancelada` → 409), CA13 (reaberta → edição aceita).
  - CA38: histórico com `DefinicaoMetodologia` e `EdicaoMetodologia`, `origem: 'Tratativa'`, `tipoAutor: 'Usuario'`, sem texto da análise no detalhe.
  - CA14 (parte de serviço): `definirMetodologia` não cria Ação; `derivarAcaoDaMetodologia` grava os valores revisados enviados pelo Gestor (Descrição, Responsável, Prazo, Prioridade).
  - CA15: derivação com prazo de hoje + 5 dias e responsável `M1001` cria Ação `Pendente` com `causaIdentificador`/`causaDescricao` e `CriacaoAcaoComCausa` (`origem: 'Acao'`) além de `Criacao` no histórico.
  - CA43: `M1001` (responsável de Ação) tenta derivar → 403; derivar sem metodologia → 409; `causaIdentificador` inexistente na análise → 400.
  - R18 etapa 4 (DC-12): `definirMetodologia` e `derivarAcaoDaMetodologia` com chave `'xyz'` → 400 `Código inválido.`; UUID inexistente → 404.
  - Causa visível ao Responsável da Ação (DC-15, R16 b): depois da derivação para `M1001`, `consultarMetodologiaTratativa` como `M1001` traz `dados`; como `usuario` sem vínculo, `dados` `null`.
  - CA45 (parte da metodologia): `consultarMetodologiaTratativa` devolve ferramenta e campos; `dados`/`autor` `null` para `usuario`; `consultarTratativa` mantém 12 chaves.
- **GREEN** (`feat(green): metodologias de causa raiz e derivacao de acoes`): módulos e handlers da lista; `npm run build` limpo.
- CAs cobertos: CA1, CA2, CA3, CA4, CA5, CA6 (parte), CA7, CA8, CA9, CA10, CA11, CA12, CA13, CA14 (serviço), CA15, CA35, CA36, CA38, CA43, CA45 (metodologia).
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Nenhuma.
