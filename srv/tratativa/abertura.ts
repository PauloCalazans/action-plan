import cds from '@sap/cds';
import { agora, dataCivil } from '../lib/relogio';
import { validarAbertura } from './validacao';
import { buscarPorPar, reservarPar } from './chave-origem';
import { normalizarTexto } from './normalizacao';
import { diasDoPrazo, somarDiasCorridos } from './prazo';

export type TipoAutor = 'Aplicativo' | 'Usuario' | 'Sistema';
export interface Autor { id: string; tipo: TipoAutor }
export interface DadosAbertura {
  origem?: string | null; idOrigem?: string | null; titulo?: string | null; criticidade?: string | null;
  descricao?: string | null; unidade?: string | null; area?: string | null; solicitante?: string | null;
}

const NS = 'br.com.calazanstec';

/** Único ponto de entrada de abertura de Tratativa (design, decisão 6). */
export async function abrirTratativa(dados: DadosAbertura, autor: Autor): Promise<{ codigo: string }> {
  validarAbertura(dados, autor.tipo === 'Aplicativo');
  const codigo = cds.utils.uuid();
  const instante = agora();
  const dataCriacao = dataCivil(instante);
  const criticidade = dados.criticidade as string;
  const dataPrevistaConclusao = somarDiasCorridos(dataCriacao, await diasDoPrazo(criticidade));

  // R4/R16: com par, a chave primária de ChavesOrigem decide; repetição devolve o existente sem gravar nada.
  if (dados.origem && dados.idOrigem) {
    const existente = await buscarPorPar(dados.origem, dados.idOrigem);
    if (existente) return { codigo: existente };
    if (!(await reservarPar(dados.origem, dados.idOrigem, codigo))) {
      return { codigo: (await buscarPorPar(dados.origem, dados.idOrigem)) as string };
    }
  }

  await cds.db.run(
    INSERT.into(`${NS}.Tratativas`).entries({
      codigo,
      origem: dados.origem,
      idOrigem: dados.idOrigem,
      titulo: dados.titulo,
      descricao: dados.descricao,
      unidade: dados.unidade,
      area: dados.area,
      solicitante: dados.solicitante,
      origemNormalizada: normalizarTexto(dados.origem),
      unidadeNormalizada: normalizarTexto(dados.unidade),
      areaNormalizada: normalizarTexto(dados.area),
      criticidade,
      status: 'Aberta',
      dataCriacao,
      dataPrevistaConclusao,
      criadoEm: instante.toISOString(),
    }),
  );
  await cds.db.run(
    INSERT.into(`${NS}.HistoricoTratativa`).entries({
      ID: cds.utils.uuid(),
      tratativa_codigo: codigo,
      evento: 'Criacao',
      autor: autor.id,
      tipoAutor: autor.tipo,
      quando: instante.toISOString(),
    }),
  );
  return { codigo };
}
