# Design: integracao-successfactors

**Spec:** agentic/projeto/specs/integracao-successfactors/spec.md  
**Status:** aprovado

Escopo técnico: integração corporativa com o SAP SuccessFactors (SF) para consumo em modo estritamente somente leitura (read-only) de Colaboradores, Gestores e Estrutura Organizacional (Unidades e Áreas) no novo serviço `IntegracaoPessoasService` (`/api/integracao-pessoas/v1`), com governança no `AdministracaoService` e no `TratativaService`, e adaptadores isolados em `srv/integracoes/` (decisão D2), compreendendo:
1. Proibição absoluta de escrita ou envio de dados para o SAP SuccessFactors (`AGENTS.md:37`);
2. Modelo persistido relacional aditivo em `db/tratativa.cds` contendo unicamente o singleton `ParametrosIntegracaoSF` para governança do mapeamento organizacional (`nivelUnidadeSF`, `nivelAreaSF`), sem persistência física ou replicação relacional de cadastro de dados pessoais no banco da aplicação (minimização e privacidade por design sob a LGPD);
3. Abstração desacoplada de portas e adaptadores em `srv/integracoes/` (`ProvedorPessoasAdapter` e `ProvedorEstruturaAdapter`) configurados via `package.json` (`cds.requires`) com dublês em memória isolados em `test/apoio/` (sem dependência de instâncias reais do SF, BTP Destination Service ou rede externa, em cumprimento estrito a `AGENTS.md:38`);
4. Camada de cache volátil em memória (TTL de 15 minutos) no processo Node.js, mitigando latência e atendendo consultas mesmo diante de falhas transitórias do provedor;
5. Implementação da porta `DiretorioPessoasAdapter` (consumida pelo serviço de alertas e notificações do intent 010), resolvendo a matrícula no endereço de e-mail corporativo cadastrado no SF e sinalizando destinatários não encontrados/inativos como falha pontual sem abortar o processamento do lote;
6. Catálogo mínimo de atributos funcionais do colaborador (matrícula, nome, e-mail, código de unidade, código de área, matrícula do gestor e situação funcional ativa/inativa), com vedação rigorosa de atributos sensíveis, salários, avaliações ou dados médicos;
7. Imutabilidade dos dados informados na abertura da Tratativa (`Unidade`, `Área`, `Solicitante` permanecem os registrados, atuando o SF como enriquecedor em tempo de leitura);
8. Resiliência e comportamento degradado: timeout de 5 segundos, resposta HTTP 503 com `target: integracao` diante de indisponibilidade externa sem cache, e continuidade operacional das atribuições de responsabilidade e delegações através de validação puramente sintática de matrículas (005 R3);
9. Operações no `IntegracaoPessoasService`: `consultarColaborador`, `buscarColaboradores` (com ordenação alfabética determinística por nome e matrícula) e `listarEstruturaOrganizacional` (com contrato estrutural explícito de Unidades com Áreas aninhadas);
10. Operações de governança de parâmetros: `consultarParametrosIntegracaoSF` no `TratativaService` (e `AdministracaoService`) restrita a Gestor e Administrador, e `atualizarParametrosIntegracaoSF` no `AdministracaoService` restrita ao Administrador;
11. Precedência de recusas da Decisão D10 estendida com HTTP 503, diferenciando functions (onde a validação de runtime HTTP 400 ocorre na etapa 2 antes do handler) e actions (onde o papel estático HTTP 403 ocorre na etapa 2 antes do corpo);
12. Universalidade corporativa sem regras específicas para áreas como o SESMT (`AGENTS.md:36`).

---

## Decisões

1. **Modelo de persistência: zero replicação de pessoas e singleton de mapeamento** (R1, R2, R3, R6; N3-1; Q1, Q2, Q5; AGENTS.md:37,66).
   - Não é criada nenhuma tabela relacional física de cadastro de colaboradores no banco de dados (`db/`). As tabelas relacionais do sistema (`Tratativas`, `Acoes`, `HistoricoTratativa`, `HistoricoAcoes`) continuam armazenando estritamente a matrícula funcional (`String(50)`).
   - Adicionada a entidade singleton `ParametrosIntegracaoSF` em `db/tratativa.cds`:
     ```cds
     @PersonalData.EntitySemantics: 'Other'
     entity ParametrosIntegracaoSF : managed {
       key chave          : String(10); // 'GLOBAL'
           nivelUnidadeSF : String(100) not null default 'BusinessUnit';
           nivelAreaSF    : String(100) not null default 'Department';
     }
     ```
   - Carga inicial de baseline sem arquivos CSV em `db/data/`, inicializada programaticamente sob demanda pelo domínio em `srv/integracoes/parametros-sf.ts` caso o singleton não exista.
   — **Por quê:** atende aos princípios de necessidade e minimização da LGPD (Art. 6º, III), eliminando o risco de vazamento de bases de colaboradores em repouso. A parametrização flexível desacopla a aplicação da estrutura corporativa específica do SAP SuccessFactors, cumprindo AGENTS.md:36.
   — **Verificado por:** compilação `cds compile db --to sql` sem criação de tabelas de pessoas; testes de banco vazio comprovando ausência de dados de colaboradores persistidos (CA5).

2. **Isolamento de arquitetura e portas desacopladas em `srv/integracoes/` via `cds.requires`** (R1, R3, R8, R10, R13; N3-2, N3-3; Q2, Q9, Q11; Decisões D2, D6; AGENTS.md:38).
   - Portas declaradas em `srv/integracoes/portas-sf.ts`:
     * `ProvedorPessoasPort`: `obterColaborador(matricula: string): Promise<DadosColaboradorSF | null>; buscarColaboradores(filtro: FiltroColaboradoresSF): Promise<DadosColaboradorSF[]>;`
     * `ProvedorEstruturaPort`: `listarEstrutura(nivelUnidade: string, nivelArea: string): Promise<DadosUnidadeSF[]>;`
   - Configuração no `package.json` (`cds.requires`):
     ```json
     "cds": {
       "requires": {
         "ProvedorPessoasAdapter": {
           "impl": "srv/integracoes/provedor-pessoas-adapter",
           "[development]": { "impl": "test/apoio/pessoas-espiao" },
           "[test]": { "impl": "test/apoio/pessoas-espiao" }
         },
         "ProvedorEstruturaAdapter": {
           "impl": "srv/integracoes/provedor-estrutura-adapter",
           "[development]": { "impl": "test/apoio/estrutura-espiao" },
           "[test]": { "impl": "test/apoio/estrutura-espiao" }
         },
         "DiretorioPessoasAdapter": {
           "impl": "srv/alertas/diretorio-pessoas-adapter",
           "[development]": { "impl": "srv/alertas/diretorio-pessoas-adapter" },
           "[test]": { "impl": "srv/alertas/diretorio-pessoas-adapter" }
         }
       }
     }
     ```
   - Implementação real em produção (intent 014): consumo somente leitura via SAP BTP Destination Service (`HTTP GET` contra APIs OData v2/v4 do SAP SuccessFactors: `User`, `PerPerson`, `FODivision`, `FODepartment`). Proibição física de verbos de escrita (POST, PUT, PATCH, DELETE).
   - Dublês em `test/apoio/` (`pessoas-espiao.ts` e `estrutura-espiao.ts`): fornecem dados mockados e métodos de simulação (`simularFalhaProvedor()`, `simularTimeoutProvedor()`, `limparProvedor()`). Nenhum helper possui `expect(`.
   - Regra inviolável: testes nunca importam `srv/`. As suítes de teste acessam os serviços OData (`cds.test().get(...)` ou `.post(...)`), consultas de banco via helper `linhas(...)` ou portas internas registradas em `cds.requires` via `cds.connect.to(...)` ou utilitários em `test/apoio/`.
   — **Por quê:** cumpre a decisão D2 (integrações externas isoladas em `srv/integracoes/`) e a regra inviolável de AGENTS.md:38 (testes locais nunca acessam o SF real).
   — **Verificado por:** testes executando com dublês em memória sob SQLite (`cds.test`), sem dependência de credenciais reais (CA1, CA25).

3. **Cache volátil em memória e implementação de `DiretorioPessoasAdapter` (010 R6)** (R2, R3, R8, R10; N3-4; Q2, Q9; LGPD).
   - Módulo `srv/integracoes/cache-pessoas.ts`:
     * Armazena dados de colaboradores em memória (`Map<string, { dado: DadosColaboradorSF; expiraEm: number }>`) com TTL padrão de 15 minutos (900.000 ms).
     * Se o colaborador estiver em cache e não expirado, retorna imediatamente sem acionar o provedor externo.
     * Invalidação automática após TTL ou reinício do processo Node.js.
   - Conexão com o Intent 010 (`srv/alertas/diretorio-pessoas-adapter.ts`):
     * A porta `DiretorioPessoasPort` do serviço de notificações (010 R6) passa a delegar a resolução ao `cache-pessoas.ts` / `ProvedorPessoasAdapter`:
       - Colaborador ativo encontrado: devolve `{ email: colab.email, teamsId: colab.email }`;
       - Colaborador inativo ou não encontrado: devolve `null` (indicando não resolvido, permitindo que 010 registre `Falha` em `AlertasEmitidos` sem abortar o lote diário);
       - Falha de rede: em caso de indisponibilidade externa, se houver cache prévio, resolve com o dado em cache; se não houver, devolve `null`.
   — **Por quê:** atende à dependência formal de 010 R6, otimiza performance de UI e minimiza chamadas de rede ao SuccessFactors.
   — **Verificado por:** testes de segunda chamada servida do cache em menos de 15 minutos (CA4), e testes de resolução de alertas (CA21, CA22).

4. **Superfície do novo serviço `IntegracaoPessoasService` (`/api/integracao-pessoas/v1`)** (R1, R2, R9, R11, R14; N3-2; Q8, Q12; Decisão D6).
   - Serviço público em `srv/integracao-pessoas-service.cds`:
     ```cds
     @path: '/api/integracao-pessoas/v1'
     @requires: 'authenticated-user'
     service IntegracaoPessoasService {
       type DetalheColaborador {
         matricula       : String(50);
         nome            : String(100);
         email           : String(100);
         codigoUnidade   : String(100);
         codigoArea      : String(100);
         matriculaGestor : String(50);
         situacao        : String(20); // 'Ativo' ou 'Inativo'
       }

       type ItemColaborador {
         matricula       : String(50);
         nome            : String(100);
         email           : String(100);
         codigoUnidade   : String(100);
         codigoArea      : String(100);
         matriculaGestor : String(50);
         situacao        : String(20);
       }

       type ItemAreaEstrutura {
         codigoArea : String(100);
         nomeArea   : String(100);
       }

       type ItemUnidadeEstrutura {
         codigoUnidade : String(100);
         nomeUnidade   : String(100);
         areas         : many ItemAreaEstrutura;
       }

       function consultarColaborador(matricula : String) returns DetalheColaborador;

       function buscarColaboradores(
         termo         : String,
         codigoUnidade : String,
         codigoArea    : String,
         apenasAtivos  : Boolean,
         tamanhoPagina : Integer,
         pagina        : Integer
       ) returns many ItemColaborador;

       function listarEstruturaOrganizacional() returns many ItemUnidadeEstrutura;
     }
     ```
   - **Ordenação determinística (Achado 4 do parecer 1):**
     * `buscarColaboradores`: ordenação obrigatória alfabética ascendente por `nome` (A-Z) com desempate por `matricula` ascendente. Paginação por fatia: `limit(tamanhoPagina, (pagina - 1) * tamanhoPagina)`.
     * `listarEstruturaOrganizacional`: ordenação hierárquica determinística com Unidades em ordem alfabética ascendente por `nomeUnidade` (desempate por `codigoUnidade`), e dentro de cada Unidade as Áreas ordenadas alfabeticamente por `nomeArea` (desempate por `codigoArea`).
   - `AplicativoOrigem` recebe 403 `Acesso negado.` no hook `before('*')`.
   — **Por quê:** garante contratos OData V4 limpos, previsíveis e consistentes para o Fiori (intent 013), respeitando o menor privilégio e isolando o Aplicativo de origem.
   — **Verificado por:** compilação `cds compile srv --to csn` e testes funcionais (CA2, CA3, CA15, CA18, CA19, CA20).

5. **Governança de `ParametrosIntegracaoSF` somada a `TratativaService` e `AdministracaoService`** (R6; N3-2; Q5; Parecer 1 Achado 3, Parecer 2).
   - Em `srv/tratativa-service.cds`:
     ```cds
     type DetalheParametrosIntegracaoSF {
       nivelUnidadeSF : String(100);
       nivelAreaSF    : String(100);
     }

     @restrict: [{ grant: '*', to: ['GestorTratativa', 'Administrador'] }]
     function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;
     ```
   - Em `srv/administracao-service.cds`:
     ```cds
     @restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]
     function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;

     @restrict: [{ grant: '*', to: 'Administrador' }]
     action atualizarParametrosIntegracaoSF(
       nivelUnidadeSF : String,
       nivelAreaSF    : String
     ) returns DetalheParametrosIntegracaoSF;
     ```
   - Grants somados diretamente no CDS (nunca `annotate` que substitua arrays de `@restrict` existentes).
   - **Canal preferencial de consulta:** O canal principal de consulta de parâmetros pelo papel `GestorTratativa` é o `TratativaService` (`GET /api/tratativa/v1/consultarParametrosIntegracaoSF()`), preservando o isolamento do `AdministracaoService` cujo escopo geral é restrito ao `Administrador`.
   - Usuário autenticado comum (`Usuário da plataforma`) recebe 403 `Acesso negado.` ao tentar consultar ou alterar parâmetros (CA11, CA11a).
   - Aplicativo de origem recebe 403 `Acesso negado.` (CA20).
   — **Por quê:** resolve formalmente a lacuna do parecer 1 (Achado 3), garantindo que Gestor consulte a configuração organizacional enquanto apenas o Administrador possa alterá-la.
   — **Verificado por:** testes de autorização por papel sobre os endpoints de parametrização (CA9, CA10, CA11, CA11a, CA20, CA24a).

6. **Resiliência, comportamento degradado e continuidade operacional** (R4, R5, R7, R8; N3-5; Q3, Q4, Q6, Q7).
   - **Timeout e erro 503:** chamadas ao provedor externo possuem timeout de 5 segundos. Em caso de falha de rede/timeout sem cache prévio, as functions de consulta retornam HTTP 503 `Serviço de pessoas temporariamente indisponível. Tente novamente mais tarde.` com `target: integracao` (estendendo a matriz D10).
   - **Continuidade operacional da fábrica:** a criação de tratativas, abertura de ações (004 R3) e atribuição/delegação de responsáveis (005 R7, R8) **NÃO** dependem da disponibilidade síncrona do SuccessFactors: a validação de matrícula é puramente sintática (1 a 50 caracteres sem espaços e sem @). Se o SF estiver fora do ar, o plano de ação continua sendo criado e delegado normalmente (CA13).
   - **Imutabilidade e prevalência da abertura:** campos `Unidade`, `Área` e `Solicitante` gravados na Tratativa nunca são alterados pelo SF. Desligamento (`situacao = 'Inativo'`) mantém o histórico gravado e não efetua reatribuição forçada (CA6, CA7, CA8).
   — **Por quê:** impede que instabilidades de rede corporativa paralisem o registro de ocorrências ou a execução de ações de segurança nas fábricas (SESMT).
   — **Verificado por:** testes simulando falha do adaptador onde consultas retornam 503, mas atribuições e criações de ações continuam funcionando perfeitamente (CA13, CA14).

7. **Precedência consolidada de recusas e contrato de erros (Decisão D10 estendida)** (R11, R12; N3-6; Q10; Parecer 1 Achado 2, Parecer 2).
   - Precedência diferenciada conforme a semântica da operação:
     * **Para functions (GET: `consultarColaborador`, `buscarColaboradores`, `listarEstruturaOrganizacional`, `consultarParametrosIntegracaoSF`):**
       1. Autenticação: não autenticado → 401;
       2. Forma do pedido no runtime: parâmetros incompatíveis ou query malformada → 400 do runtime antes do handler;
       3. Aplicativo de origem e papel estático: identidade `AplicativoOrigem` ou usuário sem o papel exigido em `consultarParametrosIntegracaoSF` → 403 `Acesso negado.` no início do handler;
       4. Forma dos parâmetros de identificador no domínio: em `consultarColaborador`, matrícula vazia, com espaços ou com @ → 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` (`target: matricula`);
       5. Existência no domínio: matrícula válida não encontrada no provedor SF → 404 `Colaborador não encontrado.` (`target: matricula`);
       6. Autorização dinâmica: não aplicável;
       7. Estado do registro: não aplicável;
       8. Validação de campos e limites no domínio: `termo > 100` → 400 (`target: termo`); `tamanhoPagina` fora de 1..200 → 400 (`target: tamanhoPagina`); `pagina < 1` → 400 (`target: pagina`), com `tamanhoPagina` antes de `pagina`;
       9. Falha de integração externa: timeout ou indisponibilidade do SF sem cache → 503 `Serviço de pessoas temporariamente indisponível. Tente novamente mais tarde.` (`target: integracao`).
     * **Para actions (`atualizarParametrosIntegracaoSF`):**
       1. Autenticação: não autenticado → 401;
       2. Autorização / Papel estático: usuário sem papel `Administrador` ou `AplicativoOrigem` → 403 `Acesso negado.` no início do handler (@restrict) antes da validação de corpo;
       3. Forma do pedido no runtime: corpo não interpretável, JSON malformado ou campos fora da assinatura → 400;
       4..7. Não aplicáveis;
       8. Validação de limites: `nivelUnidadeSF` vazio ou > 100 → 400 (`target: nivelUnidadeSF`); `nivelAreaSF` vazio ou > 100 → 400 (`target: nivelAreaSF`).
   — **Por quê:** cumpre a decisão D10 alinhada às notas de 004 R29 e 005 R16, sanando a inversão de runtime apontada no Achado 2 do parecer 1.
   — **Verificado por:** testes cobrindo todas as etapas de erro e precedência (CA11, CA11a, CA14, CA16, CA17, CA20, CA23, CA24, CA24a).

---

## Contrato executável

### 1. Modelo persistido em `db/tratativa.cds`

```cds
// Declarações aditivas em db/tratativa.cds:

/** R6 (spec integracao-successfactors): governança do mapeamento de níveis organizacionais do SF. */
@PersonalData.EntitySemantics: 'Other'
entity ParametrosIntegracaoSF : managed {
  key chave          : String(10); // 'GLOBAL'
      nivelUnidadeSF : String(100) not null default 'BusinessUnit';
      nivelAreaSF    : String(100) not null default 'Department';
}
```

### 2. Contrato de `IntegracaoPessoasService` em `srv/integracao-pessoas-service.cds`

```cds
using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Serviço de integração com o SAP SuccessFactors (spec integracao-successfactors R1-R14).
 * Modo estritamente somente leitura. Consumo por usuários autenticados da plataforma.
 */
@path    : '/api/integracao-pessoas/v1'
@requires: 'authenticated-user'
service IntegracaoPessoasService {

  type DetalheColaborador {
    matricula       : String(50);
    nome            : String(100);
    email           : String(100);
    codigoUnidade   : String(100);
    codigoArea      : String(100);
    matriculaGestor : String(50);
    situacao        : String(20);
  }

  type ItemColaborador {
    matricula       : String(50);
    nome            : String(100);
    email           : String(100);
    codigoUnidade   : String(100);
    codigoArea      : String(100);
    matriculaGestor : String(50);
    situacao        : String(20);
  }

  type ItemAreaEstrutura {
    codigoArea : String(100);
    nomeArea   : String(100);
  }

  type ItemUnidadeEstrutura {
    codigoUnidade : String(100);
    nomeUnidade   : String(100);
    areas         : many ItemAreaEstrutura;
  }

  /** R9 a: consulta de colaborador por matrícula; inexistente -> 404; timeout sem cache -> 503. */
  function consultarColaborador(matricula : String) returns DetalheColaborador;

  /** R9 b: busca com filtros e paginação; ordenado por nome ASC e matrícula ASC. */
  function buscarColaboradores(
    termo         : String,
    codigoUnidade : String,
    codigoArea    : String,
    apenasAtivos  : Boolean,
    tamanhoPagina : Integer,
    pagina        : Integer
  ) returns many ItemColaborador;

  /** R9 c: lista hierárquica de Unidades e Áreas ativas do SF. */
  function listarEstruturaOrganizacional() returns many ItemUnidadeEstrutura;
}
```

### 3. Extensões nos serviços existentes

```cds
// Em srv/tratativa-service.cds (aditivo diretamente no corpo ou via extend):
extend service TratativaService with {
  type DetalheParametrosIntegracaoSF {
    nivelUnidadeSF : String(100);
    nivelAreaSF    : String(100);
  }

  @restrict: [{ grant: '*', to: ['GestorTratativa', 'Administrador'] }]
  function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;
}

// Em srv/administracao-service.cds (aditivo, somando aos grants existentes):
extend service AdministracaoService with {
  type DetalheParametrosIntegracaoSF {
    nivelUnidadeSF : String(100);
    nivelAreaSF    : String(100);
  }

  @restrict: [{ grant: '*', to: ['Administrador', 'GestorTratativa'] }]
  function consultarParametrosIntegracaoSF() returns DetalheParametrosIntegracaoSF;

  @restrict: [{ grant: '*', to: 'Administrador' }]
  action atualizarParametrosIntegracaoSF(
    nivelUnidadeSF : String,
    nivelAreaSF    : String
  ) returns DetalheParametrosIntegracaoSF;
}
```

### 4. Contrato de Erros e Precedência (D10 estendido)

| Etapa | Verificação | Quem valida | HTTP | Mensagem de erro | Target |
|---|---|---|---|---|---|
| 1 | Autenticação | Runtime CAP (`@requires`) | 401 | - | - |
| 2 (func) | Forma do pedido no runtime | Runtime CAP | 400 | Mensagem do framework | - |
| 2 (act) | Papel estático (@restrict) | Handler / Runtime | 403 | `Acesso negado.` | - |
| 3 (func) | `AplicativoOrigem` ou sem papel no handler | Handler (`before('*')`) | 403 | `Acesso negado.` | - |
| 3 (act) | Forma do pedido no runtime | Runtime CAP | 400 | Mensagem do framework | - |
| 4 | Matrícula vazia, com espaços ou com @ | Domínio | 400 | `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` | `matricula` |
| 5 | Colaborador inexistente no provedor | Domínio | 404 | `Colaborador não encontrado.` | `matricula` |
| 8 | `termo > 100` caracteres | Domínio | 400 | `O campo Termo aceita no máximo 100 caracteres.` | `termo` |
| 8 | `tamanhoPagina` fora de 1..200 | Domínio | 400 | `O campo Tamanho da página aceita de 1 a 200.` | `tamanhoPagina` |
| 8 | `pagina < 1` | Domínio | 400 | `O campo Página deve ser 1 ou maior.` | `pagina` |
| 8 | `nivelUnidadeSF` vazio após trim | Domínio | 400 | `O campo Nível de unidade é obrigatório.` | `nivelUnidadeSF` |
| 8 | `nivelUnidadeSF > 100` caracteres | Domínio | 400 | `O campo Nível de unidade aceita no máximo 100 caracteres.` | `nivelUnidadeSF` |
| 8 | `nivelAreaSF` vazio após trim | Domínio | 400 | `O campo Nível de área é obrigatório.` | `nivelAreaSF` |
| 8 | `nivelAreaSF > 100` caracteres | Domínio | 400 | `O campo Nível de área aceita no máximo 100 caracteres.` | `nivelAreaSF` |
| 9 | Provedor SF indisponível sem cache | Domínio | 503 | `Serviço de pessoas temporariamente indisponível. Tente novamente mais tarde.` | `integracao` |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-integracao-successfactors.md` | Entregar o intent 011 em 4 etapas sequenciais RED/GREEN: modelo de parametrização e portas desacopladas (R1, R6, R11, R12, R13); implementação de DiretorioPessoasAdapter com cache em memória (R2, R3, R10); serviço IntegracaoPessoasService para colaboradores (R2, R4, R5, R7, R9, R14); estrutura organizacional, resiliência a falhas e precedência D10 (R8, R9, R11, R12). | `integracao-successfactors/001-integracao-successfactors` |

---

## Itens N3 (aguardam aprovação no Gate 1)

| Item | Origem | Impacto | Justificativa e Mitigação |
|---|---|---|---|
| N3-1 | R2, R3, R6 | Inclusão de `ParametrosIntegracaoSF` em `db/tratativa.cds` sem replicação relacional de tabelas de pessoas. | Minimização LGPD: nenhuma tabela física de colaboradores é persistida em repouso no banco de dados. Carga programática sem CSV previne sobrescrita em deploys HDI. |
| N3-2 | R6, R9, R11 | Criação de `IntegracaoPessoasService` e expansão de `AdministracaoService` e `TratativaService` com grants somados e recusa de `AplicativoOrigem` com 403. | Garante que usuários autenticados consultem pessoas e estruturas enquanto parametrização fica restrita a Gestor (leitura) e Administrador (escrita), bloqueando totalmente o Aplicativo de origem antes do acesso ao banco (Ruling R-03). |
| N3-3 | R1, R13 | Configuração formal em `package.json` (`cds.requires`) das portas desacopladas `ProvedorPessoasAdapter`, `ProvedorEstruturaAdapter` e `DiretorioPessoasAdapter` com dublês em memória em `test/apoio/`. | Isola completamente os testes automatizados (AGENTS.md:38), impedindo chamadas a instâncias reais do SF ou BTP Destinations e viabilizando execução 100% local com SQLite em memória. Alteração formal de `package.json` registrada no escopo. |
| N3-4 | R3, R10 | Implementação de cache volátil em memória (TTL 15 min) e conexão da porta `DiretorioPessoasAdapter` para notificações (010 R6). | Atende à resolução real de e-mails corporativos aguardada pelo serviço de alertas sem chamadas externas repetitivas e sem persistência em banco. |
| N3-5 | R8 | Continuidade operacional de atribuições e delegações através de validação puramente sintática de matrículas (005 R3) mesmo com SF indisponível. | Garante que falhas ou lentidão de rede externa com o SAP SuccessFactors nunca paralisem operações fabris ou registro de ocorrências de segurança. |
| N3-6 | R12 | Precedência consolidada de recusas em 9 etapas baseada na decisão D10 estendida com HTTP 503 (`target: integracao`). | Formaliza a padronização de contratos de erro diferenciando functions e actions e tratando falhas de integração externa de forma limpa e graciosa. |

---

## Como isso se prova

Mapeamento completo dos 28 Critérios de Aceite (CA1 a CA26, incluindo CA11a e CA24a) nas 4 etapas sequenciais de implementação da task:

- **Etapa 1 (Modelo de parametrização, governança e portas desacopladas):**
  - CA9: Gestor de Tratativa e Administrador consultam `consultarParametrosIntegracaoSF` e recebem os níveis vigentes com HTTP 200 (`BusinessUnit`, `Department`).
  - CA10: Administrador atualiza parâmetros via `atualizarParametrosIntegracaoSF` com novos valores válidos e recebe HTTP 200 com os dados persistidos.
  - CA11: Usuário sem papel de Administrador tentando atualizar parâmetros recebe HTTP 403 (`Acesso negado.`) na etapa 2.
  - CA11a: Usuário comum da plataforma tentando consultar parâmetros via `consultarParametrosIntegracaoSF` recebe HTTP 403 (`Acesso negado.`) no handler.
  - CA20: Aplicativo de origem tentando acessar endpoints de integração ou parâmetros recebe HTTP 403 no início do handler.
  - CA23: Usuário não autenticado tentando acessar endpoints recebe HTTP 401.
  - CA24a: Parâmetro `nivelUnidadeSF` ou `nivelAreaSF` com trim vazio ou > 100 caracteres recusa na etapa 8 com HTTP 400 nomeando o campo no target.

- **Etapa 2 (Porta de diretório de pessoas, cache em memória e integração com alertas):**
  - CA4: Consulta repetida do mesmo colaborador dentro de 15 minutos é servida diretamente do cache em memória sem acionar o provedor externo.
  - CA5: Nenhuma tabela física de cadastro de colaboradores é criada ou persistida em repouso no banco de dados relacional (`db/`).
  - CA21: Serviço de alertas (010 R6) solicita resolução de matrícula funcional "M1001" e recebe com sucesso o e-mail cadastrado no SF.
  - CA22: Resolução de matrícula inexistente ou inativa no SF sinaliza não resolvido para o serviço de alertas, permitindo registro de falha sem exceção no lote.

- **Etapa 3 (Serviço `IntegracaoPessoasService`, consulta e busca de colaboradores):**
  - CA1: Nenhuma requisição HTTP de escrita (POST, PUT, PATCH, DELETE) é emitida contra o SAP SuccessFactors.
  - CA2: Consulta de colaborador com matrícula "M1001" via `consultarColaborador` retorna estritamente os atributos mínimos com HTTP 200.
  - CA3: Atributos sensíveis (salário, avaliações, dados médicos, CPF) nunca constam no payload de retorno de colaboradores.
  - CA6: Colaborador desligado no SF mantém sua matrícula inalterada nas tratativas e ações previamente gravadas, sem reatribuição automática.
  - CA7: Gestor de Tratativa consultando colaborador desligado recebe os dados com `situacao = 'Inativo'`.
  - CA8: Tratativa com Unidade, Área e Solicitante informados na abertura mantém estritamente os dados gravados, prevalecendo sobre dados do SF.
  - CA12: Usuário autenticado via token Launchpad/XSUAA tem sua identidade validada diretamente pelas matrículas gravadas, sem consulta síncrona ao SF no login.
  - CA15: Usuário autenticado consulta colaborador válido e recebe HTTP 200.
  - CA16: Chamada a `consultarColaborador` com matrícula inexistente no SF retorna HTTP 404 `Colaborador não encontrado.` (`target: matricula`).
  - CA17: Chamada a `consultarColaborador` com matrícula vazia, com espaços ou com @ recusa na etapa 4 com HTTP 400 `Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.` (`target: matricula`).
  - CA18: Busca de colaboradores via `buscarColaboradores` retorna resultados com ordenação alfabética determinística ascendente por `nome` (A-Z) e desempate por `matricula` ascendente, respeitando `tamanhoPagina` e `pagina`.
  - CA20: Tentativa de acesso a `consultarColaborador` e `buscarColaboradores` por `AplicativoOrigem` recebe HTTP 403 (`Acesso negado.`) no hook `before('*')`.
  - CA23: Requisição anônima a `consultarColaborador` e `buscarColaboradores` recebe HTTP 401.
  - CA24: Parâmetro `termo > 100` recusa na etapa 8 com 400 (`target: termo`); `tamanhoPagina` fora de 1..200 recusa com 400 (`target: tamanhoPagina`); `pagina < 1` recusa com 400 (`target: pagina`), validando `tamanhoPagina` antes de `pagina`.
  - CA26: Colaboradores de diferentes setores são consultados com a mesma estrutura neutra e universal de atributos (AGENTS.md:36).

- **Etapa 4 (Estrutura organizacional, resiliência graciosa e precedência D10):**
  - CA13: Com o SuccessFactors indisponível ou em timeout, novas tratativas e delegações de ações para matrículas sintaticamente válidas continuam sendo aceitas com sucesso.
  - CA14: Com o SuccessFactors indisponível e sem cache prévio, consulta de colaborador retorna HTTP 503 `Serviço de pessoas temporariamente indisponível. Tente novamente mais tarde.` (`target: integracao`).
  - CA19: Consulta hierárquica `listarEstruturaOrganizacional` retorna Unidades com Áreas ativas aninhadas, ordenadas alfabeticamente por `nomeUnidade` e `nomeArea`.
  - CA20: Tentativa de acesso a `listarEstruturaOrganizacional` por `AplicativoOrigem` recebe HTTP 403 (`Acesso negado.`) no hook `before('*')`.
  - CA23: Requisição anônima a `listarEstruturaOrganizacional` recebe HTTP 401.
  - CA25: Suite de testes completa executa exclusivamente com dublês em memória sob SQLite, sem conexões de rede externas.

---

## O que não muda

- Os contratos públicos de abertura e consulta do `TratativaService` (`/api/tratativa/v1`), `IntegracaoOrigemService` (`/api/integracao-origem/v1`) e as operações de `AdministracaoService` permanecem estritamente intactos.
- `consultarTratativa` e o tipo `DetalheTratativa` preservam suas 12 chaves originais sem modificação (Ruling R-02).
- Nenhum dado pessoal sensível é persistido nas entidades da aplicação.
- A validação sintática de matrículas em 004 e 005 permanece intacta (1 a 50 caracteres sem espaços e sem @).
- Desligamentos no SF nunca alteram nem reatribuem tratativas ou ações automaticamente.

---

## O desconfortável, declarado

1. **Dependência de cache volátil para tolerância a falhas:**
   A estratégia de não replicação física de pessoas na base local (adotada para resguardar a LGPD) significa que, diante de indisponibilidade externa prolongada do SAP SuccessFactors e após o esgotamento do TTL de 15 minutos do cache em memória, buscas de colaboradores e listagens de estrutura falharão com HTTP 503. Esse compromisso protege a privacidade e elimina problemas de sincronização desatualizada, assegurando que operações críticas de registro de ações continuem viáveis via validação puramente sintática.

2. **Resolução de terceiros fora do SuccessFactors:**
   Colaboradores terceiros contratados que não possuam registro no SAP SuccessFactors da empresa não serão retornados por `consultarColaborador` (HTTP 404). Eles podem ser indicados como responsáveis no plano de ação através de sua matrícula funcional atribuída pela fábrica, mas não contarão com enriquecimento automático de nome ou e-mail no MVP.

---

## Arquivos Envolvidos

- `package.json`
- `db/tratativa.cds`
- `srv/integracao-pessoas-service.cds`
- `srv/integracao-pessoas-service.ts`
- `srv/tratativa-service.cds`
- `srv/tratativa-service.ts`
- `srv/administracao-service.cds`
- `srv/administracao-service.ts`
- `srv/integracoes/portas-sf.ts`
- `srv/integracoes/provedor-pessoas-adapter.ts`
- `srv/integracoes/provedor-estrutura-adapter.ts`
- `srv/integracoes/parametros-sf.ts`
- `srv/integracoes/cache-pessoas.ts`
- `srv/alertas/diretorio-pessoas-adapter.ts`
- `test/apoio/pessoas-espiao.ts`
- `test/apoio/estrutura-espiao.ts`
- `test/apoio/integracao-pessoas.ts`
- `test/sf-parametros-governanca.test.ts`
- `test/sf-diretorio-alertas-cache.test.ts`
- `test/sf-consulta-colaboradores.test.ts`
- `test/sf-estrutura-resiliencia-d10.test.ts`
