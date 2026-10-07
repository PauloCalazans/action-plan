import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoAdmin, comoApp, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const ABRIR = '/api/integracao-origem/v1/abrirTratativa';
const AVULSA = '/api/tratativa/v1/criarTratativaAvulsa';

jest.setTimeout(60000);

let contador = 0;
const sufixo = () => `${Date.now()}-${++contador}`;

// Toda chamada ao serviço interno é feita como promessa para ser asserida (M13).
const alterar = (codigo: string, criticidade: string) =>
  cds.connect
    .to('TratativaInternaService')
    .then((s) => s.send('alterarCriticidade', { codigo, criticidade, autor: 'sistema-teste', tipoAutor: 'Sistema' }));

async function abrir(criticidade: string): Promise<string> {
  const r = await POST(ABRIR, { origem: 'Advertência', idOrigem: `ADV-${sufixo()}`, titulo: 'T', criticidade }, comoApp);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

const historico = (codigo: string) =>
  linhas('HistoricoTratativa', { tratativa_codigo: codigo, evento: 'AlteracaoCriticidade' });

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

describe('alteração de Criticidade (R12)', () => {
  it('existência do serviço interno', async () => {
    await expect(cds.connect.to('TratativaInternaService')).resolves.toBeDefined();
  });

  it('CA11: Baixa para Crítica recalcula a Data prevista desde a criação e grava duas linhas de histórico', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const codigo = await abrir('Baixa');
    const [antes] = await linhas('Tratativas', { codigo });
    expect(antes.dataPrevistaConclusao).toBe('2026-11-06');

    fixarInstante('2026-10-20T10:00:00-03:00');
    await expect(alterar(codigo, 'Crítica')).resolves.toBeUndefined();

    const [t] = await linhas('Tratativas', { codigo });
    expect(t.criticidade).toBe('Crítica');
    expect(t.dataPrevistaConclusao).toBe('2026-10-10');
    expect(t.dataCriacao).toBe('2026-10-07');
    expect(t.codigo).toBe(codigo);

    const hist = await historico(codigo);
    expect(hist).toHaveLength(2);
    const porCampo = Object.fromEntries(hist.map((h) => [h.campo as string, h]));
    expect(porCampo.criticidade.valorAnterior).toBe('Baixa');
    expect(porCampo.criticidade.valorNovo).toBe('Crítica');
    expect(porCampo.dataPrevistaConclusao.valorAnterior).toBe('2026-11-06');
    expect(porCampo.dataPrevistaConclusao.valorNovo).toBe('2026-10-10');
    for (const h of hist) {
      expect(h.autor).toBe('sistema-teste');
      expect(h.tipoAutor).toBe('Sistema');
      expect(new Date(h.quando as string).getTime()).toBe(new Date('2026-10-20T10:00:00-03:00').getTime());
    }
  });

  it('mesma Criticidade não altera nem grava histórico', async () => {
    fixarInstante('2026-10-07T12:00:00-03:00');
    const codigo = await abrir('Alta');
    const [antes] = await linhas('Tratativas', { codigo });
    await expect(alterar(codigo, 'Alta')).resolves.toBeUndefined();
    expect(await historico(codigo)).toHaveLength(0);
    const [depois] = await linhas('Tratativas', { codigo });
    expect(depois.dataPrevistaConclusao).toBe(antes.dataPrevistaConclusao);
  });

  it('Criticidade inválida responde 400 e nada é gravado', async () => {
    const codigo = await abrir('Alta');
    await expect(alterar(codigo, 'Urgente')).rejects.toMatchObject({ status: 400 });
    const [t] = await linhas('Tratativas', { codigo });
    expect(t.criticidade).toBe('Alta');
    expect(await historico(codigo)).toHaveLength(0);
  });

  it('Código inexistente responde 404', async () => {
    await expect(alterar(cds.utils.uuid(), 'Alta')).rejects.toMatchObject({ status: 404 });
  });

  it('Tratativa avulsa também pode ter a Criticidade alterada', async () => {
    const r = await POST(AVULSA, { titulo: 'Avulsa', criticidade: 'Média' }, comoUsuario);
    expect(r.status).toBe(200);
    await expect(alterar(r.data.codigo, 'Alta')).resolves.toBeUndefined();
    expect(await historico(r.data.codigo)).toHaveLength(2);
  });
});

describe('sem operação pública', () => {
  it.each([
    ['/api/integracao-origem/v1', comoApp],
    ['/api/tratativa/v1', comoUsuario],
    ['/api/administracao/v1', comoAdmin],
  ])(
    'metadata de %s não contém alterarCriticidade',
    async (base, auth) => {
      const r = await GET(`${base}/$metadata`, auth);
      expect(r.status).toBe(200);
      expect(String(r.data)).not.toMatch(/alterarCriticidade/);
    },
  );

  it('o serviço interno existe e tem endpoints vazios', async () => {
    await expect(cds.connect.to('TratativaInternaService')).resolves.toMatchObject({ endpoints: [] });
  });
});
