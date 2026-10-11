import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as (url: string, opcoes?: unknown) => Promise<Resposta>;
const enviar = POST as unknown as Envia;
const BASE = '/api/analitico/v1';

type Resposta = { status: number; data: unknown };
type Linha = Record<string, unknown>;
type Colecao = { value: Linha[]; '@odata.context'?: string };
type Erro = { error?: { message?: string; target?: string } };

jest.setTimeout(60000);

beforeAll(registrarCredenciais);

async function criar(criticidade: 'Baixa' | 'Média' | 'Alta' | 'Crítica'): Promise<void> {
  const r = await criarAvulsa(
    enviar,
    { titulo: `Consulta OData ${criticidade} ${sufixoUnico()}`, criticidade },
  );

  expect(r.status).toBe(200);
}

function periodo(nome: string, inicio: string, fim: string): string {
  return `${BASE}/${nome}(periodoInicio='${encodeURIComponent(inicio)}',periodoFim='${encodeURIComponent(fim)}')`;
}

function erro(resposta: Resposta): Erro['error'] {
  return (resposta.data as Erro).error;
}

describe('AnaliticoService: OData v4, paginação e precedência D10', () => {
  it('CA23: pagina TratativasPorCriticidade com $top/$skip e aplica $select, $orderby e $filter', async () => {
    const criticidades: Array<'Baixa' | 'Média' | 'Alta' | 'Crítica'> = ['Baixa', 'Média', 'Alta', 'Crítica'];
    await Promise.all(criticidades.map(criar));
    const filtro = encodeURIComponent("criticidade ne 'Urgente'");
    const paginaInicial = await consultar(
      `${BASE}/TratativasPorCriticidade?$filter=${filtro}&$select=criticidade&$orderby=criticidade asc&$top=2&$skip=0`,
      comoGestor,
    );
    const paginaSeguinte = await consultar(
      `${BASE}/TratativasPorCriticidade?$filter=${filtro}&$select=criticidade&$orderby=criticidade asc&$top=2&$skip=2`,
      comoGestor,
    );

    expect(paginaInicial.status).toBe(200);
    expect(paginaSeguinte.status).toBe(200);
    const inicial = paginaInicial.data as Colecao;
    const seguinte = paginaSeguinte.data as Colecao;
    expect(inicial['@odata.context']).toEqual(expect.any(String));
    expect(inicial.value).toHaveLength(2);
    expect(seguinte.value).toHaveLength(2);
    expect(inicial.value.map((linha) => linha.criticidade)).toEqual(['Alta', 'Baixa']);
    expect(seguinte.value.map((linha) => linha.criticidade)).toEqual(['Crítica', 'Média']);
    for (const linha of [...inicial.value, ...seguinte.value]) {
      expect(Object.keys(linha).filter((chave) => !chave.startsWith('@'))).toEqual(['criticidade']);
    }
  });

  it.each(['1001', '0'])(
    'CA24: recusa $top=%s fora do intervalo analítico permitido',
    async (top) => {
      const r = await consultar(`${BASE}/TratativasPorOrigem?$top=${top}`, comoGestor);

      expect(r.status).toBe(400);
      expect(erro(r)?.message).toBe('O campo Tamanho da página aceita de 1 a 1000.');
      expect(erro(r)?.target).toBe('$top');
    },
  );

  it('CA31: recusa criticidade fora do catálogo com target nominal', async () => {
    const filtro = encodeURIComponent("criticidade eq 'Urgente'");
    const r = await consultar(`${BASE}/TratativasPorCriticidade?$filter=${filtro}`, comoGestor);

    expect(r.status).toBe(400);
    expect(erro(r)?.message).toBe('Criticidade inválida: use Baixa, Média, Alta ou Crítica.');
    expect(erro(r)?.target).toBe('criticidade');
  });

  it.each([
    ['periodoInicio', '2026.10.08', '2026-10-10'],
    ['periodoFim', '2026-10-08', '2026.10.10'],
  ])('CA32: recusa %s com data fora do formato ISO 8601', async (campo, inicio, fim) => {
    const r = await consultar(periodo('consultarTempoMedioResolucao', inicio, fim), comoGestor);

    expect(r.status).toBe(400);
    expect(erro(r)?.message).toBe('Data inválida.');
    expect(erro(r)?.target).toBe(campo);
  });

  it('R12: formato inválido de data de corte é recusado com target dataCorte', async () => {
    const r = await consultar(
      `${BASE}/consultarTratativasVencidas(dataCorte='${encodeURIComponent('2026.10.08')}')`,
      comoGestor,
    );

    expect(r.status).toBe(400);
    expect(erro(r)?.message).toBe('Data inválida.');
    expect(erro(r)?.target).toBe('dataCorte');
  });

  it('CA32a: recusa periodoInicio posterior a periodoFim', async () => {
    const r = await consultar(
      periodo('consultarCumprimentoDePrazo', '2026-10-15', '2026-10-10'),
      comoGestor,
    );

    expect(r.status).toBe(400);
    expect(erro(r)?.message).toBe(
      'Período inválido: a data inicial não pode ser posterior à data final.',
    );
    expect(erro(r)?.target).toBe('periodoInicio');
  });

  it('CA33: filtros temporais válidos sem ocorrências retornam coleção vazia', async () => {
    const r = await consultar(
      periodo('consultarTendenciaMensal', '2099-01-01', '2099-01-31'),
      comoGestor,
    );

    expect(r.status).toBe(200);
    expect((r.data as Colecao).value).toEqual([]);
  });

  it('R12: autorização precede a validação semântica de período e paginação', async () => {
    const r = await consultar(
      `${periodo('consultarTempoMedioResolucao', '2026.10.15', '2026-10-10')}?$top=1001`,
      comoUsuario,
    );

    expect(r.status).toBe(403);
    expect(erro(r)?.message).toBe('Acesso negado.');
  });

  it('R12: data inválida precede período invertido e $top inválido', async () => {
    const r = await consultar(
      `${periodo('consultarTempoMedioResolucao', '2026.10.15', '2026-10-10')}?$top=1001`,
      comoGestor,
    );

    expect(r.status).toBe(400);
    expect(erro(r)?.message).toBe('Data inválida.');
    expect(erro(r)?.target).toBe('periodoInicio');
  });

  it('R12: criticidade inválida precede $top inválido', async () => {
    const filtro = encodeURIComponent("criticidade eq 'Urgente'");
    const r = await consultar(`${BASE}/TratativasPorCriticidade?$filter=${filtro}&$top=1001`, comoGestor);

    expect(r.status).toBe(400);
    expect(erro(r)?.message).toBe('Criticidade inválida: use Baixa, Média, Alta ou Crítica.');
    expect(erro(r)?.target).toBe('criticidade');
  });
});
