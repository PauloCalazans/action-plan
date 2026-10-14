# Dados de demonstração (somente desenvolvimento local)

Massa fictícia de uma indústria brasileira com 4 unidades (Planta Betim, Planta Camaçari, Planta Joinville e CD Cajamar), para apresentar a plataforma a quem não a conhece. Todas as pessoas, matrículas e e-mails são inventados.

- Os CSVs desta pasta só são carregados no perfil `[development]` (`cds.requires.db.[development].data` no `package.json`). O jest (perfil `[test]`) e a produção (HANA) não os enxergam.
- Os arquivos das evidências semeadas ficam em `arquivos/`, com o nome `<código da Evidência>.<extensão>`. Quem os entrega é o `test/apoio/armazenamento-demo.ts`, que só é usado em `[development]`.
- A data de referência dos dados é **14/10/2026**. Os atrasos e os prazos próximos foram calculados em relação a ela.

## Como subir

```bash
npm run watch
```

Abra o launchpad: http://localhost:4004/br.com.calazanstec.actionplan.launchpad/index.html#Tratativa-manage

Os blocos do launchpad levam para **Gestão de Tratativas**, **Minhas Pendências** e **Administração da Plataforma**. Na List Report, clique em **Iniciar** para carregar a lista.

### Persona

Por padrão você entra como `superusuario`, que tem os papéis GestorTratativa, Administrador, ValidadorTecnico e LeitorAnalitico e por isso vê tudo. Para usar outra persona, suba o servidor assim:

```bash
DEV_USER=M1001 npm run watch          # bash
$env:DEV_USER="M1001"; npm run watch  # PowerShell
```

Se a persona informada não existir, o servidor usa `superusuario`.

| Persona | Pessoa fictícia | Papéis | O que ver |
|---|---|---|---|
| `superusuario` | Paula Demo (paula.demo@exemplo.com) | todos | Todos os apps. É validadora habilitada em todas as Origens. |
| `gestor` | Gustavo Ferreira Lima (gustavo.lima@exemplo.com) | GestorTratativa | Todas as tratativas sem máscara; iniciar, encerrar, cancelar e reabrir; alertas emitidos. |
| `admin` | Adriana Moraes Teixeira (adriana.teixeira@exemplo.com) | Administrador | Administração: prazos por criticidade, credenciais (uma revogada), templates (um inativo), parâmetros de alertas e de Origem. |
| `validador` | Valéria Campos Rocha (valeria.rocha@exemplo.com) | ValidadorTecnico | Avales que emitiu; a tratativa *Purgador de vapor travado na linha da autoclave* aguarda o Aval dela. |
| `validador-b` | Vinícius Batista Souza (vinicius.souza@exemplo.com) | ValidadorTecnico | Avales das auditorias, incluindo um reprovado; *Fichas de emergência de produtos químicos desatualizadas* aguarda o Aval dele. |
| `leitor-analitico` | Larissa Antunes Pires (larissa.pires@exemplo.com) | LeitorAnalitico | Indicadores de `/api/analitico/v1`. |
| `M1001` | Marcos Vieira Andrade (marcos.andrade@exemplo.com), supervisor de produção em Betim | nenhum | Minhas Pendências: ações pendentes e atrasadas; responsável principal e participante de várias tratativas. |
| `M2002` | Mariana Duarte Lopes (mariana.lopes@exemplo.com), técnica de manutenção em Camaçari | nenhum | Minhas Pendências: ação com evidência obrigatória ainda sem anexo, ação delegada para ela e ações em tratativas abertas. |
| `usuario` | Ulisses Prado Nunes (ulisses.nunes@exemplo.com), operador | nenhum | Ações próprias em andamento, evidência que ele mesmo removeu e campos pessoais mascarados nas tratativas dos outros. |

Os demais nomes aparecem só como matrícula e não podem entrar no sistema: M3003 Rafael Cunha Barros (Logística, Cajamar), M3004 Fernanda Ribeiro Matos (Qualidade, Joinville), M3005 Thiago Mendes Carvalho (eletricista, Camaçari), M3006 Juliana Castro Freitas (técnica de segurança, Betim), M3007 Eduardo Santana Reis (engenharia de processos, Joinville) e M3008 Camila Nogueira Alves (almoxarifado, Cajamar).

## O que está semeado

- **31 tratativas** entre junho e outubro de 2026, cobrindo todos os status (6 Abertas, 12 Em andamento, 10 Encerradas e 3 Canceladas) e todas as criticidades. Elas vêm de 4 Origens (Inspeção de Segurança, Auditoria Interna, Quase-Acidente e Manutenção) ou foram abertas avulsas.
- **55 ações e subações**, com todos os status e prioridades; **20 evidências**, das quais 2 foram removidas; **9 comentários** com menções; histórico completo de tratativas e de ações.
- **14 Avales Técnicos** (12 aprovados e 2 reprovados) e metodologias preenchidas com as 4 ferramentas e as 6 macrocausas.
- **4 templates**, um deles inativo, e **24 alertas emitidos** (e-mail e Teams, incluindo falhas).

## Roteiro sugerido

1. **Visão geral** (`superusuario`, Gestão de Tratativas). Clique em Iniciar, filtre Status = Em andamento e ordene pela Data prevista: 9 tratativas abertas estão atrasadas. Abra *Bloqueio elétrico ignorado na manutenção do misturador*. Ela teve a criticidade elevada de Alta para Crítica e o Responsável Principal reatribuído com justificativa. Também tem uma ação delegada e uma ação reaberta. O histórico mostra cada passo.
2. **Ciclo completo encerrado.** Abra *Registros de calibração de paquímetros vencidos*. O primeiro Aval foi reprovado, uma nova ação corretiva foi criada e concluída, e só então veio o Aval aprovado e o encerramento. É o caso que puxa a taxa de eficácia para baixo.
3. **Reabertura.** *Extintores obstruídos por paletes no almoxarifado de MP* foi encerrada, reaberta por recorrência e encerrada de novo com um novo Aval. *Falha recorrente no sensor de nível do tanque de água gelada* foi reaberta e ainda está em andamento: o Aval aprovado antigo deixou de valer.
4. **Emitir Aval** (`DEV_USER=validador`). Abra *Purgador de vapor travado na linha da autoclave*. As ações estão concluídas e a ação "Emitir Aval Técnico" está disponível. Depois de aprovar, volte como `superusuario` e encerre a tratativa.
5. **Minhas Pendências** (`DEV_USER=M2002`). A ação *Reinstalar a proteção da correia...* vence hoje e tem evidência obrigatória. Tente concluí-la sem anexo: a plataforma recusa. Anexe um arquivo e conclua.
6. **Máscara LGPD** (`DEV_USER=M1001`). Sem o papel de Gestor, a Gestão de Tratativas mostra as 31 tratativas sem descrição, solicitante e responsáveis. A análise de causa raiz só aparece onde M1001 tem vínculo, como *Operador sem protetor auricular na linha de estampagem*. Evidências e histórico ficam limitados às ações e tratativas dele, e os comentários são recusados.
7. **Evidências.** Em *Estante do almoxarifado sem ancoragem e com sobrecarga*, a foto ativa pode ser baixada; ela vem de `test/demo/arquivos/`. A foto removida aparece só no histórico da ação, como RemocaoEvidencia.
8. **Administração e indicadores** (`superusuario` ou `admin`). Na Administração, veja os templates (*Bloqueio e etiquetagem (LOTO)* foi aplicado em *Intervenção em painel energizado na subestação 2*), a credencial revogada `app-revogado` e os alertas emitidos. Em `/api/analitico/v1` estão o backlog, o Pareto de causas raízes, a tendência mensal (junho a outubro), o cumprimento de prazo e a taxa de eficácia.

Exemplos de chamadas para os indicadores:

```
/api/analitico/v1/consultarTendenciaMensal(periodoInicio='2026-06-01',periodoFim='2026-10-31')
/api/analitico/v1/consultarCumprimentoDePrazo(periodoInicio='2026-06-01',periodoFim='2026-10-31')
/api/analitico/v1/consultarTaxaEficacia(periodoInicio='2026-06-01',periodoFim='2026-10-31')
/api/analitico/v1/ParetoCausasRaizes
```
