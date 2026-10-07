import cds from '@sap/cds';
import { credencialAtiva } from './lib/credencial-aplicativo';
import { abrirTratativa, type DadosAbertura } from './tratativa/abertura';
import { codigoValido, consultarPorCodigo, consultarPorOrigem } from './tratativa/consulta';

const ausente = (v?: string | null): v is null | undefined | '' => v == null || v.trim() === '';
const NAO_ENCONTRADA = 'Tratativa não encontrada.';

/** Contrato público dos aplicativos de origem: só monta o Autor e delega ao domínio. */
export default class IntegracaoOrigemService extends cds.ApplicationService {
  async init() {
    // Decisão 10: antes de qualquer leitura ou escrita; o CAP responde 401 `Unauthorized`.
    this.before('*', async (req) => {
      if (!(await credencialAtiva(req.user.id))) req.reject(401);
    });
    this.on('abrirTratativa', (req) =>
      abrirTratativa(req.data as DadosAbertura, { id: req.user.id, tipo: 'Aplicativo' }),
    );
    this.on('consultarPorCodigo', async (req) => {
      const { codigo } = req.data as { codigo?: string };
      if (typeof codigo !== 'string' || !codigoValido(codigo)) return req.reject(400, 'Código inválido.', 'codigo');
      // R-14: UUID não diferencia caixa; o banco guarda minúsculas.
      return (await consultarPorCodigo(codigo.toLowerCase())) ?? req.reject(404, NAO_ENCONTRADA);
    });
    this.on('consultarPorOrigem', async (req) => {
      const { origem, idOrigem } = req.data as { origem?: string | null; idOrigem?: string | null };
      if (ausente(origem)) return req.reject(400, 'O campo Origem é obrigatório.', 'origem');
      if (ausente(idOrigem)) return req.reject(400, 'O campo ID_Origem é obrigatório.', 'idOrigem');
      return (await consultarPorOrigem(origem, idOrigem)) ?? req.reject(404, NAO_ENCONTRADA);
    });
    return super.init();
  }
}
