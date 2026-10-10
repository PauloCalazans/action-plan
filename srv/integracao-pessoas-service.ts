import cds from '@sap/cds';
import {
  obterColaboradorEmCache,
  guardarColaboradorEmCache,
} from './integracoes/cache-pessoas';
import type {
  DadosColaboradorSF,
  FiltroColaboradoresSF,
} from './integracoes/portas-sf';

const ERRO_INTEGRACAO = 'Serviço de pessoas temporariamente indisponível. Tente novamente mais tarde.';

function dadosMinimos(colaborador: DadosColaboradorSF): DadosColaboradorSF {
  return {
    matricula: colaborador.matricula,
    nome: colaborador.nome,
    email: colaborador.email,
    codigoUnidade: colaborador.codigoUnidade,
    codigoArea: colaborador.codigoArea,
    matriculaGestor: colaborador.matriculaGestor,
    situacao: colaborador.situacao,
  };
}

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

export default class IntegracaoPessoasService extends cds.ApplicationService {
  async init() {
    this.before('*', (req) => {
      if (req.user.is('AplicativoOrigem')) req.reject(403, 'Acesso negado.');
    });

    this.on('consultarColaborador', async (req) => {
      const matricula = req.data.matricula as string | undefined;
      if (
        typeof matricula !== 'string'
        || matricula.length < 1
        || matricula.length > 50
        || /\s|@/.test(matricula)
      ) {
        return req.reject(
          400,
          'Matrícula inválida: informe só a matrícula, sem espaços nem e-mail.',
          'matricula',
        );
      }

      const emCache = obterColaboradorEmCache(matricula);
      let colaborador: DadosColaboradorSF | null;
      try {
        const provedor = await cds.connect.to('ProvedorPessoasAdapter');
        colaborador = await provedor.send('obterColaborador', { matricula }) as DadosColaboradorSF | null;
      } catch {
        if (emCache) return dadosMinimos(emCache);
        return req.reject(503, ERRO_INTEGRACAO, 'integracao');
      }
      if (!colaborador) return req.reject(404, 'Colaborador não encontrado.', 'matricula');
      guardarColaboradorEmCache(colaborador);
      return dadosMinimos(colaborador);
    });

    this.on('buscarColaboradores', async (req) => {
      const {
        termo,
        codigoUnidade,
        codigoArea,
        apenasAtivos = true,
        tamanhoPagina = 50,
        pagina = 1,
      } = req.data as {
        termo?: string;
        codigoUnidade?: string;
        codigoArea?: string;
        apenasAtivos?: boolean;
        tamanhoPagina?: number;
        pagina?: number;
      };

      if (termo && termo.length > 100) {
        return req.reject(400, 'O campo Termo aceita até 100 caracteres.', 'termo');
      }
      if (tamanhoPagina < 1 || tamanhoPagina > 200) {
        return req.reject(400, 'O campo Tamanho da página aceita de 1 a 200.', 'tamanhoPagina');
      }
      if (pagina < 1) {
        return req.reject(400, 'O campo Página deve ser 1 ou maior.', 'pagina');
      }

      const filtro: FiltroColaboradoresSF = {
        termo,
        codigoUnidade,
        codigoArea,
        apenasAtivos,
      };
      try {
        const provedor = await cds.connect.to('ProvedorPessoasAdapter');
        const colaboradores = await provedor.send('buscarColaboradores', filtro) as DadosColaboradorSF[];
        const busca = termo?.toLocaleLowerCase('pt-BR');
        return colaboradores
          .filter((colaborador) => (
            (!busca
              || colaborador.nome.toLocaleLowerCase('pt-BR').includes(busca)
              || colaborador.matricula.toLocaleLowerCase('pt-BR').includes(busca))
            && (!codigoUnidade || colaborador.codigoUnidade === codigoUnidade)
            && (!codigoArea || colaborador.codigoArea === codigoArea)
            && (!apenasAtivos || colaborador.situacao === 'Ativo')
          ))
          .sort((a, b) => compararTexto(a.nome, b.nome) || compararTexto(a.matricula, b.matricula))
          .slice((pagina - 1) * tamanhoPagina, pagina * tamanhoPagina)
          .map(dadosMinimos);
      } catch {
        return req.reject(503, ERRO_INTEGRACAO, 'integracao');
      }
    });

    return super.init();
  }
}
