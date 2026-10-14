import { recusar } from './recusa';

interface Campo {
  rotulo: string;
  minimo?: number;
  maximo: number;
  obrigatorio?: boolean;
}

const CAMPOS_POR_FERRAMENTA: Record<string, Record<string, Campo>> = {
  '3W': {
    oQue: { rotulo: 'O que', minimo: 5, maximo: 500, obrigatorio: true },
    onde: { rotulo: 'Onde', minimo: 3, maximo: 200, obrigatorio: true },
    quando: { rotulo: 'Quando', minimo: 3, maximo: 200, obrigatorio: true },
  },
  '5 Porquês': {
    problema: { rotulo: 'Problema', minimo: 5, maximo: 500, obrigatorio: true },
    porque1: { rotulo: 'Porquê 1', minimo: 5, maximo: 500, obrigatorio: true },
    porque2: { rotulo: 'Porquê 2', maximo: 500 },
    porque3: { rotulo: 'Porquê 3', maximo: 500 },
    porque4: { rotulo: 'Porquê 4', maximo: 500 },
    porque5: { rotulo: 'Porquê 5', maximo: 500 },
    conclusao: { rotulo: 'Conclusão', minimo: 5, maximo: 1000, obrigatorio: true },
  },
  '5W2H': {
    oQue: { rotulo: 'O que', maximo: 500, obrigatorio: true },
    porQue: { rotulo: 'Por que', maximo: 500, obrigatorio: true },
    onde: { rotulo: 'Onde', maximo: 200, obrigatorio: true },
    quando: { rotulo: 'Quando', maximo: 200, obrigatorio: true },
    quem: { rotulo: 'Quem', maximo: 200, obrigatorio: true },
    como: { rotulo: 'Como', maximo: 500, obrigatorio: true },
    quantoCusta: { rotulo: 'Quanto custa', maximo: 200 },
  },
  'PDCA/8D': {
    planejar: { rotulo: 'Planejar', maximo: 2000, obrigatorio: true },
    executar: { rotulo: 'Executar', maximo: 2000, obrigatorio: true },
    checar: { rotulo: 'Checar', maximo: 2000, obrigatorio: true },
    agir: { rotulo: 'Agir', maximo: 2000, obrigatorio: true },
  },
};

const CATEGORIAS = [
  'Método/Processo',
  'Máquina/Equipamento',
  'Material/Insumo',
  'Mão de Obra/Comportamental',
  'Meio Ambiente/Instalação',
  'Gestão/Planejamento',
];

export function ferramentaHomologada(valor: string): boolean {
  return Object.hasOwn(CAMPOS_POR_FERRAMENTA, valor);
}

export function validarFerramentaMetodologia(valor: unknown): string {
  if (typeof valor !== 'string' || !Object.hasOwn(CAMPOS_POR_FERRAMENTA, valor)) {
    recusar(400, 'Ferramenta de metodologia inválida.', 'ferramenta');
  }
  return valor as string;
}

export function validarCategoriaCausaRaiz(valor: unknown): string | null {
  if (valor == null) return null;
  const texto = typeof valor === 'string' ? valor.trim() : valor;
  if (texto === '') return null;
  if (typeof texto !== 'string' || !CATEGORIAS.includes(texto)) {
    recusar(400, 'Categoria de causa raiz inválida.', 'categoriaCausaRaiz');
  }
  return texto;
}

export function rotuloCausaMetodologia(ferramenta: string, identificador: string): string {
  const campo = Object.hasOwn(CAMPOS_POR_FERRAMENTA, ferramenta)
    ? CAMPOS_POR_FERRAMENTA[ferramenta][identificador]
    : undefined;
  return campo ? `${ferramenta} — ${campo.rotulo}` : `${ferramenta} — ${identificador}`;
}

export function validarDadosMetodologia(ferramenta: string, valor: unknown): Record<string, string> {
  let dados: unknown = valor;
  if (typeof valor === 'string') {
    try {
      dados = JSON.parse(valor) as unknown;
    } catch {
      recusar(400, 'Dados da metodologia inválidos.', 'dados');
    }
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    recusar(400, 'Dados da metodologia inválidos.', 'dados');
  }

  const enviados = dados as Record<string, unknown>;
  const campos = CAMPOS_POR_FERRAMENTA[ferramenta];
  for (const chave of Object.keys(enviados)) {
    if (!Object.hasOwn(campos, chave)) recusar(400, 'O campo Dados contém uma chave não reconhecida.', 'dados');
  }

  const resultado: Record<string, string> = {};
  for (const [chave, definicao] of Object.entries(campos)) {
    const enviado = enviados[chave];
    if (enviado == null && !definicao.obrigatorio) continue;
    if (typeof enviado !== 'string') {
      recusar(400, `O campo ${definicao.rotulo} é obrigatório.`, chave);
    }
    const texto = (enviado as string).trim();
    if (!texto && !definicao.obrigatorio) continue;
    if (!texto) recusar(400, `O campo ${definicao.rotulo} é obrigatório.`, chave);
    if (definicao.minimo !== undefined && texto.length < definicao.minimo) {
      recusar(400, `O campo ${definicao.rotulo} aceita de ${definicao.minimo} a ${definicao.maximo} caracteres.`, chave);
    }
    if (texto.length > definicao.maximo) {
      recusar(400, `O campo ${definicao.rotulo} aceita no máximo ${definicao.maximo} caracteres.`, chave);
    }
    resultado[chave] = texto;
  }
  return resultado;
}
