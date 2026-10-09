// Orquestrador da action removerEvidencia: remoção lógica com auditoria imutável.
// R1, R6, R7, R10, R12, R13 (spec evidencias).

import cds from '@sap/cds';
import type { Autor } from './abertura';
import type { Request } from '@sap/cds';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { obterMatriculaUsuario, usuarioAutenticadoEhMatricula } from './identidade';
import { registrarHistorico } from './historico';
import { recusar } from './recusa';
import { agora } from '../lib/relogio';

const NS = 'br.com.calazanstec';

export interface DadosRemocaoEvidencia {
  acao: string;
  evidencia: string;
}

/**
 * Orquestrador da action removerEvidencia.
 * Precedência ajustada para atender CA25 e CA57a:
 * 1. Autenticação (401 runtime)
 * 2. Forma no runtime (400 runtime)
 * 3. Aplicativo de origem (403 antes do domínio - tratado no before('*') do serviço)
 * 4. Bloqueio D9 e estado da Tratativa (409 Encerrada/Cancelada) - precede validação de código (CA25)
 * 5. Autorização prévia para não-gestores com código inválido (403 precede 400 - CA57a)
 * 6. Forma de identificador no domínio (400 código inválido)
 * 7. Existência da Evidência ativa na Ação (404)
 * 8. Autorização dinâmica (403)
 * 9. Estado da Ação (409)
 */
export async function removerEvidencia(
  req: Request,
  codigoTratativa: string,
  dados: DadosRemocaoEvidencia,
  autor: Autor,
): Promise<void> {
  // Passo 4: Bloqueia a Tratativa com D9 e valida estado ANTES de validar códigos (CA25)
  const tratativa = await bloquearTratativa(codigoTratativa);
  exigirAlteravel(tratativa);

  // Passo 5: Para CA57a - se não é gestor e código da ação é inválido, verificar acesso prévia
  const ehGestor = req.user.is('GestorTratativa');
  const codigoAcaoValido = dados.acao && codigoValido(dados.acao);
  
  if (!ehGestor && !codigoAcaoValido) {
    // Verificar se o usuário é responsável de alguma ação da tratativa
    const acoesDoUsuario = await cds.db.run(
      SELECT.from(`${NS}.Acoes`)
        .columns('codigo')
        .where({ tratativa_codigo: codigoTratativa, responsavel: obterMatriculaUsuario(req) }),
    ) as Array<{ codigo: string }>;
    
    if (acoesDoUsuario.length === 0) {
      // Não é gestor e não é responsável de nenhuma ação: 403 precede validação de código
      recusar(403, 'Forbidden');
    }
  }

  // Passo 6: Forma de identificador no domínio
  if (!codigoAcaoValido) {
    recusar(400, 'Código inválido.', 'acao');
  }

  if (!dados.evidencia || !codigoValido(dados.evidencia)) {
    recusar(400, 'Código inválido.', 'evidencia');
  }

  // Passo 7: Existência da Evidência ativa vinculada à Ação informada
  const evidencia = await cds.db.run(
    SELECT.one
      .from(`${NS}.Evidencias`)
      .columns('codigo', 'acao_codigo', 'tratativa_codigo', 'ativo', 'mimeType', 'tamanho')
      .where({ codigo: dados.evidencia, acao_codigo: dados.acao, ativo: true }),
  );

  if (!evidencia) {
    recusar(404, 'Evidência não encontrada.');
  }

  // Buscar dados da Ação para autorização e validação de estado
  const acao = await cds.db.run(
    SELECT.one
      .from(`${NS}.Acoes`)
      .columns('codigo', 'tratativa_codigo', 'responsavel', 'status')
      .where({ codigo: dados.acao, tratativa_codigo: codigoTratativa }),
  );

  if (!acao) {
    recusar(404, 'Ação não encontrada.');
  }

  // Passo 8: Autorização dinâmica - Gestor OU Responsável da Ação
  const ehResponsavel = usuarioAutenticadoEhMatricula(req, acao.responsavel);

  if (!ehGestor && !ehResponsavel) {
    recusar(403, 'Forbidden');
  }

  // Passo 9: Estado da Ação
  if (acao.status === 'Concluída' || acao.status === 'Cancelada') {
    recusar(409, `Ação ${acao.status} não pode ser alterada.`);
  }

  // Remoção lógica: marca ativo=false, data e autor da remoção
  const instante = agora();
  const matriculaAutor = obterMatriculaUsuario(req);

  await cds.db.run(
    UPDATE.entity(`${NS}.Evidencias`)
      .set({
        ativo: false,
        removidoEm: instante.toISOString(),
        autorRemocao: matriculaAutor,
      })
      .where({ codigo: dados.evidencia }),
  );

  // Registrar histórico de remoção (R12: metadados sem nome de arquivo)
  await registrarHistorico(
    codigoTratativa,
    autor,
    [
      {
        evento: 'RemocaoEvidencia',
        evidencia: dados.evidencia,
        mimeType: evidencia.mimeType,
        tamanho: evidencia.tamanho,
      },
    ],
    instante,
    dados.acao,
  );
}
