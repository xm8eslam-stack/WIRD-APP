import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { listOfflinePublicAssets } from './scripts/offlinePublicAssets';
import {defineConfig} from 'vite';
import type {Plugin} from 'vite';

function offlineShellManifestPlugin(): Plugin {
  return {
    name: 'wird-offline-shell-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(
        item => item.type === 'chunk' && item.isEntry && item.name === 'index'
      );
      if (!entry) {
        this.error('WIRD offline shell: Vite entry chunk "index" was not found.');
      }

      const assets = new Set<string>();
      const visited = new Set<string>();
      const visitStaticChunk = (fileName: string) => {
        if (visited.has(fileName)) return;
        visited.add(fileName);
        const item = bundle[fileName];
        if (!item || item.type !== 'chunk') return;

        assets.add('/' + item.fileName);
        const metadata = (item as typeof item & {
          viteMetadata?: { importedCss?: Set<string> };
        }).viteMetadata;
        for (const cssFile of metadata?.importedCss || []) {
          assets.add('/' + cssFile);
        }
        for (const importedFile of item.imports) {
          visitStaticChunk(importedFile);
        }
      };

      visitStaticChunk(entry.fileName);
      const allAssets = new Set<string>([
        ...Object.values(bundle)
          .filter(item => item.type === 'chunk' || (
            item.type === 'asset' &&
            /\\.(?:css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|json|webmanifest)$/i.test(item.fileName)
          ))
          .map(item => '/' + item.fileName),
        ...listOfflinePublicAssets()
      ]);
      this.emitFile({
        type: 'asset',
        fileName: 'wird-precache-manifest.json',
        source: JSON.stringify({
          schemaVersion: 1,
          assets: [...assets].sort(),
          allAssets: Object.values(bundle)
            .filter(item => item.type === 'chunk' || (
              item.type === 'asset' &&
              /\.(?:css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|json|webmanifest)$/i.test(item.fileName)
            ))
            .map(item => '/' + item.fileName)
            .filter((asset, index, list) => list.indexOf(asset) === index)
            .sort()
        })
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), offlineShellManifestPlugin()],
    resolve: {
      alias: {
        '@': import.meta.dirname ?? path.resolve('.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 650,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
