import cds from '@sap/cds';
import { criarAcao, criarSubacao, editarAcao, mudarStatusAcao } from './apoio/acoes';
import { registrarCredenciais } from './apoio/credenciais';
import { criarAvulsa, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

// https obtido como o objeto real do módulo (import * copiaria o namespace).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require('node:https') as typeof import('node:https');

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;

jest.setTimeout(60000);

beforeAll(registrarCredenciais);

describe('CA86: nenhuma comunicação de saída nas operações de Ação', () => {
  it('criação, subação, transição e edição de Ações não chamam fetch externo nem https.request', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const httpsSpy = jest.spyOn(https, 'request');
    try {
      const avulsa = await criarAvulsa(enviar);
      expect(avulsa.status).toBe(200);
      const t = avulsa.data.codigo as string;
      const dados = { descricao: 'Avaliar local', responsavel: 'M1001', prazo: '2026-11-07' };

      const mae = await criarAcao(enviar, t, dados, comoGestor);
      expect(mae.status).toBe(200);
      const sub = await criarSubacao(enviar, t, { ...dados, acaoMae: mae.data.codigo }, comoGestor);
      expect(sub.status).toBe(200);
      const iniciar = await mudarStatusAcao(enviar, t, { acao: sub.data.codigo, status: 'Em andamento' }, comoGestor);
      expect(iniciar.status).toBe(204);
      const editar = await editarAcao(enviar, t, { acao: mae.data.codigo, descricao: 'Nova descrição' }, comoGestor);
      expect(editar.status).toBe(204);

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
