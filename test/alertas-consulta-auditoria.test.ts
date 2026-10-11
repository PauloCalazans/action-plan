import cds from '@sap/cds';
import { criarAcao } from './apoio/acoes';
import { executarRotinaAlertas } from './apoio/alertas';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { falharProximoTeams, limparEnviosTeams } from './apoio/teams-espiao';
import { definirColaboradores, limparProvedor } from './apoio/pessoas-espiao';
import { criarAvulsa, type Envia } from './apoio/tratativas';
import { comoAdmin, comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const ADMIN = '/api/administracao/v1';
const LISTAR = `${ADMIN}/listarAlertasEmitidos`;
const CONSULTAR_PARAMETROS = `${ADMIN}/consultarParametrosAlertas()`;
const ATUALIZAR_PARAMETROS = `${ADMIN}/atualizarParametrosAlertas`;
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const INSTANTE_CRIACAO = '2026-10-07T12:00:00.000Z';
const PRAZO_PROXIMO = '2026-10-12';

type ItemAlerta = {
  tipo: string;
  tratativa: string;
  destinatario: string;
  enviadoEm: string;
  statusEnvio: string;
  motivoFalha?: string;
};

type RespostaErro = { error?: { message?: string; target?: string } };

const erroDe = (resposta: { data: unknown }) => (resposta.data as RespostaErro).error;
const itensDe = (resposta: { data: unknown }) => (resposta.data as { value: ItemAlerta[] }).value;

function montarUrl(filtros: {
  tratativa?: string;
  tipo?: string;
  destinatario?: string;
  statusEnvio?: string;
  tamanhoPagina?: number;
  pagina?: number;
} = {}): string {
  const parametros: string[] = [];
  if (filtros.tratativa !== undefined) parametros.push(`tratativa=${filtros.tratativa}`);
  for (const campo of ['tipo', 'destinatario', 'statusEnvio'] as const) {
    const valor = filtros[campo];
    if (valor !== undefined) {
      const escapado = valor.replace(/'/g, "''");
      parametros.push(`${campo}='${encodeURIComponent(escapado)}'`);
    }
  }
  if (filtros.tamanhoPagina !== undefined) parametros.push(`tamanhoPagina=${filtros.tamanhoPagina}`);
  if (filtros.pagina !== undefined) parametros.push(`pagina=${filtros.pagina}`);
  return `${LISTAR}(${parametros.join(',')})`;
}

async function criarCenario(opcoes: {
  prazo?: string;
  responsavel?: string;
  titulo?: string;
} = {}): Promise<{ tratativa: string; acao: string }> {
  const abertura = await criarAvulsa(enviar, {
    titulo: opcoes.titulo ?? 'Tratativa para consulta de alertas',
  });
  expect(abertura.status).toBe(200);
  const tratativa = abertura.data.codigo as string;
  const criacao = await criarAcao(enviar, tratativa, {
    descricao: 'Ação para consulta de alertas',
    responsavel: opcoes.responsavel ?? 'M2002',
    prazo: opcoes.prazo ?? PRAZO_PROXIMO,
    evidenciaObrigatoria: 'não',
  }, comoGestor);
  expect(criacao.status).toBe(200);
  return { tratativa, acao: criacao.data.codigo as string };
}

async function executar(agora: string): Promise<void> {
  const relatorio = await executarRotinaAlertas(agora);
  expect(relatorio).toBeDefined();
  expect(relatorio?.ocorrenciasAvaliadas).toEqual(expect.any(Number));
}

async function atualizarParametros(extra: Record<string, unknown> = {}): Promise<void> {
  const resposta = await POST(ATUALIZAR_PARAMETROS, {
    diasAntecedenciaPrazoProximo: 3,
    diasInatividade: 15,
    emailHabilitado: true,
    teamsHabilitado: true,
    horaExecucaoUtc: 8,
    ...extra,
  }, comoAdmin);
  expect(resposta.status).toBe(200);
}

beforeAll(registrarCredenciais);
beforeEach(async () => {
  fixarInstante(INSTANTE_CRIACAO);
  limparEnviosTeams();
  limparProvedor();
  definirColaboradores([
    {
      matricula: 'M1001',
      nome: 'Colaborador M1001',
      email: 'm1001@empresa.com',
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
      matriculaGestor: null,
      situacao: 'Ativo',
    },
    {
      matricula: 'M2002',
      nome: 'Colaborador M2002',
      email: 'm2002@empresa.com',
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
      matriculaGestor: null,
      situacao: 'Ativo',
    },
  ]);
  await atualizarParametros();
});
afterEach(liberarRelogio);

describe('consulta e auditoria de alertas emitidos (etapa 4)', () => {
  it('CA49: Gestor consulta alertas em ordem cronológica decrescente e por fatia', async () => {
    await criarCenario();
    await executar('2026-10-10T12:00:00.000Z');
    await executar('2026-10-11T12:00:00.000Z');

    const primeiraPagina = await GET(montarUrl({ tamanhoPagina: 2, pagina: 1 }), comoGestor);
    const segundaPagina = await GET(montarUrl({ tamanhoPagina: 2, pagina: 2 }), comoGestor);

    expect(primeiraPagina.status).toBe(200);
    expect(segundaPagina.status).toBe(200);
    const primeira = itensDe(primeiraPagina);
    const segunda = itensDe(segundaPagina);
    expect(primeira).toHaveLength(2);
    expect(segunda).toHaveLength(2);
    expect(primeira.map((item) => new Date(item.enviadoEm).toISOString()))
      .toEqual(['2026-10-11T12:00:00.000Z', '2026-10-11T12:00:00.000Z']);
    expect(segunda.map((item) => new Date(item.enviadoEm).toISOString()))
      .toEqual(['2026-10-10T12:00:00.000Z', '2026-10-10T12:00:00.000Z']);
  });

  it('CA50: usuário sem papel administrativo recebe 403 ao consultar alertas', async () => {
    const resposta = await GET(montarUrl(), comoUsuario);

    expect(resposta.status).toBe(403);
    expect(erroDe(resposta)?.message).toBe('Acesso negado.');
  });

  it('CA51: aplica filtros combináveis por Tratativa, tipo, destinatário e status', async () => {
    const alvo = await criarCenario({ prazo: '2026-10-12', responsavel: 'M2002' });
    const outra = await criarCenario({ prazo: '2026-10-07', responsavel: 'M1001' });
    await executar('2026-10-10T12:00:00.000Z');

    const porTratativa = await GET(montarUrl({ tratativa: alvo.tratativa }), comoAdmin);
    const combinados = await GET(montarUrl({
      tratativa: alvo.tratativa,
      tipo: 'PrazoProximo',
      destinatario: 'M2002',
      statusEnvio: 'Sucesso',
    }), comoAdmin);
    const porTipo = await GET(montarUrl({ tipo: 'PrazoVencido' }), comoAdmin);
    const porDestinatario = await GET(montarUrl({ destinatario: 'M1001' }), comoAdmin);

    expect(porTratativa.status).toBe(200);
    expect(itensDe(porTratativa)).toHaveLength(2);
    expect(itensDe(porTratativa).every((item) => item.tratativa === alvo.tratativa)).toBe(true);
    expect(combinados.status).toBe(200);
    expect(itensDe(combinados)).toHaveLength(2);
    expect(itensDe(combinados).every((item) =>
      item.tratativa === alvo.tratativa
      && item.tipo === 'PrazoProximo'
      && item.destinatario === 'M2002'
      && item.statusEnvio === 'Sucesso',
    )).toBe(true);
    expect(itensDe(porTipo).every((item) => item.tipo === 'PrazoVencido')).toBe(true);
    expect(itensDe(porTipo).some((item) => item.tratativa === outra.tratativa)).toBe(true);
    expect(itensDe(porDestinatario).every((item) => item.destinatario === 'M1001')).toBe(true);
    expect(itensDe(porDestinatario).some((item) => item.tratativa === outra.tratativa)).toBe(true);
  });

  it('CA52: UUID de Tratativa malformado recebe 400 com target tratativa', async () => {
    const resposta = await GET(montarUrl({ tratativa: 'xyz' }), comoAdmin);

    expect(resposta.status).toBe(400);
    expect(erroDe(resposta)?.message).toBe('Código inválido.');
    expect(erroDe(resposta)?.target).toBe('tratativa');
  });

  it('CA53: UUID válido de Tratativa inexistente recebe 404', async () => {
    const resposta = await GET(montarUrl({ tratativa: UUID_INEXISTENTE }), comoAdmin);

    expect(resposta.status).toBe(404);
    expect(erroDe(resposta)?.message).toBe('Tratativa não encontrada.');
    expect(erroDe(resposta)?.target).toBe('tratativa');
  });

  it('CA54: filtro Falha retorna somente emissões falhas com motivo registrado', async () => {
    await atualizarParametros({ emailHabilitado: false, teamsHabilitado: true });
    const cenario = await criarCenario();
    const segundaAcao = await criarAcao(enviar, cenario.tratativa, {
      descricao: 'Segunda ação para conferir filtro de falhas',
      responsavel: 'M1001',
      prazo: PRAZO_PROXIMO,
      evidenciaObrigatoria: 'não',
    }, comoGestor);
    expect(segundaAcao.status).toBe(200);
    falharProximoTeams();
    await executar('2026-10-10T12:00:00.000Z');

    const todas = await GET(montarUrl({ tratativa: cenario.tratativa }), comoAdmin);
    const falhas = await GET(montarUrl({
      tratativa: cenario.tratativa,
      statusEnvio: 'Falha',
    }), comoAdmin);

    expect(todas.status).toBe(200);
    expect(itensDe(todas)).toHaveLength(2);
    expect(itensDe(todas).some((item) => item.statusEnvio === 'Sucesso')).toBe(true);
    expect(falhas.status).toBe(200);
    expect(itensDe(falhas)).toHaveLength(1);
    expect(itensDe(falhas)[0].statusEnvio).toBe('Falha');
    expect(itensDe(falhas)[0].motivoFalha).toBeTruthy();
  });

  it.each([201, 0])('CA55: tamanhoPagina %i fora do limite recebe 400', async (tamanhoPagina) => {
    const resposta = await GET(montarUrl({ tamanhoPagina }), comoAdmin);

    expect(resposta.status).toBe(400);
    expect(erroDe(resposta)?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
    expect(erroDe(resposta)?.target).toBe('tamanhoPagina');
  });

  it.each([0, -1])('CA56: pagina %i recebe 400', async (pagina) => {
    const resposta = await GET(montarUrl({ pagina }), comoAdmin);

    expect(resposta.status).toBe(400);
    expect(erroDe(resposta)?.message).toBe('O campo Página deve ser 1 ou maior.');
    expect(erroDe(resposta)?.target).toBe('pagina');
  });

  it('CA57: tamanhoPagina inválido precede pagina inválida', async () => {
    const resposta = await GET(montarUrl({ tamanhoPagina: 201, pagina: 0 }), comoAdmin);

    expect(resposta.status).toBe(400);
    expect(erroDe(resposta)?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
    expect(erroDe(resposta)?.target).toBe('tamanhoPagina');
  });

  it('CA58: consulta sem correspondências retorna lista vazia com HTTP 200', async () => {
    const resposta = await GET(montarUrl({
      destinatario: 'MATRICULA-SEM-ALERTAS-EXISTENTES',
    }), comoAdmin);

    expect(resposta.status).toBe(200);
    expect(itensDe(resposta)).toEqual([]);
  });

  it('CA65: Aplicativo de origem recebe 403 antes da checagem de Tratativa inexistente', async () => {
    const resposta = await GET(montarUrl({ tratativa: UUID_INEXISTENTE }), comoApp);

    expect(resposta.status).toBe(403);
    expect(erroDe(resposta)?.message).toBe('Acesso negado.');
  });

  it('CA63: endpoint real deste intent exige autenticação e devolve 401', async () => {
    const resposta = await GET(CONSULTAR_PARAMETROS, semAuth);

    expect(resposta.status).toBe(401);
  });

  it('CA64: runtime recusa JSON malformado e campos fora da assinatura com HTTP 400', async () => {
    const malformado = await POST(ATUALIZAR_PARAMETROS, 'invalid-json', comoAdmin);
    const campoDesconhecido = await POST(ATUALIZAR_PARAMETROS, {
      diasAntecedenciaPrazoProximo: 3,
      diasInatividade: 15,
      emailHabilitado: true,
      teamsHabilitado: true,
      horaExecucaoUtc: 8,
      campoForaDaAssinatura: true,
    }, comoAdmin);

    expect(malformado.status).toBe(400);
    expect(campoDesconhecido.status).toBe(400);
  });
});
