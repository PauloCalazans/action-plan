# Proposta de Solução - Plataforma Corporativa de Tratativas e Planos de Ação

## Visão Geral

A proposta consiste na construção de uma plataforma corporativa de gestão de tratativas, onde o conceito central não é o Plano de Ação em si, mas sim a **Origem da Tratativa**.

Esta abordagem permite que a mesma solução seja utilizada futuramente por qualquer área da organização sem necessidade de alterações estruturais significativas.

O Plano de Ação passa a ser apenas um mecanismo de execução vinculado a uma origem específica.

---

# Conceito Principal

## Origem da Tratativa

A origem representa o processo ou evento que gerou a necessidade de ação.

Exemplos:

- SESMT
  - Acidente
  - Quase Acidente
  - Condição Insegura
  - Ato Inseguro
  - Auditoria de Segurança

- Qualidade
  - Não Conformidade
  - Auditoria
  - Reclamação

- RH
  - PDI
  - Avaliação de Desempenho
  - Pesquisa de Clima

- Compliance
  - Achado de Auditoria
  - Canal de Denúncias

- CSC
  - Chamados Recorrentes
  - Planos de Melhoria

- Sustentabilidade
  - Gestão de Resíduos
  - Licenças Ambientais

---

# Modelo Conceitual

```text
Origem
    │
    ▼
Tratativa
    │
    ├── Plano de Ação
    ├── Evidências
    ├── Comentários
    ├── Histórico
    ├── Indicadores
    └── Responsáveis
```

---

# Componentes da Solução

## 1. Cadastro de Origens

Tela administrativa para cadastramento e parametrização das origens.

Exemplo:

```text
Origem: SESMT

Tipos:

- Acidente
- Quase Acidente
- Condição Insegura
- Auditoria
```

Cada origem poderá possuir regras próprias.

---

## 2. Tratativa

Registro principal da solução.

Campos sugeridos:

- Código
- Título
- Descrição
- Origem
- Tipo
- Unidade
- Área
- Criticidade
- Data de criação
- Data prevista de conclusão
- Status
- Responsável
- Solicitante

---

## 3. Plano de Ação

Uma tratativa poderá possuir uma ou várias ações.

Campos:

- Descrição da ação
- Responsável
- Prazo
- Prioridade
- Status
- Evidência obrigatória
- Data conclusão

---

## 4. Evidências

Permitir anexação de:

- Fotos
- PDFs
- Relatórios
- Planilhas
- Arquivos diversos

As evidências permanecem vinculadas à ação e à tratativa.

---

## 5. Comentários

Registro colaborativo entre:

- SESMT
- Gestores
- Responsáveis
- Aprovadores

Com histórico permanente.

---

## 6. Histórico e Auditoria

Registrar:

- Alteração de status
- Mudança de responsável
- Alteração de prazo
- Inclusão de evidências
- Encerramento
- Reabertura

---

# Regras de Negócio

## Criticidade

Classificação padrão:

```text
Baixa
Média
Alta
Crítica
```

---

## Prazos

Definidos através de parametrização.

Exemplo:

```text
Crítica = 3 dias

Alta = 7 dias

Média = 15 dias

Baixa = 30 dias
```

---

## Responsabilidade

A solução define responsáveis diretamente.

Sem necessidade de workflow.

Exemplo:

```text
Responsável Principal

+
Participantes
```

---

## Alertas

Regras executadas automaticamente pela aplicação.

Exemplos:

- Prazo próximo do vencimento
- Prazo vencido
- Ausência de atualização
- Evidência pendente

Notificações:

- E-mail
- Microsoft Teams

---

# Templates

Permitir criação de modelos reutilizáveis.

Exemplo:

```text
Template:
Condição Insegura
```

Ações geradas:

```text
1. Avaliar local

2. Definir correção

3. Executar correção

4. Validar correção
```

---

# Estrutura Analítica

As ações poderão ser organizadas hierarquicamente.

```text
Tratativa
    ├── Ação 1
    │     ├── Subação 1.1
    │     └── Subação 1.2
    │
    └── Ação 2
```

---

# Dashboards

## Operacional

- Tratativas abertas
- Tratativas vencidas
- Ações em andamento
- Pendências por responsável
- Pendências por unidade

## Gestão

- Tratativas por origem
- Tratativas por criticidade
- Cumprimento de prazo
- Tempo médio de resolução
- Ranking de áreas

## Executivo

- Tendência mensal
- Volume por origem
- Principais desvios
- Backlog total
- Índice de resolução

---

# Arquitetura BTP

```text
SAP SuccessFactors
        │
        ├── Estrutura Organizacional
        ├── Colaboradores
        └── Gestores
                │
                ▼
SAP BTP
        │
        ├── SAP Build Apps
        ├── CAP
        ├── HANA Cloud
        ├── Business Rules
        └── SAP Build Work Zone
                │
                ▼
Power BI / SAC
```

---

# MVP SESMT

A primeira versão implementará apenas as origens relacionadas ao SESMT:

- Acidente
- Quase Acidente
- Condição Insegura
- Ato Inseguro
- Inspeção
- Auditoria de Segurança

Toda a modelagem, porém, será construída de forma genérica para permitir evolução futura sem alteração estrutural da solução.

---

# Diferencial Estratégico

O principal diferencial da solução é que o Plano de Ação não é a entidade principal. A entidade principal passa a ser a **Origem da Tratativa**.

Essa abordagem transforma a solução em uma plataforma corporativa reutilizável para qualquer processo que gere ações corretivas, preventivas ou de melhoria, evitando a criação de múltiplas ferramentas isoladas ao longo do tempo.