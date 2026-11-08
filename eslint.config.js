/*
 * ESLint flat config: typed TypeScript rules for the whole repository.
 */
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
	{ ignores: ['dist/', 'coverage/', 'node_modules/'] },
	js.configs.recommended,
	tseslint.configs.strictTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ['eslint.config.js'] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'no-console': 'error',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
		},
	},
	{
		// ? build and dev tools report to the terminal
		files: ['tools/**'],
		rules: { 'no-console': 'off' },
	},
);
