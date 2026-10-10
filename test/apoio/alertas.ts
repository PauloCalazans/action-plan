import cds from '@sap/cds';

export interface RelatorioRotinaAlertas {
  ocorrenciasAvaliadas: number;
  alertasGerados: number;
  notificacoesEnviadas: number;
  falhas: number;
}

function servicoOuOperacaoAindaNaoDisponivel(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return (
    /(?:no|cannot|could not|unknown|missing|does not exist|not found|didn't find a configuration for)[^\n]{0,120}RotinaAlertasService/i.test(mensagem)
    || /RotinaAlertasService[^\n]{0,120}(?:not found|does not exist|unknown|unavailable)/i.test(mensagem)
    || /unknown (?:event|operation|action)[^\n]{0,80}executar/i.test(mensagem)
  );
}

export async function executarRotinaAlertas(agora: string): Promise<RelatorioRotinaAlertas | undefined> {
  try {
    const rotina = await cds.connect.to('RotinaAlertasService');
    return await rotina.send('executar', { agora }) as RelatorioRotinaAlertas;
  } catch (erro) {
    if (servicoOuOperacaoAindaNaoDisponivel(erro)) return undefined;
    throw erro;
  }
}
