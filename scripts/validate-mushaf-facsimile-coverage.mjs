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
    if (!ayah || ayah.surahNumber !== surahNumber || ayah.numberInSurah !== ayahNumber ||
        typeof ayah.text !== 'string' || !ayah.text.trim()) {
      throw new Error('[WIRD Mushaf] Invalid local Quran coordinate/text at ' + surahNumber + ':' + ayahNumber + '.');
    }
    localCoordinates.add(surahNumber + ':' + ayahNumber);
    totalLocalAyahs++;
  }
}
if (totalLocalAyahs !== 6236 || localCoordinates.size !== 6236) {
  throw new Error('[WIRD Mushaf] Expected 6,236 unique local ayahs; found ' + totalLocalAyahs + '.');
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
      if (!Array.isArray(records) || records.length === 0) throw new Error('Source page JSON is empty or invalid.');

      const pageCoordinates = new Set();
      for (const record of records) {
        const surahNumber = record?.surahNumber;
        const ayahNumber = record?.ayahNumber;
        const key = surahNumber + ':' + ayahNumber;
        if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 ||
            !Number.isInteger(ayahNumber) || ayahNumber < 1 ||
            !Number.isFinite(record?.x) || !Number.isFinite(record?.y) ||
            typeof record?.polygon !== 'string' || !record.polygon.trim()) {
          throw new Error('Invalid source ayah geometry record: ' + key);
        }
        const polygon = record.polygon.trim();
        const commands = polygon.match(/[A-Za-z]/g) ?? [];
        const numbers = polygon.match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
        const unsupported = polygon
          .replace(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|[MLZmlz]/g, '')
          .replace(/[\s,]/g, '');
        if (unsupported || numbers.length < 6 || numbers.length % 2 !== 0 ||
            numbers.some(number => !Number.isFinite(number)) ||
            (commands.length > 0 && (!commands.some(command => command.toUpperCase() === 'M') ||
              !commands.some(command => command.toUpperCase() === 'L') ||
              commands.some(command => !'MLZmlz'.includes(command))))) {
          throw new Error('Invalid polygon geometry for ' + key);
        }
        if (!localCoordinates.has(key)) throw new Error('Source page ' + page + ' contains unknown local Quran coordinate ' + key + '.');
        if (pageCoordinates.has(key)) throw new Error('Source page ' + page + ' repeats coordinate ' + key + '.');
        pageCoordinates.add(key);
      }
      return [...pageCoordinates];
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 350));
    }
  }
  throw new Error('[WIRD Mushaf] Page ' + page + ' failed validation after 4 attempts: ' + String(lastError));
}

let nextPage = 1;
const allSourceCoordinates = new Set();
const workerCount = 16;
async function worker() {
  while (true) {
    const page = nextPage++;
    if (page > 604) return;
    const coordinates = await fetchPage(page);
    for (const key of coordinates) {
      if (allSourceCoordinates.has(key)) throw new Error('[WIRD Mushaf] Coordinate ' + key + ' appears on more than one printed page.');
      allSourceCoordinates.add(key);
    }
  }
}
await Promise.all(Array.from({ length: workerCount }, () => worker()));

const missing = [...localCoordinates].filter(key => !allSourceCoordinates.has(key));
const extra = [...allSourceCoordinates].filter(key => !localCoordinates.has(key));
if (missing.length || extra.length || allSourceCoordinates.size !== localCoordinates.size) {
  throw new Error(
    '[WIRD Mushaf] Printed edition does not cover the exact local Quran corpus. ' +
    'Missing: ' + missing.slice(0, 12).join(', ') + '. Extra: ' + extra.slice(0, 12).join(', ') + '.'
  );
}
console.log(
  '[WIRD Mushaf] Verified all 604 Hafs/KFGQPC printed pages: ' +
  totalLocalAyahs + ' unique local Quran ayahs mapped exactly once; source commit ' + commit + '.'
);
