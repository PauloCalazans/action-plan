import cds from '@sap/cds';
import { criarTemplate, desativarTemplate, listarTemplates, consultarTemplate, type Consulta } from './apoio/templates';
import { comoAdmin, comoGestor, comoUsuario, comoApp, semAuth } from './apoio/usuarios';
import { sufixoUnico, type Envia } from './apoio/tratativas';

// Etapa 2 (RED): consultas e visibilidade de templates (listarTemplates, consultarTemplate) no
// TratativaService, com ordenação, paginação e visibilidade por papel (R12, R15(c)).
// CAs: CA19a, CA19b (consulta), CA22 (consulta), CA23 (consulta), CA26, CA26a, CA26b, CA27, CA30, M3.

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;

jest.setTimeout(60000); // a primeira subida do runtime CAP pode passar de 5 s

type Erro = { error?: { message?: string; target?: string } };

const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

function item(ordem: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ordem,
    descricao: `Descrição do item ${ordem}`,
    prioridade: 'Média',
    evidenciaObrigatoria: false,
    prazoRelativoDias: 5,
    ordemPai: null,
    ...extra,
  };
}

function nomeUnico(prefixo = 'Template'): string {
  return `${prefixo} ${sufixoUnico()}`;
}

// Wrapper local (não compartilhado): cria um template válido via AdministracaoService e falha o
// teste se o preparo não der 200, evitando falso RED por preparo silencioso (CONVENCOES.md #16).
async function criarTemplateValido(nome: string, itens = [item(1)]): Promise<{ id: string }> {
  const r = await criarTemplate(enviar, { nome, descricao: 'Descrição de preparo', itens }, comoAdmin);
  if (r.status !== 200) {
    throw new Error(`preparo de template falhou: status ${r.status}, corpo ${JSON.stringify(r.data)}`);
  }
  return r.data as { id: string };
}

// Wrapper local: desativa um template já criado e falha o teste se o preparo não der 200.
async function desativarTemplateValido(id: string): Promise<void> {
  const r = await desativarTemplate(enviar, id, comoAdmin);
  if (r.status !== 200) {
    throw new Error(`preparo de desativação falhou: status ${r.status}, corpo ${JSON.stringify(r.data)}`);
  }
}

describe('Etapa 2: consultas e visibilidade de templates (R12, R15(c))', () => {
  describe('CA23 (consulta) (R15): usuário não autenticado recebe 401', () => {
    it('listarTemplates sem autenticação recusa com 401', async () => {
      const r = await listarTemplates(consultar, {}, semAuth);
      expect(r.status).toBe(401);
    });

    it('consultarTemplate sem autenticação recusa com 401', async () => {
      const r = await consultarTemplate(consultar, UUID_INEXISTENTE, semAuth);
      expect(r.status).toBe(401);
    });
  });

  describe('CA22 (consulta) (R13, R15): Aplicativo de origem recebe 403 no início do handler', () => {
    it('listarTemplates por Aplicativo de origem recusa com 403 Acesso negado.', async () => {
      const r = await listarTemplates(consultar, {}, comoApp);
      expect(r.status).toBe(403);
      expect((r.data as Erro).error?.message).toBe('Acesso negado.');
    });

    it('consultarTemplate por Aplicativo de origem recusa com 403 Acesso negado. mesmo com id malformado', async () => {
      const r = await consultarTemplate(consultar, 'invalido!', comoApp);
      expect(r.status).toBe(403);
      expect((r.data as Erro).error?.message).toBe('Acesso negado.');
    });
  });

  describe('CA19b (consulta) (R12, R15): template malformado recusa com 400 Código inválido.', () => {
    it('consultarTemplate com identificador não-UUID recusa com 400 e target template', async () => {
      const r = await consultarTemplate(consultar, 'invalido!', comoUsuario);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Código inválido.');
      expect(erro?.target).toBe('template');
    });
  });

  describe('CA19a (R12, R15): template inexistente recusa com 404 Template não encontrado.', () => {
    it('consultarTemplate com UUID inexistente recusa com 404 e target template', async () => {
      const r = await consultarTemplate(consultar, UUID_INEXISTENTE, comoUsuario);
      expect(r.status).toBe(404);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Template não encontrado.');
      expect(erro?.target).toBe('template');
    });
  });

  describe('CA27 (R12): detalhe de template ativo retorna cabeçalho e itens ordenados por ordem', () => {
    it('consultarTemplate por usuário comum devolve itens em ordem crescente de ordem', async () => {
      const nome = nomeUnico('Detalhe ordenado');
      const itens = [item(3), item(1), item(2)];
      const { id } = await criarTemplateValido(nome, itens);

      const r = await consultarTemplate(consultar, id, comoUsuario);

      expect(r.status).toBe(200);
      expect(r.data.id).toBe(id);
      expect(r.data.nome).toBe(nome);
      expect(r.data.ativo).toBe(true);
      const ordens = (r.data.itens as { ordem: number }[]).map((i) => i.ordem);
      expect(ordens).toEqual([1, 2, 3]);
    });

    it('consultarTemplate por Gestor e por Administrador também devolve com sucesso', async () => {
      const nome = nomeUnico('Detalhe multi-papel');
      const { id } = await criarTemplateValido(nome);

      const comoGestorResp = await consultarTemplate(consultar, id, comoGestor);
      const comoAdminResp = await consultarTemplate(consultar, id, comoAdmin);

      expect(comoGestorResp.status).toBe(200);
      expect(comoAdminResp.status).toBe(200);
    });
  });

  describe('CA26b (R12): template inativo consultado por usuário comum recusa com 404', () => {
    it('consultarTemplate inativo por usuário comum recusa com 404 Template não encontrado., target template', async () => {
      const nome = nomeUnico('Inativo para comum');
      const { id } = await criarTemplateValido(nome);
      await desativarTemplateValido(id);

      const r = await consultarTemplate(consultar, id, comoUsuario);

      expect(r.status).toBe(404);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Template não encontrado.');
      expect(erro?.target).toBe('template');
    });

    it('consultarTemplate inativo por Gestor e por Administrador devolve com sucesso', async () => {
      const nome = nomeUnico('Inativo para gestor/admin');
      const { id } = await criarTemplateValido(nome);
      await desativarTemplateValido(id);

      const comoGestorResp = await consultarTemplate(consultar, id, comoGestor);
      const comoAdminResp = await consultarTemplate(consultar, id, comoAdmin);

      expect(comoGestorResp.status).toBe(200);
      expect(comoGestorResp.data.ativo).toBe(false);
      expect(comoAdminResp.status).toBe(200);
      expect(comoAdminResp.data.ativo).toBe(false);
    });
  });

  describe('CA26 (R12): listagem padrão retorna só ativos, ordenados por nome', () => {
    it('listarTemplates por usuário comum devolve apenas ativos com as chaves id, nome, descricao, ativo, quantidadeItens', async () => {
      const sufixo = sufixoUnico();
      const nomeA = `AAA Listagem ${sufixo}`;
      const nomeZ = `ZZZ Listagem ${sufixo}`;
      const { id: idInativo } = await criarTemplateValido(`MMM Inativo ${sufixo}`);
      await desativarTemplateValido(idInativo);
      await criarTemplateValido(nomeZ, [item(1), item(2)]);
      await criarTemplateValido(nomeA);

      const r = (await listarTemplates(consultar, { tamanhoPagina: 200 }, comoUsuario)) as { status: number; data: unknown[] };

      expect(r.status).toBe(200);
      const nomesRetornados = (r.data as { nome: string }[]).map((t) => t.nome).filter((n) => n.includes(`Listagem ${sufixo}`) || n.includes(`Inativo ${sufixo}`));
      expect(nomesRetornados).toEqual([nomeA, nomeZ]);

      const itemZ = (r.data as { nome: string; ativo: boolean; quantidadeItens: number; id: string; descricao: string }[]).find((t) => t.nome === nomeZ);
      expect(itemZ).toBeDefined();
      expect(itemZ?.ativo).toBe(true);
      expect(itemZ?.quantidadeItens).toBe(2);
      expect(typeof itemZ?.id).toBe('string');
    });

    it('listarTemplates ordena alfabeticamente de forma ascendente mesmo com filtro ativo omitido', async () => {
      const sufixo = sufixoUnico();
      const nomes = [`C Orden ${sufixo}`, `A Orden ${sufixo}`, `B Orden ${sufixo}`];
      for (const nome of nomes) {
        await criarTemplateValido(nome);
      }

      const r = (await listarTemplates(consultar, { tamanhoPagina: 200 }, comoUsuario)) as { status: number; data: { nome: string }[] };

      expect(r.status).toBe(200);
      const encontrados = r.data.map((t) => t.nome).filter((n) => n.endsWith(`Orden ${sufixo}`));
      expect(encontrados).toEqual([`A Orden ${sufixo}`, `B Orden ${sufixo}`, `C Orden ${sufixo}`]);
    });
  });

  describe('CA26a (R12): filtro ativo=false ou todos exclusivo de Gestor/Administrador', () => {
    it('usuário comum enviando ativo=false continua recebendo apenas ativos (filtro ignorado)', async () => {
      const sufixo = sufixoUnico();
      const { id } = await criarTemplateValido(`Filtro ignorado ${sufixo}`);
      await desativarTemplateValido(id);

      const r = (await listarTemplates(consultar, { ativo: 'false', tamanhoPagina: 200 }, comoUsuario)) as { status: number; data: { id: string }[] };

      expect(r.status).toBe(200);
      const presente = r.data.some((t) => t.id === id);
      expect(presente).toBe(false);
    });

    it('Gestor de Tratativa enviando ativo=false recebe o template inativo', async () => {
      const sufixo = sufixoUnico();
      const { id } = await criarTemplateValido(`Filtro gestor false ${sufixo}`);
      await desativarTemplateValido(id);

      const r = (await listarTemplates(consultar, { ativo: 'false', tamanhoPagina: 200 }, comoGestor)) as { status: number; data: { id: string }[] };

      expect(r.status).toBe(200);
      const presente = r.data.some((t) => t.id === id);
      expect(presente).toBe(true);
    });

    it('Administrador enviando ativo=todos recebe tanto ativos quanto inativos', async () => {
      const sufixo = sufixoUnico();
      const { id: idAtivo } = await criarTemplateValido(`Filtro todos ativo ${sufixo}`);
      const { id: idInativo } = await criarTemplateValido(`Filtro todos inativo ${sufixo}`);
      await desativarTemplateValido(idInativo);

      const r = (await listarTemplates(consultar, { ativo: 'todos', tamanhoPagina: 200 }, comoAdmin)) as { status: number; data: { id: string }[] };

      expect(r.status).toBe(200);
      const ids = r.data.map((t) => t.id);
      expect(ids).toContain(idAtivo);
      expect(ids).toContain(idInativo);
    });
  });

  describe('CA30 (R12, R15): tamanhoPagina fora de 1..200 recusa com 400', () => {
    it('tamanhoPagina = 201 recusa com 400 e target tamanhoPagina', async () => {
      const r = await listarTemplates(consultar, { tamanhoPagina: 201 }, comoUsuario);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
      expect(erro?.target).toBe('tamanhoPagina');
    });

    it('tamanhoPagina = 200 é aceito', async () => {
      const r = await listarTemplates(consultar, { tamanhoPagina: 200 }, comoUsuario);
      expect(r.status).toBe(200);
    });

    it('tamanhoPagina = 0 recusa com 400 e target tamanhoPagina', async () => {
      const r = await listarTemplates(consultar, { tamanhoPagina: 0 }, comoUsuario);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
      expect(erro?.target).toBe('tamanhoPagina');
    });

    it('tamanhoPagina negativo recusa com 400 e target tamanhoPagina', async () => {
      const r = await listarTemplates(consultar, { tamanhoPagina: -1 }, comoUsuario);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Tamanho da página aceita de 1 a 200.');
      expect(erro?.target).toBe('tamanhoPagina');
    });
  });

  describe('M3 (R12, R15): pagina < 1 recusa com 400; omitida assume 1', () => {
    it('pagina = 0 recusa com 400 O campo Página deve ser 1 ou maior., target pagina', async () => {
      const r = await listarTemplates(consultar, { pagina: 0 }, comoUsuario);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Página deve ser 1 ou maior.');
      expect(erro?.target).toBe('pagina');
    });

    it('pagina negativa recusa com 400 O campo Página deve ser 1 ou maior., target pagina', async () => {
      const r = await listarTemplates(consultar, { pagina: -1 }, comoUsuario);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Página deve ser 1 ou maior.');
      expect(erro?.target).toBe('pagina');
    });

    it('pagina omitida assume o valor padrão 1 e aceita a requisição', async () => {
      const r = await listarTemplates(consultar, { tamanhoPagina: 200 }, comoUsuario);
      expect(r.status).toBe(200);
    });
  });

});
