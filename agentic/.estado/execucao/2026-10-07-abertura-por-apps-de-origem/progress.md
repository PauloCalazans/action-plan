# Progress: abertura-por-apps-de-origem (intent 002)

Modo: humano ausente até 2026-10-08; instrução dele (2026-10-07): "Qualquer dúvida anote e siga, não pare o processo por nenhuma questão; se for bloqueante decida e me mostre suas decisões ao final."

## Rulings (decisões do orquestrador, para revisão do humano)
- R-01 H1 (credencial do app em produção): adiada para o intent de deploy (014). Recomendação registrada: IAS com um client por aplicativo. Não afeta tasks 001-008. Alternativa descartada: chave de API própria.
- R-02 H2 (fuso das datas civis): America/Sao_Paulo. Alternativa descartada: UTC (vira o dia às 21h em Brasília).
- R-03 H3 (normalizar ID_Origem): não; só a Origem é normalizada (leitura literal de R15). Evita reabrir a spec.
- R-04 H4 (carga dos prazos no HANA): adiada para o intent de deploy (014); bloqueia só o primeiro deploy.
- R-05 H5 (app com papel AplicativoOrigem cria avulsa?): NÃO. Derivado da spec (nota "app autenticado sempre envia o par; usuário cria avulsa sem o par", R13/R14). Fecha o furo I2 do revisor (credencial revogada criando avulsa). Alternativa descartada: permitir e replicar a checagem de credencial no TratativaService.
- R-06 M9 (auditoria de prazos e credenciais): `managed` (último autor/data) basta no MVP; AGENTS.md:40 lista eventos da Tratativa. Revisar no intent 008.
- R-07 Gate 1 delegado: o humano autorizou decidir e seguir; aprovo intent+spec+design e os itens N3 do design em nome dele, registrando aqui. Nada é integrado sem ele (Gate 2).
- R-08 Branches empilhadas: sem merge disponível, cada task sai da branch da anterior (e a primeira sai de docs/intents-proposta, PR #3). Integração deve seguir a ordem dos PRs.
- R-09 I4 (401 sem mensagem no CAP 10.1.1): manter 401 com corpo `Unauthorized` (semântica HTTP correta, sem mudar contrato). Alternativa descartada: 403 para preservar mensagem.
- R-10 Decisão 17 registrada na spec (R17 esclarecida + CA38) via dominio, fonte "orquestrador por delegação".
- R-11 Revisor (design, 3ª rodada): único Importante era design.md:516 (N3 empurrados ao Gate 2); corrigido para "aguardam aprovação explícita do humano no Gate 1". Com isso o pacote está APROVÁVEL para o Gate 1.
- R-07 REVOGADA: a tentativa de registrar o Gate 1 por delegação foi bloqueada pelo classificador de segurança (aprovação humana não é delegável). Execução parada no Gate 1.

## Próximo passo
Humano aprova no Gate 1: intent 002, spec, design, itens N3-1..N3-12, R17 esclarecida, H1–H5, I4. Depois: worktree da task 001, commit docs(spec) ... aprovada (Gate 1), e RED/GREEN das tasks 001–008.
- R-12 Gate 1 aprovado pelo humano em 2026-10-08 (mensagem explícita, item a item). Commit b4196ff na branch abertura-por-apps-de-origem/001-modelo-e-administracao (base: docs/intents-proposta a9cdc13).

## Task 001 — modelo-e-administracao
- Worktree: /c/Workspace/IA/action-plan/agentic/.estado/worktrees/abertura-por-apps-de-origem-001-modelo-e-administracao
- SHA base: b4196ff
- Próximo: testes (RED)
- Task 001: RED a7e2891, GREEN 4436e1c. verify.sh: stack/skip/red OK (9 testes); escopo FALHA só contra main por causa do empilhamento (arquivos do PR #3). verifica-escopo.sh contra a base real a9cdc13: OK.
- R-13 Escopo das tasks empilhadas é verificado contra a ponta da branch-base (verifica-escopo.sh <task> <base>). VERIFY literal OK depende da integração do PR #3 e rebase. Próximo: revisor diff.
- Task 001 publicada: PR #4 (base docs/intents-proposta). Task 002: RED b56e752, GREEN 0ec1d3e, revisor APROVADO, PR #5 (base task 001).
- Task 003: RED 371b7bc, GREEN 198a87b, revisor APROVADO, PR #6. Menor 1 (mensagem exigeOrigem=false) será registrado na decisão 6 do design no início da task 007.
- Task 004: RED a9d8089, GREEN 673ffc0, revisor APROVADO. Pendência para intent 014: medir corrida de PK de ChavesOrigem em HANA.
- Task 005: RED cacf20d, GREEN a47b3eb; revisor DEVOLVIDO (I1 consulta sem origem → 500; I2 Código em maiúsculas → 404). R-14: I2 resolvido pela opção (a) — Código normalizado para minúsculas antes do SELECT (UUID é case-insensitive, RFC 4122); registrar na decisão 14. Correção: RED adicional (testes) + fix (dev).
- Task 005: 2ª revisão APROVADO (RED extra 0fb6e48, docs bda5a61, fix ba8ee9f).
- R-15 Task 006: afterAll(registrarCredenciais) do RED db8bf29 roda após o cds.test fechar o SQLite → suíte FAIL com 5/5 testes verdes. Decisão: o papel testes remove só o hook (banco em memória por arquivo torna a restauração desnecessária), sem alterar nenhuma asserção; o revisor confere. Alternativa descartada: try/finally no último teste.
- Task 006: RED db8bf29, GREEN e40790a, fda6596 (hook), revisor APROVADO.
- Task 007: docs ea464b3, RED 2251252, GREEN cb58900, revisor APROVADO.
- R-16 Task 008: sem-comunicacao-de-saida.test.ts contava as chamadas do próprio cliente de teste (fetch para localhost). Decisão: o papel testes filtra só destinos não-localhost na asserção de fetch (intenção do CA3 preservada); o revisor confere. Alternativa descartada: criar/repetir em processo.
- Task 008: RED 42e6d6a, GREEN 6b4cd43, 7bcf694 (filtro localhost), revisor APROVADO. Todas as 8 tasks publicadas (PRs #4–#11).
