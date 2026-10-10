import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { criarAvulsa, editar, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';
import { criarAcao } from './apoio/acoes';
import { consultarHistoricoTratativa, type Consulta } from './apoio/historico';

// Etapa 2 (RED): filtros avançados e validações de paginação.
// CA21, CA22, CA22a, CA23, CA24, CA25, CA26, CA27, CA27a, CA28, CA29, CA30, CA31, CA32, CA33, CA34.

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;

jest.setTimeout(60000);

beforeAll(registrarCredenciais);

const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

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

async function historicoComoGestor(filtros: Record<string, unknown>) {
  return consultarHistoricoTratativa(consultar, filtros, comoGestor);
}

describe('Etapa 2: filtros avançados e validações de paginação', () => {
  describe('CA21 (R6): tamanhoPagina = 201 recusa com 400', () => {
    it('tamanhoPagina acima do limite é recusado com a mensagem nominal e target tamanhoPagina', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, tamanhoPagina: 201 });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
      expect(corpo.error?.target).toBe('tamanhoPagina');
    });
  });

  describe('CA22 (R6): tamanhoPagina = 0 ou negativo recusa com 400', () => {
    it('tamanhoPagina = 0 é recusado', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, tamanhoPagina: 0 });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
      expect(corpo.error?.target).toBe('tamanhoPagina');
    });

    it('tamanhoPagina negativo é recusado', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, tamanhoPagina: -5 });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
      expect(corpo.error?.target).toBe('tamanhoPagina');
    });
  });

  describe('CA22a (R6): pagina = 0 ou negativo recusa com 400', () => {
    it('pagina = 0 é recusada com a mensagem nominal e target pagina', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, pagina: 0 });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('O campo Página deve ser 1 ou maior.');
      expect(corpo.error?.target).toBe('pagina');
    });

    it('pagina negativa é recusada', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, pagina: -1 });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('O campo Página deve ser 1 ou maior.');
      expect(corpo.error?.target).toBe('pagina');
    });
  });

  describe('CA23 (R7): filtro tipoEvento = MudancaStatus retorna só esse tipo', () => {
    it('somente eventos MudancaStatus voltam na lista', async () => {
      const tratativa = await criarTratativaAberta();
      const edicao = await editar(enviar, tratativa, { titulo: `Editado ${sufixoUnico()}` }, comoGestor);
      expect(edicao.status).toBe(204);
      const mudanca = await mudarStatus(enviar, tratativa, { status: 'Em andamento' }, comoGestor);
      expect(mudanca.status).toBe(204);

      const r = await historicoComoGestor({ tratativa, tipoEvento: 'MudancaStatus' });
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.length).toBeGreaterThan(0);
      for (const item of itens) expect(item.tipoEvento).toBe('MudancaStatus');
    });

    it('eventos Edicao não aparecem no filtro MudancaStatus', async () => {
      const tratativa = await criarTratativaAberta();
      const edicao = await editar(enviar, tratativa, { titulo: `Editado ${sufixoUnico()}` }, comoGestor);
      expect(edicao.status).toBe(204);
      const mudanca = await mudarStatus(enviar, tratativa, { status: 'Em andamento' }, comoGestor);
      expect(mudanca.status).toBe(204);

      const r = await historicoComoGestor({ tratativa, tipoEvento: 'MudancaStatus' });
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      for (const item of itens) expect(item.tipoEvento).not.toBe('Edicao');
    });
  });

  describe('CA24 (R7): filtro tipoEvento = Encerramento retorna só encerramentos', () => {
    it('somente eventos de Encerramento da Tratativa voltam na lista', async () => {
      const tratativa = await criarTratativaAberta();
      const encerrar = await editar(enviar, tratativa, { titulo: `Editado ${sufixoUnico()}` }, comoGestor);
      expect(encerrar.status).toBe(204);

      const r = await historicoComoGestor({ tratativa, tipoEvento: 'Encerramento' });
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      for (const item of itens) expect(item.tipoEvento).toBe('Encerramento');
    });
  });

  describe('CA25 (R7): filtro tipoEvento = Reabertura retorna reaberturas de Tratativa ou Ação', () => {
    it('somente eventos Reabertura voltam na lista', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);
      void acao;

      const r = await historicoComoGestor({ tratativa, tipoEvento: 'Reabertura' });
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      for (const item of itens) expect(item.tipoEvento).toBe('Reabertura');
    });
  });

  describe('CA26 (R7): tipoEvento fora do catálogo recusa com 400', () => {
    it('tipoEvento = EventoInexistente é recusado com a mensagem nominal e target tipoEvento', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, tipoEvento: 'EventoInexistente' });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Tipo de evento inválido.');
      expect(corpo.error?.target).toBe('tipoEvento');
    });
  });

  describe('CA27 (R7): filtro codigoAcao válido retorna só os eventos daquela Ação', () => {
    it('somente eventos subordinados à Ação informada voltam na lista', async () => {
      const tratativa = await criarTratativaAberta();
      const acao1 = await criarAcaoComResponsavel(tratativa);
      const acao2 = await criarAcaoComResponsavel(tratativa);
      void acao2;

      const r = await historicoComoGestor({ tratativa, codigoAcao: acao1 });
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.length).toBeGreaterThan(0);
      for (const item of itens) expect(item.codigoAcao).toBe(acao1);
    });
  });

  describe('CA27a (R7): Responsável de uma Ação filtrando por codigoAcao de outra Ação recebe [] com 200', () => {
    it('Responsável da Ação 1 filtrando pela Ação 2 da mesma Tratativa recebe lista vazia', async () => {
      const tratativa = await criarTratativaAberta();
      await criarAcaoComResponsavel(tratativa, 'M1001');
      const acao2 = await criarAcaoComResponsavel(tratativa, 'M2002');

      const comoM1001 = { auth: { username: 'M1001', password: '' }, validateStatus: () => true };
      const r = await consultarHistoricoTratativa(consultar, { tratativa, codigoAcao: acao2 }, comoM1001);
      expect(r.status).toBe(200);
      expect(r.data).toEqual([]);
    });
  });

  describe('CA28 (R7): codigoAcao inexistente recusa com 404', () => {
    it('codigoAcao com UUID bem formado mas inexistente é recusado', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, codigoAcao: UUID_INEXISTENTE });
      expect(r.status).toBe(404);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Ação não encontrada.');
      expect(corpo.error?.target).toBe('codigoAcao');
    });
  });

  describe('CA29 (R7): codigoAcao de Ação de outra Tratativa recusa com 404', () => {
    it('Ação pertencente a outra Tratativa é recusada como não encontrada', async () => {
      const tratativaA = await criarTratativaAberta();
      const tratativaB = await criarTratativaAberta();
      const acaoDeB = await criarAcaoComResponsavel(tratativaB);

      const r = await historicoComoGestor({ tratativa: tratativaA, codigoAcao: acaoDeB });
      expect(r.status).toBe(404);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Ação não encontrada.');
      expect(corpo.error?.target).toBe('codigoAcao');
    });
  });

  describe('CA30 (R7): codigoAcao mal formado recusa com 400 na etapa 4 do domínio', () => {
    it('codigoAcao não-UUID é recusado antes de consultar o banco', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, codigoAcao: 'xyz' });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Código de ação inválido.');
      expect(corpo.error?.target).toBe('codigoAcao');
    });
  });

  describe('CA31 (R7): periodoInicio e periodoFim filtram o intervalo inclusivo', () => {
    it('somente eventos com dataHora dentro do intervalo informado voltam na lista', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({
        tratativa,
        periodoInicio: '2026-10-01T08:00:00Z',
        periodoFim: '2026-10-02T18:00:00Z',
      });
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      for (const item of itens) {
        const quando = new Date(item.dataHora as string).getTime();
        expect(quando).toBeGreaterThanOrEqual(new Date('2026-10-01T08:00:00Z').getTime());
        expect(quando).toBeLessThanOrEqual(new Date('2026-10-02T18:00:00Z').getTime());
      }
    });
  });

  describe('CA32 (R7): periodoInicio inválido recusa com 400', () => {
    it('periodoInicio = data-invalida é recusado com a mensagem nominal e target periodoInicio', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, periodoInicio: 'data-invalida' });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Data inválida.');
      expect(corpo.error?.target).toBe('periodoInicio');
    });
  });

  describe('CA33 (R7): periodoFim inválido recusa com 400', () => {
    it('periodoFim = data-invalida é recusado com a mensagem nominal e target periodoFim', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({ tratativa, periodoFim: 'data-invalida' });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Data inválida.');
      expect(corpo.error?.target).toBe('periodoFim');
    });
  });

  describe('CA34 (R7): periodoInicio posterior a periodoFim recusa com 400', () => {
    it('início depois do fim é recusado com a mensagem nominal e target periodoInicio', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor({
        tratativa,
        periodoInicio: '2026-10-05T10:00:00Z',
        periodoFim: '2026-10-01T10:00:00Z',
      });
      expect(r.status).toBe(400);
      const corpo = r.data as unknown as Erro;
      expect(corpo.error?.message).toBe('Período inválido: a data inicial não pode ser posterior à data final.');
      expect(corpo.error?.target).toBe('periodoInicio');
    });
  });
});
