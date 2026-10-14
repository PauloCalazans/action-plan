import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import { agora, dataCivil } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { obterMatriculaUsuario } from './identidade';
import { registrarHistorico, validarAutor } from './historico';
import { recusar } from './recusa';
import { usuarioEhValidadorHabilitado } from './validador-tecnico';

const NS = 'br.com.calazanstec';
const PARECERES = ['Aprovado', 'Reprovado'];
// Default declarado em ParametrosOrigem.prazoVerificacaoEficaciaDias (db/tratativa.cds).
const PRAZO_VERIFICACAO_PADRAO = 30;
const STATUS_ACAO_FINAL = ['Concluída', 'Cancelada'];

export interface SituacaoAval {
  avalVigente: boolean;
  aprovadoVigente: boolean;
  houveReabertura: boolean;
  acoesAbertas: boolean;
  exigeNovaAcao: boolean;
  aptaParaEmissao: boolean;
  dataBase: string | null;
  dataLimite: string | null;
  idAvalVigente: string | null;
  parecerVigente: string | null;
}

interface LinhaTratativa {
  codigo: string;
  origemNormalizada: string | null;
  status: string;
  dataCriacao: string;
}

interface LinhaAval {
  id: string;
  tratativa_codigo: string;
  parecer: string;
  fundamentacao: string;
  validador: string;
  emitidoEm: string;
  dataBaseVerificacao: string | null;
  dataLimiteVerificacao: string | null;
}

interface LinhaHistorico {
  tratativa_codigo: string;
  evento: string;
  valorNovo: string | null;
  quando: string;
}

interface LinhaCancelamento {
  tratativa_codigo: string;
  acao_codigo: string;
  quando: string;
}

interface LinhaAcao {
  codigo: string;
  tratativa_codigo: string;
  status: string;
  criadoEm: string;
  dataConclusao: string | null;
}

interface LinhaParametro {
  origemNormalizada: string;
  prazoVerificacaoEficaciaDias: number;
}

interface ResultadoAval {
  id: string;
  parecer: string;
  fundamentacao: string | null;
  validador: string | null;
  emitidoEm: string;
  vigente: boolean;
}

function instante(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function instanteDoDia(dia: string): Date {
  return new Date(`${dia}T12:00:00.000Z`);
}

function instanteDeDataCivil(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return instanteDoDia(valor);
  return instante(valor);
}

function adicionarDias(dia: string, quantidade: number): string {
  const data = instanteDoDia(dia);
  data.setUTCDate(data.getUTCDate() + quantidade);
  return data.toISOString().slice(0, 10);
}

async function lerPrazos(origens: string[]): Promise<Map<string, number>> {
  const chaves = [...new Set([...origens, '*'])];
  const linhas = (await cds.db.run(
    SELECT.from(`${NS}.ParametrosOrigem`)
      .columns('origemNormalizada', 'prazoVerificacaoEficaciaDias')
      .where({ origemNormalizada: { in: chaves } }),
  )) as LinhaParametro[];
  return new Map(linhas.map((linha) => [linha.origemNormalizada, linha.prazoVerificacaoEficaciaDias]));
}

function maiorInstante(datas: Array<Date | null>): Date | null {
  const presentes = datas.filter((data): data is Date => data !== null);
  if (!presentes.length) return null;
  return presentes.reduce((maior, data) => (data.getTime() > maior.getTime() ? data : maior));
}

async function carregarSituacoes(codigos: string[]): Promise<{
  tratativas: LinhaTratativa[];
  avales: LinhaAval[];
  historicos: LinhaHistorico[];
  acoes: LinhaAcao[];
  cancelamentos: LinhaCancelamento[];
  prazos: Map<string, number>;
}> {
  const ids = [...new Set(codigos)];
  if (!ids.length) return { tratativas: [], avales: [], historicos: [], acoes: [], cancelamentos: [], prazos: new Map() };

  const [tratativas, avales, historicos, acoes, cancelamentos] = await Promise.all([
    cds.db.run(
      SELECT.from(`${NS}.Tratativas`)
        .columns('codigo', 'origemNormalizada', 'status', 'dataCriacao')
        .where({ codigo: { in: ids } }),
    ) as Promise<LinhaTratativa[]>,
    cds.db.run(
      SELECT.from(`${NS}.AvalesTecnicos`)
        .columns('id', 'tratativa_codigo', 'parecer', 'fundamentacao', 'validador', 'emitidoEm',
          'dataBaseVerificacao', 'dataLimiteVerificacao')
        .where({ tratativa_codigo: { in: ids } }),
    ) as Promise<LinhaAval[]>,
    cds.db.run(
      SELECT.from(`${NS}.HistoricoTratativa`)
        .columns('tratativa_codigo', 'evento', 'valorNovo', 'quando')
        .where({ tratativa_codigo: { in: ids }, evento: { in: ['Reabertura', 'MudancaStatus'] } }),
    ) as Promise<LinhaHistorico[]>,
    cds.db.run(
      SELECT.from(`${NS}.Acoes`)
        .columns('codigo', 'tratativa_codigo', 'status', 'criadoEm', 'dataConclusao')
        .where({ tratativa_codigo: { in: ids } }),
    ) as Promise<LinhaAcao[]>,
    cds.db.run(
      SELECT.from(`${NS}.HistoricoAcoes`)
        .columns('tratativa_codigo', 'acao_codigo', 'quando')
        .where({ tratativa_codigo: { in: ids }, evento: 'Cancelamento' }),
    ) as Promise<LinhaCancelamento[]>,
  ]);
  const prazos = await lerPrazos(tratativas.map((tratativa) => tratativa.origemNormalizada ?? ''));
  return { tratativas, avales, historicos, acoes, cancelamentos, prazos };
}

function montarSituacoes(
  dados: Awaited<ReturnType<typeof carregarSituacoes>>,
): Map<string, SituacaoAval> {
  const resultado = new Map<string, SituacaoAval>();
  for (const tratativa of dados.tratativas) {
    const avales = dados.avales
      .filter((aval) => aval.tratativa_codigo === tratativa.codigo)
      .sort((a, b) => new Date(a.emitidoEm).getTime() - new Date(b.emitidoEm).getTime());
    const historicos = dados.historicos.filter((linha) => linha.tratativa_codigo === tratativa.codigo);
    const acoes = dados.acoes.filter((linha) => linha.tratativa_codigo === tratativa.codigo);
    const reaberturas = historicos.filter((linha) => linha.evento === 'Reabertura');
    const ultimaReabertura = maiorInstante(reaberturas.map((linha) => instante(linha.quando)));
    const ultimoAval = avales[avales.length - 1];
    const vigente = ultimoAval && (!ultimaReabertura || new Date(ultimoAval.emitidoEm) > ultimaReabertura)
      ? ultimoAval
      : undefined;
    const ultimaReprovacao = [...avales].reverse().find((aval) => aval.parecer === 'Reprovado');
    const exigeNovaAcao = !!ultimaReprovacao && !acoes.some((acao) =>
      new Date(acao.criadoEm) > new Date(ultimaReprovacao.emitidoEm) &&
      STATUS_ACAO_FINAL.includes(acao.status),
    );
    const acoesAbertas = acoes.some((acao) => !STATUS_ACAO_FINAL.includes(acao.status));
    const entradasEmAndamento = historicos.filter(
      (linha) => linha.evento === 'Reabertura' ||
        (linha.evento === 'MudancaStatus' && linha.valorNovo === 'Em andamento'),
    );
    const instanteInicio = maiorInstante(entradasEmAndamento.map((linha) => instante(linha.quando)));
    const ultimaConclusao = maiorInstante(acoes
      .filter((acao) => acao.status === 'Concluída' && acao.dataConclusao)
      .map((acao) => instanteDeDataCivil(acao.dataConclusao)));
    // Ação Cancelada não grava dataConclusao: o instante vem do evento Cancelamento (DC-04).
    const canceladas = new Set(acoes.filter((acao) => acao.status === 'Cancelada').map((acao) => acao.codigo));
    const ultimoCancelamento = maiorInstante(dados.cancelamentos
      .filter((linha) => linha.tratativa_codigo === tratativa.codigo && canceladas.has(linha.acao_codigo))
      .map((linha) => instante(linha.quando)));
    const base = maiorInstante([instanteInicio, ultimaConclusao, ultimoCancelamento]) ??
      instante(`${tratativa.dataCriacao}T12:00:00.000Z`);
    const dataBase = base ? dataCivil(base) : null;
    const prazo = dados.prazos.get(tratativa.origemNormalizada ?? '') ?? dados.prazos.get('*') ?? PRAZO_VERIFICACAO_PADRAO;
    const dataLimite = dataBase ? adicionarDias(dataBase, prazo) : null;

    resultado.set(tratativa.codigo, {
      avalVigente: !!vigente,
      aprovadoVigente: vigente?.parecer === 'Aprovado',
      houveReabertura: reaberturas.length > 0,
      acoesAbertas,
      exigeNovaAcao,
      aptaParaEmissao: tratativa.status === 'Em andamento' && !acoesAbertas && !exigeNovaAcao,
      dataBase,
      dataLimite,
      idAvalVigente: vigente?.id ?? null,
      parecerVigente: vigente?.parecer ?? null,
    });
  }
  return resultado;
}

export async function lerSituacaoAval(codigos: string[]): Promise<Map<string, SituacaoAval>> {
  return montarSituacoes(await carregarSituacoes(codigos));
}

export async function emitirAvalTecnico(
  req: Request,
  codigoTratativa: string,
  dados: { parecer?: unknown; fundamentacao?: unknown },
  autor: Autor,
): Promise<void> {
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'codigo');
  validarAutor(autor);
  const tratativa = await bloquearTratativa(codigoTratativa.toLowerCase());
  if (!(await usuarioEhValidadorHabilitado(req, tratativa.codigo))) recusar(403, 'Acesso negado.');
  exigirAlteravel(tratativa);
  if (tratativa.status !== 'Em andamento') {
    recusar(409, 'Aval Técnico exige que a Tratativa esteja em status Em andamento.');
  }

  const situacao = (await lerSituacaoAval([tratativa.codigo])).get(tratativa.codigo);
  if (situacao?.acoesAbertas) {
    recusar(409, 'Aval Técnico não pode ser emitido: há Ações não concluídas nem canceladas.');
  }
  if (situacao?.exigeNovaAcao) {
    recusar(
      409,
      'Aval Técnico não pode ser emitido: exige nova Ação corretiva concluída ou cancelada criada após a última reprovação.',
    );
  }
  if (typeof dados.parecer !== 'string' || !PARECERES.includes(dados.parecer)) {
    recusar(400, 'Parecer inválido: use Aprovado ou Reprovado.', 'parecer');
  }
  if (typeof dados.fundamentacao !== 'string') {
    recusar(400, 'O campo Fundamentação deve ser um texto.', 'fundamentacao');
  }
  const fundamentacao = dados.fundamentacao.trim();
  if (fundamentacao.length < 20 || fundamentacao.length > 2000) {
    recusar(400, 'O campo Fundamentação aceita de 20 a 2000 caracteres.', 'fundamentacao');
  }
  if (!situacao?.dataBase || !situacao.dataLimite) {
    throw new Error('Não foi possível derivar o prazo de verificação de eficácia.');
  }

  const id = cds.utils.uuid();
  const emitidoEm = agora();
  await cds.db.run(
    INSERT.into(`${NS}.AvalesTecnicos`).entries({
      id,
      tratativa_codigo: tratativa.codigo,
      parecer: dados.parecer,
      fundamentacao,
      validador: obterMatriculaUsuario(req),
      emitidoEm: emitidoEm.toISOString(),
      dataBaseVerificacao: instanteDoDia(situacao.dataBase).toISOString(),
      dataLimiteVerificacao: situacao.dataLimite,
    }),
  );
  await registrarHistorico(
    tratativa.codigo,
    autor,
    [{ evento: 'EmissaoAvalTecnico', campo: 'parecer', valorNovo: dados.parecer, avalTecnico: id }],
    emitidoEm,
  );
}

export async function consultarAvalTecnico(
  req: Request,
  codigoTratativa: string | null | undefined,
): Promise<{
  vigente: ResultadoAval | null;
  dataBaseVerificacao: string | null;
  dataLimiteVerificacao: string | null;
  historico: ResultadoAval[];
}> {
  if (typeof codigoTratativa !== 'string' || !codigoValido(codigoTratativa)) {
    recusar(400, 'Código inválido.', 'codigoTratativa');
  }
  const codigo = (codigoTratativa as string).toLowerCase();
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo').where({ codigo }),
  )) as { codigo: string } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  const [situacao, podeVerFundamentacao, avales] = await Promise.all([
    lerSituacaoAval([codigo]),
    usuarioEhValidadorHabilitado(req, codigo),
    cds.db.run(
      SELECT.from(`${NS}.AvalesTecnicos`)
        .columns('id', 'parecer', 'fundamentacao', 'validador', 'emitidoEm')
        .where({ tratativa_codigo: codigo })
        .orderBy('emitidoEm desc'),
    ) as Promise<Array<Omit<LinhaAval, 'tratativa_codigo' | 'dataBaseVerificacao' | 'dataLimiteVerificacao'>>>,
  ]);
  const dados = situacao.get(codigo);
  const gestor = req.user.is('GestorTratativa');
  const historico = avales.map((aval) => ({
    id: aval.id,
    parecer: aval.parecer,
    fundamentacao: gestor || podeVerFundamentacao ? aval.fundamentacao : null,
    validador: gestor ? aval.validador : null,
    emitidoEm: aval.emitidoEm,
    vigente: aval.id === dados?.idAvalVigente,
  }));
  return {
    vigente: historico.find((aval) => aval.vigente) ?? null,
    dataBaseVerificacao: dados?.dataBase ?? null,
    dataLimiteVerificacao: dados?.dataLimite ?? null,
    historico,
  };
}
