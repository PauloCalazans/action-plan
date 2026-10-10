import cds from '@sap/cds';
import { recusar } from '../tratativa/recusa';
import { validarCabecalho, validarItens, type ItemTemplateEntrada } from './templates-validacao';

const NS = 'br.com.calazanstec';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decisão 14 (padrão da plataforma): o runtime não valida o formato do UUID. */
export const idValido = (id: string): boolean => UUID.test(id);

export interface DadosTemplate {
  nome?: string;
  descricao?: string;
  itens?: ItemTemplateEntrada[];
}

interface TemplateExistente {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

async function buscarPorId(id: string): Promise<TemplateExistente | undefined> {
  return cds.db.run(
    SELECT.one.from(`${NS}.Templates`).columns('id', 'nome', 'descricao', 'ativo').where({ id }),
  );
}

async function existeOutroComMesmoNome(nome: string, idExcluido?: string): Promise<boolean> {
  const consulta = SELECT.one.from(`${NS}.Templates`).columns('id').where({ nome });
  const linha = (await cds.db.run(consulta)) as { id: string } | undefined;
  if (!linha) return false;
  return linha.id !== idExcluido;
}

/** R1-R4, R14 (spec templates-de-acoes): cria template com cabeçalho e de 1 a 30 itens (etapa 7 de validação). */
export async function criarTemplate(dados: DadosTemplate): Promise<{ id: string }> {
  const { nome, descricao } = validarCabecalho(dados.nome, dados.descricao);
  if (await existeOutroComMesmoNome(nome)) {
    recusar(409, 'Já existe um template com este nome.', 'nome');
  }
  const itens = validarItens(dados.itens);

  const id = cds.utils.uuid();
  await cds.db.run(INSERT.into(`${NS}.Templates`).entries({ id, nome, descricao, ativo: true }));
  await cds.db.run(
    INSERT.into(`${NS}.ItensTemplate`).entries(
      itens.map((item) => ({
        id: cds.utils.uuid(),
        template_id: id,
        ordem: item.ordem,
        descricao: item.descricao,
        prioridade: item.prioridade,
        evidenciaObrigatoria: item.evidenciaObrigatoria,
        prazoRelativoDias: item.prazoRelativoDias,
        ordemPai: item.ordemPai,
      })),
    ),
  );
  return { id };
}

/** Resolve e valida o Identificador de template nas operações de id único (editar/ativar/desativar). */
async function resolverTemplate(id: unknown): Promise<TemplateExistente> {
  if (typeof id !== 'string' || !idValido(id)) {
    recusar(400, 'Código inválido.', 'id');
  }
  const template = await buscarPorId(id);
  if (!template) {
    recusar(404, 'Template não encontrado.', 'id');
  }
  return template;
}

/** R3, R8 (spec templates-de-acoes): atualiza nome, descrição e substitui itens para aplicações futuras. */
export async function editarTemplate(id: unknown, dados: DadosTemplate): Promise<void> {
  const template = await resolverTemplate(id);
  const { nome, descricao } = validarCabecalho(dados.nome, dados.descricao);
  if (await existeOutroComMesmoNome(nome, template.id)) {
    recusar(409, 'Já existe um template com este nome.', 'nome');
  }
  const itens = validarItens(dados.itens);

  await cds.db.run(UPDATE(`${NS}.Templates`).set({ nome, descricao }).where({ id: template.id }));
  await cds.db.run(DELETE.from(`${NS}.ItensTemplate`).where({ template_id: template.id }));
  await cds.db.run(
    INSERT.into(`${NS}.ItensTemplate`).entries(
      itens.map((item) => ({
        id: cds.utils.uuid(),
        template_id: template.id,
        ordem: item.ordem,
        descricao: item.descricao,
        prioridade: item.prioridade,
        evidenciaObrigatoria: item.evidenciaObrigatoria,
        prazoRelativoDias: item.prazoRelativoDias,
        ordemPai: item.ordemPai,
      })),
    ),
  );
}

/** R4 (spec templates-de-acoes): define ativo = <alvo>; idempotente quando já está no estado desejado. */
async function definirAtivo(id: unknown, alvo: boolean): Promise<{ id: string; ativo: boolean }> {
  const template = await resolverTemplate(id);
  if (template.ativo !== alvo) {
    await cds.db.run(UPDATE(`${NS}.Templates`).set({ ativo: alvo }).where({ id: template.id }));
  }
  return { id: template.id, ativo: alvo };
}

export function ativarTemplate(id: unknown): Promise<{ id: string; ativo: boolean }> {
  return definirAtivo(id, true);
}

export function desativarTemplate(id: unknown): Promise<{ id: string; ativo: boolean }> {
  return definirAtivo(id, false);
}

interface ItemTemplatePersistido {
  id: string;
  ordem: number;
  descricao: string;
  prioridade: string;
  evidenciaObrigatoria: boolean;
  prazoRelativoDias: number;
  ordemPai: number | null;
}

export interface DetalheTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  itens: ItemTemplatePersistido[];
}

/**
 * R12 (spec templates-de-acoes): consulta de detalhe para o Administrador (etapa 1, uso mínimo).
 * A visibilidade por papel e a paginação da listagem pertencem à etapa 2 (`templates-consulta.ts`).
 */
export async function consultarTemplateAdministrativo(template: unknown): Promise<DetalheTemplate> {
  if (typeof template !== 'string' || !idValido(template)) {
    recusar(400, 'Código inválido.', 'template');
  }
  const cabecalho = await buscarPorId(template);
  if (!cabecalho) {
    recusar(404, 'Template não encontrado.', 'template');
  }
  const itens = (await cds.db.run(
    SELECT.from(`${NS}.ItensTemplate`)
      .columns('id', 'ordem', 'descricao', 'prioridade', 'evidenciaObrigatoria', 'prazoRelativoDias', 'ordemPai')
      .where({ template_id: cabecalho.id })
      .orderBy('ordem ASC'),
  )) as ItemTemplatePersistido[];
  return { ...cabecalho, itens };
}

