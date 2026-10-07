import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoApp, semAuth } from './apoio/usuarios';

const { POST } = cds.test(__dirname + '/..');
const ABRIR = '/api/integracao-origem/v1/abrirTratativa';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

jest.setTimeout(60000);

let contador = 0;
const idUnico = () => `ID-${Date.now()}-${++contador}`;
const pedido = (extra: Record<string, unknown> = {}) => ({
  origem: 'Advertência',
  idOrigem: idUnico(),
  titulo: 'Título',
  criticidade: 'Alta',
  ...extra,
});
const total = async (entidade: string) => (await linhas(entidade)).length;

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

describe('abertura por aplicativo: caminho feliz', () => {
  it('CA1: aplicativo autenticado abre e recebe o Código', async () => {
    const r = await POST(ABRIR, pedido({ idOrigem: 'ADV-001' }), comoApp);
    expect(r.status).toBe(200);
    expect(typeof r.data.codigo).toBe('string');
    expect(r.data.codigo.length).toBeGreaterThan(0);
  });

  it.each([
    ['CA6', 'Crítica', '2026-10-10'],
    ['CA7', 'Baixa', '2026-11-06'],
    ['CA29', 'Alta', '2026-10-14'],
    ['CA30', 'Média', '2026-10-22'],
  ])('%s: Criticidade %s criada em 2026-10-07 tem Data prevista %s', async (_ca, criticidade, esperada) => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const r = await POST(ABRIR, pedido({ criticidade }), comoApp);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.dataCriacao).toBe('2026-10-07');
    expect(t.dataPrevistaConclusao).toBe(esperada);
  });

  it('CA6 (fuso): às 23h30 em Brasília a data civil ainda é 2026-10-07', async () => {
    fixarInstante('2026-10-07T23:30:00-03:00');
    const r = await POST(ABRIR, pedido({ criticidade: 'Crítica' }), comoApp);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.dataCriacao).toBe('2026-10-07');
    expect(t.dataPrevistaConclusao).toBe('2026-10-10');
  });

  it('CA13: só os obrigatórios deixam os opcionais nulos', async () => {
    const r = await POST(ABRIR, pedido(), comoApp);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.descricao).toBeNull();
    expect(t.unidade).toBeNull();
    expect(t.area).toBeNull();
    expect(t.solicitante).toBeNull();
  });

  it('CA24: status Aberta e uma linha de histórico de criação', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const r = await POST(ABRIR, pedido(), comoApp);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.status).toBe('Aberta');
    const hist = await linhas('HistoricoTratativa', { tratativa_codigo: r.data.codigo });
    expect(hist).toHaveLength(1);
    expect(hist[0].evento).toBe('Criacao');
    expect(hist[0].autor).toBe('app-origem-a');
    expect(hist[0].tipoAutor).toBe('Aplicativo');
    expect(Date.parse(String(hist[0].quando))).toBe(Date.parse('2026-10-07T12:00:00-03:00'));
  });

  it('CA26: Origem de outra área também abre', async () => {
    const r = await POST(ABRIR, pedido({ origem: 'Auditoria de Qualidade' }), comoApp);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.origem).toBe('Auditoria de Qualidade');
  });

  it('CA36: Solicitante é só a matrícula e o modelo não guarda nome nem e-mail', async () => {
    const r = await POST(ABRIR, pedido({ solicitante: 'M12345' }), comoApp);
    expect(r.status).toBe(200);
    const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
    expect(t.solicitante).toBe('M12345');
    const definicao = cds.model!.definitions['br.com.calazanstec.Tratativas'] as unknown as {
      elements: Record<string, unknown>;
    };
    const elementos = Object.keys(definicao.elements);
    expect(elementos.filter((e) => /nome|email/i.test(e))).toEqual([]);
  });
});

describe('abertura por aplicativo: Código', () => {
  it('CA34: registros diferentes recebem Códigos diferentes, ambos UUID v4', async () => {
    const a = await POST(ABRIR, pedido(), comoApp);
    const b = await POST(ABRIR, pedido(), comoApp);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.data.codigo).not.toBe(b.data.codigo);
    expect(a.data.codigo).toMatch(UUID_V4);
    expect(b.data.codigo).toMatch(UUID_V4);
  });

  it('CA35: o Código não contém Origem nem ID_Origem', async () => {
    const dados = pedido({ origem: 'Advertência', idOrigem: 'ADV-777' });
    const r = await POST(ABRIR, dados, comoApp);
    expect(r.status).toBe(200);
    const codigo = String(r.data.codigo).toLowerCase();
    expect(codigo).toMatch(UUID_V4);
    expect(codigo).not.toContain('advertência');
    expect(codigo).not.toContain('adv-777');
  });
});

describe('abertura por aplicativo: pedidos recusados não gravam nada', () => {
  const recusa = async (corpo: Record<string, unknown>, opcoes: object) => {
    const antes = [await total('Tratativas'), await total('HistoricoTratativa')];
    const r = await POST(ABRIR, corpo, opcoes);
    const depois = [await total('Tratativas'), await total('HistoricoTratativa')];
    expect(depois).toEqual(antes);
    return r;
  };

  it('CA8: data prevista informada é recusada (400)', async () => {
    const r = await recusa(pedido({ dataPrevistaConclusao: '2026-12-31' }), comoApp);
    expect(r.status).toBe(400);
  });

  it.each([['CA25', 'nomeVitima'], ['CA37', 'nomeSolicitante'], ['CA37', 'emailSolicitante']])(
    '%s: campo desconhecido %s é recusado (400)',
    async (_ca, campo) => {
      const r = await recusa(pedido({ [campo]: 'valor' }), comoApp);
      expect(r.status).toBe(400);
    },
  );

  it('CA19: sem autenticação responde 401', async () => {
    const r = await recusa(pedido(), semAuth);
    expect(r.status).toBe(401);
  });
});
