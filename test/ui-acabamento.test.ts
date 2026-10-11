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
const PACOTE = join(RAIZ, 'package.json');
const DEPCRUISER = join(RAIZ, '.dependency-cruiser.cjs');

jest.setTimeout(60000);

beforeEach(() => fixarInstante('2026-10-26T12:00:00-03:00'));
afterEach(liberarRelogio);

type Erro = { error?: { message?: string; target?: string } };

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
