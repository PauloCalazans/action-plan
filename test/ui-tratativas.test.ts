import cds from '@sap/cds';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoGestor, comoUsuario, semAuth } from './apoio/usuarios';
import { sufixoUnico } from './apoio/tratativas';

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

// GET de coleção OData v4: devolve o array de itens (ou [] quando vazio).
function itens(dados: unknown): Record<string, unknown>[] {
  const corpo = dados as { value?: Record<string, unknown>[] };
  return Array.isArray(corpo?.value) ? corpo.value : [];
}

// Setup pela API da UI (Achado 4): cria a Tratativa e a Ação pelo próprio TratativaAppService.
async function novaTratativaApp(): Promise<string> {
  const r = await POST(
    `${BASE}/criarTratativaAvulsa`,
    { titulo: `Tratativa da UI ${sufixoUnico()}`, criticidade: 'Alta' },
    comoUsuario,
  );
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function novaAcaoApp(tratativa: string, responsavel: string): Promise<string> {
  const r = await POST(
    `${BASE}/Tratativas(${tratativa})/criarAcao`,
    { descricao: `Ação da UI ${sufixoUnico()}`, responsavel, prazo: '2027-01-01', prioridade: 'Alta' },
    comoGestor,
  );
  expect(r.status).toBe(200);
  return r.data.codigo as string;
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
    expect(anotacoes).toContain("Action: 'TratativaAppService.EntityContainer/criarTratativaAvulsa'");
  });

  it('CA7 e CA8: identificação declara ações de cabeçalho do Gestor e o serviço as restringe', async () => {
    const metadados = await GET(`${BASE}/$metadata`, comoGestor);
    const anotacoes = textoDo(ANOTACOES);

    expect(metadados.status).toBe(200);
    for (const rotulo of ['Iniciar Tratativa', 'Encerrar Tratativa', 'Cancelar Tratativa', 'Alterar Criticidade']) {
      expect(anotacoes).toContain(rotulo);
    }
    expect(anotacoes).toContain('UI.Identification');
    // Achado 4 (R-08): os botões de ciclo de vida usam as ações dedicadas com @UI.Hidden: oculta<Acao>.
    for (const acao of ['iniciarTratativa', 'encerrarTratativa', 'cancelarTratativa', 'reabrirTratativa']) {
      expect(anotacoes).toContain(`Action: 'TratativaAppService.${acao}'`);
    }
    for (const flag of ['ocultaIniciar', 'ocultaEncerrar', 'ocultaCancelar', 'ocultaReabrir']) {
      expect(anotacoes).toContain(`@UI.Hidden: ${flag}`);
    }
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

  it('CA2, CA3 e CA29 (acoes-nas-entidades): o manifest declara os botões das actions de linha e o serviço as liga a Acoes e a Evidencias', async () => {
    const manifesto = JSON.parse(textoDo(MANIFESTO)) as {
      'sap.ui5': {
        routing: {
          targets: {
            TratativasObjectPage: {
              options: { settings: { controlConfiguration?: Record<string, { actions?: Record<string, unknown> }> } };
            };
          };
        };
      };
    };
    const configuracao =
      manifesto['sap.ui5'].routing.targets.TratativasObjectPage.options.settings.controlConfiguration ?? {};
    const modelo = (await cds.load(['srv', 'app'])) as unknown as {
      definitions: Record<string, { actions?: Record<string, unknown> }>;
    };
    const daTratativa = Object.keys(modelo.definitions['TratativaAppService.Tratativas'].actions ?? {});
    const daAcao = Object.keys(modelo.definitions['TratativaAppService.Acoes'].actions ?? {});

    for (const lista of ['acoes', 'evidencias', 'comentarios']) {
      const acoes = configuracao[`${lista}/@com.sap.vocabularies.UI.v1.LineItem`]?.actions ?? {};
      expect(Object.keys(acoes).length).toBeGreaterThan(0);
    }
    for (const action of ['criarSubacao', 'delegarAcao', 'anexarEvidencia']) {
      expect(daTratativa).not.toContain(action);
      expect(daAcao).toContain(action);
    }
  });

  it('CA9 (Achado 4): criarSubacao monta a hierarquia de 2 níveis pelo TratativaAppService', async () => {
    const tratativa = await novaTratativaApp();
    const mae = await novaAcaoApp(tratativa, 'M1001');

    const filha = await POST(
      `${BASE}/Acoes(${mae})/criarSubacao`,
      { descricao: 'Subação da UI', responsavel: 'M1001', prazo: '2027-01-01', prioridade: 'Média' },
      comoGestor,
    );
    expect(filha.status).toBe(200);

    const detalhe = await GET(`${BASE}/Acoes(${filha.data.codigo})?$expand=acaoMae`, comoGestor);
    expect(detalhe.status).toBe(200);
    expect((detalhe.data as { acaoMae?: { codigo?: string } }).acaoMae?.codigo).toBe(mae);
  });

  it('CA10 (Achado 4): anexarEvidencia e removerEvidencia operam pelo TratativaAppService', async () => {
    const tratativa = await novaTratativaApp();
    const acao = await novaAcaoApp(tratativa, 'M1001');
    const conteudo = Buffer.from('%PDF-1.4\nEvidência de teste').toString('base64');

    const anexo = await POST(
      `${BASE}/Acoes(${acao})/anexarEvidencia`,
      { nomeArquivo: 'evidencia.pdf', mimeType: 'application/pdf', conteudo, descricao: 'Evidência de teste' },
      comoGestor,
    );
    expect(anexo.status).toBe(200);
    const evidencia = anexo.data.codigo as string;

    const ativa = await GET(`${BASE}/Evidencias(${evidencia})`, comoGestor);
    expect(ativa.status).toBe(200);
    expect(ativa.data.ativo).toBe(true);

    const remocao = await POST(`${BASE}/Evidencias(${evidencia})/removerEvidencia`, {}, comoGestor);
    expect(remocao.status).toBe(204);
    const removida = await GET(`${BASE}/Evidencias(${evidencia})`, comoGestor);
    expect(removida.status).toBe(200);
    expect(removida.data.ativo).toBe(false);
  });

  it('CA11 (Achado 4): comentarTratativa e comentarAcao registram comentários com menção pelo TratativaAppService', async () => {
    const tratativa = await novaTratativaApp();
    const acao = await novaAcaoApp(tratativa, 'M1001');

    const naTratativa = await POST(
      `${BASE}/Tratativas(${tratativa})/comentarTratativa`,
      { texto: 'Comentário na Tratativa', mencoes: ['M2002'] },
      comoGestor,
    );
    expect(naTratativa.status).toBe(200);
    const comentarioTratativa = await GET(`${BASE}/Comentarios(${naTratativa.data.codigo})`, comoGestor);
    expect(comentarioTratativa.status).toBe(200);
    expect(comentarioTratativa.data.texto).toBe('Comentário na Tratativa');

    const naAcao = await POST(
      `${BASE}/Acoes(${acao})/comentarAcao`,
      { texto: 'Comentário na Ação', mencoes: ['M2002'] },
      comoGestor,
    );
    expect(naAcao.status).toBe(200);
    const comentarioAcao = await GET(`${BASE}/Comentarios(${naAcao.data.codigo})`, comoGestor);
    expect(comentarioAcao.status).toBe(200);
    expect(comentarioAcao.data.texto).toBe('Comentário na Ação');
  });

  it('CA3 e CA27 (acoes-nas-entidades): delegarAcao da linha troca o responsável pela ação pelo TratativaAppService', async () => {
    const tratativa = await novaTratativaApp();
    const acao = await novaAcaoApp(tratativa, 'M1001');

    const delegacao = await POST(
      `${BASE}/Acoes(${acao})/delegarAcao`,
      { novoResponsavel: 'M2002', justificativa: 'Redistribuição de carga' },
      comoGestor,
    );
    expect(delegacao.status).toBe(204);

    const detalhe = await GET(`${BASE}/Acoes(${acao})`, comoGestor);
    expect(detalhe.status).toBe(200);
    expect(detalhe.data.responsavel).toBe('M2002');
  });

  it('CA21 (Achado 1 LGPD): Participantes e Acoes não expõem matrícula/responsável a quem não é Gestor', async () => {
    const criada = await POST(
      `${BASE}/criarTratativaAvulsa`,
      { titulo: 'Tratativa LGPD', criticidade: 'Alta' },
      comoUsuario,
    );
    expect(criada.status).toBe(200);
    const tratativa = criada.data.codigo as string;

    const participante = await POST(`/api/tratativa/v1/Tratativas(${tratativa})/incluirParticipante`, { participante: 'M2002' }, comoGestor);
    expect(participante.status).toBe(204);
    const acao = await novaAcaoApp(tratativa, 'M1001');

    // Não-gestor: nenhuma matrícula nem responsável exposto (mascarados como null).
    const participantesUsuario = await GET(`${BASE}/Participantes`, comoUsuario);
    expect(participantesUsuario.status).toBe(200);
    expect(itens(participantesUsuario.data).every((linha) => linha.matricula === null)).toBe(true);

    const acoesUsuario = await GET(`${BASE}/Acoes`, comoUsuario);
    expect(acoesUsuario.status).toBe(200);
    expect(itens(acoesUsuario.data).every((linha) => linha.responsavel === null)).toBe(true);

    // O $expand a partir de Tratativas também respeita a máscara.
    const expandido = await GET(`${BASE}/Tratativas(${tratativa})?$expand=participantes,acoes`, comoUsuario);
    expect(expandido.status).toBe(200);
    const detalhe = expandido.data as { participantes?: { matricula?: unknown }[]; acoes?: { responsavel?: unknown }[] };
    expect((detalhe.participantes ?? []).every((linha) => linha.matricula === null)).toBe(true);
    expect((detalhe.acoes ?? []).every((linha) => linha.responsavel === null)).toBe(true);

    // Gestor: os dados aparecem (a máscara vale só para quem não é Gestor).
    const participantesGestor = await GET(`${BASE}/Participantes`, comoGestor);
    expect(itens(participantesGestor.data).some((linha) => linha.matricula === 'M2002')).toBe(true);
    const acoesGestor = await GET(`${BASE}/Acoes`, comoGestor);
    expect(itens(acoesGestor.data).some((linha) => linha.codigo === acao && linha.responsavel === 'M1001')).toBe(true);
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
