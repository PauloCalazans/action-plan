import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Prova da regra de genericidade (decisão 13; AGENTS.md:36): roda o ESLint do projeto em processo filho.
const raiz = path.join(__dirname, '..');
const eslint = path.join(raiz, 'node_modules', 'eslint', 'bin', 'eslint.js');

function mensagensRestritas(input: string) {
  const r = spawnSync(
    process.execPath,
    [eslint, '--stdin', '--stdin-filename', 'srv/fixture-genericidade.ts', '--format', 'json'],
    { cwd: raiz, input, encoding: 'utf8' },
  );
  const mensagens = JSON.parse(r.stdout)[0].messages as { ruleId: string | null }[];
  return mensagens.filter((m) => m.ruleId === 'no-restricted-syntax');
}

describe('genericidade: nome de Origem/área em srv/**/*.ts', () => {
  it('recusa literal e template com nome de Origem/área', () => {
    const achados = mensagensRestritas("export const x = 'Advertência';\nexport const y = `SESMT`;\n");
    expect(achados).toHaveLength(2);
  });

  it('aceita trecho sem nome de Origem/área', () => {
    expect(mensagensRestritas("export const x = 'Auditoria';\n")).toHaveLength(0);
  });
});
