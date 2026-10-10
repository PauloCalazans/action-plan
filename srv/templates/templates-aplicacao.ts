import cds from '@sap/cds';
import type { Autor } from '../tratativa/abertura';
import { bloquearTratativa } from '../tratativa/bloqueio';
import { recusar } from '../tratativa/recusa';
import { registrarHistorico } from '../tratativa/historico';
import { validarMatricula } from '../tratativa/validacao-matricula';
import { agora } from '../lib/relogio';
import { idValido } from './templates-cadastro';

const NS = 'br.com.calazanstec';

export interface AtribuicaoItemEntrada {
  ordem?: number;
  responsavel?: string;
}

export interface DadosAplicacaoTemplate {
  template?: string;
  responsavelPadrao?: string;
  atribuicoes?: AtribuicaoItemEntrada[];
}

interface TemplateCabecalho {
  id: string;
  nome: string;
  ativo: boolean;
}

interface ItemTemplatePersistido {
  id: string;
  ordem: number;
  descricao: string;
  prioridade: string;
  evidenciaObrigatoria: boolean;
  prazoRelativoDias: number;
  ordemPai: number | null;
}

/**
 * R7(f), M11 (spec templates-de-acoes): data civil `AAAA-MM-DD` em UTC, independente do fuso da
 * plataforma, somando `dias` ao instante informado (cálculo de prazo da aplicação de template).
 */
function dataCivilUtcMaisDias(instante: Date, dias: number): string {
  const base = Date.UTC(instante.getUTCFullYear(), instante.getUTCMonth(), instante.getUTCDate());
  const alvo = new Date(base + dias * 86400000);
  const ano = alvo.getUTCFullYear();
  const mes = String(alvo.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(alvo.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

async function buscarTemplate(id: string): Promise<TemplateCabecalho | undefined> {
  return cds.db.run(SELECT.one.from(`${NS}.Templates`).columns('id', 'nome', 'ativo').where({ id }));
}

async function buscarItens(templateId: string): Promise<ItemTemplatePersistido[]> {
  return cds.db.run(
    SELECT.from(`${NS}.ItensTemplate`)
      .columns('id', 'ordem', 'descricao', 'prioridade', 'evidenciaObrigatoria', 'prazoRelativoDias', 'ordemPai')
      .where({ template_id: templateId })
      .orderBy('ordem ASC'),
  ) as Promise<ItemTemplatePersistido[]>;
}

/** R6, R15 (spec templates-de-acoes): valida responsavelPadrao e atribuicoes (etapa 8). */
function resolverResponsaveis(
  itens: ItemTemplatePersistido[],
  responsavelPadrao: unknown,
  atribuicoes: unknown,
): Map<number, string> {
  const padrao = validarMatricula(responsavelPadrao, 'responsavelPadrao');

  const porOrdem = new Map<number, string>();
  for (const item of itens) porOrdem.set(item.ordem, padrao);

  if (atribuicoes === undefined || atribuicoes === null) return porOrdem;
  if (!Array.isArray(atribuicoes)) return porOrdem;

  const ordensValidas = new Set(itens.map((i) => i.ordem));
  const ordensVistas = new Set<number>();
  for (const atribuicao of atribuicoes as AtribuicaoItemEntrada[]) {
    const ordem = Number(atribuicao?.ordem);
    const responsavel = validarMatricula(atribuicao?.responsavel, 'atribuicoes');
    if (ordensVistas.has(ordem)) {
      recusar(400, 'Ordem de atribuição duplicada.', 'atribuicoes');
    }
    ordensVistas.add(ordem);
    if (!ordensValidas.has(ordem)) {
      recusar(400, 'Item de template inválido.', 'atribuicoes');
    }
    porOrdem.set(ordem, responsavel);
  }
  return porOrdem;
}

/**
 * R5-R11, R13, R15(a), R16 (spec templates-de-acoes): aplica Template de Ações na Tratativa.
 * Ordem: bloqueio D9 (404 Tratativa), existência do Template (404), estado da Tratativa (409),
 * estado do Template (409), responsáveis (400), persistência prioritária das Ações mãe antes das
 * Subações, histórico `Criacao` por Ação (sem Descrição, com metadado do template), tudo atômico.
 */
export async function aplicarTemplateTratativa(
  codigoTratativa: string,
  dados: DadosAplicacaoTemplate,
): Promise<{ totalAcoesCriadas: number }> {
  if (typeof dados.template !== 'string' || !idValido(dados.template)) {
    recusar(400, 'Código inválido.', 'template');
  }

  // D9: bloqueio pessimista da Tratativa antes de qualquer consulta ao Template.
  const tratativa = await bloquearTratativa(codigoTratativa);

  const template = await buscarTemplate(dados.template);
  if (!template) {
    recusar(404, 'Template não encontrado.', 'template');
  }

  // R9 (spec templates-de-acoes): Tratativa Encerrada ou Cancelada não aceita aplicação de Template
  // (409, target 'status'; o helper exigirAlteravel compartilhado não anota target, por isso o
  // check é refeito aqui para cumprir o contrato específico desta action, CA20).
  if (tratativa.status === 'Encerrada' || tratativa.status === 'Cancelada') {
    recusar(409, `Tratativa ${tratativa.status} não pode ser alterada.`, 'status');
  }

  if (!template.ativo) {
    recusar(409, 'Template inativo não pode ser aplicado.', 'template');
  }

  const itens = await buscarItens(template.id);
  const responsavelPorOrdem = resolverResponsaveis(itens, dados.responsavelPadrao, dados.atribuicoes);

  // R7(f): data base da aplicação em UTC; cada item recebe prazo estritamente posterior a hoje.
  const baseInstante = agora();

  // R7(h), I5: Ações mãe (ordemPai null) antes das Subações; carimbos criadoEm distintos e crescentes
  // na ordem do template, preservando a sequência na consulta analítica (004 R25).
  const maes = itens.filter((i) => i.ordemPai === null);
  const filhas = itens.filter((i) => i.ordemPai !== null);

  const codigoPorOrdem = new Map<number, string>();
  const linhasAcao: Record<string, unknown>[] = [];

  function montarLinhaAcao(item: ItemTemplatePersistido, acaoMaeCodigo: string | null): string {
    const codigo = cds.utils.uuid();
    codigoPorOrdem.set(item.ordem, codigo);
    const instanteItem = new Date(baseInstante.getTime() + item.ordem * 1000);
    linhasAcao.push({
      codigo,
      tratativa_codigo: codigoTratativa,
      acaoMae_codigo: acaoMaeCodigo,
      descricao: item.descricao,
      responsavel: responsavelPorOrdem.get(item.ordem) as string,
      prazo: dataCivilUtcMaisDias(baseInstante, item.prazoRelativoDias),
      prioridade: item.prioridade,
      status: 'Pendente',
      evidenciaObrigatoria: item.evidenciaObrigatoria,
      dataConclusao: null,
      criadoEm: instanteItem.toISOString(),
    });
    return codigo;
  }

  for (const mae of maes) montarLinhaAcao(mae, null);
  for (const filha of filhas) {
    const codigoMae = codigoPorOrdem.get(filha.ordemPai as number) as string;
    montarLinhaAcao(filha, codigoMae);
  }

  await cds.db.run(INSERT.into(`${NS}.Acoes`).entries(linhasAcao));

  // R11, LGPD (004 R23): histórico Criacao por Ação gerada, com metadado do template e sem Descrição.
  // Autor da Criacao é a matrícula do Responsável atribuído à própria Ação (impessoalidade do Template,
  // R6; cada Ação pode ter responsável distinto via atribuicoes), com tipoAutor Usuario.
  for (const linha of linhasAcao) {
    const codigoAcao = linha.codigo as string;
    const quando = new Date(linha.criadoEm as string);
    const autorAcao: Autor = { id: linha.responsavel as string, tipo: 'Usuario' };
    await registrarHistorico(
      codigoTratativa,
      autorAcao,
      [{ evento: 'Criacao', template: template.id, templateNome: template.nome }],
      quando,
      codigoAcao,
    );
  }

  return { totalAcoesCriadas: linhasAcao.length };
}
