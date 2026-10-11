# Design: dashboards-e-indicadores

**Spec:** agentic/projeto/specs/dashboards-e-indicadores/spec.md  
**Status:** aprovado

Escopo técnico: catálogo de 15 métricas corporativas e indicadores de desempenho (divididos nos níveis Operacional, Gestão e Executivo), mais o totalizador de Evidências Pendentes, expostos pelo novo serviço OData v4 somente leitura `AnaliticoService` (`/api/analitico/v1`), sem tabelas físicas adicionais no banco de dados (puramente views e projeções CDS em `srv/analitico/`), compreendendo:
1. Nível Operacional: `TratativasAbertas`, `TratativasVencidas`, `AcoesEmAndamento`, `PendenciasPorResponsavel` (para Gestor de Tratativa e Administrador da plataforma) e `PendenciasPorUnidadeArea` / `PendenciasPorUnidade` (para todos os leitores analíticos);
2. Nível de Gestão: `TratativasPorOrigem` (com agrupador padronizado `'Sem Origem'` para registros avulsos ou nulos e normalização de maiúsculas/minúsculas/espaços), `TratativasPorCriticidade`, `CumprimentoDePrazo`, `TempoMedioResolucao` e `RankingAreas` (com agrupador `'Sem Área'` para nulos);
3. Nível Executivo: `TendenciaMensal`, `VolumePorOrigem` (com total e percentual), `PrincipaisDesvios` (agrupando ocorrências ativas em atraso), `BacklogTotal` (soma de tratativas ativas e ações ativas vinculadas) e `IndiceResolucao` (admitindo valores superiores a 100.00% em redução de passivo);
4. Totalizador de Evidências Pendentes: contagem de ações ativas com evidência obrigatória que possuam zero evidências ativas anexadas pertencentes a tratativas ativas;
5. Resolução do atraso perpétuo: ocorrências pertencentes a tratativas com Status `Cancelada` (e `Encerrada`) são estritamente excluídas do cálculo de atraso e das contagens de pendências em qualquer data de corte;
6. Governança de acesso via novo papel corporativo `Leitor Analítico` (`LeitorAnalitico`), concedendo acesso a `PendenciasPorResponsavel` para `GestorTratativa` e `Administrador` (com matrícula funcional) e visão agregada `PendenciasPorUnidadeArea` para os demais perfis;
7. Data de corte determinística como parâmetro explícito das consultas (default: data civil atual em UTC), com injeção de datas fixas nos testes (ex.: `'2026-10-08'`);
8. Filtros de período temporal (`periodoInicio`, `periodoFim`) via functions unbound com parâmetros textuais validados no domínio (`srv/analitico/filtros.ts`);
9. Contrato de erro D10 alinhado ao runtime: recusa de papel e autorização estática via HTTP 403 do runtime CAP (`@requires`/`@restrict`);
10. Proibição absoluta de verbos de escrita (POST, PUT, PATCH, DELETE) retornando HTTP 405 Method Not Allowed;
11. Todas as entidades e views expostas possuem chave primária explícita não nula (`key`), garantindo conformidade estrita com o OData v4.

---

## Decisões

1. **Processamento analítico via CDS Views declarativas sem persistência duplicada** (R1, R9; N3-1; D1, D4).
   - Não são criadas novas tabelas físicas no banco de dados para dados analíticos.
   - Três arquivos modulares de views CDS em `srv/analitico/`:
     - `srv/analitico/operacional.cds`: views operacionais (`TratativasAbertasView`, `TratativasVencidasView`, `AcoesEmAndamentoView`, `PendenciasPorResponsavelView`, `PendenciasPorUnidadeAreaView`, `PendenciasPorUnidadeView`).
     - `srv/analitico/gestao.cds`: views de gestão (`TratativasPorOrigemView`, `TratativasPorCriticidadeView`, `RankingAreasView`).
     - `srv/analitico/executivo.cds`: views executivas (`VolumePorOrigemView`, `PrincipaisDesviosView`, `BacklogTotalView`, `EvidenciasPendentesView`).
   - O serviço `AnaliticoService` expõe entidades como projeções diretas sobre essas views (`as projection on ...`).
   - **Chaves primárias obrigatórias (Ruling R-03 / Achado 1):** Todas as views e entidades expostas possuem ao menos uma propriedade-chave (`key`). Entidades totalizadoras sem dimensão natural de agrupamento (`TratativasAbertas`, `TratativasVencidas`, `AcoesEmAndamento`, `BacklogTotal`, `EvidenciasPendentes`) declaram `key 'TOTAL' as id : String(10)`.
   — **Por quê:** cumpre a diretriz de zero replicação física em `db/` e cumpre a especificação OData v4 que exige chaves em todo entity set exposto.
   — **Verificado por:** `cds compile --to sql` comprovando ausência de tabelas físicas novas; compilação de metadados OData v4 sem erros (CA1-CA5).

2. **Segregação de acesso para Pendências sob LGPD e chave estrita não nula** (R2, R10, R11; N3-3; Ruling R-03; Achado 2 do parecer 2).
   - `PendenciasPorResponsavel` possui `key responsavel : String(50)` e é autorizada para os papéis `GestorTratativa` e `Administrador` via `@restrict: [{ grant: '*', to: ['GestorTratativa', 'Administrador'] }]` (em estrito alinhamento com a spec R10 a, R11 b, CA26 e CA30). Usuários com perfil exclusivo de `LeitorAnalitico` ou sem os papéis autorizados recebem HTTP 403 do runtime.
   - Para visualização agregada sem dados pessoais, é disponibilizada a entidade `PendenciasPorUnidadeArea` com `key unidade : String(100)`, `key area : String(100)` e `total : Integer`, acessível a todos os leitores analíticos.
   - Elimina chaves nulas no OData, garantindo conformidade com a especificação OASIS OData v4 e integridade de indexação no Power BI e SAC.
   — **Por quê:** assegura o menor privilégio e a conformidade com a LGPD (AGENTS.md:66) sem produzir conflitos de chaves primárias e sem bloquear o Administrador.
   — **Verificado por:** testes com perfis Gestor/Admin vs Leitor Analítico (CA4, CA5, CA26, CA30).

3. **Data de corte explícita para relógio analítico determinístico** (R2, R8; Achado 5 do parecer 2).
   - A avaliação de ocorrências vencidas (`dataPrevistaConclusao < dataCorte`) é parametrizada com suporte a data de corte determinística.
   - O serviço `AnaliticoService` disponibiliza a function `consultarTratativasVencidas(dataCorte : String)` e o handler intercepta a leitura de `TratativasVencidas` aplicando o parâmetro `dataCorte` (formato ISO `AAAA-MM-DD`).
   - Quando não fornecido pelo consumidor, o valor padrão adotado é a data civil atual calculada em UTC (`new Date().toISOString().slice(0, 10)`).
   - Nos testes automatizados, é passada uma data de corte fixa (ex.: `'2026-10-08'`), garantindo que asserções temporais sejam 100% determinísticas e independentes do dia de execução da esteira.
   — **Por quê:** atende ao requisito obrigatório do brief, eliminando testes intermitentes decorrentes da passagem do tempo.
   — **Verificado por:** CA3 (asserção exata baseada na data de corte `'2026-10-08'`).

4. **Filtros de período temporal via Functions com parâmetros textuais validados no domínio** (R3, R4, R5, R12).
   - Indicadores temporais que exigem intervalo de datas (`CumprimentoDePrazo`, `TempoMedioResolucao`, `TendenciaMensal`, `IndiceResolucao`) são expostos como functions unbound em `AnaliticoService`:
     - `consultarCumprimentoDePrazo(periodoInicio : String, periodoFim : String)`
     - `consultarTempoMedioResolucao(periodoInicio : String, periodoFim : String)`
     - `consultarTendenciaMensal(periodoInicio : String, periodoFim : String)`
     - `consultarIndiceResolucao(periodoInicio : String, periodoFim : String)`
     - `consultarTratativasVencidas(dataCorte : String)`
   - O domínio em `srv/analitico/filtros.ts` valida os parâmetros textuais:
     - Formato ISO `AAAA-MM-DD` (regex `^\d{4}-\d{2}-\d{2}$`); formato inválido recusa com HTTP 400 `Data inválida.` (`target: periodoInicio` ou `periodoFim`);
     - `periodoInicio > periodoFim` recusa com HTTP 400 `Período inválido: a data inicial não pode ser posterior à data final.` (`target: periodoInicio`).
   — **Por quê:** garante compatibilidade cross-database e tratamento semântico de erros de domínio da Decisão D10.
   — **Verificado por:** CA9, CA10, CA11, CA15, CA32, CA32a.

5. **Contrato de erros e autorização via Runtime CAP (Decisão D10 ajustada)** (R10, R12).
   - Em `srv/analitico-service.cds`:
     `@requires: ['GestorTratativa', 'Administrador', 'LeitorAnalitico']`
   - Requisições sem autenticação recebem HTTP 401 do runtime.
   - Requisições de usuários corporativos sem os papéis analíticos ou de `AplicativoOrigem` recebem HTTP 403 com a mensagem `Acesso negado.` exigida pela spec (CA27, CA30); como o 403 estático do `@restrict`/`@requires` do CAP responde `Forbidden` (mensagem fixa), a recusa por papel é feita no handler `before`, como em `mudarStatusAcao`/`aplicarTemplateTratativa` (009). Ruling R-07.
   - Requisições com verbos de modificação (POST, PUT, PATCH, DELETE) são rejeitadas com HTTP 405 Method Not Allowed pelas anotações `@readonly`.
   — **Por quê:** alinha a arquitetura ao comportamento padrão do runtime do CAP.
   — **Verificado por:** CA1, CA25, CA27, CA28.

6. **Exclusão de canceladas e resolução do atraso perpétuo** (R2, R3, R6, R7; Achado 4 do parecer 2).
   - Ocorrências pertencentes a tratativas com `status = 'Cancelada'` (e `Encerrada`) são estritamente excluídas do cálculo de atraso e das contagens de pendência em qualquer data de corte.
   - Todas as views de pendências (`AcoesEmAndamentoView`, `PendenciasPorResponsavelView`, `PendenciasPorUnidadeAreaView`, `PendenciasPorUnidadeView`, `EvidenciasPendentesView`) realizam inner join com `Tratativas` filtrando estritamente `t.status in ('Aberta', 'Em andamento')`.
   — **Por quê:** impede que ações congeladas por cancelamento distorçam métricas operacionais e resolva definitivamente o atraso perpétuo.
   — **Verificado por:** CA3, CA4, CA8, CA19.

7. **Tratamento de origens nulas com rótulo padronizado `'Sem Origem'` e normalização** (R3, R7, R8, R13; Ruling R-03; Achado 3 do parecer 2).
   - Em cumprimento estrito à spec aprovada (R3 a, R8 a, CA7, Invariantes e Q8), registros onde `origem IS NULL` ou vazia são consolidados sob o rótulo oficial `'Sem Origem'` (eliminando qualquer uso de rótulos não homologados).
   - Na agregação de origens, o domínio/handler aplica normalização de espaços (trim) e caixa alta/baixa, consolidando variações de grafia sob a mesma chave canônica conforme R8 b e CA22.
   - Ocorrências sem área são agrupadas sob `'Sem Área'` e ocorrências sem unidade sob `'Sem Unidade'`.
   — **Por quê:** assegura fidelidade absoluta à spec aprovada e previne quebra de testes de agrupamento.
   — **Verificado por:** CA7, CA14, CA22.

8. **Composição completa das métricas executivas (Percentuais, Desvios, Backlog Total e Evidências)** (R4, R5, R13; Achado 4 do parecer 2).
   - `VolumePorOrigemView`: inclui `total : Integer` e `percentual : Decimal(5,2)`, onde `percentual` é calculado no handler dividindo o total da origem pelo total geral de ocorrências (CA14).
   - `PrincipaisDesviosView`: filtra estritamente tratativas ativas em atraso (`dataPrevistaConclusao < dataCorte`), agrupadas por origem em ordem decrescente (CA15).
   - `BacklogTotalView`: a métrica é calculada no handler somando `(total de Tratativas ativas) + (total de Ações ativas vinculadas)`, correspondendo à soma exata exigida pelo CA16.
   - `EvidenciasPendentesView`: filtra ações de tratativas ativas com evidência obrigatória que possuam zero evidências ativas anexadas (`not exists ativo = true`) (CA18).
   - `IndiceResolucao`: admite valores superiores a 100.00% em redução de passivo (CA13).
   — **Por quê:** garante que todas as queries atendam perfeitamente à semântica dos critérios de aceite.
   — **Verificado por:** CA13, CA14, CA15, CA16, CA18.

---

## Contrato executável

### 1. `srv/analitico/operacional.cds`
```cds
using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.operacional;

view TratativasAbertasView as
  select from m.Tratativas {
    key 'TOTAL' as id    : String(10),
        count(*) as total : Integer
  }
  where status = 'Aberta' or status = 'Em andamento';

view TratativasVencidasView as
  select from m.Tratativas {
    key 'TOTAL' as id    : String(10),
        count(*) as total : Integer
  }
  where (status = 'Aberta' or status = 'Em andamento')
    and dataPrevistaConclusao < $now;

view AcoesEmAndamentoView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key 'TOTAL' as id    : String(10),
        count(*) as total : Integer
  }
  where a.status = 'Em andamento'
    and (t.status = 'Aberta' or t.status = 'Em andamento');

view PendenciasPorResponsavelView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key a.responsavel as responsavel : String(50),
        count(*) as total            : Integer
  }
  where (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
  group by a.responsavel;

view PendenciasPorUnidadeAreaView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key coalesce(t.unidade, 'Sem Unidade') as unidade : String(100),
    key coalesce(t.area, 'Sem Área')       as area    : String(100),
        count(*) as total                  : Integer
  }
  where (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
  group by t.unidade, t.area;

view PendenciasPorUnidadeView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key coalesce(t.unidade, 'Sem Unidade') as unidade : String(100),
        count(*) as total                  : Integer
  }
  where (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
  group by t.unidade;
```

### 2. `srv/analitico/gestao.cds`
```cds
using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.gestao;

view TratativasPorOrigemView as
  select from m.Tratativas {
    key coalesce(origem, 'Sem Origem') as origem : String(100),
        count(*) as total              : Integer
  }
  group by origem;

view TratativasPorCriticidadeView as
  select from m.Tratativas {
    key criticidade,
        count(*) as total : Integer
  }
  group by criticidade;

view RankingAreasView as
  select from m.Tratativas {
    key coalesce(area, 'Sem Área') as area : String(100),
        count(*) as total          : Integer
  }
  where status = 'Aberta' or status = 'Em andamento'
  group by area;
```

### 3. `srv/analitico/executivo.cds`
```cds
using { br.com.calazanstec as m } from '../../db/tratativa';

namespace br.com.calazanstec.analitico.executivo;

view VolumePorOrigemView as
  select from m.Tratativas {
    key coalesce(origem, 'Sem Origem')        as origem     : String(100),
        count(*)                              as total      : Integer,
        cast(0.00 as Decimal(5,2))            as percentual : Decimal(5,2)
  }
  group by origem;

view PrincipaisDesviosView as
  select from m.Tratativas {
    key coalesce(origem, 'Sem Origem') as origem       : String(100),
        count(*)                       as totalDesvios : Integer
  }
  where (status = 'Aberta' or status = 'Em andamento')
    and dataPrevistaConclusao < $now
  group by origem;

view BacklogTotalView as
  select from m.Tratativas {
    key 'TOTAL' as id    : String(10),
        count(*) as total : Integer
  }
  where status = 'Aberta' or status = 'Em andamento';

view EvidenciasPendentesView as
  select from m.Acoes as a
  inner join m.Tratativas as t on t.codigo = a.tratativa.codigo {
    key 'TOTAL' as id    : String(10),
        count(*) as total : Integer
  }
  where a.evidenciaObrigatoria = true
    and (a.status = 'Pendente' or a.status = 'Em andamento')
    and (t.status = 'Aberta' or t.status = 'Em andamento')
    and not exists (
      select 1 from m.Evidencias as e
      where e.acao.codigo = a.codigo
        and e.ativo = true
    );
```

### 4. `srv/analitico-service.cds`
```cds
using { br.com.calazanstec.analitico.operacional as op } from './analitico/operacional';
using { br.com.calazanstec.analitico.gestao as gs } from './analitico/gestao';
using { br.com.calazanstec.analitico.executivo as ex } from './analitico/executivo';
using { br.com.calazanstec as m } from '../db/tratativa';

@path    : '/api/analitico/v1'
@requires: ['GestorTratativa', 'Administrador', 'LeitorAnalitico']
service AnaliticoService {

  // --- Nível Operacional ---
  @readonly entity TratativasAbertas as projection on op.TratativasAbertasView;
  @readonly entity TratativasVencidas as projection on op.TratativasVencidasView;
  @readonly entity AcoesEmAndamento as projection on op.AcoesEmAndamentoView;

  // Gestor e Administrador (com matrícula; Spec R10 a, R11 b, CA26, CA30)
  @readonly
  @restrict: [{ grant: '*', to: ['GestorTratativa', 'Administrador'] }]
  entity PendenciasPorResponsavel as projection on op.PendenciasPorResponsavelView;

  // Aberto a Leitores Analíticos, Gestores e Administradores (sem matrícula)
  @readonly entity PendenciasPorUnidadeArea as projection on op.PendenciasPorUnidadeAreaView;
  @readonly entity PendenciasPorUnidade as projection on op.PendenciasPorUnidadeView;

  // --- Nível de Gestão ---
  @readonly entity TratativasPorOrigem as projection on gs.TratativasPorOrigemView;
  @readonly entity TratativasPorCriticidade as projection on gs.TratativasPorCriticidadeView;
  @readonly entity RankingAreas as projection on gs.RankingAreasView;

  // --- Nível Executivo ---
  @readonly entity VolumePorOrigem as projection on ex.VolumePorOrigemView;
  @readonly entity PrincipaisDesvios as projection on ex.PrincipaisDesviosView;
  @readonly entity BacklogTotal as projection on ex.BacklogTotalView;
  @readonly entity EvidenciasPendentes as projection on ex.EvidenciasPendentesView;

  // --- Functions analíticas com filtros e data de corte ---
  type RetornoCumprimentoPrazo { taxaPercentual : Decimal(5,2); }
  type RetornoTempoMedioResolucao { mediaDias : Decimal(5,1); }
  type ItemTendenciaMensal { mesReferencia : String(7); totalCriadas : Integer; totalEncerradas : Integer; }
  type RetornoIndiceResolucao { indicePercentual : Decimal(6,2); }
  type RetornoTotalizador { total : Integer; }

  function consultarCumprimentoDePrazo(periodoInicio : String, periodoFim : String) returns RetornoCumprimentoPrazo;
  function consultarTempoMedioResolucao(periodoInicio : String, periodoFim : String) returns RetornoTempoMedioResolucao;
  function consultarTendenciaMensal(periodoInicio : String, periodoFim : String) returns many ItemTendenciaMensal;
  function consultarIndiceResolucao(periodoInicio : String, periodoFim : String) returns RetornoIndiceResolucao;
  function consultarTratativasVencidas(dataCorte : String) returns RetornoTotalizador;
}
```

### Contrato de Erros e Precedência (Decisão D10)

| Etapa | Verificação | Quem valida | HTTP | Mensagem de erro | Target |
|---|---|---|---|---|---|
| 1 | Autenticação | Runtime CAP (`@requires`) | 401 | - | - |
| 2 | Autorização / Papel estático (`@requires` / `@restrict`) | Runtime CAP | 403 | - | - |
| 3 | Forma do pedido no runtime | Runtime CAP | 400 | Mensagem do framework | - |
| 4 | Formato de data inválido em parâmetro temporal | Domínio (`filtros.ts`) | 400 | `Data inválida.` | `periodoInicio` / `periodoFim` / `dataCorte` |
| 4 | `periodoInicio > periodoFim` | Domínio (`filtros.ts`) | 400 | `Período inválido: a data inicial não pode ser posterior à data final.` | `periodoInicio` |
| 4 | Tamanho de página OData (`$top > 1000` ou `< 1`) | Domínio | 400 | `O campo Tamanho da página aceita de 1 a 1000.` | `$top` |
| 5 | Consulta com filtros que não localizam dados | Domínio | 200 | Retorna lista vazia `[]` ou totalizador 0 | - |

---

## Tasks

| Task | Objetivo | Branch |
|---|---|---|
| `tasks/001-dashboards-e-indicadores.md` | Entregar o intent 012 em 4 etapas sequenciais RED/GREEN: serviço analítico e views operacionais com segregação LGPD (R1, R2, R10, R11); views de gestão e functions temporais com 'Sem Origem' (R3, R7, R8); views executivas, índice de resolução e evidências pendentes (R4, R5, R6, R13); validações de paginação e filtros temporais D10 (R9, R12). | `dashboards-e-indicadores/001-dashboards-e-indicadores` |

---

## Itens N3 (aguardam aprovação no Gate 1)

| Item | Origem | Impacto | Justificativa e Mitigação |
|---|---|---|---|
| N3-1 | R1, R9 | Criação do novo serviço `AnaliticoService` em `srv/analitico-service.cds` com processamento somente leitura via CDS Views. | Exposição estruturada OData v4 padronizada para ferramentas de BI corporativas (Power BI e SAC) sem persistência física duplicada de dados analíticos. |
| N3-2 | R10 | Novo papel corporativo `Leitor Analítico` (`LeitorAnalitico`) formalizado para consumo analítico. | Permite conceder acesso estritamente somente leitura para ferramentas externas de BI e executivos, delegando a amarração formal no BTP XSUAA para o intent 014. |
| N3-3 | R11 | Segregação LGPD no indicador de pendências com `PendenciasPorResponsavel` restrito a Gestor e Administrador, e `PendenciasPorUnidadeArea` aberto a Leitores Analíticos sem matrículas. | Garante que painéis e dashboards corporativos não exponham dados funcionais de colaboradores fora do escopo de gestão direta da ocorrência (`AGENTS.md:66`). |
| N3-4 | R9, R12 | Precedência consolidada de recusas e limitação rígida de paginação analítica com `$top` máximo de 1.000 registros. | Protege a infraestrutura do SAP BTP contra esgotamento de memória por extrações analíticas descontroladas, mantendo o contrato de erro D10 padronizado. |

---

## Como isso se prova

Mapeamento completo dos 35 Critérios de Aceite (CA1 a CA34, incluindo CA32a) nas 4 etapas sequenciais de implementação da task:

- **Etapa 1 (Serviço analítico, papel Leitor Analítico, views operacionais e proteção LGPD):**
  - CA1: Requisições POST, PUT, PATCH ou DELETE em qualquer entidade de `AnaliticoService` recebem HTTP 405 Method Not Allowed e nenhuma escrita é realizada.
  - CA2: Indicador `TratativasAbertas` contabiliza estritamente Tratativas com Status `Aberta` e `Em andamento`.
  - CA3: Indicador `TratativasVencidas` com data de corte fixa `'2026-10-08'` contabiliza tratativas com prazo vencido e exclui canceladas e encerradas.
  - CA4: Indicador `AcoesEmAndamento` contabiliza ações com Status `Em andamento` de Tratativas ativas.
  - CA5: `PendenciasPorResponsavel` consultada por Gestor ou Administrador retorna contagem com a chave da matrícula do responsável.
  - CA6: Indicador `PendenciasPorUnidade` agrupa total de pendências de Tratativas ativas por Unidade.
  - CA19: Tentativa de inserção ou alteração de registros via `AnaliticoService` é recusada (405); ações de tratativas canceladas não contam como pendências.
  - CA25: Acesso sem autenticação retorna HTTP 401.
  - CA26: Usuário com perfil `Leitor Analítico`, `GestorTratativa` ou `Administrador` autenticado acessa os indicadores com sucesso (HTTP 200).
  - CA27: Usuário sem papel analítico corporativo recebe HTTP 403.
  - CA28: Credencial técnica de `AplicativoOrigem` recebe HTTP 403.
  - CA29: Administrador da plataforma acessa o serviço analítico com sucesso.
  - CA30: Consulta a `PendenciasPorResponsavel` por usuário com perfil exclusivo `Leitor Analítico` recebe HTTP 403; consulta a `PendenciasPorUnidadeArea` retorna contagem sem matrículas; consulta por Gestor ou Administrador retorna com matrícula.

- **Etapa 2 (Views de gestão, histórico unificado, tratamento de 'Sem Origem' e functions de prazo):**
  - CA7: `TratativasPorOrigem` agrupa ocorrências por Origem e consolida tratativas avulsas ou nulas sob o rótulo oficial `'Sem Origem'` (ex.: 'Registro de Acidente': 5, 'Advertência': 3, 'Sem Origem': 2).
  - CA8: `TratativasPorCriticidade` contabiliza tratativas agrupadas por Baixa, Média, Alta e Crítica.
  - CA9: `CumprimentoDePrazo` calcula a taxa percentual de tratativas concluídas no prazo no período informado.
  - CA10: `TempoMedioResolucao` calcula a média de dias decorridos até o encerramento.
  - CA11: `RankingAreas` retorna áreas ordenadas decrescentemente por total de tratativas ativas, agrupando nulos sob `'Sem Área'`.
  - CA12: Tratativas canceladas não contam como prazo cumprido nem computam atraso perpétuo.
  - CA20: Consulta com filtros temporais válidos retorna dados filtrados pelo período.
  - Período sem ocorrências finalizadas retorna 100.00% em cumprimento de prazo (spec R3(c), CA10) e 0.0 em tempo médio (spec R3(d)). Nota (Ruling R-05): a numeração e o comportamento dos CAs seguem a spec; esta lista é um resumo por etapa.
  - CA22: Normalização de origens: variações como "advertência", " Advertência " e "ADVERTÊNCIA" são consolidadas sob a mesma chave.

- **Etapa 3 (Views executivas, índice de resolução e evidências pendentes):**
  - CA13: `IndiceResolucao` calcula a razão percentual entre encerradas e criadas no período, aceitando valores superiores a 100.00% em redução de passivo.
  - CA14: `VolumePorOrigem` calcula o total e a participação percentual (`percentual : Decimal(5,2)`) de cada origem sobre o total.
  - CA15: `PrincipaisDesvios` lista origens ordenadas pelo número de tratativas ativas em atraso (`dataPrevistaConclusao < dataCorte`).
  - CA16: `BacklogTotal` contabiliza a soma de Tratativas ativas e Ações ativas vinculadas acumuladas na plataforma.
  - CA17: Séries temporais e backlog desconsideram registros cancelados.
  - CA18: `EvidenciasPendentes` contabiliza ações ativas de tratativas ativas com evidência obrigatória e zero evidências ativas anexadas.
  - CA34: Toda a infraestrutura analítica é genérica e aplicável a qualquer departamento sem menção exclusiva ao SESMT.

- **Etapa 4 (Exposição OData v4, limites de paginação e validações D10):**
  - CA23: Paginação OData com `$top` e `$skip` divide coleções analíticas corretamente.
  - CA24: Requisição analítica com `$top > 1000` recebe HTTP 400 `O campo Tamanho da página aceita de 1 a 1000.` (`target: $top`).
  - CA31: Filtro com `periodoInicio > periodoFim` recebe HTTP 400 `Período inválido: a data inicial não pode ser posterior à data final.` (`target: periodoInicio`).
  - CA32: Filtro com data malformada recebe HTTP 400 `Data inválida.` (`target: periodoInicio` / `periodoFim`).
  - CA32a: Filtro temporal sem registros no intervalo retorna coleção vazia `[]` ou totalizador zerado com HTTP 200.
  - CA33: Filtro com valor inválido de criticidade recebe HTTP 400 (`target: criticidade`).

---

## O que não muda

- Nenhuma tabela do banco de dados persistido (`db/`) sofre alteração ou ganha colunas analíticas redundantes.
- Os serviços transacionais `TratativaService` (`/api/tratativa/v1`), `AdministracaoService` e `IntegracaoOrigemService` permanecem inalterados.
- Nenhuma operação de escrita é introduzida pelo intent 012.

---

## O desconfortável, declarado

1. **Chaves artificiais para entidades escalares/totalizadoras no OData v4:**
   O protocolo OData v4 exige que todo Entity Set tenha ao menos uma propriedade `key`, inviabilizando views puras que retornam apenas uma linha com `count(*) as total`. A declaração de `key 'TOTAL' as id : String(10)` resolve o contrato OData e satisfaz os conectores de Power BI e SAC sem persistência em banco.

2. **Cálculo de percentuais e soma de backlog no handler analítico:**
   Como views analíticas em bancos relacionais exigem operações analíticas de janela (Window Functions) ou subconsultas que podem apresentar variações entre SQLite em memória e SAP HANA Cloud, a complementação do campo `percentual` em `VolumePorOrigem` e a soma de tratativas e ações para `BacklogTotal` no handler de leitura garante paridade total de comportamento entre ambientes de teste e produção.

---

## Arquivos Envolvidos

- `package.json`
- `srv/analitico-service.cds`
- `srv/analitico-service.ts`
- `srv/analitico/operacional.cds`
- `srv/analitico/gestao.cds`
- `srv/analitico/executivo.cds`
- `srv/analitico/filtros.ts`
- `test/apoio/analitico.ts`
- `test/analitico-operacional-lgpd.test.ts`
- `test/analitico-gestao-metricas.test.ts`
- `test/analitico-executivo-evidencias.test.ts`
- `test/analitico-odata-precedencia-d10.test.ts`
