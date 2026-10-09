import cds from '@sap/cds';
import { agora } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { registrarHistorico } from './historico';
import { matriculasIguais } from './identidade';
import { validarJustificativa } from './justificativa';
import { recusar } from './recusa';
import { validarMatricula } from './validacao-matricula';

const NS = 'br.com.calazanstec';

interface AcaoLocalizada {
  codigo: string;
  responsavel: string;
  status: string;
}

/**
 * R8, R10, R14, R27, R29, R30 (spec responsaveis-e-participantes):
 * Delegação de Ação com justificativa obrigatória e histórico dedicado.
 * 
 * Precedência:
 * 1. Validação de formato de código acao (400 "Código inválido.", target: acao)
 * 2. Bloqueio pessimista D9 (bloquearTratativa)
 * 3. Existência completa: Tratativa inexistente → 404; Ação inexistente ou de outra Tratativa → 404
 * 4. Estado da Tratativa (409): Encerrada ou Cancelada → 409
 * 5. Estado da Ação (409): Concluída ou Cancelada → 409
 * 6. Idempotência: delegar para a mesma matrícula já gravada → 204 sem alteração e sem histórico
 * 7. Campos validados (400):
 *    - novoResponsavel validado por R3 (target: novoResponsavel)
 *    - justificativa obrigatória (target: justificativa)
 * 8. Gravação atômica da Ação e do histórico de Delegacao
 * 
 * @param codigoTratativa - Código da Tratativa
 * @param codigoAcao - Código da Ação ou Subação
 * @param novoResponsavel - Matrícula do novo responsável
 * @param justificativa - Justificativa obrigatória
 * @param autor - Autor da operação (Gestor)
 */
export async function delegarAcao(
  codigoTratativa: string,
  codigoAcao: string,
  novoResponsavel: string,
  justificativa: string,
  autor: Autor,
): Promise<void> {
  // 1. Validação de formato de código acao antes do bloqueio D9 (M4)
  if (!codigoValido(codigoAcao)) {
    recusar(400, 'Código inválido.', 'acao');
  }

  // 2. Bloqueio pessimista D9
  const tratativa = await bloquearTratativa(codigoTratativa);

  // 3. Existência completa: localizar a Ação
  const acao = await localizarAcao(codigoTratativa, codigoAcao);

  // 4. Estado da Tratativa (409)
  exigirAlteravel(tratativa);

  // 5. Estado da Ação (409)
  if (acao.status === 'Concluída' || acao.status === 'Cancelada') {
    recusar(409, `Ação ${acao.status} não pode ser alterada.`);
  }

  // 6. Validação de novoResponsavel (R3) - antes da idempotência
  const novoResponsavelValidado = validarMatricula(novoResponsavel, 'novoResponsavel');

  // 7. Idempotência: delegar para a mesma matrícula já gravada
  if (matriculasIguais(novoResponsavelValidado, acao.responsavel)) {
    // 204 sem alteração e sem histórico
    return;
  }

  // 8. Validação de justificativa obrigatória (R8)
  validarJustificativa(justificativa, 'delegar');

  // 9. Gravação atômica da Ação e do histórico de Delegacao
  const instante = agora();
  await cds.db.run(
    UPDATE(`${NS}.Acoes`)
      .set({ responsavel: novoResponsavelValidado })
      .where({ codigo: codigoAcao }),
  );

  // Registrar histórico de Delegacao em HistoricoAcoes
  await registrarHistorico(
    codigoTratativa,
    autor,
    [
      {
        evento: 'Delegacao',
        campo: 'responsavel',
        valorAnterior: acao.responsavel,
        valorNovo: novoResponsavelValidado,
        justificativa,
      },
    ],
    instante,
    codigoAcao,
  );
}

/**
 * Existência e pertencimento: a Ação precisa existir e ser da Tratativa informada.
 * @param codigoTratativa - Código da Tratativa
 * @param codigoAcao - Código da Ação
 * @returns Ação localizada com código, responsável e status
 * @throws Recusa HTTP 404 "Ação não encontrada." se a Ação não existir ou não pertencer à Tratativa
 */
async function localizarAcao(codigoTratativa: string, codigoAcao: string): Promise<AcaoLocalizada> {
  const linha = (await cds.db.run(
    SELECT.one
      .from(`${NS}.Acoes`)
      .columns('codigo', 'responsavel', 'status')
      .where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as AcaoLocalizada | undefined;

  if (!linha) {
    recusar(404, 'Ação não encontrada.');
  }

  return linha;
}
