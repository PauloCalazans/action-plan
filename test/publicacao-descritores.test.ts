import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// js-yaml é dependência já instalada, porém sem @types no projeto: require tipado localmente (padrão dos testes).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { load: carregarYaml } = require('js-yaml') as { load: (texto: string) => unknown };

const RAIZ = join(__dirname, '..');
const MTA = join(RAIZ, 'mta.yaml');
const XS_SECURITY = join(RAIZ, 'xs-security.json');

interface ModuloMta {
  name?: string;
  type?: string;
  path?: string;
  requires?: { name?: string; parameters?: { 'content-target'?: boolean } }[];
  provides?: { name?: string; properties?: Record<string, unknown> }[];
  'build-parameters'?: {
    builder?: string;
    'build-result'?: string;
    commands?: string[];
    'supported-platforms'?: unknown[];
    requires?: { name?: string; artifacts?: string[]; 'target-path'?: string }[];
  };
}

interface RecursoMta {
  name?: string;
  type?: string;
  parameters?: {
    service?: string;
    'service-plan'?: string;
    config?: {
      init_data?: { instance?: { destinations?: Record<string, unknown>[] } };
    };
  };
}

interface Mta {
  '_schema-version'?: unknown;
  ID?: string;
  modules?: ModuloMta[];
  resources?: RecursoMta[];
}

interface Escopo {
  name?: string;
}

interface Atributo {
  name?: string;
  valueType?: string;
}

interface RoleTemplate {
  name?: string;
  'scope-references'?: string[];
}

interface RoleCollection {
  name?: string;
  'role-template-references'?: string[];
}

interface XsSecurity {
  xsappname?: string;
  'tenant-mode'?: string;
  attributes?: Atributo[];
  scopes?: Escopo[];
  'role-templates'?: RoleTemplate[];
  'role-collections'?: RoleCollection[];
  'oauth2-configuration'?: { 'redirect-uris'?: string[] };
}

function lerTexto(caminho: string): string {
  expect(existsSync(caminho)).toBe(true);
  return readFileSync(caminho, 'utf8');
}

describe('Descritores declarativos de deploy e segurança (mta.yaml e xs-security.json)', () => {
  it('CA1: mta.yaml declara os 6 módulos (com empacotamento HTML5) e os 4 recursos gerenciados', () => {
    const mta = carregarYaml(lerTexto(MTA)) as Mta;

    expect(String(mta['_schema-version'])).toBe('3.1');
    expect(mta.ID).toBe('action-plan');

    const modulos = mta.modules ?? [];
    const porModulo = new Map(modulos.map((modulo) => [modulo.name, modulo]));
    const appsHtml5: Record<string, string> = {
      'action-plan-tratativas': 'app/tratativas',
      'action-plan-minhas-pendencias': 'app/minhas-pendencias',
      'action-plan-administracao': 'app/administracao',
    };
    expect(modulos.map((modulo) => modulo.name)).toHaveLength(6);
    for (const nome of ['action-plan-db', 'action-plan-srv', ...Object.keys(appsHtml5), 'action-plan-app-deployer']) {
      expect(porModulo.has(nome)).toBe(true);
    }
    expect(modulos.map((modulo) => modulo.name)).not.toContain('action-plan-portal-content');

    expect(porModulo.get('action-plan-db')?.type).toBe('hdb');
    expect(porModulo.get('action-plan-db')?.path).toBe('gen/db');
    expect(porModulo.get('action-plan-srv')?.type).toBe('nodejs');
    expect(porModulo.get('action-plan-srv')?.path).toBe('gen/srv');

    // Um módulo html5 por app, com builder custom e build-result dist (empacotamento dos apps).
    for (const [nome, caminho] of Object.entries(appsHtml5)) {
      const modulo = porModulo.get(nome);
      expect(modulo?.type).toBe('html5');
      expect(modulo?.path).toBe(caminho);
      expect(modulo?.['build-parameters']?.builder).toBe('custom');
      expect(modulo?.['build-parameters']?.['build-result']).toBe('dist');
      expect(modulo?.['build-parameters']?.commands).toEqual(expect.arrayContaining(['npm install', 'npm run build']));
      // Revisão do diff 2, Achado 1: sem supported-platforms o mbt geraria o módulo como app Cloud Foundry.
      expect(modulo?.['build-parameters']?.['supported-platforms']).toEqual([]);
    }

    // O deployer publica no HTML5 host (content-target) os zips dos 3 apps em resources/.
    const deployer = porModulo.get('action-plan-app-deployer');
    expect(deployer?.type).toBe('com.sap.application.content');
    expect(deployer?.path).toBe('.');
    const exige = deployer?.requires ?? [];
    expect(exige.map((item) => item.name)).toEqual(
      expect.arrayContaining(['action-plan-html5-host', 'action-plan-auth']),
    );
    expect(exige.find((item) => item.name === 'action-plan-html5-host')?.parameters?.['content-target']).toBe(true);

    const zips: Record<string, string> = {
      'action-plan-tratativas': 'brcomcalazanstecactionplantratativas.zip',
      'action-plan-minhas-pendencias': 'brcomcalazanstecactionplanminhaspendencias.zip',
      'action-plan-administracao': 'brcomcalazanstecactionplanadministracao.zip',
    };
    const requisitosBuild = deployer?.['build-parameters']?.requires ?? [];
    const porRequisito = new Map(requisitosBuild.map((item) => [item.name, item]));
    for (const [nome, zip] of Object.entries(zips)) {
      const requisito = porRequisito.get(nome);
      expect(requisito?.artifacts).toEqual([zip]);
      expect(requisito?.['target-path']).toBe('resources/');
    }

    // Ruling R-07: o build-result do deployer tem de ser 'resources' e casar com o target-path (sem a barra) dos zips.
    const buildResult = deployer?.['build-parameters']?.['build-result'];
    expect(buildResult).toBe('resources');
    for (const nome of Object.keys(zips)) {
      const requisito = porRequisito.get(nome);
      expect(requisito?.['target-path']?.replace(/\/$/, '')).toBe(buildResult);
    }

    // Nenhum módulo aponta para o diretório inexistente gen/app.
    for (const modulo of modulos) {
      expect(modulo.path).not.toBe('gen/app');
    }

    // Associação dos módulos de runtime aos recursos gerenciados (R1).
    expect((porModulo.get('action-plan-db')?.requires ?? []).map((item) => item.name)).toEqual(
      expect.arrayContaining(['action-plan-hdi']),
    );
    expect((porModulo.get('action-plan-srv')?.requires ?? []).map((item) => item.name)).toEqual(
      expect.arrayContaining(['action-plan-hdi', 'action-plan-auth', 'action-plan-destination']),
    );
    expect((porModulo.get('action-plan-srv')?.provides ?? []).map((item) => item.name)).toContain('srv-api');

    const recursos = mta.resources ?? [];
    const porRecurso = new Map(recursos.map((recurso) => [recurso.name, recurso]));
    expect(recursos.map((recurso) => recurso.name)).toHaveLength(4);
    for (const nome of ['action-plan-hdi', 'action-plan-auth', 'action-plan-destination', 'action-plan-html5-host']) {
      expect(porRecurso.has(nome)).toBe(true);
    }
    expect(recursos.map((recurso) => recurso.name)).not.toContain('action-plan-html5-runtime');

    // Destination gerenciada action-plan-srv-api com propagação do JWT (HTML5.ForwardAuthToken).
    const destination = porRecurso.get('action-plan-destination');
    const destinos = destination?.parameters?.config?.init_data?.instance?.destinations ?? [];
    const srvApi = destinos.find((item) => item['Name'] === 'action-plan-srv-api');
    expect(srvApi).toBeDefined();
    expect(srvApi?.['HTML5.ForwardAuthToken']).toBe(true);
  });

  it('CA1: cada app de app/ tem package.json com o build do design e ui5.yaml apontando para webapp', () => {
    const apps: Record<string, { zip: string; id: string }> = {
      tratativas: { zip: 'brcomcalazanstecactionplantratativas.zip', id: 'br.com.calazanstec.actionplan.tratativas' },
      'minhas-pendencias': {
        zip: 'brcomcalazanstecactionplanminhaspendencias.zip',
        id: 'br.com.calazanstec.actionplan.minhaspendencias',
      },
      administracao: {
        zip: 'brcomcalazanstecactionplanadministracao.zip',
        id: 'br.com.calazanstec.actionplan.administracao',
      },
    };

    for (const [app, esperado] of Object.entries(apps)) {
      const pacote = JSON.parse(lerTexto(join(RAIZ, 'app', app, 'package.json'))) as {
        private?: boolean;
        scripts?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pacote.private).toBe(true);
      // Revisão (R-06): UI5 CLI 4 não aceita mais --archive; o zip passa a ser gerado pela custom task ui5-task-zipper.
      expect(pacote.scripts?.build).toBe('ui5 build --config=ui5.yaml --clean-dest');
      expect(pacote.devDependencies?.['ui5-task-zipper']).toBe('^3.1.3');
      expect(lerTexto(join(RAIZ, 'app', app, 'ui5.yaml'))).toContain(esperado.zip);

      const ui5 = carregarYaml(lerTexto(join(RAIZ, 'app', app, 'ui5.yaml'))) as {
        metadata?: { name?: string };
        resources?: { configuration?: { paths?: { webapp?: string } } };
      };
      expect(ui5.metadata?.name).toBe(esperado.id);
      expect(ui5.resources?.configuration?.paths?.webapp).toBe('webapp');
    }
  });

  it('CA3: xs-security.json declara o atributo matricula e os 4 escopos corporativos', () => {
    const xs = JSON.parse(lerTexto(XS_SECURITY)) as XsSecurity;

    expect(xs.xsappname).toBe('action-plan');
    expect(xs['tenant-mode']).toBe('dedicated');

    const atributos = xs.attributes ?? [];
    const matricula = atributos.find((atributo) => atributo.name === 'matricula');
    expect(matricula).toBeDefined();
    expect(matricula?.valueType).toBe('string');

    const escopos = (xs.scopes ?? []).map((escopo) => escopo.name);
    for (const escopo of [
      '$XSAPPNAME.GestorTratativa',
      '$XSAPPNAME.Administrador',
      '$XSAPPNAME.LeitorAnalitico',
      '$XSAPPNAME.AplicativoOrigem',
    ]) {
      expect(escopos).toContain(escopo);
    }

    // Achado 1 (revisão do diff): redirect-uris restrito ao Launchpad do Work Zone, sem o curinga aberto de cfapps.
    expect(xs['oauth2-configuration']?.['redirect-uris']).toEqual([
      'https://*.launchpad.cfapps.*.hana.ondemand.com/**',
    ]);
    expect(lerTexto(XS_SECURITY)).not.toContain('https://*.cfapps.*.hana.ondemand.com/**');
  });

  it('CA4: xs-security.json declara role-templates e as 3 Role Collections com referências corretas', () => {
    const xs = JSON.parse(lerTexto(XS_SECURITY)) as XsSecurity;

    const templates = xs['role-templates'] ?? [];
    const porTemplate = new Map(templates.map((template) => [template.name, template['scope-references'] ?? []]));
    expect(porTemplate.get('GestorTratativa')).toEqual(['$XSAPPNAME.GestorTratativa']);
    expect(porTemplate.get('Administrador')).toEqual(['$XSAPPNAME.Administrador']);
    expect(porTemplate.get('LeitorAnalitico')).toEqual(['$XSAPPNAME.LeitorAnalitico']);
    expect(porTemplate.get('AplicativoOrigem')).toEqual(['$XSAPPNAME.AplicativoOrigem']);

    const colecoes = xs['role-collections'] ?? [];
    const porColecao = new Map(colecoes.map((colecao) => [colecao.name, colecao['role-template-references'] ?? []]));
    expect(porColecao.get('ActionPlan_Gestor')).toEqual(['$XSAPPNAME.GestorTratativa']);
    expect(porColecao.get('ActionPlan_Administrador')).toEqual(['$XSAPPNAME.Administrador']);
    expect(porColecao.get('ActionPlan_LeitorAnalitico')).toEqual(['$XSAPPNAME.LeitorAnalitico']);
  });

  it('CA14: os descritores de infraestrutura não usam nomenclatura exclusiva de departamento', () => {
    for (const descritor of [MTA, XS_SECURITY]) {
      expect(lerTexto(descritor)).not.toMatch(/\b(SESMT|Qualidade|RH|Compliance)\b/i);
    }
  });
});
