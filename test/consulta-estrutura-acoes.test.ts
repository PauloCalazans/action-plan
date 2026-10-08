import cds from '@sap/cds';
import { consultarAcao, consultarEstruturaAcoes, criarAcao, criarSubacao, type Consulta } from './apoio/acoes';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const enviar = POST as unknown as Envia;
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const HOJE = '2026-10-08';
const PRAZO = '2026-11-07';
const APP_BASE = '/api/integracao-origem/v1';

jest.setTimeout(60000);

beforeAll(async () => {
  await registrarCredenciais();
});
beforeEach(() => fixarInstante(`${HOJE}T12:00:00Z`));
afterEach(() => liberarRelogio());

// Move o relógio para o segundo pedido; cada criação ganha um criadoEm distinto (ordenação por CA79/CA82).
const em = (segundo: number) => fixarInstante(`${HOJE}T12:00:${String(segundo).padStart(2, '0')}Z`);

const dados = (descricao: string, extra: Record<string, unknown> = {}) => ({
  descricao,
  responsavel: 'M1001',
  prazo: PRAZO,
  ...extra,
});

// Tratativa avulsa Aberta criada no instante atual do relógio fixo.
async function nova(): Promise<string> {
  const r = await criarAvulsa(enviar);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

// Item de Ação na resposta (estrutura ou detalhe); tipado solto porque o contrato é checado campo a campo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Acao = Record<string, any>;

const CAMPOS_ACAO = ['codigo', 'descricao', 'responsavel', 'prazo', 'prioridade', 'status', 'evidenciaObrigatoria', 'dataConclusao'];

describe('consulta da estrutura hierárquica de Ações (R25)', () => {
  it('CA2: Tratativa sem Ações → consultarEstruturaAcoes devolve lista vazia', async () => {
    const t = await nova();
    const r = await consultarEstruturaAcoes(consultar, t, comoGestor);
    expect(r.status).toBe(200);
    expect(r.data.value).toEqual([]);
  });

  it('CA79: Ação 1 com Subações 1.1 e 1.2 aninhadas e Ação 2 sem filhas, na ordem de criação', async () => {
    const t = await nova();
    em(1);
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);
    em(2);
    const s11 = await criarSubacao(enviar, t, dados('Subação 1.1', { acaoMae: a1.data.codigo }), comoGestor);
    expect(s11.status).toBe(200);
    em(3);
    const s12 = await criarSubacao(enviar, t, dados('Subação 1.2', { acaoMae: a1.data.codigo }), comoGestor);
    expect(s12.status).toBe(200);
    em(4);
    const a2 = await criarAcao(enviar, t, dados('Ação 2'), comoGestor);
    expect(a2.status).toBe(200);

    const r = await consultarEstruturaAcoes(consultar, t, comoGestor);
    expect(r.status).toBe(200);
    const itens = r.data.value as Acao[];
    expect(itens.map((i) => i.codigo)).toEqual([a1.data.codigo, a2.data.codigo]);
    expect(itens[0].subacoes.map((s: Acao) => s.codigo)).toEqual([s11.data.codigo, s12.data.codigo]);
    expect(itens[0].subacoes[0].descricao).toBe('Subação 1.1');
    expect(itens[1].subacoes).toEqual([]);
  });

  it('CA80: consultarAcao de Ação traz os campos, acaoMae null e Subações; de Subação traz o código da mãe', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);
    const s11 = await criarSubacao(
      enviar,
      t,
      dados('Subação 1.1', { acaoMae: a1.data.codigo, evidenciaObrigatoria: 'sim', prioridade: 'Alta' }),
      comoGestor,
    );
    expect(s11.status).toBe(200);

    const mae = await consultarAcao(consultar, t, a1.data.codigo, comoGestor);
    expect(mae.status).toBe(200);
    for (const campo of CAMPOS_ACAO) expect(mae.data).toHaveProperty(campo);
    expect(mae.data.codigo).toBe(a1.data.codigo);
    expect(mae.data.descricao).toBe('Ação 1');
    expect(mae.data.status).toBe('Pendente');
    expect(mae.data.prazo).toBe(PRAZO);
    expect(mae.data.prioridade).toBe('Média');
    expect(mae.data.evidenciaObrigatoria).toBe('não');
    expect(mae.data.dataConclusao).toBeNull();
    expect(mae.data.acaoMae).toBeNull();
    expect(mae.data.subacoes.map((s: Acao) => s.codigo)).toEqual([s11.data.codigo]);

    const sub = await consultarAcao(consultar, t, s11.data.codigo, comoGestor);
    expect(sub.status).toBe(200);
    expect(sub.data.codigo).toBe(s11.data.codigo);
    expect(sub.data.acaoMae).toBe(a1.data.codigo);
    expect(sub.data.prioridade).toBe('Alta');
    expect(sub.data.evidenciaObrigatoria).toBe('sim');
    expect(sub.data.subacoes).toEqual([]);
  });

  it('CA81: Tratativa inexistente → 404 "Tratativa não encontrada."; Ação inexistente ou de outra Tratativa → 404 "Ação não encontrada."', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);
    const outra = await nova();

    const semTratativa = await consultarEstruturaAcoes(consultar, UUID_INEXISTENTE, comoGestor);
    expect(semTratativa.status).toBe(404);
    expect(semTratativa.data.error.message).toBe('Tratativa não encontrada.');

    const acaoDeOutraTratativa = await consultarAcao(consultar, outra, a1.data.codigo, comoGestor);
    expect(acaoDeOutraTratativa.status).toBe(404);
    expect(acaoDeOutraTratativa.data.error.message).toBe('Ação não encontrada.');

    const acaoInexistente = await consultarAcao(consultar, t, UUID_INEXISTENTE, comoGestor);
    expect(acaoInexistente.status).toBe(404);
    expect(acaoInexistente.data.error.message).toBe('Ação não encontrada.');

    const tratativaInexistente = await consultarAcao(consultar, UUID_INEXISTENTE, a1.data.codigo, comoGestor);
    expect(tratativaInexistente.status).toBe(404);
    expect(tratativaInexistente.data.error.message).toBe('Tratativa não encontrada.');
  });

  it('CA82: ordenação por criadoEm ASC e, em empate de instante, por codigo ASC', async () => {
    const t = await nova();
    em(10);
    const primeira = await criarAcao(enviar, t, dados('Primeira'), comoGestor);
    em(11);
    const segunda = await criarAcao(enviar, t, dados('Segunda'), comoGestor);
    em(12);
    const terceira = await criarAcao(enviar, t, dados('Terceira'), comoGestor);
    expect([primeira.status, segunda.status, terceira.status]).toEqual([200, 200, 200]);

    const ordem = await consultarEstruturaAcoes(consultar, t, comoGestor);
    expect(ordem.status).toBe(200);
    expect((ordem.data.value as Acao[]).map((i) => i.codigo)).toEqual([
      primeira.data.codigo,
      segunda.data.codigo,
      terceira.data.codigo,
    ]);

    const mesmoInstante = await nova();
    em(20);
    const x = await criarAcao(enviar, mesmoInstante, dados('X'), comoGestor);
    const y = await criarAcao(enviar, mesmoInstante, dados('Y'), comoGestor);
    expect([x.status, y.status]).toEqual([200, 200]);
    const empate = await consultarEstruturaAcoes(consultar, mesmoInstante, comoGestor);
    expect(empate.status).toBe(200);
    const esperado = [x.data.codigo as string, y.data.codigo as string].sort();
    expect((empate.data.value as Acao[]).map((i) => i.codigo)).toEqual(esperado);
  });

  it('CA83: usuário autenticado sem papel Gestor vê responsavel null em todos os níveis, na estrutura e no detalhe', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);
    const s11 = await criarSubacao(enviar, t, dados('Subação 1.1', { acaoMae: a1.data.codigo }), comoGestor);
    expect(s11.status).toBe(200);

    const estrutura = await consultarEstruturaAcoes(consultar, t, comoUsuario);
    expect(estrutura.status).toBe(200);
    const item = (estrutura.data.value as Acao[])[0];
    expect(item.responsavel).toBeNull();
    expect(item.subacoes[0].responsavel).toBeNull();

    const detalhe = await consultarAcao(consultar, t, a1.data.codigo, comoUsuario);
    expect(detalhe.status).toBe(200);
    expect(detalhe.data.responsavel).toBeNull();
    expect(detalhe.data.subacoes[0].responsavel).toBeNull();
  });

  it('CA84: GestorTratativa vê o responsavel preenchido com a matrícula em todos os níveis', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1', { responsavel: 'M7007' }), comoGestor);
    expect(a1.status).toBe(200);
    const s11 = await criarSubacao(
      enviar,
      t,
      dados('Subação 1.1', { acaoMae: a1.data.codigo, responsavel: 'M8008' }),
      comoGestor,
    );
    expect(s11.status).toBe(200);

    const estrutura = await consultarEstruturaAcoes(consultar, t, comoGestor);
    expect(estrutura.status).toBe(200);
    const item = (estrutura.data.value as Acao[])[0];
    expect(item.responsavel).toBe('M7007');
    expect(item.subacoes[0].responsavel).toBe('M8008');

    const detalhe = await consultarAcao(consultar, t, a1.data.codigo, comoGestor);
    expect(detalhe.status).toBe(200);
    expect(detalhe.data.responsavel).toBe('M7007');
    expect(detalhe.data.subacoes[0].responsavel).toBe('M8008');
  });

  it('CA61/CA62 (consulta): aplicativo de origem → 403 e anônimo → 401 em estrutura e em Ação', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);

    expect((await consultarEstruturaAcoes(consultar, t, comoApp)).status).toBe(403);
    expect((await consultarAcao(consultar, t, a1.data.codigo, comoApp)).status).toBe(403);
    expect((await consultarEstruturaAcoes(consultar, t, semAuth)).status).toBe(401);
    expect((await consultarAcao(consultar, t, a1.data.codigo, semAuth)).status).toBe(401);
  });

  it('CA85: consulta do aplicativo (/v1) segue com sete campos e sem nada sobre Ações', async () => {
    const t = (await abrirPorApp(enviar)).data.codigo as string;
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);
    await criarSubacao(enviar, t, dados('Subação 1.1', { acaoMae: a1.data.codigo }), comoGestor);

    const r = await GET(`${APP_BASE}/consultarPorCodigo(codigo=${t})`, comoApp);
    expect(r.status).toBe(200);
    const campos = Object.keys(r.data).filter((k) => !k.startsWith('@')).sort();
    expect(campos).toEqual(
      ['codigo', 'origem', 'idOrigem', 'criticidade', 'status', 'dataCriacao', 'dataPrevistaConclusao'].sort(),
    );
    expect(Object.keys(r.data).some((k) => /acao|subac/i.test(k))).toBe(false);
  });

  it('CA103: consulta de Subação traz o código da mãe; parâmetros ausentes → 400 citando o campo', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);
    const s11 = await criarSubacao(enviar, t, dados('Subação 1.1', { acaoMae: a1.data.codigo }), comoGestor);
    expect(s11.status).toBe(200);

    const sub = await consultarAcao(consultar, t, s11.data.codigo, comoGestor);
    expect(sub.status).toBe(200);
    expect(sub.data.acaoMae).toBe(a1.data.codigo);

    const semTratativaEstrutura = await consultarEstruturaAcoes(consultar, null, comoGestor);
    expect(semTratativaEstrutura.status).toBe(400);
    expect(semTratativaEstrutura.data.error.target).toBe('tratativa');
    expect(semTratativaEstrutura.data.error.message).toBe('O campo Tratativa é obrigatório.');

    const semTratativa = await consultarAcao(consultar, null, a1.data.codigo, comoGestor);
    expect(semTratativa.status).toBe(400);
    expect(semTratativa.data.error.target).toBe('tratativa');
    expect(semTratativa.data.error.message).toBe('O campo Tratativa é obrigatório.');

    const semCodigo = await consultarAcao(consultar, t, null, comoGestor);
    expect(semCodigo.status).toBe(400);
    expect(semCodigo.data.error.target).toBe('codigo');
    expect(semCodigo.data.error.message).toBe('O campo Código é obrigatório.');
  });

  it('CA103: código malformado → 400 "Código inválido." com target correspondente', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);

    const tratativaMalformada = await consultarEstruturaAcoes(consultar, 'xyz', comoGestor);
    expect(tratativaMalformada.status).toBe(400);
    expect(tratativaMalformada.data.error.target).toBe('tratativa');
    expect(tratativaMalformada.data.error.message).toBe('Código inválido.');

    const tratativaMalformadaAcao = await consultarAcao(consultar, 'xyz', a1.data.codigo, comoGestor);
    expect(tratativaMalformadaAcao.status).toBe(400);
    expect(tratativaMalformadaAcao.data.error.target).toBe('tratativa');
    expect(tratativaMalformadaAcao.data.error.message).toBe('Código inválido.');

    const codigoMalformado = await consultarAcao(consultar, t, 'abc', comoGestor);
    expect(codigoMalformado.status).toBe(400);
    expect(codigoMalformado.data.error.target).toBe('codigo');
    expect(codigoMalformado.data.error.message).toBe('Código inválido.');
  });

  it('M-c: chaves em maiúsculas são aceitas na estrutura e no detalhe', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, dados('Ação 1'), comoGestor);
    expect(a1.status).toBe(200);

    const estrutura = await consultarEstruturaAcoes(consultar, t.toUpperCase(), comoGestor);
    expect(estrutura.status).toBe(200);
    expect(estrutura.data.value).toHaveLength(1);

    const detalhe = await consultarAcao(consultar, t.toUpperCase(), (a1.data.codigo as string).toUpperCase(), comoGestor);
    expect(detalhe.status).toBe(200);
    expect(detalhe.data.codigo).toBe(a1.data.codigo);
  });
});
