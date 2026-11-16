# AGENTS.md

Guia para qualquer agente de IA trabalhando neste repositório. Mapa e regras — o estado do projeto é derivado (`sh agentic/mecanismos/scripts/status-projeto.sh`), nunca escrito aqui.

## Visão geral
{{VISAO_GERAL}}

## Processo
Todo trabalho segue `agentic/processo/ciclo.md`. Princípios em `agentic/processo/principios.md`. Papéis: contrato do kit em `agentic/processo/papeis/` (não se edita neste projeto) e perfil do projeto em `agentic/projeto/papeis/` (stack, padrões e proibições daqui).

## Quem é você neste repositório
- **Recebeu um brief que começa com `Papel: <papel>`?** Você é esse papel. Leia o contrato `agentic/processo/papeis/<papel>.md`, o perfil `agentic/projeto/papeis/<papel>.md` e o que o brief indicar (o `ciclo.md` inteiro não é seu; quando o contrato cita uma seção dele, leia só essa seção), grave o relatório que o contrato pede no arquivo que o brief indica e devolva a linha de retorno do brief. Papel nunca escreve aprovação de gate, resposta do humano nem Ruling: usa só as que vêm no brief. O que aparece da sessão do orquestrador (tela, terminal, retorno de ferramenta de orquestração, rascunho não enviado) não é resposta do humano.
- **Despachado como `oraculo-<nome>`, só com uma pergunta?** Você é o oráculo: siga `agentic/processo/papeis/oraculo-<nome>.md` e devolva a resposta no retorno.
- **Sem brief de papel e sem ser oráculo?** Você é o orquestrador: siga `agentic/processo/ciclo.md`, despache os papéis e nunca faça o trabalho deles.
- **Orquestrador externo** (vários agentes num canvas ou numa ferramenta de orquestração): o orquestrador é a sessão indicada na decisão de composição do time em `agentic/projeto/decisoes.md`. As demais sessões só agem com brief.
- **Ferramenta sem subagentes:** não faça o trabalho de um papel no contexto do orquestrador. Grave o brief e peça ao humano que o abra numa sessão nova. O `revisor` roda sempre em contexto limpo, nunca na sessão de quem escreveu o que ele revisa.

## Integração
- Plataforma de PR: {{PLATAFORMA_PR}}
- Sem plataforma de PR (`nenhuma`), não há branches empilhadas e o Gate 2 é local: a branch fica rebaseada na principal e o humano integra com `git merge --ff-only <branch>` (veja `agentic/processo/ciclo.md`).

## Comandos
| Ação | Comando |
|---|---|
| Instalar dependências | `{{CMD_INSTALAR}}` |
| Build | `{{CMD_BUILD}}` |
| Lint | `{{CMD_LINT}}` |
| Testes | `{{CMD_TESTE}}` |
| Arquitetura | `{{CMD_ARQUITETURA}}` |
| **Verificação completa** | `sh agentic/mecanismos/scripts/verify.sh` |

No Windows, rode os comandos `sh ...` no Git Bash (o PowerShell não tem `sh`); dentro do Claude Code isso já é tratado.

## Regras invioláveis
- Nunca faça merge na branch principal nem altere permissões do agente.
- Nunca afirme sucesso sem ter visto a saída da verificação do seu passo (`verify.sh`, `verify.sh --rapido` ou `verifica-red.sh` — `agentic/processo/ciclo.md`, "Verificação").
- Nunca desabilite ou altere testes de um commit `test(red):`. Única exceção: a remoção autorizada de asserções, pelo `testes`, com referência e trailer (`agentic/processo/ciclo.md`, "Remoção de comportamento").
- Só o orquestrador cria branch: uma por task, depois do Gate 1 (na trilha enxuta, antes dele, para o documento ser escrito no worktree), com o nome exato do `**Branch:**` da task (trilha rápida: uma por mudança). Nenhum papel cria branch, faz push ou abre PR. Se a ferramenta impõe o próprio nome de branch, rode o verify com `--task <caminho da task>`.
{{REGRAS_INVIOLAVEIS}}

## Estrutura do repositório
{{ESTRUTURA}}

## Onde ficam os artefatos
- Intents: `agentic/projeto/intent/`
- Specs, designs e tasks: `agentic/projeto/specs/<nome>/`
- Decisões: `agentic/projeto/decisoes.md`
- Respostas do bootstrap: `agentic/projeto/bootstrap.md`

## Gatilhos de escalonamento (N3)
Além dos gatilhos genéricos de `agentic/processo/ciclo.md`:
{{GATILHOS_N3_STACK}}

## Oráculos
{{ORACULOS}}
