import cds from '@sap/cds';
import { linhas } from './apoio/banco';
import { criarAvulsa, sufixoUnico, mudarStatus } from './apoio/tratativas';
import { comoGestor, comoApp, comoM1001, comoM2002, comoM9999 } from './apoio/usuarios';
import { comentarAcao, listarComentariosAcao } from './apoio/comentarios';
import { atribuirResponsavelPrincipal, incluirParticipante, delegarAcao } from './apoio/responsaveis';
import { criarAcao, criarSubacao, mudarStatusAcao } from './apoio/acoes';
import { registrarCredenciais } from './apoio/credenciais';

const { GET, POST } = cds.test(__dirname + '/..');

beforeAll(async () => {
  await registrarCredenciais();
});

describe('Etapa 2: comentários em Ações e Subações (R1, R5, R6, R7, R11, R13)', () => {

  // CA2 (R1): Responsável da Ação inclui comentário na sua Ação via comentarAcao -> comentário vinculado à Ação e à Tratativa
  test('CA2: comentário na Ação é criado vinculado à Ação e à Tratativa', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA2-${sufixoUnico()}` });
    const codigoTratativa = t.data.codigo;
    const a = await criarAcao(POST, codigoTratativa, { descricao: 'Ação teste', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    const codigoAcao = a.data.codigo;

    const r = await comentarAcao(POST, codigoTratativa, { acao: codigoAcao, texto: 'Comentário na Ação' }, comoM1001);

    expect(r.status).toBe(200);
    expect(r.data.codigo).toBeDefined();

    const comentarios = await linhas('Comentarios', { codigo: r.data.codigo });
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0].acao_codigo).toBe(codigoAcao);
    expect(comentarios[0].tratativa_codigo).toBe(codigoTratativa);
  });

  // CA3 (R1): Responsável da Subação inclui comentário na sua Subação via comentarAcao -> vinculado à Subação
  test('CA3: comentário na Subação é vinculado diretamente à Subação', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA3-${sufixoUnico()}` });
    const codigoTratativa = t.data.codigo;
    const a = await criarAcao(POST, codigoTratativa, { descricao: 'Ação mãe', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    const s = await criarSubacao(POST, codigoTratativa, { acaoMae: a.data.codigo, descricao: 'Subação', responsavel: 'M2002', prazo: '2026-12-31' }, comoGestor);
    const codigoSubacao = s.data.codigo;

    const r = await comentarAcao(POST, codigoTratativa, { acao: codigoSubacao, texto: 'Comentário na Subação' }, comoM2002);

    expect(r.status).toBe(200);
    const comentarios = await linhas('Comentarios', { codigo: r.data.codigo });
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0].acao_codigo).toBe(codigoSubacao);
  });

  // CA4 (acao, R1, R13): comentarAcao sem informar o parâmetro acao (ou null/vazio) recusa na etapa 4 com 400 'Código inválido.', target: acao
  test('CA4 (acao): comentarAcao sem parâmetro acao recusa com 400 Código inválido', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA4acao-${sufixoUnico()}` });

    const r = await comentarAcao(POST, t.data.codigo, { texto: 'teste' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Código inválido.');
    expect(erro?.target).toBe('acao');
  });

  test('CA4 (acao): comentarAcao com acao null recusa com 400 Código inválido', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA4acao-${sufixoUnico()}` });

    const r = await comentarAcao(POST, t.data.codigo, { acao: null, texto: 'teste' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Código inválido.');
    expect(erro?.target).toBe('acao');
  });

  test('CA4 (acao): comentarAcao com acao vazio recusa com 400 Código inválido', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA4acao-${sufixoUnico()}` });

    const r = await comentarAcao(POST, t.data.codigo, { acao: '', texto: 'teste' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Código inválido.');
    expect(erro?.target).toBe('acao');
  });

  // CA15 (acao, R5): Gestor de Tratativa comenta em qualquer Ação da Tratativa com sucesso
  test('CA15 (acao): Gestor comenta em qualquer Ação com sucesso', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA15acao-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário do Gestor' }, comoGestor);

    expect(r.status).toBe(200);
  });

  // CA18 (R5): Responsável da Ação comenta na sua própria Ação com sucesso
  test('CA18: Responsável da Ação comenta na sua Ação com sucesso', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA18-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário do responsável' }, comoM1001);

    expect(r.status).toBe(200);
  });

  // CA19 (R5): Responsável da Subação comenta na sua Subação com sucesso
  test('CA19: Responsável da Subação comenta na sua Subação com sucesso', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA19-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação mãe', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    const s = await criarSubacao(POST, t.data.codigo, { acaoMae: a.data.codigo, descricao: 'Subação', responsavel: 'M2002', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: s.data.codigo, texto: 'Comentário da subação' }, comoM2002);

    expect(r.status).toBe(200);
  });

  // CA21 (R5): Responsável Principal da Tratativa (não Gestor nem executor da Ação) tentando comentar em Ação recusa na etapa 6 com 403
  test('CA21: Responsável Principal tentando comentar em Ação alheia recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA21-${sufixoUnico()}` });
    await atribuirResponsavelPrincipal(POST, t.data.codigo, { responsavelPrincipal: 'M1001' }, comoGestor);
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M2002', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Tentativa indevida' }, comoM1001);

    expect(r.status).toBe(403);
  });

  // CA22 (R5): Participante da Tratativa tentando comentar em Ação recusa na etapa 6 com 403
  test('CA22: Participante tentando comentar em Ação alheia recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA22-${sufixoUnico()}` });
    await incluirParticipante(POST, t.data.codigo, { participante: 'M2002' }, comoGestor);
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Tentativa indevida' }, comoM2002);

    expect(r.status).toBe(403);
  });

  // CA23 (R5): Responsável de uma Ação A1 tentando comentar na Ação A2 recusa com 403
  test('CA23: Responsável da Ação A1 tentando comentar na Ação A2 recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA23-${sufixoUnico()}` });
    await criarAcao(POST, t.data.codigo, { descricao: 'Ação A1', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    const a2 = await criarAcao(POST, t.data.codigo, { descricao: 'Ação A2', responsavel: 'M2002', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a2.data.codigo, texto: 'Tentativa indevida' }, comoM1001);

    expect(r.status).toBe(403);
  });

  // CA24 (acao, R5): usuário comum sem papel recebe 403 Forbidden para comentar em Ação
  test('CA24 (acao): usuário comum sem papel recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA24acao-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Tentativa' }, comoM9999);

    expect(r.status).toBe(403);
  });

  // CA25 (acao, R5, R13): Aplicativo de origem tentando executar comentarAcao recebe 403 na etapa 3
  test('CA25 (acao): Aplicativo de origem recebe 403', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA25acao-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'teste' }, comoApp);

    expect(r.status).toBe(403);
  });

  // CA28 (R6): Ação Concluída recusa comentário com 409 'Ação Concluída não pode ser alterada.'
  test('CA28: comentário em Ação Concluída recusa com 409', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA28-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Em andamento' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Concluída' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'teste' }, comoGestor);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Ação Concluída não pode ser alterada.');
  });

  // CA29 (R6): Ação Cancelada recusa comentário com 409 'Ação Cancelada não pode ser alterada.'
  test('CA29: comentário em Ação Cancelada recusa com 409', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA29-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Cancelada', justificativa: 'Não aplicável' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'teste' }, comoGestor);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Ação Cancelada não pode ser alterada.');
  });

  // CA30 (R6): Ação Concluída reaberta para Em andamento aceita novos comentários
  test('CA30: Ação reaberta de Concluída para Em andamento aceita novos comentários', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA30-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Em andamento' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Concluída' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Em andamento', justificativa: 'Reabertura para ajuste' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário após reabertura' }, comoM1001);

    expect(r.status).toBe(200);
  });

  // CA34 (R7): Gestor consultando listarComentariosAcao recebe os comentários com autor e mencoes preenchidas
  test('CA34: Gestor recebe comentários da Ação com autor e mencoes preenchidas', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA34-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário', mencoes: ['M2002'] }, comoGestor);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoGestor);

    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].autor).toBeDefined();
    expect(r.data[0].mencoes).toEqual(['M2002']);
  });

  // CA35 (R7): Responsável da Ação consultando listarComentariosAcao da sua própria Ação recebe autor preenchido e mencoes como [] sob LGPD
  test('CA35: Responsável da Ação recebe autor preenchido e mencoes vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA35-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário', mencoes: ['M2002'] }, comoM1001);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoM1001);

    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].autor).toBeDefined();
    expect(r.data[0].texto).toBe('Comentário');
    expect(r.data[0].mencoes).toEqual([]);
  });

  // CA36 (R7): Responsável de Subação consulta comentários de sua Subação com sucesso; consultando a Ação mãe recebe []
  test('CA36: Responsável de Subação consulta a própria Subação com sucesso', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA36-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação mãe', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    const s = await criarSubacao(POST, t.data.codigo, { acaoMae: a.data.codigo, descricao: 'Subação', responsavel: 'M2002', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: s.data.codigo, texto: 'Comentário da subação' }, comoM2002);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: s.data.codigo }, comoM2002);

    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(1);
  });

  test('CA36: Responsável de Subação consultando a Ação mãe recebe lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA36b-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação mãe', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await criarSubacao(POST, t.data.codigo, { acaoMae: a.data.codigo, descricao: 'Subação', responsavel: 'M2002', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário da Ação mãe' }, comoM1001);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoM2002);

    expect(r.status).toBe(200);
    expect(r.data).toEqual([]);
  });

  // CA37 (R7): Responsável Principal e Participantes da Tratativa consultando comentários de Ação recebem []
  test('CA37: Responsável Principal consultando comentários de Ação recebe lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA37-${sufixoUnico()}` });
    await atribuirResponsavelPrincipal(POST, t.data.codigo, { responsavelPrincipal: 'M1001' }, comoGestor);
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M2002', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário' }, comoM2002);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoM1001);

    expect(r.status).toBe(200);
    expect(r.data).toEqual([]);
  });

  test('CA37: Participante consultando comentários de Ação recebe lista vazia', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA37b-${sufixoUnico()}` });
    await incluirParticipante(POST, t.data.codigo, { participante: 'M2002' }, comoGestor);
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário' }, comoM1001);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoM2002);

    expect(r.status).toBe(200);
    expect(r.data).toEqual([]);
  });

  // CA38 (acao, R7): leitura de comentários de Ação Concluída ou Cancelada permitida livremente
  test('CA38 (acao): consulta permitida em Ação Concluída', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA38acao-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário antes' }, comoM1001);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Em andamento' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Concluída' }, comoGestor);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoGestor);

    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThan(0);
  });

  // CA40 (acao, R7): Aplicativo de origem consultando comentários de Ação recebe 403
  test('CA40 (acao): Aplicativo de origem recebe 403 ao consultar comentários de Ação', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA40acao-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoApp);

    expect(r.status).toBe(403);
  });

  // CA58 (R13): Gestor comentando informando Código de Ação inexistente recebe 404 'Ação não encontrada.'
  test('CA58: Código de Ação inexistente recebe 404', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA58-${sufixoUnico()}` });
    const acaoInexistente = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const r = await comentarAcao(POST, t.data.codigo, { acao: acaoInexistente, texto: 'teste' }, comoGestor);

    expect(r.status).toBe(404);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Ação não encontrada.');
  });

  // CA59 (R13): Gestor comentando informando Código de Ação pertencente a outra Tratativa recebe 404 'Ação não encontrada.'
  test('CA59: Código de Ação de outra Tratativa recebe 404', async () => {
    const t1 = await criarAvulsa(POST, { titulo: `CA59a-${sufixoUnico()}` });
    const t2 = await criarAvulsa(POST, { titulo: `CA59b-${sufixoUnico()}` });
    const a1 = await criarAcao(POST, t1.data.codigo, { descricao: 'Ação de t1', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);

    const r = await comentarAcao(POST, t2.data.codigo, { acao: a1.data.codigo, texto: 'teste' }, comoGestor);

    expect(r.status).toBe(404);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Ação não encontrada.');
  });

  // CA61 (R13): texto de 2.500 caracteres para Ação Concluída recebe 409 (estado etapa 8 precede campos etapa 9)
  test('CA61: texto de 2.500 caracteres para Ação Concluída recebe 409 (estado precede campos)', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA61-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Em andamento' }, comoGestor);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Concluída' }, comoGestor);
    const texto2500 = 'x'.repeat(2500);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: texto2500 }, comoM1001);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Ação Concluída não pode ser alterada.');
  });

  // CA65 (R5, R7): Delegação da Ação transfere acesso: antigo Responsável perde (403 postar, [] listar); novo Responsável assume
  test('CA65: após Delegação, antigo Responsável perde acesso para postar', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA65-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await delegarAcao(POST, t.data.codigo, { acao: a.data.codigo, novoResponsavel: 'M2002', justificativa: 'Mudança de turno' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Tentativa pós-delegação' }, comoM1001);

    expect(r.status).toBe(403);
  });

  test('CA65: após Delegação, antigo Responsável recebe lista vazia ao listar', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA65b-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Antes da delegação' }, comoM1001);
    await delegarAcao(POST, t.data.codigo, { acao: a.data.codigo, novoResponsavel: 'M2002', justificativa: 'Mudança de turno' }, comoGestor);

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoM1001);

    expect(r.status).toBe(200);
    expect(r.data).toEqual([]);
  });

  test('CA65: novo Responsável assume acesso total para postar e listar', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA65c-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Antes da delegação' }, comoM1001);
    await delegarAcao(POST, t.data.codigo, { acao: a.data.codigo, novoResponsavel: 'M2002', justificativa: 'Mudança de turno' }, comoGestor);

    const rPostar = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Depois da delegação' }, comoM2002);
    expect(rPostar.status).toBe(200);

    const rListar = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: a.data.codigo }, comoM2002);
    expect(rListar.status).toBe(200);
    expect(rListar.data).toHaveLength(2);
  });

  // CA66 (R11): Ação com evidenciaObrigatoria=true e comentários registrados recusa transição para Concluída sem evidência com 409
  test('CA66: comentários não satisfazem Evidência obrigatória na conclusão', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA66-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31', evidenciaObrigatoria: 'sim' }, comoGestor);
    const rComentario = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'Comentário não substitui evidência' }, comoM1001);
    expect(rComentario.status).toBe(200);
    await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Em andamento' }, comoGestor);

    const r = await mudarStatusAcao(POST, t.data.codigo, { acao: a.data.codigo, status: 'Concluída' }, comoGestor);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Ação com Evidência obrigatória não pode ser concluída sem Evidência.');
  });

  // CA67 (acao, R13): parâmetro acao malformado no payload de comentarAcao ou na consulta listarComentariosAcao recusa na etapa 4 com 400 'Código inválido.', target: acao
  test('CA67 (acao): parâmetro acao malformado em comentarAcao recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA67acao-${sufixoUnico()}` });

    const r = await comentarAcao(POST, t.data.codigo, { acao: 'xyz', texto: 'teste' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Código inválido.');
    expect(erro?.target).toBe('acao');
  });

  test('CA67 (acao): parâmetro acao malformado em listarComentariosAcao recusa com 400', async () => {
    const t = await criarAvulsa(POST, { titulo: `CA67acaolist-${sufixoUnico()}` });

    const r = await listarComentariosAcao(GET, { tratativa: t.data.codigo, acao: 'xyz' }, comoGestor);

    expect(r.status).toBe(400);
    const erro = (r.data as { error?: { message?: string; target?: string } }).error;
    expect(erro?.message).toBe('Código inválido.');
    expect(erro?.target).toBe('acao');
  });

  // Preparo de garantia: comentário em Ação com Tratativa Cancelada também recusa (cobertura adicional de R6, não listada como CA isolado nesta etapa)
  test('comentário em Ação de Tratativa Cancelada recusa com 409 Tratativa Cancelada', async () => {
    const t = await criarAvulsa(POST, { titulo: `TratCancelada-${sufixoUnico()}` });
    const a = await criarAcao(POST, t.data.codigo, { descricao: 'Ação', responsavel: 'M1001', prazo: '2026-12-31' }, comoGestor);
    await mudarStatus(POST, t.data.codigo, { status: 'Cancelada', justificativa: 'Não aplicável' }, comoGestor);

    const r = await comentarAcao(POST, t.data.codigo, { acao: a.data.codigo, texto: 'teste' }, comoM1001);

    expect(r.status).toBe(409);
    const erro = (r.data as { error?: { message?: string } }).error;
    expect(erro?.message).toBe('Tratativa Cancelada não pode ser alterada.');
  });
});
