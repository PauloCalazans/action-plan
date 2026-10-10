import cds from '@sap/cds';
import type { Autor } from './abertura';
import { agora } from '../lib/relogio';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { registrarHistorico } from './historico';
import { validarMatricula } from './validacao-matricula';
import { validarJustificativa } from './justificativa';
import { matriculasIguais } from './identidade';
import { codigoValido } from './consulta';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

/**
 * R7 (spec responsaveis-e-participantes): atribuição ou reatribuição de Responsável Principal da Tratativa.
 * - Primeira atribuição (quando responsavelPrincipal === null): justificativa opcional
 * - Reatribuição (troca de matrícula): justificativa obrigatória
 * - R5: Responsável Principal e Participante não podem ser a mesma pessoa
 * - R10: Tratativa Encerrada ou Cancelada não pode ser alterada
 * - Idempotente: atribuir a mesma matrícula já gravada resulta em 204 sem histórico
 */
export async function atribuirResponsavelPrincipal(
  codigoTratativa: string,
  responsavelPrincipal: string,
  justificativa: string | undefined,
  autor: Autor,
): Promise<void> {
  // Validação de matrícula
  const matriculaValidada = validarMatricula(responsavelPrincipal, 'responsavelPrincipal');

  // Bloqueio pessimista D9
  const tratativa = await bloquearTratativa(codigoTratativa);
  exigirAlteravel(tratativa);

  // Ler estado atual
  const tratativaCompleta = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`)
      .columns('responsavelPrincipal')
      .where({ codigo: codigoTratativa }),
  )) as { responsavelPrincipal: string | null };

  const responsavelAtual = tratativaCompleta.responsavelPrincipal;

  // Idempotência: mesma matrícula já gravada
  if (matriculasIguais(matriculaValidada, responsavelAtual)) {
    return; // 204 sem histórico
  }

  // R5: Responsável Principal não pode ser Participante
  const participantes = (await cds.db.run(
    SELECT.from(`${NS}.ParticipantesTratativa`)
      .columns('matricula')
      .where({ tratativa_codigo: codigoTratativa }),
  )) as { matricula: string }[];

  for (const p of participantes) {
    if (matriculasIguais(matriculaValidada, p.matricula)) {
      recusar(409, 'Responsável Principal e Participante não podem ser a mesma pessoa.', 'responsavelPrincipal');
    }
  }

  // Validação de justificativa
  let justificativaValidada: string | null = null;
  if (responsavelAtual === null) {
    // Primeira atribuição: justificativa opcional
    justificativaValidada = justificativa ? validarJustificativa(justificativa, 'opcional') : null;
  } else {
    // Reatribuição: justificativa obrigatória
    justificativaValidada = validarJustificativa(justificativa, 'para reatribuir');
  }

  // Atualização
  await cds.db.run(
    UPDATE(`${NS}.Tratativas`)
      .set({ responsavelPrincipal: matriculaValidada })
      .where({ codigo: codigoTratativa }),
  );

  // Histórico
  const evento = responsavelAtual === null ? 'Atribuicao' : 'Reatribuicao';
  await registrarHistorico(
    codigoTratativa,
    autor,
    [{
      evento,
      campo: 'responsavelPrincipal',
      valorAnterior: responsavelAtual,
      valorNovo: matriculaValidada,
      justificativa: justificativaValidada,
    }],
    agora(),
  );
}

/**
 * R9 (spec responsaveis-e-participantes): inclusão de participante na Tratativa.
 * - R5: Responsável Principal e Participante não podem ser a mesma pessoa
 * - R6: limite de 20 participantes
 * - R10: Tratativa Encerrada ou Cancelada não pode ser alterada
 * - Idempotente: incluir participante já presente resulta em 204 sem histórico
 */
export async function incluirParticipante(
  codigoTratativa: string,
  participante: string,
  autor: Autor,
): Promise<void> {
  // Validação de matrícula
  const matriculaValidada = validarMatricula(participante, 'participante');

  // Bloqueio pessimista D9
  const tratativa = await bloquearTratativa(codigoTratativa);
  exigirAlteravel(tratativa);

  // Ler estado atual
  const tratativaCompleta = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`)
      .columns('responsavelPrincipal')
      .where({ codigo: codigoTratativa }),
  )) as { responsavelPrincipal: string | null };

  // R5: Participante não pode ser Responsável Principal
  if (matriculasIguais(matriculaValidada, tratativaCompleta.responsavelPrincipal)) {
    recusar(409, 'Responsável Principal e Participante não podem ser a mesma pessoa.', 'participante');
  }

  // Ler participantes existentes
  const participantes = (await cds.db.run(
    SELECT.from(`${NS}.ParticipantesTratativa`)
      .columns('matricula')
      .where({ tratativa_codigo: codigoTratativa }),
  )) as { matricula: string }[];

  // Idempotência: participante já presente (verificado ANTES do limite de 20, R6, CA97, I5)
  for (const p of participantes) {
    if (matriculasIguais(matriculaValidada, p.matricula)) {
      return; // 204 sem histórico
    }
  }

  // R6: limite de 20 participantes
  if (participantes.length >= 20) {
    recusar(409, 'Limite de 20 Participantes atingido.', 'participante');
  }

  // Calcular sequência
  const sequencia = participantes.length + 1;

  // Inserção
  await cds.db.run(
    INSERT.into(`${NS}.ParticipantesTratativa`).entries({
      ID: cds.utils.uuid(),
      tratativa_codigo: codigoTratativa,
      matricula: matriculaValidada,
      sequencia,
      criadoEm: agora().toISOString(),
    }),
  );

  // Histórico
  await registrarHistorico(
    codigoTratativa,
    autor,
    [{
      evento: 'InclusaoParticipante',
      campo: 'participante',
      valorAnterior: null,
      valorNovo: matriculaValidada,
      justificativa: null,
    }],
    agora(),
  );
}

/**
 * R9 (spec responsaveis-e-participantes): remoção de participante da Tratativa.
 * - R10: Tratativa Encerrada ou Cancelada não pode ser alterada
 * - Idempotente: remover participante inexistente resulta em 204 sem histórico
 */
export async function removerParticipante(
  codigoTratativa: string,
  participante: string,
  autor: Autor,
): Promise<void> {
  // Validação de matrícula
  const matriculaValidada = validarMatricula(participante, 'participante');

  // Bloqueio pessimista D9
  const tratativa = await bloquearTratativa(codigoTratativa);
  exigirAlteravel(tratativa);

  // Verificar se o participante existe
  const participantes = (await cds.db.run(
    SELECT.from(`${NS}.ParticipantesTratativa`)
      .columns('ID', 'matricula')
      .where({ tratativa_codigo: codigoTratativa }),
  )) as { ID: string; matricula: string }[];

  let encontrado: { ID: string; matricula: string } | undefined;
  for (const p of participantes) {
    if (matriculasIguais(matriculaValidada, p.matricula)) {
      encontrado = p;
      break;
    }
  }

  // Idempotência: participante inexistente
  if (!encontrado) {
    return; // 204 sem histórico
  }

  // Remoção
  await cds.db.run(
    DELETE.from(`${NS}.ParticipantesTratativa`).where({ ID: encontrado.ID }),
  );

  // Histórico
  await registrarHistorico(
    codigoTratativa,
    autor,
    [{
      evento: 'RemocaoParticipante',
      campo: 'participante',
      valorAnterior: encontrado.matricula,
      valorNovo: null,
      justificativa: null,
    }],
    agora(),
  );
}

/**
 * R17, R26 (spec responsaveis-e-participantes; Ruling R-02): consulta de responsáveis exclusiva para o Gestor.
 * Precedência:
 * 1. Autenticação (401 runtime)
 * 2. Papel estático: apenas GestorTratativa (403 Forbidden estático do runtime CAP)
 * 3. Código malformado ou ausente: 400 Código inválido., target: tratativa
 * 4. Existência: Tratativa inexistente no banco recusa com 404 Tratativa não encontrada.
 * 5. Sucesso (200): retorna DetalheResponsaveis com os dados ou responsavelPrincipal: null e participantes: []
 */
export async function consultarResponsaveis(codigoTratativa: string): Promise<{ responsavelPrincipal: string | null; participantes: string[] }> {
  // Validação de formato de código (M3)
  if (!codigoValido(codigoTratativa)) {
    recusar(400, 'Código inválido.', 'tratativa');
  }

  // Verificar existência da Tratativa
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`)
      .columns('responsavelPrincipal')
      .where({ codigo: codigoTratativa }),
  )) as { responsavelPrincipal: string | null } | null;

  if (!tratativa) {
    recusar(404, 'Tratativa não encontrada.');
  }

  // Ler participantes
  const participantes = (await cds.db.run(
    SELECT.from(`${NS}.ParticipantesTratativa`)
      .columns('matricula')
      .where({ tratativa_codigo: codigoTratativa })
      .orderBy('criadoEm', 'sequencia'),
  )) as { matricula: string }[];

  return {
    responsavelPrincipal: tratativa.responsavelPrincipal,
    participantes: participantes.map(p => p.matricula),
  };
}
