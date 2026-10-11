import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const PACOTE = join(RAIZ, 'package.json');
const GITIGNORE = join(RAIZ, '.gitignore');

type Perfis = Record<string, Record<string, unknown>>;

interface Pacote {
  cds: {
    requires: Record<string, Perfis | undefined>;
  };
}

function lerTexto(caminho: string): string {
  expect(existsSync(caminho)).toBe(true);
  return readFileSync(caminho, 'utf8');
}

function lerPacote(): Pacote {
  return JSON.parse(lerTexto(PACOTE)) as Pacote;
}

describe('Destinations declarativas, perfis de execução e governança de segredos', () => {
  it('CA5: package.json declara os destinations lógicos sob [production], sem URL nem senha fixa', () => {
    const pacote = lerPacote();
    const requires = pacote.cds.requires;

    for (const nome of ['SuccessFactors', 'ServicoNotificacoes']) {
      const servico = requires[nome];
      expect(servico).toBeDefined();
      expect((servico?.['[production]']?.credentials as { destination?: string } | undefined)?.destination).toBe(nome);
    }

    const bruto = JSON.stringify({ SuccessFactors: requires.SuccessFactors, ServicoNotificacoes: requires.ServicoNotificacoes });
    expect(bruto).not.toMatch(/"(url|password|clientsecret|client_secret|token|secret|key)"\s*:/i);
  });

  it('CA6: testes rodam com autenticação mockada e dublês em memória; XSUAA só em produção', () => {
    const pacote = lerPacote();
    const auth = pacote.cds.requires.auth ?? {};

    // Perfil ativo (testes/desenvolvimento): autenticação mockada.
    const authResolvido = (cds.env.requires as Record<string, unknown>).auth as { kind?: string } | undefined;
    expect(authResolvido?.kind).toBe('mocked');

    const desenvolvimento = auth['[development]'];
    expect(desenvolvimento?.kind).toBe('mocked');

    // Preservação integral dos usuários mockados e seus papéis.
    const usuarios = (desenvolvimento?.users ?? {}) as Record<string, { roles?: string[] }>;
    const esperados: Record<string, string[]> = {
      'app-origem-a': ['AplicativoOrigem'],
      'app-origem-b': ['AplicativoOrigem'],
      'app-revogado': ['AplicativoOrigem'],
      admin: ['Administrador'],
      usuario: [],
      gestor: ['GestorTratativa'],
      'leitor-analitico': ['LeitorAnalitico'],
    };
    for (const [nome, papeis] of Object.entries(esperados)) {
      expect(usuarios[nome]?.roles).toEqual(papeis);
    }

    // Produção: XSUAA, sem usuários mockados.
    const producao = auth['[production]'];
    expect(producao?.kind).toBe('xsuaa');
    expect(producao?.users).toBeUndefined();

    // Dublês em memória sob desenvolvimento e teste (nenhum destino real é acionado).
    for (const adaptador of [
      'ArmazenamentoEvidencias',
      'EmailAdapter',
      'TeamsAdapter',
      'ProvedorPessoasAdapter',
      'ProvedorEstruturaAdapter',
    ]) {
      for (const perfil of ['[development]', '[test]']) {
        expect((pacote.cds.requires[adaptador]?.[perfil] as { impl?: string } | undefined)?.impl).toMatch(/^test\/apoio\//);
      }
    }
  });

  it('CA8: .gitignore bloqueia credenciais/segredos e artefatos de build', () => {
    const regras = lerTexto(GITIGNORE).split(/\r?\n/).map((linha) => linha.trim());

    for (const padrao of ['default-env.json', '.env', '.cdsrc-private.json', '*.pem', '*.key', 'gen/']) {
      expect(regras).toContain(padrao);
    }
  });
});
