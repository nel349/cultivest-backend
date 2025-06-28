import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 10000,
    include: [
      'test/**/*.{test,spec}.{js,ts}',
      'utils/**/*.{test,spec}.{js,ts}',
      'services/**/*.{test,spec}.{js,ts}',
      'app/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      'node_modules/',
      'build/',
      'contracts/**/*',
      'cultivest-react-native/**/*',
      '**/*.d.ts',
      'scripts/',
      'vitest.config.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        'contracts/',
        '**/*.d.ts',
        'test/',
        'scripts/',
        'vitest.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@utils': path.resolve(__dirname, './utils'),
      '@services': path.resolve(__dirname, './services')
    }
  }
}); 