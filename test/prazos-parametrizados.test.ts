import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoAdmin, comoApp } from './apoio/usuarios';

const { POST, PATCH } = cds.test(__dirname + '/..');
const ABRIR = '/api/integracao-origem/v1/abrirTratativa';
const PRAZO_ALTA = "/api/administracao/v1/PrazosCriticidade('Alta')";

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

const abrirAlta = async (idOrigem: string) => {
  fixarInstante('2026-10-07T12:00:00-03:00');
  const r = await POST(ABRIR, { origem: 'Advertência', idOrigem, titulo: 'Título', criticidade: 'Alta' }, comoApp);
  expect(r.status).toBe(200);
  const [t] = await linhas('Tratativas', { codigo: r.data.codigo });
  return t;
};

describe('prazos parametrizados (CA9)', () => {
  afterAll(async () => {
    await PATCH(PRAZO_ALTA, { dias: 7 }, comoAdmin);
  });

  it('CA9: mudar os dias vale só para as novas; as existentes não mudam', async () => {
    const primeira = await abrirAlta('PRZ-1');
    expect(primeira.dataPrevistaConclusao).toBe('2026-10-14');

    const altera = await PATCH(PRAZO_ALTA, { dias: 5 }, comoAdmin);
    expect(altera.status).toBe(200);

    const segunda = await abrirAlta('PRZ-2');
    expect(segunda.dataPrevistaConclusao).toBe('2026-10-12');

    const [releitura] = await linhas('Tratativas', { codigo: primeira.codigo });
    expect(releitura.dataPrevistaConclusao).toBe('2026-10-14');
  });
});
