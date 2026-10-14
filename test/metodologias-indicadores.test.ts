import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao } from './apoio/acoes';
import { comoValidador, emitirAval } from './apoio/aval';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, type Envia, type Resposta } from './apoio/tratativas';
import { comoGestor, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as (url: string, identidade?: unknown) => Promise<Resposta>;
const enviar = POST as unknown as Envia;

const BASE = '/api/analitico/v1';
const TRATATIVA = '/api/tratativa/v1';
const PARECER_APROVADO = { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' };

jest.setTimeout(90000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

function erro(resposta: Resposta): { message?: string; target?: string } {
  return (resposta.data as { error?: { message?: string; target?: string } })?.error ?? {};
}

function itens(dados: unknown): Record<string, unknown>[] {
  const corpo = dados as { value?: Record<string, unknown>[] };
  return Array.isArray(corpo?.value) ? corpo.value : [];
}

function periodo(inicio: string, fim: string): string {
  return `periodoInicio='${encodeURIComponent(inicio)}',periodoFim='${encodeURIComponent(fim)}'`;
}

async function criarIniciada(instante: string): Promise<string> {
  fixarInstante(instante);
  const abertura = await criarAvulsa(enviar, { titulo: `Indicador ${Date.now()}` });
  expect(abertura.status).toBe(200);
  const codigo = abertura.data.codigo as string;
  const inicio = await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor);
  expect(inicio.status).toBe(204);
  return codigo;
}

async function emitir(codigo: string, instante: string, dados = PARECER_APROVADO): Promise<void> {
  fixarInstante(instante);
  const resposta = await emitirAval(enviar, codigo, dados, comoValidador);
  expect(resposta.status).toBe(204);
}

async function acaoConcluida(codigo: string, instante: string): Promise<void> {
  fixarInstante(instante);
  const criada = await criarAcao(
    enviar,
    codigo,
    { descricao: 'Ação corretiva após reprovação', responsavel: 'M1001', prazo: '2026-12-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
    comoGestor,
  );
  expect(criada.status).toBe(200);
  const conclusao = await mudarStatusAcao(enviar, codigo, { acao: criada.data.codigo, status: 'Concluída' }, comoGestor);
  expect(conclusao.status).toBe(204);
}

async function definirMetodologia(codigo: string, categoria: string, como: unknown = comoGestor): Promise<void> {
  const resposta = await enviar(
    `${TRATATIVA}/Tratativas(${codigo})/definirMetodologia`,
    {
      ferramenta: '3W',
      categoriaCausaRaiz: categoria,
      dados: JSON.stringify({ oQue: 'Desvio observado na inspeção', onde: 'Setor de Embalagem', quando: 'Turno da manhã' }),
      confirmarSubstituicao: false,
    },
    como,
  );
  expect(resposta.status).toBe(204);
}

async function mapaPareto(): Promise<Map<string, number>> {
  const resposta = await consultar(`${BASE}/ParetoCausasRaizes`, comoGestor);
  expect(resposta.status).toBe(200);
  return new Map(itens(resposta.data).map((linha) => [String(linha.categoriaCausaRaiz), Number(linha.total)]));
}

describe('Indicadores de eficácia e causas raízes (task 006)', () => {
  it('CA30: o Pareto agrega as macrocausas no banco e nega acesso a quem não tem papel analítico', async () => {
    const negado = await consultar(`${BASE}/ParetoCausasRaizes`, comoUsuario);
    expect(negado.status).toBe(403);
    expect(erro(negado).message).toBe('Acesso negado.');

    const antes = await mapaPareto();

    const processoA = await criarIniciada('2026-06-01T12:00:00.000Z');
    const processoB = await criarIniciada('2026-06-01T12:00:00.000Z');
    const maquina = await criarIniciada('2026-06-01T12:00:00.000Z');
    await definirMetodologia(processoA, 'Método/Processo');
    await definirMetodologia(processoB, 'Método/Processo');
    await definirMetodologia(maquina, 'Máquina/Equipamento');

    const depois = await mapaPareto();
    expect((depois.get('Método/Processo') ?? 0) - (antes.get('Método/Processo') ?? 0)).toBe(2);
    expect((depois.get('Máquina/Equipamento') ?? 0) - (antes.get('Máquina/Equipamento') ?? 0)).toBe(1);
  });

  it('CA40: a Aderência Metodológica é o percentual de Tratativas do período com metodologia preenchida', async () => {
    const comMetodologia: string[] = [];
    const semMetodologia: string[] = [];
    for (let indice = 0; indice < 10; indice += 1) {
      const codigo = await criarIniciada('2026-04-15T12:00:00.000Z');
      (indice < 7 ? comMetodologia : semMetodologia).push(codigo);
    }
    expect(comMetodologia).toHaveLength(7);
    expect(semMetodologia).toHaveLength(3);
    for (const codigo of comMetodologia) {
      await definirMetodologia(codigo, 'Método/Processo');
    }

    const resposta = await consultar(`${BASE}/consultarAderenciaMetodologica(${periodo('2026-04-15', '2026-04-15')})`, comoGestor);
    expect(resposta.status).toBe(200);
    expect(resposta.data.percentual).toBe(70);
  });

  it('Taxa de Eficácia (DC-14): primeiro Aval de todo o histórico, filtrado pelo período', async () => {
    const aprovadaA = await criarIniciada('2026-05-01T12:00:00.000Z');
    await emitir(aprovadaA, '2026-05-05T12:00:00.000Z');
    const aprovadaB = await criarIniciada('2026-05-01T12:00:00.000Z');
    await emitir(aprovadaB, '2026-05-06T12:00:00.000Z');
    const reprovadaDepoisAprovada = await criarIniciada('2026-05-01T12:00:00.000Z');
    await emitir(reprovadaDepoisAprovada, '2026-05-07T12:00:00.000Z', {
      parecer: 'Reprovado',
      fundamentacao: 'A causa persiste após a verificação e exige nova ação corretiva.',
    });
    await acaoConcluida(reprovadaDepoisAprovada, '2026-05-08T12:00:00.000Z');
    await emitir(reprovadaDepoisAprovada, '2026-05-10T12:00:00.000Z');

    // Primeiro Aval fora do período (abril) e aprovação dentro dele: não entra no universo.
    const reprovadaAntes = await criarIniciada('2026-04-01T12:00:00.000Z');
    await emitir(reprovadaAntes, '2026-04-20T12:00:00.000Z', {
      parecer: 'Reprovado',
      fundamentacao: 'A causa persiste após a verificação e exige nova ação corretiva.',
    });
    await acaoConcluida(reprovadaAntes, '2026-05-02T12:00:00.000Z');
    await emitir(reprovadaAntes, '2026-05-12T12:00:00.000Z');

    const maio = await consultar(`${BASE}/consultarTaxaEficacia(${periodo('2026-05-01', '2026-05-31')})`, comoGestor);
    expect(maio.status).toBe(200);
    expect(maio.data.taxaPercentual).toBe(66.67);

    const vazio = await consultar(`${BASE}/consultarTaxaEficacia(${periodo('2020-01-01', '2020-01-31')})`, comoGestor);
    expect(vazio.status).toBe(200);
    expect(vazio.data.taxaPercentual).toBe(0);
  });

  it('CA39: tempo médio de verificação em dias corridos a partir da entrada em Em andamento (sem Ações)', async () => {
    const codigo = await criarIniciada('2026-10-13T12:00:00.000Z');
    await emitir(codigo, '2026-10-23T12:00:00.000Z');

    const resposta = await consultar(
      `${BASE}/consultarTempoMedioVerificacaoEficacia(${periodo('2026-10-01', '2026-10-31')})`,
      comoGestor,
    );
    expect(resposta.status).toBe(200);
    expect(resposta.data.mediaDias).toBe(10);
  });

  it('DC-14: a diferença usa datas civis no fuso da plataforma (não instantes UTC)', async () => {
    const codigo = await criarIniciada('2026-11-13T13:00:00.000Z'); // 2026-11-13 10h (São Paulo)
    await emitir(codigo, '2026-11-24T01:30:00.000Z'); // 2026-11-23 22h30 (São Paulo)

    const resposta = await consultar(
      `${BASE}/consultarTempoMedioVerificacaoEficacia(${periodo('2026-11-01', '2026-11-30')})`,
      comoGestor,
    );
    expect(resposta.status).toBe(200);
    expect(resposta.data.mediaDias).toBe(10);
  });

  it('período invertido é recusado com 400 nomeando o campo periodoInicio', async () => {
    const resposta = await consultar(
      `${BASE}/consultarTaxaEficacia(${periodo('2026-05-31', '2026-05-01')})`,
      comoGestor,
    );
    expect(resposta.status).toBe(400);
    expect(erro(resposta).target).toBe('periodoInicio');
  });
});
