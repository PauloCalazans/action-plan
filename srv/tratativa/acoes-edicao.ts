import cds from '@sap/cds';
import { agora, dataCivil } from '../lib/relogio';
import type { Autor } from './abertura';
import { validarDescricao, validarEvidenciaObrigatoria, validarPrazo, validarPrioridade } from './acoes-validacao';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { registrarHistorico, validarAutor, type LinhaHistorico } from './historico';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

/** Campos que a edição aceita (R19, R20; Ruling R-07): sem `responsavel`, `status`, `codigo` ou datas de sistema. */
export interface CamposEdicaoAcao {
  descricao?: string | null; prazo?: string | null; prioridade?: string | null; evidenciaObrigatoria?: string | null;
}

type CampoEditavel = keyof CamposEdicaoAcao;

// Ordem de verificação e de gravação dos campos (design, decisão 11).
const CAMPOS: CampoEditavel[] = ['descricao', 'prazo', 'prioridade', 'evidenciaObrigatoria'];

interface AcaoEditavel {
  codigo: string; status: string; descricao: string; prazo: string | Date; prioridade: string; evidenciaObrigatoria: boolean | number;
}

const ausente = (valor: unknown): boolean => valor === null || (typeof valor === 'string' && valor.trim() === '');

// Data civil como texto AAAA-MM-DD, qualquer que seja o tipo devolvido pelo driver.
const dataTexto = (valor: string | Date): string => (valor instanceof Date ? valor.toISOString() : valor).slice(0, 10);

/**
 * Ordem da decisão 11 do design: Código da Ação (400), bloqueio D9 (404), existência e pertencimento (404),
 * Tratativa alterável (409), Ação alterável R19 (409), campos (400), e gravação com histórico Edicao por campo alterado,
 * tudo na mesma transação. Chave ausente não altera o campo; reenviar o mesmo valor não gera histórico (CA72).
 */
export async function editarAcao(
  codigoTratativa: string,
  codigoAcao: string,
  campos: CamposEdicaoAcao,
  autor: Autor,
): Promise<void> {
  if (!codigoValido(codigoAcao)) recusar(400, 'Código inválido.', 'acao');
  validarAutor(autor);
  const tratativa = await bloquearTratativa(codigoTratativa);
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`)
      .columns('codigo', 'status', 'descricao', 'prazo', 'prioridade', 'evidenciaObrigatoria')
      .where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as AcaoEditavel | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');
  exigirAlteravel(tratativa);
  if (acao.status === 'Concluída' || acao.status === 'Cancelada') {
    recusar(409, `Ação ${acao.status} não pode ser alterada.`);
  }

  const atuais: Record<CampoEditavel, string | boolean> = {
    descricao: acao.descricao,
    prazo: dataTexto(acao.prazo),
    prioridade: acao.prioridade,
    evidenciaObrigatoria: Boolean(acao.evidenciaObrigatoria),
  };

  const novos: Partial<Record<CampoEditavel, string | boolean>> = {};
  for (const campo of CAMPOS) {
    const enviado = campos[campo];
    if (enviado === undefined) continue;
    if (campo === 'descricao') novos.descricao = validarDescricao(enviado);
    // Reenviar o Prazo já gravado não revalida contra hoje (CA20): só o formato é conferido.
    if (campo === 'prazo') novos.prazo = validarPrazo(enviado, enviado === atuais.prazo ? undefined : dataCivil(agora()));
    if (campo === 'prioridade') {
      if (ausente(enviado)) recusar(400, 'O campo Prioridade é obrigatório.', 'prioridade');
      novos.prioridade = validarPrioridade(enviado);
    }
    if (campo === 'evidenciaObrigatoria') {
      if (ausente(enviado)) recusar(400, 'O campo Evidência obrigatória é obrigatório.', 'evidenciaObrigatoria');
      novos.evidenciaObrigatoria = validarEvidenciaObrigatoria(enviado);
    }
  }

  const alterados = CAMPOS.filter((campo) => campo in novos && novos[campo] !== atuais[campo]);
  if (!alterados.length) return;

  const atualizacao: Record<string, string | boolean> = {};
  for (const campo of alterados) atualizacao[campo] = novos[campo] as string | boolean;

  const instante = agora();
  await cds.db.run(UPDATE(`${NS}.Acoes`).set(atualizacao).where({ codigo: codigoAcao }));

  // R23 (LGPD): a Descrição nunca é copiada para o histórico; evidência grava "sim" ou "não" (M-e).
  const texto = (campo: CampoEditavel, valor: string | boolean) =>
    campo === 'evidenciaObrigatoria' ? (valor ? 'sim' : 'não') : String(valor);
  const linhas: LinhaHistorico[] = alterados.map((campo) => ({
    evento: 'Edicao',
    campo,
    valorAnterior: campo === 'descricao' ? null : texto(campo, atuais[campo]),
    valorNovo: campo === 'descricao' ? null : texto(campo, novos[campo] as string | boolean),
  }));
  await registrarHistorico(codigoTratativa, autor, linhas, instante, codigoAcao);
}
