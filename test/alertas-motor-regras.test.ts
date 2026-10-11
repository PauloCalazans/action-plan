import cds from '@sap/cds';
import { atribuirResponsavelPrincipal, incluirParticipante } from './apoio/responsaveis';
import { criarAcao, criarSubacao, mudarStatusAcao } from './apoio/acoes';
import { anexarEvidencia, gerarPDF } from './apoio/evidencias';
import { comentarTratativa } from './apoio/comentarios';
import { linhas } from './apoio/banco';
import { abrirPorApp, criarAvulsa, mudarStatus, type Envia } from './apoio/tratativas';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoAdmin, comoGestor, comoM2002 } from './apoio/usuarios';
import { registrarCredenciais } from './apoio/credenciais';
import { limparEnviosEmail, obterEnviosEmail } from './apoio/email-espiao';
import { limparEnviosTeams, obterEnviosTeams } from './apoio/teams-espiao';
import { limparDiretorio } from './apoio/diretorio-espiao';
import { definirColaboradores, limparProvedor } from './apoio/pessoas-espiao';
import { executarRotinaAlertas, type RelatorioRotinaAlertas } from './apoio/alertas';

const { PATCH, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const AGORA = '2026-10-10T12:00:00.000Z';
const CRIACAO = '2026-10-07T12:00:00.000Z';
const PARAMETROS = '/api/administracao/v1/atualizarParametrosAlertas';
const PRAZO_ALTA = "/api/administracao/v1/PrazosCriticidade('Alta')";
const ESPERA = (dias: number) => `2026-10-${String(10 + dias).padStart(2, '0')}`;

jest.setTimeout(60000);

type Alerta = Record<string, unknown>;

async function anexarEvidenciaValida(tratativa: string, acao: string) {
  const resposta = await anexarEvidencia(enviar, tratativa, {
    acao,
    nomeArquivo: 'comprovante.pdf',
    mimeType: 'application/pdf',
    conteudo: gerarPDF(),
    descricao: 'Comprovante de teste',
  }, comoM2002);
  expect(resposta.status).toBe(200);
}

async function atualizarParametros(extra: Record<string, unknown> = {}) {
  const resposta = await POST(PARAMETROS, {
    diasAntecedenciaPrazoProximo: 3,
    diasInatividade: 15,
    emailHabilitado: true,
    teamsHabilitado: true,
    horaExecucaoUtc: 8,
    ...extra,
  }, comoAdmin);
  expect(resposta.status).toBe(200);
}

async function diasPrazoAlta(dias: number) {
  const resposta = await PATCH(PRAZO_ALTA, { dias }, comoAdmin);
  expect(resposta.status).toBe(200);
}

async function novaTratativa(opcoes: {
  instante?: string;
  origem?: string;
  responsavelPrincipal?: string;
  criticidade?: string;
} = {}): Promise<string> {
  fixarInstante(opcoes.instante ?? CRIACAO);
  const resposta = opcoes.origem
    ? await abrirPorApp(enviar, { origem: opcoes.origem, criticidade: opcoes.criticidade ?? 'Alta' })
    : await criarAvulsa(enviar, { criticidade: opcoes.criticidade ?? 'Alta' });
  expect(resposta.status).toBe(200);
  const codigo = resposta.data.codigo as string;
  if (opcoes.responsavelPrincipal) {
    const atribuicao = await atribuirResponsavelPrincipal(
      enviar,
      codigo,
      { responsavelPrincipal: opcoes.responsavelPrincipal, justificativa: 'Responsável do teste' },
      comoGestor,
    );
    expect(atribuicao.status).toBe(204);
  }
  return codigo;
}

async function novaAcao(
  tratativa: string,
  prazo: string,
  responsavel = 'M2002',
  extra: Record<string, unknown> = {},
): Promise<string> {
  const resposta = await criarAcao(enviar, tratativa, {
    descricao: 'Ação de teste',
    responsavel,
    prazo,
    ...extra,
  }, comoGestor);
  expect(resposta.status).toBe(200);
  return resposta.data.codigo as string;
}

async function novaSubacao(tratativa: string, acaoMae: string, prazo: string, responsavel = 'M3003') {
  const resposta = await criarSubacao(enviar, tratativa, {
    acaoMae,
    descricao: 'Subação de teste',
    responsavel,
    prazo,
  }, comoGestor);
  expect(resposta.status).toBe(200);
  return resposta.data.codigo as string;
}

async function mudarAcao(tratativa: string, acao: string, status: string, justificativa?: string) {
  const resposta = await mudarStatusAcao(enviar, tratativa, {
    acao,
    status,
    ...(justificativa ? { justificativa } : {}),
  }, comoGestor);
  expect(resposta.status).toBe(204);
}

async function mudarTratativa(tratativa: string, status: string, justificativa?: string) {
  const resposta = await mudarStatus(enviar, tratativa, {
    status,
    ...(justificativa ? { justificativa } : {}),
  }, comoGestor);
  expect(resposta.status).toBe(204);
}

async function tornarEmAndamento(tratativa: string, acao: string) {
  await mudarAcao(tratativa, acao, 'Em andamento');
}

async function executarAvaliacao(): Promise<RelatorioRotinaAlertas | undefined> {
  return executarRotinaAlertas(AGORA);
}

function esperarOcorrenciasAvaliadas(relatorio: RelatorioRotinaAlertas | undefined) {
  expect(relatorio).toMatchObject({ ocorrenciasAvaliadas: expect.any(Number) });
  expect(relatorio!.ocorrenciasAvaliadas).toBeGreaterThan(0);
}

async function alertasDa(tratativa: string): Promise<Alerta[]> {
  return linhas('AlertasEmitidos', { tratativa_codigo: tratativa });
}

function alertasDistintos(alertas: Alerta[]): Alerta[] {
  const distintos = new Map<string, Alerta>();
  for (const alerta of alertas) {
    const chave = JSON.stringify([
      alerta.tipo,
      alerta.entidade,
      alerta.tratativa_codigo,
      alerta.acao_codigo ?? null,
      alerta.destinatario,
    ]);
    distintos.set(chave, alerta);
  }
  return [...distintos.values()];
}

function tipoDestinatario(alertas: Alerta[], tipo?: string): string[] {
  return alertasDistintos(alertas)
    .filter((alerta) => tipo === undefined || alerta.tipo === tipo)
    .map((alerta) => String(alerta.destinatario))
    .sort();
}

function alertasDaAcao(alertas: Alerta[], acao: string, tipo?: string): Alerta[] {
  return alertasDistintos(alertas).filter((alerta) =>
    alerta.acao_codigo === acao && (tipo === undefined || alerta.tipo === tipo));
}

beforeAll(registrarCredenciais);
beforeEach(async () => {
  fixarInstante(CRIACAO);
  limparEnviosEmail();
  limparEnviosTeams();
  limparDiretorio();
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
      matricula: 'M2001',
      nome: 'Colaborador M2001',
      email: 'm2001@empresa.com',
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
    {
      matricula: 'M3003',
      nome: 'Colaborador M3003',
      email: 'm3003@empresa.com',
      codigoUnidade: 'SP',
      codigoArea: 'SESMT',
      matriculaGestor: null,
      situacao: 'Ativo',
    },
  ]);
  await atualizarParametros();
  await diasPrazoAlta(7);
});
afterEach(liberarRelogio);

describe('motor de regras dos alertas (etapa 2)', () => {
  it('CA11: alerta PrazoProximo de Ação Pendente em dois dias vai somente ao responsável da Ação', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, ESPERA(2));

    await executarAvaliacao();
    const alertas = await alertasDa(tratativa);
    expect(tipoDestinatario(alertas, 'PrazoProximo')).toEqual(['M2002']);
    expect(alertasDaAcao(alertas, acao, 'PrazoProximo')).toHaveLength(1);
  });

  it('CA12: PrazoProximo inclui o limite de três dias para Ação Em andamento', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, ESPERA(3));
    await tornarEmAndamento(tratativa, acao);

    await executarAvaliacao();
    expect(alertasDaAcao(await alertasDa(tratativa), acao, 'PrazoProximo')).toHaveLength(1);
  });

  it('CA13: Ação com prazo quatro dias à frente não gera PrazoProximo', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, ESPERA(4));
    await tornarEmAndamento(tratativa, acao);

    const relatorio = await executarAvaliacao();
    expect(alertasDaAcao(await alertasDa(tratativa), acao, 'PrazoProximo')).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA14: Tratativa com conclusão em dois dias gera PrazoProximo ao Responsável Principal', async () => {
    await diasPrazoAlta(2);
    const tratativa = await novaTratativa({ instante: AGORA, responsavelPrincipal: 'M1001' });

    await executarAvaliacao();
    const alertas = await alertasDa(tratativa);
    expect(alertasDistintos(alertas).filter((alerta) => alerta.tipo === 'PrazoProximo' && alerta.entidade === 'Tratativa')
      .map((alerta) => alerta.destinatario)).toEqual(['M1001']);
  });

  it('CA15: Tratativa com conclusão próxima sem Responsável Principal não dispara envio', async () => {
    await diasPrazoAlta(2);
    const tratativa = await novaTratativa();
    await mudarTratativa(tratativa, 'Em andamento');

    const relatorio = await executarAvaliacao();
    expect((await alertasDa(tratativa)).filter((alerta) =>
      alerta.tipo === 'PrazoProximo' && alerta.entidade === 'Tratativa',
    )).toHaveLength(0);
    expect(obterEnviosEmail()).toHaveLength(0);
    expect(obterEnviosTeams()).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA16: Subação Em andamento com prazo amanhã alerta o responsável da própria Subação', async () => {
    const tratativa = await novaTratativa();
    const mae = await novaAcao(tratativa, ESPERA(20));
    const subacao = await novaSubacao(tratativa, mae, ESPERA(1));
    await tornarEmAndamento(tratativa, subacao);

    await executarAvaliacao();
    expect(tipoDestinatario(alertasDaAcao(await alertasDa(tratativa), subacao, 'PrazoProximo')))
      .toEqual(['M3003']);
  });

  it('CA17: PrazoVencido da Ação alerta responsável da Ação e Responsável Principal', async () => {
    const tratativa = await novaTratativa({ responsavelPrincipal: 'M1001' });
    const acao = await novaAcao(tratativa, '2026-10-09');

    await executarAvaliacao();
    const alertas = alertasDaAcao(await alertasDa(tratativa), acao, 'PrazoVencido');
    expect(alertas.map((alerta) => alerta.destinatario).sort()).toEqual(['M1001', 'M2002']);
  });

  it('CA18: Ação vencida sem Responsável Principal alerta apenas o responsável da Ação', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, '2026-10-09');

    await executarAvaliacao();
    expect(tipoDestinatario(alertasDaAcao(await alertasDa(tratativa), acao, 'PrazoVencido')))
      .toEqual(['M2002']);
  });

  it('CA19: mesma matrícula recebe no máximo uma notificação por canal no dia para PrazoVencido', async () => {
    const tratativa = await novaTratativa({ responsavelPrincipal: 'M1001' });
    const acao = await novaAcao(tratativa, '2026-10-09', 'M1001');

    await executarAvaliacao();
    const alertas = alertasDaAcao(await alertasDa(tratativa), acao, 'PrazoVencido');
    expect(tipoDestinatario(alertas))
      .toEqual(['M1001']);
    for (const canal of ['Email', 'Teams']) {
      expect(alertas.filter((alerta) => alerta.canal === canal).length).toBeLessThanOrEqual(1);
    }
  });

  it('CA20: conclusão vencida da Tratativa gera PrazoVencido ao Responsável Principal', async () => {
    await diasPrazoAlta(2);
    const tratativa = await novaTratativa({
      instante: '2026-10-07T12:00:00.000Z',
      responsavelPrincipal: 'M1001',
    });

    await executarAvaliacao();
    expect(tipoDestinatario(alertasDistintos(await alertasDa(tratativa))
      .filter((alerta) => alerta.entidade === 'Tratativa'), 'PrazoVencido'))
      .toEqual(['M1001']);
  });

  it('CA21: Tratativa inativa há 16 dias alerta seu Responsável Principal', async () => {
    await atualizarParametros({ diasInatividade: 15 });
    await diasPrazoAlta(30);
    const tratativa = await novaTratativa({
      instante: '2026-09-24T12:00:00.000Z',
      responsavelPrincipal: 'M1001',
    });
    fixarInstante(AGORA);

    await executarAvaliacao();
    expect(tipoDestinatario(alertasDistintos(await alertasDa(tratativa))
      .filter((alerta) => alerta.entidade === 'Tratativa'), 'Inatividade'))
      .toEqual(['M1001']);
  });

  it('CA22: sem Responsável Principal, alerta de inatividade vai a todos os Participantes', async () => {
    await atualizarParametros({ diasInatividade: 15 });
    await diasPrazoAlta(30);
    const tratativa = await novaTratativa({ instante: '2026-09-20T12:00:00.000Z' });
    for (const participante of ['M2001', 'M2002']) {
      const resposta = await incluirParticipante(enviar, tratativa, { participante }, comoGestor);
      expect(resposta.status).toBe(204);
    }
    fixarInstante(AGORA);

    await executarAvaliacao();
    expect(tipoDestinatario(alertasDistintos(await alertasDa(tratativa))
      .filter((alerta) => alerta.entidade === 'Tratativa'), 'Inatividade'))
      .toEqual(['M2001', 'M2002']);
  });

  it('CA23: Comentário há dois dias torna recente a última atividade da Tratativa', async () => {
    await atualizarParametros({ diasInatividade: 15 });
    await diasPrazoAlta(30);
    const tratativa = await novaTratativa({ instante: '2026-09-20T12:00:00.000Z' });
    fixarInstante('2026-10-08T12:00:00.000Z');
    const comentario = await comentarTratativa(enviar, tratativa, { texto: 'Atualização recente', mencoes: [] }, comoGestor);
    expect(comentario.status).toBe(200);
    fixarInstante(AGORA);

    const relatorio = await executarAvaliacao();
    expect((await alertasDa(tratativa)).filter((alerta) => alerta.tipo === 'Inatividade')).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA24: evento de Histórico de Ação há três dias torna recente a última atividade', async () => {
    await atualizarParametros({ diasInatividade: 15 });
    await diasPrazoAlta(30);
    const tratativa = await novaTratativa({ instante: '2026-09-20T12:00:00.000Z' });
    const acao = await novaAcao(tratativa, '2026-11-20');
    fixarInstante('2026-10-07T12:00:00.000Z');
    await tornarEmAndamento(tratativa, acao);
    fixarInstante(AGORA);

    const relatorio = await executarAvaliacao();
    expect((await alertasDa(tratativa)).filter((alerta) => alerta.tipo === 'Inatividade')).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA25: Tratativa inativa sem Responsável Principal nem Participantes não envia alerta', async () => {
    await atualizarParametros({ diasInatividade: 15 });
    await diasPrazoAlta(30);
    const tratativa = await novaTratativa({ instante: '2026-09-20T12:00:00.000Z' });
    fixarInstante(AGORA);

    const relatorio = await executarAvaliacao();
    expect((await alertasDa(tratativa)).filter((alerta) => alerta.tipo === 'Inatividade')).toHaveLength(0);
    expect(obterEnviosEmail()).toHaveLength(0);
    expect(obterEnviosTeams()).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA26: Ação com evidência obrigatória sem anexo e prazo próximo gera EvidenciaPendente', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, ESPERA(2), 'M2002', { evidenciaObrigatoria: 'sim' });

    await executarAvaliacao();
    expect(tipoDestinatario(alertasDaAcao(await alertasDa(tratativa), acao, 'EvidenciaPendente')))
      .toEqual(['M2002']);
  });

  it('CA27: EvidenciaPendente vencida alerta o Responsável da Ação e o Responsável Principal', async () => {
    const tratativa = await novaTratativa({ responsavelPrincipal: 'M1001' });
    const acao = await novaAcao(tratativa, '2026-10-09', 'M2002', { evidenciaObrigatoria: 'sim' });

    await executarAvaliacao();
    expect(tipoDestinatario(alertasDaAcao(await alertasDa(tratativa), acao, 'EvidenciaPendente')))
      .toEqual(['M1001', 'M2002']);
  });

  it('CA28: evidência ativa satisfaz a exigência e impede EvidenciaPendente', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, ESPERA(2), 'M2002', { evidenciaObrigatoria: 'sim' });
    const evidencia = await anexarEvidencia(enviar, tratativa, {
      acao,
      nomeArquivo: 'comprovante.pdf',
      mimeType: 'application/pdf',
      conteudo: gerarPDF(),
      descricao: 'Comprovante',
    }, { auth: { username: 'M2002', password: '' }, validateStatus: () => true });
    expect(evidencia.status).toBe(200);

    const relatorio = await executarAvaliacao();
    expect(alertasDaAcao(await alertasDa(tratativa), acao, 'EvidenciaPendente')).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA29: evidência opcional sem anexo não gera EvidenciaPendente', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, ESPERA(2), 'M2002', { evidenciaObrigatoria: 'não' });

    const relatorio = await executarAvaliacao();
    expect(alertasDaAcao(await alertasDa(tratativa), acao, 'EvidenciaPendente')).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA30: Tratativa Encerrada com prazo vencido não gera alertas para Tratativa nem suas Ações', async () => {
    await diasPrazoAlta(1);
    const tratativa = await novaTratativa({ instante: '2026-09-20T12:00:00.000Z' });
    const acao = await novaAcao(tratativa, '2026-09-21', 'M2002', { evidenciaObrigatoria: 'sim' });
    await anexarEvidenciaValida(tratativa, acao);
    await mudarAcao(tratativa, acao, 'Concluída');
    await mudarTratativa(tratativa, 'Encerrada');
    fixarInstante(AGORA);

    const relatorio = await executarAvaliacao();
    expect(await alertasDa(tratativa)).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA31: Tratativa Cancelada não gera alertas de nenhuma modalidade', async () => {
    await diasPrazoAlta(1);
    const tratativa = await novaTratativa({ instante: '2026-09-20T12:00:00.000Z' });
    const acao = await novaAcao(tratativa, '2026-09-21', 'M2002', { evidenciaObrigatoria: 'sim' });
    await mudarTratativa(tratativa, 'Cancelada', 'Tratativa duplicada');
    fixarInstante(AGORA);

    const relatorio = await executarAvaliacao();
    const alertas = await alertasDa(tratativa);
    expect(alertas).toHaveLength(0);
    expect(alertasDaAcao(alertas, acao)).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA32: Ação Concluída com prazo e evidência pendentes não gera alertas', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, '2026-10-09', 'M2002', { evidenciaObrigatoria: 'sim' });
    await anexarEvidenciaValida(tratativa, acao);
    await mudarAcao(tratativa, acao, 'Concluída');

    const relatorio = await executarAvaliacao();
    expect(alertasDaAcao(await alertasDa(tratativa), acao)).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA33: Ação Cancelada não gera alertas de nenhuma modalidade', async () => {
    const tratativa = await novaTratativa();
    const acao = await novaAcao(tratativa, ESPERA(1), 'M2002', { evidenciaObrigatoria: 'sim' });
    await mudarAcao(tratativa, acao, 'Cancelada', 'Ação cancelada para teste');

    const relatorio = await executarAvaliacao();
    expect(alertasDaAcao(await alertasDa(tratativa), acao)).toHaveLength(0);
    esperarOcorrenciasAvaliadas(relatorio);
  });

  it('CA66: quatro Origens externas e uma avulsa recebem as mesmas quatro regras de alerta', async () => {
    await atualizarParametros({ diasInatividade: 15 });
    await diasPrazoAlta(30);
    const origens = [
      'Registro de Acidente',
      'Notificação de Risco de Acidente',
      'Advertência',
      'Auditoria de Qualidade',
      undefined,
    ];
    const tratativas: string[] = [];
    const acoesProximas: string[] = [];
    const acoesVencidas: string[] = [];
    const acoesComEvidenciaPendente: string[] = [];
    for (const origem of origens) {
      const tratativa = await novaTratativa({
        instante: '2026-09-20T12:00:00.000Z',
        responsavelPrincipal: 'M1001',
        ...(origem ? { origem } : {}),
      });
      const proxima = await novaAcao(tratativa, '2026-10-12');
      const vencida = await novaAcao(tratativa, '2026-10-09');
      const semEvidencia = await novaAcao(tratativa, '2026-10-12', 'M2002', { evidenciaObrigatoria: 'sim' });
      tratativas.push(tratativa);
      acoesProximas.push(proxima);
      acoesVencidas.push(vencida);
      acoesComEvidenciaPendente.push(semEvidencia);
    }

    const relatorio = await executarAvaliacao();
    const alertasPorTratativa = await Promise.all(tratativas.map(alertasDa));
    for (const [indice, alertas] of alertasPorTratativa.entries()) {
      expect(tipoDestinatario(alertasDaAcao(alertas, acoesProximas[indice], 'PrazoProximo')))
        .toEqual(['M2002']);
      expect(tipoDestinatario(alertasDaAcao(alertas, acoesVencidas[indice], 'PrazoVencido')))
        .toEqual(['M1001', 'M2002']);
      expect(tipoDestinatario(alertasDaAcao(alertas, acoesComEvidenciaPendente[indice], 'EvidenciaPendente')))
        .toEqual(['M2002']);
      expect(tipoDestinatario(alertasDistintos(alertas)
        .filter((alerta) => alerta.entidade === 'Tratativa'), 'Inatividade'))
        .toEqual(['M1001']);
    }
    esperarOcorrenciasAvaliadas(relatorio);
  });
});
