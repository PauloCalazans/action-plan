# Intent: Integração com SuccessFactors (somente leitura)

**Autor:** Paulo Calazans
**Sponsor:** nenhum (projeto sem sponsor designado)
**Data:** 2026-10-07
**Status:** aprovado
**Origem:** ideia

## Problema
Unidade, Área, solicitantes, responsáveis e gestores precisam refletir a estrutura real da organização; digitá-los manualmente gera inconsistência e retrabalho (fonte: humano:2026-10-07, proposta anexada, seção Arquitetura BTP).

## Resultado proposto
A solução consome do SAP SuccessFactors, **somente leitura**:

- Estrutura Organizacional
- Colaboradores
- Gestores

Esses dados alimentam a escolha de Unidade, Área, Solicitante e Responsável (intents 003 e 005). A solução nunca escreve de volta no SuccessFactors (`AGENTS.md`, regras invioláveis).

## Usuários e sistemas afetados
- SAP SuccessFactors — fonte.
- Todos os usuários que escolhem pessoas, Unidade ou Área.
- Intents 003, 005, 010 (destinatários) e 012 (agrupamento por Unidade/Área).

## Restrições e não-escopo
- Restrição: somente leitura.
- Restrição: colaboradores são dados pessoais (LGPD): finalidade, acesso e retenção a definir.
- Restrição: testes não usam o SuccessFactors real.
- Fora de escopo: escrita no SuccessFactors; autenticação de usuários (a ser tratada em intent próprio ou no de acesso, 013).

## Critérios de aceite de negócio
- A estrutura organizacional, os colaboradores e os gestores do SuccessFactors podem ser consultados na solução.
- Ao escolher Responsável ou Solicitante, o usuário vê colaboradores reais, com gestor.
- Alterações no SuccessFactors se refletem na solução em tempo previsto.
- A solução não grava nada no SuccessFactors.

## Questões abertas
- Quais atributos de colaborador são necessários (nome, e-mail, cargo, unidade, gestor, situação)? Mínimo necessário por LGPD.
- Frequência de atualização (tempo real, diária, sob demanda)?
- Como são tratados desligamentos e mudanças de gestor/área com pendências abertas?
- Há mais de um sistema de origem de pessoas, ou todos estão no SuccessFactors (terceiros)?
- Antes da integração disponível, como os dados de pessoas são fornecidos no MVP (carga manual)? Isso define a ordem de entrega em relação aos intents 003 e 005.
- Os conceitos "Unidade" e "Área" do intent 003 mapeiam para quais níveis da estrutura organizacional?
- A identidade do usuário logado também vem do SuccessFactors?
- Os aplicativos de origem (intent 002) identificam pessoas (solicitante, envolvidos) por um identificador que casa com o do SuccessFactors? Quando o aplicativo de origem já informa Unidade, Área ou Solicitante, qual fonte prevalece: o aplicativo ou o SuccessFactors?
