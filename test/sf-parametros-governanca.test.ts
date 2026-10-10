import cds from '@sap/cds';
import { comoAdmin, comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const ADMIN = '/api/administracao/v1';
const TRATATIVA = '/api/tratativa/v1';

jest.setTimeout(60000);

type Erro = { error?: { message?: string; target?: string } };

const erroDe = (resposta: { data?: unknown }) => (resposta.data as Erro | undefined)?.error;

const PARAMETROS_PADRAO = {
  nivelUnidadeSF: 'BusinessUnit',
  nivelAreaSF: 'Department',
};

describe('integração SuccessFactors – parametrização e governança (etapa 1)', () => {
  it('CA9: administrador consulta os parâmetros vigentes do SF', async () => {
    const resposta = await GET(`${ADMIN}/consultarParametrosIntegracaoSF()`, comoAdmin);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject(PARAMETROS_PADRAO);
  });

  it('CA10: gestor consulta os parâmetros vigentes do SF', async () => {
    const resposta = await GET(`${TRATATIVA}/consultarParametrosIntegracaoSF()`, comoGestor);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject(PARAMETROS_PADRAO);
  });

  it('CA11: usuário comum recebe 403 ao consultar parâmetros do SF', async () => {
    const resposta = await GET(`${TRATATIVA}/consultarParametrosIntegracaoSF()`, comoUsuario);

    expect(resposta.status).toBe(403);
    expect(erroDe(resposta)?.message).toBe('Acesso negado.');
  });

  it('CA11a: gestor não atualiza os parâmetros do SF', async () => {
    const resposta = await POST(
      `${ADMIN}/atualizarParametrosIntegracaoSF`,
      { ...PARAMETROS_PADRAO, nivelUnidadeSF: 'Division' },
      comoGestor,
    );

    expect(resposta.status).toBe(403);
    expect(erroDe(resposta)?.message).toBe('Acesso negado.');
  });

  it('CA20: aplicativo de origem é recusado em consulta e atualização de parâmetros', async () => {
    const consulta = await GET(`${ADMIN}/consultarParametrosIntegracaoSF()`, comoApp);
    expect(consulta.status).toBe(403);
    expect(erroDe(consulta)?.message).toBe('Acesso negado.');

    const atualizacao = await POST(
      `${ADMIN}/atualizarParametrosIntegracaoSF`,
      { nivelUnidadeSF: 'BusinessUnit', nivelAreaSF: 'Department' },
      comoApp,
    );
    expect(atualizacao.status).toBe(403);
    expect(erroDe(atualizacao)?.message).toBe('Acesso negado.');
  });

  it('CA23: requisição anônima recebe 401 em consulta e atualização de parâmetros', async () => {
    const consulta = await GET(`${TRATATIVA}/consultarParametrosIntegracaoSF()`, semAuth);
    expect(consulta.status).toBe(401);

    const atualizacao = await POST(
      `${ADMIN}/atualizarParametrosIntegracaoSF`,
      { nivelUnidadeSF: 'BusinessUnit', nivelAreaSF: 'Department' },
      semAuth,
    );
    expect(atualizacao.status).toBe(401);
  });

  it.each([
    ['nivelUnidadeSF', '   ', 'O campo Nível da Unidade do SF é obrigatório.'],
    ['nivelAreaSF', '   ', 'O campo Nível da Área do SF é obrigatório.'],
    ['nivelUnidadeSF', 'A'.repeat(101), 'O campo Nível da Unidade do SF aceita até 100 caracteres.'],
    ['nivelAreaSF', 'A'.repeat(101), 'O campo Nível da Área do SF aceita até 100 caracteres.'],
  ] as const)('CA24a: rejeita valor inválido em %s (%s)', async (campo, valor, mensagem) => {
    const resposta = await POST(
      `${ADMIN}/atualizarParametrosIntegracaoSF`,
      {
        nivelUnidadeSF: campo === 'nivelUnidadeSF' ? valor : PARAMETROS_PADRAO.nivelUnidadeSF,
        nivelAreaSF: campo === 'nivelAreaSF' ? valor : PARAMETROS_PADRAO.nivelAreaSF,
      },
      comoAdmin,
    );

    expect(resposta.status).toBe(400);
    expect(erroDe(resposta)?.message).toBe(mensagem);
    expect(erroDe(resposta)?.target).toBe(campo);
  });
});
