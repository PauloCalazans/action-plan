import { prioridadesValidas } from '../tratativa/dominios';
import { recusar } from '../tratativa/recusa';

/** R1-R2 (spec templates-de-acoes): item de entrada de template, antes da validação. */
export interface ItemTemplateEntrada {
  ordem?: number;
  descricao?: string;
  prioridade?: string;
  evidenciaObrigatoria?: boolean;
  prazoRelativoDias?: number;
  ordemPai?: number | null;
}

/** Item já validado e normalizado, pronto para persistência. */
export interface ItemTemplateValidado {
  ordem: number;
  descricao: string;
  prioridade: string;
  evidenciaObrigatoria: boolean;
  prazoRelativoDias: number;
  ordemPai: number | null;
}

/** Cabeçalho validado e normalizado do template, pronto para persistência. */
export interface CabecalhoTemplateValidado {
  nome: string;
  descricao: string | null;
}

const ausente = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim() === '');

/** R3, R15(b) (spec templates-de-acoes): nome obrigatório, 1 a 100 caracteres após trim. */
export function validarNome(nome: unknown): string {
  if (ausente(nome)) recusar(400, 'O campo Nome do template é obrigatório.', 'nome');
  const valor = String(nome).trim();
  if (valor.length > 100) recusar(400, 'O campo Nome do template aceita no máximo 100 caracteres.', 'nome');
  return valor;
}

/** R1, R15(b) (spec templates-de-acoes): descrição opcional até 500 caracteres; vazia/espaços vira null. */
export function validarDescricaoTemplate(descricao: unknown): string | null {
  if (ausente(descricao)) return null;
  const valor = String(descricao).trim();
  if (valor.length > 500) recusar(400, 'O campo Descrição do template aceita no máximo 500 caracteres.', 'descricao');
  return valor;
}

/** R1, R2, R15(b) (spec templates-de-acoes): valida cabeçalho (nome + descrição). */
export function validarCabecalho(nome: unknown, descricao: unknown): CabecalhoTemplateValidado {
  return { nome: validarNome(nome), descricao: validarDescricaoTemplate(descricao) };
}

function validarDescricaoItem(descricao: unknown): string {
  const valor = ausente(descricao) ? '' : String(descricao).trim();
  if (valor.length < 1 || valor.length > 500) {
    recusar(400, 'O campo Descrição da ação aceita no máximo 500 caracteres.', 'itens');
  }
  return valor;
}

function validarPrioridadeItem(prioridade: unknown): string {
  const valor = ausente(prioridade) ? 'Média' : String(prioridade);
  if (!prioridadesValidas().includes(valor)) {
    recusar(400, 'Prioridade inválida.', 'itens');
  }
  return valor;
}

function validarPrazoRelativo(prazo: unknown): number {
  const valor = Number(prazo);
  if (!Number.isInteger(valor) || valor < 1 || valor > 365) {
    recusar(400, 'O prazo relativo deve ser de 1 a 365 dias.', 'prazoRelativoDias');
  }
  return valor;
}

/**
 * R1, R2, R15(b) (spec templates-de-acoes): valida a lista de itens do template.
 * Ordem de verificação: quantidade -> ordens (faixa/duplicidade) -> hierarquia -> campos de cada item.
 */
export function validarItens(itens: unknown): ItemTemplateValidado[] {
  if (!Array.isArray(itens) || itens.length === 0) {
    recusar(400, 'O template deve conter pelo menos um item.', 'itens');
  }
  if (itens.length > 30) {
    recusar(400, 'O template aceita no máximo 30 itens.', 'itens');
  }

  const entrada = itens as ItemTemplateEntrada[];

  // Ordens: inteiro de 1 a 30, sem duplicidade.
  const ordens = entrada.map((i) => Number(i.ordem));
  const ordensUnicas = new Set<number>();
  for (const ordem of ordens) {
    if (!Number.isInteger(ordem) || ordem < 1 || ordem > 30 || ordensUnicas.has(ordem)) {
      recusar(400, 'Ordem dos itens inválida.', 'itens');
    }
    ordensUnicas.add(ordem);
  }

  // Hierarquia: ordemPai null (primeiro nível) ou referência válida a item de primeiro nível existente.
  const ordemParaOrdemPai = new Map<number, number | null>();
  entrada.forEach((i, idx) => {
    const ordemPaiBruto = i.ordemPai;
    const ordemPai = ordemPaiBruto === undefined || ordemPaiBruto === null ? null : Number(ordemPaiBruto);
    ordemParaOrdemPai.set(ordens[idx], ordemPai);
  });

  for (const [ordem, ordemPai] of ordemParaOrdemPai) {
    if (ordemPai === null) continue;
    if (ordemPai === ordem || !ordensUnicas.has(ordemPai)) {
      recusar(400, 'Ordem dos itens inválida.', 'itens');
    }
    // O item referenciado (ordemPai) não pode já ser um subitem (ter o seu próprio ordemPai preenchido).
    if (ordemParaOrdemPai.get(ordemPai) !== null) {
      recusar(400, 'Uma Subação não pode ter Subações.', 'itens');
    }
  }

  // Campos de cada item: descrição, prioridade, prazo relativo.
  return entrada.map((i, idx) => ({
    ordem: ordens[idx],
    descricao: validarDescricaoItem(i.descricao),
    prioridade: validarPrioridadeItem(i.prioridade),
    evidenciaObrigatoria: i.evidenciaObrigatoria === true,
    prazoRelativoDias: validarPrazoRelativo(i.prazoRelativoDias),
    ordemPai: ordemParaOrdemPai.get(ordens[idx]) ?? null,
  }));
}
