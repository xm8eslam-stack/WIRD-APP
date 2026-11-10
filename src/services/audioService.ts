import { ReciterId, ReciterInfo } from '../types/quran';

export const RECITERS: ReciterInfo[] = [
  { id: 'alafasy', name: 'الشيخ مشاري راشد العفاسي', identifier: 'Alafasy_128kbps', subfolder: 'Alafasy_128kbps' },
  { id: 'husary', name: 'الشيخ محمود خليل الحصري (مرتل)', identifier: 'Husary_128kbps', subfolder: 'Husary_128kbps' },
  { id: 'minshawi', name: 'الشيخ محمد صديق المنشاوي (مرتل)', identifier: 'Minshawy_Murattal_128kbps', subfolder: 'Minshawy_Murattal_128kbps' },
  { id: 'abdulbasit', name: 'الشيخ عبد الباسط عبد الصمد (مرتل)', identifier: 'Abdul_Basit_Murattal_192kbps', subfolder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'ghamdi', name: 'الشيخ سعد الغامدي', identifier: 'Ghamadi_40kbps', subfolder: 'Ghamadi_40kbps' },
];

export function formatAyahAudioUrl(surahNumber: number, ayahNumberInSurah: number, reciterId: ReciterId = 'alafasy'): string {
  const reciter = RECITERS.find(r => r.id === reciterId) || RECITERS[0];
  const s = String(surahNumber).padStart(3, '0');
  const a = String(ayahNumberInSurah).padStart(3, '0');
  return `https://everyayah.com/data/${reciter.subfolder}/${s}${a}.mp3`;
}

/**
 * Ask the active service worker to persist the next short recitation segment.
 * This is opportunistic: playback never waits for caching, and the worker
 * applies its own strict host/path allowlist and bounded cache policy.
 */
export function requestOfflineAudioCache(urls: string[]): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const safeUrls = urls.slice(0, 20).filter(rawUrl => {
    try {
      const url = new URL(rawUrl);
      return url.protocol === 'https:' && !url.search && !url.hash &&
        ((url.hostname === 'everyayah.com' &&
          /^\/data\/(Alafasy_128kbps|Husary_128kbps|Minshawy_Murattal_128kbps|Abdul_Basit_Murattal_192kbps|Ghamadi_40kbps)\/[0-9]{6}\.mp3$/.test(url.pathname)) ||
         (url.hostname === 'cdn.islamic.network' &&
          /^\/quran\/audio\/(64|128|192)\/(ar\.husary|ar\.minshawi|ar\.abdulbasitmurattal|ar\.abdurrahmaansudais|ar\.saoodshuraym|ar\.ahmedajamy|ar\.alafasy)\/[1-6][0-9]{0,3}\.mp3$/.test(url.pathname)));
    } catch {
      return false;
    }
  });
  if (!safeUrls.length) return;
  navigator.serviceWorker.ready
    .then(registration => {
      const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
      worker?.postMessage({ type: 'WIRD_CACHE_SESSION_AUDIO', urls: safeUrls });
    })
    .catch(error => console.warn('[WIRD Audio] Offline audio pre-cache unavailable:', error));
}
