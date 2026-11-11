import { formatAyahAudioUrl, RECITERS } from './audioService';

export function runAudioServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    }
  }

  test('formatAyahAudioUrl generates valid EveryAyah streaming URLs for all configured reciters', () => {
    RECITERS.forEach(reciter => {
      const url = formatAyahAudioUrl(1, 1, reciter.id);
      if (!url.startsWith('https://everyayah.com/data/')) throw new Error('Unexpected streaming provider URL');
      if (!url.endsWith('/001001.mp3')) throw new Error('Unexpected ayah filename');
      if (!url.includes(reciter.subfolder)) throw new Error('Reciter folder mismatch');
    });
  });

  test('offline session-cache helper is restricted to the reviewed Quran CDN', () => {
    const fs = require('fs');
    const source = fs.readFileSync('./src/services/audioService.ts', 'utf8');
    const helper = source.split('export function requestOfflineAudioCache')[1] || '';
    if (!helper.includes("url.hostname === 'cdn.islamic.network'")) throw new Error('Reviewed Quran CDN allowlist is missing');
    if (helper.includes("url.hostname === 'everyayah.com'")) throw new Error('EveryAyah must remain stream-only');
    if (!helper.includes('urls.slice(0, 20)')) throw new Error('Session pre-cache must remain bounded');
  });

  return { passed, failed };
}

export function runAudioServiceOfflineCacheTests(): { passed: number; failed: number } {
  return runAudioServiceTests();
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('audioService.test')) {
  const res = runAudioServiceTests();
  if (res.failed > 0) process.exit(1);
}
