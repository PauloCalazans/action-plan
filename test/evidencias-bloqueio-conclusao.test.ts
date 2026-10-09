import cds from '@sap/cds';
import { criarAcao, criarSubacao, mudarStatusAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor, comoM1001 } from './apoio/usuarios';
import { anexarEvidencia, type Resposta } from './apoio/evidencias';
import { limparArmazenamento } from './apoio/armazenamento-espiao';

const { POST, GET } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
type Consulta = (url: string, opcoes?: unknown) => Promise<Resposta>;
const consultar = GET as unknown as Consulta;
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const ACOES = 'Acoes';
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

// Função local para listar pendências de evidência (não existe no helper restaurado)
async function listarPendenciasEvidenciasTratativa(
  GET: Consulta,
  tratativa: string,
  como: Record<string, unknown> = {}
): Promise<Resposta> {
  return GET(`/api/tratativa/v1/listarPendenciasEvidenciasTratativa(tratativa='${tratativa}')`, como);
}

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

// Wrappers locais que lançam erro em não-2xx (sem expect), chamando os helpers originais
async function novaAcao(
  tratativa: string,
  responsavel = 'M1001',
  extra: Record<string, unknown> = {}
): Promise<string> {
  const dados = {
    descricao: `Ação ${sufixoUnico()}`,
    responsavel,
    prazo: '2026-11-08',
    ...extra,
  };
  const r = await criarAcao(enviar, tratativa, dados, comoGestor);
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`criarAcao falhou com status ${r.status}`);
  }
  return (r.data.codigo as string) || '';
}

async function novaSubacao(
  tratativa: string,
  acaoMae: string,
  responsavel = 'M1001',
  extra: Record<string, unknown> = {}
): Promise<string> {
  const dados = {
    acaoMae,
    descricao: `Subação ${sufixoUnico()}`,
    responsavel,
    prazo: '2026-11-08',
    ...extra,
  };
  const r = await criarSubacao(enviar, tratativa, dados, comoGestor);
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`criarSubacao falhou com status ${r.status}`);
  }
  return (r.data.codigo as string) || '';
}

async function anexarValidoEm(tratativa: string, acao: string, como?: Record<string, unknown>): Promise<string> {
  // anexarEvidencia restaurado NÃO lança erro em não-2xx, então precisamos criar wrapper local
  const r = await anexarEvidencia(enviar, tratativa, { acao, ...evidenciaValida() }, como || comoGestor);
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`anexarEvidencia falhou com status ${r.status}`);
  }
  return (r.data.codigo as string) || '';
}

const acaoPorCodigo = async (codigo: string) => {
  const registros = await linhas('Acoes', { codigo });
  return registros[0] || null;
};

describe('Etapa 3: Bloqueio de Conclusão por Evidência Obrigatória e Consulta de Pendências (RED)', () => {
  // ===== CA29: Tentativa de concluir Ação com evidência obrigatória sem evidências (Gestor) =====
  it('CA29: Gestor não pode concluir Ação com evidenciaObrigatoria=sim sem Evidências', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Move para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Tenta concluir sem evidência - deve falhar com 409
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(r.status).toBe(409);
    expect(typeof r.data.error === 'object').toBe(true);
    const msg = (r.data as { error?: { message?: string } }).error?.message;
    expect(msg).toContain('Evidência obrigatória');
    expect(msg).toContain('sem Evidência');
  });

  // ===== CA30: Tentativa de concluir Ação com evidência obrigatória sem evidências (Responsável) =====
  it('CA30: Responsável não pode concluir Ação com evidenciaObrigatoria=sim sem Evidências', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Move para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Tenta concluir como Responsável - deve falhar com 409
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoM1001);
    expect(r.status).toBe(409);
    expect(typeof r.data.error === 'object').toBe(true);
    const msg = (r.data as { error?: { message?: string } }).error?.message;
    expect(msg).toContain('Evidência obrigatória');
    expect(msg).toContain('sem Evidência');
  });

  // ===== CA31: Conclusão bem-sucedida com evidenciaObrigatoria=sim e 1 Evidência ativa =====
  it('CA31: Responsável conclui Ação com evidenciaObrigatoria=sim com 1 Evidência ativa', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Move para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Anexa 1 evidência
    await anexarValidoEm(t, a, comoM1001);

    // Conclui - deve suceder com 200/204
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoM1001);
    expect([200, 204]).toContain(r.status);

    // Valida que Ação ficou Concluída
    const acao = await acaoPorCodigo(a);
    expect(acao.status).toBe('Concluída');
  });

  // ===== CA32: Conclusão bem-sucedida com evidenciaObrigatoria=não sem Evidências =====
  it('CA32: Responsável conclui Ação com evidenciaObrigatoria=não (padrão) sem Evidências', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'não' });

    // Move para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Conclui sem evidência - deve suceder pois evidenciaObrigatoria=não
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoM1001);
    expect([200, 204]).toContain(r.status);

    // Valida que Ação ficou Concluída
    const acao = await acaoPorCodigo(a);
    expect(acao.status).toBe('Concluída');
  });

  // ===== CA33: Conclusão bloqueada se a única Evidência foi removida logicamente =====
  it('CA33: Ação com evidenciaObrigatoria=sim não conclui se a única Evidência foi removida', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Move para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Anexa 1 evidência
    const ev = await anexarValidoEm(t, a, comoGestor);

    // Remove a evidência logicamente
    const rRemove = await enviar(`/api/tratativa/v1/Tratativas('${t}')/removerEvidencia`, {
      acao: a,
      evidencia: ev,
    }, comoGestor);
    expect(rRemove.status).toBe(204);

    // Tenta concluir - deve falhar com 409 pois não há evidência ativa
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(r.status).toBe(409);
    expect(typeof r.data.error === 'object').toBe(true);
    const msg = (r.data as { error?: { message?: string } }).error?.message;
    expect(msg).toContain('Evidência obrigatória');
  });

  // ===== CA34: Consulta de pendências retorna Ação Pendente com evidenciaObrigatoria=true e sem Evidências =====
  it('CA34: listarPendenciasEvidenciasTratativa retorna Ação Pendente com evidenciaObrigatoria=sim e zero Evidências', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Consulta pendências - deve retornar a Ação em Pendente sem evidência
    const r = await listarPendenciasEvidenciasTratativa(consultar, t, comoGestor);
    expect(r.status).toBe(200);

    const pendencias = (r.data as { value?: unknown[] }).value as Array<{ acao?: string }>;
    expect(pendencias).toBeInstanceOf(Array);
    expect(pendencias.length).toBeGreaterThanOrEqual(1);

    const acaoPendente = pendencias.find((p) => (p.acao as string | undefined) === a);
    expect(acaoPendente).toBeDefined();
  });

  // ===== CA35: Ação não aparece em pendências após anexar 1 Evidência =====
  it('CA35: Ação não consta em pendências após anexar Evidência ativa', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Anexa 1 evidência
    await anexarValidoEm(t, a, comoGestor);

    // Consulta pendências - não deve retornar esta Ação
    const r = await listarPendenciasEvidenciasTratativa(consultar, t, comoGestor);
    expect(r.status).toBe(200);

    const pendencias = (r.data as { value?: unknown[] }).value as Array<{ acao?: string }>;
    const acaoPendente = pendencias.find((p) => (p.acao as string | undefined) === a);
    expect(acaoPendente).toBeUndefined();
  });

  // ===== CA36: Ação com evidenciaObrigatoria=não não aparece em pendências =====
  it('CA36: Ação com evidenciaObrigatoria=não não consta em pendências', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'não' });

    // Move para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Consulta pendências - não deve retornar esta Ação
    const r = await listarPendenciasEvidenciasTratativa(consultar, t, comoGestor);
    expect(r.status).toBe(200);

    const pendencias = (r.data as { value?: unknown[] }).value as Array<{ acao?: string }>;
    const acaoPendente = pendencias.find((p) => (p.acao as string | undefined) === a);
    expect(acaoPendente).toBeUndefined();
  });

  // ===== CA37: Ação Concluída/Cancelada não aparece em pendências =====
  it('CA37: Ação Concluída ou Cancelada não consta em pendências', async () => {
    const t = await nova();
    const a1 = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });
    const a2 = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Conclui a1 (forcendo direto no banco para simular Ação com evidência que foi removida depois)
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Concluída' }).where({ codigo: a1 }));

    // Cancela a2
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Cancelada' }).where({ codigo: a2 }));

    // Consulta pendências - não deve retornar nenhuma destas
    const r = await listarPendenciasEvidenciasTratativa(consultar, t, comoGestor);
    expect(r.status).toBe(200);

    const pendencias = (r.data as { value?: unknown[] }).value as Array<{ acao?: string }>;
    const encontrada1 = pendencias.find((p) => (p.acao as string | undefined) === a1);
    const encontrada2 = pendencias.find((p) => (p.acao as string | undefined) === a2);
    expect(encontrada1).toBeUndefined();
    expect(encontrada2).toBeUndefined();
  });

  // ===== CA38: Consulta com visibilidade correta (Responsável null para não-Gestor) =====
  it('CA38: Gestor vê Responsável preenchido; Responsável da Ação vê null', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Consulta como Gestor - deve trazer Responsável preenchido
    const rGestor = await listarPendenciasEvidenciasTratativa(consultar, t, comoGestor);
    expect(rGestor.status).toBe(200);
    const pendenciasGestor = (rGestor.data as { value?: unknown[] }).value as Array<{
      acao?: string;
      responsavel?: string | null;
    }>;
    const acaoGestor = pendenciasGestor.find((p) => (p.acao as string | undefined) === a);
    expect(acaoGestor).toBeDefined();
    expect(acaoGestor?.responsavel).toBe('M1001');

    // Consulta como Responsável da Ação - deve trazer Responsável como null
    const rResponsavel = await listarPendenciasEvidenciasTratativa(consultar, t, comoM1001);
    expect(rResponsavel.status).toBe(200);
    const pendenciasResponsavel = (rResponsavel.data as { value?: unknown[] }).value as Array<{
      acao?: string;
      responsavel?: string | null;
    }>;
    const acaoResponsavel = pendenciasResponsavel.find((p) => (p.acao as string | undefined) === a);
    expect(acaoResponsavel).toBeDefined();
    expect(acaoResponsavel?.responsavel).toBeNull();
  });

  // ===== CA38a: Tipos existentes mantêm chaves exatas (sem evidenciaPendente) =====
  it('CA38a: Tipos de retorno existentes não recebem campo evidenciaPendente', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Consulta estrutura de Ações (função consultarEstruturaAcoes) - não deve ter campo evidenciaPendente
    const rEstrutura = await consultar(
      `/api/tratativa/v1/consultarEstruturaAcoes(tratativa='${t}')`,
      comoGestor
    );
    expect(rEstrutura.status).toBe(200);

    const acoes = (rEstrutura.data as { value?: unknown[] }).value as Array<Record<string, unknown>>;
    if (acoes.length > 0) {
      const chaves = Object.keys(acoes[0]);
      expect(chaves).not.toContain('evidenciaPendente');
    }

    // Consulta detalhe de Ação específica - não deve ter campo evidenciaPendente
    const rDetalhe = await consultar(
      `/api/tratativa/v1/consultarAcao(tratativa='${t}',codigo='${a}')`,
      comoGestor
    );
    expect(rDetalhe.status).toBe(200);

    const detalhe = rDetalhe.data as Record<string, unknown>;
    expect(Object.keys(detalhe)).not.toContain('evidenciaPendente');
  });

  // ===== CA64: Conclusão com Subações abertas recusa na etapa 9 (relação mãe/filhas) =====
  it('CA64: Ação com Subação Pendente não conclui (relação mãe/filhas precede evidência obrigatória)', async () => {
    const t = await nova();
    const mae = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });
    await novaSubacao(t, mae, 'M2002', { evidenciaObrigatoria: 'não' });

    // Move mãe para Em andamento
    await mudarStatusAcao(enviar, t, { acao: mae, status: 'Em andamento' }, comoGestor);

    // Tenta concluir mãe sem concluir filha e sem evidência
    // Deve falhar com 409 sobre Subações não concluídas (etapa 9) antes de validar evidência (etapa 10)
    const r = await mudarStatusAcao(enviar, t, { acao: mae, status: 'Concluída' }, comoGestor);
    expect(r.status).toBe(409);
    // A mensagem deve mencionar Subações, não Evidência
    const msg = (r.data as { error?: { message?: string } }).error?.message;
    expect(msg).toContain('Subações');
  });

  // ===== CA65: Conclusão com Tratativa Cancelada recusa na etapa 7 (estado Tratativa Cancelada) =====
  it('CA65: Estado da Tratativa Cancelada (etapa 7) precede validação de evidência obrigatória (etapa 10)', async () => {
    const t = await nova('Aberta'); // Cria Tratativa Aberta
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' }); // Sem Evidência

    // Move Ação para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Cancela a Tratativa (com justificativa; cancelamento não exige Ações finalizadas)
    const rCancelarTratativa = await enviar(
      `/api/tratativa/v1/Tratativas('${t}')/mudarStatus`,
      { status: 'Cancelada', justificativa: 'Cancelamento de teste para CA65' },
      comoGestor
    );
    expect(rCancelarTratativa.status).toBe(204);

    // Tenta concluir a Ação - deve falhar com 409 sobre estado da Tratativa (etapa 7), não sobre evidência (etapa 10)
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(r.status).toBe(409);
    const msg = (r.data as { error?: { message?: string } }).error?.message;
    expect(msg).toContain('Tratativa');
    expect(msg).toContain('Cancelada');
  });

  // ===== CA66: Conclusão de Ação Cancelada recusa na etapa 8 (estado Ação) =====
  it('CA66: Estado da Ação (etapa 8) precede validação de evidência obrigatória (etapa 10)', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Cancela a Ação
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Cancelada' }).where({ codigo: a }));

    // Tenta concluir de estado Cancelada para Concluída - deve falhar com 409 sobre transição não permitida (etapa 8)
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(r.status).toBe(409);
    const msg = (r.data as { error?: { message?: string } }).error?.message;
    expect(msg).toContain('Transição');
    expect(msg).toContain('Cancelada');
  });

  // ===== CA68: Consulta dedicada lista Ações com pendência de evidência (generalidade Ruling R-10) =====
  it('CA68: Consulta listarPendenciasEvidenciasTratativa funciona para Tratativas de qualquer Origem', async () => {
    const t = await nova();
    const a1 = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });
    const a2 = await novaAcao(t, 'M2002', { evidenciaObrigatoria: 'não' });
    const a3 = await novaAcao(t, 'M9999', { evidenciaObrigatoria: 'sim' });

    // Move a1 para Em andamento, a3 para Pendente
    await mudarStatusAcao(enviar, t, { acao: a1, status: 'Em andamento' }, comoGestor);

    // Consulta pendências
    const r = await listarPendenciasEvidenciasTratativa(consultar, t, comoGestor);
    expect(r.status).toBe(200);

    const pendencias = (r.data as { value?: unknown[] }).value as Array<{ acao?: string }>;

    // a1 deve estar em pendências (Em andamento com evidenciaObrigatoria=sim e zero evidências)
    const p1 = pendencias.find((p) => (p.acao as string | undefined) === a1);
    expect(p1).toBeDefined();

    // a2 não deve estar (evidenciaObrigatoria=não)
    const p2 = pendencias.find((p) => (p.acao as string | undefined) === a2);
    expect(p2).toBeUndefined();

    // a3 deve estar em pendências (Pendente com evidenciaObrigatoria=sim e zero evidências)
    const p3 = pendencias.find((p) => (p.acao as string | undefined) === a3);
    expect(p3).toBeDefined();
  });

  // ===== CA69: Bloqueio de conclusão substitui formalmente plano-de-acao:R14 =====
  it('CA69: Ação com evidenciaObrigatoria=sim é bloqueada de concluir sem Evidência (substitui 004:R14)', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001', { evidenciaObrigatoria: 'sim' });

    // Move para Em andamento
    await mudarStatusAcao(enviar, t, { acao: a, status: 'Em andamento' }, comoGestor);

    // Tenta concluir sem evidência - deve falhar com 409 (bloqueio ativo)
    const r = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(r.status).toBe(409);
    expect(typeof r.data.error === 'object').toBe(true);
    const msg = (r.data as { error?: { message?: string } }).error?.message;
    expect(msg).toContain('Evidência obrigatória');

    // Anexa evidência
    await anexarValidoEm(t, a, comoGestor);

    // Agora conclui com sucesso
    const rSuccess = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect([200, 204]).toContain(rSuccess.status);
  });
});
