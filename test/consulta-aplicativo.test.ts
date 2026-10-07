import cds from '@sap/cds';
import { randomUUID } from 'crypto';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { comoApp } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const BASE = '/api/integracao-origem/v1';
const ABRIR = `${BASE}/abrirTratativa`;

jest.setTimeout(60000);

let contador = 0;
const sufixo = () => `${Date.now()}-${++contador}`;
const CAMPOS = ['codigo', 'origem', 'idOrigem', 'criticidade', 'status', 'dataCriacao', 'dataPrevistaConclusao'];
const semAnotacoes = (o: Record<string, unknown>) =>
  Object.keys(o).filter((k) => !k.startsWith('@odata')).sort();
const porCodigo = (c: string) => GET(`${BASE}/consultarPorCodigo(codigo=${c})`, comoApp);
const porPar = (origem: string, idOrigem: string) =>
  GET(
    `${BASE}/consultarPorOrigem(origem='${encodeURIComponent(origem)}',idOrigem='${encodeURIComponent(idOrigem)}')`,
    comoApp,
  );
const instante = (v: unknown) => new Date(v as string).getTime();

async function abrir(origem: string, idOrigem: string) {
  const r = await POST(
    ABRIR,
    {
      origem,
      idOrigem,
      titulo: 'Título sigiloso',
      criticidade: 'Alta',
      descricao: 'Descrição sigilosa',
      solicitante: 'fulano.solicitante',
    },
    comoApp,
  );
  expect(r.status).toBe(200);
  const [gravada] = await linhas('Tratativas', { codigo: r.data.codigo });
  return { codigo: r.data.codigo as string, gravada };
}

function conferirCampos(corpo: Record<string, unknown>, gravada: Record<string, unknown>) {
  expect(semAnotacoes(corpo)).toEqual([...CAMPOS].sort());
  for (const k of ['codigo', 'origem', 'idOrigem', 'criticidade', 'status']) expect(corpo[k]).toBe(gravada[k]);
  expect(instante(corpo.dataCriacao)).toBe(instante(gravada.dataCriacao));
  expect(instante(corpo.dataPrevistaConclusao)).toBe(instante(gravada.dataPrevistaConclusao));
  for (const k of ['descricao', 'titulo', 'solicitante', 'autor']) expect(corpo).not.toHaveProperty(k);
}

beforeAll(registrarCredenciais);

describe('consulta pelo aplicativo', () => {
  it('CA21: consulta pelo Código devolve exatamente os sete campos gravados', async () => {
    const { codigo, gravada } = await abrir('Advertência', `ADV-${sufixo()}`);
    const r = await porCodigo(codigo);
    expect(r.status).toBe(200);
    conferirCampos(r.data, gravada);
  });

  it('CA22: consulta pelo par devolve os mesmos campos, inclusive com Origem em outra caixa/espaços', async () => {
    const id = `ADV-${sufixo()}`;
    const { gravada } = await abrir('Advertência', id);
    const exata = await porPar('Advertência', id);
    expect(exata.status).toBe(200);
    conferirCampos(exata.data, gravada);
    const variada = await porPar('  advertência ', id);
    expect(variada.status).toBe(200);
    conferirCampos(variada.data, gravada);
  });

  it('CA23: Código inexistente devolve 404 "Tratativa não encontrada."', async () => {
    const r = await porCodigo(randomUUID());
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Tratativa não encontrada.');
  });

  it('CA23: par inexistente devolve 404', async () => {
    const r = await porPar('Advertência', `INEXISTENTE-${sufixo()}`);
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Tratativa não encontrada.');
  });

  it('CA23: ID_Origem é comparado exato (outra caixa não encontra)', async () => {
    const id = `abc-${sufixo()}`;
    await abrir('Advertência', id);
    expect((await porPar('Advertência', id)).status).toBe(200);
    const r = await porPar('Advertência', id.toUpperCase());
    expect(r.status).toBe(404);
  });

  it('decisão 14: Código mal formado devolve 400 "Código inválido." com target codigo', async () => {
    const r = await porCodigo('abc');
    expect(r.status).toBe(400);
    expect(r.data.error.target).toBe('codigo');
    expect(r.data.error.message).toBe('Código inválido.');
  });

  it('N3-6: $metadata expõe ConsultaTratativa só com as sete propriedades', async () => {
    const r = await GET(`${BASE}/$metadata`, comoApp);
    expect(r.status).toBe(200);
    const xml = String(r.data);
    const tipo = xml.match(/<ComplexType Name="ConsultaTratativa">([\s\S]*?)<\/ComplexType>/);
    expect(tipo).not.toBeNull();
    const props = [...(tipo as RegExpMatchArray)[1].matchAll(/<Property Name="(\w+)"/g)].map((m) => m[1]);
    expect(props.sort()).toEqual([...CAMPOS].sort());
  });
});
