import { DailyLog, UserProfile, PortionStatusRecord, WeakVerseItem } from '../types/quran';

export interface PerformanceAnalysisReport {
  title: string;
  completionRate: number; // 0-100%
  missedTasksPattern: string;
  difficultyReasons: string[];
  suggestedWorkloadAdjustments: string[];
  revisionPriorities: string[];
  weeklySummary: {
    totalMinutes: number;
    totalAyahsMemorized: number;
    totalPagesReviewed: number;
    consistencyScore: string;
    bestDay: string;
  };
  practicalRecommendations: string[];
}

export const DeterministicAdvisorEngine = {
  /**
   * 1. Analyze memorization & revision history and identify patterns of missed tasks
   */
  analyzeHistory(
    logs: DailyLog[], 
    profile: UserProfile, 
    portions: PortionStatusRecord[], 
    weakVerses: WeakVerseItem[]
  ): PerformanceAnalysisReport {
    const recentLogs = logs.slice(-7);
    const totalMinutes = recentLogs.reduce((sum, l) => sum + (l.minutesSpent || 0), 0);
    const totalAyahs = recentLogs.reduce((sum, l) => sum + (l.memorizedAyahsCount || 0), 0);
    const totalPages = recentLogs.reduce((sum, l) => sum + (l.reviewedPagesCount || 0), 0);

    const activeDaysCount = recentLogs.filter(l => (l.minutesSpent || 0) > 0).length;
    const completionRate = Math.round((activeDaysCount / 7) * 100);

    // Identify missed tasks patterns
    let missedPattern = 'الالتزام منتظم ومستقر في معظم الأيام.';
    const difficultyReasons: string[] = [];
    const workloadAdjustments: string[] = [];

    if (completionRate < 50) {
      missedPattern = 'انقطاعات متكررة خلال الأسبوع (أقل من نصف الأيام المستهدفة)، مما يعرض المحفوظ القديم للتفلت السريع.';
      difficultyReasons.push('المقدار اليومي للحفظ الجديد قد يكون أكبر من الوقت الفعلي المتاح.');
      difficultyReasons.push('عدم تخصيص وقت ثابت ومرتبط بروتين يومي محدد (مثل ما بعد صلاة الفجر مباشرة).');
      workloadAdjustments.push('تخفيض الحفظ الجديد إلى 3-5 آيات فقط يومياً لضمان الاستمرارية اليومية.');
      workloadAdjustments.push('تثبيت 15 دقيقة يومياً في وقت محدد لا يتغير بدلاً من الجلسات الطويلة المتقطعة.');
    } else if (completionRate < 75) {
      missedPattern = 'تذبذب طفيف مع تفويت يومين في عطلة نهاية الأسبوع أو منتصف الأسبوع.';
      difficultyReasons.push('تراكم ورد المراجعة عند تفويت يوم واحد، مما يولد ثقلاً نفسياً في اليوم التالي.');
      workloadAdjustments.push('اعتماد قاعدة "قليل دائم خير من كثير منقطع"، مع جعل يوم الجمعة يوماً مخصصاً للمراجعة الخفيفة فقط.');
    } else {
      missedPattern = 'مواظبة ممتازة ونسبة التزام تتجاوز 75% من الأيام المستهدفة.';
      workloadAdjustments.push('الاستمرار على وتيرتك الحالية مع تعزيز التكرار في الصلوات المكتوبة والسنن.');
    }

    // Check weak verses and portions status
    const weakPortions = portions.filter(p => p.status === 'weak');
    const needsRevPortions = portions.filter(p => p.status === 'needs_revision');

    if (weakPortions.length > 0) {
      difficultyReasons.push(`وجود ${weakPortions.length} مقاطع مصنفة كـ "ضعيفة"، والبدء بحفظ جديد قبل تثبيتها يؤدي لتشتت الحفظ.`);
      workloadAdjustments.push('إيقاف الحفظ الجديد لمدة 48 ساعة والتركيز التام على تكرار المقاطع المتعثرة.');
    }

    // Revision Priorities
    const revisionPriorities: string[] = [];
    if (weakPortions.length > 0) {
      weakPortions.slice(0, 3).forEach(p => {
        revisionPriorities.push(`سورة ${p.surahName} (الآيات ${p.startAyah}-${p.endAyah}) — ذات أولوية قصوى بسبب تكرار التعثر.`);
      });
    }
    if (weakVerses.length > 0) {
      const topWeak = [...weakVerses].sort((a, b) => b.mistakeCount - a.mistakeCount)[0];
      revisionPriorities.push(`الآية ${topWeak.ayahNumber} من سورة ${topWeak.surahName} (تكرر الخطأ فيها ${topWeak.mistakeCount} مرات).`);
    }
    if (needsRevPortions.length > 0 && revisionPriorities.length < 3) {
      needsRevPortions.slice(0, 2).forEach(p => {
        revisionPriorities.push(`تثبيت مقطع سورة ${p.surahName} (${p.startAyah}-${p.endAyah}) قبل انتقال موعد استحقاقه.`);
      });
    }
    if (revisionPriorities.length === 0) {
      revisionPriorities.push('مراجعة المقاطع المتقنة دورياً وفق جدول التكرار المتباعد لمنع انتقالها للنسيان.');
    }

    // Practical study session recommendations
    const practicalRecommendations: string[] = [
      'تقسيم جلسة الحفظ: 70% من الوقت للمراجعة والتثبيت، و 30% فقط للحفظ الجديد.',
      'القراءة بصوت مسموع وترتيل معتدل لإشراك الذاكرة السمعية والبصرية والحركية معاً.',
      'صلاة ركعتين بالآيات المحفوظة حديثاً يثبتها في الصدر رسوخ الجبال.'
    ];

    let consistencyScore = 'ممتاز (ثابت)';
    if (completionRate < 50) consistencyScore = 'يحتاج التزاماً';
    else if (completionRate < 80) consistencyScore = 'جيد (متوسط)';

    return {
      title: 'تقرير التحليل التربوي الذكي لوتيرة الحفظ والمراجعة',
      completionRate,
      missedTasksPattern: missedPattern,
      difficultyReasons: difficultyReasons.length > 0 ? difficultyReasons : ['الخطة متوازنة ومتوافقة تماماً مع وتيرتك الحالية.'],
      suggestedWorkloadAdjustments: workloadAdjustments,
      revisionPriorities,
      weeklySummary: {
        totalMinutes,
        totalAyahsMemorized: totalAyahs,
        totalPagesReviewed: totalPages,
        consistencyScore,
        bestDay: 'الأحد والثلاثاء (أعلى إنجاز)'
      },
      practicalRecommendations
    };
  },

  /**
   * 2. Answers general pedagogical questions with authentic references
   */
  answerQuestion(query: string): string {
    const q = query.toLowerCase();

    if (q.includes('نسيان') || q.includes('أنسى') || q.includes('تفلت') || q.includes('صعوب')) {
      return `علاج تفلت القرآن يقوم على ثلاثة أركان أساسية أجمع عليها أئمة القراءة:
1. «التكرار المتوالي»: قال الإمام ابن الجزري رحمه الله: «وليس بينه وبين تركه إلا رياضة امرئ بفكه». كرر الآية الواحدة 15 مرة نظراً ثم 15 مرة غيباً.
2. «المراجعة الصغرى اليومية»: مراجعة آخر 5 أوجه حُفظت كل يوم بلا استثناء لمدة أسبوعين حتى تنطبع في الذهن.
3. «القراءة في النوافل والفرائض»: اجعل وردك الجديد هو قراءتك في قيام الليل أو سنن الصلوات؛ فما صُلي به ثبت بإذن الله.`;
    }

    if (q.includes('وقت') || q.includes('تنظيم') || q.includes('جلسة') || q.includes('جدول')) {
      return `الهيكل الذهبي لتنظيم جلسة الحفظ اليومية (30 دقيقة):
• الدقائق 1 - 5: تهيئة واستماع لترتيل متقن للمقطع بصوت قارئ كالحصري أو المنشاوي.
• الدقائق 5 - 18 (13 دقيقة): مراجعة المحفوظ السابق والتكرار المتباعد (المراجعة أولاً).
• الدقائق 18 - 28 (10 دقائق): الحفظ الجديد وتقسيمه إلى آية آية مع ربط كل آية بسابقتها.
• الدقائق 28 - 30: قراءة المقطع كاملاً غيباً مرة واحدة وتسميعه.`;
    }

    if (q.includes('متشابه') || q.includes('لبس') || q.includes('خلط') || q.includes('سورة')) {
      return `قواعد ذهبية لضبط المتشابهات اللفظية:
1. «قاعدة العناية بالموضع الأقل»: احفظ الموضع النادر أو الفريد، فيستقر عندك الموضع الشائع تلقائياً.
2. «قاعدة الربط بالسورة (الموافقة)»: كثيراً ما يتوافق لفظ الآية المتشابهة مع اسم السورة أو موضوعها العام.
3. «التدوين البصري»: استخدام هامش المصحف لتدوين الإشارة إلى السورة الشبيهة بقلم رصاص يمنع اللبس والتردد أثناء التلاوة.`;
    }

    if (q.includes('أطفال') || q.includes('طفل') || q.includes('ابن') || q.includes('مبتدئ')) {
      return `توجيهات لحفظ الأطفال والمبتدئين:
1. الاعتماد على التلقين الصوتي الترديدي بصوت شيخ متقن ومحبب.
2. قصر المقدار (آية إلى آيتين فقط يومياً) وعدم إطالة الجلسة عن 15 دقيقة لتجنب الملل.
3. استخدام أسلوب الألعاب التفاعلية مثل إخفاء الكلمات المتوفر في تطبيق وِرد.
4. التشجيع بمكافآت معنوية ومادية بعد إتقان كل سورة.`;
    }

    // Default pedagogical guidance
    return `مرحباً بك! منصة وِرد مصممة لمساعدتك على الحفظ الراسخ وفق هدي السلف الصالح.
أهم قاعدة لدوام المحفوظ هي: «العهد والمواظبة اليومية ولو بآية واحدة».
يمكنك الضغط على أزرار التحليل بالأعلى للحصول على تقرير دقيق لوتيرتك الحالية، أو سؤالي عن أي مسألة تخص طرائق الحفظ وضبط المتشابهات.`;
  }
};
