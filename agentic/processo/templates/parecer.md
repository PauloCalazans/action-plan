<!-- Template de parecer do revisor. O revisor preenche e apaga este comentário.
- Onde: no caminho que o brief dá, agentic/.estado/execucao/<AAAA-MM-DD>-<nome>/NN-revisor-<modo>-parecer.md, fora do
  worktree revisado. O parecer é local (agentic/.estado/ não é versionado); o PR leva o veredito e os achados menores.
  Sem plataforma de PR, o orquestrador copia o parecer final aprovado para agentic/projeto/specs/<nome>/pareceres/<NNN>-diff.md (NNN = número da task).
- Escala do kit: Crítico e Importante bloqueiam; Menor não abre rodada: vai com a próxima correção ou, sem ela, no PR.
- Rodada `<k>`: conta todos os pareceres do mesmo artefato (a spec, o design, o documento enxuto ou o diff da task), também os de ajuste reaberto por Ruling, decisão ou achado a jusante; nunca recomeça. O número e o parecer anterior vêm na linha da rodada em "O que fazer" do brief: quem conta é o orquestrador. Com parecer anterior, a rodada é de confirmação.
- Causa (coluna da tabela de achados): defeito | contrato | não conferido | sem contrato | forma. Na rodada >= 2, acrescente `· já na rodada 1` quando o defeito já estava no artefato da rodada 1. `sem contrato` diz em Problema onde a regra deveria estar.
- Toda evidência é `medido` (você abriu ou rodou) ou `inferido` (dedução). Aprovar sem abrir as citações e rodar a
  verificação não vale.
-->
# Parecer — <modo: spec | design | mudanca | diff> — <task ou artefato> — rodada <k>

**Veredito:** <APROVADO | DEVOLVIDO> · C <n> I <n> M <n>
**Revisado:** <intervalo de SHAs base..HEAD (modo diff) | caminho do artefato>
**Parecer anterior:** <caminho do último parecer do mesmo artefato, na rodada de confirmação | não há (rodada 1)>

## Rodada anterior
<só na confirmação (com parecer anterior); senão: não se aplica>

| Achado anterior | Situação | Evidência no HEAD |
|---|---|---|
| <ID> | <corrigido \| não corrigido \| parcial> | <arquivo:linha> |

## Critérios de aceite
<no modo diff; nos modos spec, design e mudanca: não se aplica>

| CA | Teste | Status |
|---|---|---|
| <CA<n>> | <arquivo:linha do teste> | <coberto \| não coberto> (<medido \| inferido>) |

## Achados
<ou: nenhum>

| ID | Classe | Causa | Onde | Problema | Evidência |
|---|---|---|---|---|---|
| <C1 \| I1 \| M1> | <Crítico \| Importante \| Menor> | <valor de Causa> | <arquivo:linha> | <o que está errado e o que precisa passar a ser verdade; nunca a correção> | <medido \| inferido>: <o que você viu> |

## Verificação
```
<comando rodado, em primeiro plano (no modo diff, sh agentic/mecanismos/scripts/verify.sh)>
<últimas linhas da saída>
```
