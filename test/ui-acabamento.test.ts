import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoGestor, comoUsuario } from './apoio/usuarios';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/app/v1';
const RAIZ = join(__dirname, '..');
const ANOTACOES = join(RAIZ, 'app', 'tratativas', 'annotations.cds');
const I18N_TRATATIVAS = join(RAIZ, 'app', 'tratativas', 'webapp', 'i18n', 'i18n.properties');
const PACOTE = join(RAIZ, 'package.json');
const DEPCRUISER = join(RAIZ, '.dependency-cruiser.cjs');
const MTA = join(RAIZ, 'mta.yaml');
const APPS = [
  { dir: 'tratativas', id: 'br.com.calazanstec.actionplan.tratativas' },
  { dir: 'minhas-pendencias', id: 'br.com.calazanstec.actionplan.minhaspendencias' },
  { dir: 'administracao', id: 'br.com.calazanstec.actionplan.administracao' },
];

jest.setTimeout(60000);

beforeEach(() => fixarInstante('2026-10-26T12:00:00-03:00'));
afterEach(liberarRelogio);

type Erro = { error?: { message?: string; target?: string } };
type UsuarioInjetado = { id?: string; is: (papel: string) => boolean };
type Middleware = (req: { user?: UsuarioInjetado }, res: unknown, next: (erro?: unknown) => void) => void;

function textoDo(arquivo: string): string {
  expect(existsSync(arquivo)).toBe(true);
  return readFileSync(arquivo, 'utf8');
}

async function metadados(como: unknown): Promise<string> {
  const resposta = await GET(`${BASE}/$metadata`, como);
  expect(resposta.status).toBe(200);
  return String(resposta.data);
}

// Bloco <Action Name="...">...</Action> do $metadata (isolando os parâmetros da ação).
function blocoAcao(xml: string, nome: string): string {
  const match = new RegExp(`<Action Name="${nome}"[^>]*>([\\s\\S]*?)</Action>`).exec(xml);
  expect(match).not.toBeNull();
  return (match as RegExpMatchArray)[1];
}

function parametro(bloco: string, nome: string): string {
  return bloco.split('<Parameter ').find((parte) => parte.includes(`Name="${nome}"`)) ?? '';
}

describe('Acabamento da UI: robustez do backend e contratos de serviço', () => {
  it('CA5: criarTratativaAvulsa não expõe dataPrevistaConclusao e cria a Tratativa avulsa', async () => {
    const xml = await metadados(comoUsuario);
    const acao = blocoAcao(xml, 'criarTratativaAvulsa');
    expect(acao).not.toContain('dataPrevistaConclusao');

    const criada = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: `Avulsa ${sufixoUnico()}`, criticidade: 'Alta' },
      comoUsuario,
    );
    expect(criada.status).toBe(200);
    expect(typeof criada.data.codigo).toBe('string');
  });

  it('CA7: prazo de criarAcao/criarSubacao é Edm.Date e segue compatível com a validação de prazo', async () => {
    const xml = await metadados(comoGestor);
    for (const nome of ['criarAcao', 'criarSubacao']) {
      expect(parametro(blocoAcao(xml, nome), 'prazo')).toContain('Edm.Date');
    }

    const tratativa = await criarAvulsa(enviar, { titulo: `Ações ${sufixoUnico()}`, criticidade: 'Alta' });
    expect(tratativa.status).toBe(200);
    const acao = await POST(
      `${BASE}/Tratativas(${tratativa.data.codigo})/criarAcao`,
      { descricao: 'Ação com prazo ISO', responsavel: 'M1001', prazo: '2026-12-01', prioridade: 'Alta' },
      comoGestor,
    );
    expect(acao.status).toBe(200);
  });

  it('CA7: as anotações declaram listas de valores e Value Help de colaboradores nos parâmetros das ações', () => {
    const anotacoes = textoDo(ANOTACOES);

    expect(anotacoes).toContain('Common.ValueListWithFixedValues');
    expect(anotacoes).toContain('Common.ValueList');
    for (const colecao of ['ValoresCriticidade', 'ValoresPrioridade', 'ValoresEvidenciaObrigatoria', 'Colaboradores']) {
      expect(anotacoes).toContain(`CollectionPath: '${colecao}'`);
    }
    expect(anotacoes).toMatch(/annotate TratativaAppService(\.Tratativas)? with actions/);
  });

  it('CA9: as 4 ações dedicadas de status e as flags pode/oculta governam as transições', async () => {
    const xml = await metadados(comoGestor);
    for (const nome of ['iniciarTratativa', 'encerrarTratativa', 'cancelarTratativa', 'reabrirTratativa']) {
      expect(blocoAcao(xml, nome)).not.toHaveLength(0);
    }

    const anotacoes = textoDo(ANOTACOES);
    for (const flag of ['podeIniciar', 'podeEncerrar', 'podeCancelar', 'podeReabrir']) {
      expect(anotacoes).toContain(`@Core.OperationAvailable: ${flag}`);
    }

    const tratativa = await criarAvulsa(enviar, { titulo: `Status ${sufixoUnico()}`, criticidade: 'Alta' });
    expect(tratativa.status).toBe(200);
    const consulta = await GET(`${BASE}/Tratativas(${tratativa.data.codigo})`, comoGestor);
    expect(consulta.status).toBe(200);

    const linha = consulta.data as Record<string, unknown>;
    expect(linha.podeIniciar).toBe(true);
    expect(linha.podeEncerrar).toBe(true);
    expect(linha.podeCancelar).toBe(true);
    expect(linha.podeReabrir).toBe(false);
    expect(linha.ocultaIniciar).toBe(false);
    expect(linha.ocultaReabrir).toBe(true);
  });

  it('CA9: cancelar e reabrir exigem justificativa (HTTP 400 sem o parâmetro)', async () => {
    const tratativa = await criarAvulsa(enviar, { titulo: `Justificativa ${sufixoUnico()}`, criticidade: 'Alta' });
    expect(tratativa.status).toBe(200);

    const semJustificativa = await POST(`${BASE}/Tratativas(${tratativa.data.codigo})/cancelarTratativa`, {}, comoGestor);
    expect(semJustificativa.status).toBe(400);
    expect((semJustificativa.data as Erro).error?.target).toBe('justificativa');
  });

  it('CA14: o Value Help expõe Colaboradores apenas com matrícula, nome e e-mail (sem CPF)', async () => {
    const xml = await metadados(comoUsuario);
    const match = /<EntityType Name="Colaboradores">([\s\S]*?)<\/EntityType>/.exec(xml);
    expect(match).not.toBeNull();
    const bloco = (match as RegExpMatchArray)[1];
    for (const campo of ['matricula', 'nome', 'email']) {
      expect(bloco).toContain(`Name="${campo}"`);
    }
    expect(bloco.toLowerCase()).not.toContain('cpf');

    const lista = await GET(`${BASE}/Colaboradores`, comoUsuario);
    expect(lista.status).toBe(200);
    for (const colaborador of (lista.data.value as Record<string, unknown>[] | undefined) ?? []) {
      expect(Object.keys(colaborador).filter((chave) => !chave.startsWith('@')).sort()).toEqual([
        'email',
        'matricula',
        'nome',
      ]);
    }
  });

  it('CA16: a esteira de verificação (lint, test e arch) está configurada e sem navegador real', () => {
    const pacote = JSON.parse(textoDo(PACOTE)) as { scripts?: Record<string, string> };
    expect(pacote.scripts?.lint).toContain('eslint');
    expect(pacote.scripts?.test).toContain('jest');
    expect(pacote.scripts?.arch).toContain('depcruise');

    const configuracao = textoDo(DEPCRUISER);
    expect(configuracao).toContain('app-nao-importa-srv');
    expect(configuracao).toContain('db-nao-depende-de-srv-nem-app');
  });

  describe('Componentes SAPUI5, sandbox Fiori launchpad e execução local (padrão CAP/BAS)', () => {
    it('CA1: cada app tem webapp/Component.js estendendo sap.fe.core.AppComponent e apontando o manifest', () => {
      for (const app of APPS) {
        const componente = textoDo(join(RAIZ, 'app', app.dir, 'webapp', 'Component.js'));
        expect(componente).toContain('sap.fe.core.AppComponent');
        expect(componente).toContain(`${app.id}.Component`);
        expect(componente).toMatch(/manifest\s*:\s*["']json["']/);

        const manifesto = JSON.parse(textoDo(join(RAIZ, 'app', app.dir, 'webapp', 'manifest.json'))) as {
          'sap.app'?: { id?: string };
        };
        expect(manifesto['sap.app']?.id).toBe(app.id);
      }
    });

    it('CA1: o webapp/index.html de cada app usa UI5 local, bootstrap kebab-case, sem CDN e sem script inline', () => {
      for (const app of APPS) {
        const html = textoDo(join(RAIZ, 'app', app.dir, 'webapp', 'index.html'));
        expect(html).toContain('src="resources/sap-ui-core.js"');
        expect(html).toContain('module:sap/ui/core/ComponentSupport');
        expect(html).toContain('sap_horizon');
        expect(html).toContain('data-sap-ui-component');
        for (const parametro of ['data-sap-ui-resource-roots', 'data-sap-ui-compat-version', 'data-sap-ui-frame-options']) {
          expect(html).toContain(parametro);
        }
        expect(html).not.toContain('ui5.sap.com');
        expect(html).not.toContain('sapui5.hana.ondemand.com');
        expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i);
      }
    });

    it('CA1: cada manifest.json está em Manifest Version 2 (LTS 1.136.23, contentDensities, sem synchronizationMode)', () => {
      for (const app of APPS) {
        const bruto = textoDo(join(RAIZ, 'app', app.dir, 'webapp', 'manifest.json'));
        expect(bruto).not.toContain('synchronizationMode');

        const manifesto = JSON.parse(bruto) as {
          _version?: string;
          'sap.ui5'?: {
            dependencies?: { minUI5Version?: string };
            contentDensities?: { compact?: boolean; cozy?: boolean };
          };
        };
        expect(manifesto._version).toMatch(/^2\./);
        expect(manifesto['sap.ui5']?.dependencies?.minUI5Version).toBe('1.136.23');
        expect(manifesto['sap.ui5']?.contentDensities).toEqual({ compact: true, cozy: true });
      }
    });

    it('CA1: o Fiori Launchpad Sandbox isolado em app/launchpad/ publica os 3 apps por intent', () => {
      const ui5 = textoDo(join(RAIZ, 'app', 'launchpad', 'ui5.yaml'));
      expect(ui5).toContain('SAPUI5');
      expect(ui5).toContain('1.136.23');
      for (const biblioteca of ['sap.m', 'sap.ui.core', 'sap.ushell', 'sap.fe.templates', 'themelib_sap_horizon']) {
        expect(ui5).toContain(biblioteca);
      }

      const pacote = JSON.parse(textoDo(join(RAIZ, 'app', 'launchpad', 'package.json'))) as { private?: boolean };
      expect(pacote.private).toBe(true);

      const manifesto = JSON.parse(textoDo(join(RAIZ, 'app', 'launchpad', 'webapp', 'manifest.json'))) as {
        _version?: string;
        'sap.app'?: { id?: string; title?: string };
        'sap.ui5'?: { contentDensities?: { compact?: boolean; cozy?: boolean } };
      };
      expect(manifesto._version).toMatch(/^2\./);
      expect(manifesto['sap.app']?.id).toBe('br.com.calazanstec.actionplan.launchpad');
      expect((manifesto['sap.app']?.title ?? '').length).toBeGreaterThan(0);
      expect(manifesto['sap.ui5']?.contentDensities).toEqual({ compact: true, cozy: true });

      const html = textoDo(join(RAIZ, 'app', 'launchpad', 'webapp', 'index.html'));
      // R-15: o módulo sap/ushell/shells/sandbox/fioriSandbox não existe no SAPUI5 1.136.23; o sandbox
      // oficial é o sandbox2, carregado antes do sap-ui-core.js, com o shell criado por init.js.
      expect(html).not.toContain('module:sap/ushell/shells/sandbox/fioriSandbox');
      expect(html).toContain('src="sandbox.js"');
      expect(html).toContain('id="sap-ushell-bootstrap"');
      expect(html).toContain('src="resources/sap/ushell/bootstrap/sandbox2.js"');
      expect(html).toContain('src="resources/sap-ui-core.js"');
      expect(html).toContain('module:br/com/calazanstec/actionplan/launchpad/init');
      expect(html).toContain('id="content"');
      expect(html.indexOf('src="sandbox.js"')).toBeLessThan(html.indexOf('src="resources/sap-ui-core.js"'));
      expect(html.indexOf('src="resources/sap/ushell/bootstrap/sandbox2.js"')).toBeLessThan(
        html.indexOf('src="resources/sap-ui-core.js"'),
      );
      for (const parametro of ['data-sap-ui-resource-roots', 'data-sap-ui-compat-version', 'data-sap-ui-frame-options']) {
        expect(html).toContain(parametro);
      }
      expect(html).not.toContain('ui5.sap.com');
      expect(html).not.toContain('sapui5.hana.ondemand.com');
      expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i);

      const init = textoDo(join(RAIZ, 'app', 'launchpad', 'webapp', 'init.js'));
      expect(init).toContain('sap/ushell/Container');
      expect(init).toContain('createRendererInternal');
      expect(init).toMatch(/placeAt\(\s*["']content["']\s*\)/);

      const sandbox = textoDo(join(RAIZ, 'app', 'launchpad', 'webapp', 'sandbox.js'));
      expect(sandbox).toContain('sap-ushell-config');
      for (const intent of ['Tratativa-manage', 'MinhasPendencias-display', 'AdministracaoPlataforma-manage']) {
        expect(sandbox).toContain(intent);
      }
      for (const titulo of ['Gestão de Tratativas', 'Minhas Pendências', 'Administração da Plataforma']) {
        expect(sandbox).toContain(titulo);
      }
      for (const app of APPS) {
        expect(sandbox).toContain(`/${app.id}`);
      }
    });

    it('CA1: a raiz de app/ não publica sandbox próprio (o CAP serve a página inicial padrão)', () => {
      expect(existsSync(join(RAIZ, 'app', 'index.html'))).toBe(false);
      expect(existsSync(join(RAIZ, 'app', 'sandbox.js'))).toBe(false);
    });

    it('CA1: o package.json raiz declara cds-plugin-ui5 e a autenticação de dev customizada', () => {
      const raiz = JSON.parse(textoDo(PACOTE)) as {
        devDependencies?: Record<string, string>;
        cds?: {
          requires?: {
            auth?: Record<string, { kind?: string; impl?: string; users?: Record<string, unknown> }>;
          };
        };
      };
      expect(raiz.devDependencies?.['cds-plugin-ui5']).toBe('0.17.4');

      const auth = raiz.cds?.requires?.auth ?? {};
      expect(auth['[development]']?.impl).toBe('test/apoio/auth-dev');
      expect(auth['[test]']?.kind).toBe('mocked');
      expect(auth['[papeis]']?.kind).toBe('mocked');
      expect(auth['[production]']?.kind).toBe('xsuaa');
      expect(Object.keys(auth['[test]']?.users ?? {}).sort()).toEqual([
        'admin', 'app-origem-a', 'app-origem-b', 'app-revogado', 'gestor', 'leitor-analitico', 'usuario',
      ]);
      expect(JSON.stringify(auth['[production]'] ?? {})).not.toContain('auth-dev');
    });

    it('CA1: o middleware de dev injeta a persona escolhida (padrão gestor) e não vaza para produção', async () => {
      const caminho = join(RAIZ, 'test', 'apoio', 'auth-dev.js');
      expect(existsSync(caminho)).toBe(true);

      const carregado = (await import(caminho)) as unknown;
      const middleware = (typeof carregado === 'function'
        ? carregado
        : (carregado as { default?: unknown }).default) as Middleware;
      expect(typeof middleware).toBe('function');

      const aplicar = (valores: { dev?: string; cds?: string }) => {
        const anteriorDev = process.env.DEV_USER;
        const anteriorCds = process.env.CDS_DEV_USER;
        try {
          if (valores.dev === undefined) delete process.env.DEV_USER;
          else process.env.DEV_USER = valores.dev;
          if (valores.cds === undefined) delete process.env.CDS_DEV_USER;
          else process.env.CDS_DEV_USER = valores.cds;
          const req: { user?: UsuarioInjetado } = {};
          let seguiu = false;
          middleware(req, {}, () => {
            seguiu = true;
          });
          return { usuario: req.user, seguiu };
        } finally {
          if (anteriorDev === undefined) delete process.env.DEV_USER;
          else process.env.DEV_USER = anteriorDev;
          if (anteriorCds === undefined) delete process.env.CDS_DEV_USER;
          else process.env.CDS_DEV_USER = anteriorCds;
        }
      };

      const padrao = aplicar({});
      expect(padrao.seguiu).toBe(true);
      expect(padrao.usuario?.id).toBe('gestor');
      expect(padrao.usuario?.is('GestorTratativa')).toBe(true);
      expect(padrao.usuario?.is('AplicativoOrigem')).toBe(false);

      const porDev = aplicar({ dev: 'admin' });
      expect(porDev.usuario?.id).toBe('admin');
      expect(porDev.usuario?.is('Administrador')).toBe(true);

      const porCds = aplicar({ cds: 'leitor-analitico' });
      expect(porCds.usuario?.id).toBe('leitor-analitico');
      expect(porCds.usuario?.is('LeitorAnalitico')).toBe(true);

      const desconhecida = aplicar({ dev: 'persona-inexistente' });
      expect(desconhecida.usuario?.id).toBe('gestor');
    });

    it('CA1 e CA16: cada app empacota via ui5-task-zipper (SAPUI5 LTS 1.136.23) sem --archive', () => {
      const zips: Record<string, string> = {
        tratativas: 'brcomcalazanstecactionplantratativas.zip',
        'minhas-pendencias': 'brcomcalazanstecactionplanminhaspendencias.zip',
        administracao: 'brcomcalazanstecactionplanadministracao.zip',
      };
      const mta = textoDo(MTA);
      for (const app of APPS) {
        const ui5 = textoDo(join(RAIZ, 'app', app.dir, 'ui5.yaml'));
        expect(ui5).toContain('SAPUI5');
        expect(ui5).toContain('1.136.23');
        expect(ui5).toContain('sap.ushell');
        expect(ui5).toContain('themelib_sap_horizon');
        expect(ui5).toContain('ui5-task-zipper');
        expect(ui5).toContain(zips[app.dir]);
        expect(mta).toContain(zips[app.dir]);

        const pacoteApp = JSON.parse(textoDo(join(RAIZ, 'app', app.dir, 'package.json'))) as {
          scripts?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        expect(pacoteApp.scripts?.build).toBe('ui5 build --config=ui5.yaml --clean-dest');
        expect(pacoteApp.devDependencies?.['ui5-task-zipper']).toBe('^3.1.3');
      }
    });

    it('CA1 e CA16: mta.yaml, ui5.yaml e package.json dos apps permanecem íntegros para o empacotamento MTA/HTML5', () => {
      const mta = textoDo(MTA);
      expect(mta).toContain('action-plan-app-deployer');
      for (const app of APPS) {
        expect(mta).toContain(`path: app/${app.dir}`);
        expect(textoDo(join(RAIZ, 'app', app.dir, 'ui5.yaml'))).toContain('webapp: webapp');
        const pacoteApp = JSON.parse(textoDo(join(RAIZ, 'app', app.dir, 'package.json'))) as {
          scripts?: Record<string, string>;
        };
        expect(pacoteApp.scripts?.build).toContain('ui5 build --config=ui5.yaml');
      }
    });
  });

  describe('Etapa 3: rótulos pt-BR e acabamento das anotações de app/tratativas', () => {
    it('CA3: as anotações de app/tratativas/ não expõem identificadores técnicos como rótulos', () => {
      const anotacoes = textoDo(ANOTACOES);

      const tecnicos = [
        'codigo', 'titulo', 'origem', 'idOrigem', 'criticidade', 'status', 'unidade', 'area',
        'dataPrevistaConclusao', 'descricao', 'solicitante', 'responsavelPrincipal', 'responsavel',
      ];
      for (const tecnico of tecnicos) {
        expect(anotacoes).not.toContain(`Label: '${tecnico}'`);
      }
      for (const ocorrencia of anotacoes.matchAll(/Label:\s*'([^']*)'/g)) {
        expect(ocorrencia[1]).toMatch(/^[A-ZÀ-Ý]/);
        expect(ocorrencia[1]).not.toMatch(/[a-zà-ÿ][A-ZÀ-Ý]/);
      }
    });

    it('CA7: as ações declaram Value List canônica para os parâmetros (dropdowns e Value Help)', () => {
      const anotacoes = textoDo(ANOTACOES);

      expect(anotacoes).toMatch(/annotate TratativaAppService(\.Tratativas)? with actions\s*\{/);
      for (const acao of ['criarTratativaAvulsa', 'mudarCriticidade', 'criarAcao', 'criarSubacao', 'delegarAcao']) {
        expect(anotacoes).toContain(`${acao}(`);
      }
      for (const colecao of ['ValoresCriticidade', 'ValoresPrioridade', 'ValoresEvidenciaObrigatoria', 'Colaboradores']) {
        expect(anotacoes).toContain(`CollectionPath: '${colecao}'`);
      }
      expect((anotacoes.match(/Common\.ValueListWithFixedValues/g) ?? []).length).toBeGreaterThanOrEqual(5);
    });

    it('CA15: o catálogo i18n orienta contra dados sensíveis nos campos livres', () => {
      const textos = textoDo(I18N_TRATATIVAS);

      for (const chave of ['titlePlaceholder', 'descriptionPlaceholder', 'commentPlaceholder']) {
        expect(textos).toContain(`${chave}=`);
      }
      expect(textos).toMatch(/dados sensíveis/i);
      expect(textos).toMatch(/nomes/i);
    });

    it('CA5: o botão "Criar Tratativa Avulsa" usa o Action Import do EntityContainer', () => {
      const anotacoes = textoDo(ANOTACOES);

      expect(anotacoes).toContain('Criar Tratativa Avulsa');
      expect(anotacoes).toContain("Action: 'TratativaAppService.EntityContainer/criarTratativaAvulsa'");
    });

    it('CA9: os botões de transição usam as ações dedicadas com @UI.Hidden: oculta<Acao> (sem @Core.OperationAvailable no DataField)', () => {
      const anotacoes = textoDo(ANOTACOES);

      for (const acao of ['iniciarTratativa', 'encerrarTratativa', 'cancelarTratativa', 'reabrirTratativa']) {
        expect(anotacoes).toContain(`Action: 'TratativaAppService.${acao}'`);
      }
      for (const flag of ['ocultaIniciar', 'ocultaEncerrar', 'ocultaCancelar', 'ocultaReabrir']) {
        expect(anotacoes).toContain(`@UI.Hidden: ${flag}`);
      }
      expect(anotacoes).not.toContain("Action: 'TratativaAppService.mudarStatus'");

      const inicio = anotacoes.indexOf('UI.Identification: [');
      const fim = anotacoes.indexOf('UI.SelectionFields');
      expect(inicio).toBeGreaterThan(-1);
      expect(fim).toBeGreaterThan(inicio);
      expect(anotacoes.slice(inicio, fim)).not.toContain('Core.OperationAvailable');
    });

    it('CA11: o FieldGroup#DadosGerais rotula todos os campos', () => {
      const anotacoes = textoDo(ANOTACOES);
      const inicio = anotacoes.indexOf('UI.FieldGroup #DadosGerais');
      const fim = anotacoes.indexOf('UI.FieldGroup #ResponsavelPrincipal');
      expect(inicio).toBeGreaterThan(-1);
      expect(fim).toBeGreaterThan(inicio);
      const bloco = anotacoes.slice(inicio, fim);

      const campos = [...bloco.matchAll(/Value:\s*(\w+)/g)].map((ocorrencia) => ocorrencia[1]);
      expect(campos).toEqual(
        expect.arrayContaining(['titulo', 'descricao', 'unidade', 'area', 'solicitante', 'dataPrevistaConclusao']),
      );
      const rotulos = bloco.match(/Label:\s*'/g) ?? [];
      expect(rotulos.length).toBeGreaterThanOrEqual(campos.length);
    });

    it('CA11: as colunas Unidade, Área e Data prevista usam @UI.Importance: #High', () => {
      const anotacoes = textoDo(ANOTACOES);
      const inicio = anotacoes.indexOf('UI.LineItem: [');
      const fim = anotacoes.indexOf('UI.Facets:');
      expect(inicio).toBeGreaterThan(-1);
      expect(fim).toBeGreaterThan(inicio);
      const linha = anotacoes.slice(inicio, fim);

      for (const campo of ['unidade', 'area', 'dataPrevistaConclusao']) {
        const entrada = linha.split('{').find((parte) => new RegExp(`Value:\\s*${campo}\\b`).test(parte)) ?? '';
        expect(entrada).toContain('@UI.Importance: #High');
        expect(entrada).toContain('Label:');
      }
    });
  });

  // Último teste do arquivo: esvazia PrazosCriticidade (o OData bloqueia POST/DELETE da lista fixa, R7).
  it('CA13: base sem PrazosCriticidade recusa 400 sem TypeError e mantém o servidor ativo', async () => {
    await cds.db.run(DELETE.from('br.com.calazanstec.PrazosCriticidade'));

    const resposta = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: `Sem prazo ${sufixoUnico()}`, criticidade: 'Alta' },
      comoUsuario,
    );
    expect(resposta.status).toBe(400);
    expect((resposta.data as Erro).error?.target).toBe('criticidade');
    expect((resposta.data as Erro).error?.message).toBe('Prazo não configurado para a criticidade informada.');

    const depois = await GET(`${BASE}/$metadata`, comoUsuario);
    expect(depois.status).toBe(200);
  });
});
