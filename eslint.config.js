import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.test.ts',
      'packages/**/test-bootstrap.ts',
      'packages/core/src/data/**/*.test-helper.ts',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      '**/*.d.ts',
      'vitest.config.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      'packages/core/src/**/*.ts',
      'packages/combat/src/**/*.ts',
      'packages/items/src/**/*.ts',
      'packages/characters/src/**/*.ts',
      'packages/cli/src/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'node:fs', message: '@cardgame/core must stay free of Node I/O' },
            { name: 'node:process', message: '@cardgame/core must stay free of Node I/O' },
          ],
        },
      ],
    },
  },
);
