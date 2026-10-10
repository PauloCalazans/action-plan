// Serviço CAP de armazenamento desacoplado de arquivos de Evidências.
// Implementação base para Object Store/DMS configurado em produção (intent 014).
// Em desenvolvimento/teste, o dublê test/apoio/armazenamento-espiao.ts é usado via package.json cds.requires.

/**
 * Salva um arquivo binário no repositório de armazenamento.
 * @param id Identificador único do arquivo (UUID da Evidência).
 * @param conteudo Buffer com o conteúdo binário do arquivo.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function salvar(_id: string, _conteudo: Buffer): Promise<void> {
  // Implementação com Object Store / SAP DMS será fornecida no intent 014.
  // Para desenvolvimento/teste, o package.json aponta para test/apoio/armazenamento-espiao.
  throw new Error('Armazenamento de produção não configurado. Use perfil [development] ou [test].');
}

/**
 * Obtém um arquivo binário do repositório de armazenamento.
 * @param id Identificador único do arquivo (UUID da Evidência).
 * @returns Buffer com o conteúdo binário ou null se não encontrado.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function obter(_id: string): Promise<Buffer | null> {
  throw new Error('Armazenamento de produção não configurado. Use perfil [development] ou [test].');
}

/**
 * Exclui um arquivo binário do repositório de armazenamento.
 * @param id Identificador único do arquivo (UUID da Evidência).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function excluir(_id: string): Promise<void> {
  throw new Error('Armazenamento de produção não configurado. Use perfil [development] ou [test].');
}

// Exportação padrão necessária para que o CAP importe como serviço
export default { salvar, obter, excluir };
