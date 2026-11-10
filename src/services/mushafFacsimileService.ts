export const MUSHAF_FACSIMILE_VERSION = 'v1.1.1';
export const MUSHAF_FACSIMILE_EDITION = 'hafs-kfqc';
const MUSHAF_FACSIMILE_BASE_URL = `https://cdn.quran.ws/svg/pages/${MUSHAF_FACSIMILE_VERSION}/${MUSHAF_FACSIMILE_EDITION}`;

export interface MushafViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
  raw: string;
}

export interface MushafAyahArea {
  surahNumber: number;
  ayahNumber: number;
  x: number;
  y: number;
  polygon: string;
}

export interface MushafFacsimilePageData {
  page: number;
  svgUrl: string;
  viewBox: MushafViewBox;
  ayahAreas: MushafAyahArea[];
}

export interface MushafLocalAyahCoordinate {
  surahNumber: number;
  numberInSurah: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getMushafFacsimilePageUrls(page: number): { svgUrl: string; jsonUrl: string } {
  if (!Number.isInteger(page) || page < 1 || page > 604) {
    throw new Error('رقم صفحة المصحف غير صالح.');
  }
  const filename = String(page).padStart(3, '0');
  return {
    svgUrl: `${MUSHAF_FACSIMILE_BASE_URL}/svg/${filename}.svg`,
    jsonUrl: `${MUSHAF_FACSIMILE_BASE_URL}/json/${filename}.json`
  };
}

export function parseMushafViewBox(svgMarkup: string): MushafViewBox {
  if (typeof svgMarkup !== 'string' || svgMarkup.length < 100 || svgMarkup.length > 2_000_000) {
    throw new Error('ملف رسم صفحة المصحف غير صالح أو يتجاوز الحد الآمن.');
  }
  const root = svgMarkup.match(/<svg\\b[^>]*>/i)?.[0];
  if (!root || !/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(root)) {
    throw new Error('تعذر التحقق من صيغة رسم صفحة المصحف.');
  }
  const raw = root.match(/\\bviewBox=["']([^"']+)["']/i)?.[1];
  if (!raw) throw new Error('ملف صفحة المصحف لا يحدد مساحة العرض.');
  const values = raw.trim().split(/[\\s,]+/).map(Number);
  if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
    throw new Error('أبعاد صفحة المصحف غير صالحة.');
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3], raw: raw.trim() };
}

function validatePolygon(polygon: string, viewBox: MushafViewBox): boolean {
  if (typeof polygon !== 'string' || polygon.length > 20000) return false;
  const values = polygon.trim().split(/[\\s,]+/).map(Number);
  if (values.length < 6 || values.length % 2 !== 0 || !values.every(Number.isFinite)) return false;
  const tolerance = Math.max(viewBox.width, viewBox.height) * 0.02;
  for (let i = 0; i < values.length; i += 2) {
    const x = values[i];
    const y = values[i + 1];
    if (x < viewBox.x - tolerance || x > viewBox.x + viewBox.width + tolerance ||
        y < viewBox.y - tolerance || y > viewBox.y + viewBox.height + tolerance) return false;
  }
  return true;
}

export function parseMushafAyahAreas(
  raw: unknown,
  viewBox: MushafViewBox
): MushafAyahArea[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) {
    throw new Error('فهرس مواضع الآيات في الصفحة غير مكتمل.');
  }
  const seen = new Set<string>();
  return raw.map((item: any) => {
    if (!item || !Number.isInteger(item.surahNumber) || item.surahNumber < 1 || item.surahNumber > 114 ||
        !Number.isInteger(item.ayahNumber) || item.ayahNumber < 1 ||
        !isFiniteNumber(item.x) || !isFiniteNumber(item.y) ||
        !validatePolygon(item.polygon, viewBox)) {
      throw new Error('تحتوي صفحة المصحف على موضع آية غير صالح.');
    }
    const key = `${item.surahNumber}:${item.ayahNumber}`;
    if (seen.has(key)) throw new Error('تكرر موضع الآية داخل فهرس الصفحة.');
    seen.add(key);
    return {
      surahNumber: item.surahNumber,
      ayahNumber: item.ayahNumber,
      x: item.x,
      y: item.y,
      polygon: item.polygon
    };
  });
}

/**
 * Page artwork and ayah polygons are display geometry only. This exact-coordinate
 * join keeps all Quran text, audio, tafsir, and progress bound to WIRD's local corpus.
 */
export function matchMushafAyahAreas<T extends MushafLocalAyahCoordinate>(
  areas: MushafAyahArea[],
  localAyahs: T[]
): Array<{ area: MushafAyahArea; ayah: T }> {
  const local = new Map(localAyahs.map(ayah => [`${ayah.surahNumber}:${ayah.numberInSurah}`, ayah]));
  if (local.size !== localAyahs.length || local.size !== areas.length) {
    throw new Error('عدد الآيات في تخطيط الصفحة لا يطابق نص وِرد المحلي.');
  }
  const matched = areas.map(area => {
    const ayah = local.get(`${area.surahNumber}:${area.ayahNumber}`);
    if (!ayah) throw new Error('إحداثيات تخطيط المصحف لا تطابق آيات الصفحة في وِرد.');
    return { area, ayah };
  });
  if (new Set(matched.map(item => item.ayah)).size !== localAyahs.length) {
    throw new Error('تعذر مطابقة جميع آيات الصفحة دون تكرار.');
  }
  return matched;
}

export async function loadMushafFacsimilePage(
  page: number,
  signal?: AbortSignal
): Promise<MushafFacsimilePageData> {
  const { svgUrl, jsonUrl } = getMushafFacsimilePageUrls(page);
  const [svgResponse, jsonResponse] = await Promise.all([
    fetch(svgUrl, { signal, mode: 'cors', credentials: 'omit' }),
    fetch(jsonUrl, { signal, mode: 'cors', credentials: 'omit', headers: { Accept: 'application/json' } })
  ]);
  if (!svgResponse.ok || !jsonResponse.ok) {
    throw new Error('تعذر تحميل بيانات الصفحة المطبوعة؛ يمكنك متابعة القراءة بالعرض المرن.');
  }
  const svgType = (svgResponse.headers.get('content-type') || '').toLowerCase();
  const jsonType = (jsonResponse.headers.get('content-type') || '').toLowerCase();
  if (!svgType.includes('image/svg+xml') || !jsonType.includes('application/json')) {
    throw new Error('نوع ملفات صفحة المصحف لا يطابق الصيغة المتوقعة.');
  }
  const [svgMarkup, rawAreas] = await Promise.all([svgResponse.text(), jsonResponse.json()]);
  const viewBox = parseMushafViewBox(svgMarkup);
  const ayahAreas = parseMushafAyahAreas(rawAreas, viewBox);
  return { page, svgUrl, viewBox, ayahAreas };
}
