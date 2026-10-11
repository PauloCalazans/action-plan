import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoAdmin, comoApp, comoGestor, comoUsuario } from './apoio/usuarios';
import { criarTemplate, desativarTemplate } from './apoio/templates';
import { sufixoUnico, type Envia } from './apoio/tratativas';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/administracao/v1';
const RAIZ = join(__dirname, '..');
const ANOTACOES = join(RAIZ, 'app', 'administracao', 'annotations.cds');
const MANIFESTO = join(RAIZ, 'app', 'administracao', 'webapp', 'manifest.json');
const I18N = join(RAIZ, 'app', 'administracao', 'webapp', 'i18n', 'i18n.properties');
const XS_APP = join(RAIZ, 'app', 'administracao', 'xs-app.json');

jest.setTimeout(60000);

beforeEach(() => fixarInstante('2026-10-10T12:00:00-03:00'));
afterEach(liberarRelogio);

function textoDo(arquivo: string): string {
  expect(existsSync(arquivo)).toBe(true);
  return readFileSync(arquivo, 'utf8');
}

// GET de coleção OData v4: devolve o array de itens (ou [] quando vazio).
function itens(dados: unknown): Record<string, unknown>[] {
  const corpo = dados as { value?: Record<string, unknown>[] };
  return Array.isArray(corpo?.value) ? corpo.value : [];
}

function item(ordem: number): Record<string, unknown> {
  return {
    ordem,
    descricao: `Descrição do item ${ordem}`,
    prioridade: 'Média',
    evidenciaObrigatoria: false,
    prazoRelativoDias: 5,
    ordemPai: null,
  };
}

// Preparo por OData (helper da 009): cria um template ativo e devolve o Identificador.
async function novoAtivo(): Promise<string> {
  const r = await criarTemplate(enviar, { nome: `Template ${sufixoUnico()}`, descricao: 'Descrição', itens: [item(1)] }, comoAdmin);
  expect(r.status).toBe(200);
  return r.data.id as string;
}

describe('Administração da Plataforma: leitura OData administrada e escrita pelas actions da 009/010/011', () => {
  it('CA16: a aba Templates de Ações lê ativos e inativos e declara os botões de ciclo de vida', async () => {
    const ativo = await novoAtivo();
    const inativado = await novoAtivo();
    const desativacao = await desativarTemplate(enviar, inativado, comoAdmin);
    expect(desativacao.status).toBe(200);

    const r = await GET(`${BASE}/Templates`, comoAdmin);
    expect(r.status).toBe(200);

    const porId = new Map(itens(r.data).map((linha) => [linha.id as string, linha]));
    expect(porId.get(ativo)?.ativo).toBe(true);
    expect(porId.get(inativado)?.ativo).toBe(false);

    const anotacoes = textoDo(ANOTACOES);
    expect(anotacoes).toContain('annotate AdministracaoService.Templates');
    expect(anotacoes).toContain("Action: 'AdministracaoService.criarTemplate'");
    expect(anotacoes).toContain("Action: 'AdministracaoService.editarTemplate'");
    expect(anotacoes).toContain("Action: 'AdministracaoService.ativarTemplate'");
    expect(anotacoes).toContain("Action: 'AdministracaoService.desativarTemplate'");
  });

  it('CA16a: a aba Parâmetros de Alertas lê os valores vigentes, persiste alterações e dispara o processamento manual', async () => {
    const primeiro = {
      diasAntecedenciaPrazoProximo: 5,
      diasInatividade: 20,
      emailHabilitado: false,
      teamsHabilitado: true,
      horaExecucaoUtc: 9,
    };
    const salvar = await POST(`${BASE}/atualizarParametrosAlertas`, primeiro, comoAdmin);
    expect(salvar.status).toBe(200);

    const form = await GET(`${BASE}/ParametrosAlertas`, comoAdmin);
    expect(form.status).toBe(200);
    expect(itens(form.data)).toHaveLength(1);
    expect(itens(form.data)[0]).toMatchObject(primeiro);

    const alterado = { ...primeiro, diasAntecedenciaPrazoProximo: 7, horaExecucaoUtc: 11 };
    const salvarNovamente = await POST(`${BASE}/atualizarParametrosAlertas`, alterado, comoAdmin);
    expect(salvarNovamente.status).toBe(200);
    const formAtualizado = await GET(`${BASE}/ParametrosAlertas`, comoAdmin);
    expect(itens(formAtualizado.data)[0]).toMatchObject(alterado);

    const processamento = await POST(`${BASE}/executarProcessamentoAlertas`, {}, comoAdmin);
    expect(processamento.status).toBe(200);

    const anotacoes = textoDo(ANOTACOES);
    expect(anotacoes).toContain('annotate AdministracaoService.ParametrosAlertas');
    for (const campo of ['diasAntecedenciaPrazoProximo', 'diasInatividade', 'emailHabilitado', 'teamsHabilitado', 'horaExecucaoUtc']) {
      expect(anotacoes).toContain(campo);
    }
    expect(anotacoes).toContain("Action: 'AdministracaoService.atualizarParametrosAlertas'");
    expect(anotacoes).toContain("Action: 'AdministracaoService.executarProcessamentoAlertas'");
  });

  it('CA16b: a aba Estrutura Organizacional lê os mapeamentos vigentes e persiste a atualização', async () => {
    const salvar = await POST(
      `${BASE}/atualizarParametrosIntegracaoSF`,
      { nivelUnidadeSF: 'Divisao', nivelAreaSF: 'Setor' },
      comoAdmin,
    );
    expect(salvar.status).toBe(200);

    const form = await GET(`${BASE}/ParametrosIntegracaoSF`, comoAdmin);
    expect(form.status).toBe(200);
    expect(itens(form.data)).toHaveLength(1);
    expect(itens(form.data)[0]).toMatchObject({ nivelUnidadeSF: 'Divisao', nivelAreaSF: 'Setor' });

    const atualizado = await POST(
      `${BASE}/atualizarParametrosIntegracaoSF`,
      { nivelUnidadeSF: 'Unidade', nivelAreaSF: 'Departamento' },
      comoAdmin,
    );
    expect(atualizado.status).toBe(200);
    const formAtualizado = await GET(`${BASE}/ParametrosIntegracaoSF`, comoAdmin);
    expect(itens(formAtualizado.data)[0]).toMatchObject({ nivelUnidadeSF: 'Unidade', nivelAreaSF: 'Departamento' });

    const anotacoes = textoDo(ANOTACOES);
    expect(anotacoes).toContain('annotate AdministracaoService.ParametrosIntegracaoSF');
    expect(anotacoes).toContain('nivelUnidadeSF');
    expect(anotacoes).toContain('nivelAreaSF');
    expect(anotacoes).toContain("Action: 'AdministracaoService.atualizarParametrosIntegracaoSF'");
  });

  it('CA17: Gestor de Tratativa e usuário comum sem papel de Administrador recebem 403', async () => {
    for (const como of [comoGestor, comoUsuario]) {
      const templates = await GET(`${BASE}/Templates`, como);
      expect(templates.status).toBe(403);
      expect((templates.data as { error?: { message?: string } }).error?.message).toBe('Acesso negado.');

      const integracao = await GET(`${BASE}/ParametrosIntegracaoSF`, como);
      expect(integracao.status).toBe(403);
    }

    const aplicativo = await GET(`${BASE}/Templates`, comoApp);
    expect(aplicativo.status).toBe(403);
    expect((aplicativo.data as { error?: { message?: string } }).error?.message).toBe('Acesso negado.');
  });

  it('CA25: a visão administrativa usa textos em pt-BR a partir do i18n.properties', () => {
    const textos = textoDo(I18N);
    expect(textos).toMatch(/Administração/);
    expect(textos).toMatch(/[áàâãéêíóôõúç]/i);

    const interfaceDaTela = [textoDo(ANOTACOES), textos, textoDo(MANIFESTO)].join('\n');
    expect(interfaceDaTela).toContain('Templates de Ações');
    expect(interfaceDaTela).toContain('Parâmetros de Alertas');
    expect(interfaceDaTela).toContain('Estrutura Organizacional');
  });

  it('CA26: a visão administrativa usa o floorplan Fiori elements nativo, operável por teclado', () => {
    const manifesto = JSON.parse(textoDo(MANIFESTO)) as Record<string, unknown>;
    const serializado = JSON.stringify(manifesto);

    expect(serializado).toContain('sap.fe.templates');
    expect(serializado).toContain('ListReport');
    expect(serializado).toContain('Templates');
    expect(serializado).toContain('ParametrosAlertas');
    expect(serializado).toContain('ParametrosIntegracaoSF');
  });

  it('CA26 (Achado 3): as Object Pages da Administração estão em sap.ui5.routing.targets e são alvo de rotas', () => {
    const manifesto = JSON.parse(textoDo(MANIFESTO)) as {
      'sap.app'?: Record<string, unknown>;
      'sap.ui5'?: { routing?: { routes?: { target?: string }[]; targets?: Record<string, unknown> } };
    };
    const alvos = ['TemplatesObjectPage', 'ParametrosAlertasObjectPage', 'ParametrosIntegracaoSFObjectPage'];
    const routing = manifesto['sap.ui5']?.routing;
    const targets = routing?.targets ?? {};
    const rotas = routing?.routes ?? [];

    for (const alvo of alvos) {
      expect(manifesto['sap.app']).not.toHaveProperty(alvo);
      expect(targets).toHaveProperty(alvo);
      expect(rotas.some((rota) => rota.target === alvo)).toBe(true);
    }
  });

  it('CA27 e CA27a: anotações e manifesto válidos em execução OData headless', async () => {
    const metadados = await GET(`${BASE}/$metadata`, comoAdmin);

    expect(metadados.status).toBe(200);
    expect(String(metadados.data)).toContain('AdministracaoService');
    for (const arquivo of [ANOTACOES, MANIFESTO, XS_APP]) {
      expect(existsSync(arquivo)).toBe(true);
    }
    expect(() => JSON.parse(textoDo(MANIFESTO)) as unknown).not.toThrow();
    expect(() => JSON.parse(textoDo(XS_APP)) as unknown).not.toThrow();
    expect(textoDo(ANOTACOES)).toContain('annotate AdministracaoService.Templates');
    expect(textoDo(ANOTACOES)).toContain('annotate AdministracaoService.ParametrosAlertas');
    expect(textoDo(ANOTACOES)).toContain('annotate AdministracaoService.ParametrosIntegracaoSF');
  });
});
