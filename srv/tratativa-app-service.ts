import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';
import { mudarStatus } from './tratativa/ciclo-de-vida';
import { alterarCriticidade } from './tratativa/criticidade';
import { editarTratativa } from './tratativa/edicao';
import { obterMatriculaUsuario } from './tratativa/identidade';
import { mudarStatusAcao } from './tratativa/acoes-ciclo-de-vida';
import { criarAcao, type DadosCriacaoAcao } from './tratativa/acoes-criacao';
import { minhasAcoes, minhasTratativas } from './tratativa/consultas-responsabilidade';
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

    this.on('READ', 'MinhasAcoes', async (req) =>
      (await minhasAcoes(req)).map((acao) => ({
        codigoAcao: acao.codigo,
        codigoTratativa: acao.codigoTratativa,
        tituloTratativa: acao.tituloTratativa,
        statusTratativa: acao.statusTratativa,
        descricao: acao.descricao,
        prioridade: acao.prioridade,
        statusAcao: acao.status,
        prazo: acao.prazo,
        evidenciaObrigatoria: acao.evidenciaObrigatoria,
        dataConclusao: acao.dataConclusao,
      })),
    );

    this.on('READ', 'MinhasTratativas', async (req) =>
      (await minhasTratativas(req)).map((tratativa) => ({
        codigoTratativa: tratativa.codigo,
        tituloTratativa: tratativa.titulo,
        origem: tratativa.origem,
        idOrigem: tratativa.idOrigem,
        criticidade: tratativa.criticidade,
        statusTratativa: tratativa.status,
        unidade: tratativa.unidade,
        area: tratativa.area,
        dataPrevistaConclusao: tratativa.dataPrevistaConclusao,
        meuPapel: tratativa.meuPapel,
      })),
    );

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
