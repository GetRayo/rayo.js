import { defineConfig } from 'eslint/config';
import _import from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'coverage/**', 'docs/**', '**/*.old.*', '**/* copy.*']
  },
  {
    extends: compat.extends('plugin:prettier/recommended'),

    plugins: {
      import: fixupPluginRules(_import),
      prettier
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha
      },

      ecmaVersion: 'latest',
      sourceType: 'module'
    },

    settings: {
      'import/extensions': ['.js', '.mjs'],

      'import/resolver': {
        node: {
          extensions: ['.js']
        }
      }
    },

    rules: {
      'import/no-named-as-default-member': 0,
      'import/no-named-as-default': 0,
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
