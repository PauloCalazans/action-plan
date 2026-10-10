import type cds from '@sap/cds';

/**
 * R4 (spec responsaveis-e-participantes): ponto único de identidade "usuário autenticado ↔ matrícula".
 * Isolamento de integração futura: os intents 011 (SuccessFactors) e 014 (identidade corporativa BTP)
 * alterarão exclusivamente as funções deste módulo, sem impacto em nenhuma regra de negócio do domínio.
 * 
 * Premissa de identidade: não há tela de login nem autenticação proprietária no backend;
 * a identidade provém do Launchpad/XSUAA. Hoje o ID do token (req.user.id) representa a matrícula.
 */

/**
 * Extrai a matrícula do usuário autenticado.
 * @param req - Request do CAP
 * @returns Matrícula do usuário autenticado
 */
export function obterMatriculaUsuario(req: cds.Request): string {
  return req.user.id;
}

/**
 * Aplica trim() e toLowerCase() na matrícula, retornando string vazia para nulos.
 * @param matricula - Matrícula a normalizar
 * @returns Matrícula normalizada
 */
export function normalizarMatricula(matricula?: string | null): string {
  if (!matricula) return '';
  return matricula.trim().toLowerCase();
}

/**
 * Compara duas matrículas de forma case-insensitive e trim-insensitive.
 * @param m1 - Primeira matrícula
 * @param m2 - Segunda matrícula
 * @returns true se as matrículas forem iguais após normalização
 */
export function matriculasIguais(m1?: string | null, m2?: string | null): boolean {
  return normalizarMatricula(m1) === normalizarMatricula(m2);
}

/**
 * Compara a matrícula do usuário autenticado com a matrícula gravada.
 * @param req - Request do CAP
 * @param matricula - Matrícula gravada a comparar
 * @returns true se o usuário autenticado for a matrícula informada
 */
export function usuarioAutenticadoEhMatricula(req: cds.Request, matricula: string): boolean {
  return matriculasIguais(obterMatriculaUsuario(req), matricula);
}
