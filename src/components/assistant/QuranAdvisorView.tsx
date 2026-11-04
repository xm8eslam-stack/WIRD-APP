import React, { useState } from 'react';
import { 
  Compass, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  Lightbulb, 
  CheckCircle, 
  ArrowLeft,
  Calculator,
  ShieldCheck,
  Send
} from 'lucide-react';

interface QuranAdvisorViewProps {
  onStartSessionWithSurah?: (surahNumber: number) => void;
}

export const QuranAdvisorView: React.FC<QuranAdvisorViewProps> = () => {
  const [selectedTopic, setSelectedTopic] = useState<'methods' | 'calculator' | 'mutashabihat_rules' | 'qa'>('methods');
  const [targetAjza, setTargetAjza] = useState<number>(3);
  const [availableDailyMinutes, setAvailableDailyMinutes] = useState<number>(30);
  const [userQuery, setUserQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'advisor'; text: string }>>([
    {
      sender: 'advisor',
      text: 'مرحباً بك في المستشار القرآني لمنصة وِرد. يسعدني إرشادك لأفضل أساليب الحفظ والتثبيت وعلاج التفلت وتنظيم المراجعة المتباعدة. كيف يمكنني مساعدتك اليوم؟'
    }
  ]);

  // Methodologies
  const methodologies = [
    {
      title: "طريقة التكرار الشنقيطية (سر الحفاظ الكبار)",
      description: "تقوم على قراءة الآية أو اللوح الواحد بصوت مسموع من 15 إلى 30 مرة متتالية حتى تنطبع في الذاكرة الصورية والسمعية، ثم عدم الانتقال للآية التالية إلا بعد ربطها بسابقتها.",
      tag: "الأعلى رسوخاً",
      tips: [
        "اقرأ الآية الأولى 10 مرات نظراً من المصحف.",
        "اقرأها 10 مرات غيباً.",
        "انتقل للآية الثانية وكررها 10 مرات.",
        "اربط الآيتين معاً واقرأهما 5 مرات متتابعة."
      ]
    },
    {
      title: "قاعدة «المراجعة قبل الحفظ الجديد»",
      description: "خطأ معظم من ينسى القرآن هو البدء بالحفظ الجديد وإهمال الماضي. اجعل أول نصف ساعة مخصصة للورد الماضي (المراجعة الصغرى) ثم ابدأ بجديدك.",
      tag: "وقاية من النسيان",
      tips: [
        "خصص 70% من وقت جلستك للمراجعة والتثبيت.",
        "خصص 30% فقط للحفظ الجديد.",
        "ما حُفظ في أسبوع يُراجع يومياً طوال الأسبوع التالي."
      ]
    },
    {
      title: "الحفظ الصوتي بالاستماع المقترن",
      description: "الاستماع لقارئ متقن (كالشيخ الحصري أو الشيخ المنشاوي أو الشيخ العفاسي) قبل البدء في الحفظ لتفادي الأخطاء اللغوية وحفظ التشكيل السليم.",
      tag: "للمبتدئين والأطفال",
      tips: [
        "استمع للمقطع المقرر 3 مرات قبل فتحه من المصحف.",
        "ردد مع القارئ بصوت خافت (الترتيل الترديدي).",
        "تحقق من مواضع الوقف والابتداء الصحيحة."
      ]
    }
  ];

  // Mutashabihat mnemonic rules
  const mnemonicRules = [
    {
      rule: "قاعدة المجاورة والموافقة",
      explanation: "تأتي الآية موافقة للفظ الأقرب إليها في نفس السياق أو الآية التي سبقتها مباشرة."
    },
    {
      rule: "قاعدة الزيادة لموضع الزيادة",
      explanation: "إذا ورد لفظ مختصر في موضع ومفصل بزيادة حرف أو كلمة في موضع آخر، فالزيادة غالباً تكون في السورة الأطول أو السياق الأكثر تفصيلاً."
    },
    {
      rule: "قاعدة الترتيب الهجائي",
      explanation: "في كثير من الألفاظ المتشابهة في القرآن، يتقدم في المصحف الحرف الأسبق هجائياً."
    },
    {
      rule: "قاعدة ما تكرر تقرر بالربط البصري",
      explanation: "تلوين أو تدوين موضع الشبه بقلم رصاص خفيف في هامش مصحفك يمنع التردد أثناء القراءة في الصلاة."
    }
  ];

  // Plan calculator result
  const calculatedDays = Math.round((targetAjza * 20) / Math.max(1, availableDailyMinutes / 25));
  const suggestedAyahsDaily = availableDailyMinutes >= 45 ? "صفحة كاملة (15 سطراً)" : availableDailyMinutes >= 25 ? "نصف صفحة (7-8 آيات)" : "3 - 5 آيات";

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    const q = userQuery.trim();
    const newMsgs = [...chatMessages, { sender: 'user' as const, text: q }];
    setChatMessages(newMsgs);
    setUserQuery('');

    // Thoughtful rule-based instant Quranic advisor responses
    setTimeout(() => {
      let reply = "وفقك الله ونفع بك! لتثبيت هذا المقطع، نوصيك بتكراره غيباً 10 مرات في الصلاة المفروضة والسنن الرواتب، فما قُرئ به في الصلاة لا يضيع بإذن الله.";
      
      if (q.includes("نسيان") || q.includes("أنسى") || q.includes("تفلت")) {
        reply = "تفلت القرآن طبيعي إن لم يتعاهده الحافظ؛ قال النبي ﷺ: «تعاهدوا هذا القرآن، فوالذي نفس محمد بيده لهو أشد تفلتاً من الإبل في عُقُلها». العلاج العملي: أوقف الحفظ الجديد لمدة 3 أيام، وكرس وقتك كاملاً لمركز المراجعة الصغرى حتى تعود الآيات طرية على لسانك.";
      } else if (q.includes("وقت") || q.includes("مشغول") || q.includes("دوام")) {
        reply = "أفضل الأوقات للحفظ السريع الراسخ هو بعد صلاة الفجر مباشرة (15 دقيقة فقط)، أو قبل النوم مباشرة حيث يقوم الدماغ بترسيخ آخر ما رآه وقرأه أثناء النوم. 3 آيات يومياً بعد الفجر تعني ختم القرآن كاملاً بتؤدة وإتقان.";
      } else if (q.includes("أطفال") || q.includes("ابن") || q.includes("طفل")) {
        reply = "مع الأطفال، اعتمد أسلوب «التكرار السمعي التنافسي» واستخدام أسلوب إخفاء الكلمات التفاعلي المتوفر في جلسة الحفظ بمنصة وِرد. كافئهم على كل 3 آيات متقنة واجعل وقت الجلسة خفيفاً لا يتجاوز 15 دقيقة.";
      }

      setChatMessages([...newMsgs, { sender: 'advisor' as const, text: reply }]);
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Header */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
            <Compass className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            المستشار القرآني لعلوم ومنهجيات الحفظ
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            خلاصة تجارب كبار القراء وأئمة الإقراء في ضبط الحفظ ومحاربة التفلت وتيسير التكرار
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-[#faf8f5] dark:bg-stone-900 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold">
          <button
            onClick={() => setSelectedTopic('methods')}
            className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
              selectedTopic === 'methods'
                ? 'bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            منهجيات الحفظ المعتمدة
          </button>

          <button
            onClick={() => setSelectedTopic('calculator')}
            className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
              selectedTopic === 'calculator'
                ? 'bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            محاكي الخطة الذكية
          </button>

          <button
            onClick={() => setSelectedTopic('mutashabihat_rules')}
            className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
              selectedTopic === 'mutashabihat_rules'
                ? 'bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            قواعد ضبط المتشابهات
          </button>

          <button
            onClick={() => setSelectedTopic('qa')}
            className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
              selectedTopic === 'qa'
                ? 'bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            استشارة فورية
          </button>
        </div>
      </div>

      {/* 2. Topic: Methodologies */}
      {selectedTopic === 'methods' && (
        <div className="space-y-4">
          {methodologies.map((m, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  {m.title}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {m.tag}
                </span>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {m.description}
              </p>

              <div className="bg-[#faf8f5] dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200/60 dark:border-stone-700/60 text-xs space-y-2">
                <div className="font-semibold text-stone-800 dark:text-stone-200">
                  خطوات التطبيق العملي:
                </div>
                <ul className="space-y-1.5 text-stone-600 dark:text-stone-400 text-[11px]">
                  {m.tips.map((tip, tIdx) => (
                    <li key={tIdx} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Topic: Smart Plan Calculator */}
      {selectedTopic === 'calculator' && (
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 md:p-8 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <Calculator className="w-6 h-6 text-emerald-700" />
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                حاسبة وقت الحفظ والتثبيت التقديرية
              </h3>
              <p className="text-xs text-stone-500">
                احسب المدة الواقعية للوصول لهدفك مع مراعاة أيام المراجعة دون إجهاد
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-2">
                كم جزءاً تريد حفظه وتثبيته؟
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={targetAjza}
                  onChange={(e) => setTargetAjza(Number(e.target.value))}
                  className="flex-1 accent-emerald-700"
                />
                <span className="font-bold font-mono text-base text-emerald-800 dark:text-emerald-300 w-16 text-center">
                  {targetAjza} أجزاء
                </span>
              </div>
            </div>

            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-2">
                الوقت المتاح لديك يومياً:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="15"
                  value={availableDailyMinutes}
                  onChange={(e) => setAvailableDailyMinutes(Number(e.target.value))}
                  className="flex-1 accent-emerald-700"
                />
                <span className="font-bold font-mono text-base text-stone-800 dark:text-stone-200 w-16 text-center">
                  {availableDailyMinutes} دقيقة
                </span>
              </div>
            </div>
          </div>

          {/* Calculator Output Card */}
          <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white p-6 rounded-2xl space-y-4">
            <div className="text-xs text-emerald-200 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>التوصية المنهجية لحفظك:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white/10 rounded-xl p-3">
                <div className="text-[11px] text-emerald-200">الورد اليومي المقترح</div>
                <div className="text-sm font-bold text-amber-300 mt-1">{suggestedAyahsDaily}</div>
              </div>

              <div className="bg-white/10 rounded-xl p-3">
                <div className="text-[11px] text-emerald-200">المدة المتوقعة للختم</div>
                <div className="text-lg font-bold font-mono text-white mt-1">~ {calculatedDays} يوماً</div>
              </div>

              <div className="bg-white/10 rounded-xl p-3">
                <div className="text-[11px] text-emerald-200">توزيع الجلسة اليومية</div>
                <div className="text-xs font-semibold text-emerald-100 mt-1">
                  {Math.round(availableDailyMinutes * 0.4)}د مراجعة + {Math.round(availableDailyMinutes * 0.6)}د جديد
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Topic: Mutashabihat Rules */}
      {selectedTopic === 'mutashabihat_rules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mnemonicRules.map((rule, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-2"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  {rule.rule}
                </h4>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {rule.explanation}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 5. Topic: Interactive Q&A */}
      {selectedTopic === 'qa' && (
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4">
          <div className="space-y-3 max-h-96 overflow-y-auto p-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs leading-relaxed ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] p-3.5 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-emerald-800 text-white rounded-br-xs'
                      : 'bg-[#faf8f5] dark:bg-stone-900 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-700">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="اطرح استفسارك القرآني (مثال: كيف أثبت سورة البقرة؟ ما علاج النسيان؟)..."
              className="flex-1 px-4 py-2.5 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              className="p-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl transition-colors"
              title="إرسال"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
