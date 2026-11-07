export type RuqyahApiProgram = 'brief-ruqya' | 'a-medium-ruqya' | 'a-long-ruqya';
export type RuqyahApiSource = 'from-quran' | 'from-sunnah';

export interface RuqyahApiEntry {
  id: number | string;
  title: string;
  arabic: string;
  reference?: string;
  introduction?: string;
  translation?: string;
  category?: string;
  sub_category?: string;
}

export interface RuqyahApiRequest {
  type: 'instant-category' | 'instant' | 'topic-category' | 'topic';
  program?: RuqyahApiProgram;
  source?: RuqyahApiSource;
  topic?: string;
  id?: number;
  random?: boolean;
}

import { getRuqyahDisplayText } from './ruqyahContentService';
import type { RuqyahItem } from '../data/ruqyahData';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Fetch Arabic Ruqyah data through WIRD's server proxy; never expose upstream secrets. */
export async function fetchRuqyahApiData<T = unknown>(
  request: RuqyahApiRequest,
  signal?: AbortSignal
): Promise<T> {
  const params = new URLSearchParams({ type: request.type, lang: 'ar' });
  if (request.program) params.set('program', request.program);
  if (request.source) params.set('source', request.source);
  if (request.topic) params.set('topic', request.topic);
  if (request.id !== undefined) params.set('id', String(request.id));
  if (request.random !== undefined) params.set('random', String(request.random));

  let response: Response;
  try {
    response = await fetch('/api/ruqyah?' + params.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new Error('تعذر الاتصال بمصدر الرقية. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
  }

  let raw: string;
  try { raw = await response.text(); }
  catch { throw new Error('تعذر قراءة استجابة مصدر الرقية.'); }

  const contentType = response.headers.get('content-type') || '';
  if (raw.trim().startsWith('<') || /text\/html/i.test(contentType)) {
    throw new Error('أعاد خادم الرقية صفحة HTML بدل بيانات JSON؛ لم يتم عرض محتوى غير موثوق.');
  }
  if (!response.ok) {
    const payload = (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : '';
    if (response.status === 503 && code === 'RUQYAH_API_KEY_NOT_CONFIGURED') {
      throw new Error('مصدر الرقية الخارجي يحتاج إلى ضبط مفتاحه المجاني في إعدادات الخادم.');
    }
    if (response.status === 429) throw new Error('تم تجاوز حد طلبات مصدر الرقية مؤقتًا. حاول بعد قليل.');
    throw new Error('تعذر جلب محتوى الرقية من المصدر الخارجي (HTTP ' + response.status + ').');
  }
  if (!/application\/(?:[a-z0-9.+-]*\+)?json/i.test(contentType)) {
    throw new Error('استجابة مصدر الرقية ليست بصيغة JSON صالحة.');
  }

  let payload: unknown;
  try { payload = JSON.parse(raw) as unknown; }
  catch { throw new Error('أعاد مصدر الرقية بيانات JSON غير صالحة.'); }
  if (!isRecord(payload) || payload.status !== 'success' || !('data' in payload)) {
    throw new Error('استجابة مصدر الرقية لا تطابق البنية المتوقعة.');
  }
  return payload.data as T;
}


/**
 * API Quran titles carry a numeric surah:ayah reference. Use that reference
 * to render from WIRD's canonical Quran corpus instead of trusting a second
 * independently supplied Quran text string.
 */
export function resolveApiQuranEntryText(entry: RuqyahApiEntry): string {
  if (!entry || typeof entry.title !== 'string') {
    throw new Error('لا يحتوي عنصر الرقية الخارجي على عنوان صالح.');
  }
  const match = entry.title.match(/(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/);
  if (!match) {
    throw new Error('تعذر تحديد موضع الآيات في المصحف من مرجع المصدر الخارجي.');
  }
  const surahNumber = Number(match[1]);
  const start = Number(match[2]);
  const end = match[3] === undefined ? start : Number(match[3]);
  const item: RuqyahItem = {
    id: 'external-ruqyah-' + String(entry.id),
    categories: ['brief'],
    type: 'quran',
    title: entry.title,
    surahNumber,
    verseRange: start === end ? String(start) : start + '-' + end,
    text: entry.arabic || '',
    repeatTarget: 1,
    source: 'IslamicAPI'
  };
  return getRuqyahDisplayText(item);
}
