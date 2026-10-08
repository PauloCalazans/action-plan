import { prioridadesValidas } from './dominios';
import { recusar } from './recusa';

const MAX_DESCRICAO = 500;
const MAX_RESPONSAVEL = 50;
const PRIORIDADE_PADRAO = 'Média';
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

const ausente = (valor: unknown): boolean => typeof valor !== 'string' || valor.trim() === '';

/** Data civil AAAA-MM-DD real (rejeita 2026-02-30). */
function dataCivilValida(texto: string): boolean {
  if (!FORMATO_DATA.test(texto)) return false;
  const [ano, mes, dia] = texto.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/** R1 (004): Descrição obrigatória, sem ser só espaços, até 500 caracteres. */
export function validarDescricao(valor: unknown): string {
  if (ausente(valor)) recusar(400, 'O campo Descrição é obrigatório.', 'descricao');
  const descricao = valor as string;
  if (descricao.length > MAX_DESCRICAO) {
    recusar(400, `O campo Descrição aceita no máximo ${MAX_DESCRICAO} caracteres.`, 'descricao');
  }
  return descricao;
}

/** R3 (004): Responsável obrigatório na criação, até 50 caracteres. */
export function validarResponsavel(valor: unknown): string {
  if (ausente(valor)) recusar(400, 'O campo Responsável é obrigatório.', 'responsavel');
  const responsavel = valor as string;
  if (responsavel.length > MAX_RESPONSAVEL) {
    recusar(400, `O campo Responsável aceita no máximo ${MAX_RESPONSAVEL} caracteres.`, 'responsavel');
  }
  return responsavel;
}

/** R21 (004): Prazo em AAAA-MM-DD, real e não anterior à data civil de hoje. */
export function validarPrazo(valor: unknown, hoje: string): string {
  if (ausente(valor)) recusar(400, 'O campo Prazo é obrigatório.', 'prazo');
  const prazo = valor as string;
  if (!dataCivilValida(prazo)) recusar(400, 'Prazo inválido: use o formato AAAA-MM-DD.', 'prazo');
  if (prazo < hoje) recusar(400, 'Prazo não pode ser anterior a hoje.', 'prazo');
  return prazo;
}

/** R4 (004): Prioridade exata (sem normalizar "Media"); null assume Média; "" ou só espaços é recusado. */
export function validarPrioridade(valor: unknown): string {
  if (valor == null) return PRIORIDADE_PADRAO;
  if (typeof valor !== 'string' || !prioridadesValidas().includes(valor)) {
    recusar(400, 'Prioridade inválida: use Baixa, Média ou Alta.', 'prioridade');
  }
  return valor;
}

/** R14 (004): "sim" ou "não" (sem diferenciar caixa e após trim); null assume "não" (false); outro valor é recusado. */
export function validarEvidenciaObrigatoria(valor: unknown): boolean {
  if (valor == null) return false;
  const texto = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
  if (texto === 'sim') return true;
  if (texto === 'não') return false;
  recusar(400, 'Evidência obrigatória inválida: use Sim ou Não.', 'evidenciaObrigatoria');
}
