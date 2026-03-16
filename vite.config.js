import { defineConfig } from 'vite';
import { vitePluginCssModule } from './vite-plugin-css-module.js';

export default defineConfig({
  plugins: [vitePluginCssModule()],
  
  resolve: {
    alias: {
      $: '/src'
    }
  },

  server: {
    port: 3000,
    open: true
  },

  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },

  preview: {
    port: 4173,
    open: true
  }
});
