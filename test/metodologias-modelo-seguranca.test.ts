import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { consultarHistoricoTratativa, type Consulta } from './apoio/historico';
import { criarAvulsa, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor } from './apoio/usuarios';

const RAIZ = join(__dirname, '..');
const NAMESPACE = 'br.com.calazanstec';
const { GET, POST } = cds.test(__dirname + '/..');
const consultar = GET as unknown as Consulta;
const enviar = POST as unknown as Envia;

type ElementoCSN = {
  type?: string;
  default?: { val?: unknown };
  '@PersonalData.IsPotentiallyPersonal'?: boolean;
  '@assert.range'?: number[];
};

type DefinicaoCSN = {
  enum?: Record<string, { val?: string }>;
  elements?: Record<string, ElementoCSN>;
};

type ModeloCSN = { definitions?: Record<string, DefinicaoCSN> };

type PapelMockado = { roles?: string[] };
type ConfiguracaoAuth = { kind?: string; users?: Record<string, PapelMockado> };
type ConfiguracaoProjeto = {
  cds?: { requires?: { auth?: Record<string, ConfiguracaoAuth> } };
};

let definicoes: Record<string, DefinicaoCSN>;

beforeAll(async () => {
  const modelo = (await cds.load('db')) as unknown as ModeloCSN;
  definicoes = modelo.definitions ?? {};
});

function valoresEnum(nome: string): string[] {
  const valores = definicoes[`${NAMESPACE}.${nome}`]?.enum ?? {};
  return Object.entries(valores).map(([chave, definicao]) => definicao.val ?? chave);
}

function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(caminho, 'utf8')) as T;
}

describe('modelo persistido e papel Validador Técnico (016)', () => {
  it('declara os tipos e eventos novos no CSN do modelo', () => {
    expect(valoresEnum('FerramentaMetodologia')).toEqual([
      '3W',
      '5 Porquês',
      '5W2H',
      'PDCA/8D',
    ]);
    expect(valoresEnum('MacrocausaCausaRaiz')).toEqual([
      'Método/Processo',
      'Máquina/Equipamento',
      'Material/Insumo',
      'Mão de Obra/Comportamental',
      'Meio Ambiente/Instalação',
      'Gestão/Planejamento',
    ]);
    expect(valoresEnum('ParecerAvalTecnico')).toEqual(['Aprovado', 'Reprovado']);
    expect(valoresEnum('EventoHistorico')).toEqual(
      expect.arrayContaining([
        'DefinicaoMetodologia',
        'EdicaoMetodologia',
        'EmissaoAvalTecnico',
      ]),
    );
    expect(valoresEnum('EventoHistoricoAcao')).toContain('CriacaoAcaoComCausa');
    expect(valoresEnum('EntidadeAlerta')).toContain('VerificacaoEficacia');
  });

  it('persiste as novas colunas com tipos e marcação de dado potencialmente pessoal', () => {
    const tratativas = definicoes[`${NAMESPACE}.Tratativas`]?.elements ?? {};
    const acoes = definicoes[`${NAMESPACE}.Acoes`]?.elements ?? {};
    const avales = definicoes[`${NAMESPACE}.AvalesTecnicos`]?.elements ?? {};
    const validadores = definicoes[`${NAMESPACE}.ValidadoresOrigem`]?.elements ?? {};
    const historico = definicoes[`${NAMESPACE}.HistoricoTratativa`]?.elements ?? {};

    expect(tratativas.metodologia?.type).toBe(`${NAMESPACE}.FerramentaMetodologia`);
    expect(tratativas.categoriaCausaRaiz?.type).toBe(`${NAMESPACE}.MacrocausaCausaRaiz`);
    expect(tratativas.metodologiaData?.['@PersonalData.IsPotentiallyPersonal']).toBe(true);
    expect(tratativas.metodologiaAutor?.['@PersonalData.IsPotentiallyPersonal']).toBe(true);
    expect(acoes.causaIdentificador).toBeDefined();
    expect(acoes.causaDescricao?.['@PersonalData.IsPotentiallyPersonal']).toBe(true);
    expect(avales.fundamentacao?.['@PersonalData.IsPotentiallyPersonal']).toBe(true);
    expect(avales.validador?.['@PersonalData.IsPotentiallyPersonal']).toBe(true);
    expect(validadores.matricula?.['@PersonalData.IsPotentiallyPersonal']).toBe(true);
    expect(historico.avalTecnico?.type).toBe('cds.UUID');
  });

  it('define o prazo de eficácia parametrizado com faixa de 1 a 180 dias e default 30', () => {
    const prazo =
      definicoes[`${NAMESPACE}.ParametrosOrigem`]?.elements?.prazoVerificacaoEficaciaDias;

    expect(prazo?.['@assert.range']).toEqual([1, 180]);
    expect(prazo?.default?.val).toBe(30);
  });

  it('fornece a linha baseline * no CSV sem amarrar a parametrização a um departamento', () => {
    const caminho = join(RAIZ, 'db', 'data', 'br.com.calazanstec-ParametrosOrigem.csv');
    expect(existsSync(caminho)).toBe(true);
    const linhas = readFileSync(caminho, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((linha) => linha.split(';'));

    expect(linhas[0]).toEqual([
      'origemNormalizada',
      'origem',
      'validadorPadrao',
      'prazoVerificacaoEficaciaDias',
    ]);
    expect(linhas[1]).toEqual(['*', 'Padrão global', 'Validador Técnico', '30']);
    expect(linhas[1].join(';')).not.toMatch(/SESMT|Qualidade|RH|Compliance/);
  });

  it('declara escopo, role template e role collection ValidadorTecnico no XSUAA', () => {
    type Referencia = {
      name: string;
      'scope-references'?: string[];
      'role-template-references'?: string[];
    };
    type Seguranca = {
      scopes?: Referencia[];
      'role-templates'?: Referencia[];
      'role-collections'?: Referencia[];
    };
    const seguranca = lerJson<Seguranca>(join(RAIZ, 'xs-security.json'));
    const escopo = seguranca.scopes?.find((item) => item.name === '$XSAPPNAME.ValidadorTecnico');
    const template = seguranca['role-templates']?.find((item) => item.name === 'ValidadorTecnico');
    const colecao = seguranca['role-collections']?.find(
      (item) => item.name === 'ActionPlan_ValidadorTecnico',
    );

    expect(escopo).toBeDefined();
    expect(template?.['scope-references']).toContain('$XSAPPNAME.ValidadorTecnico');
    expect(colecao?.['role-template-references']).toContain('$XSAPPNAME.ValidadorTecnico');
    expect(JSON.stringify(seguranca)).not.toMatch(/SESMT|Qualidade|RH|Compliance/);
  });

  it('atribui ValidadorTecnico aos usuários validador e validador-b nos perfis não produtivos', () => {
    const pacote = lerJson<ConfiguracaoProjeto>(join(RAIZ, 'package.json'));
    const auth = pacote.cds?.requires?.auth ?? {};

    for (const perfil of ['[test]', '[papeis]']) {
      for (const nome of ['validador', 'validador-b']) {
        expect(auth[perfil]?.users?.[nome]?.roles ?? []).toContain('ValidadorTecnico');
      }
    }
    expect(auth['[production]']?.users).toBeUndefined();
  });

  it('injeta o papel ValidadorTecnico no middleware de desenvolvimento', async () => {
    const caminho = join(RAIZ, 'test', 'apoio', 'auth-dev.js');
    const carregado = (await import(caminho)) as unknown;
    const middleware = (typeof carregado === 'function'
      ? carregado
      : (carregado as { default?: unknown }).default) as (
      req: { user?: { id?: string; is: (papel: string) => boolean } },
      res: unknown,
      next: (erro?: unknown) => void,
    ) => void;
    const anteriorDev = process.env.DEV_USER;
    const anteriorCds = process.env.CDS_DEV_USER;

    try {
      process.env.DEV_USER = 'validador';
      delete process.env.CDS_DEV_USER;
      const req: { user?: { id?: string; is: (papel: string) => boolean } } = {};
      let seguiu = false;
      middleware(req, {}, () => {
        seguiu = true;
      });

      expect(seguiu).toBe(true);
      expect(req.user?.id).toBe('validador');
      expect(req.user?.is('ValidadorTecnico')).toBe(true);
    } finally {
      if (anteriorDev === undefined) delete process.env.DEV_USER;
      else process.env.DEV_USER = anteriorDev;
      if (anteriorCds === undefined) delete process.env.CDS_DEV_USER;
      else process.env.CDS_DEV_USER = anteriorCds;
    }
  });

  it('aceita os quatro novos tipos de evento pela consulta OData do histórico', async () => {
    const criada = await criarAvulsa(enviar, { titulo: `Tratativa ${sufixoUnico()}` });
    expect(criada.status).toBe(200);
    const tratativa = criada.data.codigo as string;

    for (const tipoEvento of [
      'EmissaoAvalTecnico',
      'DefinicaoMetodologia',
      'EdicaoMetodologia',
      'CriacaoAcaoComCausa',
    ]) {
      const resposta = await consultarHistoricoTratativa(
        consultar,
        { tratativa, tipoEvento },
        comoGestor,
      );

      expect(resposta.status).toBe(200);
    }
  });
});
