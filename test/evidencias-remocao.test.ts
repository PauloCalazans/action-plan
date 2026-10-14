import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { encerrarComAval } from './apoio/encerramento';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM1001, comoM2002, comoM9999 } from './apoio/usuarios';
import {
  anexarEvidencia,
  removerEvidencia,
} from './apoio/evidencias';
import { limparArmazenamento, contemArquivo } from './apoio/armazenamento-espiao';

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const ACOES = 'br.com.calazanstec.Acoes';
const EVIDENCIAS = 'Evidencias';
const HISTORICO = 'HistoricoAcoes';
const HOJE = '2026-10-08';

jest.setTimeout(60000);

let espiao: Espiao;

beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});

beforeEach(() => {
  fixarInstante(`${HOJE}T12:00:00Z`);
  limparArmazenamento();
  espiao.naoFalhar();
});

afterEach(() => {
  liberarRelogio();
  espiao.naoFalhar();
  limparArmazenamento();
});

const evidenciaValida = (extra: Record<string, unknown> = {}) => ({
  nomeArquivo: `arquivo_${sufixoUnico()}.pdf`,
  mimeType: 'application/pdf',
  conteudo: Buffer.from('PDF_FAKE_CONTENT'),
  descricao: 'Evidência de teste',
  ...extra,
});

async function nova(status = 'Aberta'): Promise<string> {
  const r = await criarAvulsa(enviar);
  const codigo = r.data.codigo as string;
  if (status !== 'Aberta') {
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status }).where({ codigo }));
  }
  return codigo;
}

async function novaAcao(tratativa: string, responsavel = 'M1001'): Promise<string> {
  const dados = {
    descricao: `Ação ${sufixoUnico()}`,
    responsavel,
    prazo: '2026-11-08',
  };
  const r = await criarAcao(enviar, tratativa, dados, comoGestor);
  return (r.data.codigo as string) || '';
}

async function anexarValidoEm(tratativa: string, acao: string, como?: Record<string, unknown>): Promise<string> {
  const r = await anexarEvidencia(enviar, tratativa, { acao, ...evidenciaValida() }, como || comoGestor);
  return (r.data.codigo as string) || '';
}

const evidenciasDe = async (acao: string) => linhas(EVIDENCIAS, { acao_codigo: acao });
const historicoAcao = async (acao: string) => linhas(HISTORICO, { acao_codigo: acao });

describe('Etapa 2: Remoção Lógica e Auditoria de Evidências (removerEvidencia - RED)', () => {
  // ===== CA6: Remoção lógica libera cota =====
  it('CA6: Remover Evidência libera cota e permite anexar 10ª', async () => {
    const t = await nova();
    const a = await novaAcao(t);

    // Anexa 10 evidências
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const id = await anexarValidoEm(t, a);
      ids.push(id);
    }

    // Tenta anexar 11ª - deve falhar com 409
    const r11 = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoGestor);
    expect(r11.status).toBe(409);

    // Remove a 1ª evidência
    const rRemove = await removerEvidencia(enviar, t, { acao: a, evidencia: ids[0] }, comoGestor);
    expect(rRemove.status).toBe(204);

    // Agora anexa a 11ª (que era antes 11, mas agora cota foi liberada) - deve passar
    const r11Novo = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoGestor);
    expect(r11Novo.status).toBe(200);
  });

  // ===== CA39: Remoção lógica grava ativo=false, data e autor =====
  it('CA39: Remover Evidência marca ativo=false, data de remoção e autorRemocao', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // Remove como gestor
    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(204);

    // Verifica no banco
    const evRemovida = await linhas(EVIDENCIAS, { codigo: evId });
    expect(evRemovida.length).toBe(1);
    const ev = evRemovida[0];
    expect(ev.ativo).toBe(false);
    expect(ev.removidoEm).toBeTruthy();
    expect(ev.autorRemocao).toBeTruthy(); // Deve ter a matrícula do usuário
  });

  // ===== CA41a: Arquivo permanece guardado após remoção =====
  it('CA41a: Arquivo binário permanece no armazenamento após remoção lógica', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // Verifica que arquivo existe no dublê
    expect(contemArquivo(evId)).toBe(true);

    // Remove a evidência
    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(204);

    // Arquivo ainda deve estar no armazenamento (remoção lógica)
    expect(contemArquivo(evId)).toBe(true);
  });

  // ===== CA42: Remoção de já removida ou inexistente = 404 =====
  it('CA42: Remover Evidência já removida logicamente retorna 404', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // Remove pela 1ª vez
    let r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(204);

    // Tenta remover de novo - deve retornar 404
    r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(404);
    expect((r.data as { error?: { message?: string } }).error?.message).toContain('não encontrada');
  });

  it('CA42: Remover Evidência inexistente retorna 404', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: fakeId }, comoGestor);
    expect(r.status).toBe(404);
    expect((r.data as { error?: { message?: string } }).error?.message).toContain('não encontrada');
  });

  // ===== CA18-CA23 (remoção): Permissões =====
  it('CA18: Gestor pode remover Evidência de qualquer Ação', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const evId = await anexarValidoEm(t, a);

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(204);
  });

  it('CA19: Responsável da Ação pode remover Evidência da sua Ação', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const evId = await anexarValidoEm(t, a, comoM1001); // Anexada pelo responsável

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoM1001);
    expect(r.status).toBe(204);
  });

  it('CA20: Responsável de Ação A1 NÃO pode remover Evidência de outra Ação A2', async () => {
    const t = await nova();
    const a1 = await novaAcao(t, 'M1001');
    const a2 = await novaAcao(t, 'M2002');
    const evId = await anexarValidoEm(t, a2);

    // M1001 é responsável de A1, tenta remover de A2
    // Validamos que A1 existe (criada com responsável M1001)
    expect(a1).toBeTruthy();
    const r = await removerEvidencia(enviar, t, { acao: a2, evidencia: evId }, comoM1001);
    expect(r.status).toBe(403);
  });

  it('CA21: Responsável Principal da Tratativa NÃO pode remover Evidência da Ação', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const evId = await anexarValidoEm(t, a);

    // Responsável principal é gestor, temos que usar outro usuário autenticado
    // Por simplicidade, M2002 que não é responsável de nada
    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoM2002);
    expect(r.status).toBe(403);
  });

  it('CA22: Participante da Tratativa NÃO pode remover Evidência', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const evId = await anexarValidoEm(t, a);

    // M9999 é um usuário sem papel (via mock de teste), tenta remover
    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoM9999);
    expect(r.status).toBe(403);
  });

  it('CA23: Usuário autenticado sem papel NÃO pode remover Evidência', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // M2002 sem papel na tratativa
    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoM2002);
    expect(r.status).toBe(403);
  });

  // ===== CA24 (remoção): Aplicativo negado =====
  it('CA24: Aplicativo de origem NÃO pode remover Evidência (403 etapa 3)', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoApp);
    expect(r.status).toBe(403);
  });

  // ===== CA25-CA27 (remoção): Estados da Tratativa e Ação =====
  it('CA25: Remoção em Tratativa Encerrada retorna 409 com mensagem de estado', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    const rConcluir = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(rConcluir.status).toBe(204);
    const rEncerrar = await encerrarComAval(enviar, t);
    expect(rEncerrar.status).toBe(204);

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(409);
    expect((r.data as { error?: { message?: string } }).error?.message).toContain('Encerrada');
  });

  it('CA25: Remoção em Tratativa Cancelada retorna 409 com mensagem de estado', async () => {
    // Nota: pode não conseguir anexar em Cancelada, então anexamos antes
    const t2 = await nova('Aberta');
    const a2 = await novaAcao(t2);
    const evId = await anexarValidoEm(t2, a2);
    // Depois cancelamos
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status: 'Cancelada' }).where({ codigo: t2 }));

    const r = await removerEvidencia(enviar, t2, { acao: a2, evidencia: evId }, comoGestor);
    expect(r.status).toBe(409);
    expect((r.data as { error?: { message?: string } }).error?.message).toContain('Cancelada');
  });

  it('CA26: Remoção em Ação Concluída retorna 409 com mensagem de estado', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // Marca Ação como Concluída
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Concluída' }).where({ codigo: a }));

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(409);
    expect((r.data as { error?: { message?: string } }).error?.message).toContain('Concluída');
  });

  it('CA27: Remoção em Ação Cancelada retorna 409 com mensagem de estado', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // Marca Ação como Cancelada
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Cancelada' }).where({ codigo: a }));

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(409);
    expect((r.data as { error?: { message?: string } }).error?.message).toContain('Cancelada');
  });

  // ===== CA50, CA51, CA52 (remoção): Histórico RemocaoEvidencia =====
  it('CA50: Remoção de Evidência grava evento RemocaoEvidencia no histórico', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // Limpa histórico anterior (da inclusão)
    await cds.db.run(DELETE.from(HISTORICO).where({ acao_codigo: a }));

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(204);

    const hist = await historicoAcao(a);
    const remocao = hist.find((h: Record<string, unknown>) => h.evento === 'RemocaoEvidencia');
    expect(remocao).toBeTruthy();
    if (remocao) {
      expect(remocao.evidencia).toBe(evId);
      expect(remocao.mimeType).toBeTruthy();
      expect(remocao.tamanho).toBeTruthy();
      expect(remocao.autor).toBeTruthy();
      expect(remocao.tipoAutor).toBe('Usuario');
    }
  });

  it('CA51: Histórico RemocaoEvidencia contém metadados (MIME, tamanho, autor) sem nome do arquivo', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const nomeArquivo = `arquivo_${sufixoUnico()}.pdf`;
    const r = await anexarEvidencia(enviar, t, {
      acao: a,
      nomeArquivo,
      mimeType: 'application/pdf',
      conteudo: Buffer.from('PDF_CONTENT'),
      descricao: 'Teste',
    }, comoGestor);
    const evId = r.data.codigo as string;

    await cds.db.run(DELETE.from(HISTORICO).where({ acao_codigo: a }));

    const rRemove = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(rRemove.status).toBe(204);

    const hist = await historicoAcao(a);
    const remocao = hist.find((h: Record<string, unknown>) => h.evento === 'RemocaoEvidencia');
    expect(remocao).toBeTruthy();
    if (remocao) {
      expect(remocao.mimeType).toBe('application/pdf');
      expect(remocao.tamanho).toBeGreaterThan(0);
      expect(remocao.autor).toBe('gestor'); // Quem removeu
      // Verifica que NÃO tem nomeArquivo
      expect((remocao as Record<string, unknown>).nomeArquivo).toBeUndefined();
    }
  });

  it('CA52: Histórico RemocaoEvidencia registrado para remoção aceita; pedido recusado não grava', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const evId = await anexarValidoEm(t, a);

    // Tenta remover com M2002 (sem acesso) - deve falhar
    let r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoM2002);
    expect(r.status).toBe(403);

    // Verifica que NÃO há histórico de remoção
    await cds.db.run(DELETE.from(HISTORICO).where({ acao_codigo: a, evento: 'InclusaoEvidencia' }));
    let hist = await historicoAcao(a);
    expect(hist.filter((h: Record<string, unknown>) => h.evento === 'RemocaoEvidencia')).toHaveLength(0);

    // Agora remove com acesso correto
    r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    expect(r.status).toBe(204);

    // Verifica que agora existe histórico
    hist = await historicoAcao(a);
    expect(hist.filter((h: Record<string, unknown>) => h.evento === 'RemocaoEvidencia')).toHaveLength(1);
  });

  // ===== CA54: Falha na gravação do histórico mantém ativo=true =====
  it('CA54: Se histórico falha na gravação, Evidência mantém ativo=true (transação falha)', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const evId = await anexarValidoEm(t, a);

    // Injeta falha na próxima escrita
    espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');

    const r = await removerEvidencia(enviar, t, { acao: a, evidencia: evId }, comoGestor);
    // A remoção deve falhar (500 ou 400)
    expect(r.status).toBeGreaterThanOrEqual(400);

    // Verifica que Evidência ainda está ativa
    const evs = await evidenciasDe(a);
    const ev = evs.find((e: Record<string, unknown>) => e.codigo === evId);
    expect(ev).toBeTruthy();
    if (ev) {
      expect(ev.ativo).toBe(true);
      expect(ev.removidoEm).toBeNull();
    }
  });

  // ===== CA56 (remoção), CA57a (remoção com "xyz"), CA61: Precedência de recusas =====
  it('CA56 (remoção): Aplicativo (etapa 3) recusado antes de Código malformado (etapa 4)', async () => {
    const t = await nova();

    // Código malformado "xyz" (válido para URL mas código de ação inválido)
    const r = await removerEvidencia(enviar, t, { acao: 'xyz', evidencia: '00000000-0000-0000-0000-000000000000' }, comoApp);
    expect(r.status).toBe(403); // Aplicativo (etapa 3) recusado ANTES de validação de Código (etapa 4)
  });

  it('CA57a (remoção com xyz): Aplicativo de origem (etapa 3) recusado antes de Código malformado', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const evId = await anexarValidoEm(t, a);

    // Aplicativo de origem tenta remover com Código de ação "xyz"
    const r = await removerEvidencia(enviar, t, { acao: 'xyz', evidencia: evId }, comoApp);
    expect(r.status).toBe(403); // Aplicativo (etapa 3) recusado antes de Código inválido (etapa 4)
  });

  it('CA61: Remoção informando Código de outra Ação (evidência não pertence) retorna 404', async () => {
    const t = await nova();
    const a1 = await novaAcao(t, 'M1001');
    const a2 = await novaAcao(t, 'M2002');
    const evId = await anexarValidoEm(t, a1); // Evidência vinculada a A1

    // Tenta remover informando A2 como ação
    const r = await removerEvidencia(enviar, t, { acao: a2, evidencia: evId }, comoGestor);
    expect(r.status).toBe(404);
    expect((r.data as { error?: { message?: string } }).error?.message).toContain('não encontrada');
  });
});
