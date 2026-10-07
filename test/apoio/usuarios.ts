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
