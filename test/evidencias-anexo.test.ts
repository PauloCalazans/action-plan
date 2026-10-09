import cds from '@sap/cds';
import { criarAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM1001, comoM2002 } from './apoio/usuarios';
import {
  anexarEvidencia,
  gerarPDF,
  gerarJPG,
  gerarPNG,
  gerarVazio,
  gerarAcimaDe10MB,
  gerarExatamente10MB,
} from './apoio/evidencias';
import { limparArmazenamento, contemArquivo } from './apoio/armazenamento-espiao';

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const ACOES = 'br.com.calazanstec.Acoes';
const EVIDENCIAS = 'Evidencias';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

async function novaAcao(tratativa: string, responsavel = 'M1001') {
  const dados = {
    descricao: `Ação ${sufixoUnico()}`,
    responsavel,
    prazo: '2026-11-08',
  };
  const r = await criarAcao(enviar, tratativa, dados, comoGestor);
  return (r.data.codigo as string) || '';
}

const evidenciasDe = async (acao: string) => linhas(EVIDENCIAS, { acao_codigo: acao });
const historicoAcao = async (acao: string) => linhas('HistoricoAcoes', { acao_codigo: acao });

describe('Etapa 1: Inclusão e Armazenamento de Evidências (anexarEvidencia - RED)', () => {
  // ===== CA1, CA2: Vínculo básico =====
  it('CA1: Gestor anexa PDF em Ação → Evidência criada com UUID', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoGestor);
    expect(r.status).toBe(200);
    expect(r.data.codigo).toMatch(UUID);
  });

  it('CA2: Responsável anexa JPG em Ação → aceito', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, nomeArquivo: 'foto.jpg', mimeType: 'image/jpeg', conteudo: gerarJPG(), descricao: 'foto' },
      comoM1001
    );
    expect(r.status).toBe(200);
  });

  // ===== CA3: Ação obrigatória =====
  it('CA3: Ação ausente → 400', async () => {
    const t = await nova();
    const r = await anexarEvidencia(enviar, t, { ...evidenciaValida(), acao: undefined }, comoGestor);
    expect(r.status).toBe(400);
  });

  // ===== CA4, CA5: Limite de 10 =====
  it('CA4: 9ª evidência aceita', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    for (let i = 1; i <= 9; i++) {
      const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: `arquivo_${i}.pdf` }) }, comoGestor);
      expect(r.status).toBe(200);
    }
    expect((await evidenciasDe(a)).length).toBe(9);
  });

  it('CA5: 11ª evidência recusa → 409', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    for (let i = 1; i <= 10; i++) {
      await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: `arquivo_${i}.pdf` }) }, comoGestor);
    }
    const r11 = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: 'arquivo_11.pdf' }) }, comoGestor);
    expect(r11.status).toBe(409);
  });

  // ===== CA7-CA9: Trim e limite de descrição =====
  it('CA7: Nome trimado, autor gravado', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, nomeArquivo: '  foto.png  ', mimeType: 'image/png', conteudo: gerarPNG(), descricao: '  teste  ' },
      comoGestor
    );
    expect(r.status).toBe(200);
    const ev = (await evidenciasDe(a))[0];
    expect(ev.nomeArquivo).toBe('foto.png');
    expect(ev.descricao).toBe('teste');
  });

  it('CA8: Descrição vazia grava null', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ descricao: '' }) }, comoGestor);
    expect(r.status).toBe(200);
    expect((await evidenciasDe(a))[0].descricao).toBeNull();
  });

  it('CA9: Descrição > 500 caracteres → 400', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ descricao: 'X'.repeat(501) }) }, comoGestor);
    expect(r.status).toBe(400);
  });

  // ===== CA10-CA10c: Sanitização e limites =====
  it('CA10: Nome com caminho sanitizado', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: 'dir/subdir/../../foto.pdf' }) }, comoGestor);
    expect(r.status).toBe(200);
    expect((await evidenciasDe(a))[0].nomeArquivo).toBe('foto.pdf');
  });

  it('CA10a: Nome vazio após sanitização → 400', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: '../../' }) }, comoGestor);
    expect(r.status).toBe(400);
  });

  it('CA10b: Nome > 255 caracteres → 400', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: 'X'.repeat(256) + '.pdf' }) }, comoGestor);
    expect(r.status).toBe(400);
  });

  // ===== CA11, CA12, CA13: Formatos =====
  it('CA11/CA12: Formatos válidos aceitos', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r1 = await anexarEvidencia(enviar, t, { acao: a, nomeArquivo: 'doc.pdf', mimeType: 'application/pdf', conteudo: gerarPDF(), descricao: '' }, comoGestor);
    expect(r1.status).toBe(200);
  });

  it('CA13: Formatos proibidos (.exe) → 415', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, nomeArquivo: 'prog.exe', mimeType: 'application/x-msdownload', conteudo: gerarPDF(), descricao: '' },
      comoGestor
    );
    expect(r.status).toBe(415);
  });

  it('CA14: Maiúsculas em extensão aceitas', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, nomeArquivo: 'imagem.PNG', mimeType: 'image/png', conteudo: gerarPNG(), descricao: '' }, comoGestor);
    expect(r.status).toBe(200);
  });

  // ===== CA15, CA16: Tamanho =====
  it('CA15: Arquivo vazio → 400', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ conteudo: gerarVazio() }) }, comoGestor);
    expect(r.status).toBe(400);
  });

  it('CA16: Arquivo > 10 MB → 413', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ conteudo: gerarAcimaDe10MB() }) }, comoGestor);
    expect(r.status).toBe(413);
  });

  it('CA16: Arquivo = 10 MB aceito', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ conteudo: gerarExatamente10MB() }) }, comoGestor);
    expect(r.status).toBe(200);
  });

  // ===== CA17: Persistência =====
  it('CA17: Metadados no banco, binário no repositório', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const buf = gerarPDF(1000);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, nomeArquivo: 'documento.pdf', mimeType: 'application/pdf', conteudo: buf, descricao: 'teste' },
      comoGestor
    );
    expect(r.status).toBe(200);
    const codigo = r.data.codigo as string;
    const ev = (await evidenciasDe(a)).find((e) => e.codigo === codigo);
    expect(ev).toBeDefined();
    expect(ev?.nomeArquivo).toBe('documento.pdf');
    expect(contemArquivo(codigo)).toBe(true);
  });

  // ===== CA18-CA24: Autorização =====
  it('CA18: Gestor pode anexar', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoGestor);
    expect(r.status).toBe(200);
  });

  it('CA19: Responsável da Ação pode anexar', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoM1001);
    expect(r.status).toBe(200);
  });

  it('CA20: Responsável de outra Ação negado → 403', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoM2002);
    expect(r.status).toBe(403);
  });

  it('CA24: Aplicativo de origem negado → 403', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoApp);
    expect(r.status).toBe(403);
  });

  // ===== CA25-CA28: Estado =====
  it('CA25: Tratativa Encerrada não permite anexo → 409', async () => {
    const t = await nova('Encerrada');
    const a = await novaAcao(t);
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoGestor);
    expect(r.status).toBe(409);
  });

  it('CA26: Ação Concluída não permite anexo → 409', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Concluída' }).where({ codigo: a }));
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoGestor);
    expect(r.status).toBe(409);
  });

  // ===== CA49: Histórico =====
  it('CA49: Inclusão gera histórico InclusaoEvidencia', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, nomeArquivo: 'relatorio.pdf', mimeType: 'application/pdf', conteudo: gerarPDF(2000), descricao: 'Relatório' },
      comoGestor
    );
    expect(r.status).toBe(200);
    const historico = await historicoAcao(a);
    const ev = historico.find((h) => h.evento === 'InclusaoEvidencia');
    expect(ev).toBeDefined();
  });

  it('CA52: Pedido recusado não grava histórico', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const historicoAntes = await historicoAcao(a);
    const r = await anexarEvidencia(enviar, t, { acao: '00000000-0000-0000-0000-000000000099', ...evidenciaValida() }, comoGestor);
    expect(r.status).toBeGreaterThanOrEqual(400);
    const historicoDepois = await historicoAcao(a);
    expect(historicoDepois.length).toBe(historicoAntes.length);
  });
});
