import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { encerrarComAval } from './apoio/encerramento';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, abrirPorApp, editar, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';
import { criarAcao, mudarStatusAcao } from './apoio/acoes';
import { atribuirResponsavelPrincipal } from './apoio/responsaveis';
import { anexarEvidencia } from './apoio/evidencias';
import { comentarTratativa, comentarAcao } from './apoio/comentarios';
import { consultarHistoricoTratativa, type Consulta } from './apoio/historico';
import { linhas } from './apoio/banco';

// Etapa 1 (RED): consulta unificada, catálogo de origens e ordenação determinística.
// CA1, CA2, CA3, CA4, CA7, CA8, CA17, CA18, CA19, CA20, CA54, CA55.

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;
const BASE = '/api/tratativa/v1';

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

type Item = Record<string, unknown>;

async function criarTratativaAberta(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta', ...dados });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function criarTratativaDeApp(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await abrirPorApp(enviar, { idOrigem: `ADV-${sufixoUnico()}`, ...dados });
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

// Consulta o histórico unificado como Gestor (visão irrestrita; etapas de autorização ficam na Etapa 3).
async function historicoComoGestor(tratativa: string, filtros: Record<string, unknown> = {}) {
  return consultarHistoricoTratativa(consultar, { tratativa, ...filtros }, comoGestor);
}

describe('Etapa 1: consulta unificada, catálogo de origens e ordenação determinística', () => {
  describe('CA1 (R1, R4): consulta devolve lista integrada em ordem cronológica com HTTP 200', () => {
    it('Gestor consulta Tratativa com eventos registrados e recebe 200 com lista não vazia', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.data)).toBe(true);
      expect((r.data as Item[]).length).toBeGreaterThan(0);
    });
  });

  describe('CA2 (R1): item do histórico contém os nove campos obrigatórios', () => {
    it('evento de Criacao traz id, codigoTratativa, codigoAcao, origem, tipoEvento, detalhe, dataHora, autor, tipoAutor', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const criacao = itens.find((i) => i.tipoEvento === 'Criacao' && i.origem === 'Tratativa');
      expect(criacao).toBeDefined();
      const chaves = Object.keys(criacao as Item).sort();
      expect(chaves).toEqual(
        ['autor', 'codigoAcao', 'codigoTratativa', 'detalhe', 'dataHora', 'id', 'origem', 'tipoAutor', 'tipoEvento'].sort(),
      );
      expect(typeof (criacao as Item).id).toBe('string');
      expect((criacao as Item).codigoTratativa).toBe(tratativa);
      expect((criacao as Item).codigoAcao).toBeNull();
      expect((criacao as Item).origem).toBe('Tratativa');
      expect(typeof (criacao as Item).detalhe).toBe('object');
      expect(typeof (criacao as Item).dataHora).toBe('string');
      expect(typeof (criacao as Item).autor).toBe('string');
      expect(['Usuario', 'Aplicativo', 'Sistema']).toContain((criacao as Item).tipoAutor);
    });
  });

  describe('CA3 (R2): eventos diretos da Tratativa trazem codigoAcao null', () => {
    it('Criacao, Edicao, AtribuicaoResponsavelPrincipal e InclusaoComentario diretos vêm com codigoAcao null', async () => {
      const tratativa = await criarTratativaAberta();
      const edicao = await editar(enviar, tratativa, { titulo: `Novo título ${sufixoUnico()}` }, comoGestor);
      expect(edicao.status).toBe(204);
      const atribuicao = await atribuirResponsavelPrincipal(
        enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor,
      );
      expect(atribuicao.status).toBe(204);
      const comentario = await comentarTratativa(enviar, tratativa, { texto: 'Comentário direto' }, comoGestor);
      expect(comentario.status).toBe(200);

      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];

      const diretos = itens.filter((i) =>
        (i.origem === 'Tratativa' && ['Criacao', 'Edicao'].includes(i.tipoEvento as string)) ||
        (i.origem === 'Responsaveis' && i.tipoEvento === 'AtribuicaoResponsavelPrincipal') ||
        (i.origem === 'Comentario' && i.tipoEvento === 'InclusaoComentario' && i.codigoAcao === null),
      );
      expect(diretos.length).toBeGreaterThanOrEqual(4);
      for (const item of diretos) expect(item.codigoAcao).toBeNull();
    });
  });

  describe('CA4 (R2): eventos subordinados a uma Ação trazem codigoAcao preenchido', () => {
    it('Criacao de Ação, InclusaoEvidencia e InclusaoComentario de Ação vêm com codigoAcao = UUID da Ação', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);
      const evidencia = await anexarEvidencia(enviar, tratativa, {
        acao,
        nomeArquivo: 'laudo.pdf',
        mimeType: 'application/pdf',
        conteudo: Buffer.from('conteudo-teste').toString('base64'),
      }, comoGestor);
      expect(evidencia.status).toBe(200);
      const comentario = await comentarAcao(enviar, tratativa, { acao, texto: 'Comentário da ação' }, comoGestor);
      expect(comentario.status).toBe(200);

      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];

      const criacaoAcao = itens.find((i) => i.origem === 'Acao' && i.tipoEvento === 'Criacao');
      expect(criacaoAcao).toBeDefined();
      expect((criacaoAcao as Item).codigoAcao).toBe(acao);

      const inclusaoEvidencia = itens.find((i) => i.origem === 'Evidencia' && i.tipoEvento === 'InclusaoEvidencia');
      expect(inclusaoEvidencia).toBeDefined();
      expect((inclusaoEvidencia as Item).codigoAcao).toBe(acao);

      const comentarioAcao = itens.find(
        (i) => i.origem === 'Comentario' && i.tipoEvento === 'InclusaoComentario' && i.codigoAcao === acao,
      );
      expect(comentarioAcao).toBeDefined();
    });
  });

  describe('CA7 (R4): Tratativa inexistente recusa com 404', () => {
    it('consulta com Código inexistente devolve 404 Tratativa não encontrada.', async () => {
      const r = await consultarHistoricoTratativa(consultar, { tratativa: UUID_INEXISTENTE }, comoGestor);
      expect(r.status).toBe(404);
      const corpo = r.data as unknown as { error?: { message?: string; target?: string } };
      expect(corpo.error?.message).toBe('Tratativa não encontrada.');
    });
  });

  describe('CA8 (R4, R14): consultarTratativa de 003 preserva as 12 chaves originais', () => {
    it('consultarTratativa continua devolvendo exatamente 12 chaves, sem coleções de histórico', async () => {
      const tratativa = await criarTratativaDeApp();
      const r = await GET(`${BASE}/consultarTratativa(codigo=${tratativa})`, comoGestor);
      expect(r.status).toBe(200);
      const chaves = Object.keys(r.data as Item).filter((k) => !k.startsWith('@odata')).sort();
      expect(chaves).toEqual(
        [
          'area', 'codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'descricao', 'idOrigem',
          'origem', 'solicitante', 'status', 'titulo', 'unidade',
        ].sort(),
      );
      expect(chaves.length).toBe(12);
      for (const k of chaves) expect(k.toLowerCase()).not.toContain('historico');
    });
  });

  describe('CA17 (R5d): consulta de histórico é estritamente de leitura', () => {
    it('consultar o histórico não grava novo registro em HistoricoTratativa nem HistoricoAcoes', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);

      const antesTratativa = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      const antesAcoes = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });

      const r1 = await historicoComoGestor(tratativa);
      expect(r1.status).toBe(200);
      const r2 = await historicoComoGestor(tratativa);
      expect(r2.status).toBe(200);

      const depoisTratativa = await linhas('HistoricoTratativa', { tratativa_codigo: tratativa });
      const depoisAcoes = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });

      expect(depoisTratativa.length).toBe(antesTratativa.length);
      expect(depoisAcoes.length).toBe(antesAcoes.length);
      void acao;
    });
  });

  describe('CA18 (R6): eventos retornados em ordem cronológica crescente', () => {
    it('criação, edição e encerramento em instantes distintos saem na ordem 10:00, 10:30, 11:00', async () => {
      fixarInstante('2026-10-07T10:00:00-03:00');
      const tratativa = await criarTratativaAberta();

      fixarInstante('2026-10-07T10:30:00-03:00');
      const edicao = await editar(enviar, tratativa, { titulo: `Editado ${sufixoUnico()}` }, comoGestor);
      expect(edicao.status).toBe(204);

      fixarInstante('2026-10-07T11:00:00-03:00');
      const encerrar = await encerrarComAval(enviar, tratativa);
      expect(encerrar.status).toBe(204);

      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const horarios = (r.data as Item[]).map((i) => new Date(i.dataHora as string).getTime());
      const ordenado = [...horarios].sort((a, b) => a - b);
      expect(horarios).toEqual(ordenado);

      const tipos = (r.data as Item[]).map((i) => i.tipoEvento as string);
      expect(tipos.indexOf('Criacao')).toBeLessThan(tipos.indexOf('Edicao'));
      expect(tipos.indexOf('Edicao')).toBeLessThan(tipos.indexOf('Encerramento'));
    });
  });

  describe('CA19 (R6): desempate determinístico por origem, tipoEvento e id em eventos simultâneos', () => {
    it('dois eventos no mesmo instante desempatam por dataHora, origem ASC, tipoEvento ASC, id ASC', async () => {
      fixarInstante('2026-10-07T09:00:00-03:00');
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);

      // Criacao (origem Tratativa) e Criacao (origem Acao) ocorrem no mesmo instante fixado.
      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];

      const mesmoInstante = itens.filter((i) => new Date(i.dataHora as string).getTime() === new Date('2026-10-07T09:00:00-03:00').getTime());
      expect(mesmoInstante.length).toBeGreaterThanOrEqual(2);

      const esperado = [...mesmoInstante].sort((a, b) => {
        const origemCmp = String(a.origem).localeCompare(String(b.origem));
        if (origemCmp !== 0) return origemCmp;
        const tipoCmp = String(a.tipoEvento).localeCompare(String(b.tipoEvento));
        if (tipoCmp !== 0) return tipoCmp;
        return String(a.id).localeCompare(String(b.id));
      });
      expect(mesmoInstante.map((i) => i.id)).toEqual(esperado.map((i) => i.id));
      // Origem 'Acao' vem antes de 'Tratativa' em ordem alfabética.
      expect(mesmoInstante[0].origem).toBe('Acao');
      void acao;
    });
  });

  describe('CA20 (R6): paginação direta sem envelope de metadados', () => {
    it('75 eventos: página 1 traz 50, página 2 traz 25, sem totalRegistros nem temMais', async () => {
      const tratativa = await criarTratativaAberta();
      // 1 evento de Criacao da Tratativa; completa até 75 com 74 edições de título.
      for (let i = 0; i < 74; i++) {
        const r = await editar(enviar, tratativa, { titulo: `Título ${sufixoUnico()}-${i}` }, comoGestor);
        expect(r.status).toBe(204);
      }

      const pagina1 = await consultarHistoricoTratativa(
        consultar, { tratativa, tamanhoPagina: 50, pagina: 1 }, comoGestor,
      );
      expect(pagina1.status).toBe(200);
      expect((pagina1.data as Item[]).length).toBe(50);
      expect(pagina1.data).not.toHaveProperty('totalRegistros');
      expect(pagina1.data).not.toHaveProperty('temMais');

      const pagina2 = await consultarHistoricoTratativa(
        consultar, { tratativa, tamanhoPagina: 50, pagina: 2 }, comoGestor,
      );
      expect(pagina2.status).toBe(200);
      expect((pagina2.data as Item[]).length).toBe(25);

      const idsP1 = (pagina1.data as Item[]).map((i) => i.id);
      const idsP2 = (pagina2.data as Item[]).map((i) => i.id);
      expect(new Set([...idsP1, ...idsP2]).size).toBe(75);
    });
  });

  describe('CA54 (R13): comportamento idêntico para qualquer Origem (inclusive avulsa)', () => {
    it('Registro de Acidente, Auditoria de Qualidade e avulsa produzem histórico com mesma estrutura', async () => {
      const acidente = await criarTratativaDeApp({ origem: 'Registro de Acidente' });
      const auditoria = await criarTratativaDeApp({ origem: 'Auditoria de Qualidade' });
      const avulsa = await criarTratativaAberta();

      for (const tratativa of [acidente, auditoria, avulsa]) {
        const r = await historicoComoGestor(tratativa);
        expect(r.status).toBe(200);
        const itens = r.data as Item[];
        expect(itens.length).toBeGreaterThan(0);
        const criacao = itens.find((i) => i.tipoEvento === 'Criacao' && i.origem === 'Tratativa');
        expect(criacao).toBeDefined();
        expect(Object.keys(criacao as Item).sort()).toEqual(
          ['autor', 'codigoAcao', 'codigoTratativa', 'detalhe', 'dataHora', 'id', 'origem', 'tipoAutor', 'tipoEvento'].sort(),
        );
      }
    });
  });

  describe('CA55 (R14): histórico unificado reúne eventos de todas as origens presentes', () => {
    it('Tratativa com eventos de Tratativa, Ação, Evidência, Comentário e Responsáveis unifica a linha do tempo', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa);

      const atribuicao = await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor);
      expect(atribuicao.status).toBe(204);

      const evidencia = await anexarEvidencia(enviar, tratativa, {
        acao,
        nomeArquivo: 'evidencia.pdf',
        mimeType: 'application/pdf',
        conteudo: Buffer.from('conteudo').toString('base64'),
      }, comoGestor);
      expect(evidencia.status).toBe(200);

      const comentario = await comentarTratativa(enviar, tratativa, { texto: 'Comentário' }, comoGestor);
      expect(comentario.status).toBe(200);

      const statusAcao = await mudarStatusAcao(
        enviar, tratativa, { acao, status: 'Em andamento' }, comoGestor,
      );
      expect(statusAcao.status).toBe(204);

      const r = await historicoComoGestor(tratativa);
      expect(r.status).toBe(200);
      const origens = new Set((r.data as Item[]).map((i) => i.origem));
      expect(origens.has('Tratativa')).toBe(true);
      expect(origens.has('Acao')).toBe(true);
      expect(origens.has('Evidencia')).toBe(true);
      expect(origens.has('Comentario')).toBe(true);
      expect(origens.has('Responsaveis')).toBe(true);
    });
  });
});
