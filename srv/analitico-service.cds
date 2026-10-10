using { br.com.calazanstec.analitico.operacional as op } from './analitico/operacional';
using { br.com.calazanstec.analitico.gestao as gs } from './analitico/gestao';
using { br.com.calazanstec.analitico.executivo as ex } from './analitico/executivo';

@path    : '/api/analitico/v1'
@requires: 'authenticated-user'
@readonly
service AnaliticoService {
  type Totalizador {
    total : Integer;
  }

  @readonly
  entity TratativasAbertas as projection on op.TratativasAbertasView;

  @readonly
  entity TratativasVencidas as projection on op.TratativasVencidasView;

  @readonly
  entity AcoesEmAndamento as projection on op.AcoesEmAndamentoView;

  @readonly
  entity PendenciasPorResponsavel as projection on op.PendenciasPorResponsavelView;

  @readonly
  entity PendenciasPorUnidadeArea as projection on op.PendenciasPorUnidadeAreaView;

  @readonly
  entity PendenciasPorUnidade as projection on op.PendenciasPorUnidadeView;

  @readonly
  entity TratativasPorOrigem as projection on gs.TratativasPorOrigemView;

  @readonly
  entity TratativasPorCriticidade as projection on gs.TratativasPorCriticidadeView;

  @readonly
  entity RankingAreas as projection on gs.RankingAreasView;

  @readonly
  entity BacklogTotal as projection on ex.BacklogTotalView;

  type RetornoCumprimentoPrazo {
    taxaPercentual : Decimal(5,2);
  }

  type RetornoTempoMedioResolucao {
    mediaDias : Decimal(5,1);
  }

  function consultarCumprimentoDePrazo(periodoInicio : String, periodoFim : String) returns RetornoCumprimentoPrazo;
  function consultarTempoMedioResolucao(periodoInicio : String, periodoFim : String) returns RetornoTempoMedioResolucao;
  function consultarTratativasVencidas(dataCorte : String) returns Totalizador;
}
