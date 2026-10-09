// Dublê em memória do serviço ArmazenamentoEvidencias.
// Armazena buffers em Map<string, Buffer> privado.
// Exporta funções de inspeção de teste sem expect().

const arquivos = new Map<string, Buffer>();
let falharProxima = false;

export async function salvar(id: string, conteudo: Buffer): Promise<void> {
  if (falharProxima) {
    falharProxima = false;
    throw new Error('falha simulada no armazenamento');
  }
  arquivos.set(id, conteudo);
}

export async function obter(id: string): Promise<Buffer | null> {
  return arquivos.get(id) || null;
}

export async function excluir(id: string): Promise<void> {
  if (falharProxima) {
    falharProxima = false;
    throw new Error('falha simulada no armazenamento');
  }
  arquivos.delete(id);
}

// Funções de inspeção (chamadas pelos testes, sem expect)
export function limparArmazenamento(): void {
  arquivos.clear();
  falharProxima = false;
}

export function contemArquivo(id: string): boolean {
  return arquivos.has(id);
}

export function falharProximoArmazenamento(): void {
  falharProxima = true;
}

// Export default para que o CAP possa importar como serviço
export default { salvar, obter, excluir };
