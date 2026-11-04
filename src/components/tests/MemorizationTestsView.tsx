import React, { useState } from 'react';
import { 
  CheckCircle, 
  RotateCcw, 
  Award, 
  Sparkles, 
  Check, 
  X, 
  ArrowLeft,
  BookOpen
} from 'lucide-react';
import { MUTASHABIHAT_DATA } from '../../data/mutashabihatData';
import { TestResult } from '../../types/quran';

interface MemorizationTestsViewProps {
  onSaveTestResult: (result: TestResult) => void;
  onAddVerseToRevision: (surahNumber: number, surahName: string, ayahNumber: number) => void;
}

type TestType = 'complete_verse' | 'mutashabihat';

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

  // 1. Complete the Verse Questions (Authentic verified Quranic questions)
  const completeVerseQuestions = [
    {
      surahName: "الملك",
      surahNumber: 67,
      prompt: "«تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ» — ما هي الآية التي تليها مباشرة؟",
      options: [
        "الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا ۚ وَهُوَ الْعَزِيزُ الْغَفُورُ",
        "الَّذِي خَلَقَ سَبْعَ سَمَاوَاتٍ طِبَاقًا ۖ مَّا تَرَىٰ فِي خَلْقِ الرَّحْمَٰنِ مِن تَفَاوُتٍ",
        "وَلَقَدْ زَيَّنَّا السَّمَاءَ الدُّنْيَا بِمَصَابِيحَ وَجَعَلْنَاهَا رُجُومًا لِّلشَّيَاطِينِ",
        "هُوَ الَّذِي جَعَلَ لَكُمُ الْأَرْضَ ذَلُولًا فَامْشُوا فِي مَنَاكِبِهَا"
      ],
      correctIndex: 0,
      nextAyahNumber: 2
    },
    {
      surahName: "الكهف",
      surahNumber: 18,
      prompt: "«الْحَمْدُ لِلَّهِ الَّذِي أَنزَلَ عَلَىٰ عَبْدِهِ الْكِتَابَ وَلَمْ يَجْعَل لَّهُ عِوَجًا» — ما الكلمة الأولى في الآية الثانية؟",
      options: [
        "قَيِّمًا لِّيُنذِرَ بَأْسًا شَدِيدًا مِّن لَّدُنْهُ",
        "مَّاكِثِينَ فِيهِ أَبَدًا",
        "إِنَّا جَعَلْنَا مَا عَلَى الْأَرْضِ زِينَةً لَّهَا",
        "وَيُنذِرَ الَّذِينَ قَالُوا اتَّخَذَ اللَّهُ وَلَدًا"
      ],
      correctIndex: 0,
      nextAyahNumber: 2
    },
    {
      surahName: "النبأ",
      surahNumber: 78,
      prompt: "«عَمَّ يَتَسَاءَلُونَ ۝ عَنِ النَّبَإِ الْعَظِيمِ» — الآية الثالثة هي:",
      options: [
        "كَلَّا سَيَعْلَمُونَ",
        "الَّذِي هُمْ فِيهِ مُخْتَلِفُونَ",
        "أَلَمْ نَجْعَلِ الْأَرْضَ مِهَادًا",
        "ثُمَّ كَلَّا سَيَعْلَمُونَ"
      ],
      correctIndex: 1,
      nextAyahNumber: 3
    },
    {
      surahName: "الضحى",
      surahNumber: 93,
      prompt: "«مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ» — الآية التي تليها مباشرة:",
      options: [
        "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ",
        "أَلَمْ يَجِدْكَ يَتِيمًا فَآوَىٰ",
        "وَلَلْآخِرَةُ خَيْرٌ لَّكَ مِنَ الْأُولَىٰ",
        "وَوَجَدَكَ ضَالًّا فَهَدَىٰ"
      ],
      correctIndex: 2,
      nextAyahNumber: 4
    }
  ];

  // 2. Mutashabihat Test Questions
  const mutashabihatQuestions = MUTASHABIHAT_DATA.map((item) => ({
    surahName: item.surah1.name,
    surahNumber: item.surah1.surahNumber,
    prompt: `في سورة ${item.surah1.name} (الآية ${item.surah1.ayahNumber}): كيف وردت صياغة الآية الكريمة؟`,
    options: [
      item.surah1.text,
      item.surah2.text
    ],
    correctIndex: 0,
    distinctionRule: item.distinctionRule,
    nextAyahNumber: item.surah1.ayahNumber
  }));

  const currentQuestions = selectedTestType === 'complete_verse' 
    ? completeVerseQuestions 
    : mutashabihatQuestions;

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
    } else {
      setIsFinished(true);
      onSaveTestResult({
        id: `test-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: selectedTestType,
        surahName: currentQ.surahName,
        score: score + (selectedOption === currentQ.correctIndex ? 1 : 0),
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
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 1. Header & Test Mode Switcher */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
            <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            اختبارات الحفظ والتقييم الذاتي
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            امتحانات قرآنية تفاعلية معتمدة لقياس رسوخ الآيات وضبط المتشابهات اللفظية
          </p>
        </div>

        {/* Test Type Tabs */}
        <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
          <button
            onClick={() => {
              setSelectedTestType('complete_verse');
              handleResetTest();
            }}
            className={`p-3.5 rounded-xl border text-center transition-all ${
              selectedTestType === 'complete_verse'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#faf8f5] dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
            }`}
          >
            <div className="font-bold text-sm">أكمل الآية التالية</div>
            <div className={`text-[11px] font-normal mt-0.5 ${selectedTestType === 'complete_verse' ? 'text-emerald-100' : 'text-stone-400'}`}>
              اختبار التسلسل والترابط الذهني
            </div>
          </button>

          <button
            onClick={() => {
              setSelectedTestType('mutashabihat');
              handleResetTest();
            }}
            className={`p-3.5 rounded-xl border text-center transition-all ${
              selectedTestType === 'mutashabihat'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#faf8f5] dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
            }`}
          >
            <div className="font-bold text-sm">اختبار المتشابهات اللفظية</div>
            <div className={`text-[11px] font-normal mt-0.5 ${selectedTestType === 'mutashabihat' ? 'text-emerald-100' : 'text-stone-400'}`}>
              ضبط الآيات المتشابهة في السور
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
              أحسنت بارك الله فيك!
            </h3>
            <p className="text-xs text-stone-500">
              حصلت على <strong className="text-emerald-700 font-mono text-sm">{score}</strong> من <strong className="font-mono text-sm">{currentQuestions.length}</strong>
            </p>
          </div>

          <div className="p-4 bg-[#faf8f5] dark:bg-stone-900/60 rounded-xl border border-stone-200/70 dark:border-stone-700/60 max-w-sm mx-auto text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-stone-500">معدل الدقة:</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 font-mono">
                {Math.round((score / currentQuestions.length) * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">تقييم الرسوخ:</span>
              <span className="font-bold text-stone-800 dark:text-stone-200">
                {score === currentQuestions.length ? 'ممتاز وجيد جداً' : 'جيد ويحتاج مراجعة المتشابهات'}
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
      ) : (
        /* 3. Question Card */
        <div className="bg-white dark:bg-stone-800/90 rounded-3xl p-6 md:p-8 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between text-xs pb-3 border-b border-stone-100 dark:border-stone-700">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-md">
              السؤال {currentQuestionIndex + 1} من {currentQuestions.length}
            </span>
            <span className="text-stone-500 font-mono tabular-nums">
              الدرجة الحالية: {score}
            </span>
          </div>

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

          {/* Action Row */}
          {isAnswered && (
            <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-700">
              <button
                onClick={() => onAddVerseToRevision(currentQ.surahNumber, currentQ.surahName, currentQ.nextAyahNumber)}
                className="text-xs text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium"
              >
                + إضافة هذه الآية لجدول المراجعة للتثبيت
              </button>

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
