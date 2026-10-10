using { AdministracaoService } from './administracao-service';

@protocol: 'none'
service RotinaAlertasService {
  action executar(agora : Timestamp) returns AdministracaoService.RelatorioProcessamentoAlertas;
}
