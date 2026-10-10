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
  const rotulo =
    valor === minusculo || valor === valor.toLocaleUpperCase('pt-BR')
      ? `${minusculo.charAt(0).toLocaleUpperCase('pt-BR')}${minusculo.slice(1)}`
      : valor;
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
