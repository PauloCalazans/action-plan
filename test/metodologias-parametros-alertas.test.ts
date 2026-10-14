import cds from '@sap/cds';
import { criarAcao } from './apoio/acoes';
import { executarRotinaAlertas, type RelatorioRotinaAlertas } from './apoio/alertas';
import { anexarEvidencia, baixarEvidencia, gerarPDF, type Consulta as ConsultaEvidencias } from './apoio/evidencias';
import { comoValidador, comoValidadorB, consultarAval, emitirAval } from './apoio/aval';
import { linhas } from './apoio/banco';
import { registrarCredenciais } from './apoio/credenciais';
import { atribuirResponsavelPrincipal } from './apoio/responsaveis';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { abrirPorApp, criarAvulsa, mudarStatus, type Envia, type Resposta } from './apoio/tratativas';
import { comoAdmin, comoGestor, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as (url: string, identidade?: unknown) => Promise<Resposta>;
const consultarEvidencias = GET as unknown as ConsultaEvidencias;
const enviar = POST as unknown as Envia;

const ADMIN = '/api/administracao/v1';
const AGORA = '2026-10-10T12:00:00.000Z';
const PARECER_APROVADO = { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' };

jest.setTimeout(90000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

type Alerta = Record<string, unknown>;

async function parametrosAlertas(extra: Record<string, unknown> = {}) {
  const resposta = await enviar(`${ADMIN}/atualizarParametrosAlertas`, {
    diasAntecedenciaPrazoProximo: 3,
    diasInatividade: 15,
    emailHabilitado: true,
    teamsHabilitado: true,
    horaExecucaoUtc: 8,
    ...extra,
  }, comoAdmin);
  expect(resposta.status).toBe(200);
}

async function atualizarOrigem(dados: Record<string, unknown>, como: unknown = comoAdmin) {
  return enviar(`${ADMIN}/atualizarParametrosOrigem`, dados, como);
}

async function incluirValidador(origem: string, matricula: string, como: unknown = comoAdmin) {
  return enviar(`${ADMIN}/incluirValidadorOrigem`, { origem, matricula }, como);
}

async function removerValidador(origem: string, matricula: string, como: unknown = comoAdmin) {
  return enviar(`${ADMIN}/removerValidadorOrigem`, { origem, matricula }, como);
}

async function configurarOrigem(
  origem: string,
  prazoVerificacaoEficaciaDias: number,
  validadores: string[] = [],
  extra: Record<string, unknown> = {},
) {
  const atualizacao = await atualizarOrigem({
    origem,
    metodologiaSugerida: '',
    validadorPadrao: 'Validador Técnico',
    prazoVerificacaoEficaciaDias,
    ...extra,
  });
  expect(atualizacao.status).toBe(200);
  for (const matricula of validadores) {
    const inclusao = await incluirValidador(origem, matricula);
    expect(inclusao.status).toBe(200);
  }
}

async function novaTratativa(origem?: string): Promise<string> {
  const resposta = origem ? await abrirPorApp(enviar, { origem }) : await criarAvulsa(enviar, { titulo: `Origem ${Date.now()}` });
  expect(resposta.status).toBe(200);
  return resposta.data.codigo as string;
}

async function iniciar(codigo: string, quando = AGORA): Promise<void> {
  fixarInstante(quando);
  const resposta = await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor);
  expect(resposta.status).toBe(204);
}

async function atribuirPrincipal(codigo: string, matricula: string): Promise<void> {
  const resposta = await atribuirResponsavelPrincipal(
    enviar,
    codigo,
    { responsavelPrincipal: matricula, justificativa: 'Responsável do teste' },
    comoGestor,
  );
  expect(resposta.status).toBe(204);
}

async function alertasVerificacao(tratativa: string): Promise<Alerta[]> {
  return (await linhas('AlertasEmitidos', { tratativa_codigo: tratativa }))
    .filter((alerta) => alerta.entidade === 'VerificacaoEficacia');
}

function destinatarios(alertas: Alerta[], tipo?: string): string[] {
  const distintos = new Map<string, string>();
  for (const alerta of alertas) {
    if (tipo && alerta.tipo !== tipo) continue;
    distintos.set(`${alerta.tipo}|${alerta.destinatario}`, String(alerta.destinatario));
  }
  return [...new Set(distintos.values())].sort();
}

function diasComEnvio(alertas: Alerta[], tipo: string, destinatario: string): number {
  const dias = new Set(
    alertas
      .filter((alerta) => alerta.tipo === tipo && alerta.destinatario === destinatario)
      .map((alerta) => String(alerta.enviadoEm).slice(0, 10)),
  );
  return dias.size;
}

function erro(resposta: Resposta): { message?: string; target?: string } {
  return (resposta.data as { error?: { message?: string; target?: string } })?.error ?? {};
}

function itens(dados: unknown): Record<string, unknown>[] {
  const corpo = dados as { value?: Record<string, unknown>[] };
  return Array.isArray(corpo?.value) ? corpo.value : [];
}

async function rodarRotina(agora: string): Promise<RelatorioRotinaAlertas> {
  const relatorio = await executarRotinaAlertas(agora);
  expect(relatorio).toMatchObject({ ocorrenciasAvaliadas: expect.any(Number) });
  return relatorio!;
}

describe('Parametrização por Origem e alertas de eficácia (task 005)', () => {
  it('CA27: Administrador mantém a parametrização da Origem e os demais papéis são recusados', async () => {
    const salvar = await atualizarOrigem({
      origem: 'Qualidade',
      metodologiaSugerida: 'PDCA/8D',
      validadorPadrao: 'Inspetor da Qualidade',
      prazoVerificacaoEficaciaDias: 45,
    });
    expect(salvar.status).toBe(200);

    const consulta = await consultar(`${ADMIN}/ParametrosOrigem`, comoAdmin);
    expect(consulta.status).toBe(200);
    const qualidade = itens(consulta.data).find((linha) => linha.origem === 'Qualidade');
    expect(qualidade).toMatchObject({
      origem: 'Qualidade',
      metodologiaSugerida: 'PDCA/8D',
      validadorPadrao: 'Inspetor da Qualidade',
      prazoVerificacaoEficaciaDias: 45,
    });

    for (const como of [comoGestor, comoUsuario]) {
      const leitura = await consultar(`${ADMIN}/ParametrosOrigem`, como);
      expect(leitura.status).toBe(403);
      expect(erro(leitura).message).toBe('Acesso negado.');
      const escrita = await atualizarOrigem(
        { origem: 'Qualidade', validadorPadrao: 'X', prazoVerificacaoEficaciaDias: 30 },
        como,
      );
      expect(escrita.status).toBe(403);
      expect(erro(escrita).message).toBe('Acesso negado.');
    }

    for (const prazo of [0, 181]) {
      const invalido = await atualizarOrigem({
        origem: 'Qualidade',
        validadorPadrao: 'Inspetor da Qualidade',
        prazoVerificacaoEficaciaDias: prazo,
      });
      expect(invalido.status).toBe(400);
      expect(erro(invalido).target).toBe('prazoVerificacaoEficaciaDias');
    }
  });

  it('CA17 (R7 c/e): a lista da Origem habilita somente o Validador nela', async () => {
    await configurarOrigem('Qualidade', 30, ['validador']);
    const codigo = await novaTratativa('Qualidade');
    await iniciar(codigo);

    const outro = await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidadorB);
    expect(outro.status).toBe(403);
    expect(erro(outro).message).toBe('Acesso negado.');

    const gestor = await emitirAval(enviar, codigo, PARECER_APROVADO, comoGestor);
    expect(gestor.status).toBe(403);
    expect(erro(gestor).message).toBe('Acesso negado.');

    const habilitado = await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidador);
    expect(habilitado.status).toBe(204);

    const criada = await criarAcao(
      enviar,
      codigo,
      { descricao: 'Ação com evidência', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(criada.status).toBe(200);
    const acao = criada.data.codigo as string;
    const anexo = await anexarEvidencia(
      enviar,
      codigo,
      { acao, nomeArquivo: 'comprovante.pdf', mimeType: 'application/pdf', conteudo: gerarPDF(), descricao: 'Comprovante' },
      comoGestor,
    );
    expect(anexo.status).toBe(200);
    const evidencia = anexo.data.codigo as string;

    const baixarOutro = await baixarEvidencia(consultarEvidencias, codigo, acao, evidencia, comoValidadorB);
    expect(baixarOutro.status).toBe(403);
    const baixarHabilitado = await baixarEvidencia(consultarEvidencias, codigo, acao, evidencia, comoValidador);
    expect(baixarHabilitado.status).toBe(200);
  });

  it('lista padrão corporativa (*): habilita Origem sem lista própria e Tratativa avulsa; remover volta ao caso sem lista', async () => {
    await incluirValidador('*', 'validador-b');

    const avulsa = await novaTratativa();
    await iniciar(avulsa);
    expect((await emitirAval(enviar, avulsa, PARECER_APROVADO, comoValidadorB)).status).toBe(204);
    const avulsaOutro = await novaTratativa();
    await iniciar(avulsaOutro);
    expect((await emitirAval(enviar, avulsaOutro, PARECER_APROVADO, comoValidador)).status).toBe(403);

    const semListaPropria = await novaTratativa('Advertência');
    await iniciar(semListaPropria);
    expect((await emitirAval(enviar, semListaPropria, PARECER_APROVADO, comoValidadorB)).status).toBe(204);

    // validadorPadrao é rótulo descritivo: alterá-lo não muda quem emite (R-08).
    await atualizarOrigem({ origem: 'Advertência', validadorPadrao: 'Outro rótulo', prazoVerificacaoEficaciaDias: 30 });
    const aposRotulo = await novaTratativa('Advertência');
    await iniciar(aposRotulo);
    expect((await emitirAval(enviar, aposRotulo, PARECER_APROVADO, comoValidadorB)).status).toBe(204);
    const outroAposRotulo = await novaTratativa('Advertência');
    await iniciar(outroAposRotulo);
    expect((await emitirAval(enviar, outroAposRotulo, PARECER_APROVADO, comoValidador)).status).toBe(403);

    const remocao = await removerValidador('*', 'validador-b');
    expect(remocao.status).toBe(200);

    // Sem nenhuma lista, qualquer ValidadorTecnico emite (R7 c).
    const semLista = await novaTratativa('Advertência');
    await iniciar(semLista);
    expect((await emitirAval(enviar, semLista, PARECER_APROVADO, comoValidador)).status).toBe(204);
  });

  it('DC-17: habilitação em lote — a fundamentação só chega ao Validador habilitado de cada Origem', async () => {
    await configurarOrigem('Auditoria A', 30, ['validador']);
    await configurarOrigem('Auditoria B', 30, ['validador-b']);

    const primeira = await novaTratativa('Auditoria A');
    await iniciar(primeira);
    expect((await emitirAval(enviar, primeira, PARECER_APROVADO, comoValidador)).status).toBe(204);

    const segunda = await novaTratativa('Auditoria B');
    await iniciar(segunda);
    expect((await emitirAval(enviar, segunda, PARECER_APROVADO, comoValidadorB)).status).toBe(204);

    const primeiraComoHabilitado = await consultarAval(consultar, primeira, comoValidador);
    expect(primeiraComoHabilitado.status).toBe(200);
    expect(primeiraComoHabilitado.data.vigente.fundamentacao).toBe(PARECER_APROVADO.fundamentacao);
    const primeiraComoOutro = await consultarAval(consultar, primeira, comoValidadorB);
    expect(primeiraComoOutro.data.vigente.fundamentacao).toBeNull();

    const segundaComoHabilitado = await consultarAval(consultar, segunda, comoValidadorB);
    expect(segundaComoHabilitado.status).toBe(200);
    expect(segundaComoHabilitado.data.vigente.fundamentacao).toBe(PARECER_APROVADO.fundamentacao);
    const segundaComoOutro = await consultarAval(consultar, segunda, comoValidador);
    expect(segundaComoOutro.data.vigente.fundamentacao).toBeNull();
  });

  it('prazo da Origem: 45 dias mudam a dataLimiteVerificacao de consultarAvalTecnicoTratativa', async () => {
    await configurarOrigem('Qualidade', 45);
    const codigo = await novaTratativa('Qualidade');
    await iniciar(codigo, '2026-10-13T12:00:00.000Z');

    const consulta = await consultarAval(consultar, codigo, comoValidador);
    expect(consulta.status).toBe(200);
    expect(consulta.data.dataBaseVerificacao).toBe('2026-10-13');
    expect(consulta.data.dataLimiteVerificacao).toBe('2026-11-27');
  });

  it('CA26: verificação vencendo em 2 dias gera PrazoProximo ao Validador da lista (e não ao Responsável Principal)', async () => {
    await parametrosAlertas();
    await incluirValidador('*', 'validador');
    const codigo = await novaTratativa();
    await atribuirPrincipal(codigo, 'M1001');
    await iniciar(codigo, '2026-09-12T12:00:00.000Z');

    await rodarRotina(AGORA);
    const alertas = await alertasVerificacao(codigo);
    expect(destinatarios(alertas, 'PrazoProximo')).toEqual(['validador']);
    expect(destinatarios(alertas, 'PrazoVencido')).toEqual([]);

    await removerValidador('*', 'validador');
  });

  it('CA37: verificação vencida gera PrazoVencido ao Validador e ao Responsável Principal, com reenvio diário', async () => {
    await parametrosAlertas();
    await incluirValidador('*', 'validador');
    const codigo = await novaTratativa();
    await atribuirPrincipal(codigo, 'M1001');
    await iniciar(codigo, '2026-09-01T12:00:00.000Z');

    await rodarRotina(AGORA);
    const primeiroDia = await alertasVerificacao(codigo);
    expect(destinatarios(primeiroDia, 'PrazoVencido')).toEqual(['M1001', 'validador']);

    // Rodar de novo no mesmo dia não duplica.
    await rodarRotina(AGORA);
    const mesmoDia = await alertasVerificacao(codigo);
    expect(diasComEnvio(mesmoDia, 'PrazoVencido', 'validador')).toBe(1);
    expect(diasComEnvio(mesmoDia, 'PrazoVencido', 'M1001')).toBe(1);

    // Dia seguinte: reenvio diário.
    await rodarRotina('2026-10-11T12:00:00.000Z');
    const segundoDia = await alertasVerificacao(codigo);
    expect(diasComEnvio(segundoDia, 'PrazoVencido', 'validador')).toBe(2);
    expect(diasComEnvio(segundoDia, 'PrazoVencido', 'M1001')).toBe(2);

    // Sem encerramento automático.
    expect((await linhas('Tratativas', { codigo }))[0].status).toBe('Em andamento');

    await removerValidador('*', 'validador');
  });

  it('DV-05 (R-08): sem nenhuma lista os alertas vão só ao Responsável Principal, com reenvio diário e sem duplicar no dia', async () => {
    await parametrosAlertas();
    await removerValidador('*', 'validador');
    await removerValidador('*', 'validador-b');

    const vencida = await novaTratativa('Advertência');
    await atribuirPrincipal(vencida, 'M1001');
    await iniciar(vencida, '2026-09-01T12:00:00.000Z');

    await rodarRotina(AGORA);
    expect(destinatarios(await alertasVerificacao(vencida), 'PrazoVencido')).toEqual(['M1001']);

    await rodarRotina(AGORA);
    expect(diasComEnvio(await alertasVerificacao(vencida), 'PrazoVencido', 'M1001')).toBe(1);

    await rodarRotina('2026-10-11T12:00:00.000Z');
    expect(diasComEnvio(await alertasVerificacao(vencida), 'PrazoVencido', 'M1001')).toBe(2);
    expect((await linhas('Tratativas', { codigo: vencida }))[0].status).toBe('Em andamento');

    const proxima = await novaTratativa('Advertência');
    await atribuirPrincipal(proxima, 'M1001');
    await iniciar(proxima, '2026-09-12T12:00:00.000Z');
    await rodarRotina(AGORA);
    const alertasProxima = await alertasVerificacao(proxima);
    expect(destinatarios(alertasProxima, 'PrazoProximo')).toEqual(['M1001']);
    expect(destinatarios(alertasProxima, 'PrazoVencido')).toEqual([]);

    // Sem lista e sem Responsável Principal, nenhum alerta de verificação.
    const semPrincipal = await novaTratativa('Advertência');
    await iniciar(semPrincipal, '2026-09-01T12:00:00.000Z');
    await rodarRotina(AGORA);
    expect(await alertasVerificacao(semPrincipal)).toHaveLength(0);
  });

  it('não gera alerta de verificação com Aval aprovado vigente, Ação aberta ou exigência pós-reprovação pendente', async () => {
    await parametrosAlertas();
    await removerValidador('*', 'validador');

    const comAval = await novaTratativa('Advertência');
    await atribuirPrincipal(comAval, 'M1001');
    await iniciar(comAval, '2026-09-01T12:00:00.000Z');
    expect((await emitirAval(enviar, comAval, PARECER_APROVADO, comoValidador)).status).toBe(204);

    const comAcaoAberta = await novaTratativa('Advertência');
    await atribuirPrincipal(comAcaoAberta, 'M1001');
    await iniciar(comAcaoAberta, '2026-09-01T12:00:00.000Z');
    const acao = await criarAcao(
      enviar,
      comAcaoAberta,
      { descricao: 'Ação em andamento', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(acao.status).toBe(200);

    const reprovada = await novaTratativa('Advertência');
    await atribuirPrincipal(reprovada, 'M1001');
    await iniciar(reprovada, '2026-09-01T12:00:00.000Z');
    expect((await emitirAval(
      enviar,
      reprovada,
      { parecer: 'Reprovado', fundamentacao: 'A causa persiste após a verificação e exige nova ação corretiva.' },
      comoValidador,
    )).status).toBe(204);

    await rodarRotina(AGORA);
    for (const codigo of [comAval, comAcaoAberta, reprovada]) {
      expect(await alertasVerificacao(codigo)).toHaveLength(0);
    }
  });
});
