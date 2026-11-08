/*
 * Vitest config: unit tests next to the code, data and build tests in tests/.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['packages/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
		reporters: ['dot'],
	},
});
