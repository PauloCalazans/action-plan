using { br.com.calazanstec as m } from '../db/tratativa';

/**
 * Serviço dos usuários da plataforma (spec abertura-por-apps-de-origem R6/R17; spec tratativa R1-R31).
 * Leitura por functions com tipo de retorno explícito (R23-R26); ciclo de vida por actions ligadas à
 * Tratativa (R2, R12, R18), só para o papel GestorTratativa (R8). Aplicativo de origem é recusado com 403.
 */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  /** R25: exatamente estes dez campos na listagem (sem Descrição e sem Solicitante). */
  type ItemListagem {
    codigo                : UUID;
    titulo                : String(200);
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    unidade               : String(100);
    area                  : String(100);
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
  }

  /** R26: campos da listagem mais Descrição e Solicitante; os dois vêm null para quem não é Gestor (R23). */
  type DetalheTratativa {
    codigo                : UUID;
    titulo                : String(200);
    origem                : String(100);
    idOrigem              : String(50);
    criticidade           : m.Criticidade;
    status                : m.StatusTratativa;
    unidade               : String(100);
    area                  : String(100);
    dataCriacao           : Date;
    dataPrevistaConclusao : Date;
    descricao             : String(5000);
    solicitante           : String(50);
  }

  action   criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                                unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;

  /** R24/R25: filtros combinados; página padrão 50, máximo 200; pagina começa em 1. */
  function listarTratativas(origem : String, idOrigem : String, criticidade : String, status : String,
                            unidade : String, area : String, tamanhoPagina : Integer, pagina : Integer) returns many ItemListagem;

  /** R26: consulta pelo Código; inexistente → 404. */
  function consultarTratativa(codigo : UUID) returns DetalheTratativa;

  /**
   * Âncora das operações de ciclo de vida (R2, R12, R18). Só a chave é exposta; não há leitura,
   * criação, alteração nem exclusão pelo entity set (R11; leitura pelas functions acima).
   * Parâmetros sem tamanho de propósito: o domínio valida tamanho depois de papel, existência e estado (R31).
   */
  @readonly
  @restrict: [{ grant: ['mudarStatus', 'editar', 'mudarCriticidade'], to: 'GestorTratativa' }]
  entity Tratativas as projection on m.Tratativas { key codigo } actions {
    /** R2/R4/R5: a operação é identificada pelo Status de destino. */
    action mudarStatus(status : String, justificativa : String);
    /** R12/R13/R15: só estes campos; ausente = não muda; null ou só espaços = apaga (Título não pode). */
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);
    /** R18/R19: reutiliza a regra interna do 002 com tipo de autor Usuario. */
    action mudarCriticidade(criticidade : String);
  };
}
