import fs from 'node:fs';
import path from 'node:path';

const OFFLINE_PUBLIC_ASSET_EXTENSION = /\.(?:css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|json|webmanifest)$/i;

/**
 * List public static files that the explicit offline package must include.
 * The service worker script itself is deliberately excluded: browsers must
 * fetch its current version through the service-worker update lifecycle.
 */
export function listOfflinePublicAssets(publicDir = path.resolve(process.cwd(), 'public')): string[] {
  if (!fs.existsSync(publicDir)) return [];

  const assets: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relativePath = path.relative(publicDir, absolutePath).split(path.sep).join('/');
      if (relativePath === 'sw.js' || !OFFLINE_PUBLIC_ASSET_EXTENSION.test(relativePath)) continue;
      assets.push('/' + relativePath);
    }
  };

  visit(publicDir);
  return assets.sort();
}
