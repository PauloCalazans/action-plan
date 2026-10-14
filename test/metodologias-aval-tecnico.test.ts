import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao, type Consulta } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { comoValidador, consultarAval, emitirAval } from './apoio/aval';
import { registrarCredenciais } from './apoio/credenciais';
import { anexarEvidencia, baixarEvidencia, gerarPDF, listarEvidenciasAcao, listarEvidenciasTratativa, type Consulta as ConsultaEvidencias } from './apoio/evidencias';
import { consultarHistoricoTratativa, type Consulta as ConsultaHistorico } from './apoio/historico';
import { incluirParticipante } from './apoio/responsaveis';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM1001, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST, PATCH, DELETE } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const consultarEvidencias = GET as unknown as ConsultaEvidencias;
const consultarHistorico = GET as unknown as ConsultaHistorico;
const enviar = POST as unknown as Envia;
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PARECER_APROVADO = { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' };

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

async function nova(): Promise<string> {
  const criada = await criarAvulsa(enviar, { titulo: `Aval ${Date.now()}` });
  expect(criada.status).toBe(200);
  return criada.data.codigo as string;
}

async function iniciar(codigo: string): Promise<void> {
  const r = await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor);
  expect(r.status).toBe(204);
}

async function acaoConcluida(codigo: string): Promise<string> {
  const criada = await criarAcao(
    enviar,
    codigo,
    {
      descricao: 'Ação corretiva verificada',
      responsavel: 'M1001',
      prazo: '2026-11-01',
      prioridade: 'Alta',
      evidenciaObrigatoria: 'não',
    },
    comoGestor,
  );
  expect(criada.status).toBe(200);
  const acao = criada.data.codigo as string;
  const concluida = await mudarStatusAcao(enviar, codigo, { acao, status: 'Concluída' }, comoGestor);
  expect(concluida.status).toBe(204);
  return acao;
}

function erro(r: { data: unknown }): { message?: string; target?: string } {
  return (r.data as { error?: { message?: string; target?: string } }).error ?? {};
}

describe('Aval Técnico — emissão e consulta pelo TratativaService (task 002)', () => {
  it('CA16/R9c: Validador emite Aval em Tratativa Em andamento sem Ações', async () => {
    const codigo = await nova();
    await iniciar(codigo);

    const r = await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidador);

    expect(r.status).toBe(204);
    const [registro] = await linhas('AvalesTecnicos', { tratativa_codigo: codigo });
    expect(registro.parecer).toBe('Aprovado');
    expect(registro.validador).toBe('validador');
    expect(registro.vigente).toBe(true);
  });

  it('CA20: não emite Aval enquanto existir Ação em andamento', async () => {
    const codigo = await nova();
    await iniciar(codigo);
    const criada = await criarAcao(
      enviar,
      codigo,
      { descricao: 'Ação pendente de validação', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(criada.status).toBe(200);
    const acao = criada.data.codigo as string;
    const andamento = await mudarStatusAcao(enviar, codigo, { acao, status: 'Em andamento' }, comoGestor);
    expect(andamento.status).toBe(204);

    const r = await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidador);

    expect(r.status).toBe(409);
    expect(erro(r).message).toBe('Aval Técnico não pode ser emitido: há Ações não concluídas nem canceladas.');
  });

  it('CA17/CA42: exige habilitação de Validador e Tratativa Em andamento para emitir', async () => {
    const aberta = await nova();
    const gestor = await emitirAval(enviar, aberta, PARECER_APROVADO, comoGestor);
    expect(gestor.status).toBe(403);
    expect(erro(gestor).message).toBe('Acesso negado.');
    const abertaValidador = await emitirAval(enviar, aberta, PARECER_APROVADO, comoValidador);
    expect(abertaValidador.status).toBe(409);
    expect(erro(abertaValidador).message).toBe('Aval Técnico exige que a Tratativa esteja em status Em andamento.');

    const encerrada = await nova();
    await iniciar(encerrada);
    const primeiraEmissao = await emitirAval(enviar, encerrada, PARECER_APROVADO, comoValidador);
    expect(primeiraEmissao.status).toBe(204);
    expect((await mudarStatus(enviar, encerrada, { status: 'Encerrada' }, comoGestor)).status).toBe(204);
    const depoisDeEncerrar = await emitirAval(enviar, encerrada, PARECER_APROVADO, comoValidador);
    expect(depoisDeEncerrar.status).toBe(409);
    expect(erro(depoisDeEncerrar).message).toBe('Tratativa Encerrada não pode ser alterada.');

    const cancelada = await nova();
    expect((await mudarStatus(enviar, cancelada, { status: 'Cancelada', justificativa: 'Duplicidade confirmada' }, comoGestor)).status).toBe(204);
    expect((await emitirAval(enviar, cancelada, PARECER_APROVADO, comoValidador)).status).toBe(409);
  });

  it('CA21/CA22: valida tamanho da fundamentação e o catálogo de pareceres', async () => {
    const codigo = await nova();
    await iniciar(codigo);

    const fundamentacao = await emitirAval(
      enviar,
      codigo,
      { parecer: 'Aprovado', fundamentacao: 'Aprovado ok' },
      comoValidador,
    );
    expect(fundamentacao.status).toBe(400);
    expect(erro(fundamentacao).target).toBe('fundamentacao');

    const parecer = await emitirAval(
      enviar,
      codigo,
      { parecer: 'Em Análise', fundamentacao: PARECER_APROVADO.fundamentacao },
      comoValidador,
    );
    expect(parecer.status).toBe(400);
    expect(erro(parecer).target).toBe('parecer');
  });

  it('R7/CA34: aplica precedência de autenticação, origem e validação da chave', async () => {
    const codigo = await nova();
    await iniciar(codigo);

    const naoAutenticada = await POST(
      `/api/tratativa/v1/Tratativas(${codigo})/emitirAvalTecnico`,
      PARECER_APROVADO,
      semAuth,
    );
    expect(naoAutenticada.status).toBe(401);
    const app = await emitirAval(enviar, codigo, PARECER_APROVADO, comoApp);
    expect(app.status).toBe(403);

    const tipoInvalido = await emitirAval(
      enviar,
      codigo,
      { parecer: 42, fundamentacao: PARECER_APROVADO.fundamentacao },
      comoValidador,
    );
    expect(tipoInvalido.status).toBe(400);

    const chave = await POST(
      "/api/tratativa/v1/Tratativas('xyz')/emitirAvalTecnico",
      PARECER_APROVADO,
      comoValidador,
    );
    expect(chave.status).toBe(400);
    expect(erro(chave).message).toBe('Código inválido.');
    expect(erro(chave).target).toBe('codigo');

    const inexistente = await emitirAval(enviar, UUID_INEXISTENTE, PARECER_APROVADO, comoValidador);
    expect(inexistente.status).toBe(404);
    const avalComConsultaMalformada = await GET(
      '/api/tratativa/v1/consultarAvalTecnicoTratativa(codigoTratativa=xyz)',
      comoValidador,
    );
    expect(avalComConsultaMalformada.status).toBe(400);
    expect(erro(avalComConsultaMalformada).target).toBe('codigoTratativa');
  });

  it('CA23/CA24: reprovação permanece auditada e exige nova Ação corretiva concluída para nova emissão', async () => {
    const codigo = await nova();
    await iniciar(codigo);
    const acao = await acaoConcluida(codigo);
    const reprovar = await emitirAval(
      enviar,
      codigo,
      { parecer: 'Reprovado', fundamentacao: 'A causa persiste após a verificação e exige nova ação corretiva.' },
      comoValidador,
    );
    expect(reprovar.status).toBe(204);
    expect((await linhas('Tratativas', { codigo }))[0].status).toBe('Em andamento');

    const historico = await consultarHistoricoTratativa(
      consultarHistorico,
      { tratativa: codigo, tipoEvento: 'EmissaoAvalTecnico' },
      comoGestor,
    );
    expect(historico.status).toBe(200);
    expect(historico.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoEvento: 'EmissaoAvalTecnico',
          origem: 'Tratativa',
          autor: 'validador',
          detalhe: expect.objectContaining({
            valorNovo: 'Reprovado',
            fundamentacao: 'A causa persiste após a verificação e exige nova ação corretiva.',
          }),
        }),
      ]),
    );

    const repetir = await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidador);
    expect(repetir.status).toBe(409);
    expect(erro(repetir).message).toBe(
      'Aval Técnico não pode ser emitido: exige nova Ação corretiva concluída ou cancelada criada após a última reprovação.',
    );

    const novaAcao = await acaoConcluida(codigo);
    expect(novaAcao).not.toBe(acao);
    const segundaEmissao = await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidador);
    expect(segundaEmissao.status).toBe(204);
    expect((await linhas('AvalesTecnicos', { tratativa_codigo: codigo })).filter((item) => item.vigente)).toHaveLength(1);
  });

  it('CA25/CA39: calcula prazo de verificação a partir da última conclusão ou da entrada em andamento', async () => {
    fixarInstante('2026-10-13T12:00:00Z');
    const comAcao = await nova();
    await iniciar(comAcao);
    const acao = await acaoConcluida(comAcao);
    const prazoAcao = await consultarAval(consultar, comAcao, comoValidador);
    expect(prazoAcao.status).toBe(200);
    expect(prazoAcao.data.dataBaseVerificacao).toBe('2026-10-13');
    expect(prazoAcao.data.dataLimiteVerificacao).toBe('2026-11-12');
    expect((await linhas('Acoes', { codigo: acao }))[0].status).toBe('Concluída');

    fixarInstante('2026-10-13T12:00:00Z');
    const semAcoes = await nova();
    await iniciar(semAcoes);
    const prazoSemAcao = await consultarAval(consultar, semAcoes, comoValidador);
    expect(prazoSemAcao.status).toBe(200);
    expect(prazoSemAcao.data.dataLimiteVerificacao).toBe('2026-11-12');
  });

  it('CA28/CA29/CA41/CA45: consulta o histórico e mascara fundamentação para usuário sem vínculo', async () => {
    const codigo = await nova();
    await iniciar(codigo);
    await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidador);

    const comoGestorConsulta = await consultarAval(consultar, codigo, comoGestor);
    expect(comoGestorConsulta.status).toBe(200);
    expect(comoGestorConsulta.data.vigente).toBeDefined();
    expect(comoGestorConsulta.data.historico).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parecer: 'Aprovado',
          fundamentacao: PARECER_APROVADO.fundamentacao,
          vigente: true,
        }),
      ]),
    );
    await incluirParticipante(enviar, codigo, { participante: 'M1001' }, comoGestor);
    const historicoParticipante = await consultarHistoricoTratativa(
      consultarHistorico,
      { tratativa: codigo, tipoEvento: 'EmissaoAvalTecnico' },
      comoM1001,
    );
    expect(historicoParticipante.status).toBe(200);
    expect(historicoParticipante.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoEvento: 'EmissaoAvalTecnico',
          detalhe: expect.objectContaining({ fundamentacao: null }),
        }),
      ]),
    );
    const comoUsuarioConsulta = await consultarAval(consultar, codigo, comoUsuario);
    expect(comoUsuarioConsulta.status).toBe(200);
    expect(comoUsuarioConsulta.data.historico[0].fundamentacao).toBeNull();
    expect(comoUsuarioConsulta.data.historico[0].validador).toBeNull();

    const [evento] = (await linhas('HistoricoTratativa', { tratativa_codigo: codigo })).filter(
      (item) => item.evento === 'EmissaoAvalTecnico',
    );
    const antes = { ...evento };
    const patchHistorico = await PATCH(
      `/api/tratativa/v1/HistoricoTratativa(${evento.ID})`,
      { valorNovo: 'Reprovado' },
      comoGestor,
    );
    expect([404, 405]).toContain(patchHistorico.status);
    const deleteHistorico = await DELETE(`/api/tratativa/v1/HistoricoTratativa(${evento.ID})`, comoGestor);
    expect([404, 405]).toContain(deleteHistorico.status);
    expect(await linhas('HistoricoTratativa', { ID: evento.ID })).toEqual([antes]);
  });

  it('DC-17: consulta avaliações de várias Tratativas sem expor fundamentação a usuário sem vínculo', async () => {
    const codigos = [await nova(), await nova()];
    for (const codigo of codigos) {
      await iniciar(codigo);
      expect((await emitirAval(enviar, codigo, PARECER_APROVADO, comoValidador)).status).toBe(204);
    }

    for (const codigo of codigos) {
      const validador = await consultarAval(consultar, codigo, comoValidador);
      expect(validador.status).toBe(200);
      expect(validador.data.vigente.fundamentacao).toBe(PARECER_APROVADO.fundamentacao);
      const usuario = await consultarAval(consultar, codigo, comoUsuario);
      expect(usuario.status).toBe(200);
      expect(usuario.data.vigente.fundamentacao).toBeNull();
    }
  });

  it('CA44: Validador consulta e baixa evidência de Ação concluída, com autor mascarado e auditoria', async () => {
    const codigo = await nova();
    await iniciar(codigo);
    const criada = await criarAcao(
      enviar,
      codigo,
      { descricao: 'Ação com evidência de eficácia', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(criada.status).toBe(200);
    const acao = criada.data.codigo as string;
    const anexada = await anexarEvidencia(
      enviar,
      codigo,
      { acao, nomeArquivo: 'comprovante.pdf', mimeType: 'application/pdf', conteudo: gerarPDF(), descricao: 'Evidência de eficácia' },
      comoGestor,
    );
    expect(anexada.status).toBe(200);
    const evidencia = anexada.data.codigo as string;
    const concluida = await mudarStatusAcao(enviar, codigo, { acao, status: 'Concluída' }, comoGestor);
    expect(concluida.status).toBe(204);

    const lista = await listarEvidenciasTratativa(consultarEvidencias, codigo, comoValidador);
    expect(lista.status).toBe(200);
    expect(lista.data.value).toEqual(
      expect.arrayContaining([expect.objectContaining({ codigo: evidencia, autorAnexo: null })]),
    );
    const listaDaAcao = await listarEvidenciasAcao(consultarEvidencias, codigo, acao, comoValidador);
    expect(listaDaAcao.status).toBe(200);
    expect(listaDaAcao.data.value).toEqual(
      expect.arrayContaining([expect.objectContaining({ codigo: evidencia, autorAnexo: null })]),
    );
    const download = await baixarEvidencia(consultarEvidencias, codigo, acao, evidencia, comoValidador);
    expect(download.status).toBe(200);
    expect(download.data.conteudo).toBeTruthy();
    expect((await linhas('HistoricoAcoes', { tratativa_codigo: codigo })).some(
      (item) => item.evento === 'DownloadEvidencia' && item.autor === 'validador' && item.evidencia === evidencia,
    )).toBe(true);

    const listaComum = await listarEvidenciasTratativa(consultarEvidencias, codigo, comoUsuario);
    expect(listaComum.status).toBe(200);
    expect(listaComum.data.value).toEqual([]);
    const listaDaAcaoComum = await listarEvidenciasAcao(consultarEvidencias, codigo, acao, comoUsuario);
    expect(listaDaAcaoComum.status).toBe(200);
    expect(listaDaAcaoComum.data.value).toEqual([]);
    const downloadComum = await baixarEvidencia(consultarEvidencias, codigo, acao, evidencia, comoUsuario);
    expect(downloadComum.status).toBe(403);
  });
});
