import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { comoAdmin } from './apoio/usuarios';
import type { RespostaGrupo3 } from './apoio/grupo3';

const { GET } = cds.test(__dirname + '/..');
const consultar = GET as unknown as (url: string, identidade?: unknown) => Promise<RespostaGrupo3>;

beforeAll(registrarCredenciais);

describe('suporte de integração do grupo 3', () => {
  it('os serviços que recebem as tasks 005-007 estão expostos em OData V4', async () => {
    const servicos = [
      { url: '/api/administracao/v1/$metadata', nome: 'AdministracaoService' },
      { url: '/api/analitico/v1/$metadata', nome: 'AnaliticoService' },
      { url: '/api/app/v1/$metadata', nome: 'TratativaAppService' },
    ];

    for (const servico of servicos) {
      const resposta = await consultar(servico.url, comoAdmin);
      expect(resposta.status).toBe(200);
      expect(String(resposta.data)).toContain(servico.nome);
    }
  });
});
