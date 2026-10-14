import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao, type Consulta } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { comoValidador, consultarAval, emitirAval } from './apoio/aval';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const enviar = POST as unknown as Envia;
const BASE = '/api/tratativa/v1';

jest.setTimeout(60000);
beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

async function nova(): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Correcoes R22 ${Date.now()}` });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

function corpo(ferramenta: string, dados: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { ferramenta, dados: JSON.stringify(dados), confirmarSubstituicao: false, ...extra };
}

function definirCru(codigo: string, dados: Record<string, unknown>) {
  return POST(`${BASE}/Tratativas(${codigo})/definirMetodologia`, dados, comoGestor);
}

async function consultarMetodologia(codigo: string) {
  return GET(`${BASE}/consultarMetodologiaTratativa(codigoTratativa=${codigo})`, comoGestor);
}

function erro(r: { data: unknown }): { message?: string; target?: string } {
  return (r.data as { error?: { message?: string; target?: string } }).error ?? {};
}

// Categoria enviada no preparo e nos controles, para o RED falhar só pelo comportamento sob teste.
const CATEGORIA = { categoriaCausaRaiz: 'Método/Processo' };
const TRES_W = { oQue: 'Desvio na inspeção', onde: 'Linha de produção', quando: 'Turno da manhã' };
const CINCO_PORQUES = {
  problema: 'Peça fora de especificação',
  porque1: 'Ajuste incorreto',
  porque2: 'Procedimento desatualizado',
  conclusao: 'A causa raiz foi o ajuste incorreto.',
};

describe('Correções do grupo 2 (R-22): opcionalidade da categoria e limites de R2', () => {
  it('I-01/R2 a: 3W do CA1 sem Categoria da Causa Raiz é aceito e a categoria fica vazia', async () => {
    const codigo = await nova();
    const r = await definirCru(codigo, corpo('3W', TRES_W));
    expect(r.status).toBe(204);
    const consulta = await consultarMetodologia(codigo);
    expect(consulta.data.metodologia).toBe('3W');
    expect(consulta.data.categoriaCausaRaiz ?? null).toBeNull();
  });

  it('I-01/R2 e: categoria com espaços nas pontas é aceita e gravada sem os espaços', async () => {
    const codigo = await nova();
    const r = await definirCru(codigo, corpo('3W', TRES_W, { categoriaCausaRaiz: ' Método/Processo ' }));
    expect(r.status).toBe(204);
    expect((await consultarMetodologia(codigo)).data.categoriaCausaRaiz).toBe('Método/Processo');
    const [tratativa] = await linhas('Tratativas', { codigo });
    expect(tratativa.categoriaCausaRaiz).toBe('Método/Processo');
  });

  it('I-01/R2 c: 5W2H com Onde e Quem curtos (L1, RH) é aceito', async () => {
    const codigo = await nova();
    const dados = { oQue: 'Corrigir inspeção', porQue: 'Evitar recorrência', onde: 'L1', quando: 'Nesta semana', quem: 'RH', como: 'Revisar procedimento' };
    const r = await definirCru(codigo, corpo('5W2H', dados, CATEGORIA));
    expect(r.status).toBe(204);
    expect((await consultarMetodologia(codigo)).data.dados).toEqual(dados);
  });

  it('I-01/R2 d: PDCA/8D com campos curtos (Ok) é aceito', async () => {
    const codigo = await nova();
    const dados = { planejar: 'Ok', executar: 'Ok', checar: 'Ok', agir: 'Ok' };
    const r = await definirCru(codigo, corpo('PDCA/8D', dados, CATEGORIA));
    expect(r.status).toBe(204);
    expect((await consultarMetodologia(codigo)).data.dados).toEqual(dados);
  });

  it('I-01 controle: PDCA/8D vazio após trim e os mínimos de 3W e 5 Porquês continuam recusados', async () => {
    const codigo = await nova();
    const vazio = await definirCru(codigo, corpo('PDCA/8D', { planejar: '   ', executar: 'Ok', checar: 'Ok', agir: 'Ok' }, CATEGORIA));
    expect(vazio.status).toBe(400);
    expect(erro(vazio).target).toBe('planejar');
    const curta = await definirCru(codigo, corpo('3W', { ...TRES_W, oQue: 'Ab' }, CATEGORIA));
    expect(curta.status).toBe(400);
    expect(erro(curta).target).toBe('oQue');
    const porque = await definirCru(codigo, corpo('5 Porquês', { ...CINCO_PORQUES, porque1: 'Ab' }, CATEGORIA));
    expect(porque.status).toBe(400);
    expect(erro(porque).target).toBe('porque1');
  });
});

describe('Correções do grupo 2 (R-22): data base conta o cancelamento da última Ação (I-02)', () => {
  it('R12 a/R15 b/DC-04: cancelamento posterior à conclusão vira a data base, o limite e o fato gravado no Aval', async () => {
    fixarInstante('2026-10-01T12:00:00Z');
    const codigo = await nova();
    expect((await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    const criarAcaoDoCenario = async (): Promise<string> => {
      const r = await criarAcao(
        enviar,
        codigo,
        { descricao: 'Ação do cenário de prazo', responsavel: 'M1001', prazo: '2026-11-30', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
        comoGestor,
      );
      expect(r.status).toBe(200);
      return r.data.codigo as string;
    };
    const acaoA = await criarAcaoDoCenario();
    const acaoB = await criarAcaoDoCenario();

    fixarInstante('2026-10-05T12:00:00Z');
    expect((await mudarStatusAcao(enviar, codigo, { acao: acaoA, status: 'Concluída' }, comoGestor)).status).toBe(204);

    fixarInstante('2026-10-13T12:00:00Z');
    const cancelada = await mudarStatusAcao(
      enviar,
      codigo,
      { acao: acaoB, status: 'Cancelada', justificativa: 'Escopo absorvido pela Ação A' },
      comoGestor,
    );
    expect(cancelada.status).toBe(204);

    const consulta = await consultarAval(consultar, codigo, comoValidador);
    expect(consulta.status).toBe(200);
    expect(consulta.data.dataBaseVerificacao).toBe('2026-10-13');
    expect(consulta.data.dataLimiteVerificacao).toBe('2026-11-12');

    fixarInstante('2026-10-14T12:00:00Z');
    const emissao = await emitirAval(
      enviar,
      codigo,
      { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' },
      comoValidador,
    );
    expect(emissao.status).toBe(204);
    const [aval] = await linhas('AvalesTecnicos', { tratativa_codigo: codigo });
    expect(String(aval.dataBaseVerificacao).slice(0, 10)).toBe('2026-10-13');
    expect(String(aval.dataLimiteVerificacao).slice(0, 10)).toBe('2026-11-12');
  });
});

describe('Correções do grupo 2 (R-22): evento CriacaoAcaoComCausa (I-03, DC-03)', () => {
  it('registra campo=causa, valorNovo=identificador e justificativa=rótulo canônico em HistoricoAcoes', async () => {
    const codigo = await nova();
    expect((await definirCru(codigo, corpo('5 Porquês', CINCO_PORQUES, CATEGORIA))).status).toBe(204);
    const derivada = await POST(
      `${BASE}/Tratativas(${codigo})/derivarAcaoDaMetodologia`,
      { causaIdentificador: 'porque2', descricao: 'Atualizar procedimento', responsavel: 'M1001', prazo: '2099-12-31', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(derivada.status).toBe(200);
    const eventos = (await linhas('HistoricoAcoes', { tratativa_codigo: codigo })).filter(
      (e) => e.evento === 'CriacaoAcaoComCausa',
    );
    expect(eventos).toHaveLength(1);
    expect(eventos[0].campo).toBe('causa');
    expect(eventos[0].valorNovo).toBe('porque2');
    expect(eventos[0].justificativa).toBe('5 Porquês — Porquê 2');
  });
});

describe('Correções do grupo 2 (R-22): precedência R18 em definirMetodologia (M-02, M-05)', () => {
  const MENSAGEM_SUBSTITUICAO = 'Tratativa já possui metodologia associada: confirme a substituição para alterar.';

  async function comCincoPorques(): Promise<string> {
    const codigo = await nova();
    expect((await definirCru(codigo, corpo('5 Porquês', CINCO_PORQUES, CATEGORIA))).status).toBe(204);
    return codigo;
  }

  it('M-02/R18 etapa 7 antes da 9: ferramenta não homologada sobre metodologia existente, sem confirmação, é 409', async () => {
    const codigo = await comCincoPorques();
    const r = await definirCru(codigo, corpo('Ishikawa', { causa: 'Não homologada' }));
    expect(r.status).toBe(409);
    expect(erro(r).message).toBe(MENSAGEM_SUBSTITUICAO);
    expect((await consultarMetodologia(codigo)).data.metodologia).toBe('5 Porquês');
  });

  it('M-05/decisão 2: ferramenta vazia sobre metodologia existente, sem confirmarSubstituicao, é recusada e preserva a análise', async () => {
    const codigo = await comCincoPorques();
    const r = await definirCru(codigo, { ferramenta: '', dados: '{}', confirmarSubstituicao: false });
    expect(r.status).toBe(409);
    expect(erro(r).message).toBe(MENSAGEM_SUBSTITUICAO);
    const consulta = await consultarMetodologia(codigo);
    expect(consulta.data.metodologia).toBe('5 Porquês');
    expect(consulta.data.dados).toEqual(CINCO_PORQUES);
  });
});
