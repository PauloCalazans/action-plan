import { recusar } from './recusa';

/**
 * R3 (spec responsaveis-e-participantes): formato e validação semântica de Matrícula.
 * - Valor deve ser do tipo string
 * - Espaços nas pontas são aparados via trim()
 * - Comprimento deve ter entre 1 e 50 caracteres
 * - Não pode conter espaços no meio (rejeita múltiplos nomes como "Ana Lima", "Maria Silva")
 * - Não pode conter o caractere @ (rejeita e-mails corporativos como "maria@empresa.com")
 * 
 * @param valor - Valor a validar
 * @param nomeCampo - Nome do campo para a mensagem de erro e target
 * @returns A string com a grafia original aparada
 * @throws Recusa HTTP 400 se a matrícula for inválida
 */
export function validarMatricula(valor: unknown, nomeCampo: string): string {
  // Deve ser string
  if (typeof valor !== 'string') {
    recusar(400, 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.', nomeCampo);
  }

  // Aplica trim
  const matriculaTrimmed = valor.trim();

  // Comprimento entre 1 e 50 caracteres
  if (matriculaTrimmed.length < 1 || matriculaTrimmed.length > 50) {
    recusar(400, 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.', nomeCampo);
  }

  // Não pode conter espaços no meio
  if (matriculaTrimmed.includes(' ')) {
    recusar(400, 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.', nomeCampo);
  }

  // Não pode conter @
  if (matriculaTrimmed.includes('@')) {
    recusar(400, 'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.', nomeCampo);
  }

  return matriculaTrimmed;
}
