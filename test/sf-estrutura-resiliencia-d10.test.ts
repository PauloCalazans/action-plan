import cds from '@sap/cds';
import { criarAcao } from './apoio/acoes';
import { criarAvulsa, type Envia } from './apoio/tratativas';
import {
  definirEstrutura,
  limparProvedor as limparEstrutura,
  simularFalhaProvedor as simularFalhaEstrutura,
} from './apoio/estrutura-espiao';
import {
  limparProvedor as limparPessoas,
  simularFalhaProvedor as simularFalhaPessoas,
  simularTimeoutProvedor as simularTimeoutPessoas,
} from './apoio/pessoas-espiao';
import {
  atribuirResponsavelPrincipal,
  consultarResponsaveis,
  delegarAcao,
  type Consulta,
} from './apoio/responsaveis';
import { linhas } from './apoio/banco';
import { comoApp, comoGestor, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;
const BASE = '/api/integracao-pessoas/v1';

jest.setTimeout(60000);

type Erro = { error?: { message?: string; target?: string } };

const erroDe = (resposta: { data?: unknown }) => (resposta.data as Erro | undefined)?.error;

beforeEach(() => {
  limparPessoas();
  limparEstrutura();
});

describe('integração SuccessFactors — estrutura, resiliência e precedência D10 (etapa 4)', () => {
  describe('CA13: operações de tratativa continuam disponíveis sem o SuccessFactors', () => {
    it.each([
      ['falha do provedor', simularFalhaPessoas],
      ['timeout do provedor', simularTimeoutPessoas],
    ])('atribui Responsável Principal com matrícula sintaticamente válida durante %s', async (_, indisponibilizar) => {
      const novaTratativa = await criarAvulsa(enviar);
      expect(novaTratativa.status).toBe(200);

      indisponibilizar();
      const atribuicao = await atribuirResponsavelPrincipal(
        enviar,
        novaTratativa.data.codigo,
        { responsavelPrincipal: 'M3003', justificativa: 'Atribuição durante indisponibilidade do SF' },
        comoGestor,
      );
      expect(atribuicao.status).toBe(204);

      const responsaveis = await consultarResponsaveis(consultar, novaTratativa.data.codigo, comoGestor);
      expect(responsaveis.status).toBe(200);
      expect(responsaveis.data.responsavelPrincipal).toBe('M3003');
    });

    it.each([
      ['falha do provedor', simularFalhaPessoas],
      ['timeout do provedor', simularTimeoutPessoas],
    ])('delega Ação para matrícula sintaticamente válida durante %s', async (_, indisponibilizar) => {
      const novaTratativa = await criarAvulsa(enviar);
      expect(novaTratativa.status).toBe(200);

      const acao = await criarAcao(
        enviar,
        novaTratativa.data.codigo,
        {
          descricao: 'Ação para delegação resiliente',
          responsavel: 'M1001',
          prazo: '2026-11-15',
        },
        comoGestor,
      );
      expect(acao.status).toBe(200);

      indisponibilizar();
      const delegacao = await delegarAcao(
        enviar,
        novaTratativa.data.codigo,
        {
          acao: acao.data.codigo,
          novoResponsavel: 'M3003',
          justificativa: 'Delegação durante indisponibilidade do SF',
        },
        comoGestor,
      );
      expect(delegacao.status).toBe(204);

      const acoes = await linhas('Acoes', { codigo: acao.data.codigo });
      expect(acoes[0].responsavel).toBe('M3003');
    });
  });

  describe('CA14 + D10: falha externa retorna 503 depois das recusas anteriores', () => {
    it.each([
      ['falha do provedor', simularFalhaPessoas],
      ['timeout do provedor', simularTimeoutPessoas],
    ])('preserva autenticação e validação de matrícula antes de %s', async (_, indisponibilizar) => {
      const matricula = `Z${Date.now()}`;
      indisponibilizar();

      const anonima = await GET(
        `${BASE}/consultarColaborador(matricula='${matricula}')`,
        semAuth,
      );
      expect(anonima.status).toBe(401);

      const aplicativo = await GET(
        `${BASE}/consultarColaborador(matricula='${matricula}')`,
        comoApp,
      );
      expect(aplicativo.status).toBe(403);
      expect(erroDe(aplicativo)?.message).toBe('Acesso negado.');

      const invalida = await GET(
        `${BASE}/consultarColaborador(matricula='M%201001')`,
        comoGestor,
      );
      expect(invalida.status).toBe(400);
      expect(erroDe(invalida)?.message).toBe(
        'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.',
      );
      expect(erroDe(invalida)?.target).toBe('matricula');

      const indisponivel = await GET(
        `${BASE}/consultarColaborador(matricula='${matricula}')`,
        comoGestor,
      );
      expect(indisponivel.status).toBe(503);
      expect(erroDe(indisponivel)?.message).toBe(
        'Serviço de pessoas temporariamente indisponível. Tente novamente mais tarde.',
      );
      expect(erroDe(indisponivel)?.target).toBe('integracao');
    });
  });

  it('CA19: lista estrutura hierárquica, filtra Áreas inativas e ordena empates por código', async () => {
    definirEstrutura([
      {
        codigoUnidade: 'U2',
        nomeUnidade: 'Central',
        areas: [
          { codigoArea: 'A2', nomeArea: 'Compras', ativa: true },
          { codigoArea: 'AX', nomeArea: 'Arquivo', ativa: false },
          { codigoArea: 'A1', nomeArea: 'Compras', ativa: true },
        ],
      },
      {
        codigoUnidade: 'U3',
        nomeUnidade: 'Norte',
        areas: [],
      },
      {
        codigoUnidade: 'U1',
        nomeUnidade: 'Central',
        areas: [
          { codigoArea: 'A3', nomeArea: 'Operações', ativa: true },
        ],
      },
    ]);

    const resposta = await GET(`${BASE}/listarEstruturaOrganizacional()`, comoGestor);

    expect(resposta.status).toBe(200);
    expect(resposta.data.value).toEqual([
      {
        codigoUnidade: 'U1',
        nomeUnidade: 'Central',
        areas: [{ codigoArea: 'A3', nomeArea: 'Operações' }],
      },
      {
        codigoUnidade: 'U2',
        nomeUnidade: 'Central',
        areas: [
          { codigoArea: 'A1', nomeArea: 'Compras' },
          { codigoArea: 'A2', nomeArea: 'Compras' },
        ],
      },
      {
        codigoUnidade: 'U3',
        nomeUnidade: 'Norte',
        areas: [],
      },
    ]);
  });

  it('CA20: Aplicativo de origem recebe 403 antes de consultar o provedor de estrutura', async () => {
    simularFalhaEstrutura();

    const resposta = await GET(`${BASE}/listarEstruturaOrganizacional()`, comoApp);

    expect(resposta.status).toBe(403);
    expect(erroDe(resposta)?.message).toBe('Acesso negado.');
  });

  it('CA23: usuário anônimo recebe 401 ao consultar estrutura organizacional', async () => {
    simularFalhaEstrutura();

    const resposta = await GET(`${BASE}/listarEstruturaOrganizacional()`, semAuth);

    expect(resposta.status).toBe(401);
  });

  it('CA25: o provedor de estrutura do perfil de testes responde pela fixture em memória', async () => {
    const estrutura = [{
      codigoUnidade: 'UTESTE',
      nomeUnidade: 'Unidade de teste',
      areas: [{ codigoArea: 'ATESTE', nomeArea: 'Área de teste', ativa: true }],
    }];
    definirEstrutura(estrutura);

    const provedor = await cds.connect.to('ProvedorEstruturaAdapter');
    const resposta = await provedor.send('listarEstrutura', {
      nivelUnidade: 'BusinessUnit',
      nivelArea: 'Department',
    });

    expect(resposta).toEqual(estrutura);
  });
});
