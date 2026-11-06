import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.WIRD_SMOKE_PORT || 4179);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn('npm', ['run', 'start'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    GEMINI_API_KEY: ''
  },
  stdio: 'inherit'
});

let exited = false;
let exitCode = null;
server.on('exit', code => {
  exited = true;
  exitCode = code;
});

try {
  const deadline = Date.now() + 20_000;
  let response = null;
  let lastError = 'server did not become ready';

  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`Production server exited before becoming ready (code ${exitCode}).`);
    }

    try {
      response = await fetch(`${baseUrl}/api/advisor/status`, {
        signal: AbortSignal.timeout(2_000)
      });
      if (response.ok) break;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await delay(250);
  }

  if (!response?.ok) {
    throw new Error(`Production server smoke test failed: ${lastError}`);
  }

  const payload = await response.json();
  if (payload.available !== false || payload.tier !== 'free') {
    throw new Error('Advisor status did not return the expected no-key/free fallback state.');
  }

  const tafsirResponse = await fetch(`${baseUrl}/api/tafsir?surah=115&ayah=1`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(2_000)
  });
  const tafsirContentType = tafsirResponse.headers.get('content-type') || '';
  const tafsirPayload = await tafsirResponse.json();
  if (tafsirResponse.status !== 400 || !tafsirContentType.includes('application/json') || tafsirPayload.error !== 'INVALID_QURAN_COORDINATES') {
    throw new Error('Tafsir API route did not return the expected JSON validation response.');
  }

  console.log('Production server smoke test passed: advisor and tafsir API routes responded with JSON.');
} finally {
  if (!exited) {
    server.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => server.once('exit', resolve)),
      delay(3_000)
    ]);
    if (!exited) server.kill('SIGKILL');
  }
}
