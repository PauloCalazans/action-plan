import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const PACOTE = join(RAIZ, 'package.json');
const AGENTS = join(RAIZ, 'AGENTS.md');
const SETTINGS = join(RAIZ, '.claude', 'settings.json');
const GITHOOKS = join(RAIZ, 'agentic', 'mecanismos', 'githooks');
const CONFIG = join(RAIZ, 'agentic', 'config');
const DESIGN = join(RAIZ, 'agentic', 'projeto', 'specs', 'publicacao-corporativa', 'design.md');

function texto(caminho: string): string {
  expect(existsSync(caminho)).toBe(true);
  return readFileSync(caminho, 'utf8');
}

describe('Governança de promoção entre ambientes e bloqueio de deploy autônomo', () => {
  it('CA11: nenhum script autônomo de deploy em nuvem ou de merge na branch principal', () => {
    const pacote = JSON.parse(texto(PACOTE)) as { scripts?: Record<string, string> };
    const scripts = pacote.scripts ?? {};

    for (const [nome, comando] of Object.entries(scripts)) {
      expect(nome).not.toMatch(/deploy|publish|push|merge/i);
      expect(comando).not.toMatch(
        /\bcf\s+(deploy|push|login)\b|\bmbt\s+(build|deploy)\b|\bgit\s+(push|merge)\b|\bgh\s+pr\s+merge\b/i,
      );
    }
  });

  it('CA11: o merge na branch principal é impedido (deny do agente + githooks + branches protegidas)', () => {
    const settings = JSON.parse(texto(SETTINGS)) as {
      permissions?: { deny?: string[]; disableBypassPermissionsMode?: string };
    };
    expect(settings.permissions?.deny ?? []).toContain('Bash(gh pr merge:*)');
    expect(settings.permissions?.disableBypassPermissionsMode).toBe('disable');

    for (const hook of ['pre-commit', 'pre-merge-commit', 'pre-push']) {
      expect(existsSync(join(GITHOOKS, hook))).toBe(true);
    }
    expect(texto(join(GITHOOKS, 'pre-merge-commit'))).toMatch(/branch protegida/);
    expect(texto(join(GITHOOKS, 'pre-push'))).toMatch(/branch protegida/);
    expect(texto(CONFIG)).toMatch(/BRANCHES_PROTEGIDAS="main master"/);
  });

  it('CA11: a promoção DEV/QA/PRD é documentada como manual e exclusivamente humana', () => {
    const agents = texto(AGENTS);
    expect(agents).toMatch(/Nunca faça merge na branch principal/);
    expect(agents).toMatch(/Deploy\/infra/);

    const design = texto(DESIGN);
    expect(design).toMatch(/DEV/);
    expect(design).toMatch(/QA/);
    expect(design).toMatch(/PRD/);
    expect(design).toMatch(/exclusivamente human/i);
  });
});
