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

const expectedByPage = Array.from({ length: 605 }, () => new Set());
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
    const page = ayah.page;
    if (!Number.isInteger(page) || page < 1 || page > 604) {
      throw new Error('[WIRD Mushaf] Invalid local page coordinate at ' + surahNumber + ':' + ayahNumber + '.');
    }
    expectedByPage[page].add(surahNumber + ':' + ayahNumber);
    totalLocalAyahs++;
  }
}

if (totalLocalAyahs !== 6236) {
  throw new Error('[WIRD Mushaf] Expected 6,236 local ayahs; found ' + totalLocalAyahs + '.');
}

for (let page = 1; page <= 604; page++) {
  if (expectedByPage[page].size === 0) {
    throw new Error('[WIRD Mushaf] Local page index is empty for page ' + page + '.');
  }
}

async function fetchPage(page) {
  const file = String(page).padStart(3, '0') + '.json';
  const url = 'https://raw.githubusercontent.com/quran-ws/quran-svg/' + commit + '/mushafs/hafs/kfqc/json/' + file;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const records = await response.json();
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('The source page JSON is empty or not an array.');
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
        const points = record.polygon.trim().split(/\s+/).map(point => point.split(',').map(Number));
        if (points.length < 3 || points.some(point => point.length !== 2 || !point.every(Number.isFinite))) {
          throw new Error('Invalid polygon geometry for ' + key);
        }
        if (actual.has(key)) throw new Error('Duplicate source coordinate ' + key);
        actual.add(key);
      }

      const expected = expectedByPage[page];
      const missing = [...expected].filter(key => !actual.has(key));
      const extra = [...actual].filter(key => !expected.has(key));
      if (missing.length || extra.length || actual.size !== expected.size) {
        throw new Error(
          'Page ' + page + ' differs from WIRD local coordinates. ' +
          'Missing: ' + missing.slice(0, 8).join(', ') + '. ' +
          'Extra: ' + extra.slice(0, 8).join(', ') + '.'
        );
      }
      return records.length;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 350));
    }
  }
  throw new Error('[WIRD Mushaf] Page ' + page + ' failed validation after 4 attempts: ' + String(lastError));
}

let nextPage = 1;
let validatedAyahPolygons = 0;
const workerCount = 16;
async function worker() {
  while (true) {
    const page = nextPage++;
    if (page > 604) return;
    validatedAyahPolygons += await fetchPage(page);
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));
console.log(
  '[WIRD Mushaf] Verified all 604 Hafs/KFGQPC page coordinate maps against WIRD local data: ' +
  totalLocalAyahs + ' ayahs, ' + validatedAyahPolygons + ' page polygons, source commit ' + commit + '.'
);
