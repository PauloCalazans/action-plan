import cds from '@sap/cds';
import { criarAcao, criarSubacao, mudarStatusAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import {
  anexarEvidencia as anexarNoDominio,
  gerarAcimaDe10MB,
  gerarExatamente10MB,
  gerarExecutavel,
  gerarPDF,
  gerarPNG,
} from './apoio/evidencias';
import { atribuirResponsavelPrincipal, incluirParticipante } from './apoio/responsaveis';
import { abrirPorApp, criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM1001, comoM2002, comoM9999, comoUsuario, semAuth } from './apoio/usuarios';

// Operações de linha no TratativaAppService (/api/app/v1): Ação e Evidência acionadas pela linha selecionada.
// Cada operação é exercitada pelos DOIS caminhos (direto e por contenção), como o Fiori elements as invoca
// (design, decisão 2; revisão r1, C1).
const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/app/v1';
const ZERO = '00000000-0000-4000-8000-000000000000';
const PRAZO = '2027-01-01';
const NS = 'br.com.calazanstec.';
const MSG_FORMATO =
  'Tipo de arquivo não permitido: envie imagem (JPG, PNG), PDF, documento (DOCX, DOC, TXT) ou planilha (XLSX, XLS, CSV).';

jest.setTimeout(120000);

type Linha = Record<string, unknown>;
type Via = 'direto' | 'contencao';
const VIAS: Via[] = ['direto', 'contencao'];
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

// ---------------------------------------------------------------------------------------------------------------
// Caminhos e corpos
// ---------------------------------------------------------------------------------------------------------------
const urlAcao = (via: Via, tratativa: string, acao: string, operacao: string) =>
  via === 'direto'
    ? `${BASE}/Acoes(${acao})/${operacao}`
    : `${BASE}/Tratativas(${tratativa})/acoes(${acao})/${operacao}`;

const urlEvidencia = (via: Via, tratativa: string, evidencia: string, operacao: string) =>
  via === 'direto'
    ? `${BASE}/Evidencias(${evidencia})/${operacao}`
    : `${BASE}/Tratativas(${tratativa})/evidencias(${evidencia})/${operacao}`;

const SUBACAO = {
  descricao: 'Subação de linha',
  responsavel: 'M2002',
  prazo: PRAZO,
  prioridade: 'Média',
  evidenciaObrigatoria: 'não',
};
const DELEGACAO = { novoResponsavel: 'M2002', justificativa: 'Redistribuição de carga' };
const COMENTARIO = { texto: 'Comentário de linha', mencoes: [] as string[] };

function anexo(nome: string, mimeType: string, conteudo: Buffer, descricao = 'Evidência de teste') {
  return { nomeArquivo: nome, mimeType, conteudo: conteudo.toString('base64'), descricao };
}
const anexoPdf = () => anexo(`doc_${sufixoUnico()}.pdf`, 'application/pdf', gerarPDF(400));

// Operações que recebem a Ação da linha (nome, corpo válido).
const OPERACOES_DE_ACAO: Array<[string, () => Record<string, unknown>]> = [
  ['criarSubacao', () => ({ ...SUBACAO })],
  ['delegarAcao', () => ({ ...DELEGACAO })],
  ['anexarEvidencia', anexoPdf],
  ['comentarAcao', () => ({ ...COMENTARIO })],
];

function erroDe(dados: unknown): { message?: string; target?: string } | undefined {
  return (dados as { error?: { message?: string; target?: string } }).error;
}

// ---------------------------------------------------------------------------------------------------------------
// Preparo de cenário (domínio /api/tratativa/v1; cada passo confere o status)
// ---------------------------------------------------------------------------------------------------------------
function exigir(resposta: { status: number }, esperado: number, passo: string): void {
  if (resposta.status !== esperado) throw new Error(`${passo}: HTTP ${resposta.status} (esperado ${esperado}).`);
}

async function novaTratativa(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Tratativa de linha ${sufixoUnico()}`, ...dados });
  exigir(r, 200, 'criar Tratativa');
  return r.data.codigo as string;
}

async function novaAcao(tratativa: string, responsavel = 'M1001'): Promise<string> {
  const r = await criarAcao(
    enviar,
    tratativa,
    { descricao: `Ação ${sufixoUnico()}`, responsavel, prazo: PRAZO, prioridade: 'Alta' },
    comoGestor,
  );
  exigir(r, 200, 'criar Ação');
  return r.data.codigo as string;
}

async function novaSubacaoNoDominio(tratativa: string, mae: string, responsavel = 'M2002'): Promise<string> {
  const r = await criarSubacao(
    enviar,
    tratativa,
    { acaoMae: mae, descricao: `Subação ${sufixoUnico()}`, responsavel, prazo: PRAZO, prioridade: 'Média' },
    comoGestor,
  );
  exigir(r, 200, 'criar Subação');
  return r.data.codigo as string;
}

async function novaEvidencia(tratativa: string, acao: string): Promise<string> {
  const r = await anexarNoDominio(
    enviar,
    tratativa,
    {
      acao,
      nomeArquivo: `evidencia_${sufixoUnico()}.pdf`,
      mimeType: 'application/pdf',
      conteudo: gerarPDF(300),
      descricao: 'Evidência do cenário',
    },
    comoGestor,
  );
  exigir(r, 200, 'anexar Evidência');
  return r.data.codigo as string;
}

async function removerNoDominio(tratativa: string, acao: string, evidencia: string): Promise<void> {
  const r = await POST(
    `/api/tratativa/v1/Tratativas(${tratativa})/removerEvidencia`,
    { acao, evidencia },
    comoGestor,
  );
  exigir(r, 204, 'remover Evidência');
}

async function levarAcao(tratativa: string, acao: string, status: string): Promise<void> {
  const r = await mudarStatusAcao(enviar, tratativa, { acao, status }, comoGestor);
  exigir(r, 204, `levar a Ação a ${status}`);
}

async function cancelarTratativa(tratativa: string): Promise<void> {
  const r = await mudarStatus(
    enviar,
    tratativa,
    { status: 'Cancelada', justificativa: 'Cancelamento do cenário' },
    comoGestor,
  );
  exigir(r, 204, 'cancelar Tratativa');
}

async function contagens(tratativa: string) {
  const filtro = { tratativa_codigo: tratativa };
  return {
    acoes: (await linhas('Acoes', filtro)).length,
    evidencias: (await linhas('Evidencias', filtro)).length,
    comentarios: (await linhas('Comentarios', filtro)).length,
    historico: (await linhas('HistoricoAcoes', filtro)).length,
  };
}

async function eventosDa(acao: string): Promise<string[]> {
  const historico = await linhas('HistoricoAcoes', { acao_codigo: acao });
  return historico.map((linha) => String(linha.evento)).sort();
}

// Cenário de papéis: Tratativa com Responsável Principal (M9999) e Participante (M3003); A1 (M1001) e A2 (M2002).
type Papeis = { tratativa: string; a1: string; a2: string; e1: string; e2: string };
async function cenarioDePapeis(): Promise<Papeis> {
  const tratativa = await novaTratativa();
  const rp = await atribuirResponsavelPrincipal(
    enviar,
    tratativa,
    { responsavelPrincipal: 'M9999', justificativa: 'Responsável principal do cenário' },
    comoGestor,
  );
  exigir(rp, 204, 'atribuir Responsável Principal');
  const participante = await incluirParticipante(enviar, tratativa, { participante: 'M3003' }, comoGestor);
  exigir(participante, 204, 'incluir Participante');
  const a1 = await novaAcao(tratativa, 'M1001');
  const a2 = await novaAcao(tratativa, 'M2002');
  return { tratativa, a1, a2, e1: await novaEvidencia(tratativa, a1), e2: await novaEvidencia(tratativa, a2) };
}

// ---------------------------------------------------------------------------------------------------------------
// Operações de linha: sucesso, histórico e atomicidade (R1, R2, R17; CA3, CA15, CA18-CA22, CA31, CA33, CA34, CA41)
// ---------------------------------------------------------------------------------------------------------------
describe.each(VIAS)('Operações de linha pelo caminho %s', (via) => {
  it('CA3, CA31: Criar Subação na Ação da linha grava a Subação com a Ação mãe e o evento Criacao', async () => {
    const tratativa = await novaTratativa();
    const mae = await novaAcao(tratativa);

    const r = await POST(urlAcao(via, tratativa, mae, 'criarSubacao'), { ...SUBACAO }, comoGestor);

    expect(r.status).toBe(200);
    const sub = r.data.codigo as string;
    const [linha] = await linhas('Acoes', { codigo: sub });
    expect(linha).toMatchObject({ acaoMae_codigo: mae, tratativa_codigo: tratativa, responsavel: 'M2002' });
    const historico = await linhas('HistoricoAcoes', { acao_codigo: sub });
    expect(historico.map((h) => h.evento)).toEqual(['Criacao']);
    expect(historico[0]).toMatchObject({ autor: 'gestor', tipoAutor: 'Usuario' });
    expect(await eventosDa(mae)).toEqual(['Criacao']);
  });

  it('CA15: Criar Subação tendo uma Subação como Ação mãe é recusado (400, hierarquia de dois níveis) e nada é criado', async () => {
    const tratativa = await novaTratativa();
    const mae = await novaAcao(tratativa);
    const sub = await novaSubacaoNoDominio(tratativa, mae);
    const antes = await contagens(tratativa);

    const r = await POST(urlAcao(via, tratativa, sub, 'criarSubacao'), { ...SUBACAO }, comoGestor);

    expect(r.status).toBe(400);
    expect(erroDe(r.data)?.message).toBe('Uma Subação não pode ter Subações.');
    expect(await contagens(tratativa)).toEqual(antes);
  });

  it('CA3, CA31: Delegar Ação troca o Responsável da Ação da linha e grava só o evento Delegacao', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, 'M1001');

    const r = await POST(urlAcao(via, tratativa, acao, 'delegarAcao'), { ...DELEGACAO }, comoGestor);

    expect(r.status).toBe(204);
    const [linha] = await linhas('Acoes', { codigo: acao });
    expect(linha.responsavel).toBe('M2002');
    const delegacoes = await linhas('HistoricoAcoes', { acao_codigo: acao, evento: 'Delegacao' });
    expect(delegacoes).toHaveLength(1);
    expect(delegacoes[0]).toMatchObject({
      campo: 'responsavel',
      valorAnterior: 'M1001',
      valorNovo: 'M2002',
      justificativa: 'Redistribuição de carga',
      autor: 'gestor',
      tipoAutor: 'Usuario',
    });
    expect(await eventosDa(acao)).toEqual(['Criacao', 'Delegacao']);
  });

  it('CA18, CA31: Anexar Evidência foto_local.png grava Nome, Tipo, Tamanho e Descrição nula; o histórico não leva o Nome', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);
    const arquivo = gerarPNG(1234);

    const r = await POST(
      urlAcao(via, tratativa, acao, 'anexarEvidencia'),
      anexo('foto_local.png', 'image/png', arquivo, ''),
      comoGestor,
    );

    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ nomeArquivo: 'foto_local.png', mimeType: 'image/png', tamanho: 1234 });
    const [evidencia] = await linhas('Evidencias', { codigo: r.data.codigo });
    expect(evidencia).toMatchObject({
      acao_codigo: acao,
      tratativa_codigo: tratativa,
      nomeArquivo: 'foto_local.png',
      mimeType: 'image/png',
      tamanho: 1234,
      descricao: null,
      ativo: true,
    });
    const historico = await linhas('HistoricoAcoes', { acao_codigo: acao, evento: 'InclusaoEvidencia' });
    expect(historico).toHaveLength(1);
    expect(JSON.stringify(historico[0])).not.toContain('foto_local');
    expect(await eventosDa(acao)).toEqual(['Criacao', 'InclusaoEvidencia']);
  });

  it('CA19: o servidor grava só o último segmento do Nome do arquivo', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);

    const r = await POST(
      urlAcao(via, tratativa, acao, 'anexarEvidencia'),
      anexo('dir\\subdir/../../foto.png', 'image/png', gerarPNG(500)),
      comoGestor,
    );

    expect(r.status).toBe(200);
    const [evidencia] = await linhas('Evidencias', { codigo: r.data.codigo });
    expect(evidencia.nomeArquivo).toBe('foto.png');
  });

  it('CA20: aceita as 10 extensões com Tipo compatível e recusa .exe, .zip e .pdf com Tipo image/png (415)', async () => {
    const tratativa = await novaTratativa();
    const aceitas = await novaAcao(tratativa);
    const recusadas = await novaAcao(tratativa);
    const pares: Array<[string, string]> = [
      ['a.jpg', 'image/jpeg'],
      ['a.jpeg', 'image/jpeg'],
      ['a.png', 'image/png'],
      ['a.pdf', 'application/pdf'],
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['a.doc', 'application/msword'],
      ['a.txt', 'text/plain'],
      ['a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['a.xls', 'application/vnd.ms-excel'],
      ['a.csv', 'text/csv'],
    ];

    const statusAceitas: number[] = [];
    for (const [nome, tipo] of pares) {
      const r = await POST(
        urlAcao(via, tratativa, aceitas, 'anexarEvidencia'),
        anexo(nome, tipo, Buffer.from('conteudo')),
        comoGestor,
      );
      statusAceitas.push(r.status);
    }
    expect(statusAceitas).toEqual(pares.map(() => 200));

    const rejeitados: Array<[string, string, Buffer]> = [
      ['programa.exe', 'application/octet-stream', gerarExecutavel()],
      ['pacote.zip', 'application/zip', Buffer.from('PK')],
      ['documento.pdf', 'image/png', gerarPDF(100)],
    ];
    for (const [nome, tipo, conteudo] of rejeitados) {
      const r = await POST(
        urlAcao(via, tratativa, recusadas, 'anexarEvidencia'),
        anexo(nome, tipo, conteudo),
        comoGestor,
      );
      expect(r.status).toBe(415);
      expect(erroDe(r.data)?.message).toBe(MSG_FORMATO);
    }
  });

  it('CA21: aceita 10.485.760 bytes, recusa 10.485.761 (413) e arquivo vazio (400)', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);
    const url = urlAcao(via, tratativa, acao, 'anexarEvidencia');

    const limite = await POST(url, anexo('limite.txt', 'text/plain', gerarExatamente10MB()), comoGestor);
    const acima = await POST(url, anexo('acima.txt', 'text/plain', gerarAcimaDe10MB()), comoGestor);
    const vazio = await POST(url, anexo('vazio.txt', 'text/plain', Buffer.alloc(0)), comoGestor);

    expect(limite.status).toBe(200);
    expect(limite.data.tamanho).toBe(10485760);
    expect(acima.status).toBe(413);
    expect(erroDe(acima.data)?.message).toBe('Arquivo excede o tamanho máximo permitido de 10 MB.');
    expect(vazio.status).toBe(400);
    expect(erroDe(vazio.data)?.message).toBe('O arquivo não pode ser vazio.');
  });

  it('CA12, CA22: a 10ª Evidência é aceita, a indicação de anexar segue verdadeira e a 11ª é recusada (409)', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);
    for (let i = 0; i < 9; i++) await novaEvidencia(tratativa, acao);
    const url = urlAcao(via, tratativa, acao, 'anexarEvidencia');

    const decima = await POST(url, anexoPdf(), comoGestor);
    const indicacao = await GET(
      `${BASE}/Tratativas(${tratativa})/acoes?$select=codigo,podeAnexarEvidencia`,
      comoGestor,
    );
    const decimaPrimeira = await POST(url, anexoPdf(), comoGestor);

    expect(decima.status).toBe(200);
    expect(indicacao.status).toBe(200);
    const linha = (indicacao.data.value as Linha[]).find((l) => l.codigo === acao);
    expect(linha?.podeAnexarEvidencia).toBe(true);
    expect(decimaPrimeira.status).toBe(409);
    expect(erroDe(decimaPrimeira.data)?.message).toBe('Limite de 10 evidências por Ação atingido.');
    expect(await linhas('Evidencias', { acao_codigo: acao, ativo: true })).toHaveLength(10);
  });

  it('CA41 (servidor): .csv com Tipo text/csv é gravado com text/csv; .pdf como image/png e .exe sem Tipo são recusados (415)', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);
    const url = urlAcao(via, tratativa, acao, 'anexarEvidencia');

    const csv = await POST(url, anexo('dados.csv', 'text/csv', Buffer.from('a,b\n1,2')), comoGestor);
    const divergente = await POST(url, anexo('doc.pdf', 'image/png', gerarPDF(100)), comoGestor);
    const foraDaLista = await POST(url, anexo('programa.exe', '', gerarExecutavel()), comoGestor);

    expect(csv.status).toBe(200);
    const [gravada] = await linhas('Evidencias', { codigo: csv.data.codigo });
    expect(gravada.mimeType).toBe('text/csv');
    expect(divergente.status).toBe(415);
    expect(erroDe(divergente.data)?.message).toBe(MSG_FORMATO);
    expect(foraDaLista.status).toBe(415);
    expect(erroDe(foraDaLista.data)?.message).toBe(MSG_FORMATO);
  });

  it('CA31: Comentar Ação grava o Comentário na Ação e na Tratativa da linha e só o evento InclusaoComentario', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);

    const r = await POST(
      urlAcao(via, tratativa, acao, 'comentarAcao'),
      { texto: 'Comentário na Ação da linha', mencoes: ['M2002'] },
      comoGestor,
    );

    expect(r.status).toBe(200);
    const [comentario] = await linhas('Comentarios', { codigo: r.data.codigo });
    expect(comentario).toMatchObject({
      acao_codigo: acao,
      tratativa_codigo: tratativa,
      texto: 'Comentário na Ação da linha',
      autor: 'gestor',
    });
    expect(await linhas('MencoesComentario', { comentario_codigo: r.data.codigo })).toHaveLength(1);
    expect(await eventosDa(acao)).toEqual(['Criacao', 'InclusaoComentario']);
  });

  it('CA33: o Responsável comenta a Ação Em andamento; depois da Delegação perde a permissão (403) e o novo a ganha', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, 'M1001');
    await levarAcao(tratativa, acao, 'Em andamento');
    const url = urlAcao(via, tratativa, acao, 'comentarAcao');

    const antes = await POST(url, { texto: 'Andamento informado pelo Responsável', mencoes: [] }, comoM1001);
    const delegacao = await POST(urlAcao(via, tratativa, acao, 'delegarAcao'), { ...DELEGACAO }, comoGestor);
    const anteriorDepois = await POST(url, { texto: 'Tentativa do Responsável anterior', mencoes: [] }, comoM1001);
    const novoDepois = await POST(url, { texto: 'Comentário do novo Responsável', mencoes: [] }, comoM2002);

    expect(antes.status).toBe(200);
    const [comentario] = await linhas('Comentarios', { codigo: antes.data.codigo });
    expect(comentario).toMatchObject({ acao_codigo: acao, tratativa_codigo: tratativa });
    expect(delegacao.status).toBe(204);
    expect(anteriorDepois.status).toBe(403);
    expect(novoDepois.status).toBe(200);
  });

  it('CA34: texto vazio, texto com 2.001 caracteres e 11 menções distintas são recusados com as mensagens de comentarios', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);
    const url = urlAcao(via, tratativa, acao, 'comentarAcao');
    const onzeMencoes = Array.from({ length: 11 }, (_, i) => `M${1000 + i}`);

    const vazio = await POST(url, { texto: '   ', mencoes: [] }, comoGestor);
    const longo = await POST(url, { texto: 'x'.repeat(2001), mencoes: [] }, comoGestor);
    const mencoes = await POST(url, { texto: 'Com menções', mencoes: onzeMencoes }, comoGestor);

    expect(vazio.status).toBe(400);
    expect(erroDe(vazio.data)?.message).toBe('O campo Texto do comentário é obrigatório.');
    expect(longo.status).toBe(400);
    expect(erroDe(longo.data)?.message).toBe('O campo Texto do comentário aceita no máximo 2000 caracteres.');
    expect(mencoes.status).toBe(400);
    expect(erroDe(mencoes.data)?.message).toBe('Limite de 10 menções por comentário atingido.');
    expect(await linhas('Comentarios', { acao_codigo: acao })).toHaveLength(0);
  });

  it('CA4, CA31: Remover Evidência desativa a Evidência da linha e grava só o evento RemocaoEvidencia', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);
    const evidencia = await novaEvidencia(tratativa, acao);

    const r = await POST(urlEvidencia(via, tratativa, evidencia, 'removerEvidencia'), {}, comoGestor);

    expect(r.status).toBe(204);
    const [linha] = await linhas('Evidencias', { codigo: evidencia });
    expect(linha.ativo).toBe(false);
    const historico = await linhas('HistoricoAcoes', { acao_codigo: acao, evento: 'RemocaoEvidencia' });
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({ evidencia, autor: 'gestor' });
    expect(await eventosDa(acao)).toEqual(['Criacao', 'InclusaoEvidencia', 'RemocaoEvidencia']);
  });

  it('R23: o Responsável inicia e o Gestor conclui a Ação da linha (Iniciar e Concluir pelo mesmo caminho)', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, 'M1001');

    const iniciar = await POST(urlAcao(via, tratativa, acao, 'iniciar'), {}, comoM1001);
    const [aposIniciar] = await linhas('Acoes', { codigo: acao });
    const concluir = await POST(urlAcao(via, tratativa, acao, 'concluir'), {}, comoGestor);
    const [aposConcluir] = await linhas('Acoes', { codigo: acao });

    expect(iniciar.status).toBe(204);
    expect(aposIniciar.status).toBe('Em andamento');
    expect(concluir.status).toBe(204);
    expect(aposConcluir.status).toBe('Concluída');
  });

  describe('CA31: falha simulada na gravação do histórico desfaz a operação inteira', () => {
    it('Criar Subação', async () => {
      const tratativa = await novaTratativa();
      const mae = await novaAcao(tratativa);
      const antes = await contagens(tratativa);
      espiao.falharEm('CREATE', `${NS}HistoricoAcoes`);

      const r = await POST(urlAcao(via, tratativa, mae, 'criarSubacao'), { ...SUBACAO }, comoGestor);

      expect(r.status).toBe(500);
      expect(await contagens(tratativa)).toEqual(antes);
    });

    it('Delegar Ação', async () => {
      const tratativa = await novaTratativa();
      const acao = await novaAcao(tratativa, 'M1001');
      espiao.falharEm('CREATE', `${NS}HistoricoAcoes`);

      const r = await POST(urlAcao(via, tratativa, acao, 'delegarAcao'), { ...DELEGACAO }, comoGestor);

      expect(r.status).toBe(500);
      const [linha] = await linhas('Acoes', { codigo: acao });
      expect(linha.responsavel).toBe('M1001');
    });

    it('Anexar Evidência', async () => {
      const tratativa = await novaTratativa();
      const acao = await novaAcao(tratativa);
      espiao.falharEm('CREATE', `${NS}HistoricoAcoes`);

      const r = await POST(urlAcao(via, tratativa, acao, 'anexarEvidencia'), anexoPdf(), comoGestor);

      expect(r.status).toBe(500);
      expect(await linhas('Evidencias', { acao_codigo: acao })).toHaveLength(0);
    });

    it('Comentar Ação', async () => {
      const tratativa = await novaTratativa();
      const acao = await novaAcao(tratativa);
      espiao.falharEm('CREATE', `${NS}HistoricoAcoes`);

      const r = await POST(urlAcao(via, tratativa, acao, 'comentarAcao'), { ...COMENTARIO }, comoGestor);

      expect(r.status).toBe(500);
      expect(await linhas('Comentarios', { acao_codigo: acao })).toHaveLength(0);
    });

    it('Remover Evidência', async () => {
      const tratativa = await novaTratativa();
      const acao = await novaAcao(tratativa);
      const evidencia = await novaEvidencia(tratativa, acao);
      espiao.falharEm('CREATE', `${NS}HistoricoAcoes`);

      const r = await POST(urlEvidencia(via, tratativa, evidencia, 'removerEvidencia'), {}, comoGestor);

      expect(r.status).toBe(500);
      const [linha] = await linhas('Evidencias', { codigo: evidencia });
      expect(linha.ativo).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 404 do registro-alvo, 403 antes de 404, M1 e M2-1 (R14; CA25, CA26)
// ---------------------------------------------------------------------------------------------------------------
describe.each(VIAS)('Registro-alvo pelo caminho %s (R14)', (via) => {
  it.each(OPERACOES_DE_ACAO)(
    'CA25: %s com chave malformada (xyz) ou inexistente dá 404 "Ação não encontrada." e não 400',
    async (operacao, corpo) => {
      const tratativa = await novaTratativa();
      await novaAcao(tratativa);

      const malformada = await POST(urlAcao(via, tratativa, 'xyz', operacao), corpo(), comoGestor);
      const inexistente = await POST(urlAcao(via, tratativa, ZERO, operacao), corpo(), comoGestor);

      for (const r of [malformada, inexistente]) {
        expect(r.status).toBe(404);
        expect(erroDe(r.data)?.message).toBe('Ação não encontrada.');
      }
    },
  );

  it('CA25: Remover Evidência com chave malformada, inexistente ou inativa dá 404 "Evidência não encontrada."', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa);
    const removida = await novaEvidencia(tratativa, acao);
    await removerNoDominio(tratativa, acao, removida);

    const respostas = [];
    for (const chave of ['xyz', ZERO, removida]) {
      respostas.push(await POST(urlEvidencia(via, tratativa, chave, 'removerEvidencia'), {}, comoGestor));
    }

    for (const r of respostas) {
      expect(r.status).toBe(404);
      expect(erroDe(r.data)?.message).toBe('Evidência não encontrada.');
    }
  });

  it.each(OPERACOES_DE_ACAO)(
    'CA26: %s por quem não é Gestor, sobre Ação inexistente: 403 nas de papel estático, 404 nas de papel dinâmico',
    async (operacao, corpo) => {
      const tratativa = await novaTratativa();
      await novaAcao(tratativa, 'M1001');
      const estatico = operacao === 'criarSubacao' || operacao === 'delegarAcao';

      const r = await POST(urlAcao(via, tratativa, ZERO, operacao), corpo(), comoM1001);

      expect(r.status).toBe(estatico ? 403 : 404);
      if (!estatico) expect(erroDe(r.data)?.message).toBe('Ação não encontrada.');
    },
  );

  it('CA26: Remover Evidência por quem não é Gestor, sobre Evidência inexistente, dá 404 (existência antes da autorização)', async () => {
    const tratativa = await novaTratativa();
    await novaAcao(tratativa, 'M1001');

    const r = await POST(urlEvidencia(via, tratativa, ZERO, 'removerEvidencia'), {}, comoM1001);

    expect(r.status).toBe(404);
    expect(erroDe(r.data)?.message).toBe('Evidência não encontrada.');
  });

  it('M1: Evidência inativa dá 404 antes do 403 (usuário sem vínculo) e antes do 409 (Tratativa Cancelada)', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, 'M1001');
    const inativa = await novaEvidencia(tratativa, acao);
    const ativa = await novaEvidencia(tratativa, acao);
    await removerNoDominio(tratativa, acao, inativa);

    const semVinculo = await POST(urlEvidencia(via, tratativa, inativa, 'removerEvidencia'), {}, comoM2002);
    const controleSemVinculo = await POST(urlEvidencia(via, tratativa, ativa, 'removerEvidencia'), {}, comoM2002);
    await cancelarTratativa(tratativa);
    const cancelada = await POST(urlEvidencia(via, tratativa, inativa, 'removerEvidencia'), {}, comoGestor);
    const controleCancelada = await POST(urlEvidencia(via, tratativa, ativa, 'removerEvidencia'), {}, comoGestor);

    expect(semVinculo.status).toBe(404);
    expect(erroDe(semVinculo.data)?.message).toBe('Evidência não encontrada.');
    expect(controleSemVinculo.status).toBe(403);
    expect(cancelada.status).toBe(404);
    expect(erroDe(cancelada.data)?.message).toBe('Evidência não encontrada.');
    expect(controleCancelada.status).toBe(409);
  });

  it('CA24: usuário sem papel recebe 403 antes do 409 de estado; o Gestor recebe 409 antes do 400 de campo, com a mensagem do servidor', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, 'M1001');
    const evidencia = await novaEvidencia(tratativa, acao);
    const concluida = await novaAcao(tratativa, 'M1001');
    await levarAcao(tratativa, concluida, 'Concluída');
    const viva = await novaAcao(tratativa, 'M1001');
    await cancelarTratativa(tratativa);

    const anexarSemPapel = await POST(urlAcao(via, tratativa, acao, 'anexarEvidencia'), anexoPdf(), comoM2002);
    const comentarSemPapel = await POST(urlAcao(via, tratativa, acao, 'comentarAcao'), { ...COMENTARIO }, comoM2002);
    const removerSemPapel = await POST(urlEvidencia(via, tratativa, evidencia, 'removerEvidencia'), {}, comoM2002);
    const subacaoSemPapel = await POST(urlAcao(via, tratativa, acao, 'criarSubacao'), { ...SUBACAO }, comoM1001);
    const textoInvalido = await POST(
      urlAcao(via, tratativa, viva, 'comentarAcao'),
      { texto: '', mencoes: [] },
      comoGestor,
    );
    const arquivoInvalido = await POST(
      urlAcao(via, tratativa, viva, 'anexarEvidencia'),
      anexo('programa.exe', 'application/octet-stream', gerarExecutavel()),
      comoGestor,
    );

    for (const r of [anexarSemPapel, comentarSemPapel, removerSemPapel, subacaoSemPapel]) {
      expect(r.status).toBe(403);
    }
    for (const r of [textoInvalido, arquivoInvalido]) {
      expect(r.status).toBe(409);
      expect(erroDe(r.data)?.message).toBe('Tratativa Cancelada não pode ser alterada.');
    }
  });

  it('CA24: Ação Concluída com texto inválido recebe 409 antes do 400', async () => {
    const tratativa = await novaTratativa();
    const concluida = await novaAcao(tratativa, 'M1001');
    await levarAcao(tratativa, concluida, 'Concluída');

    const r = await POST(urlAcao(via, tratativa, concluida, 'comentarAcao'), { texto: '', mencoes: [] }, comoGestor);

    expect(r.status).toBe(409);
    expect(erroDe(r.data)?.message).toBe('Ação Concluída não pode ser alterada.');
  });
});

describe('Caminhos fora do contrato (R14 c; M2-1)', () => {
  it.each(OPERACOES_DE_ACAO)(
    'CA25: %s por Tratativas(t)/acoes(a) com Ação de outra Tratativa, ou com t malformada, dá 404 e não muda nada',
    async (operacao, corpo) => {
      const t1 = await novaTratativa();
      const t2 = await novaTratativa();
      const aDeT2 = await novaAcao(t2, 'M1001');
      const aDeT1 = await novaAcao(t1, 'M1001');
      const antes = { t1: await contagens(t1), t2: await contagens(t2) };

      const outraTratativa = await POST(urlAcao('contencao', t1, aDeT2, operacao), corpo(), comoGestor);
      const malformada = await POST(urlAcao('contencao', 'xyz', aDeT1, operacao), corpo(), comoGestor);

      for (const r of [outraTratativa, malformada]) {
        expect(r.status).toBe(404);
        expect(erroDe(r.data)?.message).toBe('Ação não encontrada.');
      }
      expect(await contagens(t1)).toEqual(antes.t1);
      expect(await contagens(t2)).toEqual(antes.t2);
      const [linha] = await linhas('Acoes', { codigo: aDeT2 });
      expect(linha.responsavel).toBe('M1001');
    },
  );

  it('CA25: Remover Evidência por Tratativas(t)/evidencias(e) com Evidência de outra Tratativa, ou t malformada, dá 404', async () => {
    const t1 = await novaTratativa();
    const t2 = await novaTratativa();
    const eDeT2 = await novaEvidencia(t2, await novaAcao(t2));
    const eDeT1 = await novaEvidencia(t1, await novaAcao(t1));

    const outraTratativa = await POST(urlEvidencia('contencao', t1, eDeT2, 'removerEvidencia'), {}, comoGestor);
    const malformada = await POST(urlEvidencia('contencao', 'xyz', eDeT1, 'removerEvidencia'), {}, comoGestor);

    for (const r of [outraTratativa, malformada]) {
      expect(r.status).toBe(404);
      expect(erroDe(r.data)?.message).toBe('Evidência não encontrada.');
    }
    const [naoRemovida] = await linhas('Evidencias', { codigo: eDeT2 });
    const [outraNaoRemovida] = await linhas('Evidencias', { codigo: eDeT1 });
    expect(naoRemovida.ativo).toBe(true);
    expect(outraNaoRemovida.ativo).toBe(true);
  });

  it('M2-1: Acoes(sub)/acaoMae/criarSubacao dá 404 e não cria nada, e o caminho direto da mesma Ação mãe funciona', async () => {
    const tratativa = await novaTratativa();
    const mae = await novaAcao(tratativa);
    const sub = await novaSubacaoNoDominio(tratativa, mae);
    const controle = await POST(`${BASE}/Acoes(${mae})/criarSubacao`, { ...SUBACAO }, comoGestor);
    const antes = await contagens(tratativa);

    const r = await POST(`${BASE}/Acoes(${sub})/acaoMae/criarSubacao`, { ...SUBACAO }, comoGestor);

    expect(controle.status).toBe(200);
    expect(r.status).toBe(404);
    expect(erroDe(r.data)?.message).toBe('Ação não encontrada.');
    expect(await contagens(tratativa)).toEqual(antes);
  });

  it('M2-1: Acoes(sub)/acaoMae/iniciar dá 404 e a Ação mãe continua Pendente', async () => {
    const tratativa = await novaTratativa();
    const mae = await novaAcao(tratativa);
    const sub = await novaSubacaoNoDominio(tratativa, mae);
    const controle = await POST(`${BASE}/Acoes(${sub})/iniciar`, {}, comoGestor);

    const r = await POST(`${BASE}/Acoes(${sub})/acaoMae/iniciar`, {}, comoGestor);

    expect(controle.status).toBe(204);
    expect(r.status).toBe(404);
    const [linhaMae] = await linhas('Acoes', { codigo: mae });
    expect(linhaMae.status).toBe('Pendente');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Matriz de papéis, Aplicativo de origem e não autenticado (R15; CA27, CA28)
// ---------------------------------------------------------------------------------------------------------------
describe.each(VIAS)('Matriz de papéis pelo caminho %s (CA27)', (via) => {
  let c: Papeis;
  beforeAll(async () => {
    c = await cenarioDePapeis();
  });

  const SEM_PAPEL_GESTOR: Array<[string, unknown]> = [
    ['Responsável da Ação', comoM1001],
    ['Responsável Principal', comoM9999],
    ['Participante', comoM3003],
    ['usuário comum', comoUsuario],
  ];
  const SEM_PAPEL_DINAMICO: Array<[string, unknown]> = [
    ['Responsável de outra Ação', comoM2002],
    ['Responsável Principal', comoM9999],
    ['Participante', comoM3003],
    ['usuário comum', comoUsuario],
  ];

  it.each(SEM_PAPEL_GESTOR)('Criar Subação e Delegar Ação: %s recebe 403; o Gestor é aceito', async (_papel, como) => {
    const subacao = await POST(urlAcao(via, c.tratativa, c.a1, 'criarSubacao'), { ...SUBACAO }, como);
    const delegacao = await POST(urlAcao(via, c.tratativa, c.a1, 'delegarAcao'), { ...DELEGACAO }, como);
    const gestorSubacao = await POST(urlAcao(via, c.tratativa, c.a1, 'criarSubacao'), { ...SUBACAO }, comoGestor);
    const gestorDelegacao = await POST(
      urlAcao(via, c.tratativa, c.a1, 'delegarAcao'),
      { novoResponsavel: 'M1001', justificativa: 'Mantém o Responsável' },
      comoGestor,
    );

    expect(subacao.status).toBe(403);
    expect(delegacao.status).toBe(403);
    expect(gestorSubacao.status).toBe(200);
    expect(gestorDelegacao.status).toBe(204);
  });

  it.each(SEM_PAPEL_DINAMICO)(
    'Anexar Evidência, Comentar Ação e Remover Evidência: %s recebe 403',
    async (_papel, como) => {
      const anexar = await POST(urlAcao(via, c.tratativa, c.a1, 'anexarEvidencia'), anexoPdf(), como);
      const comentar = await POST(urlAcao(via, c.tratativa, c.a1, 'comentarAcao'), { ...COMENTARIO }, como);
      const remover = await POST(urlEvidencia(via, c.tratativa, c.e1, 'removerEvidencia'), {}, como);

      expect(anexar.status).toBe(403);
      expect(comentar.status).toBe(403);
      expect(remover.status).toBe(403);
      const [ativa] = await linhas('Evidencias', { codigo: c.e1 });
      expect(ativa.ativo).toBe(true);
    },
  );

  it.each([
    ['Gestor', comoGestor],
    ['Responsável da própria Ação', comoM1001],
  ])('Anexar Evidência, Comentar Ação e Remover Evidência: %s é aceito', async (_papel, como) => {
    const anexar = await POST(urlAcao(via, c.tratativa, c.a1, 'anexarEvidencia'), anexoPdf(), como);
    const comentar = await POST(urlAcao(via, c.tratativa, c.a1, 'comentarAcao'), { ...COMENTARIO }, como);
    const propria = await novaEvidencia(c.tratativa, c.a1);
    const remover = await POST(urlEvidencia(via, c.tratativa, propria, 'removerEvidencia'), {}, como);

    expect(anexar.status).toBe(200);
    expect(comentar.status).toBe(200);
    expect(remover.status).toBe(204);
  });

  it('CA28: o Aplicativo de origem recebe 403 e o não autenticado 401 em todas as operações de linha', async () => {
    const alvos: Array<[string, Record<string, unknown>]> = [
      [urlAcao(via, c.tratativa, c.a1, 'criarSubacao'), { ...SUBACAO }],
      [urlAcao(via, c.tratativa, c.a1, 'delegarAcao'), { ...DELEGACAO }],
      [urlAcao(via, c.tratativa, c.a1, 'anexarEvidencia'), anexoPdf()],
      [urlAcao(via, c.tratativa, c.a1, 'comentarAcao'), { ...COMENTARIO }],
      [urlAcao(via, c.tratativa, c.a1, 'iniciar'), {}],
      [urlAcao(via, c.tratativa, c.a1, 'concluir'), {}],
      [urlEvidencia(via, c.tratativa, c.e1, 'removerEvidencia'), {}],
    ];

    const statusApp: number[] = [];
    const statusAnonimo: number[] = [];
    for (const [url, corpo] of alvos) {
      statusApp.push((await POST(url, corpo, comoApp)).status);
      statusAnonimo.push((await POST(url, corpo, semAuth)).status);
    }

    expect(statusApp).toEqual(alvos.map(() => 403));
    expect(statusAnonimo).toEqual(alvos.map(() => 401));
  });
});

describe('Operações no nível da Tratativa (R15; CA27, CA28)', () => {
  let c: Papeis;
  beforeAll(async () => {
    c = await cenarioDePapeis();
  });

  const NOVA_ACAO = () => ({ descricao: 'Ação pelo botão da tabela', responsavel: 'M1001', prazo: PRAZO, prioridade: 'Alta' });

  it.each([
    ['Responsável da Ação', comoM1001],
    ['Responsável Principal', comoM9999],
    ['Participante', comoM3003],
    ['usuário comum', comoUsuario],
  ])('Criar Ação: %s recebe 403; o Gestor é aceito', async (_papel, como) => {
    const recusada = await POST(`${BASE}/Tratativas(${c.tratativa})/criarAcao`, NOVA_ACAO(), como);
    const aceita = await POST(`${BASE}/Tratativas(${c.tratativa})/criarAcao`, NOVA_ACAO(), comoGestor);

    expect(recusada.status).toBe(403);
    expect(aceita.status).toBe(200);
  });

  it.each([
    ['Gestor', comoGestor],
    ['Responsável Principal', comoM9999],
    ['Participante', comoM3003],
  ])('Comentar Tratativa: %s é aceito', async (_papel, como) => {
    const r = await POST(`${BASE}/Tratativas(${c.tratativa})/comentarTratativa`, { ...COMENTARIO }, como);

    expect(r.status).toBe(200);
  });

  it.each([
    ['Responsável de Ação sem vínculo com a Tratativa', comoM1001],
    ['usuário comum', comoUsuario],
  ])('Comentar Tratativa: %s recebe 403', async (_papel, como) => {
    const r = await POST(`${BASE}/Tratativas(${c.tratativa})/comentarTratativa`, { ...COMENTARIO }, como);

    expect(r.status).toBe(403);
  });

  it('CA28: o Aplicativo de origem recebe 403 e o não autenticado 401 em Criar Ação, Comentar Tratativa e regrasAnexoEvidencia', async () => {
    const urls: Array<[string, Record<string, unknown>]> = [
      [`${BASE}/Tratativas(${c.tratativa})/criarAcao`, NOVA_ACAO()],
      [`${BASE}/Tratativas(${c.tratativa})/comentarTratativa`, { ...COMENTARIO }],
    ];
    const statusApp: number[] = [];
    const statusAnonimo: number[] = [];
    for (const [url, corpo] of urls) {
      statusApp.push((await POST(url, corpo, comoApp)).status);
      statusAnonimo.push((await POST(url, corpo, semAuth)).status);
    }
    const regrasApp = await GET(`${BASE}/regrasAnexoEvidencia()`, comoApp);
    const regrasAnonimo = await GET(`${BASE}/regrasAnexoEvidencia()`, semAuth);

    expect(statusApp).toEqual([403, 403]);
    expect(statusAnonimo).toEqual([401, 401]);
    expect(regrasApp.status).toBe(403);
    expect(regrasAnonimo.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Regras de anexo expostas pelo servidor (decisão 7; R12, R13, R25)
// ---------------------------------------------------------------------------------------------------------------
describe('regrasAnexoEvidencia (decisão 7)', () => {
  it('devolve o tamanho máximo e os pares extensão/Tipo; cada par é aceito por Anexar Evidência', async () => {
    const r = await GET(`${BASE}/regrasAnexoEvidencia()`, comoUsuario);

    expect(r.status).toBe(200);
    expect(r.data.tamanhoMaximo).toBe(10485760);
    const formatos = r.data.formatos as Array<{ extensao: string; tipos: string[] }>;
    expect(formatos.map((f) => f.extensao).sort()).toEqual(
      ['.csv', '.doc', '.docx', '.jpeg', '.jpg', '.pdf', '.png', '.txt', '.xls', '.xlsx'].sort(),
    );
    const porExtensao = Object.fromEntries(formatos.map((f) => [f.extensao, f.tipos]));
    expect(porExtensao['.csv']).toEqual(['text/csv', 'application/vnd.ms-excel']);
    expect(porExtensao['.pdf']).toEqual(['application/pdf']);

    const tratativa = await novaTratativa();
    const statusDosPares: number[] = [];
    for (const formato of formatos) {
      for (const tipo of formato.tipos) {
        const acao = await novaAcao(tratativa);
        const envio = await POST(
          `${BASE}/Acoes(${acao})/anexarEvidencia`,
          anexo(`arquivo${formato.extensao}`, tipo, Buffer.from('conteudo')),
          comoGestor,
        );
        statusDosPares.push(envio.status);
      }
    }
    expect(statusDosPares.length).toBeGreaterThanOrEqual(10);
    expect(statusDosPares.every((status) => status === 200)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Indicações pode*/oculta* calculadas pelo servidor, sem matrícula (R5, R6, R8, R23; CA12, CA14)
// ---------------------------------------------------------------------------------------------------------------
const FLAGS_TRATATIVA = 'ocultaGestaoAcoes,podeCriarAcao,podeComentarTratativa,ocultaComentarTratativa,ocultaOperacoesDeAcao';
const FLAGS_ACAO =
  'ocultaOperacoesDaLinha,podeCriarSubacao,podeDelegar,podeAnexarEvidencia,podeComentarAcao,podeIniciarAcao,podeConcluirAcao';
const FLAGS_EVIDENCIA = 'ocultaRemover,podeRemover';
const MATRICULAS_DO_CENARIO = ['M1001', 'M2002', 'M3003', 'M9999', 'gestor'];

function porCodigo(dados: unknown): Map<string, Linha> {
  const itens = (dados as { value?: Linha[] }).value ?? [];
  return new Map(itens.map((linha) => [String(linha.codigo), linha]));
}

function apenasFlags(linha: Linha | undefined): Linha {
  const flags: Linha = {};
  for (const [chave, valor] of Object.entries(linha ?? {})) {
    if (/^(pode|oculta)/.test(chave)) flags[chave] = valor;
  }
  return flags;
}

describe('Indicações de disponibilidade (decisão 3)', () => {
  it('Tratativa: Gestor, Responsável Principal, Participante e Responsável de Ação recebem as indicações de seu papel', async () => {
    const c = await cenarioDePapeis();
    const ler = async (como: unknown) => {
      const r = await GET(`${BASE}/Tratativas(${c.tratativa})?$select=${FLAGS_TRATATIVA}`, como);
      expect(r.status).toBe(200);
      return apenasFlags(r.data);
    };

    expect(await ler(comoGestor)).toEqual({
      ocultaGestaoAcoes: false,
      podeCriarAcao: true,
      podeComentarTratativa: true,
      ocultaComentarTratativa: false,
      ocultaOperacoesDeAcao: false,
    });
    expect(await ler(comoM9999)).toEqual({
      ocultaGestaoAcoes: true,
      podeCriarAcao: false,
      podeComentarTratativa: true,
      ocultaComentarTratativa: false,
      ocultaOperacoesDeAcao: true,
    });
    expect(await ler(comoM3003)).toEqual({
      ocultaGestaoAcoes: true,
      podeCriarAcao: false,
      podeComentarTratativa: true,
      ocultaComentarTratativa: false,
      ocultaOperacoesDeAcao: true,
    });
    expect(await ler(comoM1001)).toEqual({
      ocultaGestaoAcoes: true,
      podeCriarAcao: false,
      podeComentarTratativa: false,
      ocultaComentarTratativa: true,
      ocultaOperacoesDeAcao: false,
    });
  });

  it('Tratativa Cancelada: Criar Ação e Comentar Tratativa ficam indisponíveis para o Gestor, que continua não oculto', async () => {
    const tratativa = await novaTratativa();
    await novaAcao(tratativa);
    await cancelarTratativa(tratativa);

    const r = await GET(`${BASE}/Tratativas(${tratativa})?$select=${FLAGS_TRATATIVA}`, comoGestor);

    expect(r.status).toBe(200);
    expect(apenasFlags(r.data)).toMatchObject({
      ocultaGestaoAcoes: false,
      podeCriarAcao: false,
      podeComentarTratativa: false,
    });
  });

  it('Acoes, Gestor: as indicações seguem o status da Ação, a hierarquia e a Tratativa', async () => {
    const tratativa = await novaTratativa();
    const a1 = await novaAcao(tratativa, 'M1001');
    const sub = await novaSubacaoNoDominio(tratativa, a1);
    const emAndamento = await novaAcao(tratativa, 'M2002');
    await levarAcao(tratativa, emAndamento, 'Em andamento');
    const concluida = await novaAcao(tratativa, 'M2002');
    await levarAcao(tratativa, concluida, 'Concluída');
    const todasVivas = (iniciar: boolean) => ({
      ocultaOperacoesDaLinha: false,
      podeCriarSubacao: true,
      podeDelegar: true,
      podeAnexarEvidencia: true,
      podeComentarAcao: true,
      podeIniciarAcao: iniciar,
      podeConcluirAcao: true,
    });

    const lista = await GET(`${BASE}/Tratativas(${tratativa})/acoes?$select=codigo,${FLAGS_ACAO}`, comoGestor);
    const direta = await GET(`${BASE}/Acoes(${a1})?$select=${FLAGS_ACAO}`, comoGestor);

    expect(lista.status).toBe(200);
    const linhasPorCodigo = porCodigo(lista.data);
    expect(apenasFlags(linhasPorCodigo.get(a1))).toEqual(todasVivas(true));
    expect(apenasFlags(linhasPorCodigo.get(sub))).toEqual({ ...todasVivas(true), podeCriarSubacao: false });
    expect(apenasFlags(linhasPorCodigo.get(emAndamento))).toEqual(todasVivas(false));
    expect(apenasFlags(linhasPorCodigo.get(concluida))).toEqual({
      ocultaOperacoesDaLinha: false,
      podeCriarSubacao: false,
      podeDelegar: false,
      podeAnexarEvidencia: false,
      podeComentarAcao: false,
      podeIniciarAcao: false,
      podeConcluirAcao: false,
    });
    expect(direta.status).toBe(200);
    expect(apenasFlags(direta.data)).toEqual(todasVivas(true));

    await cancelarTratativa(tratativa);
    const cancelada = await GET(`${BASE}/Tratativas(${tratativa})/acoes?$select=codigo,${FLAGS_ACAO}`, comoGestor);
    expect(cancelada.status).toBe(200);
    for (const linha of porCodigo(cancelada.data).values()) {
      expect(apenasFlags(linha)).toMatchObject({
        podeCriarSubacao: false,
        podeDelegar: false,
        podeAnexarEvidencia: false,
        podeComentarAcao: false,
        podeIniciarAcao: false,
        podeConcluirAcao: false,
      });
    }
  });

  it('CA14, Acoes: o Responsável da Ação (sem papel de Gestor) vê as indicações só da própria Ação e nenhuma matrícula', async () => {
    const c = await cenarioDePapeis();
    const tratativa = c.tratativa;
    const sub = await novaSubacaoNoDominio(tratativa, c.a1, 'M2002');

    const lista = await GET(
      `${BASE}/Tratativas(${tratativa})/acoes?$select=codigo,responsavel,${FLAGS_ACAO}`,
      comoM1001,
    );

    expect(lista.status).toBe(200);
    const linhasPorCodigo = porCodigo(lista.data);
    expect(apenasFlags(linhasPorCodigo.get(c.a1))).toEqual({
      ocultaOperacoesDaLinha: false,
      podeCriarSubacao: false,
      podeDelegar: false,
      podeAnexarEvidencia: true,
      podeComentarAcao: true,
      podeIniciarAcao: true,
      podeConcluirAcao: true,
    });
    for (const alheia of [c.a2, sub]) {
      expect(apenasFlags(linhasPorCodigo.get(alheia))).toEqual({
        ocultaOperacoesDaLinha: true,
        podeCriarSubacao: false,
        podeDelegar: false,
        podeAnexarEvidencia: false,
        podeComentarAcao: false,
        podeIniciarAcao: false,
        podeConcluirAcao: false,
      });
    }
    expect([...linhasPorCodigo.values()].every((linha) => linha.responsavel === null)).toBe(true);
    const texto = JSON.stringify(lista.data);
    for (const matricula of MATRICULAS_DO_CENARIO) expect(texto).not.toContain(matricula);
  });

  it('Evidencias: Remover fica disponível só para Evidência ativa de Ação viva em Tratativa alterável', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, 'M1001');
    const ativa = await novaEvidencia(tratativa, acao);
    const removida = await novaEvidencia(tratativa, acao);
    await removerNoDominio(tratativa, acao, removida);
    const encerrada = await novaAcao(tratativa, 'M1001');
    const daEncerrada = await novaEvidencia(tratativa, encerrada);
    await levarAcao(tratativa, encerrada, 'Concluída');

    const lista = await GET(
      `${BASE}/Tratativas(${tratativa})/evidencias?$select=codigo,${FLAGS_EVIDENCIA}`,
      comoGestor,
    );

    expect(lista.status).toBe(200);
    const linhasPorCodigo = porCodigo(lista.data);
    expect(apenasFlags(linhasPorCodigo.get(ativa))).toEqual({ ocultaRemover: false, podeRemover: true });
    expect(apenasFlags(linhasPorCodigo.get(removida))).toEqual({ ocultaRemover: false, podeRemover: false });
    expect(apenasFlags(linhasPorCodigo.get(daEncerrada))).toEqual({ ocultaRemover: false, podeRemover: false });

    await cancelarTratativa(tratativa);
    const cancelada = await GET(
      `${BASE}/Tratativas(${tratativa})/evidencias?$select=codigo,${FLAGS_EVIDENCIA}`,
      comoGestor,
    );
    expect(apenasFlags(porCodigo(cancelada.data).get(ativa))).toEqual({ ocultaRemover: false, podeRemover: false });
  });

  it('CA14, Evidencias: o Responsável da Ação vê a Evidência da própria Ação com Remover disponível, sem autor nem matrícula', async () => {
    const c = await cenarioDePapeis();

    const lista = await GET(
      `${BASE}/Tratativas(${c.tratativa})/evidencias?$select=codigo,autorAnexo,${FLAGS_EVIDENCIA}`,
      comoM1001,
    );

    expect(lista.status).toBe(200);
    const linhasPorCodigo = porCodigo(lista.data);
    expect([...linhasPorCodigo.keys()]).toEqual([c.e1]);
    expect(linhasPorCodigo.get(c.e1)).toMatchObject({ autorAnexo: null, ocultaRemover: false, podeRemover: true });
    const texto = JSON.stringify(lista.data);
    for (const matricula of MATRICULAS_DO_CENARIO) expect(texto).not.toContain(matricula);
  });

  it('CA14, Tratativa: as indicações do nível da Tratativa e o campo Responsável Principal não revelam matrícula a quem não é Gestor', async () => {
    const c = await cenarioDePapeis();

    const respostas = [];
    for (const como of [comoM1001, comoM9999, comoM3003]) {
      respostas.push(
        await GET(`${BASE}/Tratativas(${c.tratativa})?$select=responsavelPrincipal,${FLAGS_TRATATIVA}`, como),
      );
    }

    for (const r of respostas) {
      expect(r.status).toBe(200);
      expect(r.data.responsavelPrincipal).toBeNull();
      const texto = JSON.stringify(r.data);
      for (const matricula of MATRICULAS_DO_CENARIO) expect(texto).not.toContain(matricula);
    }
  });

  it('Fail-closed: em $expand as indicações de Acoes ficam falsas', async () => {
    const tratativa = await novaTratativa();
    await novaAcao(tratativa, 'M1001');

    const r = await GET(`${BASE}/Tratativas(${tratativa})?$expand=acoes($select=codigo,${FLAGS_ACAO})`, comoGestor);

    expect(r.status).toBe(200);
    const acoes = r.data.acoes as Linha[];
    expect(acoes.length).toBeGreaterThan(0);
    for (const linha of acoes) {
      expect(Object.values(apenasFlags(linha)).every((valor) => valor === false)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Generalidade (R21; CA37)
// ---------------------------------------------------------------------------------------------------------------
describe('CA37: operações de linha idênticas para Tratativa com Origem e avulsa', () => {
  async function sequencia(tratativa: string): Promise<number[]> {
    const mae = await novaAcao(tratativa, 'M1001');
    const status: number[] = [];
    const subacao = await POST(`${BASE}/Acoes(${mae})/criarSubacao`, { ...SUBACAO }, comoGestor);
    status.push(subacao.status);
    const anexada = await POST(
      `${BASE}/Acoes(${mae})/anexarEvidencia`,
      anexo('foto.png', 'image/png', gerarPNG(300)),
      comoGestor,
    );
    status.push(anexada.status);
    status.push((await POST(`${BASE}/Acoes(${mae})/comentarAcao`, { ...COMENTARIO }, comoGestor)).status);
    status.push((await POST(`${BASE}/Acoes(${mae})/delegarAcao`, { ...DELEGACAO }, comoGestor)).status);
    status.push(
      (await POST(`${BASE}/Acoes(${mae})/anexarEvidencia`, anexo('prog.exe', '', gerarExecutavel()), comoGestor)).status,
    );
    status.push(
      (
        await POST(
          `${BASE}/Acoes(${mae})/anexarEvidencia`,
          anexo('grande.txt', 'text/plain', gerarAcimaDe10MB()),
          comoGestor,
        )
      ).status,
    );
    status.push((await POST(`${BASE}/Evidencias(${anexada.data.codigo})/removerEvidencia`, {}, comoGestor)).status);
    return status;
  }

  it('a sequência de operações e dos limites devolve os mesmos resultados nas duas Tratativas', async () => {
    const comOrigem = await abrirPorApp(enviar, { origem: 'Registro de Acidente' });
    exigir(comOrigem, 200, 'abrir Tratativa com Origem');
    const avulsa = await novaTratativa();

    const daOrigem = await sequencia(comOrigem.data.codigo as string);
    const daAvulsa = await sequencia(avulsa);

    expect(daOrigem).toEqual([200, 200, 200, 204, 415, 413, 204]);
    expect(daAvulsa).toEqual(daOrigem);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Contrato CDS do serviço do aplicativo (R16; CA29, CA32) e EDMX com @Core.OperationAvailable
// ---------------------------------------------------------------------------------------------------------------
type DefinicaoCSN = {
  actions?: Record<string, { params?: Record<string, Record<string, unknown>> }>;
  elements?: Record<string, Record<string, unknown>>;
  [chave: string]: unknown;
};
type ModeloCSN = { definitions: Record<string, DefinicaoCSN> };

const REMOVIDAS_DE_TRATATIVAS = ['criarSubacao', 'delegarAcao', 'anexarEvidencia', 'removerEvidencia', 'comentarAcao'];

async function carregarModelo(): Promise<ModeloCSN> {
  return (await cds.load(['srv', 'app'])) as unknown as ModeloCSN;
}

function blocoEdmx(xml: string, abertura: string, fechamento: string): string {
  const inicio = xml.indexOf(abertura);
  if (inicio === -1) return '';
  const fim = xml.indexOf(fechamento, inicio);
  return xml.slice(inicio, fim === -1 ? xml.length : fim);
}

describe('Contrato do serviço do aplicativo (CA29, CA32)', () => {
  it('CA29: Tratativas só mantém Criar Ação e Comentar Tratativa; as demais estão em Acoes e em Evidencias, sem parâmetro de código', async () => {
    const modelo = await carregarModelo();
    const tratativas = Object.keys(modelo.definitions['TratativaAppService.Tratativas'].actions ?? {});
    const acoes = modelo.definitions['TratativaAppService.Acoes'].actions ?? {};
    const evidencias = modelo.definitions['TratativaAppService.Evidencias'].actions ?? {};

    expect(tratativas).toEqual(expect.arrayContaining(['criarAcao', 'comentarTratativa']));
    for (const removida of REMOVIDAS_DE_TRATATIVAS) expect(tratativas).not.toContain(removida);
    expect(Object.keys(acoes).sort()).toEqual(
      ['anexarEvidencia', 'comentarAcao', 'concluir', 'criarSubacao', 'delegarAcao', 'iniciar'].sort(),
    );
    expect(Object.keys(evidencias)).toEqual(['removerEvidencia']);
    expect(Object.keys(acoes.criarSubacao?.params ?? {}).sort()).toEqual(
      ['descricao', 'evidenciaObrigatoria', 'prazo', 'prioridade', 'responsavel'].sort(),
    );
    expect(Object.keys(acoes.delegarAcao?.params ?? {}).sort()).toEqual(['justificativa', 'novoResponsavel']);
    expect(Object.keys(acoes.anexarEvidencia?.params ?? {}).sort()).toEqual(
      ['conteudo', 'descricao', 'mimeType', 'nomeArquivo'],
    );
    expect(Object.keys(acoes.comentarAcao?.params ?? {}).sort()).toEqual(['mencoes', 'texto']);
    expect(Object.keys(evidencias.removerEvidencia?.params ?? {})).toEqual([]);
    expect(modelo.definitions['TratativaAppService.regrasAnexoEvidencia']).toBeDefined();
  });

  it('CA29: o EDMX liga as operações a Acoes e a Evidencias e não as liga mais a Tratativas', async () => {
    const r = await GET(`${BASE}/$metadata`, comoGestor);
    const xml = String(r.data);
    const ligadaA = (acao: string, entidade: string) =>
      new RegExp(
        `<Action Name="${acao}" IsBound="true">\\s*<Parameter Name="in" Type="TratativaAppService\\.${entidade}"`,
      ).test(xml);

    expect(r.status).toBe(200);
    for (const acao of ['criarSubacao', 'delegarAcao', 'anexarEvidencia', 'comentarAcao', 'iniciar', 'concluir']) {
      expect(ligadaA(acao, 'Acoes')).toBe(true);
    }
    expect(ligadaA('removerEvidencia', 'Evidencias')).toBe(true);
    for (const removida of REMOVIDAS_DE_TRATATIVAS) expect(ligadaA(removida, 'Tratativas')).toBe(false);
    expect(ligadaA('criarAcao', 'Tratativas')).toBe(true);
    expect(ligadaA('comentarTratativa', 'Tratativas')).toBe(true);
    expect(xml).toContain('<Function Name="regrasAnexoEvidencia"');
  });

  it('EDMX: @Core.OperationAvailable de cada operação aponta para a indicação correspondente e as indicações são propriedades', async () => {
    const r = await GET(`${BASE}/$metadata`, comoGestor);
    const xml = String(r.data);
    const disponibilidade: Array<[string, string, string]> = [
      ['criarAcao', 'Tratativas', 'podeCriarAcao'],
      ['comentarTratativa', 'Tratativas', 'podeComentarTratativa'],
      ['iniciar', 'Acoes', 'podeIniciarAcao'],
      ['concluir', 'Acoes', 'podeConcluirAcao'],
      ['criarSubacao', 'Acoes', 'podeCriarSubacao'],
      ['delegarAcao', 'Acoes', 'podeDelegar'],
      ['anexarEvidencia', 'Acoes', 'podeAnexarEvidencia'],
      ['comentarAcao', 'Acoes', 'podeComentarAcao'],
      ['removerEvidencia', 'Evidencias', 'podeRemover'],
    ];

    for (const [acao, entidade, flag] of disponibilidade) {
      const alvo = `TratativaAppService.${acao}(TratativaAppService.${entidade})`;
      const anotacoes = blocoEdmx(xml, `<Annotations Target="${alvo}">`, '</Annotations>');
      expect(anotacoes).toContain(`Term="Core.OperationAvailable" Path="in/${flag}"`);
    }
    const propriedades: Array<[string, string[]]> = [
      ['Tratativas', FLAGS_TRATATIVA.split(',')],
      ['Acoes', FLAGS_ACAO.split(',')],
      ['Evidencias', FLAGS_EVIDENCIA.split(',')],
    ];
    for (const [entidade, flags] of propriedades) {
      const tipo = blocoEdmx(xml, `<EntityType Name="${entidade}">`, '</EntityType>');
      for (const flag of flags) expect(tipo).toContain(`<Property Name="${flag}" Type="Edm.Boolean"`);
    }
  });

  it('CA32: Criar Subação de linha e Criar Ação têm Prazo como data, listas fixas e ajuda de pesquisa de colaboradores; Delegar Ação também', async () => {
    const modelo = await carregarModelo();
    const r = await GET(`${BASE}/$metadata`, comoGestor);
    const xml = String(r.data);
    const bloco = blocoEdmx(xml, '<Action Name="criarSubacao" IsBound="true">', '</Action>');
    const colaboradores = (param: Record<string, unknown> | undefined) => ({
      colecao: param?.['@Common.ValueList.CollectionPath'],
      propriedades: ((param?.['@Common.ValueList.Parameters'] ?? []) as Array<{ ValueListProperty: string }>).map(
        (p) => p.ValueListProperty,
      ),
    });
    const subacao = modelo.definitions['TratativaAppService.Acoes'].actions?.criarSubacao?.params ?? {};
    const delegar = modelo.definitions['TratativaAppService.Acoes'].actions?.delegarAcao?.params ?? {};
    const criarAcaoParams =
      modelo.definitions['TratativaAppService.Tratativas'].actions?.criarAcao?.params ?? {};

    expect(bloco).toContain('<Parameter Name="prazo" Type="Edm.Date"/>');
    for (const params of [subacao, criarAcaoParams]) {
      expect(params.prazo?.type).toBe('cds.Date');
      expect(params.prioridade?.['@Common.ValueListWithFixedValues']).toBe(true);
      expect(params.prioridade?.['@Common.ValueList.CollectionPath']).toBe('ValoresPrioridade');
      expect(params.evidenciaObrigatoria?.['@Common.ValueListWithFixedValues']).toBe(true);
      expect(params.evidenciaObrigatoria?.['@Common.ValueList.CollectionPath']).toBe('ValoresEvidenciaObrigatoria');
      expect(colaboradores(params.responsavel)).toEqual({
        colecao: 'Colaboradores',
        propriedades: ['matricula', 'nome', 'email'],
      });
    }
    expect(colaboradores(delegar.novoResponsavel)).toEqual({
      colecao: 'Colaboradores',
      propriedades: ['matricula', 'nome', 'email'],
    });
  });
});
