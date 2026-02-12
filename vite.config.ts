/**
 * Vite Configuration
 * Build and development server settings for LectureSense Web
 */

import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // Development server configuration
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: false, // Allow fallback to another port if 3000 is in use
    },
    
    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,
    },
    
    // Plugins
    plugins: [react()],
    
    // Environment variable definitions
    // Only expose explicitly listed variables to client code
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    
    // Path resolution
    resolve: {
      alias: {
        '@': resolve(__dirname, './'),
        '@components': resolve(__dirname, './components'),
        '@services': resolve(__dirname, './services'),
        '@hooks': resolve(__dirname, './hooks'),
      },
    },
  };
});
