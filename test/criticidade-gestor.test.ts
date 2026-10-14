import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { bloqueiaAntesDeEscrever, instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { encerrarComAval } from './apoio/encerramento';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarCriticidade, mudarStatus, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const HISTORICO = 'br.com.calazanstec.HistoricoTratativa';
const MSG_INVALIDA = 'Criticidade inválida: use Baixa, Média, Alta ou Crítica.';

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
const mudar = (codigo: string, corpo: Record<string, unknown>, como: unknown = comoGestor) =>
  mudarCriticidade(enviar, codigo, corpo, como);

// Regra interna do 002; toda chamada é uma promessa asserida por quem chama (M13).
const interno = (codigo: string, criticidade: string, autor: string, tipoAutor: string) =>
  cds.connect.to('TratativaInternaService').then((s) => s.send('alterarCriticidade', { codigo, criticidade, autor, tipoAutor }));

async function nova(criticidade = 'Baixa', status = 'Aberta'): Promise<string> {
  const r = await criarAvulsa(enviar, { criticidade });
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  if (status !== 'Aberta') await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status }).where({ codigo }));
  return codigo;
}

const linha = async (codigo: string): Promise<Linha> => (await linhas('Tratativas', { codigo }))[0];
const historico = (codigo: string) => linhas('HistoricoTratativa', { tratativa_codigo: codigo });
const alteracoes = async (codigo: string) => (await historico(codigo)).filter((h) => h.evento === 'AlteracaoCriticidade');
const instante = (v: unknown) => new Date(v as string).getTime();
const estado = async (codigo: string) => ({ linha: await linha(codigo), historico: (await historico(codigo)).length });

describe('alteração pelo Gestor (R18)', () => {
  it('CA36: Baixa → Crítica recalcula a Data prevista e grava duas linhas de histórico com autor gestor', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const codigo = await nova('Baixa');
    fixarInstante('2026-10-20T10:00:00-03:00');
    const r = await mudar(codigo, { criticidade: 'Crítica' });
    expect(r.status).toBe(204);
    const t = await linha(codigo);
    expect(t.criticidade).toBe('Crítica');
    expect(t.dataPrevistaConclusao).toBe('2026-10-10');
    const hist = await alteracoes(codigo);
    expect(hist).toHaveLength(2);
    const porCampo = Object.fromEntries(hist.map((h) => [h.campo as string, h]));
    expect(porCampo.criticidade.valorAnterior).toBe('Baixa');
    expect(porCampo.criticidade.valorNovo).toBe('Crítica');
    expect(porCampo.dataPrevistaConclusao.valorAnterior).toBe('2026-11-06');
    expect(porCampo.dataPrevistaConclusao.valorNovo).toBe('2026-10-10');
    for (const h of hist) {
      expect(h.autor).toBe('gestor');
      expect(h.tipoAutor).toBe('Usuario');
      expect(instante(h.quando)).toBe(new Date('2026-10-20T10:00:00-03:00').getTime());
    }
  });

  it('CA37: Tratativa Em andamento aceita a alteração', async () => {
    const codigo = await nova('Baixa', 'Em andamento');
    expect((await mudar(codigo, { criticidade: 'Alta' })).status).toBe(204);
    expect((await linha(codigo)).criticidade).toBe('Alta');
  });

  it('CA38: mesma Criticidade → 204 e nenhuma linha de histórico', async () => {
    const codigo = await nova('Alta');
    const antes = await estado(codigo);
    expect((await mudar(codigo, { criticidade: 'Alta' })).status).toBe(204);
    expect(await estado(codigo)).toEqual(antes);
  });
});

describe('acesso (R8)', () => {
  it.each([
    ['CA39: usuário comum', comoUsuario],
    ['CA18: aplicativo de origem', comoApp],
    ['CA19: sem autenticação', semAuth],
  ])('%s → acesso recusado (401/403) e a Criticidade permanece', async (_nome, como) => {
    const codigo = await nova('Baixa');
    const antes = await estado(codigo);
    const r = await mudar(codigo, { criticidade: 'Crítica' }, como);
    expect(r.status).toBe(como === semAuth ? 401 : 403);
    expect(await estado(codigo)).toEqual(antes);
  });
});

describe('validação e estado (R14, R19)', () => {
  it.each([
    ['CA40: Urgente', { criticidade: 'Urgente' }],
    ['CA41: sem criticidade', {}],
  ])('%s → 400 com a mensagem do contrato e target criticidade; nada gravado', async (_nome, corpo) => {
    const codigo = await nova('Alta');
    const antes = await estado(codigo);
    const r = await mudar(codigo, corpo);
    expect(r.status).toBe(400);
    expect(r.data.error.message).toBe(MSG_INVALIDA);
    expect(r.data.error.target).toBe('criticidade');
    expect(await estado(codigo)).toEqual(antes);
  });

  it.each([['Cancelada'], ['Encerrada']])('CA30: %s → 409 Tratativa <Status> não pode ser alterada.', async (status) => {
    const codigo = await nova('Alta', status);
    const antes = await estado(codigo);
    const r = await mudar(codigo, { criticidade: 'Crítica' });
    expect(r.status).toBe(409);
    expect(r.data.error.message).toBe(`Tratativa ${status} não pode ser alterada.`);
    expect(await estado(codigo)).toEqual(antes);
  });

  it('CA30: o estado vem antes do campo — Cancelada com Urgente também é 409', async () => {
    const codigo = await nova('Alta', 'Cancelada');
    const r = await mudar(codigo, { criticidade: 'Urgente' });
    expect(r.status).toBe(409);
    expect(r.data.error.message).toBe('Tratativa Cancelada não pode ser alterada.');
  });
});

describe('regra interna do 002 (R20)', () => {
  it('CA42/CA47: tipoAutor Robô → 400, target tipoAutor, mensagem cita Tipo de autor; nada gravado', async () => {
    const codigo = await nova('Baixa');
    const antes = await estado(codigo);
    await expect(interno(codigo, 'Alta', 'sistema-teste', 'Robô')).rejects.toMatchObject({
      status: 400,
      target: 'tipoAutor',
      message: expect.stringContaining('Tipo de autor'),
    });
    expect(await estado(codigo)).toEqual(antes);
  });

  it.each([[''], ['  ']])('CA43/CA47: autor %j → 400, target autor, mensagem cita Autor; nada gravado', async (autor) => {
    const codigo = await nova('Baixa');
    const antes = await estado(codigo);
    await expect(interno(codigo, 'Alta', autor, 'Sistema')).rejects.toMatchObject({
      status: 400,
      target: 'autor',
      message: expect.stringContaining('Autor'),
    });
    expect(await estado(codigo)).toEqual(antes);
  });

  it('CA44: tipo Sistema com autor válido é aceito e o histórico guarda o tipo Sistema', async () => {
    const codigo = await nova('Baixa');
    await expect(interno(codigo, 'Alta', 'sistema-teste', 'Sistema')).resolves.toBeUndefined();
    const hist = await alteracoes(codigo);
    expect(hist).toHaveLength(2);
    for (const h of hist) {
      expect(h.tipoAutor).toBe('Sistema');
      expect(h.autor).toBe('sistema-teste');
    }
  });

  it.each([['Encerrada'], ['Cancelada']])('CA76: Tratativa %s com autor Sistema → 409; nada gravado', async (status) => {
    const codigo = await nova('Alta', status);
    const antes = await estado(codigo);
    await expect(interno(codigo, 'Crítica', 'sistema-teste', 'Sistema')).rejects.toMatchObject({
      status: 409,
      message: `Tratativa ${status} não pode ser alterada.`,
    });
    expect(await estado(codigo)).toEqual(antes);
  });
});

describe('serialização e atomicidade (R10, R21)', () => {
  it('CA45: Alta e Crítica simultâneas → duas 204, estado coerente e quatro linhas em cadeia', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const codigo = await nova('Baixa');
    const [a, b] = await Promise.all([mudar(codigo, { criticidade: 'Alta' }), mudar(codigo, { criticidade: 'Crítica' })]);
    expect([a.status, b.status]).toEqual([204, 204]);

    const t = await linha(codigo);
    expect(['Alta', 'Crítica']).toContain(t.criticidade);
    expect(t.dataPrevistaConclusao).toBe(t.criticidade === 'Alta' ? '2026-10-14' : '2026-10-10');

    const hist = await alteracoes(codigo);
    expect(hist).toHaveLength(4);
    const crit = hist.filter((h) => h.campo === 'criticidade');
    const datas = hist.filter((h) => h.campo === 'dataPrevistaConclusao');
    expect(crit).toHaveLength(2);
    expect(datas).toHaveLength(2);
    const [c1, c2] = crit[0].valorAnterior === 'Baixa' ? crit : [crit[1], crit[0]];
    expect(c1.valorAnterior).toBe('Baixa');
    expect(c2.valorAnterior).toBe(c1.valorNovo);
    expect(c2.valorNovo).toBe(t.criticidade);
    const [d1, d2] = datas[0].valorAnterior === '2026-11-06' ? datas : [datas[1], datas[0]];
    expect(d1.valorAnterior).toBe('2026-11-06');
    expect(d2.valorAnterior).toBe(d1.valorNovo);
    expect(d2.valorNovo).toBe(t.dataPrevistaConclusao);
  });

  it('D9: mudarCriticidade isolado e chamada isolada da regra interna bloqueiam antes de escrever', async () => {
    const pelaApi = await nova('Baixa');
    espiao.limpar();
    expect((await mudar(pelaApi, { criticidade: 'Alta' })).status).toBe(204);
    expect(bloqueiaAntesDeEscrever(espiao.comandos)).toBe(true);

    const pelaRegra = await nova('Baixa');
    espiao.limpar();
    await expect(interno(pelaRegra, 'Alta', 'sistema-teste', 'Sistema')).resolves.toBeUndefined();
    expect(bloqueiaAntesDeEscrever(espiao.comandos)).toBe(true);
  });

  it('CA75: falha ao gravar o histórico → ≥ 500; Criticidade e Data prevista inalteradas', async () => {
    const codigo = await nova('Baixa');
    const antes = await estado(codigo);
    espiao.falharEm('CREATE', HISTORICO);
    const r = await mudar(codigo, { criticidade: 'Crítica' });
    espiao.naoFalhar();
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(await estado(codigo)).toEqual(antes);
  });
});

describe('fronteira com o ciclo de vida', () => {
  it('Tratativa encerrada pelo Gestor e depois reaberta aceita nova Criticidade', async () => {
    const codigo = await nova('Baixa');
    expect((await encerrarComAval(enviar, codigo)).status).toBe(204);
    expect((await mudar(codigo, { criticidade: 'Alta' })).status).toBe(409);
    expect((await mudarStatus(enviar, codigo, { status: 'Em andamento', justificativa: 'reabrir' }, comoGestor)).status).toBe(204);
    expect((await mudar(codigo, { criticidade: 'Alta' })).status).toBe(204);
  });
});
