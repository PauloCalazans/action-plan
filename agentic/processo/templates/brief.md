<!-- Template de brief de papel. O orquestrador preenche e apaga este comentário; o brief começa na linha "Papel:".
Por quê: cada requisição do papel reenvia o contexto inteiro. Arquivo lido inteiro, saída de shell larga e exploração
sem rumo são contexto inútil; "leia só isto", saída curta e teto declarado cortam esse custo. E a regra que está só no
contrato linkado não chega ao papel: o brief é o texto que ele lê com atenção.

- Meta: até ~40 linhas, sem contar o `## Impacto` colado nem os trechos que ele acrescenta a "Leia só isto". Brief maior vira um segundo contrato e traz o custo de volta.
- Toda seção obrigatória aparece; quando não há nada a dizer, escreva `nenhum`.
- Caminhos absolutos sempre, inclusive em rodada de correção. `Papel:` é o nome exato de um contrato de agentic/processo/papeis/.
- Rodada de correção: copie para um arquivo novo o brief anterior do mesmo papel, inteiro; reescreva "O que fazer",
  acrescente "Desde a rodada anterior" e ajuste o resto só onde a rodada mudou. Nunca "mesmo contrato", "mesmo escopo
  do brief anterior" nem "continuação": o papel numa sessão nova não tem o brief anterior.
- Arquivos na pasta de execução agentic/.estado/execucao/<AAAA-MM-DD>-<nome>/, pela ordem de despacho (NN = 01, 02, …):
  brief `NN-<papel>[-<modo>]-brief.md`; relatório `NN-<papel>[-<modo>]-relatorio.md`; revisor `NN-revisor-<modo>-parecer.md`
  (pelo template agentic/processo/templates/parecer.md).
- Linha de retorno: `NN-<papel>: <FEITO|FEITO_COM_RESSALVAS|BLOQUEADO> | <campos do "Ao terminar" do contrato> | <arquivo de relatório>`;
  no revisor: `NN-revisor-<modo>: <APROVADO|DEVOLVIDO> | C n I n M n | <arquivo do parecer>`.
-->
Papel: <papel exato do kit>[ — modo <modo>]
Contrato: <caminho absoluto de agentic/processo/papeis/<papel>.md>
Perfil: <caminho absoluto de agentic/projeto/papeis/<papel>.md>[; <outro perfil absoluto>]
Task: <caminho da task ou do documento enxuto> — fase <n>

## Escopo
Worktree: <caminho absoluto> (branch <branch>; antes do Gate 1 da trilha padrão: a árvore principal, sem branch). Escreva só em: <caminhos>. Precisa de outro arquivo: PARE e pergunte pelo canal de dúvida.

## O que fazer
<até 5 linhas; cada uma, uma entrega verificável — a entrega, nunca a solução: valor, nome, caminho de implementação só se vier de "Já decidido". No `revisor`, antes das entregas, uma linha a mais: `Rodada <k> do <artefato>; parecer anterior: <caminho absoluto | não há>`>

## Já decidido
<só o que tem origem citável, um por linha com a origem: resposta do humano (data), R-n, D<n>, item N3 aprovado; ou: nenhum. Ruling nova: o orquestrador a escreve em `## Rulings` da task no worktree e o brief do próximo papel manda incluir essa mudança no próximo commit dele (RED, GREEN ou correção); o revisor `diff` só é despachado com a Ruling já commitada>

## Nunca faz
<as linhas de "No brief" do contrato que valem nesta rodada, coladas; mais os itens de "Padrões" e "Nunca faz neste
projeto" do perfil que se aplicam. Em forma de ação: "PARE e diga", nunca um link>

## Leia só isto
- <arquivo>:<a>-<b> — <para quê> (até ~80 linhas por trecho; nada de "leia o arquivo" nem "veja o commit")

## Impacto
<o que a entrega muda e quem já depende disso, `medido`, para o papel não descobrir tarde. Antes do Gate 1 (`dominio`, `arquiteto`): a saída das buscas que você rodou na árvore, colada com o comando de cada uma — para cada termo, símbolo, rota, schema ou regra que muda segundo o pedido ou o intent (para o `dominio`), a spec ou, na trilha enxuta, a descrição do humano (para o `arquiteto`): as specs aprovadas que citam a regra e, para o `arquiteto`, também quem usa (`arquivo:linha`) e os testes que o exercitam; todo resultado tem trecho em "Leia só isto". Depois do Gate 1 (`testes`, `dev`): as linhas de `## Impacto` do design (ou do documento enxuto) que tocam esta task, coladas, com o teste existente afetado; teste afetado que contradiz a spec leva a referência de remoção em "Já decidido" (`agentic/processo/ciclo.md`, "Remoção de comportamento"). O `revisor` recebe o mesmo `## Impacto` do brief do autor. Ou: nenhum (só arquivos novos), com a busca que mostrou isso>

## Comandos
- <comando exato, com saída limitada e em primeiro plano>
- Quem roda cada verificação longa: <você | o orquestrador>. Exceção: o brief nunca tira do `revisor` modo `diff` o
  `sh agentic/mecanismos/scripts/verify.sh` completo; ele o roda, em primeiro plano (nos modos `spec`, `design` e `mudanca` não há verify).
- Proibido: <ex.: push, leitura de código de dependência, verificação que é do orquestrador>.

## Teto
~<n> requisições (ou turnos, na ferramenta que não conta requisições). Ao atingir: pare, comite o que estiver pronto
(se o seu papel comita) e reporte onde travou.

## Entrega
- Commits (sem push): <tipo(escopo): mensagem>, ou: nenhum (o revisor não comita). Se `## Rulings` da task mudou no worktree, a mudança vai no primeiro commit desta entrega.
- Relatório: <caminho absoluto do NN-…-relatorio.md ou NN-revisor-<modo>-parecer.md>.
- Retorno, uma linha: <linha de retorno com os campos deste papel>.
- Dúvida que trava: <canal>; espere a resposta.

## Casos a cobrir
<condicional; casos de borda e ataques que o orquestrador quer cobertos: o MESMO texto vai no brief do autor e no do revisor>

## Desde a rodada anterior
<só em rodada de correção, obrigatória: brief anterior (caminho), o parecer ou relatório que motivou a rodada (caminho
e IDs dos achados) e o que mudou; o autor atualiza o Impacto e a autoconferência para tudo que a correção mudou. Não substitui nenhuma seção acima>

## Assinaturas
<testes e dev, quando há contrato executável: tipos, métodos e records colados, para o papel não procurar>

## API externa
<testes e dev, quando o papel usa biblioteca externa: um snippet pronto>

<!-- Antes de enviar (o orquestrador confere; nenhum mecanismo obriga, é por revisão):
- [ ] cabeçalho de quatro linhas, caminhos absolutos, `Papel:` igual ao nome do contrato;
- [ ] em correção: copiado do brief anterior, com "Desde a rodada anterior";
- [ ] toda leitura com intervalo; todo comando com saída limitada;
- [ ] `## Impacto` com as buscas coladas (antes do Gate 1) ou as linhas do Impacto aprovado da task (depois), cada resultado com trecho em "Leia só isto";
- [ ] revisor: linha da rodada em "O que fazer", com a rodada `<k>` e o último parecer do mesmo artefato, contados em todos os pareceres dele (`agentic/processo/templates/parecer.md`), e o mesmo `## Impacto` do brief do autor;
- [ ] teto declarado;
- [ ] "Nunca faz" colado, não linkado;
- [ ] nenhuma linha decide algo sem origem citável;
- [ ] "Casos a cobrir" igual no brief do autor e no do revisor.

Ao receber (antes de passar a entrega adiante):
- [ ] antes do revisor de spec, design ou mudanca, sempre (também quando o revisor é opcional na trilha enxuta), na árvore onde o autor escreveu (trilha enxuta: o worktree; trilha padrão: a principal): `cd <árvore> && sh agentic/mecanismos/scripts/verifica-artefato.sh <spec|design|mudanca> <caminho>` verde; com falha, o trabalho volta ao autor sem despachar o revisor;
- [ ] `sh agentic/mecanismos/scripts/verifica-escopo.sh <task.md>` na branch do papel;
- [ ] depois do RED: `sh agentic/mecanismos/scripts/verifica-red.sh`; depois de cada GREEN no laço: `sh agentic/mecanismos/scripts/verify.sh --rapido`;
- [ ] antes do PR (o revisor `diff` roda o seu próprio): `sh agentic/mecanismos/scripts/verify.sh` completo, uma vez;
- [ ] revisor, modo diff: `git rev-parse HEAD` no worktree igual ao SHA final do intervalo do brief (o revisor não
  comita) e `git status --porcelain` vazio;
- [ ] revisor, modos spec, design e mudanca (nada commitado): `git status --porcelain` e
  `{ git diff; git ls-files -o --exclude-standard | xargs cat; } | sha256sum` iguais aos que você anotou no
  progress.md antes do despacho. O parecer fica fora do que é conferido;
- [ ] a linha de retorno confere com o arquivo de relatório.
Desvio que é da stack não entra aqui: pelo Princípio 2, vai para o CMD_VERIFY_STACK do projeto.
-->
