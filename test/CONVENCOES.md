# Convenções de teste

Leia antes de escrever ou ajustar qualquer teste. Cada item abaixo já causou retrabalho medido nas tasks 004–006. As regras do ciclo continuam valendo (`agentic/processo/papeis/testes.md`): cada RED cria um arquivo novo, testes não importam `srv/`, helpers não têm `expect(`.

## Helpers compartilhados (`test/apoio/`)
1. **Não altere** helpers usados por outros arquivos (`acoes.ts`, `banco.ts`, `usuarios.ts`, `tratativas.ts`, `responsaveis.ts`…). Se precisar de outro comportamento (ex.: lançar erro quando o preparo falha), crie um wrapper **local** no seu arquivo de teste. Helpers **novos** para a sua task podem ir para `test/apoio/`.
2. Use os helpers e caminhos que já existem; nunca invente URL. Actions ligadas: `POST /api/tratativa/v1/Tratativas(<codigo>)/<action>`. Transição de Ação: `mudarStatusAcao(enviar, tratativa, { acao, status, justificativa }, como)`.

## Banco e espião
3. `linhas(entidade, where)` recebe o nome **sem** namespace (`'Acoes'`, `'Evidencias'`, `'HistoricoAcoes'`); o helper já põe `br.com.calazanstec.`.
4. O espião recebe **evento primeiro** e entidade **qualificada**: `espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes')`.
5. Testes **não gravam** no banco (`cds.db.run(UPDATE…)` é proibido). Estado de preparo só por OData.
6. Use o nome real das entidades e colunas do `db/tratativa.cds` (ex.: `ParticipantesTratativa`; coluna `evidencia`, não `evidencia_codigo`). O histórico usa o campo `evento`, não `tipo`.

## Contrato OData
7. Action sem retorno com sucesso devolve **204** (sem corpo); function devolve **200** com corpo. Functions `many` devolvem `{ value: [...] }`.
8. Erro OData: `r.data.error.message` e `r.data.error.target`, nunca `r.data.target`. Tipagem sem `any`: `(r.data as { error?: { message?: string; target?: string } }).error`.
9. Parâmetros **String** de function vão na URL **entre aspas simples**, com `encodeURIComponent` e aspas internas duplicadas: `minhasAcoes(status='Em%20andamento',tamanhoPagina=50,pagina=1)`. Inteiros vão sem aspas; parâmetro omitido não entra na URL.
10. Código mal formado: use `'xyz'` (caracteres válidos na URL). UUID de "inexistente" precisa ter **5 grupos** (`00000000-0000-4000-8000-000000000000`). Chave de action ligada mal formada dá 404; parâmetro de Código mal formado dá 400 `Código inválido.`.
11. Campos de negócio: `evidenciaObrigatoria` é texto `'sim'`/`'não'` (nunca booleano); Subação usa `acaoMae`; Prioridade é `Baixa`/`Média`/`Alta`; `criarTratativaAvulsa` não aceita `dataPrevistaConclusao`.

## Identidade e autorização
12. O ID do usuário autenticado **é** a matrícula (005 R4). Para agir como colaborador, autentique como o usuário de mesmo id (ex.: `M1001`); o autor gravado no histórico é quem fez o pedido (`comoGestor` → `'gestor'`).
13. O aplicativo de origem (`comoApp`) **nunca** usa o `TratativaService` (403). A consulta dele é `/api/integracao-origem/v1/consultarPorCodigo(...)`. Sem autenticação: `semAuth` de `test/apoio/usuarios.ts`.

## Preparo de cenários (003/004)
14. Cancelar e reabrir exigem justificativa; reabrir é de `Encerrada` para `Em andamento` (não existe `'Reaberta'`).
15. Não dá para encerrar uma Tratativa com Ação aberta (004 R16). Para testar "Tratativa Encerrada recusa X": conclua a Ação, inicie e encerre a Tratativa e só então peça X. Para Ação aberta numa Tratativa fechada, use Tratativa **Cancelada**.
16. Confira o status de **cada** passo de preparo (ex.: `expect(r.status).toBe(204)` no teste, ou um wrapper local que lança erro). Preparo que falha em silêncio gera falso RED.

## Proibido
17. Teste que afirma que a operação **não existe** ("falha esperada no RED"); teste sem asserção real ou com `expect(true).toBe(true)`; asserção dentro de `if (status === 200)`; variáveis e imports sem uso (o lint faz parte do `verify`); arquivos soltos no worktree (`test-output.txt` etc.).

## Armadilhas medidas em 010–014
18. Respostas OData v4 trazem anotações como `@odata.context`: ao contar campos de um objeto, ignore as chaves que começam com `@` (`Object.keys(r.data).filter((k) => !k.startsWith('@'))`).
19. Não rode `npm`/`cds`/`npx` dentro do Jest (`spawnSync npm.cmd` dá EINVAL no Windows, e arch/lint/build já são passos do `verify`). Prove o estrutural lendo os arquivos (ex.: nenhum arquivo de `app/` importa `srv/` ou `db/`; `manifest.json` é JSON válido). Se um teste precisar do build, só o rode quando `gen/` ainda não existir.
20. Tratativa **com origem** nasce por `abrirPorApp` (`comoApp`); `criarTratativaAvulsa` não aceita origem (400).
21. Depois de `fixarInstante` para um evento, **refixe** o relógio antes de criar o próximo cenário — senão ele nasce no instante do evento anterior.
22. Indicadores e listas globais (contagens, rankings, backlog, envios de espiões) compartilham a base entre os testes do arquivo: meça antes e asserte o **delta**, ou filtre pelos registros do próprio teste.
23. Não invente regra: confira cada `expect` contra a spec. Em divergência entre a spec e o resumo de CAs do design, vale a **spec** (registre no FIM). Estado inalcançável pela API → use o equivalente alcançável que preserve a intenção e reporte.
24. `AlertasEmitidos` tem um registro **por canal** (010 R10); conte alertas pela chave sem o canal quando o CA falar de alertas, não de envios.
25. Setup que já passa vai num commit `test(support)` separado do `test(red)`: o `verify` exige que todo arquivo de um `test(red)` falhe naquele commit.
