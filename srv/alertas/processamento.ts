import cds from '@sap/cds';
import { randomUUID } from 'node:crypto';
import { avaliarAlertas } from './motor-regras';

const ALERTAS_EMITIDOS = 'br.com.calazanstec.AlertasEmitidos';

export interface RelatorioProcessamentoAlertas {
  ocorrenciasAvaliadas: number;
  alertasGerados: number;
  notificacoesEnviadas: number;
  falhas: number;
}

export async function processarAlertas(agora: Date): Promise<RelatorioProcessamentoAlertas> {
  const avaliacao = await avaliarAlertas(agora);
  if (avaliacao.alertas.length > 0) {
    await cds.db.run(INSERT.into(ALERTAS_EMITIDOS).entries(
      avaliacao.alertas.map((alerta) => ({
        id: randomUUID(),
        tipo: alerta.tipo,
        entidade: alerta.entidade,
        tratativa_codigo: alerta.tratativa,
        acao_codigo: alerta.acao ?? null,
        destinatario: alerta.destinatario,
        canal: 'Email',
        enviadoEm: agora.toISOString(),
        statusEnvio: 'Sucesso',
      })),
    ));
  }

  return {
    ocorrenciasAvaliadas: avaliacao.ocorrenciasAvaliadas,
    alertasGerados: avaliacao.alertas.length,
    notificacoesEnviadas: 0,
    falhas: 0,
  };
}
