import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { comoAdmin, comoApp, comoAppB, comoAppRevogado, semAuth } from './apoio/usuarios';

const { GET, POST, PATCH } = cds.test(__dirname + '/..');
const BASE = '/api/integracao-origem/v1';
const ADMIN = '/api/administracao/v1';

jest.setTimeout(60000);

let contador = 0;
const sufixo = () => `${Date.now()}-${++contador}`;
type Opcoes = typeof comoApp | typeof semAuth;

const corpoAbertura = (idOrigem: string) => ({
  origem: 'Advertência',
  idOrigem,
  titulo: 'Título sigiloso',
  criticidade: 'Alta',
  descricao: 'Descrição sigilosa',
  solicitante: 'fulano.solicitante',
});
const abrir = (idOrigem: string, opcoes: Opcoes) => POST(`${BASE}/abrirTratativa`, corpoAbertura(idOrigem), opcoes);
const porCodigo = (codigo: string, opcoes: Opcoes) => GET(`${BASE}/consultarPorCodigo(codigo=${codigo})`, opcoes);
const porPar = (origem: string, idOrigem: string, opcoes: Opcoes) =>
  GET(
    `${BASE}/consultarPorOrigem(origem='${encodeURIComponent(origem)}',idOrigem='${encodeURIComponent(idOrigem)}')`,
    opcoes,
  );
const total = async () => (await linhas('Tratativas')).length;

// O CAP 10.1.1 responde todo 401 com `Unauthorized`; nenhuma mensagem própria é afirmada.
function esperar401(r: { status: number; data: unknown }) {
  expect(r.status).toBe(401);
  expect(String(r.data)).toBe('Unauthorized');
}

let existente: { codigo: string; origem: string; idOrigem: string; gravada: Record<string, unknown> };

function semDadosDaTratativa(r: { data: unknown }) {
  const texto = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
  const g = existente.gravada;
  const valores = [existente.codigo, existente.origem, existente.idOrigem, g.criticidade, g.dataCriacao, g.dataPrevistaConclusao];
  for (const v of valores) expect(texto).not.toContain(String(v));
}

beforeAll(async () => {
  await registrarCredenciais();
  const idOrigem = `ADV-${sufixo()}`;
  const r = await abrir(idOrigem, comoApp);
  expect(r.status).toBe(200);
  const [gravada] = await linhas('Tratativas', { codigo: r.data.codigo });
  existente = { codigo: r.data.codigo, origem: 'Advertência', idOrigem, gravada };
});


describe('credencial revogável de aplicativo (R18)', () => {
  it('CA19/CA20: sem autenticação, abertura e consultas respondem 401 Unauthorized sem dados', async () => {
    const antes = await total();
    const a = await abrir(`ADV-${sufixo()}`, semAuth);
    esperar401(a);
    const c = await porCodigo(existente.codigo, semAuth);
    esperar401(c);
    semDadosDaTratativa(c);
    const p = await porPar(existente.origem, existente.idOrigem, semAuth);
    esperar401(p);
    semDadosDaTratativa(p);
    expect(await total()).toBe(antes);
  });

  it('CA32: app-revogado não abre Tratativa e nada é gravado', async () => {
    const antes = await total();
    const r = await abrir(`ADV-${sufixo()}`, comoAppRevogado);
    esperar401(r);
    expect(await total()).toBe(antes);
  });

  it('CA32: app-revogado não consulta por Código nem por par, e a resposta não revela a Tratativa', async () => {
    const c = await porCodigo(existente.codigo, comoAppRevogado);
    esperar401(c);
    semDadosDaTratativa(c);
    const p = await porPar(existente.origem, existente.idOrigem, comoAppRevogado);
    esperar401(p);
    semDadosDaTratativa(p);
  });

  it('revogação em tempo de execução: o pedido seguinte à revogação pelo Administrador é recusado', async () => {
    expect((await abrir(`ADV-${sufixo()}`, comoAppB)).status).toBe(200);
    expect((await porCodigo(existente.codigo, comoAppB)).status).toBe(200);

    const rev = await PATCH(`${ADMIN}/CredenciaisAplicativo('app-origem-b')`, { ativa: false }, comoAdmin);
    expect(rev.status).toBe(200);

    const antes = await total();
    esperar401(await abrir(`ADV-${sufixo()}`, comoAppB));
    const c = await porCodigo(existente.codigo, comoAppB);
    esperar401(c);
    semDadosDaTratativa(c);
    esperar401(await porPar(existente.origem, existente.idOrigem, comoAppB));
    expect(await total()).toBe(antes);
  });

  // Por último: apaga a linha de app-origem-b (o banco em memória é por arquivo).
  it('aplicativo com o papel, mas sem registro em CredenciaisAplicativo, é recusado', async () => {
    await registrarCredenciais(); // app-origem-b ativa de novo
    expect((await abrir(`ADV-${sufixo()}`, comoAppB)).status).toBe(200);

    await cds.db.run(DELETE.from('br.com.calazanstec.CredenciaisAplicativo').where({ usuarioTecnico: 'app-origem-b' }));

    const antes = await total();
    esperar401(await abrir(`ADV-${sufixo()}`, comoAppB));
    const c = await porCodigo(existente.codigo, comoAppB);
    esperar401(c);
    semDadosDaTratativa(c);
    esperar401(await porPar(existente.origem, existente.idOrigem, comoAppB));
    expect(await total()).toBe(antes);
  });
});
