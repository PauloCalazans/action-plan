using { br.com.calazanstec as m } from '../db/tratativa';

/** Administração da plataforma (R11, R18): tabela de prazos e credenciais de aplicativo. */
@path    : '/api/administracao/v1'
@requires: 'Administrador'
service AdministracaoService {

  /** R11: o Administrador só altera os dias; a lista de Criticidades é fixa (R7). */
  @Capabilities: { InsertRestrictions.Insertable: false, DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'UPDATE'], to: 'Administrador' }]
  entity PrazosCriticidade     as projection on m.PrazosCriticidade;

  /** R18: emissão (CREATE) e revogação (UPDATE ativa = false) da credencial de cada aplicativo. */
  @Capabilities: { DeleteRestrictions.Deletable: false }
  @restrict    : [{ grant: ['READ', 'CREATE', 'UPDATE'], to: 'Administrador' }]
  entity CredenciaisAplicativo as projection on m.CredenciaisAplicativo;
}
