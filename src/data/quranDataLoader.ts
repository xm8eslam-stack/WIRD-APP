import { Ayah } from '../types/quran';

// The split files are generated from completeQuranData.json before dev/build.
// Vite turns each matching JSON file into an independent lazy-loaded chunk.
let viteGlobAvailable = true;
const surahModules = (() => {
  try { return import.meta.glob<{ default: Ayah[] }>('./quran-surahs/*.json'); }
  catch { viteGlobAvailable = false; return {}; }
})();
const surahCache = new Map<number, Promise<Ayah[]>>();

export async function loadSurahVerses(surahNumber: number): Promise<Ayah[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return [];

  const cached = surahCache.get(surahNumber);
  if (cached) return cached;

  const modulePath = './quran-surahs/' + surahNumber + '.json';
  const loader = surahModules[modulePath];
  if (!loader && viteGlobAvailable) throw new Error('Missing local Quran chunk for Surah ' + surahNumber + '. Run the Quran chunk generator.');

  // Node-based integrity tests do not implement Vite's import.meta.glob. Load the canonical JSON only in that test runtime.
  const pending = (loader ? loader() : import('./completeQuranData.json').then(module => ({ default: module.default[String(surahNumber)] as Ayah[] })))
    .then(module => Array.isArray(module.default) ? module.default : [])
    .catch(error => {
      surahCache.delete(surahNumber);
      throw error;
    });
  surahCache.set(surahNumber, pending);
  return pending;
}

export async function loadAyahByCoordinate(surahNumber: number, ayahNumber: number): Promise<Ayah | undefined> {
  if (!Number.isInteger(ayahNumber) || ayahNumber < 1) return undefined;
  const verses = await loadSurahVerses(surahNumber);
  return verses.find(ayah => ayah.numberInSurah === ayahNumber);
}

export function getAyahWords(text: string): string[] {
  return text.split(/\s+/).filter(word => word.trim().length > 0 && !['ۚ', 'ۖ', 'ۗ', 'ۛ'].includes(word));
}
 
// Tanzil Simple is stored separately from the canonical Uthmani corpus and loaded per surah.
interface SimpleAyahRecord { surahNumber: number; ayahNumber: number; text: string; }
interface SimpleSurahChunk { source: string; version: string; copyright: string; license: string; sourceUrl: string; surahNumber: number; ayahs: SimpleAyahRecord[]; }
const simpleSurahModules = (() => {
  try { return import.meta.glob<{ default: SimpleSurahChunk }>('./quran-simple-surahs/*.json'); }
  catch { return {}; }
})();
const simpleSurahCache = new Map<number, Promise<SimpleAyahRecord[]>>();

async function loadSimpleSurahTexts(surahNumber: number): Promise<SimpleAyahRecord[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return [];
  const cached = simpleSurahCache.get(surahNumber);
  if (cached) return cached;
  const modulePath = './quran-simple-surahs/' + surahNumber + '.json';
  const loader = simpleSurahModules[modulePath];
  if (!loader) throw new Error('Missing local Tanzil Simple chunk for Surah ' + surahNumber + '. Run the Quran data generator.');
  const pending = loader()
    .then(module => Array.isArray(module.default?.ayahs) && module.default.surahNumber === surahNumber ? module.default.ayahs : [])
    .catch(error => { simpleSurahCache.delete(surahNumber); throw error; });
  simpleSurahCache.set(surahNumber, pending);
  return pending;
}

export async function loadSimpleAyahText(surahNumber: number, ayahNumber: number): Promise<string | undefined> {
  if (!Number.isInteger(ayahNumber) || ayahNumber < 1) return undefined;
  const verses = await loadSimpleSurahTexts(surahNumber);
  return verses.find(ayah => ayah.surahNumber === surahNumber && ayah.ayahNumber === ayahNumber)?.text;
}

export async function loadSimpleAyahRange(surahNumber: number, startAyah: number, endAyah = startAyah): Promise<string[]> {
  if (!Number.isInteger(startAyah) || !Number.isInteger(endAyah) || startAyah < 1 || endAyah < startAyah) return [];
  const verses = await loadSimpleSurahTexts(surahNumber);
  const selected = verses.filter(ayah => ayah.surahNumber === surahNumber && ayah.ayahNumber >= startAyah && ayah.ayahNumber <= endAyah);
  if (selected.length !== endAyah - startAyah + 1) return [];
  return selected.sort((a, b) => a.ayahNumber - b.ayahNumber).map(ayah => ayah.text);
}

/** Resolve the display spelling asynchronously while preserving the canonical Uthmani Ayah.text field. */
export async function getAyahDisplayText(ayah: Ayah): Promise<string> {
  const simpleText = await loadSimpleAyahText(ayah.surahNumber, ayah.numberInSurah);
  if (!simpleText) throw new Error('Missing verified Tanzil Simple text for ' + ayah.surahNumber + ':' + ayah.numberInSurah);
  return simpleText;
}
