import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as (url: string, opcoes?: unknown) => Promise<Resposta>;
const enviar = POST as unknown as Envia;
const BASE = '/api/analitico/v1';

type Resposta = { status: number; data: unknown };
type Linha = Record<string, unknown>;
type Colecao = { value: Linha[] };

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
beforeEach(() => fixarInstante('2026-10-08T12:00:00Z'));
afterEach(liberarRelogio);

async function criar(dados: Record<string, unknown> = {}): Promise<string> {
  const payload: Record<string, unknown> = { titulo: `Métrica de gestão ${sufixoUnico()}`, ...dados };
  const r = payload.origem === undefined ? await criarAvulsa(enviar, payload) : await abrirPorApp(enviar, payload);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function encerrar(codigo: string, instante: string): Promise<void> {
  fixarInstante(instante);
  const r = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);
  expect(r.status).toBe(204);
}

async function cancelar(codigo: string): Promise<void> {
  const r = await mudarStatus(
    enviar,
    codigo,
    { status: 'Cancelada', justificativa: 'Cancelada para o cenário analítico' },
    comoGestor,
  );
  expect(r.status).toBe(204);
}

async function colecao(nome: string, query = ''): Promise<Linha[]> {
  const r = await consultar(`${BASE}/${nome}${query}`, comoGestor);
  expect(r.status).toBe(200);
  return (r.data as Colecao).value;
}

async function funcao(nome: string, inicio: string, fim: string): Promise<Linha> {
  const r = await consultar(
    `${BASE}/${nome}(periodoInicio='${encodeURIComponent(inicio)}',periodoFim='${encodeURIComponent(fim)}')`,
    comoGestor,
  );
  expect(r.status).toBe(200);
  return r.data as Linha;
}

describe('AnaliticoService: gestão, histórico e corte temporal', () => {
  it('CA7: agrupa origens e consolida tratativas avulsas como Sem Origem', async () => {
    const antes = await colecao('TratativasPorOrigem');
    const origemA = `Registro de Acidente ${sufixoUnico()}`;
    const origemB = `Origem B ${sufixoUnico()}`;
    await criar({ origem: origemA });
    await criar({ origem: origemA });
    await criar({ origem: origemA });
    await criar({ origem: origemA });
    await criar({ origem: origemA });
    await criar({ origem: origemB });
    await criar({ origem: origemB });
    await criar({ origem: origemB });
    await criar();
    await criar();

    const depois = await colecao('TratativasPorOrigem');
    const totalAntes = (origem: string) => Number(antes.find((r) => r.origem === origem)?.total ?? 0);
    expect(Number(depois.find((r) => r.origem === origemA)?.total)).toBe(totalAntes(origemA) + 5);
    expect(Number(depois.find((r) => r.origem === origemB)?.total)).toBe(totalAntes(origemB) + 3);
    expect(Number(depois.find((r) => r.origem === 'Sem Origem')?.total)).toBe(totalAntes('Sem Origem') + 2);
  });

  it('CA8: agrupa tratativas pelas quatro criticidades', async () => {
    const antes = await colecao('TratativasPorCriticidade');
    for (const criticidade of ['Baixa', 'Média', 'Alta', 'Crítica']) await criar({ criticidade });
    const depois = await colecao('TratativasPorCriticidade');

    for (const criticidade of ['Baixa', 'Média', 'Alta', 'Crítica']) {
      const inicial = Number(antes.find((r) => r.criticidade === criticidade)?.total ?? 0);
      expect(Number(depois.find((r) => r.criticidade === criticidade)?.total)).toBe(inicial + 1);
    }
  });

  it('CA9: calcula 75.00% de cumprimento usando o encerramento no prazo', async () => {
    const periodo = ['2040-01-01', '2040-01-31'];
    fixarInstante('2040-01-01T12:00:00Z');
    const noPrazo = await Promise.all([criar({ criticidade: 'Crítica' }), criar({ criticidade: 'Crítica' }), criar({ criticidade: 'Crítica' })]);
    const atrasada = await criar({ criticidade: 'Crítica' });
    for (const codigo of noPrazo) await encerrar(codigo, '2040-01-03T12:00:00Z');
    await encerrar(atrasada, '2040-01-10T12:00:00Z');

    const resultado = await funcao('consultarCumprimentoDePrazo', periodo[0], periodo[1]);
    expect(Number(resultado.taxaPercentual)).toBe(75);
  });

  it('CA10 e R-05: calcula tempo médio e retorna 100.00%/0.0 sem encerramentos', async () => {
    fixarInstante('2041-02-01T12:00:00Z');
    const quatroDias = await criar();
    const seisDias = await criar();
    await encerrar(quatroDias, '2041-02-05T12:00:00Z');
    await encerrar(seisDias, '2041-02-07T12:00:00Z');

    const media = await funcao('consultarTempoMedioResolucao', '2041-02-01', '2041-02-28');
    expect(Number(media.mediaDias)).toBe(5);

    const vazioCumprimento = await funcao('consultarCumprimentoDePrazo', '2042-01-01', '2042-01-31');
    const vazioMedia = await funcao('consultarTempoMedioResolucao', '2042-01-01', '2042-01-31');
    expect(Number(vazioCumprimento.taxaPercentual)).toBe(100);
    expect(Number(vazioMedia.mediaDias)).toBe(0);
  });

  it('CA11: ordena RankingAreas por volume ativo e agrupa área ausente como Sem Área', async () => {
    const prefixo = `Área ${sufixoUnico()}`;
    const antes = await colecao('RankingAreas');
    for (let i = 0; i < 3; i++) await criar({ area: `${prefixo} Operação` });
    for (let i = 0; i < 2; i++) await criar({ area: `${prefixo} Manutenção` });
    await criar({ area: `${prefixo} Logística` });
    await criar();

    const linhas = await colecao('RankingAreas');
    const areasDoCenario = [`${prefixo} Operação`, `${prefixo} Manutenção`, `${prefixo} Logística`];
    const totalAntes = (area: string) => Number(antes.find((r) => r.area === area)?.total ?? 0);
    const totalDepois = (area: string) => Number(linhas.find((r) => r.area === area)?.total ?? 0);
    expect(linhas.filter((r) => areasDoCenario.includes(String(r.area))).map((r) => r.area)).toEqual([
      `${prefixo} Operação`,
      `${prefixo} Manutenção`,
      `${prefixo} Logística`,
    ]);
    expect(areasDoCenario.map(totalDepois)).toEqual(areasDoCenario.map((area) => totalAntes(area) + (area.endsWith('Operação') ? 3 : area.endsWith('Manutenção') ? 2 : 1)));
    expect(totalDepois('Sem Área')).toBe(totalAntes('Sem Área') + 1);
  });

  it('CA12 e CA20: tratativa cancelada não entra em cumprimento nem tempo de resolução', async () => {
    fixarInstante('2043-03-01T12:00:00Z');
    const codigo = await criar({ criticidade: 'Crítica' });
    await cancelar(codigo);

    const cumprimento = await funcao('consultarCumprimentoDePrazo', '2043-03-01', '2043-03-31');
    const media = await funcao('consultarTempoMedioResolucao', '2043-03-01', '2043-03-31');
    expect(Number(cumprimento.taxaPercentual)).toBe(100);
    expect(Number(media.mediaDias)).toBe(0);
  });

  it('CA20: filtros temporais válidos isolam os eventos do período informado', async () => {
    fixarInstante('2044-04-01T12:00:00Z');
    const dentro = await criar();
    await encerrar(dentro, '2044-04-02T12:00:00Z');
    fixarInstante('2044-04-01T12:00:00Z');
    const fora = await criar();
    await encerrar(fora, '2044-05-02T12:00:00Z');

    const abril = await funcao('consultarTempoMedioResolucao', '2044-04-01', '2044-04-30');
    const maio = await funcao('consultarTempoMedioResolucao', '2044-05-01', '2044-05-31');
    expect(Number(abril.mediaDias)).toBe(1);
    expect(Number(maio.mediaDias)).toBe(31);
  });

  it('CA21: usa a data do evento em UTC para o corte temporal', async () => {
    fixarInstante('2045-06-30T23:30:00-03:00');
    const codigo = await criar();
    await encerrar(codigo, '2045-07-01T02:30:00Z');

    const antesDaVirada = await funcao('consultarTempoMedioResolucao', '2045-06-30', '2045-06-30');
    const depoisDaVirada = await funcao('consultarTempoMedioResolucao', '2045-07-01', '2045-07-01');
    expect(Number(antesDaVirada.mediaDias)).toBe(0);
    expect(Number(depoisDaVirada.mediaDias)).toBe(0);
  });

  it('CA22: normaliza espaços e caixa das origens numa única chave canônica', async () => {
    const antes = await colecao('TratativasPorOrigem');
    await criar({ origem: 'advertência' });
    await criar({ origem: ' Advertência ' });
    await criar({ origem: 'ADVERTÊNCIA' });
    const depois = await colecao('TratativasPorOrigem');
    const totalAntes = Number(antes.find((r) => r.origem === 'Advertência')?.total ?? 0);
    const advertencia = depois.find((r) => r.origem === 'Advertência');

    expect(advertencia?.origem).toBe('Advertência');
    expect(Number(advertencia?.total)).toBe(totalAntes + 3);
    expect(depois.filter((r) => /advertência/i.test(String(r.origem).trim()))).toHaveLength(1);
  });
});
