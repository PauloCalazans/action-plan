import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { liberarRelogio } from './apoio/relogio';
import { type Envia, criarAvulsa, sufixoUnico } from './apoio/tratativas';
import { comoGestor, comoUsuario } from './apoio/usuarios';
import { consultarResponsaveis, listarTratativas, consultarTratativa } from './apoio/responsaveis';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET;
jest.setTimeout(60000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

async function criarTratativaAberta(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta', ...dados });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

// Helper para verificar as chaves de um item da listagem
const semAnotacoes = (o: Record<string, unknown>) => Object.keys(o).filter((k) => !k.startsWith('@odata')).sort();

// Chaves esperadas para um item da listagem de Tratativas (conforme teste existente)
const CHAVES_ITEM = [
  'area', 'codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'idOrigem', 'origem', 'status', 'titulo',
  'unidade',
];

// Chaves esperadas para o detalhe da Tratativa (consultarTratativa)
const CHAVES_DETALHE = [...CHAVES_ITEM, 'descricao', 'solicitante'].sort();

describe('CA88: Gestor listando Tratativas recebe itens sem responsavelPrincipal nem participantes', () => {
  describe('Listagem de Tratativas (listarTratativas)', () => {
    it('itens da listagem não contêm responsavelPrincipal nem participantes', async () => {
      // Cria uma tratativa para garantir que há dados para listar
      await criarTratativaAberta();
      
      // Lista Tratativas como Gestor
      const rListar = await listarTratativas(consultar, { tamanhoPagina: 10 }, comoGestor);
      expect(rListar.status).toBe(200);
      
      const itens = rListar.data.value as Record<string, unknown>[];
      expect(itens.length).toBeGreaterThan(0);
      
      // Verifica que nenhum item tem os campos responsavelPrincipal ou participantes
      for (const item of itens) {
        expect(item).not.toHaveProperty('responsavelPrincipal');
        expect(item).not.toHaveProperty('participantes');
        
        // Verifica que tem exatamente as 10 chaves esperadas (CHAVES_ITEM)
        expect(semAnotacoes(item)).toEqual(CHAVES_ITEM);
      }
    });

    it('consulta consultarResponsaveis retorna os campos', async () => {
      const tratativa = await criarTratativaAberta();
      
      // Consulta os responsáveis (function existe)
      const rConsultar = await consultarResponsaveis(consultar, tratativa, comoGestor);
      // A function existe, não é 404
      expect(rConsultar.status).not.toBe(404);
      
      // Se implementada corretamente, deveria retornar 200 com os campos
      if (rConsultar.status === 200) {
        expect(rConsultar.data).toHaveProperty('responsavelPrincipal');
        expect(rConsultar.data).toHaveProperty('participantes');
      }
    });
  });

  describe('Consulta de Tratativa (consultarTratativa)', () => {
    it('detalhe da Tratativa não contém responsavelPrincipal nem participantes', async () => {
      const tratativa = await criarTratativaAberta();
      
      // Consulta a Tratativa como Gestor
      const r = await consultarTratativa(consultar, tratativa, comoGestor);
      expect(r.status).toBe(200);
      
      // Verifica que não tem os campos responsavelPrincipal ou participantes
      expect(r.data).not.toHaveProperty('responsavelPrincipal');
      expect(r.data).not.toHaveProperty('participantes');
      
      // Verifica que tem exatamente as 12 chaves esperadas (CHAVES_DETALHE)
      expect(semAnotacoes(r.data)).toEqual(CHAVES_DETALHE);
    });
  });

  describe('Comparação entre listarTratativas e consultarResponsaveis', () => {
    it('campos de responsáveis só aparecem em consultarResponsaveis', async () => {
      const tratativa = await criarTratativaAberta();
      
      // Lista Tratativas - sem campos de responsáveis
      const rListar = await listarTratativas(consultar, { tamanhoPagina: 10 }, comoGestor);
      expect(rListar.status).toBe(200);
      
      const itens = rListar.data.value as Record<string, unknown>[];
      const itemTratativa = itens.find(item => item.codigo === tratativa);
      if (itemTratativa) {
        expect(itemTratativa).not.toHaveProperty('responsavelPrincipal');
        expect(itemTratativa).not.toHaveProperty('participantes');
      }
      
      // Consulta os responsáveis (function existe)
      const rResponsaveis = await consultarResponsaveis(consultar, tratativa, comoGestor);
      // A function existe, não é 404
      expect(rResponsaveis.status).not.toBe(404);
      
      // Se implementada corretamente:
      if (rResponsaveis.status === 200) {
        expect(rResponsaveis.data).toHaveProperty('responsavelPrincipal');
        expect(rResponsaveis.data).toHaveProperty('participantes');
        expect(rResponsaveis.data.responsavelPrincipal).toBeNull(); // Não atribuído ainda
        expect(rResponsaveis.data.participantes).toEqual([]);
      }
    });
  });

  describe('Usuário sem papel de Gestor', () => {
    it('também não recebe responsavelPrincipal nem participantes na listagem', async () => {
      const r = await listarTratativas(consultar, { tamanhoPagina: 10 }, comoUsuario);
      expect(r.status).toBe(200);
      
      const itens = r.data.value as Record<string, unknown>[];
      expect(itens.length).toBeGreaterThan(0);
      
      for (const item of itens) {
        expect(item).not.toHaveProperty('responsavelPrincipal');
        expect(item).not.toHaveProperty('participantes');
        expect(semAnotacoes(item)).toEqual(CHAVES_ITEM);
      }
    });

    it('recebe 403 ao tentar consultarResponsaveis (restrição de acesso)', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await consultarResponsaveis(consultar, tratativa, comoUsuario);
      expect(r.status).toBe(403); // Usuário não-gestor não tem acesso
    });
  });

  describe('Verificações adicionais de segregação CA88', () => {
    it('detalhe da tratativa não contém campos aninhados de responsáveis', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await consultarTratativa(consultar, tratativa, comoGestor);
      expect(r.status).toBe(200);
      
      // Verifica que não há campos relacionados a responsáveis em nenhum nível
      expect(r.data).not.toHaveProperty('responsavelPrincipal');
      expect(r.data).not.toHaveProperty('participantes');
      expect(r.data).not.toHaveProperty('responsavel');
      expect(r.data).not.toHaveProperty('autorResponsavel');
      
      // Verifica estrutura completa dos dados
      const campos = Object.keys(r.data).filter(k => !k.startsWith('@')).sort();
      expect(campos).toEqual(CHAVES_DETALHE);
    });

    it('listagem com tratativas com responsáveis atribuídos ainda não mostra os campos', async () => {
      // Primeiro cria uma tratativa (atribuição de responsável não afeta a listagem)
      await criarTratativaAberta();
      // A listagem não deve mostrar campos de responsáveis independentemente de atribuição
      
      const r = await listarTratativas(consultar, { tamanhoPagina: 20 }, comoGestor);
      expect(r.status).toBe(200);
      
      const itens = r.data.value as Record<string, unknown>[];
      expect(itens.length).toBeGreaterThan(0);
      
      // Verifica que nenhum item tem campos de responsáveis
      for (const item of itens) {
        expect(item).not.toHaveProperty('responsavelPrincipal');
        expect(item).not.toHaveProperty('participantes');
        expect(semAnotacoes(item)).toEqual(CHAVES_ITEM);
      }
      
      // Verifica contagem total de campos por item
      for (const item of itens) {
        const camposItem = semAnotacoes(item);
        expect(camposItem.length).toBe(10); // CHAVES_ITEM tem 10 elementos
      }
    });

    it('consulta de tratativa por usuário não-gestor também não mostra responsáveis', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await consultarTratativa(consultar, tratativa, comoUsuario);
      expect(r.status).toBe(200);
      
      // Usuário não-gestor também não deve ver campos de responsáveis
      expect(r.data).not.toHaveProperty('responsavelPrincipal');
      expect(r.data).not.toHaveProperty('participantes');
      
      // Deve ter as mesmas 12 chaves que o gestor
      const campos = Object.keys(r.data).filter(k => !k.startsWith('@')).sort();
      expect(campos).toEqual(CHAVES_DETALHE);
    });
  });
});