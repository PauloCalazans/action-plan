// R5, R8, R9 (spec historico-e-auditoria): autorização dinâmica por menor privilégio e mascaramento LGPD.
// Etapa 2 (filtros avançados): a autorização completa (Participantes, Responsável Principal, segregação
// hierárquica entre Ação mãe e Subações, acúmulo de papéis, delegação dinâmica) e o mascaramento LGPD
// completo chegam na Etapa 3 (N3-2, N3-3). Nesta etapa, só a regra mínima exigida pelo CA27a está em
// vigor: Responsável de uma Ação não vê eventos de outra Ação da mesma Tratativa que não seja sua.

import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import type { ItemHistoricoBruto } from './historico-consulta';
import { usuarioAutenticadoEhMatricula } from './identidade';

const NS = 'br.com.calazanstec';

/** Lê o responsável de cada Ação citada nos itens (uma única consulta por conjunto de códigos distintos). */
async function responsaveisPorAcao(codigosAcao: string[]): Promise<Map<string, string>> {
  if (codigosAcao.length === 0) return new Map();
  const linhas = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`).columns('codigo', 'responsavel').where({ codigo: { in: codigosAcao } }),
  )) as Array<{ codigo: string; responsavel: string }>;
  return new Map(linhas.map((l) => [l.codigo, l.responsavel]));
}

/**
 * Filtra os itens que o usuário chamador está autorizado a ver.
 * Etapa 2: Gestor tem visão irrestrita; para não-Gestor, eventos diretos da Tratativa (`codigoAcao === null`)
 * permanecem visíveis (vínculo de Participante/Responsável Principal chega na Etapa 3) e eventos de Ação só
 * são visíveis quando o usuário é o responsável daquela Ação (CA27a).
 */
export async function filtrarPorAutorizacao(req: Request, itens: ItemHistoricoBruto[]): Promise<ItemHistoricoBruto[]> {
  if (req.user.is('GestorTratativa')) return itens;

  const codigosAcao = [...new Set(itens.map((i) => i.codigoAcao).filter((c): c is string => c !== null))];
  const responsaveis = await responsaveisPorAcao(codigosAcao);

  return itens.filter((item) => {
    if (item.codigoAcao === null) return true;
    const responsavel = responsaveis.get(item.codigoAcao);
    return !!responsavel && usuarioAutenticadoEhMatricula(req, responsavel);
  });
}

/**
 * Aplica o mascaramento LGPD de `autor`, `justificativa` e matrículas em `detalhe` para não-Gestores.
 * Etapa 2: mascaramento ainda não está em vigor (chega na Etapa 3, N3-3); devolve o item sem alteração.
 */
export function mascarar(req: Request, item: ItemHistoricoBruto): ItemHistoricoBruto {
  void req;
  return item;
}
