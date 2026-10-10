# Design: alertas-e-notificacoes

**Spec:** agentic/projeto/specs/alertas-e-notificacoes/spec.md  
**Status:** aprovado

Escopo técnico: monitoramento proativo de prazos, pendências documentais e inatividade por meio da execução automatizada de regras de alerta e notificação multicanal (E-mail e Microsoft Teams) para Tratativas e Ações no `AdministracaoService` (`/api/administracao/v1`), no serviço interno `RotinaAlertasService` (`@protocol: 'none'`) e no domínio `srv/alertas/`, compreendendo:
1. Modelo persistido relacional aditivo em `db/tratativa.cds` contendo a entidade singleton de configuração `ParametrosAlertas` (com carga de baseline sem arquivos CSV em `db/data/`), a entidade de auditoria e rastreabilidade `AlertasEmitidos`, e os tipos enumerados `TipoAlerta`, `EntidadeAlerta`, `CanalNotificacao` e `StatusEnvioAlerta`;
2. Arquitetura desacoplada de portas e adaptadores para os canais de envio (`EmailAdapter` e `TeamsAdapter`) e para a resolução de destinatários (`DiretorioPessoasAdapter`), configurados via `package.json` (`cds.requires`) com dublês em memória isolados em `test/apoio/` (sem dependência de servidores SMTP, Microsoft Graph API, Teams ou SAP SuccessFactors reais, em conformidade com AGENTS.md:38);
3. Serviço interno sem protocolo `RotinaAlertasService` (`srv/rotina-alertas-service.cds`, `@protocol: 'none'`) expondo a action `executar(agora : Timestamp) returns RelatorioProcessamentoAlertas`, acionada via `cds.connect.to('RotinaAlertasService')` pelo agendador de produção (intent 014) e pelas suítes de teste automatizadas com relógio determinístico injetado, no mesmo padrão consolidado do `TratativaInternaService` do 002 (Ruling R-02 da 010);
4. Motor autônomo de regras de negócio em código TypeScript/Node.js (sem dependência de SAP Build Process Automation / Business Rules, garantindo testes 100% locais com SQLite em memória) avaliando as 4 modalidades de alerta: `PrazoProximo`, `PrazoVencido`, `Inatividade` e `EvidenciaPendente`;
5. Cálculo dinâmico e puramente derivado da data de última atividade da Tratativa (`max(criadoEm da Tratativa, max(quando de HistoricoTratativa e HistoricoAcoes), max(criadoEm de Comentarios))`), sem inclusão de colunas físicas na tabela `Tratativas`;
6. Congelamento estrito de registros finalizados: Tratativas `Encerrada` ou `Cancelada` e Ações `Concluída` ou `Cancelada` nunca geram alertas;
7. Garantia de idempotência diária no fuso UTC baseada na chave composta `(tipoAlerta, entidade, tratativaId, acaoId, destinatarioMatricula, canal, dataEnvioYMD)` (onde `dataEnvioYMD` é extraída estritamente em UTC via `instante.toISOString().slice(0, 10)`), impedindo múltiplos envios bem-sucedidos para o mesmo destinatário e canal no mesmo dia civil;
8. Resiliência transacional e isolamento de falhas: indisponibilidade ou erro em um destinatário/canal registra falha em `AlertasEmitidos` sem abortar o processamento do lote e sem interferir no estado transacional das ocorrências;
9. Salvaguarda estrita de dados pessoais sob LGPD (AGENTS.md:66): mensagens neutras contendo estritamente Tipo, Código da Tratativa, Título, Código da Ação, Prazo formatado (DD/MM/AAAA) e URL direta segura de acesso, sendo terminantemente proibida a inclusão de descrições detalhadas, comentários, laudos médicos ou anexos de evidência;
10. Governança administrativa e relatórios de auditoria no `AdministracaoService`: operações `consultarParametrosAlertas`, `atualizarParametrosAlertas`, `executarProcessamentoAlertas` (disparo manual sob demanda restrito ao Administrador) e `listarAlertasEmitidos` (com filtros, paginação e ordenação cronológica decrescente);
11. Precedência consolidada de recusas em 8 etapas com códigos HTTP padronizados conforme a decisão D10, com recusa estática de `AplicativoOrigem` (HTTP 403 `Acesso negado.`) verificada na etapa 2 no início do handler antes de qualquer consulta ao banco;
12. Universalidade e genericidade (AGENTS.md:36): parametrização global única para toda a plataforma sem variação por Origem ou área de negócio no código do MVP.

---

## Decisões

1. **Modelo persistido: aditivo em `db/tratativa.cds`, sem CSV de carga inicial** (R1, R2, R10; N3-1; Q1, Q4, Q14).
   - Adicionada a entidade singleton `ParametrosAlertas` para governança global de parâmetros de alertas:
     ```cds
     @PersonalData.EntitySemantics: 'Other'
     entity ParametrosAlertas : managed {
       key chave                        : String(10); // 'GLOBAL'
           diasAntecedenciaPrazoProximo : Integer not null default 3;
           diasInatividade              : Integer not null default 15;
           emailHabilitado              : Boolean not null default true;
           teamsHabilitado              : Boolean not null default true;
           horaExecucaoUtc              : Integer not null default 8;
     }
     ```
   - Adicionada a entidade `AlertasEmitidos` para auditoria dedicada, rastreabilidade e idempotência de despachos:
     ```cds
     @PersonalData.EntitySemantics: 'Other'
     entity AlertasEmitidos {
       key id           : UUID;
           tipo         : TipoAlerta not null;
           entidade     : EntidadeAlerta not null;
           tratativa    : Association to one Tratativas not null;
           acao         : Association to one Acoes;
           @PersonalData.IsPotentiallyPersonal
           destinatario : String(50) not null; // matrícula do colaborador
           canal        : CanalNotificacao not null;
           enviadoEm    : Timestamp not null;
           statusEnvio  : StatusEnvioAlerta not null;
           motivoFalha  : String(255);
           dadosAlerta  : String(1000); // Metadados resumidos (Título, Prazo formatado)
     }
     ```
   - Adicionados os tipos enumerados fechados: `TipoAlerta` (`PrazoProximo`, `PrazoVencido`, `Inatividade`, `EvidenciaPendente`), `EntidadeAlerta` (`Tratativa`, `Acao`), `CanalNotificacao` (`Email`, `Teams`) e `StatusEnvioAlerta` (`Sucesso`, `Falha`).
   - **Carga de baseline sem CSV:** a inicialização dos parâmetros vigentes padrão (`diasAntecedenciaPrazoProximo = 3`, `diasInatividade = 15`, `emailHabilitado = true`, `teamsHabilitado = true`, `horaExecucaoUtc = 8`) é executada programaticamente pelo domínio via seed sob demanda (`obterOuCriarParametros`) caso o registro singleton não exista, sem arquivos CSV em `db/data/`.
   — **Por quê:** atende à diretriz estrita de R2 e AGENTS.md:36. Arquivos CSV em `db/data/` no SAP HANA Cloud são tratados como `.hdbtabledata` e sobrescrevem parâmetros alterados pelo Administrador a cada novo deploy HDI. O seed programático sob demanda inicializa o singleton de forma idempotente sem risco de regressão em produção. O histórico da Tratativa (`HistoricoTratativa`) permanece limpo de alertas diários (AGENTS.md:40, Q14), isolando a auditoria de entrega em `AlertasEmitidos`.
   — **Verificado por:** compilação `cds compile db --to sql` gerando `CREATE TABLE` aditivos sem alterações destrutivas em tabelas existentes; testes de consulta e alteração de parâmetros (CA1, CA4, CA10, CA48).

2. **Superfície do `AdministracaoService`: expansão com grants somados e operações tipadas** (R2, R3, R9, R11; N3-2; Q13; Parecer 2).
   - O serviço `AdministracaoService` (`/api/administracao/v1`) é ajustado para permitir acesso autenticado de Administradores e Gestores de Tratativa:
     `@requires: ['Administrador', 'GestorTratativa']`
   - As entidades preexistentes `PrazosCriticidade` e `CredenciaisAplicativo` mantêm integralmente seus `@restrict` originais intactos:
     `@restrict: [{ grant: ['READ', 'UPDATE'], to: 'Administrador' }]` em `PrazosCriticidade`.
     `@restrict: [{ grant: ['READ', 'CREATE', 'UPDATE'], to: 'Administrador' }]` em `CredenciaisAplicativo`.
   - Adicionadas 4 novas operações tipadas:
     * `function consultarParametrosAlertas() returns DetalheParametrosAlertas;` com `@restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]`;
     * `action atualizarParametrosAlertas(...) returns DetalheParametrosAlertas;` com `@restrict: [{ grant: '*', to: 'Administrador' }]`;
     * `action executarProcessamentoAlertas() returns RelatorioProcessamentoAlertas;` com `@restrict: [{ grant: '*', to: 'Administrador' }]`;
     * `function listarAlertasEmitidos(...) returns many ItemAlertaEmitido;` com `@restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]`.
   - **Grants somados sem `annotate` sobrescritivo:** todas as anotações `@restrict` são declaradas diretamente no corpo do serviço em `srv/administracao-service.cds`, preservando os grants anteriores sem substituição destrutiva de arrays de autorização.
   - **Tipos qualificados:** tipos derivados do modelo utilizam prefixo `m.` (`m.TipoAlerta`, `m.EntidadeAlerta`, `m.CanalNotificacao`, `m.StatusEnvioAlerta`).
   — **Por quê:** garante que o `GestorTratativa` consulte parâmetros e relatórios de alertas sem violar a segurança das credenciais e prazos de criticidade que permanecem restritos ao `Administrador`. O `AplicativoOrigem` é barrado no início do handler pelo hook `before('*')` (R13). A action pública `executarProcessamentoAlertas` delega a execução à rotina de alertas (`processarAlertas`), mantendo paridade com o serviço interno.
   — **Verificado por:** compilação `npm run build`, conferência de `$metadata` e testes de controle de acesso (CA1, CA2, CA3, CA4, CA5, CA9, CA46, CA47, CA50).

3. **Portas e adaptadores para canais e diretório: abstração desacoplada em `package.json` (`cds.requires`)** (R5, R6; N3-3, N3-4; Q6, Q11; AGENTS.md:38; Ruling R-02 I1).
   - As integrações externas são modeladas como portas de serviço CAP (`srv/alertas/portas.ts`):
     * `EmailPort`: `enviarEmail(destinatario: string, assunto: string, corpo: string): Promise<void>;`
     * `TeamsPort`: `enviarMensagem(destinatarioTeamsId: string, titulo: string, corpo: string): Promise<void>;`
     * `DiretorioPessoasPort`: `resolverPessoa(matricula: string): Promise<{ email: string; teamsId: string } | null>;`
   - **Configuração no `package.json` (`cds.requires`):**
     ```json
     "cds": {
       "requires": {
         "EmailAdapter": {
           "impl": "srv/alertas/email-adapter",
           "[development]": { "impl": "test/apoio/email-espiao" },
           "[test]": { "impl": "test/apoio/email-espiao" }
         },
         "TeamsAdapter": {
           "impl": "srv/alertas/teams-adapter",
           "[development]": { "impl": "test/apoio/teams-espiao" },
           "[test]": { "impl": "test/apoio/teams-espiao" }
         },
         "DiretorioPessoasAdapter": {
           "impl": "srv/alertas/diretorio-pessoas-adapter",
           "[development]": { "impl": "test/apoio/diretorio-espiao" },
           "[test]": { "impl": "test/apoio/diretorio-espiao" }
         }
       }
     }
     ```
   - **Dublês em memória (`test/apoio/`):**
     * `test/apoio/email-espiao.ts`: captura envios em array em memória; provê `limparEnviosEmail()`, `obterEnviosEmail()`, `falharProximoEmail()`.
     * `test/apoio/teams-espiao.ts`: captura notificações 1:1 em memória; provê `limparEnviosTeams()`, `obterEnviosTeams()`, `falharProximoTeams()`.
     * `test/apoio/diretorio-espiao.ts`: resolução padrão determinística `<matricula.toLowerCase()>@empresa.com`; provê `definirPessoaDiretorio()`, `simularFalhaMatricula()`, `limparDiretorio()`.
     * **Regra Inviolável:** nenhum helper em `test/apoio/` contém asserções (`expect(`), e nenhum teste em `test/` importa arquivos de `srv/`.
   - **Resolução de pessoas no MVP:** o `DiretorioPessoasAdapter` resolve matrículas de forma determinística em minúsculas (`m1001` → `m1001@empresa.com`), antecipando a integração com SAP SuccessFactors que será plugada no intent 011 sem modificar o domínio de alertas.
   — **Por quê:** cumpre a regra inviolável de AGENTS.md:38 (testes nunca dependem de SMTP, Graph API, Teams ou SF reais), permite simulação controlada de indisponibilidade de rede e prepara a extensão do intent 011 de forma desacoplada. `package.json` entra no escopo formal da task como item N3 de infraestrutura (Ruling R-02 I1).
   — **Verificado por:** testes com os dublês espiões (CA34, CA35, CA36, CA37, CA39, CA40, CA59).

4. **Rotina de alertas agendada como serviço interno sem protocolo (`RotinaAlertasService`)** (R1, R4, R8, R9, R14; N3-7; Q1, Q2, Q3, Q7, Q8, Q12; Ruling R-02 I2).
   - A rotina automática de execução de alertas é declarada no serviço interno `RotinaAlertasService` em `srv/rotina-alertas-service.cds` com anotação `@protocol: 'none'`:
     ```cds
     @protocol: 'none'
     service RotinaAlertasService {
       action executar(agora : Timestamp) returns AdministracaoService.RelatorioProcessamentoAlertas;
     }
     ```
   - **Disparo interno sem importação de `srv/` (Ruling R-02 I2):**
     * O agendador periódico de produção (artefato do intent 014) e as suítes de testes automatizados disparam a rotina exclusivamente via `cds.connect.to('RotinaAlertasService')`:
       `const rotina = await cds.connect.to('RotinaAlertasService'); await rotina.send('executar', { agora });`
     * Esse mecanismo segue exatamente o padrão consolidado em `test/criticidade-gestor.test.ts:33` com o `TratativaInternaService` do 002. Os arquivos de testes em `test/` **nunca importam a camada `srv/`**, satisfazendo integralmente o isolamento arquitetural.
   - **Relógio determinístico injetado:** o parâmetro `agora : Timestamp` transporta o instante temporal fixado pelo teste ou pelo agendador, garantindo repetibilidade de cenários e total independência do relógio da máquina de execução.
   - **Regras avaliadas:**
     * `PrazoProximo`:
       - Ações/Subações (`Pendente`, `Em andamento`): `0 <= (prazo - dataRef) <= diasAntecedenciaPrazoProximo` → notifica `Responsável da Ação`;
       - Tratativas (`Aberta`, `Em andamento`): `0 <= (dataPrevistaConclusao - dataRef) <= diasAntecedenciaPrazoProximo` → notifica `Responsável Principal` (se ausente, não despacha);
     * `PrazoVencido`:
       - Ações/Subações: `prazo < dataRef` → notifica `Responsável da Ação` e `Responsável Principal` da Tratativa (se houver);
       - Tratativas: `dataPrevistaConclusao < dataRef` → notifica `Responsável Principal` (se houver);
     * `Inatividade`:
       - Tratativas (`Aberta`, `Em andamento`): `dataRef - ultimaAtividade > diasInatividade` → notifica `Responsável Principal`; se não houver RP mas houver `Participantes`, notifica todos os Participantes; se não houver nenhum, não despacha;
     * `EvidenciaPendente`:
       - Ações/Subações (`Pendente`, `Em andamento`) com `evidenciaObrigatoria = true` e zero evidências ativas anexadas (`ativo = true`):
         - Se no prazo (`prazo - dataRef <= diasAntecedenciaPrazoProximo` e `>= 0`): notifica `Responsável da Ação`;
         - Se vencida (`prazo < dataRef`): notifica `Responsável da Ação` e `Responsável Principal` da Tratativa;
   - **Última atividade estritamente derivada:**
     `ultimaAtividade = max(criadoEm da Tratativa, max(quando de HistoricoTratativa e HistoricoAcoes), max(criadoEm de Comentarios))`. Nenhuma coluna física é adicionada a `Tratativas` (007 R9, 008 R2; Achados 3 e 4).
   - **Congelamento:** Tratativas `Encerrada`/`Cancelada` e Ações `Concluída`/`Cancelada` são imediatamente excluídas da varredura.
   — **Por quê:** cumpre a diretriz de Ruling R-02 I2, viabiliza o acionamento dos testes de regras da Etapa 2 sem acoplamento a código de `srv/`, elimina dependência de serviços externos de nuvem (sem SAP BTP Business Rules, Q12) e preserva a integridade do modelo relacional.
   — **Verificado por:** testes funcionais cobrindo cada modalidade, inatividade e registros finalizados acionados via `cds.connect.to('RotinaAlertasService')` (CA11-CA33, CA66).

5. **Idempotência estrita diária em UTC e resiliência a falhas** (R10, R12; Q7; AGENTS.md:40; Achado 5).
   - **Chave lógica de idempotência diária:**
     `tipoAlerta + '|' + entidade + '|' + tratativaId + '|' + (acaoId || '') + '|' + destinatario + '|' + canal + '|' + dataEnvioYMD`.
   - **Data civil estritamente em UTC (Achado 5):** `dataEnvioYMD` é obtida extraindo a data no fuso UTC (`instante.toISOString().slice(0, 10)`), prevenindo desvios provocados por fusos locais como o de Brasília (`srv/lib/relogio.ts:dataCivil`).
   - Antes do despacho por canal, o motor consulta `AlertasEmitidos` para verificar se já existe registro com `statusEnvio = 'Sucesso'` para a mesma chave lógica na mesma data UTC:
     * Se existir: o envio é omitido silenciosamente (CA44).
     * Se não existir: o despacho é executado via adaptador correspondente.
   - **Despacho 1:1 no Microsoft Teams (CA38):** mensagens Teams são transmitidas exclusivamente em chat direto individual 1:1 ao colaborador, sendo terminantemente proibido o disparo em canais compartilhados de equipes.
   - **Isolamento de falhas e integridade transacional:**
     * Falhas de rede ou timeout em um canal/destinatário não abortam o processamento dos demais alertas do lote (CA59).
     * A falha é persistida em `AlertasEmitidos` com `statusEnvio = 'Falha'` e detalhamento em `motivoFalha`.
     * Falhas não marcam sucesso na chave de idempotência, tornando o alerta elegível para nova tentativa na execução seguinte (CA60).
     * O despacho de alertas nunca efetua rollback nem altera o estado das entidades de negócio (`Tratativas`, `Acoes`) (CA61).
   — **Por quê:** evita reenvio abusivo (spam) em caso de reinicializações do lote, protege a privacidade corporativa no Teams e isola o ciclo de vida transacional da ocorrência de instabilidades em mensageria externa.
   — **Verificado por:** testes de idempotência repetida no mesmo dia, disparos subsequentes em dias seguintes e injeção de erros de rede nos adaptadores (CA43, CA44, CA45, CA59, CA60, CA61).

6. **Proteção de dados pessoais sob LGPD no conteúdo das mensagens** (R7; N3-5; Q9; AGENTS.md:66).
   - O conteúdo de todas as mensagens transmitidas (E-mail e Microsoft Teams) é formatado em estrita conformidade com a LGPD:
     * Idioma: obrigatoriamente português do Brasil (pt-BR);
     * Elementos permitidos no corpo e assunto:
       1. Tipo do alerta (ex.: "Prazo Próximo", "Prazo Vencido", "Ausência de Atualização", "Evidência Obrigatória Pendente");
       2. Código da Tratativa (UUID);
       3. Título da Tratativa;
       4. Código da Ação (quando aplicável);
       5. Data de Prazo formatada como `DD/MM/AAAA`;
       6. Link seguro direto (URL) para a aplicação: `https://plataforma.empresa.com/tratativas/<codigo>`.
     * **Vedação absoluta de dados sensíveis:** é estritamente proibida a inclusão de: Descrição detalhada da ocorrência, Descrição da Ação, textos de comentários, laudos ocupacionais ou médicos, nomes de terceiros e arquivos/fotos de evidência.
   — **Por quê:** e-mails corporativos e mensagens de chat trafegam por servidores externos e clientes de terceiros fora do controle de autorização da aplicação. Dados de acidentes e ocorrências de trabalho configuram dados pessoais e sensíveis sob a LGPD (Art. 5º e 11 da Lei 13.709/2018). O colaborador deve autenticar-se na plataforma para visualizar o conteúdo sob menor privilégio (004 R26, 005 R17, 006 R11, 007 R7).
   — **Verificado por:** testes de inspeção de conteúdo das mensagens capturadas pelos dublês (CA41, CA42).

7. **Consulta e auditoria de alertas emitidos com paginação e ordenação** (R11; N3-2; Q13).
   - Operação pública em `AdministracaoService`:
     ```cds
     function listarAlertasEmitidos(
       tratativa     : UUID,
       tipo          : String,
       destinatario  : String,
       statusEnvio   : String,
       tamanhoPagina : Integer,
       pagina        : Integer
     ) returns many ItemAlertaEmitido;
     ```
   - **Regras de consulta:**
     * Acesso permitido a `Administrador` e `GestorTratativa` (demais usuários recebem HTTP 403; Aplicativo de origem recebe 403);
     * Filtros opcionais suportados: `tratativa` (UUID da ocorrência), `tipo` (tipo de alerta), `destinatario` (matrícula funcional) e `statusEnvio` (`Sucesso` ou `Falha`);
     * Ordenação: estritamente cronológica decrescente (`enviadoEm DESC`, mais recente primeiro);
     * Paginação: `limit(tamanhoPagina, (pagina - 1) * tamanhoPagina)` com `tamanhoPagina` padrão 50 (máximo 200) e `pagina` padrão 1;
     * Devolve coleção direta `many` sem envelopamento; consulta sem resultados retorna `[]` com HTTP 200; operação estritamente de leitura sem geração de histórico.
   — **Por quê:** viabiliza o acompanhamento e auditoria de entrega para os gestores e suporte sem poluir a linha do tempo executiva da ocorrência.
   — **Verificado por:** testes de listagem com filtros, ordenação decrescente e paginação (CA49, CA50, CA51, CA54, CA58).

8. **Precedência consolidada de recusas para operações de alertas (Decisão D10)** (R13, R15; N3-6; Q13).
   - As 4 operações do intent (`consultarParametrosAlertas`, `atualizarParametrosAlertas`, `executarProcessamentoAlertas` e `listarAlertasEmitidos`) seguem a cadeia de 8 etapas da decisão D10:
     1. Autenticação: não autenticado → HTTP 401;
     2. Papel / Aplicativo de origem: identidade com papel `AplicativoOrigem` ou usuário sem o papel exigido para a operação → HTTP 403 `Acesso negado.` verificado no início do handler no hook `before('*')` antes de consultas ao banco e antes de validar formato/existência;
     3. Forma do pedido no runtime: JSON malformado ou campos fora da assinatura → HTTP 400 do framework CAP antes do handler;
     4. Forma de parâmetros de identificador no domínio: parâmetro `tratativa` malformado (não-UUID) em `listarAlertasEmitidos` → HTTP 400 `Código inválido.` (`target: tratativa`);
     5. Existência no domínio: Tratativa informada em filtro que não existe no banco → HTTP 404 `Tratativa não encontrada.` (`target: tratativa`);
     6. Autorização dinâmica: não aplicável para os endpoints deste intent;
     7. Estado do registro: não aplicável para operações de parametrização e consulta de alertas;
     8. Validação de campos e limites no domínio:
        - `diasAntecedenciaPrazoProximo` fora de 1..30 → HTTP 400 `O campo Dias de antecedência aceita de 1 a 30.` (`target: diasAntecedenciaPrazoProximo`);
        - `diasInatividade` fora de 1..90 → HTTP 400 `O campo Dias de inatividade aceita de 1 a 90.` (`target: diasInatividade`);
        - `horaExecucaoUtc` fora de 0..23 → HTTP 400 `O campo Hora de execução aceita de 0 a 23.` (`target: horaExecucaoUtc`);
        - `tamanhoPagina` fora de 1..200 → HTTP 400 `O campo Tamanho da página aceita de 1 a 200.` (`target: tamanhoPagina`);
        - `pagina` < 1 → HTTP 400 `O campo Página deve ser 1 ou maior.` (`target: pagina`);
        - `tamanhoPagina` é validado antes de `pagina` conforme a ordem do intent 003.
   — **Por quê:** unifica o contrato de erros da plataforma, previne vazamento de dados de existência para o aplicativo de origem (Ruling R-03) e assegura mensagens de erro determinísticas com indicação nominal do campo (`target`).
   — **Verificado por:** testes cobrindo todas as etapas de precedência (CA3, CA5, CA6, CA7, CA8, CA9, CA46, CA47, CA52, CA53, CA55, CA56, CA57, CA63, CA64, CA65).

---

## Contrato executável

### 1. Modelo persistido em `db/tratativa.cds`

```cds
// Declarações aditivas em db/tratativa.cds:

/** R1 (spec alertas-e-notificacoes): modalidades de alertas de negócio. */
type TipoAlerta : String(30) enum {
  PrazoProximo      = 'PrazoProximo';
  PrazoVencido      = 'PrazoVencido';
  Inatividade       = 'Inatividade';
  EvidenciaPendente = 'EvidenciaPendente';
}

/** R10 (spec alertas-e-notificacoes): nível da entidade associada ao alerta. */
type EntidadeAlerta : String(20) enum {
  Tratativa;
  Acao;
}

/** R5 (spec alertas-e-notificacoes): canais corporativos suportados. */
type CanalNotificacao : String(20) enum {
  Email;
  Teams;
}

/** R10 (spec alertas-e-notificacoes): resultado da tentativa de envio. */
type StatusEnvioAlerta : String(20) enum {
  Sucesso;
  Falha;
}

/** R2 (spec alertas-e-notificacoes): entidade singleton de governança global de parâmetros de alerta. */
@PersonalData.EntitySemantics: 'Other'
entity ParametrosAlertas : managed {
  key chave                        : String(10); // 'GLOBAL'
      diasAntecedenciaPrazoProximo : Integer not null default 3;
      diasInatividade              : Integer not null default 15;
      emailHabilitado              : Boolean not null default true;
      teamsHabilitado              : Boolean not null default true;
      horaExecucaoUtc              : Integer not null default 8;
}

/** R10 (spec alertas-e-notificacoes): registro de auditoria e rastreabilidade de alertas emitidos. */
@PersonalData.EntitySemantics: 'Other'
entity AlertasEmitidos {
  key id           : UUID;
      tipo         : TipoAlerta not null;
      entidade     : EntidadeAlerta not null;
      tratativa    : Association to one Tratativas not null;
      acao         : Association to one Acoes;
      @PersonalData.IsPotentiallyPersonal
      destinatario : String(50) not null; // matrícula do colaborador
      canal        : CanalNotificacao not null;
      enviadoEm    : Timestamp not null;
      statusEnvio  : StatusEnvioAlerta not null;
      motivoFalha  : String(255);
      dadosAlerta  : String(1000);
}
```

### 2. Contrato do `AdministracaoService` em `srv/administracao-service.cds`

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

/** Administração da plataforma (R11, R18; spec alertas-e-notificacoes R2, R3, R9, R11). */
@path    : '/api/administracao/v1'
@requires: ['Administrador', 'GestorTratativa']
service AdministracaoService {

  /** R11: o Administrador só altera os dias; a lista de Criticidades é fixa (R7). */
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'UPDATE'], to: 'Administrador' }]
  entity PrazosCriticidade     as projection on m.PrazosCriticidade;

  /** R18: emissão (CREATE) e revogação (UPDATE ativa = false) da credencial de cada aplicativo. */
  @Capabilities: { DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'CREATE', 'UPDATE'], to: 'Administrador' }]
  entity CredenciaisAplicativo as projection on m.CredenciaisAplicativo;

  /** R2, R3 (spec alertas-e-notificacoes): tipo para consulta e atualização de parâmetros. */
  type DetalheParametrosAlertas {
    diasAntecedenciaPrazoProximo : Integer;
    diasInatividade              : Integer;
    emailHabilitado              : Boolean;
    teamsHabilitado              : Boolean;
    horaExecucaoUtc              : Integer;
  }

  /** R9 (spec alertas-e-notificacoes): relatório do processamento de alertas em lote. */
  type RelatorioProcessamentoAlertas {
    ocorrenciasAvaliadas : Integer;
    alertasGerados       : Integer;
    notificacoesEnviadas : Integer;
    falhas               : Integer;
  }

  /** R10, R11 (spec alertas-e-notificacoes): item da listagem de alertas emitidos. */
  type ItemAlertaEmitido {
    id           : UUID;
    tipo         : m.TipoAlerta;
    entidade     : m.EntidadeAlerta;
    tratativa    : UUID;
    acao         : UUID;
    destinatario : String(50);
    canal        : m.CanalNotificacao;
    enviadoEm    : Timestamp;
    statusEnvio  : m.StatusEnvioAlerta;
    motivoFalha  : String(255);
    dadosAlerta  : String(1000);
  }

  /** R3: consulta de parâmetros vigente (Administrador e Gestor de Tratativa). */
  @restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]
  function consultarParametrosAlertas() returns DetalheParametrosAlertas;

  /** R3: atualização de parâmetros de alertas (exclusivo Administrador). */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action atualizarParametrosAlertas(
    diasAntecedenciaPrazoProximo : Integer,
    diasInatividade              : Integer,
    emailHabilitado              : Boolean,
    teamsHabilitado              : Boolean,
    horaExecucaoUtc              : Integer
  ) returns DetalheParametrosAlertas;

  /** R9: disparo do processamento de alertas em lote sob demanda (exclusivo Administrador). */
  @restrict: [{ grant: '*', to: 'Administrador' }]
  action executarProcessamentoAlertas() returns RelatorioProcessamentoAlertas;

  /** R11: consulta paginada de alertas emitidos com filtros (Administrador e Gestor de Tratativa). */
  @restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]
  function listarAlertasEmitidos(
    tratativa     : UUID,
    tipo          : String,
    destinatario  : String,
    statusEnvio   : String,
    tamanhoPagina : Integer,
    pagina        : Integer
  ) returns many ItemAlertaEmitido;
}
```

### 3. Contrato do `RotinaAlertasService` em `srv/rotina-alertas-service.cds`

```cds
using { br.com.calazanstec as m } from '../db/tratativa';
using { AdministracaoService } from './administracao-service';

/**
 * R9 (spec alertas-e-notificacoes; Ruling R-02 da 010): serviço interno sem protocolo (@protocol: 'none')
 * para execução da rotina automática de alertas com relógio fixo injetado.
 * Disparado por testes e pelo agendador (intent 014) via cds.connect.to('RotinaAlertasService').
 */
@protocol: 'none'
service RotinaAlertasService {
  action executar(agora : Timestamp) returns AdministracaoService.RelatorioProcessamentoAlertas;
}
```

### 4. Contrato de Erros e Precedência (D10)

| Etapa | Verificação | Quem valida | HTTP | Mensagem de erro | Target |
|---|---|---|---|---|---|
| 1 | Autenticação | Runtime CAP (`@requires`) | 401 | - | - |
| 2 | Autorização / Papel estático / `AplicativoOrigem` | Handler (`before('*')`) / Runtime (`@restrict`) | 403 | `Acesso negado.` | - |
| 3 | Forma do pedido no runtime | Runtime CAP | 400 | Mensagem do framework | - |
| 4 | Identificador `tratativa` em filtro malformado | Domínio | 400 | `Código inválido.` | `tratativa` |
| 5 | Existência da Tratativa informada em filtro | Domínio | 404 | `Tratativa não encontrada.` | `tratativa` |
| 6 | Autorização dinâmica | Não aplicável | - | - | - |
| 7 | Estado do registro | Não aplicável | - | - | - |
| 8 | Validação de limites: `diasAntecedenciaPrazoProximo` fora de 1..30 | Domínio | 400 | `O campo Dias de antecedência aceita de 1 a 30.` | `diasAntecedenciaPrazoProximo` |
| 8 | Validação de limites: `diasInatividade` fora de 1..90 | Domínio | 400 | `O campo Dias de inatividade aceita de 1 a 90.` | `diasInatividade` |
| 8 | Validação de limites: `horaExecucaoUtc` fora de 0..23 | Domínio | 400 | `O campo Hora de execução aceita de 0 a 23.` | `horaExecucaoUtc` |
| 8 | Validação de limites: `tamanhoPagina` fora de 1..200 | Domínio | 400 | `O campo Tamanho da página aceita de 1 a 200.` | `tamanhoPagina` |
| 8 | Validação de limites: `pagina < 1` | Domínio | 400 | `O campo Página deve ser 1 ou maior.` | `pagina` |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-alertas-e-notificacoes.md` | Entregar o intent 010 completo em 4 etapas sequenciais RED/GREEN: modelo persistido e governança de parâmetros (R2, R3, R5, R6, R13, R15); rotina interna sem protocolo `RotinaAlertasService`, motor de avaliação de regras e cálculo derivado de prazos/inatividade (R1, R4, R8, R9, R16); despacho multicanal, formatação LGPD, idempotência diária e lote sob demanda (R5, R7, R9, R10, R12, R14); e consulta paginada de alertas emitidos com precedência consolidada D10 (R11, R13, R15). | `alertas-e-notificacoes/001-alertas-e-notificacoes` |

---

## Itens N3 (aguardam aprovação no Gate 1)

| Item | Origem | Impacto | Justificativa e Mitigação |
|---|---|---|---|
| N3-1 | R2, R10 | Adição das entidades `ParametrosAlertas` e `AlertasEmitidos` e novos tipos enumerados em `db/tratativa.cds`. | Modificação estritamente aditiva sem migrações destrutivas no SAP HANA Cloud. Inicialização de baseline sem arquivos CSV previne sobrescrita indesejada em deploys HDI. |
| N3-2 | R3, R9, R11 | Expansão de `AdministracaoService` para `@requires: ['Administrador', 'GestorTratativa']` com grants somados e recusa de `AplicativoOrigem` com 403 no `before('*')`. | Permite ao Gestor de Tratativa consultar parâmetros e auditoria de alertas mantendo as operações administrativas e de credenciais restritas ao Administrador, e bloqueando totalmente o Aplicativo de origem antes do acesso ao banco (Ruling R-03). |
| N3-3 | R5 | Criação de portas desacopladas (`EmailAdapter`, `TeamsAdapter`, `DiretorioPessoasAdapter`) configuradas em `package.json` (`cds.requires`) com dublês de teste em `test/apoio/`. | Isola completamente os testes automatizados (AGENTS.md:38), impedindo chamadas a SMTP ou Microsoft Graph API reais e viabilizando execução 100% local com SQLite em memória. Alteração formal de `package.json` registrada no escopo. |
| N3-4 | R6 | Resolução de destinatários baseada em matrícula funcional com resolução padrão determinística `<matricula>@empresa.com` no MVP. | Antecipa o intent 011 (SAP SuccessFactors) provendo abstração estável sem duplicar o cadastro de pessoas no banco de dados. |
| N3-5 | R7 | Salvaguarda rigorosa sob LGPD: mensagens neutras contendo apenas Tipo, Código, Título, Prazo e URL, sem descrições detalhadas, laudos ou anexos de evidência. | Protege dados pessoais e sensíveis contra vazamento via canais de mensageria externa desprovidos de controle de acesso da aplicação (AGENTS.md:66). |
| N3-6 | R15 | Precedência consolidada de recusas em 8 etapas estendendo a decisão D10. | Fixa precedência padronizada garantindo que validação estática de papel precede formato/existência de recursos, e validações de limites precedem o processamento. |
| N3-7 | R9 | Serviço interno sem protocolo `RotinaAlertasService` (`@protocol: 'none'`) para execução automatizada com relógio determinístico injetável. | Desacopla o agendador de nuvem (BTP Job Scheduler / Cloud ALM) da regra de negócio, permitindo que a rotina seja acionada sob demanda por testes e pelo futuro job de nuvem via `cds.connect.to('RotinaAlertasService')` sem que testes importem `srv/` (Ruling R-02 I2). |
| N3-8 | R10 | Persistência dedicada de notificações em `AlertasEmitidos` sem registro em `HistoricoTratativa`. | Preserva a linha do tempo executiva da ocorrência limpa de ruído diário (AGENTS.md:40), encaminhando política final de retenção e expurgo para decisão antes da produção (intent 014). |

---

## Como isso se prova

Mapeamento completo dos 66 Critérios de Aceite (CA1 a CA66) nas 4 etapas sequenciais de implementação da task:

- **Etapa 1 (Modelo persistido, baseline de parâmetros, portas desacopladas e governança administrativa):**
  - CA1: Administrador consulta `consultarParametrosAlertas` e recebe a parametrização vigente padrão com HTTP 200 (`diasAntecedenciaPrazoProximo = 3`, `diasInatividade = 15`, `emailHabilitado = true`, `teamsHabilitado = true`, `horaExecucaoUtc = 8`).
  - CA2: Gestor de Tratativa consulta `consultarParametrosAlertas` com sucesso (HTTP 200).
  - CA3: Usuário autenticado comum sem papel de Administrador nem de Gestor recebe HTTP 403 (`Acesso negado.`) na etapa 2.
  - CA4: Administrador atualiza parâmetros via `atualizarParametrosAlertas` com novos valores válidos e recebe HTTP 200 com os dados persistidos.
  - CA5: Gestor de Tratativa tentando atualizar parâmetros via `atualizarParametrosAlertas` recebe HTTP 403 (`Acesso negado.`) e valores não mudam.
  - CA6: Atualização informando `diasAntecedenciaPrazoProximo = 0` ou `31` recusa na etapa 8 com HTTP 400 `O campo Dias de antecedência aceita de 1 a 30.` (`target: diasAntecedenciaPrazoProximo`).
  - CA7: Atualização informando `diasInatividade = 0` ou `91` recusa na etapa 8 com HTTP 400 `O campo Dias de inatividade aceita de 1 a 90.` (`target: diasInatividade`).
  - CA8: Atualização informando `horaExecucaoUtc = -1` ou `24` recusa na etapa 8 com HTTP 400 `O campo Hora de execução aceita de 0 a 23.` (`target: horaExecucaoUtc`).
  - CA9: Aplicativo de origem tentando executar `consultarParametrosAlertas` ou `atualizarParametrosAlertas` recebe HTTP 403 no início do handler.
  - CA10: Alteração de parâmetros de alerta não gera eventos na tabela de histórico de auditoria da Tratativa (`HistoricoTratativa`).
  - CA37: Testes automatizados utilizam exclusivamente dublês em memória (`test/apoio/`) sem conexão a SMTP ou Graph API reais.
  - CA39: Destinatário com matrícula funcional "M1001" é resolvido deterministicamente pelo `DiretorioPessoasAdapter` como "m1001@empresa.com".
  - CA40: Matrícula inválida ou não resolvida pelo diretório gera registro com `statusEnvio = Falha` e `motivoFalha = Destinatário não resolvido`, sem abortar os demais envios do lote.
  - CA63: Usuário não autenticado tentando acessar endpoints de alerta recebe HTTP 401.
  - CA64: Requisição com JSON malformado ou campos desconhecidos fora da assinatura é recusada pelo runtime CAP na etapa 3 com HTTP 400.

- **Etapa 2 (Serviço interno `RotinaAlertasService`, motor de regras e cálculo derivado de prazos e inatividade):**
  - CA11: Ação `Pendente` com Prazo para daqui a 2 dias (limite <= 3) gera alerta `PrazoProximo` unicamente para o `Responsável da Ação`.
  - CA12: Ação `Em andamento` com Prazo exatamente no limite de antecedência (3 dias) gera alerta `PrazoProximo` para o `Responsável da Ação`.
  - CA13: Ação com Prazo além do limite de antecedência (4 dias) não gera alerta de `PrazoProximo`.
  - CA14: Tratativa `Aberta` com conclusão para daqui a 2 dias gera alerta `PrazoProximo` para o `Responsável Principal`.
  - CA15: Tratativa com prazo próximo que não possui Responsável Principal atribuído não despacha notificações externas.
  - CA16: Subação `Em andamento` com Prazo para daqui a 1 dia gera alerta `PrazoProximo` para o Responsável da respectiva Subação.
  - CA17: Ação `Pendente` com Prazo vencido despacha alerta `PrazoVencido` tanto para o `Responsável da Ação` quanto para o `Responsável Principal` da Tratativa.
  - CA18: Ação com Prazo vencido em Tratativa sem Responsável Principal envia alerta `PrazoVencido` unicamente ao Responsável da Ação.
  - CA19: Ação vencida onde o Responsável da Ação e o Responsável Principal são a mesma matrícula recebe no máximo uma notificação por canal naquele dia.
  - CA20: Tratativa `Aberta` com conclusão vencida gera alerta `PrazoVencido` para seu Responsável Principal.
  - CA21: Tratativa `Aberta` cuja última atividade (criação) ocorreu há 16 dias (`diasInatividade = 15`) gera alerta `Inatividade` para o Responsável Principal.
  - CA22: Tratativa com inatividade há 20 dias sem Responsável Principal mas com Participantes despacha alerta de `Inatividade` para todos os Participantes cadastrados.
  - CA23: Tratativa criada há 20 dias que recebeu novo Comentário há 2 dias calcula última atividade derivada como 2 dias atrás e não gera alerta de `Inatividade`.
  - CA24: Tratativa criada há 20 dias que teve evento de histórico há 3 dias calcula última atividade como 3 dias atrás e não gera alerta de `Inatividade`.
  - CA25: Tratativa inativa há 20 dias sem Responsável Principal e sem Participantes não despacha notificações externas.
  - CA26: Ação com `evidenciaObrigatoria = true` em Status `Pendente` com prazo a vencer em 2 dias e zero evidências ativas anexadas gera alerta `EvidenciaPendente` para o Responsável da Ação.
  - CA27: Ação com `evidenciaObrigatoria = true` com Prazo vencido e zero evidências ativas anexadas despacha `EvidenciaPendente` para o Responsável da Ação e para o Responsável Principal da Tratativa.
  - CA28: Ação com `evidenciaObrigatoria = true` que possui 1 evidência ativa anexada no prazo não gera alerta de `EvidenciaPendente`.
  - CA29: Ação com `evidenciaObrigatoria = false` sem evidências anexadas não gera alerta de `EvidenciaPendente`.
  - CA30: Tratativa `Encerrada` com data vencida e ações pendentes nunca gera alertas de qualquer modalidade.
  - CA31: Tratativa `Cancelada` nunca gera alertas de qualquer modalidade.
  - CA32: Ação `Concluída` nunca gera alertas de prazo ou evidência.
  - CA33: Ação `Cancelada` nunca gera alertas de qualquer modalidade.
  - CA66: Regras de alerta comportam-se com rigorosa e exata igualdade para Tratativas de qualquer Origem externa ou avulsas (AGENTS.md:36).

- **Etapa 3 (Despacho multicanal, formatação LGPD, idempotência diária UTC e execução sob demanda):**
  - CA34: Processamento com `emailHabilitado = true` e `teamsHabilitado = true` aciona tanto o `EmailAdapter` quanto o `TeamsAdapter`.
  - CA35: Processamento com `emailHabilitado = true` e `teamsHabilitado = false` aciona unicamente o `EmailAdapter`.
  - CA36: Processamento com ambos os canais desabilitados não realiza chamadas aos adaptadores externos.
  - CA38: Envio via Microsoft Teams ocorre exclusivamente como mensagem direta 1:1 ao colaborador, sem envio em canais compartilhados de equipe.
  - CA41: Mensagens enviadas contêm Tipo, Código e Título da Tratativa, Prazo formatado em DD/MM/AAAA e URL direta em português (pt-BR).
  - CA42: Mensagens não contêm Descrição da Tratativa, Descrição da Ação, comentários, laudos médicos ou anexos de evidência sob LGPD.
  - CA43: Execução sob demanda via `executarProcessamentoAlertas` grava registros em `AlertasEmitidos` com `statusEnvio = Sucesso` e `enviadoEm`.
  - CA44: Nova execução do processamento no mesmo dia UTC não reenvia o alerta já transmitido com sucesso (idempotência garantida).
  - CA45: Ação pendente e vencida em dias civis subsequentes recebe exatamente um alerta diário em cada dia do calendário.
  - CA46: Execução de `executarProcessamentoAlertas` por usuário sem papel de Administrador (inclusive Gestor de Tratativa) recebe HTTP 403 na etapa 2.
  - CA47: Aplicativo de origem tentando executar `executarProcessamentoAlertas` recebe HTTP 403 no início do handler.
  - CA48: Emissão de alertas cria registros em `AlertasEmitidos` e nenhum registro na tabela de histórico de auditoria da Tratativa (`HistoricoTratativa`).
  - CA59: Falha ou exceção em adaptador de canal para determinado alerta registra `statusEnvio = Falha` e prossegue com o envio dos demais alertas sem abortar a transação.
  - CA60: Alerta que falhou pela manhã é retentado e emitido com sucesso na reexecução manual após recuperação do canal.
  - CA61: Ocorrência de falha no envio de alertas mantém os dados e status da Tratativa e das Ações estritamente intactos.
  - CA62: Execução das regras no serviço CAP não efetua nenhuma dependência ou chamada HTTP ao serviço externo SAP Build Process Automation / Business Rules.

- **Etapa 4 (Consulta e auditoria de notificações emitidas, filtros, paginação e precedência consolidada D10):**
  - CA49: Gestor de Tratativa ou Administrador consulta `listarAlertasEmitidos` e recebe a listagem ordenada cronologicamente decrescente (`enviadoEm DESC`).
  - CA50: Usuário comum sem papel de Administrador nem de Gestor recebe HTTP 403 ao consultar `listarAlertasEmitidos`.
  - CA51: Administrador consulta `listarAlertasEmitidos` com filtro `tratativa = <UUID>` e recebe exclusivamente os alertas daquela ocorrência.
  - CA52: Consulta informando UUID de Tratativa malformado em `listarAlertasEmitidos` recusa na etapa 4 com HTTP 400 `Código inválido.` (`target: tratativa`).
  - CA53: Consulta informando Código de Tratativa inexistente no banco recusa na etapa 5 com HTTP 404 `Tratativa não encontrada.` (`target: tratativa`).
  - CA54: Consulta com filtro `statusEnvio = Falha` retorna apenas os registros com falha, contendo `motivoFalha` preenchido.
  - CA55: Consulta com `tamanhoPagina = 201` ou `0` recusa na etapa 8 com HTTP 400 `O campo Tamanho da página aceita de 1 a 200.` (`target: tamanhoPagina`).
  - CA56: Consulta com `pagina = 0` ou negativo recusa na etapa 8 com HTTP 400 `O campo Página deve ser 1 ou maior.` (`target: pagina`).
  - CA57: Consulta combinando `tamanhoPagina = 201` e `pagina = 0` recusa nomeando `tamanhoPagina`, comprovando que `tamanhoPagina` é validado antes de `pagina`.
  - CA58: Consulta que não encontra nenhum registro para os filtros retorna HTTP 200 com lista vazia `[]`.
  - CA65: Aplicativo de origem tentando consultar `listarAlertasEmitidos` com chave de Tratativa inexistente recebe HTTP 403 na etapa 2 antes da checagem de existência da etapa 5.

---

## O que não muda

- Os contratos públicos de abertura e consulta do `TratativaService` (`/api/tratativa/v1`), `IntegracaoOrigemService` (`/api/integracao-origem/v1`) e as operações existentes em `AdministracaoService` (`PrazosCriticidade`, `CredenciaisAplicativo`) permanecem estritamente intactos.
- `consultarTratativa` e o tipo `DetalheTratativa` do intent 003 preservam suas 12 chaves originais sem modificação.
- Nenhum campo novo é adicionado à entidade `Tratativas` (a última atividade é calculada dinamicamente a partir de `criadoEm` de `Tratativas`, `quando` de `HistoricoTratativa`/`HistoricoAcoes` e `criadoEm` de `Comentarios`).
- A tabela de histórico executivo da ocorrência (`HistoricoTratativa`) não recebe eventos de disparos de alertas ou alterações de parâmetros administrativos.
- O congelamento de registros finalizados permanece inviolável: Tratativas Encerradas/Canceladas e Ações Concluídas/Canceladas não sofrem nenhuma alteração.

---

## O desconfortável, declarado

1. **Varredura diária baseada em calendário UTC vs streaming contínuo:**
   A idempotência e o agendamento operam sobre dias civis no fuso horário UTC (`dataEnvioYMD`, extraída estritamente por `instante.toISOString().slice(0, 10)`). Para colaboradores em fusos muito distantes, o corte diário ocorre às 00:00 UTC (21:00 em Brasília). Esse compromisso simplifica drasticamente a máquina de estados no MVP e elimina a necessidade de gestão complexa de fusos horários individuais por usuário, sendo plenamente suficiente para o acompanhamento corporativo de prazos em dias corridos.

2. **Cálculo derivado de última atividade em memória:**
   A data de última atividade para o alerta de inatividade é apurada através de agregações (`MAX`) sobre as tabelas `HistoricoTratativa`, `HistoricoAcoes` e `Comentarios` e o carimbo `criadoEm` da `Tratativa`. Para o volume do MVP, a consulta é sub-milissegundo. Caso ocorra crescimento volumétrico exponencial com milhões de eventos, uma view analítica indexada no SAP HANA Cloud poderá ser introduzida em intents futuros sem quebrar as regras de negócio deste intent.

3. **Resolução determinística provisória de pessoas no MVP:**
   Antes da implantação da integração somente leitura com o SAP SuccessFactors no intent 011, o `DiretorioPessoasAdapter` mapeia a matrícula diretamente para o formato `<matricula.toLowerCase()>@empresa.com`. Colaboradores cuja caixa postal corporativa divirja do formato padrão dependerão da entrada em operação do intent 011.
