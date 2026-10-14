import cds from '@sap/cds';
import { criarAcao, criarSubacao } from './apoio/acoes';
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

// Cenário rico da Etapa 1: metodologia 5 Porquês do gestor, Ação derivada para M1001, Subação de M2002,
// Aval aprovado do validador e M2002 como Participante (vínculo direto para a leitura do Histórico).
async function cenario(): Promise<{ codigo: string; acao: string; subacao: string }> {
  const codigo = await nova();
  await iniciar(codigo);
  expect((await definir(codigo, '5 Porquês', {
    problema: 'Falha recorrente na inspeção',
    porque1: 'Checklist incompleto',
    conclusao: 'A causa raiz foi o checklist incompleto.',
  })).status).toBe(204);

  const acao = await afirmarAcao(await criarAcao(
    enviar,
    codigo,
    { descricao: 'Revisar checklist', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
    comoGestor,
  ), 200);
  const subacao = await afirmarAcao(await criarSubacao(
    enviar,
    codigo,
    { acaoMae: acao, descricao: 'Subação de evidência', responsavel: 'M2002', prazo: '2026-11-02', prioridade: 'Média', evidenciaObrigatoria: 'não' },
    comoGestor,
  ), 200);
  expect((await derivar(codigo, {
    causaIdentificador: 'porque1',
    descricao: 'Revisar checklist de inspeção',
    responsavel: 'M1001',
    prazo: '2026-11-03',
    prioridade: 'Alta',
    evidenciaObrigatoria: 'não',
  })).status).toBe(200);

  expect((await incluirParticipante(enviar, codigo, { participante: 'M2002' }, comoGestor)).status).toBe(204);
  expect((await emitirAval(enviar, codigo, PARECER, comoValidador)).status).toBe(204);
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
    expect(validador.data.podeEmitirAval).toBe(true);
    expect(validador.data.ocultaEmitirAval).toBe(false);

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

    expect((await emitirAval(enviar, codigo, PARECER, comoValidador)).status).toBe(204);
    const avaliacoes = await consultar(`${APP}/AvalesTecnicos?$filter=tratativa_codigo eq ${codigo}`, comoGestor);
    expect(avaliacoes.status).toBe(200);
    const vigentes = itens(avaliacoes.data).filter((linha) => linha.vigente === true);
    expect(vigentes).toHaveLength(1);
  });

  it('HTTP: a máscara vale em navegação, $expand, expand cruzado e sem a chave no $select', async () => {
    const { codigo, subacao } = await cenario();

    // (a) navegação
    const navAvales = await consultar(`${APP}/Tratativas(${codigo})/avalesTecnicos`, comoUsuario);
    expect(navAvales.status).toBe(200);
    expect(itens(navAvales.data)[0]?.fundamentacao).toBeNull();
    expect(itens(navAvales.data)[0]?.validador).toBeNull();
    const navAcoesUsuario = await consultar(`${APP}/Tratativas(${codigo})/acoes`, comoUsuario);
    expect((itens(navAcoesUsuario.data)[0] as Record<string, unknown> | undefined)?.causaDescricao).toBeNull();
    const navAcoesValidador = await consultar(`${APP}/Tratativas(${codigo})/acoes`, comoValidador);
    expect((itens(navAcoesValidador.data)[0] as Record<string, unknown> | undefined)?.causaDescricao).toBeNull();

    // (b) $expand
    const expandido = await consultar(`${APP}/Tratativas(${codigo})?$expand=avalesTecnicos,acoes`, comoUsuario);
    expect(expandido.status).toBe(200);
    const linha = expandido.data as Record<string, unknown>;
    expect((linha.avalesTecnicos as Record<string, unknown>[])[0]?.fundamentacao).toBeNull();
    expect((linha.acoes as Record<string, unknown>[])[0]?.causaDescricao).toBeNull();
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
    expect((itens(avalesCruzado.data)[0]?.tratativa as Record<string, unknown>)?.metodologiaData).toBeNull();
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
