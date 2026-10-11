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
async function novaTratativa(): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Tratativa ${sufixoUnico()}`, criticidade: 'Alta' });
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
