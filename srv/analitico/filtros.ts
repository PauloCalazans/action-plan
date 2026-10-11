import { recusar } from '../tratativa/recusa';

type Requisicao = {
  data?: unknown;
  http?: { req?: { query?: unknown } };
};

type Linha = Record<string, unknown>;

const CRITICIDADES = new Set(['Baixa', 'Média', 'Alta', 'Crítica']);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function parametros(req: Requisicao): Record<string, unknown> {
  const query = req.http?.req?.query;
  return typeof query === 'object' && query !== null ? query as Record<string, unknown> : {};
}

function valor(parametrosOdata: Record<string, unknown>, nome: string): string | undefined {
  const valor = parametrosOdata[nome];
  return typeof valor === 'string' ? valor : undefined;
}

function dataValida(data: unknown): data is string {
  if (typeof data !== 'string' || !DATA_ISO.test(data)) return false;
  return new Date(`${data}T00:00:00.000Z`).toISOString().slice(0, 10) === data;
}

function filtroCriticidade(filtro: string | undefined): string | undefined {
  if (!filtro) return undefined;
  const encontrado = /\bcriticidade\s+eq\s+'((?:''|[^'])*)'/i.exec(filtro);
  return encontrado?.[1].replace(/''/g, "'");
}

export function validarFiltros(req: Requisicao): void {
  const data = typeof req.data === 'object' && req.data !== null ? req.data as Record<string, unknown> : {};

  for (const campo of ['periodoInicio', 'periodoFim', 'dataCorte']) {
    if (data[campo] !== undefined && !dataValida(data[campo])) {
      recusar(400, 'Data inválida.', campo);
    }
  }

  if (
    typeof data.periodoInicio === 'string' &&
    typeof data.periodoFim === 'string' &&
    data.periodoInicio > data.periodoFim
  ) {
    recusar(400, 'Período inválido: a data inicial não pode ser posterior à data final.', 'periodoInicio');
  }

  const parametrosOdata = parametros(req);
  const criticidade = filtroCriticidade(valor(parametrosOdata, '$filter'));
  if (criticidade !== undefined && !CRITICIDADES.has(criticidade)) {
    recusar(400, 'Criticidade inválida: use Baixa, Média, Alta ou Crítica.', 'criticidade');
  }

  const top = valor(parametrosOdata, '$top');
  if (top !== undefined && (!/^\d+$/.test(top) || Number(top) < 1 || Number(top) > 1000)) {
    recusar(400, 'O campo Tamanho da página aceita de 1 a 1000.', '$top');
  }
}

function aplicarFiltro(linhas: Linha[], filtro: string | undefined): Linha[] {
  if (!filtro) return linhas;
  const comparacao = /\b([A-Za-z_]\w*)\s+(eq|ne)\s+'((?:''|[^'])*)'/i.exec(filtro);
  if (!comparacao) return linhas;

  const [, campo, operador, valorComparado] = comparacao;
  const esperado = valorComparado.replace(/''/g, "'");
  return linhas.filter((linha) => {
    const corresponde = linha[campo] === esperado;
    return operador.toLowerCase() === 'eq' ? corresponde : !corresponde;
  });
}

function aplicarOrdenacao(linhas: Linha[], orderby: string | undefined): Linha[] {
  if (!orderby) return linhas;
  const criterios = orderby.split(',').map((criterio) => {
    const [campo, direcao = 'asc'] = criterio.trim().split(/\s+/);
    return { campo, descendente: direcao.toLowerCase() === 'desc' };
  });
  return [...linhas].sort((esquerda, direita) => {
    for (const { campo, descendente } of criterios) {
      const comparacao = String(esquerda[campo] ?? '').localeCompare(String(direita[campo] ?? ''), 'pt-BR');
      if (comparacao) return descendente ? -comparacao : comparacao;
    }
    return 0;
  });
}

function aplicarSelecao(linhas: Linha[], select: string | undefined): Linha[] {
  if (!select) return linhas;
  const campos = select.split(',').map((campo) => campo.trim()).filter(Boolean);
  return linhas.map((linha) =>
    Object.fromEntries(campos.filter((campo) => campo in linha).map((campo) => [campo, linha[campo]])),
  );
}

export function aplicarOpcoesOdata(resultado: unknown, req: Requisicao): unknown {
  if (!Array.isArray(resultado)) return resultado;

  const parametrosOdata = parametros(req);
  const linhas = aplicarSelecao(
    aplicarOrdenacao(
      aplicarFiltro(resultado as Linha[], valor(parametrosOdata, '$filter')),
      valor(parametrosOdata, '$orderby'),
    ),
    valor(parametrosOdata, '$select'),
  );
  const inicio = Number(valor(parametrosOdata, '$skip') ?? 0);
  const top = valor(parametrosOdata, '$top');
  return linhas.slice(inicio, top === undefined ? undefined : inicio + Number(top));
}
