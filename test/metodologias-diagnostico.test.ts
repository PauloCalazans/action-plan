import cds from '@sap/cds';
import { criarAcao, mudarStatusAcao, type Consulta } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { comoValidador, consultarAval, emitirAval } from './apoio/aval';
import { encerrarComAval } from './apoio/encerramento';
import { registrarCredenciais } from './apoio/credenciais';
import { consultarHistoricoTratativa, type Consulta as ConsultaHistorico } from './apoio/historico';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, mudarStatus, type Envia } from './apoio/tratativas';
import { comoApp, comoGestor, comoM1001, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const consultarHistorico = GET as unknown as ConsultaHistorico;
const enviar = POST as unknown as Envia;
const BASE = '/api/tratativa/v1';
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

jest.setTimeout(60000);
beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

async function nova(): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Metodologia ${Date.now()}` });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function definir(
  codigo: string,
  ferramenta: string,
  dados: Record<string, unknown>,
  confirmarSubstituicao = false,
  como: unknown = comoGestor,
) {
  return POST(
    `${BASE}/Tratativas(${codigo})/definirMetodologia`,
    { ferramenta, categoriaCausaRaiz: 'Método/Processo', dados: JSON.stringify(dados), confirmarSubstituicao },
    como,
  );
}

async function consultarMetodologia(codigo: string, como: unknown = comoGestor) {
  return GET(`${BASE}/consultarMetodologiaTratativa(codigoTratativa=${codigo})`, como);
}

function erro(r: { data: unknown }): { message?: string; target?: string } {
  return (r.data as { error?: { message?: string; target?: string } }).error ?? {};
}

describe('Metodologias de causa raiz e derivação de Ações (task 004)', () => {
  it('CA1/CA2/CA4/CA5/CA45: aceita ferramentas homologadas e retorna os dados estruturados', async () => {
    const casos = [
      { ferramenta: '3W', dados: { oQue: 'Desvio na inspeção', onde: 'Linha de produção', quando: 'Turno da manhã' } },
      { ferramenta: '5 Porquês', dados: { problema: 'Peça fora de especificação', porque1: 'Ajuste incorreto', conclusao: 'A causa raiz foi o ajuste incorreto.' } },
      { ferramenta: '5W2H', dados: { oQue: 'Corrigir inspeção', porQue: 'Evitar recorrência', onde: 'Linha A', quando: 'Nesta semana', quem: 'Equipe de produção', como: 'Revisar procedimento' } },
      { ferramenta: '5W2H', dados: { oQue: 'Substituir ferramenta', porQue: 'Evitar recorrência', onde: 'Linha B', quando: 'Próxima semana', quem: 'Equipe de produção', como: 'Aplicar plano revisado', quantoCusta: 'R$ 500' } },
      { ferramenta: 'PDCA/8D', dados: { planejar: 'Analisar o problema', executar: 'Aplicar contramedida', checar: 'Verificar resultado', agir: 'Padronizar processo' } },
    ];
    for (const caso of casos) {
      const codigo = await nova();
      const resposta = await definir(codigo, caso.ferramenta, caso.dados);
      expect(resposta.status).toBe(204);
      const consulta = await consultarMetodologia(codigo);
      expect(consulta.status).toBe(200);
      expect(consulta.data.metodologia).toBe(caso.ferramenta);
      expect(consulta.data.dados).toEqual(caso.dados);
    }
  });

  it('CA3/CA35/CA36: rejeita ferramenta, campo obrigatório e valor fora do limite com target específico', async () => {
    const codigo = await nova();
    const ferramenta = await definir(codigo, 'Ishikawa', { causa: 'Não homologada' });
    expect(ferramenta.status).toBe(400);
    expect(erro(ferramenta).target).toBe('ferramenta');

    const incompleta = await definir(codigo, '5 Porquês', { problema: 'Falha encontrada', conclusao: 'Conclusão suficiente.' });
    expect(incompleta.status).toBe(400);
    expect(erro(incompleta).target).toBe('porque1');

    const curta = await definir(codigo, '3W', { oQue: 'Ab', onde: 'Setor A', quando: 'Hoje' });
    expect(curta.status).toBe(400);
    expect(erro(curta).target).toBe('oQue');

    const categoria = await POST(
      `${BASE}/Tratativas(${codigo})/definirMetodologia`,
      { ferramenta: '3W', categoriaCausaRaiz: 'Categoria não homologada', dados: JSON.stringify({ oQue: 'Desvio observado', onde: 'Setor A', quando: 'Hoje' }), confirmarSubstituicao: false },
      comoGestor,
    );
    expect(categoria.status).toBe(400);
    expect(erro(categoria).target).toBe('categoriaCausaRaiz');
  });

  it('CA7/CA8/CA9/CA10: controla substituição de ferramenta e autorização para editar', async () => {
    const codigo = await nova();
    const primeira = await definir(codigo, '3W', { oQue: 'Desvio observado', onde: 'Setor A', quando: 'Hoje' });
    expect(primeira.status).toBe(204);

    const semConfirmar = await definir(codigo, '5 Porquês', { problema: 'Falha observada', porque1: 'Causa imediata', conclusao: 'Causa raiz identificada.' });
    expect(semConfirmar.status).toBe(409);
    expect(erro(semConfirmar).message).toBe('Tratativa já possui metodologia associada: confirme a substituição para alterar.');
    const substituida = await definir(
      codigo,
      '5 Porquês',
      { problema: 'Falha observada', porque1: 'Causa imediata', conclusao: 'Causa raiz identificada.' },
      true,
    );
    expect(substituida.status).toBe(204);
    expect((await consultarMetodologia(codigo)).data.metodologia).toBe('5 Porquês');

    const responsavel = await criarAcao(
      enviar,
      codigo,
      { descricao: 'Ação de executor', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(responsavel.status).toBe(200);
    const responsavelEdita = await definir(
      codigo,
      '5 Porquês',
      { problema: 'Falha refinada', porque1: 'Causa imediata revisada', conclusao: 'Causa raiz identificada após a revisão.' },
      false,
      comoM1001,
    );
    expect(responsavelEdita.status).toBe(204);

    const semVinculo = await definir(codigo, '3W', { oQue: 'Outro desvio', onde: 'Setor A', quando: 'Hoje' }, false, comoUsuario);
    expect(semVinculo.status).toBe(403);
    const app = await definir(codigo, '3W', { oQue: 'Outro desvio', onde: 'Setor A', quando: 'Hoje' }, false, comoApp);
    expect(app.status).toBe(403);
  });

  it('CA11/CA12/CA13: bloqueia alteração em estados finais e permite editar após reabertura', async () => {
    const encerrada = await nova();
    expect((await mudarStatus(enviar, encerrada, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    expect((await definir(encerrada, '3W', { oQue: 'Desvio observado', onde: 'Setor A', quando: 'Hoje' })).status).toBe(204);
    const fechada = await encerrarComAval(enviar, encerrada);
    expect(fechada.status).toBe(204);
    const bloqueada = await definir(encerrada, '3W', { oQue: 'Desvio atualizado', onde: 'Setor A', quando: 'Hoje' });
    expect(bloqueada.status).toBe(409);
    expect(erro(bloqueada).message).toBe('Tratativa Encerrada não pode ser alterada.');

    const cancelada = await nova();
    expect((await mudarStatus(enviar, cancelada, { status: 'Cancelada', justificativa: 'Duplicidade confirmada' }, comoGestor)).status).toBe(204);
    const bloqueadaCancelada = await definir(cancelada, '3W', { oQue: 'Desvio observado', onde: 'Setor A', quando: 'Hoje' });
    expect(bloqueadaCancelada.status).toBe(409);
    expect(erro(bloqueadaCancelada).message).toBe('Tratativa Cancelada não pode ser alterada.');

    const reabertura = await mudarStatus(
      enviar,
      encerrada,
      { status: 'Em andamento', justificativa: 'Nova investigação do desvio' },
      comoGestor,
    );
    expect(reabertura.status).toBe(204);
    const editada = await definir(encerrada, '3W', { oQue: 'Desvio após reabertura', onde: 'Setor A', quando: 'Hoje' });
    expect(editada.status).toBe(204);
  });

  it('CA14/CA15/CA38/CA43: deriva Ação revisada, registra vínculo e restringe o comando ao Gestor', async () => {
    fixarInstante('2026-10-13T12:00:00Z');
    const codigo = await nova();
    const diagnostico = { problema: 'Falha recorrente', porque1: 'Inspeção incompleta', conclusao: 'A causa foi inspeção incompleta.' };
    const diagnosticoEditado = { ...diagnostico, conclusao: 'A causa foi confirmada após revisar o procedimento.' };
    expect(await linhas('Acoes', { tratativa_codigo: codigo })).toHaveLength(0);
    expect((await definir(codigo, '5 Porquês', diagnostico)).status).toBe(204);
    expect(await linhas('Acoes', { tratativa_codigo: codigo })).toHaveLength(0);
    expect((await definir(codigo, '5 Porquês', diagnosticoEditado)).status).toBe(204);

    const semMetodologia = await nova();
    expect((await mudarStatus(enviar, semMetodologia, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    const acaoSemMetodologia = await criarAcao(
      enviar,
      semMetodologia,
      { descricao: 'Ação independente do diagnóstico', responsavel: 'M1001', prazo: '2026-10-18', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(acaoSemMetodologia.status).toBe(200);
    expect((await mudarStatusAcao(
      enviar,
      semMetodologia,
      { acao: acaoSemMetodologia.data.codigo, status: 'Concluída' },
      comoGestor,
    )).status).toBe(204);
    const semDados = await POST(
      `${BASE}/Tratativas(${semMetodologia})/derivarAcaoDaMetodologia`,
      { causaIdentificador: 'porque1', descricao: 'Ação corretiva', responsavel: 'M1001', prazo: '2026-10-19', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(semDados.status).toBe(409);

    const naoGestor = await POST(
      `${BASE}/Tratativas(${codigo})/derivarAcaoDaMetodologia`,
      { causaIdentificador: 'porque1', descricao: 'Ação corretiva', responsavel: 'M1001', prazo: '2026-10-19', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoM1001,
    );
    expect(naoGestor.status).toBe(403);

    const derivada = await POST(
      `${BASE}/Tratativas(${codigo})/derivarAcaoDaMetodologia`,
      { causaIdentificador: 'porque1', descricao: 'Revisar checklist de inspeção', responsavel: 'M1001', prazo: '2026-10-18', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(derivada.status).toBe(200);
    const acaoCodigo = derivada.data.codigo as string;
    const [acao] = await linhas('Acoes', { codigo: acaoCodigo });
    expect(acao.status).toBe('Pendente');
    expect(acao.descricao).toBe('Revisar checklist de inspeção');
    expect(acao.responsavel).toBe('M1001');
    expect(String(acao.prazo).slice(0, 10)).toBe('2026-10-18');
    expect(acao.prioridade).toBe('Alta');
    expect(acao.evidenciaObrigatoria).toBe(false);
    expect(acao.causaIdentificador).toBe('porque1');
    expect(acao.causaDescricao).toBe(diagnostico.porque1);
    const causaInexistente = await POST(
      `${BASE}/Tratativas(${codigo})/derivarAcaoDaMetodologia`,
      { causaIdentificador: 'nao-existe', descricao: 'Ação sem causa', responsavel: 'M1001', prazo: '2026-10-18', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(causaInexistente.status).toBe(400);

    const eventos = await consultarHistoricoTratativa(
      consultarHistorico,
      { tratativa: codigo },
      comoGestor,
    );
    expect(eventos.status).toBe(200);
    expect(eventos.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipoEvento: 'DefinicaoMetodologia', origem: 'Tratativa', tipoAutor: 'Usuario' }),
        expect.objectContaining({ tipoEvento: 'EdicaoMetodologia', origem: 'Tratativa', tipoAutor: 'Usuario' }),
        expect.objectContaining({ tipoEvento: 'Criacao', origem: 'Acao' }),
        expect.objectContaining({ tipoEvento: 'CriacaoAcaoComCausa', origem: 'Acao' }),
      ]),
    );
    const eventosMetodologia = eventos.data.filter(
      (item: { tipoEvento: string }) => ['DefinicaoMetodologia', 'EdicaoMetodologia'].includes(item.tipoEvento),
    );
    const detalhesMetodologia = JSON.stringify(eventosMetodologia);
    expect(detalhesMetodologia).not.toContain(diagnostico.problema);
    expect(detalhesMetodologia).not.toContain(diagnostico.porque1);
    expect(detalhesMetodologia).not.toContain(diagnosticoEditado.conclusao);
    const mascaraGestor = await consultarMetodologia(codigo, comoGestor);
    expect(mascaraGestor.data.dados).toEqual(diagnosticoEditado);
    const mascaraExecutor = await consultarMetodologia(codigo, comoM1001);
    expect(mascaraExecutor.data.dados).toEqual(diagnosticoEditado);
    const mascaraUsuario = await consultarMetodologia(codigo, comoUsuario);
    expect(mascaraUsuario.data.dados).toBeNull();
  });

  it('CA45: consultas dedicadas retornam metodologia e Aval sem alterar as 12 chaves de consultarTratativa', async () => {
    const codigo = await nova();
    const dados = { oQue: 'Desvio na inspeção', onde: 'Linha A', quando: 'Turno da manhã' };
    expect((await definir(codigo, '3W', dados)).status).toBe(204);
    expect((await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    expect((await emitirAval(
      enviar,
      codigo,
      { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' },
      comoValidador,
    )).status).toBe(204);

    const metodologia = await consultarMetodologia(codigo);
    expect(metodologia.status).toBe(200);
    expect(metodologia.data.metodologia).toBe('3W');
    expect(metodologia.data.categoriaCausaRaiz).toBe('Método/Processo');
    expect(metodologia.data.dados).toEqual(dados);
    const aval = await consultarAval(consultar, codigo, comoValidador);
    expect(aval.status).toBe(200);
    expect(aval.data.vigente.parecer).toBe('Aprovado');
    expect(aval.data.historico).toEqual(
      expect.arrayContaining([expect.objectContaining({ parecer: 'Aprovado', vigente: true })]),
    );

    const consultaTratativa = await GET(`${BASE}/consultarTratativa(codigo=${codigo})`, comoGestor);
    expect(consultaTratativa.status).toBe(200);
    expect(Object.keys(consultaTratativa.data).filter((key) => !key.startsWith('@odata'))).toHaveLength(12);
  });

  it('R18/DC-12: validação da chave ligada precede existência e a consulta retorna erro tipado', async () => {
    const chave = await POST(
      "/api/tratativa/v1/Tratativas('xyz')/definirMetodologia",
      { ferramenta: '3W', categoriaCausaRaiz: '', dados: JSON.stringify({ oQue: 'Desvio encontrado', onde: 'Setor A', quando: 'Hoje' }), confirmarSubstituicao: false },
      comoGestor,
    );
    expect(chave.status).toBe(400);
    expect(erro(chave).message).toBe('Código inválido.');
    expect(erro(chave).target).toBe('codigo');

    const chaveDerivacao = await POST(
      "/api/tratativa/v1/Tratativas('xyz')/derivarAcaoDaMetodologia",
      { causaIdentificador: 'porque1', descricao: 'Ação corretiva', responsavel: 'M1001', prazo: '2026-11-01', prioridade: 'Alta', evidenciaObrigatoria: 'não' },
      comoGestor,
    );
    expect(chaveDerivacao.status).toBe(400);
    expect(erro(chaveDerivacao).message).toBe('Código inválido.');
    expect(erro(chaveDerivacao).target).toBe('codigo');

    const consultaMalformada = await GET(`${BASE}/consultarMetodologiaTratativa(codigoTratativa=xyz)`, comoGestor);
    expect(consultaMalformada.status).toBe(400);
    expect(erro(consultaMalformada).target).toBe('codigoTratativa');

    const inexistente = await GET(`${BASE}/consultarMetodologiaTratativa(codigoTratativa=${UUID_INEXISTENTE})`, comoGestor);
    expect(inexistente.status).toBe(404);
  });
});
