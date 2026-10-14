// Operações de linha do TratativaAppService: resolução da Ação/Evidência da linha selecionada e indicações
// de disponibilidade por linha (acoes-nas-entidades, decisões 2, 3 e 7). Sem matrícula nas respostas (LGPD).

import cds from '@sap/cds';
import { Readable } from 'node:stream';
import { codigoValido } from './consulta';
import { processarDownloadEvidencia } from './evidencias-consultas';
import { FORMATOS_ACEITOS, TAMANHO_MAXIMO_ARQUIVO } from './evidencias-validacao';
import { usuarioAutenticadoEhMatricula } from './identidade';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';
const SERVICO = 'TratativaAppService';
const ALTERAVEIS = ['Aberta', 'Em andamento'];
const VIVAS = ['Pendente', 'Em andamento'];

type Segmento = string | { id?: string; where?: unknown };
type EntidadeAlvo = 'Acoes' | 'Evidencias' | 'MinhasAcoes';

export interface AcaoDaLinha {
  codigoAcao: string;
  codigoTratativa: string;
}

export interface EvidenciaDaLinha {
  codigoEvidencia: string;
  codigoAcao: string;
  codigoTratativa: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
}

export interface IndicacoesAcao {
  ocultaOperacoesDaLinha: boolean;
  podeCriarSubacao: boolean;
  podeDelegar: boolean;
  podeAnexarEvidencia: boolean;
  podeComentarAcao: boolean;
  podeIniciarAcao: boolean;
  podeConcluirAcao: boolean;
}

export interface IndicacoesEvidencia {
  ocultaRemover: boolean;
  podeRemover: boolean;
}

export interface RegrasAnexo {
  tamanhoMaximo: number;
  formatos: { extensao: string; tipos: string[] }[];
}

const idDe = (segmento: Segmento): string => (typeof segmento === 'string' ? segmento : String(segmento?.id ?? ''));

function segmentosDe(req: cds.Request): string[] {
  const consulta = req.query as unknown as { SELECT?: { from?: { ref?: Segmento[] } } };
  return (consulta.SELECT?.from?.ref ?? []).map(idDe);
}

function chaveDe(parametro: unknown, nomes: string[]): string {
  if (parametro && typeof parametro === 'object') {
    const registro = parametro as Record<string, unknown>;
    for (const nome of nomes) if (registro[nome] !== undefined) return String(registro[nome]);
    return '';
  }
  return parametro === undefined || parametro === null ? '' : String(parametro);
}

/**
 * Identifica a linha pelos segmentos de `req.query.SELECT.from.ref` (r2, M2-1). Aceita só
 * `<Entidade>(k)` e `Tratativas(t)/<contenção>(k)`; qualquer outra forma é 404.
 */
function resolverCaminho(
  req: cds.Request,
  entidade: EntidadeAlvo,
  contencao: 'acoes' | 'evidencias',
  nomesDaChave: string[],
  mensagem: string,
): { chave: string; tratativa?: string } {
  const ids = segmentosDe(req);
  const params = req.params as unknown[];
  if (ids.length === 1 && params.length === 1 && ids[0] === `${SERVICO}.${entidade}`) {
    return { chave: chaveDe(params[0], nomesDaChave) };
  }
  if (
    ids.length === 2 &&
    params.length === 2 &&
    entidade !== 'MinhasAcoes' &&
    ids[0] === `${SERVICO}.Tratativas` &&
    ids[1] === contencao
  ) {
    return { chave: chaveDe(params[1], nomesDaChave), tratativa: chaveDe(params[0], ['codigo']) };
  }
  return recusar(404, mensagem);
}

/** Ação da linha: 404 para caminho fora do contrato, chave malformada, inexistente ou de outra Tratativa (R14). */
export async function localizarAcaoDaLinha(req: cds.Request): Promise<AcaoDaLinha> {
  const mensagem = 'Ação não encontrada.';
  const entidade: EntidadeAlvo = segmentosDe(req).includes(`${SERVICO}.MinhasAcoes`) ? 'MinhasAcoes' : 'Acoes';
  const { chave, tratativa } = resolverCaminho(req, entidade, 'acoes', ['codigo', 'codigoAcao'], mensagem);
  if (!codigoValido(chave) || (tratativa !== undefined && !codigoValido(tratativa))) recusar(404, mensagem);
  const codigoAcao = chave.toLowerCase();
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'tratativa_codigo').where({ codigo: codigoAcao }),
  )) as { codigo: string; tratativa_codigo: string } | undefined;
  if (!acao) recusar(404, mensagem);
  const codigoTratativa = String(acao.tratativa_codigo).toLowerCase();
  if (tratativa !== undefined && tratativa.toLowerCase() !== codigoTratativa) recusar(404, mensagem);
  return { codigoAcao, codigoTratativa };
}

/** Evidência ativa da linha: 404 nos mesmos casos e também para Evidência inativa (M1). */
export async function localizarEvidenciaDaLinha(req: cds.Request): Promise<EvidenciaDaLinha> {
  const mensagem = 'Evidência não encontrada.';
  const { chave, tratativa } = resolverCaminho(req, 'Evidencias', 'evidencias', ['codigo'], mensagem);
  if (!codigoValido(chave) || (tratativa !== undefined && !codigoValido(tratativa))) recusar(404, mensagem);
  const codigoEvidencia = chave.toLowerCase();
  const evidencia = (await cds.db.run(
    SELECT.one
      .from(`${NS}.Evidencias`)
      .columns('codigo', 'acao_codigo', 'tratativa_codigo', 'ativo', 'nomeArquivo', 'mimeType', 'tamanho')
      .where({ codigo: codigoEvidencia }),
  )) as
    | {
        codigo: string;
        acao_codigo: string;
        tratativa_codigo: string;
        ativo: boolean;
        nomeArquivo: string;
        mimeType: string;
        tamanho: number;
      }
    | undefined;
  if (!evidencia || evidencia.ativo === false) recusar(404, mensagem);
  const codigoTratativa = String(evidencia.tratativa_codigo).toLowerCase();
  if (tratativa !== undefined && tratativa.toLowerCase() !== codigoTratativa) recusar(404, mensagem);
  return {
    codigoEvidencia,
    codigoAcao: String(evidencia.acao_codigo).toLowerCase(),
    codigoTratativa,
    nomeArquivo: evidencia.nomeArquivo,
    mimeType: evidencia.mimeType,
    tamanho: Number(evidencia.tamanho),
  };
}

/** Tipos que o navegador exibe na própria aba; os demais são baixados (R2: na dúvida, baixar). */
const TIPOS_EXIBIVEIS = new Set(['image/jpeg', 'image/pjpeg', 'image/png', 'application/pdf', 'text/plain']);

/**
 * Anexo da Evidência pela propriedade de mídia `conteudo` (caminho direto ou por contenção). Precedência:
 * 404 Evidência, 404 Ação, 403 (autorização dinâmica), auditoria e só então o binário.
 */
export async function servirAnexoEvidencia(req: cds.Request): Promise<void> {
  const { codigoEvidencia, codigoAcao, codigoTratativa, nomeArquivo, mimeType, tamanho } =
    await localizarEvidenciaDaLinha(req);
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('responsavel').where({ codigo: codigoAcao }),
  )) as { responsavel: string | null } | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');
  const conteudo = await processarDownloadEvidencia(
    req,
    { codigoTratativa, codigoAcao, codigoEvidencia, responsavelAcao: acao.responsavel ?? '', mimeType, tamanho },
    'Acesso negado.',
  );
  const disposicao = TIPOS_EXIBIVEIS.has(mimeType.toLowerCase()) ? 'inline' : 'attachment';
  const resposta = (req as unknown as { http?: { res?: { set(nome: string, valor: string): void } } }).http?.res;
  resposta?.set('content-type', mimeType);
  resposta?.set('content-disposition', `${disposicao}; filename="${encodeURIComponent(nomeArquivo)}"`);
  req.reply(Readable.from(conteudo) as never);
}

interface LinhaAcaoBase {
  codigo: string;
  responsavel: string | null;
  status: string;
  acaoMae_codigo: string | null;
  statusTratativa: string;
}

interface LinhaEvidenciaBase {
  codigo: string;
  ativo: boolean;
  responsavelAcao: string | null;
  statusAcao: string;
  statusTratativa: string;
}

const ehResponsavel = (req: cds.Request, responsavel: string | null): boolean =>
  !!responsavel && usuarioAutenticadoEhMatricula(req, responsavel);

/** Indicações das Ações em uma consulta em lote ao banco; nunca lê da linha devolvida (a máscara a anula). */
export async function indicacoesAcoes(req: cds.Request, codigos: string[]): Promise<Map<string, IndicacoesAcao>> {
  const resultado = new Map<string, IndicacoesAcao>();
  if (!codigos.length) return resultado;
  const gestor = req.user.is('GestorTratativa');
  const base = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`)
      .columns('codigo', 'responsavel', 'status', 'acaoMae_codigo', 'tratativa.status as statusTratativa')
      .where({ codigo: { in: codigos } }),
  )) as LinhaAcaoBase[];
  for (const acao of base) {
    const alteravel = ALTERAVEIS.includes(acao.statusTratativa);
    const viva = VIVAS.includes(acao.status);
    const oculta = !gestor && !ehResponsavel(req, acao.responsavel);
    const opera = !oculta && alteravel && viva;
    resultado.set(acao.codigo, {
      ocultaOperacoesDaLinha: oculta,
      podeCriarSubacao: gestor && alteravel && viva && !acao.acaoMae_codigo,
      podeDelegar: gestor && alteravel && viva,
      podeAnexarEvidencia: opera,
      podeComentarAcao: opera,
      podeIniciarAcao: !oculta && alteravel && acao.status === 'Pendente',
      podeConcluirAcao: opera,
    });
  }
  return resultado;
}

/** Indicações das Evidências (Remover), calculadas no banco a partir da Ação dona. */
export async function indicacoesEvidencias(
  req: cds.Request,
  codigos: string[],
): Promise<Map<string, IndicacoesEvidencia>> {
  const resultado = new Map<string, IndicacoesEvidencia>();
  if (!codigos.length) return resultado;
  const gestor = req.user.is('GestorTratativa');
  const base = (await cds.db.run(
    SELECT.from(`${NS}.Evidencias`)
      .columns(
        'codigo',
        'ativo',
        'acao.responsavel as responsavelAcao',
        'acao.status as statusAcao',
        'tratativa.status as statusTratativa',
      )
      .where({ codigo: { in: codigos } }),
  )) as LinhaEvidenciaBase[];
  for (const evidencia of base) {
    const oculta = !gestor && !ehResponsavel(req, evidencia.responsavelAcao);
    resultado.set(evidencia.codigo, {
      ocultaRemover: oculta,
      podeRemover:
        !oculta &&
        evidencia.ativo === true &&
        ALTERAVEIS.includes(evidencia.statusTratativa) &&
        VIVAS.includes(evidencia.statusAcao),
    });
  }
  return resultado;
}

/** Regras de anexo (evidencias R3 e R4): a interface não tem lista própria. */
export function regrasAnexo(): RegrasAnexo {
  return {
    tamanhoMaximo: TAMANHO_MAXIMO_ARQUIVO,
    formatos: Object.entries(FORMATOS_ACEITOS).map(([extensao, tipos]) => ({ extensao, tipos: [...tipos] })),
  };
}
