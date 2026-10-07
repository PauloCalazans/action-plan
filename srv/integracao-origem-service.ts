import cds from '@sap/cds';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';
import { codigoValido, consultarPorCodigo, consultarPorOrigem } from './tratativa/consulta';

const NAO_ENCONTRADA = 'Tratativa não encontrada.';

/** Contrato público dos aplicativos de origem: só monta o Autor e delega ao domínio. */
export default class IntegracaoOrigemService extends cds.ApplicationService {
  async init() {
    this.on('abrirTratativa', (req) =>
      abrirTratativa(req.data as DadosAbertura, { id: req.user.id, tipo: 'Aplicativo' }),
    );
    this.on('consultarPorCodigo', async (req) => {
      const { codigo } = req.data as { codigo: string };
      if (!codigoValido(codigo)) return req.reject(400, 'Código inválido.', 'codigo');
      return (await consultarPorCodigo(codigo)) ?? req.reject(404, NAO_ENCONTRADA);
    });
    this.on('consultarPorOrigem', async (req) => {
      const { origem, idOrigem } = req.data as { origem: string; idOrigem: string };
      return (await consultarPorOrigem(origem, idOrigem)) ?? req.reject(404, NAO_ENCONTRADA);
    });
    return super.init();
  }
}
