import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['frontend/tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['frontend/scripts/lib/**/*.ts'],
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage/frontend',
    },
  },
});
