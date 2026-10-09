// Opções de requisição por identidade mockada (package.json › cds.requires.auth [development]).
// Reutilizadas por todos os testes da spec abertura-por-apps-de-origem.
const aceitaQualquerStatus = { validateStatus: () => true };
const como = (username: string) => ({ auth: { username, password: '' }, ...aceitaQualquerStatus });

export const semAuth = { ...aceitaQualquerStatus };
export const comoApp = como('app-origem-a');
export const comoAppB = como('app-origem-b');
export const comoAppRevogado = como('app-revogado');
export const comoAdmin = como('admin');
export const comoUsuario = como('usuario');
export const comoGestor = como('gestor');

// Autenticação como colaborador específico (005 R4: ID do usuário autenticado É a matrícula)
export const comoM1001 = como('M1001');
export const comoM2002 = como('M2002');
export const comoM9999 = como('M9999');
