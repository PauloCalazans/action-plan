import cds from '@sap/cds';
import { randomUUID } from 'node:crypto';
import { avaliarAlertas, type AlertaGerado } from './motor-regras';
import { consultarParametrosAlertas } from './parametros';

const ALERTAS_EMITIDOS = 'br.com.calazanstec.AlertasEmitidos';

function obterCanaisProcessamento(parametros: { emailHabilitado: boolean; teamsHabilitado: boolean }): Array<'Email' | 'Teams'> {
  return [
    ...(parametros.emailHabilitado ? ['Email' as const] : []),
    ...(parametros.teamsHabilitado ? ['Teams' as const] : []),
  ];
}

export interface RelatorioProcessamentoAlertas {
  ocorrenciasAvaliadas: number;
  alertasGerados: number;
  notificacoesEnviadas: number;
  falhas: number;
}

function formatarDataUtc(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function formatarPrazoUtc(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarTipoAlerta(tipo: AlertaGerado['tipo']): string {
  const tipos: Record<AlertaGerado['tipo'], string> = {
    PrazoProximo: 'Prazo Próximo',
    PrazoVencido: 'Prazo Vencido',
    Inatividade: 'Inatividade',
    EvidenciaPendente: 'Evidência Pendente',
  };
  return tipos[tipo];
}

function montarMensagem(alerta: Pick<AlertaGerado, 'tipo' | 'entidade' | 'tratativa' | 'acao' | 'destinatario'>, titulo: string, prazo: Date, url: string): { assunto: string; corpo: string } {
  const acao = alerta.acao ? `Ação: ${alerta.acao}\n` : '';
  const tipo = formatarTipoAlerta(alerta.tipo);
  const assunto = `${tipo} - ${alerta.tratativa}`;
  const corpo = [
    `Tipo: ${tipo}`,
    `Tratativa: ${alerta.tratativa}`,
    `Título: ${titulo}`,
    acao.trim() ? acao.trim() : undefined,
    `Prazo: ${formatarPrazoUtc(prazo)}`,
    `URL: ${url}`,
  ].filter(Boolean).join('\n');
  return { assunto, corpo };
}

async function registrarEmissao(registro: {
  tipo: string;
  entidade: string;
  tratativa: string;
  acao?: string;
  destinatario: string;
  canal: 'Email' | 'Teams';
  enviadoEm: Date;
  statusEnvio: 'Sucesso' | 'Falha';
  motivoFalha?: string;
  dadosAlerta?: string;
}) {
  await cds.db.run(INSERT.into(ALERTAS_EMITIDOS).entries({
    id: randomUUID(),
    tipo: registro.tipo,
    entidade: registro.entidade,
    tratativa_codigo: registro.tratativa,
    acao_codigo: registro.acao ?? null,
    destinatario: registro.destinatario,
    canal: registro.canal,
    enviadoEm: registro.enviadoEm.toISOString(),
    statusEnvio: registro.statusEnvio,
    motivoFalha: registro.motivoFalha ?? null,
    dadosAlerta: registro.dadosAlerta ?? null,
  }));
}

async function jaFoiEnviadoComSucessoNoDia(
  alerta: { tipo: string; entidade: string; tratativa: string; acao?: string; destinatario: string },
  canal: 'Email' | 'Teams',
  agora: Date,
): Promise<boolean> {
  const registros = await cds.db.run(SELECT.from(ALERTAS_EMITIDOS).columns('id', 'enviadoEm', 'statusEnvio').where({
    tipo: alerta.tipo,
    entidade: alerta.entidade,
    tratativa_codigo: alerta.tratativa,
    acao_codigo: alerta.acao ?? null,
    destinatario: alerta.destinatario,
    canal,
  })) as Array<{ id: string; enviadoEm: string; statusEnvio: 'Sucesso' | 'Falha' }>;

  const dataRef = formatarDataUtc(agora);
  return registros.some((registro) =>
    registro.statusEnvio === 'Sucesso'
    && formatarDataUtc(new Date(registro.enviadoEm)) === dataRef,
  );
}

async function resolverDestinatario(matricula: string): Promise<{ email: string; teamsId: string } | null> {
  const diretorio = await cds.connect.to('DiretorioPessoasAdapter');
  const pessoa = await diretorio.send('resolverPessoa', { matricula }) as { email?: string; teamsId?: string } | null;
  if (!pessoa || !pessoa.email || !pessoa.teamsId) return null;
  return { email: pessoa.email, teamsId: pessoa.teamsId };
}

async function enviarCanal(
  canal: 'Email' | 'Teams',
  destinatario: string,
  assunto: string,
  corpo: string,
): Promise<void> {
  if (canal === 'Email') {
    const email = await cds.connect.to('EmailAdapter');
    await email.send('enviarEmail', { destinatario, assunto, corpo });
    return;
  }

  const teams = await cds.connect.to('TeamsAdapter');
  await teams.send('enviarMensagem', { destinatarioTeamsId: destinatario, titulo: assunto, corpo });
}

export async function processarAlertas(agora: Date): Promise<RelatorioProcessamentoAlertas> {
  const chavesProcessadas = new Set<string>();
  const parametros = await consultarParametrosAlertas();
  const avaliacao = await avaliarAlertas(agora);
  const relatorio: RelatorioProcessamentoAlertas = {
    ocorrenciasAvaliadas: avaliacao.ocorrenciasAvaliadas,
    alertasGerados: avaliacao.alertas.length,
    notificacoesEnviadas: 0,
    falhas: 0,
  };

  const tratarivaResumo = new Map<string, { titulo: string; dataPrevistaConclusao: string }>();
  const acoesResumo = new Map<string, { prazo: string }>();

  for (const alerta of avaliacao.alertas) {
    if (!tratarivaResumo.has(alerta.tratativa)) {
      const tratativa = await cds.db.run(SELECT.one.from('br.com.calazanstec.Tratativas').columns('titulo', 'dataPrevistaConclusao').where({ codigo: alerta.tratativa })) as { titulo?: string; dataPrevistaConclusao?: string } | undefined;
      if (tratativa) {
        tratarivaResumo.set(alerta.tratativa, {
          titulo: tratativa.titulo ?? 'Tratativa',
          dataPrevistaConclusao: tratativa.dataPrevistaConclusao ?? agora.toISOString(),
        });
      }
    }

    if (alerta.acao && !acoesResumo.has(alerta.acao)) {
      const acao = await cds.db.run(SELECT.one.from('br.com.calazanstec.Acoes').columns('prazo').where({ codigo: alerta.acao })) as { prazo?: string } | undefined;
      if (acao) {
        acoesResumo.set(alerta.acao, { prazo: acao.prazo ?? agora.toISOString() });
      }
    }

    const tratativa = tratarivaResumo.get(alerta.tratativa) ?? { titulo: 'Tratativa', dataPrevistaConclusao: agora.toISOString() };
    const prazoBase = alerta.acao ? (acoesResumo.get(alerta.acao)?.prazo ?? tratativa.dataPrevistaConclusao) : tratativa.dataPrevistaConclusao;
    const dataPrazo = new Date(`${prazoBase}T00:00:00.000Z`);
    const url = `https://plataforma.empresa.com/tratativas/${alerta.tratativa}`;

    const canais = obterCanaisProcessamento(parametros);

    for (const canal of canais) {
      const chave = `${alerta.tipo}|${alerta.entidade}|${alerta.tratativa}|${alerta.acao ?? ''}|${alerta.destinatario}|${canal}|${formatarDataUtc(agora)}`;
      if (chavesProcessadas.has(chave) || await jaFoiEnviadoComSucessoNoDia(alerta, canal, agora)) {
        continue;
      }

      const pessoa = await resolverDestinatario(alerta.destinatario);
      if (!pessoa) {
        await registrarEmissao({
          tipo: alerta.tipo,
          entidade: alerta.entidade,
          tratativa: alerta.tratativa,
          acao: alerta.acao,
          destinatario: alerta.destinatario,
          canal,
          enviadoEm: agora,
          statusEnvio: 'Falha',
          motivoFalha: 'Destinatário não resolvido',
          dadosAlerta: JSON.stringify({ tipo: alerta.tipo, titulo: tratativa.titulo, prazo: formatarPrazoUtc(dataPrazo), url }),
        });
        relatorio.falhas += 1;
        continue;
      }

      const destinatario = canal === 'Email' ? pessoa.email : pessoa.teamsId;
      const mensagem = montarMensagem(alerta, tratativa.titulo, dataPrazo, url);

      try {
        await enviarCanal(canal, destinatario, mensagem.assunto, mensagem.corpo);
        await registrarEmissao({
          tipo: alerta.tipo,
          entidade: alerta.entidade,
          tratativa: alerta.tratativa,
          acao: alerta.acao,
          destinatario: alerta.destinatario,
          canal,
          enviadoEm: agora,
          statusEnvio: 'Sucesso',
          dadosAlerta: JSON.stringify({ tipo: alerta.tipo, titulo: tratativa.titulo, prazo: formatarPrazoUtc(dataPrazo), url }),
        });
        chavesProcessadas.add(chave);
        relatorio.notificacoesEnviadas += 1;
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : 'Erro de envio indisponível';
        await registrarEmissao({
          tipo: alerta.tipo,
          entidade: alerta.entidade,
          tratativa: alerta.tratativa,
          acao: alerta.acao,
          destinatario: alerta.destinatario,
          canal,
          enviadoEm: agora,
          statusEnvio: 'Falha',
          motivoFalha: motivo,
          dadosAlerta: JSON.stringify({ tipo: alerta.tipo, titulo: tratativa.titulo, prazo: formatarPrazoUtc(dataPrazo), url }),
        });
        relatorio.falhas += 1;
      }
    }
  }

  return relatorio;
}
