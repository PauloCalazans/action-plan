import { type Envia, type Resposta } from './tratativas';

// Helper de teste para a function consultarHistoricoTratativa (intent 008).
// Sem expect(): toda asserção pertence aos arquivos de teste (test/CONVENCOES.md).

const BASE = '/api/tratativa/v1';

export type Consulta = (url: string, opcoes?: unknown) => Promise<Resposta>;

export interface FiltrosHistorico {
  tratativa?: string | null;
  tipoEvento?: string | null;
  codigoAcao?: string | null;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  tamanhoPagina?: number | null;
  pagina?: number | null;
}

// Parâmetros UUID (tratativa, codigoAcao) vão sem aspas; String (tipoEvento, periodoInicio,
// periodoFim) vão entre aspas simples com encodeURIComponent e aspas internas duplicadas (CONVENCOES.md #9);
// Integer (tamanhoPagina, pagina) vão sem aspas; parâmetro omitido (null/undefined) não entra na URL.
const PARAMETROS_STRING = new Set(['tipoEvento', 'periodoInicio', 'periodoFim']);

function montarUrl(filtros: FiltrosHistorico): string {
  const parametros = Object.entries(filtros)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([chave, valor]) => {
      if (PARAMETROS_STRING.has(chave)) {
        const escapado = String(valor).replace(/'/g, "''");
        return `${chave}='${encodeURIComponent(escapado)}'`;
      }
      return `${chave}=${valor}`;
    })
    .join(',');
  return `${BASE}/consultarHistoricoTratativa(${parametros})`;
}

// Chama consultarHistoricoTratativa via OData e devolve a resposta crua (status + data),
// já extraindo .value quando a function many devolve o envelope OData padrão.
export async function consultarHistoricoTratativa(
  GET: Consulta,
  filtros: FiltrosHistorico,
  como: unknown,
): Promise<Resposta> {
  const r = await GET(montarUrl(filtros), como);
  const dataValue = r.data?.value !== undefined ? r.data.value : r.data;
  return { status: r.status, data: dataValue };
}

// Reexporta o tipo Envia para quem só precisa montar cenários (actions de outras specs).
export type { Envia };
