import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // Отключаем стандартные правила для неиспользуемых переменных
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // Используем правила из плагина (можно автофиксить)
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];