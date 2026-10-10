import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, editar, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor, comoM1001 } from './apoio/usuarios';
import { criarAcao, editarAcao } from './apoio/acoes';
import { atribuirResponsavelPrincipal } from './apoio/responsaveis';
import { consultarHistoricoTratativa, type Consulta } from './apoio/historico';

// Revisão do diff (Achado 1, Importante): a paginação (slice) é aplicada antes do filtro de
// autorização (`srv/tratativa-service.ts:726-730`, `srv/tratativa/historico-consulta.ts:1210-1213`),
// quebrando a navegação paginada para papéis restritos — design.md:298 manda filtrar antes de paginar.
// Achado 3: não havia teste de paginação com múltiplos eventos para um papel restrito (Responsável de Ação).

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;

jest.setTimeout(60000);

beforeAll(registrarCredenciais);
afterEach(liberarRelogio);

type Item = Record<string, unknown>;

async function criarTratativaComResponsavelPrincipal(responsavelPrincipal: string): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta' });
  expect(r.status).toBe(200);
  const codigo = r.data.codigo as string;
  const atribuicao = await atribuirResponsavelPrincipal(enviar, codigo, { responsavelPrincipal }, comoGestor);
  expect(atribuicao.status).toBe(204);
  return codigo;
}

async function criarAcaoComResponsavel(tratativa: string, responsavel: string): Promise<string> {
  const r = await criarAcao(enviar, tratativa, {
    descricao: `Descrição da Ação ${sufixoUnico()}`,
    prioridade: 'Alta',
    prazo: '2027-01-01',
    responsavel,
  }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

// Edita o título da Tratativa: evento Edicao direto na Tratativa (invisível ao Responsável de Ação,
// que não tem vínculo direto — nem Responsável Principal nem Participante).
async function gerarEventoInvisivel(tratativa: string, indice: number): Promise<void> {
  const r = await editar(enviar, tratativa, { titulo: `Invisível ${sufixoUnico()}-${indice}` }, comoGestor);
  expect(r.status).toBe(204);
}

// Edita o prazo da Ação do Responsável restrito, alternando entre dois valores válidos para sempre
// gerar diff (CONVENCOES.md #16: cada passo de preparo confere o status). Evento Edicao em
// HistoricoAcoes, visível ao Responsável daquela Ação exata.
async function gerarEventoVisivel(tratativa: string, acao: string, indice: number): Promise<void> {
  const prazo = indice % 2 === 0 ? '2027-02-01' : '2027-03-01';
  const r = await editarAcao(enviar, tratativa, { acao, prazo }, comoGestor);
  expect(r.status).toBe(204);
}

async function comoM1001Consulta(filtros: Record<string, unknown>) {
  return consultarHistoricoTratativa(consultar, filtros, comoM1001);
}

describe('Revisão do diff (Achado 1): paginação do histórico depois do filtro de autorização', () => {
  it('Responsável de UMA Ação navega pelas páginas só com os seus eventos, em ordem, sem itens invisíveis', async () => {
    const tratativa = await criarTratativaComResponsavelPrincipal('M2002');
    const acaoM1001 = await criarAcaoComResponsavel(tratativa, 'M1001');
    // Segunda Ação de outro responsável: mais eventos invisíveis ao M1001, da mesma forma que o
    // Achado 3 descreve (eventos de Ação de outro Responsável, não só diretos da Tratativa).
    const acaoM2002 = await criarAcaoComResponsavel(tratativa, 'M2002');

    // 6 eventos visíveis ao M1001 (Edicao na Ação dele), intercalados com 12 eventos invisíveis
    // (6 diretos da Tratativa + 6 na Ação do M2002), de forma que os primeiros registros globais da
    // Tratativa sejam majoritariamente invisíveis — reproduzindo exatamente o cenário do Achado 1.
    for (let i = 0; i < 6; i++) {
      fixarInstante(`2026-10-0${(i % 9) + 1}T08:00:00Z`);
      await gerarEventoInvisivel(tratativa, i);
      fixarInstante(`2026-10-0${(i % 9) + 1}T09:00:00Z`);
      await editarAcao(enviar, tratativa, { acao: acaoM2002, prazo: i % 2 === 0 ? '2027-04-01' : '2027-05-01' }, comoGestor)
        .then((r) => expect(r.status).toBe(204));
      fixarInstante(`2026-10-0${(i % 9) + 1}T10:00:00Z`);
      await gerarEventoVisivel(tratativa, acaoM1001, i);
    }
    liberarRelogio();

    // Confirma que a lista bruta (sem filtro de autorização) tem 18 eventos de edição além da
    // Criacao de Tratativa e das duas Ações: os primeiros registros globais, cronologicamente,
    // intercalam invisível/invisível/visível — nenhuma página de tamanho 3 cheia de "invisível"
    // apareceria para o Gestor, mas é exatamente o que o bug causa para o M1001.
    const comoGestorPagina1 = await consultarHistoricoTratativa(consultar, { tratativa, tamanhoPagina: 3, pagina: 1 }, comoGestor);
    expect(comoGestorPagina1.status).toBe(200);
    expect((comoGestorPagina1.data as Item[]).length).toBe(3);

    // (a) Página 1 do Responsável restrito (M1001) vem CHEIA (tamanhoPagina = 3) com os eventos
    // visíveis em ordem cronológica — não pode vir vazia nem com itens de fora da Ação dele.
    const pagina1 = await comoM1001Consulta({ tratativa, tamanhoPagina: 3, pagina: 1 });
    expect(pagina1.status).toBe(200);
    const itensP1 = pagina1.data as Item[];
    expect(itensP1.length).toBe(3);
    for (const item of itensP1) {
      expect(item.codigoAcao).toBe(acaoM1001);
      expect(item.tipoEvento).toBe('Edicao');
    }
    const quandoP1 = itensP1.map((i) => new Date(i.dataHora as string).getTime());
    expect(quandoP1).toEqual([...quandoP1].sort((a, b) => a - b));

    // (b) Página 2 traz os eventos visíveis seguintes (os outros 3 da Ação do M1001), também em ordem.
    const pagina2 = await comoM1001Consulta({ tratativa, tamanhoPagina: 3, pagina: 2 });
    expect(pagina2.status).toBe(200);
    const itensP2 = pagina2.data as Item[];
    expect(itensP2.length).toBe(3);
    for (const item of itensP2) {
      expect(item.codigoAcao).toBe(acaoM1001);
      expect(item.tipoEvento).toBe('Edicao');
    }
    const quandoP2 = itensP2.map((i) => new Date(i.dataHora as string).getTime());
    expect(quandoP2).toEqual([...quandoP2].sort((a, b) => a - b));

    // As duas páginas, juntas, cobrem exatamente os 6 eventos visíveis, sem repetição.
    const idsP1 = itensP1.map((i) => i.id);
    const idsP2 = itensP2.map((i) => i.id);
    expect(new Set([...idsP1, ...idsP2]).size).toBe(6);
    expect(Math.max(...quandoP1)).toBeLessThanOrEqual(Math.min(...quandoP2));

    // (c) Nenhum evento invisível (direto da Tratativa, ou da Ação do M2002) aparece em nenhuma página.
    for (const item of [...itensP1, ...itensP2]) {
      expect(item.codigoAcao).not.toBeNull();
      expect(item.codigoAcao).not.toBe(acaoM2002);
    }
  });
});
