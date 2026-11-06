/**
 * Quranic Tafsir Sanitizer and Formatter
 * Grounded in Quran.com API v4 data formats.
 *
 * Cleans raw HTML/code tags returned by Quran.com / Muyassar / Saadi / Ibn Kathir APIs,
 * converting raw spans and curly braces into elegant Quranic quotes (﴿ ... ﴾),
 * highlights, and readable commentary blocks without exposing raw code tags.
 */

export type TafsirSegmentType = 'ayah_quote' | 'highlight' | 'text' | 'paragraph_break';

export interface TafsirSegment {
  id: string;
  type: TafsirSegmentType;
  text: string;
}

const ENTITY_MAP: Record<string, string> = {
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&rlm;': '\u200F',
  '&lrm;': '\u200E'
};

/**
 * Decodes standard HTML entities and numerical entities.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  let result = input.replace(/&(?:quot|#39|apos|amp|lt|gt|nbsp|rlm|lrm);/g, match => ENTITY_MAP[match] || match);
  result = result.replace(/&#(\d+);/g, (_, dec) => {
    const code = Number(dec);
    return Number.isFinite(code) && code > 0 ? String.fromCharCode(code) : '';
  });
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) && code > 0 ? String.fromCharCode(code) : '';
  });
  return result;
}

/**
 * Replaces curly braces `{ ... }` commonly used in Arabic tafsir texts for ayah quotations
 * with authentic Quranic quotation marks ﴿ ... ﴾.
 */
export function formatQuranicBrackets(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{\s*([^}]+?)\s*\}/g, '﴿ $1 ﴾')
    .replace(/\[\s*([^\]]+?)\s*\]/g, '[$1]');
}

/**
 * Strips technical HTML code tags while preserving semantic spacing and Quranic quotes.
 * Produces clean plain-text suitable for copying to clipboard.
 */
export function sanitizeTafsirToPlainText(raw: string): string {
  if (!raw) return '';
  let cleaned = raw;
  // Replace line breaks and paragraphs with clean linebreaks
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/p>/gi, '\n\n');
  cleaned = cleaned.replace(/<\/div>/gi, '\n');
  // Strip all other HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = decodeHtmlEntities(cleaned);
  cleaned = formatQuranicBrackets(cleaned);
  // Normalize redundant whitespace while keeping intentional linebreaks
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
  return cleaned;
}

/**
 * Parses raw Tafsir HTML (from Quran.com API v4 or other sources) into structured segments
 * for safe, rich rendering in React without requiring dangerouslySetInnerHTML.
 */
export function parseTafsirToSegments(raw: string): TafsirSegment[] {
  if (!raw || typeof raw !== 'string') return [];

  const segments: TafsirSegment[] = [];
  let counter = 0;

  // Normalize linebreaks and paragraph tags first
  let prepared = raw
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n');

  // Regex to match Quran.com specific tags:
  // - <span class="...blue...">...</span> (Ayah quote/reference)
  // - <span class="...brown...">...</span> (Ayah quote in Saadi)
  // - <span class="...arabic...">...</span> (Arabic quotation)
  // - <span class="...green...">...</span> (Special title/name)
  // - Generic spans, links, bold tags
  const tagRegex = /<span\s+class=["']([^"']*)["'][^>]*>(.*?)<\/span>|<b[^>]*>(.*?)<\/b>|<strong[^>]*>(.*?)<\/strong>|<[^>]+>/gis;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(prepared)) !== null) {
    const textBefore = prepared.slice(lastIndex, match.index);
    if (textBefore) {
      appendPlainTextSegments(textBefore, segments, () => `seg-${counter++}`);
    }

    const fullTag = match[0];
    const spanClass = match[1] || '';
    const spanContent = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4] || '';

    if (spanContent) {
      const decodedContent = decodeHtmlEntities(spanContent).replace(/<[^>]+>/g, '').trim();
      if (decodedContent) {
        const isAyah = spanClass.includes('blue') ||
          spanClass.includes('brown') ||
          spanClass.includes('qpc-hafs') ||
          spanClass.includes('arabic') ||
          decodedContent.startsWith('{') ||
          decodedContent.startsWith('﴿');

        const isHighlight = spanClass.includes('green') || fullTag.startsWith('<b') || fullTag.startsWith('<strong');

        if (isAyah) {
          segments.push({
            id: `seg-${counter++}`,
            type: 'ayah_quote',
            text: formatQuranicBrackets(decodedContent)
          });
        } else if (isHighlight) {
          segments.push({
            id: `seg-${counter++}`,
            type: 'highlight',
            text: formatQuranicBrackets(decodedContent)
          });
        } else {
          appendPlainTextSegments(decodedContent, segments, () => `seg-${counter++}`);
        }
      }
    }

    lastIndex = tagRegex.lastIndex;
  }

  // Handle remaining text
  const remaining = prepared.slice(lastIndex);
  if (remaining) {
    appendPlainTextSegments(remaining, segments, () => `seg-${counter++}`);
  }

  return segments;
}

function appendPlainTextSegments(
  rawText: string,
  segments: TafsirSegment[],
  getId: () => string
): void {
  const decoded = decodeHtmlEntities(rawText);
  // Split on double linebreaks for paragraphs
  const paragraphs = decoded.split(/\n\s*\n/);

  paragraphs.forEach((para, index) => {
    const formatted = formatQuranicBrackets(para.trim());
    if (formatted) {
      // Check if paragraph contains curly bracket quotes not wrapped in span tags
      const bracketRegex = /﴿\s*([^﴾]+?)\s*﴾/g;
      let lastPos = 0;
      let bracketMatch: RegExpExecArray | null;

      while ((bracketMatch = bracketRegex.exec(formatted)) !== null) {
        const lead = formatted.slice(lastPos, bracketMatch.index).trim();
        if (lead) {
          segments.push({ id: getId(), type: 'text', text: lead });
        }
        segments.push({
          id: getId(),
          type: 'ayah_quote',
          text: `﴿ ${bracketMatch[1].trim()} ﴾`
        });
        lastPos = bracketRegex.lastIndex;
      }

      const rest = formatted.slice(lastPos).trim();
      if (rest) {
        segments.push({ id: getId(), type: 'text', text: rest });
      }
    }

    if (index < paragraphs.length - 1 && segments.length > 0) {
      segments.push({ id: getId(), type: 'paragraph_break', text: '' });
    }
  });
}
