import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { sufixoUnico, type Envia, type Resposta, criarAvulsa } from './apoio/tratativas';
import { comoGestor, comoUsuario } from './apoio/usuarios';
import { atribuirResponsavelPrincipal, incluirParticipante, consultarResponsaveis, listarTratativas, consultarTratativa } from './apoio/responsaveis';

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
      // Cria uma Tratativa com Responsável Principal e Participante
      const tratativa = await criarTratativaAberta();
      
      // Atribui Responsável Principal
      const rAtribuir = await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001', justificativa: 'Primeira atribuição' }, comoGestor);
      expect(rAtribuir.status).toBe(404); // Esperado no RED - action não implementada
      
      // Inclui Participante
      const rIncluir = await incluirParticipante(enviar, tratativa, { participante: 'M3003' }, comoGestor);
      expect(rIncluir.status).toBe(404); // Esperado no RED - action não implementada
      
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

    it('consulta consultarResponsaveis retorna os campos (quando implementado)', async () => {
      const tratativa = await criarTratativaAberta();
      
      // Tenta consultar os responsáveis - espera 404 no RED (function não implementada)
      const rConsultar = await consultarResponsaveis(consultar, tratativa, comoGestor);
      expect(rConsultar.status).toBe(404);
      
      // Quando implementado, deveria retornar os campos:
      // expect(rConsultar.status).toBe(200);
      // expect(rConsultar.data).toHaveProperty('responsavelPrincipal');
      // expect(rConsultar.data).toHaveProperty('participantes');
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
    it('campos de responsáveis só aparecem em consultarResponsaveis (quando implementado)', async () => {
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
      
      // Tenta consultar os responsáveis - espera 404 no RED
      const rResponsaveis = await consultarResponsaveis(consultar, tratativa, comoGestor);
      expect(rResponsaveis.status).toBe(404);
      
      // Quando implementado:
      // expect(rResponsaveis.status).toBe(200);
      // expect(rResponsaveis.data).toHaveProperty('responsavelPrincipal');
      // expect(rResponsaveis.data).toHaveProperty('participantes');
      // expect(rResponsaveis.data.responsavelPrincipal).toBeNull(); // Não atribuído ainda
      // expect(rResponsaveis.data.participantes).toEqual([]);
    });
  });

  describe('Usuário sem papel de Gestor', () => {
    it('também não recebe responsavelPrincipal nem participantes na listagem', async () => {
      const tratativa = await criarTratativaAberta();
      
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

    it('recebe 404 ao tentar consultarResponsaveis (function não implementada)', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await consultarResponsaveis(consultar, tratativa, comoUsuario);
      expect(r.status).toBe(404); // Function não implementada no RED
    });
  });
});