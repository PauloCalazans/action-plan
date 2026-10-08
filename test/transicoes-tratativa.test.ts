import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { bloqueiaAntesDeEscrever, instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, mudarStatus, type Envia } from './apoio/tratativas';
import { comoAdmin, comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST, PATCH, DELETE } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/tratativa/v1';
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const HISTORICO = 'br.com.calazanstec.HistoricoTratativa';

jest.setTimeout(60000);

let espiao: Espiao;
beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});
afterEach(() => {
  liberarRelogio();
  espiao.naoFalhar();
});

const mudar = (codigo: string, corpo: Record<string, unknown>, como: unknown = comoGestor) =>
  mudarStatus(enviar, codigo, corpo, como);

// Cria uma avulsa Aberta e, se pedido, leva direto ao Status inicial do caso (setup, sem passar pelo mudarStatus).
async function nova(status = 'Aberta', dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, dados);
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  if (status !== 'Aberta') await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status }).where({ codigo }));
  return codigo;
}

const statusDe = async (codigo: string) => ((await linhas('Tratativas', { codigo }))[0] ?? {}).status;
const historico = (codigo: string) => linhas('HistoricoTratativa', { tratativa_codigo: codigo });
const instante = (v: unknown) => new Date(v as string).getTime();
const transicoes = async (codigo: string) =>
  (await historico(codigo))
    .filter((h) => h.campo === 'status')
    .sort((a, b) => instante(a.quando) - instante(b.quando));

// Pedido recusado: confere HTTP, mensagem/target e que Status e contagem de histórico não mudaram.
async function recusa(
  codigo: string,
  corpo: Record<string, unknown>,
  http: number,
  target: string,
  mensagem: string | RegExp,
) {
  const status = await statusDe(codigo);
  const antes = (await historico(codigo)).length;
  const r = await mudar(codigo, corpo);
  expect(r.status).toBe(http);
  expect(r.data.error.target).toBe(target);
  if (typeof mensagem === 'string') expect(r.data.error.message).toBe(mensagem);
  else expect(r.data.error.message).toMatch(mensagem);
  expect(await statusDe(codigo)).toBe(status);
  expect((await historico(codigo)).length).toBe(antes);
}

describe('transições aceitas (R2, R5, R7)', () => {
  it.each([
    ['CA2/CA14: iniciar sem justificativa', 'Aberta', { status: 'Em andamento' }, 'Em andamento'],
    ['CA3: encerrar Em andamento', 'Em andamento', { status: 'Encerrada' }, 'Encerrada'],
    ['CA4/CA16: encerrar Aberta direto', 'Aberta', { status: 'Encerrada' }, 'Encerrada'],
    ['CA6: cancelar Aberta com justificativa', 'Aberta', { status: 'Cancelada', justificativa: 'duplicada' }, 'Cancelada'],
    ['CA6: cancelar Em andamento com justificativa', 'Em andamento', { status: 'Cancelada', justificativa: 'duplicada' }, 'Cancelada'],
    ['CA5: reabrir Encerrada com justificativa', 'Encerrada', { status: 'Em andamento', justificativa: 'faltou ação' }, 'Em andamento'],
  ])('%s → 204 e Status novo no banco', async (_nome, inicial, corpo, esperado) => {
    const codigo = await nova(inicial);
    const r = await mudar(codigo, corpo);
    expect(r.status).toBe(204);
    expect(await statusDe(codigo)).toBe(esperado);
  });
});

describe('transições recusadas (R3, R4)', () => {
  it.each([
    ['CA7: Cancelada → Em andamento (reabrir)', 'Cancelada', 'Em andamento'],
    ['CA7: Cancelada → Encerrada', 'Cancelada', 'Encerrada'],
    ['CA8: Em andamento → Em andamento', 'Em andamento', 'Em andamento'],
    ['CA9: Encerrada → Cancelada', 'Encerrada', 'Cancelada'],
    ['CA10: Em andamento → Aberta', 'Em andamento', 'Aberta'],
  ])('%s → 409 com mensagem exata, target status e nada muda', async (_nome, atual, pedido) => {
    const codigo = await nova(atual);
    await recusa(
      codigo,
      { status: pedido, justificativa: 'motivo válido' },
      409,
      'status',
      `Transição não permitida: de ${atual} para ${pedido}.`,
    );
  });

  it('CA7: Cancelada → Em andamento sem justificativa também é Transição não permitida (409, não 400)', async () => {
    const codigo = await nova('Cancelada');
    await recusa(codigo, { status: 'Em andamento' }, 409, 'status', 'Transição não permitida: de Cancelada para Em andamento.');
  });

  it('CA73: usuário comum → 403 e Gestor → 409 ao cancelar Encerrada sem justificativa', async () => {
    const codigo = await nova('Encerrada');
    const u = await mudar(codigo, { status: 'Cancelada' }, comoUsuario);
    expect(u.status).toBe(403);
    await recusa(codigo, { status: 'Cancelada' }, 409, 'status', 'Transição não permitida: de Encerrada para Cancelada.');
  });

  it('Status ausente → 400 O campo Status é obrigatório., target status', async () => {
    const codigo = await nova();
    await recusa(codigo, {}, 400, 'status', 'O campo Status é obrigatório.');
  });
});

describe('Justificativa (R5)', () => {
  it.each([
    ['CA11: ausente', {}],
    ['CA11: só espaços', { justificativa: '   ' }],
    ['CA13: 501 caracteres', { justificativa: 'x'.repeat(501) }],
  ])('%s ao cancelar → 400, target justificativa', async (_nome, extra) => {
    const codigo = await nova('Em andamento');
    await recusa(codigo, { status: 'Cancelada', ...extra }, 400, 'justificativa', /Justificativa/);
  });

  it('CA12: reabrir com justificativa só de espaços → 400, target justificativa', async () => {
    const codigo = await nova('Encerrada');
    await recusa(codigo, { status: 'Em andamento', justificativa: '   ' }, 400, 'justificativa', /Justificativa/);
  });
});

describe('Criticidade e Data prevista na reabertura (R6)', () => {
  it('CA15: reabrir não recalcula Criticidade nem Data prevista', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const codigo = await nova('Aberta', { criticidade: 'Alta' });
    expect((await linhas('Tratativas', { codigo }))[0].dataPrevistaConclusao).toBe('2026-10-14');
    expect((await mudar(codigo, { status: 'Em andamento' })).status).toBe(204);
    expect((await mudar(codigo, { status: 'Encerrada' })).status).toBe(204);
    fixarInstante('2026-10-20T10:00:00-03:00');
    expect((await mudar(codigo, { status: 'Em andamento', justificativa: 'reaberta' })).status).toBe(204);
    const [t] = await linhas('Tratativas', { codigo });
    expect(t.status).toBe('Em andamento');
    expect(t.criticidade).toBe('Alta');
    expect(t.dataPrevistaConclusao).toBe('2026-10-14');
  });
});

describe('acesso (R8)', () => {
  const quem: [string, unknown][] = [
    ['CA17: usuário comum', comoUsuario],
    ['CA68: Administrador', comoAdmin],
    ['CA18: aplicativo de origem', comoApp],
  ];
  const pedidos: [string, Record<string, unknown>][] = [
    ['Aberta', { status: 'Em andamento' }],
    ['Em andamento', { status: 'Encerrada' }],
    ['Encerrada', { status: 'Em andamento', justificativa: 'reabrir' }],
    ['Em andamento', { status: 'Cancelada', justificativa: 'cancelar' }],
  ];

  it.each(quem)('%s → 403 em iniciar, encerrar, reabrir e cancelar; nada muda', async (_nome, como) => {
    for (const [inicial, corpo] of pedidos) {
      const codigo = await nova(inicial);
      const antes = (await historico(codigo)).length;
      const r = await mudar(codigo, corpo, como);
      expect(r.status).toBe(403);
      expect(await statusDe(codigo)).toBe(inicial);
      expect((await historico(codigo)).length).toBe(antes);
    }
  });

  it('CA19: sem autenticação → 401; nada muda', async () => {
    const codigo = await nova();
    const antes = (await historico(codigo)).length;
    const r = await mudar(codigo, { status: 'Em andamento' }, semAuth);
    expect(r.status).toBe(401);
    expect(await statusDe(codigo)).toBe('Aberta');
    expect((await historico(codigo)).length).toBe(antes);
  });
});

describe('histórico da transição (R9)', () => {
  it('CA20: campo status, valores, autor gestor, tipo Usuario, instante fixado e justificativa aparada', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const codigo = await nova('Em andamento');
    const r = await mudar(codigo, { status: 'Cancelada', justificativa: '  duplicada  ' });
    expect(r.status).toBe(204);
    const [h] = await transicoes(codigo);
    expect(h).toBeDefined();
    expect(h.campo).toBe('status');
    expect(h.valorAnterior).toBe('Em andamento');
    expect(h.valorNovo).toBe('Cancelada');
    expect(h.autor).toBe('gestor');
    expect(h.tipoAutor).toBe('Usuario');
    expect(instante(h.quando)).toBe(new Date('2026-10-07T12:00:00-03:00').getTime());
    expect(h.justificativa).toBe('duplicada');
  });

  it('CA20: sem justificativa informada, justificativa é null', async () => {
    const codigo = await nova();
    expect((await mudar(codigo, { status: 'Em andamento' })).status).toBe(204);
    const [h] = await transicoes(codigo);
    expect(h).toBeDefined();
    expect(h.justificativa).toBeNull();
  });

  it.each([
    ['Aberta', { status: 'Em andamento' }, 'MudancaStatus'],
    ['Em andamento', { status: 'Encerrada' }, 'Encerramento'],
    ['Encerrada', { status: 'Em andamento', justificativa: 'reabrir' }, 'Reabertura'],
    ['Em andamento', { status: 'Cancelada', justificativa: 'cancelar' }, 'Cancelamento'],
  ])('CA21: de %s com %j grava o evento %s', async (inicial, corpo, evento) => {
    const codigo = await nova(inicial);
    expect((await mudar(codigo, corpo)).status).toBe(204);
    const trans = await transicoes(codigo);
    expect(trans).toHaveLength(1);
    expect(trans[0].evento).toBe(evento);
  });

  it('CA77: Aberta → Encerrada sem justificativa é Encerramento; Aberta → Cancelada sem justificativa é recusada', async () => {
    const a = await nova();
    expect((await mudar(a, { status: 'Encerrada' })).status).toBe(204);
    const trans = await transicoes(a);
    expect(trans).toHaveLength(1);
    expect(trans[0].evento).toBe('Encerramento');
    expect(trans[0].justificativa).toBeNull();

    const b = await nova();
    await recusa(b, { status: 'Cancelada' }, 400, 'justificativa', /Justificativa/);
  });

  it('CA67: Aberta → Em andamento → Encerrada → Em andamento → Cancelada gera quatro linhas em ordem de quando', async () => {
    const codigo = await nova();
    const passos: [string, Record<string, unknown>][] = [
      ['2026-10-07T09:00:00-03:00', { status: 'Em andamento' }],
      ['2026-10-07T10:00:00-03:00', { status: 'Encerrada' }],
      ['2026-10-07T11:00:00-03:00', { status: 'Em andamento', justificativa: 'reabrir' }],
      ['2026-10-07T12:00:00-03:00', { status: 'Cancelada', justificativa: 'cancelar' }],
    ];
    for (const [iso, corpo] of passos) {
      fixarInstante(iso);
      expect((await mudar(codigo, corpo)).status).toBe(204);
    }
    const trans = await transicoes(codigo);
    expect(trans.map((h) => h.evento)).toEqual(['MudancaStatus', 'Encerramento', 'Reabertura', 'Cancelamento']);
  });
});

describe('atomicidade (R10)', () => {
  it('CA22: falha ao gravar o histórico → ≥ 500, Status inalterado e nenhum histórico novo', async () => {
    const codigo = await nova();
    const antes = (await historico(codigo)).length;
    espiao.falharEm('CREATE', HISTORICO);
    const r = await mudar(codigo, { status: 'Em andamento' });
    espiao.naoFalhar();
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(await statusDe(codigo)).toBe('Aberta');
    expect((await historico(codigo)).length).toBe(antes);
  });
});

describe('sem exclusão nem escrita pelo entity set (R11)', () => {
  it.each([
    ['gestor', comoGestor],
    ['admin', comoAdmin],
  ])('CA23: DELETE, PATCH e POST como %s → 405; a Tratativa continua', async (_nome, como) => {
    const codigo = await nova();
    expect((await DELETE(`${BASE}/Tratativas(${codigo})`, como)).status).toBe(405);
    expect((await PATCH(`${BASE}/Tratativas(${codigo})`, { titulo: 'x' }, como)).status).toBe(405);
    expect((await POST(`${BASE}/Tratativas`, { titulo: 'x' }, como)).status).toBe(405);
    expect(await linhas('Tratativas', { codigo })).toHaveLength(1);
  });
});

describe('serialização por Tratativa (D9)', () => {
  it('CA46: dois encerramentos simultâneos → [204, 409], um único Encerramento', async () => {
    const codigo = await nova('Em andamento');
    const [a, b] = await Promise.all([
      mudar(codigo, { status: 'Encerrada' }),
      mudar(codigo, { status: 'Encerrada' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([204, 409]);
    const perdedora = a.status === 409 ? a : b;
    expect(perdedora.data.error.message).toBe('Transição não permitida: de Encerrada para Encerrada.');
    const trans = await transicoes(codigo);
    expect(trans.filter((h) => h.evento === 'Encerramento')).toHaveLength(1);
  });

  it('D9: num pedido isolado a primeira leitura de Tratativas é forUpdate e nada foi escrito antes', async () => {
    const codigo = await nova('Em andamento');
    espiao.limpar();
    const r = await mudar(codigo, { status: 'Encerrada' });
    expect(r.status).toBe(204);
    expect(bloqueiaAntesDeEscrever(espiao.comandos)).toBe(true);
  });
});

describe('aplicativo de origem e Origens (R29, R31)', () => {
  it('CA64: o aplicativo consulta a Tratativa encerrada pelo Gestor com os sete campos e Status Encerrada', async () => {
    const aberta = await abrirPorApp(enviar);
    expect(aberta.status).toBe(200);
    const codigo = aberta.data.codigo as string;
    expect((await mudar(codigo, { status: 'Encerrada' })).status).toBe(204);
    const r = await GET(`/api/integracao-origem/v1/consultarPorCodigo(codigo=${codigo})`, comoApp);
    expect(r.status).toBe(200);
    const chaves = Object.keys(r.data).filter((k) => !k.startsWith('@odata')).sort();
    expect(chaves).toEqual(
      ['codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'idOrigem', 'origem', 'status'],
    );
    expect(r.data.status).toBe('Encerrada');
  });

  it('CA66: Origem Auditoria de Qualidade e avulsa aceitam iniciar e encerrar', async () => {
    const porApp = await abrirPorApp(enviar, { origem: 'Auditoria de Qualidade' });
    expect(porApp.status).toBe(200);
    const avulsa = await nova();
    for (const codigo of [porApp.data.codigo as string, avulsa]) {
      expect((await mudar(codigo, { status: 'Em andamento' })).status).toBe(204);
      expect((await mudar(codigo, { status: 'Encerrada' })).status).toBe(204);
    }
  });
});
