import cds from '@sap/cds';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

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

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/tratativa/v1';

type Item = Record<string, unknown>;
const semAnotacoes = (o: Item) => Object.keys(o).filter((chave) => !chave.startsWith('@odata')).sort();
const CHAVES_ITEM = [
  'area', 'codigo', 'criticidade', 'dataCriacao', 'dataPrevistaConclusao', 'idOrigem', 'origem', 'status', 'titulo', 'unidade',
];
const CHAVES_DETALHE = [...CHAVES_ITEM, 'descricao', 'solicitante'].sort();

function urlLista(filtros: Record<string, string | number> = {}): string {
  const partes = Object.entries(filtros).map(([chave, valor]) =>
    typeof valor === 'number' ? `${chave}=${valor}` : `${chave}='${encodeURIComponent(valor)}'`,
  );
  return `${BASE}/listarTratativas(${partes.join(',')})`;
}

async function avulsaCom(dados: Record<string, unknown>): Promise<string> {
  const r = await criarAvulsa(enviar, dados);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
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

  it('CA7: nenhum arquivo sensível está presente ou rastreado no Git', () => {
    const rastreados = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    const sensiveis = rastreados.filter(
      (arquivo) => /(^|\/)(default-env\.json|\.env(\.|$)|\.cdsrc-private\.json)$/.test(arquivo) || /\.(pem|key)$/.test(arquivo),
    );
    expect(sensiveis).toEqual([]);

    for (const nome of ['default-env.json', '.env', '.cdsrc-private.json']) {
      expect(existsSync(join(RAIZ, nome))).toBe(false);
    }
  });

  it('CA12: GestorTratativa opera transversalmente, com 10 chaves na listagem e 12 no detalhe', async () => {
    const s = sufixoUnico();
    const norte = await avulsaCom({ titulo: `Norte ${s}`, unidade: `Norte-${s}`, area: `AreaA-${s}` });
    const sul = await avulsaCom({ titulo: `Sul ${s}`, unidade: `Sul-${s}`, area: `AreaB-${s}` });

    const lista = await GET(urlLista({ tamanhoPagina: 200 }), comoGestor);
    expect(lista.status).toBe(200);
    const itens = lista.data.value as Item[];
    expect(itens.map((item) => item.codigo)).toEqual(expect.arrayContaining([norte, sul]));
    for (const item of itens) {
      expect(semAnotacoes(item)).toEqual(CHAVES_ITEM);
    }

    const detalhe = await GET(`${BASE}/consultarTratativa(codigo=${norte})`, comoGestor);
    expect(detalhe.status).toBe(200);
    expect(semAnotacoes(detalhe.data as Item)).toEqual(CHAVES_DETALHE);

    // Gestão operacional transversal: o Gestor transita uma Tratativa de outra Unidade/Área.
    const inicio = await POST(`${BASE}/Tratativas(${sul})/mudarStatus`, { status: 'Em andamento' }, comoGestor);
    expect(inicio.status).toBe(204);
  });
});
