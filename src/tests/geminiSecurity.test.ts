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

  // 5. Vercel chat route exists and preserves bounded conversation context
  test('Advisor chat endpoint is routed in production and validates conversation history', () => {
    const chatRoute = fs.readFileSync(path.resolve('./api/advisor/chat.ts'), 'utf8');
    const apiHandler = fs.readFileSync(path.resolve('./api/advisor.ts'), 'utf8');
    assert(chatRoute.includes("from '../advisor'"), 'Vercel /api/advisor/chat route must delegate to the shared advisor handler');
    assert(apiHandler.includes('INVALID_HISTORY'), 'Serverless handler must reject malformed or oversized chat history');
    assert(apiHandler.includes('safeHistory.map'), 'Serverless handler must include validated conversation context');
  });

  // 6. Local Express implementation enforces the same chat constraints
  test('Development server validates advisor chat history and request size', () => {
    const serverContent = fs.readFileSync(path.resolve('./server.ts'), 'utf8');
    assert(serverContent.includes("limit: '4kb'"), 'Development server body parser must enforce the 4KB limit');
    assert(serverContent.includes('INVALID_HISTORY'), 'Development server must validate chat history');
    assert(serverContent.includes('conversationContext'), 'Development server must preserve chat context');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('geminiSecurity.test')) {
  console.log('=== Running Gemini Security Tests ===');
  const res = runGeminiSecurityTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
