import { ALL_SURAHS, TOTAL_QURAN_VERSES, TOTAL_QURAN_PAGES } from '../data/quranMeta';
import { SurahMeta } from '../types/quran';

export interface VerseCoordinate {
  surahNumber: number;
  ayahNumber: number;
}

export interface VerseRange {
  start: VerseCoordinate;
  end: VerseCoordinate;
  totalVerses: number;
}

export const QuranMath = {
  getSurah(surahNumber: number): SurahMeta | undefined {
    return ALL_SURAHS.find(s => s.number === surahNumber);
  },

  /**
   * Validate if a surah and ayah coordinate exists
   */
  isValidCoordinate(surahNumber: number, ayahNumber: number): boolean {
    if (!Number.isSafeInteger(surahNumber) || !Number.isSafeInteger(ayahNumber)) return false;
    const s = this.getSurah(surahNumber);
    if (!s) return false;
    return ayahNumber >= 1 && ayahNumber <= s.versesCount;
  },

  /**
   * Calculate absolute global index of an ayah in the Quran (1 to 6236)
   */
  getAbsoluteAyahIndex(surahNumber: number, ayahNumber: number): number {
    if (!this.isValidCoordinate(surahNumber, ayahNumber)) return 0;
    let index = 0;
    for (let i = 0; i < ALL_SURAHS.length; i++) {
      if (ALL_SURAHS[i].number === surahNumber) {
        index += ayahNumber;
        break;
      }
      index += ALL_SURAHS[i].versesCount;
    }
    return index;
  },

  /**
   * Convert absolute global index back to Surah and Ayah
   */
  getCoordinateFromAbsoluteIndex(absIndex: number): VerseCoordinate {
    if (!Number.isSafeInteger(absIndex)) {
      throw new RangeError('Absolute Quran ayah index must be a safe integer.');
    }
    let remaining = Math.max(1, Math.min(TOTAL_QURAN_VERSES, absIndex));
    for (const surah of ALL_SURAHS) {
      if (remaining <= surah.versesCount) {
        return { surahNumber: surah.number, ayahNumber: remaining };
      }
      remaining -= surah.versesCount;
    }
    return { surahNumber: 114, ayahNumber: 6 };
  },

  /**
   * Calculate exact count of verses between two coordinates (inclusive)
   */
  countVersesBetween(start: VerseCoordinate, end: VerseCoordinate): number {
    if (!this.isValidCoordinate(start?.surahNumber, start?.ayahNumber) ||
        !this.isValidCoordinate(end?.surahNumber, end?.ayahNumber)) return 0;
    const startIdx = this.getAbsoluteAyahIndex(start.surahNumber, start.ayahNumber);
    const endIdx = this.getAbsoluteAyahIndex(end.surahNumber, end.ayahNumber);
    return Math.max(0, endIdx - startIdx + 1);
  },

  /**
   * Add N verses to a coordinate, advancing across surah boundaries accurately
   */
  addVerses(start: VerseCoordinate, count: number): VerseCoordinate {
    if (!this.isValidCoordinate(start?.surahNumber, start?.ayahNumber)) {
      throw new RangeError('Starting Quran coordinate is invalid.');
    }
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError('Verse offset must be a non-negative safe integer.');
    }
    const currentAbs = this.getAbsoluteAyahIndex(start.surahNumber, start.ayahNumber);
    const targetAbs = currentAbs + count;
    return this.getCoordinateFromAbsoluteIndex(targetAbs);
  },

  /**
   * Divide a range of verses into chunks of size `chunkSize`
   */
  sliceRangeIntoChunks(start: VerseCoordinate, end: VerseCoordinate, chunkSize: number): VerseRange[] {
    const chunks: VerseRange[] = [];
    if (!this.isValidCoordinate(start?.surahNumber, start?.ayahNumber) ||
        !this.isValidCoordinate(end?.surahNumber, end?.ayahNumber) ||
        !Number.isSafeInteger(chunkSize) || chunkSize <= 0) return chunks;
    const totalVerses = this.countVersesBetween(start, end);
    if (totalVerses <= 0) return chunks;

    let currentStart = { ...start };
    let versesRemaining = totalVerses;

    while (versesRemaining > 0) {
      const currentChunkSize = Math.min(versesRemaining, chunkSize);
      const currentEnd = this.addVerses(currentStart, currentChunkSize - 1);
      
      chunks.push({
        start: { ...currentStart },
        end: { ...currentEnd },
        totalVerses: currentChunkSize
      });

      versesRemaining -= currentChunkSize;
      if (versesRemaining > 0) {
        currentStart = this.addVerses(currentEnd, 1);
      }
    }

    return chunks;
  },

  /**
   * Estimate realistic cognitive time required for new memorization in minutes
   * based on memorization level and verses count.
   */
  estimateMemorizationMinutes(versesCount: number, level: 'beginner' | 'intermediate' | 'advanced' | 'hafiz'): number {
    if (!Number.isSafeInteger(versesCount) || versesCount <= 0) return 0;
    // Minutes per verse for deep repetition and solid retention:
    // Beginner: ~4-5 mins/verse (includes reading, tajweed, 15x repetition)
    // Intermediate: ~3 mins/verse
    // Advanced: ~2 mins/verse
    // Hafiz: ~1-1.5 mins/verse
    const ratePerVerse = {
      beginner: 4.5,
      intermediate: 3.0,
      advanced: 2.0,
      hafiz: 1.2
    }[level];

    return Math.max(10, Math.round(versesCount * ratePerVerse));
  },

  /**
   * Estimate revision time required in minutes for a given number of verses
   */
  estimateRevisionMinutes(versesCount: number, type: 'minor' | 'major'): number {
    if (!Number.isSafeInteger(versesCount) || versesCount <= 0) return 0;
    // Minor revision (recent): ~0.8 min per verse (includes linking)
    // Major revision (older): ~0.4 min per verse (fluent recitation pace ~20 min/juz)
    const rate = type === 'minor' ? 0.8 : 0.4;
    return Math.max(5, Math.round(versesCount * rate));
  }
};
