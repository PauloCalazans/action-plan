import cds from '@sap/cds';

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
    this.before('READ', 'PendenciasPorResponsavel', (req) => {
      if (!req.user.is('GestorTratativa') && !req.user.is('Administrador')) req.reject(403, 'Acesso negado.');
    });
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
        .sort((a, b) => {
          if (a.area === 'Sem Área') return 1;
          if (b.area === 'Sem Área') return -1;
          return b.total - a.total || a.area.localeCompare(b.area, 'pt-BR');
        });
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
      if (!encerramentos.length) return { taxaPercentual: 100 };
      const porCodigo = new Map(encerramentos.map((item) => [item.tratativa_codigo, item]));
      const tratativas = (await cds.db.run(
        SELECT.from(`${NS}.Tratativas`).columns('codigo', 'dataPrevistaConclusao', 'status'),
      )) as Array<Pick<Tratativa, 'codigo' | 'dataPrevistaConclusao' | 'status'>>;
      const noPrazo = tratativas.filter((tratativa) => {
        const encerramento = porCodigo.get(tratativa.codigo);
        return encerramento && tratativa.status !== 'Cancelada' && dataCivil(encerramento.quando) <= tratativa.dataPrevistaConclusao;
      });
      return { taxaPercentual: Number(((noPrazo.length / encerramentos.length) * 100).toFixed(2)) };
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
        .filter((encerramento) => porCodigo.get(encerramento.tratativa_codigo)?.status !== 'Cancelada')
        .map((encerramento) => {
          const criado = porCodigo.get(encerramento.tratativa_codigo)?.criadoEm;
          return criado ? (Date.parse(encerramento.quando) - Date.parse(criado)) / 86400000 : 0;
        });
      return { mediaDias: dias.length ? Number((dias.reduce((soma, dias) => soma + dias, 0) / dias.length).toFixed(1)) : 0 };
    });
    this.on('consultarTratativasVencidas', async (req) => {
      const { dataCorte } = req.data as { dataCorte: string };
      const resultado = (await cds.db.run(
        SELECT.one
          .from(`${NS}.Tratativas`)
          .columns('count(*) as total')
          .where({
            status: { in: ['Aberta', 'Em andamento'] },
            dataPrevistaConclusao: { '<': dataCorte },
          }),
      )) as Total | undefined;
      return { total: Number(resultado?.total ?? 0) };
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
      return { indicePercentual: criadas ? Number(((encerradas / criadas) * 100).toFixed(2)) : 0 };
    });
    return super.init();
  }
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
