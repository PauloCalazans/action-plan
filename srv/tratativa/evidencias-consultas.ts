import cds from '@sap/cds';
import { codigoValido } from './consulta';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';
const FINAIS = ['Concluída', 'Cancelada'];

interface PendenciaEvidencia {
  acao: string;
  descricao: string;
  responsavel: string | null;
  status: string;
}

/**
 * R9, R17 (006 etapa 3): lista Ações e Subações com evidência obrigatória sem Evidências ativas.
 * Aplicação de menor privilégio (R11):
 * - Gestor: vê todas as Ações/Subações com pendência e respectivos responsáveis
 * - Responsável: vê apenas as Ações/Subações sob sua responsabilidade com responsavel = null
 * - Terceiros: lista vazia
 */
export async function listarPendenciasEvidenciasTratativa(
  req: cds.Request,
  codigoTratativa: string,
): Promise<PendenciaEvidencia[]> {
  // Validação de código
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'tratativa');

  // Verificar existência da Tratativa (sem bloqueio D9, consulta não bloqueia)
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo')
      .where({ codigo: codigoTratativa }),
  )) as { codigo: string } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  const ehGestor = req.user.is('GestorTratativa');
  const matriculaUsuario = req.user.id;

  // Buscar Ações com evidência obrigatória, não finalizadas, sem evidências ativas
  const acoes = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`)
      .columns('codigo', 'descricao', 'responsavel', 'status')
      .where({ 
        tratativa_codigo: codigoTratativa, 
        evidenciaObrigatoria: true,
        status: { 'not in': FINAIS },
      }),
  )) as Array<{ codigo: string; descricao: string; responsavel: string; status: string }>;

  if (!acoes || acoes.length === 0) {
    return [];
  }

  // Filtrar apenas as Ações que não têm evidências ativas
  const pendencias: PendenciaEvidencia[] = [];

  for (const acao of acoes) {
    // Contar evidências ativas desta Ação
    const evidenciasAtivas = (await cds.db.run(
      SELECT.one.from(`${NS}.Evidencias`).columns('count(*) as total')
        .where({ acao_codigo: acao.codigo, ativo: true }),
    )) as { total: number } | undefined;
    
    const contagem = evidenciasAtivas?.total ?? 0;
    
    // Se não tem evidências ativas, é uma pendência
    if (contagem === 0) {
      // Aplicar menor privilégio
      if (ehGestor) {
        // Gestor vê tudo com responsável preenchido
        pendencias.push({
          acao: acao.codigo,
          descricao: acao.descricao,
          responsavel: acao.responsavel,
          status: acao.status,
        });
      } else if (acao.responsavel.toLowerCase() === matriculaUsuario.toLowerCase()) {
        // Responsável vê apenas suas Ações com responsavel = null
        pendencias.push({
          acao: acao.codigo,
          descricao: acao.descricao,
          responsavel: null,
          status: acao.status,
        });
      }
      // Terceiros não veem nada (não entra no if)
    }
  }

  return pendencias;
}
