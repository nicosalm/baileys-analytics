import { defineConfig } from 'vitest/config';

// Plain node pool for pure-util tests that don't need a Workers runtime.
// Run: pnpm vitest run --config vitest.node.config.mts
export default defineConfig({
	test: {
		include: ['src/utils/**/*.test.ts', 'src/services/**/*.spec.ts', 'src/middleware/**/*.spec.ts', 'src/routes/**/*.spec.ts'],
	},
});
