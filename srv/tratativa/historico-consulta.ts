// R1, R2, R4, R6, R14 (spec historico-e-auditoria): consulta unificada do histórico de auditoria.
// Leitura direta e estritamente somente-leitura sobre HistoricoTratativa e HistoricoAcoes (CA17);
// nenhuma nova tabela/coluna é introduzida (N3-5) e os contratos anteriores (consultarTratativa, 12
// chaves) permanecem intactos (Ruling R-02).

import cds from '@sap/cds';
import { recusar } from './recusa';
import { codigoValido } from './consulta';
import {
  nomeCanonico,
  origemDoEventoAcao,
  origemDoEventoTratativa,
  todosEventosCanonicos,
  type OrigemHistorico,
} from './historico-catalogo';

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

/**
 * R1, R2, R6 (spec historico-e-auditoria): item unificado da trilha de auditoria. `autor` é `string`
 * na leitura direta do banco e passa a admitir `null` depois do mascaramento LGPD (R5c, N3-3) aplicado
 * por `srv/tratativa/historico-autorizacao.ts` para não-Gestores.
 */
export interface ItemHistoricoBruto {
  id: string;
  codigoTratativa: string;
  codigoAcao: string | null;
  origem: OrigemHistorico;
  tipoEvento: string;
  detalhe: DetalheEventoHistorico;
  dataHora: string;
  autor: string | null;
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

/** R7: valida a existência e a pertinência da Ação à Tratativa, recusando com 404 quando ausente ou de outra Tratativa. */
async function existeAcaoNaTratativa(codigoAcao: string, codigoTratativa: string): Promise<boolean> {
  const a = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo').where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as { codigo: string } | undefined;
  return !!a;
}

/** R7: formato ISO 8601 válido — Date.parse aceita variações; recusa string vazia e não-string. */
function dataValida(valor: string): Date | null {
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime()) ? null : instante;
}

/** R7 (etapa 2, D10 etapa 6): valida tipoEvento, codigoAcao (pertinência), período e paginação, nesta ordem. */
async function validarFiltros(
  codigoTratativa: string,
  filtros: {
    tipoEvento?: string | null;
    codigoAcao?: string | null;
    periodoInicio?: string | null;
    periodoFim?: string | null;
    tamanhoPagina?: number | null;
    pagina?: number | null;
  },
): Promise<{ periodoInicio: Date | null; periodoFim: Date | null }> {
  const { tipoEvento, codigoAcao, periodoInicio, periodoFim, tamanhoPagina, pagina } = filtros;

  // Etapa 5 (D10): existência e pertinência de codigoAcao (formato já validado na etapa 4, antes da existência da Tratativa).
  if (typeof codigoAcao === 'string' && codigoAcao.length > 0) {
    if (!(await existeAcaoNaTratativa(codigoAcao.toLowerCase(), codigoTratativa))) {
      recusar(404, 'Ação não encontrada.', 'codigoAcao');
    }
  }

  // Etapa 6 (D10): validação semântica de filtros e paginação.
  if (typeof tipoEvento === 'string' && tipoEvento.length > 0 && !todosEventosCanonicos().includes(tipoEvento)) {
    recusar(400, 'Tipo de evento inválido.', 'tipoEvento');
  }

  let inicio: Date | null = null;
  let fim: Date | null = null;
  if (typeof periodoInicio === 'string' && periodoInicio.length > 0) {
    inicio = dataValida(periodoInicio);
    if (!inicio) recusar(400, 'Data inválida.', 'periodoInicio');
  }
  if (typeof periodoFim === 'string' && periodoFim.length > 0) {
    fim = dataValida(periodoFim);
    if (!fim) recusar(400, 'Data inválida.', 'periodoFim');
  }
  if (inicio && fim && inicio.getTime() > fim.getTime()) {
    recusar(400, 'Período inválido: a data inicial não pode ser posterior à data final.', 'periodoInicio');
  }

  if (tamanhoPagina !== undefined && tamanhoPagina !== null && (tamanhoPagina < 1 || tamanhoPagina > 200)) {
    recusar(400, 'O campo Tamanho da página aceita de 1 a 200.', 'tamanhoPagina');
  }
  if (pagina !== undefined && pagina !== null && pagina < 1) {
    recusar(400, 'O campo Página deve ser 1 ou maior.', 'pagina');
  }

  return { periodoInicio: inicio, periodoFim: fim };
}

/** Aplica os filtros combinados (tipoEvento, codigoAcao, período) sobre a lista unificada, antes da ordenação e da página. */
function aplicarFiltros(
  itens: ItemHistoricoBruto[],
  filtros: { tipoEvento?: string | null; codigoAcao?: string | null; periodoInicio: Date | null; periodoFim: Date | null },
): ItemHistoricoBruto[] {
  let resultado = itens;
  if (typeof filtros.tipoEvento === 'string' && filtros.tipoEvento.length > 0) {
    resultado = resultado.filter((item) => item.tipoEvento === filtros.tipoEvento);
  }
  if (typeof filtros.codigoAcao === 'string' && filtros.codigoAcao.length > 0) {
    const codigoAcao = filtros.codigoAcao.toLowerCase();
    resultado = resultado.filter((item) => item.codigoAcao === codigoAcao);
  }
  if (filtros.periodoInicio) {
    const inicio = filtros.periodoInicio.getTime();
    resultado = resultado.filter((item) => new Date(item.dataHora).getTime() >= inicio);
  }
  if (filtros.periodoFim) {
    const fim = filtros.periodoFim.getTime();
    resultado = resultado.filter((item) => new Date(item.dataHora).getTime() <= fim);
  }
  return resultado;
}

/**
 * Orquestra a consulta unificada: valida a forma e a existência da Tratativa e da Ação (quando filtrada),
 * valida os filtros semânticos e a paginação, lê HistoricoTratativa e HistoricoAcoes filtrados por
 * `tratativa_codigo`, normaliza para o item unificado, aplica os filtros combinados, ordena de forma
 * determinística e pagina por fatia (R1, R4, R6, R7; etapas 1 e 2).
 */
export async function consultarHistoricoUnificado(
  tratativa: string | null | undefined,
  opcoes: {
    tipoEvento?: string | null;
    codigoAcao?: string | null;
    periodoInicio?: string | null;
    periodoFim?: string | null;
    tamanhoPagina?: number | null;
    pagina?: number | null;
  } = {},
): Promise<ItemHistoricoBruto[]> {
  const { tipoEvento, codigoAcao, periodoInicio, periodoFim, tamanhoPagina, pagina } = opcoes;

  // Etapa 4 (D10): forma do parâmetro `tratativa`.
  if (typeof tratativa !== 'string' || !codigoValido(tratativa)) {
    recusar(400, 'Código inválido.', 'tratativa');
  }
  const codigo = (tratativa as string).toLowerCase();

  // Etapa 4 (D10): forma do parâmetro `codigoAcao`, quando informado.
  if (typeof codigoAcao === 'string' && codigoAcao.length > 0 && !codigoValido(codigoAcao)) {
    recusar(400, 'Código de ação inválido.', 'codigoAcao');
  }

  // Etapa 5 (D10): existência da Tratativa.
  if (!(await existeTratativa(codigo))) {
    recusar(404, 'Tratativa não encontrada.', 'tratativa');
  }

  // Etapa 5/6 (D10): existência e pertinência de codigoAcao; filtros semânticos e paginação.
  const { periodoInicio: inicio, periodoFim: fim } = await validarFiltros(codigo, {
    tipoEvento, codigoAcao, periodoInicio, periodoFim, tamanhoPagina, pagina,
  });

  const [linhasTratativa, linhasAcoes] = await Promise.all([
    cds.db.run(
      SELECT.from(`${NS}.HistoricoTratativa`).columns(...COLUNAS_TRATATIVA).where({ tratativa_codigo: codigo }),
    ) as Promise<LinhaHistoricoTratativa[]>,
    cds.db.run(
      SELECT.from(`${NS}.HistoricoAcoes`).columns(...COLUNAS_ACOES).where({ tratativa_codigo: codigo }),
    ) as Promise<LinhaHistoricoAcoes[]>,
  ]);

  const itens = aplicarFiltros(
    [...linhasTratativa.map(normalizarLinhaTratativa), ...linhasAcoes.map(normalizarLinhaAcao)],
    { tipoEvento, codigoAcao, periodoInicio: inicio, periodoFim: fim },
  ).sort(compararItens);

  const tamanho = tamanhoPagina ?? PADRAO_TAMANHO;
  const pag = pagina ?? 1;
  const offset = (pag - 1) * tamanho;
  return itens.slice(offset, offset + tamanho);
}
