import React, { useState } from 'react';
import { 
  CheckCircle, 
  RotateCcw, 
  Award, 
  Sparkles, 
  Check, 
  X, 
  ArrowLeft,
  BookOpen,
  Shuffle,
  ArrowUpDown,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { MUTASHABIHAT_DATA } from '../../data/mutashabihatData';
import { TestResult, WirdPortion } from '../../types/quran';
import { RetentionService } from '../../services/retentionService';
import { VERIFIED_AYAHS } from '../../data/verifiedAyahs';
import { generateDynamicTestQuestions, GeneratedQuestion } from '../../services/testQuestionGenerator';

interface MemorizationTestsViewProps {
  onSaveTestResult: (result: TestResult) => void;
  onAddVerseToRevision: (surahNumber: number, surahName: string, ayahNumber: number) => void;
}

type TestType = 'complete_verse' | 'bidirectional_recall' | 'random_recall' | 'mutashabihat';

const ARABIC_OPTION_LETTERS = ['أ', 'ب', 'ج', 'د'];

export const MemorizationTestsView: React.FC<MemorizationTestsViewProps> = ({
  onSaveTestResult,
  onAddVerseToRevision
}) => {
  const [selectedTestType, setSelectedTestType] = useState<TestType>('complete_verse');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [weakVerseFeedback, setWeakVerseFeedback] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  // Load user portions and dynamically generate verified test questions
  const portions = RetentionService.getPortions();
  const generationResult = React.useMemo(() => {
    return generateDynamicTestQuestions(selectedTestType, portions as WirdPortion[]);
  }, [selectedTestType, sessionKey]);

  const currentQuestions = generationResult.questions;
  const currentQ = currentQuestions[currentQuestionIndex] || currentQuestions[0];

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (index === currentQ.correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setWeakVerseFeedback(null);
    } else {
      setIsFinished(true);
      const finalScore = score + (selectedOption === currentQ.correctIndex ? 1 : 0);
      onSaveTestResult({
        id: `test-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: selectedTestType,
        surahName: currentQ.surahName,
        score: finalScore,
        totalQuestions: currentQuestions.length,
        weakVerses: []
      });
    }
  };

  const handleResetTest = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
    setWeakVerseFeedback(null);
    setSessionKey(k => k + 1);
  };

  const handleAddCurrentToWeakVerses = () => {
    try {
      RetentionService.addOrIncrementWeakVerse(
        currentQ.surahNumber,
        currentQ.targetAyahNumber,
        currentQ.surahName,
        currentQ.options[currentQ.correctIndex],
        `تعثر في اختبار: ${
          selectedTestType === 'complete_verse' ? 'إكمال الآية التالية' :
          selectedTestType === 'bidirectional_recall' ? 'الآية السابقة والتالية' :
          selectedTestType === 'random_recall' ? 'اختبار عشوائي من المحفوظ' : 'المتشابهات اللفظية'
        }`
      );
      setWeakVerseFeedback(`تم تسجيل الآية ${currentQ.targetAyahNumber} من سورة ${currentQ.surahName} بنجاح في قائمة الآيات الملتبسة.`);
    } catch (error) {
      setWeakVerseFeedback(error instanceof Error ? error.message : 'تعذر حفظ الآية المتعثرة؛ لم يتم تأكيد التغيير.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 1. Header & Test Mode Switcher */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
            <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            اختبارات الحفظ والتقييم الذاتي المتقدمة
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            امتحانات قرآنية تفاعلية دقيقة: إكمال الآيات، الاسترجاع العكسي، المتشابهات اللفظية، وسحب عشوائي من المحفوظ
          </p>
        </div>

        {/* Test Type 4 Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-semibold">
          <button
            onClick={() => {
              setSelectedTestType('complete_verse');
              handleResetTest();
            }}
            className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
              selectedTestType === 'complete_verse'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#faf8f5] dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-emerald-500'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <div className="font-bold text-xs">أكمل الآية التالية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'complete_verse' ? 'text-emerald-100' : 'text-stone-400'}`}>
              التسلسل الأمامي
            </div>
          </button>

          <button
            onClick={() => {
              setSelectedTestType('bidirectional_recall');
              handleResetTest();
            }}
            className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
              selectedTestType === 'bidirectional_recall'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#faf8f5] dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-emerald-500'
            }`}
          >
            <ArrowUpDown className="w-4 h-4 text-amber-500" />
            <div className="font-bold text-xs">الآية السابقة والتالية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'bidirectional_recall' ? 'text-emerald-100' : 'text-stone-400'}`}>
              الاسترجاع الثنائي
            </div>
          </button>

          <button
            onClick={() => {
              setSelectedTestType('random_recall');
              handleResetTest();
            }}
            className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
              selectedTestType === 'random_recall'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#faf8f5] dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-emerald-500'
            }`}
          >
            <Shuffle className="w-4 h-4 text-sky-400" />
            <div className="font-bold text-xs">عشوائي من المحفوظ</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'random_recall' ? 'text-emerald-100' : 'text-stone-400'}`}>
              اختبار المفاجأة
            </div>
          </button>

          <button
            onClick={() => {
              setSelectedTestType('mutashabihat');
              handleResetTest();
            }}
            className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
              selectedTestType === 'mutashabihat'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#faf8f5] dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-emerald-500'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <div className="font-bold text-xs">المتشابهات اللفظية</div>
            <div className={`text-[10px] font-normal ${selectedTestType === 'mutashabihat' ? 'text-emerald-100' : 'text-stone-400'}`}>
              الضوابط القرآنية
            </div>
          </button>
        </div>
      </div>

      {/* 2. Finished Test Result Card */}
      {isFinished ? (
        <div className="bg-white dark:bg-stone-800/90 rounded-3xl p-8 border border-stone-200/80 dark:border-stone-700/80 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-inner border border-emerald-200 dark:border-emerald-800">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              نتيجة الاختبار القرآني
            </span>
            <h3 className="text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">
              أحسنت بارك الله فيك ونفع بك!
            </h3>
            <p className="text-xs text-stone-500">
              حصلت على <strong className="text-emerald-700 font-mono text-sm">{score}</strong> من <strong className="font-mono text-sm">{currentQuestions.length}</strong>
            </p>
          </div>

          <div className="p-4 bg-[#faf8f5] dark:bg-stone-900/60 rounded-xl border border-stone-200/70 dark:border-stone-700/60 max-w-sm mx-auto text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-stone-500">معدل الدقة الإجمالي:</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 font-mono">
                {Math.round((score / currentQuestions.length) * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">مستوى الرسوخ الذهني:</span>
              <span className="font-bold text-stone-800 dark:text-stone-200">
                {score === currentQuestions.length ? 'ممتاز ومتقن تماماً' : score >= currentQuestions.length * 0.7 ? 'جيد جداً مع حاجة للتثبيت' : 'يحتاج مراجعة وتكرار'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleResetTest}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة الاختبار</span>
            </button>
          </div>
        </div>
      ) : currentQuestions.length === 0 ? (
        /* 3. Empty State Card when user has no memorized portions for test mode */
        <div className="bg-white dark:bg-stone-800/90 rounded-3xl p-8 border border-stone-200/80 dark:border-stone-700/80 text-center space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
              لا تتوفر أسئلة مؤهلة من المحفوظ حالياً
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              {generationResult.messageAr || 'يرجى تسجيل مقاطع محفوظة أولاً في خطتك أو إتمام جلسة حفظ قبل إجراء الاختبارات المبنية على المحفوظ الفعلي.'}
            </p>
          </div>
        </div>
      ) : (
        /* 4. Question Card */
        <div className="bg-white dark:bg-stone-800/90 rounded-3xl p-6 md:p-8 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between text-xs pb-3 border-b border-stone-100 dark:border-stone-700">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-md">
              السؤال {currentQuestionIndex + 1} من {currentQuestions.length}
            </span>
            <span className="text-stone-500 font-mono tabular-nums">
              الدرجة الحالية: {score}
            </span>
          </div>

          {/* Insufficient data notification banner */}
          {(!generationResult.hasSufficientData || generationResult.messageAr) && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{generationResult.messageAr || 'ملاحظة: هذا الاختبار مستخرج من المقاطع المحفوظة في سجلك الفعلي.'}</span>
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-3">
            <h3 className="font-quran text-xl md:text-2xl text-stone-900 dark:text-stone-100 leading-relaxed text-right bg-[#fdfbf7] dark:bg-stone-900/60 p-5 rounded-2xl border border-stone-200/60 dark:border-stone-700/60">
              {currentQ.prompt}
            </h3>
          </div>

          {/* Options with Arabic letter marks (أ، ب، ج، د) */}
          <div className="space-y-3">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;
              const letterMark = ARABIC_OPTION_LETTERS[idx] || 'أ';

              let style = 'bg-[#faf8f5] dark:bg-stone-900/60 border-stone-200 dark:border-stone-700/80 text-stone-800 dark:text-stone-200 hover:border-emerald-400';
              if (isAnswered) {
                if (isCorrect) {
                  style = 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold ring-1 ring-emerald-500';
                } else if (isSelected && !isCorrect) {
                  style = 'bg-red-50 dark:bg-red-950/70 border-red-500 text-red-950 dark:text-red-200';
                } else {
                  style = 'opacity-50 border-stone-200 dark:border-stone-700';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={isAnswered}
                  className={`w-full p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${style}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-quran ${
                    isAnswered && isCorrect
                      ? 'bg-emerald-600 text-white'
                      : isAnswered && isSelected && !isCorrect
                      ? 'bg-red-600 text-white'
                      : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                  }`}>
                    {isAnswered && isCorrect ? <Check className="w-3.5 h-3.5" /> : isAnswered && isSelected && !isCorrect ? <X className="w-3.5 h-3.5" /> : letterMark}
                  </div>

                  <div className="font-quran text-lg md:text-xl flex-1 leading-loose">
                    {opt}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation if Mutashabihat and answered */}
          {isAnswered && 'distinctionRule' in currentQ && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-1 text-right">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                💡 ضابط الحفظ وقاعدة التمييز المعتمدة:
              </div>
              <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-[11px]">
                {(currentQ as any).distinctionRule}
              </p>
            </div>
          )}

          {/* Weak verse added feedback */}
          {weakVerseFeedback && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{weakVerseFeedback}</span>
            </div>
          )}

          {/* Action Row */}
          {isAnswered && (
            <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-700 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddCurrentToWeakVerses}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>تسجيل هذه الآية في قائمة الآيات الملتبسة</span>
                </button>
              </div>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <span>السؤال التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
