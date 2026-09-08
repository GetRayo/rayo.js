import { defineConfig } from 'eslint/config';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default defineConfig([
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'coverage/**', 'docs/**', '**/*.old.*', '**/* copy.*']
  },
  {
    extends: [prettierRecommended],

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha
      },

      ecmaVersion: 'latest',
      sourceType: 'module'
    },

    rules: {
      'arrow-parens': ['error', 'always'],

      'prettier/prettier': [
        'error',
        {
          semi: true,
          printWidth: 120,
          singleQuote: true,
          arrowParens: 'always',
          trailingComma: 'none'
        }
      ],

      'func-names': ['error', 'always'],
      'comma-dangle': ['error', 'never'],

      'no-param-reassign': [
        'error',
        {
          props: false
        }
      ],

      'max-len': [
        'error',
        120,
        {
          ignoreRegExpLiterals: true
        }
      ]
    },

    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'eslint.config.mjs',
      'coverage',
      'node_modules',
      'packages/**/node_modules',
      'docs',
      'test'
    ]
  }
]);
