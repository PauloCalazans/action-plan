import cds from '@sap/cds';
import { agora, dataCivil } from '../lib/relogio';
import type { Autor } from './abertura';
import { validarDescricao, validarEvidenciaObrigatoria, validarPrazo, validarPrioridade, validarResponsavel } from './acoes-validacao';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { registrarHistorico, validarAutor } from './historico';
import { recusar } from './recusa';
import { validarMatricula } from './validacao-matricula';

const NS = 'br.com.calazanstec';

/** Campos de criação de Ação ou Subação; ausente ou null assume o padrão de cada campo (R4, R14). */
export interface DadosCriacaoAcao {
  descricao?: string | null; responsavel?: string | null; prazo?: string | null;
  prioridade?: string | null; evidenciaObrigatoria?: string | null;
}

interface AcaoLocalizada { codigo: string; status: string; acaoMae_codigo: string | null }

/** R1 (004): Ação de primeiro nível, Status Pendente. */
export function criarAcao(codigoTratativa: string, dados: DadosCriacaoAcao, autor: Autor): Promise<{ codigo: string }> {
  return criar(codigoTratativa, null, dados, autor);
}

/** R6 b (016): cria uma Ação com vínculo persistido à causa que a originou. */
export function criarAcaoComCausa(
  codigoTratativa: string,
  dados: DadosCriacaoAcao,
  causa: { identificador: string; descricao: string; rotulo: string },
  autor: Autor,
): Promise<{ codigo: string }> {
  return criar(codigoTratativa, null, dados, autor, causa);
}

/** R2 (004): Subação sob a Ação mãe da mesma Tratativa; Código da mãe inválido recusa antes de qualquer consulta. */
export function criarSubacao(codigoTratativa: string, acaoMae: string, dados: DadosCriacaoAcao, autor: Autor): Promise<{ codigo: string }> {
  if (!codigoValido(acaoMae)) recusar(400, 'Código inválido.', 'acaoMae');
  return criar(codigoTratativa, acaoMae, dados, autor);
}

/**
 * Ordem da decisão 4 do design: autor, bloqueio D9 (404), existência da mãe (404), Tratativa alterável (409),
 * Subação de Subação (400), campos (400), persistência e histórico `Criacao` na mesma transação.
 */
async function criar(
  codigoTratativa: string,
  acaoMae: string | null,
  dados: DadosCriacaoAcao,
  autor: Autor,
  causa?: { identificador: string; descricao: string; rotulo: string },
): Promise<{ codigo: string }> {
  validarAutor(autor);
  const tratativa = await bloquearTratativa(codigoTratativa);
  const mae = acaoMae === null ? undefined : await localizarAcao(codigoTratativa, acaoMae);
  exigirAlteravel(tratativa);
  if (mae?.acaoMae_codigo) recusar(400, 'Uma Subação não pode ter Subações.');
  // R12: mãe Concluída ou Cancelada não aceita Subação nova.
  if (mae && (mae.status === 'Concluída' || mae.status === 'Cancelada')) {
    recusar(409, `A Ação mãe está ${mae.status} e não aceita esta alteração.`);
  }

  const hoje = dataCivil(agora());
  const campos = {
    descricao: validarDescricao(dados.descricao),
    responsavel: validarResponsavel(dados.responsavel),
    prazo: validarPrazo(dados.prazo, hoje),
    prioridade: validarPrioridade(dados.prioridade),
    evidenciaObrigatoria: validarEvidenciaObrigatoria(dados.evidenciaObrigatoria),
  };

  // R27 (005): validação de formato de matrícula após validação semântica básica do 004
  // Preserva as mensagens semânticas do 004 para ausente/vazio e comprimento > 50
  // A mensagem de matrícula inválida aplica-se quando houver espaços no meio ou @
  validarMatricula(campos.responsavel, 'responsavel');

  const codigo = cds.utils.uuid();
  const instante = agora();
  await cds.db.run(
    INSERT.into(`${NS}.Acoes`).entries({
      codigo,
      tratativa_codigo: codigoTratativa,
      acaoMae_codigo: acaoMae,
      ...campos,
      causaIdentificador: causa?.identificador ?? null,
      causaDescricao: causa?.descricao ?? null,
      status: 'Pendente',
      dataConclusao: null,
      criadoEm: instante.toISOString(),
    }),
  );
  // R23: o histórico registra o evento e o autor, nunca a Descrição.
  await registrarHistorico(
    codigoTratativa,
    autor,
    [{ evento: 'Criacao' }, ...(causa
      ? [{ evento: 'CriacaoAcaoComCausa', campo: 'causa', valorNovo: causa.identificador, justificativa: causa.rotulo }]
      : [])],
    instante,
    codigo,
  );
  return { codigo };
}

/** Existência e pertencimento: a Ação precisa existir e ser da Tratativa informada (404 `Ação não encontrada.`). */
async function localizarAcao(codigoTratativa: string, codigo: string): Promise<AcaoLocalizada> {
  const linha = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'status', 'acaoMae_codigo').where({ codigo, tratativa_codigo: codigoTratativa }),
  )) as AcaoLocalizada | undefined;
  if (!linha) recusar(404, 'Ação não encontrada.');
  return linha;
}
