import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { comoGestor, comoM1001, comoUsuario, semAuth } from './apoio/usuarios';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { criarAcao, criarSubacao } from './apoio/acoes';
import { atribuirResponsavelPrincipal, incluirParticipante } from './apoio/responsaveis';

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const BASE = '/api/app/v1';
const RAIZ = join(__dirname, '..');
const ANOTACOES = join(RAIZ, 'app', 'minhas-pendencias', 'annotations.cds');
const MANIFESTO = join(RAIZ, 'app', 'minhas-pendencias', 'webapp', 'manifest.json');
const I18N = join(RAIZ, 'app', 'minhas-pendencias', 'webapp', 'i18n', 'i18n.properties');
const XS_APP = join(RAIZ, 'app', 'minhas-pendencias', 'xs-app.json');
const PRAZO = '2027-01-01';

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

// Setup pela API transacional (helpers): cria a Tratativa avulsa e devolve o Código.
async function novaTratativa(criticidade = 'Alta'): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Tratativa ${sufixoUnico()}`, criticidade });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function novaAcao(tratativa: string, responsavel: string): Promise<string> {
  const r = await criarAcao(enviar, tratativa, {
    descricao: `Ação ${sufixoUnico()}`,
    responsavel,
    prazo: PRAZO,
    prioridade: 'Alta',
  }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

describe('Minhas Pendências: visão pessoal do colaborador', () => {
  it('CA2: identidade corporativa M1001 executa as consultas sem tela de login', async () => {
    // Sem token não há acesso: a autenticação é delegada ao Launchpad (XSUAA), não à aplicação.
    const semToken = await GET(`${BASE}/MinhasAcoes`, semAuth);
    expect(semToken.status).toBe(401);

    // Com o token do colaborador (matrícula M1001) as consultas OData executam.
    const acoes = await GET(`${BASE}/MinhasAcoes`, comoM1001);
    const tratativas = await GET(`${BASE}/MinhasTratativas`, comoM1001);
    expect(acoes.status).toBe(200);
    expect(tratativas.status).toBe(200);

    const xsApp = JSON.parse(textoDo(XS_APP)) as {
      authenticationMethod?: string;
      routes?: { authenticationType?: string }[];
    };
    expect(xsApp.authenticationMethod).toBe('route');
    expect(xsApp.routes?.some((rota) => rota.authenticationType === 'xsuaa')).toBe(true);
  });

  it('CA13: a aba Minhas Ações lista apenas Ações e Subações da matrícula M1001', async () => {
    const tratativa = await novaTratativa();
    await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor);

    const minhaAcao = await novaAcao(tratativa, 'M1001');
    const subacao = await criarSubacao(enviar, tratativa, {
      acaoMae: minhaAcao,
      descricao: `Subação ${sufixoUnico()}`,
      responsavel: 'M1001',
      prazo: PRAZO,
      prioridade: 'Média',
    }, comoGestor);
    expect(subacao.status).toBe(200);
    const acaoAlheia = await novaAcao(tratativa, 'M2002');

    const r = await GET(`${BASE}/MinhasAcoes`, comoM1001);
    expect(r.status).toBe(200);

    const codigosDeAcao = itens(r.data).map((linha) => linha.codigoAcao);
    expect(codigosDeAcao).toContain(minhaAcao);
    expect(codigosDeAcao).toContain(subacao.data.codigo);
    expect(codigosDeAcao).not.toContain(acaoAlheia);

    const anotacoes = textoDo(ANOTACOES);
    expect(anotacoes).toContain('annotate TratativaAppService.MinhasAcoes');
    expect(anotacoes).toContain('Value: codigoAcao');
    expect(anotacoes).toContain('Value: statusAcao');
  });

  it('CA14: Iniciar na linha da Ação leva o Status da Ação a Em andamento', async () => {
    const tratativa = await novaTratativa();
    await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor);
    const acao = await novaAcao(tratativa, 'M1001');

    const inicio = await POST(`${BASE}/MinhasAcoes(${acao})/iniciar`, {}, comoM1001);
    expect(inicio.status).toBe(204);

    const r = await GET(`${BASE}/MinhasAcoes`, comoM1001);
    expect(r.status).toBe(200);
    const item = itens(r.data).find((linha) => linha.codigoAcao === acao);
    expect(item).toBeDefined();
    expect(item?.statusAcao).toBe('Em andamento');

    const anotacoes = textoDo(ANOTACOES);
    expect(anotacoes).toContain("Action: 'TratativaAppService.iniciar'");
    expect(anotacoes).toContain("Action: 'TratativaAppService.concluir'");
  });

  it('CA15: a aba Minhas Tratativas indica o papel do colaborador (Responsável Principal ou Participante)', async () => {
    const comoResponsavel = await novaTratativa();
    await atribuirResponsavelPrincipal(enviar, comoResponsavel, { responsavelPrincipal: 'M1001' }, comoGestor);

    const comoParticipante = await novaTratativa();
    await atribuirResponsavelPrincipal(enviar, comoParticipante, { responsavelPrincipal: 'M2002' }, comoGestor);
    const inclusao = await incluirParticipante(enviar, comoParticipante, { participante: 'M1001' }, comoGestor);
    expect(inclusao.status).toBe(204);

    const alheia = await novaTratativa();
    await atribuirResponsavelPrincipal(enviar, alheia, { responsavelPrincipal: 'M2002' }, comoGestor);

    const r = await GET(`${BASE}/MinhasTratativas`, comoM1001);
    expect(r.status).toBe(200);

    const porCodigo = new Map(itens(r.data).map((linha) => [linha.codigoTratativa as string, linha]));
    expect(porCodigo.get(comoResponsavel)?.meuPapel).toBe('Responsável Principal');
    expect(porCodigo.get(comoParticipante)?.meuPapel).toBe('Participante');
    expect(porCodigo.has(alheia)).toBe(false);

    const anotacoes = textoDo(ANOTACOES);
    expect(anotacoes).toContain('annotate TratativaAppService.MinhasTratativas');
    expect(anotacoes).toContain('Value: meuPapel');
  });

  it('CA13 (Achado 2): MinhasAcoes respeita $filter, $top/$skip, $orderby e $count no escopo de M1001', async () => {
    const tratativa = await novaTratativa();
    await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor);

    // 55 Ações de M1001 na mesma Tratativa (a 2ª página do corte padrão de 50 precisa existir) + 1 de M2002.
    const minhas: string[] = [];
    for (let i = 0; i < 55; i += 1) {
      const r = await criarAcao(enviar, tratativa, {
        descricao: `Ação ${sufixoUnico()}`,
        responsavel: 'M1001',
        prazo: i === 0 ? '2027-12-31' : '2027-01-01',
        prioridade: 'Alta',
      }, comoGestor);
      expect(r.status).toBe(200);
      minhas.push(r.data.codigo as string);
    }
    await novaAcao(tratativa, 'M2002');
    const inicio = await POST(`${BASE}/MinhasAcoes(${minhas[0]})/iniciar`, {}, comoM1001);
    expect(inicio.status).toBe(204);

    const escopo = `codigoTratativa eq '${tratativa}'`;
    const filtro = `$filter=${encodeURIComponent(escopo)}`;

    // $count + corte padrão de 50: só as 55 de M1001 (a de M2002 não conta).
    const contado = await GET(`${BASE}/MinhasAcoes?${filtro}&$count=true`, comoM1001);
    expect(contado.status).toBe(200);
    expect(itens(contado.data)).toHaveLength(50);
    expect((contado.data as Record<string, unknown>)['@odata.count']).toBe(55);

    // $filter por status.
    const porStatus = await GET(
      `${BASE}/MinhasAcoes?$filter=${encodeURIComponent(`${escopo} and statusAcao eq 'Em andamento'`)}`,
      comoM1001,
    );
    expect(porStatus.status).toBe(200);
    expect(itens(porStatus.data).map((linha) => linha.codigoAcao)).toEqual([minhas[0]]);

    // $top/$skip: a 2ª página existe.
    const segunda = await GET(`${BASE}/MinhasAcoes?${filtro}&$top=50&$skip=50`, comoM1001);
    expect(segunda.status).toBe(200);
    expect(itens(segunda.data)).toHaveLength(5);

    // $orderby.
    const ordenado = await GET(`${BASE}/MinhasAcoes?${filtro}&$orderby=${encodeURIComponent('prazo desc')}&$top=1`, comoM1001);
    expect(ordenado.status).toBe(200);
    expect(itens(ordenado.data)[0]?.prazo).toBe('2027-12-31');
  });

  it('CA15 (Achado 2): MinhasTratativas respeita $filter, $top/$skip, $orderby e $count no escopo de M1001', async () => {
    const baixa = await novaTratativa('Baixa');
    const media = await novaTratativa('Média');
    const alta = await novaTratativa('Alta');
    for (const t of [baixa, media, alta]) {
      expect((await atribuirResponsavelPrincipal(enviar, t, { responsavelPrincipal: 'M1001' }, comoGestor)).status).toBe(204);
    }
    const alheia = await novaTratativa('Alta');
    expect((await atribuirResponsavelPrincipal(enviar, alheia, { responsavelPrincipal: 'M2002' }, comoGestor)).status).toBe(204);

    const escopo = [baixa, media, alta].map((t) => `codigoTratativa eq '${t}'`).join(' or ');
    const filtro = `$filter=${encodeURIComponent(escopo)}`;
    const asc = `$orderby=${encodeURIComponent('dataPrevistaConclusao asc')}`;

    const contado = await GET(`${BASE}/MinhasTratativas?${filtro}&$count=true`, comoM1001);
    expect(contado.status).toBe(200);
    expect(itens(contado.data)).toHaveLength(3);
    expect((contado.data as Record<string, unknown>)['@odata.count']).toBe(3);

    // Escopo por usuário: a Tratativa de outra pessoa não aparece para M1001.
    const soAlheia = await GET(`${BASE}/MinhasTratativas?$filter=${encodeURIComponent(`codigoTratativa eq '${alheia}'`)}&$count=true`, comoM1001);
    expect(soAlheia.status).toBe(200);
    expect((soAlheia.data as Record<string, unknown>)['@odata.count']).toBe(0);

    // $top/$skip.
    const pagina1 = await GET(`${BASE}/MinhasTratativas?${filtro}&${asc}&$top=2`, comoM1001);
    expect(pagina1.status).toBe(200);
    expect(itens(pagina1.data)).toHaveLength(2);
    const pagina2 = await GET(`${BASE}/MinhasTratativas?${filtro}&${asc}&$top=2&$skip=2`, comoM1001);
    expect(pagina2.status).toBe(200);
    expect(itens(pagina2.data)).toHaveLength(1);

    // $orderby: a de maior Data prevista (criticidade Baixa) vem por último em asc e primeira em desc.
    const maior = await GET(
      `${BASE}/MinhasTratativas?${filtro}&$orderby=${encodeURIComponent('dataPrevistaConclusao desc')}&$top=1`,
      comoM1001,
    );
    expect(maior.status).toBe(200);
    expect(itens(maior.data)[0]?.codigoTratativa).toBe(baixa);
  });

  it('CA25: a visão pessoal usa textos em pt-BR a partir do i18n.properties', () => {
    const textos = textoDo(I18N);
    expect(textos).toMatch(/Minhas Pendências/);
    expect(textos).toMatch(/[áàâãéêíóôõúç]/i);

    const interfaceDaTela = [textoDo(ANOTACOES), textos, textoDo(MANIFESTO)].join('\n');
    expect(interfaceDaTela).toContain('Minhas Ações');
    expect(interfaceDaTela).toContain('Minhas Tratativas');
  });

  it('CA26: a visão pessoal usa o floorplan Fiori elements nativo, operável por teclado', () => {
    const manifesto = JSON.parse(textoDo(MANIFESTO)) as Record<string, unknown>;
    const serializado = JSON.stringify(manifesto);

    expect(serializado).toContain('sap.fe.templates');
    expect(serializado).toContain('ListReport');
    expect(serializado).toContain('MinhasAcoes');
    expect(serializado).toContain('MinhasTratativas');
  });

  it('CA27 e CA27a: anotações e manifesto válidos em execução OData headless', async () => {
    const metadados = await GET(`${BASE}/$metadata`, comoUsuario);

    expect(metadados.status).toBe(200);
    expect(String(metadados.data)).toContain('MinhasAcoes');
    for (const arquivo of [ANOTACOES, MANIFESTO, XS_APP]) {
      expect(existsSync(arquivo)).toBe(true);
    }
    expect(() => JSON.parse(textoDo(MANIFESTO)) as unknown).not.toThrow();
    expect(() => JSON.parse(textoDo(XS_APP)) as unknown).not.toThrow();
    expect(textoDo(ANOTACOES)).toContain('annotate TratativaAppService.MinhasAcoes');
    expect(textoDo(ANOTACOES)).toContain('annotate TratativaAppService.MinhasTratativas');
  });
});
