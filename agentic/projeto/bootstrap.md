# Respostas do bootstrap

Data: 2026-10-06. Fonte do contexto: `Proposta Plano de Ação SESMT SSA.md`.

## Contexto
- Produto: plataforma corporativa de tratativas e planos de ação; a entidade central é a Origem da Tratativa. — `inferido` (proposta)
- Usuários: SESMT, gestores, responsáveis, aprovadores; depois outras áreas (Qualidade, RH, Compliance, CSC, Sustentabilidade). — `inferido` (proposta)
- Domínio: Saúde e Segurança do Trabalho (MVP) sobre um modelo genérico de ações corretivas/preventivas/de melhoria. — `inferido` (proposta)
- Projeto novo, sem código legado. — `confirmado`
- Restrições: LGPD (dados de colaboradores, acidentes, saúde ocupacional); SuccessFactors somente leitura. — `inferido`; LGPD como gatilho N3 `confirmado`

## Stack
- SAP CAP Node.js + TypeScript; HANA Cloud; Fiori elements/UI5 em `app/`; Work Zone. — `confirmado`
- Gerenciador: npm. — `inferido`
- Comandos: instalar `npm ci`; build `npm run build`; lint `npm run lint`; testes `npm test`; arquitetura `npm run arch`. — `inferido`
- `CMD_VERIFY_STACK = npm run build && npm run lint && npm test && npm run arch` — `inferido`
- `CMD_TESTE = npm test`; `CMD_TESTE_ARQUIVO = npx jest {}`; `CMD_PREPARAR_TESTE = npm ci` — `inferido`
- Teste desabilitado: `(it|test|describe)\.(skip|todo)\(|(^|[^A-Za-z0-9_])x(it|test|describe)\(`; asserção: `expect\(`; JUnit: `reports/junit/*.xml` (jest-junit). — `inferido`

## Estrutura
- Camadas CAP: `db/`, `srv/` (integrações em `srv/integracoes/`), `app/<app>/`; testes em `test/`. — `inferido`
- Fronteiras: dependency-cruiser (`npm run arch`). — `inferido`

## Risco
- Caminhos protegidos: apenas os do framework. — `inferido`
- Gatilhos N3 adicionais: modelo persistido em HANA (`db/**/*.cds`), deploy/infra (`mta.yaml`, `xs-security.json`, destinations), dados pessoais (LGPD). — `confirmado`
- Dependências sensíveis: `@sap/cds`, `@sap/xssec`, SDKs de integração (toda dependência nova já é N3). — `inferido`

## Fontes externas
- Nenhuma por enquanto (sem oráculos). — `confirmado`

## Operação
- Branch principal: `main`. — `inferido`
- Plataforma de PR: GitHub via `gh`; sem CI por enquanto. — `confirmado`
- Gate 1 e Gate 2: Paulo Calazans. — `confirmado`
- Modo automático: desligado. — `confirmado`

## Pendências
- `verify.sh` não passa ainda: não existe `package.json` (projeto sem código). A primeira mudança (trilha rápida, `chore`) é o scaffold CAP com os scripts npm de D1, jest-junit e `.dependency-cruiser.cjs` de D2.
- Repositório local sem remote no GitHub: criar o repositório e `git remote add origin …` antes da primeira publicação (fase 6).
