// Módulo de validação declarativa de formatos, extensões e limites de evidências.
// R3, R4 (spec evidencias): sanitização, formatos aceitos e limites de tamanho.

import { recusar } from './recusa';

/** Limite de tamanho de arquivo: 10 MB em bytes. */
export const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024; // 10.485.760 bytes

/**
 * Pares de extensão e MIME types aceitos (normalizado para minúsculas).
 * R3: JPG, JPEG, PNG, PDF, DOCX, DOC, TXT, XLSX, XLS, CSV.
 */
const FORMATOS_ACEITOS: Record<string, string[]> = {
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.txt': ['text/plain'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
};

/**
 * Sanitiza o nome do arquivo: extrai o último segmento após '/' ou '\' e aplica trim().
 * R2, R4 (spec evidencias): CA10.
 * @param nomeArquivo Nome original do arquivo (pode conter caminho).
 * @returns Nome sanitizado (último segmento).
 */
export function sanitizarNomeArquivo(nomeArquivo: string): string {
  const segmentos = nomeArquivo.split(/[/\\]/);
  const ultimoSegmento = segmentos[segmentos.length - 1] || '';
  return ultimoSegmento.trim();
}

/**
 * Valida o nome do arquivo: não pode ser vazio nem exceder 255 caracteres.
 * R2, R4 (spec evidencias): CA10a, CA10b.
 * @param nomeArquivo Nome sanitizado do arquivo.
 */
export function validarNomeArquivo(nomeArquivo: string): void {
  if (!nomeArquivo || nomeArquivo.length === 0) {
    recusar(400, 'O campo Nome do arquivo é obrigatório.', 'nomeArquivo');
  }
  if (nomeArquivo.length > 255) {
    recusar(400, 'O campo Nome do arquivo aceita no máximo 255 caracteres.', 'nomeArquivo');
  }
}

/**
 * Valida o MIME type: não pode exceder 100 caracteres.
 * R4 (spec evidencias): CA10c.
 * @param mimeType Tipo MIME declarado.
 */
export function validarMimeType(mimeType: string): void {
  if (mimeType.length > 100) {
    recusar(415, 'Tipo de arquivo não permitido: envie imagem (JPG, PNG), PDF, documento (DOCX, DOC, TXT) ou planilha (XLSX, XLS, CSV).', 'arquivo');
  }
}

/**
 * Valida formato e compatibilidade entre extensão e MIME type.
 * R3, R4 (spec evidencias): CA11-CA14.
 * @param nomeArquivo Nome sanitizado do arquivo.
 * @param mimeType Tipo MIME declarado (normalizado para minúsculas).
 */
export function validarFormato(nomeArquivo: string, mimeType: string): void {
  const extensao = obterExtensao(nomeArquivo);
  const mimeNormalizado = mimeType.toLowerCase();

  const mimesAceitos = FORMATOS_ACEITOS[extensao];
  if (!mimesAceitos) {
    recusar(415, 'Tipo de arquivo não permitido: envie imagem (JPG, PNG), PDF, documento (DOCX, DOC, TXT) ou planilha (XLSX, XLS, CSV).', 'arquivo');
  }

  if (!mimesAceitos.includes(mimeNormalizado)) {
    // Extensão e MIME incompatíveis (CA13a)
    recusar(415, 'Tipo de arquivo não permitido: envie imagem (JPG, PNG), PDF, documento (DOCX, DOC, TXT) ou planilha (XLSX, XLS, CSV).', 'arquivo');
  }
}

/**
 * Valida tamanho do arquivo: não pode ser vazio nem exceder 10 MB.
 * R4, R14 (spec evidencias): CA15, CA16.
 * @param tamanho Tamanho em bytes do buffer decodificado.
 */
export function validarTamanho(tamanho: number): void {
  if (tamanho === 0) {
    recusar(400, 'O arquivo não pode ser vazio.', 'arquivo');
  }
  if (tamanho > TAMANHO_MAXIMO_ARQUIVO) {
    recusar(413, 'Arquivo excede o tamanho máximo permitido de 10 MB.', 'arquivo');
  }
}

/**
 * Valida a descrição: se informada, não pode exceder 500 caracteres após trim().
 * R2, R4 (spec evidencias): CA9.
 * @param descricao Descrição opcional da evidência.
 * @returns Descrição trimada ou null se vazia.
 */
export function validarDescricao(descricao: string | null | undefined): string | null {
  if (!descricao) return null;
  const trimada = descricao.trim();
  if (trimada.length === 0) return null;
  if (trimada.length > 500) {
    recusar(400, 'O campo Descrição aceita no máximo 500 caracteres.', 'descricao');
  }
  return trimada;
}

/**
 * Obtém a extensão do arquivo em minúsculas com o ponto inicial.
 * @param nomeArquivo Nome do arquivo.
 * @returns Extensão (ex.: '.pdf', '.jpg').
 */
function obterExtensao(nomeArquivo: string): string {
  const partes = nomeArquivo.split('.');
  if (partes.length < 2) return '';
  return '.' + partes[partes.length - 1].toLowerCase();
}
