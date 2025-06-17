const fs = require('fs');
const path = require('path');

const prettierOptions = JSON.parse(fs.readFileSync(path.resolve(__dirname, '.prettierrc'), 'utf8'));
const tsconfigOptions = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'tsconfig.json'), 'utf8'),
);

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'no-relative-import-paths'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  settings: {
    'import/resolver': {
      node: {
        extension: ['.js', '.ts'],
        paths: ['./src'],
      },
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-return-await': 'error',
    'import/newline-after-import': ['error', { count: 1 }],
    'import/order': [
      'error',
      {
        pathGroups: [
          {
            pattern: 'nestjs/**',
            group: 'builtin',
            position: 'before',
          },
          {
            pattern: 'config',
            group: 'external',
            position: 'after',
          },
          {
            pattern: 'translation',
            group: 'external',
            position: 'after',
          },
          {
            pattern: 'entity/**',
            group: 'external',
            position: 'after',
          },
          {
            pattern: 'modules/**',
            group: 'external',
            position: 'after',
          },
          {
            pattern: 'common/**',
            group: 'external',
            position: 'after',
          },
        ],
        'newlines-between': 'always',
      },
    ],
    'prettier/prettier': ['warn', prettierOptions],
    'no-relative-import-paths/no-relative-import-paths': [
      'warn',
      { rootDir: tsconfigOptions.compilerOptions.baseUrl, allowSameFolder: true },
    ],
    'no-console': 'error',
  },
};
