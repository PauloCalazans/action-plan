import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { comoApp, comoUsuario } from './apoio/usuarios';

// https obtido como o objeto real do módulo (import * copiaria o namespace).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require('node:https') as typeof import('node:https');

const { POST } = cds.test(__dirname + '/..');
const ABRIR = '/api/integracao-origem/v1/abrirTratativa';
const AVULSA = '/api/tratativa/v1/criarTratativaAvulsa';

jest.setTimeout(60000);

beforeAll(registrarCredenciais);

describe('CA3: nenhuma comunicação de saída ao aplicativo', () => {
  it('criação, repetição (R16) e alteração de Criticidade não chamam fetch nem https.request', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const httpsSpy = jest.spyOn(https, 'request');
    try {
      const pedido = { origem: 'Advertência', idOrigem: `ADV-${Date.now()}`, titulo: 'T', criticidade: 'Baixa' };
      const criar = await POST(ABRIR, pedido, comoApp);
      expect(criar.status).toBe(200);
      const repetir = await POST(ABRIR, pedido, comoApp);
      expect(repetir.status).toBe(200);
      expect(repetir.data.codigo).toBe(criar.data.codigo);
      const avulsa = await POST(AVULSA, { titulo: 'A', criticidade: 'Alta' }, comoUsuario);
      expect(avulsa.status).toBe(200);

      const interno = cds.connect.to('TratativaInternaService');
      await expect(
        interno.then((s) =>
          s.send('alterarCriticidade', {
            codigo: criar.data.codigo,
            criticidade: 'Crítica',
            autor: 'sistema-teste',
            tipoAutor: 'Sistema',
          }),
        ),
      ).resolves.toBeUndefined();

      // O cliente do cds.test também usa fetch para localhost; só conta o que sai para fora.
      const destino = (arg: unknown) => String(arg instanceof Request ? arg.url : arg);
      const externas = fetchSpy.mock.calls.filter(([alvo]) => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(destino(alvo)));
      expect(externas).toHaveLength(0);
      expect(httpsSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      httpsSpy.mockRestore();
    }
  });

  it('nenhum serviço em cds.services é RemoteService', () => {
    const Remoto = (cds as unknown as { RemoteService: new () => unknown }).RemoteService;
    const remotos = Object.values(cds.services as Record<string, unknown>).filter((s) => s instanceof Remoto);
    expect(remotos).toHaveLength(0);
  });
});
