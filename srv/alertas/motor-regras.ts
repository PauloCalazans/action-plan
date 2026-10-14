import cds from '@sap/cds';
import { consultarParametrosAlertas } from './parametros';
import { avaliarVerificacaoEficacia } from './regra-verificacao-eficacia';

const NS = 'br.com.calazanstec';
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const STATUS_TRATATIVA_ATIVOS = new Set(['Aberta', 'Em andamento']);
const STATUS_ACAO_ATIVOS = new Set(['Pendente', 'Em andamento']);

interface Tratativa {
  codigo: string;
  status: string;
  dataPrevistaConclusao: string;
  criadoEm: string;
  responsavelPrincipal?: string;
  origemNormalizada?: string | null;
}

interface Acao {
  codigo: string;
  tratativa_codigo: string;
  status: string;
  prazo: string;
  responsavel: string;
  evidenciaObrigatoria: boolean;
}

interface RegistroAtividade {
  tratativa_codigo: string;
  quando?: string;
  criadoEm?: string;
}

interface Participante {
  tratativa_codigo: string;
  matricula: string;
}

export interface AlertaGerado {
  tipo: 'PrazoProximo' | 'PrazoVencido' | 'Inatividade' | 'EvidenciaPendente';
  entidade: 'Tratativa' | 'Acao' | 'VerificacaoEficacia';
  tratativa: string;
  acao?: string;
  destinatario: string;
  /** Data limite (AAAA-MM-DD) quando o prazo não vem da Tratativa nem da Ação. */
  prazo?: string;
}

export interface AvaliacaoAlertas {
  ocorrenciasAvaliadas: number;
  alertas: AlertaGerado[];
}

function dataUtc(valor: string): number {
  return Date.parse(`${valor.slice(0, 10)}T00:00:00.000Z`);
}

function diferencaDias(data: string, referencia: number): number {
  return (dataUtc(data) - referencia) / MS_POR_DIA;
}

function adicionarAlerta(
  alertas: AlertaGerado[],
  tipo: AlertaGerado['tipo'],
  entidade: AlertaGerado['entidade'],
  tratativa: string,
  destinatarios: Iterable<string | undefined>,
  acao?: string,
): void {
  for (const destinatario of new Set(destinatarios)) {
    if (destinatario) {
      alertas.push({ tipo, entidade, tratativa, ...(acao ? { acao } : {}), destinatario });
    }
  }
}

function agregarAtividades(
  ultimaAtividade: Map<string, number>,
  registros: RegistroAtividade[],
  campo: 'quando' | 'criadoEm',
): void {
  for (const registro of registros) {
    const valor = registro[campo];
    if (!valor) continue;
    const atual = ultimaAtividade.get(registro.tratativa_codigo) ?? Number.NEGATIVE_INFINITY;
    ultimaAtividade.set(registro.tratativa_codigo, Math.max(atual, Date.parse(valor)));
  }
}

export async function avaliarAlertas(agora: Date): Promise<AvaliacaoAlertas> {
  const [
    parametros,
    tratativas,
    acoes,
    historicosTratativa,
    historicosAcoes,
    comentarios,
    participantes,
    evidencias,
  ] = await Promise.all([
    consultarParametrosAlertas(),
    cds.db.run(SELECT.from(`${NS}.Tratativas`).columns(
      'codigo', 'status', 'dataPrevistaConclusao', 'criadoEm', 'responsavelPrincipal', 'origemNormalizada',
    )),
    cds.db.run(SELECT.from(`${NS}.Acoes`).columns(
      'codigo', 'tratativa_codigo', 'status', 'prazo', 'responsavel', 'evidenciaObrigatoria',
    )),
    cds.db.run(SELECT.from(`${NS}.HistoricoTratativa`).columns('tratativa_codigo', 'quando')),
    cds.db.run(SELECT.from(`${NS}.HistoricoAcoes`).columns('tratativa_codigo', 'quando')),
    cds.db.run(SELECT.from(`${NS}.Comentarios`).columns('tratativa_codigo', 'criadoEm')),
    cds.db.run(SELECT.from(`${NS}.ParticipantesTratativa`).columns('tratativa_codigo', 'matricula')),
    cds.db.run(SELECT.from(`${NS}.Evidencias`).columns('acao_codigo').where({ ativo: true })),
  ]) as [
    Awaited<ReturnType<typeof consultarParametrosAlertas>>,
    Tratativa[],
    Acao[],
    RegistroAtividade[],
    RegistroAtividade[],
    RegistroAtividade[],
    Participante[],
    Array<{ acao_codigo: string }>,
  ];

  const dataRef = dataUtc(agora.toISOString());
  const ultimaAtividade = new Map(tratativas.map((tratativa) => [
    tratativa.codigo,
    Date.parse(tratativa.criadoEm),
  ]));
  agregarAtividades(ultimaAtividade, historicosTratativa, 'quando');
  agregarAtividades(ultimaAtividade, historicosAcoes, 'quando');
  agregarAtividades(ultimaAtividade, comentarios, 'criadoEm');

  const participantesPorTratativa = new Map<string, string[]>();
  for (const participante of participantes) {
    const destinatarios = participantesPorTratativa.get(participante.tratativa_codigo) ?? [];
    destinatarios.push(participante.matricula);
    participantesPorTratativa.set(participante.tratativa_codigo, destinatarios);
  }

  const tratativasPorCodigo = new Map(tratativas.map((tratativa) => [tratativa.codigo, tratativa]));
  const acoesComEvidenciaAtiva = new Set(evidencias.map(({ acao_codigo }) => acao_codigo));
  const alertas: AlertaGerado[] = [];

  for (const tratativa of tratativas) {
    if (!STATUS_TRATATIVA_ATIVOS.has(tratativa.status)) continue;

    const diasParaConclusao = diferencaDias(tratativa.dataPrevistaConclusao, dataRef);
    if (diasParaConclusao < 0) {
      adicionarAlerta(alertas, 'PrazoVencido', 'Tratativa', tratativa.codigo, [tratativa.responsavelPrincipal]);
    } else if (diasParaConclusao <= parametros.diasAntecedenciaPrazoProximo) {
      adicionarAlerta(alertas, 'PrazoProximo', 'Tratativa', tratativa.codigo, [tratativa.responsavelPrincipal]);
    }

    const inativaDesde = ultimaAtividade.get(tratativa.codigo) ?? Date.parse(tratativa.criadoEm);
    if (agora.getTime() - inativaDesde > parametros.diasInatividade * MS_POR_DIA) {
      const responsaveis = tratativa.responsavelPrincipal
        ? [tratativa.responsavelPrincipal]
        : participantesPorTratativa.get(tratativa.codigo) ?? [];
      adicionarAlerta(alertas, 'Inatividade', 'Tratativa', tratativa.codigo, responsaveis);
    }
  }

  for (const acao of acoes) {
    const tratativa = tratativasPorCodigo.get(acao.tratativa_codigo);
    if (!tratativa || !STATUS_TRATATIVA_ATIVOS.has(tratativa.status) || !STATUS_ACAO_ATIVOS.has(acao.status)) {
      continue;
    }

    const diasParaPrazo = diferencaDias(acao.prazo, dataRef);
    const vencida = diasParaPrazo < 0;
    const proxima = diasParaPrazo >= 0 && diasParaPrazo <= parametros.diasAntecedenciaPrazoProximo;
    if (vencida) {
      adicionarAlerta(alertas, 'PrazoVencido', 'Acao', tratativa.codigo, [
        acao.responsavel,
        tratativa.responsavelPrincipal,
      ], acao.codigo);
    } else if (proxima) {
      adicionarAlerta(alertas, 'PrazoProximo', 'Acao', tratativa.codigo, [acao.responsavel], acao.codigo);
    }

    if (acao.evidenciaObrigatoria && !acoesComEvidenciaAtiva.has(acao.codigo) && (vencida || proxima)) {
      const destinatarios = vencida
        ? [acao.responsavel, tratativa.responsavelPrincipal]
        : [acao.responsavel];
      adicionarAlerta(alertas, 'EvidenciaPendente', 'Acao', tratativa.codigo, destinatarios, acao.codigo);
    }
  }

  const ativas = tratativas.filter((tratativa) => tratativa.status === 'Em andamento');
  alertas.push(...await avaliarVerificacaoEficacia(ativas, agora, parametros.diasAntecedenciaPrazoProximo));

  return { ocorrenciasAvaliadas: tratativas.length, alertas };
}
