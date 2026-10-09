import cds from '@sap/cds';
import { codigoValido } from './consulta';
import { recusar } from './recusa';

const NS = 'br.com.calazanstec';

const COLUNAS = [
  'codigo', 'descricao', 'responsavel', 'prazo', 'prioridade', 'status', 'evidenciaObrigatoria', 'dataConclusao', 'acaoMae_codigo',
];

interface LinhaAcao {
  codigo: string; descricao: string; responsavel: string; prazo: string | Date; prioridade: string; status: string;
  evidenciaObrigatoria: boolean | number; dataConclusao: string | Date | null; acaoMae_codigo: string | null;
}

/** R25 (004): Subação na árvore; `responsavel` vem null para quem não é GestorTratativa (LGPD, R26). */
export interface ItemSubacao {
  codigo: string; descricao: string; responsavel: string | null; prazo: string; prioridade: string; status: string;
  evidenciaObrigatoria: 'sim' | 'não'; dataConclusao: string | null;
}

export interface ItemAcao extends ItemSubacao { subacoes: ItemSubacao[] }

export interface DetalheAcao extends ItemSubacao { acaoMae: string | null; subacoes: ItemSubacao[] }

const ausente = (valor: unknown): boolean => typeof valor !== 'string' || valor.trim() === '';

/** Parâmetro de Código obrigatório e no formato UUID, antes de qualquer busca (R29, etapa 3). */
function exigirCodigo(valor: unknown, campo: 'tratativa' | 'codigo', nome: string): string {
  if (ausente(valor)) recusar(400, `O campo ${nome} é obrigatório.`, campo);
  const codigo = (valor as string).toLowerCase();
  if (!codigoValido(codigo)) recusar(400, 'Código inválido.', campo);
  return codigo;
}

/** Existência da Tratativa (404 `Tratativa não encontrada.`); leitura sem bloqueio, pois não decide nem grava. */
async function exigirTratativa(codigo: string): Promise<void> {
  const linha = await cds.db.run(SELECT.one.from(`${NS}.Tratativas`).columns('codigo').where({ codigo }));
  if (!linha) recusar(404, 'Tratativa não encontrada.');
}

// Data civil sempre como texto AAAA-MM-DD, independentemente do driver devolver string ou Date.
const dataCivil = (valor: string | Date | null): string | null =>
  valor === null ? null : valor instanceof Date ? valor.toISOString().slice(0, 10) : valor;

function item(linha: LinhaAcao, verResponsavel: boolean): ItemSubacao {
  return {
    codigo: linha.codigo,
    descricao: linha.descricao,
    responsavel: verResponsavel ? linha.responsavel : null,
    prazo: dataCivil(linha.prazo) as string,
    prioridade: linha.prioridade,
    status: linha.status,
    evidenciaObrigatoria: linha.evidenciaObrigatoria ? 'sim' : 'não',
    dataConclusao: dataCivil(linha.dataConclusao),
  };
}

/** R25 (CA82): Ações de primeiro nível e Subações aninhadas, ordenadas por criadoEm ASC e codigo ASC. */
export async function consultarEstruturaAcoes(tratativa: unknown, verResponsavel: boolean): Promise<ItemAcao[]> {
  const codigoTratativa = exigirCodigo(tratativa, 'tratativa', 'Tratativa');
  await exigirTratativa(codigoTratativa);
  const linhas = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`).columns(...COLUNAS)
      .where({ tratativa_codigo: codigoTratativa })
      .orderBy('criadoEm asc', 'codigo asc'),
  )) as LinhaAcao[];

  const subacoesDe = new Map<string, ItemSubacao[]>();
  for (const linha of linhas) {
    if (!linha.acaoMae_codigo) continue;
    const irmas = subacoesDe.get(linha.acaoMae_codigo) ?? [];
    irmas.push(item(linha, verResponsavel));
    subacoesDe.set(linha.acaoMae_codigo, irmas);
  }
  return linhas
    .filter((linha) => !linha.acaoMae_codigo)
    .map((linha) => ({ ...item(linha, verResponsavel), subacoes: subacoesDe.get(linha.codigo) ?? [] }));
}

/** R25 (CA80, CA81): detalhe de uma Ação ou Subação pelo Código, com `acaoMae` e Subações aninhadas. */
export async function consultarAcao(tratativa: unknown, codigo: unknown, verResponsavel: boolean): Promise<DetalheAcao> {
  const codigoTratativa = exigirCodigo(tratativa, 'tratativa', 'Tratativa');
  const codigoAcao = exigirCodigo(codigo, 'codigo', 'Código');
  await exigirTratativa(codigoTratativa);

  const linha = (await cds.db.run(
    SELECT.one.from(`${NS}.Acoes`).columns(...COLUNAS).where({ codigo: codigoAcao, tratativa_codigo: codigoTratativa }),
  )) as LinhaAcao | undefined;
  if (!linha) recusar(404, 'Ação não encontrada.');

  const subacoes = (await cds.db.run(
    SELECT.from(`${NS}.Acoes`).columns(...COLUNAS)
      .where({ acaoMae_codigo: codigoAcao, tratativa_codigo: codigoTratativa })
      .orderBy('criadoEm asc', 'codigo asc'),
  )) as LinhaAcao[];

  return {
    ...item(linha, verResponsavel),
    acaoMae: linha.acaoMae_codigo,
    subacoes: subacoes.map((sub) => item(sub, verResponsavel)),
  };
}
