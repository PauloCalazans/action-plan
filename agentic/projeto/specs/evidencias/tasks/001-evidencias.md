# Task 001: evidencias

**Spec:** agentic/projeto/specs/evidencias/spec.md  
**Status:** em-andamento  
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->  
**Branch:** evidencias/001-evidencias

## Objetivo
Entregar o intent 006 inteiro numa branch empilhada sobre os intents 004 e 005, em quatro etapas sequenciais RED/GREEN: (1) Inclusão e Armazenamento de Evidências (`anexarEvidencia`) com abstração de repositório via serviço CAP `ArmazenamentoEvidencias` (dublê isolado em `test/apoio/`), validação declarativa de formatos, limite de corpo do runtime de 20 MB e histórico; (2) Remoção Lógica e Auditoria (`removerEvidencia`) com liberação de cota e preservação do arquivo guardado; (3) Bloqueio de Conclusão da Ação por Evidência Obrigatória (R8, R15 compatibilizado com Ruling R-10) e Nova Consulta de Pendências de Evidência da Tratativa (`listarPendenciasEvidenciasTratativa`, R9, I8); (4) Consultas, Visibilidade LGPD e Download com Auditoria Prévia (`listarEvidenciasAcao`, `listarEvidenciasTratativa`, `baixarEvidencia`) sem bloqueio da Tratativa, conforme desenhado em `agentic/projeto/specs/evidencias/design.md`.

## Arquivos
- `package.json`
- `db/tratativa.cds`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/tratativa/armazenamento-evidencias.ts`
- `srv/tratativa/evidencias-validacao.ts`
- `srv/tratativa/evidencias-anexo.ts`
- `srv/tratativa/evidencias-remocao.ts`
- `srv/tratativa/evidencias-consultas.ts`
- `srv/tratativa/acoes-ciclo-de-vida.ts`
- `srv/tratativa/historico.ts`
- `srv/tratativa/recusa.ts`
- `test/apoio/evidencias.ts`
- `test/apoio/armazenamento-espiao.ts`
- `test/evidencias-anexo.test.ts`
- `test/evidencias-remocao.test.ts`
- `test/evidencias-bloqueio-conclusao.test.ts`
- `test/evidencias-consultas-download.test.ts`

## Interfaces
- **Produz:**
  - Modelo persistido em `db/tratativa.cds`:
    * Nova entidade `Evidencias` com `@PersonalData.EntitySemantics: 'Other'`, anotações `@PersonalData.IsPotentiallyPersonal` em `nomeArquivo`, `descricao`, `autorAnexo`, `autorRemocao`, e controle de remoção lógica (`ativo`, `removidoEm`, `autorRemocao`).
    * Composição aditiva `evidencias : Composition of many Evidencias on evidencias.acao = $self;` em `Acoes`.
    * Novos valores no enum `EventoHistoricoAcao`: `InclusaoEvidencia`, `RemocaoEvidencia`, `DownloadEvidencia`.
    * Colunas opcionais aditivas em `HistoricoAcoes`: `evidencia : UUID; mimeType : String(100); tamanho : Integer;`.
  - Superfície OData V4 em `srv/tratativa-service.cds`:
    * Actions ligadas a `Tratativas`: `anexarEvidencia` (retornando `TratativaService.DetalheEvidencia`) e `removerEvidencia`, com o grant `{ grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }` acrescentado diretamente ao array `@restrict` existente da entidade `Tratativas` em `srv/tratativa-service.cds` (como o 005 fez com `mudarStatusAcao`).
    * Functions públicas: `listarEvidenciasAcao`, `listarEvidenciasTratativa`, `baixarEvidencia` e `listarPendenciasEvidenciasTratativa`.
    * Tipos estruturados: `DetalheEvidencia`, `ItemEvidencia`, `ItemEvidenciaTratativa`, `DetalheDownloadEvidencia`, `ItemPendenciaEvidenciaTratativa`.
  - Módulos de domínio em `srv/tratativa/`:
    * `armazenamento-evidencias.ts`: serviço CAP `ArmazenamentoEvidencias` com métodos `salvar`, `obter`, `excluir`.
    * `evidencias-validacao.ts`: sanitização de caminho, validação declarativa de MIME e extensão, e validação de limites de tamanho.
    * `evidencias-anexo.ts`: orquestração da action `anexarEvidencia` com bloqueio pessimista D9, 10 passos de precedência, decodificação Base64, auditoria e compensação contra arquivos órfãos.
    * `evidencias-remocao.ts`: orquestração da action `removerEvidencia` com remoção lógica e auditoria.
    * `evidencias-consultas.ts`: listagens, consulta de pendências e download com menor privilégio, mascaramento de matrícula LGPD e auditoria prévia `DownloadEvidencia` sem bloqueio pessimista da Tratativa.
    * `historico.ts`: extensão de `LinhaHistorico` com `evidencia`, `mimeType` e `tamanho`, mantendo assinatura existente de `registrarHistorico`.
    * Extensões de `acoes-ciclo-de-vida.ts` (passo 10 de pré-condição de conclusão com evidência obrigatória) e `recusa.ts` (suporte a 413 e 415).
  - Configurações no `package.json`: `cds.server.body_parser.limit = "20mb"` e registro de `cds.requires.ArmazenamentoEvidencias`.
- **Consome:**
  - Infraestrutura e modelos dos intents 003, 004 e 005.
  - Módulos reutilizados: `bloquearTratativa` (`bloqueio.ts`), `recusar` (`recusa.ts`), `registrarHistorico` (`historico.ts`), `codigoValido` (`consulta.ts`), `obterMatriculaUsuario`, `usuarioAutenticadoEhMatricula` (`identidade.ts`), `agora`, `dataCivil` (`srv/lib/relogio.ts`).
  - Helpers de teste em `test/apoio/`: `usuarios.ts` (`comoGestor`, `comoUsuario`, `comoApp`, `semAuth`), `banco.ts` (`linhas`), `banco-espiao.ts` (`instalarEspiao`, `bloqueiaAntesDeEscrever`, `falharEm`), `armazenamento-espiao.ts` (`limparArmazenamento`, `contemArquivo`, `falharProximoArmazenamento`), `tratativas.ts`, `acoes.ts`.

## Regras para todas as etapas
- **Commits por etapa:** `test(red): <etapa> …` somente com arquivos de `test/` (e este arquivo de task); depois `feat(green): <etapa> …` com a implementação de produção. Nunca alterar testes de commits RED anteriores.
- **Arquivo de teste novo por RED:** o script `verifica-red.sh` valida o RED por arquivo novo e exige que os testes novos falhem estritamente no commit RED.
- **Helpers em `test/apoio/` sem asserções:** nenhum helper pode conter chamadas a `expect(`. Todas as asserções pertencem aos arquivos `*.test.ts`.
- **Testes não importam `srv/`:** a interação dos testes de integração ocorre exclusivamente via chamadas OData V4 (`POST`, `GET` do `cds.test`), leitura direta do banco via `linhas(...)` de `test/apoio/banco.ts`, ou inspeção do dublê via `test/apoio/armazenamento-espiao.ts`.
- **Cuidado com asserções amplas:** preferir validação de chaves exatas em vez de regex genéricas sobre nomes de campos em payloads de erro.
- **Isolamento de concorrência e massa:** utilizar `sufixoUnico()` em descrições e títulos para evitar colisões no banco da mesma suíte.
- **Verificação obrigatória:** rodar `sh agentic/mecanismos/scripts/verify.sh` ao término de cada etapa GREEN.

---

## Etapa 1 — Inclusão e Armazenamento de Evidências (`anexarEvidencia`)
**CAs:** CA1, CA2, CA3, CA4, CA5, CA7, CA8, CA9, CA10, CA10a, CA10b, CA10c, CA11, CA12, CA13, CA13a, CA14, CA15, CA16, CA17, CA18, CA19, CA20, CA21, CA22, CA23, CA24 (anexo), CA25, CA26, CA27, CA28, CA49, CA51, CA52, CA53, CA55, CA56 (anexo), CA57, CA57a (anexo com "xyz"), CA57b, CA58, CA59, CA59a, CA60, CA62, CA63.  
**Itens N3 utilizados:** N3-1, N3-2, N3-3, N3-4, N3-5, N3-6.

**RED (papel `testes`)** — commit `test(red): inclusão e armazenamento desacoplado de evidências com validação de formato e tamanho (R1-R7, R12-R14)`:
- `test/apoio/armazenamento-espiao.ts` (novo, sem `expect`): dublê em memória do serviço `ArmazenamentoEvidencias` com métodos `salvar`, `obter`, `excluir`, `limparArmazenamento`, `contemArquivo`, `falharProximoArmazenamento`.
- `test/apoio/evidencias.ts` (novo, sem `expect`): helpers para invocação OData V4:
  * `anexarEvidencia(POST, tratativa, dados, como)`: dispara `POST /Tratativas(<tratativa>)/anexarEvidencia`.
  * `bufferParaBase64(buffer)` e geradores de buffers de tamanhos e formatos controlados (JPG, PNG, PDF, DOCX, TXT, CSV, binário vazio, 10 MB, 10.485.761 bytes, 14 MB, 16 MB para body > 20 MB).
- `test/evidencias-anexo.test.ts` (novo, falha no RED):
  * CA1, CA2: anexo válido de PDF por Gestor e JPG por Responsável de Subação vinculando à Ação/Tratativa.
  * CA3: parâmetro `acao` ausente ou nulo no payload recusa na etapa 4 com 400 `Código inválido.`, `target: acao`.
  * CA4, CA5: inclusão da 10ª evidência aceita com sucesso; 11ª evidência recusa com 409 `Limite de 10 evidências por Ação atingido.`.
  * CA7, CA8, CA9: trim em nome e descrição; descrição nula; descrição com 501 caracteres recusa com 400 `O campo Descrição aceita no máximo 500 caracteres.`, `target: descricao`.
  * CA10, CA10a, CA10b, CA10c: extração do último segmento em caminhos (`../../foto.png` -> `foto.png`); nome vazio recusa com 400 `O campo Nome do arquivo é obrigatório.`; nome > 255 recusa com 400 `O campo Nome do arquivo aceita no máximo 255 caracteres.`; MIME > 100 recusa com 415.
  * CA11, CA12, CA13, CA13a, CA14: formatos válidos (JPG, JPEG, PNG, PDF, DOCX, DOC, TXT, XLSX, XLS, CSV com pares normais e alternativos; maiúsculas aceitas); formatos proibidos (.exe, .bat, .zip) e extensão incompatível com MIME recusam com 415.
  * CA15, CA16, CA59a: arquivo vazio (0 bytes) recusa com 400 `O arquivo não pode ser vazio.`, `target: arquivo`; arquivo com 10.485.761 bytes a 14 MB recusa no domínio com 413 `Arquivo excede o tamanho máximo permitido de 10 MB.`; arquivo com exatamente 10.485.760 bytes aceito com sucesso.
  * CA17: conferência de que metadados foram para a base relacional e binário para o repositório em memória via `test/apoio/armazenamento-espiao.ts` (sem binário na tabela relacional).
  * CA18, CA19, CA20, CA21, CA22, CA23: permissão de Gestor e Responsável da Ação; recusa 403 para terceiros, Responsável Principal e Participantes.
  * CA24, CA57, CA57a (com `"xyz"`), CA57b: recusa 403 para aplicativo no início do handler antes da existência; corpo > 20 MB (arquivo > ~15 MB) recusa com 413 do runtime antes do handler; aplicativo com código malformado de sintaxe válida recebe 403 antes de validar código.
  * CA25, CA26, CA27, CA28: estados permitidos (Tratativa Aberta/Em andamento, Ação Pendente/Em andamento; recusa 409 nos demais; Ação reaberta aceita novo anexo).
  * CA49, CA51, CA52: histórico `InclusaoEvidencia` registrado com tipo MIME, tamanho e autor sem copiar nome do arquivo nem binário; pedidos recusados não gravam histórico.
  * CA53: falha injetada no banco/histórico após persistir binário aciona rollback e compensação excluindo arquivo do repositório em memória.
  * CA55: duas inclusões simultâneas da 10ª evidência resultam em uma 200 e uma 409 (serialização D9).
  * CA56, CA58, CA59, CA60, CA62, CA63: precedência completa de recusas.

**GREEN (papel `backend`)** — commit `feat(green): inclusão e armazenamento desacoplado de evidências com validação de formato e tamanho (R1-R7, R12-R14)`:
- `package.json`: configuração `cds.server.body_parser.limit = "20mb"` e registro de `cds.requires.ArmazenamentoEvidencias`.
- `db/tratativa.cds`: entidade `Evidencias` com `@PersonalData.EntitySemantics: 'Other'`, composição em `Acoes`, novos eventos em `EventoHistoricoAcao` e colunas aditivas em `HistoricoAcoes`.
- `srv/tratativa-service.cds`: action ligada `anexarEvidencia` (retornando `TratativaService.DetalheEvidencia`) com o grant `{ grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }` acrescentado diretamente ao array `@restrict` existente da entidade `Tratativas`.
- `srv/tratativa/armazenamento-evidencias.ts` (novo): implementação base do serviço CAP `ArmazenamentoEvidencias`.
- `srv/tratativa/evidencias-validacao.ts` (novo): sanitização de nome, verificação de pares MIME/extensão, limites de tamanho e validação declarativa.
- `srv/tratativa/evidencias-anexo.ts` (novo): orquestrador de `anexarEvidencia` com bloqueio D9, 10 passos de precedência, decodificação Base64, persistência de metadados, armazenamento de binário, auditoria e compensação contra arquivos órfãos.
- `srv/tratativa/historico.ts`: suporte a `evidencia`, `mimeType`, `tamanho` em `LinhaHistorico`.
- `srv/tratativa-service.ts`: registro do handler da action `anexarEvidencia`.
- `srv/tratativa/recusa.ts`: garantia de emissão dos códigos HTTP 413 e 415 com payload estruturado e `target`.
- Execução de `sh agentic/mecanismos/scripts/verify.sh` passando 100% verde.

---

## Etapa 2 — Remoção Lógica e Auditoria (`removerEvidencia`)
**CAs:** CA6, CA18 (remoção), CA19 (remoção), CA20 (remoção), CA21 (remoção), CA22 (remoção), CA23 (remoção), CA24 (remoção), CA25 (remoção), CA26 (remoção), CA27 (remoção), CA39, CA41a, CA42, CA50, CA51 (remoção), CA52 (remoção), CA54, CA56 (remoção), CA57a (remoção com "xyz"), CA61.  
**Itens N3 utilizados:** N3-3, N3-4, N3-5.

**RED (papel `testes`)** — commit `test(red): remoção lógica de evidências com liberação de cota e auditoria imutável (R1, R6, R7, R10, R12, R13)`:
- `test/apoio/evidencias.ts`: helper `removerEvidencia(POST, tratativa, dados, como)` disparando `POST /Tratativas(<tratativa>)/removerEvidencia`.
- `test/evidencias-remocao.test.ts` (novo, falha no RED):
  * CA6: remoção lógica libera cota ativa permitindo inclusão da 10ª evidência.
  * CA39: remoção grava `ativo = false`, data da remoção e matrícula do autor.
  * CA41a: conferência no dublê de armazenamento de que o arquivo binário permanece guardado após a remoção lógica.
  * CA42: remoção de evidência já removida (ou inexistente) retorna 404 `Evidência não encontrada.`.
  * CA50, CA51, CA52: histórico `RemocaoEvidencia` registrado com tipo MIME, tamanho, autor sem nome de arquivo; pedidos recusados não gravam histórico.
  * CA54: falha na gravação do histórico mantém a evidência com `ativo = true`.
  * CA56 (remoção), CA24 (remoção), CA57a (remoção com `"xyz"`): precedência de 401, 403 app antes de 400 código no POST.
  * CA61: remoção informando código de outra Ação à qual a evidência não pertence retorna 404 `Evidência não encontrada.`.
  * Permissões e estados em remoção (CA18–CA23, CA25–CA27).

**GREEN (papel `backend`)** — commit `feat(green): remoção lógica de evidências com liberação de cota e auditoria imutável (R1, R6, R7, R10, R12, R13)`:
- `srv/tratativa-service.cds`: action ligada `removerEvidencia(acao : UUID, evidencia : UUID)` (coberta pelo grant acrescentado em `Tratativas`).
- `srv/tratativa/evidencias-remocao.ts` (novo): orquestrador de `removerEvidencia` com bloqueio D9, verificação de precedência (401 -> 403 app -> 400 código -> 404 existência/pertencimento -> 403 autorização dinâmica -> 409 estados), marcação `ativo = false` com data/autor e gravação do histórico `RemocaoEvidencia`.
- `srv/tratativa-service.ts`: registro do handler da action `removerEvidencia`.
- Execução de `sh agentic/mecanismos/scripts/verify.sh` passando 100% verde.

---

## Etapa 3 — Bloqueio de Conclusão por Evidência Obrigatória e Sinalização Pendente (R8, R9, R15)
**CAs:** CA29, CA30, CA31, CA32, CA33, CA34, CA35, CA36, CA37, CA38, CA38a, CA64, CA65, CA66, CA68, CA69.  
**Itens N3 utilizados:** N3-4, N3-5.

**RED (papel `testes`)** — commit `test(red): bloqueio de conclusão de Ação com evidência obrigatória e consulta de pendências (R8, R9, R15, R17)`:
- `test/apoio/evidencias.ts`: helper `listarPendenciasEvidenciasTratativa(GET, tratativa, como)`.
- `test/evidencias-bloqueio-conclusao.test.ts` (novo, falha no RED):
  * CA29, CA30: tentativa de concluir Ação com `evidenciaObrigatoria = true` sem evidências ativas (por Gestor ou Responsável) recusa com 409 `Ação com Evidência obrigatória não pode ser concluída sem Evidência.`.
  * CA31, CA32: Ação com `evidenciaObrigatoria = true` com 1 evidência ativa conclui com sucesso; Ação com `evidenciaObrigatoria = false` conclui sem evidências.
  * CA33: Ação com `evidenciaObrigatoria = true` cuja única evidência foi removida logicamente recusa conclusão com 409.
  * CA34, CA35, CA36, CA37, CA38, CA68: consulta dedicada `listarPendenciasEvidenciasTratativa` retorna ações com evidência obrigatória e zero evidências ativas; não retorna quando possui evidência, quando `evidenciaObrigatoria = false` ou quando Concluída/Cancelada; aplica menor privilégio (responsável null para não-gestor, lista vazia para terceiros).
  * CA38a: as consultas existentes de detalhe da Ação, da estrutura de Ações (004) e de "Minhas Ações" (005) mantêm exatamente as chaves atuais, sem acrescentar o campo `evidenciaPendente` (preservando testes de chaves exatas).
  * CA64: conclusão de mãe com Subações abertas recusa com 409 na etapa 9 antes de validar evidência obrigatória na etapa 10.
  * CA65, CA66: estado da Tratativa (etapa 7) e transição da Ação (etapa 8) precedem a validação de evidência obrigatória na etapa 10.
  * CA69: comprovação da substituição formal de `plano-de-acao:R14` (harmonizado com o Ruling R-10 do CA47 do 004).

**GREEN (papel `backend`)** — commit `feat(green): bloqueio de conclusão de Ação com evidência obrigatória e consulta de pendências (R8, R9, R15, R17)`:
- `srv/tratativa-service.cds`: function `listarPendenciasEvidenciasTratativa(tratativa : UUID) returns many ItemPendenciaEvidenciaTratativa` e tipo estruturado associado (sem tocar em tipos existentes de 004 e 005; I8).
- `srv/tratativa/acoes-ciclo-de-vida.ts`: inserção da etapa 10 na transição para `Concluída`: se `evidenciaObrigatoria === true`, consulta contagem de evidências ativas e emite 409 `Ação com Evidência obrigatória não pode ser concluída sem Evidência.` caso seja zero.
- `srv/tratativa/evidencias-consultas.ts`: implementação da function `listarPendenciasEvidenciasTratativa`.
- `srv/tratativa-service.ts`: registro do handler de `listarPendenciasEvidenciasTratativa`.
- Execução de `sh agentic/mecanismos/scripts/verify.sh` passando 100% verde.

---

## Etapa 4 — Consultas, Visibilidade LGPD e Download com Auditoria (`listarEvidenciasAcao`, `listarEvidenciasTratativa`, `baixarEvidencia`)
**CAs:** CA7 (leitura), CA24 (leitura/download), CA40, CA41, CA43, CA44, CA45, CA46, CA47, CA47a, CA47b, CA48, CA48a, CA50a, CA50b, CA52 (download), CA54a, CA56 (download), CA57a (leitura/download com "xyz"), CA61a, CA61b (com "xyz"), CA67, CA70.  
**Itens N3 utilizados:** N3-1, N3-3, N3-4, N3-5.

**RED (papel `testes`)** — commit `test(red): consultas de evidência, proteção LGPD de matrículas e download com auditoria prévia (R11, R12, R13, R16, R17)`:
- `test/apoio/evidencias.ts`: helpers para `listarEvidenciasAcao`, `listarEvidenciasTratativa` e `baixarEvidencia`.
- `test/evidencias-consultas-download.test.ts` (novo, falha no RED):
  * CA40: listagens por Ação e por Tratativa retornam apenas evidências ativas (`ativo = true`).
  * CA41: tentativa de baixar evidência removida logicamente retorna 404 `Evidência não encontrada.`.
  * CA43, CA44: Gestor vê matrícula do autor; Responsável da Ação vê suas evidências com autor null; Responsável de Subação opera estritamente sobre a Subação.
  * CA45, CA46, CA47: Responsável Principal, Participantes e terceiros recebem lista vazia `[]` em listagens e 403 em download.
  * CA47a, CA47b: listagem por Tratativa retorna todas as evidências com código da Ação ao Gestor; Responsável recebe apenas suas evidências com autor null.
  * CA48, CA48a: download e listagens permitidos em Tratativa Encerrada/Cancelada e Ação Concluída/Cancelada.
  * CA50a, CA54a: download aceito grava `DownloadEvidencia` antes de entregar o binário; falha na gravação impede entrega do arquivo; download concorrente não bloqueia Tratativa (exceção à D9).
  * CA50b: listagens não geram registro no histórico.
  * CA56 (download), CA24 (leitura/download): autenticação e recusa 403 de aplicativo.
  * CA61a, CA61b (com `"xyz"`): Tratativa/Ação inexistente em listagem retorna 404; código malformado de sintaxe válida na URL retorna 400 `Código inválido.`.
  * CA67, CA70: generalidade entre origens e completude dos eventos de histórico.

**GREEN (papel `backend`)** — commit `feat(green): consultas de evidência, proteção LGPD de matrículas e download com auditoria prévia (R11, R12, R13, R16, R17)`:
- `srv/tratativa-service.cds`: functions `listarEvidenciasAcao`, `listarEvidenciasTratativa`, `baixarEvidencia` e tipos `ItemEvidencia`, `ItemEvidenciaTratativa`, `DetalheDownloadEvidencia`.
- `srv/tratativa/evidencias-consultas.ts`: implementação das listagens e download com regras de menor privilégio, mascaramento de matrícula para não-gestores, recuperação de binário pelo serviço `ArmazenamentoEvidencias` e inserção do histórico `DownloadEvidencia` na mesma transação sem bloqueio pessimista da Tratativa.
- `srv/tratativa-service.ts`: registro dos handlers de `listarEvidenciasAcao`, `listarEvidenciasTratativa` e `baixarEvidencia`.
- Execução de `sh agentic/mecanismos/scripts/verify.sh` passando 100% verde.

---

## N3 aprovados no Gate 1
- N3-1 (deploy/infra): Abstração de armazenamento desacoplado de binários via serviço CAP (`ArmazenamentoEvidencias`): dublê em memória isolado em `test/apoio/` no MVP; binding e configuração de Object Store / DMS em produção entregues no intent 014 (etapas 1 e 4; R5; I6, I7).
- N3-2 (deploy/infra): Configuração do limite de corpo HTTP do runtime em 20 MB no `package.json` (`cds.server.body_parser.limit = "20mb"`), que afeta o servidor Express/CAP (etapa 1; R14; I2).
- N3-3 (autorização/segurança): Autorização com grant `{ grant: ['anexarEvidencia', 'removerEvidencia'], to: 'authenticated-user' }` no `@restrict` do CDS, recusa estática de `AplicativoOrigem` no `before('*')`, e autorização dinâmica no domínio restrita ao Gestor de Tratativa e ao Responsável da respectiva Ação/Subação (etapas 1, 2 e 4; R6, R11; C2).
- N3-4 (LGPD): Dados pessoais e sensíveis em Evidências: laudos e fotos com `@PersonalData`, `EntitySemantics: 'Other'`, `@PersonalData.IsPotentiallyPersonal` em `nomeArquivo` e `descricao`, omissão de matrículas como `null` para não-Gestores, histórico sem nome de arquivo, auditoria mandatória prévia `DownloadEvidencia` e retenção sob remoção lógica (etapas 1, 2, 3 e 4; R2, R10, R11, R12; I7).
- N3-5 (contrato público OData V4): Novas actions ligadas `anexarEvidencia` e `removerEvidencia` no entity set `Tratativas`, e novas functions públicas `listarEvidenciasAcao`, `listarEvidenciasTratativa`, `baixarEvidencia` e `listarPendenciasEvidenciasTratativa` no contrato OData V4 em `/api/tratativa/v1` (etapas 1, 2, 3 e 4; R11, R17; I1, I8).
- N3-6 (contrato de erros): Extensão formal do catálogo de erros da decisão D10 com os códigos HTTP 413 (runtime para corpo > 20 MB e domínio para arquivo entre 10 MB e 14 MB) e 415 (domínio para formato/MIME inválido) (etapa 1; R4, R14, R17; I2).

---

## Critérios de pronto
- Etapa 1: CA1, CA2, CA3, CA4, CA5, CA7, CA8, CA9, CA10, CA10a, CA10b, CA10c, CA11, CA12, CA13, CA13a, CA14, CA15, CA16, CA17, CA18, CA19, CA20, CA21, CA22, CA23, CA24 (anexo), CA25, CA26, CA27, CA28, CA49, CA51, CA52, CA53, CA55, CA56 (anexo), CA57, CA57a (anexo), CA57b, CA58, CA59, CA59a, CA60, CA62, CA63.
- Etapa 2: CA6, CA18 (remoção), CA19 (remoção), CA20 (remoção), CA21 (remoção), CA22 (remoção), CA23 (remoção), CA24 (remoção), CA25 (remoção), CA26 (remoção), CA27 (remoção), CA39, CA41a, CA42, CA50, CA51 (remoção), CA52 (remoção), CA54, CA56 (remoção), CA57a (remoção), CA61.
- Etapa 3: CA29, CA30, CA31, CA32, CA33, CA34, CA35, CA36, CA37, CA38, CA38a, CA64, CA65, CA66, CA68, CA69.
- Etapa 4: CA7 (leitura), CA24 (leitura/download), CA40, CA41, CA43, CA44, CA45, CA46, CA47, CA47a, CA47b, CA48, CA48a, CA50a, CA50b, CA52 (download), CA54a, CA56 (download), CA57a (leitura/download), CA61a, CA61b, CA67, CA70.
- Cobertura integral de todos os 87 Critérios de Aceite da spec `evidencias`.
- Todos os testes de intents anteriores (002, 003, 004 em `agentic/.estado/worktrees/plano-de-acao-001-acoes-hierarquicas/` e 005) mantidos íntegros e 100% verdes (harmonizados via Ruling R-10).
- Quatro pares de commits `test(red):` e `feat(green):` registrados sequencialmente na branch, cada RED validado pelo script `verifica-red.sh`.
- `sh agentic/mecanismos/scripts/verify.sh` passando 100% limpo ao fim da branch.

---

## Questões em aberto
- Nenhuma questão impeditiva técnica para execução. As decisões delegadas Q1 a Q19 e os itens N3 (N3-1 a N3-6) aguardam ratificação formal do humano no Gate 1.
