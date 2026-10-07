import cds from '@sap/cds';
import { comoAdmin, comoApp, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST, PATCH, DELETE } = cds.test(__dirname + '/..');
const ADMIN = '/api/administracao/v1';

jest.setTimeout(60000); // a primeira subida do runtime CAP pode passar de 5 s

type Prazo = { criticidade: string; dias: number };
const lerPrazos = async () => {
  const { data, status } = await GET(`${ADMIN}/PrazosCriticidade`, comoAdmin);
  expect(status).toBe(200);
  return Object.fromEntries((data.value as Prazo[]).map((p) => [p.criticidade, p.dias]));
};

describe('administração: prazos por Criticidade (R10, R11, CA10)', () => {
  it('R10: valores iniciais 3/7/15/30 lidos pelo Administrador', async () => {
    expect(await lerPrazos()).toEqual({ 'Crítica': 3, Alta: 7, 'Média': 15, Baixa: 30 });
  });

  it('R11: Administrador altera os dias de uma Criticidade', async () => {
    const r = await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias: 5 }, comoAdmin);
    expect(r.status).toBe(200);
    expect((await lerPrazos()).Alta).toBe(5);
    await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias: 7 }, comoAdmin);
  });

  it('CA10: usuário comum, aplicativo e anônimo não alteram prazos', async () => {
    const antes = await lerPrazos();
    expect((await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias: 1 }, comoUsuario)).status).toBe(403);
    expect((await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias: 1 }, comoApp)).status).toBe(403);
    expect((await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias: 1 }, semAuth)).status).toBe(401);
    expect(await lerPrazos()).toEqual(antes);
  });

  it('R7: a lista de Criticidades é fixa (POST e DELETE recusados)', async () => {
    const post = await POST(`${ADMIN}/PrazosCriticidade`, { criticidade: 'Baixa', dias: 1 }, comoAdmin);
    expect(post.status).toBeGreaterThanOrEqual(400);
    expect(post.status).toBeLessThan(500);
    const del = await DELETE(`${ADMIN}/PrazosCriticidade('Baixa')`, comoAdmin);
    expect(del.status).toBeGreaterThanOrEqual(400);
    expect(del.status).toBeLessThan(500);
    expect((await lerPrazos()).Baixa).toBe(30);
  });
});

describe('administração: credenciais de aplicativo (R18)', () => {
  it('Administrador emite e revoga a credencial', async () => {
    const emissao = await POST(`${ADMIN}/CredenciaisAplicativo`, { usuarioTecnico: 'app-novo' }, comoAdmin);
    expect(emissao.status).toBe(201);
    expect(emissao.data.ativa).toBe(true);
    const revogacao = await PATCH(`${ADMIN}/CredenciaisAplicativo('app-novo')`, { ativa: false }, comoAdmin);
    expect(revogacao.status).toBe(200);
    expect(revogacao.data.ativa).toBe(false);
  });

  it('usuário comum não emite credencial', async () => {
    const r = await POST(`${ADMIN}/CredenciaisAplicativo`, { usuarioTecnico: 'app-negado' }, comoUsuario);
    expect(r.status).toBe(403);
  });
});
