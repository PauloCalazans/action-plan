// R1, R2, R4, R6, R14 (spec historico-e-auditoria): consulta unificada do histórico de auditoria.
// Leitura direta e estritamente somente-leitura sobre HistoricoTratativa e HistoricoAcoes (CA17);
// nenhuma nova tabela/coluna é introduzida (N3-5) e os contratos anteriores (consultarTratativa, 12
// chaves) permanecem intactos (Ruling R-02).

import cds from '@sap/cds';
import { recusar } from './recusa';
import { codigoValido } from './consulta';
import { nomeCanonico, origemDoEventoAcao, origemDoEventoTratativa, type OrigemHistorico } from './historico-catalogo';

const NS = 'br.com.calazanstec';
const PADRAO_TAMANHO = 50;

/** R1 (spec historico-e-auditoria): detalhe estruturado do evento de histórico. */
export interface DetalheEventoHistorico {
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  justificativa: string | null;
  evidencia: string | null;
  mimeType: string | null;
  tamanho: number | null;
}

/** R1, R2, R6 (spec historico-e-auditoria): item unificado da trilha de auditoria, antes de autorização/mascaramento. */
export interface ItemHistoricoBruto {
  id: string;
  codigoTratativa: string;
  codigoAcao: string | null;
  origem: OrigemHistorico;
  tipoEvento: string;
  detalhe: DetalheEventoHistorico;
  dataHora: string;
  autor: string;
  tipoAutor: string;
}

interface LinhaHistoricoTratativa {
  ID: string;
  tratativa_codigo: string;
  evento: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  justificativa: string | null;
  autor: string;
  tipoAutor: string;
  quando: string;
}

interface LinhaHistoricoAcoes extends LinhaHistoricoTratativa {
  acao_codigo: string;
  evidencia: string | null;
  mimeType: string | null;
  tamanho: number | null;
}

const COLUNAS_TRATATIVA = [
  'ID', 'tratativa_codigo', 'evento', 'campo', 'valorAnterior', 'valorNovo', 'justificativa', 'autor', 'tipoAutor', 'quando',
];
const COLUNAS_ACOES = [...COLUNAS_TRATATIVA, 'acao_codigo', 'evidencia', 'mimeType', 'tamanho'];

function montarDetalhe(linha: LinhaHistoricoTratativa | LinhaHistoricoAcoes): DetalheEventoHistorico {
  const comEvidencia = linha as LinhaHistoricoAcoes;
  return {
    campo: linha.campo ?? null,
    valorAnterior: linha.valorAnterior ?? null,
    valorNovo: linha.valorNovo ?? null,
    justificativa: linha.justificativa ?? null,
    evidencia: comEvidencia.evidencia ?? null,
    mimeType: comEvidencia.mimeType ?? null,
    tamanho: comEvidencia.tamanho ?? null,
  };
}

/** Normaliza uma linha de `HistoricoTratativa` para o item unificado (R2: codigoAcao sempre null). */
function normalizarLinhaTratativa(linha: LinhaHistoricoTratativa): ItemHistoricoBruto {
  const tipoEvento = nomeCanonico(linha.evento);
  return {
    id: linha.ID,
    codigoTratativa: linha.tratativa_codigo,
    codigoAcao: null,
    origem: origemDoEventoTratativa(tipoEvento),
    tipoEvento,
    detalhe: montarDetalhe(linha),
    dataHora: new Date(linha.quando).toISOString(),
    autor: linha.autor,
    tipoAutor: linha.tipoAutor,
  };
}

/** Normaliza uma linha de `HistoricoAcoes` para o item unificado (R2: codigoAcao = UUID da Ação). */
function normalizarLinhaAcao(linha: LinhaHistoricoAcoes): ItemHistoricoBruto {
  const tipoEvento = nomeCanonico(linha.evento);
  return {
    id: linha.ID,
    codigoTratativa: linha.tratativa_codigo,
    codigoAcao: linha.acao_codigo,
    origem: origemDoEventoAcao(tipoEvento),
    tipoEvento,
    detalhe: montarDetalhe(linha),
    dataHora: new Date(linha.quando).toISOString(),
    autor: linha.autor,
    tipoAutor: linha.tipoAutor,
  };
}

/** N3-5 (B2): desempate determinístico multidimensional por dados já persistidos, sem coluna nova. */
function compararItens(a: ItemHistoricoBruto, b: ItemHistoricoBruto): number {
  const porInstante = new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
  if (porInstante !== 0) return porInstante;
  const porOrigem = a.origem.localeCompare(b.origem);
  if (porOrigem !== 0) return porOrigem;
  const porTipoEvento = a.tipoEvento.localeCompare(b.tipoEvento);
  if (porTipoEvento !== 0) return porTipoEvento;
  return a.id.localeCompare(b.id);
}

/** R4: valida a existência da Tratativa, recusando com 404 quando inexistente. */
async function existeTratativa(codigo: string): Promise<boolean> {
  const t = (await cds.db.run(SELECT.one.from(`${NS}.Tratativas`).columns('codigo').where({ codigo }))) as
    | { codigo: string }
    | undefined;
  return !!t;
}

/**
 * Orquestra a consulta unificada: valida a forma e a existência da Tratativa, lê HistoricoTratativa e
 * HistoricoAcoes filtrados por `tratativa_codigo`, normaliza para o item unificado, ordena de forma
 * determinística e pagina por fatia (R1, R4, R6; etapa 1 — filtros avançados chegam na Etapa 2).
 */
export async function consultarHistoricoUnificado(
  tratativa: string | null | undefined,
  tamanhoPagina?: number | null,
  pagina?: number | null,
): Promise<ItemHistoricoBruto[]> {
  // Etapa 4 (D10): forma do parâmetro `tratativa`.
  if (typeof tratativa !== 'string' || !codigoValido(tratativa)) {
    recusar(400, 'Código inválido.', 'tratativa');
  }
  const codigo = (tratativa as string).toLowerCase();

  // Etapa 5 (D10): existência da Tratativa.
  if (!(await existeTratativa(codigo))) {
    recusar(404, 'Tratativa não encontrada.', 'tratativa');
  }

  const [linhasTratativa, linhasAcoes] = await Promise.all([
    cds.db.run(
      SELECT.from(`${NS}.HistoricoTratativa`).columns(...COLUNAS_TRATATIVA).where({ tratativa_codigo: codigo }),
    ) as Promise<LinhaHistoricoTratativa[]>,
    cds.db.run(
      SELECT.from(`${NS}.HistoricoAcoes`).columns(...COLUNAS_ACOES).where({ tratativa_codigo: codigo }),
    ) as Promise<LinhaHistoricoAcoes[]>,
  ]);

  const itens = [
    ...linhasTratativa.map(normalizarLinhaTratativa),
    ...linhasAcoes.map(normalizarLinhaAcao),
  ].sort(compararItens);

  const tamanho = tamanhoPagina ?? PADRAO_TAMANHO;
  const pag = pagina ?? 1;
  const offset = (pag - 1) * tamanho;
  return itens.slice(offset, offset + tamanho);
}
