import cds from '@sap/cds';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comoAdmin, comoApp, comoGestor, comoUsuario } from './apoio/usuarios';
import { linhas } from './apoio/banco';
import { definirColaboradores, limparProvedor } from './apoio/pessoas-espiao';

const { GET, POST } = cds.test(__dirname + '/..');
const ADMIN = '/api/administracao/v1';
const CONSULTAR = `${ADMIN}/consultarParametrosAlertas()`;
const ATUALIZAR = `${ADMIN}/atualizarParametrosAlertas`;

jest.setTimeout(60000);

type Parametros = {
  diasAntecedenciaPrazoProximo: number;
  diasInatividade: number;
  emailHabilitado: boolean;
  teamsHabilitado: boolean;
  horaExecucaoUtc: number;
};

type RespostaErro = { error?: { message?: string; target?: string } };

const PADRAO: Parametros = {
  diasAntecedenciaPrazoProximo: 3,
  diasInatividade: 15,
  emailHabilitado: true,
  teamsHabilitado: true,
  horaExecucaoUtc: 8,
};

const erroDe = (resposta: { data: unknown }) => (resposta.data as RespostaErro).error;

beforeEach(() => {
  limparProvedor();
  definirColaboradores([{
    matricula: 'M1001',
    nome: 'Colaborador M1001',
    email: 'm1001@empresa.com',
    codigoUnidade: 'SP',
    codigoArea: 'SESMT',
    matriculaGestor: null,
    situacao: 'Ativo',
  }]);
});

describe('parâmetros de alertas e governança administrativa', () => {
  it('CA1: Administrador recebe a parametrização inicial padrão', async () => {
    const resposta = await GET(CONSULTAR, comoAdmin);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject(PADRAO);
  });

  it('CA2: Gestor de Tratativa consulta os parâmetros vigentes', async () => {
    const resposta = await GET(CONSULTAR, comoGestor);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject(PADRAO);
  });

  it('CA3: usuário sem papel de Administrador nem Gestor recebe acesso negado', async () => {
    const resposta = await GET(CONSULTAR, comoUsuario);

    expect(resposta.status).toBe(403);
    expect(erroDe(resposta)?.message).toBe('Acesso negado.');
  });

  it('CA4: Administrador atualiza e relê os parâmetros persistidos', async () => {
    const novos: Parametros = {
      diasAntecedenciaPrazoProximo: 5,
      diasInatividade: 16,
      emailHabilitado: false,
      teamsHabilitado: true,
      horaExecucaoUtc: 22,
    };

    const atualizacao = await POST(ATUALIZAR, novos, comoAdmin);
    expect(atualizacao.status).toBe(200);
    expect(atualizacao.data).toMatchObject(novos);

    const consulta = await GET(CONSULTAR, comoAdmin);
    expect(consulta.status).toBe(200);
    expect(consulta.data).toMatchObject(novos);
  });

  it('CA5: Gestor não altera parâmetros e recebe acesso negado', async () => {
    const antes = await GET(CONSULTAR, comoAdmin);
    expect(antes.status).toBe(200);

    const atualizacao = await POST(ATUALIZAR, PADRAO, comoGestor);
    expect(atualizacao.status).toBe(403);
    expect(erroDe(atualizacao)?.message).toBe('Acesso negado.');

    const depois = await GET(CONSULTAR, comoAdmin);
    expect(depois.status).toBe(200);
    expect(depois.data).toMatchObject(antes.data);
  });

  it('CA9: Aplicativo de origem não consulta nem atualiza parâmetros', async () => {
    const consulta = await GET(CONSULTAR, comoApp);
    expect(consulta.status).toBe(403);
    expect(erroDe(consulta)?.message).toBe('Acesso negado.');

    const atualizacao = await POST(ATUALIZAR, PADRAO, comoApp);
    expect(atualizacao.status).toBe(403);
    expect(erroDe(atualizacao)?.message).toBe('Acesso negado.');
  });

  it.each([0, 31])(
    'CA6: rejeita diasAntecedenciaPrazoProximo fora do limite (%i)',
    async (diasAntecedenciaPrazoProximo) => {
      const resposta = await POST(ATUALIZAR, {
        ...PADRAO,
        diasAntecedenciaPrazoProximo,
      }, comoAdmin);

      expect(resposta.status).toBe(400);
      expect(erroDe(resposta)?.message).toBe('O campo Dias de antecedência aceita de 1 a 30.');
      expect(erroDe(resposta)?.target).toBe('diasAntecedenciaPrazoProximo');
    },
  );

  it.each([0, 91])(
    'CA7: rejeita diasInatividade fora do limite (%i)',
    async (diasInatividade) => {
      const resposta = await POST(ATUALIZAR, { ...PADRAO, diasInatividade }, comoAdmin);

      expect(resposta.status).toBe(400);
      expect(erroDe(resposta)?.message).toBe('O campo Dias de inatividade aceita de 1 a 90.');
      expect(erroDe(resposta)?.target).toBe('diasInatividade');
    },
  );

  it.each([-1, 24])(
    'CA8: rejeita horaExecucaoUtc fora do limite (%i)',
    async (horaExecucaoUtc) => {
      const resposta = await POST(ATUALIZAR, { ...PADRAO, horaExecucaoUtc }, comoAdmin);

      expect(resposta.status).toBe(400);
      expect(erroDe(resposta)?.message).toBe('O campo Hora de execução aceita de 0 a 23.');
      expect(erroDe(resposta)?.target).toBe('horaExecucaoUtc');
    },
  );

  it.each([
    ['diasAntecedenciaPrazoProximo', 'O campo Dias de antecedência aceita de 1 a 30.'],
    ['diasInatividade', 'O campo Dias de inatividade aceita de 1 a 90.'],
    ['horaExecucaoUtc', 'O campo Hora de execução aceita de 0 a 23.'],
  ])(
    'D10: rejeita atualização sem o campo numérico %s',
    async (campo, mensagem) => {
      const parametros: Record<string, unknown> = { ...PADRAO };
      delete parametros[campo];

      const resposta = await POST(ATUALIZAR, parametros, comoAdmin);

      expect(resposta.status).toBe(400);
      expect(erroDe(resposta)?.message).toBe(mensagem);
      expect(erroDe(resposta)?.target).toBe(campo);
    },
  );

  it('CA10: atualizar parâmetros não cria eventos no histórico das Tratativas', async () => {
    const antes = await linhas('HistoricoTratativa');
    const novos = { ...PADRAO, diasInatividade: 20 };

    try {
      const resposta = await POST(ATUALIZAR, novos, comoAdmin);
      expect(resposta.status).toBe(200);

      const depois = await linhas('HistoricoTratativa');
      expect(depois).toHaveLength(antes.length);
    } finally {
      await POST(ATUALIZAR, PADRAO, comoAdmin);
    }
  });

  it('CA37: o perfil de teste configura adaptadores em memória, sem SMTP ou Graph reais', () => {
    type Configuracao = {
      cds?: {
        requires?: Record<string, { '[test]'?: { impl?: string } }>;
      };
    };
    const configuracao = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as Configuracao;
    const requires = configuracao.cds?.requires ?? {};

    expect(requires.EmailAdapter?.['[test]']?.impl).toBe('test/apoio/email-espiao');
    expect(requires.TeamsAdapter?.['[test]']?.impl).toBe('test/apoio/teams-espiao');
    expect(requires.DiretorioPessoasAdapter?.['[test]']?.impl).toBe('srv/alertas/diretorio-pessoas-adapter');
  });

  it('CA39: o adaptador de teste resolve o e-mail do colaborador ativo no provedor', async () => {
    const configuracao = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as {
      cds?: {
        requires?: Record<string, { '[test]'?: { impl?: string } }>;
      };
    };

    expect(configuracao.cds?.requires?.DiretorioPessoasAdapter?.['[test]']?.impl)
      .toBe('srv/alertas/diretorio-pessoas-adapter');

    const diretorio = await cds.connect.to('DiretorioPessoasAdapter');
    const pessoa = await diretorio.send('resolverPessoa', { matricula: 'M1001' });

    expect(pessoa).toEqual({
      email: 'm1001@empresa.com',
      teamsId: 'm1001@empresa.com',
    });
  });

});
