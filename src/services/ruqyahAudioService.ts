export interface QuranReciter {
  id: string;
  name: string;
  arabicName: string;
  style?: string;
  bitrate: 128 | 192;
}

export const QURAN_AUDIO_PROVIDER = {
  name: 'Al Quran Cloud',
  termsUrl: 'https://alquran.cloud/terms-and-conditions',
  cdnDocsUrl: 'https://alquran.cloud/cdn',
  audioCdnBaseUrl: 'https://cdn.islamic.network/quran/audio'
} as const;

/**
 * Curated recitation editions listed in Al Quran Cloud's official CDN documentation.
 * Their terms describe recitations as licensed by the reciters or their estates for
 * streaming/embedding and educational use. Do not add dynamic or unreviewed IDs here.
 */
export const FALLBACK_QURAN_RECITERS: QuranReciter[] = [
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري', style: 'Murattal', bitrate: 128 },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq al-Minshawi', arabicName: 'محمد صديق المنشاوي', style: 'Murattal', bitrate: 128 },
  { id: 'ar.abdulbasit', name: 'Abdul Basit Abdul Samad', arabicName: 'عبد الباسط عبد الصمد', style: 'Murattal', bitrate: 192 },
  { id: 'ar.sudais', name: 'Abdul Rahman Al-Sudais', arabicName: 'عبدالرحمن السديس', style: 'Murattal', bitrate: 192 },
  { id: 'ar.shuraim', name: 'Saud Al-Shuraim', arabicName: 'سعود الشريم', style: 'Murattal', bitrate: 128 },
  { id: 'ar.ajamy', name: 'Ahmed ibn Ali al-Ajamy', arabicName: 'أحمد بن علي العجمي', style: 'Murattal', bitrate: 128 },
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي', style: 'Murattal', bitrate: 128 }
];

const APPROVED_RECITER_IDS = new Set(FALLBACK_QURAN_RECITERS.map(reciter => reciter.id));

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

  if (!isRecord(payload) || payload.provider !== QURAN_AUDIO_PROVIDER.name ||
      !Array.isArray(payload.reciters) || payload.reciters.length !== FALLBACK_QURAN_RECITERS.length) {
    throw new Error('استجابة قائمة القراء لا تطابق سجل المصادر المعتمد.');
  }

  const seen = new Set<string>();
  const reciters = payload.reciters;
  if (reciters.some(item => {
    if (!isRecord(item) || typeof item.id !== 'string' || !APPROVED_RECITER_IDS.has(item.id) || seen.has(item.id)) {
      return true;
    }
    const expected = FALLBACK_QURAN_RECITERS.find(reciter => reciter.id === item.id);
    return !expected ||
      item.name !== expected.name ||
      item.arabicName !== expected.arabicName ||
      item.style !== expected.style ||
      item.bitrate !== expected.bitrate;
  })) {
    throw new Error('تحتوي قائمة القراء على مصدر أو بيانات غير معتمدة.');
  }
  for (const item of reciters as QuranReciter[]) seen.add(item.id);
  if (seen.size !== APPROVED_RECITER_IDS.size) {
    throw new Error('قائمة القراء لا تحتوي على جميع المصادر المعتمدة.');
  }
  return reciters as QuranReciter[];
}

export function buildQuranAyahAudioUrl(reciterId: string, globalAyahNumber: number): string {
  if (typeof reciterId !== 'string' || !APPROVED_RECITER_IDS.has(reciterId) ||
      !Number.isSafeInteger(globalAyahNumber) || globalAyahNumber < 1 || globalAyahNumber > 6236) {
    throw new Error('بيانات تشغيل الآية الصوتية غير صالحة أو غير معتمدة.');
  }
  const reciter = FALLBACK_QURAN_RECITERS.find(candidate => candidate.id === reciterId);
  if (!reciter) throw new Error('القارئ الصوتي غير موجود في قائمة المصادر المعتمدة.');
  return QURAN_AUDIO_PROVIDER.audioCdnBaseUrl + '/' + reciter.bitrate + '/' + reciterId + '/' + String(globalAyahNumber) + '.mp3';
}
