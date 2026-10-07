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
  {
    files: ['srv/**/*.ts', 'db/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: 'Literal[value=/advert[eê]ncia|acidente|sesmt/i]', message: 'Genericidade (AGENTS.md:36): nome de Origem/área no código.' },
        { selector: 'TemplateElement[value.raw=/advert[eê]ncia|acidente|sesmt/i]', message: 'Genericidade (AGENTS.md:36): nome de Origem/área no código.' },
      ],
    },
  },
];
