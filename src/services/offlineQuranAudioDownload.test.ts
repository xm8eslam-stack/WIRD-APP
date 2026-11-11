import { buildQuranAudioDownloadPlan } from './offlineQuranAudioDownload';

export function runOfflineQuranAudioDownloadTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ [PASS]: ' + name); }
    catch (error) { failed++; console.error('  ❌ [FAIL]: ' + name + ' - ' + (error instanceof Error ? error.message : error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('builds the exact seven-ayah Al-Fatihah download range from canonical metadata', () => {
    const plan = buildQuranAudioDownloadPlan({ reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 7 });
    assert(plan.totalAyahs === 7 && plan.items.length === 7, 'The plan must contain exactly seven ayahs.');
    assert(plan.items[0].globalAyahNumber === 1 && plan.items[0].url.endsWith('/ar.alafasy/1.mp3'), 'The first Fatiha ayah must map to global ayah 1.');
    assert(plan.items[6].globalAyahNumber === 7 && plan.items[6].url.endsWith('/ar.alafasy/7.mp3'), 'The final Fatiha ayah must map to global ayah 7.');
  });

  test('maps a partial Al-Baqarah range to canonical global ayah coordinates', () => {
    const plan = buildQuranAudioDownloadPlan({ reciterId: 'ar.husary', surahNumber: 2, startAyah: 2, endAyah: 4 });
    assert(plan.totalAyahs === 3, 'Only the selected three ayahs may be included.');
    assert(plan.items[0].globalAyahNumber === 9 && plan.items[2].globalAyahNumber === 11, 'Al-Baqarah 2:2–4 must map to global ayahs 9–11.');
    assert(plan.items.every(item => item.url.startsWith('https://cdn.islamic.network/quran/audio/128/ar.husary/')), 'Every generated URL must use the reviewed HTTPS provider and edition.');
  });

  test('allows the last canonical Quran ayah and bounds the final global number at 6236', () => {
    const plan = buildQuranAudioDownloadPlan({ reciterId: 'ar.sudais', surahNumber: 114, startAyah: 6, endAyah: 6 });
    assert(plan.items[0].globalAyahNumber === 6236, 'An-Nas 114:6 must map to global ayah 6236.');
  });

  test('rejects invalid surahs, reversed ranges, and ayahs beyond the selected surah', () => {
    const invalid = [
      { reciterId: 'ar.alafasy', surahNumber: 0, startAyah: 1, endAyah: 1 },
      { reciterId: 'ar.alafasy', surahNumber: 115, startAyah: 1, endAyah: 1 },
      { reciterId: 'ar.alafasy', surahNumber: 2, startAyah: 5, endAyah: 4 },
      { reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 8 },
      { reciterId: 'ar.alafasy', surahNumber: 2, startAyah: 0, endAyah: 1 },
      { reciterId: 'ar.alafasy', surahNumber: 2, startAyah: 1.5, endAyah: 2 }
    ];
    for (const request of invalid) {
      let rejected = false;
      try { buildQuranAudioDownloadPlan(request); } catch { rejected = true; }
      assert(rejected, 'Invalid range must be rejected: ' + JSON.stringify(request));
    }
  });

  test('rejects unreviewed reciters before producing any download URL', () => {
    let rejected = false;
    try { buildQuranAudioDownloadPlan({ reciterId: 'unreviewed-reciter', surahNumber: 1, startAyah: 1, endAyah: 1 }); }
    catch { rejected = true; }
    assert(rejected, 'An unreviewed reciter must never enter the download plan.');
  });

  return { passed, failed };
}
