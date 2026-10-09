// Orquestrador da action anexarEvidencia: bloqueio D9, 10 passos de precedência e compensação.
// R1-R7, R12-R14 (spec evidencias).

import cds from '@sap/cds';
import type { Autor } from './abertura';
import type { Request } from '@sap/cds';
import { bloquearTratativa, exigirAlteravel } from './bloqueio';
import { codigoValido } from './consulta';
import { obterMatriculaUsuario, usuarioAutenticadoEhMatricula } from './identidade';
import { registrarHistorico } from './historico';
import { recusar } from './recusa';
import { agora } from '../lib/relogio';
import { getStorage } from './evidencias-storage';
import {
  sanitizarNomeArquivo,
  validarNomeArquivo,
  validarMimeType,
  validarFormato,
  validarTamanho,
  validarDescricao,
} from './evidencias-validacao';

const NS = 'br.com.calazanstec';
const LIMITE_EVIDENCIAS = 10;

export interface DadosAnexoEvidencia {
  acao: string;
  nomeArquivo: string;
  mimeType: string;
  conteudo: string; // Base64
  descricao?: string | null;
}

export interface DetalheEvidencia {
  codigo: string;
  acao: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  descricao: string | null;
  criadoEm: string;
  autorAnexo: string;
}

/**
 * Orquestrador da action anexarEvidencia.
 * Precedência conforme D10:
 * 1. Autenticação (401 runtime)
 * 2. Forma no runtime (400 runtime ou 413 do framework para corpos > 20 MB)
 * 3. Aplicativo de origem (403 antes do domínio - tratado no before('*') do serviço)
 * 4. Forma de identificador da Ação no domínio (400 código inválido)
 * 5. Existência da Tratativa (404) - com bloqueio D9
 * 6. Existência da Ação (404)
 * 7. Autorização dinâmica (403 para terceiros)
 * 8. Estado da Tratativa (409 Encerrada/Cancelada)
 * 9. Estado da Ação (409 Concluída/Cancelada)
 * 10. Estado das Evidências (409 limite de 10 atingido)
 * 11. Campos no domínio (400/413/415 validações de nome, formato, tamanho, descrição)
 */
export async function anexarEvidencia(
  req: Request,
  codigoTratativa: string,
  dados: DadosAnexoEvidencia,
  autor: Autor,
): Promise<DetalheEvidencia> {
  // Etapa 4: Forma de identificador da Ação no domínio (antes do bloqueio D9)
  if (!dados.acao || !codigoValido(dados.acao)) {
    recusar(400, 'Código inválido.', 'acao');
  }

  // Etapa 5: Existência da Tratativa - bloqueio D9 serializa acesso
  const tratativa = await bloquearTratativa(codigoTratativa);

  // Etapa 6: Existência da Ação dentro da Tratativa
  const acao = await cds.db.run(
    SELECT.one
      .from(`${NS}.Acoes`)
      .columns('codigo', 'tratativa_codigo', 'responsavel', 'status')
      .where({ codigo: dados.acao, tratativa_codigo: codigoTratativa }),
  );

  if (!acao) {
    recusar(404, 'Ação não encontrada.');
  }

  // Etapa 7: Autorização dinâmica - Gestor OU Responsável da Ação
  const ehGestor = req.user.is('GestorTratativa');
  const ehResponsavel = usuarioAutenticadoEhMatricula(req, acao.responsavel);

  if (!ehGestor && !ehResponsavel) {
    recusar(403, 'Forbidden');
  }

  // Etapa 8: Estado da Tratativa
  exigirAlteravel(tratativa);

  // Etapa 9: Estado da Ação
  if (acao.status === 'Concluída' || acao.status === 'Cancelada') {
    recusar(409, `Ação ${acao.status} não pode ser alterada.`);
  }

  // Etapa 10: Limite de evidências ativas
  const contagem = (await cds.db.run(
    SELECT.from(`${NS}.Evidencias`)
      .columns('count(*) as total')
      .where({ acao_codigo: dados.acao, ativo: true }),
  )) as Array<{ total: number }>;
  const totalEvidencias = contagem[0]?.total || 0;

  if (totalEvidencias >= LIMITE_EVIDENCIAS) {
    recusar(409, 'Limite de 10 evidências por Ação atingido.');
  }

  // Etapa 11: Validações de campos
  const nomeArquivoSanitizado = sanitizarNomeArquivo(dados.nomeArquivo);
  validarNomeArquivo(nomeArquivoSanitizado);
  validarMimeType(dados.mimeType);
  validarFormato(nomeArquivoSanitizado, dados.mimeType);

  // Decodificar Base64
  const buffer = Buffer.from(dados.conteudo, 'base64');
  const tamanho = buffer.length;

  validarTamanho(tamanho);

  const descricaoValidada = validarDescricao(dados.descricao);

  // Persistência transacional: metadados e binário
  const codigoEvidencia = cds.utils.uuid();
  const instante = agora();
  const matriculaAutor = obterMatriculaUsuario(req);

  // Salvar binário no repositório ANTES de gravar no banco
  const storage = await getStorage();
  await storage.salvar(codigoEvidencia, buffer);

  try {
    // Inserir metadados no banco
    await cds.db.run(
      INSERT.into(`${NS}.Evidencias`).entries({
        codigo: codigoEvidencia,
        tratativa_codigo: codigoTratativa,
        acao_codigo: dados.acao,
        nomeArquivo: nomeArquivoSanitizado,
        mimeType: dados.mimeType,
        tamanho,
        descricao: descricaoValidada,
        ativo: true,
        criadoEm: instante.toISOString(),
        autorAnexo: matriculaAutor,
      }),
    );

    // Registrar histórico de inclusão (R12: sem nome de arquivo, sem binário)
    await registrarHistorico(
      codigoTratativa,
      autor,
      [
        {
          evento: 'InclusaoEvidencia',
          evidencia: codigoEvidencia,
          mimeType: dados.mimeType,
          tamanho,
        },
      ],
      instante,
      dados.acao,
    );
  } catch (erro) {
    // Compensação: excluir binário do repositório em caso de falha no banco
    await storage.excluir(codigoEvidencia);
    throw erro;
  }

  // Retornar detalhes da evidência criada
  return {
    codigo: codigoEvidencia,
    acao: dados.acao,
    nomeArquivo: nomeArquivoSanitizado,
    mimeType: dados.mimeType,
    tamanho,
    descricao: descricaoValidada,
    criadoEm: instante.toISOString(),
    autorAnexo: matriculaAutor,
  };
}
