const fs = await import('node:fs');
const path = await import('node:path');
const url = await import('node:url');

const { readFileSync, writeFileSync } = fs;
const { dirname, resolve } = path;
const { fileURLToPath } = url;

const __dirname = dirname(fileURLToPath(import.meta.url));

export function vitePluginCssModule() {
  let cssFiles = [];
  let rootDir = '';

  return {
    name: 'vite-plugin-css-module',

    configResolved(config) {
      rootDir = resolve(config.root);
      const outDir = resolve(rootDir, config.build.outDir);
      
      cssFiles = [
        { src: resolve(rootDir, 'src/themes/default.css'), name: 'default' }
      ];

      for (const { src, name } of cssFiles) {
        try {
          const source = readFileSync(src, 'utf-8');
          const compressed = source.replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '');
          
          const jsContent = `export default '${compressed}';`;
          
          const outputPath = resolve(outDir, 'themes', `${name}.js`);
          writeFileSync(outputPath, jsContent);
          
          console.log(`[CSS Module] ${src} -> ${outputPath}`);
        } catch (err) {
          console.error(`[CSS Module] Error processing ${src}:`, err.message);
        }
      }
    },

    configureServer(server) {
      server.watcher.on('change', async (file) => {
        if (file.endsWith('.css') && file.includes('/src/themes/')) {
          const match = file.match(/\/themes\/([\w-]+)\.css$/);
          if (match) {
            const [, name] = match;
            try {
              const source = readFileSync(file, 'utf-8');
              const compressed = source.replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '');
              const jsContent = `export default '${compressed}';`;
              const outputPath = resolve(rootDir, 'dist', 'themes', `${name}.js`);
              writeFileSync(outputPath, jsContent);
              console.log(`[CSS Module] Watch: ${file} updated`);
              server.ws.send({ type: 'full-reload' });
            } catch (err) {
              console.error(`[CSS Module] Error: ${err.message}`);
            }
          }
        }
      });
    }
  };
}
