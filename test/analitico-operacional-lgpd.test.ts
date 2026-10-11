import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao, type Consulta } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoAdmin, comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST, PUT, PATCH, DELETE } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const enviar = POST as unknown as Envia;
const BASE = '/api/analitico/v1';
const HOJE = '2026-10-08';
const PRAZO_ACAO = '2026-11-07';
const comoLeitorAnalitico = {
  auth: { username: 'leitor-analitico', password: '' },
  validateStatus: () => true,
};

type RespostaHttp = { status: number; data: unknown };
type Linha = Record<string, unknown>;
type Colecao = { value: Linha[] };
type ErroOData = { error?: { message?: string; target?: string } };

const unidadeUnica = (nome: string) => `${nome} ${sufixoUnico()}`;

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
beforeEach(() => fixarInstante(`${HOJE}T12:00:00Z`));
afterEach(liberarRelogio);

async function novaTratativa(
  dados: Record<string, unknown> = {},
  status?: 'Em andamento' | 'Encerrada' | 'Cancelada',
): Promise<string> {
  const criada = await criarAvulsa(enviar, {
    titulo: `Indicador operacional ${sufixoUnico()}`,
    ...dados,
  });
  expect(criada.status).toBe(200);
  const codigo = criada.data.codigo as string;
  if (status) {
    const transicao = await mudarStatus(
      enviar,
      codigo,
      { status, ...(status === 'Cancelada' ? { justificativa: 'Cancelada para teste analítico' } : {}) },
      comoGestor,
    );
    expect(transicao.status).toBe(204);
  }
  return codigo;
}

async function novaAcao(
  tratativa: string,
  responsavel: string,
  status: 'Pendente' | 'Em andamento' = 'Pendente',
  prazo = PRAZO_ACAO,
): Promise<void> {
  const criada = await criarAcao(
    enviar,
    tratativa,
    { descricao: 'Ação de teste analítico', responsavel, prazo },
    comoGestor,
  );
  expect(criada.status).toBe(200);
  if (status === 'Em andamento') {
    const transicao = await mudarStatusAcao(
      enviar,
      tratativa,
      { acao: criada.data.codigo as string, status },
      comoGestor,
    );
    expect(transicao.status).toBe(204);
  }
}

async function totalizador(
  nome: string,
  como: unknown = comoGestor,
): Promise<{ status: number; total: number | undefined }> {
  const r = (await consultar(`${BASE}/${nome}`, como)) as RespostaHttp;
  const linhasOData = r.status === 200 ? (r.data as Colecao).value : undefined;
  return {
    status: r.status,
    total: linhasOData?.length === 1 ? (linhasOData[0].total as number) : undefined,
  };
}

async function totalVencidas(
  dataCorte: string,
  como: unknown = comoGestor,
): Promise<{ status: number; total: number | undefined }> {
  const r = (await consultar(
    `${BASE}/consultarTratativasVencidas(dataCorte='${encodeURIComponent(dataCorte)}')`,
    como,
  )) as RespostaHttp;
  return {
    status: r.status,
    total: r.status === 200 ? (r.data as { total: number }).total : undefined,
  };
}

async function linhasDaColecao(
  nome: string,
  como: unknown = comoGestor,
): Promise<{ status: number; rows: Linha[] | undefined }> {
  const r = (await consultar(`${BASE}/${nome}`, como)) as RespostaHttp;
  return {
    status: r.status,
    rows: r.status === 200 ? (r.data as Colecao).value : undefined,
  };
}

async function contagemResponsavel(responsavel: string): Promise<{ status: number; total: number | undefined }> {
  const existentes = await linhasDaColecao('PendenciasPorResponsavel');
  return {
    status: existentes.status,
    total: existentes.rows?.find((row) => row.responsavel === responsavel)?.total as number | undefined,
  };
}

async function contagemUnidade(unidade: string): Promise<{ status: number; total: number | undefined }> {
  const existentes = await linhasDaColecao('PendenciasPorUnidade');
  return {
    status: existentes.status,
    total: existentes.rows?.find((row) => row.unidade === unidade)?.total as number | undefined,
  };
}

describe('AnaliticoService: leitura operacional, autorização e LGPD', () => {
  it('CA1: POST, PUT, PATCH e DELETE são recusados com 405 sem persistir alterações', async () => {
    const antes = [await linhas('Tratativas'), await linhas('Acoes')];
    const endpoint = `${BASE}/TratativasAbertas('TOTAL')`;
    const respostas = [
      (await POST(`${BASE}/TratativasAbertas`, { id: 'RED-CA1', total: 999 }, comoGestor)) as RespostaHttp,
      (await PUT(endpoint, { total: 999 }, comoGestor)) as RespostaHttp,
      (await PATCH(endpoint, { total: 999 }, comoGestor)) as RespostaHttp,
      (await DELETE(endpoint, comoGestor)) as RespostaHttp,
    ];

    for (const resposta of respostas) expect(resposta.status).toBe(405);
    expect([await linhas('Tratativas'), await linhas('Acoes')]).toEqual(antes);
  });

  it('CA2: TratativasAbertas soma Aberta e Em andamento, excluindo Encerrada e Cancelada', async () => {
    const antes = await totalizador('TratativasAbertas');
    for (let i = 0; i < 3; i++) await novaTratativa();
    for (let i = 0; i < 2; i++) await novaTratativa({}, 'Em andamento');
    await novaTratativa({}, 'Encerrada');
    await novaTratativa({}, 'Cancelada');
    const depois = await totalizador('TratativasAbertas');

    expect(antes.status).toBe(200);
    expect(depois.status).toBe(200);
    expect(depois.total).toBe((antes.total ?? Number.NaN) + 5);
  });

  it('CA3: TratativasVencidas usa a data de corte explícita em UTC', async () => {
    const antes = await totalVencidas(HOJE);
    fixarInstante('2026-10-01T12:00:00Z');
    await novaTratativa({ criticidade: 'Crítica' }, 'Em andamento');
    fixarInstante('2026-10-07T12:00:00Z');
    await novaTratativa({ criticidade: 'Crítica' }, 'Em andamento');
    fixarInstante(`${HOJE}T12:00:00Z`);
    const depois = await totalVencidas(HOJE);

    expect(antes.status).toBe(200);
    expect(depois.status).toBe(200);
    expect(depois.total).toBe((antes.total ?? Number.NaN) + 1);
  });

  it('CA4: AcoesEmAndamento conta apenas ações de Tratativas ativas (Cancelada é excluída)', async () => {
    const antes = await totalizador('AcoesEmAndamento');
    const ativos = await Promise.all([
      novaTratativa({}, 'Em andamento'),
      novaTratativa(),
      novaTratativa({}, 'Em andamento'),
    ]);
    const cancelada = await novaTratativa();
    for (const codigo of ativos) await novaAcao(codigo, `M-${sufixoUnico()}`, 'Em andamento');
    await novaAcao(cancelada, `M-${sufixoUnico()}`, 'Em andamento');
    const cancelamento = await mudarStatus(
      enviar,
      cancelada,
      { status: 'Cancelada', justificativa: 'Cancelada para teste analítico' },
      comoGestor,
    );
    expect(cancelamento.status).toBe(204);
    const depois = await totalizador('AcoesEmAndamento');

    expect(antes.status).toBe(200);
    expect(depois.status).toBe(200);
    expect(depois.total).toBe((antes.total ?? Number.NaN) + 3);
  });

  it('CA5: Gestor consulta três pendências de M1001 em Tratativas ativas', async () => {
    const antes = await contagemResponsavel('M1001');
    const tratamentos = [
      await novaTratativa(),
      await novaTratativa({}, 'Em andamento'),
      await novaTratativa(),
    ];
    await novaAcao(tratamentos[0], 'M1001');
    await novaAcao(tratamentos[1], 'M1001');
    await novaAcao(tratamentos[2], 'M1001', 'Em andamento');
    const depois = await contagemResponsavel('M1001');

    expect(antes.status).toBe(200);
    expect(depois.status).toBe(200);
    expect(depois.total).toBe((antes.total ?? 0) + 3);
  });

  it('CA6: PendenciasPorUnidade agrupa quatro ações na Planta Sul e duas na Planta Norte', async () => {
    const sul = unidadeUnica('Planta Sul');
    const norte = unidadeUnica('Planta Norte');
    const antesSul = await contagemUnidade(sul);
    const antesNorte = await contagemUnidade(norte);
    for (let i = 0; i < 4; i++) await novaAcao(await novaTratativa({ unidade: sul }), `M-${sufixoUnico()}`);
    for (let i = 0; i < 2; i++) await novaAcao(await novaTratativa({ unidade: norte }), `M-${sufixoUnico()}`);
    const depoisSul = await contagemUnidade(sul);
    const depoisNorte = await contagemUnidade(norte);

    expect(antesSul.status).toBe(200);
    expect(antesNorte.status).toBe(200);
    expect(depoisSul.status).toBe(200);
    expect(depoisNorte.status).toBe(200);
    expect(depoisSul.total).toBe((antesSul.total ?? 0) + 4);
    expect(depoisNorte.total).toBe((antesNorte.total ?? 0) + 2);
  });

  it('CA19: ação vencida numa Tratativa Cancelada não altera os totalizadores de atraso e backlog', async () => {
    const vencidasAntes = await totalVencidas(HOJE);
    const backlogAntes = await totalizador('BacklogTotal');
    fixarInstante('2026-10-01T12:00:00Z');
    const codigo = await novaTratativa({ criticidade: 'Crítica' });
    await novaAcao(codigo, `M-${sufixoUnico()}`, 'Pendente', '2026-10-01');
    const cancelamento = await mudarStatus(
      enviar,
      codigo,
      { status: 'Cancelada', justificativa: 'Cancelada para teste analítico' },
      comoGestor,
    );
    expect(cancelamento.status).toBe(204);
    fixarInstante(`${HOJE}T12:00:00Z`);
    const vencidasDepois = await totalVencidas(HOJE);
    const backlogDepois = await totalizador('BacklogTotal');

    expect(vencidasAntes.status).toBe(200);
    expect(backlogAntes.status).toBe(200);
    expect(vencidasDepois.status).toBe(200);
    expect(backlogDepois.status).toBe(200);
    expect(vencidasDepois.total).toBe(vencidasAntes.total);
    expect(backlogDepois.total).toBe(backlogAntes.total);
  });

  it('CA25: LeitorAnalitico autenticado consulta o serviço analítico com sucesso', async () => {
    const r = (await consultar(`${BASE}/TratativasAbertas`, comoLeitorAnalitico)) as RespostaHttp;

    expect(r.status).toBe(200);
  });

  it('CA26: Gestor e Administrador consultam o serviço analítico com sucesso', async () => {
    const gestor = (await consultar(`${BASE}/TratativasAbertas`, comoGestor)) as RespostaHttp;
    const admin = (await consultar(`${BASE}/TratativasAbertas`, comoAdmin)) as RespostaHttp;

    expect(gestor.status).toBe(200);
    expect(admin.status).toBe(200);
  });

  it('CA27: usuário comum recebe 403 e Acesso negado ao consultar o serviço', async () => {
    const r = (await consultar(`${BASE}/TratativasAbertas`, comoUsuario)) as RespostaHttp;
    const erro = (r.data as ErroOData).error;

    expect(r.status).toBe(403);
    expect(erro?.message).toBe('Acesso negado.');
  });

  it('CA28: AplicativoOrigem recebe 403 ao consultar qualquer endpoint analítico', async () => {
    const r = (await consultar(`${BASE}/PendenciasPorUnidadeArea`, comoApp)) as RespostaHttp;

    expect(r.status).toBe(403);
  });

  it('CA29: requisição anônima ao serviço analítico recebe 401', async () => {
    const r = (await consultar(`${BASE}/TratativasAbertas`, semAuth)) as RespostaHttp;

    expect(r.status).toBe(401);
  });

  it('CA30: LeitorAnalitico recebe 403 na visão pessoal com a recusa padronizada', async () => {
    const restrita = (await consultar(`${BASE}/PendenciasPorResponsavel`, comoLeitorAnalitico)) as RespostaHttp;
    expect(restrita.status).toBe(403);
    expect(((restrita.data as ErroOData).error)?.message).toBe('Acesso negado.');
  });

  it('CA30: LeitorAnalitico consulta PendenciasPorUnidadeArea sem identificador pessoal', async () => {
    const anonima = (await consultar(`${BASE}/PendenciasPorUnidadeArea`, comoLeitorAnalitico)) as RespostaHttp;
    expect(anonima.status).toBe(200);
    const linhasAnonimas = (anonima.data as Colecao).value;
    expect(linhasAnonimas.length).toBeGreaterThan(0);
    expect(linhasAnonimas.every((row) => !('responsavel' in row))).toBe(true);
  });

  it('CA30: Gestor recebe matrícula preenchida em PendenciasPorResponsavel', async () => {
    const identificavel = await linhasDaColecao('PendenciasPorResponsavel', comoGestor);
    expect(identificavel.status).toBe(200);
    expect(identificavel.rows?.length).toBeGreaterThan(0);
    expect(
      identificavel.rows?.every((row) => typeof row.responsavel === 'string' && row.responsavel.length > 0),
    ).toBe(true);
  });
});
