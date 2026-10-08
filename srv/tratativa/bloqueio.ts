import cds from '@sap/cds';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

export interface TratativaBloqueada {
  codigo: string; titulo: string; descricao: string | null; unidade: string | null; area: string | null;
  solicitante: string | null; criticidade: string; status: string; dataCriacao: string; dataPrevistaConclusao: string;
}

/**
 * D9: primeira leitura de toda operação de ciclo de vida, na transação do pedido.
 * Sem `.one` e sem `limit`: o SQL fica `... WHERE codigo = ? FOR UPDATE` (design tratativa, decisão 6).
 */
export async function bloquearTratativa(codigo: string): Promise<TratativaBloqueada> {
  const linhas = (await cds.db.run(
    SELECT.from(`${NS}.Tratativas`)
      .columns('codigo', 'titulo', 'descricao', 'unidade', 'area', 'solicitante', 'criticidade', 'status',
        'dataCriacao', 'dataPrevistaConclusao')
      .where({ codigo })
      .forUpdate(),
  )) as TratativaBloqueada[];
  if (!linhas?.length) recusar(404, 'Tratativa não encontrada.');
  return linhas[0];
}

/** R14: Tratativa Encerrada ou Cancelada não é alterada (409). */
export function exigirAlteravel(t: TratativaBloqueada): void {
  if (t.status === 'Encerrada' || t.status === 'Cancelada') {
    recusar(409, `Tratativa ${t.status} não pode ser alterada.`);
  }
}
