import cds from '@sap/cds';

// Registra as credenciais de aplicativo usadas pelas suítes do IntegracaoOrigemService (chamar no beforeAll).
export async function registrarCredenciais(): Promise<void> {
  const entidade = 'br.com.calazanstec.CredenciaisAplicativo';
  await cds.db.run(
    UPSERT.into(entidade).entries([
      { usuarioTecnico: 'app-origem-a', ativa: true },
      { usuarioTecnico: 'app-origem-b', ativa: true },
      { usuarioTecnico: 'app-revogado', ativa: false },
    ]),
  );
}
