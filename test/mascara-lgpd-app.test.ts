import cds from '@sap/cds';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comoGestor, comoM1001, comoM2002, comoM9999, comoUsuario } from './apoio/usuarios';
import { criarAcao, criarSubacao } from './apoio/acoes';
import { atribuirResponsavelPrincipal, incluirParticipante } from './apoio/responsaveis';
import { sufixoUnico, type Envia } from './apoio/tratativas';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/app/v1';
const RAIZ = join(__dirname, '..');
const PRAZO = '2027-01-01';

type Linha = Record<string, unknown>;
type Cenario = {
  tratativa: string;
  titulo: string;
  acao: string;
  subacao: string;
  comentarios: { tratativa: string; acao: string; subacao: string };
  evidencias: { ativa: string; removida: string; subacao: string };
  historico: Linha[];
  descricao: string;
  solicitante: string;
  trechoComentario: string;
  nomeArquivo: string;
  justificativa: string;
};

let cenario: Cenario;

jest.setTimeout(60000);

function itens(dados: unknown): Linha[] {
  const corpo = dados as { value?: Linha[] };
  return Array.isArray(corpo?.value) ? corpo.value : [];
}

function consulta(entidade: string, expressao: string, como: unknown = comoUsuario) {
  return GET(`${BASE}/${entidade}?${encodeURIComponent(expressao)}`, como);
}

function mensagemErro(dados: unknown): string | undefined {
  return (dados as { error?: { message?: string } })?.error?.message;
}

function codigo(dados: unknown): string {
  const valor = (dados as { codigo?: unknown }).codigo;
  if (typeof valor !== 'string') throw new Error('A resposta da action não contém o Código.');
  return valor as string;
}

async function anexo(
  tratativa: string,
  acao: string,
  nomeArquivo: string,
  descricao: string,
): Promise<string> {
  const resposta = await POST(
    `${BASE}/Acoes(${acao})/anexarEvidencia`,
    {
      nomeArquivo,
      mimeType: 'text/plain',
      conteudo: Buffer.from(`Conteúdo ${nomeArquivo}`).toString('base64'),
      descricao,
    },
    comoGestor,
  );
  if (resposta.status !== 200) throw new Error(`Falha ao anexar Evidência: HTTP ${resposta.status}`);
  return codigo(resposta.data);
}

beforeAll(async () => {
  const sufixo = sufixoUnico().replace(/-/g, '');
  const titulo = `Tratativa mascara ${sufixo}`;
  const descricao = `DescricaoPrivada${sufixo}`;
  const solicitante = `SolicitantePrivado${sufixo}`;
  const trechoComentario = `ComentarioPrivado${sufixo}`;
  const nomeArquivo = `EvidenciaPrivada${sufixo}.txt`;
  const justificativa = `JustificativaPrivada${sufixo}`;

  const criada = await POST(
    `${BASE}/criarTratativaAvulsa`,
    { titulo, descricao, criticidade: 'Alta', solicitante },
    comoGestor,
  );
  expect(criada.status).toBe(200);
  const tratativa = codigo(criada.data);

  const responsavel = await atribuirResponsavelPrincipal(
    enviar,
    tratativa,
    { responsavelPrincipal: 'M9999', justificativa: 'Responsável principal do cenário' },
    comoGestor,
  );
  expect(responsavel.status).toBe(204);
  const participante = await incluirParticipante(
    enviar,
    tratativa,
    { participante: 'M2002' },
    comoGestor,
  );
  expect(participante.status).toBe(204);

  const acao = await criarAcao(
    enviar,
    tratativa,
    { descricao: `Acao ${sufixo}`, responsavel: 'M1001', prazo: PRAZO, prioridade: 'Alta' },
    comoGestor,
  );
  expect(acao.status).toBe(200);
  const codigoAcao = codigo(acao.data);
  const subacao = await criarSubacao(
    enviar,
    tratativa,
    {
      acaoMae: codigoAcao,
      descricao: `Subacao ${sufixo}`,
      responsavel: 'M2002',
      prazo: PRAZO,
      prioridade: 'Média',
    },
    comoGestor,
  );
  expect(subacao.status).toBe(200);
  const codigoSubacao = codigo(subacao.data);

  const comentarioTratativa = await POST(
    `${BASE}/Tratativas(${tratativa})/comentarTratativa`,
    { texto: trechoComentario, mencoes: ['M2002'] },
    comoGestor,
  );
  expect(comentarioTratativa.status).toBe(200);
  const comentarioAcao = await POST(
    `${BASE}/Acoes(${codigoAcao})/comentarAcao`,
    { texto: `ComentarioAcao${sufixo}`, mencoes: [] },
    comoGestor,
  );
  expect(comentarioAcao.status).toBe(200);
  const comentarioSubacao = await POST(
    `${BASE}/Acoes(${codigoSubacao})/comentarAcao`,
    { texto: `ComentarioSubacao${sufixo}`, mencoes: [] },
    comoGestor,
  );
  expect(comentarioSubacao.status).toBe(200);

  const evidenciaAtiva = await anexo(tratativa, codigoAcao, nomeArquivo, `DescricaoAnexo${sufixo}`);
  const evidenciaRemovida = await anexo(
    tratativa,
    codigoAcao,
    `EvidenciaRemovida${sufixo}.txt`,
    `DescricaoRemovida${sufixo}`,
  );
  const evidenciaSubacao = await anexo(
    tratativa,
    codigoSubacao,
    `EvidenciaSubacao${sufixo}.txt`,
    `DescricaoSubacao${sufixo}`,
  );
  const remocao = await POST(
    `${BASE}/Evidencias(${evidenciaRemovida})/removerEvidencia`,
    {},
    comoGestor,
  );
  expect(remocao.status).toBe(204);

  const criticidade = await POST(
    `${BASE}/Tratativas(${tratativa})/mudarCriticidade`,
    { criticidade: 'Média' },
    comoGestor,
  );
  expect(criticidade.status).toBe(204);
  const cancelamento = await POST(
    `${BASE}/Tratativas(${tratativa})/cancelarTratativa`,
    { justificativa },
    comoGestor,
  );
  expect(cancelamento.status).toBe(204);

  const leituraHistorico = await consulta(
    `Historico`,
    `$filter=tratativa_codigo eq ${tratativa}`,
    comoGestor,
  );
  expect(leituraHistorico.status).toBe(200);
  const historico = itens(leituraHistorico.data);
  expect(historico.length).toBeGreaterThan(0);
  expect(historico.some((linha) => linha.campo === 'responsavelPrincipal')).toBe(true);
  expect(historico.some((linha) => linha.campo === 'participante')).toBe(true);
  expect(historico.some((linha) => linha.campo === 'criticidade')).toBe(true);

  cenario = {
    tratativa,
    titulo,
    acao: codigoAcao,
    subacao: codigoSubacao,
    comentarios: {
      tratativa: codigo(comentarioTratativa.data),
      acao: codigo(comentarioAcao.data),
      subacao: codigo(comentarioSubacao.data),
    },
    evidencias: {
      ativa: evidenciaAtiva,
      removida: evidenciaRemovida,
      subacao: evidenciaSubacao,
    },
    historico,
    descricao,
    solicitante,
    trechoComentario,
    nomeArquivo,
    justificativa,
  };
});

describe('Máscara LGPD genérica do TratativaAppService', () => {
  it('DC-17 mascara dados da Tratativa e das relações em expansões profundas', async () => {
    const expandHistorico = await GET(
      `${BASE}/Historico?${encodeURIComponent(
        `$filter=tratativa_codigo eq ${cenario.tratativa}&$expand=tratativa($select=descricao,solicitante,responsavelPrincipal)`,
      )}`,
      comoM2002,
    );
    expect(expandHistorico.status).toBe(200);
    const historico = itens(expandHistorico.data);
    expect(historico.length).toBeGreaterThan(0);
    for (const linha of historico) {
      const tratativa = linha.tratativa as Linha;
      expect(tratativa.descricao).toBeNull();
      expect(tratativa.solicitante).toBeNull();
      expect(tratativa.responsavelPrincipal).toBeNull();
    }

    const subacao = await GET(
      `${BASE}/Acoes(${cenario.subacao})?$expand=acaoMae`,
      comoUsuario,
    );
    expect(subacao.status).toBe(200);
    expect(subacao.data.responsavel).toBeNull();
    expect((subacao.data.acaoMae as Linha).responsavel).toBeNull();

    const participantes = await GET(
      `${BASE}/Participantes?${encodeURIComponent(
        `$filter=tratativa_codigo eq ${cenario.tratativa}&$expand=tratativa`,
      )}`,
      comoUsuario,
    );
    expect(participantes.status).toBe(200);
    const linhasParticipantes = itens(participantes.data);
    expect(linhasParticipantes.length).toBeGreaterThan(0);
    for (const linha of linhasParticipantes) {
      expect(linha.matricula).toBeNull();
      const tratativaExpandida = linha.tratativa as Linha;
      expect(tratativaExpandida.descricao).toBeNull();
      expect(tratativaExpandida.solicitante).toBeNull();
      expect(tratativaExpandida.responsavelPrincipal).toBeNull();
    }

    const tresNiveis = await GET(
      `${BASE}/Historico?${encodeURIComponent(
        `$filter=tratativa_codigo eq ${cenario.tratativa}&$expand=tratativa($expand=acoes($expand=acaoMae),participantes)`,
      )}`,
      comoM2002,
    );
    expect(tresNiveis.status).toBe(200);
    const historicoExpandido = itens(tresNiveis.data);
    expect(historicoExpandido.length).toBeGreaterThan(0);
    for (const linha of historicoExpandido) {
      const tratativa = linha.tratativa as Linha;
      expect(tratativa.participantes).toEqual([]);
      for (const acao of (tratativa.acoes as Linha[]) ?? []) {
        expect(acao.responsavel).toBeNull();
        if (acao.acaoMae) expect((acao.acaoMae as Linha).responsavel).toBeNull();
      }
    }

    const flags = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?$select=status,podeIniciar,ocultaIniciar,descricao`,
      comoUsuario,
    );
    expect(flags.status).toBe(200);
    expect(flags.data.podeIniciar).toBe(false);
    expect(flags.data.ocultaIniciar).toBe(true);
    expect(flags.data.descricao).toBeNull();
    const flagsGestor = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?$select=status,podeIniciar,ocultaIniciar,descricao`,
      comoGestor,
    );
    expect(flagsGestor.status).toBe(200);
    expect(flagsGestor.data.status).toBe('Cancelada');
    expect(flagsGestor.data.podeIniciar).toBe(false);
    expect(flagsGestor.data.ocultaIniciar).toBe(true);
    expect(flagsGestor.data.descricao).toBe(cenario.descricao);
  });

  it('DC-18 bloqueia Comentarios e caminhos que começam por Comentarios para não-Gestores', async () => {
    for (const identidade of [comoUsuario, comoM9999, comoM1001, comoM2002]) {
      const colecao = await GET(`${BASE}/Comentarios`, identidade);
      expect(colecao.status).toBe(403);
      expect(mensagemErro(colecao.data)).toBe('Acesso negado.');

      const chave = await GET(`${BASE}/Comentarios(${cenario.comentarios.tratativa})`, identidade);
      expect(chave.status).toBe(403);
      expect(mensagemErro(chave.data)).toBe('Acesso negado.');

      const mencoes = await GET(`${BASE}/Comentarios(${cenario.comentarios.tratativa})/mencoes`, identidade);
      expect(mencoes.status).toBe(403);
      const tratativa = await GET(`${BASE}/Comentarios(${cenario.comentarios.tratativa})/tratativa`, identidade);
      expect(tratativa.status).toBe(403);
    }
  });

  it('DC-18 restringe a navegação de Comentarios aos vínculos e omite mencoes expandidas', async () => {
    const semVinculo = await GET(`${BASE}/Tratativas(${cenario.tratativa})/comentarios`, comoUsuario);
    expect(semVinculo.status).toBe(200);
    expect(itens(semVinculo.data)).toEqual([]);
    const contagemSemVinculo = await GET(`${BASE}/Tratativas(${cenario.tratativa})/comentarios/$count`, comoUsuario);
    expect(contagemSemVinculo.status).toBe(200);
    expect(String(contagemSemVinculo.data)).toBe('0');

    const responsavelPrincipal = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios?$expand=mencoes`,
      comoM9999,
    );
    expect(responsavelPrincipal.status).toBe(200);
    const comentariosPrincipal = itens(responsavelPrincipal.data);
    expect(comentariosPrincipal.map((linha) => linha.codigo)).toEqual([cenario.comentarios.tratativa]);
    expect(comentariosPrincipal[0].texto).toBe(cenario.trechoComentario);
    expect(comentariosPrincipal[0].autor).toBe('gestor');
    expect(comentariosPrincipal[0].mencoes).toEqual([]);

    const participante = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios?$expand=mencoes`,
      comoM2002,
    );
    expect(participante.status).toBe(200);
    const comentariosParticipante = itens(participante.data);
    expect(comentariosParticipante.map((linha) => linha.codigo).sort()).toEqual(
      [cenario.comentarios.tratativa, cenario.comentarios.subacao].sort(),
    );
    expect(comentariosParticipante.every((linha) => linha.texto && linha.autor)).toBe(true);
    expect(comentariosParticipante.every((linha) => JSON.stringify(linha.mencoes) === '[]')).toBe(true);
    const contagemParticipante = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios/$count`,
      comoM2002,
    );
    expect(String(contagemParticipante.data)).toBe('2');

    const responsavelAcao = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios`,
      comoM1001,
    );
    expect(itens(responsavelAcao.data).map((linha) => linha.codigo)).toEqual([cenario.comentarios.acao]);

    const comentarioDeOutraAcao = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios(${cenario.comentarios.acao})`,
      comoM2002,
    );
    expect(comentarioDeOutraAcao.status).toBe(404);

    const expandTratativa = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?$expand=comentarios($expand=mencoes)`,
      comoM2002,
    );
    expect(expandTratativa.status).toBe(200);
    expect(expandTratativa.data.comentarios).toEqual([]);

    const expandTresNiveis = await GET(
      `${BASE}/Participantes?${encodeURIComponent(
        `$filter=tratativa_codigo eq ${cenario.tratativa}&$expand=tratativa($expand=comentarios)`,
      )}`,
      comoUsuario,
    );
    expect(expandTresNiveis.status).toBe(200);
    expect(
      (itens(expandTresNiveis.data)[0].tratativa as Linha).comentarios,
    ).toEqual([]);
  });

  it('DC-18 filtra Evidencias ativas por vínculo e mascara a autoria', async () => {
    const semVinculo = await consulta(
      'Evidencias',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoUsuario,
    );
    expect(semVinculo.status).toBe(200);
    expect(itens(semVinculo.data)).toEqual([]);

    const navegacaoSemVinculo = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/evidencias`,
      comoUsuario,
    );
    expect(navegacaoSemVinculo.status).toBe(200);
    expect(itens(navegacaoSemVinculo.data)).toEqual([]);
    const evidenciaDireta = await GET(
      `${BASE}/Evidencias(${cenario.evidencias.ativa})`,
      comoUsuario,
    );
    expect(evidenciaDireta.status).toBe(404);
    const acaoDaEvidenciaAlheia = await GET(
      `${BASE}/Evidencias(${cenario.evidencias.subacao})/acao`,
      comoUsuario,
    );
    expect(acaoDaEvidenciaAlheia.status).toBe(404);

    const expandSemVinculo = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?$expand=evidencias`,
      comoUsuario,
    );
    expect(expandSemVinculo.status).toBe(200);
    expect(expandSemVinculo.data.evidencias).toEqual([]);

    const responsavelAcao = await consulta(
      'Evidencias',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoM1001,
    );
    expect(responsavelAcao.status).toBe(200);
    const evidenciasM1001 = itens(responsavelAcao.data);
    expect(evidenciasM1001.map((linha) => linha.codigo)).toEqual([cenario.evidencias.ativa]);
    const contagem = await GET(
      `${BASE}/Evidencias/$count?${encodeURIComponent(
        `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      )}`,
      comoM1001,
    );
    expect(String(contagem.data)).toBe('1');
    const ativa = await GET(`${BASE}/Evidencias(${cenario.evidencias.ativa})`, comoM1001);
    expect(ativa.status).toBe(200);
    expect(ativa.data.autorAnexo).toBeNull();
    expect(ativa.data.autorRemocao).toBeNull();
    expect(ativa.data.nomeArquivo).toBe(cenario.nomeArquivo);
    expect(ativa.data.descricao).toBeTruthy();

    const codigosAcaoResponsavel = new Set(evidenciasM1001.map((linha) => linha.codigo));
    expect(codigosAcaoResponsavel.has(cenario.evidencias.removida)).toBe(false);
    expect(codigosAcaoResponsavel.has(cenario.evidencias.subacao)).toBe(false);
    const acaoPropria = await GET(`${BASE}/Evidencias(${cenario.evidencias.ativa})/acao`, comoM1001);
    expect(acaoPropria.status).toBe(200);
    const acaoAlheia = await GET(
      `${BASE}/Evidencias(${cenario.evidencias.subacao})/acao`,
      comoM1001,
    );
    expect(acaoAlheia.status).toBe(404);

    const expandComVinculo = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?$expand=evidencias`,
      comoM1001,
    );
    expect(expandComVinculo.status).toBe(200);
    expect(expandComVinculo.data.evidencias).toEqual([]);

    const responsavelSubacao = await consulta(
      'Evidencias',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoM2002,
    );
    expect(itens(responsavelSubacao.data).map((linha) => linha.codigo)).toEqual([
      cenario.evidencias.subacao,
    ]);
  });

  it('DC-18 filtra Historico por Responsável Principal ou Participante e mascara valores pessoais', async () => {
    const semVinculo = await consulta(
      'Historico',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoUsuario,
    );
    expect(semVinculo.status).toBe(200);
    expect(itens(semVinculo.data)).toEqual([]);

    const navegacaoSemVinculo = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/historico`,
      comoUsuario,
    );
    expect(navegacaoSemVinculo.status).toBe(200);
    expect(itens(navegacaoSemVinculo.data)).toEqual([]);
    const chaveSemVinculo = await GET(
      `${BASE}/Historico(${cenario.historico[0].ID})`,
      comoUsuario,
    );
    expect(chaveSemVinculo.status).toBe(404);
    const tratativaSemVinculo = await GET(
      `${BASE}/Historico(${cenario.historico[0].ID})/tratativa`,
      comoUsuario,
    );
    expect(tratativaSemVinculo.status).toBe(404);
    const expandSemVinculo = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?$expand=historico`,
      comoUsuario,
    );
    expect(expandSemVinculo.status).toBe(200);
    expect(expandSemVinculo.data.historico).toEqual([]);

    const responsavelAcao = await consulta(
      'Historico',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoM1001,
    );
    expect(itens(responsavelAcao.data)).toEqual([]);

    const participante = await consulta(
      'Historico',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoM2002,
    );
    expect(participante.status).toBe(200);
    const eventos = itens(participante.data);
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((linha) => linha.autor === null && linha.justificativa === null)).toBe(true);
    const semCampo = eventos.find((linha) => linha.campo === null || linha.campo === undefined);
    expect(semCampo).toBeDefined();
    expect(semCampo?.valorAnterior).toBeNull();
    expect(semCampo?.valorNovo).toBeNull();
    for (const linha of eventos) {
      const campo = String(linha.campo ?? '').toLowerCase();
      if (['solicitante', 'responsavelprincipal', 'participante', 'responsavel'].includes(campo)) {
        expect(linha.valorAnterior).toBeNull();
        expect(linha.valorNovo).toBeNull();
      }
    }
    const eventoCriticidade = eventos.find((linha) => linha.campo === 'criticidade');
    expect(eventoCriticidade?.valorNovo).toBe('Média');

    const selecionado = await consulta(
      'Historico',
      `$filter=tratativa_codigo eq ${cenario.tratativa}&$select=valorNovo`,
      comoM2002,
    );
    expect(selecionado.status).toBe(200);
    const valores = itens(selecionado.data).map((linha) => linha.valorNovo);
    expect(valores).toContain('Média');
    expect(valores).toContain(null);

    const expandComVinculo = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?$expand=historico`,
      comoM2002,
    );
    expect(expandComVinculo.status).toBe(200);
    expect(expandComVinculo.data.historico).toEqual([]);
    const tratativaDoEvento = await GET(
      `${BASE}/Historico(${eventoCriticidade?.ID})/tratativa`,
      comoM2002,
    );
    expect(tratativaDoEvento.status).toBe(200);
    expect(tratativaDoEvento.data.descricao).toBeNull();
    expect(tratativaDoEvento.data.solicitante).toBeNull();
    expect(tratativaDoEvento.data.responsavelPrincipal).toBeNull();
  });

  it('DC-19 recusa lambdas que atravessam Comentarios, Historico e Evidencias', async () => {
    const filtros = [
      `$filter=comentarios/any(c:contains(c/texto,'${cenario.trechoComentario}'))`,
      `$filter=comentarios/any(c:c/autor eq 'gestor')`,
      `$filter=historico/any(h:contains(h/justificativa,'${cenario.justificativa}'))`,
      `$filter=evidencias/any(e:e/autorAnexo eq 'gestor')`,
      `$filter=evidencias/all(e:e/ativo eq true)`,
    ];
    for (const filtro of filtros) {
      const resposta = await consulta('Tratativas', filtro);
      expect(resposta.status).toBe(403);
      expect(mensagemErro(resposta.data)).toBe('Acesso negado.');
    }

    for (const identidade of [comoM1001, comoM2002]) {
      for (const entidadeRestrita of ['historico', 'evidencias']) {
        const resposta = await consulta(
          'Tratativas',
          `$filter=${entidadeRestrita}/any(x:x/tratativa_codigo eq ${cenario.tratativa})`,
          identidade,
        );
        expect(resposta.status).toBe(403);
      }
    }
  });

  it('DC-19 recusa predicados e ordenações por campos pessoais não filtráveis', async () => {
    const filtros = [
      [`Tratativas`, `$filter=solicitante eq '${cenario.solicitante}'`],
      [`Tratativas`, `$filter=contains(descricao,'${cenario.descricao.slice(0, 18)}')`],
      [`Tratativas`, '$orderby=responsavelPrincipal'],
      [`Tratativas`, `$filter=acoes/any(a:a/responsavel eq 'M1001')`],
      [`Acoes`, `$filter=responsavel eq 'M1001'`],
      [`Acoes`, `$filter=tratativa/solicitante eq '${cenario.solicitante}'`],
      [`Participantes`, `$filter=matricula eq 'M2002'`],
    ];
    for (const [entidade, filtro] of filtros) {
      const resposta = await consulta(entidade, filtro);
      expect(resposta.status).toBe(403);
      expect(mensagemErro(resposta.data)).toBe('Acesso negado.');
    }

    const historicoPorValor = await consulta(
      'Historico',
      `$filter=tratativa_codigo eq ${cenario.tratativa} and valorNovo eq 'M2002'`,
      comoM2002,
    );
    expect(historicoPorValor.status).toBe(403);
    expect(mensagemErro(historicoPorValor.data)).toBe('Acesso negado.');
  });

  it('DC-19 recusa filtros aninhados, agrupamentos e colunas calculadas sobre campos pessoais', async () => {
    const filtroExpandido = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})?${encodeURIComponent(
        `$expand=acoes($filter=responsavel eq 'M1001')`,
      )}`,
      comoUsuario,
    );
    expect(filtroExpandido.status).toBe(403);
    expect(mensagemErro(filtroExpandido.data)).toBe('Acesso negado.');

    const agrupamento = await consulta('Tratativas', '$apply=groupby((solicitante))');
    expect(agrupamento.status).toBe(403);
    expect(mensagemErro(agrupamento.data)).toBe('Acesso negado.');
    const agregado = await consulta(
      'Tratativas',
      '$apply=aggregate(solicitante with max as s)',
    );
    expect(agregado.status).toBe(403);
    expect(mensagemErro(agregado.data)).toBe('Acesso negado.');

    const calculado = await consulta('Tratativas', '$compute=solicitante as s&$select=s');
    expect([400, 403, 501]).toContain(calculado.status);
    if (calculado.status === 403) {
      expect(mensagemErro(calculado.data)).toBe('Acesso negado.');
    }
    expect(JSON.stringify(calculado.data)).not.toContain(cenario.solicitante);
  });

  it('DC-19 exclui campos pessoais da busca livre e mantém os campos públicos pesquisáveis', async () => {
    const tituloPermitido = await consulta(
      'Tratativas',
      `$search=${cenario.titulo}`,
    );
    expect(tituloPermitido.status).toBe(200);
    expect(itens(tituloPermitido.data).some((linha) => linha.codigo === cenario.tratativa)).toBe(true);

    const buscas = [
      ['Tratativas', cenario.solicitante, comoUsuario],
      ['Tratativas', cenario.descricao.slice(0, 18), comoUsuario],
      ['Tratativas', 'M9999', comoUsuario],
      ['Acoes', 'M1001', comoUsuario],
      ['Historico', 'M9999', comoM2002],
    ] as const;
    for (const [entidade, termo, identidade] of buscas) {
      const resposta = await consulta(entidade, `$search=${encodeURIComponent(termo)}`, identidade);
      expect(resposta.status).toBe(200);
      expect(
        itens(resposta.data).some(
          (linha) =>
            linha.codigo === cenario.tratativa ||
            linha.tratativa_codigo === cenario.tratativa ||
            linha.codigo === cenario.acao ||
            linha.codigo === cenario.subacao,
        ),
      ).toBe(false);
    }

    const buscaParticipantesComum = await consulta(
      'Participantes',
      `$search=${encodeURIComponent('M2002')}`,
      comoUsuario,
    );
    expect(buscaParticipantesComum.status).toBe(403);
    expect(mensagemErro(buscaParticipantesComum.data)).toBe('Acesso negado.');

    const buscaParticipantesGestor = await consulta(
      'Participantes',
      `$search=${encodeURIComponent('TERMO-SEM-CORRESPONDENCIA')}`,
      comoGestor,
    );
    expect(buscaParticipantesGestor.status).toBe(200);
    expect(
      itens(buscaParticipantesGestor.data).some((linha) => linha.tratativa_codigo === cenario.tratativa),
    ).toBe(true);
  });

  it('DC-19 permite filtros legítimos e preserva o comportamento do Gestor', async () => {
    const comentarioGestor = await GET(
      `${BASE}/Comentarios(${cenario.comentarios.tratativa})?$expand=mencoes`,
      comoGestor,
    );
    expect(comentarioGestor.status).toBe(200);
    expect(comentarioGestor.data.texto).toBe(cenario.trechoComentario);
    expect((comentarioGestor.data.mencoes as Linha[]).map((linha) => linha.matricula)).toContain('M2002');
    const evidenciasGestor = await consulta(
      'Evidencias',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoGestor,
    );
    expect(itens(evidenciasGestor.data).map((linha) => linha.codigo)).toEqual(
      expect.arrayContaining([
        cenario.evidencias.ativa,
        cenario.evidencias.removida,
        cenario.evidencias.subacao,
      ]),
    );
    const evidenciaRemovidaGestor = await GET(
      `${BASE}/Evidencias(${cenario.evidencias.removida})`,
      comoGestor,
    );
    expect(evidenciaRemovidaGestor.status).toBe(200);
    expect(evidenciaRemovidaGestor.data.autorAnexo).toBe('gestor');
    expect(evidenciaRemovidaGestor.data.autorRemocao).toBe('gestor');
    const historicoGestor = await consulta(
      'Historico',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoGestor,
    );
    expect(itens(historicoGestor.data).some((linha) => linha.autor === 'gestor')).toBe(true);
    expect(
      itens(historicoGestor.data).some((linha) => linha.justificativa === cenario.justificativa),
    ).toBe(true);
    expect(
      (await GET(`${BASE}/Comentarios(${cenario.comentarios.tratativa})/tratativa`, comoGestor)).status,
    ).toBe(200);
    expect(
      (await GET(`${BASE}/Evidencias(${cenario.evidencias.subacao})/acao`, comoGestor)).status,
    ).toBe(200);
    expect(
      (
        await GET(
          `${BASE}/Historico(${cenario.historico[0].ID})/tratativa`,
          comoGestor,
        )
      ).status,
    ).toBe(200);

    const evidenciasDoResponsavel = await consulta(
      'Evidencias',
      `$filter=tratativa_codigo eq ${cenario.tratativa}`,
      comoM1001,
    );
    expect(evidenciasDoResponsavel.status).toBe(200);
    expect(itens(evidenciasDoResponsavel.data).map((linha) => linha.codigo)).toContain(
      cenario.evidencias.ativa,
    );

    const comentariosDoParticipante = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios`,
      comoM2002,
    );
    expect(comentariosDoParticipante.status).toBe(200);
    expect(itens(comentariosDoParticipante.data).map((linha) => linha.codigo)).toEqual(
      expect.arrayContaining([cenario.comentarios.tratativa, cenario.comentarios.subacao]),
    );
    const filtroComentarioPermitido = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios?${encodeURIComponent(
        `$filter=contains(texto,'${cenario.trechoComentario}')`,
      )}`,
      comoM2002,
    );
    expect(filtroComentarioPermitido.status).toBe(200);
    expect(itens(filtroComentarioPermitido.data).map((linha) => linha.codigo)).toContain(
      cenario.comentarios.tratativa,
    );
    const filtroComentarioEGestor = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios?${encodeURIComponent(
        "$filter=autor eq 'gestor'&$orderby=criadoEm",
      )}`,
      comoM2002,
    );
    expect(filtroComentarioEGestor.status).toBe(200);

    const evidenciaFiltradaPorNome = await consulta(
      'Evidencias',
      `$filter=tratativa_codigo eq ${cenario.tratativa} and contains(nomeArquivo,'${cenario.nomeArquivo}')`,
      comoM1001,
    );
    expect(itens(evidenciaFiltradaPorNome.data).map((linha) => linha.codigo)).toContain(
      cenario.evidencias.ativa,
    );
    const historicoCriticidade = await consulta(
      'Historico',
      `$filter=tratativa_codigo eq ${cenario.tratativa} and campo eq 'criticidade'`,
      comoM2002,
    );
    expect(historicoCriticidade.status).toBe(200);
    expect(itens(historicoCriticidade.data).some((linha) => linha.campo === 'criticidade')).toBe(true);

    const filtroComCampoDecididoGestor = await consulta(
      'Tratativas',
      `$filter=solicitante eq '${cenario.solicitante}'`,
      comoGestor,
    );
    expect(filtroComCampoDecididoGestor.status).toBe(200);
    expect(itens(filtroComCampoDecididoGestor.data).some((linha) => linha.codigo === cenario.tratativa)).toBe(true);
    const filtroStatusCriticidade = await consulta(
      'Tratativas',
      `$filter=status eq 'Cancelada' and criticidade eq 'Média'&$orderby=titulo`,
      comoUsuario,
    );
    expect(filtroStatusCriticidade.status).toBe(200);
    expect(itens(filtroStatusCriticidade.data).some((linha) => linha.codigo === cenario.tratativa)).toBe(true);
    const ordemGestor = await consulta('Tratativas', '$orderby=responsavelPrincipal', comoGestor);
    expect(ordemGestor.status).toBe(200);
    const agrupamentoGestor = await consulta(
      'Tratativas',
      '$apply=groupby((solicitante))',
      comoGestor,
    );
    expect(agrupamentoGestor.status).toBe(200);
    const calculadoGestor = await consulta(
      'Tratativas',
      '$compute=solicitante as s&$select=s',
      comoGestor,
    );
    expect(calculadoGestor.status).toBe(200);
    const lambdaGestor = await consulta(
      'Tratativas',
      `$filter=comentarios/any(c:c/autor eq 'gestor')`,
      comoGestor,
    );
    expect(lambdaGestor.status).toBe(200);
    expect(itens(lambdaGestor.data).some((linha) => linha.codigo === cenario.tratativa)).toBe(true);
    const searchGestor = await consulta(
      'Tratativas',
      `$search=${cenario.titulo}`,
      comoGestor,
    );
    expect(searchGestor.status).toBe(200);
    expect(itens(searchGestor.data).some((linha) => linha.codigo === cenario.tratativa)).toBe(true);

    const filtroMencoes = await GET(
      `${BASE}/Tratativas(${cenario.tratativa})/comentarios?${encodeURIComponent(
        "$filter=mencoes/any(m:m/matricula eq 'M2002')",
      )}`,
      comoM2002,
    );
    expect(filtroMencoes.status).toBe(403);
  });

  it('DC-17 e DC-19 guardam no CSN os campos decididos, liberados e filtráveis', async () => {
    const pesquisaColaboradores = await consulta(
      'Colaboradores',
      '$search=M1001',
      comoUsuario,
    );
    expect(pesquisaColaboradores.status).toBe(200);

    type ElementoCSN = {
      type?: string;
      target?: string;
      '@PersonalData.IsPotentiallyPersonal'?: boolean;
      '@cds.search'?: Record<string, unknown>;
      [chave: string]: unknown;
    };
    type DefinicaoCSN = {
      elements?: Record<string, ElementoCSN>;
      [chave: string]: unknown;
    };
    const modelo = (await cds.load(['srv', 'app'])) as unknown as {
      definitions: Record<string, DefinicaoCSN>;
    };
    const decididos: Record<string, string[]> = {
      'TratativaAppService.Tratativas': [
        'descricao',
        'solicitante',
        'responsavelPrincipal',
        'metodologiaData',
        'metodologiaAutor',
      ],
      'TratativaAppService.Acoes': ['responsavel', 'causaDescricao'],
      'TratativaAppService.Participantes': ['matricula'],
      'TratativaAppService.AvalesTecnicos': ['fundamentacao', 'validador'],
      'TratativaAppService.Evidencias': [
        'nomeArquivo',
        'descricao',
        'autorAnexo',
        'autorRemocao',
      ],
      'TratativaAppService.Comentarios': ['texto', 'autor'],
      'TratativaAppService.Historico': [
        'autor',
        'justificativa',
        'valorAnterior',
        'valorNovo',
      ],
      'TratativaAppService.MencoesComentario': ['matricula'],
    };
    const liberados: Record<string, string[]> = {
      'TratativaAppService.Evidencias': ['nomeArquivo', 'descricao'],
      'TratativaAppService.Comentarios': ['texto', 'autor'],
      'TratativaAppService.Historico': ['valorAnterior', 'valorNovo'],
    };
    const filtraveis: Record<string, string[]> = {
      'TratativaAppService.Evidencias': ['nomeArquivo', 'descricao'],
      'TratativaAppService.Comentarios': ['texto', 'autor'],
    };

    expect(
      liberados['TratativaAppService.Evidencias'].every((campo) =>
        decididos['TratativaAppService.Evidencias'].includes(campo),
      ),
    ).toBe(true);
    expect(
      liberados['TratativaAppService.Comentarios'].every((campo) =>
        decididos['TratativaAppService.Comentarios'].includes(campo),
      ),
    ).toBe(true);
    expect(
      liberados['TratativaAppService.Historico'].every((campo) =>
        decididos['TratativaAppService.Historico'].includes(campo),
      ),
    ).toBe(true);

    for (const [nome, campos] of Object.entries(decididos)) {
      const definicao = modelo.definitions[nome];
      expect(definicao).toBeDefined();
      for (const campo of campos) {
        expect(definicao?.elements?.[campo]).toBeDefined();
      }
    }

    for (const [nome, definicao] of Object.entries(modelo.definitions)) {
      if (!nome.startsWith('TratativaAppService.') || nome === 'TratativaAppService.Colaboradores') {
        continue;
      }
      for (const [campo, elemento] of Object.entries(definicao.elements ?? {})) {
        if (elemento['@PersonalData.IsPotentiallyPersonal']) {
          expect(decididos[nome]).toContain(campo);
        }
      }
    }

    for (const [nome, campos] of Object.entries(filtraveis)) {
      for (const campo of campos) {
        expect(liberados[nome]).toContain(campo);
      }
    }

    const entidadesComBuscaExcluida = [
      'TratativaAppService.Tratativas',
      'TratativaAppService.Acoes',
      'TratativaAppService.Participantes',
      'TratativaAppService.AvalesTecnicos',
      'TratativaAppService.Evidencias',
      'TratativaAppService.Historico',
      'TratativaAppService.MencoesComentario',
    ];
    for (const nome of entidadesComBuscaExcluida) {
      const definicao = modelo.definitions[nome];
      expect(definicao).toBeDefined();
      for (const campo of decididos[nome]) {
        if (filtraveis[nome]?.includes(campo)) continue;
        const tipo = definicao?.elements?.[campo]?.type;
        if (tipo !== 'cds.String' && tipo !== 'cds.LargeString') continue;
        const anotacaoDireta = definicao?.[`@cds.search.${campo}`];
        const busca = definicao?.['@cds.search'] as Record<string, unknown> | undefined;
        expect(anotacaoDireta ?? busca?.[campo]).toBe(false);
      }
    }

    const authDev = readFileSync(join(RAIZ, 'test', 'apoio', 'auth-dev.js'), 'utf8');
    expect(authDev).toMatch(/['"]M1001['"]\s*:\s*\[\s*\]/);
    expect(authDev).toMatch(/['"]M2002['"]\s*:\s*\[\s*\]/);
  });

  it('DC-17 e DC-19 reconhecem M1001 e M2002 como usuários de desenvolvimento sem papéis', async () => {
    const caminho = join(RAIZ, 'test', 'apoio', 'auth-dev.js');
    const carregado = (await import(caminho)) as unknown;
    type UsuarioInjetado = { id?: string; is?: (papel: string) => boolean };
    type Middleware = (
      req: { user?: UsuarioInjetado },
      res: unknown,
      next: () => void,
    ) => void;
    const middleware = (typeof carregado === 'function'
      ? carregado
      : (carregado as { default?: unknown }).default) as Middleware;
    const anteriorDev = process.env.DEV_USER;
    const anteriorCds = process.env.CDS_DEV_USER;

    try {
      for (const identidade of ['M1001', 'M2002']) {
        process.env.DEV_USER = identidade;
        delete process.env.CDS_DEV_USER;
        const req: { user?: UsuarioInjetado } = {};
        let seguiu = false;
        middleware(req, {}, () => {
          seguiu = true;
        });
        expect(seguiu).toBe(true);
        expect(req.user?.id).toBe(identidade);
        expect(req.user?.is?.('GestorTratativa')).toBe(false);
      }
    } finally {
      if (anteriorDev === undefined) delete process.env.DEV_USER;
      else process.env.DEV_USER = anteriorDev;
      if (anteriorCds === undefined) delete process.env.CDS_DEV_USER;
      else process.env.CDS_DEV_USER = anteriorCds;
    }
  });
});
