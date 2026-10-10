import cds from '@sap/cds';
import { recusar } from '../tratativa/recusa';
import { extrairPaginacao } from '../tratativa/listagem';
import { idValido } from './templates-cadastro';

const NS = 'br.com.calazanstec';

export interface FiltrosListagemTemplates {
  ativo?: string | null;
  tamanhoPagina?: number | null;
  pagina?: number | null;
}

export interface ItemListagemTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  quantidadeItens: number;
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
 * R12 (spec templates-de-acoes): visibilidade por papel do filtro `ativo` de listarTemplates.
 * - Administrador e GestorTratativa podem pedir 'true' (padrão), 'false' ou 'todos'.
 * - Usuário comum sempre recebe apenas ativos, mesmo que peça 'false' ou 'todos' (filtro ignorado).
 */
function resolverFiltroAtivo(ativo: string | null | undefined, podeVerInativos: boolean): boolean | null {
  const valor = typeof ativo === 'string' ? ativo.trim().toLowerCase() : '';
  if (!podeVerInativos) return true;
  if (valor === 'false') return false;
  if (valor === 'todos') return null;
  return true;
}

/** R12 (spec templates-de-acoes): lista templates ordenados por nome, com paginação e visibilidade por papel. */
export async function listarTemplates(filtros: FiltrosListagemTemplates, podeVerInativos: boolean): Promise<ItemListagemTemplate[]> {
  const { tamanho, offset } = extrairPaginacao(filtros.tamanhoPagina, filtros.pagina);
  const ativoFiltro = resolverFiltroAtivo(filtros.ativo, podeVerInativos);

  const onde: Record<string, boolean> = {};
  if (ativoFiltro !== null) onde.ativo = ativoFiltro;

  const cabecalhos = (await cds.db.run(
    SELECT.from(`${NS}.Templates`)
      .columns('id', 'nome', 'descricao', 'ativo')
      .where(onde)
      .orderBy('nome ASC')
      .limit(tamanho, offset),
  )) as { id: string; nome: string; descricao: string | null; ativo: boolean }[];

  if (cabecalhos.length === 0) return [];

  const ids = cabecalhos.map((c) => c.id);
  const contagens = (await cds.db.run(
    SELECT.from(`${NS}.ItensTemplate`).columns('template_id', 'count(*) as quantidade').where({ template_id: ids }).groupBy('template_id'),
  )) as { template_id: string; quantidade: number }[];
  const quantidadePorTemplate = new Map(contagens.map((c) => [c.template_id, Number(c.quantidade)]));

  return cabecalhos.map((c) => ({
    id: c.id,
    nome: c.nome,
    descricao: c.descricao,
    ativo: c.ativo,
    quantidadeItens: quantidadePorTemplate.get(c.id) ?? 0,
  }));
}

/**
 * R12 (spec templates-de-acoes): consulta de detalhe para TratativaService, com visibilidade por papel.
 * Template inexistente ou (inativo e consultado por quem não pode ver inativos) recusa igualmente com
 * 404 Template não encontrado., sem distinguir os dois casos (evita vazamento de existência).
 */
export async function consultarTemplate(template: unknown, podeVerInativos: boolean): Promise<DetalheTemplate> {
  if (typeof template !== 'string' || !idValido(template)) {
    recusar(400, 'Código inválido.', 'template');
  }
  const cabecalho = (await cds.db.run(
    SELECT.one.from(`${NS}.Templates`).columns('id', 'nome', 'descricao', 'ativo').where({ id: template }),
  )) as { id: string; nome: string; descricao: string | null; ativo: boolean } | undefined;
  if (!cabecalho || (!cabecalho.ativo && !podeVerInativos)) {
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
