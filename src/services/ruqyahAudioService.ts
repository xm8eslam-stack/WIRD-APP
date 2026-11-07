export interface QuranReciter {
  id: string;
  name: string;
  arabicName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function fetchQuranReciters(signal?: AbortSignal): Promise<QuranReciter[]> {
  let response: Response;
  try {
    response = await fetch('/api/quran-audio?type=reciters', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new Error('تعذر تحميل قائمة القراء الصوتية.');
  }
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  if (raw.trim().startsWith('<') || /text\/html/i.test(contentType)) {
    throw new Error('أعاد مصدر القراء صفحة HTML بدل JSON.');
  }
  if (!response.ok || !/application\/(?:[a-z0-9.+-]*\+)?json/i.test(contentType)) {
    throw new Error('تعذر تحميل قائمة القراء (HTTP ' + response.status + ').');
  }
  let payload: unknown;
  try { payload = JSON.parse(raw) as unknown; }
  catch { throw new Error('بيانات قائمة القراء غير صالحة.'); }
  if (!isRecord(payload) || !Array.isArray(payload.reciters)) {
    throw new Error('استجابة قائمة القراء لا تطابق البنية المتوقعة.');
  }
  const reciters = payload.reciters;
  if (reciters.length < 1 || reciters.length > 100 || reciters.some(item =>
    !isRecord(item) ||
    typeof item.id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(item.id) ||
    typeof item.name !== 'string' || !item.name.trim() ||
    typeof item.arabicName !== 'string' || !item.arabicName.trim()
  )) throw new Error('تحتوي قائمة القراء على بيانات غير صالحة.');
  return reciters as QuranReciter[];
}

export function buildQuranAyahAudioUrl(reciterId: string, globalAyahNumber: number): string {
  if (!/^[a-z0-9-]{2,80}$/.test(reciterId) ||
      !Number.isInteger(globalAyahNumber) || globalAyahNumber < 1 || globalAyahNumber > 6236) {
    throw new Error('بيانات تشغيل الآية الصوتية غير صالحة.');
  }
  return 'https://alfurqan.online/api/v1/audio/' +
    encodeURIComponent(reciterId) + '/' + String(globalAyahNumber);
}
