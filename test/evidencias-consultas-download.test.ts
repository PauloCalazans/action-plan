import cds from '@sap/cds';
import { criarAcao, criarSubacao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM1001, comoM2002, comoM9999, comoUsuario, semAuth } from './apoio/usuarios';
import {
  anexarEvidencia,
  listarEvidenciasAcao,
  listarEvidenciasTratativa,
  baixarEvidencia,
  removerEvidencia,
  gerarPDF,
  gerarJPG,
  type Consulta,
} from './apoio/evidencias';
import { incluirParticipante } from './apoio/responsaveis';
import { limparArmazenamento } from './apoio/armazenamento-espiao';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;
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
  conteudo: gerarPDF(5000),
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

async function novaAcao(tratativa: string, responsavel = 'M1001', extra: Record<string, unknown> = {}) {
  const dados = {
    descricao: `Ação ${sufixoUnico()}`,
    responsavel,
    prazo: '2026-11-08',
    ...extra,
  };
  const r = await criarAcao(enviar, tratativa, dados, comoGestor);
  return (r.data.codigo as string) || '';
}

async function novaSubacao(tratativa: string, acaoMae: string, responsavel = 'M2002') {
  const dados = {
    descricao: `Subação ${sufixoUnico()}`,
    acaoMae,
    responsavel,
    prazo: '2026-11-10',
  };
  const r = await criarSubacao(enviar, tratativa, dados, comoGestor);
  return (r.data.codigo as string) || '';
}

async function anexar(t: string, a: string, como = comoGestor) {
  const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, como);
  return (r.data.codigo as string) || '';
}

const evidenciasDe = async (acao: string) => linhas(EVIDENCIAS, { acao_codigo: acao });
const historicoAcao = async (acao: string) => linhas(HISTORICO, { acao_codigo: acao });

describe('Etapa 4: Consultas, Visibilidade LGPD e Download com Auditoria (RED)', () => {
  // ===== CA7 (leitura): Trim, autor como matrícula; Gestor vê matrícula, Responsável vê null =====
  it('CA7 (leitura): Gestor lista e vê matrícula; Responsável lista e vê null', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    await anexarEvidencia(
      enviar,
      t,
      { acao: a, nomeArquivo: '  foto.png  ', mimeType: 'image/png', conteudo: gerarJPG(), descricao: '  teste  ' },
      comoGestor
    );

    const rGestor = await listarEvidenciasAcao(consultar, t, a, comoGestor);
    expect(rGestor.status).toBe(200);
    expect(rGestor.data.value).toHaveLength(1);
    expect((rGestor.data.value as Array<Record<string, unknown>>)[0].autorAnexo).toBe('gestor');

    const rResp = await listarEvidenciasAcao(consultar, t, a, comoM1001);
    expect(rResp.status).toBe(200);
    expect(rResp.data.value).toHaveLength(1);
    expect((rResp.data.value as Array<Record<string, unknown>>)[0].autorAnexo).toBeNull();
  });

  // ===== CA24 (leitura/download): Aplicativo recusa listagens e download com 403 =====
  it('CA24 (leitura): Aplicativo tenta listar → 403', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    await anexar(t, a);
    const r = await listarEvidenciasAcao(consultar, t, a, comoApp);
    expect(r.status).toBe(403);
  });

  it('CA24 (download): Aplicativo tenta baixar → 403', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);
    const r = await baixarEvidencia(consultar, t, a, e, comoApp);
    expect(r.status).toBe(403);
  });

  // ===== CA40: Listagens retornam apenas evidências ativas =====
  it('CA40: Listagem só retorna evidências ativas', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e1 = await anexar(t, a);
    const e2 = await anexar(t, a);
    await removerEvidencia(enviar, t, { acao: a, evidencia: e1 }, comoGestor);

    const r = await listarEvidenciasAcao(consultar, t, a, comoGestor);
    expect(r.status).toBe(200);
    expect(r.data.value).toHaveLength(1);
    expect((r.data.value as Array<Record<string, unknown>>)[0].codigo).toBe(e2);
  });

  // ===== CA41: Download de evidência removida → 404 =====
  it('CA41: Download de evidência removida → 404', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);
    await removerEvidencia(enviar, t, { acao: a, evidencia: e }, comoGestor);

    const r = await baixarEvidencia(consultar, t, a, e, comoGestor);
    expect(r.status).toBe(404);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Evidência não encontrada.');
  });

  // ===== CA43: Gestor vê matrícula nas listagens =====
  it('CA43: Gestor lista e baixa com autorAnexo preenchido', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const e = await anexar(t, a);

    const rLista = await listarEvidenciasAcao(consultar, t, a, comoGestor);
    expect(rLista.status).toBe(200);
    expect((rLista.data.value as Array<Record<string, unknown>>)[0].autorAnexo).toBe('gestor');

    const rBaixa = await baixarEvidencia(consultar, t, a, e, comoGestor);
    expect(rBaixa.status).toBe(200);
  });

  // ===== CA44: Responsável vê autorAnexo null; segregação mãe/subação =====
  it('CA44: Responsável lista com autorAnexo null', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    await anexar(t, a, comoM1001);

    const r = await listarEvidenciasAcao(consultar, t, a, comoM1001);
    expect(r.status).toBe(200);
    expect(r.data.value).toHaveLength(1);
    expect((r.data.value as Array<Record<string, unknown>>)[0].autorAnexo).toBeNull();
  });

  it('CA44 (subação): Responsável de Subação vê só a Subação, não a mãe', async () => {
    const t = await nova();
    const aMae = await novaAcao(t, 'M1001');
    const aSub = await novaSubacao(t, aMae, 'M2002');
    await anexar(t, aMae, comoM1001);
    await anexar(t, aSub, comoM2002);

    const rMae = await listarEvidenciasAcao(consultar, t, aMae, comoM1001);
    expect(rMae.status).toBe(200);
    expect(rMae.data.value).toHaveLength(1);

    const rSub = await listarEvidenciasAcao(consultar, t, aSub, comoM2002);
    expect(rSub.status).toBe(200);
    expect(rSub.data.value).toHaveLength(1);
  });

  // ===== CA45: Responsável Principal recebe lista vazia e 403 em download =====
  it('CA45: Responsável Principal lista vazia e download 403', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const e = await anexar(t, a);

    // Registrar M9999 como Responsável Principal da Tratativa
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ responsavelPrincipal: 'M9999' }).where({ codigo: t }));

    const rLista = await listarEvidenciasAcao(consultar, t, a, comoM9999);
    expect(rLista.status).toBe(200);
    expect(rLista.data.value).toHaveLength(0);

    const rBaixa = await baixarEvidencia(consultar, t, a, e, comoM9999);
    expect(rBaixa.status).toBe(403);
  });

  // ===== CA46: Participante recebe lista vazia e 403 em download =====
  it('CA46: Participante lista vazia e download 403', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const e = await anexar(t, a);

    // Registrar M9999 como Participante da Tratativa
    await incluirParticipante(enviar, t, { participante: 'M9999' }, comoGestor);

    const rLista = await listarEvidenciasAcao(consultar, t, a, comoM9999);
    expect(rLista.status).toBe(200);
    expect(rLista.data.value).toHaveLength(0);

    const rBaixa = await baixarEvidencia(consultar, t, a, e, comoM9999);
    expect(rBaixa.status).toBe(403);
  });

  // ===== CA47: Terceiro (sem papel) recebe lista vazia e 403 =====
  it('CA47: Terceiro lista vazia e download 403', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const e = await anexar(t, a);

    const rLista = await listarEvidenciasAcao(consultar, t, a, comoUsuario);
    expect(rLista.status).toBe(200);
    expect(rLista.data.value).toHaveLength(0);

    const rBaixa = await baixarEvidencia(consultar, t, a, e, comoUsuario);
    expect(rBaixa.status).toBe(403);
  });

  // ===== CA47a: Listagem por Tratativa, Gestor vê tudo com acao e autorAnexo =====
  it('CA47a: Gestor lista por Tratativa e vê todas com código da ação', async () => {
    const t = await nova();
    const a1 = await novaAcao(t, 'M1001');
    const aSub = await novaSubacao(t, a1, 'M2002');
    const e1 = await anexar(t, a1);
    const eSub = await anexar(t, aSub);

    const r = await listarEvidenciasTratativa(consultar, t, comoGestor);
    expect(r.status).toBe(200);
    expect(r.data.value).toHaveLength(2);
    const lista = r.data.value as Array<Record<string, unknown>>;
    expect(lista.map((ev) => ev.codigo)).toContain(e1);
    expect(lista.map((ev) => ev.codigo)).toContain(eSub);
    expect(lista.every((ev) => ev.autorAnexo !== null)).toBe(true);
  });

  // ===== CA47b: Responsável lista por Tratativa e vê só as suas com autorAnexo null =====
  it('CA47b: Responsável de Ação lista Tratativa e vê só suas evidências', async () => {
    const t = await nova();
    const a1 = await novaAcao(t, 'M1001');
    const aSub = await novaSubacao(t, a1, 'M2002');
    await anexar(t, a1);
    await anexar(t, aSub);

    const r = await listarEvidenciasTratativa(consultar, t, comoM1001);
    expect(r.status).toBe(200);
    expect(r.data.value).toHaveLength(1);
    expect((r.data.value as Array<Record<string, unknown>>)[0].autorAnexo).toBeNull();
  });

  // ===== CA48, CA48a: Download e listagem permitidos em Tratativa/Ação encerrada =====
  it('CA48: Download permitido em Tratativa Encerrada', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status: 'Encerrada' }).where({ codigo: t }));

    const r = await baixarEvidencia(consultar, t, a, e, comoGestor);
    expect(r.status).toBe(200);
  });

  it('CA48a: Listagem permitida em Tratativa Cancelada e Ação Concluída', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    await anexar(t, a);
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status: 'Cancelada' }).where({ codigo: t }));
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Concluída' }).where({ codigo: a }));

    const rPorAcao = await listarEvidenciasAcao(consultar, t, a, comoGestor);
    expect(rPorAcao.status).toBe(200);
    expect(rPorAcao.data.value).toHaveLength(1);

    const rPorTratativa = await listarEvidenciasTratativa(consultar, t, comoGestor);
    expect(rPorTratativa.status).toBe(200);
    expect(rPorTratativa.data.value).toHaveLength(1);
  });

  // ===== CA50a: Download grava DownloadEvidencia antes de entregar; falha impede entrega =====
  it('CA50a: Download grava histórico DownloadEvidencia', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);

    const r = await baixarEvidencia(consultar, t, a, e, comoGestor);
    expect(r.status).toBe(200);
    expect(r.data.conteudo).toBeTruthy();

    const hist = await historicoAcao(a);
    const download = hist.find((h) => h.evento === 'DownloadEvidencia');
    expect(download).toBeDefined();
    expect(download?.evidencia).toBe(e);
  });

  it('CA50b: Listagem não gera histórico', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    await anexar(t, a);

    const histAntes = (await historicoAcao(a)).length;
    await listarEvidenciasAcao(consultar, t, a, comoGestor);
    const histDepois = (await historicoAcao(a)).length;

    expect(histDepois).toBe(histAntes);
  });

  // ===== CA52 (download): Pedido recusado não grava histórico =====
  it('CA52 (download): Download recusado não grava histórico', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);

    const histAntes = (await historicoAcao(a)).length;
    await baixarEvidencia(consultar, t, a, e, comoUsuario); // terceiro, 403
    const histDepois = (await historicoAcao(a)).length;

    expect(histDepois).toBe(histAntes);
  });

  // ===== CA54a: Falha na gravação do histórico de download impede entrega =====
  it('CA54a: Falha no histórico de download impede entrega', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);

    espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');
    const r = await baixarEvidencia(consultar, t, a, e, comoGestor);
    expect(r.status).not.toBe(200);
  });

  // ===== CA56 (download): não autenticado → 401 =====
  it('CA56 (download): não autenticado → 401', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);

    const r = await baixarEvidencia(consultar, t, a, e, semAuth);
    expect(r.status).toBe(401);
  });

  // ===== CA57a (leitura/download): Aplicativo com código "xyz" → 403 antes de 400 =====
  it('CA57a (leitura): Aplicativo com "xyz" → 403', async () => {
    const r = await listarEvidenciasAcao(consultar, 'xyz', 'xyz', comoApp);
    expect(r.status).toBe(403);
  });

  it('CA57a (download): Aplicativo com "xyz" → 403', async () => {
    const r = await baixarEvidencia(consultar, 'xyz', 'xyz', 'xyz', comoApp);
    expect(r.status).toBe(403);
  });

  // ===== CA61a: Código inexistente na listagem → 404 =====
  it('CA61a: Listagem com Tratativa inexistente → 404', async () => {
    const uuidInexistente = '00000000-0000-0000-0000-000000000000';
    const r = await listarEvidenciasAcao(consultar, uuidInexistente, uuidInexistente, comoGestor);
    expect(r.status).toBe(404);
  });

  // ===== CA61b: Código malformado "xyz" na URL → 400 Código inválido =====
  it('CA61b: Listagem com "xyz" → 400 Código inválido', async () => {
    const r = await listarEvidenciasAcao(consultar, 'xyz', 'xyz', comoGestor);
    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Código inválido.');
  });

  // ===== CA67: Generalidade entre Origens e avulsas =====
  it('CA67: Evidências funcionam igual em Avulsa e com Origem', async () => {
    const tAvulsa = await nova();
    const aAvulsa = await novaAcao(tAvulsa);
    const eAvulsa = await anexar(tAvulsa, aAvulsa);

    const rAvulsa = await baixarEvidencia(consultar, tAvulsa, aAvulsa, eAvulsa, comoGestor);
    expect(rAvulsa.status).toBe(200);

    // Tratativa com Origem (a lógica de permissões é a mesma)
    const tOrigem = await nova();
    await cds.db.run(UPDATE.entity(TRATATIVAS).set({ origem: 'AppA' }).where({ codigo: tOrigem }));
    const aOrigem = await novaAcao(tOrigem);
    const eOrigem = await anexar(tOrigem, aOrigem);

    const rOrigem = await baixarEvidencia(consultar, tOrigem, aOrigem, eOrigem, comoGestor);
    expect(rOrigem.status).toBe(200);
  });

  // ===== CA70: Eventos incluem InclusaoEvidencia, RemocaoEvidencia, DownloadEvidencia =====
  it('CA70: Histórico registra todos os eventos de evidência', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const e = await anexar(t, a);
    await removerEvidencia(enviar, t, { acao: a, evidencia: e }, comoGestor);
    await anexar(t, a); // nova evidência
    const e2 = (await evidenciasDe(a)).find((ev) => ev.ativo)?.codigo as string;
    await baixarEvidencia(consultar, t, a, e2, comoGestor);

    const hist = await historicoAcao(a);
    const eventos = hist.map((h) => h.evento);
    expect(eventos).toContain('InclusaoEvidencia');
    expect(eventos).toContain('RemocaoEvidencia');
    expect(eventos).toContain('DownloadEvidencia');
  });
});
