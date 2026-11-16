# Escolha de modelo por papel

Lido pelo orquestrador e pelo `/bootstrap`. Os papéis não precisam deste arquivo.

**Regra-mãe:** otimize o custo da task **aprovada**, não o da chamada: rodada extra de revisão, retrabalho e conferência pelo orquestrador entram na conta.

## Níveis
Por capacidade, não por nome:
- **forte** — o modelo de raciocínio de topo disponível;
- **médio** — o modelo de código de uso geral;
- **leve** — o rápido e barato.

O mapeamento produto/modelo → nível fica na decisão de composição do time, em `agentic/projeto/decisoes.md`.

## Nível de partida por papel
O nível acompanha o custo do erro que escapa e a existência de um mecanismo que o pegue.

| Papel | Nível |
|---|---|
| `arquiteto` | forte |
| `revisor` | forte |
| `dominio` | médio |
| `testes` | médio |
| `dev` | médio; o primeiro a rebaixar |
| transcrição (o brief já traz o código completo) | leve |
| orquestrador | médio; forte só se o `revisor` não for forte |

## Ajuste por dado
A medição são as devoluções e rodadas dos pareceres (coluna Causa, em `agentic/.estado/execucao/`) e a linha "Rodadas" dos PRs.
- **Subir um nível:** o papel teve Crítico ou Importante em duas rodadas da mesma task, ou em duas tasks seguidas.
- **Descer um nível, como experimento:** o papel foi aprovado na primeira rodada em três tasks seguidas. Volte se a regra de subir disparar.
- **Antes de trocar o modelo, baixe o esforço de raciocínio,** quando o produto permitir.
- **Nunca rebaixe o `revisor`.** Com o Gate 1 delegado, ele fica no nível forte também em time misto.
- Toda troca é decisão humana: registre-a como ajuste da decisão de composição do time, com o dado que a motivou.

## Orquestrador externo ou mais de um produto
Quando os papéis rodam em produtos diferentes (por exemplo, um canvas que orquestra várias CLIs de agente), o orquestrador propõe a composição do time no `/bootstrap` e sempre que o humano mudar os produtos disponíveis:
1. **Inventário.** Para cada produto: modelos e o nível de cada um; cota ou limite da licença; se permite negar escrita a um papel; se aplica `deny` e hooks como o adaptador do Claude Code. Marque cada item `confirmado` ou `inferido`.
2. **Nível.** Atribua pela tabela acima. Na falta do nível pedido, use o mais próximo acima no `arquiteto` e no `revisor`, e o mais próximo abaixo nos demais.
3. **Cota.** Estime os despachos por papel: por spec, `dominio`, `arquiteto` e `revisor` (`spec` e `design`); por mudança enxuta, `arquiteto` e `revisor` (`mudanca`, quando obrigatório); por task, `testes`, `dev` e `revisor` (`diff`), mais as devoluções. Ponha os papéis frequentes no produto com mais cota.
4. **Ferramentas.** O `revisor` vai para um produto que restrinja a escrita ao parecer; sem isso, "escreve só o parecer" fica por revisão e pela conferência ao receber (lista "Ao receber" do template de brief), e a decisão diz isso. Os papéis que escrevem (`testes`, `dev`) vão de preferência para um produto que aplique `deny`; nos outros, só os githooks protegem, e a decisão também diz isso.
5. **Independência.** Com mais de uma família de modelos, prefira o `revisor` numa família diferente da do autor do que ele revisa: do `arquiteto` no modo `design` e `mudanca`, do `dev` no modo `diff` (preferência, não exigência). Autor e revisor no mesmo modelo erram juntos: o ponto cego é correlacionado.
6. **Proposta.** Apresente uma composição recomendada e uma alternativa mais barata, com o que cada uma sacrifica. O humano escolhe. Grave `D<n> — Composição do time` com a tabela papel | produto | modelo | nível | ferramentas, incluindo a linha do orquestrador.

**Verificado por:** revisão. Nenhum mecanismo confere qual modelo de fato rodou.
