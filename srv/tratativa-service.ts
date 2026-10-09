import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';
import { consultarAcao, consultarEstruturaAcoes } from './tratativa/acoes-consulta';
import { editarAcao, type CamposEdicaoAcao } from './tratativa/acoes-edicao';
import { mudarStatusAcao } from './tratativa/acoes-ciclo-de-vida';
import { criarAcao, criarSubacao, type DadosCriacaoAcao } from './tratativa/acoes-criacao';
import { mudarStatus } from './tratativa/ciclo-de-vida';
import { alterarCriticidade } from './tratativa/criticidade';
import { editarTratativa } from './tratativa/edicao';
import { consultarTratativa, listarTratativas, type FiltrosListagem } from './tratativa/listagem';
import { atribuirResponsavelPrincipal, incluirParticipante, removerParticipante, consultarResponsaveis } from './tratativa/responsaveis-tratativa';

/** Contrato dos usuários: só monta o Autor e delega ao domínio (decisões 6, 14 e 15). */
export default class TratativaService extends cds.ApplicationService {
  async init() {
    // Decisão 3 (design tratativa): aplicativo de origem é recusado em todo o serviço, antes de qualquer gravação.
    // Registrado antes de qualquer outro handler.
    // Permite consultas (listarTratativas, consultarTratativa, consultarEstruturaAcoes, consultarAcao)
    this.before('*', (req) => {
      if (!req.user.is('AplicativoOrigem')) return;
      // Permite functions de leitura
      const permitidas = ['listarTratativas', 'consultarTratativa', 'consultarEstruturaAcoes', 'consultarAcao'];
      if (permitidas.includes(req.event)) return;
      req.reject(
        403,
        req.event === 'criarTratativaAvulsa'
          ? 'Aplicativo de origem não cria Tratativa avulsa.'
          : 'Aplicativo de origem não usa este serviço.',
      );
    });
    // Decisão 2: o entity set é só âncora das actions; leitura é pelas functions.
    this.before('READ', 'Tratativas', (req) => req.reject(405, 'Use as functions listarTratativas e consultarTratativa.'));
    this.on('listarTratativas', (req) => listarTratativas(req.data as FiltrosListagem));
    this.on('consultarTratativa', (req) =>
      consultarTratativa((req.data as { codigo?: string }).codigo, req.user.is('GestorTratativa')),
    );
    this.on('criarTratativaAvulsa', (req) =>
      abrirTratativa(req.data as DadosAbertura, { id: req.user.id, tipo: 'Usuario' }),
    );
    this.on('mudarStatus', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await mudarStatus(String(codigo).toLowerCase(), req.data, { id: req.user.id, tipo: 'Usuario' });
    });
    this.on('editar', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await editarTratativa(String(codigo).toLowerCase(), req.data, { id: req.user.id, tipo: 'Usuario' });
    });
    this.on('mudarCriticidade', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      await alterarCriticidade(String(codigo).toLowerCase(), (req.data as { criticidade?: string }).criticidade, {
        id: req.user.id,
        tipo: 'Usuario',
      });
    });
    // 004 R25: leitura da estrutura e do detalhe; `responsavel` só para o GestorTratativa (LGPD).
    this.on('consultarEstruturaAcoes', (req) => {
      const { tratativa } = req.data as { tratativa?: string };
      return consultarEstruturaAcoes(tratativa, req.user.is('GestorTratativa'));
    });
    this.on('consultarAcao', (req) => {
      const { tratativa, codigo } = req.data as { tratativa?: string; codigo?: string };
      return consultarAcao(tratativa, codigo, req.user.is('GestorTratativa'));
    });
    // 004 R1/R2: `acaoMae` passa como texto (String) para que ausente ou null vire 'undefined'/'null' e seja recusado como Código inválido.
    this.on('criarAcao', 'Tratativas', (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      return criarAcao(String(codigo).toLowerCase(), req.data as DadosCriacaoAcao, { id: req.user.id, tipo: 'Usuario' });
    });
    // 004 R6-R12: `acao` passa como texto (String), pelo mesmo motivo de `acaoMae`: ausente ou null vira 'Código inválido.'.
    this.on('mudarStatusAcao', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { acao, status, justificativa } = req.data as { acao?: string; status?: string; justificativa?: string };
      await mudarStatusAcao(String(codigo).toLowerCase(), String(acao).toLowerCase(), { status, justificativa }, {
        id: req.user.id,
        tipo: 'Usuario',
      });
    });
    // 004 R19/R20 (Ruling R-07): `acao` é tirado dos campos; o runtime já recusou qualquer campo fora da assinatura.
    this.on('editarAcao', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { acao, ...campos } = req.data as { acao?: string } & CamposEdicaoAcao;
      await editarAcao(String(codigo).toLowerCase(), String(acao).toLowerCase(), campos, {
        id: req.user.id,
        tipo: 'Usuario',
      });
    });
    this.on('criarSubacao', 'Tratativas', (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { acaoMae, ...dados } = req.data as DadosCriacaoAcao & { acaoMae?: string | null };
      return criarSubacao(String(codigo).toLowerCase(), String(acaoMae).toLowerCase(), dados, {
        id: req.user.id,
        tipo: 'Usuario',
      });
    });
    // 005 R17, R26 (Ruling R-02): consulta de responsáveis exclusiva para o Gestor (403 estático do runtime para não-gestores).
    this.on('consultarResponsaveis', (req) => {
      const { tratativa } = req.data as { tratativa?: string };
      return consultarResponsaveis(String(tratativa).toLowerCase());
    });
    // 005 R7, R14: atribuição ou reatribuição de Responsável Principal.
    this.on('atribuirResponsavelPrincipal', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { responsavelPrincipal, justificativa } = req.data as { responsavelPrincipal?: string; justificativa?: string };
      await atribuirResponsavelPrincipal(String(codigo).toLowerCase(), responsavelPrincipal!, justificativa, {
        id: req.user.id,
        tipo: 'Usuario',
      });
    });
    // 005 R9, R14: inclusão de participante.
    this.on('incluirParticipante', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { participante } = req.data as { participante?: string };
      await incluirParticipante(String(codigo).toLowerCase(), participante!, { id: req.user.id, tipo: 'Usuario' });
    });
    // 005 R9, R14: remoção de participante.
    this.on('removerParticipante', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as { codigo: string };
      const { participante } = req.data as { participante?: string };
      await removerParticipante(String(codigo).toLowerCase(), participante!, { id: req.user.id, tipo: 'Usuario' });
    });
    return super.init();
  }
}
