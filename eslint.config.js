import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

// 日本語メモ: Flat Config での最小構成。
// typescript-eslint のメタパッケージは使わず、parser/plugin を直接設定する。
export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    ignores: ['dist', 'node_modules', 'coverage'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd()
      },
      // 日本語メモ: 追加依存を避けるため最小限のグローバルのみ許可。
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // 日本語メモ: 必要最低限のみ。詳細ルールは後で追加。
      'no-console': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  prettier
];
