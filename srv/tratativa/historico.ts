import cds from '@sap/cds';
import type { Autor } from './abertura';
import { tiposAutorValidos } from './dominios';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

export interface LinhaHistorico {
  evento: string;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  justificativa?: string | null;
  evidencia?: string | null;
  mimeType?: string | null;
  tamanho?: number | null;
  /** R11 (spec templates-de-acoes): metadado aditivo do template gerador da Ação (sem cópia de Descrição). */
  template?: string | null;
  templateNome?: string | null;
  avalTecnico?: string | null;
}

/** R20: autor e tipo de autor válidos antes de qualquer gravação. */
export function validarAutor(autor: Autor): void {
  if (typeof autor?.id !== 'string' || autor.id.trim() === '') recusar(400, 'O campo Autor é obrigatório.', 'autor');
  if (!tiposAutorValidos().includes(autor.tipo as string)) {
    recusar(400, 'Tipo de autor inválido: use Aplicativo, Usuario ou Sistema.', 'tipoAutor');
  }
}

/**
 * Insere todas as linhas de uma vez, no mesmo instante e com o mesmo autor.
 * Sem `acao`, grava em HistoricoTratativa; com `acao` (Código da Ação), grava em HistoricoAcoes da mesma Tratativa.
 */
export async function registrarHistorico(
  codigo: string,
  autor: Autor,
  linhas: LinhaHistorico[],
  quando: Date,
  acao?: string,
): Promise<void> {
  validarAutor(autor);
  if (!linhas.length) return;
  const referencia = acao === undefined ? { tratativa_codigo: codigo } : { tratativa_codigo: codigo, acao_codigo: acao };
  await cds.db.run(
    INSERT.into(`${NS}.${acao === undefined ? 'HistoricoTratativa' : 'HistoricoAcoes'}`).entries(
      linhas.map((l) => ({
        ID: cds.utils.uuid(),
        ...referencia,
        evento: l.evento,
        campo: l.campo ?? null,
        valorAnterior: l.valorAnterior ?? null,
        valorNovo: l.valorNovo ?? null,
        justificativa: l.justificativa ?? null,
        autor: autor.id,
        tipoAutor: autor.tipo,
        quando: quando.toISOString(),
        ...(l.evidencia ? { evidencia: l.evidencia } : {}),
        ...(l.mimeType ? { mimeType: l.mimeType } : {}),
        ...(l.tamanho !== undefined && l.tamanho !== null ? { tamanho: l.tamanho } : {}),
        ...(l.template ? { template_id: l.template } : {}),
        ...(l.templateNome ? { templateNome: l.templateNome } : {}),
        ...(l.avalTecnico ? { avalTecnico: l.avalTecnico } : {}),
      })),
    ),
  );
}
