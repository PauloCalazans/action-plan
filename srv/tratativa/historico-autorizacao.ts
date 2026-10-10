// R5, R8, R9 (spec historico-e-auditoria): autorização dinâmica por menor privilégio e mascaramento LGPD.
// Etapa 1 (consulta unificada): ainda não há regra de autorização nem mascaramento em vigor — a function
// `consultarHistoricoTratativa` só é exercitada pelo Gestor (visão irrestrita) nos testes desta etapa.
// As regras de segregação de menor privilégio e o mascaramento LGPD completo entram na Etapa 3 (N3-2, N3-3).

import type { Request } from '@sap/cds';
import type { ItemHistoricoBruto } from './historico-consulta';

/**
 * Filtra os itens que o usuário chamador está autorizado a ver.
 * Etapa 1: Gestor tem visão irrestrita (todos os itens); a segregação por vínculo (Responsável Principal,
 * Participante, Responsável de Ação) e o retorno de lista vazia para desvinculados chegam na Etapa 3.
 */
export async function filtrarPorAutorizacao(req: Request, itens: ItemHistoricoBruto[]): Promise<ItemHistoricoBruto[]> {
  if (req.user.is('GestorTratativa')) return itens;
  return itens;
}

/**
 * Aplica o mascaramento LGPD de `autor`, `justificativa` e matrículas em `detalhe` para não-Gestores.
 * Etapa 1: mascaramento ainda não está em vigor (chega na Etapa 3, N3-3); devolve o item sem alteração.
 */
export function mascarar(req: Request, item: ItemHistoricoBruto): ItemHistoricoBruto {
  void req;
  return item;
}
