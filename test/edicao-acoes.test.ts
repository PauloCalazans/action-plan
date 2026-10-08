import cds from '@sap/cds';
import { criarAcao, editarAcao, mudarStatusAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { POST, DELETE } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const BASE = '/api/tratativa/v1';
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const HOJE = '2026-10-08';
const PRAZO = '2026-11-07';
const PRAZO_NOVO = '2026-12-01';

jest.setTimeout(60000);

let espiao: Espiao;
beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});
beforeEach(() => fixarInstante(`${HOJE}T12:00:00Z`));
afterEach(() => {
  liberarRelogio();
  espiao.naoFalhar();
});

// Tipado solto: as linhas do banco têm campos de tipos variados; cada teste confere o campo que usa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Linha = Record<string, any>;

const dados = (descricao: string, extra: Record<string, unknown> = {}) => ({
  descricao,
  responsavel: 'M1001',
  prazo: PRAZO,
  ...extra,
});

// Tratativa avulsa; com status diferente de Aberta, leva direto ao status pedido (setup no banco).
async function nova(status = 'Aberta'): Promise<string> {
  const r = await criarAvulsa(enviar);
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  if (status !== 'Aberta') await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status }).where({ codigo }));
  return codigo;
}

const acaoDe = async (codigo: string): Promise<Linha> => (await linhas('Acoes', { codigo }))[0];
const statusAcao = async (codigo: string) => (await acaoDe(codigo)).status;
const historicoAcao = (acao: string): Promise<Linha[]> => linhas('HistoricoAcoes', { acao_codigo: acao });
const edicoes = async (acao: string) => (await historicoAcao(acao)).filter((l) => l.evento === 'Edicao');
const dataCivil = (v: unknown) => new Date(v as string).toISOString().slice(0, 10);
const em = (dia: string) => fixarInstante(`${dia}T12:00:00Z`);

// Ação Pendente criada pelo Gestor (setup pelo próprio pedido de criação).
async function acao(t: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAcao(enviar, t, dados('Ação', extra), comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

// Pedido de edição pelo Gestor (ou como indicado).
const editar = (t: string, acaoCodigo: unknown, corpo: Record<string, unknown>, como: unknown = comoGestor) =>
  editarAcao(enviar, t, { acao: acaoCodigo, ...corpo }, como);

// Retrato dos campos editáveis e do Responsável, para provar que nada mudou depois de uma recusa.
async function foto(codigo: string) {
  const l = await acaoDe(codigo);
  return {
    descricao: l.descricao,
    prazo: dataCivil(l.prazo),
    prioridade: l.prioridade,
    evidenciaObrigatoria: Boolean(l.evidenciaObrigatoria),
    responsavel: l.responsavel,
    status: l.status,
  };
}

// Pedido recusado: confere HTTP, mensagem, target, e que nenhum campo nem o histórico mudaram.
async function recusaEdicao(
  t: string,
  acaoCodigo: string,
  corpo: Record<string, unknown>,
  http: number,
  target: string,
  mensagem: string,
) {
  const antes = await foto(acaoCodigo);
  const historico = (await historicoAcao(acaoCodigo)).length;
  const r = await editar(t, acaoCodigo, corpo);
  expect(r.status).toBe(http);
  expect(r.data.error.target).toBe(target);
  expect(r.data.error.message).toBe(mensagem);
  expect(await foto(acaoCodigo)).toEqual(antes);
  expect((await historicoAcao(acaoCodigo)).length).toBe(historico);
}

describe('edição de Ações (R5, R19, R20, R28)', () => {
  it('CA20/CA21: reenviar o mesmo Prazo já passado não revalida contra hoje; atraso não muda o Status', async () => {
    em('2026-10-08');
    const t = await nova();
    const a = await acao(t, { prazo: '2026-10-10' });
    em('2026-10-20');
    const r = await editar(t, a, { prazo: '2026-10-10', prioridade: 'Alta' });
    expect(r.status).toBe(204);
    expect(dataCivil((await acaoDe(a)).prazo)).toBe('2026-10-10');
    expect(await statusAcao(a)).toBe('Pendente');
    expect((await edicoes(a)).map((l) => l.campo)).toEqual(['prioridade']);
  });

  it('CA28: não há operação para excluir Ação; a Ação continua no banco', async () => {
    const t = await nova();
    const a = await acao(t);
    const porEntidade = await DELETE(`${BASE}/Acoes(${a})`, comoGestor);
    const porAcao = await POST(`${BASE}/Tratativas(${t})/excluirAcao`, { acao: a }, comoGestor);
    const porSubacao = await POST(`${BASE}/Tratativas(${t})/excluirSubacao`, { acao: a }, comoGestor);
    for (const r of [porEntidade, porAcao, porSubacao]) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    }
    expect(await acaoDe(a)).toBeDefined();
  });

  it('CA56 (edição)/CA58 (edição): Tratativa Encerrada ou Cancelada → 409; após reabrir a Tratativa, aceito', async () => {
    const t = await nova();
    const a = await acao(t);
    const c = await nova();
    const b = await acao(c);
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status: 'Encerrada' }).where({ codigo: t }));
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status: 'Cancelada' }).where({ codigo: c }));
    const r1 = await editar(t, a, { descricao: 'Nova' });
    expect(r1.status).toBe(409);
    expect(r1.data.error.message).toBe('Tratativa Encerrada não pode ser alterada.');
    const r2 = await editar(c, b, { descricao: 'Nova' });
    expect(r2.status).toBe(409);
    expect(r2.data.error.message).toBe('Tratativa Cancelada não pode ser alterada.');

    const reabrir = await mudarStatus(enviar, t, { status: 'Em andamento', justificativa: 'faltou ação' }, comoGestor);
    expect(reabrir.status).toBe(204);
    const depois = await editar(t, a, { descricao: 'Nova' });
    expect(depois.status).toBe(204);
    expect(await acaoDe(a)).toMatchObject({ descricao: 'Nova' });
  });

  it('CA59 (edição)/CA61 (edição)/CA62 (edição): usuário comum e aplicativo → 403; anônimo → 401; nada muda', async () => {
    const t = await nova();
    const a = await acao(t);
    const antes = await foto(a);
    expect((await editar(t, a, { descricao: 'Outra' }, comoUsuario)).status).toBe(403);
    expect((await editar(t, a, { descricao: 'Outra' }, comoApp)).status).toBe(403);
    expect((await editar(t, a, { descricao: 'Outra' }, semAuth)).status).toBe(401);
    expect(await foto(a)).toEqual(antes);
  });

  it('CA63: edição dos quatro campos editáveis grava os novos valores sem alterar o Responsável', async () => {
    const t = await nova();
    const a = await acao(t);
    const r = await editar(t, a, {
      descricao: 'Descrição revisada',
      prazo: PRAZO_NOVO,
      prioridade: 'Alta',
      evidenciaObrigatoria: 'sim',
    });
    expect(r.status).toBe(204);
    expect(await foto(a)).toEqual({
      descricao: 'Descrição revisada',
      prazo: PRAZO_NOVO,
      prioridade: 'Alta',
      evidenciaObrigatoria: true,
      responsavel: 'M1001',
      status: 'Pendente',
    });
  });

  it('CA64/CA67/CA68 (R-07): campos fora da assinatura → 400 do runtime; responsavel não muda', async () => {
    const t = await nova();
    const a = await acao(t);
    const antes = await foto(a);
    for (const campo of ['codigo', 'tratativa', 'acaoMae', 'responsavel', 'status', 'dataConclusao']) {
      const valor = campo === 'responsavel' ? 'M9999' : campo === 'dataConclusao' ? HOJE : 'x';
      const r = await editar(t, a, { descricao: 'Tentativa', [campo]: valor });
      expect(r.status).toBe(400);
      expect(r.data.error.message).toMatch(/does not exist/);
      expect(r.data.error.message).toContain(campo);
    }
    expect(await foto(a)).toEqual(antes);
    expect((await acaoDe(a)).responsavel).toBe('M1001');
  });

  it('CA65: edição de Ação Concluída ou Cancelada → 409 "Ação <Status> não pode ser alterada."', async () => {
    const t = await nova();
    const concluida = await acao(t);
    const cancelada = await acao(t);
    expect((await mudarStatusAcao(enviar, t, { acao: concluida, status: 'Concluída' }, comoGestor)).status).toBe(204);
    expect((await mudarStatusAcao(enviar, t, { acao: cancelada, status: 'Cancelada', justificativa: 'duplicada' }, comoGestor)).status).toBe(204);

    const r1 = await editar(t, concluida, { descricao: 'Nova' });
    expect(r1.status).toBe(409);
    expect(r1.data.error.message).toBe('Ação Concluída não pode ser alterada.');
    const r2 = await editar(t, cancelada, { descricao: 'Nova' });
    expect(r2.status).toBe(409);
    expect(r2.data.error.message).toBe('Ação Cancelada não pode ser alterada.');
    expect(await statusAcao(concluida)).toBe('Concluída');
  });

  it('CA66: null ou só espaços em campo obrigatório → 400 "O campo <Nome> é obrigatório." e nada é apagado', async () => {
    const t = await nova();
    const a = await acao(t);
    await recusaEdicao(t, a, { descricao: null }, 400, 'descricao', 'O campo Descrição é obrigatório.');
    await recusaEdicao(t, a, { descricao: '   ' }, 400, 'descricao', 'O campo Descrição é obrigatório.');
    await recusaEdicao(t, a, { prazo: null }, 400, 'prazo', 'O campo Prazo é obrigatório.');
    await recusaEdicao(t, a, { prazo: '   ' }, 400, 'prazo', 'O campo Prazo é obrigatório.');
    await recusaEdicao(t, a, { prioridade: null }, 400, 'prioridade', 'O campo Prioridade é obrigatório.');
    await recusaEdicao(t, a, { prioridade: '   ' }, 400, 'prioridade', 'O campo Prioridade é obrigatório.');
    await recusaEdicao(t, a, { evidenciaObrigatoria: null }, 400, 'evidenciaObrigatoria', 'O campo Evidência obrigatória é obrigatório.');
    await recusaEdicao(t, a, { evidenciaObrigatoria: '   ' }, 400, 'evidenciaObrigatoria', 'O campo Evidência obrigatória é obrigatório.');
  });

  it('CA71: edição que altera só o Prazo grava Edicao apenas para o campo prazo', async () => {
    const t = await nova();
    const a = await acao(t);
    const r = await editar(t, a, { prazo: PRAZO_NOVO });
    expect(r.status).toBe(204);
    const e = await edicoes(a);
    expect(e).toHaveLength(1);
    expect(e[0].campo).toBe('prazo');
    expect(e.some((l) => l.campo === 'responsavel')).toBe(false);
  });

  it('CA72: reenviar os mesmos valores → 204, sem alteração e sem histórico', async () => {
    const t = await nova();
    // Criada com exatamente os valores que serão reenviados: o reenvio não pode gerar histórico.
    const a = await acao(t, { descricao: 'Avaliar local', prazo: PRAZO, prioridade: 'Média', evidenciaObrigatoria: 'sim' });
    const r = await editar(t, a, { descricao: 'Avaliar local', prazo: PRAZO, prioridade: 'Média', evidenciaObrigatoria: 'sim' });
    expect(r.status).toBe(204);
    expect(await edicoes(a)).toHaveLength(0);
  });

  it('CA74: edição de Descrição grava histórico com campo descricao e sem o texto anterior nem o novo', async () => {
    const t = await nova();
    const antigo = `Texto antigo ${sufixoUnico()}`;
    const novo = `Texto novo ${sufixoUnico()}`;
    const a = await acao(t, { descricao: antigo });
    const r = await editar(t, a, { descricao: novo });
    expect(r.status).toBe(204);
    const e = await edicoes(a);
    expect(e).toHaveLength(1);
    expect(e[0].campo).toBe('descricao');
    expect(e[0].valorAnterior).toBeNull();
    expect(e[0].valorNovo).toBeNull();
    const texto = JSON.stringify(await historicoAcao(a));
    expect(texto).not.toContain(antigo);
    expect(texto).not.toContain(novo);
  });

  it('CA76 (edição)/CA99: falha no histórico da edição → rollback atômico de todos os campos alterados', async () => {
    const t = await nova();
    const a = await acao(t);
    const antes = await foto(a);
    espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');
    const r = await editar(t, a, { descricao: `Falha ${sufixoUnico()}`, prioridade: 'Alta', prazo: PRAZO_NOVO });
    espiao.naoFalhar();
    expect(r.status).toBe(500);
    expect(await foto(a)).toEqual(antes);
    expect(await edicoes(a)).toHaveLength(0);
  });

  it('CA97 (edição): código ausente, nulo ou malformado → 400 "Código inválido." com target acao', async () => {
    const t = await nova();
    await acao(t);
    for (const codigo of [undefined, null, 'xyz']) {
      const r = await editar(t, codigo, { descricao: 'Nova' });
      expect(r.status).toBe(400);
      expect(r.data.error.target).toBe('acao');
      expect(r.data.error.message).toBe('Código inválido.');
    }
  });

  it('CA97 (edição): Tratativa inexistente ou malformada → 404 "Tratativa não encontrada."; Ação inexistente ou de outra Tratativa → 404 "Ação não encontrada."', async () => {
    const t = await nova();
    const a = await acao(t);
    for (const alvo of [UUID_INEXISTENTE, 'xyz']) {
      const r = await editar(alvo, a, { descricao: 'Nova' });
      expect(r.status).toBe(404);
      expect(r.data.error.message).toBe('Tratativa não encontrada.');
    }
    const r1 = await editar(t, UUID_INEXISTENTE, { descricao: 'Nova' });
    expect(r1.status).toBe(404);
    expect(r1.data.error.message).toBe('Ação não encontrada.');
    const outra = await nova();
    const deOutra = await acao(outra);
    const r2 = await editar(t, deOutra, { descricao: 'Nova' });
    expect(r2.status).toBe(404);
    expect(r2.data.error.message).toBe('Ação não encontrada.');
  });

  it('CA97 (edição): Ação inexistente em Tratativa Encerrada → 404 antes do 409', async () => {
    const t = await nova('Encerrada');
    const r = await editar(t, UUID_INEXISTENTE, { descricao: 'Nova' });
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Ação não encontrada.');
  });

  it('CA100 (edição): Evidência obrigatória aceita "sim" e "não"; "talvez" → 400 citando evidenciaObrigatoria', async () => {
    const t = await nova();
    const a = await acao(t);
    expect((await editar(t, a, { evidenciaObrigatoria: 'sim' })).status).toBe(204);
    expect(Boolean((await acaoDe(a)).evidenciaObrigatoria)).toBe(true);
    expect((await editar(t, a, { evidenciaObrigatoria: 'não' })).status).toBe(204);
    expect(Boolean((await acaoDe(a)).evidenciaObrigatoria)).toBe(false);
    await recusaEdicao(t, a, { evidenciaObrigatoria: 'talvez' }, 400, 'evidenciaObrigatoria', 'Evidência obrigatória inválida: use Sim ou Não.');
  });

  it('CA101: Prazo anterior a hoje → 400; hoje ou futuro → aceito', async () => {
    const t = await nova();
    const a = await acao(t);
    await recusaEdicao(t, a, { prazo: '2026-10-07' }, 400, 'prazo', 'Prazo não pode ser anterior a hoje.');
    expect((await editar(t, a, { prazo: HOJE })).status).toBe(204);
    expect((await editar(t, a, { prazo: PRAZO_NOVO })).status).toBe(204);
  });

  it('CA105 (edição): Prazo malformado ("2026-02-30", "amanhã") → 400 citando prazo', async () => {
    const t = await nova();
    const a = await acao(t);
    for (const prazo of ['2026-02-30', 'amanhã']) {
      await recusaEdicao(t, a, { prazo }, 400, 'prazo', 'Prazo inválido: use o formato AAAA-MM-DD.');
    }
  });
});
