import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/helpers/**/*.test.js'],
    exclude: ['tests/e2e/**'],
  },
});
