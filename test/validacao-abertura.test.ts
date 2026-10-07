import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { comoApp } from './apoio/usuarios';

const { POST } = cds.test(__dirname + '/..');
const ABRIR = '/api/integracao-origem/v1/abrirTratativa';

jest.setTimeout(60000);

const valido = () => ({ origem: 'Advertência', idOrigem: 'VAL-001', titulo: 'Título', criticidade: 'Alta' });
const total = async (entidade: string) => (await linhas(entidade)).length;
const contagens = async () => [
  await total('Tratativas'),
  await total('ChavesOrigem'),
  await total('HistoricoTratativa'),
];

// Envia o pedido sem o campo omitido (ou com o valor substituído) e confere o contrato de erro e a ausência de gravação.
async function recusa(alteracao: Record<string, unknown>, omitir: string[], target: string, trecho?: string) {
  const corpo: Record<string, unknown> = { ...valido(), ...alteracao };
  for (const campo of omitir) delete corpo[campo];
  const antes = await contagens();
  const r = await POST(ABRIR, corpo, comoApp);
  expect(r.status).toBe(400);
  expect(r.data.error.target).toBe(target);
  if (trecho) expect(r.data.error.message).toContain(trecho);
  expect(await contagens()).toEqual(antes);
}

beforeAll(registrarCredenciais);

describe('validação da abertura pelo aplicativo', () => {
  it('CA12: sem titulo → 400, target titulo, mensagem cita Título', async () => {
    await recusa({}, ['titulo'], 'titulo', 'Título');
  });

  it('CA12: titulo só com espaços conta como ausente', async () => {
    await recusa({ titulo: '   ' }, [], 'titulo', 'Título');
  });

  it('CA28: sem criticidade → 400, target criticidade, mensagem cita Criticidade', async () => {
    await recusa({}, ['criticidade'], 'criticidade', 'Criticidade');
  });

  it('CA5: criticidade fora da lista → 400, target criticidade', async () => {
    await recusa({ criticidade: 'Urgente' }, [], 'criticidade', 'Criticidade');
  });

  it('CA14: idOrigem sem origem → 400, target origem', async () => {
    await recusa({}, ['origem'], 'origem', 'Origem');
  });

  it('CA27: origem sem idOrigem → 400, target idOrigem', async () => {
    await recusa({}, ['idOrigem'], 'idOrigem', 'ID_Origem');
  });

  it('M5: aplicativo sem origem e sem idOrigem → 400, target origem', async () => {
    await recusa({}, ['origem', 'idOrigem'], 'origem', 'Origem');
  });
});
