import cds from '@sap/cds';

const NS = 'br.com.calazanstec';

type Total = { total: number };

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
