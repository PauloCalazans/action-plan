import cds from '@sap/cds';
import { normalizarMatricula, obterMatriculaUsuario } from './identidade';

const NS = 'br.com.calazanstec';
const SERVICE = 'TratativaAppService';
const CAMPOS_MATRICULA = new Set(['solicitante', 'responsavelprincipal', 'participante', 'responsavel']);

type Entidade = {
  name?: string;
  elements?: Record<string, Elemento>;
};

type Elemento = {
  type?: string;
  key?: boolean;
  target?: string;
  _target?: Entidade;
  cardinality?: { max?: number | string };
  is2many?: boolean;
  '@PersonalData.IsPotentiallyPersonal'?: boolean;
};

type Linha = Record<string, unknown>;
type Consulta = {
  SELECT?: Select;
  where?: (...condicoes: unknown[]) => unknown;
};
type Select = {
  from?: From;
  columns?: unknown[];
  where?: unknown;
  having?: unknown;
  groupBy?: unknown[];
  orderBy?: unknown[];
  limit?: unknown;
  search?: unknown;
  [chave: string]: unknown;
};
type From = { ref?: unknown[]; SELECT?: Select; [chave: string]: unknown };
type Segmento = string | { id?: string; where?: unknown; [chave: string]: unknown };

export interface ContextoMascara {
  gestor: boolean;
}

type RegraMascara = {
  campos: string[];
  liberados?: string[];
  filtraveis?: string[];
  leitura?: 'livre' | 'porVinculo' | 'soGestor';
  aninhada?: 'mascarar' | 'omitir';
  fonte: string;
  navegacaoPorVinculo?: { origem: string; elemento: string };
  aplicar(linha: Linha, contexto: ContextoMascara): void;
};

function mascararTratativa(linha: Linha): void {
  linha.descricao = null;
  linha.solicitante = null;
  linha.responsavelPrincipal = null;
  if (Array.isArray(linha.participantes)) linha.participantes = [];
}

function mascararParticipante(linha: Linha): void {
  linha.matricula = null;
}

function mascararAcao(linha: Linha): void {
  linha.responsavel = null;
}

function mascararEvidencia(linha: Linha): void {
  linha.autorAnexo = null;
  linha.autorRemocao = null;
}

function mascararComentario(linha: Linha): void {
  linha.mencoes = [];
}

function mascararMencao(linha: Linha): void {
  linha.matricula = null;
}

function mascararHistorico(linha: Linha): void {
  linha.autor = null;
  linha.justificativa = null;
  const campo = typeof linha.campo === 'string' ? linha.campo.toLowerCase() : '';
  if (!campo || CAMPOS_MATRICULA.has(campo)) {
    linha.valorAnterior = null;
    linha.valorNovo = null;
  }
}

export const REGRAS_MASCARA: Record<string, RegraMascara> = {
  [`${SERVICE}.Tratativas`]: {
    campos: ['descricao', 'solicitante', 'responsavelPrincipal'],
    fonte: `${NS}.Tratativas`,
    aplicar: mascararTratativa,
  },
  [`${SERVICE}.Acoes`]: {
    campos: ['responsavel'],
    fonte: `${NS}.Acoes`,
    aplicar: mascararAcao,
  },
  [`${SERVICE}.Participantes`]: {
    campos: ['matricula'],
    fonte: `${NS}.ParticipantesTratativa`,
    aplicar: mascararParticipante,
  },
  [`${SERVICE}.Evidencias`]: {
    campos: ['nomeArquivo', 'descricao', 'autorAnexo', 'autorRemocao'],
    liberados: ['nomeArquivo', 'descricao'],
    leitura: 'porVinculo',
    aninhada: 'omitir',
    fonte: `${NS}.Evidencias`,
    aplicar: mascararEvidencia,
  },
  [`${SERVICE}.Comentarios`]: {
    campos: ['texto', 'autor'],
    liberados: ['texto', 'autor'],
    leitura: 'soGestor',
    aninhada: 'omitir',
    fonte: `${NS}.Comentarios`,
    navegacaoPorVinculo: { origem: `${SERVICE}.Tratativas`, elemento: 'comentarios' },
    aplicar: mascararComentario,
  },
  [`${SERVICE}.Historico`]: {
    campos: ['autor', 'justificativa', 'valorAnterior', 'valorNovo'],
    liberados: ['valorAnterior', 'valorNovo'],
    filtraveis: [],
    leitura: 'porVinculo',
    aninhada: 'omitir',
    fonte: `${NS}.HistoricoTratativa`,
    aplicar: mascararHistorico,
  },
  [`${SERVICE}.MencoesComentario`]: {
    campos: ['matricula'],
    leitura: 'soGestor',
    aninhada: 'omitir',
    fonte: `${NS}.MencoesComentario`,
    aplicar: mascararMencao,
  },
};

function rejeitar(req: cds.Request, status = 403): never {
  req.reject(status, status === 404 ? undefined : 'Acesso negado.');
  throw new Error('A requisição foi rejeitada.');
}

function entidadePorNome(nome: string | undefined): Entidade | undefined {
  if (!nome) return undefined;
  const definicoes = cds.model?.definitions as Record<string, Entidade> | undefined;
  if (!definicoes) return undefined;
  if (definicoes[nome]) return definicoes[nome];
  const correspondencias = Object.values(definicoes).filter((definicao) => definicao.name === nome);
  return correspondencias.length === 1 ? correspondencias[0] : undefined;
}

function idDoSegmento(segmento: Segmento): string | undefined {
  if (typeof segmento === 'string') return segmento;
  return typeof segmento.id === 'string' ? segmento.id : undefined;
}

function regraDa(entidade: Entidade | undefined): RegraMascara | undefined {
  return entidade?.name ? REGRAS_MASCARA[entidade.name] : undefined;
}

function ehAssociacao(elemento: Elemento): boolean {
  return !!(elemento.target || elemento._target);
}

function ehParaMuitos(elemento: Elemento): boolean {
  return elemento.is2many === true || elemento.cardinality?.max === '*' || elemento.cardinality?.max === Infinity;
}

function percorrerLinhas(entidade: Entidade, resultado: unknown, acao: (linha: Linha) => void): void {
  const linhas = Array.isArray(resultado) ? resultado : [resultado];
  for (const item of linhas) {
    if (item && typeof item === 'object' && !Array.isArray(item)) acao(item as Linha);
  }
}

export function aplicarMascaras(
  entidade: cds.entity,
  resultado: unknown,
  contexto: ContextoMascara,
): void {
  if (contexto.gestor) return;
  const definicao = entidade as unknown as Entidade;
  percorrerLinhas(definicao, resultado, (linha) => {
    const regra = regraDa(definicao);
    regra?.aplicar(linha, contexto);
    for (const [nome, elemento] of Object.entries(definicao.elements ?? {})) {
      if (elemento['@PersonalData.IsPotentiallyPersonal'] && !regra?.campos.includes(nome)) {
        linha[nome] = null;
      }
      if (!ehAssociacao(elemento) || !(nome in linha)) continue;
      const alvo = elemento._target ?? entidadePorNome(elemento.target);
      if (!alvo) {
          linha[nome] = ehParaMuitos(elemento) ? [] : null;
        continue;
      }
      if (regraDa(alvo)?.aninhada === 'omitir') {
        linha[nome] = ehParaMuitos(elemento) ? [] : null;
      } else {
        aplicarMascaras(alvo as cds.entity, linha[nome], contexto);
      }
    }
  });
}

function falhar(req: cds.Request): never {
  return rejeitar(req);
}

function obterAlvoElemento(elemento: Elemento): Entidade | undefined {
  return elemento._target ?? entidadePorNome(elemento.target);
}

function resolverRef(
  req: cds.Request,
  base: Entidade,
  referencia: unknown,
  varrerExpressao: (expressao: unknown, entidade: Entidade) => void,
  bloquearTravessia: boolean,
): Entidade | undefined {
  if (!Array.isArray(referencia) || referencia.length === 0) falhar(req);
  let entidade: Entidade | undefined = base;
  let entidadeDoElementoFinal: Entidade | undefined;
  let elementoFinal: Elemento | undefined;
  for (const segmento of referencia) {
    const id = idDoSegmento(segmento as Segmento);
    if (!id || !entidade?.elements) falhar(req);
    entidadeDoElementoFinal = entidade;
    const elemento = entidade.elements[id];
    if (!elemento) falhar(req);
    elementoFinal = elemento;
    const alvo = obterAlvoElemento(elemento);
    if (alvo) {
      if (bloquearTravessia && regraDa(alvo)?.leitura && regraDa(alvo)?.leitura !== 'livre') {
        falhar(req);
      }
      entidade = alvo;
      const where = typeof segmento === 'object' && segmento !== null
        ? (segmento as { where?: unknown }).where
        : undefined;
      if (where !== undefined) varrerExpressao(where, entidade);
    } else {
      entidade = undefined;
      const where = typeof segmento === 'object' && segmento !== null
        ? (segmento as { where?: unknown }).where
        : undefined;
      if (where !== undefined) falhar(req);
    }
  }
  if (elementoFinal && !obterAlvoElemento(elementoFinal)) {
    const regra = regraDa(entidadeDoElementoFinal);
    const liberados = regra?.filtraveis ?? regra?.liberados ?? [];
    const nome = idDoSegmento(referencia[referencia.length - 1] as Segmento);
    if (
      nome &&
      ((regra?.campos.includes(nome) && !liberados.includes(nome)) ||
        (elementoFinal['@PersonalData.IsPotentiallyPersonal'] && !regra?.campos.includes(nome)))
    ) {
      falhar(req);
    }
  } else if (elementoFinal && bloquearTravessia) {
    const alvo = obterAlvoElemento(elementoFinal);
    if (regraDa(alvo)?.leitura && regraDa(alvo)?.leitura !== 'livre') falhar(req);
  }
  return entidade;
}

function resolverColuna(
  req: cds.Request,
  base: Entidade,
  referencia: unknown,
  varrerExpressao: (expressao: unknown, entidade: Entidade) => void,
): Entidade | undefined {
  if (!Array.isArray(referencia) || referencia.length === 0) falhar(req);
  let entidade: Entidade | undefined = base;
  for (const segmento of referencia) {
    const id = idDoSegmento(segmento as Segmento);
    if (!id || !entidade?.elements) falhar(req);
    const elemento: Elemento | undefined = entidade.elements[id];
    if (!elemento) falhar(req);
    entidade = obterAlvoElemento(elemento);
    const where = typeof segmento === 'object' && segmento !== null
      ? (segmento as { where?: unknown }).where
      : undefined;
    if (where !== undefined) {
      if (!entidade) falhar(req);
      varrerExpressao(where, entidade);
    }
    if (!entidade && segmento !== referencia[referencia.length - 1]) falhar(req);
  }
  return entidade;
}

function validarExpressao(
  req: cds.Request,
  expressao: unknown,
  base: Entidade,
  varrerExpressao: (expressao: unknown, entidade: Entidade) => void,
): void {
  if (Array.isArray(expressao)) {
    for (const item of expressao) {
      if (typeof item === 'string') continue;
      validarExpressao(req, item, base, varrerExpressao);
    }
    return;
  }
  if (!expressao || typeof expressao !== 'object') falhar(req);
  const item = expressao as Record<string, unknown>;
  const chaves = Object.keys(item);
  if (chaves.includes('SELECT')) falhar(req);
  if (Object.hasOwn(item, 'val')) {
    if (chaves.some((chave) => !['val', 'literal'].includes(chave))) falhar(req);
    return;
  }
  if (item.param === true) return;
  if (Object.hasOwn(item, 'ref')) {
    if (chaves.some((chave) => !['ref', 'as', 'sort', 'nulls', 'implicit'].includes(chave))) falhar(req);
    resolverRef(req, base, item.ref, varrerExpressao, true);
    return;
  }
  if (Object.hasOwn(item, 'xpr')) {
    if (chaves.some((chave) => !['xpr'].includes(chave))) falhar(req);
    validarExpressao(req, item.xpr, base, varrerExpressao);
    return;
  }
  if (Object.hasOwn(item, 'list')) {
    if (chaves.some((chave) => !['list'].includes(chave))) falhar(req);
    validarExpressao(req, item.list, base, varrerExpressao);
    return;
  }
  if (Object.hasOwn(item, 'func')) {
    if (chaves.some((chave) => !['func', 'args'].includes(chave)) || typeof item.func !== 'string') falhar(req);
    validarExpressao(req, item.args, base, varrerExpressao);
    return;
  }
  falhar(req);
}

function alvoDaOrigem(req: cds.Request, origem: From | undefined, fallback: Entidade): Entidade {
  if (!origem) falhar(req);
  if (origem.SELECT) return alvoDaOrigem(req, origem.SELECT.from, fallback);
  if (!Array.isArray(origem.ref) || origem.ref.length === 0) falhar(req);
  const primeiro = idDoSegmento(origem.ref[0] as Segmento);
  let entidade: Entidade = entidadePorNome(primeiro) ?? falhar(req);
  for (const segmento of origem.ref.slice(1)) {
    const id = idDoSegmento(segmento as Segmento);
    const elemento: Elemento | undefined = id ? entidade.elements?.[id] : undefined;
    const alvo: Entidade | undefined = elemento ? obterAlvoElemento(elemento) : undefined;
    entidade = alvo ?? falhar(req);
  }
  return entidade ?? fallback;
}

function varrerSelect(
  req: cds.Request,
  select: Select,
  fallback: Entidade,
  varrerExpressao: (expressao: unknown, entidade: Entidade) => void,
): void {
  const permitidas = new Set([
    'from',
    'columns',
    'where',
    'having',
    'groupBy',
    'orderBy',
    'limit',
    'search',
    'one',
    'distinct',
    'count',
    'excluding',
    'mixin',
    'localized',
    'forUpdate',
    'forShareLock',
    'as',
  ]);
  if (Object.keys(select).some((chave) => !permitidas.has(chave))) falhar(req);
  const entidade = alvoDaOrigem(req, select.from, fallback);
  const from = select.from;
  if (from?.ref) {
    let atual: Entidade = entidadePorNome(idDoSegmento(from.ref[0] as Segmento)) ?? falhar(req);
    for (let indice = 0; indice < from.ref.length; indice += 1) {
      const segmento = from.ref[indice];
      const where = typeof segmento === 'object' && segmento !== null
        ? (segmento as { where?: unknown }).where
        : undefined;
      if (where !== undefined) varrerExpressao(where, atual);
      if (indice < from.ref.length - 1) {
        const id = idDoSegmento(from.ref[indice + 1] as Segmento);
        const elemento: Elemento | undefined = id ? atual.elements?.[id] : undefined;
        const alvo: Entidade | undefined = elemento ? obterAlvoElemento(elemento) : undefined;
        atual = alvo ?? falhar(req);
      }
    }
  } else if (from?.SELECT) {
    varrerSelect(req, from.SELECT, entidade, varrerExpressao);
  }
  if (select.where !== undefined) varrerExpressao(select.where, entidade);
  if (select.having !== undefined) varrerExpressao(select.having, entidade);
  if (select.groupBy !== undefined) varrerExpressao(select.groupBy, entidade);
  if (select.orderBy !== undefined) varrerExpressao(select.orderBy, entidade);
  if (select.columns !== undefined) {
    if (!Array.isArray(select.columns)) falhar(req);
    for (const coluna of select.columns) {
      if (coluna === '*') continue;
      if (!coluna || typeof coluna !== 'object') falhar(req);
      const item = coluna as Record<string, unknown>;
      if (item.val === 1 && item.as === '$parent' && Object.keys(item).every((chave) => ['val', 'as'].includes(chave))) {
        continue;
      }
      if (Object.hasOwn(item, 'ref')) {
        if (Array.isArray(item.ref) && item.ref.length === 1 && item.ref[0] === '*') continue;
        if (
          Object.keys(item).some((chave) =>
            !['ref', 'as', 'expand', 'inline', 'where', 'having', 'groupBy', 'orderBy', 'limit'].includes(chave),
          )
        ) {
          falhar(req);
        }
        const baseExpandida = resolverColuna(req, entidade, item.ref, varrerExpressao);
        const expansao = item.expand ?? item.inline;
        if (
          expansao !== undefined ||
          item.where !== undefined ||
          item.having !== undefined ||
          item.groupBy !== undefined ||
          item.orderBy !== undefined
        ) {
          if (!baseExpandida || (expansao !== undefined && !Array.isArray(expansao))) falhar(req);
          varrerSelect(req, {
            from: { ref: [baseExpandida.name ?? ''] },
            columns: Array.isArray(expansao) ? expansao : undefined,
            where: item.where,
            having: item.having,
            groupBy: item.groupBy as unknown[] | undefined,
            orderBy: item.orderBy as unknown[] | undefined,
            limit: item.limit,
          }, baseExpandida, varrerExpressao);
        }
        if (item.as !== undefined) resolverRef(req, entidade, item.ref, varrerExpressao, true);
      } else if (item.func === 'count' && item.as === '$count' && Array.isArray(item.args)) {
        validarExpressao(req, item.args, entidade, varrerExpressao);
      } else if (Object.hasOwn(item, 'xpr') || Object.hasOwn(item, 'func')) {
        if (Object.keys(item).some((chave) => !['xpr', 'func', 'args', 'as'].includes(chave))) falhar(req);
        validarExpressao(req, item, entidade, varrerExpressao);
      } else {
        falhar(req);
      }
    }
  }
}

function varrerQuery(req: cds.Request): void {
  const consulta = req.query as unknown as Consulta;
  const select = consulta.SELECT;
  const entidade = req.target as unknown as Entidade;
  if (!select) return;
  const varrer = (expressao: unknown, base: Entidade) => validarExpressao(req, expressao, base, varrer);
  const from = select.from;
  if (from?.ref) {
    let atual: Entidade = entidadePorNome(idDoSegmento(from.ref[0] as Segmento)) ?? falhar(req);
    for (let indice = 0; indice < from.ref.length; indice += 1) {
      const segmento = from.ref[indice];
      const where = typeof segmento === 'object' && segmento !== null
        ? (segmento as { where?: unknown }).where
        : undefined;
      if (where !== undefined) varrer(where, atual);
      if (indice < from.ref.length - 1) {
        const id = idDoSegmento(from.ref[indice + 1] as Segmento);
        const elemento: Elemento | undefined = id ? atual.elements?.[id] : undefined;
        const alvo: Entidade | undefined = elemento ? obterAlvoElemento(elemento) : undefined;
        atual = alvo ?? falhar(req);
      }
    }
  }
  varrerSelect(req, select, entidade, varrer);
}

function expressaoCaminho(caminho: unknown): unknown {
  return Array.isArray(caminho) ? caminho : undefined;
}

function valorDaChave(caminho: unknown, chave: string): string | undefined {
  if (!Array.isArray(caminho)) return undefined;
  for (let indice = 0; indice < caminho.length - 1; indice += 1) {
    const item = caminho[indice];
    const operador = caminho[indice + 1];
    const seguinte = caminho[indice + 2];
    if (
      item &&
      typeof item === 'object' &&
      Array.isArray((item as { ref?: unknown }).ref) &&
      ((item as { ref: unknown[] }).ref[0] === chave || (item as { ref: unknown[] }).ref[0] === 'codigo') &&
      (operador === '=' || operador === '==') &&
      seguinte &&
      typeof seguinte === 'object' &&
      Object.hasOwn(seguinte, 'val')
    ) {
      const valor = (seguinte as { val?: unknown }).val;
      return typeof valor === 'string' ? valor : undefined;
    }
  }
  return undefined;
}

async function codigosTratativasVinculadas(matricula: string): Promise<string[]> {
  const responsaveis = (await SELECT.from(`${NS}.Tratativas`)
    .columns('codigo')
    .where('lower(trim(responsavelPrincipal)) =', matricula)) as Array<{ codigo: string }>;
  const participantes = (await SELECT.from(`${NS}.ParticipantesTratativa`)
    .columns('tratativa_codigo')
    .where('lower(trim(matricula)) =', matricula)) as Array<{ tratativa_codigo: string }>;
  return [...new Set([...responsaveis.map((item) => item.codigo), ...participantes.map((item) => item.tratativa_codigo)])];
}

async function codigosAcoesVinculadas(matricula: string): Promise<string[]> {
  const acoes = (await SELECT.from(`${NS}.Acoes`)
    .columns('codigo')
    .where('lower(trim(responsavel)) =', matricula)) as Array<{ codigo: string }>;
  return acoes.map((acao) => acao.codigo);
}

function whereConsulta(req: cds.Request): Consulta {
  return req.query as unknown as Consulta;
}

function injetarLista(req: cds.Request, coluna: string, valores: string[]): void {
  whereConsulta(req).where?.({ [coluna]: { in: valores.length ? valores : [''] } });
}

async function filtrarEvidencias(req: cds.Request, matricula: string): Promise<void> {
  const codigos = await codigosAcoesVinculadas(matricula);
  whereConsulta(req).where?.({ ativo: true });
  injetarLista(req, 'acao_codigo', codigos);
}

async function filtrarHistorico(req: cds.Request, matricula: string): Promise<void> {
  injetarLista(req, 'tratativa_codigo', await codigosTratativasVinculadas(matricula));
}

async function registroPermitido(
  req: cds.Request,
  entidade: Entidade,
  segmento: Segmento,
  matricula: string,
): Promise<boolean> {
  const regra = regraDa(entidade);
  if (!regra) return true;
  if (regra.leitura === 'soGestor') return false;
  const id = idDoSegmento(segmento);
  if (!id) return false;
  const chaveEntidade = Object.entries(entidade.elements ?? {}).find(([, elemento]) => elemento.key)?.[0];
  const where = typeof segmento === 'object' && segmento !== null
    ? expressaoCaminho(segmento.where)
    : undefined;
  const valorChave = chaveEntidade && valorDaChave(where, chaveEntidade);
  if (!chaveEntidade || !valorChave) return false;
  let query = SELECT.one.from(regra.fonte).where({ [chaveEntidade]: valorChave });
  if (regra.leitura === 'porVinculo') {
    if (entidade.name === `${SERVICE}.Evidencias`) {
      query = query.where({ ativo: true });
      const codigos = await codigosAcoesVinculadas(matricula);
      query = query.where({ acao_codigo: { in: codigos.length ? codigos : [''] } });
    } else if (entidade.name === `${SERVICE}.Historico`) {
      const codigos = await codigosTratativasVinculadas(matricula);
      query = query.where({ tratativa_codigo: { in: codigos.length ? codigos : [''] } });
    }
  }
  return !!(await cds.db.run(query));
}

async function filtrarComentariosDaTratativa(
  req: cds.Request,
  segmentoTratativa: Segmento,
  matricula: string,
): Promise<void> {
  const whereTratativa = typeof segmentoTratativa === 'object' && segmentoTratativa !== null
    ? segmentoTratativa.where
    : undefined;
  const codigoTratativa = valorDaChave(whereTratativa, 'codigo');
  if (!codigoTratativa) rejeitar(req, 404);
  const tratativa = (await SELECT.one.from(`${NS}.Tratativas`)
    .columns('codigo', 'responsavelPrincipal')
    .where({ codigo: codigoTratativa })) as { codigo: string; responsavelPrincipal: string | null } | undefined;
  if (!tratativa) rejeitar(req, 404);

  const ehResponsavelPrincipal =
    normalizarMatricula(tratativa.responsavelPrincipal ?? '') === matricula;
  let ehParticipante = false;
  if (!ehResponsavelPrincipal) {
    const participante = await SELECT.one.from(`${NS}.ParticipantesTratativa`)
      .columns('ID')
      .where({ tratativa_codigo: codigoTratativa })
      .where('lower(trim(matricula)) =', matricula);
    ehParticipante = !!participante;
  }
  const codigosAcoes = await codigosAcoesVinculadas(matricula);
  const comentariosPermitidos: Array<{ codigo: string }> = [];
  if (ehResponsavelPrincipal || ehParticipante) {
    const diretos = (await SELECT.from(`${NS}.Comentarios`)
      .columns('codigo')
      .where({ tratativa_codigo: codigoTratativa, acao_codigo: null })) as Array<{ codigo: string }>;
    comentariosPermitidos.push(...diretos);
  }
  if (codigosAcoes.length) {
    const deAcoes = (await SELECT.from(`${NS}.Comentarios`)
      .columns('codigo')
      .where({ tratativa_codigo: codigoTratativa, acao_codigo: { in: codigosAcoes } })) as Array<{ codigo: string }>;
    comentariosPermitidos.push(...deAcoes);
  }
  injetarLista(req, 'codigo', [...new Set(comentariosPermitidos.map((comentario) => comentario.codigo))]);
}

async function verificarSegmentos(
  req: cds.Request,
  segmentos: unknown[],
  matricula: string,
): Promise<void> {
  let entidade: Entidade = entidadePorNome(idDoSegmento(segmentos[0] as Segmento)) ?? falhar(req);
  for (let indice = 0; indice < segmentos.length - 1; indice += 1) {
    if (indice > 0) {
      const id = idDoSegmento(segmentos[indice] as Segmento);
      const elemento: Elemento | undefined = id ? entidade.elements?.[id] : undefined;
      const alvo: Entidade | undefined = elemento ? obterAlvoElemento(elemento) : undefined;
      entidade = alvo ?? falhar(req);
    }
    const regra = regraDa(entidade);
    if (regra?.leitura === 'soGestor') rejeitar(req);
    if (regra?.leitura === 'porVinculo') {
      const permitido = await registroPermitido(req, entidade, segmentos[indice] as Segmento, matricula);
      if (!permitido) rejeitar(req, 404);
    }
  }
}

function injetarCampoHistorico(entidade: Entidade, select: Select | undefined): void {
  if (!select) return;
  if (entidade.name === `${SERVICE}.Historico` && Array.isArray(select.columns)) {
    const colunas = select.columns as Array<string | Record<string, unknown>>;
    const pedeValores = colunas.some((coluna) =>
      typeof coluna === 'object' && coluna !== null &&
      Array.isArray(coluna.ref) &&
      ['valorAnterior', 'valorNovo'].includes(String(coluna.ref[0])),
    );
    const temCampo = colunas.some((coluna) =>
      coluna === '*' ||
      (typeof coluna === 'object' && coluna !== null &&
        Array.isArray(coluna.ref) && coluna.ref[0] === 'campo'),
    );
    if (pedeValores && !temCampo) colunas.push({ ref: ['campo'] });
  }
  for (const coluna of select.columns ?? []) {
    if (!coluna || typeof coluna !== 'object') continue;
    const item = coluna as { ref?: unknown[]; expand?: unknown[] };
    if (!Array.isArray(item.ref) || !Array.isArray(item.expand)) continue;
    const alvo = resolverAlvoExpandido(entidade, item.ref);
    if (alvo) injetarCampoHistorico(alvo, { columns: item.expand });
  }
}

function resolverAlvoExpandido(entidade: Entidade, referencia: unknown[]): Entidade | undefined {
  let atual: Entidade | undefined = entidade;
  for (const segmento of referencia) {
    const id = idDoSegmento(segmento as Segmento);
    const elemento: Elemento | undefined = id ? atual?.elements?.[id] : undefined;
    atual = elemento ? obterAlvoElemento(elemento) : undefined;
  }
  return atual;
}

export async function restricaoDeLeitura(req: cds.Request): Promise<void> {
  const gestor = req.user.is('GestorTratativa');
  const select = (req.query as unknown as Consulta).SELECT;
  if (!gestor) varrerQuery(req);
  if (req.target.name === `${SERVICE}.Participantes` && select?.search !== undefined) {
    injetarLista(req, 'ID', []);
  }
  if (gestor) return;

  const consulta = whereConsulta(req);
  const querySelect = consulta.SELECT;
  if (!querySelect) return;
  const matricula = normalizarMatricula(obterMatriculaUsuario(req));
  const segmentos = querySelect.from?.ref;
  if (!segmentos?.length) falhar(req);
  const entidadeInicial: Entidade = entidadePorNome(idDoSegmento(segmentos[0] as Segmento)) ?? falhar(req);
  injetarCampoHistorico(req.target as unknown as Entidade, querySelect);

  if (segmentos.length > 1) {
    await verificarSegmentos(req, segmentos, matricula);
    const idFinal = idDoSegmento(segmentos[segmentos.length - 1] as Segmento);
    const regraFinal = regraDa(req.target as unknown as Entidade);
    let entidadeAnterior: Entidade | undefined = entidadeInicial;
    for (const segmento of segmentos.slice(1, -1)) {
      const id = idDoSegmento(segmento as Segmento);
      const elemento: Elemento | undefined = id ? entidadeAnterior?.elements?.[id] : undefined;
      entidadeAnterior = elemento ? obterAlvoElemento(elemento) : undefined;
    }
    if (
      regraFinal?.navegacaoPorVinculo &&
      entidadeAnterior?.name === regraFinal.navegacaoPorVinculo.origem &&
      idFinal === regraFinal.navegacaoPorVinculo.elemento
    ) {
      await filtrarComentariosDaTratativa(req, segmentos[0] as Segmento, matricula);
      return;
    }
  }

  const regra = regraDa(req.target as unknown as Entidade);
  if (regra?.leitura === 'soGestor') rejeitar(req);
  if (regra?.leitura === 'porVinculo') {
    if (req.target.name === `${SERVICE}.Evidencias`) await filtrarEvidencias(req, matricula);
    if (req.target.name === `${SERVICE}.Historico`) await filtrarHistorico(req, matricula);
  }
}
