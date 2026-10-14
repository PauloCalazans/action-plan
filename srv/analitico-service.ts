import cds from '@sap/cds';
import { aplicarOpcoesOdata, validarFiltros } from './analitico/filtros';
import { dataCivil as dataCivilPlataforma } from './lib/relogio';

const NS = 'br.com.calazanstec';

type Total = { total: number };
type Tratativa = {
  codigo: string;
  origem?: string | null;
  criticidade: string;
  area?: string | null;
  status: string;
  dataCriacao: string;
  dataPrevistaConclusao: string;
  criadoEm: string;
};
type Historico = {
  tratativa_codigo: string;
  evento: string;
  quando: string;
};
type Acao = {
  codigo: string;
  tratativa_codigo: string;
  status: string;
  evidenciaObrigatoria: boolean;
};
type Evidencia = {
  acao_codigo: string;
  ativo: boolean;
};

const ATIVOS = ['Aberta', 'Em andamento'];
const ENTIDADES_COM_LEITURA_MANUAL = new Set([
  'TratativasVencidas',
  'TratativasPorOrigem',
  'TratativasPorCriticidade',
  'RankingAreas',
  'VolumePorOrigem',
  'PrincipaisDesvios',
  'BacklogTotal',
  'EvidenciasPendentes',
]);

function dataCivil(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function dentroDoPeriodo(data: string, inicio: string, fim: string): boolean {
  return data >= inicio && data <= fim;
}

function origemCanonica(origem: string | null | undefined): { chave: string; rotulo: string } {
  const valor = origem?.trim();
  if (!valor) return { chave: 'sem origem', rotulo: 'Sem Origem' };
  const minusculo = valor.toLocaleLowerCase('pt-BR');
  const maiusculo = valor.toLocaleUpperCase('pt-BR');
  if (valor !== minusculo && valor !== maiusculo) return { chave: minusculo, rotulo: valor };
  const rotulo = valor
    .split(/\s+/)
    .map((palavra) =>
      palavra === palavra.toLocaleUpperCase('pt-BR') && palavra.length <= 5
        ? palavra
        : `${palavra.charAt(0).toLocaleUpperCase('pt-BR')}${palavra.slice(1).toLocaleLowerCase('pt-BR')}`,
    )
    .join(' ');
  return { chave: minusculo, rotulo };
}

function areaCanonica(area: string | null | undefined): string {
  return area?.trim() || 'Sem Área';
}

export default class AnaliticoService extends cds.ApplicationService {
  async init() {
    this.before('*', (req) => {
      if (
        req.user.is('AplicativoOrigem') ||
        (!req.user.is('GestorTratativa') && !req.user.is('Administrador') && !req.user.is('LeitorAnalitico'))
      ) {
        req.reject(403, 'Acesso negado.');
      }
    });
    this.before('*', validarFiltros);
    this.after('READ', (resultado, req) => {
      if (!Array.isArray(resultado) || !ENTIDADES_COM_LEITURA_MANUAL.has(req.target?.name.split('.').pop() ?? '')) return;
      resultado.splice(0, resultado.length, ...(aplicarOpcoesOdata(resultado, req) as unknown[]));
    });
    this.before('READ', 'PendenciasPorResponsavel', (req) => {
      if (!req.user.is('GestorTratativa') && !req.user.is('Administrador')) req.reject(403, 'Acesso negado.');
    });
    this.on('READ', 'TratativasVencidas', async () => [{
      id: 'TOTAL',
      total: await totalTratativasVencidas(dataCivil(new Date().toISOString())),
    }]);
    this.on('READ', 'TratativasPorOrigem', async () => {
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('origem', 'criadoEm').orderBy('criadoEm asc'),
      )) as Array<Pick<Tratativa, 'origem'>>;
      const agrupadas = new Map<string, { origem: string; total: number }>();
      for (const tratativa of tratativas) {
        const origem = origemCanonica(tratativa.origem);
        const atual = agrupadas.get(origem.chave);
        agrupadas.set(origem.chave, { origem: atual?.origem ?? origem.rotulo, total: (atual?.total ?? 0) + 1 });
      }
      return [...agrupadas.values()];
    });
    this.on('READ', 'TratativasPorCriticidade', async () => {
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('criticidade'),
      )) as Array<Pick<Tratativa, 'criticidade'>>;
      const agrupadas = new Map<string, number>();
      for (const tratativa of tratativas) {
        agrupadas.set(tratativa.criticidade, (agrupadas.get(tratativa.criticidade) ?? 0) + 1);
      }
      return [...agrupadas.entries()].map(([criticidade, total]) => ({ criticidade, total }));
    });
    this.on('READ', 'RankingAreas', async () => {
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('area', 'status'),
      )) as Array<Pick<Tratativa, 'area' | 'status'>>;
      const agrupadas = new Map<string, number>();
      for (const tratativa of tratativas) {
        if (!ATIVOS.includes(tratativa.status)) continue;
        const area = areaCanonica(tratativa.area);
        agrupadas.set(area, (agrupadas.get(area) ?? 0) + 1);
      }
      return [...agrupadas.entries()]
        .map(([area, total]) => ({ area, total }))
        .sort((a, b) => b.total - a.total || a.area.localeCompare(b.area, 'pt-BR'));
    });
    this.on('READ', 'VolumePorOrigem', async () => {
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('origem'),
      )) as Array<Pick<Tratativa, 'origem'>>;
      const agrupadas = new Map<string, { origem: string; total: number }>();
      for (const tratativa of tratativas) {
        const origem = origemCanonica(tratativa.origem);
        const atual = agrupadas.get(origem.chave);
        agrupadas.set(origem.chave, { origem: atual?.origem ?? origem.rotulo, total: (atual?.total ?? 0) + 1 });
      }
      return [...agrupadas.values()].map(({ origem, total }) => ({
        origem,
        total,
        percentual: tratativas.length ? Number(((total / tratativas.length) * 100).toFixed(2)) : 0,
      }));
    });
    this.on('READ', 'PrincipaisDesvios', async () => {
      const dataCorte = dataCivil(new Date().toISOString());
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('origem', 'status', 'dataPrevistaConclusao'),
      )) as Array<Pick<Tratativa, 'origem' | 'status' | 'dataPrevistaConclusao'>>;
      const agrupadas = new Map<string, { origem: string; totalDesvios: number }>();
      for (const tratativa of tratativas) {
        if (!ATIVOS.includes(tratativa.status) || tratativa.dataPrevistaConclusao >= dataCorte) continue;
        const origem = origemCanonica(tratativa.origem);
        const atual = agrupadas.get(origem.chave);
        agrupadas.set(origem.chave, {
          origem: atual?.origem ?? origem.rotulo,
          totalDesvios: (atual?.totalDesvios ?? 0) + 1,
        });
      }
      return [...agrupadas.values()].sort(
        (a, b) => b.totalDesvios - a.totalDesvios || a.origem.localeCompare(b.origem, 'pt-BR'),
      );
    });
    this.on('READ', 'BacklogTotal', async () => {
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('codigo', 'status'),
      )) as Array<Pick<Tratativa, 'codigo' | 'status'>>;
      const codigosAtivos = new Set(tratativas.filter((tratativa) => ATIVOS.includes(tratativa.status)).map((tratativa) => tratativa.codigo));
      const acoes = (await cds.db.run(
        SELECT.from(`${NS}.Acoes`).columns('tratativa_codigo', 'status'),
      )) as Array<Pick<Acao, 'tratativa_codigo' | 'status'>>;
      const totalAcoes = acoes.filter(
        (acao) => codigosAtivos.has(acao.tratativa_codigo) && ['Pendente', 'Em andamento'].includes(acao.status),
      ).length;
      return [{ id: 'TOTAL', total: codigosAtivos.size + totalAcoes }];
    });
    this.on('READ', 'EvidenciasPendentes', async () => {
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('codigo', 'status'),
      )) as Array<Pick<Tratativa, 'codigo' | 'status'>>;
      const codigosAtivos = new Set(tratativas.filter((tratativa) => ATIVOS.includes(tratativa.status)).map((tratativa) => tratativa.codigo));
      const acoes = (await cds.db.run(
        SELECT.from(`${NS}.Acoes`).columns('codigo', 'tratativa_codigo', 'status', 'evidenciaObrigatoria'),
      )) as Acao[];
      const evidencias = (await cds.db.run(
        SELECT.from(`${NS}.Evidencias`).columns('acao_codigo', 'ativo'),
      )) as Evidencia[];
      const acoesComEvidencia = new Set(
        evidencias.filter((evidencia) => evidencia.ativo).map((evidencia) => evidencia.acao_codigo),
      );
      const total = acoes.filter(
        (acao) =>
          codigosAtivos.has(acao.tratativa_codigo) &&
          acao.evidenciaObrigatoria &&
          ['Pendente', 'Em andamento'].includes(acao.status) &&
          !acoesComEvidencia.has(acao.codigo),
      ).length;
      return [{ id: 'TOTAL', total }];
    });
    this.on('consultarCumprimentoDePrazo', async (req) => {
      const { periodoInicio, periodoFim } = req.data as { periodoInicio: string; periodoFim: string };
      const encerramentos = await encerramentosNoPeriodo(periodoInicio, periodoFim);
      const porCodigo = new Map(encerramentos.map((item) => [item.tratativa_codigo, item]));
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('codigo', 'dataPrevistaConclusao', 'status'),
      )) as Array<Pick<Tratativa, 'codigo' | 'dataPrevistaConclusao' | 'status'>>;
      const encerradas = tratativas.filter((tratativa) => {
        const encerramento = porCodigo.get(tratativa.codigo);
        return encerramento && tratativa.status === 'Encerrada';
      });
      if (!encerradas.length) return { taxaPercentual: 100 };
      const noPrazo = encerradas.filter((tratativa) => {
        const encerramento = porCodigo.get(tratativa.codigo);
        return encerramento && dataCivil(encerramento.quando) <= tratativa.dataPrevistaConclusao;
      });
      return { taxaPercentual: Number(((noPrazo.length / encerradas.length) * 100).toFixed(2)) };
    });
    this.on('consultarTempoMedioResolucao', async (req) => {
      const { periodoInicio, periodoFim } = req.data as { periodoInicio: string; periodoFim: string };
      const encerramentos = await encerramentosNoPeriodo(periodoInicio, periodoFim);
      if (!encerramentos.length) return { mediaDias: 0 };
      const codigos = encerramentos.map((item) => item.tratativa_codigo);
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('codigo', 'criadoEm', 'status').where({ codigo: { in: codigos } }),
      )) as Array<Pick<Tratativa, 'codigo' | 'criadoEm' | 'status'>>;
      const porCodigo = new Map(tratativas.map((item) => [item.codigo, item]));
      const dias = encerramentos
        .filter((encerramento) => porCodigo.get(encerramento.tratativa_codigo)?.status === 'Encerrada')
        .map((encerramento) => {
          const criado = porCodigo.get(encerramento.tratativa_codigo)?.criadoEm;
          return criado ? (Date.parse(encerramento.quando) - Date.parse(criado)) / 86400000 : 0;
        });
      return { mediaDias: dias.length ? Number((dias.reduce((soma, dias) => soma + dias, 0) / dias.length).toFixed(1)) : 0 };
    });
    this.on('consultarTratativasVencidas', async (req) => {
      const { dataCorte } = req.data as { dataCorte: string };
      return { total: await totalTratativasVencidas(dataCorte) };
    });
    this.on('consultarTendenciaMensal', async (req) => {
      const { periodoInicio, periodoFim } = req.data as { periodoInicio: string; periodoFim: string };
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('codigo', 'criadoEm', 'status'),
      )) as Array<Pick<Tratativa, 'codigo' | 'criadoEm' | 'status'>>;
      const totais = new Map<string, { mesReferencia: string; totalCriadas: number; totalEncerradas: number }>();
      const obterMes = (data: string): string => dataCivil(data).slice(0, 7);
      const acumular = (mes: string, campo: 'totalCriadas' | 'totalEncerradas') => {
        const atual = totais.get(mes) ?? { mesReferencia: mes, totalCriadas: 0, totalEncerradas: 0 };
        atual[campo] += 1;
        totais.set(mes, atual);
      };
      for (const tratativa of tratativas) {
        if (tratativa.status === 'Cancelada') continue;
        const criada = dataCivil(tratativa.criadoEm);
        if (dentroDoPeriodo(criada, periodoInicio, periodoFim)) acumular(obterMes(tratativa.criadoEm), 'totalCriadas');
      }
      const encerramentos = await encerramentosNoPeriodo(periodoInicio, periodoFim);
      const porCodigo = new Map(tratativas.map((tratativa) => [tratativa.codigo, tratativa]));
      for (const encerramento of encerramentos) {
        if (porCodigo.get(encerramento.tratativa_codigo)?.status !== 'Cancelada') {
          acumular(obterMes(encerramento.quando), 'totalEncerradas');
        }
      }
      return [...totais.values()].sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia));
    });
    this.on('consultarIndiceResolucao', async (req) => {
      const { periodoInicio, periodoFim } = req.data as { periodoInicio: string; periodoFim: string };
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('codigo', 'criadoEm', 'status'),
      )) as Array<Pick<Tratativa, 'codigo' | 'criadoEm' | 'status'>>;
      const ativosNoCalculo = tratativas.filter((tratativa) => tratativa.status !== 'Cancelada');
      const criadas = ativosNoCalculo.filter((tratativa) =>
        dentroDoPeriodo(dataCivil(tratativa.criadoEm), periodoInicio, periodoFim),
      ).length;
      const porCodigo = new Map(ativosNoCalculo.map((tratativa) => [tratativa.codigo, tratativa]));
      const encerradas = (await encerramentosNoPeriodo(periodoInicio, periodoFim)).filter((encerramento) =>
        porCodigo.has(encerramento.tratativa_codigo),
      ).length;
      return { indicePercentual: criadas ? Number(((encerradas / criadas) * 100).toFixed(2)) : 100 };
    });
    this.on('consultarTaxaEficacia', async (req) => {
      const { periodoInicio, periodoFim } = req.data as { periodoInicio: string; periodoFim: string };
      return { taxaPercentual: await taxaEficacia(periodoInicio, periodoFim) };
    });
    this.on('consultarTempoMedioVerificacaoEficacia', async (req) => {
      const { periodoInicio, periodoFim } = req.data as { periodoInicio: string; periodoFim: string };
      return { mediaDias: await tempoMedioVerificacao(periodoInicio, periodoFim) };
    });
    this.on('consultarAderenciaMetodologica', async (req) => {
      const { periodoInicio, periodoFim } = req.data as { periodoInicio: string; periodoFim: string };
      return { percentual: await aderenciaMetodologica(periodoInicio, periodoFim) };
    });
    return super.init();
  }
}

const MS_POR_DIA = 86400000;

/** Limites do período em instantes UTC, com 1 dia de folga; o corte exato é feito por data civil da plataforma. */
function limitesComFolga(periodoInicio: string, periodoFim: string): { de: string; ate: string } {
  const de = new Date(Date.parse(`${periodoInicio}T00:00:00.000Z`) - MS_POR_DIA).toISOString();
  const ate = new Date(Date.parse(`${periodoFim}T00:00:00.000Z`) + 2 * MS_POR_DIA).toISOString();
  return { de, ate };
}

function diasEntre(inicio: string, fim: string): number {
  return (Date.parse(`${fim}T00:00:00.000Z`) - Date.parse(`${inicio}T00:00:00.000Z`)) / MS_POR_DIA;
}

function arredondar(valor: number, casas: number): number {
  return Number(valor.toFixed(casas));
}

/** DC-14: primeiro Aval da Tratativa em todo o histórico, filtrado pelo período; eficaz se Aprovado. */
async function taxaEficacia(periodoInicio: string, periodoFim: string): Promise<number> {
  const { de, ate } = limitesComFolga(periodoInicio, periodoFim);
  const [primeiros, primeirosAprovados] = (await Promise.all([
    cds.db.run(
      SELECT.from(`${NS}.AvalesTecnicos`)
        .columns('tratativa_codigo', 'min(emitidoEm) as primeiro')
        .groupBy('tratativa_codigo')
        .having('min(emitidoEm) >=', de, 'and min(emitidoEm) <', ate),
    ),
    cds.db.run(
      SELECT.from(`${NS}.AvalesTecnicos`)
        .columns('tratativa_codigo', 'min(emitidoEm) as primeiro')
        .where({ parecer: 'Aprovado' })
        .groupBy('tratativa_codigo'),
    ),
  ])) as [Array<{ tratativa_codigo: string; primeiro: string }>, Array<{ tratativa_codigo: string; primeiro: string }>];

  const aprovado = new Map(primeirosAprovados.map((linha) => [linha.tratativa_codigo, Date.parse(linha.primeiro)]));
  const universo = primeiros.filter((linha) =>
    dentroDoPeriodo(dataCivilPlataforma(new Date(linha.primeiro)), periodoInicio, periodoFim),
  );
  if (!universo.length) return 0;
  const eficazes = universo.filter((linha) => aprovado.get(linha.tratativa_codigo) === Date.parse(linha.primeiro));
  return arredondar((eficazes.length / universo.length) * 100, 2);
}

/** DC-14: média, em dias corridos entre datas civis, de `dataBaseVerificacao` até `emitidoEm` dos Avales do período. */
async function tempoMedioVerificacao(periodoInicio: string, periodoFim: string): Promise<number> {
  const { de, ate } = limitesComFolga(periodoInicio, periodoFim);
  const avales = (await cds.db.run(
    SELECT.from(`${NS}.AvalesTecnicos`)
      .columns('emitidoEm', 'dataBaseVerificacao')
      .where('emitidoEm >=', de, 'and emitidoEm <', ate, 'and dataBaseVerificacao is not null'),
  )) as Array<{ emitidoEm: string; dataBaseVerificacao: string }>;
  const dias = avales
    .map((aval) => ({
      emitido: dataCivilPlataforma(new Date(aval.emitidoEm)),
      base: dataCivilPlataforma(new Date(aval.dataBaseVerificacao)),
    }))
    .filter(({ emitido }) => dentroDoPeriodo(emitido, periodoInicio, periodoFim))
    .map(({ emitido, base }) => diasEntre(base, emitido));
  return dias.length ? arredondar(dias.reduce((soma, valor) => soma + valor, 0) / dias.length, 1) : 0;
}

/** R15 d: percentual das Tratativas criadas no período com metodologia preenchida. */
async function aderenciaMetodologica(periodoInicio: string, periodoFim: string): Promise<number> {
  const [total, comMetodologia] = (await Promise.all([
    cds.db.run(
      SELECT.one.from(`${NS}.Tratativas`).columns('count(*) as total')
        .where('dataCriacao >=', periodoInicio, 'and dataCriacao <=', periodoFim),
    ),
    cds.db.run(
      SELECT.one.from(`${NS}.Tratativas`).columns('count(*) as total')
        .where('dataCriacao >=', periodoInicio, 'and dataCriacao <=', periodoFim, 'and metodologia is not null'),
    ),
  ])) as [Total | undefined, Total | undefined];
  const universo = Number(total?.total ?? 0);
  return universo ? arredondar((Number(comMetodologia?.total ?? 0) / universo) * 100, 2) : 0;
}

async function encerramentosNoPeriodo(periodoInicio: string, periodoFim: string): Promise<Historico[]> {
  const historicos = (await cds.db.run(
    SELECT.from(`${NS}.HistoricoTratativa`)
      .columns('tratativa_codigo', 'evento', 'quando')
      .where({ evento: 'Encerramento' })
      .orderBy('quando asc'),
  )) as Historico[];
  const ultimos = new Map<string, Historico>();
  for (const historico of historicos) {
    ultimos.set(historico.tratativa_codigo, historico);
  }
  return [...ultimos.values()].filter((historico) => dentroDoPeriodo(dataCivil(historico.quando), periodoInicio, periodoFim));
}

async function totalTratativasVencidas(dataCorte: string): Promise<number> {
  const resultado = (await cds.db.run(
    SELECT.one
      .from(`${NS}.Tratativas`)
      .columns('count(*) as total')
      .where({
        status: { in: ['Aberta', 'Em andamento'] },
        dataPrevistaConclusao: { '<': dataCorte },
      }),
  )) as Total | undefined;
  return Number(resultado?.total ?? 0);
}
