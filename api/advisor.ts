import { GoogleGenAI } from '@google/genai';

// In-memory sliding-window rate limiter for serverless instance (15 req/min per IP)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (record.count >= 15) {
    return false;
  }
  record.count += 1;
  return true;
}

const SYSTEM_INSTRUCTION = `أنت "المستشار القرآني" لمنصة "وِرد | WIRD" لتحفيظ ومراجعة القرآن الكريم.
مهمتك: تقديم إرشادات تربوية وتعليمية ونفسية لمساعدة الحفاظ على تثبيت القرآن وتنظيم أوقاتهم وضبط خططهم وعلاج التفلت.

القواعد القرآنية والأمنية الإلزامية:
1. لا تقم أبداً بتأليف أو اختلاق أو استنباط أي آيات قرآنية من ذاكرتك.
2. لا تعدل على أي نص قرآني.
3. لا تدعي التحقق من التجويد أو مخارج الحروف الصوتية دون وجود نظام مخصص لذلك.
4. يجب أن تستند نصائحك وإرشاداتك حصرًا إلى المقاييس والبيانات الفعلية للمستخدم وسياق حفظه دون اختلاق تقدم وهمي.
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

const ALLOWED_PAYLOAD_KEYS = new Set(['contextType', 'userData', 'query', 'message', 'history']);

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = req.url || '';
  const clientIp = req.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() || 
                   req.socket?.remoteAddress || 
                   'global';

  // 1. GET /api/advisor/status
  if (req.method === 'GET' || path.includes('/status')) {
    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

    return res.status(200).json({
      available: isKeyConfigured,
      status: isKeyConfigured ? 'CONFIGURED_OPERATIONAL' : 'KEY_MISSING',
      model: 'gemini-3.8-flash',
      tier: 'free',
      quotaExhausted: false,
      message: isKeyConfigured 
        ? 'خدمة الذكاء الاصطناعي مهيأة وتعمل وفق Gemini Free Tier' 
        : 'يعمل النظام في وضع التوصيات الحتمية المحلي (بدون استهلاك رصيد أو مفاتيح)'
    });
  }

  // 2. POST /api/advisor/analyze or /api/advisor/chat
  if (req.method === 'POST') {
    // Rate Limiting Enforcement
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'تم تجاوز الحد الأقصى للطلبات المجانية (15 طلب في الدقيقة). يرجى التمهل أو الاعتماد على المحلل الحتمي المدمج.'
      });
    }

    // Input Size Limits & Whitelist Validation
    const body = req.body || {};
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 4096) {
      return res.status(400).json({
        success: false,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'حجم الطلب يتجاوز الحد المسموح به (الحد الأقصى 4 كيلوبايت).'
      });
    }

    const payloadKeys = Object.keys(body);
    const hasInvalidKey = payloadKeys.some(k => !ALLOWED_PAYLOAD_KEYS.has(k));
    if (hasInvalidKey) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PAYLOAD',
        message: 'الطلب يتضمن حقولاً غير مسموح بها.'
      });
    }

    const { contextType, userData, query, message } = body;
    const promptText = String(message || query || '').trim();
    if (promptText.length > 500) {
      return res.status(400).json({
        success: false,
        code: 'INPUT_TOO_LONG',
        message: 'النص المدخل طويل جداً (الحد الأقصى 500 حرف).'
      });
    }

    // Server-Side Client Validation
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({
        success: false,
        code: 'KEY_MISSING',
        message: 'مفتاح الذكاء الاصطناعي غير متوفر في متغيرات البيئة. يعمل النظام تلقائياً بالمحلل الحتمي الداخلي.'
      });
    }

    // Sanitize userData: Strictly reject PII (name, email) and format anonymous learning metrics
    let userContextSummary = '';
    if (userData && typeof userData === 'object') {
      const memorizedCount = Number(userData.memorizedAyahsCount) || 0;
      const weakCount = Number(userData.weakVersesCount) || 0;
      const retentionScore = Number(userData.retentionScore) || 0;
      const dueCount = Number(userData.dueRevisionsCount) || 0;
      const safeGoal = typeof userData.goal === 'string' ? userData.goal.slice(0, 80) : 'حفظ وإتقان القرآن';
      const safePlan = typeof userData.activePlanTitle === 'string' ? userData.activePlanTitle.slice(0, 50) : 'خطة الحفظ الحالية';

      userContextSummary = `
[المؤشرات الرقمية لتقدم الحافظ]:
- الهدف القرآني: ${safeGoal}
- الخطة الحالية: ${safePlan}
- عدد الآيات المنجزة: ${memorizedCount} آية
- الآيات المتعثرة الملتبسة: ${weakCount} آيات
- مؤشر جودة الرسوخ: %${retentionScore}
- المقاطع المستحقة للمراجعة اليوم: ${dueCount} مقطع
`;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${userContextSummary}\nنوع الطلب: ${contextType ? String(contextType).slice(0, 30) : 'استشارة منهجية'}\nالسؤال: ${promptText || 'قدم نصائح منهجية لتعزيز رسوخ الحفظ وتنظيم المراجعة.'}`,
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
          ? 'تم استنفاذ الحصة المجانية الحالية لمزود الذكاء الاصطناعي (Quota Exhausted). يمكنك الاعتماد الكامل على المحرك الحتمي المدمج.' 
          : 'تعذر الاتصال بمزود الذكاء الاصطناعي، تم التحويل تلقائياً للمحرك الحتمي المدمج.'
      });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
