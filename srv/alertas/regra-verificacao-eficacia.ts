import { dataCivil } from '../lib/relogio';
import { lerSituacaoAval } from '../tratativa/aval-tecnico';
import { validadoresEfetivos } from '../tratativa/validador-tecnico';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface TratativaVerificacao {
  codigo: string;
  origemNormalizada?: string | null;
  responsavelPrincipal?: string;
}

export interface AlertaVerificacao {
  tipo: 'PrazoProximo' | 'PrazoVencido';
  entidade: 'VerificacaoEficacia';
  tratativa: string;
  destinatario: string;
  prazo: string;
}

function dataUtc(dia: string): number {
  return Date.parse(`${dia.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * R12, R20 d (016), DC-02, DC-04, DC-11: alertas de prazo da verificação de eficácia.
 * Etapa ativa: Tratativa apta a receber Aval (Em andamento, sem Ação aberta nem exigência pendente)
 * e sem Aval aprovado vigente. O prazo é calculado sob demanda por `lerSituacaoAval`.
 */
export async function avaliarVerificacaoEficacia(
  tratativas: TratativaVerificacao[],
  agora: Date,
  diasAntecedencia: number,
): Promise<AlertaVerificacao[]> {
  const situacoes = await lerSituacaoAval(tratativas.map((tratativa) => tratativa.codigo));
  const hoje = dataUtc(dataCivil(agora));
  const listas = new Map<string, Awaited<ReturnType<typeof validadoresEfetivos>>>();
  const alertas: AlertaVerificacao[] = [];

  for (const tratativa of tratativas) {
    const situacao = situacoes.get(tratativa.codigo);
    if (!situacao?.aptaParaEmissao || situacao.aprovadoVigente || !situacao.dataLimite) continue;

    const dias = (dataUtc(situacao.dataLimite) - hoje) / MS_POR_DIA;
    const tipo = dias < 0 ? 'PrazoVencido' : dias <= diasAntecedencia ? 'PrazoProximo' : undefined;
    if (!tipo) continue;

    const chave = tratativa.origemNormalizada ?? '';
    let efetivos = listas.get(chave);
    if (!efetivos) {
      efetivos = await validadoresEfetivos(tratativa.origemNormalizada ?? null);
      listas.set(chave, efetivos);
    }

    const destinatarios = efetivos.fonte === 'Nenhuma'
      ? [tratativa.responsavelPrincipal]
      : [...efetivos.lista, ...(tipo === 'PrazoVencido' ? [tratativa.responsavelPrincipal] : [])];
    for (const destinatario of new Set(destinatarios)) {
      if (destinatario) {
        alertas.push({ tipo, entidade: 'VerificacaoEficacia', tratativa: tratativa.codigo, destinatario, prazo: situacao.dataLimite });
      }
    }
  }
  return alertas;
}
