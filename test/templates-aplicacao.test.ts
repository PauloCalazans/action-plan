import cds from '@sap/cds';
import { criarTemplate, editarTemplate, aplicarTemplate, type Consulta } from './apoio/templates';
import { comoAdmin, comoGestor, comoUsuario, comoApp, comoM1001, semAuth } from './apoio/usuarios';
import { criarAvulsa, abrirPorApp, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { consultarEstruturaAcoes, mudarStatusAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { registrarCredenciais } from './apoio/credenciais';

// Etapa 3 (RED): aplicação atômica de template a Tratativa com serialização D9, cálculo de
// prazos e auditoria (R5-R11, R13, R15(a), R16).
// CAs: CA10 (não retroatividade sobre Ações já geradas), CA12, CA13, CA14, CA14a, CA15, CA16,
//      CA16a, CA16b, CA17, CA18, CA19, CA19b (aplicação), CA20, CA21a, CA22 (aplicação),
//      CA23 (aplicação), CA24, CA25, CA25a, CA28, CA29, CA31, CA32.

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;

jest.setTimeout(60000);

let espiao: Espiao;
beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});

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

// Wrapper local (não compartilhado): cria um template válido e falha o teste se o preparo não der 200
// (CONVENCOES.md #16; evita falso RED por preparo silencioso).
async function criarTemplateValido(nome: string, itens: Record<string, unknown>[] = [item(1)]): Promise<{ id: string }> {
  const r = await criarTemplate(enviar, { nome, descricao: 'Descrição de preparo', itens }, comoAdmin);
  if (r.status !== 200) {
    throw new Error(`preparo de template falhou: status ${r.status}, corpo ${JSON.stringify(r.data)}`);
  }
  return r.data as { id: string };
}

// Wrapper local: cria o template de referência "Condição Insegura" (4 itens, R14/CA33).
async function criarTemplateCondicaoInsegura(nome: string = nomeUnico('Condição Insegura')): Promise<{ id: string }> {
  const itens = [
    item(1, { descricao: 'Avaliar local', prioridade: 'Alta', evidenciaObrigatoria: false, prazoRelativoDias: 2 }),
    item(2, { descricao: 'Definir correção', prioridade: 'Média', evidenciaObrigatoria: false, prazoRelativoDias: 5 }),
    item(3, { descricao: 'Executar correção', prioridade: 'Média', evidenciaObrigatoria: true, prazoRelativoDias: 15 }),
    item(4, { descricao: 'Validar correção', prioridade: 'Média', evidenciaObrigatoria: true, prazoRelativoDias: 20 }),
  ];
  return criarTemplateValido(nome, itens);
}

// Wrapper local: cria uma Tratativa avulsa Aberta e falha se o preparo não der 200.
async function criarTratativaValida(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, dados);
  if (r.status !== 200) {
    throw new Error(`preparo de tratativa falhou: status ${r.status}, corpo ${JSON.stringify(r.data)}`);
  }
  return (r.data as { codigo: string }).codigo;
}

describe('Etapa 3: aplicação de template em Tratativa (R5-R11, R13, R15(a), R16)', () => {
  describe('CA13 (R5, R7): aplicação gera 4 Ações com prazos calculados em UTC', () => {
    afterEach(() => liberarRelogio());

    it('gera exatamente 4 Ações Pendente, responsável M1001 e prazos 2026-10-10/13/23/28', async () => {
      fixarInstante('2026-10-08T12:00:00.000Z');
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateCondicaoInsegura();

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);

      expect(r.status).toBe(200);

      const acoes = await linhas('Acoes', { tratativa_codigo: tratativa });
      expect(acoes).toHaveLength(4);
      for (const acao of acoes) {
        expect(acao.status).toBe('Pendente');
        expect(acao.responsavel).toBe('M1001');
      }
      const prazos = acoes.map((a) => String(a.prazo)).sort();
      expect(prazos).toEqual(['2026-10-10', '2026-10-13', '2026-10-23', '2026-10-28']);
    });
  });

  describe('CA14 (R5, R7): Ações mãe e Subações com acaoMae apontando para o UUID gerado', () => {
    it('gera 1 Ação de primeiro nível e 2 Subações vinculadas à mãe do mesmo lote', async () => {
      const tratativa = await criarTratativaValida();
      const itens = [
        item(1, { ordemPai: null }),
        item(2, { ordemPai: 1 }),
        item(3, { ordemPai: 1 }),
      ];
      const { id: template } = await criarTemplateValido(nomeUnico('Com subacoes'), itens);

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(r.status).toBe(200);

      const acoes = await linhas('Acoes', { tratativa_codigo: tratativa });
      expect(acoes).toHaveLength(3);
      const mae = acoes.find((a) => !a.acaoMae_codigo);
      const filhas = acoes.filter((a) => a.acaoMae_codigo);
      expect(mae).toBeDefined();
      expect(filhas).toHaveLength(2);
      for (const filha of filhas) {
        expect(filha.acaoMae_codigo).toBe(mae!.codigo);
      }
    });
  });

  describe('CA14a (R7): estrutura analítica preserva a ordem do Template', () => {
    it('consultarEstruturaAcoes devolve mãe antes de subações, com criadoEm estritamente crescente', async () => {
      const tratativa = await criarTratativaValida();
      const itens = [
        item(1, { ordemPai: null }),
        item(2, { ordemPai: 1 }),
        item(3, { ordemPai: 1 }),
        item(4, { ordemPai: null }),
      ];
      const { id: template } = await criarTemplateValido(nomeUnico('Ordem preservada'), itens);

      const aplicacao = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(aplicacao.status).toBe(200);

      const estrutura = await consultarEstruturaAcoes(consultar, tratativa, comoGestor);
      expect(estrutura.status).toBe(200);
      const raizes = estrutura.data.value as { descricao: string; subacoes: { descricao: string }[] }[];
      expect(raizes).toHaveLength(2);
      expect(raizes[0].descricao).toBe('Descrição do item 1');
      expect(raizes[0].subacoes.map((s) => s.descricao)).toEqual(['Descrição do item 2', 'Descrição do item 3']);
      expect(raizes[1].descricao).toBe('Descrição do item 4');

      const criadosEm = (await linhas('Acoes', { tratativa_codigo: tratativa })).map((a) => String(a.criadoEm));
      const ordenados = [...criadosEm].sort();
      expect(criadosEm).toEqual(ordenados);
      const unicos = new Set(criadosEm);
      expect(unicos.size).toBe(criadosEm.length);
    });
  });

  describe('CA15 (R5): aplicação idêntica em Tratativa avulsa e com Origem', () => {
    it('aplica com sucesso em Tratativa avulsa Em andamento', async () => {
      const tratativa = await criarTratativaValida();
      const statusInicial = await mudarStatus(enviar, tratativa, { status: 'Em andamento' }, comoGestor);
      if (statusInicial.status !== 204) throw new Error(`preparo mudarStatus falhou: ${statusInicial.status}`);
      const { id: template } = await criarTemplateValido(nomeUnico('Avulsa em andamento'));

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(r.status).toBe(200);
    });

    it('aplica com sucesso em Tratativa com Origem externa', async () => {
      const abertura = await abrirPorApp(enviar);
      if (abertura.status !== 200) throw new Error(`preparo abrirPorApp falhou: ${abertura.status}`);
      const tratativa = (abertura.data as { codigo: string }).codigo;
      const { id: template } = await criarTemplateValido(nomeUnico('Com origem'));

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(r.status).toBe(200);
    });
  });

  describe('CA16 (R6): atribuições personalizadas por item', () => {
    it('item com atribuicoes recebe o responsável mapeado; os demais recebem o responsavelPadrao', async () => {
      const tratativa = await criarTratativaValida();
      const itens = [item(1), item(2), item(3)];
      const { id: template } = await criarTemplateValido(nomeUnico('Atribuicoes'), itens);

      const r = await aplicarTemplate(
        enviar,
        tratativa,
        { template, responsavelPadrao: 'M1001', atribuicoes: [{ ordem: 2, responsavel: 'M2002' }] },
        comoGestor,
      );
      expect(r.status).toBe(200);

      const acoes = await linhas('Acoes', { tratativa_codigo: tratativa });
      const porDescricao = Object.fromEntries(acoes.map((a) => [a.descricao, a.responsavel]));
      expect(porDescricao['Descrição do item 2']).toBe('M2002');
      expect(porDescricao['Descrição do item 1']).toBe('M1001');
      expect(porDescricao['Descrição do item 3']).toBe('M1001');
    });
  });

  describe('CA16a (R6, R15): ordem duplicada em atribuicoes recusa com 400', () => {
    it('devolve 400 Ordem de atribuição duplicada., target atribuicoes', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Atribuicao duplicada'), [item(1), item(2)]);

      const r = await aplicarTemplate(
        enviar,
        tratativa,
        {
          template,
          responsavelPadrao: 'M1001',
          atribuicoes: [{ ordem: 1, responsavel: 'M2002' }, { ordem: 1, responsavel: 'M1001' }],
        },
        comoGestor,
      );

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Ordem de atribuição duplicada.');
      expect(erro?.target).toBe('atribuicoes');
    });
  });

  describe('CA16b (R6, R15): ordem inexistente no template em atribuicoes recusa com 400', () => {
    it('devolve 400 Item de template inválido., target atribuicoes', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Ordem inexistente atribuicao'), [item(1)]);

      const r = await aplicarTemplate(
        enviar,
        tratativa,
        { template, responsavelPadrao: 'M1001', atribuicoes: [{ ordem: 99, responsavel: 'M2002' }] },
        comoGestor,
      );

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Item de template inválido.');
      expect(erro?.target).toBe('atribuicoes');
    });
  });

  describe('CA17 (R6): matrícula inválida em responsavelPadrao e atribuicoes', () => {
    it('responsavelPadrao com espaço no meio recusa com 400, target responsavelPadrao', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Matricula espaco'));

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M 1001' }, comoGestor);

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.');
      expect(erro?.target).toBe('responsavelPadrao');
    });

    it('responsavelPadrao em formato de e-mail recusa com 400, target responsavelPadrao', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Matricula email'));

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001@empresa.com' }, comoGestor);

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.');
      expect(erro?.target).toBe('responsavelPadrao');
    });

    it('matrícula inválida em item de atribuicoes recusa com 400, target atribuicoes', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Matricula atribuicao invalida'), [item(1)]);

      const r = await aplicarTemplate(
        enviar,
        tratativa,
        { template, responsavelPadrao: 'M1001', atribuicoes: [{ ordem: 1, responsavel: 'M 2002' }] },
        comoGestor,
      );

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.');
      expect(erro?.target).toBe('atribuicoes');
    });

    it('responsavelPadrao com espaços nas pontas é aparado e aceito (005 R3)', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Matricula aparada'));

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: ' M1001 ' }, comoGestor);

      expect(r.status).toBe(200);
      const acoes = await linhas('Acoes', { tratativa_codigo: tratativa });
      expect(acoes[0].responsavel).toBe('M1001');
    });
  });

  describe('CA18 (R5, R15): Tratativa inexistente na URL recusa com 404', () => {
    it('devolve 404 Tratativa não encontrada.', async () => {
      const { id: template } = await criarTemplateValido(nomeUnico('Tratativa inexistente'));

      const r = await aplicarTemplate(enviar, UUID_INEXISTENTE, { template, responsavelPadrao: 'M1001' }, comoGestor);

      expect(r.status).toBe(404);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Tratativa não encontrada.');
    });
  });

  describe('CA19 (R5, R15): Template inexistente no payload recusa com 404', () => {
    it('devolve 404 Template não encontrado., target template', async () => {
      const tratativa = await criarTratativaValida();

      const r = await aplicarTemplate(enviar, tratativa, { template: UUID_INEXISTENTE, responsavelPadrao: 'M1001' }, comoGestor);

      expect(r.status).toBe(404);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Template não encontrado.');
      expect(erro?.target).toBe('template');
    });
  });

  describe('CA31 (R15): Tratativa e Template inexistentes — precedência da Tratativa', () => {
    it('devolve 404 Tratativa não encontrada. (não o 404 de Template)', async () => {
      const r = await aplicarTemplate(
        enviar,
        UUID_INEXISTENTE,
        { template: UUID_INEXISTENTE, responsavelPadrao: 'M1001' },
        comoGestor,
      );

      expect(r.status).toBe(404);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Tratativa não encontrada.');
    });
  });

  describe('CA19b (R12, R15): template malformado no payload recusa com 400', () => {
    it('devolve 400 Código inválido., target template', async () => {
      const tratativa = await criarTratativaValida();

      const r = await aplicarTemplate(enviar, tratativa, { template: 'invalido!', responsavelPadrao: 'M1001' }, comoGestor);

      expect(r.status).toBe(400);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Código inválido.');
      expect(erro?.target).toBe('template');
    });
  });

  describe('CA20 (R9): Tratativa Encerrada ou Cancelada recusa com 409', () => {
    it('Tratativa Cancelada devolve 409 Tratativa Cancelada não pode ser alterada., target status', async () => {
      const tratativa = await criarTratativaValida();
      const cancelamento = await mudarStatus(enviar, tratativa, { status: 'Cancelada', justificativa: 'Encerrar teste' }, comoGestor);
      if (cancelamento.status !== 204) throw new Error(`preparo cancelamento falhou: ${cancelamento.status}`);
      const { id: template } = await criarTemplateValido(nomeUnico('Tratativa cancelada'));

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);

      expect(r.status).toBe(409);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Tratativa Cancelada não pode ser alterada.');
      expect(erro?.target).toBe('status');
    });
  });

  describe('CA12 (R4): Template inativo recusa com 409', () => {
    it('devolve 409 Template inativo não pode ser aplicado., target template', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Template inativo aplicacao'));
      const desativacao = await enviar('/api/administracao/v1/desativarTemplate', { id: template }, comoAdmin);
      if (desativacao.status !== 200) throw new Error(`preparo desativarTemplate falhou: ${desativacao.status}`);

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);

      expect(r.status).toBe(409);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Template inativo não pode ser aplicado.');
      expect(erro?.target).toBe('template');
    });
  });

  describe('CA10 (R3, R8): editarTemplate não retroage sobre Ações já geradas por aplicação anterior', () => {
    it('Ações geradas antes da edição permanecem idênticas; nova aplicação usa os itens novos', async () => {
      const nomeOriginal = nomeUnico('Template retroatividade');
      const itensOriginais = [item(1, { descricao: 'Descrição original', prioridade: 'Alta', evidenciaObrigatoria: true, prazoRelativoDias: 3 })];
      const { id: template } = await criarTemplateValido(nomeOriginal, itensOriginais);

      const tratativa = await criarTratativaValida();
      const aplicacaoAntes = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(aplicacaoAntes.status).toBe(200);

      const antes = await linhas('Acoes', { tratativa_codigo: tratativa });
      expect(antes).toHaveLength(1);
      const acaoAntes = {
        descricao: antes[0].descricao,
        prioridade: antes[0].prioridade,
        prazo: antes[0].prazo,
        evidenciaObrigatoria: antes[0].evidenciaObrigatoria,
      };

      const itensNovos = [item(1, { descricao: 'Descrição nova', prioridade: 'Baixa', evidenciaObrigatoria: false, prazoRelativoDias: 10 })];
      const edicao = await editarTemplate(enviar, { id: template, nome: nomeOriginal, itens: itensNovos }, comoAdmin);
      expect(edicao.status).toBe(200);

      const depois = await linhas('Acoes', { tratativa_codigo: tratativa });
      expect(depois).toHaveLength(1);
      expect(depois[0].descricao).toBe(acaoAntes.descricao);
      expect(depois[0].prioridade).toBe(acaoAntes.prioridade);
      expect(depois[0].prazo).toBe(acaoAntes.prazo);
      expect(depois[0].evidenciaObrigatoria).toBe(acaoAntes.evidenciaObrigatoria);

      const outraTratativa = await criarTratativaValida();
      const aplicacaoDepois = await aplicarTemplate(enviar, outraTratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(aplicacaoDepois.status).toBe(200);

      const acoesNovaAplicacao = await linhas('Acoes', { tratativa_codigo: outraTratativa });
      expect(acoesNovaAplicacao).toHaveLength(1);
      expect(acoesNovaAplicacao[0].descricao).toBe('Descrição nova');
      expect(acoesNovaAplicacao[0].prioridade).toBe('Baixa');
      expect(acoesNovaAplicacao[0].evidenciaObrigatoria).toBe(false);
    });
  });

  describe('CA21a (R5, R15): usuário sem papel de Gestor recusa na etapa 2 com 403', () => {
    it('usuário comum tentando aplicar template recebe 403 Acesso negado. antes de checar existência', async () => {
      const r = await aplicarTemplate(
        enviar,
        UUID_INEXISTENTE,
        { template: UUID_INEXISTENTE, responsavelPadrao: 'M1001' },
        comoUsuario,
      );

      expect(r.status).toBe(403);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Acesso negado.');
    });
  });

  describe('CA22 (R13, R15) e CA32 (R15): Aplicativo de origem recusa na etapa 2 com 403', () => {
    it('Aplicativo de origem tentando aplicar template recebe 403 Acesso negado.', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('App origem aplicacao'));

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoApp);

      expect(r.status).toBe(403);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Acesso negado.');
    });

    it('CA32: Aplicativo de origem com Tratativa malformada na URL recebe 403 antes da forma', async () => {
      const r = await aplicarTemplate(enviar, 'xyz', { template: 'xyz', responsavelPadrao: 'M1001' }, comoApp);

      expect(r.status).toBe(403);
      const erro = (r.data as Erro).error;
      expect(erro?.message).toBe('Acesso negado.');
    });
  });

  describe('CA23 (R15): usuário não autenticado recebe 401', () => {
    it('devolve 401 sem autenticação', async () => {
      const r = await aplicarTemplate(enviar, UUID_INEXISTENTE, { template: UUID_INEXISTENTE, responsavelPadrao: 'M1001' }, semAuth);

      expect(r.status).toBe(401);
    });
  });

  describe('CA24 (R11): histórico Criacao com metadado do template e sem Descrição (LGPD)', () => {
    it('grava 4 eventos Criacao na origem Acao com template { id, nome } e sem o texto de Descrição', async () => {
      const tratativa = await criarTratativaValida();
      const nomeTemplate = nomeUnico('Condição Insegura histórico');
      const { id: template } = await criarTemplateCondicaoInsegura(nomeTemplate);

      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(r.status).toBe(200);

      const historico = await linhas('HistoricoAcoes', { tratativa_codigo: tratativa });
      expect(historico).toHaveLength(4);
      for (const h of historico) {
        expect(h.evento).toBe('Criacao');
        expect(h.autor).toBe('gestor');
        expect(h.tipoAutor).toBe('Usuario');
        expect(h.template_id).toBe(template);
        expect(h.templateNome).toBe(nomeTemplate);
        expect(JSON.stringify(h)).not.toContain('Avaliar local');
        expect(JSON.stringify(h)).not.toContain('Definir correção');
      }
    });
  });

  describe('CA25 (R8): Ações geradas aceitam edição e início normalmente', () => {
    it('Gestor edita a Descrição e o Responsável inicia a Ação para Em andamento', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Autonomia acoes'));
      const aplicacao = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(aplicacao.status).toBe(200);

      const estrutura = await consultarEstruturaAcoes(consultar, tratativa, comoGestor);
      const acao = (estrutura.data.value as { codigo: string }[])[0];

      const edicao = await enviar(
        `/api/tratativa/v1/Tratativas(${tratativa})/editarAcao`,
        { acao: acao.codigo, descricao: 'Descrição editada pelo Gestor' },
        comoGestor,
      );
      expect(edicao.status).toBe(204);

      const inicio = await mudarStatusAcao(enviar, tratativa, { acao: acao.codigo, status: 'Em andamento' }, comoM1001);
      expect(inicio.status).toBe(204);
    });
  });

  describe('CA25a (R8): Ação com evidenciaObrigatoria bloqueia conclusão sem Evidência', () => {
    it('devolve 409 ao concluir Ação com evidenciaObrigatoria=true sem Evidência anexada', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('Evidencia obrigatoria'), [
        item(1, { evidenciaObrigatoria: true }),
      ]);
      const aplicacao = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(aplicacao.status).toBe(200);

      const estrutura = await consultarEstruturaAcoes(consultar, tratativa, comoGestor);
      const acao = (estrutura.data.value as { codigo: string; evidenciaObrigatoria: string }[])[0];
      expect(acao.evidenciaObrigatoria).toBe('sim');

      const conclusao = await mudarStatusAcao(enviar, tratativa, { acao: acao.codigo, status: 'Concluída' }, comoGestor);

      expect(conclusao.status).toBe(409);
      const erro = (conclusao.data as Erro).error;
      expect(erro?.message).toBe('Ação com Evidência obrigatória não pode ser concluída sem Evidência.');
    });
  });

  describe('CA28 (R10): falha de gravação simulada dispara rollback atômico completo', () => {
    afterEach(() => espiao.naoFalhar());

    it('nenhuma Ação, Subação nem histórico ficam órfãos após falha simulada', async () => {
      const tratativa = await criarTratativaValida();
      const itens = [item(1, { ordemPai: null }), item(2, { ordemPai: 1 })];
      const { id: template } = await criarTemplateValido(nomeUnico('Rollback'), itens);

      const antesAcoes = (await linhas('Acoes', { tratativa_codigo: tratativa })).length;
      const antesHistorico = (await linhas('HistoricoAcoes', { tratativa_codigo: tratativa })).length;

      espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');
      const r = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(r.status).toBeGreaterThanOrEqual(400);

      const depoisAcoes = (await linhas('Acoes', { tratativa_codigo: tratativa })).length;
      const depoisHistorico = (await linhas('HistoricoAcoes', { tratativa_codigo: tratativa })).length;
      expect(depoisAcoes).toBe(antesAcoes);
      expect(depoisHistorico).toBe(antesHistorico);
    });
  });

  describe('CA29 (R6): consulta de estrutura por não-Gestor mascara Responsável sob LGPD', () => {
    it('consultarEstruturaAcoes devolve responsavel: null para usuário sem papel de Gestor', async () => {
      const tratativa = await criarTratativaValida();
      const { id: template } = await criarTemplateValido(nomeUnico('LGPD responsavel'));
      const aplicacao = await aplicarTemplate(enviar, tratativa, { template, responsavelPadrao: 'M1001' }, comoGestor);
      expect(aplicacao.status).toBe(200);

      const estrutura = await consultarEstruturaAcoes(consultar, tratativa, comoUsuario);
      expect(estrutura.status).toBe(200);
      const acoes = estrutura.data.value as { responsavel: string | null }[];
      expect(acoes).toHaveLength(1);
      expect(acoes[0].responsavel).toBeNull();
    });
  });
});
