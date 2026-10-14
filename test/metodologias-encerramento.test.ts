import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao, type Consulta } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { comoValidador, emitirAval, consultarAval } from './apoio/aval';
import { semearTratativaEncerradaLegada } from './apoio/legado';
import { registrarCredenciais } from './apoio/credenciais';
import { criarAvulsa, mudarStatus, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const enviar = POST as unknown as Envia;
const SEM_AVAL = 'Tratativa não pode ser encerrada: exige Aval Técnico aprovado.';
const EXIGE_NOVO_AVAL = 'Tratativa não pode ser encerrada: exige novo Aval Técnico aprovado emitido após a reabertura.';
const FUNDAMENTACAO = 'Eficacia confirmada por testes em campo e evidencias revisadas.';

jest.setTimeout(60000);
beforeAll(registrarCredenciais);

async function nova(): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Encerramento ${Date.now()}` });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function aprovar(codigo: string): Promise<void> {
  const r = await emitirAval(
    enviar,
    codigo,
    { parecer: 'Aprovado', fundamentacao: FUNDAMENTACAO },
    comoValidador,
  );
  expect(r.status).toBe(204);
}

async function concluirAcao(codigo: string): Promise<void> {
  const criada = await criarAcao(
    enviar,
    codigo,
    { descricao: 'Ação concluída para encerrar', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Média', evidenciaObrigatoria: 'não' },
    comoGestor,
  );
  expect(criada.status).toBe(200);
  const encerrada = await mudarStatusAcao(
    enviar,
    codigo,
    { acao: criada.data.codigo, status: 'Concluída' },
    comoGestor,
  );
  expect(encerrada.status).toBe(204);
}

function erro(r: { data: unknown }): { message?: string; target?: string } {
  return (r.data as { error?: { message?: string; target?: string } }).error ?? {};
}

describe('Encerramento condicionado ao Aval Técnico (task 003)', () => {
  it('CA18: recusa sem Aval aprovado, preservando Em andamento', async () => {
    const codigo = await nova();
    const inicio = await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor);
    expect(inicio.status).toBe(204);

    const r = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);

    expect(r.status).toBe(409);
    expect(erro(r).message).toBe(SEM_AVAL);
    expect((await linhas('Tratativas', { codigo }))[0].status).toBe('Em andamento');
  });

  it('CA19/CA6: Aval aprovado e vigente habilita encerramento em etapa independente, mesmo sem metodologia', async () => {
    const codigo = await nova();
    const inicio = await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor);
    expect(inicio.status).toBe(204);
    await aprovar(codigo);

    const encerramento = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);

    expect(encerramento.status).toBe(204);
    expect((await linhas('Tratativas', { codigo }))[0].status).toBe('Encerrada');
  });

  it('CA6: fluxo sem metodologia permite criar, concluir Ação, emitir Aval e encerrar', async () => {
    const codigo = await nova();
    const inicio = await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor);
    expect(inicio.status).toBe(204);
    await concluirAcao(codigo);
    await aprovar(codigo);

    const encerramento = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);

    expect(encerramento.status).toBe(204);
    expect((await linhas('Tratativas', { codigo }))[0].status).toBe('Encerrada');
  });

  it('CA23: Aval reprovado bloqueia encerramento sem alterar o status', async () => {
    const codigo = await nova();
    expect((await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    const reprovacao = await emitirAval(
      enviar,
      codigo,
      { parecer: 'Reprovado', fundamentacao: 'A causa ainda persiste e requer nova ação corretiva.' },
      comoValidador,
    );
    expect(reprovacao.status).toBe(204);

    const encerramento = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);

    expect(encerramento.status).toBe(409);
    expect(erro(encerramento).message).toBe(SEM_AVAL);
    expect((await linhas('Tratativas', { codigo }))[0].status).toBe('Em andamento');
  });

  it('CA33: reabertura revoga Aval aprovado; a mensagem muda e uma nova aprovação restaura o encerramento', async () => {
    const codigo = await nova();
    expect((await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    await aprovar(codigo);
    expect((await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor)).status).toBe(204);
    expect(
      (await mudarStatus(
        enviar,
        codigo,
        { status: 'Em andamento', justificativa: 'Nova verificação necessária' },
        comoGestor,
      )).status,
    ).toBe(204);

    const semAvalNovo = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);
    expect(semAvalNovo.status).toBe(409);
    expect(erro(semAvalNovo).message).toBe(EXIGE_NOVO_AVAL);

    await aprovar(codigo);
    const comAvalNovo = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);
    expect(comAvalNovo.status).toBe(204);
  });

  it('CA32/DC-09: Tratativa legada permanece encerrada e sua consulta de Aval não inventa vigência', async () => {
    const codigo = await semearTratativaEncerradaLegada();

    expect((await linhas('Tratativas', { codigo }))[0].status).toBe('Encerrada');
    const consultaTratativa = await GET(`/api/tratativa/v1/consultarTratativa(codigo=${codigo})`, comoGestor);
    expect(consultaTratativa.status).toBe(200);
    expect(consultaTratativa.data.status).toBe('Encerrada');
    const aval = await consultarAval(consultar, codigo, comoGestor);
    expect(aval.status).toBe(200);
    expect(aval.data.vigente).toBeNull();
  });

  it('CA42: não encerra diretamente de Aberta pelo serviço ou pela action do App', async () => {
    const codigo = await nova();

    const servico = await mudarStatus(enviar, codigo, { status: 'Encerrada' }, comoGestor);
    expect(servico.status).toBe(409);
    expect(erro(servico).message).toBe(
      'Tratativa em status Aberta não pode ser encerrada diretamente: deve transitar para Em andamento e receber Aval Técnico aprovado.',
    );

    const app = await POST(`/api/app/v1/Tratativas(${codigo})/encerrarTratativa`, {}, comoGestor);
    expect(app.status).toBe(409);
    expect(erro(app).message).toBe(
      'Tratativa em status Aberta não pode ser encerrada diretamente: deve transitar para Em andamento e receber Aval Técnico aprovado.',
    );
  });

  it('R20/CA18/CA19: flags do App refletem status e existência de Aval aprovado vigente', async () => {
    const codigo = await nova();
    const lerFlags = () =>
      GET(
        `/api/app/v1/Tratativas(${codigo})?$select=podeEncerrar,ocultaEncerrar`,
        comoGestor,
      );

    const aberta = await lerFlags();
    expect(aberta.status).toBe(200);
    expect(aberta.data.podeEncerrar).toBe(false);
    expect(aberta.data.ocultaEncerrar).toBe(true);

    expect((await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    const semAval = await lerFlags();
    expect(semAval.data.podeEncerrar).toBe(false);
    expect(semAval.data.ocultaEncerrar).toBe(true);

    await aprovar(codigo);
    const aprovado = await lerFlags();
    expect(aprovado.data.podeEncerrar).toBe(true);
    expect(aprovado.data.ocultaEncerrar).toBe(false);
  });
});
