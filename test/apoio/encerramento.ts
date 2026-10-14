import { linhas } from './banco';
import { emitirAval, comoValidador } from './aval';
import { mudarStatus, type Envia, type Resposta } from './tratativas';
import { comoGestor } from './usuarios';

const FUNDAMENTACAO_APROVACAO = 'Eficacia verificada em testes e evidencias revisadas.';

export async function encerrarComAval(
  POST: Envia,
  codigo: string,
  opcoes: { justificativa?: string } = {},
): Promise<Resposta> {
  const [tratativa] = await linhas('Tratativas', { codigo });
  if (!tratativa) throw new Error(`Tratativa ${codigo} não encontrada no preparo do encerramento.`);

  if (tratativa.status === 'Aberta') {
    const inicio = await mudarStatus(POST, codigo, { status: 'Em andamento' }, comoGestor);
    if (inicio.status !== 204) {
      throw new Error(`Falha ao iniciar a Tratativa ${codigo}: HTTP ${inicio.status}.`);
    }
  }

  const avaliacao = await emitirAval(
    POST,
    codigo,
    { parecer: 'Aprovado', fundamentacao: FUNDAMENTACAO_APROVACAO },
    comoValidador,
  );
  if (avaliacao.status !== 204) {
    throw new Error(`Falha ao emitir Aval Técnico para a Tratativa ${codigo}: HTTP ${avaliacao.status}.`);
  }

  return mudarStatus(
    POST,
    codigo,
    { status: 'Encerrada', justificativa: opcoes.justificativa },
    comoGestor,
  );
}
