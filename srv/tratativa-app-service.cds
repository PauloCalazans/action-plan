using { br.com.calazanstec as m } from '../db/tratativa';

@path    : '/api/app/v1'
@requires: 'authenticated-user'
service TratativaAppService {

  @readonly
  @cds.redirection.target
  entity Tratativas as projection on m.Tratativas {
    key codigo,
        titulo,
        descricao,
        origem,
        idOrigem,
        criticidade,
        status,
        unidade,
        area,
        solicitante,
        responsavelPrincipal,
        dataCriacao,
        dataPrevistaConclusao,
        false as ocultaResponsaveis : Boolean,
        acoes         : Composition of many Acoes on acoes.tratativa = $self,
        participantes : Composition of many Participantes on participantes.tratativa = $self,
        evidencias    : Composition of many Evidencias on evidencias.tratativa = $self,
        comentarios   : Composition of many Comentarios on comentarios.tratativa = $self,
        historico     : Association to many Historico on historico.tratativa = $self
  } actions {
    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action mudarStatus(status : String, justificativa : String);

    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action editar(titulo : String, descricao : String, unidade : String, area : String, solicitante : String);

    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action mudarCriticidade(criticidade : m.Criticidade);

    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action aplicarTemplate(templateId : UUID);

    @restrict: [{ grant: '*', to: 'GestorTratativa' }]
    action criarAcao(descricao : String, responsavel : String, prazo : String, prioridade : String, evidenciaObrigatoria : String) returns ResultadoCriacaoAcao;
  };

  type ResultadoCriacaoAcao {
    codigo : UUID;
  }

  action criarTratativaAvulsa(
    titulo                : String(200),
    descricao             : String(5000),
    criticidade           : m.Criticidade,
    unidade               : String(100),
    area                  : String(100),
    solicitante           : String(50),
    dataPrevistaConclusao : Date
  ) returns Tratativas;

  @readonly
  @cds.redirection.target
  entity Acoes as projection on m.Acoes {
    key codigo,
        tratativa,
        descricao,
        prioridade,
        status,
        prazo,
        evidenciaObrigatoria,
        dataConclusao,
        responsavel,
        acaoMae
  } actions {
    action iniciar();
    action concluir();
  };

  @readonly
  entity Participantes as projection on m.ParticipantesTratativa {
    key ID,
        tratativa,
        matricula,
        sequencia,
        criadoEm
  };

  @readonly
  entity Evidencias as projection on m.Evidencias;

  @readonly
  entity Comentarios as projection on m.Comentarios;

  @readonly
  entity Historico as projection on m.HistoricoTratativa;

  @readonly
  @cds.redirection.target: false
  entity MinhasAcoes as projection on m.Acoes {
    key codigo as codigoAcao,
        tratativa.codigo as codigoTratativa,
        tratativa.titulo as tituloTratativa,
        tratativa.status as statusTratativa,
        descricao,
        prioridade,
        status as statusAcao,
        prazo,
        evidenciaObrigatoria,
        dataConclusao
  } actions {
    action iniciar();
    action concluir();
  };

  @readonly
  @cds.redirection.target: false
  entity MinhasTratativas as projection on m.Tratativas {
    key codigo as codigoTratativa,
        titulo as tituloTratativa,
        origem,
        idOrigem,
        criticidade,
        status as statusTratativa,
        unidade,
        area,
        dataPrevistaConclusao,
        'Responsável' as meuPapel : String(30)
  };
}
