import cds from '@sap/cds';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoGestor, comoUsuario, semAuth } from './apoio/usuarios';

const { GET, POST } = cds.test(__dirname + '/..');
const BASE = '/api/app/v1';
const RAIZ = join(__dirname, '..');
const ANOTACOES = join(RAIZ, 'app', 'tratativas', 'annotations.cds');
const MANIFESTO = join(RAIZ, 'app', 'tratativas', 'webapp', 'manifest.json');
const I18N = join(RAIZ, 'app', 'tratativas', 'webapp', 'i18n', 'i18n.properties');
const XS_APP = join(RAIZ, 'app', 'tratativas', 'xs-app.json');
const APP = join(RAIZ, 'app');

jest.setTimeout(60000);

beforeEach(() => fixarInstante('2026-10-10T12:00:00-03:00'));
afterEach(liberarRelogio);

function textoDo(arquivo: string): string {
  expect(existsSync(arquivo)).toBe(true);
  return readFileSync(arquivo, 'utf8');
}

// Arquivos regulares sob app/ (recursivo), base da prova estrutural de CA4.
function arquivosEm(diretorio: string): string[] {
  return readdirSync(diretorio, { recursive: true })
    .map((entrada) => join(diretorio, String(entrada)))
    .filter((caminho) => statSync(caminho).isFile());
}

describe('Gestão de Tratativas: serviço OData e interface declarativa', () => {
  it('CA1: requisição OData inicial sem token é recusada com 401', async () => {
    const resposta = await GET(`${BASE}/Tratativas`, semAuth);

    expect(resposta.status).toBe(401);
  });

  it('CA3: a aplicação contém anotações CDS declarativas, manifesto e catálogo pt-BR', () => {
    for (const arquivo of [ANOTACOES, MANIFESTO, I18N, XS_APP]) {
      expect(existsSync(arquivo)).toBe(true);
    }

    expect(textoDo(ANOTACOES)).toContain('annotate TratativaAppService.Tratativas');
  });

  it('CA4: a regra arquitetural não permite dependência de código entre app e srv', () => {
    const arquivos = arquivosEm(APP);
    expect(arquivos.length).toBeGreaterThan(0);

    for (const caminho of arquivos) {
      const conteudo = readFileSync(caminho, 'utf8');

      // Nenhum arquivo de app/ importa/requer (TS/JS) algo de srv/ ou db/.
      const especificadoresDeCodigo = [
        ...conteudo.matchAll(/\b(?:import|export)\b[^;\n]*?\bfrom\s*['"]([^'"]+)['"]/g),
        ...conteudo.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]/g),
        ...conteudo.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
      ].map((ocorrencia) => ocorrencia[1]);
      for (const especificador of especificadoresDeCodigo) {
        expect(especificador).not.toMatch(/(?:^|\/)(?:srv|db)\//);
      }

      // Anotações CDS podem usar o contrato do serviço (srv), nunca o modelo persistido (db).
      for (const ocorrencia of conteudo.matchAll(/\busing\b[^;\n]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
        expect(ocorrencia[1]).not.toMatch(/(?:^|\/)db\//);
      }
    }
  });

  it('CA5: criação avulsa é síncrona, retorna a Tratativa e não expõe metadados Draft', async () => {
    const resposta = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: 'Ocorrência direta', criticidade: 'Alta' },
      comoUsuario,
    );
    const metadados = await GET(`${BASE}/$metadata`, comoUsuario);

    expect(resposta.status).toBe(200);
    expect(typeof resposta.data.codigo).toBe('string');
    expect(metadados.status).toBe(200);
    expect(String(metadados.data)).not.toContain('IsActiveEntity');
    expect(String(metadados.data)).not.toContain('HasActiveEntity');
  });

  it('CA6: metadata expõe listagem filtrável com colunas e ordenação por data prevista', async () => {
    const metadados = await GET(`${BASE}/$metadata`, comoUsuario);
    const anotacoes = textoDo(ANOTACOES);

    expect(metadados.status).toBe(200);
    for (const campo of [
      'codigo', 'titulo', 'origem', 'idOrigem', 'criticidade', 'status', 'unidade', 'area', 'dataPrevistaConclusao',
    ]) {
      expect(anotacoes).toContain(`Value: ${campo}`);
    }
    for (const filtro of ['origem', 'criticidade', 'status', 'unidade', 'area']) {
      expect(anotacoes).toContain(filtro);
    }
    expect(anotacoes).toContain('Criar Tratativa Avulsa');
    expect(anotacoes).toContain("Action: 'TratativaAppService.criarTratativaAvulsa'");
  });

  it('CA7 e CA8: identificação declara ações de cabeçalho do Gestor e o serviço as restringe', async () => {
    const metadados = await GET(`${BASE}/$metadata`, comoGestor);
    const anotacoes = textoDo(ANOTACOES);

    expect(metadados.status).toBe(200);
    for (const rotulo of ['Iniciar Tratativa', 'Encerrar Tratativa', 'Cancelar Tratativa', 'Alterar Criticidade']) {
      expect(anotacoes).toContain(rotulo);
    }
    expect(anotacoes).toContain('UI.Identification');
    expect(anotacoes).toContain("Action: 'TratativaAppService.mudarStatus'");
    expect(anotacoes).toContain("Action: 'TratativaAppService.mudarCriticidade'");

    const criada = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: 'Tratativa para autorização', criticidade: 'Alta' },
      comoUsuario,
    );
    expect(criada.status).toBe(200);

    const semGestao = await POST(
      `${BASE}/Tratativas(${criada.data.codigo})/mudarStatus`,
      { status: 'Em andamento' },
      comoUsuario,
    );
    expect(semGestao.status).toBe(403);

    const comoGestorDeTratativa = await POST(
      `${BASE}/Tratativas(${criada.data.codigo})/mudarStatus`,
      { status: 'Em andamento' },
      comoGestor,
    );
    expect(comoGestorDeTratativa.status).toBe(204);
  });

  it('CA9: Plano de Ação referencia a composição de ações com a chave de hierarquia acaoMae', async () => {
    const metadados = await GET(`${BASE}/$metadata`, comoGestor);
    const anotacoes = textoDo(ANOTACOES);

    expect(metadados.status).toBe(200);
    expect(String(metadados.data)).toContain('acaoMae');
    expect(anotacoes).toContain("Target: 'acoes/@UI.LineItem'");
  });

  it('CA10, CA11 e CA12: Object Page declara as listas de Evidências, Comentários e Histórico', () => {
    const anotacoes = textoDo(ANOTACOES);

    for (const alvo of ['evidencias', 'comentarios', 'historico']) {
      expect(anotacoes).toContain(`Target: '${alvo}/@UI.LineItem'`);
    }
    for (const entidade of ['Evidencias', 'Comentarios', 'Historico']) {
      expect(anotacoes).toContain(`annotate TratativaAppService.${entidade}`);
    }
    expect(anotacoes).toContain('Value: quando');
    expect(anotacoes).toContain('Value: justificativa');
  });

  it('CA21: leitura por usuário comum mascara dados pessoais e oculta Responsáveis', async () => {
    const resposta = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: 'Tratativa para mascaramento', criticidade: 'Alta', descricao: 'Descrição restrita', solicitante: 'M2002' },
      comoUsuario,
    );
    const anotacoes = textoDo(ANOTACOES);

    expect(resposta.status).toBe(200);
    const consulta = await GET(`${BASE}/Tratativas(${resposta.data.codigo})`, comoUsuario);
    expect(consulta.status).toBe(200);
    expect(consulta.data.descricao).toBeNull();
    expect(consulta.data.solicitante).toBeNull();
    expect(consulta.data.responsavelPrincipal).toBeNull();
    expect(consulta.data.ocultaResponsaveis).toBe(true);
    expect(anotacoes).toContain("ID: 'ResponsaveisFacet'");
    expect(anotacoes).toContain('@UI.Hidden: ocultaResponsaveis');
    expect(anotacoes).toContain("Target: 'participantes/@UI.LineItem'");
  });

  it('CA22 e CA25: textos pt-BR incluem orientação contra nomes e dados sensíveis', () => {
    const textos = textoDo(I18N);

    expect(textos).toMatch(/nomes/i);
    expect(textos).toMatch(/dados sensíveis/i);
    expect(textos).toMatch(/Tratativa/);
    expect(textos).toMatch(/Comentário/);
  });

  it('CA23: transição inválida conserva a mensagem exata do backend', async () => {
    const criada = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: 'Tratativa para transição', criticidade: 'Alta' },
      comoUsuario,
    );
    expect(criada.status).toBe(200);

    const iniciar = await POST(
      `${BASE}/Tratativas(${criada.data.codigo})/mudarStatus`,
      { status: 'Em andamento' },
      comoGestor,
    );
    expect(iniciar.status).toBe(204);

    const repetida = await POST(
      `${BASE}/Tratativas(${criada.data.codigo})/mudarStatus`,
      { status: 'Em andamento' },
      comoGestor,
    );
    expect(repetida.status).toBe(409);
    expect(repetida.data.error.message).toBe('Transição não permitida: de Em andamento para Em andamento.');
  });

  it('CA24: recusa de prazo mantém target e mensagem estruturados para o campo', async () => {
    const tratativa = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: 'Tratativa com Ação de prazo inválido', criticidade: 'Alta' },
      comoUsuario,
    );
    expect(tratativa.status).toBe(200);

    // 004 R5: o Prazo recusado aqui é o da Ação, criada pela action "Adicionar Ação" do TratativaAppService.
    const resposta = await POST(
      `${BASE}/Tratativas(${tratativa.data.codigo})/criarAcao`,
      { descricao: 'Ação com prazo no passado', responsavel: 'M1001', prazo: '2026-10-09' },
      comoGestor,
    );

    expect(resposta.status).toBe(400);
    expect(resposta.data.error.target).toBe('prazo');
    expect(resposta.data.error.message).toBe('Prazo não pode ser anterior a hoje.');
  });

  it('CA26: manifesto usa floorplan Fiori elements, operável pelos controles nativos do SAPUI5', () => {
    const manifesto = JSON.parse(textoDo(MANIFESTO)) as Record<string, unknown>;
    const serializado = JSON.stringify(manifesto);

    expect(serializado).toContain('sap.fe.templates');
    expect(serializado).toContain('ListReport');
    expect(serializado).toContain('ObjectPage');
  });

  it('CA27 e CA27a: anotações e manifesto válidos em execução OData headless', async () => {
    const metadados = await GET(`${BASE}/$metadata`, comoUsuario);

    expect(metadados.status).toBe(200);
    expect(String(metadados.data)).toContain('Tratativas');
    for (const arquivo of [ANOTACOES, MANIFESTO, XS_APP]) {
      expect(existsSync(arquivo)).toBe(true);
    }
    expect(() => JSON.parse(textoDo(MANIFESTO)) as unknown).not.toThrow();
    expect(() => JSON.parse(textoDo(XS_APP)) as unknown).not.toThrow();
    expect(textoDo(ANOTACOES)).toContain('annotate TratativaAppService.Tratativas');
  });

  it('CA28: artefatos da tela não expõem nomenclatura exclusiva de departamento', () => {
    const interfaceDaTela = [textoDo(ANOTACOES), textoDo(I18N), textoDo(MANIFESTO)].join('\n');

    expect(interfaceDaTela).not.toMatch(/\b(SESMT|Qualidade|Compliance)\b/i);
  });
});
