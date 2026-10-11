/**
 * Consulta de colaboradores do SuccessFactors em modo somente leitura.
 */
@path    : '/api/integracao-pessoas/v1'
@requires: 'authenticated-user'
service IntegracaoPessoasService {
  type DetalheColaborador {
    matricula       : String(50);
    nome            : String(100);
    email           : String(100);
    codigoUnidade   : String(100);
    codigoArea      : String(100);
    matriculaGestor : String(50);
    situacao        : String(20);
  }

  type ItemColaborador {
    matricula       : String(50);
    nome            : String(100);
    email           : String(100);
    codigoUnidade   : String(100);
    codigoArea      : String(100);
    matriculaGestor : String(50);
    situacao        : String(20);
  }

  type ItemAreaEstrutura {
    codigoArea : String(100);
    nomeArea   : String(100);
  }

  type ItemUnidadeEstrutura {
    codigoUnidade : String(100);
    nomeUnidade   : String(100);
    areas         : many ItemAreaEstrutura;
  }

  function consultarColaborador(matricula : String) returns DetalheColaborador;

  function buscarColaboradores(
    termo         : String,
    codigoUnidade : String,
    codigoArea    : String,
    apenasAtivos  : Boolean,
    tamanhoPagina : Integer,
    pagina        : Integer
  ) returns many ItemColaborador;

  function listarEstruturaOrganizacional() returns many ItemUnidadeEstrutura;
}
