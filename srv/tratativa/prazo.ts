import cds from '@sap/cds';
import { recusar } from './recusa';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Soma dias corridos a uma data civil `YYYY-MM-DD` (aritmética em UTC, sem horário de verão). */
export function somarDiasCorridos(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const base = Date.UTC(ano, mes - 1, dia);
  return new Date(base + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Lê da tabela PrazosCriticidade os dias da Criticidade (R10/R11). */
export async function diasDoPrazo(criticidade: string): Promise<number> {
  const prazo = (await cds.db.run(
    SELECT.one.from('br.com.calazanstec.PrazosCriticidade').columns('dias').where({ criticidade }),
  )) as { dias?: number } | null | undefined;
  if (!prazo || typeof prazo.dias !== 'number') {
    recusar(400, 'Prazo não configurado para a criticidade informada.', 'criticidade');
  }
  return prazo.dias;
}
