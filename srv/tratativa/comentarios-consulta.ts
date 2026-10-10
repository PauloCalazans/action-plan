// Consulta listarComentariosTratativa: autorização dinâmica, menor privilégio, paginação e mascaramento LGPD.
// R7, R8, R13 (spec comentarios), etapa 1 da task 001.

import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import { codigoValido } from './consulta';
import { recusar } from './recusa';
import { usuarioAutenticadoEhMatricula, matriculasIguais, obterMatriculaUsuario } from './identidade';

const NS = 'br.com.calazanstec';
const TAMANHO_PAGINA_PADRAO = 50;
const TAMANHO_PAGINA_MAXIMO = 200;

export interface ItemComentario {
  codigo: string;
  texto: string;
  autor: string;
  criadoEm: string;
  mencoes: string[];
}

interface LinhaComentario {
  codigo: string;
  texto: string;
  autor: string;
  criadoEm: string;
}

/** Valida e normaliza os parâmetros de paginação (003 R25: tamanhoPagina antes de pagina). */
function validarPaginacao(tamanhoPagina: unknown, pagina: unknown): { tamanho: number; paginaNumero: number } {
  const tamanho = tamanhoPagina === undefined || tamanhoPagina === null ? TAMANHO_PAGINA_PADRAO : Number(tamanhoPagina);
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > TAMANHO_PAGINA_MAXIMO) {
    recusar(400, 'O campo Tamanho da página aceita de 1 a 200.', 'tamanhoPagina');
  }
  const paginaNumero = pagina === undefined || pagina === null ? 1 : Number(pagina);
  if (!Number.isInteger(paginaNumero) || paginaNumero < 1) {
    recusar(400, 'O campo Página deve ser 1 ou maior.', 'pagina');
  }
  return { tamanho, paginaNumero };
}

/** Busca comentários ordenados (criadoEm ASC, desempate codigo ASC) e aplica o mascaramento LGPD de menções. */
async function buscarEMascarar(
  where: Record<string, unknown>,
  tamanho: number,
  paginaNumero: number,
  ehGestor: boolean,
): Promise<ItemComentario[]> {
  const comentarios = (await cds.db.run(
    SELECT.from(`${NS}.Comentarios`)
      .columns('codigo', 'texto', 'autor', 'criadoEm')
      .where(where)
      .orderBy('criadoEm asc', 'codigo asc')
      .limit(tamanho, (paginaNumero - 1) * tamanho),
  )) as LinhaComentario[];

  if (comentarios.length === 0) return [];

  // Mascaramento LGPD: mencoes só preenchida para o GestorTratativa; demais recebem [] (CA31, CA32, CA34, CA35;
  // coleção OData não aceita null, docs(spec) 0429f5f).
  if (!ehGestor) {
    return comentarios.map((c) => ({ ...c, mencoes: [] }));
  }

  const codigos = comentarios.map((c) => c.codigo);
  const mencoes = (await cds.db.run(
    SELECT.from(`${NS}.MencoesComentario`).columns('comentario_codigo', 'matricula').where({ comentario_codigo: codigos }),
  )) as Array<{ comentario_codigo: string; matricula: string }>;

  const mencoesPorComentario = new Map<string, string[]>();
  for (const m of mencoes) {
    const lista = mencoesPorComentario.get(m.comentario_codigo) ?? [];
    lista.push(m.matricula);
    mencoesPorComentario.set(m.comentario_codigo, lista);
  }

  return comentarios.map((c) => ({ ...c, mencoes: mencoesPorComentario.get(c.codigo) ?? [] }));
}

/**
 * Precedência (D10, 9 etapas; etapas 1-3 tratadas pelo runtime/before):
 * 4. Forma do parâmetro `tratativa` no domínio (400 `Código inválido.`, target `tratativa`).
 * 5. Existência da Tratativa (404 `Tratativa não encontrada.`).
 * 6. Autorização dinâmica e menor privilégio: sem vínculo -> lista vazia `[]` com 200 (precede a etapa 9).
 * 9. Parâmetros de paginação: `tamanhoPagina` validado antes de `pagina`.
 */
export async function listarComentariosTratativa(
  req: Request,
  codigoTratativa: string,
  tamanhoPagina: unknown,
  pagina: unknown,
): Promise<ItemComentario[]> {
  // Etapa 4: forma do parâmetro `tratativa`.
  if (!codigoTratativa || !codigoValido(codigoTratativa)) {
    recusar(400, 'Código inválido.', 'tratativa');
  }

  // Etapa 5: existência da Tratativa (sem bloqueio D9: consulta não bloqueia, R12/CA53).
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo', 'responsavelPrincipal').where({ codigo: codigoTratativa }),
  )) as { codigo: string; responsavelPrincipal: string | null } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  // Etapa 6: autorização dinâmica e menor privilégio (precede a etapa 9 — CA33a).
  const ehGestor = req.user.is('GestorTratativa');
  let autorizado = ehGestor;
  if (!autorizado) {
    autorizado =
      !!tratativa.responsavelPrincipal && usuarioAutenticadoEhMatricula(req, tratativa.responsavelPrincipal);
  }
  if (!autorizado) {
    const participantes = (await cds.db.run(
      SELECT.from(`${NS}.ParticipantesTratativa`).columns('matricula').where({ tratativa_codigo: codigoTratativa }),
    )) as Array<{ matricula: string }>;
    const matriculaUsuario = obterMatriculaUsuario(req);
    autorizado = participantes.some((p) => matriculasIguais(matriculaUsuario, p.matricula));
  }
  if (!autorizado) {
    return [];
  }

  // Etapa 9: paginação — tamanhoPagina validado antes de pagina (003 R25).
  const { tamanho, paginaNumero } = validarPaginacao(tamanhoPagina, pagina);

  // Busca ordenada: criadoEm ASC, desempate por codigo ASC (CA41, CA42); mascaramento LGPD de menções.
  return buscarEMascarar({ tratativa_codigo: codigoTratativa, acao_codigo: null }, tamanho, paginaNumero, ehGestor);
}

/**
 * Precedência (D10, 9 etapas; etapas 1-3 tratadas pelo runtime/before):
 * 4. Forma dos parâmetros `tratativa` e `acao` no domínio (400 `Código inválido.`, target respectivo).
 * 5. Existência da Tratativa (404 `Tratativa não encontrada.`) e da Ação (404 `Ação não encontrada.`,
 *    inexistente ou pertencente a outra Tratativa).
 * 6. Autorização dinâmica e menor privilégio: Gestor ou Responsável da própria Ação/Subação; sem vínculo
 *    (inclusive Responsável Principal, Participantes, Responsável de outra Ação ou da Ação mãe/filha)
 *    -> lista vazia `[]` com 200 (precede a etapa 9).
 * 9. Parâmetros de paginação: `tamanhoPagina` validado antes de `pagina`.
 */
export async function listarComentariosAcao(
  req: Request,
  codigoTratativa: string,
  codigoAcao: string,
  tamanhoPagina: unknown,
  pagina: unknown,
): Promise<ItemComentario[]> {
  // Etapa 4: forma do parâmetro `tratativa`.
  if (!codigoTratativa || !codigoValido(codigoTratativa)) {
    recusar(400, 'Código inválido.', 'tratativa');
  }
  // Etapa 4: forma do parâmetro `acao`.
  if (!codigoAcao || !codigoValido(codigoAcao)) {
    recusar(400, 'Código inválido.', 'acao');
  }

  // Etapa 5: existência da Tratativa (sem bloqueio D9: consulta não bloqueia, R12/CA53).
  const tratativa = await cds.db.run(SELECT.one.from(`${NS}.Tratativas`).columns('codigo').where({ codigo: codigoTratativa }));
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  // Etapa 5: existência da Ação (inexistente ou de outra Tratativa).
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'responsavel').where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as { codigo: string; responsavel: string } | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');

  // Etapa 6: autorização dinâmica e menor privilégio (precede a etapa 9).
  const ehGestor = req.user.is('GestorTratativa');
  const autorizado = ehGestor || usuarioAutenticadoEhMatricula(req, acao.responsavel);
  if (!autorizado) {
    return [];
  }

  // Etapa 9: paginação — tamanhoPagina validado antes de pagina (003 R25).
  const { tamanho, paginaNumero } = validarPaginacao(tamanhoPagina, pagina);

  // Busca ordenada: criadoEm ASC, desempate por codigo ASC; mascaramento LGPD de menções.
  return buscarEMascarar({ tratativa_codigo: codigoTratativa, acao_codigo: codigoAcao }, tamanho, paginaNumero, ehGestor);
}
