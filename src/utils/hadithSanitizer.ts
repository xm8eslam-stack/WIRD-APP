import { decodeHtmlEntities } from './tafsirSanitizer';
import { ALL_SURAHS } from '../data/quranMeta';

export type HadithMatnSegment =
  | { type: 'text'; value: string }
  | { type: 'quran'; surahNumber: number; startAyah: number; endAyah: number }
  | { type: 'invalid-quran' };

/**
 * Converts Quran Foundation's HTML-formatted hadith matn into safe plain text.
 * Markup and links are removed, while visible text and paragraph boundaries
 * are preserved. The result is rendered as React text, never as source HTML.
 */
export function sanitizeHadithHtmlToPlainText(raw: string): string {
  if (typeof raw !== 'string' || !raw) return '';
  const withoutActiveContent = raw.replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const plain = withoutActiveContent
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|blockquote)\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(plain)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses Quran Foundation's [quran ...]{...} citation syntax.
 * The provider's quoted verse text is intentionally discarded: valid
 * coordinates are rendered later from WIRD's locally verified Quran corpus.
 * Any incomplete Quran marker is consumed and replaced with a verification
 * notice so provider markup or unverified verse text cannot leak into the UI.
 */
export function parseHadithMatn(raw: string): HadithMatnSegment[] {
  if (typeof raw !== 'string' || !raw) return [];
  const segments: HadithMatnSegment[] = [];
  const markerPattern = /\[quran\b/gi;
  const digitMap = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
  const normalizeDigits = (value: string) => value.replace(/[٠-٩۰-۹]/g, digit => String(digitMap.indexOf(digit) % 10));
  let cursor = 0;
  let marker: RegExpExecArray | null;

  while ((marker = markerPattern.exec(raw)) !== null) {
    if (marker.index > cursor) segments.push({ type: 'text', value: raw.slice(cursor, marker.index) });

    const headerEnd = raw.indexOf(']', marker.index + marker[0].length);
    if (headerEnd === -1) {
      segments.push({ type: 'invalid-quran' });
      cursor = raw.length;
      break;
    }

    const attributes = normalizeDigits(raw.slice(marker.index + marker[0].length, headerEnd));
    let citationEnd = headerEnd + 1;
    while (citationEnd < raw.length && /[\s\u200e\u200f\u200b]/.test(raw[citationEnd])) citationEnd += 1;
    if (raw[citationEnd] === '{') {
      const closingBrace = raw.indexOf('}', citationEnd + 1);
      // An unterminated quote consumes the remainder rather than exposing
      // any unverified provider-supplied Quran text.
      citationEnd = closingBrace === -1 ? raw.length : closingBrace + 1;
    }

    const surahMatch = attributes.match(/\bsura\s*=\s*["']([0-9]{1,3})["']/i);
    const startMatch = attributes.match(/\baya_start\s*=\s*["']([0-9]{1,3})["']/i);
    const endMatch = attributes.match(/\baya_end\s*=\s*["']([0-9]{1,3})["']/i);
    const surahNumber = surahMatch ? Number(surahMatch[1]) : 0;
    const startAyah = startMatch ? Number(startMatch[1]) : 0;
    const endAyah = endMatch ? Number(endMatch[1]) : startAyah;
    const surah = ALL_SURAHS.find(item => item.number === surahNumber);

    if (surah && Number.isSafeInteger(startAyah) && Number.isSafeInteger(endAyah) &&
        startAyah >= 1 && endAyah >= startAyah && endAyah <= surah.versesCount) {
      segments.push({ type: 'quran', surahNumber, startAyah, endAyah });
    } else {
      segments.push({ type: 'invalid-quran' });
    }

    cursor = citationEnd;
    markerPattern.lastIndex = citationEnd;
  }

  if (cursor < raw.length) segments.push({ type: 'text', value: raw.slice(cursor) });
  return segments.filter(segment => segment.type !== 'text' || segment.value.length > 0);
}
