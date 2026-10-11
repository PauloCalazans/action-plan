import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const RAIZ = join(__dirname, '..');
const GEN = join(RAIZ, 'gen');
const PACOTE = join(RAIZ, 'package.json');

jest.setTimeout(180000);

interface Pacote {
  scripts: Record<string, string>;
}

const pacote = JSON.parse(readFileSync(PACOTE, 'utf8')) as Pacote;

// Executa um script do package.json SEM npm (binários locais no PATH); nunca fala com o BTP.
function executarScript(script: string): void {
  execSync(script, {
    cwd: RAIZ,
    stdio: 'pipe',
    env: { ...process.env, PATH: join(RAIZ, 'node_modules', '.bin') + delimiter + (process.env.PATH ?? '') },
  });
}

function arquivos(diretorio: string): string[] {
  if (!existsSync(diretorio)) return [];
  return readdirSync(diretorio, { recursive: true })
    .map((entrada) => join(diretorio, String(entrada)))
    .filter((caminho) => statSync(caminho).isFile());
}

describe('Prontidão de compilação corporativa e build de produção', () => {
  beforeAll(() => {
    // Compila para produção (cds-typer + TypeScript + cds build --production), sem npm.
    executarScript(pacote.scripts.build);
  });

  it('CA2: a compilação gera os artefatos HANA em gen/db e o serviço Node.js compilado em gen/srv', () => {
    const artefatosBanco = arquivos(join(GEN, 'db'));
    expect(artefatosBanco.some((arquivo) => /\.hdb(table|view|migrationtable)$/.test(arquivo))).toBe(true);

    // O runtime Node.js de produção precisa dos handlers TypeScript compilados (exclui os tipos @cds-models).
    const servicoCompilado = arquivos(join(GEN, 'srv')).filter(
      (arquivo) => arquivo.endsWith('.js') && !arquivo.includes('@cds-models'),
    );
    expect(servicoCompilado.length).toBeGreaterThan(0);
  });
});
