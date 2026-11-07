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
    'Ruqyah view does not instantiate audio or invoke browser playback',
    !viewSource.includes('new Audio(') && !/\.play\s*\(/.test(viewSource)
  );
  test(
    'Ruqyah view contains no legacy audio player state or handlers',
    !/audio_stream|audioStreamRef|audioVerseRef|handleToggleStream|handleToggleVerseAudio|sleepTimerMinutes/.test(viewSource)
  );
  test(
    'Full-program audio mode remains visibly disabled pending source and rights review',
    /disabled[\s\S]{0,180}title="سيُتاح بعد التحقق/.test(viewSource) &&
      viewSource.includes('التسجيل الكامل (قيد التحقق)')
  );
  test(
    'Individual Quran audio controls remain disabled and explicitly labelled',
    /disabled[\s\S]{0,600}الصوت قيد التحقق/.test(viewSource)
  );
  test(
    'The rendered view exposes only interactive reading and the Quran locator library',
    /useState<'interactive' \| 'api_library'>\('interactive'\)/.test(viewSource) &&
      !viewSource.includes("setViewMode('audio_stream')")
  );

  return { passed, failed };
}
