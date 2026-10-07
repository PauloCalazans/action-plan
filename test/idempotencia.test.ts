import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { comoApp, comoAppB } from './apoio/usuarios';

const { POST } = cds.test(__dirname + '/..');
const ABRIR = '/api/integracao-origem/v1/abrirTratativa';

jest.setTimeout(60000);

// Cada teste usa um sufixo próprio para isolar seus pares no banco compartilhado da suíte.
let contador = 0;
const sufixo = () => `${Date.now()}-${++contador}`;
const pedido = (origem: string, idOrigem: string, extra: Record<string, unknown> = {}) => ({
  origem,
  idOrigem,
  titulo: 'Título',
  criticidade: 'Alta',
  ...extra,
});
const porId = (idOrigem: string) => linhas('Tratativas', { idOrigem });

beforeAll(registrarCredenciais);

describe('idempotência por par (Origem, ID_Origem)', () => {
  it('CA2: repetir o par devolve o mesmo Código sem duplicar Tratativa, chave ou histórico', async () => {
    const id = `ADV-${sufixo()}`;
    const r1 = await POST(ABRIR, pedido('Advertência', id), comoApp);
    const r2 = await POST(ABRIR, pedido('Advertência', id), comoApp);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.data.codigo).toBe(r1.data.codigo);
    expect(await porId(id)).toHaveLength(1);
    expect(await linhas('ChavesOrigem', { idOrigem: id })).toHaveLength(1);
    const hist = await linhas('HistoricoTratativa', { tratativa_codigo: r1.data.codigo });
    expect(hist.filter((h) => h.evento === 'Criacao')).toHaveLength(1);
  });

  it('CA15: mesmo ID_Origem em outra Origem gera outra Tratativa', async () => {
    const id = `123-${sufixo()}`;
    const r1 = await POST(ABRIR, pedido('Advertência', id), comoApp);
    const r2 = await POST(ABRIR, pedido('Notificação de Risco de Acidente', id), comoAppB);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.data.codigo).not.toBe(r1.data.codigo);
    expect(await porId(id)).toHaveLength(2);
  });

  it('CA16: Origem com caixa e espaços nas pontas é o mesmo par; origem gravada não muda', async () => {
    const id = `123-${sufixo()}`;
    const r1 = await POST(ABRIR, pedido('Advertência', id), comoApp);
    const r2 = await POST(ABRIR, pedido('  advertência ', id), comoApp);
    expect(r2.status).toBe(200);
    expect(r2.data.codigo).toBe(r1.data.codigo);
    const ts = await porId(id);
    expect(ts).toHaveLength(1);
    expect(ts[0].origem).toBe('Advertência');
  });

  it('CA17: Origem sem o acento é outro par e cria nova Tratativa', async () => {
    const id = `123-${sufixo()}`;
    const r1 = await POST(ABRIR, pedido('Advertência', id), comoApp);
    const r2 = await POST(ABRIR, pedido('Advertencia', id), comoApp);
    expect(r2.status).toBe(200);
    expect(r2.data.codigo).not.toBe(r1.data.codigo);
    expect(await porId(id)).toHaveLength(2);
  });

  it('H3: ID_Origem não é normalizado; espaços nas pontas criam outra Tratativa', async () => {
    const id = `123-${sufixo()}`;
    const r1 = await POST(ABRIR, pedido('Advertência', id), comoApp);
    const r2 = await POST(ABRIR, pedido('Advertência', ` ${id} `), comoApp);
    expect(r2.status).toBe(200);
    expect(r2.data.codigo).not.toBe(r1.data.codigo);
    expect(await linhas('ChavesOrigem', { origemNormalizada: 'advertência' }).then(
      (l) => l.filter((c) => c.idOrigem === id || c.idOrigem === ` ${id} `),
    )).toHaveLength(2);
  });

  it('CA18: repetição com outra Criticidade e outro título não altera a Tratativa existente', async () => {
    const id = `ADV-${sufixo()}`;
    const r1 = await POST(ABRIR, pedido('Advertência', id, { titulo: 'Original', criticidade: 'Alta' }), comoApp);
    const [antes] = await linhas('Tratativas', { codigo: r1.data.codigo });
    const r2 = await POST(ABRIR, pedido('Advertência', id, { titulo: 'Outro', criticidade: 'Baixa' }), comoApp);
    expect(r2.status).toBe(200);
    expect(r2.data.codigo).toBe(r1.data.codigo);
    const [depois] = await linhas('Tratativas', { codigo: r1.data.codigo });
    expect(depois.criticidade).toBe('Alta');
    expect(depois.titulo).toBe('Original');
    expect(depois.dataPrevistaConclusao).toBe(antes.dataPrevistaConclusao);
    expect(await porId(id)).toHaveLength(1);
  });

  it('corrida (amostra): 5 pedidos idênticos simultâneos resultam em um único Código e uma linha', async () => {
    const id = `ADV-${sufixo()}`;
    const rs: { status: number; data: { codigo: string } }[] = await Promise.all(
      Array.from({ length: 5 }, () => POST(ABRIR, pedido('Advertência', id), comoApp)),
    );
    expect(rs.map((r: { status: number; data: { codigo: string } }) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(rs.map((r: { status: number; data: { codigo: string } }) => r.data.codigo)).size).toBe(1);
    expect(await porId(id)).toHaveLength(1);
    expect(await linhas('ChavesOrigem', { idOrigem: id })).toHaveLength(1);
  });
});
