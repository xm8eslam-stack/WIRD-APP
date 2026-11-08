import { decodeHtmlEntities } from './tafsirSanitizer';

/**
 * Converts Quran Foundation's HTML-formatted hadith matn into safe plain text.
 * Markup and links are removed, while their visible Arabic text and paragraph
 * boundaries are preserved. The result is rendered as a React text node.
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
