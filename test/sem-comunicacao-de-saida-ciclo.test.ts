import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { abrirPorApp, editar, mudarCriticidade, mudarStatus, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

// https obtido como o objeto real do módulo (import * copiaria o namespace).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require('node:https') as typeof import('node:https');

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;

jest.setTimeout(60000);

beforeAll(registrarCredenciais);

describe('CA65: nenhuma comunicação de saída ao aplicativo no ciclo de vida', () => {
  it('mudarStatus, editar e mudarCriticidade de uma Tratativa de aplicativo não chamam fetch externo nem https.request', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const httpsSpy = jest.spyOn(https, 'request');
    try {
      const aberta = await abrirPorApp(enviar);
      expect(aberta.status).toBe(200);
      const codigo = aberta.data.codigo as string;

      const iniciar = await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor);
      const editada = await editar(enviar, codigo, { titulo: 'Novo título' }, comoGestor);
      const criticidade = await mudarCriticidade(enviar, codigo, { criticidade: 'Crítica' }, comoGestor);
      expect([iniciar.status, editada.status, criticidade.status]).toEqual([204, 204, 204]);

      // O cliente do cds.test também usa fetch para localhost; só conta o que sai para fora.
      const destino = (arg: unknown) => String(arg instanceof Request ? arg.url : arg);
      const externas = fetchSpy.mock.calls.filter(
        ([alvo]) => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(destino(alvo)),
      );
      expect(externas).toHaveLength(0);
      expect(httpsSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      httpsSpy.mockRestore();
    }
  });
});
