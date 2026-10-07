import cds from '@sap/cds';

/** R18: a identidade técnica só é aceita enquanto estiver ativa no registro de credenciais. */
export async function credencialAtiva(usuarioTecnico: string): Promise<boolean> {
  if (!usuarioTecnico) return false;
  const linha = await cds.db.run(
    SELECT.one.from('CredenciaisAplicativo').columns('ativa').where({ usuarioTecnico }),
  );
  return linha?.ativa === true;
}
