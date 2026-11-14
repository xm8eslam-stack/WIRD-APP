import { DeterministicAdvisorEngine } from '../services/deterministicAdvisor';
import { AdvisorService } from '../services/advisorService';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
}

export function runGeminiSecurityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
    } catch (e: any) {
      failed++;
    }
  }

  // 1. Client bundle leakage check
  test('No GEMINI_API_KEY or process.env in src/ client files', () => {
    function scanDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.test.') && !file.includes('.spec.')) {
          results.push(fullPath);
        }
      });
      return results;
    }

    const srcFiles = scanDir(path.resolve('./src'));
    let foundKey = false;
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('process.env.GEMINI_API_KEY') || content.includes('VITE_GEMINI_API_KEY')) {
        foundKey = true;
        console.error(`Leaked in: ${file}`);
        break;
      }
    }
    assert(!foundKey, 'No Gemini API key reference may exist in client src directory');
  });

  // 2. Strict Free Tier Model identifier
  test('Serverless handler uses gemini-3.8-flash Free Tier model', () => {
    const apiAdvisorContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(apiAdvisorContent.includes("'gemini-3.8-flash'"), 'Must specify gemini-3.8-flash model identifier');
    assert(!apiAdvisorContent.includes('gemini-1.5-pro'), 'Must not reference paid pro models');
  });

  // 3. Fallback operates with 0 dependencies
  test('Deterministic Advisor works 100% offline without API key', () => {
    const answer = DeterministicAdvisorEngine.answerQuestion('كيف أثبت سورة الملك؟');
    assert(typeof answer === 'string' && answer.length > 50, 'Deterministic advisor must answer offline questions');
  });

  // 4. Rate Limiting logic exists in serverless handler
  test('api/advisor.ts has rate limiting and input size controls', () => {
    const handlerContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(handlerContent.includes('checkRateLimit'), 'api/advisor.ts must enforce rate limiting');
    assert(handlerContent.includes('4096'), 'api/advisor.ts must enforce 4KB body limit');
    assert(handlerContent.includes('500'), 'api/advisor.ts must enforce 500 char prompt limit');
  });

  // 5. CORS and memory-bounded rate limiting
  test('Public wildcard CORS does not enable credentialed cross-origin requests', () => {
    const handlerContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(handlerContent.includes("Access-Control-Allow-Origin', '*'"), 'Advisor endpoint must declare its public origin policy');
    assert(!handlerContent.includes('Access-Control-Allow-Credentials'), 'Wildcard CORS must not be combined with credential credentials');
  });

  test('In-memory rate-limit maps prune expired IP records when they grow', () => {
    const handlerContent = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    const serverContent = fs.readFileSync(path.resolve('./server.ts'), 'utf8');
    assert(handlerContent.includes('rateLimitMap.size > 1000') && handlerContent.includes('rateLimitMap.entries()'), 'Serverless advisor limiter must prune expired records');
    assert(serverContent.includes('rateLimitMap.size > 1000') && serverContent.includes('rateLimitMap.entries()'), 'Express advisor limiter must prune expired records');
  });


  test('Advisor chat API validates a bounded typed history before prompt construction', () => {
    const handler = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(handler.includes('history.length > 6'), 'Advisor history must be limited to six messages');
    assert(handler.includes('item.text.length > 400'), 'Each history message must be limited to 400 characters');
    assert(handler.includes('INVALID_HISTORY'), 'Malformed history must be rejected');
    assert(handler.includes('safeHistory.map'), 'Only normalized history may reach the model prompt');
  });

  test('Advisor chat cannot impersonate trusted assistant history from client-supplied sender labels', () => {
    const handler = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(handler.includes("let safeHistory: Array<{ text: string }> = []"), 'Normalized history must discard client-controlled sender roles');
    assert(handler.includes('text: item.text.trim()'), 'Only bounded text content may be retained from history items');
    assert(handler.includes('رسالة سابقة غير موثوقة من المستخدم: ${item.text}'), 'Every prior message must be framed as untrusted user-provided context');
    assert(!handler.includes("item.sender === 'user' ? 'المستخدم' : 'المستشار'"), 'Client history must never be rendered as an authenticated assistant message');
  });

  test('Advisor system prompt treats user content as untrusted and declines religious rulings', () => {
    const handler = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(handler.includes('لا تصدر فتوى شرعية'), 'Advisor must not issue fatwas or doctrinal rulings');
    assert(handler.includes('بيانات غير موثوقة'), 'User text and history must be treated as untrusted input');
  });

  test('Advisor client bounds message history and Vercel rewrites nested advisor routes', () => {
    const service = fs.readFileSync(path.resolve('./src/services/advisorService.ts'), 'utf8');
    const config = fs.readFileSync(path.resolve('./vercel.json'), 'utf8');
    assert(service.includes('message.slice(0, 500)'), 'Client message must be capped at 500 characters');
    assert(service.includes('history.slice(-6)'), 'Client must send only the latest six history messages');
    assert(service.includes('item.text.slice(0, 400)'), 'Client must cap each history message at 400 characters');
    assert(config.includes('/api/advisor/(.*)'), 'Nested advisor routes must be rewritten to the shared handler');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('geminiSecurity.test')) {
  console.log('=== Running Gemini Security Tests ===');
  const res = runGeminiSecurityTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
