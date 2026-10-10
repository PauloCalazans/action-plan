using { br.com.calazanstec.analitico.operacional as op } from './analitico/operacional';
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
  entity BacklogTotal as projection on ex.BacklogTotalView;

  function consultarTratativasVencidas(dataCorte : String) returns Totalizador;
}
