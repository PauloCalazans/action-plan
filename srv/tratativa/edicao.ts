import cds from '@sap/cds';
import { agora } from '../lib/relogio';
import type { Autor } from './abertura';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { registrarHistorico, validarAutor, type LinhaHistorico } from './historico';
import { normalizarTexto } from './normalizacao';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

export interface CamposEditaveis { titulo?: string | null; descricao?: string | null; unidade?: string | null; area?: string | null; solicitante?: string | null }

type Campo = keyof CamposEditaveis;

/** Ordem de verificação e gravação; nome e limite de cada campo (decisão 5). */
const CAMPOS: { campo: Campo; nome: string; max: number }[] = [
  { campo: 'titulo', nome: 'Título', max: 200 },
  { campo: 'descricao', nome: 'Descrição', max: 5000 },
  { campo: 'unidade', nome: 'Unidade', max: 100 },
  { campo: 'area', nome: 'Área', max: 100 },
  { campo: 'solicitante', nome: 'Solicitante', max: 50 },
];

/** R12-R15, R17: ausente não muda; null ou só espaços apaga (Título não pode); só o que mudou gera histórico. */
export async function editarTratativa(codigo: string, campos: CamposEditaveis, autor: Autor): Promise<void> {
  validarAutor(autor);
  const tratativa = await bloquearTratativa(codigo);
  exigirAlteravel(tratativa);

  const novos: Partial<Record<Campo, string | null>> = {};
  for (const { campo, nome, max } of CAMPOS) {
    if (!(campo in campos)) continue;
    const enviado = campos[campo];
    if (campo === 'titulo' && (typeof enviado !== 'string' || enviado.trim() === '')) {
      recusar(400, 'O campo Título é obrigatório.', 'titulo');
    }
    if (typeof enviado === 'string' && enviado.length > max) {
      recusar(400, `O campo ${nome} aceita no máximo ${max} caracteres.`, campo);
    }
    novos[campo] = typeof enviado !== 'string' || enviado.trim() === '' ? null : enviado;
  }

  const alterados = CAMPOS.filter(({ campo }) => campo in novos && novos[campo] !== tratativa[campo]).map(({ campo }) => campo);
  if (!alterados.length) return;

  const atualizacao: Record<string, string | null> = {};
  for (const campo of alterados) atualizacao[campo] = novos[campo] as string | null;
  if (alterados.includes('unidade')) atualizacao.unidadeNormalizada = normalizarTexto(novos.unidade);
  if (alterados.includes('area')) atualizacao.areaNormalizada = normalizarTexto(novos.area);
  await cds.db.run(UPDATE(`${NS}.Tratativas`).set(atualizacao).where({ codigo }));

  // R15: a Descrição nunca é copiada para o histórico.
  const linhas: LinhaHistorico[] = alterados.map((campo) => ({
    evento: 'Edicao',
    campo,
    valorAnterior: campo === 'descricao' ? null : tratativa[campo],
    valorNovo: campo === 'descricao' ? null : (novos[campo] as string | null),
  }));
  await registrarHistorico(codigo, autor, linhas, agora());
}
