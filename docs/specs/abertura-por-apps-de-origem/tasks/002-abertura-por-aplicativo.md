# Task 002: abertura-por-aplicativo

**Spec:** docs/specs/abertura-por-apps-de-origem/spec.md
**Status:** publicada
<!-- pendente | em-andamento | em-revisão | publicada  (integrada não é escrito: deriva do git) -->
**Branch:** abertura-por-apps-de-origem/002-abertura-por-aplicativo

## Objetivo
Expor `abrirTratativa` no `IntegracaoOrigemService` criando a Tratativa com Código UUID v4, Status `Aberta`, Data prevista pela tabela de prazos e histórico de criação (caminho feliz; validação, idempotência e credencial ficam em 003, 004 e 006).

## Arquivos
- `srv/integracao-origem-service.cds`
- `srv/integracao-origem-service.ts`
- `srv/tratativa/abertura.ts`
- `srv/tratativa/prazo.ts`
- `srv/lib/relogio.ts`
- `jest.config.js`
- `test/abertura-aplicativo.test.ts`
- `test/prazos-parametrizados.test.ts`
- `test/apoio/relogio.ts`
- `test/apoio/banco.ts`
- `test/apoio/credenciais.ts`
- `test/apoio/usuarios.ts`

## Interfaces
- Produz:
  - `srv/integracao-origem-service.cds`: o trecho de `design.md` **só com** `ResultadoAbertura` e `abrirTratativa` (sem `ConsultaTratativa` e sem as functions, que são de T005). Caminho `/api/integracao-origem/v1`, `@requires: 'AplicativoOrigem'`.
  - `srv/integracao-origem-service.ts`: `class IntegracaoOrigemService extends cds.ApplicationService`, `on('abrirTratativa')` delega a `abrirTratativa(req.data, { id: req.user.id, tipo: 'Aplicativo' })`.
  - `srv/tratativa/abertura.ts`: exporta `TipoAutor`, `Autor`, `DadosAbertura` e `abrirTratativa(dados: DadosAbertura, autor: Autor): Promise<{ codigo: string }>` **exatamente** como em `design.md` › decisão 6 › "Assinaturas fixas do domínio" (único ponto de entrada; T003 acrescenta a validação dentro dele, T007 só o consome). Nesta task: gera `codigo` com `cds.utils.uuid()`, grava `Tratativas` (status `Aberta`, `dataCriacao = dataCivil(agora())`, `criadoEm = agora()`, `dataPrevistaConclusao`) e uma linha `HistoricoTratativa` `Criacao`, na transação do pedido.
  - `srv/tratativa/prazo.ts`: `somarDiasCorridos(data: string, dias: number): string` (aritmética de data civil em UTC) e `diasDoPrazo(criticidade: string): Promise<number>` (lê `PrazosCriticidade`).
  - `srv/lib/relogio.ts`: `agora(): Date`, `dataCivil(instante: Date): string`, `FUSO_PLATAFORMA = 'America/Sao_Paulo'` (decisão 8; H2 decidido).
  - `jest.config.js`: primeira linha `process.env.CDS_TYPESCRIPT = 'true';` (decisão 12).
  - Apoio de teste (usado por todas as suítes seguintes):
    - `test/apoio/relogio.ts`: `fixarInstante(iso: string)` (`jest.useFakeTimers` só para `Date`, lista `doNotFake` do design) e `liberarRelogio()`.
    - `test/apoio/banco.ts`: `linhas(entidade: string, where?)` lendo direto do `cds.db` (`br.com.calazanstec.*`).
    - `test/apoio/credenciais.ts`: `registrarCredenciais()` insere `app-origem-a` e `app-origem-b` ativas e `app-revogado` inativa em `CredenciaisAplicativo`. **Toda suíte que chama o `IntegracaoOrigemService` o executa no `beforeAll`**, para continuar verde quando T006 ligar a verificação.
- Consome: modelo, prazos e usuários de T001.

## RED (papel `testes`)
Sem importar nada de `srv/` (o RED deve falhar por asserção, não por módulo inexistente).
`test/abertura-aplicativo.test.ts`:
- CA1: `app-origem-a` abre ("Advertência", "ADV-001", "Título", `Alta`) → 200 e `codigo` presente.
- CA6, CA7, CA29, CA30: com `fixarInstante('2026-10-07T12:00:00-03:00')`, `Crítica` → `2026-10-10`, `Baixa` → `2026-11-06`, `Alta` → `2026-10-14`, `Média` → `2026-10-22` (lidas no banco). Caso de fuso: `fixarInstante('2026-10-07T23:30:00-03:00')` com `Crítica` → `dataCriacao = 2026-10-07`.
- CA8: corpo com `dataPrevistaConclusao` → 400; nenhuma linha nova.
- CA13: só obrigatórios → `descricao`, `unidade`, `area`, `solicitante` nulos.
- CA19 (parte): sem autenticação → 401; nenhuma linha nova.
- CA24: `status = 'Aberta'`; uma linha `HistoricoTratativa` com `evento = 'Criacao'`, `autor = 'app-origem-a'`, `tipoAutor = 'Aplicativo'`, `quando` = instante fixado.
- CA25, CA37: `nomeVitima`, `nomeSolicitante`, `emailSolicitante` → 400 cada; nenhuma linha nova.
- CA26: Origem "Auditoria de Qualidade" → 200 e Tratativa criada.
- CA34: duas aberturas de registros diferentes → Códigos diferentes, ambos casando `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- CA35: o Código não contém a Origem nem o ID_Origem (comparação sem caixa) e é v4 (regex acima; "não depende da ordem" é propriedade da versão, decisão 2).
- CA36: `solicitante: 'M12345'` → gravado `M12345`; `cds.model.definitions['br.com.calazanstec.Tratativas'].elements` não tem elemento com `nome` ou `email` no nome.
`test/prazos-parametrizados.test.ts` (arquivo próprio: altera a tabela):
- CA9: abre `Alta` em 2026-10-07 (→ 2026-10-14); `admin` muda `Alta` para 5; nova `Alta` em 2026-10-07 → `2026-10-12`; a primeira continua `2026-10-14`.
Falha esperada no RED: 404 (operação inexistente) onde se espera 200/400/401.

## GREEN (papel `dev`)
Implementar o caminho feliz. **Fora desta task:** mensagens de obrigatório e validação de Criticidade (T003), `ChavesOrigem` e repetição (T004), consulta (T005), verificação de credencial (T006). Nenhum `new Date()` fora de `srv/lib/relogio.ts`; nenhum nome de Origem no código.

## N3 aprovados no Gate 1
- N3-1 (design): escrita em `Tratativas` e `HistoricoTratativa` (tabelas de T001).
- N3-4 (design): `@requires: 'AplicativoOrigem'` no `IntegracaoOrigemService`.
- N3-7 (design): contrato público de abertura (assinatura, tamanhos, retorno `{ codigo }` UUID v4, erros, `/v1`).
- N3-8 (design): `solicitante` só matrícula; `autor` no histórico.

## Critérios de pronto
- CA1, CA6, CA7, CA8, CA9, CA13, CA19 (sem autenticação), CA24 (aplicativo), CA25, CA26, CA29, CA30, CA34, CA35, CA36, CA37.
- `sh scripts/agentic/verify.sh` verde.

## Questões em aberto
- Nenhuma (H2 decidido: `America/Sao_Paulo`).
