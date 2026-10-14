import cds from '@sap/cds';
import { criarAcao } from './apoio/acoes';
import { registrarCredenciais } from './apoio/credenciais';
import { anexarEvidencia, gerarPDF } from './apoio/evidencias';
import { encerrarComAval } from './apoio/encerramento';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as (url: string, opcoes?: unknown) => Promise<Resposta>;
const enviar = POST as unknown as Envia;
const BASE = '/api/analitico/v1';
const HOJE = '2026-10-08';

type Resposta = { status: number; data: unknown };
type Linha = Record<string, unknown>;
type Colecao = { value: Linha[] };

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
beforeEach(() => fixarInstante(`${HOJE}T12:00:00Z`));
afterEach(liberarRelogio);

async function criar(dados: Record<string, unknown> = {}): Promise<string> {
  const payload: Record<string, unknown> = { titulo: `Indicador executivo ${sufixoUnico()}`, ...dados };
  const r = payload.origem === undefined ? await criarAvulsa(enviar, payload) : await abrirPorApp(enviar, payload);

  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function encerrar(codigo: string, instante: string): Promise<void> {
  fixarInstante(instante);
  const r = await encerrarComAval(enviar, codigo);

  expect(r.status).toBe(204);
}

async function colecao(nome: string): Promise<Linha[]> {
  const r = await consultar(`${BASE}/${nome}`, comoGestor);

  expect(r.status).toBe(200);
  return (r.data as Colecao).value;
}

async function funcao(nome: string, inicio: string, fim: string): Promise<Resposta> {
  return consultar(
    `${BASE}/${nome}(periodoInicio='${encodeURIComponent(inicio)}',periodoFim='${encodeURIComponent(fim)}')`,
    comoGestor,
  );
}

async function totalizador(nome: string): Promise<number> {
  const linhas = await colecao(nome);

  expect(linhas).toHaveLength(1);
  return Number(linhas[0].total);
}

async function novaAcao(
  tratativa: string,
  evidenciaObrigatoria: 'sim' | 'não' = 'não',
): Promise<string> {
  const r = await criarAcao(
    enviar,
    tratativa,
    {
      descricao: `Ação executiva ${sufixoUnico()}`,
      responsavel: 'M1001',
      prazo: '2026-11-07',
      evidenciaObrigatoria,
    },
    comoGestor,
  );

  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

describe('AnaliticoService: métricas executivas e evidências pendentes', () => {
  it('CA13: TendenciaMensal agrupa criadas e encerradas nos meses de agosto e setembro de 2026', async () => {
    fixarInstante('2026-08-01T12:00:00Z');
    const agostoEncerrada = await criar();
    await criar();
    await encerrar(agostoEncerrada, '2026-08-02T12:00:00Z');

    fixarInstante('2026-09-01T12:00:00Z');
    const setembroEncerradaA = await criar();
    const setembroEncerradaB = await criar();
    await criar();
    await encerrar(setembroEncerradaA, '2026-09-02T12:00:00Z');
    await encerrar(setembroEncerradaB, '2026-09-03T12:00:00Z');

    const r = await funcao('consultarTendenciaMensal', '2026-08-01', '2026-09-30');

    expect(r.status).toBe(200);
    const linhas = (r.data as Colecao).value;
    expect(linhas.filter((linha) => linha.mesReferencia === '2026-08')).toEqual([
      expect.objectContaining({ totalCriadas: 2, totalEncerradas: 1 }),
    ]);
    expect(linhas.filter((linha) => linha.mesReferencia === '2026-09')).toEqual([
      expect.objectContaining({ totalCriadas: 3, totalEncerradas: 2 }),
    ]);
  });

  it('CA14: VolumePorOrigem devolve total e percentual de cada origem sobre o volume global', async () => {
    const origemA = `Notificação de Risco ${sufixoUnico()}`;
    const origemB = `Origem Corporativa ${sufixoUnico()}`;
    const antes = await colecao('VolumePorOrigem');
    const volumeAntes = antes.reduce((soma, linha) => soma + Number(linha.total), 0);
    for (let i = 0; i < 10; i++) await criar({ origem: origemA });
    for (let i = 0; i < 10; i++) await criar({ origem: origemB });

    const depois = await colecao('VolumePorOrigem');
    const daOrigemA = depois.find((linha) => linha.origem === origemA);
    const daOrigemB = depois.find((linha) => linha.origem === origemB);
    const percentualEsperado = Number(((10 / (volumeAntes + 20)) * 100).toFixed(2));

    expect(daOrigemA).toEqual(expect.objectContaining({ total: 10, percentual: percentualEsperado }));
    expect(daOrigemB).toEqual(expect.objectContaining({ total: 10, percentual: percentualEsperado }));
  });

  it('CA15: PrincipaisDesvios agrupa origens vencidas e ordena-as por quantidade decrescente', async () => {
    const maior = `Maior desvio ${sufixoUnico()}`;
    const menor = `Menor desvio ${sufixoUnico()}`;
    fixarInstante('2026-10-01T12:00:00Z');
    for (let i = 0; i < 3; i++) await criar({ origem: maior, criticidade: 'Crítica' });
    for (let i = 0; i < 2; i++) await criar({ origem: menor, criticidade: 'Crítica' });
    fixarInstante(`${HOJE}T12:00:00Z`);

    const desvios = await colecao('PrincipaisDesvios');
    const doCenario = desvios.filter((linha) => linha.origem === maior || linha.origem === menor);

    expect(doCenario).toEqual([
      expect.objectContaining({ origem: maior, totalDesvios: 3 }),
      expect.objectContaining({ origem: menor, totalDesvios: 2 }),
    ]);
  });

  it('CA16: BacklogTotal soma cinco Tratativas ativas e oito Ações ativas, sem incluir canceladas', async () => {
    const antes = await totalizador('BacklogTotal');
    const tratativas = await Promise.all(Array.from({ length: 5 }, () => criar()));
    const distribuicao = [2, 2, 2, 1, 1];
    for (const [indice, quantidade] of distribuicao.entries()) {
      for (let i = 0; i < quantidade; i++) await novaAcao(tratativas[indice]);
    }

    const cancelada = await criar();
    await novaAcao(cancelada);
    const cancelamento = await mudarStatus(
      enviar,
      cancelada,
      { status: 'Cancelada', justificativa: 'Cancelada para o cenário executivo' },
      comoGestor,
    );
    expect(cancelamento.status).toBe(204);

    expect(await totalizador('BacklogTotal')).toBe(antes + 13);
  });

  it('CA17: IndiceResolucao retorna 200.00% quando dez encerramentos superam cinco criações no período', async () => {
    fixarInstante('2026-12-31T12:00:00Z');
    const passivo = await Promise.all(Array.from({ length: 10 }, () => criar()));
    fixarInstante('2027-01-01T12:00:00Z');
    for (let i = 0; i < 5; i++) await criar();
    for (const codigo of passivo) await encerrar(codigo, '2027-01-02T12:00:00Z');

    const r = await funcao('consultarIndiceResolucao', '2027-01-01', '2027-01-31');

    expect(r.status).toBe(200);
    expect(Number((r.data as Linha).indicePercentual)).toBe(200);
  });

  it('CA18: EvidenciasPendentes conta duas ações ativas obrigatórias sem evidência e exclui a já comprovada', async () => {
    const antes = await totalizador('EvidenciasPendentes');
    const tratativa = await criar();
    const semEvidenciaA = await novaAcao(tratativa, 'sim');
    const semEvidenciaB = await novaAcao(tratativa, 'sim');
    const comprovada = await novaAcao(tratativa, 'sim');
    const anexo = await anexarEvidencia(
      enviar,
      tratativa,
      {
        acao: comprovada,
        nomeArquivo: `evidencia_${sufixoUnico()}.pdf`,
        mimeType: 'application/pdf',
        conteudo: gerarPDF(),
        descricao: 'Comprovação do cenário executivo',
      },
      comoGestor,
    );

    expect(anexo.status).toBe(200);
    expect(semEvidenciaA).not.toBe(semEvidenciaB);
    expect(await totalizador('EvidenciasPendentes')).toBe(antes + 2);
  });

  it('CA34: Origens SESMT, Qualidade e RH recebem os mesmos cálculos analíticos', async () => {
    const origens = [
      `SESMT ${sufixoUnico()}`,
      `Qualidade ${sufixoUnico()}`,
      `RH ${sufixoUnico()}`,
    ];
    fixarInstante('2026-10-01T12:00:00Z');
    for (const origem of origens) await criar({ origem, criticidade: 'Crítica' });
    fixarInstante(`${HOJE}T12:00:00Z`);

    const desvios = await colecao('PrincipaisDesvios');

    for (const origem of origens) {
      expect(desvios).toContainEqual(expect.objectContaining({ origem, totalDesvios: 1 }));
    }
  });
});
