import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarAcao, criarSubacao, mudarStatusAcao } from './apoio/acoes';
import { comoValidador, comoValidadorB, emitirAval } from './apoio/aval';
import { anexarEvidencia, gerarPDF, removerEvidencia } from './apoio/evidencias';
import { registrarCredenciais } from './apoio/credenciais';
import { incluirParticipante } from './apoio/responsaveis';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, type Envia, type Resposta } from './apoio/tratativas';
import { comoAdmin, comoGestor, comoM1001, comoM2002, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as (url: string, identidade?: unknown) => Promise<Resposta>;
const enviar = POST as unknown as Envia;

const APP = '/api/app/v1';
const TRATATIVA = '/api/tratativa/v1';
const AGORA = '2026-10-13T12:00:00.000Z';
const PARECER = { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' };

jest.setTimeout(120000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

type Erro = { message?: string; target?: string };

function erro(resposta: Resposta): Erro {
  return (resposta.data as { error?: Erro })?.error ?? {};
}

function itens(dados: unknown): Record<string, unknown>[] {
  const corpo = dados as { value?: Record<string, unknown>[] };
  return Array.isArray(corpo?.value) ? corpo.value : [];
}

async function definir(codigo: string, ferramenta: string, dados: Record<string, unknown>, como: unknown = comoGestor) {
  return enviar(
    `${TRATATIVA}/Tratativas(${codigo})/definirMetodologia`,
    { ferramenta, categoriaCausaRaiz: 'Método/Processo', dados: JSON.stringify(dados), confirmarSubstituicao: false },
    como,
  );
}

async function derivar(codigo: string, dados: Record<string, unknown>, como: unknown = comoGestor) {
  return enviar(`${TRATATIVA}/Tratativas(${codigo})/derivarAcaoDaMetodologia`, dados, como);
}

async function iniciar(codigo: string): Promise<void> {
  fixarInstante(AGORA);
  expect((await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
}

async function nova(): Promise<string> {
  const resposta = await criarAvulsa(enviar, { titulo: `UI metodologia ${Date.now()}` });
  expect(resposta.status).toBe(200);
  return resposta.data.codigo as string;
}

async function afirmarAcao(resposta: Resposta, status: number): Promise<string> {
  expect(resposta.status).toBe(status);
  return String(resposta.data.codigo);
}

// Cenário rico da Etapa 1: metodologia 5 Porquês do gestor, Aval aprovado do validador, Ação derivada
// para M1001 (com a causa vinculada), uma Subação dela para M3003 e M2002 apenas como Participante (sem Ação/Subação).
async function cenario(): Promise<{ codigo: string; acao: string; subacao: string }> {
  const codigo = await nova();
  await iniciar(codigo);
  expect((await definir(codigo, '5 Porquês', {
    problema: 'Falha recorrente na inspeção',
    porque1: 'Checklist incompleto',
    conclusao: 'A causa raiz foi o checklist incompleto.',
  })).status).toBe(204);

  // O Aval exige que não haja Ação em aberto (CA20): emita antes de derivar.
  expect((await emitirAval(enviar, codigo, PARECER, comoValidador)).status).toBe(204);

  const derivada = await derivar(codigo, {
    causaIdentificador: 'porque1',
    descricao: 'Revisar checklist de inspeção',
    responsavel: 'M1001',
    prazo: '2026-11-03',
    prioridade: 'Alta',
    evidenciaObrigatoria: 'não',
  });
  expect(derivada.status).toBe(200);
  const acao = String(derivada.data.codigo);
  const subacao = await afirmarAcao(await criarSubacao(
    enviar,
    codigo,
    { acaoMae: acao, descricao: 'Subação de evidência', responsavel: 'M3003', prazo: '2026-11-02', prioridade: 'Média', evidenciaObrigatoria: 'não' },
    comoGestor,
  ), 200);
  expect((await incluirParticipante(enviar, codigo, { participante: 'M2002' }, comoGestor)).status).toBe(204);
  return { codigo, acao, subacao };
}

describe('Contrato do app para metodologia e Aval (task 007, Etapa 1)', () => {
  it('CSN: as três actions existem, com OperationAvailable e SideEffects', async () => {
    const modelo = (await cds.load(['srv', 'app'])) as unknown as {
      definitions: Record<string, { actions?: Record<string, Record<string, unknown>> }>;
    };
    const actions = modelo.definitions['TratativaAppService.Tratativas']?.actions ?? {};
    expect(Object.keys(actions)).toEqual(expect.arrayContaining([
      'definirMetodologia',
      'derivarAcaoDaMetodologia',
      'emitirAvalTecnico',
    ]));

    const disponivel = (nome: string) => actions[nome]?.['@Core.OperationAvailable'] as Record<string, unknown> | undefined;
    expect(disponivel('definirMetodologia')?.['=']).toBe('in.podeDefinirMetodologia');
    expect(disponivel('derivarAcaoDaMetodologia')?.['=']).toBe('in.podeDerivarAcao');
    expect(disponivel('emitirAvalTecnico')?.['=']).toBe('in.podeEmitirAval');

    const propriedades = actions.emitirAvalTecnico?.['@Common.SideEffects.TargetProperties'] as string[] | undefined;
    expect(propriedades).toEqual(expect.arrayContaining([
      'in/podeEmitirAval', 'in/ocultaEmitirAval', 'in/podeEncerrar', 'in/ocultaEncerrar',
    ]));
    const entidades = actions.emitirAvalTecnico?.['@Common.SideEffects.TargetEntities'] as string[] | undefined;
    expect(entidades).toEqual(expect.arrayContaining(['in/avalesTecnicos', 'in/historico']));

    for (const nome of ['iniciarTratativa', 'encerrarTratativa', 'cancelarTratativa', 'reabrirTratativa']) {
      const alvos = actions[nome]?.['@Common.SideEffects.TargetProperties'] as string[] | undefined;
      expect(alvos).toEqual(expect.arrayContaining(['in/podeEmitirAval', 'in/ocultaEmitirAval']));
    }
  });

  it('HTTP: as flags de metodologia e Aval respeitam o papel e não dependem de status no $select', async () => {
    const codigo = await nova();
    await iniciar(codigo);
    const criada = await criarAcao(
      enviar,
      codigo,
      { descricao: 'Ação de M1001', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(criada.status).toBe(200);

    const validador = await consultar(`${APP}/Tratativas(${codigo})?$select=podeEmitirAval,ocultaEmitirAval`, comoValidador);
    expect(validador.status).toBe(200);
    // Com Ação aberta a Tratativa não está apta para emissão (task 007: Validador habilitado E aptaParaEmissao).
    expect(validador.data.podeEmitirAval).toBe(false);
    expect(validador.data.ocultaEmitirAval).toBe(true);

    const gestor = await consultar(`${APP}/Tratativas(${codigo})?$select=podeEmitirAval,ocultaEmitirAval`, comoGestor);
    expect(gestor.status).toBe(200);
    expect(gestor.data.podeEmitirAval).toBe(false);
    expect(gestor.data.ocultaEmitirAval).toBe(true);

    const responsavel = await consultar(`${APP}/Tratativas(${codigo})?$select=podeDefinirMetodologia`, comoM1001);
    expect(responsavel.status).toBe(200);
    expect(responsavel.data.podeDefinirMetodologia).toBe(true);

    const definido = await definir(codigo, '3W', { oQue: 'Desvio na inspeção', onde: 'Linha A', quando: 'Turno da manhã' });
    expect(definido.status).toBe(204);
    const usuario = await consultar(`${APP}/Tratativas(${codigo})?$select=metodologiaData,metodologiaAutor`, comoUsuario);
    expect(usuario.status).toBe(200);
    expect(usuario.data.metodologiaData).toBeNull();

    // Concluir a Ação deixa a etapa de verificação ativa (sem Ação aberta) e permite emitir o Aval.
    const conclusao = await mudarStatusAcao(enviar, codigo, { acao: criada.data.codigo, status: 'Concluída' }, comoGestor);
    expect(conclusao.status).toBe(204);
    const validadorApto = await consultar(`${APP}/Tratativas(${codigo})?$select=podeEmitirAval,ocultaEmitirAval`, comoValidador);
    expect(validadorApto.status).toBe(200);
    expect(validadorApto.data.podeEmitirAval).toBe(true);
    expect(validadorApto.data.ocultaEmitirAval).toBe(false);
    const gestorApto = await consultar(`${APP}/Tratativas(${codigo})?$select=podeEmitirAval,ocultaEmitirAval`, comoGestor);
    expect(gestorApto.data.podeEmitirAval).toBe(false);
    expect(gestorApto.data.ocultaEmitirAval).toBe(true);
    expect((await emitirAval(enviar, codigo, PARECER, comoValidador)).status).toBe(204);
    const avaliacoes = await consultar(`${APP}/AvalesTecnicos?$filter=tratativa_codigo eq ${codigo}`, comoGestor);
    expect(avaliacoes.status).toBe(200);
    const vigentes = itens(avaliacoes.data).filter((linha) => linha.vigente === true);
    expect(vigentes).toHaveLength(1);
  });

  it('HTTP: a máscara vale em navegação, $expand, expand cruzado e sem a chave no $select', async () => {
    const { codigo, acao, subacao } = await cenario();
    const daAcao = (linhas: Record<string, unknown>[]) => linhas.find((item) => String(item.codigo) === acao);

    // (a) navegação
    const navAvales = await consultar(`${APP}/Tratativas(${codigo})/avalesTecnicos`, comoUsuario);
    expect(navAvales.status).toBe(200);
    expect(itens(navAvales.data)[0]?.fundamentacao).toBeNull();
    expect(itens(navAvales.data)[0]?.validador).toBeNull();
    const navAcoesUsuario = await consultar(`${APP}/Tratativas(${codigo})/acoes`, comoUsuario);
    expect(itens(navAcoesUsuario.data).length).toBe(2);
    expect(itens(navAcoesUsuario.data).every((item) => item.causaDescricao === null)).toBe(true);
    const navAcoesValidador = await consultar(`${APP}/Tratativas(${codigo})/acoes`, comoValidador);
    // O Validador habilitado (sem lista = habilitado) tem vínculo diagnóstico (DC-15).
    expect(daAcao(itens(navAcoesValidador.data))?.causaDescricao).toBe('Checklist incompleto');

    // (b) $expand
    const expandido = await consultar(`${APP}/Tratativas(${codigo})?$expand=avalesTecnicos,acoes`, comoUsuario);
    expect(expandido.status).toBe(200);
    const linha = expandido.data as Record<string, unknown>;
    expect((linha.avalesTecnicos as Record<string, unknown>[])[0]?.fundamentacao).toBeNull();
    expect((linha.acoes as Record<string, unknown>[]).length).toBe(2);
    expect((linha.acoes as Record<string, unknown>[]).every((item) => item.causaDescricao === null)).toBe(true);
    const expandidoValidador = await consultar(`${APP}/Tratativas(${codigo})?$expand=avalesTecnicos,acoes`, comoValidador);
    const linhaValidador = expandidoValidador.data as Record<string, unknown>;
    expect((linhaValidador.avalesTecnicos as Record<string, unknown>[])[0]?.fundamentacao).toBe(PARECER.fundamentacao);

    // (c) expand cruzado a partir do Histórico (M2002, Participante) e de Acoes(<subacao>) (M1001)
    const historico = await consultar(
      `${APP}/Historico?$filter=tratativa_codigo eq ${codigo}&$expand=tratativa($select=metodologiaData,metodologiaAutor;$expand=avalesTecnicos)`,
      comoM2002,
    );
    expect(historico.status).toBe(200);
    expect(itens(historico.data).length).toBeGreaterThan(0);
    const tratativaDoHistorico = itens(historico.data)[0]?.tratativa as Record<string, unknown> | undefined;
    expect(tratativaDoHistorico?.metodologiaData).toBeNull();
    const subacaoExpandida = await consultar(`${APP}/Acoes(${subacao})?$expand=acaoMae`, comoM1001);
    expect(subacaoExpandida.status).toBe(200);
    expect((subacaoExpandida.data.acaoMae as Record<string, unknown>)?.causaDescricao).toBe('Checklist incompleto');

    // AvalesTecnicos e Participantes com expand de tratativa (sem chave)
    const avalesCruzado = await consultar(`${APP}/AvalesTecnicos?$expand=tratativa($select=metodologiaData)`, comoUsuario);
    expect(itens(avalesCruzado.data).length).toBeGreaterThan(0);
    expect(itens(avalesCruzado.data).every((item) => (item.tratativa as Record<string, unknown>)?.metodologiaData === null)).toBe(true);
    const participantes = await consultar(`${APP}/Participantes?$filter=tratativa_codigo eq ${codigo}&$expand=tratativa($select=metodologiaData)`, comoM2002);
    expect(participantes.status).toBe(200);
    expect((itens(participantes.data)[0]?.tratativa as Record<string, unknown>)?.metodologiaData).toBeNull();

    // (d) sem a chave no $select: a decisão de vínculo é fail-closed
    const acoesSemChave = await consultar(`${APP}/Acoes?$filter=tratativa_codigo eq ${codigo}&$select=causaDescricao`, comoUsuario);
    expect(acoesSemChave.status).toBe(200);
    expect(itens(acoesSemChave.data).every((item) => item.causaDescricao === null)).toBe(true);
    const acoesSemChaveM1001 = await consultar(`${APP}/Acoes?$filter=tratativa_codigo eq ${codigo}&$select=causaDescricao`, comoM1001);
    expect(acoesSemChaveM1001.status).toBe(200);
    const comCausa = itens(acoesSemChaveM1001.data).filter((item) => item.causaDescricao !== null);
    expect(comCausa.length).toBeGreaterThan(0);
    const avalesSemChave = await consultar(`${APP}/AvalesTecnicos?$select=fundamentacao,vigente`, comoUsuario);
    expect(avalesSemChave.status).toBe(200);
    expect(itens(avalesSemChave.data).every((item) => item.fundamentacao === null)).toBe(true);
    const vigenteUsuario = itens(avalesSemChave.data).filter((item) => item.vigente === true).length;
    const avalesSemChaveGestor = await consultar(`${APP}/AvalesTecnicos?$select=fundamentacao,vigente`, comoGestor);
    expect(itens(avalesSemChaveGestor.data).filter((item) => item.vigente === true).length).toBe(vigenteUsuario);
  });

  it('DC-19: predicados, ordenação e busca sobre os campos decididos são recusados ao não-Gestor', async () => {
    const { codigo } = await cenario();

    const recusas = [
      `${APP}/Tratativas?$filter=contains(metodologiaData,'desvio')`,
      `${APP}/Tratativas?$filter=metodologiaAutor eq 'gestor'`,
      `${APP}/Acoes?$filter=contains(causaDescricao,'checklist')`,
      `${APP}/Tratativas?$filter=avalesTecnicos/any(a:contains(a/fundamentacao,'eficacia'))`,
      `${APP}/Tratativas?$filter=avalesTecnicos/any(a:a/validador eq 'validador')`,
      `${APP}/AvalesTecnicos?$orderby=validador`,
      `${APP}/Acoes?$filter=tratativa_codigo eq ${codigo} and contains(causaDescricao,'checklist')`,
    ];
    for (const url of recusas) {
      const recusa = await consultar(url, comoUsuario);
      expect(recusa.status).toBe(403);
      expect(erro(recusa).message).toBe('Acesso negado.');
    }

    const porVinculo = await consultar(`${APP}/Acoes?$filter=tratativa_codigo eq ${codigo} and contains(causaDescricao,'checklist')`, comoM1001);
    expect(porVinculo.status).toBe(403);

    const parecerPermitido = await consultar(`${APP}/Tratativas?$filter=avalesTecnicos/any(a:a/parecer eq 'Aprovado')`, comoUsuario);
    expect(parecerPermitido.status).toBe(200);

    const busca = await consultar(`${APP}/Tratativas?$search=eficacia`, comoUsuario);
    expect(busca.status).toBe(200);
    expect(itens(busca.data).some((item) => item.codigo === codigo)).toBe(false);

    const gestor = await consultar(`${APP}/Tratativas?$filter=metodologiaAutor eq 'gestor'`, comoGestor);
    expect(gestor.status).toBe(200);
    expect(itens(gestor.data).some((item) => item.codigo === codigo)).toBe(true);
  });

  it('CA44: o Validador habilitado lê as Evidências ativas do App; o não habilitado não', async () => {
    const codigo = await nova();
    await iniciar(codigo);
    const acao = await afirmarAcao(await criarAcao(
      enviar,
      codigo,
      { descricao: 'Ação com evidências', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    ), 200);
    const subacao = await afirmarAcao(await criarSubacao(
      enviar,
      codigo,
      { acaoMae: acao, descricao: 'Subação com evidência', responsavel: 'M2002', prazo: '2026-11-02', prioridade: 'Média', evidenciaObrigatoria: 'não' },
      comoGestor,
    ), 200);

    const e1 = String((await anexarEvidencia(enviar, codigo, { acao, nomeArquivo: 'e1.pdf', mimeType: 'application/pdf', conteudo: gerarPDF(), descricao: 'Ativa' }, comoGestor)).data.codigo);
    const e2Resposta = await anexarEvidencia(enviar, codigo, { acao, nomeArquivo: 'e2.pdf', mimeType: 'application/pdf', conteudo: gerarPDF(), descricao: 'Removida' }, comoGestor);
    const e2 = String(e2Resposta.data.codigo);
    expect((await removerEvidencia(enviar, codigo, { acao, evidencia: e2 }, comoGestor)).status).toBeLessThan(300);
    const e3 = String((await anexarEvidencia(enviar, codigo, { acao: subacao, nomeArquivo: 'e3.pdf', mimeType: 'application/pdf', conteudo: gerarPDF(), descricao: 'Subação' }, comoGestor)).data.codigo);

    // (1) Sem lista de Validadores: qualquer ValidadorTecnico lê as ativas.
    for (const como of [comoValidador, comoValidadorB]) {
      const colecao = await consultar(`${APP}/Evidencias?$filter=tratativa_codigo eq ${codigo}`, como);
      expect(colecao.status).toBe(200);
      const codigos = itens(colecao.data).map((item) => String(item.codigo)).sort();
      expect(codigos).toEqual([e1, e3].sort());
    }

    // (2) Lista padrão (*) com o validador: só ele lê; o não habilitado não.
    const inclusao = await enviar('/api/administracao/v1/incluirValidadorOrigem', { origem: '*', matricula: 'validador' }, comoAdmin);
    expect(inclusao.status).toBe(200);

    const colecaoValidador = await consultar(`${APP}/Evidencias?$filter=tratativa_codigo eq ${codigo}`, comoValidador);
    expect(itens(colecaoValidador.data).map((item) => String(item.codigo)).sort()).toEqual([e1, e3].sort());
    const navegacao = await consultar(`${APP}/Tratativas(${codigo})/evidencias`, comoValidador);
    expect(itens(navegacao.data).map((item) => String(item.codigo)).sort()).toEqual([e1, e3].sort());
    const contagem = await consultar(`${APP}/Evidencias/$count?$filter=tratativa_codigo eq ${codigo}`, comoValidador);
    expect(Number(contagem.data)).toBe(2);
    expect((await consultar(`${APP}/Evidencias(${e3})`, comoValidador)).status).toBe(200);
    expect((await consultar(`${APP}/Evidencias(${e3})/acao`, comoValidador)).status).toBe(200);
    for (const item of itens(colecaoValidador.data)) {
      expect(item.autorAnexo).toBeNull();
      expect(item.autorRemocao).toBeNull();
      expect(item.nomeArquivo).toBeTruthy();
    }

    const colecaoOutro = await consultar(`${APP}/Evidencias?$filter=tratativa_codigo eq ${codigo}`, comoValidadorB);
    expect(colecaoOutro.status).toBe(200);
    expect(itens(colecaoOutro.data)).toEqual([]);
    const navOutro = await consultar(`${APP}/Tratativas(${codigo})/evidencias`, comoValidadorB);
    expect(itens(navOutro.data)).toEqual([]);
    expect(Number((await consultar(`${APP}/Evidencias/$count?$filter=tratativa_codigo eq ${codigo}`, comoValidadorB)).data)).toBe(0);
    expect((await consultar(`${APP}/Evidencias(${e1})`, comoValidadorB)).status).toBe(404);

    const colecaoResponsavel = await consultar(`${APP}/Evidencias?$filter=tratativa_codigo eq ${codigo}`, comoM1001);
    expect(itens(colecaoResponsavel.data).map((item) => String(item.codigo))).toEqual([e1]);
    const expandido = await consultar(`${APP}/Tratativas(${codigo})?$expand=evidencias`, comoValidador);
    expect(itens((expandido.data as Record<string, unknown>).evidencias).length).toBe(0);
  });

  it('CSN e HTTP: causaIdentificador somente leitura e o Aval habilita o encerramento', async () => {
    const modelo = (await cds.load(['srv', 'app'])) as unknown as {
      definitions: Record<string, { actions?: Record<string, { params?: Record<string, Record<string, unknown>> }> }>;
    };
    const parametro = modelo.definitions['TratativaAppService.Tratativas']?.actions?.derivarAcaoDaMetodologia?.params?.causaIdentificador;
    expect(parametro?.['@Common.FieldControl']).toEqual({ '#': 'ReadOnly' });
    expect(typeof parametro?.['@title']).toBe('string');

    const codigo = await nova();
    await iniciar(codigo);
    expect((await emitirAval(enviar, codigo, PARECER, comoValidador)).status).toBe(204);
    const gestor = await consultar(`${APP}/Tratativas(${codigo})?$select=podeEncerrar,ocultaEncerrar`, comoGestor);
    expect(gestor.status).toBe(200);
    expect(gestor.data.podeEncerrar).toBe(true);
  });

  it('HTTP: as entidades de valores devolvem o catálogo', async () => {
    const ferramentas = await consultar(`${APP}/ValoresFerramentaMetodologia`, comoGestor);
    expect(ferramentas.status).toBe(200);
    expect(itens(ferramentas.data).map((item) => item.codigo)).toEqual(
      expect.arrayContaining(['3W', '5 Porquês', '5W2H', 'PDCA/8D']),
    );
    const macrocausas = await consultar(`${APP}/ValoresMacrocausa`, comoGestor);
    expect(macrocausas.status).toBe(200);
    expect(itens(macrocausas.data).map((item) => item.codigo)).toEqual(
      expect.arrayContaining(['Método/Processo', 'Máquina/Equipamento']),
    );
    const pareceres = await consultar(`${APP}/ValoresParecerAval`, comoGestor);
    expect(pareceres.status).toBe(200);
    expect(itens(pareceres.data).map((item) => item.codigo).sort()).toEqual(['Aprovado', 'Reprovado']);
  });
});

// --- Etapa 2: seção customizada da metodologia (estrutural) ---

const RAIZ = join(__dirname, '..');
const MANIFESTO = join(RAIZ, 'app', 'tratativas', 'webapp', 'manifest.json');
const UI5 = join(RAIZ, 'app', 'tratativas', 'ui5.yaml');
const FRAGMENTO = join(RAIZ, 'app', 'tratativas', 'webapp', 'ext', 'fragment', 'MetodologiaSection.fragment.xml');
const EXTENSAO = join(RAIZ, 'app', 'tratativas', 'webapp', 'ext', 'controller', 'MetodologiaExtension.controller.js');
const I18N = join(RAIZ, 'app', 'tratativas', 'webapp', 'i18n', 'i18n.properties');

const TEXTOS_SPEC: Record<string, string> = {
  tresWOQue: 'Descreva o evento ou desvio observado de forma objetiva. Evite nomes de pessoas ou dados sensíveis',
  tresWOnde: 'Informe o local físico, posto de trabalho ou linha de processo onde o desvio ocorreu. Evite nomes de pessoas ou dados sensíveis',
  tresWQuando: 'Informe o momento, turno ou data/hora em que a ocorrência foi detectada. Evite nomes de pessoas ou dados sensíveis',
  cincoProblema: 'Defina claramente a falha ou o problema inicial a ser investigado. Evite nomes de pessoas ou dados sensíveis',
  cincoPorque1: 'Por que a falha imediata ocorreu? Descreva o fator causal direto. Evite nomes de pessoas ou dados sensíveis',
  cincoPorque2a5: 'Por que a condição anterior ocorreu? Aprofunde até a causa básica do processo. Evite nomes de pessoas ou dados sensíveis',
  cincoConclusao: 'Sintetize a causa raiz fundamental e sistêmica identificada. Evite nomes de pessoas ou dados sensíveis',
  cincoW2H: 'Preencha a análise operacional do desvio focando em processo, causas e contramedidas. Evite citar nomes pessoais',
  pdca: 'Descreva as etapas do ciclo de melhoria contínua e as disciplinas de contenção, correção e padronização. Evite nomes de pessoas ou dados sensíveis',
  categoria: 'Selecione a macrocausa padronizada para consolidar o indicador de Pareto (ex.: Método/Processo, Máquina/Equipamento)',
};

function textoDo(arquivo: string): string {
  expect(existsSync(arquivo)).toBe(true);
  return readFileSync(arquivo, 'utf8');
}

function xmlBemFormado(xml: string): boolean {
  const semComentarios = xml.replace(/<!--[\s\S]*?-->/g, '');
  const pilha: string[] = [];
  for (const tag of semComentarios.match(/<\/?[^>]+>/g) ?? []) {
    if (/^<\?/.test(tag) || /^<!/.test(tag) || /\/>$/.test(tag)) continue;
    const nome = /^<\/\s*([\w:.-]+)/.exec(tag)?.[1] ?? /^<\s*([\w:.-]+)/.exec(tag)?.[1];
    if (!nome) continue;
    if (tag.startsWith('</')) {
      if (pilha.pop() !== nome) return false;
    } else {
      pilha.push(nome);
    }
  }
  return pilha.length === 0;
}

function contemChave(objeto: unknown, chave: string): boolean {
  if (Array.isArray(objeto)) return objeto.some((item) => contemChave(item, chave));
  if (!objeto || typeof objeto !== 'object') return false;
  return Object.entries(objeto as Record<string, unknown>).some(
    ([nome, valor]) => nome === chave || contemChave(valor, chave),
  );
}

function valoresI18n(conteudo: string): string[] {
  return conteudo
    .split(/\r?\n/)
    .filter((linha) => linha.includes('=') && !linha.trimStart().startsWith('#'))
    .map((linha) => linha.slice(linha.indexOf('=') + 1).trim());
}

describe('Seção customizada da metodologia (task 007, Etapa 2)', () => {
  it('manifest.json e ui5.yaml registram a seção, o controller de extensão e a biblioteca sap.ui.layout', () => {
    const manifesto = JSON.parse(textoDo(MANIFESTO)) as {
      'sap.ui5'?: {
        dependencies?: { libs?: Record<string, unknown> };
        routing?: {
          targets?: Record<string, {
            options?: { settings?: { content?: { body?: { sections?: Record<string, { template?: string; position?: { anchor?: string } }> } } } };
          }>;
        };
      };
    };
    const sapUi5 = manifesto['sap.ui5'] ?? {};
    expect(sapUi5.dependencies?.libs?.['sap.ui.layout']).toBeDefined();

    const secao = sapUi5.routing?.targets?.TratativasObjectPage?.options?.settings?.content?.body?.sections?.MetodologiaSection;
    expect(secao?.template).toBe('br.com.calazanstec.actionplan.tratativas.ext.fragment.MetodologiaSection');
    expect(secao?.position?.anchor).toBe('PlanoAcaoFacet');

    const serializado = JSON.stringify(manifesto);
    expect(serializado).toContain('MetodologiaExtension');
    expect(contemChave(manifesto, 'sap.ui.controllerExtensions')).toBe(true);

    expect(textoDo(UI5)).toContain('sap.ui.layout');
  });

  it('o fragmento é XML válido, usa Form + ColumnLayout e um FormContainer por ferramenta', () => {
    const fragmento = textoDo(FRAGMENTO);
    expect(xmlBemFormado(fragmento)).toBe(true);
    expect(fragmento).toContain('<core:FragmentDefinition');
    expect(fragmento).not.toContain('<script');
    expect(fragmento).not.toContain('SimpleForm');
    expect(fragmento).toMatch(/sap\.ui\.layout\.form/);
    expect(fragmento).toContain('<Form');
    expect(fragmento).toContain('ColumnLayout');
    expect(fragmento).toContain('columnsM="2"');
    expect(fragmento).toContain('columnsL="3"');
    expect(fragmento).toContain('columnsXL="4"');
    expect((fragmento.match(/<FormContainer/g) ?? []).length).toBeGreaterThanOrEqual(4);

    expect(fragmento).toMatch(/<Select[^>]*id="metodologiaFerramenta"|<Select[^>]*metodologiaFerramenta/);
    expect(fragmento).toMatch(/<ComboBox[^>]*id="metodologiaCategoria"|<ComboBox[^>]*metodologiaCategoria/);
    for (const id of ['metodologiaSalvar', 'metodologiaRemover', 'metodologiaDerivar-']) {
      expect(fragmento).toContain(id);
    }
    expect(fragmento).not.toMatch(/\spress\s*=/);
  });

  it('CA31: cada placeholder é uma chave i18n existente com o texto literal da spec', () => {
    const fragmento = textoDo(FRAGMENTO);
    const i18n = textoDo(I18N);
    const chaves = new Set(
      i18n
        .split(/\r?\n/)
        .filter((linha) => linha.includes('=') && !linha.trimStart().startsWith('#'))
        .map((linha) => linha.slice(0, linha.indexOf('=')).trim()),
    );
    const referenciadas = [...fragmento.matchAll(/\{i18n>([^}]+)\}/g)].map((captura) => captura[1].trim());
    expect(referenciadas.length).toBeGreaterThanOrEqual(12);
    for (const chave of referenciadas) {
      expect(chaves.has(chave)).toBe(true);
    }

    const valores = valoresI18n(i18n);
    const contar = (texto: string) => valores.filter((valor) => valor === texto).length;
    for (const texto of [
      TEXTOS_SPEC.tresWOQue,
      TEXTOS_SPEC.tresWOnde,
      TEXTOS_SPEC.tresWQuando,
      TEXTOS_SPEC.cincoProblema,
      TEXTOS_SPEC.cincoPorque1,
      TEXTOS_SPEC.cincoConclusao,
      TEXTOS_SPEC.categoria,
    ]) {
      expect(contar(texto)).toBeGreaterThanOrEqual(1);
    }
    expect(contar(TEXTOS_SPEC.cincoPorque2a5)).toBeGreaterThanOrEqual(4);
    expect(contar(TEXTOS_SPEC.cincoW2H)).toBeGreaterThanOrEqual(7);
    expect(contar(TEXTOS_SPEC.pdca)).toBeGreaterThanOrEqual(4);
  });

  it('a extensão de controller liga os controles e grava pelas actions do App (DC-13)', () => {
    const extensao = textoDo(EXTENSAO);
    expect(extensao.startsWith('sap.ui.define')).toBe(true);
    expect(extensao).toContain('onAfterBinding');
    expect(extensao).toContain('requestProperty');
    expect(extensao).toContain('getExtensionAPI');
    expect(extensao).toContain('getEditFlow');
    expect(extensao).toContain('invokeAction');
    for (const trecho of ['byId(', 'attachPress', 'metodologiaSalvar', 'metodologiaRemover', 'metodologiaDerivar-']) {
      expect(extensao).toContain(trecho);
    }
    expect(extensao).toContain('TratativaAppService.definirMetodologia');
    expect(extensao).toContain('TratativaAppService.derivarAcaoDaMetodologia');
    expect(extensao).not.toMatch(/'\.\.\/\.\.\/\.\.\/srv|"\.\.\/\.\.\/\.\.\/srv/);
    expect(extensao).not.toContain("from 'db/");
  });

  // V-01: o UI5 resolve o controllerName do manifest para <namespace como caminho>.controller.js (medido no navegador).
  it('o controllerName da extensão no manifest resolve para um arquivo .controller.js existente (V-01)', () => {
    const manifesto = JSON.parse(textoDo(MANIFESTO)) as { 'sap.app': { id: string } };
    const namespace = manifesto['sap.app'].id;
    const extensoes = JSON.parse(textoDo(MANIFESTO))['sap.ui5'].extends.extensions['sap.ui.controllerExtensions'] as Record<string, { controllerName: string }>;
    const nomes = Object.values(extensoes).map((e) => e.controllerName);
    expect(nomes.length).toBeGreaterThan(0);
    for (const nome of nomes) {
      expect(nome.startsWith(`${namespace}.`)).toBe(true);
      const relativo = nome.slice(namespace.length + 1).split('.').join('/');
      const arquivo = join(RAIZ, 'app', 'tratativas', 'webapp', `${relativo}.controller.js`);
      expect(existsSync(arquivo)).toBe(true);
    }
  });

  // V-02: ExtensionAPI#byId só resolve IDs de seção customizada com o prefixo da subseção (medido: byId("metodologiaSalvar") = undefined).
  it('todo byId da extensão usa o prefixo da subseção customizada e o sufixo existe no fragmento (V-02)', () => {
    const PREFIXO = 'fe::CustomSubSection::MetodologiaSection--';
    const extensao = textoDo(EXTENSAO);
    const fragmento = textoDo(FRAGMENTO);
    const idsFragmento = [...fragmento.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

    // Argumento completo de cada chamada (parênteses balanceados) de byId / wrappers *ById.
    const chamadas: { direta: boolean; arg: string }[] = [];
    for (const m of extensao.matchAll(/(\.?)\b(\w*[Bb]yId)\(/g)) {
      const antes = extensao.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
      if (/function\s*$/.test(antes)) continue;
      let fundo = 1;
      let i = (m.index ?? 0) + m[0].length;
      const ini = i;
      for (; i < extensao.length && fundo > 0; i++) {
        if (extensao[i] === '(') fundo++;
        else if (extensao[i] === ')') fundo--;
      }
      chamadas.push({ direta: m[2] === 'byId', arg: extensao.slice(ini, i - 1).trim() });
    }
    expect(chamadas.length).toBeGreaterThanOrEqual(3);

    const valorDe = (ident: string): string | undefined => {
      const nome = ident.split('.').pop() as string;
      const def = new RegExp(String.raw`(?:\b(?:var|const|let)\s+${nome}\s*=|\b${nome}\s*:)\s*(["'])([^"']*)\1`).exec(extensao);
      return def?.[2];
    };
    const inicio = (arg: string): string | undefined => {
      const lit = /^(["'])([^"']*)\1/.exec(arg);
      if (lit) return lit[2];
      const id = /^([A-Za-z_$][\w$.]*)/.exec(arg);
      return id ? valorDe(id[1]) : undefined;
    };

    for (const { direta, arg } of chamadas) {
      if (direta) {
        // aceita o literal completo ou uma constante de prefixo concatenada
        expect(inicio(arg)?.startsWith(PREFIXO)).toBe(true);
      }
      // sufixos literais (sem o prefixo) precisam existir no fragmento; terminando em '-' valem como prefixo de ID
      for (const lit of arg.matchAll(/(["'])([^"']*)\1/g)) {
        const sufixo = lit[2].startsWith(PREFIXO) ? lit[2].slice(PREFIXO.length) : lit[2];
        if (sufixo === '') continue;
        const existe = sufixo.endsWith('-') ? idsFragmento.some((id) => id.startsWith(sufixo)) : idsFragmento.includes(sufixo);
        expect(existe).toBe(true);
      }
    }
  });

  // M-05: cancelar o diálogo rejeita com Error("Dialog cancelled") (medido no navegador); não é falha a avisar.
  it('o tratamento de falha da extensão ignora o cancelamento do diálogo antes de avisar (M-05)', () => {
    const extensao = textoDo(EXTENSAO);
    const ini = extensao.indexOf('_falhou:');
    expect(ini).toBeGreaterThanOrEqual(0);
    const fim = extensao.indexOf('_texto:', ini);
    const corpo = extensao.slice(ini, fim > ini ? fim : undefined);
    const aviso = corpo.indexOf('MessageToast.show');
    const cancelamento = corpo.indexOf('Dialog cancelled');
    expect(aviso).toBeGreaterThanOrEqual(0);
    expect(cancelamento).toBeGreaterThanOrEqual(0);
    expect(cancelamento).toBeLessThan(aviso);
  });
});

// --- Etapa 3: diálogo do Aval e facet de avaliações (CSN e anotações) ---

const PLACEHOLDER_PARECER = 'Selecione Aprovado para validar a eficácia comprovada das contramedidas ou Reprovado se o desvio persistir';
const PLACEHOLDER_FUNDAMENTACAO = 'Fundamente tecnicamente a comprovação de eficácia das ações ou o motivo detalhado da reprovação (mínimo de 20 caracteres). Evite dados sensíveis';

describe('Diálogo do Aval Técnico e facet de avaliações (task 007, Etapa 3)', () => {
  it('CSN: o botão e o diálogo do Aval declaram Hidden, Value List de parecer e placeholders LGPD', async () => {
    const modelo = (await cds.load(['srv', 'app'])) as unknown as {
      definitions: Record<string, {
        actions?: Record<string, { params?: Record<string, Record<string, unknown>> }>;
        elements?: Record<string, Record<string, unknown>>;
        [chave: string]: unknown;
      }>;
    };
    const tratativas = modelo.definitions['TratativaAppService.Tratativas'] ?? {};

    const identificacao = (tratativas['@UI.Identification'] ?? []) as Array<Record<string, unknown>>;
    const botao = identificacao.find((entrada) => entrada.Action === 'TratativaAppService.emitirAvalTecnico');
    expect(botao).toBeDefined();
    expect(JSON.stringify(botao)).toContain('ocultaEmitirAval');

    const parametros = tratativas.actions?.emitirAvalTecnico?.params ?? {};
    expect(parametros.parecer?.['@Common.ValueListWithFixedValues']).toBe(true);
    expect(parametros.parecer?.['@Common.ValueList.CollectionPath']).toBe('ValoresParecerAval');
    expect(parametros.parecer?.['@UI.Placeholder']).toBe(PLACEHOLDER_PARECER);
    expect(parametros.fundamentacao?.['@UI.Placeholder']).toBe(PLACEHOLDER_FUNDAMENTACAO);
    expect(typeof parametros.parecer?.['@title']).toBe('string');
    expect(typeof parametros.fundamentacao?.['@title']).toBe('string');
  });

  it('CSN: a facet de avaliações e o LineItem de AvalesTecnicos rotulam todos os campos', async () => {
    const modelo = (await cds.load(['srv', 'app'])) as unknown as {
      definitions: Record<string, {
        elements?: Record<string, Record<string, unknown>>;
        [chave: string]: unknown;
      }>;
    };
    const tratativas = modelo.definitions['TratativaAppService.Tratativas'];
    const facets = (tratativas?.['@UI.Facets'] ?? []) as Array<Record<string, unknown>>;
    const facet = facets.find((entrada) => entrada.ID === 'AvaliacoesTecnicasFacet');
    expect(facet).toBeDefined();
    expect(facet?.Target).toBe('avalesTecnicos/@UI.LineItem');

    const avales = modelo.definitions['TratativaAppService.AvalesTecnicos'];
    expect(avales).toBeDefined();
    const linha = (avales?.['@UI.LineItem'] ?? []) as Array<Record<string, unknown>>;
    const valores = linha
      .map((entrada) => (entrada.Value as Record<string, unknown> | undefined)?.['='])
      .filter((valor): valor is string => typeof valor === 'string');
    expect(valores).toEqual(expect.arrayContaining(['parecer', 'fundamentacao', 'validador', 'emitidoEm', 'vigente']));

    for (const campo of ['parecer', 'fundamentacao', 'validador', 'emitidoEm', 'vigente']) {
      expect(typeof avales?.elements?.[campo]?.['@title']).toBe('string');
    }
  });
});

// --- R-26: agregações do App não recebem a chave de vínculo injetada ---

describe('Agregação do App sem chave injetada (R-26)', () => {
  const semChaves = (linhas: Record<string, unknown>[]) =>
    linhas.every((linha) => !('codigo' in linha) && !('tratativa_codigo' in linha));

  async function duasTratativas(): Promise<{ filtro: string; status: string[] }> {
    const a = await nova();
    const b = await nova();
    await iniciar(b);
    const status: string[] = [];
    for (const codigo of [a, b]) {
      const lida = await consultar(`${APP}/Tratativas(${codigo})?$select=status`, comoGestor);
      expect(lida.status).toBe(200);
      status.push(String(lida.data.status));
    }
    return { filtro: `filter(codigo eq ${a} or codigo eq ${b})`, status };
  }

  it('gestor: groupby sem agregação devolve só as colunas agrupadas', async () => {
    const { filtro, status } = await duasTratativas();
    const resposta = await consultar(`${APP}/Tratativas?$apply=${filtro}/groupby((status))`, comoGestor);
    expect(resposta.status).toBe(200);
    const linhas = itens(resposta.data);
    expect(semChaves(linhas)).toBe(true);
    expect(linhas.map((linha) => String(linha.status)).sort()).toEqual([...new Set(status)].sort());
  });

  it('gestor: groupby com $count devolve totais corretos e sem codigo', async () => {
    const { filtro, status } = await duasTratativas();
    const resposta = await consultar(`${APP}/Tratativas?$apply=${filtro}/groupby((status),aggregate($count as total))`, comoGestor);
    expect(resposta.status).toBe(200);
    const linhas = itens(resposta.data);
    expect(semChaves(linhas)).toBe(true);
    for (const valor of new Set(status)) {
      const esperado = status.filter((item) => item === valor).length;
      expect(Number(linhas.find((linha) => String(linha.status) === valor)?.total)).toBe(esperado);
    }
  });

  it('gestor: aggregate($count) devolve uma linha só com o total', async () => {
    const { filtro } = await duasTratativas();
    const resposta = await consultar(`${APP}/Tratativas?$apply=${filtro}/aggregate($count as total)`, comoGestor);
    expect(resposta.status).toBe(200);
    const linhas = itens(resposta.data);
    expect(linhas).toHaveLength(1);
    expect(semChaves(linhas)).toBe(true);
    expect(Number(linhas[0].total)).toBe(2);
  });
});
