import cds from '@sap/cds';

// Teste de fumaça (R7/CA5): sobe o runtime CAP com SQLite em memória, sem serviços externos.
describe('fumaça: banco em memória', () => {
  cds.test(__dirname + '/..');

  it('responde a uma consulta no SQLite em memória', async () => {
    const db = await cds.connect.to('db');
    const [linha] = await db.run('SELECT 1 AS um');
    expect(linha.um).toBe(1);
  });
});
