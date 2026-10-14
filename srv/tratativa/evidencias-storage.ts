// Módulo único de resolução e carregamento do serviço de armazenamento de Evidências.
// Elimina duplicação de getStorage (MEN-02 da revisão do diff).

import cds from '@sap/cds';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'node:url';

export interface StorageModule {
  salvar: (id: string, conteudo: Buffer) => Promise<void>;
  obter: (id: string) => Promise<Buffer | null>;
  excluir: (id: string) => Promise<void>;
}

let storageModule: StorageModule | null = null;

/**
 * Obtém a instância singleton do módulo de armazenamento de Evidências.
 * Carrega dinamicamente a implementação configurada em cds.env.requires.ArmazenamentoEvidencias.impl.
 */
export async function getStorage(): Promise<StorageModule> {
  if (!storageModule) {
    await cds.connect.to('ArmazenamentoEvidencias'); // Registra o serviço
    const impl = cds.env.requires?.ArmazenamentoEvidencias?.impl || './armazenamento-evidencias';
    let modulePath = impl;
    
    // Se o path é relativo, resolve a partir de diferentes bases
    if (!path.isAbsolute(impl)) {
      // Primeiro tenta do diretório raiz do projeto
      const fromRoot = path.resolve(process.cwd(), impl);
      // Se não encontrar, tenta relativo ao diretório atual do módulo
      const fromHere = path.resolve(__dirname, impl);
      
      if (fs.existsSync(fromRoot + '.ts') || fs.existsSync(fromRoot + '.js')) {
        modulePath = fromRoot;
      } else if (fs.existsSync(fromHere + '.ts') || fs.existsSync(fromHere + '.js')) {
        modulePath = fromHere;
      }
    }
    
    // ESM dynamic import: no Windows o especificador precisa ser uma URL de arquivo (D-01).
    const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
    storageModule = imported.default || imported;
  }
  if (!storageModule) {
    throw new Error('Falha ao carregar módulo de armazenamento');
  }
  return storageModule;
}
