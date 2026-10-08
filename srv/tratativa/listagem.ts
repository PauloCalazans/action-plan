import cds from '@sap/cds';
import { codigoValido } from './consulta';
import { criticidadesValidas, statusValidos } from './dominios';
import { normalizarTexto } from './normalizacao';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';
const PADRAO_TAMANHO = 50;
const MAX_TAMANHO = 200;

export interface FiltrosListagem {
  origem?: string | null; idOrigem?: string | null; criticidade?: string | null; status?: string | null;
  unidade?: string | null; area?: string | null; tamanhoPagina?: number | null; pagina?: number | null;
}
export interface ItemListagem {
  codigo: string; titulo: string; origem: string | null; idOrigem: string | null; criticidade: string; status: string;
  unidade: string | null; area: string | null; dataCriacao: string; dataPrevistaConclusao: string;
}
export interface DetalheTratativa extends ItemListagem { descricao: string | null; solicitante: string | null }

const COLUNAS_ITEM = ['codigo', 'titulo', 'origem', 'idOrigem', 'criticidade', 'status', 'unidade', 'area', 'dataCriacao', 'dataPrevistaConclusao'];

/** Filtro ausente, vazio ou só espaços não filtra (decisão 12). */
const informado = (v?: string | null): v is string => typeof v === 'string' && v.trim() !== '';

/** R24/R25: filtros combinados, ordem fixa e página; só os dez campos de ItemListagem. */
export async function listarTratativas(filtros: FiltrosListagem): Promise<ItemListagem[]> {
  const { origem, idOrigem, criticidade, status, unidade, area } = filtros;
  if (informado(criticidade) && !criticidadesValidas().includes(criticidade)) {
    recusar(400, 'Criticidade inválida: use Baixa, Média, Alta ou Crítica.', 'criticidade');
  }
  if (informado(status) && !statusValidos().includes(status)) {
    recusar(400, 'Status inválido: use Aberta, Em andamento, Encerrada ou Cancelada.', 'status');
  }
  const tamanho = filtros.tamanhoPagina ?? PADRAO_TAMANHO;
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > MAX_TAMANHO) {
    recusar(400, 'O campo Tamanho da página aceita de 1 a 200.', 'tamanhoPagina');
  }
  const pagina = filtros.pagina ?? 1;
  if (!Number.isInteger(pagina) || pagina < 1) recusar(400, 'O campo Página deve ser 1 ou maior.', 'pagina');

  const onde: Record<string, string> = {};
  if (informado(origem)) onde.origemNormalizada = normalizarTexto(origem) as string;
  if (informado(unidade)) onde.unidadeNormalizada = normalizarTexto(unidade) as string;
  if (informado(area)) onde.areaNormalizada = normalizarTexto(area) as string;
  if (informado(idOrigem)) onde.idOrigem = idOrigem;
  if (informado(criticidade)) onde.criticidade = criticidade;
  if (informado(status)) onde.status = status;

  return (await cds.db.run(
    SELECT.from(`${NS}.Tratativas`)
      .columns(...COLUNAS_ITEM)
      .where(onde)
      .orderBy('dataPrevistaConclusao', 'dataCriacao', 'codigo')
      .limit(tamanho, (pagina - 1) * tamanho),
  )) as ItemListagem[];
}

/** R26/R23: detalhe pelo Código; Descrição e Solicitante só para quem pode vê-los, senão null. */
export async function consultarTratativa(codigo: string | null | undefined, verOcultos: boolean): Promise<DetalheTratativa> {
  if (typeof codigo !== 'string' || !codigoValido(codigo)) recusar(400, 'Código inválido.', 'codigo');
  const t = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns(...COLUNAS_ITEM, 'descricao', 'solicitante').where({ codigo: codigo.toLowerCase() }),
  )) as DetalheTratativa | undefined;
  if (!t) recusar(404, 'Tratativa não encontrada.');
  return verOcultos ? t : { ...t, descricao: null, solicitante: null };
}
