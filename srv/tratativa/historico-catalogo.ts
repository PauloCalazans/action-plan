// R2, R10 (spec historico-e-auditoria): catálogo canônico de origens e eventos do histórico unificado.
// Mapeamento estrito sem renomeação nem modificação de dados gravados (design, decisão 4).
// Nenhum nome de Origem de app (ex.: SESMT) é codificado aqui — isto é só o catálogo de ORIGEM INTERNA
// (Tratativa, Acao, Responsaveis, Evidencia, Comentario), que é estrutural ao domínio e não de parametrização.

/** Origens internas do histórico unificado (R2). */
export type OrigemHistorico = 'Tratativa' | 'Acao' | 'Responsaveis' | 'Evidencia' | 'Comentario';

/** Nomes canônicos de evento por Origem, na ordem alfabética usada no desempate (N3-5). */
export const CATALOGO_EVENTOS: Record<OrigemHistorico, string[]> = {
  Tratativa: [
    'Criacao',
    'AlteracaoCriticidade',
    'DefinicaoMetodologia',
    'EdicaoMetodologia',
    'EmissaoAvalTecnico',
    'MudancaStatus',
    'Encerramento',
    'Reabertura',
    'Cancelamento',
    'Edicao',
  ],
  Acao: ['Criacao', 'CriacaoAcaoComCausa', 'MudancaStatus', 'Conclusao', 'Reabertura', 'Cancelamento', 'Edicao'],
  Responsaveis: [
    'AtribuicaoResponsavelPrincipal',
    'ReatribuicaoResponsavelPrincipal',
    'InclusaoParticipante',
    'RemocaoParticipante',
    'DelegacaoAcao',
  ],
  Evidencia: ['InclusaoEvidencia', 'RemocaoEvidencia', 'DownloadEvidencia'],
  Comentario: ['InclusaoComentario'],
};

/** Lista plana de todos os nomes canônicos de evento, para validação do filtro `tipoEvento` (etapa 2). */
export function todosEventosCanonicos(): string[] {
  return Object.values(CATALOGO_EVENTOS).flat();
}

/**
 * Normaliza o nome do evento persistido para o nome canônico do catálogo (design, decisão 4).
 * `HistoricoTratativa` grava `Atribuicao`/`Reatribuicao`; `HistoricoAcoes` grava `Delegacao`.
 * Os demais eventos já são gravados com o nome canônico.
 */
const RENOMEIO_CANONICO: Record<string, string> = {
  Atribuicao: 'AtribuicaoResponsavelPrincipal',
  Reatribuicao: 'ReatribuicaoResponsavelPrincipal',
  Delegacao: 'DelegacaoAcao',
};

export function nomeCanonico(eventoPersistido: string): string {
  return RENOMEIO_CANONICO[eventoPersistido] ?? eventoPersistido;
}

/** Determina a Origem canônica de um evento de `HistoricoTratativa` (sem Ação) pelo nome canônico. */
export function origemDoEventoTratativa(eventoCanonico: string): OrigemHistorico {
  if (eventoCanonico === 'InclusaoComentario') return 'Comentario';
  if (
    eventoCanonico === 'AtribuicaoResponsavelPrincipal' ||
    eventoCanonico === 'ReatribuicaoResponsavelPrincipal' ||
    eventoCanonico === 'InclusaoParticipante' ||
    eventoCanonico === 'RemocaoParticipante'
  ) {
    return 'Responsaveis';
  }
  return 'Tratativa';
}

/** Determina a Origem canônica de um evento de `HistoricoAcoes` (vinculado a uma Ação) pelo nome canônico. */
export function origemDoEventoAcao(eventoCanonico: string): OrigemHistorico {
  if (eventoCanonico === 'InclusaoComentario') return 'Comentario';
  if (eventoCanonico === 'DelegacaoAcao') return 'Responsaveis';
  if (
    eventoCanonico === 'InclusaoEvidencia' ||
    eventoCanonico === 'RemocaoEvidencia' ||
    eventoCanonico === 'DownloadEvidencia'
  ) {
    return 'Evidencia';
  }
  return 'Acao';
}
