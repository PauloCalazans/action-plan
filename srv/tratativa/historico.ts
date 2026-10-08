import cds from '@sap/cds';
import type { Autor } from './abertura';
import { tiposAutorValidos } from './dominios';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

export interface LinhaHistorico {
  evento: string; campo?: string | null; valorAnterior?: string | null; valorNovo?: string | null; justificativa?: string | null;
}

/** R20: autor e tipo de autor válidos antes de qualquer gravação. */
export function validarAutor(autor: Autor): void {
  if (typeof autor?.id !== 'string' || autor.id.trim() === '') recusar(400, 'O campo Autor é obrigatório.', 'autor');
  if (!tiposAutorValidos().includes(autor.tipo as string)) {
    recusar(400, 'Tipo de autor inválido: use Aplicativo, Usuario ou Sistema.', 'tipoAutor');
  }
}

/** Insere todas as linhas de uma vez, no mesmo instante e com o mesmo autor. */
export async function registrarHistorico(codigo: string, autor: Autor, linhas: LinhaHistorico[], quando: Date): Promise<void> {
  validarAutor(autor);
  if (!linhas.length) return;
  await cds.db.run(
    INSERT.into(`${NS}.HistoricoTratativa`).entries(
      linhas.map((l) => ({
        ID: cds.utils.uuid(),
        tratativa_codigo: codigo,
        evento: l.evento,
        campo: l.campo ?? null,
        valorAnterior: l.valorAnterior ?? null,
        valorNovo: l.valorNovo ?? null,
        justificativa: l.justificativa ?? null,
        autor: autor.id,
        tipoAutor: autor.tipo,
        quando: quando.toISOString(),
      })),
    ),
  );
}
