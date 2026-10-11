import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comoAdmin, comoApp, comoGestor, comoUsuario } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const RAIZ = join(__dirname, '..');
const APP = '/api/app/v1';
const ADMIN = '/api/administracao/v1';
const SERVICO_NUVEM = 'br.com.calazanstec.actionplan';
const DESTINO = 'action-plan-srv-api';

// Leitor Analítico: usuário mockado do package.json (papel LeitorAnalitico), sem helper compartilhado novo.
const comoLeitor = { auth: { username: 'leitor-analitico', password: '' }, validateStatus: () => true };

type Json = Record<string, unknown>;

// Lê um JSON do repositório; a presença do arquivo é requisito, não asserção isolada.
function lerJson(caminho: string): Json {
  expect(existsSync(caminho)).toBe(true);
  return JSON.parse(readFileSync(caminho, 'utf8')) as Json;
}

function manifesto(app: string): Json {
  return lerJson(join(RAIZ, 'app', app, 'webapp', 'manifest.json'));
}

function xSApp(app: string): Json {
  return lerJson(join(RAIZ, 'app', app, 'xs-app.json'));
}

function inbounds(manifestoApp: Json): Json {
  const sapApp = manifestoApp['sap.app'] as Json | undefined;
  const crossNavigation = sapApp?.['crossNavigation'] as Json | undefined;
  return (crossNavigation?.['inbounds'] as Json | undefined) ?? {};
}

function servicoNuvem(manifestoApp: Json): unknown {
  return (manifestoApp['sap.cloud'] as Json | undefined)?.['service'];
}

function destinoDoBackend(xsApp: Json): boolean {
  const rotas = xsApp['routes'];
  return Array.isArray(rotas)
    && (rotas as Json[]).some((rota) => rota['destination'] === DESTINO && rota['authenticationType'] === 'xsuaa');
}

type Erro = { error?: { message?: string } };

async function status(url: string, como: unknown): Promise<number> {
  return (await GET(url, como)).status;
}

describe('Governança do Launchpad (Work Zone) e bloqueio do aplicativo técnico', () => {
  it('CA18: usuário comum tem Gestão e Minhas Pendências e é bloqueado na Administração', async () => {
    // in-repo: os inbounds dos dois tiles do usuário comum estão declarados.
    expect(inbounds(manifesto('tratativas'))).toHaveProperty('Tratativa-manage');
    expect(inbounds(manifesto('minhas-pendencias'))).toHaveProperty('MinhasPendencias-display');

    // backend: consulta autorizada em /api/app/v1 e Administração negada.
    expect(await status(`${APP}/Tratativas`, comoUsuario)).toBe(200);
    expect(await status(`${APP}/MinhasAcoes`, comoUsuario)).toBe(200);
    expect(await status(`${ADMIN}/Templates`, comoUsuario)).toBe(403);
  });

  it('CA19: Administrador acessa Gestão, Minhas Pendências e Administração no backend', async () => {
    expect(await status(`${APP}/Tratativas`, comoAdmin)).toBe(200);
    expect(await status(`${APP}/MinhasTratativas`, comoAdmin)).toBe(200);
    expect(await status(`${ADMIN}/Templates`, comoAdmin)).toBe(200);
    expect(await status(`${ADMIN}/ParametrosAlertas`, comoAdmin)).toBe(200);
    expect(await status(`${ADMIN}/ParametrosIntegracaoSF`, comoAdmin)).toBe(200);

    // in-repo: o tile de Administração está declarado e aponta para a destination do backend.
    expect(inbounds(manifesto('administracao'))).toHaveProperty('AdministracaoPlataforma-manage');
    expect(destinoDoBackend(xSApp('administracao'))).toBe(true);
  });

  it('CA19a: Gestor de Tratativa consulta Gestão/Minhas e é bloqueado na Administração', async () => {
    expect(await status(`${APP}/Tratativas`, comoGestor)).toBe(200);
    expect(await status(`${APP}/MinhasAcoes`, comoGestor)).toBe(200);
    expect(await status(`${ADMIN}/Templates`, comoGestor)).toBe(403);
  });

  it('CA19b: Leitor Analítico usa Minhas Pendências e é bloqueado na Administração', async () => {
    expect(await status(`${APP}/MinhasAcoes`, comoLeitor)).toBe(200);
    expect(await status(`${ADMIN}/Templates`, comoLeitor)).toBe(403);
  });

  it('CA20: Aplicativo de origem recebe 403 em entity sets, projeções e actions ($metadata isento, Ruling R-07)', async () => {
    const leituras = [
      `${APP}/Tratativas`,
      `${APP}/MinhasAcoes`,
      `${APP}/MinhasTratativas`,
      `${APP}/Acoes`,
      `${ADMIN}/Templates`,
      `${ADMIN}/ParametrosAlertas`,
      `${ADMIN}/ParametrosIntegracaoSF`,
    ];
    for (const alvo of leituras) {
      const r = await GET(alvo, comoApp);
      expect(r.status).toBe(403);
      expect((r.data as Erro).error?.message).toBe('Acesso negado.');
    }

    // Ao menos uma action de /api/app/v1 também recusa a credencial técnica.
    const criar = await POST(`${APP}/criarTratativaAvulsa`, { titulo: 'Ocorrência direta', criticidade: 'Alta' }, comoApp);
    expect(criar.status).toBe(403);
    expect((criar.data as Erro).error?.message).toBe('Acesso negado.');

    // Ruling R-07: o $metadata é isento (apenas esquema, sem dados) e responde 200 para o Aplicativo de origem.
    for (const servico of [APP, ADMIN]) {
      const metadados = await GET(`${servico}/$metadata`, comoApp);
      expect(metadados.status).toBe(200);
    }
  });

  it('CA27 e CA27a: inbounds, sap.cloud.service e rotas XSUAA válidos em execução headless', async () => {
    const esperados: Record<string, string> = {
      tratativas: 'Tratativa-manage',
      'minhas-pendencias': 'MinhasPendencias-display',
      administracao: 'AdministracaoPlataforma-manage',
    };
    for (const [app, inbound] of Object.entries(esperados)) {
      const manifestoApp = manifesto(app);
      expect(servicoNuvem(manifestoApp)).toBe(SERVICO_NUVEM);
      expect(inbounds(manifestoApp)).toHaveProperty(inbound);

      const xsApp = xSApp(app);
      expect(xsApp['authenticationMethod']).toBe('route');
      expect(destinoDoBackend(xsApp)).toBe(true);
    }

    expect((await GET(`${APP}/$metadata`, comoAdmin)).status).toBe(200);
    expect((await GET(`${ADMIN}/$metadata`, comoAdmin)).status).toBe(200);
  });
});
