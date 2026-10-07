using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Contrato público para aplicativos de origem (R3, R4, R5, R9, R13-R16, R18, R19, R21-R23).
 * Sem entity sets: o aplicativo não lista Tratativas; só abre e consulta por Código ou par.
 */
@path    : '/api/integracao-origem/v1'
@requires: 'AplicativoOrigem'
service IntegracaoOrigemService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  /** R19: somente estes campos; sem Descrição, sem pessoas. */
  type ConsultaTratativa {
    codigo                : UUID;
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
  }

  action abrirTratativa(origem : String(100), idOrigem : String(50), titulo : String(200), criticidade : String(10),
                        descricao : String(5000), unidade : String(100), area : String(100),
                        solicitante : String(50)) returns ResultadoAbertura;

  function consultarPorCodigo(codigo : UUID)                          returns ConsultaTratativa;
  function consultarPorOrigem(origem : String(100), idOrigem : String(50)) returns ConsultaTratativa;
}
