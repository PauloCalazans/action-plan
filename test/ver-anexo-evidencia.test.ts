import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarAcao, criarSubacao, mudarStatusAcao } from './apoio/acoes';
import { limparArmazenamento } from './apoio/armazenamento-espiao';
import { comoValidador } from './apoio/aval';
import { linhas } from './apoio/banco';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { encerrarComAval } from './apoio/encerramento';
import {
  anexarEvidencia,
  baixarEvidencia,
  gerarCSV,
  gerarDOCX,
  gerarJPG,
  gerarPDF,
  gerarPNG,
  gerarTXT,
  type Consulta,
} from './apoio/evidencias';
import { atribuirResponsavelPrincipal, incluirParticipante } from './apoio/responsaveis';
import { abrirPorApp, criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM1001, comoM2002, comoM9999, comoUsuario, semAuth } from './apoio/usuarios';

// Acesso ao anexo da Evidência pela tabela do App (/api/app/v1): propriedade de mídia `conteudo`
// nos DOIS caminhos do Fiori elements (direto e por contenção). Autorização, 404 e auditoria seguem o download 006.
const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;
const BASE = '/api/app/v1';
const NS = 'br.com.calazanstec.';
const ZERO = '00000000-0000-4000-8000-000000000000';
const OUTRA_TRATATIVA = '00000000-0000-4000-8000-0000000000aa';
const PRAZO = '2027-01-01';

jest.setTimeout(180000);

type Via = 'direto' | 'contencao';
const VIAS: Via[] = ['direto', 'contencao'];
type Linha = Record<string, unknown>;

const comoMatricula = (matricula: string) => ({
  auth: { username: matricula, password: '' },
  validateStatus: () => true,
});
const comoM3003 = comoMatricula('M3003');

let espiao: Espiao;

beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});

afterEach(() => espiao.naoFalhar());
afterAll(() => limparArmazenamento());

// ---------------------------------------------------------------------------------------------------------------
// Acesso HTTP ao stream (corpo cru: o conteúdo binário não pode passar por parse de texto)
// ---------------------------------------------------------------------------------------------------------------
type Fluxo = { status: number; headers: Record<string, string>; corpo: Buffer };
type RespostaCrua = { status: number; headers: Record<string, unknown>; data: unknown };
type GetCru = (url: string, config?: Record<string, unknown>) => Promise<RespostaCrua>;

const urlConteudo = (via: Via, tratativa: string, evidencia: string) =>
  via === 'direto'
    ? `${BASE}/Evidencias(${evidencia})/conteudo`
    : `${BASE}/Tratativas(${tratativa})/evidencias(${evidencia})/conteudo`;

async function abrir(via: Via, tratativa: string, evidencia: string, como: Record<string, unknown>): Promise<Fluxo> {
  return abrirUrl(urlConteudo(via, tratativa, evidencia), como);
}

async function abrirUrl(url: string, como: Record<string, unknown>): Promise<Fluxo> {
  const r = await (GET as unknown as GetCru)(url, { ...como, responseType: 'arraybuffer' });
  const corpo = Buffer.isBuffer(r.data)
    ? r.data
    : Buffer.from(typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? ''));
  const headers: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(r.headers ?? {})) headers[chave.toLowerCase()] = String(valor);
  return { status: r.status, headers, corpo };
}

function mensagemDe(f: Fluxo): string | undefined {
  try {
    return (JSON.parse(f.corpo.toString('utf8')) as { error?: { message?: string } }).error?.message;
  } catch {
    return undefined;
  }
}

const tipoDe = (f: Fluxo) => (f.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();

function exigir(resposta: { status: number }, esperado: number, passo: string): void {
  if (resposta.status !== esperado) throw new Error(`${passo}: HTTP ${resposta.status} (esperado ${esperado}).`);
}

// ---------------------------------------------------------------------------------------------------------------
// Preparo de cenário (domínio /api/tratativa/v1; cada passo confere o status)
// ---------------------------------------------------------------------------------------------------------------
async function novaTratativa(): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Tratativa de anexo ${sufixoUnico()}` });
  exigir(r, 200, 'criar Tratativa');
  return r.data.codigo as string;
}

async function novaAcao(tratativa: string, responsavel: string): Promise<string> {
  const r = await criarAcao(
    enviar,
    tratativa,
    { descricao: `Ação ${sufixoUnico()}`, responsavel, prazo: PRAZO, prioridade: 'Alta' },
    comoGestor,
  );
  exigir(r, 200, 'criar Ação');
  return r.data.codigo as string;
}

async function novaSubacao(tratativa: string, mae: string, responsavel: string): Promise<string> {
  const r = await criarSubacao(
    enviar,
    tratativa,
    { acaoMae: mae, descricao: `Subação ${sufixoUnico()}`, responsavel, prazo: PRAZO, prioridade: 'Média' },
    comoGestor,
  );
  exigir(r, 200, 'criar Subação');
  return r.data.codigo as string;
}

async function anexar(
  tratativa: string,
  acao: string,
  nomeArquivo: string,
  mimeType: string,
  conteudo: Buffer,
): Promise<string> {
  const r = await anexarEvidencia(
    enviar,
    tratativa,
    { acao, nomeArquivo, mimeType, conteudo, descricao: 'Evidência do cenário' },
    comoGestor,
  );
  exigir(r, 200, `anexar ${nomeArquivo}`);
  return r.data.codigo as string;
}

async function remover(tratativa: string, acao: string, evidencia: string): Promise<void> {
  const r = await POST(`/api/tratativa/v1/Tratativas(${tratativa})/removerEvidencia`, { acao, evidencia }, comoGestor);
  exigir(r, 204, 'remover Evidência');
}

async function levarAcao(tratativa: string, acao: string, status: string, justificativa?: string): Promise<void> {
  const r = await mudarStatusAcao(enviar, tratativa, { acao, status, justificativa }, comoGestor);
  exigir(r, 204, `levar a Ação a ${status}`);
}

const eventosDownload = async (acao: string) => linhas('HistoricoAcoes', { acao_codigo: acao, evento: 'DownloadEvidencia' });

const pdf = (marca: number) => Buffer.concat([gerarPDF(300), Buffer.from(`marca-${marca}`)]);

// Formatos do dado de demonstração (nomes de test/demo): [nome, mimeType, conteúdo, disposição esperada].
type Formato = [string, string, Buffer, 'inline' | 'attachment'];
const FORMATOS: Formato[] = [
  ['foto-guarda-corpo-reapertado.png', 'image/png', gerarPNG(500), 'inline'],
  ['foto-bloqueio-eletrico.jpg', 'image/jpeg', gerarJPG(520), 'inline'],
  ['lista-presenca-integracao.pdf', 'application/pdf', gerarPDF(540), 'inline'],
  ['os-troca-mangueira.txt', 'text/plain', gerarTXT(560), 'inline'],
  ['certificados-calibracao.csv', 'text/csv', gerarCSV(580), 'attachment'],
  [
    'procedimento-revisado.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    gerarDOCX(600),
    'attachment',
  ],
  [
    'controle-epi.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    gerarDOCX(620),
    'attachment',
  ],
];

// Cenário de papéis: Tratativa com Responsável Principal (M9999) e Participante (M3003); A1 (M1001), A2 (M2002),
// A3 (M3003, com os formatos), Subação S1 de A1 (M2002).
type Cenario = {
  tratativa: string;
  a1: string;
  a2: string;
  a3: string;
  s1: string;
  e1: string;
  e1Conteudo: Buffer;
  e2: string;
  eS: string;
  removida: string;
  formatos: Array<{ codigo: string; nome: string; mime: string; conteudo: Buffer; disposicao: string }>;
};
let c: Cenario;

async function montarCenario(): Promise<Cenario> {
  const tratativa = await novaTratativa();
  exigir(
    await atribuirResponsavelPrincipal(
      enviar,
      tratativa,
      { responsavelPrincipal: 'M9999', justificativa: 'Responsável principal do cenário' },
      comoGestor,
    ),
    204,
    'atribuir Responsável Principal',
  );
  exigir(await incluirParticipante(enviar, tratativa, { participante: 'M3003' }, comoGestor), 204, 'incluir Participante');
  const a1 = await novaAcao(tratativa, 'M1001');
  const a2 = await novaAcao(tratativa, 'M2002');
  const a3 = await novaAcao(tratativa, 'M3003');
  const s1 = await novaSubacao(tratativa, a1, 'M2002');
  const e1Conteudo = pdf(1);
  const e1 = await anexar(tratativa, a1, `a1_${sufixoUnico()}.pdf`, 'application/pdf', e1Conteudo);
  const e2 = await anexar(tratativa, a2, `a2_${sufixoUnico()}.pdf`, 'application/pdf', pdf(2));
  const eS = await anexar(tratativa, s1, `s1_${sufixoUnico()}.pdf`, 'application/pdf', pdf(3));
  const removida = await anexar(tratativa, a1, `removida_${sufixoUnico()}.pdf`, 'application/pdf', pdf(4));
  await remover(tratativa, a1, removida);
  const formatos: Cenario['formatos'] = [];
  for (const [nome, mime, conteudo, disposicao] of FORMATOS) {
    formatos.push({ codigo: await anexar(tratativa, a3, nome, mime, conteudo), nome, mime, conteudo, disposicao });
  }
  return { tratativa, a1, a2, a3, s1, e1, e1Conteudo, e2, eS, removida, formatos };
}

beforeAll(async () => {
  c = await montarCenario();
});

const ATIVAS = () => [c.e1, c.e2, c.eS, ...c.formatos.map((f) => f.codigo)];

// ---------------------------------------------------------------------------------------------------------------
// Acesso ao stream, nos dois caminhos
// ---------------------------------------------------------------------------------------------------------------
describe.each(VIAS)('Acesso ao anexo pelo caminho %s', (via) => {
  // CA2, CA3, CA4, CA5 (R2)
  it.each(FORMATOS.map((f) => f[0]))('CA2-CA5: Gestor abre %s com conteúdo, tipo, disposição e nome gravados', async (nome) => {
    const f = c.formatos.find((x) => x.nome === nome);
    if (!f) throw new Error(`formato ${nome} ausente do cenário`);

    const r = await abrir(via, c.tratativa, f.codigo, comoGestor);

    expect(r.status).toBe(200);
    expect(tipoDe(r)).toBe(f.mime);
    expect(r.headers['content-disposition']).toBe(`${f.disposicao}; filename="${encodeURIComponent(f.nome)}"`);
    expect(r.corpo.equals(f.conteudo)).toBe(true);
  });

  // CA6 (R4)
  it('CA6: Responsável da Ação, Responsável da Subação e Validador Técnico habilitado recebem o arquivo', async () => {
    const respAcao = await abrir(via, c.tratativa, c.e1, comoM1001);
    const respSubacao = await abrir(via, c.tratativa, c.eS, comoM2002);
    const validador = await abrir(via, c.tratativa, c.e1, comoValidador);

    for (const r of [respAcao, validador]) {
      expect(r.status).toBe(200);
      expect(r.corpo.equals(c.e1Conteudo)).toBe(true);
    }
    expect(respSubacao.status).toBe(200);
    expect(respSubacao.corpo.equals(pdf(3))).toBe(true);
  });

  it('CA6: segregação Ação mãe × Subação: cada Responsável recebe 403 no anexo do outro', async () => {
    const maeNaSubacao = await abrir(via, c.tratativa, c.eS, comoM1001);
    const subacaoNaMae = await abrir(via, c.tratativa, c.e1, comoM2002);

    for (const r of [maeNaSubacao, subacaoNaMae]) {
      expect(r.status).toBe(403);
      expect(mensagemDe(r)).toBe('Acesso negado.');
      expect(r.corpo.includes(Buffer.from('%PDF'))).toBe(false);
    }
  });

  // CA7, CA13, CA14 (R4, R8)
  it.each([
    ['usuário comum', comoUsuario],
    ['Responsável Principal sem papel na Ação', comoM9999],
    ['Participante sem papel na Ação', comoM3003],
  ])('CA7: %s recebe 403 "Acesso negado." sem nenhum byte do arquivo', async (_rotulo, como) => {
    const antes = (await eventosDownload(c.a1)).length;

    const r = await abrir(via, c.tratativa, c.e1, como as Record<string, unknown>);

    expect(r.status).toBe(403);
    expect(mensagemDe(r)).toBe('Acesso negado.');
    expect(r.corpo.includes(Buffer.from('marca-1'))).toBe(false);
    expect(r.corpo.toString('utf8')).not.toMatch(/stack|node_modules|\.ts:\d+/);
    expect((await eventosDownload(c.a1)).length).toBe(antes);
  });

  it('CA13: Responsável de A1 acessando direto a Evidência de A2 recebe 403 "Acesso negado."', async () => {
    const r = await abrir(via, c.tratativa, c.e2, comoM1001);

    expect(r.status).toBe(403);
    expect(mensagemDe(r)).toBe('Acesso negado.');
  });

  // CA8
  it('CA8: Aplicativo de origem recebe 403 e não autenticado recebe 401', async () => {
    const app = await abrir(via, c.tratativa, c.e1, comoApp);
    const anonimo = await abrir(via, c.tratativa, c.e1, semAuth);

    expect(app.status).toBe(403);
    expect(mensagemDe(app)).toBe('Acesso negado.');
    expect(anonimo.status).toBe(401);
    expect(anonimo.corpo.includes(Buffer.from('marca-1'))).toBe(false);
  });

  // CA9 (R3)
  it('CA9: Evidência removida dá 404 "Evidência não encontrada." para o Gestor e para quem não tem vínculo', async () => {
    const antes = (await eventosDownload(c.a1)).length;

    const gestor = await abrir(via, c.tratativa, c.removida, comoGestor);
    const terceiro = await abrir(via, c.tratativa, c.removida, comoUsuario);

    for (const r of [gestor, terceiro]) {
      expect(r.status).toBe(404);
      expect(mensagemDe(r)).toBe('Evidência não encontrada.');
    }
    expect((await eventosDownload(c.a1)).length).toBe(antes);
  });

  it.each([
    ['inexistente', ZERO],
    ['com chave não UUID', 'xyz'],
  ])('CA9: Evidência %s dá 404 "Evidência não encontrada."', async (_rotulo, chave) => {
    const r = await abrir(via, c.tratativa, chave, comoGestor);

    expect(r.status).toBe(404);
    expect(mensagemDe(r)).toBe('Evidência não encontrada.');
  });

  // CA10 (R6)
  it('CA10: acesso aceito grava DownloadEvidencia com evidência, tipo e tamanho, sem Nome do arquivo nem conteúdo', async () => {
    const f = c.formatos[2];
    const antes = (await eventosDownload(c.a3)).filter((h) => h.evidencia === f.codigo).length;

    const r = await abrir(via, c.tratativa, f.codigo, comoGestor);

    expect(r.status).toBe(200);
    const novos = (await eventosDownload(c.a3)).filter((h) => h.evidencia === f.codigo);
    expect(novos).toHaveLength(antes + 1);
    const evento = novos[novos.length - 1];
    expect(evento.mimeType).toBe(f.mime);
    expect(evento.tamanho).toBe(f.conteudo.length);
    expect(evento.autor).toBe('gestor');
    const serializado = JSON.stringify(evento);
    expect(serializado).not.toContain(f.nome);
    expect(serializado).not.toContain(f.conteudo.toString('base64'));
  });

  // CA11 (R6)
  it('CA11: falha ao gravar a auditoria aborta o pedido sem entregar nenhum byte e sem evento parcial', async () => {
    const controle = await abrir(via, c.tratativa, c.e1, comoGestor);
    expect(controle.status).toBe(200);
    const antes = (await eventosDownload(c.a1)).length;

    espiao.falharEm('CREATE', `${NS}HistoricoAcoes`);
    const r = await abrir(via, c.tratativa, c.e1, comoGestor);

    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(r.corpo.includes(Buffer.from('marca-1'))).toBe(false);
    expect(r.corpo.includes(Buffer.from('%PDF'))).toBe(false);
    expect((await eventosDownload(c.a1)).length).toBe(antes);
  });

  // CA18 (R11) e CA15 (R9)
  it('CA18: Tratativa de Origem e Tratativa avulsa se comportam de forma idêntica', async () => {
    const comOrigem = await abrirPorApp(enviar, { origem: 'Registro de Acidente' });
    exigir(comOrigem, 200, 'abrir Tratativa com Origem');
    const tOrigem = comOrigem.data.codigo as string;
    const aOrigem = await novaAcao(tOrigem, 'M1001');
    const conteudo = pdf(18);
    const eOrigem = await anexar(tOrigem, aOrigem, `origem_${sufixoUnico()}.pdf`, 'application/pdf', conteudo);

    const gestor = await abrir(via, tOrigem, eOrigem, comoGestor);
    const responsavel = await abrir(via, tOrigem, eOrigem, comoM1001);
    const terceiro = await abrir(via, tOrigem, eOrigem, comoUsuario);

    expect(gestor.status).toBe(200);
    expect(gestor.corpo.equals(conteudo)).toBe(true);
    expect(responsavel.status).toBe(200);
    expect(terceiro.status).toBe(403);
  });

  it('CA15: Tratativa Cancelada: o acesso tem sucesso e é auditado', async () => {
    const t = await novaTratativa();
    const a = await novaAcao(t, 'M1001');
    const conteudo = pdf(15);
    const e = await anexar(t, a, `cancelada_${sufixoUnico()}.pdf`, 'application/pdf', conteudo);
    exigir(
      await mudarStatus(enviar, t, { status: 'Cancelada', justificativa: 'Cancelamento do cenário' }, comoGestor),
      204,
      'cancelar Tratativa',
    );
    const antes = (await eventosDownload(a)).length;

    const gestor = await abrir(via, t, e, comoGestor);
    const responsavel = await abrir(via, t, e, comoM1001);

    expect(gestor.status).toBe(200);
    expect(gestor.corpo.equals(conteudo)).toBe(true);
    expect(responsavel.status).toBe(200);
    expect((await eventosDownload(a)).length).toBe(antes + 2);
  });

  it('CA15: Tratativa Encerrada com Ação Concluída: o acesso tem sucesso e é auditado', async () => {
    const t = await novaTratativa();
    const a = await novaAcao(t, 'M1001');
    const conteudo = pdf(16);
    const e = await anexar(t, a, `encerrada_${sufixoUnico()}.pdf`, 'application/pdf', conteudo);
    await levarAcao(t, a, 'Em andamento');
    await levarAcao(t, a, 'Concluída');
    exigir(await encerrarComAval(enviar, t), 204, 'encerrar Tratativa');
    const antes = (await eventosDownload(a)).length;

    const gestor = await abrir(via, t, e, comoGestor);
    const responsavel = await abrir(via, t, e, comoM1001);

    expect(gestor.status).toBe(200);
    expect(gestor.corpo.equals(conteudo)).toBe(true);
    expect(responsavel.status).toBe(200);
    expect((await eventosDownload(a)).length).toBe(antes + 2);
  });

  it('CA15: Ação Cancelada em Tratativa em andamento: o acesso tem sucesso e é auditado', async () => {
    const t = await novaTratativa();
    const a = await novaAcao(t, 'M1001');
    const conteudo = pdf(17);
    const e = await anexar(t, a, `acao-cancelada_${sufixoUnico()}.pdf`, 'application/pdf', conteudo);
    await levarAcao(t, a, 'Em andamento');
    await levarAcao(t, a, 'Cancelada', 'Cancelamento do cenário');
    const antes = (await eventosDownload(a)).length;

    const r = await abrir(via, t, e, comoGestor);

    expect(r.status).toBe(200);
    expect(r.corpo.equals(conteudo)).toBe(true);
    expect((await eventosDownload(a)).length).toBe(antes + 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Caminho por contenção: chave da Tratativa divergente ou malformada
// ---------------------------------------------------------------------------------------------------------------
describe('Caminho por contenção com chave da Tratativa inconsistente', () => {
  it('Tratativa divergente da Evidência dá 404 "Evidência não encontrada." (mesmo para o Gestor)', async () => {
    const outra = await novaTratativa();

    const r = await abrir('contencao', outra, c.e1, comoGestor);
    const inexistente = await abrir('contencao', OUTRA_TRATATIVA, c.e1, comoGestor);

    for (const f of [r, inexistente]) {
      expect(f.status).toBe(404);
      expect(mensagemDe(f)).toBe('Evidência não encontrada.');
      expect(f.corpo.includes(Buffer.from('marca-1'))).toBe(false);
    }
  });

  it('Tratativa malformada dá 404 "Evidência não encontrada."', async () => {
    const r = await abrir('contencao', 'xyz', c.e1, comoGestor);

    expect(r.status).toBe(404);
    expect(mensagemDe(r)).toBe('Evidência não encontrada.');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// CA12, CA13 (R5, R7): listagens trazem o link de mídia, nunca o binário
// ---------------------------------------------------------------------------------------------------------------
describe('Listagens: link de mídia sem o conteúdo binário', () => {
  const lista = async (como: Record<string, unknown>) => {
    const r = await GET(`${BASE}/Tratativas(${c.tratativa})/evidencias`, como);
    return { status: r.status, valores: ((r.data as { value?: Linha[] }).value ?? []) as Linha[], bruto: r.data };
  };

  it('CA12/CA13: o Gestor vê todas as ativas, cada linha com conteudo@odata.mediaContentType igual ao mimeType e sem binário', async () => {
    const r = await lista(comoGestor);

    expect(r.status).toBe(200);
    expect(r.valores.map((l) => l.codigo).sort()).toEqual(ATIVAS().sort());
    for (const linha of r.valores) {
      expect(linha['conteudo@odata.mediaContentType']).toBe(linha.mimeType);
      expect(linha).not.toHaveProperty('conteudo');
    }
    const texto = JSON.stringify(r.bruto);
    expect(texto).not.toContain(c.e1Conteudo.toString('base64'));
    for (const f of c.formatos) expect(texto).not.toContain(f.conteudo.toString('base64'));
  });

  it('CA13: o Responsável da Ação vê só as linhas da sua Ação, com o link e autorAnexo mascarado', async () => {
    const r = await lista(comoM1001);

    expect(r.status).toBe(200);
    expect(r.valores.map((l) => l.codigo)).toEqual([c.e1]);
    expect(r.valores[0]['conteudo@odata.mediaContentType']).toBe('application/pdf');
    expect(r.valores[0].autorAnexo).toBeNull();
  });

  it('CA13: o Validador Técnico vê todas as ativas com o link, e usuário sem vínculo vê a tabela vazia', async () => {
    const validador = await lista(comoValidador);
    const terceiro = await lista(comoUsuario);

    expect(validador.status).toBe(200);
    expect(validador.valores.map((l) => l.codigo).sort()).toEqual(ATIVAS().sort());
    for (const linha of validador.valores) {
      expect(linha['conteudo@odata.mediaContentType']).toBe(linha.mimeType);
      expect(linha.autorAnexo).toBeNull();
    }
    expect(terceiro.status).toBe(200);
    expect(terceiro.valores).toEqual([]);
  });

  it('CA12: $expand=evidencias não traz o binário e mantém o link de mídia nas linhas', async () => {
    const r = await GET(`${BASE}/Tratativas(${c.tratativa})?$expand=evidencias`, comoGestor);

    expect(r.status).toBe(200);
    const evidencias = ((r.data as { evidencias?: Linha[] }).evidencias ?? []) as Linha[];
    expect(evidencias).toHaveLength(ATIVAS().length);
    for (const linha of evidencias) {
      expect(linha['conteudo@odata.mediaContentType']).toBe(linha.mimeType);
      expect(linha).not.toHaveProperty('conteudo');
    }
    expect(JSON.stringify(r.data)).not.toContain(c.e1Conteudo.toString('base64'));
  });

  it('CA12: a listagem direta de Evidencias traz o link de mídia e nunca o binário', async () => {
    const r = await GET(`${BASE}/Evidencias`, comoGestor);

    expect(r.status).toBe(200);
    const valores = (r.data as { value: Linha[] }).value;
    const doCenario = valores.filter((l) => ATIVAS().includes(l.codigo as string));
    expect(doCenario).toHaveLength(ATIVAS().length);
    for (const linha of valores) {
      expect(linha['conteudo@odata.mediaContentType']).toBe(linha.mimeType);
      expect(linha).not.toHaveProperty('conteudo');
    }
  });

  it('CA12: autorAnexo continua visível ao Gestor e mascarado para quem não é Gestor', async () => {
    const gestor = await lista(comoGestor);
    const responsavel = await lista(comoM1001);

    expect(gestor.valores.every((l) => l.autorAnexo === 'gestor')).toBe(true);
    expect(responsavel.valores.every((l) => l.autorAnexo === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Contrato estático (EDMX e anotações da tela)
// ---------------------------------------------------------------------------------------------------------------
function blocoEdmx(xml: string, abertura: string, fechamento: string): string {
  const inicio = xml.indexOf(abertura);
  if (inicio === -1) return '';
  const fim = xml.indexOf(fechamento, inicio);
  return xml.slice(inicio, fim === -1 ? xml.length : fim);
}

describe('Contrato estático', () => {
  it('EDMX: Evidencias expõe conteudo como Edm.Stream com Core.MediaType e Core.ContentDisposition', async () => {
    const r = await GET(`${BASE}/$metadata`, comoGestor);
    const xml = String(r.data);

    expect(r.status).toBe(200);
    const tipo = blocoEdmx(xml, '<EntityType Name="Evidencias">', '</EntityType>');
    expect(tipo).toMatch(/<Property Name="conteudo" Type="Edm\.Stream"/);
    const anotacoes = blocoEdmx(xml, 'Target="TratativaAppService.Evidencias/conteudo"', '</Annotations>');
    expect(anotacoes).toContain('Core.MediaType');
    expect(anotacoes).toContain('Path="mimeType"');
    expect(anotacoes).toContain('Core.ContentDisposition');
    expect(anotacoes).toContain('Path="nomeArquivo"');
  });

  it('CA17: a única propriedade de stream do /api/app/v1 é a de Evidencias; Administração não expõe stream', async () => {
    const app = String((await GET(`${BASE}/$metadata`, comoGestor)).data);
    const admin = String((await GET('/api/administracao/v1/$metadata', comoGestor)).data);

    expect(app.match(/Type="Edm\.Stream"/g) ?? []).toHaveLength(1);
    expect(blocoEdmx(app, '<EntityType Name="MinhasAcoes">', '</EntityType>')).not.toContain('Edm.Stream');
    expect(admin.match(/Type="Edm\.Stream"/g) ?? []).toHaveLength(0);
  });

  it('Tela: UI.LineItem de Evidencias usa conteudo no lugar de nomeArquivo, com o título "Nome do arquivo"', () => {
    const caminho = join(__dirname, '..', 'app', 'tratativas', 'annotations.cds');
    expect(existsSync(caminho)).toBe(true);
    const fonte = readFileSync(caminho, 'utf8');
    const inicio = fonte.indexOf('annotate TratativaAppService.Evidencias with @(');
    const lineItem = fonte.slice(inicio, fonte.indexOf(');', inicio));

    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(lineItem).toMatch(/\$Type:\s*'UI\.DataField',\s*Value:\s*conteudo\b/);
    expect(lineItem).not.toMatch(/Value:\s*nomeArquivo\b/);
    expect(fonte).toMatch(/annotate TratativaAppService\.Evidencias with \{[^}]*conteudo\s+@title:\s*'Nome do arquivo'/s);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Regressão: o download existente do TratativaService permanece como antes (CA14, CA16)
// ---------------------------------------------------------------------------------------------------------------
describe('Regressão: TratativaService.baixarEvidencia', () => {
  it('Gestor continua recebendo 200 com o conteúdo em Base64', async () => {
    const r = await baixarEvidencia(consultar, c.tratativa, c.a1, c.e1, comoGestor);

    expect(r.status).toBe(200);
    expect(r.data.conteudo).toBe(c.e1Conteudo.toString('base64'));
  });

  it('terceiro continua recebendo 403 "Forbidden"', async () => {
    const r = await baixarEvidencia(consultar, c.tratativa, c.a1, c.e1, comoUsuario);

    expect(r.status).toBe(403);
    expect((r.data as { error?: { message?: string } }).error?.message).toBe('Forbidden');
  });
});
