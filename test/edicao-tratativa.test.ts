import cds from '@sap/cds';
import { emitirAval, comoValidador } from './apoio/aval';
import { linhas } from './apoio/banco';
import { bloqueiaAntesDeEscrever, instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, editar, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
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

type Linha = Record<string, unknown>;
const editarComo = (codigo: string, corpo: Record<string, unknown>, como: unknown = comoGestor) =>
  editar(enviar, codigo, corpo, como);

// Avulsa Aberta com os campos informados; `status` diferente de Aberta é ajustado direto no banco (setup).
async function nova(dados: Record<string, unknown> = {}, status = 'Aberta'): Promise<string> {
  const r = await criarAvulsa(enviar, dados);
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  if (status !== 'Aberta') await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status }).where({ codigo }));
  return codigo;
}

const linha = async (codigo: string): Promise<Linha> => (await linhas('Tratativas', { codigo }))[0];
const historico = (codigo: string) => linhas('HistoricoTratativa', { tratativa_codigo: codigo });
const edicoes = async (codigo: string) => (await historico(codigo)).filter((h) => h.evento === 'Edicao');
const instante = (v: unknown) => new Date(v as string).getTime();
const consultar = (codigo: string) => GET(`${BASE}/consultarTratativa(codigo=${codigo})`, comoGestor);

// Estado observável de uma Tratativa: a linha inteira e a quantidade de histórico.
async function estado(codigo: string) {
  return { linha: await linha(codigo), historico: (await historico(codigo)).length };
}

// Pedido recusado: confere HTTP/target/mensagem e que nada mudou.
async function recusa(codigo: string, corpo: Record<string, unknown>, http: number, target?: string, trecho?: string) {
  const antes = await estado(codigo);
  const r = await editarComo(codigo, corpo);
  expect(r.status).toBe(http);
  if (target) expect(r.data.error.target).toBe(target);
  if (trecho) expect(r.data.error.message).toContain(trecho);
  expect(await estado(codigo)).toEqual(antes);
}

describe('edição aceita (R12)', () => {
  it('CA24: altera os cinco campos; a consulta devolve os novos e o filtro acha pela Unidade e Área novas', async () => {
    const s = sufixoUnico();
    const codigo = await nova({ unidade: 'Antiga', area: 'Antiga', solicitante: '111' });
    const novos = {
      titulo: `Novo título ${s}`,
      descricao: 'Nova descrição',
      unidade: `Planta Nova ${s}`,
      area: `Qualidade ${s}`,
      solicitante: '99999',
    };
    const r = await editarComo(codigo, novos);
    expect(r.status).toBe(204);
    const c = await consultar(codigo);
    expect(c.status).toBe(200);
    expect(c.data.titulo).toBe(novos.titulo);
    expect(c.data.descricao).toBe(novos.descricao);
    expect(c.data.unidade).toBe(novos.unidade);
    expect(c.data.area).toBe(novos.area);
    expect(c.data.solicitante).toBe(novos.solicitante);
    const filtro = `${BASE}/listarTratativas(unidade='${encodeURIComponent(novos.unidade.toUpperCase())}',area='${encodeURIComponent(novos.area.toUpperCase())}')`;
    const lista = await GET(filtro, comoUsuario);
    expect(lista.status).toBe(200);
    expect((lista.data.value as Linha[]).map((i) => i.codigo)).toEqual([codigo]);
  });

  it('CA25: unidade null e area só de espaços apagam', async () => {
    const codigo = await nova({ unidade: 'Planta A', area: 'Manutenção' });
    expect((await editarComo(codigo, { unidade: null })).status).toBe(204);
    expect((await editarComo(codigo, { area: '   ' })).status).toBe(204);
    const t = await linha(codigo);
    expect(t.unidade).toBeNull();
    expect(t.area).toBeNull();
  });

  it('CA32: reenviar os mesmos valores e corpo vazio → 204 sem histórico novo', async () => {
    const codigo = await nova({ unidade: 'Planta A', descricao: 'Texto' });
    const antes = await estado(codigo);
    expect((await editarComo(codigo, { titulo: 'Título avulso', unidade: 'Planta A', descricao: 'Texto' })).status).toBe(204);
    expect((await editarComo(codigo, {})).status).toBe(204);
    expect(await estado(codigo)).toEqual(antes);
  });
});

describe('validação (R12, R13)', () => {
  it.each([['null', null], ['espaços', '  ']])('CA26/CA47: titulo %s → 400 target titulo, mensagem cita Título', async (_n, valor) => {
    const codigo = await nova({ titulo: 'Título atual' });
    await recusa(codigo, { titulo: valor }, 400, 'titulo', 'Título');
    expect((await linha(codigo)).titulo).toBe('Título atual');
  });

  it.each([
    ['titulo', 201],
    ['descricao', 5001],
    ['unidade', 101],
    ['area', 101],
    ['solicitante', 51],
  ])('CA27: %s com %i caracteres → 400 com target do campo; nada muda', async (campo, tamanho) => {
    const codigo = await nova();
    await recusa(codigo, { [campo]: 'x'.repeat(tamanho) }, 400, campo);
  });

  it.each(['codigo', 'origem', 'idOrigem', 'dataCriacao', 'status', 'criticidade', 'dataPrevistaConclusao'])(
    'CA28/CA34: corpo com %s → 400 (campo desconhecido); nada muda',
    async (campo) => {
      const codigo = await nova();
      await recusa(codigo, { [campo]: 'x' }, 400);
    },
  );
});

describe('estado da Tratativa (R14)', () => {
  it.each([['Encerrada'], ['Cancelada']])('CA29: %s → 409 Tratativa <Status> não pode ser alterada.', async (status) => {
    const codigo = await nova({ titulo: 'Título atual' }, status);
    await recusa(codigo, { titulo: 'Outro' }, 409, undefined, `Tratativa ${status} não pode ser alterada.`);
    expect((await linha(codigo)).titulo).toBe('Título atual');
  });

  it('CA29: o estado vem antes do campo — Encerrada com Título de 201 caracteres também é 409', async () => {
    const codigo = await nova({}, 'Encerrada');
    const r = await editarComo(codigo, { titulo: 'x'.repeat(201) });
    expect(r.status).toBe(409);
    expect(r.data.error.message).toBe('Tratativa Encerrada não pode ser alterada.');
  });

  it('CA29: Tratativa inexistente → 404', async () => {
    const r = await editarComo('3f2b8c1e-9a4d-4e57-8b6a-1c2d3e4f5a6b', { titulo: 'x' });
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Tratativa não encontrada.');
  });
});

describe('histórico por campo (R15, R17)', () => {
  it('CA31: só a Unidade muda → uma linha Edicao com campo, valores, autor, tipo e instante', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const codigo = await nova({ unidade: 'Planta A' });
    expect((await editarComo(codigo, { unidade: 'Planta B' })).status).toBe(204);
    const eds = await edicoes(codigo);
    expect(eds).toHaveLength(1);
    expect(eds[0].campo).toBe('unidade');
    expect(eds[0].valorAnterior).toBe('Planta A');
    expect(eds[0].valorNovo).toBe('Planta B');
    expect(eds[0].autor).toBe('gestor');
    expect(eds[0].tipoAutor).toBe('Usuario');
    expect(instante(eds[0].quando)).toBe(new Date('2026-10-07T12:00:00-03:00').getTime());
  });

  it('CA33: Descrição alterada → linha campo descricao com valorAnterior e valorNovo null', async () => {
    const codigo = await nova({ descricao: 'Texto sigiloso antigo' });
    expect((await editarComo(codigo, { descricao: 'Texto sigiloso novo' })).status).toBe(204);
    const eds = await edicoes(codigo);
    expect(eds).toHaveLength(1);
    expect(eds[0].campo).toBe('descricao');
    expect(eds[0].valorAnterior).toBeNull();
    expect(eds[0].valorNovo).toBeNull();
  });

  it('CA35: avulsa sem Solicitante fica sem Solicitante; o Gestor o define e o histórico guarda a matrícula', async () => {
    const r = await criarAvulsa(enviar, {});
    expect(r.status).toBe(200);
    const codigo = r.data.codigo as string;
    const antes = await linha(codigo);
    expect(antes.solicitante).toBeNull();
    expect(antes.solicitante).not.toBe('usuario');
    expect((await editarComo(codigo, { solicitante: '12345' })).status).toBe(204);
    expect((await linha(codigo)).solicitante).toBe('12345');
    const eds = await edicoes(codigo);
    expect(eds).toHaveLength(1);
    expect(eds[0].campo).toBe('solicitante');
    expect(eds[0].valorAnterior).toBeNull();
    expect(eds[0].valorNovo).toBe('12345');
  });
});

describe('acesso (R8)', () => {
  it.each([
    ['CA17: usuário comum', comoUsuario, 403],
    ['CA18: aplicativo de origem', comoApp, 403],
    ['CA19: sem autenticação', semAuth, 401],
  ])('%s → acesso recusado (401/403) e nada muda', async (_nome, como, http) => {
    const codigo = await nova({ titulo: 'Título atual' });
    const antes = await estado(codigo);
    const r = await editarComo(codigo, { titulo: 'Invasão' }, como);
    expect(r.status).toBe(http);
    expect(await estado(codigo)).toEqual(antes);
  });
});

describe('serialização e atomicidade (R10, R21)', () => {
  it('CA72: editar e encerrar simultâneos → (204, 204) com a edição antes, ou (409, 204) sem edição', async () => {
    const codigo = await nova({ titulo: 'Título antigo' }, 'Em andamento');
    const aval = await emitirAval(
      enviar,
      codigo,
      { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada por verificacao independente.' },
      comoValidador,
    );
    expect(aval.status).toBe(204);
    const [ed, enc] = await Promise.all([
      editarComo(codigo, { titulo: 'Título novo' }),
      mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor),
    ]);
    expect(enc.status).toBe(204);
    expect((await linha(codigo)).status).toBe('Encerrada');
    const trans = (await historico(codigo)).filter((h) => h.evento === 'Encerramento');
    expect(trans).toHaveLength(1);
    if (ed.status === 204) {
      // a edição veio antes do encerramento
      expect((await linha(codigo)).titulo).toBe('Título novo');
      expect(await edicoes(codigo)).toHaveLength(1);
    } else {
      expect(ed.status).toBe(409);
      expect(ed.data.error.message).toBe('Tratativa Encerrada não pode ser alterada.');
      expect((await linha(codigo)).titulo).toBe('Título antigo');
      expect(await edicoes(codigo)).toHaveLength(0);
    }
  });

  it('D9: num editar isolado a primeira leitura de Tratativas é forUpdate e nada foi escrito antes', async () => {
    const codigo = await nova();
    espiao.limpar();
    const r = await editarComo(codigo, { titulo: 'Título novo' });
    expect(r.status).toBe(204);
    expect(bloqueiaAntesDeEscrever(espiao.comandos)).toBe(true);
  });

  it('CA74: falha ao gravar o histórico numa edição de Título e Unidade → ≥ 500 e nada muda', async () => {
    const codigo = await nova({ titulo: 'Título atual', unidade: 'Planta A' });
    const antes = await estado(codigo);
    espiao.falharEm('CREATE', HISTORICO);
    const r = await editarComo(codigo, { titulo: 'Título novo', unidade: 'Planta B' });
    espiao.naoFalhar();
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(await estado(codigo)).toEqual(antes);
  });
});
