import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import { agora, dataCivil } from '../lib/relogio';
import type { Autor } from './abertura';
import { criarAcaoComCausa, type DadosCriacaoAcao } from './acoes-criacao';
import { validarDescricao, validarEvidenciaObrigatoria, validarPrazo, validarPrioridade, validarResponsavel } from './acoes-validacao';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { normalizarMatricula, obterMatriculaUsuario, usuarioAutenticadoEhMatricula } from './identidade';
import { registrarHistorico, validarAutor } from './historico';
import { recusar } from './recusa';
import {
  validarCategoriaCausaRaiz,
  ferramentaHomologada,
  rotuloCausaMetodologia,
  validarDadosMetodologia,
  validarFerramentaMetodologia,
} from './metodologia-validacao';
import { tratativasComValidadorHabilitado } from './validador-tecnico';

const NS = 'br.com.calazanstec';

interface MetodologiaTratativa {
  codigo: string;
  metodologia: string | null;
  categoriaCausaRaiz: string | null;
  metodologiaData: string | null;
  metodologiaAutor: string | null;
  metodologiaAtualizadoEm: string | null;
}

interface LinhaAcaoResponsavel {
  tratativa_codigo: string;
  responsavel: string;
}

export interface DadosDefinicaoMetodologia {
  ferramenta?: unknown;
  categoriaCausaRaiz?: unknown;
  dados?: unknown;
  confirmarSubstituicao?: unknown;
}

export interface DadosDerivacaoMetodologia {
  causaIdentificador?: unknown;
  descricao?: unknown;
  responsavel?: unknown;
  prazo?: unknown;
  prioridade?: unknown;
  evidenciaObrigatoria?: unknown;
}

async function lerMetodologia(codigo: string): Promise<MetodologiaTratativa | undefined> {
  return cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`)
      .columns('codigo', 'metodologia', 'categoriaCausaRaiz', 'metodologiaData', 'metodologiaAutor', 'metodologiaAtualizadoEm')
      .where({ codigo }),
  );
}

async function podeEditar(req: Request, codigo: string): Promise<boolean> {
  if (req.user.is('GestorTratativa')) return true;
  const responsaveis = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`).columns('responsavel').where({ tratativa_codigo: codigo }),
  )) as Array<{ responsavel: string }>;
  return responsaveis.some((linha) => usuarioAutenticadoEhMatricula(req, linha.responsavel));
}

export async function definirMetodologia(
  req: Request,
  codigoTratativa: string,
  dados: DadosDefinicaoMetodologia,
  autor: Autor,
): Promise<void> {
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'codigo');
  validarAutor(autor);
  const codigo = codigoTratativa.toLowerCase();
  const tratativa = await bloquearTratativa(codigo);
  if (!(await podeEditar(req, codigo))) recusar(403, 'Acesso negado.');
  exigirAlteravel(tratativa);
  const atual = await lerMetodologia(codigo);
  const ferramentaSolicitada = dados.ferramenta == null || dados.ferramenta === '' ? null : dados.ferramenta;

  if (ferramentaSolicitada === null && !atual?.metodologia) {
    recusar(400, 'O campo Ferramenta é obrigatório.', 'ferramenta');
  }
  const homologada = typeof ferramentaSolicitada === 'string' && ferramentaHomologada(ferramentaSolicitada);
  if (
    atual?.metodologia &&
    (!homologada || ferramentaSolicitada !== atual.metodologia) &&
    dados.confirmarSubstituicao !== true
  ) {
    recusar(409, 'Tratativa já possui metodologia associada: confirme a substituição para alterar.');
  }
  const ferramenta = ferramentaSolicitada === null ? null : validarFerramentaMetodologia(ferramentaSolicitada);

  let categoriaCausaRaiz: string | null = null;
  let metodologiaData: string | null = null;
  if (ferramenta) {
    categoriaCausaRaiz = validarCategoriaCausaRaiz(dados.categoriaCausaRaiz);
    metodologiaData = JSON.stringify(validarDadosMetodologia(ferramenta, dados.dados));
  }

  const instante = agora();
  await cds.db.run(
    UPDATE(`${NS}.Tratativas`)
      .set({
        metodologia: ferramenta,
        categoriaCausaRaiz,
        metodologiaData,
        metodologiaAutor: autor.id,
        metodologiaAtualizadoEm: instante.toISOString(),
      })
      .where({ codigo }),
  );
  const evento = ferramenta === null || atual?.metodologia === ferramenta
    ? 'EdicaoMetodologia'
    : 'DefinicaoMetodologia';
  await registrarHistorico(
    codigo,
    autor,
    [{
      evento,
      campo: 'metodologia',
      valorAnterior: atual?.metodologia ?? null,
      valorNovo: ferramenta,
    }],
    instante,
  );
}

export async function consultarMetodologia(
  req: Request,
  codigoTratativa: string | null | undefined,
): Promise<{
  metodologia: string | null;
  categoriaCausaRaiz: string | null;
  dados: Record<string, string> | null;
  autor: string | null;
  atualizadoEm: string | null;
}> {
  if (typeof codigoTratativa !== 'string' || !codigoValido(codigoTratativa)) {
    recusar(400, 'Código inválido.', 'codigoTratativa');
  }
  const codigo = (codigoTratativa as string).toLowerCase();
  const atual = await lerMetodologia(codigo);
  if (!atual) recusar(404, 'Tratativa não encontrada.');
  const vinculadas = await tratativasComVinculoDiagnostico(req, [codigo]);
  let dados: Record<string, string> | null = null;
  if (vinculadas.has(codigo) && atual.metodologia && atual.metodologiaData) {
    dados = JSON.parse(atual.metodologiaData) as Record<string, string>;
  }
  return {
    metodologia: atual.metodologia,
    categoriaCausaRaiz: atual.categoriaCausaRaiz,
    dados,
    autor: req.user.is('GestorTratativa') ? atual.metodologiaAutor : null,
    atualizadoEm: atual.metodologiaAtualizadoEm,
  };
}

export async function derivarAcaoDaMetodologia(
  req: Request,
  codigoTratativa: string,
  dados: DadosDerivacaoMetodologia,
  autor: Autor,
): Promise<{ codigo: string }> {
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'codigo');
  validarAutor(autor);
  const codigo = codigoTratativa.toLowerCase();
  const tratativa = await bloquearTratativa(codigo);
  if (!req.user.is('GestorTratativa')) recusar(403, 'Acesso negado.');
  exigirAlteravel(tratativa);
  const metodologia = await lerMetodologia(codigo);
  if (!metodologia?.metodologia || !metodologia.metodologiaData) {
    recusar(409, 'Tratativa não possui metodologia associada.');
  }
  if (typeof dados.causaIdentificador !== 'string' || !dados.causaIdentificador.trim()) {
    recusar(400, 'Causa de origem inválida.', 'causaIdentificador');
  }
  const analise = JSON.parse(metodologia.metodologiaData) as Record<string, string>;
  const identificador = (dados.causaIdentificador as string).trim();
  const causaDescricao = analise[identificador];
  if (typeof causaDescricao !== 'string' || causaDescricao.trim() === '') {
    recusar(400, 'Causa de origem não encontrada na metodologia.', 'causaIdentificador');
  }

  const hoje = dataCivil(agora());
  const evidenciaObrigatoria = validarEvidenciaObrigatoria(dados.evidenciaObrigatoria) ? 'sim' : 'não';
  const acao: DadosCriacaoAcao = {
    descricao: validarDescricao(dados.descricao),
    responsavel: validarResponsavel(dados.responsavel),
    prazo: validarPrazo(dados.prazo, hoje),
    prioridade: validarPrioridade(dados.prioridade),
    evidenciaObrigatoria,
  };
  return criarAcaoComCausa(
    codigo,
    acao,
    { identificador, descricao: causaDescricao, rotulo: rotuloCausaMetodologia(metodologia.metodologia, identificador) },
    { id: obterMatriculaUsuario(req), tipo: 'Usuario' },
  );
}

export async function tratativasComVinculoDiagnostico(req: Request, codigos: string[]): Promise<Set<string>> {
  const ids = [...new Set(codigos)];
  if (!ids.length) return new Set();
  const tratativas = (await cds.db.run(
    SELECT.from(`${NS}.Tratativas`).columns('codigo').where({ codigo: { in: ids } }),
  )) as Array<{ codigo: string }>;
  const existentes = new Set(tratativas.map((linha) => linha.codigo));
  if (req.user.is('GestorTratativa')) return existentes;

  const matricula = normalizarMatricula(req.user.id);
  const [acoes, comoValidador] = await Promise.all([
    cds.db.run(
      SELECT.from(`${NS}.Acoes`)
        .columns('tratativa_codigo', 'responsavel')
        .where({ tratativa_codigo: { in: [...existentes] } }),
    ) as Promise<LinhaAcaoResponsavel[]>,
    tratativasComValidadorHabilitado(req, [...existentes]),
  ]);
  const vinculadas = new Set(comoValidador);
  for (const acao of acoes) {
    if (normalizarMatricula(acao.responsavel) === matricula) vinculadas.add(acao.tratativa_codigo);
  }
  return new Set([...vinculadas].filter((codigo) => existentes.has(codigo)));
}
