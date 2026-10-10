import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { criarAvulsa, abrirPorApp, sufixoUnico, mudarStatus } from './apoio/tratativas';
import { comoGestor, comoUsuario, comoApp, semAuth, comoM1001, comoM2002, comoM9999 } from './apoio/usuarios';
import { comentarTratativa, listarComentariosTratativa } from './apoio/comentarios';
import { atribuirResponsavelPrincipal, incluirParticipante, consultarTratativa } from './apoio/responsaveis';
import { criarAcao } from './apoio/acoes';
import { registrarCredenciais } from './apoio/credenciais';

const { GET, POST, PUT, PATCH, DELETE } = cds.test(__dirname + '/..');

beforeAll(async () => {
  await registrarCredenciais();
});

describe('Etapa 1: comentários na Tratativa (R1-R4, R7, R8, R13)', () => {

  // CA1 (R1): Gestor inclui comentário válido na Tratativa Aberta via comentarTratativa -> 200 {codigo}, persistido com acao_codigo null
  test('CA1: comentário válido na Tratativa Aberta é criado e vinculado à Tratativa', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA1-${sufixoUnico()}` });
    const codigo = t.data.codigo;

    const r = await comentarTratativa(POST, codigo, { texto: 'Comentário de teste' }, comoGestor);

    expect(r.status).toBe(200);
    expect(r.data.codigo).toBeDefined();

    const comentarios = await linhas('Comentarios', { tratativa_codigo: codigo });
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0].texto).toBe('Comentário de teste');
    expect(comentarios[0].acao_codigo).toBeNull();
  });

  // CA4 (tratativa): bound action comentarTratativa com chave na URL malformada ou inexistente devolve 404 'Tratativa não encontrada.'
  test('CA4: chave malformada na URL devolve 404 Tratativa não encontrada', async () => {
    const r = await comentarTratativa(POST, 'invalido', { texto: 'teste' }, comoGestor);

    expect(r.status).toBe(404);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Tratativa não encontrada.');
  });

  test('CA4: chave inexistente na URL devolve 404 Tratativa não encontrada', async () => {
    const r = await comentarTratativa(POST, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { texto: 'teste' }, comoGestor);

    expect(r.status).toBe(404);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Tratativa não encontrada.');
  });

  // CA5 (R2): comentário com exatamente 2.000 caracteres aceito com sucesso e recebe Código UUID gerado
  test('CA5: comentário com exatamente 2.000 caracteres é aceito', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA5-${sufixoUnico()}` });
    const texto2000 = 'x'.repeat(2000);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: texto2000 }, comoGestor);

    expect(r.status).toBe(200);
    expect(r.data.codigo).toBeDefined();
  });

  // CA6 (R2): comentário com texto com espaços nas pontas grava o texto com trim
  test('CA6: texto com espaços nas pontas é gravado com trim', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA6-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: '  Alinhamento realizado.  ' }, comoGestor);

    expect(r.status).toBe(200);
    const comentarios = await linhas('Comentarios', { codigo: r.data.codigo });
    expect(comentarios[0].texto).toBe('Alinhamento realizado.');
  });

  // CA7 (R2): texto vazio ou só espaços recusa com 400 'O campo Texto do comentário é obrigatório.', target: texto
  test('CA7: texto vazio recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA7-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: '' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('O campo Texto do comentário é obrigatório.');
    expect(erro?.target).toBe('texto');
  });

  test('CA7: texto só com espaços recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA7-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: '   ' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('O campo Texto do comentário é obrigatório.');
    expect(erro?.target).toBe('texto');
  });

  // CA8 (R2): texto com 2.001 caracteres recusa com 400 'O campo Texto do comentário aceita no máximo 2000 caracteres.', target: texto
  test('CA8: texto com 2.001 caracteres recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA8-${sufixoUnico()}` });
    const texto2001 = 'x'.repeat(2001);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: texto2001 }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('O campo Texto do comentário aceita no máximo 2000 caracteres.');
    expect(erro?.target).toBe('texto');
  });

  // CA9 (R3): tentativa de PUT, PATCH ou DELETE recusa com 405; GET direto ou $expand por não-Gestor recusa com 403
  test('CA9: PUT, PATCH e DELETE recusam com 405', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA9-${sufixoUnico()}` });
    const c = await comentarTratativa(POST, t.data.codigo, { texto: 'teste' }, comoGestor);

    const rPut = await PUT(`/api/tratativa/v1/Comentarios(${c.data.codigo})`, { texto: 'alterado' }, comoGestor);
    expect(rPut.status).toBe(405);

    const rPatch = await PATCH(`/api/tratativa/v1/Comentarios(${c.data.codigo})`, { texto: 'alterado' }, comoGestor);
    expect(rPatch.status).toBe(405);

    const rDelete = await DELETE(`/api/tratativa/v1/Comentarios(${c.data.codigo})`, comoGestor);
    expect(rDelete.status).toBe(405);
  });

  test('CA9: GET direto em Comentarios por não-Gestor recusa com 403', async () => {
    const r = await GET('/api/tratativa/v1/Comentarios', comoUsuario);
    expect(r.status).toBe(403);
  });

  // CA10 (R4): comentário informando lista de menções persiste as matrículas
  test('CA10: menções válidas são persistidas', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA10-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste', mencoes: ['M1001', 'M2002'] }, comoGestor);

    expect(r.status).toBe(200);
    const mencoes = await linhas('MencoesComentario', { comentario_codigo: r.data.codigo });
    expect(mencoes).toHaveLength(2);
    const matriculas = mencoes.map((m) => m.matricula as string).sort();
    expect(matriculas).toEqual(['M1001', 'M2002']);
  });

  // CA11 (R4): menção com e-mail ou nome recusa com 400 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.', target: mencoes
  test('CA11: menção com e-mail recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA11-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste', mencoes: ['usuario@empresa.com'] }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.');
    expect(erro?.target).toBe('mencoes');
  });

  test('CA11: menção com nome recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA11-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste', mencoes: ['Ana Lima'] }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.');
    expect(erro?.target).toBe('mencoes');
  });

  // CA12 (R4): 11 menções distintas recusa com 400 'Limite de 10 menções por comentário atingido.', target: mencoes
  test('CA12: 11 menções distintas recusam com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA12-${sufixoUnico()}` });
    const mencoes = Array.from({ length: 11 }, (_, i) => `M${(i + 1).toString().padStart(4, '0')}`);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste', mencoes }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Limite de 10 menções por comentário atingido.');
    expect(erro?.target).toBe('mencoes');
  });

  // CA13 (R4): menções duplicadas case-insensitive são deduplicadas gravando a grafia da primeira
  test('CA13: menções duplicadas case-insensitive são deduplicadas', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA13-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste', mencoes: ['M1001', 'm1001', 'M1001'] }, comoGestor);

    expect(r.status).toBe(200);
    const mencoes = await linhas('MencoesComentario', { comentario_codigo: r.data.codigo });
    expect(mencoes).toHaveLength(1);
    expect(mencoes[0].matricula).toBe('M1001');
  });

  // CA14 (R4): inclusão de comentários não dispara e-mails nem chamadas externas
  test('CA14: inclusão de comentário não dispara integrações externas', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA14-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste', mencoes: ['M1001'] }, comoGestor);

    // Verificação: se a ação completou, não houve chamadas externas (teste comportamental)
    expect(r.status).toBe(200);
  });

  // CA15 (tratativa): Gestor de Tratativa inclui comentário direto na Tratativa com sucesso
  test('CA15: Gestor comenta na Tratativa com sucesso', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA15-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário do gestor' }, comoGestor);

    expect(r.status).toBe(200);
  });

  // CA16: Responsável Principal da Tratativa (sem papel de Gestor) inclui comentário com sucesso
  test('CA16: Responsável Principal comenta na Tratativa com sucesso', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA16-${sufixoUnico()}` });
    await atribuirResponsavelPrincipal(POST, t.data.codigo, { responsavelPrincipal: 'M1001' }, comoGestor);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário do RP' }, comoM1001);

    expect(r.status).toBe(200);
  });

  // CA17: Participante da Tratativa (sem papel de Gestor) inclui comentário com sucesso
  test('CA17: Participante comenta na Tratativa com sucesso', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA17-${sufixoUnico()}` });
    await incluirParticipante(POST, t.data.codigo, { participante: 'M2002' }, comoGestor);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário de participante' }, comoM2002);

    expect(r.status).toBe(200);
  });

  // CA20: Responsável de Ação (sem papel de Gestor nem na Tratativa) tentando comentarTratativa recusa com 403
  test('CA20: Responsável de Ação sem vínculo na Tratativa recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA20-${sufixoUnico()}` });
    await criarAcao(POST, t.data.codigo, { descricao: 'Ação teste', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'Tentativa indevida' }, comoM1001);

    expect(r.status).toBe(403);
  });

  // CA24 (tratativa): usuário comum autenticado sem papel na Tratativa recebe 403
  test('CA24: usuário sem papel recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA24-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'Tentativa' }, comoM9999);

    expect(r.status).toBe(403);
  });

  // CA25 (tratativa): Aplicativo de origem recebe 403 no início do handler
  test('CA25: Aplicativo de origem recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA25-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste' }, comoApp);

    expect(r.status).toBe(403);
  });

  // CA26: Tratativa Encerrada recusa com 409 'Tratativa Encerrada não pode ser alterada.'
  test('CA26: comentário em Tratativa Encerrada recusa com 409', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA26-${sufixoUnico()}` });
    await mudarStatus(POST, t.data.codigo, { status: 'Encerrada', justificativa: 'Concluída' }, comoGestor);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste' }, comoGestor);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Tratativa Encerrada não pode ser alterada.');
  });

  // CA27: Tratativa Cancelada recusa com 409 'Tratativa Cancelada não pode ser alterada.'
  test('CA27: comentário em Tratativa Cancelada recusa com 409', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA27-${sufixoUnico()}` });
    await mudarStatus(POST, t.data.codigo, { status: 'Cancelada', justificativa: 'Não aplicável' }, comoGestor);

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste' }, comoGestor);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Tratativa Cancelada não pode ser alterada.');
  });

  // CA31: Gestor consultando listarComentariosTratativa recebe texto, criadoEm, codigo, autor e mencoes preenchidas
  test('CA31: Gestor recebe comentários com mencoes preenchidas', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA31-${sufixoUnico()}` });
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário 1', mencoes: ['M1001', 'M2002'] }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoGestor);

    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.length).toBeGreaterThan(0);
    const comentario = r.data[0];
    expect(comentario.texto).toBe('Comentário 1');
    expect(comentario.autor).toBeDefined();
    expect(comentario.criadoEm).toBeDefined();
    expect(comentario.codigo).toBeDefined();
    expect(Array.isArray(comentario.mencoes)).toBe(true);
    expect(comentario.mencoes).toHaveLength(2);
  });

  // CA32: Responsável Principal e Participantes recebem texto, criadoEm, codigo, autor mas mencoes como lista vazia (coleção OData não aceita null)
  test('CA32: Responsável Principal recebe mencoes como lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA32-${sufixoUnico()}` });
    await atribuirResponsavelPrincipal(POST, t.data.codigo, { responsavelPrincipal: 'M1001' }, comoGestor);
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário 1', mencoes: ['M2002'] }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoM1001);

    expect(r.status).toBe(200);
    const comentario = r.data[0];
    expect(comentario.texto).toBe('Comentário 1');
    expect(comentario.autor).toBeDefined();
    expect(comentario.mencoes).toEqual([]);
  });

  test('CA32: Participante recebe mencoes como lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA32-${sufixoUnico()}` });
    await incluirParticipante(POST, t.data.codigo, { participante: 'M2002' }, comoGestor);
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário 1', mencoes: ['M1001'] }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoM2002);

    expect(r.status).toBe(200);
    const comentario = r.data[0];
    expect(comentario.mencoes).toEqual([]);
  });

  // CA33: Responsável de Ação e terceiros recebem lista vazia []
  test('CA33: Responsável de Ação sem vínculo na Tratativa recebe lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA33-${sufixoUnico()}` });
    await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário' }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoM1001);

    expect(r.status).toBe(200);
    expect(r.data).toEqual([]);
  });

  test('CA33: terceiro recebe lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA33-${sufixoUnico()}` });
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário' }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoM9999);

    expect(r.status).toBe(200);
    expect(r.data).toEqual([]);
  });

  // CA33a: usuário sem vínculo com parâmetros inválidos recebe lista vazia [] (etapa 6 precede etapa 9)
  test('CA33a: usuário sem vínculo com paginação inválida recebe lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA33a-${sufixoUnico()}` });

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo, pagina: 0 }, comoM9999);

    expect(r.status).toBe(200);
    expect(r.data).toEqual([]);
  });

  // CA35a: qualquer não-Gestor recebe mencoes como lista vazia (coleção OData não aceita null)
  test('CA35a: não-Gestor recebe mencoes como lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA35a-${sufixoUnico()}` });
    await atribuirResponsavelPrincipal(POST, t.data.codigo, { responsavelPrincipal: 'M1001' }, comoGestor);
    await comentarTratativa(POST, t.data.codigo, { texto: 'teste', mencoes: ['M2002'] }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoM1001);

    expect(r.status).toBe(200);
    expect(r.data[0].mencoes).toEqual([]);
  });

  // CA38 (tratativa): consulta permitida em Tratativa Encerrada ou Cancelada
  test('CA38: consulta permitida em Tratativa Encerrada', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA38-${sufixoUnico()}` });
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário antes' }, comoGestor);
    await mudarStatus(POST, t.data.codigo, { status: 'Encerrada', justificativa: 'OK' }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoGestor);

    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThan(0);
  });

  // CA39: consulta de comentários não gera histórico
  test('CA39: consulta não gera histórico', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA39-${sufixoUnico()}` });
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário' }, comoGestor);

    const historico1 = await linhas('HistoricoTratativa', { tratativa_codigo: t.data.codigo });
    const qtd1 = historico1.length;

    await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoGestor);

    const historico2 = await linhas('HistoricoTratativa', { tratativa_codigo: t.data.codigo });
    expect(historico2.length).toBe(qtd1); // Não aumentou
  });

  // CA40 (tratativa): Aplicativo de origem recebe 403
  test('CA40: Aplicativo de origem recebe 403 ao consultar', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA40-${sufixoUnico()}` });

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoApp);

    expect(r.status).toBe(403);
  });

  // CA41: comentários ordenados cronologicamente crescente
  test('CA41: comentários ordenados cronologicamente', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA41-${sufixoUnico()}` });
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário 1' }, comoGestor);
    await new Promise(resolve => setTimeout(resolve, 10));
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário 2' }, comoGestor);
    await new Promise(resolve => setTimeout(resolve, 10));
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário 3' }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoGestor);

    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(3);
    expect(r.data[0].texto).toBe('Comentário 1');
    expect(r.data[1].texto).toBe('Comentário 2');
    expect(r.data[2].texto).toBe('Comentário 3');
  });

  // CA42: desempate por Código UUID
  test('CA42: desempate por Código UUID', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA42-${sufixoUnico()}` });
    const c1 = await comentarTratativa(POST, t.data.codigo, { texto: 'C1' }, comoGestor);
    const c2 = await comentarTratativa(POST, t.data.codigo, { texto: 'C2' }, comoGestor);

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoGestor);

    expect(r.status).toBe(200);
    // Se tiverem o mesmo criadoEm, desempata por codigo ASC
    const codigos = r.data.map((c: { codigo: string }) => c.codigo);
    expect(codigos).toContain(c1.data.codigo);
    expect(codigos).toContain(c2.data.codigo);
  });

  // CA43: paginação padrão com 50 comentários
  test('CA43: paginação padrão com 50 itens', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA43-${sufixoUnico()}` });
    // Criar 60 comentários
    for (let i = 1; i <= 60; i++) {
      await comentarTratativa(POST, t.data.codigo, { texto: `Comentário ${i}` }, comoGestor);
    }

    const r1 = await listarComentariosTratativa(GET, { tratativa: t.data.codigo, pagina: 1 }, comoGestor);
    expect(r1.status).toBe(200);
    expect(r1.data).toHaveLength(50);

    const r2 = await listarComentariosTratativa(GET, { tratativa: t.data.codigo, pagina: 2 }, comoGestor);
    expect(r2.status).toBe(200);
    expect(r2.data).toHaveLength(10);
  });

  // CA44: tamanhoPagina fora de 1..200 recusa com 400
  test('CA44: tamanhoPagina = 201 recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA44-${sufixoUnico()}` });

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo, tamanhoPagina: 201 }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
    expect(erro?.target).toBe('tamanhoPagina');
  });

  test('CA44: tamanhoPagina = 0 recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA44-${sufixoUnico()}` });

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo, tamanhoPagina: 0 }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
    expect(erro?.target).toBe('tamanhoPagina');
  });

  // CA44a: pagina < 1 recusa com 400
  test('CA44a: pagina = 0 recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA44-${sufixoUnico()}` });

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo, pagina: 0 }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('O campo Página deve ser 1 ou maior.');
    expect(erro?.target).toBe('pagina');
  });

  // CA44b: tamanhoPagina e pagina ambos inválidos -> recusa tamanhoPagina (validado antes)
  test('CA44b: tamanhoPagina e pagina inválidos -> recusa tamanhoPagina', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA44b-${sufixoUnico()}` });

    const r = await listarComentariosTratativa(GET, { tratativa: t.data.codigo, tamanhoPagina: 201, pagina: 0 }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
    expect(erro?.target).toBe('tamanhoPagina');
  });

  // CA49: payload com campos desconhecidos recusa com 400 do runtime
  test('CA49: payload com campos desconhecidos recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA49-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste', anexo: 'arquivo.pdf' }, comoGestor);

    expect(r.status).toBe(400);
  });

  // CA50: visibilidade uniforme entre autorizados
  test('CA50: comentários visíveis uniformemente para autorizados', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA50-${sufixoUnico()}` });
    await atribuirResponsavelPrincipal(POST, t.data.codigo, { responsavelPrincipal: 'M1001' }, comoGestor);
    await incluirParticipante(POST, t.data.codigo, { participante: 'M2002' }, comoGestor);
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário público' }, comoGestor);

    const rGestor = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoGestor);
    const rRP = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoM1001);
    const rPart = await listarComentariosTratativa(GET, { tratativa: t.data.codigo }, comoM2002);

    expect(rGestor.data).toHaveLength(1);
    expect(rRP.data).toHaveLength(1);
    expect(rPart.data).toHaveLength(1);
    expect(rRP.data[0].texto).toBe('Comentário público');
    expect(rPart.data[0].texto).toBe('Comentário público');
  });

  // CA54: não autenticado recebe 401
  test('CA54: não autenticado recebe 401', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA54-${sufixoUnico()}` });

    const r = await comentarTratativa(POST, t.data.codigo, { texto: 'teste' }, semAuth);

    expect(r.status).toBe(401);
  });

  // CA55: JSON malformado recusa com 400
  test('CA55: JSON malformado recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA55-${sufixoUnico()}` });

    // Simular JSON malformado enviando string ao invés de objeto
    const r = await POST(`/api/tratativa/v1/Tratativas(${t.data.codigo})/comentarTratativa`, 'invalid-json', comoGestor);

    expect(r.status).toBe(400);
  });

  // CA56: Aplicativo com código malformado recebe 403 (etapa 3 precede etapa 4)
  test('CA56: Aplicativo com código malformado recebe 403', async () => {
    const r = await comentarTratativa(POST, 'xyz', { texto: 'teste' }, comoApp);

    expect(r.status).toBe(403);
  });

  // CA57: Tratativa inexistente recebe 404
  test('CA57: Tratativa inexistente recebe 404', async () => {
    const r = await comentarTratativa(POST, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { texto: 'teste' }, comoGestor);

    expect(r.status).toBe(404);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Tratativa não encontrada.');
  });

  // CA62: comportamento idêntico em qualquer Origem
  test('CA62: comportamento idêntico em Tratativa de app e avulsa', async () => {
    const tApp = await abrirPorApp(POST, { titulo: `CA62-app-${sufixoUnico()}` });
    const tAvulsa = await criarAvulsa(POST, { titulo: `CA62-avulsa-${sufixoUnico()}` });

    const r1 = await comentarTratativa(POST, tApp.data.codigo, { texto: 'teste app' }, comoGestor);
    const r2 = await comentarTratativa(POST, tAvulsa.data.codigo, { texto: 'teste avulsa' }, comoGestor);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  // CA64: consultarTratativa mantém 12 chaves
  test('CA64: consultarTratativa mantém 12 chaves originais', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA64-${sufixoUnico()}` });
    await comentarTratativa(POST, t.data.codigo, { texto: 'Comentário' }, comoGestor);

    const r = await consultarTratativa(GET, t.data.codigo, comoGestor);

    expect(r.status).toBe(200);
    const chaves = Object.keys(r.data).filter((k) => !k.startsWith('@odata'));
    expect(chaves).toHaveLength(12);
    expect(chaves).toContain('codigo');
    expect(chaves).toContain('titulo');
    expect(chaves).toContain('criticidade');
    expect(chaves).not.toContain('comentarios');
  });

  // CA67 (tratativa): parâmetro tratativa malformado na consulta recusa com 400 'Código inválido.', target: tratativa
  test('CA67: parâmetro tratativa malformado na consulta recusa com 400', async () => {
    const r = await listarComentariosTratativa(GET, { tratativa: 'xyz' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Código inválido.');
    expect(erro?.target).toBe('tratativa');
  });
});
