import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { criarAvulsa, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM9999, semAuth } from './apoio/usuarios';
import { criarAcao, mudarStatusAcao } from './apoio/acoes';
import { consultarHistoricoTratativa, type Consulta } from './apoio/historico';

// Etapa 4 (RED): precedência consolidada D10, imutabilidade absoluta e integridade.
// CA5, CA6, CA16, CA43, CA44, CA45, CA46, CA47, CA48, CA49, CA50, CA51, CA52, CA53.

const { GET, POST, PATCH, DELETE } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;
const BASE = '/api/tratativa/v1';
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

jest.setTimeout(60000);

let espiao: Espiao;
beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});
afterEach(() => espiao.naoFalhar());

type Item = Record<string, unknown>;
type Erro = { error?: { message?: string; target?: string } };

async function criarTratativaAberta(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta', ...dados });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function criarAcaoComResponsavel(tratativa: string, responsavel = 'M1001'): Promise<string> {
  const r = await criarAcao(enviar, tratativa, {
    descricao: `Descrição da Ação ${sufixoUnico()}`,
    prioridade: 'Alta',
    prazo: '2027-01-01',
    responsavel,
  }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function historicoComoGestor(tratativa: string, filtros: Record<string, unknown> = {}) {
  return consultarHistoricoTratativa(consultar, { tratativa, ...filtros }, comoGestor);
}

describe('Etapa 4: precedência consolidada D10, imutabilidade absoluta e integridade', () => {
  describe('CA5 (R3): imutabilidade absoluta — PUT/PATCH/DELETE em registros de histórico recusados', () => {
    it('PATCH em HistoricoTratativa(id) é recusado com 404/405 e não altera nenhum registro', async () => {
      const tratativa = await criarTratativaAberta();
      const antes = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      expect(antes.length).toBeGreaterThan(0);
      const idExistente = antes[0].ID as string;

      const r = await PATCH(`${BASE}/HistoricoTratativa(${idExistente})`, { campo: 'adulterado' }, comoGestor);
      expect([404, 405]).toContain(r.status);

      const depois = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      expect(depois).toEqual(antes);
    });

    it('DELETE em HistoricoTratativa(id) é recusado com 404/405 e não remove o registro', async () => {
      const tratativa = await criarTratativaAberta();
      const antes = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      const idExistente = antes[0].ID as string;

      const r = await DELETE(`${BASE}/HistoricoTratativa(${idExistente})`, comoGestor);
      expect([404, 405]).toContain(r.status);

      const depois = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      expect(depois.length).toBe(antes.length);
    });

    it('PATCH em HistoricoAcoes(id) é recusado com 404/405 e não altera nenhum registro, mesmo pelo Gestor', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);
      const antes = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });
      expect(antes.length).toBeGreaterThan(0);
      const idExistente = antes[0].ID as string;

      const r = await PATCH(`${BASE}/HistoricoAcoes(${idExistente})`, { campo: 'adulterado' }, comoGestor);
      expect([404, 405]).toContain(r.status);

      const depois = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });
      expect(depois).toEqual(antes);
      void acao;
    });

    it('DELETE em HistoricoAcoes(id) é recusado com 404/405, inclusive para o Gestor de Tratativa', async () => {
      const tratativa = await criarTratativaAberta();
      await criarAcaoComResponsavel(tratativa);
      const antes = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });
      const idExistente = antes[0].ID as string;

      const r = await DELETE(`${BASE}/HistoricoAcoes(${idExistente})`, comoGestor);
      expect([404, 405]).toContain(r.status);

      const depois = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });
      expect(depois.length).toBe(antes.length);
    });

    it('POST direto no entity set HistoricoTratativa é recusado com 404/405', async () => {
      const r = await POST(`${BASE}/HistoricoTratativa`, { evento: 'Forjado' }, comoGestor);
      expect([404, 405]).toContain(r.status);
    });
  });

  describe('CA6 (R3): requisição de negócio recusada nunca grava registro de histórico', () => {
    it('transição de Status recusada (409) não grava novo evento MudancaStatus', async () => {
      const tratativa = await criarTratativaAberta();
      const encerrar = await mudarStatus(enviar, tratativa, { status: 'Encerrada' }, comoGestor);
      expect(encerrar.status).toBe(204);

      const antes = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      // Encerrada → Encerrada não é transição permitida.
      const recusada = await mudarStatus(enviar, tratativa, { status: 'Encerrada' }, comoGestor);
      expect(recusada.status).toBe(409);

      const depois = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      expect(depois.length).toBe(antes.length);
    });

    it('acesso negado (403) ao mudarStatusAcao por usuário sem vínculo não grava histórico da Ação', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');

      const antes = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });
      const r = await mudarStatusAcao(enviar, tratativa, { acao, status: 'Em andamento' }, comoM9999);
      expect(r.status).toBe(403);

      const depois = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });
      expect(depois.length).toBe(antes.length);
    });

    it('falha de persistência simulada na gravação do histórico não deixa a mudança de status efetivada', async () => {
      const tratativa = await criarTratativaAberta();
      espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoTratativa');

      const antes = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      const r = await mudarStatus(enviar, tratativa, { status: 'Em andamento' }, comoGestor);
      espiao.naoFalhar();
      expect(r.status).toBeGreaterThanOrEqual(500);

      const depois = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      expect(depois.length).toBe(antes.length);
      const tratativaLinha = (await linhas('Tratativas', { codigo: tratativa }))[0];
      expect(tratativaLinha.status).toBe('Aberta');
    });
  });

  describe('CA16 (R5, R12): AplicativoOrigem recusado com 403 na etapa 3, antes de qualquer validação de domínio', () => {
    it('Aplicativo de origem consultando o histórico de Tratativa existente recebe 403', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await consultarHistoricoTratativa(consultar, { tratativa }, comoApp);
      expect(r.status).toBe(403);
    });

    it('Aplicativo de origem consultando com tratativa inexistente ainda recebe 403 (papel precede existência)', async () => {
      const r = await consultarHistoricoTratativa(consultar, { tratativa: UUID_INEXISTENTE }, comoApp);
      expect(r.status).toBe(403);
    });
  });

  describe('CA43 (R10): reabertura de Tratativa encerrada preserva o Encerramento e inclui a Reabertura', () => {
    it('histórico mantém Encerramento original e acrescenta Reabertura em sequência append-only', async () => {
      const tratativa = await criarTratativaAberta();
      const encerrar = await mudarStatus(enviar, tratativa, { status: 'Encerrada' }, comoGestor);
      expect(encerrar.status).toBe(204);
      const reabrir = await mudarStatus(
        enviar, tratativa, { status: 'Em andamento', justificativa: 'Reabertura por novo fato' }, comoGestor,
      );
      expect(reabrir.status).toBe(204);

      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const encerramentos = itens.filter((i) => i.tipoEvento === 'Encerramento' && i.origem === 'Tratativa');
      const reaberturas = itens.filter((i) => i.tipoEvento === 'Reabertura' && i.origem === 'Tratativa');
      expect(encerramentos.length).toBe(1);
      expect(reaberturas.length).toBe(1);
      const idxEncerramento = itens.findIndex((i) => i === encerramentos[0]);
      const idxReabertura = itens.findIndex((i) => i === reaberturas[0]);
      expect(idxEncerramento).toBeLessThan(idxReabertura);
    });
  });

  describe('CA44 (R10): reabertura de Ação concluída preserva a Conclusao e inclui a Reabertura', () => {
    it('histórico da Ação mantém Conclusao original e acrescenta Reabertura em sequência append-only', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);
      const andamento = await mudarStatusAcao(enviar, tratativa, { acao, status: 'Em andamento' }, comoGestor);
      expect(andamento.status).toBe(204);
      const concluir = await mudarStatusAcao(enviar, tratativa, { acao, status: 'Concluída' }, comoGestor);
      expect(concluir.status).toBe(204);
      const reabrir = await mudarStatusAcao(
        enviar, tratativa, { acao, status: 'Em andamento', justificativa: 'Reabertura por evidência insuficiente' }, comoGestor,
      );
      expect(reabrir.status).toBe(204);

      const r = await historicoComoGestor(tratativa, { codigoAcao: acao });
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const conclusoes = itens.filter((i) => i.tipoEvento === 'Conclusao');
      const reaberturas = itens.filter((i) => i.tipoEvento === 'Reabertura');
      expect(conclusoes.length).toBe(1);
      expect(reaberturas.length).toBe(1);
      const idxConclusao = itens.findIndex((i) => i === conclusoes[0]);
      const idxReabertura = itens.findIndex((i) => i === reaberturas[0]);
      expect(idxConclusao).toBeLessThan(idxReabertura);
    });
  });

  describe('CA45 (R10): reabertura de Tratativa não reabre Ações já concluídas (sem cascata)', () => {
    it('Ação concluída permanece Concluída após a reabertura da Tratativa, e só a Tratativa recebe o evento de reabertura', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);
      const andamento = await mudarStatusAcao(enviar, tratativa, { acao, status: 'Em andamento' }, comoGestor);
      expect(andamento.status).toBe(204);
      const concluir = await mudarStatusAcao(enviar, tratativa, { acao, status: 'Concluída' }, comoGestor);
      expect(concluir.status).toBe(204);
      const encerrar = await mudarStatus(enviar, tratativa, { status: 'Encerrada' }, comoGestor);
      expect(encerrar.status).toBe(204);
      const reabrir = await mudarStatus(
        enviar, tratativa, { status: 'Em andamento', justificativa: 'Reabertura da Tratativa' }, comoGestor,
      );
      expect(reabrir.status).toBe(204);

      const acaoLinha = (await linhas('Acoes', { codigo: acao }))[0];
      expect(acaoLinha.status).toBe('Concluída');

      const r = await historicoComoGestor(tratativa, { codigoAcao: acao });
      expect(r.status).toBe(200);
      const itensAcao = r.data as Item[];
      expect(itensAcao.some((i) => i.tipoEvento === 'Reabertura')).toBe(false);

      const geral = await historicoComoGestor(tratativa);
      expect(geral.status).toBe(200);
      const reaberturaTratativa = (geral.data as Item[]).filter(
        (i) => i.tipoEvento === 'Reabertura' && i.origem === 'Tratativa',
      );
      expect(reaberturaTratativa.length).toBe(1);
    });
  });

  describe('CA46 (R11): dataHora de Criacao e Encerramento suporta cálculo analítico de tempo de resolução', () => {
    it('eventos Criacao e Encerramento trazem dataHora distintas e cronologicamente ordenadas', async () => {
      const tratativa = await criarTratativaAberta();
      const encerrar = await mudarStatus(enviar, tratativa, { status: 'Encerrada' }, comoGestor);
      expect(encerrar.status).toBe(204);

      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const criacao = itens.find((i) => i.tipoEvento === 'Criacao' && i.origem === 'Tratativa');
      const encerramento = itens.find((i) => i.tipoEvento === 'Encerramento' && i.origem === 'Tratativa');
      expect(criacao).toBeDefined();
      expect(encerramento).toBeDefined();
      const tCriacao = new Date((criacao as Item).dataHora as string).getTime();
      const tEncerramento = new Date((encerramento as Item).dataHora as string).getTime();
      expect(Number.isNaN(tCriacao)).toBe(false);
      expect(Number.isNaN(tEncerramento)).toBe(false);
      expect(tEncerramento).toBeGreaterThanOrEqual(tCriacao);
    });
  });

  describe('CA47 (R12): não autenticado recebe 401 na etapa 1, antes de qualquer validação de domínio', () => {
    it('consulta sem autenticação a Tratativa inexistente ainda recebe 401 (não 404)', async () => {
      const r = await consultarHistoricoTratativa(consultar, { tratativa: UUID_INEXISTENTE }, semAuth);
      expect(r.status).toBe(401);
    });
  });

  describe('CA48 (R12): parâmetros com tipo incompatível no runtime recusam com 400 antes do handler', () => {
    it('tamanhoPagina com valor não numérico no payload é recusado com 400 pelo runtime', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await GET(
        `${BASE}/consultarHistoricoTratativa(tratativa=${tratativa},tamanhoPagina='abc')`,
        comoGestor,
      );
      expect(r.status).toBe(400);
    });
  });

  describe('CA49 (R12): AplicativoOrigem com parâmetro tratativa malformado ainda recebe 403 (papel precede forma)', () => {
    it('Aplicativo de origem com tratativa="invalido!" recebe 403, não 400', async () => {
      const r = await GET(`${BASE}/consultarHistoricoTratativa(tratativa='invalido!')`, comoApp);
      expect(r.status).toBe(403);
    });
  });

  describe('CA50 (R12): parâmetro tratativa ausente recusa com 400 Código inválido. na etapa 4', () => {
    it('consulta sem o parâmetro tratativa é recusada com 400 e target tratativa', async () => {
      const r = await GET(`${BASE}/consultarHistoricoTratativa()`, comoGestor);
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Código inválido.');
      expect(corpo.error?.target).toBe('tratativa');
    });
  });

  describe('CA51 (R12): código de Tratativa malformado recusa com 400 Código inválido. na etapa 4', () => {
    it('tratativa com texto não-UUID é recusada com 400 e target tratativa', async () => {
      const r = await GET(`${BASE}/consultarHistoricoTratativa(tratativa='xyz')`, comoGestor);
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Código inválido.');
      expect(corpo.error?.target).toBe('tratativa');
    });
  });

  describe('CA52 (R12): existência da Tratativa precede validação semântica de filtros (etapa 5 antes da 6)', () => {
    it('Tratativa inexistente + tipoEvento inválido recusa com 404 Tratativa não encontrada., não 400', async () => {
      const r = await consultarHistoricoTratativa(
        consultar, { tratativa: UUID_INEXISTENTE, tipoEvento: 'TipoTotalmenteInvalido' }, comoGestor,
      );
      expect(r.status).toBe(404);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Tratativa não encontrada.');
      expect(corpo.error?.target).toBe('tratativa');
    });
  });

  describe('CA53 (R12): validação de filtros precede o retorno por vínculo/menor privilégio (etapa 6 antes da 7)', () => {
    it('usuário sem vínculo (receberia []) + tipoEvento inválido recusa com 400, não 200', async () => {
      const tratativa = await criarTratativaAberta();
      await criarAcaoComResponsavel(tratativa, 'M1001');

      const semVinculo = await consultarHistoricoTratativa(consultar, { tratativa }, comoM9999);
      expect(semVinculo.status).toBe(200);
      expect(semVinculo.data).toEqual([]);

      const r = await consultarHistoricoTratativa(
        consultar, { tratativa, tipoEvento: 'TipoTotalmenteInvalido' }, comoM9999,
      );
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Tipo de evento inválido.');
      expect(corpo.error?.target).toBe('tipoEvento');
    });
  });
});
