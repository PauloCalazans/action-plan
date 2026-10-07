/** Tratativa avulsa por usuário autenticado (R6, R17). Sem Origem nem ID_Origem por assinatura. */
@path    : '/api/tratativa/v1'
@requires: 'authenticated-user'
service TratativaService {

  type ResultadoAbertura {
    codigo : UUID;
  }

  action criarTratativaAvulsa(titulo : String(200), criticidade : String(10), descricao : String(5000),
                              unidade : String(100), area : String(100), solicitante : String(50)) returns ResultadoAbertura;
}
