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
import { aplicarMascaras, montarContextoMascara, restricaoDeLeitura } from './tratativa/mascara-app';
import { lerSituacaoAval } from './tratativa/aval-tecnico';
import { definirMetodologia, derivarAcaoDaMetodologia, type DadosDefinicaoMetodologia, type DadosDerivacaoMetodologia } from './tratativa/metodologia';
import { emitirAvalTecnico } from './tratativa/aval-tecnico';
import { tratativasComValidadorHabilitado } from './tratativa/validador-tecnico';

const NS = 'br.com.calazanstec';

interface ChaveTratativa {
  codigo: string;
}

interface ChaveAcao {
  codigo?: string;
  codigoAcao?: string;
}

interface LinhaTratativa {
  codigo?: string;
  status?: string | null;
  descricao?: string | null;
  solicitante?: string | null;
  responsavelPrincipal?: string | null;
  ocultaResponsaveis?: boolean;
  podeIniciar?: boolean;
  podeEncerrar?: boolean;
  podeCancelar?: boolean;
  podeReabrir?: boolean;
  ocultaIniciar?: boolean;
  ocultaEncerrar?: boolean;
  ocultaCancelar?: boolean;
  ocultaReabrir?: boolean;
  podeDefinirMetodologia?: boolean;
  ocultaDefinirMetodologia?: boolean;
  podeDerivarAcao?: boolean;
  ocultaDerivarAcao?: boolean;
  podeEmitirAval?: boolean;
  ocultaEmitirAval?: boolean;
  participantes?: unknown[] | null;
  acoes?: { responsavel?: string | null }[] | null;
}

interface DefinicaoEnum {
  enum?: Record<string, { val?: string }>;
}

interface ConsultaValueHelp {
  SELECT?: {
    search?: unknown;
    limit?: {
      rows?: { val?: number };
      offset?: { val?: number };
    };
  };
}

interface ConsultaRestringivel {
  where(...condicoes: unknown[]): unknown;
}

const restringir = (req: cds.Request) => req.query as unknown as ConsultaRestringivel;
const papeisPorRequisicao = new WeakMap<object, Set<string>>();

function valoresEnum(nome: string): { codigo: string; descricao: string }[] {
  const definicao = cds.model?.definitions[`${NS}.${nome}`] as DefinicaoEnum | undefined;
  return Object.entries(definicao?.enum ?? {}).map(([chave, item]) => {
    const codigo = item.val ?? chave;
    return { codigo, descricao: codigo };
  });
}

function termosBusca(expressao: unknown): string[] {
  if (Array.isArray(expressao)) return expressao.flatMap(termosBusca);
  if (!expressao || typeof expressao !== 'object') return [];
  const elemento = expressao as { val?: unknown; xpr?: unknown };
  if (typeof elemento.val === 'string') return [elemento.val];
  return termosBusca(elemento.xpr);
}

interface ElementoComElementos {
  name?: string;
  elements?: Record<string, { target?: string; _target?: ElementoComElementos }>;
}

const CHAVES_DE_VINCULO: Record<string, string[]> = {
  'TratativaAppService.Tratativas': ['codigo'],
  'TratativaAppService.Acoes': ['tratativa_codigo'],
  'TratativaAppService.AvalesTecnicos': ['id', 'tratativa_codigo'],
};

/** Acrescenta as colunas de vínculo (DC-17) ao nível e, recursivamente, às expansões `{ ref, expand }`. */
function garantirChavesDoNivel(entidade: ElementoComElementos | undefined, colunas: unknown[] | undefined): void {
  if (!entidade || !Array.isArray(colunas)) return;
  const itens = colunas as Array<'*' | { ref?: string[]; expand?: unknown[] }>;
  const pedeTudo = itens.some((c) => c === '*' || (typeof c === 'object' && c?.ref?.[0] === '*'));
  if (!pedeTudo) {
    for (const chave of CHAVES_DE_VINCULO[entidade.name ?? ''] ?? []) {
      if (!itens.some((c) => typeof c === 'object' && c?.ref?.length === 1 && c.ref[0] === chave && !('expand' in c))) {
        colunas.push({ ref: [chave] });
      }
    }
  }
  for (const coluna of itens) {
    if (typeof coluna !== 'object' || !coluna || !Array.isArray(coluna.expand) || !coluna.ref) continue;
    let atual: ElementoComElementos | undefined = entidade;
    for (const id of coluna.ref) {
      const elemento: { target?: string; _target?: ElementoComElementos } | undefined = atual?.elements?.[id];
      atual = elemento?._target ?? (elemento?.target ? (cds.model?.definitions[elemento.target] as unknown as ElementoComElementos) : undefined);
    }
    garantirChavesDoNivel(atual, coluna.expand);
  }
}

export default class TratativaAppService extends cds.ApplicationService {
  async init() {
    this.before('*', (req) => {
      if (req.user.is('AplicativoOrigem')) req.reject(403, 'Acesso negado.');
    });

    this.before('READ', '*', async function restringirLeitura(req) {
      await restricaoDeLeitura(req);
    });

    // As flags dependem de `status`; o Fiori elements só pede os caminhos das anotações, então garantimos a coluna.
    this.before('READ', 'Tratativas', (req) => {
      const select = (req.query as unknown as { SELECT?: { columns?: { ref?: string[] }[] } }).SELECT;
      const colunas = select?.columns;
      if (!colunas) return;
      const pedeFlag = colunas.some((c) => /^(pode|oculta)(Iniciar|Encerrar|Cancelar|Reabrir|EmitirAval|DefinirMetodologia|DerivarAcao)$/.test(c.ref?.[0] ?? ''));
      const temStatus = colunas.some((c) => c.ref?.[0] === 'status' || c.ref?.[0] === '*');
      const temCodigo = colunas.some((c) => c.ref?.[0] === 'codigo' || c.ref?.[0] === '*');
      if (pedeFlag && !temStatus) colunas.push({ ref: ['status'] });
      if (pedeFlag && !temCodigo) colunas.push({ ref: ['codigo'] });
    });

    // As colunas de vínculo das máscaras (DC-17) são acrescentadas a cada nível, para a decisão fail-closed
    // não esconder o dado de quem tem vínculo. Registrado depois de `restringirLeitura`: a varredura vê só a query do cliente.
    this.before('READ', '*', function garantirChaves(req) {
      const select = (req.query as unknown as { SELECT?: { columns?: unknown[] } }).SELECT;
      garantirChavesDoNivel(req.target as unknown as ElementoComElementos, select?.columns);
    });

    this.after('READ', 'Tratativas', async (resultado, req) => {
      const gestor = req.user.is('GestorTratativa');
      const matricula = normalizarMatricula(obterMatriculaUsuario(req));
      const linhas = (Array.isArray(resultado) ? resultado : [resultado]) as LinhaTratativa[];
      const codigos = linhas.flatMap((linha) => typeof linha?.codigo === 'string' ? [linha.codigo] : []);
      const situacoes = await lerSituacaoAval(codigos);
      const habilitadas = await tratativasComValidadorHabilitado(req, codigos);
      const dados = codigos.length
        ? (await SELECT.from(`${NS}.Tratativas`).columns('codigo', 'status', 'metodologia').where({ codigo: { in: codigos } })) as
          Array<{ codigo: string; status: string; metodologia: string | null }>
        : [];
      const metodologias = new Map(dados.map((linha) => [linha.codigo, linha]));
      const acoesDoUsuario = !gestor && codigos.length
        ? (await SELECT.from(`${NS}.Acoes`).columns('tratativa_codigo', 'responsavel').where({ tratativa_codigo: { in: codigos } })) as
          Array<{ tratativa_codigo: string; responsavel: string }>
        : [];
      const comAcaoDoUsuario = new Set(
        acoesDoUsuario.filter((acao) => normalizarMatricula(acao.responsavel) === matricula).map((acao) => acao.tratativa_codigo),
      );
      for (const linha of linhas) {
        if (!linha) continue;
        const status = linha.status;
        const situacao = linha.codigo ? situacoes.get(linha.codigo) : undefined;
        const base = linha.codigo ? metodologias.get(linha.codigo) : undefined;
        const alteravel = base?.status === 'Aberta' || base?.status === 'Em andamento';
        linha.podeDefinirMetodologia = alteravel && (gestor || (!!linha.codigo && comAcaoDoUsuario.has(linha.codigo)));
        linha.podeDerivarAcao = gestor && alteravel && !!base?.metodologia;
        linha.podeEmitirAval = !!linha.codigo && habilitadas.has(linha.codigo) && !!situacao?.aptaParaEmissao;
        linha.ocultaDefinirMetodologia = !linha.podeDefinirMetodologia;
        linha.ocultaDerivarAcao = !linha.podeDerivarAcao;
        linha.ocultaEmitirAval = !linha.podeEmitirAval;
        linha.podeIniciar = gestor && status === 'Aberta';
        linha.podeEncerrar = gestor && status === 'Em andamento' &&
          !situacao?.acoesAbertas && !!situacao?.aprovadoVigente;
        linha.podeCancelar = gestor && (status === 'Aberta' || status === 'Em andamento');
        linha.podeReabrir = gestor && status === 'Encerrada';
        linha.ocultaIniciar = !linha.podeIniciar;
        linha.ocultaEncerrar = !linha.podeEncerrar;
        linha.ocultaCancelar = !linha.podeCancelar;
        linha.ocultaReabrir = !linha.podeReabrir;
        linha.ocultaResponsaveis = !gestor;
      }
    });

    this.after('READ', '*', async function mascararLeitura(resultado, req) {
      const entidade = req.target as unknown as cds.entity;
      aplicarMascaras(entidade, resultado, await montarContextoMascara(req, entidade, resultado));
    });

    this.on('READ', 'Colaboradores', async (req) => {
      const select = (req.query as unknown as ConsultaValueHelp).SELECT;
      const tamanho = Math.min(Math.max(select?.limit?.rows?.val ?? 50, 1), 200);
      const deslocamento = Math.max(select?.limit?.offset?.val ?? 0, 0);
      const tamanhoPagina = 200;
      const pagina = Math.floor(deslocamento / tamanhoPagina) + 1;
      const deslocamentoPagina = deslocamento % tamanhoPagina;
      const termo = termosBusca(select?.search).join(' ').trim();
      const integracao = await cds.connect.to('IntegracaoPessoasService');
      const filtro = {
        ...(termo ? { termo } : {}),
        apenasAtivos: true,
        tamanhoPagina,
        pagina,
      };
      let colaboradores = await integracao.send('buscarColaboradores', filtro) as {
        matricula: string;
        nome: string;
        email: string;
      }[];
      if (deslocamentoPagina + tamanho > tamanhoPagina) {
        const seguintes = await integracao.send('buscarColaboradores', { ...filtro, pagina: pagina + 1 }) as typeof colaboradores;
        colaboradores = [...colaboradores, ...seguintes];
      }
      return colaboradores
        .slice(deslocamentoPagina, deslocamentoPagina + tamanho)
        .map(({ matricula, nome, email }) => ({ matricula, nome, email }));
    });

    this.on('READ', 'ValoresCriticidade', () => valoresEnum('Criticidade'));
    this.on('READ', 'ValoresPrioridade', () => valoresEnum('PrioridadeAcao'));
    this.on('READ', 'ValoresFerramentaMetodologia', () => valoresEnum('FerramentaMetodologia'));
    this.on('READ', 'ValoresMacrocausa', () => valoresEnum('MacrocausaCausaRaiz'));
    this.on('READ', 'ValoresParecerAval', () => ['Aprovado', 'Reprovado'].map((codigo) => ({ codigo, descricao: codigo })));
    this.on('READ', 'ValoresEvidenciaObrigatoria', () => [
      { codigo: 'Sim', descricao: 'Sim' },
      { codigo: 'Não', descricao: 'Não' },
    ]);

    this.on('criarTratativaAvulsa', async (req) => {
      const dados = req.data as DadosAbertura;
      const { codigo } = await abrirTratativa(dados, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
      return SELECT.one.from(`${NS}.Tratativas`).where({ codigo });
    });

    this.on('mudarStatus', 'Tratativas', async (req) => {
      const { codigo } = req.params[0] as ChaveTratativa;
      await mudarStatus(String(codigo).toLowerCase(), req.data, { id: obterMatriculaUsuario(req), tipo: 'Usuario' });
    });

    const mudarStatusDedicado = (
      req: cds.Request,
      status: 'Em andamento' | 'Encerrada' | 'Cancelada',
    ) => {
      const { codigo } = req.params[0] as ChaveTratativa;
      const { justificativa } = req.data as { justificativa?: string | null };
      return mudarStatus(
        String(codigo).toLowerCase(),
        { status, justificativa },
        { id: obterMatriculaUsuario(req), tipo: 'Usuario' },
      );
    };
    this.on('iniciarTratativa', 'Tratativas', (req) => mudarStatusDedicado(req, 'Em andamento'));
    this.on('encerrarTratativa', 'Tratativas', (req) => mudarStatusDedicado(req, 'Encerrada'));
    this.on('cancelarTratativa', 'Tratativas', (req) => mudarStatusDedicado(req, 'Cancelada'));
    this.on('reabrirTratativa', 'Tratativas', (req) => mudarStatusDedicado(req, 'Em andamento'));

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

    this.on('definirMetodologia', 'Tratativas', async (req) => {
      await definirMetodologia(req, codigoDe(req), req.data as DadosDefinicaoMetodologia, autor(req));
    });

    this.on('derivarAcaoDaMetodologia', 'Tratativas', (req) =>
      derivarAcaoDaMetodologia(req, codigoDe(req), req.data as DadosDerivacaoMetodologia, autor(req)),
    );

    this.on('emitirAvalTecnico', 'Tratativas', async (req) => {
      await emitirAvalTecnico(
        req,
        codigoDe(req),
        req.data as { parecer?: unknown; fundamentacao?: unknown },
        autor(req),
      );
    });

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
