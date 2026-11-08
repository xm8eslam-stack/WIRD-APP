import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src/data/sources/tanzil/quran-simple-1.1.xml');
const outputDir = path.join(root, 'src/data/quran-simple-surahs');
if (!fs.existsSync(sourcePath)) throw new Error('[WIRD Tanzil Simple] Official XML source is missing.');
const xml = fs.readFileSync(sourcePath, 'utf8');
const surahPattern = /<sura\s+index="(\d+)"\s+name="([^"]+)"\s*>([\s\S]*?)<\/sura>/g;
const ayahPattern = /<aya\s+index="(\d+)"\s+text="([^"]*)"(?:\s+bismillah="([^"]*)")?\s*\/>/g;
const surahs = [...xml.matchAll(surahPattern)];
if (surahs.length !== 114) throw new Error('[WIRD Tanzil Simple] Refusing to generate chunks: expected 114 surahs, found ' + surahs.length);
fs.mkdirSync(outputDir, { recursive: true });
let total = 0;
for (let i = 0; i < surahs.length; i++) {
  const surahNumber = Number(surahs[i][1]);
  if (surahNumber !== i + 1) throw new Error('[WIRD Tanzil Simple] Invalid surah order at ' + (i + 1));
  const verses = [...surahs[i][3].matchAll(ayahPattern)].map((m, index) => {
    if (Number(m[1]) !== index + 1 || !m[2].trim()) throw new Error('[WIRD Tanzil Simple] Invalid ayah at ' + surahNumber + ':' + (index + 1));
    return m[2];
  });
  const target = path.join(outputDir, surahNumber + '.json');
  const serialized = JSON.stringify(verses);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== serialized) fs.writeFileSync(target, serialized, 'utf8');
  total += verses.length;
}
if (total !== 6236) throw new Error('[WIRD Tanzil Simple] Expected 6,236 ayahs, generated ' + total);
console.log('[WIRD Tanzil Simple] Generated 114 lazy-loaded surah chunks (6,236 ayahs).');
