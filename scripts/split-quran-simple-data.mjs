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
    const ayahNumber = Number(m[1]);
    if (ayahNumber !== index + 1 || !m[2].trim()) throw new Error('[WIRD Tanzil Simple] Invalid ayah at ' + surahNumber + ':' + (index + 1));
    return { surahNumber, ayahNumber, text: m[2] };
  });
  const target = path.join(outputDir, surahNumber + '.json');
  const chunk = {
    source: 'Tanzil Project',
    version: 'Quran Text (Simple), Version 1.1',
    copyright: 'Copyright (C) 2007-2026 Tanzil Project',
    license: 'Creative Commons Attribution 3.0 (CC BY 3.0)',
    sourceUrl: 'https://tanzil.net',
    surahNumber,
    ayahs: verses
  };
  const serialized = JSON.stringify(chunk);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== serialized) fs.writeFileSync(target, serialized, 'utf8');
  const generated = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (generated.source !== 'Tanzil Project' || generated.version !== 'Quran Text (Simple), Version 1.1' || generated.license !== 'Creative Commons Attribution 3.0 (CC BY 3.0)' || generated.sourceUrl !== 'https://tanzil.net' || generated.surahNumber !== surahNumber || !Array.isArray(generated.ayahs) || generated.ayahs.length !== verses.length) {
    throw new Error('[WIRD Tanzil Simple] Generated chunk attribution or coordinate structure failed for Surah ' + surahNumber);
  }
  for (let index = 0; index < verses.length; index++) {
    const expected = verses[index], actual = generated.ayahs[index];
    if (actual.surahNumber !== surahNumber || actual.ayahNumber !== index + 1 || actual.text !== expected.text) {
      throw new Error('[WIRD Tanzil Simple] Generated text changed or coordinate mismatch at ' + surahNumber + ':' + (index + 1));
    }
  }
  total += verses.length;
}
if (total !== 6236) throw new Error('[WIRD Tanzil Simple] Expected 6,236 ayahs, generated ' + total);
console.log('[WIRD Tanzil Simple] Generated 114 lazy-loaded surah chunks (6,236 ayahs).');
