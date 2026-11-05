import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourcePath = path.join(projectRoot, 'src/data/completeQuranData.json');
const outputDir = path.join(projectRoot, 'src/data/quran-surahs');

if (!fs.existsSync(sourcePath)) {
  throw new Error('[WIRD Quran] Source dataset is missing: ' + sourcePath);
}

const dataset = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
  throw new Error('[WIRD Quran] Expected a surah-number keyed JSON object.');
}

fs.mkdirSync(outputDir, { recursive: true });
let totalAyahs = 0;
const pageIndex = Object.create(null);

for (let surahNumber = 1; surahNumber <= 114; surahNumber++) {
  const ayahs = dataset[String(surahNumber)] ?? dataset[surahNumber];
  if (!Array.isArray(ayahs) || ayahs.length === 0) {
    throw new Error('[WIRD Quran] Missing or empty data for Surah ' + surahNumber);
  }

  for (let index = 0; index < ayahs.length; index++) {
    const ayah = ayahs[index];
    if (!ayah || ayah.surahNumber !== surahNumber || ayah.numberInSurah !== index + 1 || typeof ayah.text !== 'string' || !ayah.text.trim()) {
      throw new Error('[WIRD Quran] Invalid coordinate or text in Surah ' + surahNumber + ', ayah ' + (index + 1));
    }
  }

  for (let index = 0; index < ayahs.length; index++) {
    const ayah = ayahs[index];
    const pageNumber = ayah.page;
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
      throw new Error('[WIRD Quran] Invalid page number in Surah ' + surahNumber + ', ayah ' + (index + 1));
    }
    const segments = pageIndex[pageNumber] || (pageIndex[pageNumber] = []);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.surahNumber === surahNumber && lastSegment.endAyah === index) {
      lastSegment.endAyah = index + 1;
    } else {
      segments.push({ surahNumber, startAyah: index + 1, endAyah: index + 1 });
    }
  }

  totalAyahs += ayahs.length;
  const targetPath = path.join(outputDir, surahNumber + '.json');
  const serialized = JSON.stringify(ayahs);
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== serialized) {
    fs.writeFileSync(targetPath, serialized, 'utf8');
  }
}

if (totalAyahs !== 6236) {
  throw new Error('[WIRD Quran] Expected 6,236 ayahs, found ' + totalAyahs + '. No chunk set should be used.');
}

for (let pageNumber = 1; pageNumber <= 604; pageNumber++) {
  if (!Array.isArray(pageIndex[pageNumber]) || pageIndex[pageNumber].length === 0) {
    throw new Error('[WIRD Quran] Missing page index data for Mushaf page ' + pageNumber);
  }
}

const pageIndexPath = path.join(projectRoot, 'src/data/quranPageIndex.generated.ts');
const pageIndexSource = 'export const QURAN_PAGE_INDEX = ' + JSON.stringify(pageIndex) + ' as const;\n';
if (!fs.existsSync(pageIndexPath) || fs.readFileSync(pageIndexPath, 'utf8') !== pageIndexSource) {
  fs.writeFileSync(pageIndexPath, pageIndexSource, 'utf8');
}

console.log('[WIRD Quran] Generated 114 Surah chunks and a verified 604-page index (' + totalAyahs + ' ayahs).');