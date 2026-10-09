import cds from '@sap/cds';
import type { Request } from '@sap/cds';
import { obterMatriculaUsuario, normalizarMatricula, matriculasIguais } from './identidade';
import { validarMatricula } from './validacao-matricula';
import { extrairPaginacao } from './listagem';
import { statusAcaoValidos, statusValidos } from './dominios';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

/**
 * R18 (spec responsaveis-e-participantes): estrutura retornada por minhasAcoes.
 */
export interface ItemMinhasAcoes {
  codigo: string;
  codigoTratativa: string;
  tituloTratativa: string;
  statusTratativa: string;
  descricao: string;
  prioridade: string;
  status: string;
  prazo: string;
  evidenciaObrigatoria: string;
  dataConclusao: string | null;
  acaoMae: string | null;
}

/**
 * R19 (spec responsaveis-e-participantes): estrutura retornada por minhasTratativas.
 */
export interface ItemMinhasTratativas {
  codigo: string;
  titulo: string;
  origem: string | null;
  idOrigem: string | null;
  criticidade: string;
  status: string;
  unidade: string | null;
  area: string | null;
  dataCriacao: string;
  dataPrevistaConclusao: string;
  meuPapel: string;
}

/** Filtro ausente, vazio ou só espaços não filtra. */
const informado = (v?: string | null): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * R18, R20 (spec responsaveis-e-participantes): lista Ações e Subações sob responsabilidade do colaborador.
 * Precedência de validações:
 * 1. Autenticação (401 runtime)
 * 2. Aplicativo de origem (403 via before('*'))
 * 3. Parâmetro matricula: se não-gestor e diferente da própria → 403 (CA80, CA112); se gestor e malformada → 400 (CA81, CA112)
 * 4. Parâmetro status: se informado e inválido → 400 (CA70)
 * 5. Paginação: validação via extrairPaginacao (CA71)
 * 
 * @param req - Request do CAP
 * @param status - Filtro opcional de StatusAcao
 * @param matricula - Matrícula do colaborador (padrão: usuário autenticado)
 * @param tamanhoPagina - Tamanho da página (padrão: 50, máx: 200)
 * @param pagina - Número da página (padrão: 1)
 * @returns Lista de Ações do colaborador sem o campo responsavel
 */
export async function minhasAcoes(
  req: Request,
  status?: string | null,
  matricula?: string | null,
  tamanhoPagina?: number | null,
  pagina?: number | null,
): Promise<ItemMinhasAcoes[]> {
  const ehGestor = req.user.is('GestorTratativa');
  const matriculaAlvo = informado(matricula) ? matricula : obterMatriculaUsuario(req);

  // Etapa 3: autorização de matrícula (CA80, CA112)
  if (informado(matricula)) {
    if (!ehGestor) {
      // Não-gestor: qualquer matrícula informada recebe 403 na etapa 2 (papel estático precede validação de formato)
      if (!matriculasIguais(matricula, obterMatriculaUsuario(req))) {
        recusar(403, 'Acesso negado.');
      }
    } else {
      // Gestor: validar formato da matrícula (CA81, CA112)
      validarMatricula(matricula, 'matricula');
    }
  }

  // Etapa 4: validação de status (CA70)
  if (informado(status)) {
    if (!statusAcaoValidos().includes(status)) {
      recusar(400, 'Status inválido: use Pendente, Em andamento, Concluída ou Cancelada.', 'status');
    }
  }

  // Etapa 5: paginação (CA71)
  const { tamanho, offset } = extrairPaginacao(tamanhoPagina, pagina);

  // Buscar Ações e Subações onde o responsavel coincide com a matrícula alvo
  const matriculaNormalizada = normalizarMatricula(matriculaAlvo);
  const onde: Record<string, unknown> = {};
  if (informado(status)) {
    onde.status = status;
  }

  // Projeção de colunas sem responsavel (CA67)
  // Buscar TODAS as ações (sem limit inicial) para poder filtrar por matrícula em memória
  const acoes = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`)
      .columns(
        'codigo',
        'tratativa_codigo as codigoTratativa',
        'descricao',
        'prioridade',
        'status',
        'prazo',
        'evidenciaObrigatoria',
        'dataConclusao',
        'acaoMae_codigo as acaoMae',
        'responsavel',
        'criadoEm',
      )
      .where(onde),
  )) as Array<Omit<ItemMinhasAcoes, 'tituloTratativa' | 'statusTratativa'> & { responsavel: string; criadoEm: string }>;

  // Filtrar por matrícula normalizada após a consulta
  const acoesFiltradasPorMatricula = acoes.filter((acao) => 
    normalizarMatricula(acao.responsavel) === matriculaNormalizada
  );

  // Ordenação em memória (CA68: prazo ASC, criadoEm ASC, codigo ASC)
  acoesFiltradasPorMatricula.sort((a, b) => {
    if (a.prazo !== b.prazo) {
      return a.prazo < b.prazo ? -1 : 1;
    }
    if (a.criadoEm !== b.criadoEm) {
      return a.criadoEm < b.criadoEm ? -1 : 1;
    }
    return a.codigo < b.codigo ? -1 : 1;
  });

  // Aplicar paginação em memória
  const acoesComPaginacao = acoesFiltradasPorMatricula.slice(offset, offset + tamanho);

  // Obter dados das Tratativas (título e status) para enriquecer o resultado (CA67, CA72)
  const codigosTratativas = [...new Set(acoesComPaginacao.map((a) => a.codigoTratativa))];
  if (codigosTratativas.length === 0) {
    return [];
  }

  const tratativas = (await cds.db.run(
    SELECT.from(`${NS}.Tratativas`).columns('codigo', 'titulo', 'status').where({ codigo: { in: codigosTratativas } }),
  )) as Array<{ codigo: string; titulo: string; status: string }>;

  const mapaTratativas = new Map(tratativas.map((t) => [t.codigo, { titulo: t.titulo, status: t.status }]));

  return acoesComPaginacao.map((acao) => {
    const tratativa = mapaTratativas.get(acao.codigoTratativa);
    // Remove o campo responsavel que não deve ser retornado (CA67) e criadoEm que foi usado só para ordenação
    return {
      codigo: acao.codigo,
      codigoTratativa: acao.codigoTratativa,
      descricao: acao.descricao,
      prioridade: acao.prioridade,
      status: acao.status,
      prazo: acao.prazo,
      evidenciaObrigatoria: acao.evidenciaObrigatoria,
      dataConclusao: acao.dataConclusao,
      acaoMae: acao.acaoMae,
      tituloTratativa: tratativa?.titulo ?? '',
      statusTratativa: tratativa?.status ?? '',
    };
  });
}

/**
 * R19, R20 (spec responsaveis-e-participantes): lista Tratativas em que o colaborador é Responsável Principal ou Participante.
 * Precedência de validações:
 * 1. Autenticação (401 runtime)
 * 2. Aplicativo de origem (403 via before('*'))
 * 3. Parâmetro matricula: se não-gestor e diferente da própria → 403 (CA80); se gestor e malformada → 400 (CA81, CA112)
 * 4. Parâmetro status: se informado e inválido → 400 (CA77)
 * 5. Paginação: validação via extrairPaginacao (CA71)
 * 
 * @param req - Request do CAP
 * @param status - Filtro opcional de StatusTratativa
 * @param matricula - Matrícula do colaborador (padrão: usuário autenticado)
 * @param tamanhoPagina - Tamanho da página (padrão: 50, máx: 200)
 * @param pagina - Número da página (padrão: 1)
 * @returns Lista de Tratativas do colaborador com meuPapel, sem Descrição/Solicitante/Responsável/Participantes
 */
export async function minhasTratativas(
  req: Request,
  status?: string | null,
  matricula?: string | null,
  tamanhoPagina?: number | null,
  pagina?: number | null,
): Promise<ItemMinhasTratativas[]> {
  const ehGestor = req.user.is('GestorTratativa');
  const matriculaAlvo = informado(matricula) ? matricula : obterMatriculaUsuario(req);

  // Etapa 3: autorização de matrícula (CA80, CA112)
  if (informado(matricula)) {
    if (!ehGestor) {
      // Não-gestor: qualquer matrícula informada recebe 403
      if (!matriculasIguais(matricula, obterMatriculaUsuario(req))) {
        recusar(403, 'Acesso negado.');
      }
    } else {
      // Gestor: validar formato da matrícula (CA81, CA112)
      validarMatricula(matricula, 'matricula');
    }
  }

  // Etapa 4: validação de status (CA77)
  if (informado(status)) {
    if (!statusValidos().includes(status)) {
      recusar(400, 'Status inválido: use Aberta, Em andamento, Encerrada ou Cancelada.', 'status');
    }
  }

  // Etapa 5: paginação (CA71)
  const { tamanho, offset } = extrairPaginacao(tamanhoPagina, pagina);

  const matriculaNormalizada = normalizarMatricula(matriculaAlvo);

  // Buscar Tratativas onde é Responsável Principal (CA74)
  const ondeResponsavel: Record<string, unknown> = {};
  if (informado(status)) {
    ondeResponsavel.status = status;
  }

  const todasTratativas = (await cds.db.run(
    SELECT.from(`${NS}.Tratativas`)
      .columns('codigo', 'titulo', 'origem', 'idOrigem', 'criticidade', 'status', 'unidade', 'area', 'dataCriacao', 'dataPrevistaConclusao', 'responsavelPrincipal')
      .where(ondeResponsavel),
  )) as Array<Omit<ItemMinhasTratativas, 'meuPapel'> & { responsavelPrincipal: string | null }>;

  // Filtrar as que o usuário é Responsável Principal
  const tratativasComoResponsavel = todasTratativas.filter((t) => 
    t.responsavelPrincipal && normalizarMatricula(t.responsavelPrincipal) === matriculaNormalizada
  );

  // Buscar Tratativas onde é Participante (CA74)
  const ondeParticipante: Record<string, unknown> = {};

  const participantes = (await cds.db.run(
    SELECT.from(`${NS}.ParticipantesTratativa`).columns('tratativa_codigo', 'matricula').where(ondeParticipante),
  )) as Array<{ tratativa_codigo: string; matricula: string }>;

  // Filtrar os participantes que coincidem com a matrícula normalizada
  const codigosTratativasComoParticipante = participantes
    .filter((p) => normalizarMatricula(p.matricula) === matriculaNormalizada)
    .map((p) => p.tratativa_codigo);

  let tratativasComoParticipante: Array<Omit<ItemMinhasTratativas, 'meuPapel'> & { responsavelPrincipal: string | null }> = [];
  if (codigosTratativasComoParticipante.length > 0) {
    const ondeParticipanteTratativas: Record<string, unknown> = {
      codigo: { in: codigosTratativasComoParticipante },
    };
    if (informado(status)) {
      ondeParticipanteTratativas.status = status;
    }

    tratativasComoParticipante = (await cds.db.run(
      SELECT.from(`${NS}.Tratativas`)
        .columns('codigo', 'titulo', 'origem', 'idOrigem', 'criticidade', 'status', 'unidade', 'area', 'dataCriacao', 'dataPrevistaConclusao', 'responsavelPrincipal')
        .where(ondeParticipanteTratativas),
    )) as Array<Omit<ItemMinhasTratativas, 'meuPapel'> & { responsavelPrincipal: string | null }>;
  }

  // Unir as duas listas e anotar o papel (CA74), removendo o campo responsavelPrincipal
  const responsavelComPapel = tratativasComoResponsavel.map((t) => ({
    codigo: t.codigo,
    titulo: t.titulo,
    origem: t.origem,
    idOrigem: t.idOrigem,
    criticidade: t.criticidade,
    status: t.status,
    unidade: t.unidade,
    area: t.area,
    dataCriacao: t.dataCriacao,
    dataPrevistaConclusao: t.dataPrevistaConclusao,
    meuPapel: 'Responsável Principal' as const,
  }));
  const participanteComPapel = tratativasComoParticipante.map((t) => ({
    codigo: t.codigo,
    titulo: t.titulo,
    origem: t.origem,
    idOrigem: t.idOrigem,
    criticidade: t.criticidade,
    status: t.status,
    unidade: t.unidade,
    area: t.area,
    dataCriacao: t.dataCriacao,
    dataPrevistaConclusao: t.dataPrevistaConclusao,
    meuPapel: 'Participante' as const,
  }));

  // Combinar e eliminar duplicatas (caso seja Responsável E Participante)
  const mapaTratativas = new Map<string, ItemMinhasTratativas>();
  for (const t of responsavelComPapel) {
    mapaTratativas.set(t.codigo, t);
  }
  for (const t of participanteComPapel) {
    // Se já está no mapa como Responsável, não sobrescreve
    if (!mapaTratativas.has(t.codigo)) {
      mapaTratativas.set(t.codigo, t);
    }
  }

  // Ordenar e paginar (CA78)
  const todas = Array.from(mapaTratativas.values()).sort((a, b) => {
    if (a.dataPrevistaConclusao !== b.dataPrevistaConclusao) {
      return a.dataPrevistaConclusao < b.dataPrevistaConclusao ? -1 : 1;
    }
    if (a.dataCriacao !== b.dataCriacao) {
      return a.dataCriacao < b.dataCriacao ? -1 : 1;
    }
    return a.codigo < b.codigo ? -1 : 1;
  });

  return todas.slice(offset, offset + tamanho);
}
