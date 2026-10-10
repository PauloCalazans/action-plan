import cds from '@sap/cds';
import { anexarEvidencia, gerarPDF, type Envia as EnviaEvidencia } from './apoio/evidencias';
import { comentarTratativa } from './apoio/comentarios';
import { linhas } from './apoio/banco';
import { criarAcao } from './apoio/acoes';
import { criarAvulsa, type Envia } from './apoio/tratativas';
import { executarRotinaAlertas, type RelatorioRotinaAlertas } from './apoio/alertas';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoAdmin, comoApp, comoGestor, comoM2002, comoUsuario } from './apoio/usuarios';
import { registrarCredenciais } from './apoio/credenciais';
import {
  limparEnviosEmail,
  obterEnviosEmail,
} from './apoio/email-espiao';
import {
  limparEnviosTeams,
  obterEnviosTeams,
  falharProximoTeams,
} from './apoio/teams-espiao';
import {
  limparDiretorio,
  simularFalhaMatricula,
} from './apoio/diretorio-espiao';

const { PATCH, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const enviarEvidencia = POST as unknown as EnviaEvidencia;
const ADMIN = '/api/administracao/v1';
const PARAMETROS = `${ADMIN}/atualizarParametrosAlertas`;
const EXECUTAR_MANUAL = `${ADMIN}/executarProcessamentoAlertas`;
const PRAZO_ALTA = `${ADMIN}/PrazosCriticidade('Alta')`;
const CRIACAO = '2026-10-07T12:00:00.000Z';
const AGORA = '2026-10-10T12:00:00.000Z';
const PRAZO_PROXIMO = '2026-10-12';

jest.setTimeout(60000);

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

async function criarCenario(opcoes: {
  titulo?: string;
  descricao?: string;
  descricaoAcao?: string;
  prazo?: string;
  responsavel?: string;
} = {}): Promise<{ tratativa: string; acao: string }> {
  const abertura = await criarAvulsa(enviar, {
    titulo: opcoes.titulo ?? 'Tratativa para teste de alertas',
    descricao: opcoes.descricao ?? 'Descrição da ocorrência',
  });
  expect(abertura.status).toBe(200);
  const tratativa = abertura.data.codigo as string;
  const criacao = await criarAcao(enviar, tratativa, {
    descricao: opcoes.descricaoAcao ?? 'Ação para teste',
    responsavel: opcoes.responsavel ?? 'M2002',
    prazo: opcoes.prazo ?? PRAZO_PROXIMO,
    evidenciaObrigatoria: 'não',
  }, comoGestor);
  expect(criacao.status).toBe(200);
  return { tratativa, acao: criacao.data.codigo as string };
}

async function executar(agora: string): Promise<RelatorioRotinaAlertas> {
  const relatorio = await executarRotinaAlertas(agora);
  expect(relatorio).toMatchObject({
    ocorrenciasAvaliadas: expect.any(Number),
    alertasGerados: expect.any(Number),
  });
  return relatorio!;
}

async function executarManualmente() {
  return POST(EXECUTAR_MANUAL, {}, comoAdmin);
}

async function alertasDaTratativa(tratativa: string) {
  return linhas('AlertasEmitidos', { tratativa_codigo: tratativa });
}

async function definirPrazoCriticidadeAlta(dias: number) {
  const resposta = await PATCH(PRAZO_ALTA, { dias }, comoAdmin);
  expect(resposta.status).toBe(200);
}

beforeAll(registrarCredenciais);
beforeEach(async () => {
  fixarInstante(CRIACAO);
  limparEnviosEmail();
  limparEnviosTeams();
  limparDiretorio();
  await atualizarParametros();
  await definirPrazoCriticidadeAlta(7);
});
afterEach(liberarRelogio);

describe('despacho multicanal, LGPD e idempotência dos alertas (etapa 3)', () => {
  it('CA34: envia o alerta aos adaptadores de E-mail e Teams quando ambos estão habilitados', async () => {
    await criarCenario();

    await executar(AGORA);

    expect(obterEnviosEmail()).toHaveLength(1);
    expect(obterEnviosEmail()[0].destinatario).toBe('m2002@empresa.com');
    expect(obterEnviosTeams()).toHaveLength(1);
    expect(obterEnviosTeams()[0].destinatarioTeamsId).toBe('m2002@empresa.com');
  });

  it('CA35: não aciona Teams quando somente E-mail está habilitado', async () => {
    await atualizarParametros({ teamsHabilitado: false });
    await criarCenario();

    await executar(AGORA);

    expect(obterEnviosEmail()).toHaveLength(1);
    expect(obterEnviosTeams()).toHaveLength(0);
  });

  it('CA36: não aciona adaptadores externos quando os dois canais estão desabilitados', async () => {
    await atualizarParametros({ emailHabilitado: false, teamsHabilitado: false });
    await criarCenario();

    await executar(AGORA);

    expect(obterEnviosEmail()).toHaveLength(0);
    expect(obterEnviosTeams()).toHaveLength(0);
  });

  it('CA38: entrega a mensagem do Teams diretamente ao identificador individual do colaborador', async () => {
    await atualizarParametros({ emailHabilitado: false });
    await criarCenario({ responsavel: 'M2002' });

    await executar(AGORA);

    expect(obterEnviosTeams()).toEqual([
      expect.objectContaining({ destinatarioTeamsId: 'm2002@empresa.com' }),
    ]);
  });

  it('CA41/CA42: formata em pt-BR os dados permitidos e exclui descrições, comentários e evidências', async () => {
    const marcadores = {
      descricaoTratativa: 'DETALHE-SENSIVEL-DA-OCORRENCIA',
      descricaoAcao: 'DETALHE-PRIVADO-DA-ACAO',
      comentario: 'COMENTARIO-RESTRITO-DO-CASO',
      arquivo: 'LAUDO-MEDICO-RESTRITO.pdf',
      descricaoEvidencia: 'DADOS-DO-LAUDO-OCUPACIONAL',
    };
    const { tratativa, acao } = await criarCenario({
      titulo: 'Inspeção de equipamento',
      descricao: marcadores.descricaoTratativa,
      descricaoAcao: marcadores.descricaoAcao,
    });
    const comentario = await comentarTratativa(enviar, tratativa, {
      texto: marcadores.comentario,
      mencoes: [],
    }, comoGestor);
    expect(comentario.status).toBe(200);
    const evidencia = await anexarEvidencia(enviarEvidencia, tratativa, {
      acao,
      nomeArquivo: marcadores.arquivo,
      mimeType: 'application/pdf',
      conteudo: gerarPDF(),
      descricao: marcadores.descricaoEvidencia,
    }, comoM2002);
    expect(evidencia.status).toBe(200);

    await executar(AGORA);

    const emails = obterEnviosEmail();
    const teams = obterEnviosTeams();
    expect(emails).toHaveLength(1);
    expect(teams).toHaveLength(1);
    const mensagem = JSON.stringify([...emails, ...teams]);
    expect(mensagem).toContain('Prazo Próximo');
    expect(mensagem).toContain(tratativa);
    expect(mensagem).toContain('Inspeção de equipamento');
    expect(mensagem).toContain('12/10/2026');
    expect(mensagem).toContain(`https://plataforma.empresa.com/tratativas/${tratativa}`);
    expect(mensagem).toContain(acao);
    for (const dadoRestrito of Object.values(marcadores)) {
      expect(mensagem).not.toContain(dadoRestrito);
    }
  });

  it('CA43: execução manual pelo Administrador persiste envio bem-sucedido e instante de envio', async () => {
    const { tratativa } = await criarCenario({ prazo: '2026-10-10' });
    fixarInstante('2026-10-08T12:00:00.000Z');

    const resposta = await executarManualmente();

    expect(resposta.status).toBe(200);
    const alertas = await alertasDaTratativa(tratativa);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      tipo: 'PrazoProximo',
      destinatario: 'M2002',
      canal: 'Email',
      statusEnvio: 'Sucesso',
    });
    expect(alertas[0].enviadoEm).toBeTruthy();
  });

  it('CA44: não reenvia no mesmo dia UTC uma notificação já enviada com sucesso', async () => {
    const { tratativa } = await criarCenario({ prazo: '2026-10-10' });
    fixarInstante('2026-10-08T12:00:00.000Z');

    const primeira = await executarManualmente();
    const segunda = await executarManualmente();

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(obterEnviosEmail()).toHaveLength(1);
    expect((await alertasDaTratativa(tratativa)).filter((alerta) =>
      alerta.statusEnvio === 'Sucesso' && alerta.canal === 'Email',
    )).toHaveLength(1);
  });

  it('CA45: emite exatamente um alerta por dia civil UTC enquanto a Ação permanece vencida', async () => {
    const { tratativa } = await criarCenario({ prazo: '2026-10-07' });

    await executar('2026-10-08T23:59:00.000Z');
    await executar('2026-10-09T00:01:00.000Z');

    const alertas = await alertasDaTratativa(tratativa);
    expect(alertas.filter((alerta) => alerta.tipo === 'PrazoVencido' && alerta.canal === 'Email'))
      .toHaveLength(2);
    expect(obterEnviosEmail()).toHaveLength(2);
    expect(new Set(alertas.map((alerta) =>
      new Date(alerta.enviadoEm as string).toISOString().slice(0, 10),
    ))).toEqual(new Set(['2026-10-08', '2026-10-09']));
  });

  it.each([
    ['usuário comum', comoUsuario],
    ['Gestor de Tratativa', comoGestor],
  ])('CA46: recusa execução manual por %s com HTTP 403', async (_perfil, identidade) => {
    const resposta = await POST(EXECUTAR_MANUAL, {}, identidade);

    expect(resposta.status).toBe(403);
    expect((resposta.data as { error?: { message?: string } }).error?.message).toBe('Acesso negado.');
  });

  it('CA47: recusa o Aplicativo de origem na execução manual com HTTP 403', async () => {
    const resposta = await POST(EXECUTAR_MANUAL, {}, comoApp);

    expect(resposta.status).toBe(403);
    expect((resposta.data as { error?: { message?: string } }).error?.message).toBe('Acesso negado.');
  });

  it('CA48: grava 10 envios em AlertasEmitidos sem criar eventos no histórico da Tratativa', async () => {
    const primeira = await criarCenario();
    for (let indice = 1; indice < 5; indice += 1) {
      const criacao = await criarAcao(enviar, primeira.tratativa, {
        descricao: `Ação de teste ${indice}`,
        responsavel: 'M2002',
        prazo: PRAZO_PROXIMO,
        evidenciaObrigatoria: 'não',
      }, comoGestor);
      expect(criacao.status).toBe(200);
    }
    const historicoAntes = await linhas('HistoricoTratativa', {
      tratativa_codigo: primeira.tratativa,
    });

    await executar(AGORA);

    const alertas = await alertasDaTratativa(primeira.tratativa);
    expect(alertas).toHaveLength(10);
    expect(alertas.filter((alerta) => alerta.canal === 'Email')).toHaveLength(5);
    expect(alertas.filter((alerta) => alerta.canal === 'Teams')).toHaveLength(5);
    expect(await linhas('HistoricoTratativa', { tratativa_codigo: primeira.tratativa }))
      .toHaveLength(historicoAntes.length);
  });

  it('CA59: persiste falha isolada de Teams e processa com sucesso os demais alertas do lote', async () => {
    const cenario = await criarCenario();
    for (let indice = 1; indice < 5; indice += 1) {
      const criacao = await criarAcao(enviar, cenario.tratativa, {
        descricao: `Ação do lote ${indice}`,
        responsavel: 'M2002',
        prazo: PRAZO_PROXIMO,
        evidenciaObrigatoria: 'não',
      }, comoGestor);
      expect(criacao.status).toBe(200);
    }
    await atualizarParametros({ emailHabilitado: false, teamsHabilitado: true });
    falharProximoTeams();

    await executar(AGORA);

    const alertas = await alertasDaTratativa(cenario.tratativa);
    expect(alertas).toHaveLength(5);
    expect(alertas.filter((alerta) => alerta.statusEnvio === 'Falha')).toHaveLength(1);
    expect(alertas.filter((alerta) => alerta.statusEnvio === 'Sucesso')).toHaveLength(4);
    expect(alertas.find((alerta) => alerta.statusEnvio === 'Falha')?.motivoFalha).toBeTruthy();
    expect(obterEnviosTeams()).toHaveLength(4);
  });

  it('CA60: reexecuta manualmente e entrega com sucesso alerta que falhou no mesmo dia', async () => {
    await atualizarParametros({ emailHabilitado: false, teamsHabilitado: true });
    const { tratativa } = await criarCenario({ prazo: '2026-10-10' });
    fixarInstante('2026-10-08T12:00:00.000Z');
    falharProximoTeams();

    const primeira = await executarManualmente();
    const segunda = await executarManualmente();

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(200);
    const alertas = await alertasDaTratativa(tratativa);
    expect(alertas.filter((alerta) => alerta.statusEnvio === 'Falha')).toHaveLength(1);
    expect(alertas.filter((alerta) => alerta.statusEnvio === 'Sucesso')).toHaveLength(1);
    expect(obterEnviosTeams()).toHaveLength(1);
  });

  it('CA61: falha no canal não altera dados nem status da Tratativa e de suas Ações', async () => {
    await atualizarParametros({ emailHabilitado: false, teamsHabilitado: true });
    const { tratativa, acao } = await criarCenario();
    const tratativaAntes = await linhas('Tratativas', { codigo: tratativa });
    const acaoAntes = await linhas('Acoes', { codigo: acao });
    falharProximoTeams();

    const relatorio = await executar(AGORA);

    const alertas = await alertasDaTratativa(tratativa);
    expect(relatorio.falhas).toBeGreaterThan(0);
    expect(alertas).toContainEqual(expect.objectContaining({ statusEnvio: 'Falha' }));
    const tratativaDepois = await linhas('Tratativas', { codigo: tratativa });
    const acaoDepois = await linhas('Acoes', { codigo: acao });
    expect(tratativaDepois).toHaveLength(1);
    expect(acaoDepois).toHaveLength(1);
    expect(tratativaDepois[0]).toMatchObject({
      titulo: tratativaAntes[0].titulo,
      descricao: tratativaAntes[0].descricao,
      status: tratativaAntes[0].status,
    });
    expect(acaoDepois[0]).toMatchObject({
      descricao: acaoAntes[0].descricao,
      prazo: acaoAntes[0].prazo,
      status: acaoAntes[0].status,
    });
  });

  it('CA40: destinatário não resolvido vira Falha sem impedir outro destinatário do lote', async () => {
    await atualizarParametros({ emailHabilitado: true, teamsHabilitado: false });
    const primeiro = await criarCenario({ responsavel: 'M1001' });
    const segundo = await criarAcao(enviar, primeiro.tratativa, {
      descricao: 'Ação com matrícula não resolvida',
      responsavel: 'M9999',
      prazo: PRAZO_PROXIMO,
      evidenciaObrigatoria: 'não',
    }, comoGestor);
    expect(segundo.status).toBe(200);
    simularFalhaMatricula('M9999');

    await executar(AGORA);

    const alertas = await alertasDaTratativa(primeiro.tratativa);
    expect(alertas).toHaveLength(2);
    expect(alertas).toContainEqual(expect.objectContaining({
      destinatario: 'M9999',
      statusEnvio: 'Falha',
      motivoFalha: 'Destinatário não resolvido',
    }));
    expect(alertas).toContainEqual(expect.objectContaining({
      destinatario: 'M1001',
      statusEnvio: 'Sucesso',
    }));
  });
});
