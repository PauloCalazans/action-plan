import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { sufixoUnico, type Envia, type Resposta, criarAvulsa, abrirPorApp } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';
import { mudarStatusAcao, criarAcao, criarSubacao } from './apoio/acoes';
import { delegarAcao } from './apoio/responsaveis';
import { linhas } from './apoio/banco';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';

const { POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
jest.setTimeout(60000);

const ACOES = 'Acoes';
const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const HOJE = '2026-10-08';
const PRAZO = '2026-11-07';

let espiao: Espiao;
beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});
beforeEach(() => fixarInstante(`${HOJE}T12:00:00Z`));
afterEach(() => {
  liberarRelogio();
  espiao.naoFalhar();
});

// Tipado solto: as linhas do banco têm campos de tipos variados; cada teste confere o campo que usa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Linha = Record<string, any>;

// Helper para usuário M1001 (compatível com CI para teste CA10)
const comoM1001 = (username: string) => ({ auth: { username, password: '' }, validateStatus: () => true });

async function criarTratativaAberta(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta', ...dados });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function criarTratativaApp(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await abrirPorApp(enviar, { origem: 'Advertência', idOrigem: `ADV-${sufixoUnico()}`, titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta', ...dados });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

const acaoDe = async (codigo: string): Promise<Linha> => (await linhas(ACOES, { codigo }))[0];
const statusAcao = async (codigo: string) => (await acaoDe(codigo)).status;
const historicoAcao = (acao: string): Promise<Linha[]> => linhas('HistoricoAcoes', { acao_codigo: acao });

async function acao(t: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAcao(enviar, t, { descricao: 'Ação', responsavel: 'M1001', prazo: PRAZO, ...extra }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function sub(t: string, mae: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await criarSubacao(enviar, t, { descricao: 'Subação', acaoMae: mae, responsavel: 'M2002', prazo: PRAZO, ...extra }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

const mudar = (t: string, acaoCodigo: unknown, corpo: Record<string, unknown>, como: unknown = comoGestor) =>
  mudarStatusAcao(enviar, t, { acao: acaoCodigo, ...corpo }, como);

async function leva(t: string, acaoCodigo: string, status: string, justificativa?: string) {
  const corpo: Record<string, unknown> = { status };
  // Cancelamento exige justificativa (R7, R8 da spec 005)
  if (status === 'Cancelada' && !justificativa) {
    // Sem justificativa para Cancelada, espera-se erro 400
    const r = await mudar(t, acaoCodigo, corpo);
    expect(r.status).toBe(400);
    return;
  }
  if (justificativa) corpo.justificativa = justificativa;
  const r = await mudar(t, acaoCodigo, corpo);
  expect(r.status).toBe(204);
}

async function recusaAcao(t: string, acaoCodigo: string, corpo: Record<string, unknown>, http: number, target: string | undefined, mensagem: string) {
  const antes = await statusAcao(acaoCodigo);
  const contagem = (await historicoAcao(acaoCodigo)).length;
  const r = await mudar(t, acaoCodigo, corpo);
  expect(r.status).toBe(http);
  if (target !== undefined) expect(r.data.error?.target).toBe(target);
  expect(r.data.error?.message).toBe(mensagem);
  expect(await statusAcao(acaoCodigo)).toBe(antes);
  expect((await historicoAcao(acaoCodigo)).length).toBe(contagem);
}

const TRATATIVA_ENCERRADA = 'Tratativa Encerrada não pode ser alterada.';
const TRANSICAO_NAO_PERMITIDA_EM_ANDAMENTO = 'Transição não permitida: de Em andamento para Em andamento.';
const TRANSICAO_NAO_PERMITIDA_CONCLUIDA_CONCLUIDA = 'Transição não permitida: de Concluída para Concluída.';
const TRANSICAO_NAO_PERMITIDA_CANCELADA_CONCLUIDA = 'Transição não permitida: de Cancelada para Concluída.';
const SUBACOES_NAO_CONCLUIDAS = 'A Ação possui Subações não concluídas nem canceladas.';

describe('Etapa 3 - Autorização Dinâmica para Iniciar e Concluir Ação (R11, R16, R28)', () => {
  describe('CA10: usuário autenticado com ID "m1001" inicia Ação de "M1001" (comparação sem caixa)', () => {
    it('usuário "m1001" pode iniciar Ação criada com Responsável "M1001"', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
    });
  });

  describe('CA11: usuário "M2002" tenta iniciar Ação de "M1001" → 403 Forbidden', () => {
    it('usuário M2002 recebe 403', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m2002'));
      expect(r.status).toBe(403);
    });
  });

  describe('CA12: identidade técnica mockada "app-origem-a" autenticada não executa Ação', () => {
    it('app-origem-a recebe 403', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'app-origem-a' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoApp);
      expect(r.status).toBe(403);
    });
  });

  describe('CA37: Responsável inicia Ação Pendente → Em andamento', () => {
    it('inicia com sucesso e grava histórico MudancaStatus', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
      expect(await statusAcao(acaoCodigo)).toBe('Em andamento');
      const historico = await historicoAcao(acaoCodigo);
      expect(historico.some((h) => h.evento === 'MudancaStatus')).toBe(true);
    });
  });

  describe('CA38: Responsável conclui Ação Em andamento → Concluída, data de conclusão preenchida', () => {
    it('conclui e preenche dataConclusao com data corrente', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await leva(tratativa, acaoCodigo, 'Em andamento');
      const r = await mudar(tratativa, acaoCodigo, { status: 'Concluída' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
      const acao_atual = await acaoDe(acaoCodigo);
      expect(acao_atual.status).toBe('Concluída');
      expect(acao_atual.dataConclusao).toBeTruthy();
    });
  });

  describe('CA39: Responsável conclui Ação Pendente direto sem iniciar', () => {
    it('aceito diretamente de Pendente para Concluída', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Concluída' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
      expect(await statusAcao(acaoCodigo)).toBe('Concluída');
    });
  });

  describe('CA40, CA108: Responsável tenta pedir destino "Em andamento" para Ação Concluída/Cancelada', () => {
    it('de Concluída para Em andamento recusa com 403 etapa 6', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await leva(tratativa, acaoCodigo, 'Concluída');
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(403);
    });

    it('de Cancelada para Em andamento recusa com 403 etapa 6', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await leva(tratativa, acaoCodigo, 'Cancelada', 'Cancelada conforme regra');
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(403);
    });
  });

  describe('CA41: Responsável tenta concluir Ação com Subação pendente', () => {
    it('recusa com 409 Subações não concluídas', async () => {
      const tratativa = await criarTratativaAberta();
      const mae = await acao(tratativa, { responsavel: 'M1001' });
      await sub(tratativa, mae);
      await recusaAcao(tratativa, mae, { status: 'Concluída' }, 409, undefined, SUBACOES_NAO_CONCLUIDAS);
    });
  });

  describe('CA42: Responsável da mãe tenta iniciar Subação de outro colaborador', () => {
    it('recusa com 403', async () => {
      const tratativa = await criarTratativaAberta();
      const mae = await acao(tratativa, { responsavel: 'M1001' });
      const filha = await sub(tratativa, mae, { responsavel: 'M2002' });
      const r = await mudar(tratativa, filha, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(403);
    });

    it('Responsável da Subação inicia com sucesso', async () => {
      const tratativa = await criarTratativaAberta();
      const mae = await acao(tratativa, { responsavel: 'M1001' });
      const filha = await sub(tratativa, mae, { responsavel: 'M2002' });
      const r = await mudar(tratativa, filha, { status: 'Em andamento' }, comoM1001('m2002'));
      expect(r.status).toBe(204);
    });
  });

  describe('CA43: Responsável tenta concluir Ação em Tratativa Encerrada', () => {
    it('recusa com 409 Tratativa Encerrada não pode ser alterada.', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await mudarStatusAcao(enviar, tratativa, { acao: acaoCodigo, status: 'Concluída' }, comoGestor);
      await mudarStatusTratativa(tratativa, 'Em andamento', undefined, comoGestor);
      await mudarStatusTratativa(tratativa, 'Encerrada', undefined, comoGestor);
      await recusaAcao(tratativa, acaoCodigo, { status: 'Concluída' }, 409, undefined, TRATATIVA_ENCERRADA);
    });
  });

  describe('CA44, CA109: Responsável de Ação Concluída pede Concluída de novo', () => {
    it('autorização etapa 6 concedida, recusa com 409 etapa 8', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await leva(tratativa, acaoCodigo, 'Concluída');
      await recusaAcao(tratativa, acaoCodigo, { status: 'Concluída' }, 409, 'status', TRANSICAO_NAO_PERMITIDA_CONCLUIDA_CONCLUIDA);
    });

    it('pedir Em andamento em Ação já Em andamento recusa com 409', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await leva(tratativa, acaoCodigo, 'Em andamento');
      await recusaAcao(tratativa, acaoCodigo, { status: 'Em andamento' }, 409, 'status', TRANSICAO_NAO_PERMITIDA_EM_ANDAMENTO);
    });
  });

  describe('CA45: Responsável conclui sem justificativa com sucesso', () => {
    it('sem justificativa é aceito', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Concluída' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
    });

    it('Gestor continua podendo concluir', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Concluída' }, comoGestor);
      expect(r.status).toBe(204);
    });
  });

  describe('CA55: pedidos recusados de transição pelo Responsável não gravam histórico', () => {
    it('histórico não é gravado após recusa', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const contagem = (await historicoAcao(acaoCodigo)).length;
      const r = await mudar(tratativa, acaoCodigo, { status: 'Cancelada' }, comoM1001('m1001'));
      expect(r.status).toBe(403);
      expect((await historicoAcao(acaoCodigo)).length).toBe(contagem);
    });
  });

  describe('CA56: falha simulada no banco dispara rollback transacional total', () => {
    it('rollback em falha de gravação de histórico', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const statusAntes = await statusAcao(acaoCodigo);
      espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(500);
      expect(await statusAcao(acaoCodigo)).toBe(statusAntes);
      espiao.naoFalhar();
    });
  });

  describe('CA62 (transição): usuário não-gestor tentando concluir Ação inexistente com formato válido', () => {
    it('não-gestor recebe 404 pois existência precede autorização (R16)', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await mudar(tratativa, UUID_INEXISTENTE, { status: 'Concluída' }, comoUsuario);
      expect(r.status).toBe(404);
      expect(r.data.error?.message).toBe('Ação não encontrada.');
    });

    it('anônimo recebe 401', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await mudar(tratativa, UUID_INEXISTENTE, { status: 'Concluída' }, semAuth);
      expect(r.status).toBe(401);
    });
  });

  describe('CA86: execução de Ações pelo responsável funciona em Tratativa de app e avulsa', () => {
    it('Ação de Tratativa aberta por app', async () => {
      const tratativa = await criarTratativaApp();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
    });

    it('Ação de Tratativa avulsa', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
    });
  });

  describe('CA91: Responsável conclui Ação Em andamento com sucesso', () => {
    it('pode concluir ação', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await leva(tratativa, acaoCodigo, 'Em andamento');
      const r = await mudar(tratativa, acaoCodigo, { status: 'Concluída' }, comoM1001('m1001'));
      expect(r.status).toBe(204);
    });
  });

  describe('CA95: não-gestor que não é o Responsável da Ação recebe 403', () => {
    it('recebe 403 em qualquer tentativa de transição', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      const r = await mudar(tratativa, acaoCodigo, { status: 'Em andamento' }, comoUsuario);
      expect(r.status).toBe(403);
    });
  });

  describe('CA104, CA106: existência precede autorização dinâmica', () => {
    it('não-gestor tentando com Tratativa errada recebe 404', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await mudar(tratativa, UUID_INEXISTENTE, { status: 'Concluída' }, comoGestor);
      expect(r.status).toBe(404);
      expect(r.data.error?.message).toBe('Ação não encontrada.');
    });

    it('código Ação válido mas Tratativa errada recebe 404', async () => {
      const t1 = await criarTratativaAberta();
      const t2 = await criarTratativaAberta();
      const a1 = await acao(t1, { responsavel: 'M1001' });
      const r = await mudar(t2, a1, { status: 'Concluída' }, comoGestor);
      expect(r.status).toBe(404);
    });
  });

  describe('CA107: app de origem tentando iniciar/concluir Ação', () => {
    it('com payload inválido recebe 400 runtime antes de 403', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa);
      const r = await POST(`/api/tratativa/v1/Tratativas(${tratativa})/mudarStatusAcao`, { acao: acaoCodigo, status: 'Em andamento', campoDesconhecido: 'xyz' }, comoApp);
      expect(r.status).toBe(400);
    });

    it('com código malformado "xyz" recebe 403 etapa 3 antes de 400 etapa 4', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await mudar(tratativa, 'xyz', { status: 'Em andamento' }, comoApp);
      expect(r.status).toBe(403);
    });
  });

  describe('CA110: Responsável de Ação em Tratativa Encerrada pedindo Cancelada', () => {
    it('recebe 403 na etapa 6 antes do 409 de Tratativa Encerrada', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      await mudarStatusTratativa(tratativa, 'Em andamento', undefined, comoGestor);
      await mudarStatusTratativa(tratativa, 'Encerrada', undefined, comoGestor);
      const r = await mudar(tratativa, acaoCodigo, { status: 'Cancelada' }, comoM1001('m1001'));
      expect(r.status).toBe(403);
    });
  });

  describe('CA113: não-gestor tentando iniciar/concluir com dados malformados', () => {
    it('campos desconhecidos/tipo recebem 400 runtime etapa 2', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa);
      const r = await POST(`/api/tratativa/v1/Tratativas(${tratativa})/mudarStatusAcao`, { acao: acaoCodigo, status: 'Em andamento', campoDesconhecido: 'xyz' }, comoUsuario);
      expect(r.status).toBe(400);
    });

    it('código acao malformado recebe 400 etapa 4 antes de existência', async () => {
      const tratativa = await criarTratativaAberta();
      const r = await mudar(tratativa, 'xyz', { status: 'Em andamento' }, comoGestor);
      expect(r.status).toBe(400);
      expect(r.data.error?.message).toBe('Código inválido.');
      expect(r.data.error?.target).toBe('acao');
    });
  });

  describe('CA114: Responsável de Ação inexistente tentando outras operações', () => {
    it('recebe 403 na etapa 2 (papel estático precede existência) ao chamar operação estática com Ação inexistente', async () => {
      const tratativa = await criarTratativaAberta();
      // CA114: operação estática (@restrict) verifica papel ANTES de existência (R16 etapa 2 vs. etapa 5)
      // Usuário comum (não-Gestor) não tem papel para invocar delegarAcao, então recebe 403
      const r = await delegarAcao(enviar, tratativa, {
        acao: UUID_INEXISTENTE,
        novoResponsavel: 'M2002',
        justificativa: 'Tentativa de delegação'
      }, comoUsuario);
      expect(r.status).toBe(403);
      expect(r.data.error?.message).toContain('Forbidden');
    });
  });

  describe('CA115: Responsável de Ação Cancelada pede destino Concluída', () => {
    it('autorização etapa 6 concedida, recusa na etapa 8 com 409', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoCodigo = await acao(tratativa, { responsavel: 'M1001' });
      // Cancelamento exige justificativa (R7, R8 da spec 005)
      await leva(tratativa, acaoCodigo, 'Cancelada', 'Cancelada conforme regra');
      // Agora tenta transição de Cancelada para Concluída, que é proibida
      await recusaAcao(tratativa, acaoCodigo, { status: 'Concluída' }, 409, 'status', TRANSICAO_NAO_PERMITIDA_CANCELADA_CONCLUIDA);
    });
  });
});

// Helper local para mudar status de Tratativa
async function mudarStatusTratativa(codigo: string, status: string, justificativa?: string, como: unknown = comoGestor): Promise<Resposta> {
  const corpo: Record<string, unknown> = { status };
  if (justificativa !== undefined) {
    corpo.justificativa = justificativa;
  }
  return POST(`/api/tratativa/v1/Tratativas(${codigo})/mudarStatus`, corpo, como);
}
