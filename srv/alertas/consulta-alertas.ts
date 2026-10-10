import cds from '@sap/cds';
import { codigoValido } from '../tratativa/consulta';
import { recusar } from '../tratativa/recusa';

const NS = 'br.com.calazanstec';

export interface FiltrosListagemAlertas {
  tratativa?: string | null;
  tipo?: string | null;
  destinatario?: string | null;
  statusEnvio?: string | null;
  tamanhoPagina?: number | null;
  pagina?: number | null;
}

export interface ItemAlertaEmitido {
  id: string;
  tipo: string;
  entidade: string;
  tratativa: string;
  acao: string | null;
  destinatario: string;
  canal: string;
  enviadoEm: string;
  statusEnvio: string;
  motivoFalha: string | null;
  dadosAlerta: string | null;
}

/** R11/R15: consulta auditável de alertas, respeitando a ordem de precedência D10. */
export async function listarAlertasEmitidos(filtros: FiltrosListagemAlertas): Promise<ItemAlertaEmitido[]> {
  let tratativa: string | undefined;
  if (filtros.tratativa != null) {
    if (!codigoValido(filtros.tratativa)) recusar(400, 'Código inválido.', 'tratativa');
    tratativa = filtros.tratativa.toLowerCase();
    const existente = await cds.db.run(
      SELECT.one.from(`${NS}.Tratativas`).columns('codigo').where({ codigo: tratativa }),
    ) as { codigo: string } | undefined;
    if (!existente) recusar(404, 'Tratativa não encontrada.', 'tratativa');
  }

  const tamanhoPagina = filtros.tamanhoPagina ?? 50;
  if (tamanhoPagina < 1 || tamanhoPagina > 200) {
    recusar(400, 'O campo Tamanho da página aceita de 1 a 200.', 'tamanhoPagina');
  }
  const pagina = filtros.pagina ?? 1;
  if (pagina < 1) recusar(400, 'O campo Página deve ser 1 ou maior.', 'pagina');

  const onde: Record<string, string> = {};
  if (tratativa !== undefined) onde.tratativa_codigo = tratativa;
  if (filtros.tipo != null) onde.tipo = filtros.tipo;
  if (filtros.destinatario != null) onde.destinatario = filtros.destinatario;
  if (filtros.statusEnvio != null) onde.statusEnvio = filtros.statusEnvio;

  return cds.db.run(
    SELECT.from(`${NS}.AlertasEmitidos`)
      .columns(
        'id',
        'tipo',
        'entidade',
        'tratativa_codigo as tratativa',
        'acao_codigo as acao',
        'destinatario',
        'canal',
        'enviadoEm',
        'statusEnvio',
        'motivoFalha',
        'dadosAlerta',
      )
      .where(onde)
      .orderBy('enviadoEm desc')
      .limit(tamanhoPagina, (pagina - 1) * tamanhoPagina),
  ) as Promise<ItemAlertaEmitido[]>;
}
