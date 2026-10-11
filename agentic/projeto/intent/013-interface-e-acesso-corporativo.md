# Intent: Interface de usuário e acesso corporativo

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** aprovado
**Origem:** ideia

## Problema
As capacidades dos intents 002 a 012 precisam estar acessíveis aos usuários (SESMT, gestores, responsáveis, aprovadores e administradores) por uma interface corporativa única, hoje inexistente (fonte: humano:2026-10-07, proposta anexada, seção Componentes da Solução, item 1 "Tela administrativa", e seção Arquitetura BTP).

## Resultado proposto
Os usuários acessam a solução por um ponto de entrada corporativo único, com telas para: cadastro e parametrização de Origens (002), Tratativas (003), Ações (004), Responsáveis (005), Evidências (006), Comentários (007), Histórico (008), Templates (009) e indicadores (012). A proposta cita, na seção Arquitetura BTP, uma camada de aplicação e um portal de acesso (SAP Build Apps e SAP Build Work Zone). Pelo contrato do domínio, o intent registra apenas a necessidade de negócio (um portal corporativo único e telas de uso).

## Usuários e sistemas afetados
- SESMT, gestores, responsáveis por Ações, aprovadores, administradores.

## Restrições e não-escopo
- Restrição: a stack é decisão do arquiteto, conforme `AGENTS.md` (Fiori elements/UI5 e Work Zone como launchpad; "SAP Build Apps fica fora deste repositório").
- Restrição: acesso e perfis por papel (SESMT, gestores, responsáveis, aprovadores), a detalhar.
- Fora de escopo: aplicativos móveis (não constam, a confirmar).

## Critérios de aceite de negócio
- Cada capacidade dos intents 002 a 012 pode ser operada por tela, sem apoio da engenharia.
- Os usuários entram por um ponto único e só veem o que seu papel permite.

## Questões abertas
- O que é o "Build Apps" da proposta: um aplicativo separado (por exemplo, móvel, para o campo) a ser construído por outra equipe? Há necessidade de uso em campo (registrar Acidente no local, fotos pelo celular)? `AGENTS.md` o deixa fora do repositório.
- Perfis e permissões de cada papel e restrições por Unidade/Área.
- Idioma (apenas português?) e requisitos de acessibilidade.
- Uso em celular/offline para Evidências no campo?
- Como o usuário se autentica (login corporativo)?
