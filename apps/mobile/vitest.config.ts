import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Only the theme tokens are unit-tested here — they are plain data with no
// React Native imports, so they run in plain Node with no native mocking.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
