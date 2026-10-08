import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, mudarStatus, sufixoUnico, type Envia, type Resposta } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/tratativa/v1';

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

type Item = Record<string, unknown>;
const semAnotacoes = (o: Item) => Object.keys(o).filter((k) => !k.startsWith('@odata')).sort();
const CHAVES_ITEM = [
  'area', 'codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'idOrigem', 'origem', 'status', 'titulo',
  'unidade',
];
const CHAVES_DETALHE = [...CHAVES_ITEM, 'descricao', 'solicitante'].sort();

// Monta a URL da function com os parâmetros informados (texto entre aspas, números sem).
function urlLista(filtros: Record<string, string | number> = {}): string {
  const partes = Object.entries(filtros).map(([k, v]) =>
    typeof v === 'number' ? `${k}=${v}` : `${k}='${encodeURIComponent(v)}'`,
  );
  return `${BASE}/listarTratativas(${partes.join(',')})`;
}
const listar = (filtros: Record<string, string | number> = {}, como: unknown = comoUsuario): Promise<Resposta> =>
  GET(urlLista(filtros), como);
const consultar = (codigo: string, como: unknown = comoUsuario): Promise<Resposta> =>
  GET(`${BASE}/consultarTratativa(codigo=${codigo})`, como);

// Percorre todas as páginas de uma listagem (200 por página).
async function listarTudo(filtros: Record<string, string | number> = {}, como: unknown = comoUsuario): Promise<Item[]> {
  const todos: Item[] = [];
  for (let pagina = 1; pagina < 100; pagina++) {
    const r = await listar({ ...filtros, tamanhoPagina: 200, pagina }, como);
    expect(r.status).toBe(200);
    const itens = r.data.value as Item[];
    todos.push(...itens);
    if (itens.length < 200) break;
  }
  return todos;
}
const codigos = (itens: Item[]) => itens.map((i) => i.codigo);

async function avulsa(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, dados);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}
async function doApp(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await abrirPorApp(enviar, dados);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}
const aleatorio = () => '3f2b8c1e-9a4d-4e57-8b6a-1c2d3e4f5a6b';

describe('Status inicial e visibilidade (R1, R23)', () => {
  it('CA1: avulsa recém-criada é consultada com status Aberta', async () => {
    const codigo = await avulsa();
    const r = await consultar(codigo);
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('Aberta');
  });

  it('CA48/CA70: usuário comum lista sem as chaves descricao e solicitante, com titulo; com e sem filtros', async () => {
    const s = sufixoUnico();
    await doApp({ idOrigem: `ADV-${s}`, unidade: `U-${s}`, descricao: 'Texto sigiloso', solicitante: '12345' });
    const sem = await listar({ tamanhoPagina: 5 });
    expect(sem.status).toBe(200);
    expect((sem.data.value as Item[]).length).toBeGreaterThan(0);
    const com = await listar({ origem: 'Advertência', criticidade: 'Alta', status: 'Aberta', unidade: `U-${s}` });
    expect(com.status).toBe(200);
    expect((com.data.value as Item[]).length).toBe(1);
    for (const item of [...(sem.data.value as Item[]), ...(com.data.value as Item[])]) {
      expect(item).not.toHaveProperty('descricao');
      expect(item).not.toHaveProperty('solicitante');
      expect(item).toHaveProperty('titulo');
    }
  });

  it('CA48: usuário comum consulta com as chaves descricao e solicitante presentes e null', async () => {
    const s = sufixoUnico();
    const codigo = await doApp({ idOrigem: `ADV-${s}`, descricao: 'Texto sigiloso', solicitante: '12345' });
    const r = await consultar(codigo);
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('descricao');
    expect(r.data).toHaveProperty('solicitante');
    expect(r.data.descricao).toBeNull();
    expect(r.data.solicitante).toBeNull();
  });

  it('CA70: o Gestor lista e os itens também não trazem descricao e solicitante', async () => {
    const r = await listar({ tamanhoPagina: 5 }, comoGestor);
    expect(r.status).toBe(200);
    const itens = r.data.value as Item[];
    expect(itens.length).toBeGreaterThan(0);
    for (const item of itens) {
      expect(item).not.toHaveProperty('descricao');
      expect(item).not.toHaveProperty('solicitante');
    }
  });

  it('CA61/CA69: o Gestor consulta com as doze chaves e os valores, sem histórico', async () => {
    const s = sufixoUnico();
    const codigo = await doApp({
      idOrigem: `ADV-${s}`,
      titulo: `Título ${s}`,
      descricao: 'Texto sigiloso',
      solicitante: '12345',
      unidade: `Planta ${s}`,
      area: 'Manutenção',
    });
    const r = await consultar(codigo, comoGestor);
    expect(r.status).toBe(200);
    expect(semAnotacoes(r.data)).toEqual(CHAVES_DETALHE);
    expect(r.data.codigo).toBe(codigo);
    expect(r.data.titulo).toBe(`Título ${s}`);
    expect(r.data.descricao).toBe('Texto sigiloso');
    expect(r.data.solicitante).toBe('12345');
    expect(r.data.origem).toBe('Advertência');
    expect(r.data.idOrigem).toBe(`ADV-${s}`);
    expect(r.data.unidade).toBe(`Planta ${s}`);
    expect(r.data.area).toBe('Manutenção');
    expect(r.data.status).toBe('Aberta');
    expect(r.data.criticidade).toBe('Alta');
    expect(typeof r.data.dataCriacao).toBe('string');
    expect(typeof r.data.dataPrevistaConclusao).toBe('string');
    for (const k of Object.keys(r.data)) expect(k.toLowerCase()).not.toContain('historico');
  });
});

describe('acesso (R23)', () => {
  it('CA19 (leitura): sem autenticação → 401 na listagem e na consulta', async () => {
    const codigo = await avulsa();
    expect((await listar({}, semAuth)).status).toBe(401);
    expect((await consultar(codigo, semAuth)).status).toBe(401);
  });

  it('CA49: aplicativo de origem → 403 nas duas functions', async () => {
    const codigo = await avulsa();
    expect((await listar({}, comoApp)).status).toBe(403);
    expect((await consultar(codigo, comoApp)).status).toBe(403);
  });

  it('CA50: Código inexistente → 404 Tratativa não encontrada.; Código mal formado → 400 target codigo', async () => {
    const nao = await consultar(aleatorio());
    expect(nao.status).toBe(404);
    expect(nao.data.error.message).toBe('Tratativa não encontrada.');
    const mal = await consultar('abc');
    expect(mal.status).toBe(400);
    expect(mal.data.error.target).toBe('codigo');
  });

  it('CA23 (leitura): GET Tratativas e GET Tratativas(<codigo>) como Gestor → 405', async () => {
    const codigo = await avulsa();
    expect((await GET(`${BASE}/Tratativas`, comoGestor)).status).toBe(405);
    expect((await GET(`${BASE}/Tratativas(${codigo})`, comoGestor)).status).toBe(405);
  });
});

describe('filtros (R24)', () => {
  const s = sufixoUnico();
  const id = (x: string) => `${x}-${s}`;
  const massa: Record<string, string> = {};

  beforeAll(async () => {
    massa.A = await doApp({
      origem: 'Advertência', idOrigem: id('ADV-A'), criticidade: 'Alta', unidade: 'Planta A', area: 'Manutenção',
    });
    massa.B = await doApp({
      origem: 'Advertência', idOrigem: id('ADV-B'), criticidade: 'Baixa', unidade: 'Planta B', area: 'Qualidade',
    });
    massa.C = await doApp({
      origem: 'Auditoria de Qualidade', idOrigem: id('AUD-C'), criticidade: 'Alta', unidade: 'Planta A',
      area: 'Manutenção',
    });
    massa.D = await doApp({
      origem: 'Advertência', idOrigem: id('ADV-D'), criticidade: 'Alta', unidade: 'Planta A', area: 'Manutenção',
    });
    const r = await mudarStatus(enviar, massa.D, { status: 'Em andamento' }, comoGestor);
    expect(r.status).toBe(204);
  });

  const minhas = (itens: Item[]) => codigos(itens).filter((c) => Object.values(massa).includes(c as string));

  it('CA51: Origem "  advertência " devolve só Advertência (ignora caixa e espaços) e inclui a massa', async () => {
    const itens = await listarTudo({ origem: '  advertência ' });
    for (const i of itens) expect(String(i.origem).trim().toLowerCase()).toBe('advertência');
    expect(minhas(itens).sort()).toEqual([massa.A, massa.B, massa.D].sort());
  });

  it('CA52: Origem "Advertencia" (sem acento) não devolve a massa', async () => {
    const itens = await listarTudo({ origem: 'Advertencia' });
    expect(minhas(itens)).toEqual([]);
  });

  it('CA53: Criticidade Alta e Status Aberta devolvem só as que cumprem as duas', async () => {
    const itens = await listarTudo({ criticidade: 'Alta', status: 'Aberta' });
    for (const i of itens) {
      expect(i.criticidade).toBe('Alta');
      expect(i.status).toBe('Aberta');
    }
    expect(minhas(itens).sort()).toEqual([massa.A, massa.C].sort());
  });

  it('CA54: ID_Origem + Unidade + Área devolvem só a combinação; ID_Origem é exato', async () => {
    const um = await listarTudo({ idOrigem: id('ADV-A'), unidade: 'Planta A', area: 'Manutenção' });
    expect(codigos(um)).toEqual([massa.A]);
    const outraUnidade = await listarTudo({ idOrigem: id('ADV-A'), unidade: 'Planta B', area: 'Manutenção' });
    expect(codigos(outraUnidade)).toEqual([]);
    const outraCaixa = await listarTudo({ idOrigem: id('ADV-A').toLowerCase() });
    expect(codigos(outraCaixa)).toEqual([]);
  });

  it('CA71: Unidade "  planta a " + Área "MANUTENÇÃO" encontram; Área "Manutencao" não', async () => {
    const acha = await listarTudo({ unidade: '  planta a ', area: 'MANUTENÇÃO' });
    expect(minhas(acha).sort()).toEqual([massa.A, massa.C, massa.D].sort());
    const nao = await listarTudo({ unidade: '  planta a ', area: 'Manutencao' });
    expect(minhas(nao)).toEqual([]);
  });

  it('CA55/CA47: Status "Pendente" → 400 target status; Criticidade "Urgente" → 400 target criticidade', async () => {
    const st = await listar({ status: 'Pendente' });
    expect(st.status).toBe(400);
    expect(st.data.error.target).toBe('status');
    expect(st.data.error.message).toContain('Status');
    const cr = await listar({ criticidade: 'Urgente' });
    expect(cr.status).toBe(400);
    expect(cr.data.error.target).toBe('criticidade');
    expect(cr.data.error.message).toContain('Criticidade');
  });

  it('CA56: sem filtro, a listagem completa inclui uma avulsa e uma de aplicativo', async () => {
    const a = await avulsa();
    const b = await doApp();
    const todos = codigos(await listarTudo());
    expect(todos).toContain(a);
    expect(todos).toContain(b);
  });
});

describe('ordenação (R25)', () => {
  it('CA57: ordem por Data prevista de conclusão crescente', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const unidade = `Ord-${sufixoUnico()}`;
    const baixa = await avulsa({ criticidade: 'Baixa', unidade });
    const critica = await avulsa({ criticidade: 'Crítica', unidade });
    const alta = await avulsa({ criticidade: 'Alta', unidade });
    const itens = await listarTudo({ unidade });
    expect(codigos(itens)).toEqual([critica, alta, baixa]);
  });

  it('CA58: mesma Data prevista → vem primeiro a de criação mais antiga', async () => {
    const unidade = `Emp-${sufixoUnico()}`;
    fixarInstante('2026-10-22T10:00:00-03:00');
    const media = await avulsa({ criticidade: 'Média', unidade });
    fixarInstante('2026-10-07T12:00:00-03:00');
    const baixa = await avulsa({ criticidade: 'Baixa', unidade });
    const itens = await listarTudo({ unidade });
    expect(itens.map((i) => i.dataPrevistaConclusao)).toEqual(['2026-11-06', '2026-11-06']);
    expect(codigos(itens)).toEqual([baixa, media]);
  });
});

describe('paginação e forma (R25)', () => {
  it('CA59: 120 Tratativas → páginas de 50, 50 e 20 sem repetição; limites recusados', async () => {
    const unidade = `Pag-${sufixoUnico()}`;
    for (let lote = 0; lote < 6; lote++) {
      await Promise.all(Array.from({ length: 20 }, () => avulsa({ criticidade: 'Média', unidade })));
    }
    const respostas = [await listar({ unidade }), await listar({ unidade, pagina: 2 }), await listar({ unidade, pagina: 3 })];
    expect(respostas.map((r) => r.status)).toEqual([200, 200, 200]);
    const [p1, p2, p3] = respostas.map((r) => r.data.value as Item[]);
    expect([p1.length, p2.length, p3.length]).toEqual([50, 50, 20]);
    expect(new Set([...codigos(p1), ...codigos(p2), ...codigos(p3)]).size).toBe(120);

    const grande = await listar({ unidade, tamanhoPagina: 201 });
    expect(grande.status).toBe(400);
    expect(grande.data.error.target).toBe('tamanhoPagina');
    const zero = await listar({ unidade, pagina: 0 });
    expect(zero.status).toBe(400);
    expect(zero.data.error.target).toBe('pagina');
  });

  it('CA60: cada item traz exatamente as dez chaves de ItemListagem', async () => {
    await avulsa();
    const r = await listar({ tamanhoPagina: 10 });
    expect(r.status).toBe(200);
    const itens = r.data.value as Item[];
    expect(itens.length).toBeGreaterThan(0);
    for (const item of itens) expect(semAnotacoes(item)).toEqual(CHAVES_ITEM);
  });
});

describe('identificação e origem única (R27, R28)', () => {
  it('CA62/CA63: o detalhe tem só as doze chaves; origem e idOrigem são texto ou null, nunca lista', async () => {
    const dePar = await doApp();
    const avulsaCodigo = await avulsa();
    for (const codigo of [dePar, avulsaCodigo]) {
      const r = await consultar(codigo, comoGestor);
      expect(r.status).toBe(200);
      expect(semAnotacoes(r.data)).toEqual(CHAVES_DETALHE);
      for (const k of ['origem', 'idOrigem']) {
        expect(Array.isArray(r.data[k])).toBe(false);
        expect(r.data[k] === null || typeof r.data[k] === 'string').toBe(true);
      }
    }
    expect(typeof (await consultar(dePar, comoGestor)).data.origem).toBe('string');
  });

  it('CA63: o $metadata do DetalheTratativa existe e não tem Collection(', async () => {
    const r = await GET(`${BASE}/$metadata`, comoUsuario);
    expect(r.status).toBe(200);
    const m = String(r.data).match(/<ComplexType Name="DetalheTratativa">([\s\S]*?)<\/ComplexType>/);
    expect(m).not.toBeNull();
    expect((m as RegExpMatchArray)[1]).not.toContain('Collection(');
  });
});
