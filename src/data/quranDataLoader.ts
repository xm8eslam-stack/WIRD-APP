import { Ayah } from '../types/quran';

// The split files are generated from completeQuranData.json before dev/build.
// Vite turns each matching JSON file into an independent lazy-loaded chunk.
const surahModules = import.meta.glob<{ default: Ayah[] }>('./quran-surahs/*.json');
const surahCache = new Map<number, Promise<Ayah[]>>();

export async function loadSurahVerses(surahNumber: number): Promise<Ayah[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return [];

  const cached = surahCache.get(surahNumber);
  if (cached) return cached;

  const modulePath = './quran-surahs/' + surahNumber + '.json';
  const loader = surahModules[modulePath];
  if (!loader) throw new Error('Missing local Quran chunk for Surah ' + surahNumber + '. Run the Quran chunk generator.');

  const pending = loader()
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