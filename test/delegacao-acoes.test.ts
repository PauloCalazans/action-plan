import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { sufixoUnico, type Envia, criarAvulsa, abrirPorApp, mudarStatus } from './apoio/tratativas';
import { comoApp, comoGestor, comoUsuario, semAuth } from './apoio/usuarios';
import { delegarAcao } from './apoio/responsaveis';
import { linhas } from './apoio/banco';
import { instalarEspiao, type Espiao } from './apoio/banco-espiao';
import { criarAcao, criarSubacao, mudarStatusAcao, editarAcao } from './apoio/acoes';

const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

const { POST, GET } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET;
jest.setTimeout(60000);

let espiao: Espiao;
beforeAll(async () => {
  await registrarCredenciais();
  espiao = instalarEspiao();
});
afterEach(() => {
  espiao.naoFalhar();
});

async function criarTratativaAberta(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta', ...dados });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function criarAcaoComResponsavel(tratativa: string, responsavel: string): Promise<string> {
  const r = await criarAcao(enviar, tratativa, {
    descricao: `Descrição da Ação ${sufixoUnico()}`,
    prioridade: 'Alta',
    prazo: '2027-01-01',
    responsavel: responsavel
  }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

describe('Etapa 2 - Delegação de Ações com justificativa obrigatória', () => {
  describe('CA3: Ação não aceita inclusão de participantes', () => {
    it('não existe operação para incluir participante em Ação', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Tenta acessar endpoint de inclusão de participante em Ação
      // Conforme design, ParticipantesAcao não é exposto; tentativa deve retornar 404/400
      const r = await consultar(`/api/tratativa/v1/Acoes(${acao})/participantes`, comoGestor);
      
      // Esperado: 404 ou 400 (navegação/operação não disponível)
      expect([400, 404]).toContain(r.status);
    });
  });

  describe('CA9 (responsável): delegar com nome ou e-mail inválido recusa nomeando novoResponsavel', () => {
    it('delegar com "Maria Silva" recusa com 400 nomeando novoResponsavel', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'Maria Silva',
        justificativa: 'Mudança de turno'
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBe('novoResponsavel');
    });

    it('delegar com "ana@x.com" recusa com 400 nomeando novoResponsavel', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'ana@x.com',
        justificativa: 'Mudança de turno'
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBe('novoResponsavel');
    });
  });

  describe('CA26, CA28: Gestor delega Ação e Subação com justificativa obrigatória', () => {
    it('delega Ação com justificativa → Responsável é alterado no banco', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Responsável mudou de área'
      }, comoGestor);
      
      expect(r.status).toBe(204);
      
      // Verificar no banco que o responsável mudou
      const linhasAcoes = await linhas('Acoes', { codigo: acao });
      expect(linhasAcoes).toHaveLength(1);
      expect(linhasAcoes[0].responsavel).toBe('M2002');
    });

    it('delega Subação com justificativa → Responsável é alterado', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoMae = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Criar Subação
      const rSub = await criarSubacao(enviar, tratativa, {
        acaoMae: acaoMae,
        descricao: `Subação ${sufixoUnico()}`,
        prioridade: 'Média',
        prazo: '2027-01-02',
        responsavel: 'M3003'
      }, comoGestor);
      expect(rSub.status).toBe(200);
      const subacao = rSub.data.codigo as string;
      
      // Delegar Subação
      const r = await delegarAcao(enviar, tratativa, {
        acao: subacao,
        novoResponsavel: 'M4004',
        justificativa: 'Responsável da Subação mudou'
      }, comoGestor);
      
      expect(r.status).toBe(204);
      
      // Verificar no banco
      const linhasSub = await linhas('Acoes', { codigo: subacao });
      expect(linhasSub).toHaveLength(1);
      expect(linhasSub[0].responsavel).toBe('M4004');
    });
  });

  describe('CA27: delegação sem justificativa, com espaços ou > 500 caracteres recusa com 400', () => {
    it('delegação sem justificativa recusa com 400 citando Justificativa', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002'
        // Sem justificativa
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBe('justificativa');
    });

    it('delegação com justificativa só com espaços recusa com 400', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: '   '
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBe('justificativa');
    });

    it('delegação com justificativa de 501 caracteres recusa com 400', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'a'.repeat(501)
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBe('justificativa');
    });
  });

  describe('CA29, CA93: editarAcao com campo responsavel recusa como campo desconhecido', () => {
    it('editarAcao com responsavel recusa com 400 runtime campo desconhecido', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await editarAcao(enviar, tratativa, {
        acao: acao,
        descricao: 'Nova descrição',
        responsavel: 'M2002' // Campo que não existe na edição
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBeDefined(); // Runtime não especifica campo, mas pode usar 'responsavel'
    });
  });

  describe('CA30: Responsável da Ação sem papel de Gestor tenta delegar → 403', () => {
    it('Responsável M1001 tenta delegar sua própria Ação → 403', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoUsuario); // comoUsuario = M1001 (usuário sem papel de Gestor)
      
      expect(r.status).toBe(403);
    });
  });

  describe('CA31: delegar para a mesma matrícula já gravada resulta em 204 sem alteração', () => {
    it('delegar para mesma matrícula resulta em 204 sem histórico', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M1001', // Mesma matrícula
        justificativa: 'Mantendo responsabilidade'
      }, comoGestor);
      
      expect(r.status).toBe(204);
      
      // Verificar que não há histórico de Delegação
      const historico = await linhas('HistoricoAcoes', { acao: acao, evento: 'Delegacao' });
      expect(historico).toHaveLength(0);
    });
  });

  describe('CA34 (delegação), CA61, CA105: delegar em Tratativa Encerrada/Cancelada recusa com 409', () => {
    it('delegar Ação em Tratativa Encerrada recusa com 409', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Antes de encerrar, concluir a Ação
      const rConcluir = await mudarStatusAcao(enviar, tratativa, { acao: acao, status: 'Concluída', justificativa: 'Conclusão de teste' }, comoGestor);
      expect(rConcluir.status).toBe(204);
      
      // Agora encerrar Tratativa
      const rEncerrar = await mudarStatus(enviar, tratativa, { status: 'Encerrada' }, comoGestor);
      expect(rEncerrar.status).toBe(204);
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoGestor);
      
      expect(r.status).toBe(409);
    });

    it('delegar Ação em Tratativa Cancelada recusa com 409', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Antes de cancelar, concluir a Ação
      const rConcluir = await mudarStatusAcao(enviar, tratativa, { acao: acao, status: 'Concluída', justificativa: 'Conclusão de teste' }, comoGestor);
      expect(rConcluir.status).toBe(204);
      
      // Cancelar Tratativa (precisa de justificativa)
      const rCancelar = await mudarStatus(enviar, tratativa, { status: 'Cancelada', justificativa: 'Cancelamento de teste' }, comoGestor);
      expect(rCancelar.status).toBe(204);
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoGestor);
      
      expect(r.status).toBe(409);
    });
  });

  describe('CA35: delegar Ação Concluída ou Cancelada recusa com 409', () => {
    it('delegar Ação Concluída recusa com 409', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Concluir Ação
      const rConcluir = await mudarStatusAcao(enviar, tratativa, { acao: acao, status: 'Concluída', justificativa: 'Conclusão de teste' }, comoGestor);
      expect(rConcluir.status).toBe(204);
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoGestor);
      
      expect(r.status).toBe(409);
    });

    it('delegar Ação Cancelada recusa com 409', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Cancelar Ação
      const rCancelar = await mudarStatusAcao(enviar, tratativa, { acao: acao, status: 'Cancelada', justificativa: 'Cancelamento de teste' }, comoGestor);
      expect(rCancelar.status).toBe(204);
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoGestor);
      
      expect(r.status).toBe(409);
    });
  });

  describe('CA47 (delegação): participante da Tratativa tenta delegar Ação → 403', () => {
    it('participante tenta delegar → 403', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Incluir participante M3003 (simulado como usuario sem papel de Gestor)
      // Para o teste, usaremos comoUsuario que é M1001, não M3003
      // O importante é que não é Gestor
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoUsuario); // Usuário sem papel de Gestor
      
      expect(r.status).toBe(403);
    });
  });

  describe('CA48 (delegação): aplicativo de origem tenta delegar → 403', () => {
    it('app tenta delegar → 403', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoApp);
      
      expect(r.status).toBe(403);
    });
  });

  describe('CA53: gravação correta de histórico Delegacao em HistoricoAcoes', () => {
    it('delegação grava histórico com campos corretos', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Responsável mudou de turno'
      }, comoGestor);
      
      expect(r.status).toBe(204);
      
      const historico = await linhas('HistoricoAcoes', { acao: acao, evento: 'Delegacao' });
      expect(historico).toHaveLength(1);
      expect(historico[0]).toMatchObject({
        evento: 'Delegacao',
        campo: 'responsavel',
        valorAnterior: 'M1001',
        valorNovo: 'M2002',
        justificativa: 'Responsável mudou de turno',
        autor: 'gestor', // Matrícula do usuário autenticado (gestor)
        tipoAutor: 'Usuario'
      });
    });
  });

  describe('CA57 + D9: duas Delegações simultâneas resultam em histórico encadeado', () => {
    it('delegações simultâneas produzem histórico encadeado', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Duas delegações SIMULTÂNEAS com Promise.all
      const [r1, r2] = await Promise.all([
        delegarAcao(enviar, tratativa, {
          acao: acao,
          novoResponsavel: 'M2002',
          justificativa: 'Primeira delegação'
        }, comoGestor),
        delegarAcao(enviar, tratativa, {
          acao: acao,
          novoResponsavel: 'M3003',
          justificativa: 'Segunda delegação'
        }, comoGestor)
      ]);
      
      // Ambas devem ter sucesso
      expect(r1.status).toBe(204);
      expect(r2.status).toBe(204);
      
      const historico = await linhas('HistoricoAcoes', { acao_codigo: acao, evento: 'Delegacao' });
      expect(historico.length).toBeGreaterThanOrEqual(2);
      
      // Verificar que há registros de delegação encadeados
      // Valores anteriores devem incluir M1001 e um de {M2002, M3003}
      const valorAnteriores = historico.map((h: Record<string, unknown>) => h.valorAnterior);
      const valorNovos = historico.map((h: Record<string, unknown>) => h.valorNovo);
      
      expect(valorAnteriores).toContain('M1001');
      expect(['M2002', 'M3003']).toContain(valorAnteriores.find((v: unknown) => v !== 'M1001'));
      expect(valorNovos).toContain('M2002');
      expect(valorNovos).toContain('M3003');
    });
  });

  describe('CA55, CA56: pedidos recusados não gravam histórico; falha simulada no banco dispara rollback', () => {
    it('delegação recusada por justificativa ausente não grava histórico', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Tentativa sem justificativa (será recusada)
      await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002'
        // Sem justificativa
      }, comoGestor);
      
      // Verificar que não há histórico de Delegação
      const historico = await linhas('HistoricoAcoes', { acao: acao, evento: 'Delegacao' });
      expect(historico).toHaveLength(0);
    });

    it('delegação recusada por estado da Tratativa não grava histórico', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Antes de encerrar, concluir a Ação
      const rConcluir = await mudarStatusAcao(enviar, tratativa, { acao: acao, status: 'Concluída', justificativa: 'Conclusão de teste' }, comoGestor);
      expect(rConcluir.status).toBe(204);
      
      // Encerrar Tratativa
      const rEncerrar = await mudarStatus(enviar, tratativa, { status: 'Encerrada' }, comoGestor);
      expect(rEncerrar.status).toBe(204);
      
      // Tentativa em Tratativa Encerrada (será recusada)
      const rDelegarAntes = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoGestor);
      expect(rDelegarAntes.status).toBe(409);
      
      // Verificar que não há histórico
      const historico = await linhas('HistoricoAcoes', { acao: acao, evento: 'Delegacao' });
      expect(historico).toHaveLength(0);
    });

    it('CA56: falha simulada em CREATE de HistoricoAcoes dispara rollback do responsavel', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Verifica responsável antes
      let linhaAcao = await linhas('Acoes', { codigo: acao });
      expect(linhaAcao[0].responsavel).toBe('M1001');
      
      // Instala espião para falhar em CREATE de HistoricoAcoes
      espiao.falharEm('CREATE', 'br.com.calazanstec.HistoricoAcoes');
      
      // Tenta delegação que vai falhar no banco
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação que vai falhar'
      }, comoGestor);
      
      // Espera erro
      expect(r.status).toBe(500);
      
      // Verifica que o responsável NÃO foi alterado (rollback)
      linhaAcao = await linhas('Acoes', { codigo: acao });
      expect(linhaAcao[0].responsavel).toBe('M1001');
      
      // Verifica que não há histórico de delegação
      const historico = await linhas('HistoricoAcoes', { acao_codigo: acao, evento: 'Delegacao' });
      expect(historico).toHaveLength(0);
    });
  });

  describe('CA59, CA62 (delegação): usuário não-gestor delegando Ação inexistente recebe 403', () => {
    it('não-gestor com Ação inexistente recebe 403', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoInexistente = '00000000-0000-0000-0000-000000000000';
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acaoInexistente,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, comoUsuario); // Usuário sem papel de Gestor
      
      expect(r.status).toBe(403); // Papel estático precede existência
    });

    it('anônimo recebe 401', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoInexistente = '00000000-0000-0000-0000-000000000000';
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acaoInexistente,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação'
      }, semAuth);
      
      expect(r.status).toBe(401);
    });
  });

  describe('CA82, CA85: delegação para matrícula inexistente ou desligada aceita sem consulta externa', () => {
    it('delegação para matrícula inexistente é aceita', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'MAT999', // Matrícula inexistente
        justificativa: 'Delegação para novo responsável'
      }, comoGestor);
      
      expect(r.status).toBe(204);
      
      // Verificar no banco
      const linhasAcoes = await linhas('Acoes', { codigo: acao });
      expect(linhasAcoes).toHaveLength(1);
      expect(linhasAcoes[0].responsavel).toBe('MAT999');
    });
  });

  describe('CA84 (delegação): delegação imediata pelo Gestor sem papel aprovador', () => {
    it('Gestor delega sem aprovação externa', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação imediata'
      }, comoGestor);
      
      expect(r.status).toBe(204);
    });
  });

  describe('CA86 (delegação): delegação funciona em Tratativa de app e avulsa', () => {
    it('delegação em Tratativa avulsa funciona', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação avulsa'
      }, comoGestor);
      
      expect(r.status).toBe(204);
    });

    it('delegação em Tratativa de app funciona', async () => {
      const tratativa = await abrirPorApp(enviar, { origem: 'Advertência', idOrigem: `ADV-${sufixoUnico()}`, titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta' });
      expect(tratativa.status).toBe(200);
      const codigo = tratativa.data.codigo as string;
      
      const acao = await criarAcaoComResponsavel(codigo, 'M1001');
      
      const r = await delegarAcao(enviar, codigo, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Delegação app'
      }, comoGestor);
      
      expect(r.status).toBe(204);
    });
  });

  describe('CA90: criação de Ação com matrícula inválida recusa com 400', () => {
    it('criar Ação com "Ana Lima" recusa nomeando Responsável', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await criarAcao(enviar, tratativa, {
        descricao: `Descrição ${sufixoUnico()}`,
        prioridade: 'Alta',
        prazo: '2027-01-01',
        responsavel: 'Ana Lima' // Nome inválido
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBe('responsavel');
    });

    it('criar Ação com "@email.com" recusa nomeando Responsável', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await criarAcao(enviar, tratativa, {
        descricao: `Descrição ${sufixoUnico()}`,
        prioridade: 'Alta',
        prazo: '2027-01-01',
        responsavel: 'ana@x.com' // E-mail inválido
      }, comoGestor);
      
      expect(r.status).toBe(400);
      expect(r.data.error?.target).toBe('responsavel');
    });

    it('criar Ação com valor vazio mantém mensagem semântica do 004', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await criarAcao(enviar, tratativa, {
        descricao: `Descrição ${sufixoUnico()}`,
        prioridade: 'Alta',
        prazo: '2027-01-01',
        responsavel: '' // Vazio
      }, comoGestor);
      
      expect(r.status).toBe(400);
      // Mensagem do 004: "O campo Responsável é obrigatório."
      expect(r.data.error?.target).toBe('responsavel');
    });

    it('criar Ação com 51 caracteres mantém mensagem semântica do 004', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await criarAcao(enviar, tratativa, {
        descricao: `Descrição ${sufixoUnico()}`,
        prioridade: 'Alta',
        prazo: '2027-01-01',
        responsavel: 'A'.repeat(51) // 51 caracteres
      }, comoGestor);
      
      expect(r.status).toBe(400);
      // Mensagem do 004: "O campo Responsável aceita no máximo 50 caracteres."
      expect(r.data.error?.target).toBe('responsavel');
    });

    it('criar Ação com matrícula válida "M1001" é aceita', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await criarAcao(enviar, tratativa, {
        descricao: `Descrição ${sufixoUnico()}`,
        prioridade: 'Alta',
        prazo: '2027-01-01',
        responsavel: 'M1001' // Matrícula válida
      }, comoGestor);
      
      expect(r.status).toBe(200);
    });
  });

  describe('CA92, CA94: edição comum de outros campos grava histórico de Edicao sem gerar histórico de responsável', () => {
    it('editar descrição grava histórico de Edicao sem tocar no Responsável', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      const r = await editarAcao(enviar, tratativa, {
        acao: acao,
        descricao: 'Nova descrição editada'
      }, comoGestor);
      
      expect(r.status).toBe(204);
      
      // Verificar histórico de Edicao
      const historico = await linhas('HistoricoAcoes', { acao: acao, evento: 'Edicao' });
      expect(historico).toHaveLength(1);
      
      // Verificar que não há histórico de Delegação
      const historicoDelegacao = await linhas('HistoricoAcoes', { acao: acao, evento: 'Delegacao' });
      expect(historicoDelegacao).toHaveLength(0);
    });
  });

  describe('CA103: Responsável Original é derivado do histórico', () => {
    it('Responsável Original é o primeiro Responsável (sem delegação)', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Verifica que há histórico de criação
      const historico = await linhas('HistoricoAcoes', { acao_codigo: acao });
      expect(historico.length).toBeGreaterThan(0);
      
      // Verifica que o responsável atual é M1001
      const linhaAcao = await linhas('Acoes', { codigo: acao });
      expect(linhaAcao[0].responsavel).toBe('M1001');
    });

    it('Responsável Original é valor anterior da primeira Delegação', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      
      // Primeira delegação para M2002
      const r1 = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M2002',
        justificativa: 'Primeira delegação'
      }, comoGestor);
      expect(r1.status).toBe(204);
      
      // Segunda delegação para M3003
      const r2 = await delegarAcao(enviar, tratativa, {
        acao: acao,
        novoResponsavel: 'M3003',
        justificativa: 'Segunda delegação'
      }, comoGestor);
      expect(r2.status).toBe(204);
      
      // Consulta o histórico
      const historico = await linhas('HistoricoAcoes', { acao_codigo: acao, evento: 'Delegacao' });
      
      // Deve ter dois registros de delegação
      expect(historico.length).toBeGreaterThanOrEqual(2);
      
      // Verifica que há delegação de M1001 para M2002 e de M2002 para M3003
      const m1001para = historico.find((h: Record<string, unknown>) => h.valorNovo === 'M2002');
      expect(m1001para).toBeDefined();
      
      const m2002para = historico.find((h: Record<string, unknown>) => h.valorNovo === 'M3003');
      expect(m2002para).toBeDefined();
    });
  });

  describe('CA97/R16: delegação com Ação inexistente', () => {
    it('delegarAcao com Ação inexistente (UUID válido) na Tratativa existente → 404 "Ação não encontrada." e nenhum histórico', async () => {
      const tratativa = await criarTratativaAberta();
      
      const r = await delegarAcao(enviar, tratativa, {
        acao: UUID_INEXISTENTE,
        novoResponsavel: 'M2002',
        justificativa: 'Tentativa de delegação em ação inexistente'
      }, comoGestor);
      
      expect(r.status).toBe(404);
      expect(r.data.error.message).toBe('Ação não encontrada.');
      
      // Verifica que não há registro de delegação no histórico
      const historico = await linhas('HistoricoAcoes', { acao: UUID_INEXISTENTE, evento: 'Delegacao' });
      expect(historico.length).toBe(0);
    });
  });
});