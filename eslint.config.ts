import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// ARCH-04: silnik nie może zależeć od warstw prezentacji ani przeglądarki.
const engineRestrictedImports = {
  patterns: [
    {
      group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
      message: 'Silnik nie importuje React (ARCH-04).',
    },
    { group: ['phaser', 'phaser/*'], message: 'Silnik nie importuje Phaser (ARCH-04).' },
    {
      group: ['**/rendering/**', '**/ui/**', '**/application/**', '**/persistence/**', '**/pwa/**'],
      message: 'Zależności są skierowane do domeny (ARCH-04).',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/domain/**', 'src/simulation/**', 'src/world/**'],
    languageOptions: { globals: {} },
    rules: { 'no-restricted-imports': ['error', engineRestrictedImports] },
  },
  {
    files: ['*.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
