import cds from '@sap/cds';
import { criarAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { encerrarComAval } from './apoio/encerramento';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
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
  const r = await criarAvulsa(enviar, {
    titulo: `Correção analítica ${sufixoUnico()}`,
    criticidade: 'Alta',
    ...dados,
  });

  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function mudar(codigo: string, status: 'Encerrada' | 'Em andamento' | 'Cancelada', instante: string): Promise<void> {
  fixarInstante(instante);
  if (status === 'Encerrada') {
    const encerramento = await encerrarComAval(enviar, codigo);
    expect(encerramento.status).toBe(204);
    return;
  }
  const r = await mudarStatus(
    enviar,
    codigo,
    {
      status,
      ...(status === 'Em andamento' || status === 'Cancelada'
        ? { justificativa: `Transição analítica ${sufixoUnico()}` }
        : {}),
    },
    comoGestor,
  );

  expect(r.status).toBe(204);
}

async function funcao(nome: string, inicio: string, fim: string): Promise<Linha> {
  const r = await consultar(
    `${BASE}/${nome}(periodoInicio='${encodeURIComponent(inicio)}',periodoFim='${encodeURIComponent(fim)}')`,
    comoGestor,
  );

  expect(r.status).toBe(200);
  return r.data as Linha;
}

async function colecao(nome: string, query = ''): Promise<Linha[]> {
  const r = await consultar(`${BASE}/${nome}${query}`, comoGestor);

  expect(r.status).toBe(200);
  return (r.data as Colecao).value;
}

async function prepararCiclosComEncerramentoIneficaz(): Promise<void> {
  fixarInstante('2080-05-01T12:00:00Z');
  const encerrada = await criar();
  const reaberta = await criar();
  const cancelada = await criar();

  await mudar(encerrada, 'Encerrada', '2080-05-02T12:00:00Z');

  await mudar(reaberta, 'Encerrada', '2080-05-03T12:00:00Z');
  await mudar(reaberta, 'Em andamento', '2080-05-04T12:00:00Z');

  await mudar(cancelada, 'Encerrada', '2080-05-12T12:00:00Z');
  await mudar(cancelada, 'Em andamento', '2080-05-13T12:00:00Z');
  await mudar(cancelada, 'Cancelada', '2080-05-14T12:00:00Z');
}

describe('AnaliticoService: correções do parecer de diff', () => {
  it('R4(e): IndiceResolucao retorna 100.00 quando não há Tratativas criadas no período', async () => {
    const indice = await funcao('consultarIndiceResolucao', '2099-01-01', '2099-01-31');

    expect(Number(indice.indicePercentual)).toBe(100);
  });

  it('R3(c) e R6(c): CumprimentoDePrazo ignora encerramentos de Tratativas reaberta e cancelada', async () => {
    await prepararCiclosComEncerramentoIneficaz();

    const cumprimento = await funcao('consultarCumprimentoDePrazo', '2080-05-01', '2080-05-31');

    expect(Number(cumprimento.taxaPercentual)).toBe(100);
  });

  it('R3(d) e R6(c): TempoMedioResolucao ignora encerramentos de Tratativas reaberta e cancelada', async () => {
    await prepararCiclosComEncerramentoIneficaz();

    const tempoMedio = await funcao('consultarTempoMedioResolucao', '2080-05-01', '2080-05-31');

    expect(Number(tempoMedio.mediaDias)).toBe(1);
  });

  it('R9: uma view analítica entrega a segunda linha ao paginar com $top=1 e $skip=1', async () => {
    const unidadeA = `Página A ${sufixoUnico()}`;
    const unidadeB = `Página B ${sufixoUnico()}`;
    const tratativaA = await criar({ unidade: unidadeA });
    const tratativaB = await criar({ unidade: unidadeB });
    for (const tratativa of [tratativaA, tratativaB]) {
      const r = await criarAcao(
        enviar,
        tratativa,
        {
          descricao: `Ação para paginação ${sufixoUnico()}`,
          responsavel: 'M1001',
          prazo: '2026-11-07',
        },
        comoGestor,
      );
      expect(r.status).toBe(200);
    }

    const filtro = encodeURIComponent(`unidade eq '${unidadeA}' or unidade eq '${unidadeB}'`);
    const linhasPaginadas = await colecao(
      'PendenciasPorUnidade',
      `?$filter=${filtro}&$orderby=unidade asc&$top=1&$skip=1`,
    );

    expect(linhasPaginadas).toHaveLength(1);
    expect(linhasPaginadas[0]).toEqual(expect.objectContaining({ unidade: unidadeB, total: 1 }));
  });

  it('R2(b) e R7: TratativasVencidas exclui o prazo de hoje em UTC e inclui o de ontem', async () => {
    fixarInstante('2026-10-04T12:00:00Z');
    const ontem = await criar({ criticidade: 'Crítica' });
    fixarInstante('2026-10-05T12:00:00Z');
    const hoje = await criar({ criticidade: 'Crítica' });
    const [tratativaOntem] = await linhas('Tratativas', { codigo: ontem });
    const [tratativaHoje] = await linhas('Tratativas', { codigo: hoje });

    expect(tratativaOntem.dataPrevistaConclusao).toBe('2026-10-07');
    expect(tratativaHoje.dataPrevistaConclusao).toBe('2026-10-08');

    fixarInstante('2026-10-08T12:00:00Z');
    const vencidas = await colecao('TratativasVencidas');

    expect(Number(vencidas[0].total)).toBe(1);
  });

  it('R3(e): RankingAreas ordena Sem Área pelo volume ativo, inclusive contra áreas preenchidas', async () => {
    const areaPreenchida = `Área preenchida ${sufixoUnico()}`;
    const antes = await colecao('RankingAreas');
    for (let i = 0; i < 3; i++) await criar();
    for (let i = 0; i < 2; i++) await criar({ area: areaPreenchida });

    const depois = await colecao('RankingAreas');
    const totalAntesSemArea = Number(antes.find((linha) => linha.area === 'Sem Área')?.total ?? 0);
    const semArea = depois.find((linha) => linha.area === 'Sem Área');
    const preenchida = depois.find((linha) => linha.area === areaPreenchida);

    expect(Number(semArea?.total)).toBe(totalAntesSemArea + 3);
    expect(Number(preenchida?.total)).toBe(2);
    expect(depois.indexOf(semArea as Linha)).toBeLessThan(depois.indexOf(preenchida as Linha));
  });
});
