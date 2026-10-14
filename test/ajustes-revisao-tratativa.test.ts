import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { criarAvulsa, editar, mudarStatus, type Envia } from './apoio/tratativas';
import { emitirAval, comoValidador } from './apoio/aval';
import { comoGestor, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/tratativa/v1';
const TRATATIVAS = 'br.com.calazanstec.Tratativas';

jest.setTimeout(60000);

beforeAll(registrarCredenciais);

type Linha = Record<string, unknown>;

async function nova(dados: Record<string, unknown> = {}, status = 'Aberta'): Promise<string> {
  const r = await criarAvulsa(enviar, dados);
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  if (status !== 'Aberta') await cds.db.run(UPDATE.entity(TRATATIVAS).set({ status }).where({ codigo }));
  return codigo;
}
const linha = async (codigo: string): Promise<Linha> => (await linhas('Tratativas', { codigo }))[0];
// Sem ORDER BY: o SQLite devolve as linhas na ordem de gravação (rowid), que é a sequência que o teste usa.
const historico = (codigo: string) => linhas('HistoricoTratativa', { tratativa_codigo: codigo });
const estado = async (codigo: string) => ({ linha: await linha(codigo), historico: (await historico(codigo)).length });

describe('Menor 1 (CA72): Título e encerramento simultâneos', () => {
  it('(204, 204) grava Edicao antes de Encerramento; (409, 204) deixa o Título como estava', async () => {
    for (let i = 0; i < 5; i++) {
      const codigo = await nova({ titulo: 'Título antigo' }, 'Em andamento');
      const aval = await emitirAval(
        enviar,
        codigo,
        { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' },
        comoValidador,
      );
      expect(aval.status).toBe(204);
      const [ed, enc] = await Promise.all([
        editar(enviar, codigo, { titulo: 'Título novo' }, comoGestor),
        mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor),
      ]);
      expect(enc.status).toBe(204);
      const hist = await historico(codigo);
      const posEdicao = hist.findIndex((h) => h.evento === 'Edicao');
      const posEncerramento = hist.findIndex((h) => h.evento === 'Encerramento');
      expect(posEncerramento).toBeGreaterThanOrEqual(0);
      if (ed.status === 204) {
        expect(posEdicao).toBeGreaterThanOrEqual(0);
        expect(posEdicao).toBeLessThan(posEncerramento);
        expect((await linha(codigo)).titulo).toBe('Título novo');
      } else {
        expect(ed.status).toBe(409);
        expect(posEdicao).toBe(-1);
        expect((await linha(codigo)).titulo).toBe('Título antigo');
      }
    }
  });
});

describe('Menor 2 e 4 (decisão 8): Status fora da lista não é aceito', () => {
  it('Menor 2: " Encerrada " (espaços nas pontas) → 409, target status, nada gravado', async () => {
    const codigo = await nova();
    const antes = await estado(codigo);
    const r = await mudarStatus(enviar, codigo, { status: ' Encerrada ' }, comoGestor);
    expect(r.status).toBe(409);
    expect(r.data.error.target).toBe('status');
    expect(r.data.error.message).toMatch(/^Transição não permitida: de Aberta para /);
    expect(await estado(codigo)).toEqual(antes);
    expect((await linha(codigo)).status).toBe('Aberta');
  });

  it('Menor 4: "Pendente" numa Aberta → 409 Transição não permitida: de Aberta para Pendente.; nada gravado', async () => {
    const codigo = await nova();
    const antes = await estado(codigo);
    const r = await mudarStatus(enviar, codigo, { status: 'Pendente' }, comoGestor);
    expect(r.status).toBe(409);
    expect(r.data.error.target).toBe('status');
    expect(r.data.error.message).toBe('Transição não permitida: de Aberta para Pendente.');
    expect(await estado(codigo)).toEqual(antes);
  });
});

describe('Menor 3: mensagens exatas do contrato de erros', () => {
  it('edição com Título de 201 caracteres → O campo Título aceita no máximo 200 caracteres., target titulo', async () => {
    const codigo = await nova();
    const r = await editar(enviar, codigo, { titulo: 'x'.repeat(201) }, comoGestor);
    expect(r.status).toBe(400);
    expect(r.data.error.message).toBe('O campo Título aceita no máximo 200 caracteres.');
    expect(r.data.error.target).toBe('titulo');
  });

  it('consulta com Código mal formado → 400 Código inválido., target codigo', async () => {
    const r = await GET(`${BASE}/consultarTratativa(codigo=abc)`, comoUsuario);
    expect(r.status).toBe(400);
    expect(r.data.error.message).toBe('Código inválido.');
    expect(r.data.error.target).toBe('codigo');
  });

  it('filtro de Status inválido → mensagem exata da decisão 12, target status', async () => {
    const r = await GET(`${BASE}/listarTratativas(status='Pendente')`, comoUsuario);
    expect(r.status).toBe(400);
    expect(r.data.error.message).toBe('Status inválido: use Aberta, Em andamento, Encerrada ou Cancelada.');
    expect(r.data.error.target).toBe('status');
  });
});
