import { type Envia, type Resposta } from './tratativas';

// Helpers de teste para as operações de Templates de Ações (spec templates-de-acoes).
// Sem expect(): toda asserção pertence estritamente aos arquivos *.test.ts (CONVENCOES.md).

const ADMIN = '/api/administracao/v1';
const BASE = '/api/tratativa/v1';

export type Consulta = (url: string, opcoes?: unknown) => Promise<Resposta>;

// --- Gestão cadastral (AdministracaoService; etapa 1) ---

export function criarTemplate(POST: Envia, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${ADMIN}/criarTemplate`, dados, como);
}

export function editarTemplate(POST: Envia, dados: Record<string, unknown>, como: unknown): Promise<Resposta> {
  return POST(`${ADMIN}/editarTemplate`, dados, como);
}

export function ativarTemplate(POST: Envia, id: string, como: unknown): Promise<Resposta> {
  return POST(`${ADMIN}/ativarTemplate`, { id }, como);
}

export function desativarTemplate(POST: Envia, id: string, como: unknown): Promise<Resposta> {
  return POST(`${ADMIN}/desativarTemplate`, { id }, como);
}

// Monta a URL de function com parâmetros nomeados; String entre aspas simples com encodeURIComponent
// e aspas internas duplicadas (CONVENCOES.md #9); outros tipos sem aspas; omitido não entra na URL.
function montarUrlFuncao(base: string, params: Record<string, unknown> = {}): string {
  const parametros = Object.entries(params)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([chave, valor]) => {
      if (typeof valor === 'string') {
        const escapado = valor.replace(/'/g, "''");
        return `${chave}='${encodeURIComponent(escapado)}'`;
      }
      return `${chave}=${valor}`;
    })
    .join(',');
  return `${base}(${parametros})`;
}

async function extrairValue(r: Resposta): Promise<Resposta> {
  const dataValue = r.data?.value !== undefined ? r.data.value : r.data;
  return { status: r.status, data: dataValue };
}

// --- Consultas administrativas (AdministracaoService; usadas pela etapa 1 para validar persistência) ---

export async function listarTemplatesAdmin(
  GET: Consulta,
  params: Record<string, unknown> = {},
  como: unknown,
): Promise<Resposta> {
  const r = await GET(montarUrlFuncao(`${ADMIN}/listarTemplates`, params), como);
  return extrairValue(r);
}

export function consultarTemplateAdmin(GET: Consulta, id: string, como: unknown): Promise<Resposta> {
  return GET(montarUrlFuncao(`${ADMIN}/consultarTemplate`, { template: id }), como);
}

// --- Consultas públicas (TratativaService; etapa 2) ---

export async function listarTemplates(
  GET: Consulta,
  params: Record<string, unknown> = {},
  como: unknown,
): Promise<Resposta> {
  const r = await GET(montarUrlFuncao(`${BASE}/listarTemplates`, params), como);
  return extrairValue(r);
}

export function consultarTemplate(GET: Consulta, template: string, como: unknown): Promise<Resposta> {
  return GET(montarUrlFuncao(`${BASE}/consultarTemplate`, { template }), como);
}

// --- Aplicação em Tratativa (TratativaService; etapa 3) ---

export function aplicarTemplate(
  POST: Envia,
  tratativa: string,
  dados: Record<string, unknown>,
  como: unknown,
): Promise<Resposta> {
  return POST(`${BASE}/Tratativas(${tratativa})/aplicarTemplateTratativa`, dados, como);
}
