// R5, R8, R9 (spec historico-e-auditoria): autorização dinâmica por menor privilégio e mascaramento LGPD.
// Etapa 3 (N3-2, N3-3): autorização completa — Gestor (irrestrito), Responsável Principal e Participantes
// (eventos diretos da Tratativa), Responsável da Ação (eventos da própria Ação, com segregação estrita
// entre Ação mãe e Subações), união de papéis quando o usuário acumula vínculos, avaliação dinâmica do
// vínculo no momento da consulta (efeito imediato da Delegação) e lista vazia para quem não tem vínculo
// nenhum (CA9-CA15, CA27a). Mascaramento LGPD estrito de autor/justificativa/matrículas para não-Gestor
// (CA35-CA42).

import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import type { DetalheEventoHistorico, ItemHistoricoBruto } from './historico-consulta';
import { usuarioAutenticadoEhMatricula } from './identidade';

const NS = 'br.com.calazanstec';

/**
 * Campos de `detalhe` que contêm matrícula de colaborador (R8e, N3-3): mascarados para não-Gestor.
 * Valores exatos gravados por `srv/tratativa/edicao.ts` (`solicitante`), `responsaveis-tratativa.ts`
 * (`responsavelPrincipal`, `participante`) e `acoes-delegacao.ts` (`responsavel`).
 */
const CAMPOS_MATRICULA = new Set(['solicitante', 'responsavelPrincipal', 'participante', 'responsavel']);

interface VinculoTratativa {
  responsavelPrincipal: string | null;
  participantes: string[];
}

/** Lê o Responsável Principal e os Participantes atuais da Tratativa (vínculo avaliado no momento da consulta). */
async function lerVinculoTratativa(codigoTratativa: string): Promise<VinculoTratativa> {
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('responsavelPrincipal').where({ codigo: codigoTratativa }),
  )) as { responsavelPrincipal: string | null } | undefined;
  const participantesLinhas = (await cds.db.run(
    SELECT.from(`${NS}.ParticipantesTratativa`).columns('matricula').where({ tratativa_codigo: codigoTratativa }),
  )) as Array<{ matricula: string }>;
  return {
    responsavelPrincipal: tratativa?.responsavelPrincipal ?? null,
    participantes: participantesLinhas.map((p) => p.matricula),
  };
}

/** Lê o responsável atual de cada Ação citada nos itens (vínculo avaliado no momento da consulta, CA14). */
async function responsaveisPorAcao(codigosAcao: string[]): Promise<Map<string, string>> {
  if (codigosAcao.length === 0) return new Map();
  const linhas = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`).columns('codigo', 'responsavel').where({ codigo: { in: codigosAcao } }),
  )) as Array<{ codigo: string; responsavel: string }>;
  return new Map(linhas.map((l) => [l.codigo, l.responsavel]));
}

/**
 * Filtra os itens que o usuário chamador está autorizado a ver (R5, N3-2):
 * - `GestorTratativa`: visão irrestrita (CA9);
 * - Responsável Principal ou Participante da Tratativa: apenas eventos diretos (`codigoAcao === null`), CA10;
 * - Responsável de uma Ação: apenas eventos daquela Ação exata — a segregação entre Ação mãe e Subações
 *   (CA12, CA12a) decorre diretamente de `item.codigoAcao` ser o código da Ação específica, nunca o da mãe
 *   nem o das filhas, pois cada evento é gravado com o código da própria Ação/Subação onde ocorreu;
 * - União de papéis (CA13): o item é visível se autorizado por QUALQUER vínculo do usuário;
 * - Avaliação dinâmica (CA14): o vínculo é lido do estado atual do banco a cada consulta, refletindo
 *   delegações imediatamente;
 * - Sem nenhum vínculo (CA15) ou filtro por `codigoAcao` de Ação não própria (CA27a): lista vazia.
 */
export async function filtrarPorAutorizacao(req: Request, itens: ItemHistoricoBruto[]): Promise<ItemHistoricoBruto[]> {
  if (req.user.is('GestorTratativa')) return itens;
  if (itens.length === 0) return itens;

  const codigoTratativa = itens[0].codigoTratativa;
  const [vinculoTratativa, codigosAcao] = [
    await lerVinculoTratativa(codigoTratativa),
    [...new Set(itens.map((i) => i.codigoAcao).filter((c): c is string => c !== null))],
  ];
  const responsaveis = await responsaveisPorAcao(codigosAcao);

  const temVinculoDireto =
    usuarioAutenticadoEhMatricula(req, vinculoTratativa.responsavelPrincipal ?? '') ||
    vinculoTratativa.participantes.some((p) => usuarioAutenticadoEhMatricula(req, p));

  return itens.filter((item) => {
    if (item.codigoAcao === null) return temVinculoDireto;
    const responsavel = responsaveis.get(item.codigoAcao);
    return !!responsavel && usuarioAutenticadoEhMatricula(req, responsavel);
  });
}

/** Mascara `valorAnterior`/`valorNovo` como `null` quando o campo alterado é matrícula de colaborador (R8e). */
function mascararDetalhe(detalhe: DetalheEventoHistorico): DetalheEventoHistorico {
  const campoEhMatricula = typeof detalhe.campo === 'string' && CAMPOS_MATRICULA.has(detalhe.campo);
  return {
    ...detalhe,
    valorAnterior: campoEhMatricula ? null : detalhe.valorAnterior,
    valorNovo: campoEhMatricula ? null : detalhe.valorNovo,
    justificativa: null,
  };
}

/**
 * Aplica o mascaramento LGPD de `autor`, `justificativa` e matrículas em `detalhe` para não-Gestores (R5c,
 * R8e, N3-3). `GestorTratativa` recebe os itens integralmente (CA9).
 */
export function mascarar(req: Request, item: ItemHistoricoBruto): ItemHistoricoBruto {
  if (req.user.is('GestorTratativa')) return item;
  return {
    ...item,
    autor: null,
    detalhe: mascararDetalhe(item.detalhe),
  };
}
