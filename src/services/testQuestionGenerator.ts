import { Ayah, WirdPortion } from '../types/quran';

export interface QuranDataAccess {
  loadAyahByCoordinate: (surahNumber: number, ayahNumber: number) => Promise<Ayah | undefined>;
  loadSurahVerses: (surahNumber: number) => Promise<Ayah[]>;
}
import { ALL_SURAHS } from '../data/quranMeta';
import { MUTASHABIHAT_DATA } from '../data/mutashabihatData';

export type TestMode = 'complete_verse' | 'bidirectional_recall' | 'random_recall' | 'mutashabihat';

export interface GeneratedQuestion {
  surahName: string;
  surahNumber: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  targetAyahNumber: number;
  promptAyahNumber?: number;
  promptCanonicalText?: string;
  optionAyahCoordinates?: Array<{ surahNumber: number; ayahNumber: number }>;
  distinctionRule?: string;
  isFromMemorizedPortion: boolean;
}

export interface QuestionGenerationResult {
  questions: GeneratedQuestion[];
  hasSufficientData: boolean;
  memorizedPortionsCount: number;
  isCuratedMutashabihat?: boolean;
  messageAr?: string;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): { shuffled: T[]; originalIndexMap: number[] } {
  const items = [...array];
  const originalIndices = items.map((_, i) => i);

  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
    [originalIndices[i], originalIndices[j]] = [originalIndices[j], originalIndices[i]];
  }

  return { shuffled: items, originalIndexMap: originalIndices };
}

/**
 * Generate truthful, verified dynamic test questions.
 * Rules (Phase 3.1):
 * 1. Zero fallback questions from unmemorized or unrelated Surahs.
 * 2. Questions originate strictly from the user's eligible memorized portions.
 * 3. Partial question sets (< 5) are returned honestly with hasSufficientData: false.
 * 4. Empty memorized state returns zero questions with guidance to record memorization.
 * 5. Curated Mutashabihat is kept distinct and clearly designated.
 */
export async function generateDynamicTestQuestions(
  testType: TestMode,
  portions: WirdPortion[] = [],
  targetCount: number = 5,
  dataAccess?: QuranDataAccess
): Promise<QuestionGenerationResult> {
  const safePortions = Array.isArray(portions) ? portions : [];
  
  // Filter active memorized portions
  const memorized = safePortions.filter(
    p => p.status === 'stable' || p.status === 'recently_memorized' || p.status === 'needs_revision' || p.status === 'weak'
  );

  // 1. Curated Mutashabihat Test Mode (Thematic comparative Quranic questions)
  if (testType === 'mutashabihat') {
    const memorizedSurahNumbers = new Set(memorized.map(p => p.surahNumber));
    const prioritized = [...MUTASHABIHAT_DATA].sort((a, b) => {
      const aHas = memorizedSurahNumbers.has(a.surah1.surahNumber) || memorizedSurahNumbers.has(a.surah2.surahNumber);
      const bHas = memorizedSurahNumbers.has(b.surah1.surahNumber) || memorizedSurahNumbers.has(b.surah2.surahNumber);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });

    const selectedItems = prioritized.slice(0, targetCount);
    const questions: GeneratedQuestion[] = selectedItems.map(item => {
      const rawOptions = [item.surah1.text, item.surah2.text];
      const rawOptionAyahCoordinates = [
        { surahNumber: item.surah1.surahNumber, ayahNumber: item.surah1.ayahNumber },
        { surahNumber: item.surah2.surahNumber, ayahNumber: item.surah2.ayahNumber }
      ];
      const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
      const correctIndex = originalIndexMap.indexOf(0);

      return {
        surahName: item.surah1.name,
        surahNumber: item.surah1.surahNumber,
        prompt: `في سورة ${item.surah1.name} (الآية ${item.surah1.ayahNumber}): كيف وردت صياغة الآية الكريمة وضبط المتشابه بدقة؟`,
        options: shuffled,
        correctIndex,
        optionAyahCoordinates: originalIndexMap.map(index => rawOptionAyahCoordinates[index]),
        distinctionRule: item.distinctionRule,
        targetAyahNumber: item.surah1.ayahNumber,
        isFromMemorizedPortion: memorizedSurahNumbers.has(item.surah1.surahNumber)
      };
    });

    return {
      questions,
      hasSufficientData: questions.length >= targetCount,
      memorizedPortionsCount: memorized.length,
      isCuratedMutashabihat: true,
      messageAr: questions.length < targetCount 
        ? `نماذج المتشابهات المتاحة حالياً: ${questions.length} أسئلة.`
        : undefined
    };
  }

  // 2. Memorization-Based Tests: If user has zero memorized portions, never simulate or pull unmemorized Surahs
  if (memorized.length === 0) {
    return {
      questions: [],
      hasSufficientData: false,
      memorizedPortionsCount: 0,
      messageAr: 'لم تسجل أي مقاطع محفوظة بعد. يرجى إتمام وِرد حفظ أو تسجيل مقاطع محفوظة أولاً للبدء في الاختبارات المبنية على محفوظك.'
    };
  }

  // Vite's per-Surah loader is imported only when a memorization-backed mode actually needs Quran data.
  // This keeps module evaluation safe in Node-based integrity tests and avoids loading Quran chunks early.
  const { loadAyahByCoordinate, loadSurahVerses } = dataAccess ?? await import('../data/quranDataLoader');

  switch (testType) {
    case 'complete_verse': {
      const questions: GeneratedQuestion[] = [];
      const eligiblePortions = [...memorized].sort(() => 0.5 - Math.random());

      for (const p of eligiblePortions) {
        if (questions.length >= targetCount) break;
        const surahVerses = await loadSurahVerses(p.surahNumber);
        if (!surahVerses || surahVerses.length < 2) continue;

        // Candidate Ayahs where next Ayah exists within the memorized portion
        const minAyah = p.startAyah;
        const maxAyah = Math.min(p.endAyah - 1, surahVerses.length - 1);
        if (minAyah > maxAyah) continue;

        // Gather all eligible transitions in this portion
        const eligibleTargetNs: number[] = [];
        for (let n = minAyah; n <= maxAyah; n++) {
          eligibleTargetNs.push(n);
        }
        eligibleTargetNs.sort(() => 0.5 - Math.random());

        for (const targetN of eligibleTargetNs) {
          if (questions.length >= targetCount) break;

          const currentAyah = await loadAyahByCoordinate(p.surahNumber, targetN);
          const nextAyah = await loadAyahByCoordinate(p.surahNumber, targetN + 1);
          if (!currentAyah || !nextAyah) continue;

          // Avoid duplicate question prompts
          if (questions.some(q => q.surahNumber === p.surahNumber && q.targetAyahNumber === nextAyah.numberInSurah)) {
            continue;
          }

          // 3 verified distractors from the same Surah or other verified verses
          const candidates = surahVerses.filter(a => a.numberInSurah !== targetN + 1 && a.numberInSurah !== targetN);
          const shuffledCandidates = candidates.sort(() => 0.5 - Math.random());
          const distractorAyahs = shuffledCandidates.slice(0, 3);

          // If not enough in same Surah, pull from adjacent verified Surah
          if (distractorAyahs.length < 3) {
            const otherSurah = await loadSurahVerses(p.surahNumber === 114 ? 113 : p.surahNumber + 1);
            for (const o of otherSurah) {
              if (distractorAyahs.length >= 3) break;
              if (!distractorAyahs.some(ayah => ayah.text === o.text) && o.text !== nextAyah.text) {
                distractorAyahs.push(o);
              }
            }
          }

          if (distractorAyahs.length < 3) continue;

          const optionAyahs = [nextAyah, ...distractorAyahs];
          const rawOptions = optionAyahs.map(ayah => ayah.text);
          const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
          const correctIndex = originalIndexMap.indexOf(0);

          questions.push({
            surahName: p.surahName,
            surahNumber: p.surahNumber,
            prompt: `في سورة ${p.surahName}: قال تعالى: «${currentAyah.text}» [الآية ${currentAyah.numberInSurah}] — ما هي الآية التي تليها مباشرة؟`,
            options: shuffled,
            correctIndex,
            targetAyahNumber: nextAyah.numberInSurah,
            promptAyahNumber: currentAyah.numberInSurah,
            promptCanonicalText: currentAyah.text,
            optionAyahCoordinates: originalIndexMap.map(index => ({ surahNumber: optionAyahs[index].surahNumber, ayahNumber: optionAyahs[index].numberInSurah })),
            isFromMemorizedPortion: true
          });
        }
      }

      const hasSufficient = questions.length >= targetCount;
      const messageAr = !hasSufficient
        ? (questions.length === 0
            ? 'المقاطع المحفوظة الحالية قصيرة جداً لإنشاء أسئلة إكمال الآية (تحتاج مقطعاً من آيتين متتاليتين على الأقل).'
            : `المحتوى القرآني المحفوظ حالياً يكفي لإنشاء ${questions.length} أسئلة فقط. تم إعدادها حصرياً من محفوظك الفعلي.`)
        : undefined;

      return {
        questions,
        hasSufficientData: hasSufficient,
        memorizedPortionsCount: memorized.length,
        messageAr
      };
    }

    case 'bidirectional_recall': {
      const questions: GeneratedQuestion[] = [];
      const eligiblePortions = [...memorized].sort(() => 0.5 - Math.random());

      for (const p of eligiblePortions) {
        if (questions.length >= targetCount) break;
        const surahVerses = await loadSurahVerses(p.surahNumber);
        if (!surahVerses || surahVerses.length < 2) continue;

        // Try bidirectional combinations within portion
        for (let targetN = p.startAyah; targetN <= p.endAyah; targetN++) {
          if (questions.length >= targetCount) break;

          const canGoPrev = targetN > p.startAyah;
          const canGoNext = targetN < p.endAyah && targetN < surahVerses.length;
          if (!canGoPrev && !canGoNext) continue;

          const isPrevious = canGoPrev && (!canGoNext || Math.random() > 0.5);
          const expectedAyahNum = isPrevious ? targetN - 1 : targetN + 1;
          const promptDirection = isPrevious ? `⟵ ما هي الآية السابقة لها مباشرة؟` : `⟶ ما هي الآية التالية لها مباشرة؟`;

          const centerAyah = await loadAyahByCoordinate(p.surahNumber, targetN);
          const answerAyah = await loadAyahByCoordinate(p.surahNumber, expectedAyahNum);
          if (!centerAyah || !answerAyah) continue;

          if (questions.some(q => q.surahNumber === p.surahNumber && q.targetAyahNumber === expectedAyahNum)) {
            continue;
          }

          const candidates = surahVerses.filter(a => a.numberInSurah !== expectedAyahNum && a.numberInSurah !== targetN);
          const shuffledCandidates = candidates.sort(() => 0.5 - Math.random());
          const distractorAyahs = shuffledCandidates.slice(0, 3);

          if (distractorAyahs.length < 3) {
            const otherSurah = await loadSurahVerses(p.surahNumber === 114 ? 113 : p.surahNumber + 1);
            for (const o of otherSurah) {
              if (distractorAyahs.length >= 3) break;
              if (!distractorAyahs.some(ayah => ayah.text === o.text) && o.text !== answerAyah.text) {
                distractorAyahs.push(o);
              }
            }
          }

          if (distractorAyahs.length < 3) continue;

          const optionAyahs = [answerAyah, ...distractorAyahs];
          const rawOptions = optionAyahs.map(ayah => ayah.text);
          const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
          const correctIndex = originalIndexMap.indexOf(0);

          questions.push({
            surahName: p.surahName,
            surahNumber: p.surahNumber,
            prompt: `في سورة ${p.surahName}: قال تعالى: «${centerAyah.text}» [الآية ${centerAyah.numberInSurah}] ${promptDirection}`,
            options: shuffled,
            correctIndex,
            targetAyahNumber: expectedAyahNum,
            promptAyahNumber: centerAyah.numberInSurah,
            promptCanonicalText: centerAyah.text,
            optionAyahCoordinates: originalIndexMap.map(index => ({ surahNumber: optionAyahs[index].surahNumber, ayahNumber: optionAyahs[index].numberInSurah })),
            isFromMemorizedPortion: true
          });
        }
      }

      const hasSufficient = questions.length >= targetCount;
      const messageAr = !hasSufficient
        ? (questions.length === 0
            ? 'المقاطع المحفوظة الحالية قصيرة جداً لاختبار الاسترجاع العكسي.'
            : `المحتوى القرآني المحفوظ حالياً يكفي لإنشاء ${questions.length} أسئلة فقط. تم إعدادها حصرياً من محفوظك الفعلي.`)
        : undefined;

      return {
        questions,
        hasSufficientData: hasSufficient,
        memorizedPortionsCount: memorized.length,
        messageAr
      };
    }

    case 'random_recall': {
      const questions: GeneratedQuestion[] = [];
      const eligiblePortions = [...memorized].sort(() => 0.5 - Math.random());

      for (const p of eligiblePortions) {
        if (questions.length >= targetCount) break;

        // Sample Ayahs directly from the memorized portion
        for (let targetN = p.startAyah; targetN <= p.endAyah; targetN++) {
          if (questions.length >= targetCount) break;

          const ayah = await loadAyahByCoordinate(p.surahNumber, targetN);
          if (!ayah) continue;

          if (questions.some(q => q.surahNumber === p.surahNumber && q.targetAyahNumber === ayah.numberInSurah)) {
            continue;
          }

          // Choose 3 distractor surahs
          const otherSurahs = ALL_SURAHS.filter(s => s.number !== p.surahNumber);
          const shuffledSurahs = otherSurahs.sort(() => 0.5 - Math.random()).slice(0, 3);

          const correctLabel = `سورة ${p.surahName} (الآية ${ayah.numberInSurah})`;
          const distractorLabels = shuffledSurahs.map(s => `سورة ${s.name} (الآية ${Math.min(ayah.numberInSurah, s.versesCount)})`);

          const rawOptions = [correctLabel, ...distractorLabels];
          const { shuffled, originalIndexMap } = shuffleArray(rawOptions);
          const correctIndex = originalIndexMap.indexOf(0);

          questions.push({
            surahName: p.surahName,
            surahNumber: p.surahNumber,
            prompt: `من محفوظك الفعلي: أين ورد قوله تعالى: «${ayah.text}»؟`,
            options: shuffled,
            correctIndex,
            targetAyahNumber: ayah.numberInSurah,
            promptAyahNumber: ayah.numberInSurah,
            promptCanonicalText: ayah.text,
            isFromMemorizedPortion: true
          });
        }
      }

      const hasSufficient = questions.length >= targetCount;
      const messageAr = !hasSufficient
        ? (questions.length === 0
            ? 'لا توجد آيات مؤهلة كافية في محفوظك الحالي.'
            : `المحتوى القرآني المحفوظ حالياً يكفي لإنشاء ${questions.length} أسئلة فقط. تم إعدادها حصرياً من محفوظك الفعلي.`)
        : undefined;

      return {
        questions,
        hasSufficientData: hasSufficient,
        memorizedPortionsCount: memorized.length,
        messageAr
      };
    }
  }
}
