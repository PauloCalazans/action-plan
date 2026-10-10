// Validação de Texto e Menções de comentários (design comentarios, decisão 6; R2, R4).

import { recusar } from './recusa';
import { validarMatricula } from './validacao-matricula';

const LIMITE_TEXTO = 2000;
const LIMITE_MENCOES = 10;

/**
 * R2: aplica trim() nas pontas, recusa vazio e recusa acima de 2.000 caracteres.
 * @param valor - Texto bruto do comentário
 * @returns Texto aparado e validado
 */
export function validarTextoComentario(valor: unknown): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (texto === '') recusar(400, 'O campo Texto do comentário é obrigatório.', 'texto');
  if (texto.length > LIMITE_TEXTO) {
    recusar(400, 'O campo Texto do comentário aceita no máximo 2000 caracteres.', 'texto');
  }
  return texto;
}

/**
 * R4: valida cada matrícula (005 R3), deduplica case-insensitive preservando a primeira grafia
 * e limita a 10 menções distintas.
 * @param valor - Lista de matrículas informada (pode ser omitida)
 * @returns Lista de matrículas validada e deduplicada
 */
export function validarMencoes(valor: unknown): string[] {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) return [];
  if (valor.length === 0) return [];

  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const item of valor) {
    const matricula = validarMatricula(item, 'mencoes');
    const chave = matricula.toLowerCase();
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    resultado.push(matricula);
  }

  if (resultado.length > LIMITE_MENCOES) {
    recusar(400, 'Limite de 10 menções por comentário atingido.', 'mencoes');
  }

  return resultado;
}
