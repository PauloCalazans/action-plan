import cds from '@sap/cds';
import type { DadosAbertura } from './abertura';

const TIPO_CRITICIDADE = 'br.com.calazanstec.Criticidade';

const ausente = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim() === '');

function recusar(target: string, message: string): never {
  throw Object.assign(new Error(message), { status: 400, code: 400, target });
}

/** R7: valores válidos vêm do tipo `Criticidade` do modelo (valor persistido de cada item do enum). */
function criticidadesValidas(): string[] {
  const def = cds.model?.definitions?.[TIPO_CRITICIDADE] as { enum?: Record<string, { val?: string }> } | undefined;
  return Object.entries(def?.enum ?? {}).map(([nome, item]) => item?.val ?? nome);
}

/**
 * Valida a abertura (design, decisão 6). Lança erro 400 com `target` e mensagem que nomeia o campo.
 * Ordem: titulo, criticidade ausente, criticidade inválida, origem, idOrigem.
 */
export function validarAbertura(dados: DadosAbertura, exigeOrigem: boolean): void {
  if (ausente(dados.titulo)) recusar('titulo', 'O campo Título é obrigatório.');
  if (ausente(dados.criticidade)) recusar('criticidade', 'O campo Criticidade é obrigatório.');
  if (typeof dados.criticidade !== 'string' || !criticidadesValidas().includes(dados.criticidade)) {
    recusar('criticidade', 'Criticidade inválida: use Baixa, Média, Alta ou Crítica.');
  }
  if (exigeOrigem) {
    if (ausente(dados.origem)) recusar('origem', 'O campo Origem é obrigatório.');
    if (ausente(dados.idOrigem)) recusar('idOrigem', 'O campo ID_Origem é obrigatório.');
  } else if (!ausente(dados.origem) || !ausente(dados.idOrigem)) {
    recusar('origem', 'Origem e ID_Origem só podem ser informados pelo aplicativo de origem.');
  }
}
