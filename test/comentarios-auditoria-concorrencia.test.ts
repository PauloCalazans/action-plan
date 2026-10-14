import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { bloqueiaAntesDeEscrever, instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { criarAvulsa, sufixoUnico, mudarStatus, type Envia } from './apoio/tratativas';
import { comoGestor, comoM1001 } from './apoio/usuarios';
import { comentarTratativa, comentarAcao, listarComentariosTratativa } from './apoio/comentarios';
import { criarAcao } from './apoio/acoes';
import { emitirAval, comoValidador } from './apoio/aval';
import { encerrarComAval } from './apoio/encerramento';
import { registrarCredenciais } from './apoio/credenciais';

const { POST, GET } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;

const TRATATIVAS = 'br.com.calazanstec.Tratativas';
const HISTORICO_TRATATIVA = 'br.com.calazanstec.HistoricoTratativa';

jest.setTimeout(60000);

let espiao: Espiao;
beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});
afterEach(() => {
  espiao.naoFalhar();
});

type Linha = Record<string, unknown>;
const historicoTratativa = (codigo: string): Promise<Linha[]> =>
  linhas('HistoricoTratativa', { tratativa_codigo: codigo });
const historicoAcao = (acao: string): Promise<Linha[]> => linhas('HistoricoAcoes', { acao_codigo: acao });
const comentariosDe = (tratativa: string): Promise<Linha[]> => linhas('Comentarios', { tratativa_codigo: tratativa });

describe('Etapa 3: auditoria imutável, concorrência D9 e atividade recente derivada (R9, R10, R12, R14, R15)', () => {

  // CA45 (R9): comentário disponível para derivação de "última atividade" sem coluna física nova em Tratativas.
  test('CA45: comentário fica disponível para derivação de última atividade sem coluna nova em Tratativas', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA45-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;

    const r = await comentarTratativa(enviar, codigo, { texto: 'Atividade recente' }, comoGestor);
    expect(r.status).toBe(200);

    // A entidade Tratativas não ganhou coluna de atividade recente: a linha persistida só tem as colunas conhecidas do 002/003.
    const tratativaPersistida = (await linhas('Tratativas', { codigo })) as Linha[];
    expect(tratativaPersistida).toHaveLength(1);
    expect(Object.keys(tratativaPersistida[0]).sort()).not.toContain('ultimaAtividade');
    expect(Object.keys(tratativaPersistida[0]).sort()).not.toContain('ultimaInteracao');
    expect(Object.keys(tratativaPersistida[0]).sort()).not.toContain('ultimaAtualizacao');

    // O valor derivado (máximo entre histórico e comentários) é alcançável via consulta direta às duas tabelas.
    const comentarios = await comentariosDe(codigo);
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0].criadoEm).toBeDefined();
  });

  // CA46 (R10): comentário na Tratativa gera histórico imutável com evento InclusaoComentario, campo 'comentario', valorNovo = codigoComentario, sem o texto.
  test('CA46: comentário na Tratativa grava histórico InclusaoComentario sem o texto', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA46-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;

    const r = await comentarTratativa(enviar, codigo, { texto: 'Texto sigiloso de teste' }, comoGestor);
    expect(r.status).toBe(200);
    const codigoComentario = r.data.codigo as string;

    const historico = (await historicoTratativa(codigo)).filter((h) => h.evento === 'InclusaoComentario');
    expect(historico).toHaveLength(1);
    expect(historico[0].campo).toBe('comentario');
    expect(historico[0].valorNovo).toBe(codigoComentario);
    expect(historico[0].autor).toBe('gestor');
    expect(historico[0].quando).toBeDefined();
    // O texto do comentário nunca é copiado no histórico (LGPD).
    expect(JSON.stringify(historico[0])).not.toContain('Texto sigiloso de teste');
  });

  // CA47 (R10): comentário na Ação gera histórico em HistoricoAcoes com evento InclusaoComentario associado à Ação e à Tratativa, sem o texto.
  test('CA47: comentário na Ação grava histórico InclusaoComentario em HistoricoAcoes sem o texto', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA47-${sufixoUnico()}` });
    const codigoTratativa = t.data.codigo as string;
    const a = await criarAcao(enviar, codigoTratativa, { descricao: 'Ação CA47', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    const codigoAcao = a.data.codigo as string;

    const r = await comentarAcao(enviar, codigoTratativa, { acao: codigoAcao, texto: 'Alinhamento sigiloso' }, comoM1001);
    expect(r.status).toBe(200);
    const codigoComentario = r.data.codigo as string;

    const historico = (await historicoAcao(codigoAcao)).filter((h) => h.evento === 'InclusaoComentario');
    expect(historico).toHaveLength(1);
    expect(historico[0].campo).toBe('comentario');
    expect(historico[0].valorNovo).toBe(codigoComentario);
    expect(historico[0].tratativa_codigo).toBe(codigoTratativa);
    expect(historico[0].autor).toBe('M1001');
    expect(JSON.stringify(historico[0])).not.toContain('Alinhamento sigiloso');
  });

  // CA48: requisições de comentários recusadas não geram registros de histórico.
  test('CA48: comentário recusado (texto vazio) não grava histórico', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA48-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    const antes = (await historicoTratativa(codigo)).filter((h) => h.evento === 'InclusaoComentario').length;

    const r = await comentarTratativa(enviar, codigo, { texto: '' }, comoGestor);
    expect(r.status).toBe(400);

    const depois = (await historicoTratativa(codigo)).filter((h) => h.evento === 'InclusaoComentario').length;
    expect(depois).toBe(antes);
  });

  test('CA48: comentário recusado (Tratativa Encerrada) não grava histórico nem comentário', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA48b-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    expect((await encerrarComAval(enviar, codigo, { justificativa: 'Fechamento CA48b' })).status).toBe(204);

    const antesHistorico = (await historicoTratativa(codigo)).filter((h) => h.evento === 'InclusaoComentario').length;
    const antesComentarios = (await comentariosDe(codigo)).length;

    const r = await comentarTratativa(enviar, codigo, { texto: 'Tentativa pós-encerramento' }, comoGestor);
    expect(r.status).toBe(409);

    expect((await historicoTratativa(codigo)).filter((h) => h.evento === 'InclusaoComentario')).toHaveLength(antesHistorico);
    expect(await comentariosDe(codigo)).toHaveLength(antesComentarios);
  });

  // CA51: falha simulada de persistência dispara rollback total da transação sem gravação órfã de comentário.
  test('CA51: falha simulada ao gravar histórico causa rollback sem comentário órfão', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA51-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    const antesComentarios = (await comentariosDe(codigo)).length;
    const antesHistorico = (await historicoTratativa(codigo)).length;

    espiao.falharEm('CREATE', HISTORICO_TRATATIVA);
    const r = await comentarTratativa(enviar, codigo, { texto: 'Comentário que deve sofrer rollback' }, comoGestor);
    espiao.naoFalhar();

    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(await comentariosDe(codigo)).toHaveLength(antesComentarios);
    expect(await historicoTratativa(codigo)).toHaveLength(antesHistorico);
  });

  // CA52: duas inclusões simultâneas de comentários na mesma Tratativa são serializadas pelo lock pessimista D9, ambos persistidos com integridade.
  test('CA52: duas inclusões simultâneas na mesma Tratativa são serializadas e ambas persistem', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA52-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    espiao.limpar();

    const [r1, r2] = await Promise.all([
      comentarTratativa(enviar, codigo, { texto: 'Comentário simultâneo A' }, comoGestor),
      comentarTratativa(enviar, codigo, { texto: 'Comentário simultâneo B' }, comoGestor),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.data.codigo).not.toBe(r2.data.codigo);

    const comentarios = await comentariosDe(codigo);
    expect(comentarios).toHaveLength(2);
    expect(bloqueiaAntesDeEscrever(espiao.comandos)).toBe(true);
  });

  // CA52a: inclusão de comentário simultânea ao encerramento da Tratativa é serializada pela D9.
  test('CA52a: comentário simultâneo ao encerramento é serializado (ambos vistos ou comentário recusado com 409)', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA52a-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    expect((await mudarStatus(enviar, codigo, { status: 'Em andamento' }, comoGestor)).status).toBe(204);
    expect(
      (await emitirAval(
        enviar,
        codigo,
        { parecer: 'Aprovado', fundamentacao: 'Eficacia confirmada em campo e evidencias revisadas.' },
        comoValidador,
      )).status,
    ).toBe(204);

    const [comentario, encerramento] = await Promise.all([
      comentarTratativa(enviar, codigo, { texto: 'Comentário concorrente ao encerramento' }, comoGestor),
      mudarStatus(enviar, codigo, { status: 'Encerrada', justificativa: 'Fechamento concorrente CA52a' }, comoGestor),
    ]);

    expect(encerramento.status).toBe(204);
    const linhaFinal = (await linhas('Tratativas', { codigo }))[0];
    expect(linhaFinal.status).toBe('Encerrada');

    if (comentario.status === 200) {
      // o comentário foi processado antes do encerramento: deve estar persistido
      const comentarios = await comentariosDe(codigo);
      expect(comentarios.some((c) => c.codigo === comentario.data.codigo)).toBe(true);
    } else {
      // o encerramento ocorreu antes: o comentário é recusado com 409
      expect(comentario.status).toBe(409);
      const erro = (comentario.data as { error?: { message?: string } }).error;
      expect(erro?.message).toBe('Tratativa Encerrada não pode ser alterada.');
    }
  });

  // CA53: consultas de leitura de comentários não adquirem lock pessimista na Tratativa.
  test('CA53: listagem de comentários não adquire lock pessimista (FOR UPDATE)', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA53-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    await comentarTratativa(enviar, codigo, { texto: 'Comentário para leitura' }, comoGestor);

    espiao.limpar();
    const r = await listarComentariosTratativa(GET as unknown as (url: string, opcoes?: unknown) => Promise<{ status: number; data: unknown }>, { tratativa: codigo }, comoGestor);
    expect(r.status).toBe(200);

    const leuComForUpdate = espiao.comandos.some(
      (c) => c.entidade === TRATATIVAS && c.evento === 'READ' && c.forUpdate,
    );
    expect(leuComForUpdate).toBe(false);
  });

  // CA60: comentário com texto longo para Tratativa Encerrada recusa na etapa 7 com 409 antes de validar tamanho do texto na etapa 9.
  test('CA60: Tratativa Encerrada recusa comentário com 409 antes de validar tamanho do texto', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA60-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    expect((await encerrarComAval(enviar, codigo, { justificativa: 'Fechamento CA60' })).status).toBe(204);

    const texto2001 = 'x'.repeat(2001);
    const r = await comentarTratativa(enviar, codigo, { texto: texto2001 }, comoGestor);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Tratativa Encerrada não pode ser alterada.');
  });

  // CA63: evento InclusaoComentario formalmente catalogado nos enums de histórico (EventoHistorico e EventoHistoricoAcao).
  test('CA63: InclusaoComentario é um evento aceito tanto em HistoricoTratativa quanto em HistoricoAcoes', async () => {
    const t = await criarAvulsa(enviar, { titulo: `CA63-${sufixoUnico()}` });
    const codigo = t.data.codigo as string;
    const rTratativa = await comentarTratativa(enviar, codigo, { texto: 'Comentário de catálogo' }, comoGestor);
    expect(rTratativa.status).toBe(200);

    const a = await criarAcao(enviar, codigo, { descricao: 'Ação CA63', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    const rAcao = await comentarAcao(enviar, codigo, { acao: a.data.codigo, texto: 'Comentário de catálogo na Ação' }, comoM1001);
    expect(rAcao.status).toBe(200);

    const eventosTratativa = (await historicoTratativa(codigo)).map((h) => h.evento as string);
    expect(eventosTratativa).toContain('InclusaoComentario');

    const eventosAcao = (await historicoAcao(a.data.codigo as string)).map((h) => h.evento as string);
    expect(eventosAcao).toContain('InclusaoComentario');
  });
});
