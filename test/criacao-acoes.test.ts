import cds from '@sap/cds';
import { criarAcao, criarSubacao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const HOJE = '2026-10-08';

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

// Data civil AAAA-MM-DD somada a n dias (UTC, sem depender do fuso do runner).
function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const PRAZO = somarDias(HOJE, 30);

// Dados válidos de criação; cada teste sobrescreve só o campo que quer provar.
const valido = (extra: Record<string, unknown> = {}) => ({
  descricao: 'Avaliar local',
  responsavel: 'M1001',
  prazo: PRAZO,
  ...extra,
});

// Tratativa avulsa Aberta; com status diferente, leva direto ao status pedido (setup no banco, sem o mudarStatus).
async function nova(status = 'Aberta'): Promise<string> {
  const r = await criarAvulsa(enviar);
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  if (status !== 'Aberta') await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status }).where({ codigo }));
  return codigo;
}

const tratativa = async (codigo: string) => (await linhas('Tratativas', { codigo }))[0];
const statusDe = async (codigo: string) => (await tratativa(codigo)).status;
const acoesDe = (codigo: string) => linhas('Acoes', { tratativa_codigo: codigo });
const acaoDe = async (codigo: string) => (await linhas('Acoes', { codigo }))[0];
const historicoDe = (acao: string) => linhas('HistoricoAcoes', { acao_codigo: acao });
const dataCivil = (v: unknown) => new Date(v as string).toISOString().slice(0, 10);

describe('criação de Ação de primeiro nível (R1, R3, R4, R5)', () => {
  it('CA1: Gestor cria Ação em Tratativa Aberta → 200 com Código UUID e Status Pendente', async () => {
    const t = await nova();
    const r = await criarAcao(enviar, t, valido(), comoGestor);
    expect(r.status).toBe(200);
    expect(r.data.codigo).toMatch(UUID);
    expect((await acaoDe(r.data.codigo)).status).toBe('Pendente');
  });

  it('CA3: duas Ações seguidas têm Códigos diferentes e a Tratativa não muda', async () => {
    const t = await nova();
    const antes = await tratativa(t);
    const a = await criarAcao(enviar, t, valido({ descricao: 'Primeira' }), comoGestor);
    expect(a.status).toBe(200);
    const b = await criarAcao(enviar, t, valido({ descricao: 'Segunda' }), comoGestor);
    expect(b.status).toBe(200);
    expect(a.data.codigo).not.toBe(b.data.codigo);
    expect(await tratativa(t)).toEqual(antes);
  });

  it('CA48: criar Ação em Tratativa Aberta não altera o Status da Tratativa', async () => {
    const t = await nova();
    const r = await criarAcao(enviar, t, valido(), comoGestor);
    expect(r.status).toBe(200);
    expect(await statusDe(t)).toBe('Aberta');
  });

  it('CA16: Prioridade da Ação não altera Criticidade nem Data prevista da Tratativa', async () => {
    const t = await nova();
    const antes = await tratativa(t);
    const r = await criarAcao(enviar, t, valido({ prioridade: 'Baixa' }), comoGestor);
    expect(r.status).toBe(200);
    const depois = await tratativa(t);
    expect(depois.criticidade).toBe(antes.criticidade);
    expect(depois.dataPrevistaConclusao).toEqual(antes.dataPrevistaConclusao);
  });

  it('CA4/CA6: Ação 1 com Subações 1.1 e 1.2 e Ação 2 sem filhas; Subações da mesma Tratativa e mesmos campos', async () => {
    const t = await nova();
    const a1 = await criarAcao(enviar, t, valido({ descricao: 'Ação 1' }), comoGestor);
    expect(a1.status).toBe(200);
    const a2 = await criarAcao(enviar, t, valido({ descricao: 'Ação 2' }), comoGestor);
    expect(a2.status).toBe(200);
    const dadosSub = { responsavel: 'M2002', prazo: somarDias(HOJE, 15), prioridade: 'Alta', evidenciaObrigatoria: 'sim' };
    const s11 = await criarSubacao(enviar, t, valido({ ...dadosSub, descricao: 'Subação 1.1', acaoMae: a1.data.codigo }), comoGestor);
    expect(s11.status).toBe(200);
    const s12 = await criarSubacao(enviar, t, valido({ ...dadosSub, descricao: 'Subação 1.2', acaoMae: a1.data.codigo }), comoGestor);
    expect(s12.status).toBe(200);

    const sub = await acaoDe(s11.data.codigo);
    expect(sub.acaoMae_codigo).toBe(a1.data.codigo);
    expect(sub.tratativa_codigo).toBe(t);
    expect(sub.descricao).toBe('Subação 1.1');
    expect(sub.responsavel).toBe('M2002');
    expect(dataCivil(sub.prazo)).toBe(dadosSub.prazo);
    expect(sub.prioridade).toBe('Alta');
    expect(Boolean(sub.evidenciaObrigatoria)).toBe(true);
    expect(sub.status).toBe('Pendente');
    expect((await acaoDe(s12.data.codigo)).acaoMae_codigo).toBe(a1.data.codigo);
    expect((await acaoDe(a2.data.codigo)).acaoMae_codigo).toBeNull();
  });

  it('CA5/CA94: criar Subação sob outra Subação → 400 "Uma Subação não pode ter Subações."', async () => {
    const t = await nova();
    const mae = await criarAcao(enviar, t, valido(), comoGestor);
    expect(mae.status).toBe(200);
    const sub = await criarSubacao(enviar, t, valido({ acaoMae: mae.data.codigo }), comoGestor);
    expect(sub.status).toBe(200);
    const neta = await criarSubacao(enviar, t, valido({ acaoMae: sub.data.codigo }), comoGestor);
    expect(neta.status).toBe(400);
    expect(neta.data.error.message).toBe('Uma Subação não pode ter Subações.');
    expect(await acoesDe(t)).toHaveLength(2);
  });

  it('CA7: sem Prioridade e sem Evidência obrigatória grava Média, "não" (false) e sem Data de conclusão', async () => {
    const t = await nova();
    const r = await criarAcao(enviar, t, valido(), comoGestor);
    expect(r.status).toBe(200);
    const a = await acaoDe(r.data.codigo);
    expect(a.prioridade).toBe('Média');
    expect(Boolean(a.evidenciaObrigatoria)).toBe(false);
    expect(a.dataConclusao).toBeNull();
  });

  it('CA7: Prioridade e Evidência obrigatória enviadas como null assumem Média e "não"', async () => {
    const t = await nova();
    const r = await criarAcao(enviar, t, valido({ prioridade: null, evidenciaObrigatoria: null }), comoGestor);
    expect(r.status).toBe(200);
    const a = await acaoDe(r.data.codigo);
    expect(a.prioridade).toBe('Média');
    expect(Boolean(a.evidenciaObrigatoria)).toBe(false);
  });

  it('CA7: Prioridade vazia ou só com espaços → 400 citando prioridade', async () => {
    const t = await nova();
    for (const prioridade of ['', '   ']) {
      const r = await criarAcao(enviar, t, valido({ prioridade }), comoGestor);
      expect(r.status).toBe(400);
      expect(r.data.error.target).toBe('prioridade');
      expect(r.data.error.message).toBe('Prioridade inválida: use Baixa, Média ou Alta.');
    }
    expect(await acoesDe(t)).toHaveLength(0);
  });

  it('CA7: Evidência obrigatória vazia ou só com espaços → 400 citando evidenciaObrigatoria', async () => {
    const t = await nova();
    for (const evidenciaObrigatoria of ['', '   ']) {
      const r = await criarAcao(enviar, t, valido({ evidenciaObrigatoria }), comoGestor);
      expect(r.status).toBe(400);
      expect(r.data.error.target).toBe('evidenciaObrigatoria');
      expect(r.data.error.message).toBe('Evidência obrigatória inválida: use Sim ou Não.');
    }
    expect(await acoesDe(t)).toHaveLength(0);
  });

  it('CA8: Descrição ausente ou só com espaços → 400 citando descricao', async () => {
    const t = await nova();
    const ausente = await criarAcao(enviar, t, valido({ descricao: undefined }), comoGestor);
    expect(ausente.status).toBe(400);
    expect(ausente.data.error.target).toBe('descricao');
    expect(ausente.data.error.message).toBe('O campo Descrição é obrigatório.');
    const espacos = await criarAcao(enviar, t, valido({ descricao: '   ' }), comoGestor);
    expect(espacos.status).toBe(400);
    expect(espacos.data.error.target).toBe('descricao');
    expect(espacos.data.error.message).toBe('O campo Descrição é obrigatório.');
  });

  it('CA9/CA10: Descrição com 501 caracteres → 400; com 500 caracteres → aceita', async () => {
    const t = await nova();
    const longa = await criarAcao(enviar, t, valido({ descricao: 'a'.repeat(501) }), comoGestor);
    expect(longa.status).toBe(400);
    expect(longa.data.error.target).toBe('descricao');
    expect(longa.data.error.message).toBe('O campo Descrição aceita no máximo 500 caracteres.');
    const limite = await criarAcao(enviar, t, valido({ descricao: 'a'.repeat(500) }), comoGestor);
    expect(limite.status).toBe(200);
  });

  it('CA11: Responsável ausente → 400 citando responsavel', async () => {
    const t = await nova();
    const r = await criarAcao(enviar, t, valido({ responsavel: undefined }), comoGestor);
    expect(r.status).toBe(400);
    expect(r.data.error.target).toBe('responsavel');
    expect(r.data.error.message).toBe('O campo Responsável é obrigatório.');
  });

  it('CA12: Responsável com 51 caracteres → 400; com 50 caracteres → aceito', async () => {
    const t = await nova();
    const longo = await criarAcao(enviar, t, valido({ responsavel: 'R'.repeat(51) }), comoGestor);
    expect(longo.status).toBe(400);
    expect(longo.data.error.target).toBe('responsavel');
    expect(longo.data.error.message).toBe('O campo Responsável aceita no máximo 50 caracteres.');
    const limite = await criarAcao(enviar, t, valido({ responsavel: 'R'.repeat(50) }), comoGestor);
    expect(limite.status).toBe(200);
  });

  it('CA13/CA105 (criação): Prazo ausente ou malformado → 400 citando prazo', async () => {
    const t = await nova();
    const ausente = await criarAcao(enviar, t, valido({ prazo: undefined }), comoGestor);
    expect(ausente.status).toBe(400);
    expect(ausente.data.error.target).toBe('prazo');
    expect(ausente.data.error.message).toBe('O campo Prazo é obrigatório.');
    for (const prazo of ['2026-02-30', 'amanhã']) {
      const r = await criarAcao(enviar, t, valido({ prazo }), comoGestor);
      expect(r.status).toBe(400);
      expect(r.data.error.target).toBe('prazo');
      expect(r.data.error.message).toBe('Prazo inválido: use o formato AAAA-MM-DD.');
    }
  });

  it('CA14: envio de status ou dataConclusao na criação → 400 do runtime (campo desconhecido)', async () => {
    const t = await nova();
    const comStatus = await criarAcao(enviar, t, valido({ status: 'Concluída' }), comoGestor);
    expect(comStatus.status).toBe(400);
    expect(comStatus.data.error.message).toMatch(/status/);
    const comData = await criarAcao(enviar, t, valido({ dataConclusao: HOJE }), comoGestor);
    expect(comData.status).toBe(400);
    expect(comData.data.error.message).toMatch(/dataConclusao/);
    expect(await acoesDe(t)).toHaveLength(0);
  });

  it('CA15: Prioridade "Urgente" ou "Media" sem acento → 400 citando prioridade; "Alta" e "Média" aceitas', async () => {
    const t = await nova();
    for (const prioridade of ['Urgente', 'Media']) {
      const r = await criarAcao(enviar, t, valido({ prioridade }), comoGestor);
      expect(r.status).toBe(400);
      expect(r.data.error.target).toBe('prioridade');
      expect(r.data.error.message).toBe('Prioridade inválida: use Baixa, Média ou Alta.');
    }
    expect((await criarAcao(enviar, t, valido({ prioridade: 'Alta' }), comoGestor)).status).toBe(200);
    expect((await criarAcao(enviar, t, valido({ prioridade: 'Média' }), comoGestor)).status).toBe(200);
  });

  it('CA17: Prazo anterior a hoje → 400; Prazo de hoje → aceito', async () => {
    const t = await nova();
    const ontem = await criarAcao(enviar, t, valido({ prazo: somarDias(HOJE, -1) }), comoGestor);
    expect(ontem.status).toBe(400);
    expect(ontem.data.error.target).toBe('prazo');
    expect(ontem.data.error.message).toBe('Prazo não pode ser anterior a hoje.');
    const hoje = await criarAcao(enviar, t, valido({ prazo: HOJE }), comoGestor);
    expect(hoje.status).toBe(200);
  });

  it('CA18/CA19: Prazo da Ação não é limitado pela data prevista da Tratativa nem pelo prazo da mãe', async () => {
    const t = await nova();
    const dataPrevista = dataCivil((await tratativa(t)).dataPrevistaConclusao);
    const alemDaTratativa = await criarAcao(enviar, t, valido({ prazo: somarDias(dataPrevista, 90) }), comoGestor);
    expect(alemDaTratativa.status).toBe(200);
    const mae = await criarAcao(enviar, t, valido({ prazo: PRAZO }), comoGestor);
    expect(mae.status).toBe(200);
    const alemDaMae = await criarSubacao(
      enviar,
      t,
      valido({ prazo: somarDias(HOJE, 60), acaoMae: mae.data.codigo }),
      comoGestor,
    );
    expect(alemDaMae.status).toBe(200);
  });

  it('CA46/CA100 (criação): Evidência obrigatória "sim" aceita; "talvez" → 400 citando evidenciaObrigatoria', async () => {
    const t = await nova();
    const sim = await criarAcao(enviar, t, valido({ evidenciaObrigatoria: 'sim' }), comoGestor);
    expect(sim.status).toBe(200);
    expect(Boolean((await acaoDe(sim.data.codigo)).evidenciaObrigatoria)).toBe(true);
    const talvez = await criarAcao(enviar, t, valido({ evidenciaObrigatoria: 'talvez' }), comoGestor);
    expect(talvez.status).toBe(400);
    expect(talvez.data.error.target).toBe('evidenciaObrigatoria');
    expect(talvez.data.error.message).toBe('Evidência obrigatória inválida: use Sim ou Não.');
  });

  it('CA56 (criação)/CA57: Tratativa Encerrada ou Cancelada → 409 "Tratativa <Status> não pode ser alterada."', async () => {
    for (const status of ['Encerrada', 'Cancelada']) {
      const t = await nova(status);
      const r = await criarAcao(enviar, t, valido(), comoGestor);
      expect(r.status).toBe(409);
      expect(r.data.error.message).toBe(`Tratativa ${status} não pode ser alterada.`);
      expect(await acoesDe(t)).toHaveLength(0);
    }
  });

  it('CA69/CA75: criação grava Criacao em HistoricoAcoes com autor, tipoAutor Usuario e sem a Descrição', async () => {
    const t = await nova();
    const descricao = `Descrição sigilosa ${sufixoUnico()}`;
    const r = await criarAcao(enviar, t, valido({ descricao }), comoGestor);
    expect(r.status).toBe(200);
    const historico = await historicoDe(r.data.codigo);
    expect(historico).toHaveLength(1);
    expect(historico[0].evento).toBe('Criacao');
    expect(historico[0].autor).toBe('gestor');
    expect(historico[0].tipoAutor).toBe('Usuario');
    expect(JSON.stringify(historico)).not.toContain(descricao);
  });

  it('CA76 (criação): falha no INSERT de HistoricoAcoes → rollback total, a Ação não existe', async () => {
    const t = await nova();
    const descricao = `Falha simulada ${sufixoUnico()}`;
    espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');
    const r = await criarAcao(enviar, t, valido({ descricao }), comoGestor);
    espiao.naoFalhar();
    expect(r.status).toBe(500);
    expect(await acoesDe(t)).toHaveLength(0);
  });

  it('CA87: criação funciona igualmente em Tratativa de aplicativo e em Tratativa avulsa', async () => {
    const deApp = await abrirPorApp(enviar);
    expect(deApp.status).toBe(200);
    const avulsa = await nova();
    for (const t of [deApp.data.codigo as string, avulsa]) {
      const r = await criarAcao(enviar, t, valido(), comoGestor);
      expect(r.status).toBe(200);
      expect((await acaoDe(r.data.codigo)).tratativa_codigo).toBe(t);
    }
  });

  it('CA59/CA61/CA62 (criação): usuário comum e aplicativo → 403; anônimo → 401', async () => {
    const t = await nova();
    expect((await criarAcao(enviar, t, valido(), comoUsuario)).status).toBe(403);
    expect((await criarAcao(enviar, t, valido(), comoApp)).status).toBe(403);
    expect((await criarAcao(enviar, t, valido(), semAuth)).status).toBe(401);
    expect(await acoesDe(t)).toHaveLength(0);
  });

  it('CA90: precedência D10 com Tratativa inexistente: anônimo 401, sem papel 403, forma inválida 400 (runtime)', async () => {
    expect((await criarAcao(enviar, UUID_INEXISTENTE, valido(), semAuth)).status).toBe(401);
    expect((await criarAcao(enviar, UUID_INEXISTENTE, valido({ status: 'Pendente' }), comoUsuario)).status).toBe(403);
    expect((await criarAcao(enviar, UUID_INEXISTENTE, valido({ status: 'Pendente' }), comoGestor)).status).toBe(400);
    expect((await criarAcao(enviar, UUID_INEXISTENTE, valido({ evidenciaObrigatoria: true }), comoGestor)).status).toBe(400);
  });

  it('CA96: Tratativa inexistente → 404 "Tratativa não encontrada."; chave malformada na URL também', async () => {
    const r = await criarAcao(enviar, UUID_INEXISTENTE, valido(), comoGestor);
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Tratativa não encontrada.');
    const malformada = await criarAcao(enviar, 'xyz', valido(), comoGestor);
    expect(malformada.status).toBe(404);
    expect(malformada.data.error.message).toBe('Tratativa não encontrada.');
    expect(await linhas('Acoes', { tratativa_codigo: UUID_INEXISTENTE })).toHaveLength(0);
  });

  it('CA96/CA97 (acaoMae): malformado, nulo ou omitido em criarSubacao → 400 "Código inválido." com target acaoMae', async () => {
    const t = await nova();
    const casos: Record<string, unknown>[] = [{ acaoMae: 'xyz' }, { acaoMae: null }, {}];
    for (const extra of casos) {
      const r = await criarSubacao(enviar, t, valido(extra), comoGestor);
      expect(r.status).toBe(400);
      expect(r.data.error.target).toBe('acaoMae');
      expect(r.data.error.message).toBe('Código inválido.');
    }
  });

  it('CA97 (mãe inexistente): acaoMae inexistente → 404 "Ação não encontrada."; mãe de outra Tratativa também', async () => {
    const t = await nova();
    const inexistente = await criarSubacao(enviar, t, valido({ acaoMae: UUID_INEXISTENTE }), comoGestor);
    expect(inexistente.status).toBe(404);
    expect(inexistente.data.error.message).toBe('Ação não encontrada.');
    const outra = await nova();
    const maeDeOutra = await criarAcao(enviar, outra, valido(), comoGestor);
    expect(maeDeOutra.status).toBe(200);
    const cruzada = await criarSubacao(enviar, t, valido({ acaoMae: maeDeOutra.data.codigo }), comoGestor);
    expect(cruzada.status).toBe(404);
    expect(cruzada.data.error.message).toBe('Ação não encontrada.');
  });

  it('CA97 (mãe inexistente em Tratativa Encerrada): 404 "Ação não encontrada." antes do 409', async () => {
    const t = await nova('Encerrada');
    const r = await criarSubacao(enviar, t, valido({ acaoMae: UUID_INEXISTENTE }), comoGestor);
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Ação não encontrada.');
  });

  it('M-c: UUID em maiúsculas na chave da Tratativa e em acaoMae é aceito', async () => {
    const t = await nova();
    const mae = await criarAcao(enviar, t, valido(), comoGestor);
    expect(mae.status).toBe(200);
    const r = await criarSubacao(
      enviar,
      t.toUpperCase(),
      valido({ acaoMae: (mae.data.codigo as string).toUpperCase() }),
      comoGestor,
    );
    expect(r.status).toBe(200);
    expect((await acaoDe(r.data.codigo)).acaoMae_codigo).toBe(mae.data.codigo);
  });
});
