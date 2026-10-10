import cds from '@sap/cds';
import { registrarCredenciais } from './apoio/credenciais';
import { criarAvulsa, editar, mudarStatus, sufixoUnico, type Envia } from './apoio/tratativas';
import { comoGestor, comoM1001, comoM2002, comoM9999 } from './apoio/usuarios';
import { criarAcao, criarSubacao } from './apoio/acoes';
import { atribuirResponsavelPrincipal, incluirParticipante, delegarAcao } from './apoio/responsaveis';
import { anexarEvidencia } from './apoio/evidencias';
import { comentarTratativa } from './apoio/comentarios';
import { consultarHistoricoTratativa, type Consulta } from './apoio/historico';

// Etapa 3 (RED): autorização dinâmica, segregação de menor privilégio e mascaramento LGPD.
// CA9, CA10, CA11, CA12, CA12a, CA13, CA14, CA15, CA27a, CA35, CA36, CA37, CA38, CA39, CA40, CA41, CA42.

const { GET, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const consultar = GET as unknown as Consulta;

jest.setTimeout(60000);

beforeAll(registrarCredenciais);

type Item = Record<string, unknown>;
type Detalhe = { campo?: string | null; valorAnterior?: unknown; valorNovo?: unknown; justificativa?: unknown };

async function criarTratativaAberta(dados: Record<string, unknown> = {}): Promise<string> {
  const r = await criarAvulsa(enviar, { titulo: `Título ${sufixoUnico()}`, criticidade: 'Alta', ...dados });
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function criarAcaoComResponsavel(tratativa: string, responsavel = 'M1001'): Promise<string> {
  const r = await criarAcao(enviar, tratativa, {
    descricao: `Descrição da Ação ${sufixoUnico()}`,
    prioridade: 'Alta',
    prazo: '2027-01-01',
    responsavel,
  }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function criarSubacaoComResponsavel(tratativa: string, acaoMae: string, responsavel = 'M2002'): Promise<string> {
  const r = await criarSubacao(enviar, tratativa, {
    acaoMae,
    descricao: `Descrição da Subação ${sufixoUnico()}`,
    prioridade: 'Alta',
    prazo: '2027-01-01',
    responsavel,
  }, comoGestor);
  expect(r.status).toBe(200);
  return r.data.codigo as string;
}

async function historico(tratativa: string, como: unknown, filtros: Record<string, unknown> = {}) {
  return consultarHistoricoTratativa(consultar, { tratativa, ...filtros }, como);
}

describe('Etapa 3: autorização dinâmica, segregação de menor privilégio e mascaramento LGPD', () => {
  describe('CA9 (R5): Gestor tem visão irrestrita com autor, justificativa e matrículas preenchidos', () => {
    it('Gestor recebe autor preenchido e, em evento com justificativa, a justificativa integral', async () => {
      const tratativa = await criarTratativaAberta();
      const cancelar = await mudarStatus(enviar, tratativa, { status: 'Cancelada', justificativa: 'Motivo do cancelamento' }, comoGestor);
      expect(cancelar.status).toBe(204);

      const r = await historico(tratativa, comoGestor);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      for (const item of itens) expect(typeof item.autor).toBe('string');

      const cancelamento = itens.find((i) => i.tipoEvento === 'Cancelamento');
      expect(cancelamento).toBeDefined();
      expect((cancelamento as Item).autor).not.toBeNull();
      expect(((cancelamento as Item).detalhe as Detalhe).justificativa).toBe('Motivo do cancelamento');
    });

    it('Gestor recebe a matrícula do Solicitante preenchida em evento de Edicao', async () => {
      const tratativa = await criarTratativaAberta();
      const edicao = await editar(enviar, tratativa, { solicitante: 'M9999' }, comoGestor);
      expect(edicao.status).toBe(204);

      const r = await historico(tratativa, comoGestor);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const edicaoSolicitante = itens.find(
        (i) => i.tipoEvento === 'Edicao' && ((i.detalhe as Detalhe).campo === 'Solicitante' || (i.detalhe as Detalhe).campo === 'solicitante'),
      );
      expect(edicaoSolicitante).toBeDefined();
      expect(((edicaoSolicitante as Item).detalhe as Detalhe).valorNovo).toBe('M9999');
    });
  });

  describe('CA10 (R5): Responsável Principal/Participante recebem só eventos diretos da Tratativa, mascarados', () => {
    it('Responsável Principal recebe apenas eventos com codigoAcao null, com autor e justificativa null', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M2002');
      const atribuicao = await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor);
      expect(atribuicao.status).toBe(204);

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.length).toBeGreaterThan(0);
      for (const item of itens) {
        expect(item.codigoAcao).toBeNull();
        expect(item.autor).toBeNull();
      }
      void acao;
    });

    it('Participante da Tratativa recebe autor: null e justificativa: null em evento com justificativa', async () => {
      const tratativa = await criarTratativaAberta();
      const participacao = await incluirParticipante(enviar, tratativa, { participante: 'M2002' }, comoGestor);
      expect(participacao.status).toBe(204);
      const cancelar = await mudarStatus(enviar, tratativa, { status: 'Cancelada', justificativa: 'Motivo confidencial' }, comoGestor);
      expect(cancelar.status).toBe(204);

      const r = await historico(tratativa, comoM2002);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.length).toBeGreaterThan(0);
      const cancelamento = itens.find((i) => i.tipoEvento === 'Cancelamento');
      expect(cancelamento).toBeDefined();
      expect((cancelamento as Item).autor).toBeNull();
      expect(((cancelamento as Item).detalhe as Detalhe).justificativa).toBeNull();
    });

    it('Responsável Principal recebe valorAnterior e valorNovo null em Edicao do campo Solicitante', async () => {
      const tratativa = await criarTratativaAberta();
      const atribuicao = await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor);
      expect(atribuicao.status).toBe(204);
      const edicao = await editar(enviar, tratativa, { solicitante: 'M9999' }, comoGestor);
      expect(edicao.status).toBe(204);

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const edicaoSolicitante = itens.find(
        (i) => i.tipoEvento === 'Edicao' && ((i.detalhe as Detalhe).campo === 'Solicitante' || (i.detalhe as Detalhe).campo === 'solicitante'),
      );
      expect(edicaoSolicitante).toBeDefined();
      expect(((edicaoSolicitante as Item).detalhe as Detalhe).valorAnterior).toBeNull();
      expect(((edicaoSolicitante as Item).detalhe as Detalhe).valorNovo).toBeNull();
    });

    it('Responsável Principal não recebe eventos de Ação (codigoAcao preenchido)', async () => {
      const tratativa = await criarTratativaAberta();
      await criarAcaoComResponsavel(tratativa, 'M2002');
      const atribuicao = await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M1001' }, comoGestor);
      expect(atribuicao.status).toBe(204);

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.some((i) => i.origem === 'Acao')).toBe(false);
    });
  });

  describe('CA11 (R5): Responsável da Ação recebe só eventos da própria Ação, mascarados', () => {
    it('Responsável sem papel na Tratativa recebe apenas eventos da sua Ação com autor e justificativa null', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.length).toBeGreaterThan(0);
      for (const item of itens) {
        expect(item.codigoAcao).toBe(acao);
        expect(item.autor).toBeNull();
      }
    });

    it('Delegação recebida pelo Responsável traz autor: null e justificativa: null', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      const delegacao = await delegarAcao(enviar, tratativa, { acao, novoResponsavel: 'M2002', justificativa: 'Realocação de equipe' }, comoGestor);
      expect(delegacao.status).toBe(204);

      const r = await historico(tratativa, comoM2002);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const delegacaoEvento = itens.find((i) => i.tipoEvento === 'DelegacaoAcao');
      expect(delegacaoEvento).toBeDefined();
      expect((delegacaoEvento as Item).autor).toBeNull();
      expect(((delegacaoEvento as Item).detalhe as Detalhe).justificativa).toBeNull();
    });

    it('Responsável da Ação não recebe eventos diretos da Tratativa (sem vínculo de Participante)', async () => {
      const tratativa = await criarTratativaAberta();
      await criarAcaoComResponsavel(tratativa, 'M1001');
      const edicao = await editar(enviar, tratativa, { titulo: `Novo ${sufixoUnico()}` }, comoGestor);
      expect(edicao.status).toBe(204);

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.some((i) => i.codigoAcao === null)).toBe(false);
    });
  });

  describe('CA12 (R5): Responsável de Subação só vê eventos da própria Subação', () => {
    it('Responsável da Subação não recebe eventos da Ação mãe nem de outra Subação', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoMae = await criarAcaoComResponsavel(tratativa, 'M1001');
      const subacao1 = await criarSubacaoComResponsavel(tratativa, acaoMae, 'M2002');
      await criarSubacaoComResponsavel(tratativa, acaoMae, 'M9999');

      const r = await historico(tratativa, comoM2002);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.length).toBeGreaterThan(0);
      for (const item of itens) expect(item.codigoAcao).toBe(subacao1);
    });
  });

  describe('CA12a (R5): Responsável da Ação mãe só vê eventos da própria Ação mãe', () => {
    it('Responsável da Ação mãe não recebe eventos das Subações filhas', async () => {
      const tratativa = await criarTratativaAberta();
      const acaoMae = await criarAcaoComResponsavel(tratativa, 'M1001');
      await criarSubacaoComResponsavel(tratativa, acaoMae, 'M2002');

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      expect(itens.length).toBeGreaterThan(0);
      for (const item of itens) expect(item.codigoAcao).toBe(acaoMae);
    });
  });

  describe('CA13 (R5): múltiplos papéis recebem a união dos eventos autorizados', () => {
    it('Participante da Tratativa e Responsável da Ação 1 recebe eventos diretos + da Ação 1, não da Ação 2', async () => {
      const tratativa = await criarTratativaAberta();
      const acao1 = await criarAcaoComResponsavel(tratativa, 'M1001');
      const acao2 = await criarAcaoComResponsavel(tratativa, 'M9999');
      const participacao = await incluirParticipante(enviar, tratativa, { participante: 'M1001' }, comoGestor);
      expect(participacao.status).toBe(204);

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];

      const temDireto = itens.some((i) => i.codigoAcao === null);
      const temAcao1 = itens.some((i) => i.codigoAcao === acao1);
      const temAcao2 = itens.some((i) => i.codigoAcao === acao2);
      expect(temDireto).toBe(true);
      expect(temAcao1).toBe(true);
      expect(temAcao2).toBe(false);
      for (const item of itens) expect(item.autor).toBeNull();
    });
  });

  describe('CA14 (R5): Delegação altera o vínculo dinamicamente no momento da consulta', () => {
    it('antigo responsável perde acesso e novo responsável ganha acesso aos eventos da Ação após a delegação', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');

      const antesAntigo = await historico(tratativa, comoM1001);
      expect(antesAntigo.status).toBe(200);
      expect((antesAntigo.data as Item[]).length).toBeGreaterThan(0);

      const delegacao = await delegarAcao(enviar, tratativa, { acao, novoResponsavel: 'M2002', justificativa: 'Troca de equipe' }, comoGestor);
      expect(delegacao.status).toBe(204);

      const depoisAntigo = await historico(tratativa, comoM1001);
      expect(depoisAntigo.status).toBe(200);
      expect(depoisAntigo.data).toEqual([]);

      const depoisNovo = await historico(tratativa, comoM2002);
      expect(depoisNovo.status).toBe(200);
      expect((depoisNovo.data as Item[]).length).toBeGreaterThan(0);
      for (const item of depoisNovo.data as Item[]) expect(item.codigoAcao).toBe(acao);
    });
  });

  describe('CA15 (R5): usuário sem nenhum vínculo recebe lista vazia com 200', () => {
    it('usuário autenticado sem papel na Tratativa nem em Ações recebe []', async () => {
      const tratativa = await criarTratativaAberta();
      await criarAcaoComResponsavel(tratativa, 'M1001');

      const r = await historico(tratativa, comoM9999);
      expect(r.status).toBe(200);
      expect(r.data).toEqual([]);
    });
  });

  describe('CA27a (R5, R7): Responsável de uma Ação filtrando por codigoAcao de outra Ação recebe [] com 200', () => {
    it('Responsável da Ação 1 filtrando pela Ação 2 (mesma Tratativa) recebe lista vazia', async () => {
      const tratativa = await criarTratativaAberta();
      await criarAcaoComResponsavel(tratativa, 'M1001');
      const acao2 = await criarAcaoComResponsavel(tratativa, 'M2002');

      const r = await historico(tratativa, comoM1001, { codigoAcao: acao2 });
      expect(r.status).toBe(200);
      expect(r.data).toEqual([]);
    });
  });

  describe('CA35 (R8): Edicao de Descrição nunca grava o texto da descrição no detalhe', () => {
    it('evento Edicao do campo Descrição não traz o texto anterior nem o novo no detalhe', async () => {
      const tratativa = await criarTratativaAberta();
      const edicao = await editar(enviar, tratativa, { descricao: 'Novo relato detalhado do caso' }, comoGestor);
      expect(edicao.status).toBe(204);

      const r = await historico(tratativa, comoGestor);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const edicaoDescricao = itens.find(
        (i) => i.tipoEvento === 'Edicao' && ((i.detalhe as Detalhe).campo === 'Descrição' || (i.detalhe as Detalhe).campo === 'descricao'),
      );
      expect(edicaoDescricao).toBeDefined();
      const detalhe = (edicaoDescricao as Item).detalhe as Detalhe;
      expect(detalhe.valorAnterior).not.toBe('Novo relato detalhado do caso');
      expect(JSON.stringify(detalhe)).not.toContain('Novo relato detalhado do caso');
    });
  });

  describe('CA36 (R8): Edicao de Solicitante consultado por não-Gestor traz valorAnterior/valorNovo null', () => {
    it('Participante consultando após edição de Solicitante recebe valores mascarados', async () => {
      const tratativa = await criarTratativaAberta();
      const participacao = await incluirParticipante(enviar, tratativa, { participante: 'M1001' }, comoGestor);
      expect(participacao.status).toBe(204);
      const edicao = await editar(enviar, tratativa, { solicitante: 'M9999' }, comoGestor);
      expect(edicao.status).toBe(204);

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const edicaoSolicitante = itens.find(
        (i) => i.tipoEvento === 'Edicao' && ((i.detalhe as Detalhe).campo === 'Solicitante' || (i.detalhe as Detalhe).campo === 'solicitante'),
      );
      expect(edicaoSolicitante).toBeDefined();
      const detalhe = (edicaoSolicitante as Item).detalhe as Detalhe;
      expect(detalhe.valorAnterior).toBeNull();
      expect(detalhe.valorNovo).toBeNull();
    });
  });

  describe('CA37 (R8): Evidência nunca expõe nome de arquivo nem conteúdo binário no histórico', () => {
    it('InclusaoEvidencia não traz nomeArquivo nem o conteúdo binário no detalhe', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      const nomeArquivoSensivel = 'laudo-medico-confidencial.pdf';
      const anexo = await anexarEvidencia(enviar, tratativa, {
        acao,
        nomeArquivo: nomeArquivoSensivel,
        mimeType: 'application/pdf',
        conteudo: Buffer.from('conteudo-binario-sensivel').toString('base64'),
      }, comoGestor);
      expect(anexo.status).toBe(200);

      const r = await historico(tratativa, comoGestor);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const inclusao = itens.find((i) => i.tipoEvento === 'InclusaoEvidencia');
      expect(inclusao).toBeDefined();
      const textoDetalhe = JSON.stringify((inclusao as Item).detalhe);
      expect(textoDetalhe).not.toContain(nomeArquivoSensivel);
      expect(textoDetalhe).not.toContain('conteudo-binario-sensivel');
    });
  });

  describe('CA38 (R8): InclusaoComentario identifica o Código do Comentário sem duplicar o texto', () => {
    it('evento InclusaoComentario não contém o texto livre do comentário no detalhe', async () => {
      const tratativa = await criarTratativaAberta();
      const textoConfidencial = 'Relato pessoal confidencial do colaborador';
      const comentario = await comentarTratativa(enviar, tratativa, { texto: textoConfidencial }, comoGestor);
      expect(comentario.status).toBe(200);

      const r = await historico(tratativa, comoGestor);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const inclusao = itens.find((i) => i.tipoEvento === 'InclusaoComentario' && i.codigoAcao === null);
      expect(inclusao).toBeDefined();
      const textoDetalhe = JSON.stringify((inclusao as Item).detalhe);
      expect(textoDetalhe).not.toContain(textoConfidencial);
    });
  });

  describe('CA39 (R8): DownloadEvidencia registra data/hora, autor e evidência acessada', () => {
    it('download aceito gera evento DownloadEvidencia com autor preenchido para o Gestor', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      const anexo = await anexarEvidencia(enviar, tratativa, {
        acao,
        nomeArquivo: 'evidencia.pdf',
        mimeType: 'application/pdf',
        conteudo: Buffer.from('conteudo').toString('base64'),
      }, comoGestor);
      expect(anexo.status).toBe(200);
      const evidenciaCodigo = (anexo.data as { codigo?: string; evidencia?: string }).codigo
        ?? (anexo.data as { codigo?: string; evidencia?: string }).evidencia;

      const download = await consultar(
        `/api/tratativa/v1/baixarEvidencia(tratativa=${tratativa},acao=${acao},evidencia=${evidenciaCodigo})`,
        comoGestor,
      );
      expect(download.status).toBe(200);

      const r = await historico(tratativa, comoGestor);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const downloadEvento = itens.find((i) => i.tipoEvento === 'DownloadEvidencia');
      expect(downloadEvento).toBeDefined();
      expect((downloadEvento as Item).autor).not.toBeNull();
      expect(typeof (downloadEvento as Item).dataHora).toBe('string');
      expect((downloadEvento as Item).codigoAcao).toBe(acao);
    });
  });

  describe('CA40 (R9): Cancelamento/Reabertura consultados pelo Gestor contêm a justificativa', () => {
    it('evento Cancelamento consultado pelo Gestor traz a justificativa integral informada', async () => {
      const tratativa = await criarTratativaAberta();
      const cancelar = await mudarStatus(enviar, tratativa, { status: 'Cancelada', justificativa: 'Duplicidade de registro' }, comoGestor);
      expect(cancelar.status).toBe(204);

      const r = await historico(tratativa, comoGestor);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const cancelamento = itens.find((i) => i.tipoEvento === 'Cancelamento');
      expect(cancelamento).toBeDefined();
      expect(((cancelamento as Item).detalhe as Detalhe).justificativa).toBe('Duplicidade de registro');
    });
  });

  describe('CA41 (R9): justificativa de Reatribuição/Delegação é null para não-Gestor', () => {
    it('ReatribuicaoResponsavelPrincipal consultada por Participante traz justificativa: null', async () => {
      const tratativa = await criarTratativaAberta();
      const primeira = await atribuirResponsavelPrincipal(enviar, tratativa, { responsavelPrincipal: 'M9999' }, comoGestor);
      expect(primeira.status).toBe(204);
      const participacao = await incluirParticipante(enviar, tratativa, { participante: 'M1001' }, comoGestor);
      expect(participacao.status).toBe(204);
      const reatribuicao = await atribuirResponsavelPrincipal(
        enviar, tratativa, { responsavelPrincipal: 'M2002', justificativa: 'Mudança de equipe' }, comoGestor,
      );
      expect(reatribuicao.status).toBe(204);

      const r = await historico(tratativa, comoM1001);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const reatribuicaoEvento = itens.find((i) => i.tipoEvento === 'ReatribuicaoResponsavelPrincipal');
      expect(reatribuicaoEvento).toBeDefined();
      expect(((reatribuicaoEvento as Item).detalhe as Detalhe).justificativa).toBeNull();
    });

    it('DelegacaoAcao consultada pelo Responsável não traz justificativa (null)', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      const delegacao = await delegarAcao(enviar, tratativa, { acao, novoResponsavel: 'M2002', justificativa: 'Troca de time' }, comoGestor);
      expect(delegacao.status).toBe(204);

      const r = await historico(tratativa, comoM2002);
      expect(r.status).toBe(200);
      const itens = r.data as Item[];
      const delegacaoEvento = itens.find((i) => i.tipoEvento === 'DelegacaoAcao');
      expect(delegacaoEvento).toBeDefined();
      expect(((delegacaoEvento as Item).detalhe as Detalhe).justificativa).toBeNull();
    });
  });

  describe('CA42 (R9): AlteracaoCriticidade e Edicao de Prazo registram valores sem exigir justificativa', () => {
    it('AlteracaoCriticidade registra valorAnterior/valorNovo mesmo sem justificativa informada', async () => {
      const tratativa = await criarTratativaAberta({ criticidade: 'Baixa' });
      const r = await consultar(`/api/tratativa/v1/consultarTratativa(codigo=${tratativa})`, comoGestor);
      expect(r.status).toBe(200);

      const mudarCriticidade = await enviar(`/api/tratativa/v1/Tratativas(${tratativa})/mudarCriticidade`, { criticidade: 'Alta' }, comoGestor);
      expect(mudarCriticidade.status).toBe(204);

      const h = await historico(tratativa, comoGestor);
      expect(h.status).toBe(200);
      const itens = h.data as Item[];
      const alteracao = itens.find((i) => i.tipoEvento === 'AlteracaoCriticidade' && (i.detalhe as Detalhe).campo === 'criticidade');
      expect(alteracao).toBeDefined();
      const detalhe = (alteracao as Item).detalhe as Detalhe;
      expect(detalhe.valorAnterior).toBe('Baixa');
      expect(detalhe.valorNovo).toBe('Alta');
    });

    it('Edicao de Prazo da Ação registra valorAnterior/valorNovo sem exigir justificativa', async () => {
      const tratativa = await criarTratativaAberta();
      const acao = await criarAcaoComResponsavel(tratativa, 'M1001');
      const editarPrazo = await enviar(
        `/api/tratativa/v1/Tratativas(${tratativa})/editarAcao`,
        { acao, prazo: '2027-06-01' },
        comoGestor,
      );
      expect(editarPrazo.status).toBe(204);

      const h = await historico(tratativa, comoGestor);
      expect(h.status).toBe(200);
      const itens = h.data as Item[];
      const edicaoPrazo = itens.find(
        (i) => i.origem === 'Acao' && i.tipoEvento === 'Edicao' && ((i.detalhe as Detalhe).campo === 'Prazo' || (i.detalhe as Detalhe).campo === 'prazo'),
      );
      expect(edicaoPrazo).toBeDefined();
      const detalhe = (edicaoPrazo as Item).detalhe as Detalhe;
      expect(detalhe.valorNovo).toContain('2027-06-01');
    });
  });
});
