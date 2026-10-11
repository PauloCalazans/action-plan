import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';
import { mudarStatus } from './tratativa/ciclo-de-vida';
import { alterarCriticidade } from './tratativa/criticidade';
import { editarTratativa } from './tratativa/edicao';
import { normalizarMatricula, obterMatriculaUsuario } from './tratativa/identidade';
import { mudarStatusAcao } from './tratativa/acoes-ciclo-de-vida';
import { criarAcao, criarSubacao, type DadosCriacaoAcao } from './tratativa/acoes-criacao';
import { delegarAcao } from './tratativa/acoes-delegacao';
import { anexarEvidencia, type DadosAnexoEvidencia } from './tratativa/evidencias-anexo';
import { removerEvidencia, type DadosRemocaoEvidencia } from './tratativa/evidencias-remocao';
import {
  comentarTratativa,
  comentarAcao,
  type DadosComentarioTratativa,
  type DadosComentarioAcao,
} from './tratativa/comentarios-inclusao';
import { aplicarTemplateTratativa } from './templates/templates-aplicacao';

const NS = 'br.com.calazanstec';

interface ChaveTratativa {
  codigo: string;
}

interface ChaveAcao {
  codigo?: string;
  codigoAcao?: string;
}

interface LinhaTratativa {
  descricao?: string | null;
  solicitante?: string | null;
  responsavelPrincipal?: string | null;
  ocultaResponsaveis?: boolean;
  participantes?: unknown[] | null;
  acoes?: { responsavel?: string | null }[] | null;
}

interface ConsultaRestringivel {
  where(...condicoes: unknown[]): unknown;
}

const restringir = (req: cds.Request) => req.query as unknown as ConsultaRestringivel;
const papeisPorRequisicao = new WeakMap<object, Set<string>>();

export default class TratativaAppService extends cds.ApplicationService {
  async init() {
    this.before('*', (req) => {
      if (req.user.is('AplicativoOrigem')) req.reject(403, 'Acesso negado.');
    });

    this.after('READ', 'Tratativas', (resultado, req) => {
      const gestor = req.user.is('GestorTratativa');
      const linhas = Array.isArray(resultado) ? resultado : [resultado];
      for (const linha of linhas as LinhaTratativa[]) {
        if (!linha) continue;
        linha.ocultaResponsaveis = !gestor;
        if (gestor) continue;
        linha.descricao = null;
        linha.solicitante = null;
        linha.responsavelPrincipal = null;
        if (linha.participantes) linha.participantes = [];
        if (linha.acoes) {
          for (const acao of linha.acoes) acao.responsavel = null;
        }
      }
    });

    // Mesma máscara LGPD da Tratativa, aplicada às leituras diretas de Participantes e Acoes.
    this.after('READ', 'Participantes', (resultado, req) => {
      if (req.user.is('GestorTratativa')) return;
      const linhas = (Array.isArray(resultado) ? resultado : [resultado]) as { matricula?: string | null }[];
      for (const linha of linhas) if (linha) linha.matricula = null;
    });

    this.after('READ', 'Acoes', (resultado, req) => {
      if (req.user.is('GestorTratativa')) return;
      const linhas = (Array.isArray(resultado) ? resultado : [resultado]) as { responsavel?: string | null }[];
      for (const linha of linhas) if (linha) linha.responsavel = null;
    });

    this.on('criarTratativaAvulsa', async (req) => {
      const dados = req.data as DadosAbertura;
      const { codigo } = await abrirTratativa(dados, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
      return SELECT.one.from(`${NS}.Tratativas`).where({ codigo });
    });

    this.on('mudarStatus', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as ChaveTratativa;
      await mudarStatus(String(codigo).toLowerCase(), req.data, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });

    this.on('editar', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as ChaveTratativa;
      await editarTratativa(String(codigo).toLowerCase(), req.data, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });

    this.on('mudarCriticidade', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as ChaveTratativa;
      const { criticidade } = req.data as { criticidade?: string };
      await alterarCriticidade(String(codigo).toLowerCase(), criticidade, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });

    this.on('aplicarTemplate', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as ChaveTratativa;
      const { templateId, responsavelPadrao, atribuicoes } = req.data as {
        templateId?: string;
        responsavelPadrao?: string;
        atribuicoes?: { ordem?: number; responsavel?: string }[];
      };
      return aplicarTemplateTratativa(
        String(codigo).toLowerCase(),
        { template: templateId, responsavelPadrao, atribuicoes },
        { id: obterMatriculaUsuario(req), tipo: 'Usuario' },
      );
    });

    this.on('criarAcao', 'Tratativas', (req) => {
      const { codigo } = req.params[0] as ChaveTratativa;
      return criarAcao(String(codigo).toLowerCase(), req.data as DadosCriacaoAcao, {
        id: obterMatriculaUsuario(req),
        tipo: 'Usuario',
      });
    });

    const autor = (req: cds.Request) => ({ id: obterMatriculaUsuario(req), tipo: 'Usuario' as const });
    const codigoDe = (req: cds.Request) => String((req.params[0] as ChaveTratativa).codigo).toLowerCase();

    this.on('criarSubacao', 'Tratativas', (req) => {
      const { acaoMae, ...dados } = req.data as DadosCriacaoAcao & { acaoMae?: string | null };
      return criarSubacao(codigoDe(req), String(acaoMae).toLowerCase(), dados, autor(req));
    });

    this.on('delegarAcao', 'Tratativas', async (req) => {
      const { acao, novoResponsavel, justificativa } = req.data as {
        acao?: string;
        novoResponsavel?: string;
        justificativa?: string;
      };
      await delegarAcao(codigoDe(req), String(acao).toLowerCase(), novoResponsavel!, justificativa!, autor(req));
    });

    this.on('anexarEvidencia', 'Tratativas', (req) =>
      anexarEvidencia(req, codigoDe(req), req.data as DadosAnexoEvidencia, autor(req)),
    );

    this.on('removerEvidencia', 'Tratativas', async (req) => {
      await removerEvidencia(req, codigoDe(req), req.data as DadosRemocaoEvidencia, autor(req));
    });

    this.on('comentarTratativa', 'Tratativas', (req) =>
      comentarTratativa(req, codigoDe(req), req.data as DadosComentarioTratativa),
    );

    this.on('comentarAcao', 'Tratativas', (req) => comentarAcao(req, codigoDe(req), req.data as DadosComentarioAcao));

    // Escopo pessoal por subconsulta/lista de chaves; $filter, $orderby, $top/$skip e $count seguem na query CQN.
    this.before('READ', 'MinhasAcoes', (req) => {
      const matricula = normalizarMatricula(obterMatriculaUsuario(req));
      const minhas = SELECT.from(`${NS}.Acoes`).columns('codigo').where('lower(trim(responsavel)) =', matricula);
      restringir(req).where('codigoAcao in', minhas);
    });

    this.before('READ', 'MinhasTratativas', async (req) => {
      const matricula = normalizarMatricula(obterMatriculaUsuario(req));
      const comoResponsavel = (await SELECT.from(`${NS}.Tratativas`)
        .columns('codigo')
        .where('lower(trim(responsavelPrincipal)) =', matricula)) as { codigo: string }[];
      const comoParticipante = (await SELECT.from(`${NS}.ParticipantesTratativa`)
        .columns('tratativa_codigo')
        .where('lower(trim(matricula)) =', matricula)) as { tratativa_codigo: string }[];
      const codigos = [...new Set([...comoResponsavel.map((t) => t.codigo), ...comoParticipante.map((p) => p.tratativa_codigo)])];
      restringir(req).where({ codigoTratativa: { in: codigos.length ? codigos : [''] } });
      papeisPorRequisicao.set(req, new Set(comoResponsavel.map((t) => t.codigo)));
    });

    this.after('READ', 'MinhasTratativas', (resultado, req) => {
      const responsavel = papeisPorRequisicao.get(req) ?? new Set<string>();
      const linhas = (Array.isArray(resultado) ? resultado : [resultado]) as { codigoTratativa?: string; meuPapel?: string }[];
      for (const linha of linhas) {
        if (linha) linha.meuPapel = responsavel.has(String(linha.codigoTratativa)) ? 'Responsável Principal' : 'Participante';
      }
    });
    const alterarStatusAcao = async (req: cds.Request, status: 'Em andamento' | 'Concluída') => {
      const chave = req.params[0] as ChaveAcao;
      const codigoAcao = String(chave.codigo ?? chave.codigoAcao).toLowerCase();
      const acao = await SELECT.one.from(`${NS}.Acoes`).columns('tratativa_codigo').where({ codigo: codigoAcao });
      if (!acao) req.reject(404, 'Ação não encontrada.');
      await mudarStatusAcao(req, String(acao.tratativa_codigo).toLowerCase(), codigoAcao, { status });
    };

    this.on('iniciar', 'Acoes', (req) => alterarStatusAcao(req, 'Em andamento'));
    this.on('concluir', 'Acoes', (req) => alterarStatusAcao(req, 'Concluída'));
    this.on('iniciar', 'MinhasAcoes', (req) => alterarStatusAcao(req, 'Em andamento'));
    this.on('concluir', 'MinhasAcoes', (req) => alterarStatusAcao(req, 'Concluída'));

    return super.init();
  }
}
