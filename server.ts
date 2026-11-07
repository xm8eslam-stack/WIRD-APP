import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import tafsirHandler from './api/tafsir';
import ruqyahHandler from './api/ruqyah';
import quranAudioHandler from './api/quran-audio';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// Keep the same read-only tafsir endpoint available in Google AI Studio/Vite
// development and in the production Express server. Register before Vite's SPA fallback.
app.all('/api/tafsir', (req: Request, res: Response) => {
  void tafsirHandler(req, res);
});

// Secure Arabic Ruqyah data proxy; the upstream API key remains server-side.
app.all('/api/ruqyah', (req: Request, res: Response) => {
  void ruqyahHandler(req, res);
});

// Read-only catalog proxy for Al Furqan's verified Quran reciter directory.
app.all('/api/quran-audio', (req: Request, res: Response) => {
  void quranAudioHandler(req, res);
});

// In-memory rate limiter for Gemini Free Tier (15 requests/minute)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 1000) {
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now >= entry.resetAt) rateLimitMap.delete(key);
    }
  }
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

// Initialize Gemini client strictly using server-side secret and Free Tier model
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

// Strict Quranic Safety System Instruction
const SYSTEM_INSTRUCTION = `أنت "المستشار القرآني" لمنصة "وِرد | WIRD" لتحفيظ ومراجعة القرآن الكريم.
مهمتك: تقديم إرشادات تربوية وتعليمية ونفسية لمساعدة الحفاظ على تثبيت القرآن وتنظيم أوقاتهم وضبط خططهم وعلاج التفلت.

القواعد القرآنية والأمنية الإلزامية:
1. لا تقم أبداً بتأليف أو اختلاق أو استنباط أي آيات قرآنية من ذاكرتك.
2. لا تعدل على أي نص قرآني.
3. لا تدعي التحقق من التجويد أو مخارج الحروف الصوتية دون وجود نظام مخصص لذلك.
4. يجب أن تستند نصائحك وإرشاداتك حصرًا إلى البيانات الفعلية للمستخدم وسياق حفظه.
5. تحدث باللغة العربية الفصحى الراقية بأسلوب مشجع وموجز ومباشر (نبرة وقورة وودودة).
6. ركز على منهجيات الحفاظ المعتمدة (مثل المراجعة قبل الحفظ، التكرار المتباعد، تثبيت المتشابهات بالضوابط، الحفظ بعد الفجر).
7. اجعل إجابتك مركزة ومختصرة في نقاط محددة وسهلة التطبيق.`;

// 1. Health and AI Availability Endpoint
app.get('/api/advisor/status', (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

  res.json({
    available: isKeyConfigured,
    model: 'gemini-3.8-flash',
    tier: 'free',
    message: isKeyConfigured
      ? 'خدمة الذكاء الاصطناعي متاحة (Gemini Free Tier)'
      : 'يعمل النظام في وضع التوصيات الحتمية المحلي (بدون استهلاك رصيد)'
  });
});

// 2. Analyze User Progress & Workload
app.post('/api/advisor/analyze', async (req: Request, res: Response): Promise<void> => {
  const clientIp = req.ip || 'global';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'تم تجاوز الحد الأقصى للطلبات المجانية (15 طلب/دقيقة). يرجى الانتظار قليلاً أو الاعتماد على المحلل الذاتي المدمج.'
    });
    return;
  }

  const { contextType, userData, query } = req.body;

  const ai = getGeminiClient();
  if (!ai) {
    res.json({
      success: false,
      code: 'KEY_MISSING',
      message: 'مفتاح الذكاء الاصطناعي غير متوفر في البيئة الحالية. يتم تشغيل المحلل الحتمي الداخلي.'
    });
    return;
  }

  // Construct structured prompt grounded strictly in anonymous learning metrics
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

  const cleanQuery = typeof query === 'string' ? query.slice(0, 500) : '';
  const userPrompt = `
نوع التحليل المطلوب: ${contextType ? String(contextType).slice(0, 30) : 'تحليل عام'}
${userContextSummary}
طلب أو استشارة الحافظ: ${cleanQuery || 'حلل أدائي القرآني وقدم لي أهم 3 نصائح عملية ومحددة لتعزيز رسوخ الحفظ وتنظيم المراجعة.'}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });

    const replyText = response.text || 'لم يتم استلام رد، استعن بنصائح التكرار المتباعد المدمجة.';
    res.json({
      success: true,
      text: replyText
    });
  } catch (error: any) {
    console.error('Gemini API call failed:', error?.message || error);
    const isQuota = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
    const isKeyIssue = error?.status === 403 || error?.status === 400 || error?.message?.includes('API_KEY');
    
    res.json({
      success: false,
      code: isQuota ? 'QUOTA_EXHAUSTED' : isKeyIssue ? 'KEY_INVALID' : 'API_ERROR',
      message: isQuota 
        ? 'تم استنفاذ الحصة المجانية الحالية لمزود الذكاء الاصطناعي. يعمل المستشار الآن في النمط الذاتي الحتمي المدمج.' 
        : 'تعذر الاتصال بمزود الذكاء الاصطناعي، تم التحويل تلقائياً للمحرك الحتمي المدمج.'
    });
  }
});

// 3. Interactive Chat Endpoint
app.post('/api/advisor/chat', async (req: Request, res: Response): Promise<void> => {
  const clientIp = req.ip || 'global';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'يرجى التمهل قليلاً بين الرسائل لتجنب تجاوز حد الطلبات المجانية.'
    });
    return;
  }

  const { message, history } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ success: false, message: 'الرسالة مطلوبة' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.json({
      success: false,
      code: 'KEY_MISSING',
      message: 'الخدمة تعمل في وضع المحلل الحتمي.'
    });
    return;
  }

  try {
    const chat = ai.chats.create({
      model: 'gemini-3.8-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });

    // Provide context if history exists
    const response = await chat.sendMessage({
      message: `سؤال المستخدم عن حفظ القرآن الكريم: ${message}`
    });

    res.json({
      success: true,
      text: response.text || ''
    });
  } catch (error: any) {
    console.error('Gemini chat error:', error?.message || error);
    const isQuota = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
    const isKeyIssue = error?.status === 403 || error?.status === 400 || error?.message?.includes('API_KEY');
    
    res.json({
      success: false,
      code: isQuota ? 'QUOTA_EXHAUSTED' : isKeyIssue ? 'KEY_INVALID' : 'API_ERROR',
      message: isQuota
        ? 'الحصة المجانية مستنفذة مؤقتاً، يعمل المستشار في النمط الذاتي الحتمي المدمج.'
        : 'تعذر الاتصال بالذكاء الاصطناعي، تم التحويل تلقائياً للمحرك الحتمي.'
    });
  }
});

// Setup Vite in Dev or Serve Static in Production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ WIRD Platform server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch(err => {
  console.error('Failed to start server:', err);
});
