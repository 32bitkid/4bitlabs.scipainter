import { defineConfig } from 'tsdown';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  entry: ['./src/index.ts'],
  platform: 'node',
  format: ['esm'],
  target: ['node20'],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
});
