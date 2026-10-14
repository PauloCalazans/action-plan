# Task 001: ver-anexo-evidencia

**Spec:** agentic/projeto/specs/ver-anexo-evidencia/spec.md
**Status:** em-andamento
<!-- pendente | em-andamento | em-revisão | publicada (integrada não é escrito: deriva do git) -->
**Branch:** ver-anexo-evidencia/001-ver-anexo-evidencia

## Objetivo
Disponibilizar o acesso ao anexo de Evidências na tabela da Object Page de Tratativas (`app/tratativas`), transformando o nome do arquivo em um link clicável que abre arquivos exibíveis (PNG, JPG, PDF, TXT) diretamente no navegador (`inline`) ou dispara o download com nome original nos demais formatos (`attachment`), com autorização dinâmica estrita, gravação de auditoria mandatória prévia (`DownloadEvidencia`), compatibilidade com os dois caminhos de navegação da UI (direto e por contenção) e preservação estrita do `TratativaService` existente e das regras de mascaramento LGPD.

## Arquivos

### Criados
- `test/ver-anexo-evidencia.test.ts`

### Modificados
- `srv/tratativa-app-service.cds`: adição do elemento virtual de mídia `conteudo : LargeBinary @Core.MediaType: mimeType @Core.ContentDisposition.Filename: nomeArquivo` na projeção `Evidencias` de `TratativaAppService`, mantendo `where ativo = true` e as ações de linha existentes.
- `srv/tratativa-app-service.ts`:
  - registro do handler `this.on('READ', 'Evidencias', ...)` para interceptar o acesso à propriedade `query._propertyAccess === 'conteudo'` e despachar para `servirAnexoEvidencia(req)`;
  - atribuição em `after('READ', 'Evidencias')` de `linha['conteudo@odata.mediaContentType'] = linha.mimeType` só para linhas de dados (objeto com `mimeType`, nunca o `Readable` devolvido no acesso ao stream — M2 da revisão de design r1), habilitando a visibilidade do link pelo template do Fiori elements v4 (`fileStreamNotEmpty`).
- `srv/tratativa/evidencias-consultas.ts`:
  - extração do núcleo comum de validação de vínculo, recuperação do storage e auditoria mandatória prévia para a função compartilhada `processarDownloadEvidencia(req, dados, mensagemRecusa403)`;
  - refatoração de `baixarEvidencia` para delegar a `processarDownloadEvidencia(req, dados, 'Forbidden')` mantendo sua assinatura, resposta Base64 e suíte de testes (spec 006) 100% inalteradas.
- `srv/tratativa/operacoes-linha-app.ts`:
  - exportação da interface `EvidenciaDaLinha` e implementação da função `servirAnexoEvidencia(req: cds.Request)`;
  - resolução do registro da Evidência suportando caminho direto (`Evidencias(e)/conteudo`) e por contenção (`Tratativas(t)/evidencias(e)/conteudo`) via `localizarEvidenciaDaLinha`, com validação de UUID e divergência de chaves;
  - aplicação da ordem estrita de precedência: 401 não autenticado, 403 AplicativoOrigem, 404 Evidência não encontrada (inexistente ou inativa `ativo === false`), 404 Ação não encontrada;
  - invocação de `processarDownloadEvidencia(req, dados, 'Acesso negado.')`;
  - resolução dinâmica de `Content-Type: mimeType` e `Content-Disposition: inline|attachment; filename="..."`;
  - entrega do binário via `req.reply(Readable.from(buffer))`.
- `app/tratativas/annotations.cds`:
  - substituição da coluna `{ $Type: 'UI.DataField', Value: nomeArquivo }` por `{ $Type: 'UI.DataField', Value: conteudo }` na anotação `UI.LineItem` de `TratativaAppService.Evidencias`;
  - adição de `conteudo @title: 'Nome do arquivo';` no bloco de anotações de títulos de `TratativaAppService.Evidencias`.

### Removidos
- Nenhum arquivo.

## Interfaces
- **Produz (HTTP, `/api/app/v1`):**
  - `GET Evidencias(<codigo>)/conteudo` → stream binário do anexo, cabeçalhos `Content-Type: <mimeType>`, `Content-Disposition: <inline|attachment>; filename="<nomeArquivo>"`;
  - `GET Tratativas(<t>)/evidencias(<codigo>)/conteudo` → stream binário equivalente pelo caminho de contenção utilizado pelo Fiori Elements;
  - `linha['conteudo@odata.mediaContentType']` em consultas OData de leitura (`GET .../Evidencias`), ativando a renderização nativa de link pelo Fiori Elements v4.
- **Produz (servidor, `srv/tratativa/evidencias-consultas.ts` e `srv/tratativa/operacoes-linha-app.ts`):**
  - `processarDownloadEvidencia(req: cds.Request, dados: { codigoTratativa: string; codigoAcao: string; codigoEvidencia: string; responsavelAcao: string; mimeType: string; tamanho: number; }, mensagemRecusa403?: string): Promise<Buffer>`;
  - `servirAnexoEvidencia(req: cds.Request): Promise<void>`;
  - `EvidenciaDaLinha` (interface TypeScript).
- **Consome, sem alterar regra:**
  - `getStorage` (`srv/tratativa/evidencias-storage.ts`);
  - `registrarHistorico` (`srv/tratativa/historico.ts`);
  - `usuarioEhValidadorHabilitado` (`srv/tratativa/validacao-tecnica-consultas.ts`);
  - `usuarioAutenticadoEhMatricula` e `obterMatriculaUsuario` (`srv/tratativa/identidade.ts`);
  - `codigoValido` (`srv/tratativa/consulta.ts`);
  - `recusar` (`srv/tratativa/recusa.ts`);
  - `localizarEvidenciaDaLinha` (`srv/tratativa/operacoes-linha-app.ts`).

## N3 aprovados no Gate 1
- N3-1 (design): Contrato novo do `/api/app/v1` (`TratativaAppService`).
- N3-2 (design): Autorização e auditoria no acesso ao arquivo binário.
- N3-3 (design): Privacidade e LGPD dos anexos de evidências.

(Os três itens ficam pendentes de aprovação no Gate 1, delegado ao orquestrador. Mudança N3 fora desta lista exige parar.)

## Critérios de pronto

### Etapa 1: testes automatizados (RED)
- Implementação da suíte completa de testes em `test/ver-anexo-evidencia.test.ts` (`test(red): ver anexo de evidência no app`), utilizando `cds.test` com SQLite em memória e o dublê `test/apoio/armazenamento-espiao.ts`.
- Cobertura obrigatória de todos os critérios de aceite automatizáveis:
  - **CA2 (PNG inline):** Gestor acessa anexo PNG (`foto-guarda-corpo-reapertado.png`) e recebe status 200, `content-type: image/png`, `content-disposition: inline; filename="foto-guarda-corpo-reapertado.png"` e buffer idêntico ao gravado no storage.
  - **CA3 (PDF inline):** Gestor acessa anexo PDF (`lista-presenca-integracao.pdf`) e recebe status 200, `content-type: application/pdf`, `content-disposition: inline; filename="lista-presenca-integracao.pdf"` e buffer idêntico.
  - **CA4 (TXT inline):** Gestor acessa anexo TXT (`os-troca-mangueira.txt`) e recebe status 200, `content-type: text/plain`, `content-disposition: inline; filename="os-troca-mangueira.txt"` e buffer idêntico.
  - **CA5 (CSV attachment):** Gestor acessa anexo CSV (`certificados-calibracao.csv`) e recebe status 200, `content-type: text/csv`, `content-disposition: attachment; filename="certificados-calibracao.csv"` e buffer idêntico.
  - **CA6 (Matriz de autorização e segregação de subações):**
    - Responsável da Ação (ex.: `M1001`) acessa com 200 o anexo de sua Ação;
    - Validador Técnico com parecer pendente na Tratativa acessa com 200 o anexo;
    - Responsável da Ação mãe tentando acessar anexo de Subação recebe 403 `'Acesso negado.'`;
    - Responsável de Subação tentando acessar anexo da Ação mãe recebe 403 `'Acesso negado.'`.
  - **CA7 (Recusa 403 para terceiros):** usuário comum (`usuario`), Responsável de outra Ação, Responsável Principal da Tratativa (sem responsabilidade na Ação específica) e Participante sem responsabilidade na Ação recebem 403 `'Acesso negado.'` e nenhum byte é transmitido.
  - **CA8 (Origem e não-autenticado):** chamada autenticada como `AplicativoOrigem` recebe 403 `'Acesso negado.'`; chamada sem autenticação recebe 401 do runtime.
  - **CA9 (Precedência da existência física e lógica):** Evidência inexistente (UUID não cadastrado) ou inativa (`ativo === false`, ex.: `a3000000-0000-4000-8000-000019000022`) responde 404 `'Evidência não encontrada.'`, inclusive para usuário sem vínculo (existência precede autorização). Chave não UUID responde 404 `'Evidência não encontrada.'`.
  - **CA10 (Auditoria prévia):** download aceito gera registro `DownloadEvidencia` no histórico da Ação (`HistoricoAcoes`), contendo `evidencia`, `mimeType`, `tamanho`, sem Nome do arquivo nem conteúdo; acessos recusados (403 ou 404) não geram nenhum registro de histórico.
  - **CA11 (Aborto transacional por falha de auditoria):** com falha simulada no registro de histórico, a requisição é abortada com erro e nenhum byte do binário é entregue ao solicitante.
  - **CA12 (Minimização LGPD):** `GET /api/app/v1/Tratativas(t)/evidencias` e `$expand=evidencias` não incluem o binário na resposta JSON; `autorAnexo` vem mascarado como `null` para não-Gestores.
  - **CA13 (Acesso direto vs visibilidade):** usuário sem vínculo tentando acesso direto a Evidência recebe 403 `'Acesso negado.'`. Na listagem filtrada pela máscara, não-Gestores só veem as Evidências de suas Ações, todas com o link de mídia anotado.
  - **CA14 (Mensagens de erro):** respostas de erro retornam rigorosamente `Acesso negado.` (403) e `Evidência não encontrada.` (404), sem vazamento de stack ou partes do arquivo. O endpoint existente `TratativaService.baixarEvidencia` continua retornando `Forbidden`.
  - **CA15 (Qualquer status):** download aceito (200) mesmo quando a Tratativa está `Encerrada` ou `Cancelada` e a Ação está `Concluída` ou `Cancelada`.
  - **CA16 (Suíte 006 intacta):** os testes existentes de `test/evidencias-*.test.ts` e de `TratativaService` executam com 100% de sucesso sem modificação.
  - **CA17 (Minhas Pendências e Administração):** não contêm rota de stream de Evidências.
  - **CA18 (Generalidade):** funcionamento idêntico para Tratativa de Origem e Tratativa avulsa.
  - **CA19 (Esteira limpa):** suíte executa e passa sem navegador real nem chamadas de rede externas.
  - **Dois caminhos:** todas as asserções de acesso ao stream são comprovadas tanto pelo caminho direto (`Evidencias(e)/conteudo`) quanto pelo caminho por contenção (`Tratativas(t)/evidencias(e)/conteudo`). Caminho com chave `t` divergente da tratativa da evidência ou `t` malformada responde 404 `'Evidência não encontrada.'`.
  - **Validação estática de anotações e CSN:** verificação de que `TratativaAppService.Evidencias` possui a propriedade `conteudo` anotada com `Core.MediaType: mimeType` e `Core.ContentDisposition.Filename: nomeArquivo`, e que `UI.LineItem` aponta para `conteudo` com título `'Nome do arquivo'`.

### Etapa 2: implementação (GREEN)
- Ajuste das definições CDS em `srv/tratativa-app-service.cds` e anotações em `app/tratativas/annotations.cds`.
- Extração de `processarDownloadEvidencia` em `srv/tratativa/evidencias-consultas.ts` mantendo `baixarEvidencia` funcional.
- Implementação de `servirAnexoEvidencia` em `srv/tratativa/operacoes-linha-app.ts`.
- Registro dos handlers em `srv/tratativa-app-service.ts` (`on('READ', 'Evidencias')` e `after('READ', 'Evidencias')`).
- `srv/tratativa/mascara-app.ts` e `db/tratativa.cds` permanecem estritamente inalterados.

### Verificação visual (navegador local, `cds watch` + FLP sandbox)
- **CA1:** Ao carregar a Object Page da Tratativa no Launchpad como Gestor, na tabela de Evidências, a coluna "Nome do arquivo" renderiza o nome de cada evidência como um link clicável com o ícone correspondente ao MIME type.
- **CA2, CA3, CA4:** Ao clicar no link de uma imagem (PNG), documento PDF ou texto (TXT), o navegador abre o arquivo diretamente em uma nova aba (`inline`).
- **CA5:** Ao clicar no link de um arquivo CSV ou documento do pacote Office (DOCX/XLSX), o navegador efetua o download do arquivo com o nome original gravado na Evidência (`attachment`).
- **CA13:** Como Responsável pela Ação A1, a tabela de Evidências exibe somente as Evidências de A1, todas com o link de anexo ativo e funcionando; terceiros veem a tabela vazia.

### Relatório da task
- Declarar o comportamento nativo de abertura em nova aba (`target="_blank"`) proporcionado pelo Fiori Elements v4.
- Confirmar que `baixarEvidencia` permaneceu intocada em comportamento externo e a suíte da spec 006 permaneceu verde sem alterações de código de teste.
- Confirmar que nenhuma regra de máscara LGPD em `srv/tratativa/mascara-app.ts` foi modificada.

### Esteira
- `sh agentic/mecanismos/scripts/verify.sh` verde.

## Questões em aberto
- Nenhuma além dos 3 itens N3 (N3-1, N3-2, N3-3), pendentes de aprovação no Gate 1 delegado ao orquestrador.
