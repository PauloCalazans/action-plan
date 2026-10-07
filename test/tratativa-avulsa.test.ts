import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoApp, comoUsuario, semAuth } from './apoio/usuarios';

const { POST } = cds.test(__dirname + '/..');
const AVULSA = '/api/tratativa/v1/criarTratativaAvulsa';

jest.setTimeout(60000);

const valido = () => ({ titulo: 'Título avulso', criticidade: 'Alta' });
const total = async (entidade: string) => (await linhas(entidade)).length;
const contagens = async () => [
  await total('Tratativas'),
  await total('ChavesOrigem'),
  await total('HistoricoTratativa'),
];

// Envia o pedido, espera 400 com target e confere que nada foi gravado.
async function recusa(corpo: Record<string, unknown>, target: string, trecho?: string) {
  const antes = await contagens();
  const r = await POST(AVULSA, corpo, comoUsuario);
  expect(r.status).toBe(400);
  expect(r.data.error.target).toBe(target);
  if (trecho) expect(r.data.error.message).toContain(trecho);
  expect(await contagens()).toEqual(antes);
}

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

describe('Tratativa avulsa: caminho feliz', () => {
  it('CA4: usuário cria só com titulo e criticidade; origem e idOrigem nulos; sem ChavesOrigem', async () => {
    const chaves = await total('ChavesOrigem');
    const r = await POST(AVULSA, valido(), comoUsuario);
    expect(r.status).toBe(200);
    expect(typeof r.data.codigo).toBe('string');
    expect(r.data.codigo.length).toBeGreaterThan(0);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.origem).toBeNull();
    expect(t.idOrigem).toBeNull();
    expect(await total('ChavesOrigem')).toBe(chaves);
  });

  it('CA33: duas avulsas com mesmos Título e Criticidade geram dois Códigos e duas linhas', async () => {
    const antes = await total('Tratativas');
    const a = await POST(AVULSA, valido(), comoUsuario);
    const b = await POST(AVULSA, valido(), comoUsuario);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.data.codigo).not.toBe(b.data.codigo);
    expect(await total('Tratativas')).toBe(antes + 2);
  });

  it('CA24 (avulsa): status Aberta e histórico Criacao com autor usuario e tipo Usuario', async () => {
    const r = await POST(AVULSA, valido(), comoUsuario);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.status).toBe('Aberta');
    const hist = await linhas('HistoricoTratativa', { tratativa_codigo: r.data.codigo });
    expect(hist).toHaveLength(1);
    expect(hist[0].evento).toBe('Criacao');
    expect(hist[0].autor).toBe('usuario');
    expect(hist[0].tipoAutor).toBe('Usuario');
  });

  it('CA6 (avulsa): Crítica criada em 2026-10-07 tem Data prevista 2026-10-10', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const r = await POST(AVULSA, { ...valido(), criticidade: 'Crítica' }, comoUsuario);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.dataCriacao).toBe('2026-10-07');
    expect(t.dataPrevistaConclusao).toBe('2026-10-10');
  });
});

describe('Tratativa avulsa: acesso', () => {
  it('CA31: sem autenticação → 401 e nada gravado', async () => {
    const antes = await contagens();
    const r = await POST(AVULSA, valido(), semAuth);
    expect(r.status).toBe(401);
    expect(await contagens()).toEqual(antes);
  });

  it('CA38: aplicativo de origem → 403 com a mensagem da decisão 15 e nada gravado', async () => {
    const antes = await contagens();
    const r = await POST(AVULSA, valido(), comoApp);
    expect(r.status).toBe(403);
    expect(r.data.error.message).toBe('Aplicativo de origem não cria Tratativa avulsa.');
    expect(await contagens()).toEqual(antes);
  });
});

describe('Tratativa avulsa: validação', () => {
  it('CA12 (avulsa): sem titulo → 400, target titulo, mensagem cita Título', async () => {
    await recusa({ criticidade: 'Alta' }, 'titulo', 'Título');
  });

  it('CA28 (avulsa): sem criticidade → 400, target criticidade, mensagem cita Criticidade', async () => {
    await recusa({ titulo: 'Título avulso' }, 'criticidade', 'Criticidade');
  });

  it('CA5 (avulsa): criticidade fora da lista → 400, target criticidade', async () => {
    await recusa({ ...valido(), criticidade: 'Urgente' }, 'criticidade', 'Criticidade');
  });

  it.each([['origem'], ['idOrigem']])('R14/R21 (avulsa): corpo com %s → 400 e nada gravado', async (campo) => {
    const antes = await contagens();
    const r = await POST(AVULSA, { ...valido(), [campo]: 'X' }, comoUsuario);
    expect(r.status).toBe(400);
    expect(await contagens()).toEqual(antes);
  });
});
