# Task 004: idempotencia-por-par

**Spec:** docs/specs/abertura-por-apps-de-origem/spec.md
**Status:** publicada
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/004-idempotencia-por-par

## Objetivo
Garantir no máximo uma Tratativa por par (Origem normalizada, ID_Origem) usando `ChavesOrigem`, devolvendo o Código existente sem alterar nada em pedido repetido (R4, R15, R16).

## Arquivos
- `srv/tratativa/chave-origem.ts`
- `srv/tratativa/abertura.ts`
- `test/idempotencia.test.ts`

## Interfaces
- Produz:
  - `srv/tratativa/chave-origem.ts`: `normalizarOrigem(origem: string): string` = `origem.trim().toLowerCase()` (acentos preservados; decisão 3); o `idOrigem` é comparado exatamente (H3 = não normaliza); `buscarPorPar(origem: string, idOrigem: string): Promise<string | undefined>` (Código ou nada).
  - `abrirTratativa` com par: gera `codigo`; insere `ChavesOrigem` primeiro; se a chave já existe (leitura prévia ou violação de unicidade em corrida), devolve o Código existente e não grava `Tratativas` nem `HistoricoTratativa`; senão segue o caminho de T002. Repetição responde 200.
- Consome: `abrirTratativa` (T002), validação (T003, se já integrada; não é pré-requisito).

## RED (papel `testes`)
`test/idempotencia.test.ts` (com `registrarCredenciais()`; sem importar `srv/`):
- CA2: repetir ("Advertência", "ADV-001") → mesmo `codigo`; uma linha em `Tratativas` e em `ChavesOrigem` para o par; uma linha `Criacao` no histórico.
- CA15: `app-origem-b` com ("Notificação de Risco de Acidente", "123") depois de ("Advertência", "123") → Código diferente.
- CA16: ("  advertência ", "123") depois de ("Advertência", "123") → Código existente; `origem` gravada continua `Advertência`.
- CA17: ("Advertencia", "123") → nova Tratativa (acento difere).
- H3: ("Advertência", " 123 ") depois de ("Advertência", "123") → nova Tratativa (ID_Origem não é normalizado).
- CA18: repetição com `criticidade: 'Baixa'` e outro `titulo` → Código existente; Criticidade continua `Alta`, título e Data prevista inalterados.
- Amostra de corrida: 5 pedidos idênticos em `Promise.all` → um único Código entre as respostas e uma linha para o par (amostra fraca; a garantia é a chave primária, decisão 3).
Falha esperada no RED: Códigos diferentes / mais de uma linha onde se espera uma.

## GREEN (papel `dev`)
Implementar a normalização e o fluxo de `ChavesOrigem` dentro da transação do pedido. Não alterar a Tratativa existente em hipótese alguma (R16).

## N3 aprovados no Gate 1
- N3-1 (design): uso de `ChavesOrigem` (tabela criada em T001).
- N3-7 (design): repetição devolve 200 com o Código existente.

## Critérios de pronto
- CA2, CA15, CA16, CA17, CA18.
- `sh scripts/agentic/verify.sh` verde.

## Questões em aberto
- Nenhuma (H3 decidido: só a Origem é normalizada).
