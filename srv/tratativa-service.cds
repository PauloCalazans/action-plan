using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Serviço dos usuários da plataforma (spec abertura-por-apps-de-origem R6/R17; spec tratativa R1-R31).
 * Ciclo de vida por actions ligadas à Tratativa (R2), só para o papel GestorTratativa (R8).
 * Aplicativo de origem é recusado com 403.
 */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  action   criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                                unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;

  /**
   * Âncora das operações de ciclo de vida (R2). Só a chave é exposta; não há criação, alteração
   * nem exclusão pelo entity set (R11).
   * Parâmetros sem tamanho de propósito: o domínio valida tamanho depois de papel, existência e estado (R31).
   */
  @readonly
  @restrict: [{ grant: ['mudarStatus'], to: 'GestorTratativa' }]
  entity Tratativas as projection on m.Tratativas { key codigo } actions {
    /** R2/R4/R5: a operação é identificada pelo Status de destino. */
    action mudarStatus(status : String, justificativa : String);
  };
}
