process.env.CDS_TYPESCRIPT = 'true'; // CAP carrega srv/<serviço>.ts sob jest (design abertura-por-apps-de-origem, decisão 12)
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 60000, // a primeira subida do cds.test passa de 5 s (design tratativa, decisão 15)
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports/junit', outputName: 'junit.xml' }],
  ],
};
