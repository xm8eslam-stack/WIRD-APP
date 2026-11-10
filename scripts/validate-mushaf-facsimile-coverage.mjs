import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quranPath = path.join(root, 'src/data/completeQuranData.json');
const servicePath = path.join(root, 'src/services/mushafFacsimileService.ts');
const quran = JSON.parse(fs.readFileSync(quranPath, 'utf8'));
const serviceSource = fs.readFileSync(servicePath, 'utf8');
const commit = serviceSource.match(/MUSHAF_FACSIMILE_COMMIT\s*=\s*'([a-f0-9]{40})'/i)?.[1];

if (!commit) throw new Error('[WIRD Mushaf] Could not read the pinned quran-svg commit from the page service.');

const localCoordinates = new Set();
let totalLocalAyahs = 0;

for (let surahNumber = 1; surahNumber <= 114; surahNumber++) {
  const ayahs = quran[String(surahNumber)] ?? quran[surahNumber];
  if (!Array.isArray(ayahs) || ayahs.length === 0) {
    throw new Error('[WIRD Mushaf] Missing local ayah data for Surah ' + surahNumber + '.');
  }
  for (let index = 0; index < ayahs.length; index++) {
    const ayah = ayahs[index];
    const ayahNumber = index + 1;
    if (!ayah || ayah.surahNumber !== surahNumber || ayah.numberInSurah !== ayahNumber) {
      throw new Error('[WIRD Mushaf] Invalid local Quran coordinate at ' + surahNumber + ':' + ayahNumber + '.');
    }
    const key = surahNumber + ':' + ayahNumber;
    if (localCoordinates.has(key)) {
      throw new Error('[WIRD Mushaf] Duplicate ayah coordinate in WIRD local corpus: ' + key);
    }
    localCoordinates.add(key);
    totalLocalAyahs++;
  }
}

if (totalLocalAyahs !== 6236) {
  throw new Error('[WIRD Mushaf] Expected 6,236 local ayahs; found ' + totalLocalAyahs + '.');
}

const seenSourceCoordinates = new Set();
let nextPage = 1;
let validatedAyahPolygons = 0;

async function fetchPage(page) {
  const file = String(page).padStart(3, '0') + '.json';
  const url = 'https://raw.githubusercontent.com/quran-ws/quran-svg/' + commit + '/mushafs/hafs/kfqc/json/' + file;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const records = await response.json();
      if (!Array.isArray(records) || records.length === 0 || records.length > 100) {
        throw new Error('The source page JSON is empty or has an invalid number of ayah polygons.');
      }
      const actual = new Set();
      for (const record of records) {
        const surahNumber = record?.surahNumber;
        const ayahNumber = record?.ayahNumber;
        const key = surahNumber + ':' + ayahNumber;
        if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 ||
            !Number.isInteger(ayahNumber) || ayahNumber < 1 ||
            !Number.isFinite(record?.x) || !Number.isFinite(record?.y) ||
            typeof record?.polygon !== 'string' || !record.polygon.trim()) {
          throw new Error('Invalid ayah geometry record: ' + key);
        }
        if (!localCoordinates.has(key)) {
          throw new Error('Page ' + page + ' contains a coordinate missing from WIRD local Quran data: ' + key);
        }
        const pathData = record.polygon.trim();
        const commands = pathData.match(/[A-Za-z]/g) ?? [];
        const numbers = pathData.match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
        const unsupportedCharacters = pathData
          .replace(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|[MLZmlz]/g, '')
          .replace(/[\s,]/g, '');
        const isSvgPath = commands.length > 0;
        if (unsupportedCharacters.length > 0 || numbers.length < 6 ||
            numbers.length % 2 !== 0 || numbers.some(number => !Number.isFinite(number)) ||
            (isSvgPath && (!commands.some(command => command.toUpperCase() === 'M') ||
              !commands.some(command => command.toUpperCase() === 'L') ||
              commands.some(command => !'MLZmlz'.includes(command))))) {
          throw new Error('Invalid SVG polygon geometry for ' + key);
        }
        if (actual.has(key)) throw new Error('Duplicate source coordinate within page ' + page + ': ' + key);
        actual.add(key);
      }

      for (const key of actual) seenSourceCoordinates.add(key);
      return records.length;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 350));
    }
  }
  throw new Error('[WIRD Mushaf] Page ' + page + ' failed validation after 4 attempts: ' + String(lastError));
}

async function worker() {
  while (true) {
    const page = nextPage++;
    if (page > 604) return;
    validatedAyahPolygons += await fetchPage(page);
  }
}

await Promise.all(Array.from({ length: 16 }, () => worker()));

const missingCoordinates = [...localCoordinates].filter(key => !seenSourceCoordinates.has(key));
if (missingCoordinates.length > 0 || seenSourceCoordinates.size !== totalLocalAyahs) {
  throw new Error(
    '[WIRD Mushaf] The 604 printed pages do not cover the complete local Quran. ' +
    'Missing: ' + missingCoordinates.slice(0, 12).join(', ') + '.'
  );
}

console.log(
  '[WIRD Mushaf] Verified all 604 Hafs/KFGQPC page maps against WIRD local data: ' +
  totalLocalAyahs + ' unique ayahs covered by ' + validatedAyahPolygons +
  ' page polygons, source commit ' + commit + '. Page breaks are validated independently from WIRD flexible-layout metadata.'
);
