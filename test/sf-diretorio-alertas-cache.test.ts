import cds from '@sap/cds';
import { criarAcao } from './apoio/acoes';
import { linhas } from './apoio/banco';
import {
  limparEnviosEmail,
  obterEnviosEmail,
} from './apoio/email-espiao';
import { executarRotinaAlertas } from './apoio/alertas';
import {
  definirColaboradores,
  limparProvedor,
} from './apoio/pessoas-espiao';
import { registrarCredenciais } from './apoio/credenciais';
import { fixarInstante, liberarRelogio } from './apoio/relogio';
import { criarAvulsa, type Envia } from './apoio/tratativas';
import { comoAdmin, comoGestor } from './apoio/usuarios';
import { limparDiretorio } from './apoio/diretorio-espiao';

const { PATCH, POST } = cds.test(__dirname + '/..');
const enviar = POST as unknown as Envia;
const ADMIN = '/api/administracao/v1';
const PARAMETROS = `${ADMIN}/atualizarParametrosAlertas`;
const AGORA = '2026-10-10T12:00:00.000Z';
const CRIACAO = '2026-10-07T12:00:00.000Z';
const PRAZO_PROXIMO = '2026-10-12';

function colaborador(matricula: string, email: string) {
  return {
    matricula,
    nome: `Colaborador ${matricula}`,
    email,
    codigoUnidade: 'SP',
    codigoArea: 'SESMT',
    matriculaGestor: null,
    situacao: 'Ativo' as const,
  };
}

async function atualizarParametrosAlertas() {
  const resposta = await POST(PARAMETROS, {
    diasAntecedenciaPrazoProximo: 3,
    diasInatividade: 15,
    emailHabilitado: true,
    teamsHabilitado: false,
    horaExecucaoUtc: 8,
  }, comoAdmin);
  expect(resposta.status).toBe(200);
}

async function definirPrazoCriticidadeAlta(dias: number) {
  const resposta = await PATCH(`${ADMIN}/PrazosCriticidade('Alta')`, { dias }, comoAdmin);
  expect(resposta.status).toBe(200);
}

async function criarCenarioDeAlerta() {
  const abertura = await criarAvulsa(enviar, {
    titulo: 'Tratativa para resolução de destinatários do SuccessFactors',
    descricao: 'Validação da integração do diretório de pessoas com alertas.',
  });
  expect(abertura.status).toBe(200);

  const tratativa = abertura.data.codigo as string;
  const primeiraAcao = await criarAcao(enviar, tratativa, {
    descricao: 'Ação atribuída a colaborador existente no SuccessFactors',
    responsavel: 'M1001',
    prazo: PRAZO_PROXIMO,
    evidenciaObrigatoria: 'não',
  }, comoGestor);
  expect(primeiraAcao.status).toBe(200);

  const segundaAcao = await criarAcao(enviar, tratativa, {
    descricao: 'Ação atribuída a colaborador inexistente no SuccessFactors',
    responsavel: 'M9999',
    prazo: PRAZO_PROXIMO,
    evidenciaObrigatoria: 'não',
  }, comoGestor);
  expect(segundaAcao.status).toBe(200);

  return tratativa;
}

beforeAll(registrarCredenciais);
beforeEach(async () => {
  fixarInstante(CRIACAO);
  limparEnviosEmail();
  limparProvedor();
  limparDiretorio();
  await atualizarParametrosAlertas();
  await definirPrazoCriticidadeAlta(7);
});
afterEach(() => {
  jest.restoreAllMocks();
  liberarRelogio();
});

describe('diretório SuccessFactors, cache volátil e integração com alertas', () => {
  it('CA4: reutiliza em memória a segunda resolução dentro do TTL sem consultar novamente o provedor', async () => {
    const provedor = await cds.connect.to('ProvedorPessoasAdapter');
    const consultarProvedor = jest.spyOn(provedor, 'send');
    const diretorio = await cds.connect.to('DiretorioPessoasAdapter');

    definirColaboradores([colaborador('M1001', 'ana.silva@empresa.com')]);
    const primeira = await diretorio.send('resolverPessoa', { matricula: 'M1001' });
    definirColaboradores([colaborador('M1001', 'ana.atualizada@empresa.com')]);
    const segunda = await diretorio.send('resolverPessoa', { matricula: 'M1001' });

    expect(segunda).toEqual(primeira);
    expect(consultarProvedor).toHaveBeenCalledTimes(1);
  });

  it('CA5: mantém o cadastro de colaboradores fora das entidades relacionais após uma consulta', async () => {
    definirColaboradores([colaborador('M1001', 'ana.silva@empresa.com')]);
    const diretorio = await cds.connect.to('DiretorioPessoasAdapter');
    await diretorio.send('resolverPessoa', { matricula: 'M1001' });

    const entidadesComCadastroDePessoas = Object.entries(cds.model!.definitions)
      .filter(([, definicao]) => {
        const entidade = definicao as unknown as {
          kind?: string;
          elements?: Record<string, unknown>;
        };
        if (entidade.kind !== 'entity') return false;
        const campos = Object.keys(entidade.elements ?? {});
        return ['matricula', 'nome', 'email', 'codigoUnidade', 'codigoArea', 'situacao']
          .every((campo) => campos.includes(campo));
      })
      .map(([nome]) => nome);

    expect(entidadesComCadastroDePessoas).toEqual([]);
  });

  it('CA21: resolve a matrícula para o e-mail corporativo retornado pelo provedor', async () => {
    definirColaboradores([colaborador('M1001', 'ana.silva@empresa.com')]);
    const diretorio = await cds.connect.to('DiretorioPessoasAdapter');

    const pessoa = await diretorio.send('resolverPessoa', { matricula: 'M1001' });

    expect(pessoa).toEqual({
      email: 'ana.silva@empresa.com',
      teamsId: 'ana.silva@empresa.com',
    });
  });

  it('CA22: registra destinatário inexistente como falha e continua o lote de alertas', async () => {
    definirColaboradores([colaborador('M1001', 'ana.silva@empresa.com')]);
    const tratativa = await criarCenarioDeAlerta();

    const relatorio = await executarRotinaAlertas(AGORA);
    const alertas = await linhas('AlertasEmitidos', { tratativa_codigo: tratativa });

    expect(relatorio?.ocorrenciasAvaliadas).toBeGreaterThan(0);
    expect(alertas).toHaveLength(2);
    expect(alertas).toContainEqual(expect.objectContaining({
      destinatario: 'M9999',
      statusEnvio: 'Falha',
      motivoFalha: 'Destinatário não resolvido',
    }));
    expect(alertas).toContainEqual(expect.objectContaining({
      destinatario: 'M1001',
      statusEnvio: 'Sucesso',
    }));
    expect(obterEnviosEmail()).toContainEqual(expect.objectContaining({
      destinatario: 'ana.silva@empresa.com',
    }));
  });
});
