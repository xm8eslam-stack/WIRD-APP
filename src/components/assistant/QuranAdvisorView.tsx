import React, { useState, useEffect } from 'react';
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
  Send,
  Bot,
  User,
  AlertCircle,
  TrendingUp,
  Clock,
  Layers,
  Check,
  RotateCcw,
  RefreshCw,
  Zap
} from 'lucide-react';
import { UserProfile, MemorizationPlan, DailyLog, PortionStatusRecord, WeakVerseItem } from '../../types/quran';
import { AdvisorService, AdvisorStatus } from '../../services/advisorService';
import { RetentionService } from '../../services/retentionService';
import { StorageService } from '../../services/storageService';

interface QuranAdvisorViewProps {
  profile?: UserProfile;
  plans?: MemorizationPlan[];
  logs?: DailyLog[];
  onStartSessionWithSurah?: (surahNumber: number) => void;
}

export const QuranAdvisorView: React.FC<QuranAdvisorViewProps> = ({
  profile,
  plans = [],
  logs = [],
  onStartSessionWithSurah
}) => {
  const [selectedTopic, setSelectedTopic] = useState<'ai_advisor' | 'methods' | 'mutashabihat_rules' | 'calculator'>('ai_advisor');
  const [advisorStatus, setAdvisorStatus] = useState<AdvisorStatus | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetAjza, setTargetAjza] = useState<number>(3);
  const [availableDailyMinutes, setAvailableDailyMinutes] = useState<number>(30);

  const [chatMessages, setChatMessages] = useState<Array<{ 
    sender: 'user' | 'advisor'; 
    text: string; 
    isFallback?: boolean;
    timestamp?: string;
  }>>([
    {
      sender: 'advisor',
      text: 'مرحباً بك في المستشار القرآني الذكي لمنصة وِرد. أنا هنا لمساعدتك على تحليل وتيرة حفظك، تشخيص أسباب التعثر، اقتراح التعديلات الواقعية لجدولك، وتحديد أولويات المراجعة العاجلة وفق منهجيات الحفّاظ المعتمدة.',
      timestamp: 'الآن'
    }
  ]);

  // Check server AI status on mount
  useEffect(() => {
    AdvisorService.checkStatus().then(status => {
      setAdvisorStatus(status);
    });
  }, []);

  // Quick Action Buttons corresponding to the 8 required AI capabilities
  const quickActions = [
    {
      id: 'analyze_history',
      title: 'تحليل وتيرة الحفظ والمراجعة',
      desc: 'فحص معدل الإنجاز والانتظام',
      contextType: 'general',
      prompt: 'قم بتحليل سجلي القرآني للأسبوع الماضي وحدد نمط الالتزام وأهم نقاط القوة والتحسين.'
    },
    {
      id: 'missed_tasks',
      title: 'كشف أسباب صعوبة الالتزام بالخطة',
      desc: 'تشخيص أسباب التفويت والضغط',
      contextType: 'workload',
      prompt: 'ما هي الأسباب المحتملة لصعوبة الالتزام بالخطة، وكيف أتفادى تفويت المهام القرآنية؟'
    },
    {
      id: 'workload_adjust',
      title: 'اقتراح تعديل واقعي لحجم الحفظ',
      desc: 'إعادة موازنة المقدار اليومي',
      contextType: 'workload',
      prompt: 'اقترح تعديلاً واقعياً ومتوازناً لمقدار الحفظ والمراجعة اليومي ليتناسب مع وقتي المتاح دون إرهاق.'
    },
    {
      id: 'revision_priorities',
      title: 'تحديد أولويات المراجعة والتثبيت',
      desc: 'فرز المقاطع والآيات الأكثر حاجة',
      contextType: 'priorities',
      prompt: 'ما هي أولويات المراجعة العاجلة لمقاطعي المتتبعة اليوم بناءً على درجات الرسوخ وتكرار الأخطاء؟'
    },
    {
      id: 'weekly_summary',
      title: 'ملخص الإنجاز الأسبوعي',
      desc: 'تقرير الدقائق والآيات والأوجه',
      contextType: 'weekly_summary',
      prompt: 'قدم لي ملخصاً إحصائياً دقيقاً لإنجازي الأسبوعي مع نصيحة منهجية للمرحلة القادمة.'
    },
    {
      id: 'session_organizer',
      title: 'تنظيم وتوزيع جلسة الحفظ (30 د)',
      desc: 'هيكل الجلسة الذهبي (70/30)',
      contextType: 'session',
      prompt: 'كيف أنظم جلسة الحفظ اليومية في 30 دقيقة لتحقيق أقصى درجات الرسوخ ومنع التفلت؟'
    }
  ];

  // Execute an AI Analysis or Quick Action
  const handleRunQuickAction = async (action: typeof quickActions[0]) => {
    if (isLoading) return;

    const userMsg = action.prompt;
    const newMsgs = [...chatMessages, { sender: 'user' as const, text: userMsg, timestamp: 'الآن' }];
    setChatMessages(newMsgs);
    setIsLoading(true);

    const userProfile: UserProfile = profile || StorageService.getProfile();

    const portions = RetentionService.getPortions();
    const weakVerses = RetentionService.getWeakVerses();

    const response = await AdvisorService.analyzeProgress(
      action.contextType,
      logs,
      userProfile,
      plans,
      portions,
      weakVerses,
      userMsg
    );

    setIsLoading(false);
    setChatMessages([
      ...newMsgs,
      {
        sender: 'advisor',
        text: response.text,
        isFallback: response.isFallback,
        timestamp: 'الآن'
      }
    ]);
  };

  // Submit custom user message
  const handleSendCustomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || isLoading) return;

    const query = userQuery.trim();
    setUserQuery('');

    const newMsgs = [...chatMessages, { sender: 'user' as const, text: query, timestamp: 'الآن' }];
    setChatMessages(newMsgs);
    setIsLoading(true);

    const response = await AdvisorService.sendChatMessage(query, chatMessages);

    setIsLoading(false);
    setChatMessages([
      ...newMsgs,
      {
        sender: 'advisor',
        text: response.text,
        isFallback: response.isFallback,
        timestamp: 'الآن'
      }
    ]);
  };

  // Classical Methodologies
  const methodologies = [
    {
      title: "طريقة التكرار الشنقيطية (سر الحفاظ الكبار)",
      description: "تقوم على قراءة الآية أو اللوح الواحد بصوت مسموع من 15 إلى 30 مرة متتالية حتى تنطبع في الذاكرة الصورية والسمعية، ثم عدم الانتقال للآية التالية إلا بعد ربطها بسابقتها.",
      tag: "الأعلى رسوخاً",
      tips: [
        "اقرأ الآية الأولى 10 مرات نظراً من المصحف بتركيز تام.",
        "اقرأها 10 مرات غيباً مع التثبت من كل حركة.",
        "انتقل للآية التالية وكررها بنفس القدر.",
        "اربط الآيتين معاً واقرأهما 5 مرات متتابعة قبل التجاوز."
      ]
    },
    {
      title: "قاعدة «المراجعة قبل الحفظ الجديد»",
      description: "خطأ معظم من ينسى القرآن هو البدء بالحفظ الجديد وإهمال الماضي. اجعل أول ثلثي الجلسة مخصصة لورد الماضي (المراجعة الصغرى والكبرى) ثم ابدأ بجديدك.",
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

  // Mutashabihat rules
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Header & AI Availability Badge */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
              <Compass className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              المستشار القرآني ومنهجيات الحفظ والتثبيت
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              إرشاد ذكي مبني على بياناتك الفعلية وخلاصة تجارب أئمة الإقراء (الشناقطة، الشاطبي، ابن الجزري)
            </p>
          </div>

          {/* AI Availability Badge */}
          <div className="flex items-center gap-2">
            {advisorStatus?.available ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>الذكاء الاصطناعي متاح (Gemini Free Tier)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 shadow-2xs">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>النمط الذاتي الحتمي (بدون استهلاك حصة)</span>
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200 dark:border-stone-700/60 text-xs font-semibold">
          <button
            onClick={() => setSelectedTopic('ai_advisor')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              selectedTopic === 'ai_advisor'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>المستشار الذكي وتحليل وتيرة الحفظ</span>
          </button>

          <button
            onClick={() => setSelectedTopic('methods')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              selectedTopic === 'methods'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>منهجيات الحفظ المعتمدة</span>
          </button>

          <button
            onClick={() => setSelectedTopic('mutashabihat_rules')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              selectedTopic === 'mutashabihat_rules'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>قواعد ضبط المتشابهات</span>
          </button>

          <button
            onClick={() => setSelectedTopic('calculator')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              selectedTopic === 'calculator'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>حاسبة التخطيط القرآني</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: AI ADVISOR & CHAT WITH 8 CAPABILITIES */}
      {selectedTopic === 'ai_advisor' && (
        <div className="space-y-4">
          {/* Quick Action Capabilities Strip */}
          <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-3">
            <div className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <span>تحليلات واستشارات سريعة بنقرة واحدة:</span>
              </span>
              <span className="text-[10px] text-stone-400">تستند حصرًا لبياناتك المحفوظة</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleRunQuickAction(action)}
                  disabled={isLoading}
                  className="p-3 bg-[#faf8f5] dark:bg-stone-900/80 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 rounded-xl border border-stone-200/70 dark:border-stone-700/60 text-right transition-all group disabled:opacity-50"
                >
                  <div className="font-bold text-xs text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300">
                    {action.title}
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1">
                    {action.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Chat Window */}
          <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs flex flex-col min-h-[420px] max-h-[580px]">
            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pl-1">
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isUser 
                        ? 'bg-emerald-700 text-white' 
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    }`}>
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed space-y-1.5 shadow-2xs ${
                      isUser
                        ? 'bg-emerald-800 text-white rounded-tl-xs font-medium'
                        : 'bg-[#faf8f5] dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-700/80 text-stone-800 dark:text-stone-200 rounded-tr-xs'
                    }`}>
                      <div className="whitespace-pre-line leading-relaxed font-sans">
                        {msg.text}
                      </div>

                      {!isUser && msg.isFallback && (
                        <div className="text-[10px] text-stone-400 pt-1 border-t border-stone-200/50 dark:border-stone-700/50 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>إرشاد مبني على الخوارزمية الحتمية المدمجة</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-stone-400 py-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  <span>المستشار يحلل بيانات الحفظ والمراجعة...</span>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendCustomMessage} className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-700 flex items-center gap-2">
              <input
                type="text"
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                placeholder="اسأل المستشار القرآني عن طرائق الحفظ، ضبط المتشابهات، أو تنظيم وقتك..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <button
                type="submit"
                disabled={isLoading || !userQuery.trim()}
                className="p-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl transition-colors shadow-xs"
                title="إرسال"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: METHODOLOGIES */}
      {selectedTopic === 'methods' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {methodologies.map((m, idx) => (
            <div key={idx} className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {m.tag}
                </span>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 font-quran">
                  {m.title}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  {m.description}
                </p>
              </div>

              <div className="bg-[#faf8f5] dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-700/60 space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                <div className="font-bold text-[11px] text-emerald-800 dark:text-emerald-400">خطوات التطبيق:</div>
                {m.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-emerald-700 font-bold">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 3: MUTASHABIHAT RULES */}
      {selectedTopic === 'mutashabihat_rules' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mnemonicRules.map((rule, idx) => (
              <div key={idx} className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-amber-200/80 dark:border-amber-900/60 shadow-xs space-y-2">
                <div className="font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>{rule.rule}</span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  {rule.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: CALCULATOR */}
      {selectedTopic === 'calculator' && (
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-5">
          <div>
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-700" />
              <span>حاسبة التخطيط القرآني التقديرية</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              احسب الزمن المتوقع لإتمام هدفك القرآني بحسب الوقت المتاح يومياً
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                الهدف القرآني المراد حفظه:
              </label>
              <select
                value={targetAjza}
                onChange={e => setTargetAjza(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700"
              >
                <option value={1}>جزء واحد (20 صفحة)</option>
                <option value={3}>3 أجزاء (60 صفحة)</option>
                <option value={5}>5 أجزاء (100 صفحة)</option>
                <option value={10}>10 أجزاء (200 صفحة)</option>
                <option value={30}>القرآن كاملاً (604 صفحة)</option>
              </select>
            </div>

            <div>
              <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                الوقت المتاح يومياً (دقائق):
              </label>
              <input
                type="number"
                min={15}
                max={180}
                value={availableDailyMinutes}
                onChange={e => setAvailableDailyMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 font-mono"
              />
            </div>
          </div>

          {/* Result Card */}
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2 text-xs">
            <div className="font-bold text-emerald-900 dark:text-emerald-200">
              الخلاصة التقديرية للحفظ المتزن:
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-stone-500">المدة التقديرية: </span>
                <span className="font-bold text-emerald-800 dark:text-emerald-300 font-mono">
                  {Math.round((targetAjza * 20) / Math.max(0.5, availableDailyMinutes / 30))} يوماً
                </span>
              </div>
              <div>
                <span className="text-stone-500">المقدار اليومي المقترح: </span>
                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                  {availableDailyMinutes >= 45 ? 'صفحة كاملة' : availableDailyMinutes >= 25 ? 'نصف صفحة' : '3-5 آيات'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
