/** Fronteiras de arquitetura (AGENTS.md, agentic/projeto/decisoes.md D2). */

// R19: SDKs/clients de terceiros para SuccessFactors, e-mail e Teams.
// Mantenha esta lista a cada pacote novo que se enquadre nessa finalidade.
const MODULOS_INTEGRACAO_EXTERNA = [
  '^@sap-cloud-sdk(/|$)',
  '^nodemailer(/|$)',
  '^@microsoft/microsoft-graph-client(/|$)',
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'app-nao-importa-srv',
      comment: 'app/ não importa srv/.',
      severity: 'error',
      from: { path: '^app/' },
      to: { path: '^srv/' },
    },
    {
      name: 'db-nao-depende-de-srv-nem-app',
      comment: 'db/ não depende de srv/ nem de app/.',
      severity: 'error',
      from: { path: '^db/' },
      to: { path: '^(srv|app)/' },
    },
    {
      name: 'integracoes-externas-so-em-srv-integracoes',
      comment: 'SDKs/clients externos só podem ser importados em srv/integracoes/.',
      severity: 'error',
      from: { pathNot: '^srv/integracoes/' },
      to: { path: MODULOS_INTEGRACAO_EXTERNA },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    moduleSystems: ['cjs', 'es6'],
    exclude: { path: '^(node_modules|gen|@cds-models)/' },
  },
};
