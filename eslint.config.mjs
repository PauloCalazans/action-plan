import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import cds from '@sap/eslint-plugin-cds';

export default [
  { ignores: ['node_modules/', 'gen/', '@cds-models/', 'reports/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  cds.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  {
    files: ['**/*.cjs', '**/*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
