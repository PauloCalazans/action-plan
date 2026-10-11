# Intent: Publicação corporativa da solução

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** aprovado
**Origem:** ideia

## Problema
Até aqui, a solução só roda em ambiente de desenvolvimento. Para uso real, ela precisa ser publicada no ambiente corporativo, com segurança de acesso e conexão com as integrações (fonte: humano:2026-10-07, proposta anexada, seção Arquitetura BTP). O intent 001 deixou explicitamente para um intent de deploy os itens de publicação e segurança (decisão do humano em 2026-10-06).

## Resultado proposto
A solução está publicada no ambiente corporativo previsto na proposta (plataforma SAP BTP com banco HANA Cloud, seção Arquitetura BTP), com controle de acesso por perfil e integrações configuradas (SuccessFactors, e-mail, Teams, consumo analítico). Os detalhes técnicos são do arquiteto.

## Usuários e sistemas afetados
- Todos os usuários finais; equipe de engenharia e operação da plataforma.
- Integrações dos intents 010, 011 e 012.

## Restrições e não-escopo
- Restrição: deploy e segurança são itens N3 (`AGENTS.md`), exigem aprovação humana.
- Restrição: nunca versionar credenciais.
- Fora de escopo: desenvolvimento das funcionalidades (002 a 012).

## Critérios de aceite de negócio
- Usuários autorizados acessam a solução no ambiente corporativo; não autorizados, não.
- Integrações funcionam no ambiente publicado.
- Nenhuma credencial é versionada.

## Questões abertas
- Quais ambientes (desenvolvimento, homologação, produção) e quem aprova promoções?
- Perfis de acesso por papel e por Unidade/Área.
- Requisitos de disponibilidade, backup, retenção e conformidade LGPD.
- Há prazo/data alvo de entrada em produção do MVP SESMT?
- Migração de dados do acompanhamento atual do SESMT para a solução?
