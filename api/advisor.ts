import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `أنت "المستشار القرآني" لمنصة "وِرد | WIRD" لتحفيظ ومراجعة القرآن الكريم.
مهمتك: تقديم إرشادات تربوية وتعليمية ونفسية لمساعدة الحفاظ على تثبيت القرآن وتنظيم أوقاتهم وضبط خططهم وعلاج التفلت.

القواعد القرآنية والأمنية الإلزامية:
1. لا تقم أبداً بتأليف أو اختلاق أو استنباط أي آيات قرآنية من ذاكرتك.
2. لا تعدل على أي نص قرآني.
3. لا تدعي التحقق من التجويد أو مخارج الحروف الصوتية دون وجود نظام مخصص لذلك.
4. يجب أن تستند نصائحك وإرشاداتك حصرًا إلى البيانات الفعلية للمستخدم وسياق حفظه.
5. تحدث باللغة العربية الفصحى الراقية بأسلوب مشجع وموجز ومباشر.
6. ركز على منهجيات الحفاظ المعتمدة (المراجعة قبل الحفظ، التكرار المتباعد، تثبيت المتشابهات بالضوابط، الحفظ بعد الفجر).
7. اجعل إجابتك مركزة ومختصرة في نقاط محددة وسهلة التطبيق.`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = req.url || '';

  // GET /api/advisor/status
  if (req.method === 'GET' || path.includes('/status')) {
    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    return res.status(200).json({
      available: isKeyConfigured,
      model: 'gemini-3.8-flash',
      tier: 'free',
      message: isKeyConfigured 
        ? 'خدمة الذكاء الاصطناعي متاحة (Gemini Free Tier)' 
        : 'يعمل النظام في وضع التوصيات الحتمية المحلي (بدون استهلاك رصيد)'
    });
  }

  // POST /api/advisor/analyze or /api/advisor/chat
  if (req.method === 'POST') {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({
        success: false,
        code: 'KEY_MISSING',
        message: 'مفتاح الذكاء الاصطناعي غير متوفر في البيئة الحالية. يتم تشغيل المحلل الحتمي الداخلي.'
      });
    }

    const { contextType, userData, query, message } = req.body || {};
    const promptText = message || query || 'قدم نصائح لترسيخ الحفظ القرآني وتنظيم المراجعة.';

    let userContextSummary = '';
    if (userData) {
      userContextSummary = `
[بيانات المستخدم الحالية في تطبيق وِرد]:
- الاسم والهدف: ${userData.name || 'عبد الرحمن'} (${userData.goal || 'حفظ وإتقان القرآن'})
- خطة الحفظ النشطة: ${userData.activePlanTitle || 'سورة الملك'}
- إجمالي المحفوظ: ${userData.memorizedAyahsCount || 0} آية
- الآيات المتعثرة: ${userData.weakVersesCount || 0} آيات
- مؤشر جودة الرسوخ: %${userData.retentionScore || 85}
- المقاطع المستحقة للمراجعة اليوم: ${userData.dueRevisionsCount || 0} مقطع
`;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${userContextSummary}\nنوع الطلب: ${contextType || 'استشارة'}\nالسؤال: ${promptText}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });

      return res.status(200).json({
        success: true,
        text: response.text || ''
      });
    } catch (err: any) {
      const isQuota = err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED');
      return res.status(200).json({
        success: false,
        code: isQuota ? 'QUOTA_EXHAUSTED' : 'API_ERROR',
        message: isQuota 
          ? 'تم استنفاذ الحصة المجانية الحالية لمزود الذكاء الاصطناعي. يمكنك الاعتماد على المحرك الحتمي المدمج.' 
          : 'حدث خطأ أثناء التواصل مع الذكاء الاصطناعي، تم التحويل تلقائياً للمحرك الحتمي المدمج.'
      });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
