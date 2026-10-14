import cds from '@sap/cds';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { comoUsuario } from './apoio/usuarios';

// Módulo puro da interface (decisão 8): extensaoDe, avisoDoArquivo, tipoParaEnvio e montarPedidoAnexo.
// Carregado de UMA forma só (design, r1 M3): vm.runInNewContext com um `sap.ui.define` de captura, sem navegador,
// sem sap.ui.require e sem cache de módulo. As `regras` vêm de GET regrasAnexoEvidencia() (sem lista copiada).
const { GET } = cds.test(__dirname + '/..');
const CAMINHO = join(__dirname, '..', 'app', 'tratativas', 'webapp', 'ext', 'acoes', 'pedidoAnexo.js');
const TAMANHO_MAXIMO = 10485760;

type Regras = { tamanhoMaximo: number; formatos: Array<{ extensao: string; tipos: string[] }> };
type Aviso = null | 'formato' | 'tamanho';
type Parametro = { name: string; value: unknown };
type Modulo = {
  extensaoDe(nome: string): string;
  avisoDoArquivo(arquivo: { nome: string; tamanho: number }, regras: Regras): Aviso;
  tipoParaEnvio(nome: string, tipoInformado: string, regras: Regras): string;
  montarPedidoAnexo(
    arquivo: { nome: string; tipo: string; conteudo?: string; descricao?: string },
    regras: Regras,
  ): Parametro[];
};

jest.setTimeout(60000);

function carregarModulo(): { modulo: Modulo; dependencias: unknown } {
  expect(existsSync(CAMINHO)).toBe(true);
  let modulo: Modulo | undefined;
  let dependencias: unknown;
  runInNewContext(readFileSync(CAMINHO, 'utf8'), {
    sap: {
      ui: {
        define: (deps: unknown, fabrica: () => Modulo) => {
          dependencias = deps;
          modulo = fabrica();
        },
      },
    },
  });
  expect(modulo).toBeDefined();
  return { modulo: modulo as Modulo, dependencias };
}

async function regrasDoServidor(): Promise<Regras> {
  const r = await GET('/api/app/v1/regrasAnexoEvidencia()', comoUsuario);
  expect(r.status).toBe(200);
  return r.data as Regras;
}

describe('pedidoAnexo.js: montagem do pedido de anexo (R13, R25, CA41)', () => {
  it('é puro: sap.ui.define sem dependências e sem uso de DOM nem de UI5', () => {
    const { modulo, dependencias } = carregarModulo();

    expect(dependencias).toEqual([]);
    expect(Object.keys(modulo).sort()).toEqual(
      ['avisoDoArquivo', 'extensaoDe', 'montarPedidoAnexo', 'tipoParaEnvio'].sort(),
    );
  });

  it('as regras do servidor trazem o limite de 10 MB e as extensões com ponto, em minúsculas', async () => {
    const regras = await regrasDoServidor();

    expect(regras.tamanhoMaximo).toBe(TAMANHO_MAXIMO);
    expect(regras.formatos.map((f) => f.extensao)).toEqual(
      expect.arrayContaining(['.jpg', '.jpeg', '.png', '.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.csv']),
    );
  });

  it('extensaoDe devolve a extensão em minúsculas, com o ponto, a partir do último ponto', () => {
    const { modulo } = carregarModulo();

    expect(modulo.extensaoDe('foto_local.png')).toBe('.png');
    expect(modulo.extensaoDe('FOTO.JPG')).toBe('.jpg');
    expect(modulo.extensaoDe('relatorio.final.PDF')).toBe('.pdf');
  });

  it('R13: avisa "formato" para .exe, "tamanho" para 10.485.761 bytes e nada para 10.485.760 bytes', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    expect(modulo.avisoDoArquivo({ nome: 'programa.exe', tamanho: 1000 }, regras)).toBe('formato');
    expect(modulo.avisoDoArquivo({ nome: 'arquivo', tamanho: 1000 }, regras)).toBe('formato');
    expect(modulo.avisoDoArquivo({ nome: 'grande.pdf', tamanho: 10485761 }, regras)).toBe('tamanho');
    expect(modulo.avisoDoArquivo({ nome: 'limite.pdf', tamanho: 10485760 }, regras)).toBeNull();
  });

  it('R13: nenhuma extensão devolvida pelo servidor gera aviso, nem em maiúsculas (a lista é a do servidor)', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    expect(regras.formatos.length).toBeGreaterThan(0);
    for (const formato of regras.formatos) {
      expect(modulo.avisoDoArquivo({ nome: `arquivo${formato.extensao}`, tamanho: 1 }, regras)).toBeNull();
      expect(modulo.avisoDoArquivo({ nome: `ARQUIVO${formato.extensao.toUpperCase()}`, tamanho: 1 }, regras)).toBeNull();
    }
  });

  it('CA41 a: .csv com Tipo vazio é completado com text/csv, e cada extensão aceita completa o primeiro Tipo do servidor', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    expect(modulo.tipoParaEnvio('dados.csv', '', regras)).toBe('text/csv');
    expect(modulo.tipoParaEnvio('doc.pdf', '', regras)).toBe('application/pdf');
    for (const formato of regras.formatos) {
      expect(modulo.tipoParaEnvio(`arquivo${formato.extensao}`, '', regras)).toBe(formato.tipos[0]);
    }
  });

  it('CA41 b: Tipo informado e divergente da extensão nunca é corrigido (.pdf declarado image/png segue image/png)', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    expect(modulo.tipoParaEnvio('a.pdf', 'image/png', regras)).toBe('image/png');
    expect(modulo.tipoParaEnvio('dados.csv', 'application/vnd.ms-excel', regras)).toBe('application/vnd.ms-excel');
    expect(modulo.tipoParaEnvio('dados.csv', 'application/octet-stream', regras)).toBe('application/octet-stream');
  });

  it('CA41 c: extensão fora da lista com Tipo vazio permanece vazia (o servidor recusa com 415)', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    expect(modulo.tipoParaEnvio('a.exe', '', regras)).toBe('');
    expect(modulo.tipoParaEnvio('semextensao', '', regras)).toBe('');
  });

  it('montarPedidoAnexo devolve os 4 parameterValues com o Nome sem sanitizar e a Descrição vazia como ""', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    const pedido = modulo.montarPedidoAnexo(
      { nome: 'dir\\subdir/../../foto.png', tipo: 'image/png', conteudo: 'QUJD', descricao: '' },
      regras,
    );

    expect(pedido).toHaveLength(4);
    expect(Object.fromEntries(pedido.map((p) => [p.name, p.value]))).toEqual({
      nomeArquivo: 'dir\\subdir/../../foto.png',
      mimeType: 'image/png',
      conteudo: 'QUJD',
      descricao: '',
    });
  });

  it('montarPedidoAnexo completa o Tipo vazio de um .csv e mantém a Descrição informada', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    const pedido = modulo.montarPedidoAnexo(
      { nome: 'dados.csv', tipo: '', conteudo: 'YSxi', descricao: 'Planilha do turno' },
      regras,
    );

    expect(Object.fromEntries(pedido.map((p) => [p.name, p.value]))).toEqual({
      nomeArquivo: 'dados.csv',
      mimeType: 'text/csv',
      conteudo: 'YSxi',
      descricao: 'Planilha do turno',
    });
  });

  it('r1 M2: conteúdo undefined (arquivo vazio, "data:" sem vírgula) vira "" e a Descrição ausente vira ""', async () => {
    const { modulo } = carregarModulo();
    const regras = await regrasDoServidor();

    const pedido = modulo.montarPedidoAnexo({ nome: 'vazio.txt', tipo: 'text/plain' }, regras);

    const valores = Object.fromEntries(pedido.map((p) => [p.name, p.value]));
    expect(pedido).toHaveLength(4);
    expect(valores.conteudo).toBe('');
    expect(valores.descricao).toBe('');
    expect(valores.mimeType).toBe('text/plain');
  });
});
