import { readFileSync } from 'node:fs';

const viewSource = readFileSync(new URL('../components/ruqyah/RuqyahView.tsx', import.meta.url), 'utf8');

export function runRuqyahViewAudioLockTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, condition: boolean) => {
    if (condition) {
      passed++;
      console.log('  ✅ ' + name);
    } else {
      failed++;
      console.error('  ❌ ' + name);
    }
  };

  test(
    'Ruqyah uses one managed HTML audio instance with event cleanup',
    (viewSource.match(/new Audio\(\)/g) || []).length === 1 &&
      viewSource.includes("audio.removeEventListener('ended', handleEnded)") &&
      viewSource.includes("audio.removeAttribute('src')")
  );
  test(
    'Quran playback uses the canonical local ayah queue and fixed approved CDN builder',
    viewSource.includes('getRuqyahAudioQueueForItems(targetItems)') &&
      viewSource.includes('buildQuranAyahAudioUrl(selectedReciterIdRef.current, entry.globalAyahNumber)')
  );
  const audioStart = viewSource.indexOf('const startRuqyahAudio');
  const audioEnd = viewSource.indexOf('const stopRuqyahAudio', audioStart);
  test(
    'Audio queue does not automatically increment reading progress',
    audioStart >= 0 && audioEnd > audioStart && !viewSource.slice(audioStart, audioEnd).includes('setCounts(')
  );
  test(
    'Individual Quran cards expose active play/pause controls',
    viewSource.includes('onClick={() => toggleItemAudio(item)}') &&
      viewSource.includes('استمع للآيات') &&
      !viewSource.includes('الصوت قيد التحقق')
  );
  test(
    'Section playlist, reciter selection, volume, seek, and stop controls are present',
    viewSource.includes('تشغيل آيات القسم') &&
      viewSource.includes('اختيار قارئ الرقية') &&
      viewSource.includes('موضع التلاوة الصوتية') &&
      viewSource.includes('مستوى صوت التلاوة') &&
      viewSource.includes('stopRuqyahAudio')
  );
  test(
    'Unverified full-program recordings are not exposed as playable controls',
    !viewSource.includes('التسجيل الكامل (قيد التحقق)') &&
      viewSource.includes('المتاح هنا تلاوة الآيات القرآنية فقط، وليس تسجيلًا كاملًا يضم الأدعية') &&
      viewSource.includes('التسجيلات الكاملة التي تتضمن الأدعية لا تزال قيد التحقق.')
  );
  test(
    'Playback errors never silently switch to another source',
    viewSource.includes('لم يتم استبداله بتسجيل من مصدر آخر')
  );

  test(
    'Ruqyah Quran cards resolve asynchronously with explicit loading and fail-closed error states',
    viewSource.includes('getRuqyahAyahs(candidate)') &&
      viewSource.includes('quranLoadingItems[item.id]') &&
      viewSource.includes('quranErrors[item.id]') &&
      viewSource.includes('quranAyahsByItem[item.id]') &&
      !viewSource.includes('getRuqyahAyahs(item).map')
  );
  test(
    'Failed local Quran chunks expose an online-aware retry without external text fallback',
    viewSource.includes('quranRetryNonce') &&
      viewSource.includes('[activeCategory, quranRetryNonce]') &&
      viewSource.includes('setQuranRetryNonce(value => value + 1)') &&
      viewSource.includes("addEventListener('offline'") &&
      viewSource.includes("addEventListener('online'") &&
      viewSource.includes('disabled={!isOnline}') &&
      viewSource.includes('إعادة المحاولة') &&
      !viewSource.includes('verifiedAyahs')
  );
  test(
    'Category changes and unmount invalidate pending Quran/audio requests',
    viewSource.includes('let active = true') &&
      viewSource.includes('if (active) setQuranAyahsByItem') &&
      viewSource.includes('audioBuildRequestIdRef.current += 1') &&
      viewSource.includes('if (buildRequestId !== audioBuildRequestIdRef.current) return')
  );
  test(
    'Changing Ruqyah category stops the current audio source and clears its playlist',
    viewSource.includes('setAudioQueueLength(0)') &&
      viewSource.includes('audio.pause()') &&
      viewSource.includes("audio.removeAttribute('src')") &&
      viewSource.includes('audioQueueIndexRef.current = 0')
  );
  test(
    'Audio queue is awaited before replacing the active queue and preserves async request ordering',
    viewSource.includes('await getRuqyahAudioQueueForItems(targetItems)') &&
      viewSource.includes('getRuqyahAudioQueueForItems') &&
      viewSource.includes('if (buildRequestId !== audioBuildRequestIdRef.current) return')
  );
  test(
    'Starting a new queue cancels prior audio before asynchronous Quran resolution',
    viewSource.includes('audioRequestIdRef.current += 1;') &&
      viewSource.includes('previousAudio.pause()') &&
      viewSource.includes('previousAudio.removeAttribute(\'src\')') &&
      viewSource.includes('await getRuqyahAudioQueueForItems(targetItems)')
  );

  test(
    'Requested Quran ayahs use eager buffering only after an explicit playback request',
    viewSource.includes("audio.preload = 'auto'") &&
      viewSource.includes('audio.src = buildQuranAyahAudioUrl') &&
      viewSource.includes('audio.load();')
  );

  return { passed, failed };
}
