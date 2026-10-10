import cds from '@sap/cds';
import {
  comoApp,
  comoGestor,
  comoM1001,
  comoUsuario,
  semAuth,
} from './apoio/usuarios';
import {
  definirColaboradores,
  limparProvedor,
} from './apoio/pessoas-espiao';

const { GET } = cds.test(__dirname + '/..');
const BASE = '/api/integracao-pessoas/v1';

const erroDe = (resposta: { data?: unknown }) => (resposta.data as { error?: { message?: string; target?: string } } | undefined)?.error;

const colaborador = (matricula: string, nome: string, situacao: 'Ativo' | 'Inativo' = 'Ativo') => ({
  matricula,
  nome,
  email: `${nome.toLowerCase().replace(/\s+/g, '.')}@empresa.com`,
  codigoUnidade: 'SP',
  codigoArea: 'SESMT',
  matriculaGestor: 'M2002',
  situacao,
});

beforeEach(() => {
  limparProvedor();
});

describe('integração SuccessFactors – consulta e busca de colaboradores (etapa 3)', () => {
  it('CA1 + CA12 + CA15: consulta autenticada do colaborador retorna os atributos mínimos e respeita a identidade do usuário logado', async () => {
    definirColaboradores([colaborador('M1001', 'Ana Souza')]);

    const resposta = await GET(`${BASE}/consultarColaborador(matricula='M1001')`, comoM1001);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject({
      matricula: 'M1001',
      nome: 'Ana Souza',
      email: 'ana.souza@empresa.com',
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
      matriculaGestor: 'M2002',
      situacao: 'Ativo',
    });
    expect(Object.keys(resposta.data ?? {})).toEqual(expect.arrayContaining([
      'matricula',
      'nome',
      'email',
      'codigoUnidade',
      'codigoArea',
      'matriculaGestor',
      'situacao',
    ]));
  });

  it('CA2 + CA3 + CA26: retorna somente dados funcionais mínimos e nenhum atributo sensível', async () => {
    definirColaboradores([colaborador('M2002', 'Bruno Costa')]);

    const resposta = await GET(`${BASE}/consultarColaborador(matricula='M2002')`, comoGestor);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject({
      matricula: 'M2002',
      nome: 'Bruno Costa',
      email: 'bruno.costa@empresa.com',
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
      matriculaGestor: 'M2002',
      situacao: 'Ativo',
    });
    expect(resposta.data).not.toHaveProperty('cpf');
    expect(resposta.data).not.toHaveProperty('salario');
    expect(resposta.data).not.toHaveProperty('avaliacoes');
    expect(resposta.data).not.toHaveProperty('dadosMedicos');
    expect(Object.keys(resposta.data ?? {}).filter((chave) => !chave.startsWith('@'))).toHaveLength(7);
  });

  it('CA6 + CA7: colaborador desligado continua com a matrícula original e é sinalizado como inativo sem reatribuição automática', async () => {
    definirColaboradores([colaborador('M9999', 'Carla Silva', 'Inativo')]);

    const resposta = await GET(`${BASE}/consultarColaborador(matricula='M9999')`, comoGestor);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject({
      matricula: 'M9999',
      nome: 'Carla Silva',
      situacao: 'Inativo',
    });
    expect(resposta.data?.matricula).toBe('M9999');
    expect(resposta.data?.situacao).toBe('Inativo');
  });

  it('CA8: a estrutura de abertura da tratativa deve prevalecer sobre enriquecimento do SF e não ser sobrescrita por dados de consulta', async () => {
    definirColaboradores([colaborador('M3003', 'Daniel Lima')]);

    const resposta = await GET(`${BASE}/consultarColaborador(matricula='M3003')`, comoGestor);

    expect(resposta.status).toBe(200);
    expect(resposta.data).toMatchObject({
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
    });
    expect(resposta.data).not.toHaveProperty('unidadeTratativa');
    expect(resposta.data).not.toHaveProperty('areaTratativa');
    expect(resposta.data).not.toHaveProperty('solicitante');
  });

  it('CA16: matrícula inexistente retorna 404 com target matricula', async () => {
    const resposta = await GET(`${BASE}/consultarColaborador(matricula='M4040')`, comoGestor);

    expect(resposta.status).toBe(404);
    expect(erroDe(resposta)?.message).toBe('Colaborador não encontrado.');
    expect(erroDe(resposta)?.target).toBe('matricula');
  });

  it.each([
    ['matricula vazia', 'M 1001', 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.'],
    ['matricula com e-mail', 'ana@empresa.com', 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.'],
    ['matricula em branco', '   ', 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.'],
  ])('CA17: rejeita %s', async (_, valor, mensagem) => {
    const resposta = await GET(`${BASE}/consultarColaborador(matricula='${encodeURIComponent(valor)}')`, comoGestor);

    expect(resposta.status).toBe(400);
    expect(erroDe(resposta)?.message).toBe(mensagem);
    expect(erroDe(resposta)?.target).toBe('matricula');
  });

  it('CA18: busca de colaboradores tem ordenação e paginação determinísticas', async () => {
    definirColaboradores([
      colaborador('M5005', 'Zé da Silva'),
      colaborador('M1001', 'Ana Souza'),
      colaborador('M3003', 'Bruno Costa'),
      colaborador('M2002', 'Ana Pereira'),
    ]);

    const resposta = await GET(
      `${BASE}/buscarColaboradores(termo='a',codigoUnidade='SP',codigoArea='SESMT',apenasAtivos=true,tamanhoPagina=2,pagina=1)`,
      comoGestor,
    );

    expect(resposta.status).toBe(200);
    expect(Array.isArray(resposta.data.value)).toBe(true);
    expect(resposta.data.value).toHaveLength(2);
    expect(resposta.data.value.map((item: { nome: string }) => item.nome)).toEqual(['Ana Pereira', 'Ana Souza']);
  });

  it.each([
    [
      `${BASE}/buscarColaboradores(termo='${'A'.repeat(101)}',codigoUnidade='SP',codigoArea='SESMT',apenasAtivos=true,tamanhoPagina=50,pagina=1)`,
      400,
      'O campo Termo aceita no máximo 100 caracteres.',
      'termo',
    ],
    [
      `${BASE}/buscarColaboradores(termo='ana',codigoUnidade='SP',codigoArea='SESMT',apenasAtivos=true,tamanhoPagina=0,pagina=1)`,
      400,
      'O campo Tamanho da página aceita de 1 a 200.',
      'tamanhoPagina',
    ],
    [
      `${BASE}/buscarColaboradores(termo='ana',codigoUnidade='SP',codigoArea='SESMT',apenasAtivos=true,tamanhoPagina=50,pagina=0)`,
      400,
      'O campo Página deve ser 1 ou maior.',
      'pagina',
    ],
    [
      `${BASE}/buscarColaboradores(termo='ana',codigoUnidade='SP',codigoArea='SESMT',apenasAtivos=true,tamanhoPagina=0,pagina=0)`,
      400,
      'O campo Tamanho da página aceita de 1 a 200.',
      'tamanhoPagina',
    ],
  ])('CA24: valida %s', async (url, status, mensagem, target) => {
    const resposta = await GET(url, comoGestor);

    expect(resposta.status).toBe(status);
    expect(erroDe(resposta)?.message).toBe(mensagem);
    expect(erroDe(resposta)?.target).toBe(target);
  });

  it('CA20 + CA23: aplicativo de origem e usuários anônimos são bloqueados em consulta e busca de colaboradores', async () => {
    const consultaApp = await GET(`${BASE}/consultarColaborador(matricula='M1001')`, comoApp);
    expect(consultaApp.status).toBe(403);
    expect(erroDe(consultaApp)?.message).toBe('Acesso negado.');

    const buscaApp = await GET(`${BASE}/buscarColaboradores(termo='ana',apenasAtivos=true,tamanhoPagina=10,pagina=1)`, comoApp);
    expect(buscaApp.status).toBe(403);
    expect(erroDe(buscaApp)?.message).toBe('Acesso negado.');

    const consultaAnonima = await GET(`${BASE}/consultarColaborador(matricula='M1001')`, semAuth);
    expect(consultaAnonima.status).toBe(401);

    const buscaAnonima = await GET(`${BASE}/buscarColaboradores(termo='ana',apenasAtivos=true,tamanhoPagina=10,pagina=1)`, semAuth);
    expect(buscaAnonima.status).toBe(401);
  });

  it('CA23: usuário comum autenticado consulta colaboradores ativos com os dados funcionais permitidos', async () => {
    definirColaboradores([colaborador('M1001', 'Ana Souza')]);

    const consulta = await GET(`${BASE}/consultarColaborador(matricula='M1001')`, comoUsuario);
    expect(consulta.status).toBe(200);
    expect(consulta.data).toMatchObject({
      matricula: 'M1001',
      nome: 'Ana Souza',
      email: 'ana.souza@empresa.com',
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
    });
    const busca = await GET(`${BASE}/buscarColaboradores(termo='ana',apenasAtivos=true,tamanhoPagina=10,pagina=1)`, comoUsuario);
    expect(busca.status).toBe(200);
    expect(busca.data.value).toEqual([expect.objectContaining({
      matricula: 'M1001',
      nome: 'Ana Souza',
      email: 'ana.souza@empresa.com',
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
    })]);
  });
});
