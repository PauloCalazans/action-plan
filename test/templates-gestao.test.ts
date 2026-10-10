import cds from '@sap/cds';
import {
  criarTemplate,
  editarTemplate,
  ativarTemplate,
  desativarTemplate,
  consultarTemplateAdmin,
  listarTemplatesAdmin,
  aplicarTemplate,
  type Consulta,
} from './apoio/templates';
import { comoAdmin, comoGestor, comoUsuario, comoApp, semAuth } from './apoio/usuarios';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { linhas } from './apoio/banco';

// Etapa 1 (RED): gestão cadastral de templates no serviço de administração com regras de
// integridade e hierarquia (R1-R4, R14, R15(b)).
// CAs: CA1, CA2, CA3, CA4, CA5, CA6, CA6a, CA6b, CA7, CA8, CA8a, CA8b, CA8c, CA9, CA10, CA11, CA11a,
//      CA21, CA22 (gestão), CA23 (gestão), CA24a, CA33.

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;

jest.setTimeout(60000); // a primeira subida do runtime CAP pode passar de 5 s

type Erro = { error?: { message?: string; target?: string } };

const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

// Item mínimo válido reutilizado nos cenários que não testam o conteúdo do item em si.
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

// Wrapper local (não compartilhado): cria um template válido e falha o teste se o preparo não der 200,
// evitando falso RED por preparo silencioso (CONVENCOES.md #16).
async function criarTemplateValido(nome: string, itens = [item(1)]): Promise<{ id: string }> {
  const r = await criarTemplate(enviar, { nome, descricao: 'Descrição de preparo', itens }, comoAdmin);
  if (r.status !== 200) {
    throw new Error(`preparo de template falhou: status ${r.status}, corpo ${JSON.stringify(r.data)}`);
  }
  return r.data as { id: string };
}

describe('Etapa 1: gestão cadastral de templates (R1-R4, R14, R15(b))', () => {
  describe('CA1 (R1, R3): criação de template válido com 4 itens', () => {
    it('cria o template com Identificador UUID, ativo = true e 4 itens persistidos', async () => {
      const nome = nomeUnico('Condição válida');
      const itens = [item(1), item(2), item(3), item(4)];
      const r = await criarTemplate(enviar, { nome, descricao: 'Ações para correção de risco', itens }, comoAdmin);

      expect(r.status).toBe(200);
      expect(typeof r.data.id).toBe('string');

      const detalhe = await consultarTemplateAdmin(consultar, r.data.id as string, comoAdmin);
      expect(detalhe.status).toBe(200);
      expect(detalhe.data.ativo).toBe(true);
      expect(detalhe.data.itens).toHaveLength(4);

      const linhasItens = await linhas('ItensTemplate', { template_id: r.data.id });
      expect(linhasItens).toHaveLength(4);
    });
  });

  describe('CA2 (R1, R2): hierarquia válida de dois níveis', () => {
    it('cria template com mãe (ordem 1, ordemPai null) e duas filhas (ordem 2 e 3, ordemPai = 1)', async () => {
      const nome = nomeUnico('Hierarquia válida');
      const itens = [
        item(1, { ordemPai: null }),
        item(2, { ordemPai: 1 }),
        item(3, { ordemPai: 1 }),
      ];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);

      expect(r.status).toBe(200);
      const detalhe = await consultarTemplateAdmin(consultar, r.data.id as string, comoAdmin);
      expect(detalhe.status).toBe(200);
      const porOrdem = Object.fromEntries((detalhe.data.itens as { ordem: number; ordemPai: number | null }[]).map((i) => [i.ordem, i.ordemPai]));
      expect(porOrdem[1]).toBeNull();
      expect(porOrdem[2]).toBe(1);
      expect(porOrdem[3]).toBe(1);
    });
  });

  describe('CA3 (R2): subitem de subitem recusado', () => {
    it('ordemPai apontando para item que já é subitem recusa com 400 e target itens', async () => {
      const nome = nomeUnico('Subitem de subitem');
      const itens = [
        item(1, { ordemPai: null }),
        item(2, { ordemPai: 1 }),
        item(3, { ordemPai: 2 }), // item 2 já é subitem (ordemPai = 1); 3 não pode apontar para 2
      ];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Uma Subação não pode ter Subações.');
      expect(erro?.target).toBe('itens');
    });
  });

  describe('CA4 (R2): ordemPai inexistente ou auto-referência recusados', () => {
    it('ordemPai referenciando ordem inexistente recusa com 400 Ordem dos itens inválida., target itens', async () => {
      const nome = nomeUnico('OrdemPai inexistente');
      const itens = [item(1, { ordemPai: 99 })];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Ordem dos itens inválida.');
      expect(erro?.target).toBe('itens');
    });

    it('ordemPai == ordem (auto-referência) recusa com 400 Ordem dos itens inválida., target itens', async () => {
      const nome = nomeUnico('Auto-referência');
      const itens = [item(1, { ordemPai: 1 })];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Ordem dos itens inválida.');
      expect(erro?.target).toBe('itens');
    });
  });

  describe('CA5 (R3): nome já existente recusado com 409', () => {
    it('criar template com Nome já usado por outro template recusa com 409 e target nome', async () => {
      const nome = nomeUnico('Condição Insegura duplicada');
      await criarTemplateValido(nome);

      const r = await criarTemplate(enviar, { nome, itens: [item(1)] }, comoAdmin);

      expect(r.status).toBe(409);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Já existe um template com este nome.');
      expect(erro?.target).toBe('nome');
    });
  });

  describe('CA6 (R3): nome vazio ou só espaços recusado com 400', () => {
    it('nome vazio recusa com 400 O campo Nome do template é obrigatório., target nome', async () => {
      const r = await criarTemplate(enviar, { nome: '', itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Nome do template é obrigatório.');
      expect(erro?.target).toBe('nome');
    });

    it('nome só com espaços recusa com 400 O campo Nome do template é obrigatório., target nome', async () => {
      const r = await criarTemplate(enviar, { nome: '   ', itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Nome do template é obrigatório.');
      expect(erro?.target).toBe('nome');
    });
  });

  describe('CA6a (R1, R15): nome com 101 caracteres recusado; 100 aceito', () => {
    it('nome com 101 caracteres recusa com 400 e target nome', async () => {
      const nome = 'N'.repeat(101);
      const r = await criarTemplate(enviar, { nome, itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Nome do template aceita no máximo 100 caracteres.');
      expect(erro?.target).toBe('nome');
    });

    it('nome com exatamente 100 caracteres é aceito', async () => {
      const nome = `${nomeUnico('C')}${'x'.repeat(100)}`.slice(0, 100);
      const r = await criarTemplate(enviar, { nome, itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(200);
    });
  });

  describe('CA6b (R1, R15): descrição com 501 caracteres recusada; 500 aceita; vazia grava null', () => {
    it('descrição com 501 caracteres recusa com 400 e target descricao', async () => {
      const nome = nomeUnico('Descrição grande');
      const descricao = 'D'.repeat(501);
      const r = await criarTemplate(enviar, { nome, descricao, itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Descrição do template aceita no máximo 500 caracteres.');
      expect(erro?.target).toBe('descricao');
    });

    it('descrição com exatamente 500 caracteres é aceita', async () => {
      const nome = nomeUnico('Descrição máxima');
      const descricao = 'D'.repeat(500);
      const r = await criarTemplate(enviar, { nome, descricao, itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(200);
    });

    it('descrição vazia ou só espaços grava null', async () => {
      const nome = nomeUnico('Descrição vazia');
      const r = await criarTemplate(enviar, { nome, descricao: '   ', itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(200);
      const detalhe = await consultarTemplateAdmin(consultar, r.data.id as string, comoAdmin);
      expect(detalhe.data.descricao).toBeNull();
    });
  });

  describe('CA7 (R1): lista de itens vazia recusada com 400', () => {
    it('itens = [] recusa com 400 O template deve conter pelo menos um item., target itens', async () => {
      const nome = nomeUnico('Sem itens');
      const r = await criarTemplate(enviar, { nome, itens: [] }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O template deve conter pelo menos um item.');
      expect(erro?.target).toBe('itens');
    });
  });

  describe('CA8 (R1): mais de 30 itens recusado; 30 itens aceito', () => {
    it('31 itens recusa com 400 O template aceita no máximo 30 itens., target itens', async () => {
      const nome = nomeUnico('31 itens');
      const itens = Array.from({ length: 31 }, (_, i) => item(i + 1));
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O template aceita no máximo 30 itens.');
      expect(erro?.target).toBe('itens');
    });

    it('30 itens é aceito', async () => {
      const nome = nomeUnico('30 itens');
      const itens = Array.from({ length: 30 }, (_, i) => item(i + 1));
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(200);
    });
  });

  describe('CA8a (R1, R15): ordens duplicadas ou fora da faixa 1..30 recusadas', () => {
    it('ordens duplicadas recusam com 400 Ordem dos itens inválida., target itens', async () => {
      const nome = nomeUnico('Ordem duplicada');
      const itens = [item(1), item(1)];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Ordem dos itens inválida.');
      expect(erro?.target).toBe('itens');
    });

    it('ordem 0 (fora da faixa) recusa com 400', async () => {
      const nome = nomeUnico('Ordem zero');
      const itens = [item(0)];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Ordem dos itens inválida.');
      expect(erro?.target).toBe('itens');
    });

    it('ordem 31 (fora da faixa) recusa com 400', async () => {
      const nome = nomeUnico('Ordem 31');
      const itens = [item(31)];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Ordem dos itens inválida.');
      expect(erro?.target).toBe('itens');
    });
  });

  describe('CA8b (R1, R15): descrição de item vazia ou > 500 caracteres recusada', () => {
    it('descrição de item vazia após trim recusa com 400 e target itens', async () => {
      const nome = nomeUnico('Item sem descrição');
      const itens = [item(1, { descricao: '   ' })];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Descrição da ação aceita no máximo 500 caracteres.');
      expect(erro?.target).toBe('itens');
    });

    it('descrição de item com 501 caracteres recusa com 400 e target itens', async () => {
      const nome = nomeUnico('Item descrição grande');
      const itens = [item(1, { descricao: 'D'.repeat(501) })];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O campo Descrição da ação aceita no máximo 500 caracteres.');
      expect(erro?.target).toBe('itens');
    });
  });

  describe('CA8c (R1, R15): prioridade inválida recusada com 400', () => {
    it('prioridade fora de Baixa/Média/Alta recusa com 400 Prioridade inválida., target itens', async () => {
      const nome = nomeUnico('Prioridade inválida');
      const itens = [item(1, { prioridade: 'Urgentíssima' })];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Prioridade inválida.');
      expect(erro?.target).toBe('itens');
    });
  });

  describe('CA9 (R1): prazo relativo fora de 1..365 dias recusado', () => {
    it('prazoRelativoDias = 0 recusa com 400 e target prazoRelativoDias', async () => {
      const nome = nomeUnico('Prazo zero');
      const itens = [item(1, { prazoRelativoDias: 0 })];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O prazo relativo deve ser de 1 a 365 dias.');
      expect(erro?.target).toBe('prazoRelativoDias');
    });

    it('prazoRelativoDias = 366 recusa com 400 e target prazoRelativoDias', async () => {
      const nome = nomeUnico('Prazo 366');
      const itens = [item(1, { prazoRelativoDias: 366 })];
      const r = await criarTemplate(enviar, { nome, itens }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('O prazo relativo deve ser de 1 a 365 dias.');
      expect(erro?.target).toBe('prazoRelativoDias');
    });
  });

  describe('CA10 (R3, R8): editarTemplate atualiza para futuras aplicações sem retroagir', () => {
    it('edição substitui nome, descrição e itens sem alterar Ações já geradas', async () => {
      const nomeOriginal = nomeUnico('Template para editar');
      const { id } = await criarTemplateValido(nomeOriginal, [item(1), item(2)]);

      // Aplica o template original a uma Tratativa antes da edição (gera Ações no passado).
      const tratativa = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta' });
      expect(tratativa.status).toBe(200);
      const codigoTratativa = tratativa.data.codigo as string;
      const aplicacaoAntes = await aplicarTemplate(enviar, codigoTratativa, { template: id, responsavelPadrao: 'M1001' }, comoGestor);
      // Etapa 1 ainda não implementa a aplicação (etapa 3): registra o estado mas não bloqueia este CA
      // nela — o teste de retroatividade real nas Ações pertence à etapa 3 (test/templates-aplicacao.test.ts).
      // Aqui validamos exclusivamente a edição cadastral do template (R3b).
      void aplicacaoAntes;

      const nomeNovo = nomeUnico('Template editado');
      const itensNovos = [item(1, { descricao: 'Nova descrição única' })];
      const r = await editarTemplate(enviar, { id, nome: nomeNovo, descricao: 'Nova descrição do template', itens: itensNovos }, comoAdmin);
      expect(r.status).toBe(200);

      const detalhe = await consultarTemplateAdmin(consultar, id, comoAdmin);
      expect(detalhe.data.nome).toBe(nomeNovo);
      expect(detalhe.data.itens).toHaveLength(1);
    });

    it('colisão de nome com outro template existente recusa com 409', async () => {
      const nomeExistente = nomeUnico('Nome já usado');
      await criarTemplateValido(nomeExistente);
      const { id } = await criarTemplateValido(nomeUnico('Template a editar'));

      const r = await editarTemplate(enviar, { id, nome: nomeExistente, itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(409);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Já existe um template com este nome.');
      expect(erro?.target).toBe('nome');
    });

    it('id inexistente recusa na etapa 5 com 404 Template não encontrado., target id', async () => {
      const r = await editarTemplate(enviar, { id: UUID_INEXISTENTE, nome: nomeUnico('Qualquer'), itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(404);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Template não encontrado.');
      expect(erro?.target).toBe('id');
    });

    it('id malformado recusa na etapa 4 com 400 Código inválido., target id (M4)', async () => {
      const r = await editarTemplate(enviar, { id: 'xyz', nome: nomeUnico('Qualquer'), itens: [item(1)] }, comoAdmin);
      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Código inválido.');
      expect(erro?.target).toBe('id');
    });
  });

  describe('CA11 (R4): desativarTemplate define ativo = false; idempotente sobre já inativo', () => {
    it('desativa um template ativo com sucesso', async () => {
      const { id } = await criarTemplateValido(nomeUnico('Para desativar'));
      const r = await desativarTemplate(enviar, id, comoAdmin);
      expect(r.status).toBe(200);
      expect(r.data.ativo).toBe(false);

      const detalhe = await consultarTemplateAdmin(consultar, id, comoAdmin);
      expect(detalhe.data.ativo).toBe(false);
    });

    it('desativar um template já inativo é idempotente (200 sem alterar dados)', async () => {
      const { id } = await criarTemplateValido(nomeUnico('Já inativo'));
      const primeira = await desativarTemplate(enviar, id, comoAdmin);
      expect(primeira.status).toBe(200);

      const segunda = await desativarTemplate(enviar, id, comoAdmin);
      expect(segunda.status).toBe(200);
      expect(segunda.data.ativo).toBe(false);
    });
  });

  describe('CA11a (R4): ativarTemplate define ativo = true; idempotente sobre já ativo', () => {
    it('ativa um template inativo com sucesso', async () => {
      const { id } = await criarTemplateValido(nomeUnico('Para ativar'));
      await desativarTemplate(enviar, id, comoAdmin);

      const r = await ativarTemplate(enviar, id, comoAdmin);
      expect(r.status).toBe(200);
      expect(r.data.ativo).toBe(true);
    });

    it('ativar um template já ativo é idempotente (200)', async () => {
      const { id } = await criarTemplateValido(nomeUnico('Já ativo'));
      const r = await ativarTemplate(enviar, id, comoAdmin);
      expect(r.status).toBe(200);
      expect(r.data.ativo).toBe(true);
    });
  });

  describe('CA26a (R12): listarTemplates no AdministracaoService inclui inativos para o Administrador', () => {
    it('Administrador listando com ativo=todos recebe também os templates inativos', async () => {
      const nomeAtivo = nomeUnico('Admin lista ativo');
      const nomeInativo = nomeUnico('Admin lista inativo');
      await criarTemplateValido(nomeAtivo);
      const { id: idInativo } = await criarTemplateValido(nomeInativo);
      const desativacao = await desativarTemplate(enviar, idInativo, comoAdmin);
      if (desativacao.status !== 200) throw new Error(`preparo desativarTemplate falhou: ${desativacao.status}`);

      const r = await listarTemplatesAdmin(consultar, { ativo: 'todos' }, comoAdmin);

      expect(r.status).toBe(200);
      const nomes = (r.data as { nome: string }[]).map((t) => t.nome);
      expect(nomes).toContain(nomeAtivo);
      expect(nomes).toContain(nomeInativo);
    });
  });

  describe('CA21 (R3, R15): papel sem Administrador recusado na etapa 2 antes de forma/existência', () => {
    it('usuário comum é recusado com 403 mesmo com payload malformado', async () => {
      const r = await criarTemplate(enviar, { nome: '', itens: [] }, comoUsuario);
      expect(r.status).toBe(403);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Acesso negado.');
    });

    it('Gestor de Tratativa (sem papel Administrador) é recusado com 403 em criarTemplate', async () => {
      const r = await criarTemplate(enviar, { nome: nomeUnico('Gestor tentando'), itens: [item(1)] }, comoGestor);
      expect(r.status).toBe(403);
    });

    it('usuário comum é recusado com 403 em editarTemplate mesmo com id inexistente', async () => {
      const r = await editarTemplate(enviar, { id: UUID_INEXISTENTE, nome: 'x' }, comoUsuario);
      expect(r.status).toBe(403);
    });

    it('usuário comum é recusado com 403 em desativarTemplate mesmo com id malformado', async () => {
      const r = await desativarTemplate(enviar, 'formato-invalido!', comoUsuario);
      expect(r.status).toBe(403);
    });

    it('usuário comum é recusado com 403 em ativarTemplate mesmo com id malformado', async () => {
      const r = await ativarTemplate(enviar, 'formato-invalido!', comoUsuario);
      expect(r.status).toBe(403);
    });
  });

  describe('CA22 (gestão) (R13, R15): Aplicativo de origem recusado na etapa 2', () => {
    it('aplicativo de origem é recusado com 403 em criarTemplate', async () => {
      const r = await criarTemplate(enviar, { nome: nomeUnico('App tentando'), itens: [item(1)] }, comoApp);
      expect(r.status).toBe(403);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Acesso negado.');
    });

    it('aplicativo de origem é recusado com 403 em editarTemplate', async () => {
      const r = await editarTemplate(enviar, { id: UUID_INEXISTENTE, nome: 'x' }, comoApp);
      expect(r.status).toBe(403);
    });

    it('aplicativo de origem é recusado com 403 em ativarTemplate', async () => {
      const r = await ativarTemplate(enviar, UUID_INEXISTENTE, comoApp);
      expect(r.status).toBe(403);
    });

    it('aplicativo de origem é recusado com 403 em desativarTemplate', async () => {
      const r = await desativarTemplate(enviar, UUID_INEXISTENTE, comoApp);
      expect(r.status).toBe(403);
    });
  });

  describe('CA23 (gestão) (R15): usuário não autenticado recebe 401 na etapa 1', () => {
    it('não autenticado recebe 401 em criarTemplate', async () => {
      const r = await criarTemplate(enviar, { nome: nomeUnico('Sem auth'), itens: [item(1)] }, semAuth);
      expect(r.status).toBe(401);
    });

    it('não autenticado recebe 401 em editarTemplate', async () => {
      const r = await editarTemplate(enviar, { id: UUID_INEXISTENTE, nome: 'x' }, semAuth);
      expect(r.status).toBe(401);
    });

    it('não autenticado recebe 401 em ativarTemplate', async () => {
      const r = await ativarTemplate(enviar, UUID_INEXISTENTE, semAuth);
      expect(r.status).toBe(401);
    });

    it('não autenticado recebe 401 em desativarTemplate', async () => {
      const r = await desativarTemplate(enviar, UUID_INEXISTENTE, semAuth);
      expect(r.status).toBe(401);
    });
  });

  describe('CA24a (R3, R4, R11): operações cadastrais não geram histórico (AGENTS.md:40)', () => {
    it('criação, edição, ativação e desativação não gravam HistoricoAcoes', async () => {
      const antes = await linhas('HistoricoAcoes');
      const totalAntes = antes.length;

      const { id } = await criarTemplateValido(nomeUnico('Sem histórico'));
      await editarTemplate(enviar, { id, nome: nomeUnico('Sem histórico editado'), itens: [item(1)] }, comoAdmin);
      await desativarTemplate(enviar, id, comoAdmin);
      await ativarTemplate(enviar, id, comoAdmin);

      const depois = await linhas('HistoricoAcoes');
      expect(depois.length).toBe(totalAntes);
    });
  });

  describe('CA33 (R14): modelo de referência "Condição Insegura" cadastrado via API sem CSV', () => {
    it('cria o template Condição Insegura com os 4 itens de referência via criarTemplate', async () => {
      const nome = nomeUnico('Condição Insegura');
      const itens = [
        item(1, { descricao: 'Avaliar local', prioridade: 'Alta', evidenciaObrigatoria: false, prazoRelativoDias: 2 }),
        item(2, { descricao: 'Definir correção', prioridade: 'Média', evidenciaObrigatoria: false, prazoRelativoDias: 5 }),
        item(3, { descricao: 'Executar correção', prioridade: 'Média', evidenciaObrigatoria: true, prazoRelativoDias: 15 }),
        item(4, { descricao: 'Validar correção', prioridade: 'Média', evidenciaObrigatoria: true, prazoRelativoDias: 20 }),
      ];

      const r = await criarTemplate(enviar, { nome, descricao: 'Ações para correção de risco', itens }, comoAdmin);

      expect(r.status).toBe(200);
      expect(typeof r.data.id).toBe('string');

      const detalhe = await consultarTemplateAdmin(consultar, r.data.id as string, comoAdmin);
      expect(detalhe.data.itens).toHaveLength(4);
      const porOrdem = Object.fromEntries((detalhe.data.itens as { ordem: number; evidenciaObrigatoria: boolean; prazoRelativoDias: number }[]).map((i) => [i.ordem, i]));
      expect(porOrdem[3].evidenciaObrigatoria).toBe(true);
      expect(porOrdem[4].evidenciaObrigatoria).toBe(true);
      expect(porOrdem[1].evidenciaObrigatoria).toBe(false);
      expect(porOrdem[2].evidenciaObrigatoria).toBe(false);
      expect(porOrdem[3].prazoRelativoDias).toBe(15);
      expect(porOrdem[4].prazoRelativoDias).toBe(20);
    });
  });
});
