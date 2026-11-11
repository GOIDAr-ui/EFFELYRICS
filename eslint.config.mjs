import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', 'dist-electron/**', 'release/**', 'native/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended, ...ts.configs.recommended,
  { files: ['**/*.{ts,tsx,mjs}'], languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } } }
);
