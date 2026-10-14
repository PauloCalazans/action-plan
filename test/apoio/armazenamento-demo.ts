// Armazenamento de Evidências para o perfil [development] (demonstração local, cds watch).
// Igual ao dublê em memória, mas `obter` cai para os arquivos fictícios de test/demo/arquivos/
// quando a Evidência foi semeada pelos CSVs de demonstração (o arquivo se chama `<codigo da Evidência>.<ext>`).
// Nunca é usado em [test] nem em [production] (ver cds.requires.ArmazenamentoEvidencias no package.json).

import fs from 'fs';
import path from 'path';

const PASTA_DEMO = path.resolve(process.cwd(), 'test', 'demo', 'arquivos');
const CODIGO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const arquivos = new Map<string, Buffer>();

export async function salvar(id: string, conteudo: Buffer): Promise<void> {
  arquivos.set(id, conteudo);
}

function lerArquivoDemo(id: string): Buffer | null {
  if (!CODIGO.test(id) || !fs.existsSync(PASTA_DEMO)) return null;
  const nome = fs.readdirSync(PASTA_DEMO).find((arquivo) => path.parse(arquivo).name.toLowerCase() === id.toLowerCase());
  return nome ? fs.readFileSync(path.join(PASTA_DEMO, nome)) : null;
}

export async function obter(id: string): Promise<Buffer | null> {
  return arquivos.get(id) ?? lerArquivoDemo(id);
}

export async function excluir(id: string): Promise<void> {
  arquivos.delete(id);
}

export default { salvar, obter, excluir };
