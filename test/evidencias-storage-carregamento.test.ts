import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Débito D-01: o armazenamento de Evidências é carregado por `import()` dinâmico. No Node do Windows,
// `import()` de um caminho absoluto nativo (`C:\...`) falha com ERR_UNSUPPORTED_ESM_URL_SCHEME: o
// especificador precisa ser uma URL de arquivo (pathToFileURL). Este teste estrutural lê o módulo
// (testes não importam srv/) e prova que o carregamento passa por uma URL de caminho absoluto.

const RAIZ = join(__dirname, '..');
const MODULO = join(RAIZ, 'srv', 'tratativa', 'evidencias-storage.ts');

describe('D-01: carregamento do módulo de armazenamento de Evidências (task 005)', () => {
  it('prova que o módulo é carregado a partir de uma URL de caminho absoluto (pathToFileURL)', () => {
    const fonte = readFileSync(MODULO, 'utf8');

    // O especificador do import() é uma URL de arquivo, não um caminho nativo.
    expect(fonte).toMatch(/pathToFileURL/);

    const importaPorUrl = /import\(\s*pathToFileURL\([\s\S]*?\)\s*\.href\s*\)/.test(fonte)
      || /import\(\s*[A-Za-z_$][\w$]*\.href\s*\)/.test(fonte);
    expect(importaPorUrl).toBe(true);

    // A conversão para URL parte de um caminho resolvido (absoluto) do módulo.
    expect(fonte).toMatch(/path(\.|\.resolve|\.isAbsolute|\.join)/);
  });
});
