import cds from '@sap/cds';
import { normalizarTexto } from '../tratativa/normalizacao';
import { normalizarMatricula } from '../tratativa/identidade';
import { recusar } from '../tratativa/recusa';
import { validarMatricula } from '../tratativa/validacao-matricula';

const NS = 'br.com.calazanstec';
const PARAMETROS = `${NS}.ParametrosOrigem`;
const VALIDADORES = `${NS}.ValidadoresOrigem`;
const PADRAO = '*';
const FERRAMENTAS = ['3W', '5 Porquês', '5W2H', 'PDCA/8D'];

export interface DadosParametrosOrigem {
  origem?: unknown;
  metodologiaSugerida?: unknown;
  validadorPadrao?: unknown;
  prazoVerificacaoEficaciaDias?: unknown;
}

export interface DetalheParametrosOrigem {
  origem: string;
  metodologiaSugerida: string | null;
  validadorPadrao: string;
  prazoVerificacaoEficaciaDias: number;
  validadores: string[];
}

interface LinhaParametro {
  origemNormalizada: string;
  origem: string;
  metodologiaSugerida: string | null;
  validadorPadrao: string;
  prazoVerificacaoEficaciaDias: number;
}

interface LinhaValidador {
  ID: string;
  matricula: string;
}

function textoObrigatorio(valor: unknown, rotulo: string, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') recusar(400, `O campo ${rotulo} é obrigatório.`, campo);
  const texto = valor.trim();
  if (texto.length > 100) recusar(400, `O campo ${rotulo} aceita no máximo 100 caracteres.`, campo);
  return texto;
}

function chaveDaOrigem(origem: unknown): { origem: string; chave: string } {
  const texto = textoObrigatorio(origem, 'Origem', 'origem');
  return { origem: texto, chave: normalizarTexto(texto) as string };
}

async function lerParametro(chave: string): Promise<LinhaParametro | undefined> {
  return (await cds.db.run(SELECT.one.from(PARAMETROS).where({ origemNormalizada: chave }))) as LinhaParametro | undefined;
}

async function lerValidadores(chave: string): Promise<LinhaValidador[]> {
  return (await cds.db.run(
    SELECT.from(VALIDADORES).columns('ID', 'matricula').where({ parametro_origemNormalizada: chave }),
  )) as LinhaValidador[];
}

async function detalhar(chave: string): Promise<DetalheParametrosOrigem> {
  const parametro = (await lerParametro(chave)) as LinhaParametro;
  const validadores = await lerValidadores(chave);
  return {
    origem: parametro.origem,
    metodologiaSugerida: parametro.metodologiaSugerida ?? null,
    validadorPadrao: parametro.validadorPadrao,
    prazoVerificacaoEficaciaDias: parametro.prazoVerificacaoEficaciaDias,
    validadores: validadores.map((linha) => linha.matricula).sort(),
  };
}

/** R13 (016): cria ou atualiza a parametrização da Origem; `*` é o baseline global. */
export async function atualizarParametrosOrigem(dados: DadosParametrosOrigem): Promise<DetalheParametrosOrigem> {
  const { origem, chave } = chaveDaOrigem(dados.origem);
  const validadorPadrao = textoObrigatorio(dados.validadorPadrao, 'Validador padrão', 'validadorPadrao');
  if (dados.metodologiaSugerida != null && typeof dados.metodologiaSugerida !== 'string') {
    recusar(400, 'O campo Metodologia sugerida deve ser um texto.', 'metodologiaSugerida');
  }
  const sugerida = typeof dados.metodologiaSugerida === 'string' ? dados.metodologiaSugerida.trim() : '';
  if (sugerida !== '' && !FERRAMENTAS.includes(sugerida)) {
    recusar(400, 'O campo Metodologia sugerida aceita 3W, 5 Porquês, 5W2H ou PDCA/8D.', 'metodologiaSugerida');
  }
  const prazo = dados.prazoVerificacaoEficaciaDias;
  if (typeof prazo !== 'number' || !Number.isInteger(prazo) || prazo < 1 || prazo > 180) {
    recusar(400, 'O campo Prazo de verificação aceita de 1 a 180.', 'prazoVerificacaoEficaciaDias');
  }

  const existente = await lerParametro(chave);
  const valores = {
    metodologiaSugerida: sugerida === '' ? null : sugerida,
    validadorPadrao,
    prazoVerificacaoEficaciaDias: prazo,
  };
  if (existente) {
    await cds.db.run(
      UPDATE(PARAMETROS)
        .set({ ...valores, origem: chave === PADRAO ? existente.origem : origem })
        .where({ origemNormalizada: chave }),
    );
  } else {
    await cds.db.run(INSERT.into(PARAMETROS).entries({ origemNormalizada: chave, origem, ...valores }));
  }
  return detalhar(chave);
}

async function exigirParametro(origem: unknown): Promise<string> {
  const { chave } = chaveDaOrigem(origem);
  if (!(await lerParametro(chave))) recusar(404, 'Origem não parametrizada.', 'origem');
  return chave;
}

/** R7, R12 d (016): inclui a matrícula na lista de Validadores da Origem (idempotente). */
export async function incluirValidadorOrigem(origem: unknown, matricula: unknown): Promise<DetalheParametrosOrigem> {
  const chave = await exigirParametro(origem);
  const valor = validarMatricula(matricula, 'matricula');
  const jaExiste = (await lerValidadores(chave)).some(
    (linha) => normalizarMatricula(linha.matricula) === normalizarMatricula(valor),
  );
  if (!jaExiste) {
    await cds.db.run(INSERT.into(VALIDADORES).entries({
      ID: cds.utils.uuid(),
      parametro_origemNormalizada: chave,
      matricula: valor,
    }));
  }
  return detalhar(chave);
}

/** Remove a matrícula da lista de Validadores da Origem (idempotente). */
export async function removerValidadorOrigem(origem: unknown, matricula: unknown): Promise<DetalheParametrosOrigem> {
  const chave = await exigirParametro(origem);
  const valor = normalizarMatricula(validarMatricula(matricula, 'matricula'));
  const alvos = (await lerValidadores(chave)).filter((linha) => normalizarMatricula(linha.matricula) === valor);
  for (const alvo of alvos) {
    await cds.db.run(DELETE.from(VALIDADORES).where({ ID: alvo.ID }));
  }
  return detalhar(chave);
}
