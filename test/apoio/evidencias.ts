// Helpers OData V4 para operações de Evidências.
// Sem expect(); testes consomem esses helpers e fazem suas próprias asserções.

export interface Resposta {
  status: number;
  data: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

export interface Envia {
  (url: string, data: Record<string, unknown>, config?: Record<string, unknown>): Promise<Resposta>;
}

// Codifica Buffer em Base64 string
export function bufferParaBase64(buf: Buffer): string {
  return buf.toString('base64');
}

// Geradores de buffers para testes (diferentes tamanhos e formatos)
export function gerarBuffer(tamanho: number, conteudo: string = 'X'): Buffer {
  return Buffer.alloc(tamanho, conteudo);
}

export function gerarJPG(tamanho: number = 1000): Buffer {
  const buf = Buffer.alloc(tamanho);
  buf.write('JPEG_FAKE_', 0);
  return buf;
}

export function gerarPNG(tamanho: number = 1000): Buffer {
  const buf = Buffer.alloc(tamanho);
  buf.write('PNG_FAKE_', 0);
  return buf;
}

export function gerarPDF(tamanho: number = 1000): Buffer {
  const buf = Buffer.alloc(tamanho);
  buf.write('%PDF-1.4', 0);
  return buf;
}

export function gerarDOCX(tamanho: number = 1000): Buffer {
  const buf = Buffer.alloc(tamanho);
  buf.write('PK', 0); // ZIP signature (DOCX is ZIP)
  return buf;
}

export function gerarTXT(tamanho: number = 1000): Buffer {
  const conteudo = 'Lorem ipsum dolor sit amet '.repeat(Math.ceil(tamanho / 27));
  return Buffer.from(conteudo.substring(0, tamanho));
}

export function gerarCSV(tamanho: number = 1000): Buffer {
  const conteudo = 'col1,col2,col3\n'.repeat(Math.ceil(tamanho / 15));
  return Buffer.from(conteudo.substring(0, tamanho));
}

export function gerarVazio(): Buffer {
  return Buffer.alloc(0);
}

export function gerarAcimaDe10MB(): Buffer {
  // 10.485.761 bytes (10 MB + 1 byte)
  return Buffer.alloc(10485761, 'X');
}

export function gerarExatamente10MB(): Buffer {
  // 10.485.760 bytes
  return Buffer.alloc(10485760, 'X');
}

export function gerarExecutavel(): Buffer {
  const buf = Buffer.alloc(1000);
  buf.write('MZ'); // executável Windows
  return buf;
}

// Operação: anexar evidência
export async function anexarEvidencia(
  POST: Envia,
  tratativa: string,
  dados: {
    acao?: string | null;
    nomeArquivo?: string;
    mimeType?: string;
    conteudo: Buffer | string; // Buffer será convertido em Base64
    descricao?: string;
  },
  como: Record<string, unknown> = {}
): Promise<Resposta> {
  const conteudoBase64 = typeof dados.conteudo === 'string' ? dados.conteudo : bufferParaBase64(dados.conteudo);
  const payload: Record<string, unknown> = {
    acao: dados.acao ?? undefined,
    nomeArquivo: dados.nomeArquivo ?? undefined,
    mimeType: dados.mimeType ?? undefined,
    conteudo: conteudoBase64,
    descricao: dados.descricao ?? undefined,
  };
  // Remove undefined para payload limpo
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  return POST(`/api/tratativa/v1/Tratativas('${tratativa}')/anexarEvidencia`, payload, como);
}

// Helper para remover evidência (será usado na Etapa 2)
export async function removerEvidencia(
  POST: Envia,
  tratativa: string,
  dados: {
    acao: string;
    evidencia: string;
  },
  como: Record<string, unknown> = {}
): Promise<Resposta> {
  return POST(`/api/tratativa/v1/Tratativas('${tratativa}')/removerEvidencia`, dados, como);
}
