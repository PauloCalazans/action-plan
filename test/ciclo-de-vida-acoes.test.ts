import cds from '@sap/cds';
import { consultarAcao, criarAcao, criarSubacao, mudarStatusAcao, type Consulta } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { bloqueiaAntesDeEscrever, instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { encerrarComAval } from './apoio/encerramento';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const enviar = POST as unknown as Envia;
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const HOJE = '2026-10-08';
const PRAZO = '2026-11-07';

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

// Tipado solto: as linhas do banco e as ações têm campos de tipos variados; cada teste confere o campo que usa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Linha = Record<string, any>;

const dados = (descricao: string, extra: Record<string, unknown> = {}) => ({
  descricao,
  responsavel: 'M1001',
  prazo: PRAZO,
  ...extra,
});

// Tratativa avulsa; status de preparo passa pelo contrato OData.
async function nova(status = 'Aberta'): Promise<string> {
  const r = await criarAvulsa(enviar);
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  if (status === 'Em andamento') {
    const inicio = await mudarStatus(enviar, codigo, { status }, comoGestor);
    expect(inicio.status).toBe(204);
  } else if (status === 'Encerrada') {
    const encerramento = await encerrarComAval(enviar, codigo);
    expect(encerramento.status).toBe(204);
  } else if (status === 'Cancelada') {
    const cancelamento = await mudarStatus(
      enviar,
      codigo,
      { status, justificativa: 'Cancelada no preparo do teste' },
      comoGestor,
    );
    expect(cancelamento.status).toBe(204);
  }
  return codigo;
}

const tratativa = async (codigo: string): Promise<Linha> => (await linhas('Tratativas', { codigo }))[0];
const statusTratativa = async (codigo: string) => (await tratativa(codigo)).status;
const acaoDe = async (codigo: string): Promise<Linha> => (await linhas('Acoes', { codigo }))[0];
const statusAcao = async (codigo: string) => (await acaoDe(codigo)).status;
const historicoAcao = (acao: string): Promise<Linha[]> => linhas('HistoricoAcoes', { acao_codigo: acao });
const dataCivil = (v: unknown) => new Date(v as string).toISOString().slice(0, 10);

// Move o relógio para o segundo pedido, para o histórico ter instantes distintos (ordenação do CA70).
const em = (segundo: number) => fixarInstante(`${HOJE}T12:00:${String(segundo).padStart(2, '0')}Z`);

// Ação criada com Status Pendente (setup pelo próprio pedido de criação).
async function acao(t: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAcao(enviar, t, dados('Ação', extra), comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function sub(t: string, mae: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await criarSubacao(enviar, t, dados('Subação', { acaoMae: mae, ...extra }), comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

// Pedido de transição de Ação pelo Gestor (ou como indicado).
const mudar = (t: string, acaoCodigo: unknown, corpo: Record<string, unknown>, como: unknown = comoGestor) =>
  mudarStatusAcao(enviar, t, { acao: acaoCodigo, ...corpo }, como);

// Transição que deve ser aceita (setup de estado): confere 204 antes de seguir.
async function leva(t: string, acaoCodigo: string, status: string, justificativa?: string) {
  const r = await mudar(t, acaoCodigo, { status, ...(justificativa ? { justificativa } : {}) });
  expect(r.status).toBe(204);
}

// Pedido recusado: confere HTTP, mensagem, target e que Status e histórico da Ação não mudaram.
async function recusaAcao(t: string, acaoCodigo: string, corpo: Record<string, unknown>, http: number, target: string | undefined, mensagem: string) {
  const antes = await statusAcao(acaoCodigo);
  const contagem = (await historicoAcao(acaoCodigo)).length;
  const r = await mudar(t, acaoCodigo, corpo);
  expect(r.status).toBe(http);
  if (target !== undefined) expect(r.data.error.target).toBe(target);
  expect(r.data.error.message).toBe(mensagem);
  expect(await statusAcao(acaoCodigo)).toBe(antes);
  expect((await historicoAcao(acaoCodigo)).length).toBe(contagem);
}

const TRATATIVA_ENCERRADA = 'Tratativa Encerrada não pode ser alterada.';
const JUSTIFICATIVA_OBRIGATORIA = 'O campo Justificativa é obrigatório para cancelar e reabrir.';

describe('transições de Status da Ação (R6-R10)', () => {
  it.each([
    ['CA22: iniciar Pendente', 'Pendente', 'Em andamento', undefined, 'Em andamento'],
    ['CA23: concluir Pendente', 'Pendente', 'Concluída', undefined, 'Concluída'],
    ['CA24: cancelar Pendente com justificativa', 'Pendente', 'Cancelada', 'duplicada', 'Cancelada'],
    ['CA25: concluir Em andamento', 'Em andamento', 'Concluída', undefined, 'Concluída'],
    ['CA26: cancelar Em andamento com justificativa', 'Em andamento', 'Cancelada', 'duplicada', 'Cancelada'],
  ])('%s → 204 e Status novo no banco', async (_nome, inicial, destino, justificativa, esperado) => {
    const t = await nova();
    const a = await acao(t);
    if (inicial === 'Em andamento') await leva(t, a, 'Em andamento');
    const r = await mudar(t, a, { status: destino, ...(justificativa ? { justificativa } : {}) });
    expect(r.status).toBe(204);
    expect(await statusAcao(a)).toBe(esperado);
  });

  it('CA27: Ação Cancelada não aceita saída → 409 "Transição não permitida: de Cancelada para <pedido>."', async () => {
    const t = await nova();
    const a = await acao(t);
    await leva(t, a, 'Cancelada', 'duplicada');
    await recusaAcao(t, a, { status: 'Em andamento', justificativa: 'voltar' }, 409, 'status', 'Transição não permitida: de Cancelada para Em andamento.');
    await recusaAcao(t, a, { status: 'Concluída' }, 409, 'status', 'Transição não permitida: de Cancelada para Concluída.');
  });

  it('CA29/CA30/CA31: mesmo status ou par proibido → 409 com target status e Status inalterado', async () => {
    const t = await nova();
    const a = await acao(t);
    await recusaAcao(t, a, { status: 'Pendente' }, 409, 'status', 'Transição não permitida: de Pendente para Pendente.');
    const b = await acao(t);
    await leva(t, b, 'Concluída');
    await recusaAcao(t, b, { status: 'Pendente' }, 409, 'status', 'Transição não permitida: de Concluída para Pendente.');
    await recusaAcao(t, b, { status: 'Cancelada', justificativa: 'x' }, 409, 'status', 'Transição não permitida: de Concluída para Cancelada.');
  });

  it('CA32/CA33/CA34: cancelar ou reabrir exige justificativa (400 target justificativa); iniciar e concluir não exigem', async () => {
    const t = await nova();
    const a = await acao(t);
    await recusaAcao(t, a, { status: 'Cancelada' }, 400, 'justificativa', JUSTIFICATIVA_OBRIGATORIA);
    await recusaAcao(t, a, { status: 'Cancelada', justificativa: '   ' }, 400, 'justificativa', JUSTIFICATIVA_OBRIGATORIA);
    await recusaAcao(t, a, { status: 'Cancelada', justificativa: 'x'.repeat(501) }, 400, 'justificativa', 'O campo Justificativa aceita no máximo 500 caracteres.');
    const b = await acao(t);
    await leva(t, b, 'Concluída');
    await recusaAcao(t, b, { status: 'Em andamento' }, 400, 'justificativa', JUSTIFICATIVA_OBRIGATORIA);
    expect((await mudar(t, await acao(t), { status: 'Em andamento' })).status).toBe(204);
    expect((await mudar(t, await acao(t), { status: 'Concluída' })).status).toBe(204);
  });

  it('CA35/CA36: concluir grava dataConclusao do dia; reabrir apaga dataConclusao', async () => {
    const t = await nova();
    const a = await acao(t);
    await leva(t, a, 'Concluída');
    expect(dataCivil((await acaoDe(a)).dataConclusao)).toBe(HOJE);
    await leva(t, a, 'Em andamento', 'faltou ação');
    expect((await acaoDe(a)).dataConclusao).toBeNull();
  });

  it('CA37: envio de dataConclusao no corpo → 400 do runtime (campo desconhecido)', async () => {
    const t = await nova();
    const a = await acao(t);
    const r = await mudar(t, a, { status: 'Concluída', dataConclusao: HOJE });
    expect(r.status).toBe(400);
    expect(r.data.error.message).toMatch(/dataConclusao/);
    expect(await statusAcao(a)).toBe('Pendente');
  });

  it('CA38/CA39/CA40: concluir ou cancelar mãe com Subações abertas → 409; filhas concluídas ou canceladas → aceito', async () => {
    const t = await nova();
    const mae = await acao(t);
    const s1 = await sub(t, mae);
    await recusaAcao(t, mae, { status: 'Concluída' }, 409, undefined, 'A Ação possui Subações não concluídas nem canceladas.');
    await recusaAcao(t, mae, { status: 'Cancelada', justificativa: 'duplicada' }, 409, undefined, 'A Ação possui Subações não concluídas nem canceladas.');
    await leva(t, s1, 'Concluída');
    const s2 = await sub(t, mae);
    await leva(t, s2, 'Cancelada', 'duplicada');
    await leva(t, mae, 'Concluída');
    expect(await statusAcao(mae)).toBe('Concluída');
  });

  it('CA41/CA45/CA102: mãe não conclui sozinha quando as filhas concluem; transições das filhas não mudam a mãe', async () => {
    const t = await nova();
    const mae = await acao(t);
    await leva(t, mae, 'Em andamento');
    const s1 = await sub(t, mae);
    await leva(t, s1, 'Concluída');
    expect(await statusAcao(mae)).toBe('Em andamento');
    await leva(t, s1, 'Em andamento', 'faltou ação');
    expect(await statusAcao(mae)).toBe('Em andamento');
    await leva(t, s1, 'Cancelada', 'duplicada');
    expect(await statusAcao(mae)).toBe('Em andamento');
  });

  it('CA42/CA44/CA95: criar Subação sob mãe Concluída ou Cancelada → 409 com o Status da mãe', async () => {
    const t = await nova();
    const concluida = await acao(t);
    await leva(t, concluida, 'Concluída');
    const r1 = await criarSubacao(enviar, t, dados('Subação', { acaoMae: concluida }), comoGestor);
    expect(r1.status).toBe(409);
    expect(r1.data.error.message).toBe('A Ação mãe está Concluída e não aceita esta alteração.');

    const cancelada = await acao(t);
    await leva(t, cancelada, 'Cancelada', 'duplicada');
    const r2 = await criarSubacao(enviar, t, dados('Subação', { acaoMae: cancelada }), comoGestor);
    expect(r2.status).toBe(409);
    expect(r2.data.error.message).toBe('A Ação mãe está Cancelada e não aceita esta alteração.');
  });

  it('CA43: reabrir Subação com mãe Concluída → 409; após reabrir a mãe, a reabertura da Subação é aceita', async () => {
    const t = await nova();
    const mae = await acao(t);
    const s1 = await sub(t, mae);
    await leva(t, s1, 'Concluída');
    await leva(t, mae, 'Concluída');
    await recusaAcao(t, s1, { status: 'Em andamento', justificativa: 'faltou ação' }, 409, undefined, 'A Ação mãe está Concluída e não aceita esta alteração.');
    await leva(t, mae, 'Em andamento', 'faltou ação');
    await leva(t, s1, 'Em andamento', 'faltou ação');
    expect(await statusAcao(s1)).toBe('Em andamento');
  });

  it('CA47 (R14, Ruling R-10): Ação criada com Evidência obrigatória "sim" grava e devolve o valor na consulta do Gestor', async () => {
    const t = await nova();
    const a = await acao(t, { evidenciaObrigatoria: 'sim' });
    const r = await consultarAcao(consultar, t, a, comoGestor);
    expect(r.status).toBe(200);
    expect(r.data.evidenciaObrigatoria).toBe('sim');
  });

  it('CA49: Tratativa não conclui nem muda de status quando todas as Ações concluem', async () => {
    const t = await nova();
    const a = await acao(t);
    await leva(t, a, 'Concluída');
    expect(await statusTratativa(t)).toBe('Aberta');
  });

  it('CA50/CA51/CA53: encerrar Tratativa com Ação ou Subação abertas → 409 e Tratativa inalterada', async () => {
    const pendente = await nova('Em andamento');
    await acao(pendente);
    const r1 = await mudarStatus(enviar, pendente, { status: 'Encerrada' }, comoGestor);
    expect(r1.status).toBe(409);
    expect(r1.data.error.message).toBe('Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.');
    expect(await statusTratativa(pendente)).toBe('Em andamento');

    const emAndamento = await nova('Em andamento');
    const a = await acao(emAndamento);
    await leva(emAndamento, a, 'Em andamento');
    const r2 = await mudarStatus(enviar, emAndamento, { status: 'Encerrada' }, comoGestor);
    expect(r2.status).toBe(409);
    expect(r2.data.error.message).toBe('Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.');
    expect(await statusTratativa(emAndamento)).toBe('Em andamento');

    const comSubacao = await nova('Em andamento');
    const mae = await acao(comSubacao);
    await leva(comSubacao, mae, 'Em andamento');
    await sub(comSubacao, mae);
    const r3 = await mudarStatus(enviar, comSubacao, { status: 'Encerrada' }, comoGestor);
    expect(r3.status).toBe(409);
    expect(r3.data.error.message).toBe('Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.');
    expect(await statusTratativa(comSubacao)).toBe('Em andamento');
  });

  it('CA52/CA54: encerrar Tratativa com todas as Ações finalizadas, ou sem nenhuma Ação → 204', async () => {
    const finalizadas = await nova('Em andamento');
    const a = await acao(finalizadas);
    const b = await acao(finalizadas);
    await leva(finalizadas, a, 'Concluída');
    await leva(finalizadas, b, 'Cancelada', 'duplicada');
    expect((await encerrarComAval(enviar, finalizadas)).status).toBe(204);
    expect(await statusTratativa(finalizadas)).toBe('Encerrada');

    const semAcoes = await nova();
    expect((await encerrarComAval(enviar, semAcoes)).status).toBe(204);
    expect(await statusTratativa(semAcoes)).toBe('Encerrada');
  });

  it('CA55: cancelar Tratativa com Ações abertas é aceito e não altera o Status das Ações', async () => {
    const t = await nova();
    const a = await acao(t);
    await leva(t, a, 'Em andamento');
    const r = await mudarStatus(enviar, t, { status: 'Cancelada', justificativa: 'duplicada' }, comoGestor);
    expect(r.status).toBe(204);
    expect(await statusTratativa(t)).toBe('Cancelada');
    expect(await statusAcao(a)).toBe('Em andamento');
  });

  it('CA56/CA58: Tratativa Cancelada bloqueia Ação aberta; reabertura não reabre Ação concluída', async () => {
    const encerrada = await nova('Em andamento');
    const concluida = await acao(encerrada);
    await leva(encerrada, concluida, 'Concluída');
    expect((await encerrarComAval(enviar, encerrada)).status).toBe(204);

    const cancelada = await nova('Em andamento');
    const aberta = await acao(cancelada);
    expect((await mudarStatus(enviar, cancelada, { status: 'Cancelada', justificativa: 'Finalizar cenário' }, comoGestor)).status).toBe(204);
    await recusaAcao(cancelada, aberta, { status: 'Em andamento' }, 409, undefined, 'Tratativa Cancelada não pode ser alterada.');

    const reabertura = await mudarStatus(
      enviar,
      encerrada,
      { status: 'Em andamento', justificativa: 'Verificar nova causa' },
      comoGestor,
    );
    expect(reabertura.status).toBe(204);
    expect(await statusAcao(concluida)).toBe('Concluída');
    const novaAcao = await acao(encerrada);
    await leva(encerrada, novaAcao, 'Em andamento');
    expect(await statusAcao(novaAcao)).toBe('Em andamento');
  });

  it('CA59 (transição)/CA60: usuário comum que não é o Responsável → 403 e nada muda', async () => {
    const t = await nova();
    const a = await acao(t, { responsavel: 'M1001' });
    const iniciar = await mudar(t, a, { status: 'Em andamento' }, comoUsuario);
    expect(iniciar.status).toBe(403);
    await leva(t, a, 'Concluída');
    expect(await statusAcao(a)).toBe('Concluída');
    const b = await acao(t, { responsavel: 'M1001' });
    const concluir = await mudar(t, b, { status: 'Concluída' }, comoUsuario);
    expect(concluir.status).toBe(403);
    expect(await statusAcao(b)).toBe('Pendente');
  });

  it('CA61 (transição)/CA62 (transição): aplicativo → 403 (só o status) e anônimo → 401', async () => {
    const t = await nova();
    const a = await acao(t);
    expect((await mudar(t, a, { status: 'Em andamento' }, comoApp)).status).toBe(403);
    expect((await mudar(t, a, { status: 'Em andamento' }, semAuth)).status).toBe(401);
    expect(await statusAcao(a)).toBe('Pendente');
  });

  it('CA70/CA73/CA88/CA89: histórico das transições com evento, valores, autor e justificativa', async () => {
    const t = await nova();
    em(1);
    const a = await acao(t);
    em(2);
    await leva(t, a, 'Em andamento');
    em(3);
    await leva(t, a, 'Concluída');
    em(4);
    await leva(t, a, 'Em andamento', 'faltou ação');
    em(5);
    const b = await acao(t);
    em(6);
    await leva(t, b, 'Cancelada', 'duplicada');

    const h = (await historicoAcao(a)).sort((x, y) => new Date(x.quando).getTime() - new Date(y.quando).getTime());
    expect(h.map((l) => [l.evento, l.campo, l.valorAnterior, l.valorNovo])).toEqual([
      ['Criacao', null, null, null],
      ['MudancaStatus', 'status', 'Pendente', 'Em andamento'],
      ['Conclusao', 'status', 'Em andamento', 'Concluída'],
      ['Reabertura', 'status', 'Concluída', 'Em andamento'],
    ]);
    expect(h[1].justificativa).toBeNull();
    expect(h[3].justificativa).toBe('faltou ação');
    expect(h.every((l) => l.autor === 'gestor' && l.tipoAutor === 'Usuario')).toBe(true);

    const hb = await historicoAcao(b);
    const cancelamento = hb.find((l) => l.evento === 'Cancelamento');
    expect(cancelamento).toBeDefined();
    expect(cancelamento?.campo).toBe('status');
    expect(cancelamento?.valorAnterior).toBe('Pendente');
    expect(cancelamento?.valorNovo).toBe('Cancelada');
    expect(cancelamento?.justificativa).toBe('duplicada');
  });

  it('CA76 (transição): falha no INSERT de HistoricoAcoes → rollback do Status da Ação', async () => {
    const t = await nova();
    const a = await acao(t, { descricao: `Rollback ${sufixoUnico()}` });
    espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');
    const r = await mudar(t, a, { status: 'Em andamento' });
    espiao.naoFalhar();
    expect(r.status).toBe(500);
    expect(await statusAcao(a)).toBe('Pendente');
  });

  it('CA77 + D9: duas conclusões simultâneas da mesma Ação → uma 204 e uma 409; exatamente um histórico de Conclusao', async () => {
    const t = await nova();
    const a = await acao(t);
    await leva(t, a, 'Em andamento');
    espiao.limpar();
    const [r1, r2] = await Promise.all([mudar(t, a, { status: 'Concluída' }), mudar(t, a, { status: 'Concluída' })]);
    expect([r1.status, r2.status].sort()).toEqual([204, 409]);
    const perdedora = r1.status === 409 ? r1 : r2;
    expect(perdedora.data.error.message).toBe('Transição não permitida: de Concluída para Concluída.');
    expect((await historicoAcao(a)).filter((l) => l.evento === 'Conclusao')).toHaveLength(1);
    expect(bloqueiaAntesDeEscrever(espiao.comandos)).toBe(true);
  });

  it('CA78 + D9: encerramento da Tratativa e criação de Ação simultâneos → Tratativa nunca encerra com Ação aberta', async () => {
    // Com uma Ação Pendente já existente, o encerramento é recusado por R16 em qualquer ordem de execução:
    // a criação concorrente só acrescenta outra Ação aberta. Determinístico, sem depender da ordem da corrida.
    const t = await nova('Em andamento');
    await acao(t);
    const [encerrar, criar] = await Promise.all([
      mudarStatus(enviar, t, { status: 'Encerrada' }, comoGestor),
      criarAcao(enviar, t, dados('Concorrente'), comoGestor),
    ]);
    expect(encerrar.status).toBe(409);
    expect(encerrar.data.error.message).toBe('Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.');
    expect(criar.status).toBe(200);
    expect(await statusTratativa(t)).toBe('Em andamento');
  });

  it('CA87 (conclusão): conclusão funciona igualmente em Tratativa de aplicativo e em Tratativa avulsa', async () => {
    const deApp = (await abrirPorApp(enviar)).data.codigo as string;
    const avulsa = await nova();
    for (const t of [deApp, avulsa]) {
      const a = await acao(t);
      const r = await mudar(t, a, { status: 'Concluída' });
      expect(r.status).toBe(204);
      expect(await statusAcao(a)).toBe('Concluída');
    }
  });

  it('CA91/CA92/CA93: código da Ação ausente, nulo ou malformado → 400 "Código inválido." com target acao', async () => {
    const t = await nova();
    await acao(t);
    for (const acaoCodigo of [undefined, null, 'xyz']) {
      const r = await mudar(t, acaoCodigo, { status: 'Em andamento' });
      expect(r.status).toBe(400);
      expect(r.data.error.target).toBe('acao');
      expect(r.data.error.message).toBe('Código inválido.');
    }
  });

  it('CA91/CA92: Tratativa inexistente ou malformada na URL → 404 "Tratativa não encontrada."', async () => {
    const t = await nova();
    const a = await acao(t);
    for (const alvo of [UUID_INEXISTENTE, 'xyz']) {
      const r = await mudar(alvo, a, { status: 'Em andamento' });
      expect(r.status).toBe(404);
      expect(r.data.error.message).toBe('Tratativa não encontrada.');
    }
  });

  it('CA91/CA92/CA97/CA98: Ação inexistente ou de outra Tratativa → 404 "Ação não encontrada."', async () => {
    const t = await nova();
    await acao(t);
    const outra = await nova();
    const deOutra = await acao(outra);
    const inexistente = await mudar(t, UUID_INEXISTENTE, { status: 'Em andamento' });
    expect(inexistente.status).toBe(404);
    expect(inexistente.data.error.message).toBe('Ação não encontrada.');
    const cruzada = await mudar(t, deOutra, { status: 'Em andamento' });
    expect(cruzada.status).toBe(404);
    expect(cruzada.data.error.message).toBe('Ação não encontrada.');
  });

  it('CA97 (transição): Ação inexistente em Tratativa Encerrada → 404 antes do 409', async () => {
    const t = await nova('Encerrada');
    const r = await mudar(t, UUID_INEXISTENTE, { status: 'Em andamento' });
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Ação não encontrada.');
  });

  it('CA93: Tratativa Cancelada com Ação aberta → 409 antes do status de destino', async () => {
    const t = await nova();
    const a = await acao(t);
    expect((await mudarStatus(enviar, t, { status: 'Cancelada', justificativa: 'Finalizar cenário' }, comoGestor)).status).toBe(204);
    const r = await mudar(t, a, { status: 'Em andamento' });
    expect(r.status).toBe(409);
    expect(r.data.error.message).toBe('Tratativa Cancelada não pode ser alterada.');
  });

  it('CA93: status ausente, nulo ou só com espaços → 400 "O campo Status é obrigatório." com target status', async () => {
    const t = await nova('Em andamento');
    const a = await acao(t);
    for (const status of [undefined, null, '   ']) {
      await recusaAcao(t, a, { status }, 400, 'status', 'O campo Status é obrigatório.');
    }
  });

  it('CA93: par fora da tabela → 409 com target status antes da justificativa', async () => {
    const t = await nova();
    const a = await acao(t);
    await recusaAcao(t, a, { status: 'Reaberta', justificativa: 'x' }, 409, 'status', 'Transição não permitida: de Pendente para Reaberta.');
  });

  it('CA104: Tratativa Cancelada → Encerrada recusa com 409 de transição antes de R16 (mesmo com Ação aberta)', async () => {
    const t = await nova();
    await acao(t);
    expect((await mudarStatus(enviar, t, { status: 'Cancelada', justificativa: 'Finalizar cenário' }, comoGestor)).status).toBe(204);
    const r = await mudarStatus(enviar, t, { status: 'Encerrada' }, comoGestor);
    expect(r.status).toBe(409);
    expect(r.data.error.message).toBe('Transição não permitida: de Cancelada para Encerrada.');
  });

  it('M4 (CA104/R16): com Ação aberta, o encerramento recusa com 409 de R16 antes da validação de tamanho da justificativa', async () => {
    const t = await nova('Em andamento');
    await acao(t);
    const r = await mudarStatus(enviar, t, { status: 'Encerrada', justificativa: 'x'.repeat(501) }, comoGestor);
    expect(r.status).toBe(409);
    expect(r.data.error.message).toBe('Tratativa não pode ser encerrada: há Ações não concluídas nem canceladas.');
  });

  it('CA106: Ação Cancelada em Tratativa Aberta sem status de destino → 400; em Tratativa Encerrada → 409', async () => {
    const t = await nova();
    const a = await acao(t);
    await leva(t, a, 'Cancelada', 'duplicada');
    for (const status of [undefined, '   ']) {
      await recusaAcao(t, a, { status }, 400, 'status', 'O campo Status é obrigatório.');
    }
    expect((await encerrarComAval(enviar, t)).status).toBe(204);
    const r = await mudar(t, a, { status: undefined });
    expect(r.status).toBe(409);
    expect(r.data.error.message).toBe(TRATATIVA_ENCERRADA);
  });
});
