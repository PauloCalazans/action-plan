import cds from '@sap/cds';
import path from 'path';
import fs from 'fs';
import { codigoValido } from './consulta';
import { recusar } from './recusa';
import { registrarHistorico } from './historico';
import { usuarioAutenticadoEhMatricula } from './identidade';

const NS = 'br.com.calazanstec';
const FINAIS = ['Concluída', 'Cancelada'];

interface StorageModule {
  salvar: (id: string, conteudo: Buffer) => Promise<void>;
  obter: (id: string) => Promise<Buffer | null>;
  excluir: (id: string) => Promise<void>;
}

let storageModule: StorageModule | null = null;
async function getStorage(): Promise<StorageModule> {
  if (!storageModule) {
    await cds.connect.to('ArmazenamentoEvidencias');
    const impl = cds.env.requires?.ArmazenamentoEvidencias?.impl || './armazenamento-evidencias';
    let modulePath = impl;
    
    if (!path.isAbsolute(impl)) {
      const fromRoot = path.resolve(process.cwd(), impl);
      const fromHere = path.resolve(__dirname, impl);
      
      if (fs.existsSync(fromRoot + '.ts') || fs.existsSync(fromRoot + '.js')) {
        modulePath = fromRoot;
      } else if (fs.existsSync(fromHere + '.ts') || fs.existsSync(fromHere + '.js')) {
        modulePath = fromHere;
      }
    }
    
    const imported = await import(modulePath);
    storageModule = imported.default || imported;
  }
  if (!storageModule) {
    throw new Error('Falha ao carregar módulo de armazenamento');
  }
  return storageModule;
}

interface PendenciaEvidencia {
  acao: string;
  descricao: string;
  responsavel: string | null;
  status: string;
}

interface ItemEvidencia {
  codigo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  descricao: string | null;
  criadoEm: string;
  autorAnexo: string | null;
}

interface ItemEvidenciaTratativa extends ItemEvidencia {
  acao: string;
}

interface DetalheDownloadEvidencia {
  codigo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  conteudo: string;
}

/**
 * R9, R17 (006 etapa 3): lista Ações e Subações com evidência obrigatória sem Evidências ativas.
 * Aplicação de menor privilégio (R11):
 * - Gestor: vê todas as Ações/Subações com pendência e respectivos responsáveis
 * - Responsável: vê apenas as Ações/Subações sob sua responsabilidade com responsavel = null
 * - Terceiros: lista vazia
 */
export async function listarPendenciasEvidenciasTratativa(
  req: cds.Request,
  codigoTratativa: string,
): Promise<PendenciaEvidencia[]> {
  // Validação de código
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'tratativa');

  // Verificar existência da Tratativa (sem bloqueio D9, consulta não bloqueia)
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo')
      .where({ codigo: codigoTratativa }),
  )) as { codigo: string } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  const ehGestor = req.user.is('GestorTratativa');
  const matriculaUsuario = req.user.id;

  // Buscar Ações com evidência obrigatória, não finalizadas, sem evidências ativas
  const acoes = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`)
      .columns('codigo', 'descricao', 'responsavel', 'status')
      .where({ 
        tratativa_codigo: codigoTratativa, 
        evidenciaObrigatoria: true,
        status: { 'not in': FINAIS },
      }),
  )) as Array<{ codigo: string; descricao: string; responsavel: string; status: string }>;

  if (!acoes || acoes.length === 0) {
    return [];
  }

  // Filtrar apenas as Ações que não têm evidências ativas
  const pendencias: PendenciaEvidencia[] = [];

  for (const acao of acoes) {
    // Contar evidências ativas desta Ação
    const evidenciasAtivas = (await cds.db.run(
      SELECT.one.from(`${NS}.Evidencias`).columns('count(*) as total')
        .where({ acao_codigo: acao.codigo, ativo: true }),
    )) as { total: number } | undefined;
    
    const contagem = evidenciasAtivas?.total ?? 0;
    
    // Se não tem evidências ativas, é uma pendência
    if (contagem === 0) {
      // Aplicar menor privilégio
      if (ehGestor) {
        // Gestor vê tudo com responsável preenchido
        pendencias.push({
          acao: acao.codigo,
          descricao: acao.descricao,
          responsavel: acao.responsavel,
          status: acao.status,
        });
      } else if (acao.responsavel.toLowerCase() === matriculaUsuario.toLowerCase()) {
        // Responsável vê apenas suas Ações com responsavel = null
        pendencias.push({
          acao: acao.codigo,
          descricao: acao.descricao,
          responsavel: null,
          status: acao.status,
        });
      }
      // Terceiros não veem nada (não entra no if)
    }
  }

  return pendencias;
}


/**
 * R11 (006 etapa 4): lista Evidências ativas de uma Ação ou Subação.
 * Aplicação de menor privilégio (R11):
 * - Gestor: vê todas as Evidências com autorAnexo preenchido
 * - Responsável da Ação: vê todas as Evidências com autorAnexo = null
 * - Terceiros (Responsável Principal, Participantes, outros): lista vazia
 */
export async function listarEvidenciasAcao(
  req: cds.Request,
  codigoTratativa: string,
  codigoAcao: string,
): Promise<ItemEvidencia[]> {
  // Etapa 4: Validação de código
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'tratativa');
  if (!codigoValido(codigoAcao)) recusar(400, 'Código inválido.', 'acao');

  // Etapa 5: Verificar existência da Tratativa
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo')
      .where({ codigo: codigoTratativa }),
  )) as { codigo: string } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  // Etapa 5: Verificar existência da Ação e vínculo com a Tratativa
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'responsavel')
      .where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as { codigo: string; responsavel: string } | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');

  const ehGestor = req.user.is('GestorTratativa');
  const ehResponsavel = usuarioAutenticadoEhMatricula(req, acao.responsavel);

  // Menor privilégio: Gestor e Responsável veem, terceiros não
  if (!ehGestor && !ehResponsavel) {
    return [];
  }

  // Buscar evidências ativas
  const evidencias = (await cds.db.run(
    SELECT.from(`${NS}.Evidencias`)
      .columns('codigo', 'nomeArquivo', 'mimeType', 'tamanho', 'descricao', 'criadoEm', 'autorAnexo')
      .where({ acao_codigo: codigoAcao, ativo: true })
      .orderBy('criadoEm'),
  )) as Array<{
    codigo: string;
    nomeArquivo: string;
    mimeType: string;
    tamanho: number;
    descricao: string | null;
    criadoEm: string;
    autorAnexo: string;
  }>;

  // Aplicar mascaramento LGPD: Responsável vê autorAnexo = null
  return evidencias.map((ev) => ({
    ...ev,
    autorAnexo: ehGestor ? ev.autorAnexo : null,
  }));
}

/**
 * R11 (006 etapa 4): lista todas as Evidências ativas da Tratativa.
 * Aplicação de menor privilégio (R11):
 * - Gestor: vê todas as Evidências de todas as Ações com autorAnexo preenchido
 * - Responsável de Ação: vê apenas as Evidências das Ações sob sua responsabilidade com autorAnexo = null
 * - Terceiros: lista vazia
 */
export async function listarEvidenciasTratativa(
  req: cds.Request,
  codigoTratativa: string,
): Promise<ItemEvidenciaTratativa[]> {
  // Etapa 4: Validação de código
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'tratativa');

  // Etapa 5: Verificar existência da Tratativa
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo')
      .where({ codigo: codigoTratativa }),
  )) as { codigo: string } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  const ehGestor = req.user.is('GestorTratativa');
  const matriculaUsuario = req.user.id;

  // Buscar todas as evidências ativas da Tratativa com código da Ação
  const evidencias = (await cds.db.run(
    SELECT.from(`${NS}.Evidencias`)
      .columns('codigo', 'acao_codigo as acao', 'nomeArquivo', 'mimeType', 'tamanho', 'descricao', 'criadoEm', 'autorAnexo')
      .where({ tratativa_codigo: codigoTratativa, ativo: true })
      .orderBy('criadoEm'),
  )) as Array<{
    codigo: string;
    acao: string;
    nomeArquivo: string;
    mimeType: string;
    tamanho: number;
    descricao: string | null;
    criadoEm: string;
    autorAnexo: string;
  }>;

  if (!ehGestor) {
    // Buscar Ações sob responsabilidade do usuário
    const acoesDoUsuario = (await cds.db.run(
      SELECT.from(`${NS}.Acoes`)
        .columns('codigo')
        .where({ tratativa_codigo: codigoTratativa, responsavel: matriculaUsuario }),
    )) as Array<{ codigo: string }>;

    const codigosAcoesDoUsuario = new Set(acoesDoUsuario.map((a) => a.codigo));

    // Filtrar apenas evidências das Ações do usuário
    const evidenciasFiltradas = evidencias.filter((ev) => codigosAcoesDoUsuario.has(ev.acao));

    // Mascarar autorAnexo
    return evidenciasFiltradas.map((ev) => ({
      ...ev,
      autorAnexo: null,
    }));
  }

  // Gestor vê tudo com autorAnexo preenchido
  return evidencias;
}

/**
 * R11, R12 (006 etapa 4): baixa Evidência com conteúdo em Base64 e auditoria prévia.
 * Exceção à D9: download não bloqueia a Tratativa (permite concorrência de downloads).
 * Auditoria mandatória: grava DownloadEvidencia ANTES de entregar o binário.
 * Se a gravação falhar, o binário não é entregue.
 */
export async function baixarEvidencia(
  req: cds.Request,
  codigoTratativa: string,
  codigoAcao: string,
  codigoEvidencia: string,
): Promise<DetalheDownloadEvidencia> {
  // Etapa 4: Validação de código
  if (!codigoValido(codigoTratativa)) recusar(400, 'Código inválido.', 'tratativa');
  if (!codigoValido(codigoAcao)) recusar(400, 'Código inválido.', 'acao');
  if (!codigoValido(codigoEvidencia)) recusar(400, 'Código inválido.', 'evidencia');

  // Etapa 5: Verificar existência da Tratativa
  const tratativa = (await cds.db.run(
    SELECT.one.from(`${NS}.Tratativas`).columns('codigo')
      .where({ codigo: codigoTratativa }),
  )) as { codigo: string } | undefined;
  if (!tratativa) recusar(404, 'Tratativa não encontrada.');

  // Etapa 5: Verificar existência da Ação e vínculo com a Tratativa
  const acao = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns('codigo', 'responsavel')
      .where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as { codigo: string; responsavel: string } | undefined;
  if (!acao) recusar(404, 'Ação não encontrada.');

  // Etapa 5: Verificar existência da Evidência ativa, vínculo com a Ação
  const evidencia = (await cds.db.run(
    SELECT.one.from(`${NS}.Evidencias`)
      .columns('codigo', 'nomeArquivo', 'mimeType', 'tamanho', 'ativo')
      .where({ codigo: codigoEvidencia, acao_codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as { codigo: string; nomeArquivo: string; mimeType: string; tamanho: number; ativo: boolean } | undefined;
  
  if (!evidencia || !evidencia.ativo) recusar(404, 'Evidência não encontrada.');

  // Etapa 6: Autorização dinâmica (Gestor ou Responsável da Ação)
  const ehGestor = req.user.is('GestorTratativa');
  const ehResponsavel = usuarioAutenticadoEhMatricula(req, acao.responsavel);

  if (!ehGestor && !ehResponsavel) {
    recusar(403, 'Forbidden');
  }

  // Recuperar o binário do repositório de armazenamento
  const storage = await getStorage();
  const conteudoBuffer = await storage.obter(codigoEvidencia);

  if (!conteudoBuffer) {
    throw new Error('Arquivo não encontrado no repositório de armazenamento.');
  }

  // Gravar auditoria ANTES de entregar o binário (R12 c)
  // Se falhar, a transação é revertida e o binário não é entregue
  await registrarHistorico(
    codigoTratativa,
    { id: req.user.id, tipo: 'Usuario' },
    [
      {
        evento: 'DownloadEvidencia',
        evidencia: codigoEvidencia,
        mimeType: evidencia.mimeType,
        tamanho: evidencia.tamanho,
      },
    ],
    new Date(),
    codigoAcao,
  );

  // Codificar em Base64 para devolução
  const conteudoBase64 = conteudoBuffer.toString('base64');

  return {
    codigo: evidencia.codigo,
    nomeArquivo: evidencia.nomeArquivo,
    mimeType: evidencia.mimeType,
    tamanho: evidencia.tamanho,
    conteudo: conteudoBase64,
  };
}
