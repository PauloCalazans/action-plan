import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, sufixoUnico, mudarStatus, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM2002 } from './apoio/usuarios';
import {
  anexarEvidencia,
  gerarPDF,
  gerarAcimaDe10MB,
} from './apoio/evidencias';
import { limparArmazenamento, falharProximoArmazenamento } from './apoio/armazenamento-espiao';

interface ErrorResponse {
  error?: {
    message?: string;
    target?: string;
  };
}

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const ACOES = 'br.com.calazanstec.Acoes';
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

const evidenciasDe = async (acao: string) => linhas('Evidencias', { acao_codigo: acao });
const historicoAcao = async (acao: string) => linhas('HistoricoAcoes', { acao_codigo: acao });

describe('Etapa 1: Complemento de Testes de Inclusão e Armazenamento de Evidências (RED)', () => {
  // ===== CA13a: MIME incompatível com extensão =====
  it('CA13a: Arquivo .pdf com MIME image/png (incompatíveis) → 415', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, nomeArquivo: 'arquivo.pdf', mimeType: 'image/png', conteudo: gerarPDF(), descricao: '' },
      comoGestor
    );
    expect(r.status).toBe(415);
    expect((r.data as ErrorResponse).error?.message).toContain('Tipo de arquivo não permitido');
    expect((r.data as ErrorResponse).error?.target).toBe('arquivo');
  });

  // ===== CA21, CA22, CA23: Autorização — Responsável Principal, Participante, Terceiro =====
  it('CA21: Responsável Principal da Tratativa tenta anexar → 403', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    // Simular Responsável Principal como M2002 (diferente do Responsável da Ação que é M1001)
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoM2002);
    expect(r.status).toBe(403);
  });

  it('CA22: Participante da Tratativa tenta anexar → 403', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    // Simular Participante como M9999 (outro usuário sem papel específico)
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, ...evidenciaValida() },
      { auth: { username: 'M9999', password: '' }, validateStatus: () => true }
    );
    expect(r.status).toBe(403);
  });

  it('CA23: Usuário comum autenticado sem papel tenta anexar → 403', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    // Simular usuário comum
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, ...evidenciaValida() },
      { auth: { username: 'usuario-comum', password: '' }, validateStatus: () => true }
    );
    expect(r.status).toBe(403);
  });

  // ===== CA27: Ação Cancelada não permite anexo =====
  it('CA27: Ação Cancelada não permite anexo → 409', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    await cds.db.run(UPDATE.entity(ACOES).set({ status: 'Cancelada' }).where({ codigo: a }));
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida() }, comoGestor);
    expect(r.status).toBe(409);
    expect((r.data as ErrorResponse).error?.message).toContain('Ação Cancelada não pode ser alterada');
  });

  // ===== CA51: Histórico registra tipo MIME, tamanho e autor sem copiar nome do arquivo =====
  it('CA51: Histórico registra MIME, tamanho e autor, sem Nome do arquivo', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const buf = gerarPDF(2000);
    const r = await anexarEvidencia(
      enviar,
      t,
      {
        acao: a,
        nomeArquivo: 'relatorio_secreto.pdf',
        mimeType: 'application/pdf',
        conteudo: buf,
        descricao: 'Relatório',
      },
      comoGestor
    );
    expect(r.status).toBe(200);
    const historico = await historicoAcao(a);
    const ev = historico.find((h) => h.evento === 'InclusaoEvidencia');
    expect(ev).toBeDefined();
    expect(ev?.mimeType).toBe('application/pdf');
    expect(ev?.tamanho).toBe(2000);
    expect(ev?.autor).toBe('gestor'); // Matrícula do usuário autenticado
    expect((ev as Record<string, unknown>)?.nomeArquivo).toBeUndefined(); // NÃO deve estar no histórico
  });

  // ===== CA53: Falha na gravação após salvar binário aciona compensação =====
  it('CA53: Falha no histórico após salvar binário → compensação apaga arquivo', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const buf = gerarPDF(1500);
    // Simula falha no próximo armazenamento (será revertida no catch por compensação)
    falharProximoArmazenamento();
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ conteudo: buf }) }, comoGestor);
    // Esperamos que a operação falhe
    expect(r.status).toBeGreaterThanOrEqual(400);
    // Confirma que nenhum arquivo ficou órfão no repositório
    // (Nota: sem acesso direto aos UUIDs gerados, usamos o fato de que o repositório continua vazio)
    const evidenciasGravadas = await evidenciasDe(a);
    expect(evidenciasGravadas.length).toBe(0);
  });

  // ===== CA55: Duas inclusões simultâneas da 10ª evidência (serialização D9) =====
  it('CA55: Duas inclusões simultâneas da 10ª evidência resultam em uma 200 e uma 409', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    // Anexa 9 evidências
    for (let i = 1; i <= 9; i++) {
      await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: `arquivo_${i}.pdf` }) }, comoGestor);
    }
    // Dispara duas requisições "simultâneas" tentando anexar a 10ª e a 11ª
    // (Na sequência, devido à D9, uma será 200 e a outra 409)
    const r1 = anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: 'arquivo_10.pdf' }) }, comoGestor);
    const r2 = anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ nomeArquivo: 'arquivo_11.pdf' }) }, comoGestor);
    const [res1, res2] = await Promise.all([r1, r2]);
    // Uma deve ser sucesso (200), outra deve ser limite atingido (409)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
    // Confirma que a Ação tem exatamente 10 evidências ativas
    expect((await evidenciasDe(a)).length).toBe(10);
  });

  // ===== CA56: 401 para não autenticado =====
  it('CA56: Usuário não autenticado recebe 401', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, ...evidenciaValida() },
      { validateStatus: () => true } // Sem autenticação
    );
    expect(r.status).toBe(401);
  });

  // ===== CA57: Aplicativo com arquivo inválido em Tratativa inexistente → 403 antes de 404 =====
  it('CA57: Aplicativo com arquivo inválido em Tratativa inexistente → 403 (papel precede existência)', async () => {
    const tratativaInexistente = '00000000-0000-0000-0000-000000000099';
    const r = await anexarEvidencia(
      enviar,
      tratativaInexistente,
      { acao: '00000000-0000-0000-0000-000000000099', ...evidenciaValida({ conteudo: gerarAcimaDe10MB() }) },
      comoApp
    );
    // Esperamos 403 (papel do aplicativo) antes de 404 (não encontrada)
    expect(r.status).toBe(403);
  });

  // ===== CA57a: Aplicativo com código malformado de sintaxe válida (ex.: "xyz") → 403 =====
  it("CA57a: Aplicativo com código malformado de sintaxe válida (xyz) → 403 (papel precede código)", async () => {
    const t = await nova();
    const r = await anexarEvidencia(
      enviar,
      t,
      {
        acao: 'xyz', // Código malformado de sintaxe válida (não é um UUID)
        ...evidenciaValida(),
      },
      comoApp
    );
    // Esperamos 403 (papel do aplicativo) antes de 400 (código inválido)
    expect(r.status).toBe(403);
  });

  // ===== CA57b: Corpo HTTP > 20 MB (arquivo > ~15 MB) → 413 do runtime =====
  it('CA57b: Arquivo > ~15 MB (corpo > 20 MB) → 413 do runtime antes do handler', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    // Gera arquivo de 19 MB (Base64 expandirá para ~25 MB, excedendo 20 MB)
    const buf = Buffer.alloc(19 * 1024 * 1024, 'X');
    const r = await anexarEvidencia(enviar, t, { acao: a, ...evidenciaValida({ conteudo: buf }) }, comoGestor);
    // O runtime rejeita com 413 antes do handler
    expect(r.status).toBe(413);
  });

  // ===== CA58: Arquivo inválido + Tratativa inexistente → 404 (existência precede campos) =====
  it('CA58: Arquivo com formato inválido + Tratativa inexistente → 404 (existência precede campos)', async () => {
    const tratativaInexistente = '00000000-0000-0000-0000-000000000099';
    const r = await anexarEvidencia(
      enviar,
      tratativaInexistente,
      {
        acao: '00000000-0000-0000-0000-000000000099',
        ...evidenciaValida({ conteudo: gerarAcimaDe10MB() }),
      },
      comoGestor
    );
    // Esperamos 404 (existência na etapa 5) antes de 413 (campos na etapa 10)
    expect(r.status).toBe(404);
  });

  // ===== CA59: Arquivo inválido + Tratativa Encerrada → 409 (estado precede campos) =====
  it('CA59: Arquivo com formato inválido em Tratativa Encerrada → 409 (estado precede campos)', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const rConcluir = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(rConcluir.status).toBe(204);
    const rEncerrar = await mudarStatus(enviar, t, { status: 'Encerrada' }, comoGestor);
    expect(rEncerrar.status).toBe(204);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, ...evidenciaValida({ conteudo: gerarAcimaDe10MB() }) },
      comoGestor
    );
    // Esperamos 409 (estado da Tratativa na etapa 7) antes de 413 (campos na etapa 10)
    expect(r.status).toBe(409);
    expect((r.data as ErrorResponse).error?.message).toContain('Tratativa Encerrada não pode ser alterada');
  });

  // ===== CA59a: Arquivo de 10.485.761 bytes → 413 do domínio =====
  it('CA59a: Arquivo de 10.485.761 bytes → 413 do domínio', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, ...evidenciaValida({ conteudo: gerarAcimaDe10MB() }) },
      comoGestor
    );
    // Esperamos 413 (tamanho na etapa 10)
    expect(r.status).toBe(413);
    expect((r.data as ErrorResponse).error?.message).toContain('Arquivo excede o tamanho máximo permitido');
    expect((r.data as ErrorResponse).error?.target).toBe('arquivo');
  });

  // ===== CA60: Arquivo válido + Tratativa ou Ação inexistente → 404 =====
  it('CA60: Arquivo válido + Ação inexistente → 404', async () => {
    const t = await nova();
    const acaoInexistente = '00000000-0000-0000-0000-000000000099';
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: acaoInexistente, ...evidenciaValida() },
      comoGestor
    );
    // Esperamos 404 (Ação não encontrada na etapa 5)
    expect(r.status).toBe(404);
  });

  // ===== CA62: Usuário sem permissão + descrição inválida → 403 (permissão precede campos) =====
  it('CA62: Usuário sem permissão + descrição > 500 → 403 (autorização precede campos)', async () => {
    const t = await nova();
    const a = await novaAcao(t, 'M1001');
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, ...evidenciaValida({ descricao: 'X'.repeat(600) }) },
      comoM2002 // Usuário sem permissão (não é Gestor nem Responsável da Ação)
    );
    // Esperamos 403 (autorização na etapa 6) antes de 400 (campos na etapa 10)
    expect(r.status).toBe(403);
  });

  // ===== CA63: Gestor + descrição inválida + Tratativa Encerrada → 409 (estado precede campos) =====
  it('CA63: Gestor + descrição > 500 + Tratativa Encerrada → 409 (estado precede campos)', async () => {
    const t = await nova();
    const a = await novaAcao(t);
    const rConcluir = await mudarStatusAcao(enviar, t, { acao: a, status: 'Concluída' }, comoGestor);
    expect(rConcluir.status).toBe(204);
    const rEncerrar = await mudarStatus(enviar, t, { status: 'Encerrada' }, comoGestor);
    expect(rEncerrar.status).toBe(204);
    const r = await anexarEvidencia(
      enviar,
      t,
      { acao: a, ...evidenciaValida({ descricao: 'X'.repeat(600) }) },
      comoGestor
    );
    // Esperamos 409 (estado da Tratativa na etapa 7) antes de 400 (campos na etapa 10)
    expect(r.status).toBe(409);
    expect((r.data as ErrorResponse).error?.message).toContain('Tratativa Encerrada não pode ser alterada');
  });
});
