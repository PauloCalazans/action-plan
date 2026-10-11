import cds from '@sap/cds';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoUsuario } from './apoio/usuarios';

const RAIZ = join(__dirname, '..');
const GEN = join(RAIZ, 'gen');
const PACOTE = join(RAIZ, 'package.json');
const DEPCRUISER = join(RAIZ, '.dependency-cruiser.cjs');
const BASE = '/api/tratativa/v1';

jest.setTimeout(180000);

const { GET, POST } = cds.test(RAIZ);
const enviar = POST as unknown as Envia;

interface Pacote {
  scripts: Record<string, string>;
}

const pacote = JSON.parse(readFileSync(PACOTE, 'utf8')) as Pacote;

let construiu = false;

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
    construiu = true;
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

  it('CA9: o pipeline npm run build envolve cds-typer, TypeScript e CDS e conclui com retorno zero', () => {
    // O beforeAll executou o script de build real; se falhasse, o hook teria lançado erro.
    expect(construiu).toBe(true);
    expect(pacote.scripts.build).toContain('cds-typer');
    expect(pacote.scripts.build).toContain('tsc');
    expect(pacote.scripts.build).toContain('cds build --production');
  });

  it('CA10: a verificação de fronteiras arquiteturais está configurada (npm run arch)', () => {
    expect(pacote.scripts.arch).toContain('depcruise');
    expect(pacote.scripts.arch).toContain('.dependency-cruiser.cjs');

    const configuracao = readFileSync(DEPCRUISER, 'utf8');
    expect(configuracao).toContain('app-nao-importa-srv');
    expect(configuracao).toContain('db-nao-depende-de-srv-nem-app');
  });

  it('CA13: o esquema relacional é recriado em SQLite em memória sob cds.test', async () => {
    const criada = await criarAvulsa(enviar, { titulo: `Build ${sufixoUnico()}`, criticidade: 'Alta' });
    expect(criada.status).toBe(200);

    const consulta = await GET(`${BASE}/consultarTratativa(codigo=${criada.data.codigo})`, comoUsuario);
    expect(consulta.status).toBe(200);
    expect(consulta.data.codigo).toBe(criada.data.codigo);
  });
});
