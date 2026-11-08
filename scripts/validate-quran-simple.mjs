import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src/data/sources/tanzil/quran-simple-1.1.xml');
const uthmaniPath = path.join(root, 'src/data/completeQuranData.json');
const reportPath = path.join(root, 'src/data/quranSimpleValidationReport.json');

function fail(message) { throw new Error('[Tanzil Simple validation] ' + message); }
if (!fs.existsSync(sourcePath)) fail('Official source file is missing: ' + sourcePath);
if (!fs.existsSync(uthmaniPath)) fail('Canonical Uthmani corpus is missing: ' + uthmaniPath);

const xml = fs.readFileSync(sourcePath, 'utf8');
if (!xml.includes('Tanzil Quran Text (Simple, Version 1.1)') ||
    !xml.includes('Copyright (C) 2007-2026 Tanzil Project') ||
    !xml.includes('Creative Commons Attribution 3.0') ||
    !xml.includes('PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK') ||
    !xml.includes('http://tanzil.net')) {
  fail('Tanzil copyright, license, attribution, or source link block is missing.');
}
const surahPattern = /<sura\s+index="(\d+)"\s+name="([^"]+)"\s*>([\s\S]*?)<\/sura>/g;
const ayahPattern = /<aya\s+index="(\d+)"\s+text="([^"]*)"(?:\s+bismillah="([^"]*)")?\s*\/>/g;
const surahMatches = [...xml.matchAll(surahPattern)];
const quran = JSON.parse(fs.readFileSync(uthmaniPath, 'utf8'));
const issues = [];
const seen = new Set();
const simpleBySurah = {};
let total = 0, duplicateCoordinates = 0, missingCoordinates = 0, invalidCoordinates = 0, emptyTexts = 0;
let exactCoordinateMatches = 0, metadataMismatchCount = 0;
const expectedSurahIndexes = Array.from({ length: 114 }, (_, i) => i + 1);
const actualSurahIndexes = surahMatches.map(m => Number(m[1]));
if (surahMatches.length !== 114) issues.push({ reason: 'SURAH_COUNT', expected: 114, actual: surahMatches.length });
if (actualSurahIndexes.some((n, i) => n !== expectedSurahIndexes[i])) issues.push({ reason: 'SURAH_ORDER_OR_INDEX' });

for (const match of surahMatches) {
  const surahNumber = Number(match[1]);
  const surahName = match[2];
  const body = match[3];
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    invalidCoordinates++;
    issues.push({ surah: surahNumber, reason: 'INVALID_SURAH_INDEX' });
    continue;
  }
  if (simpleBySurah[surahNumber]) {
    duplicateCoordinates++;
    issues.push({ surah: surahNumber, reason: 'DUPLICATE_SURAH' });
    continue;
  }
  const sourceAyahs = [...body.matchAll(ayahPattern)];
  const parsed = sourceAyahs.map(m => ({ ayahNumber: Number(m[1]), text: m[2] }));
  if (parsed.some((a, i) => !Number.isInteger(a.ayahNumber) || a.ayahNumber !== i + 1)) {
    invalidCoordinates++;
    issues.push({ surah: surahNumber, reason: 'AYAH_INDEX_SEQUENCE' });
  }
  if (parsed.some(a => !a.text.length || !a.text.trim())) {
    emptyTexts++;
    issues.push({ surah: surahNumber, reason: 'EMPTY_AYAH_TEXT' });
  }
  simpleBySurah[surahNumber] = parsed.map(a => a.text);
  const canonical = quran[String(surahNumber)] ?? quran[surahNumber];
  if (!Array.isArray(canonical)) {
    missingCoordinates += parsed.length;
    issues.push({ surah: surahNumber, reason: 'CANONICAL_SURAH_MISSING' });
    continue;
  }
  if (canonical.length !== parsed.length) {
    issues.push({ surah: surahNumber, reason: 'SURAH_AYAH_COUNT_MISMATCH', simple: parsed.length, uthmani: canonical.length });
  }
  const count = Math.max(parsed.length, canonical.length);
  for (let i = 0; i < count; i++) {
    const source = parsed[i];
    const current = canonical[i];
    if (!source || !current) {
      missingCoordinates++;
      issues.push({ surah: surahNumber, ayah: i + 1, reason: 'MISSING_COORDINATE' });
      continue;
    }
    const key = surahNumber + ':' + source.ayahNumber;
    if (seen.has(key)) {
      duplicateCoordinates++;
      issues.push({ surah: surahNumber, ayah: source.ayahNumber, reason: 'DUPLICATE_COORDINATE' });
    }
    seen.add(key);
    if (source.ayahNumber !== current.numberInSurah || current.surahNumber !== surahNumber) {
      invalidCoordinates++;
      issues.push({ surah: surahNumber, ayah: source.ayahNumber, reason: 'COORDINATE_MISMATCH' });
      continue;
    }
    exactCoordinateMatches++;
    if (!Number.isInteger(current.number) || !Number.isInteger(current.page) ||
        !Number.isInteger(current.juz) || !Number.isInteger(current.hizbQuarter)) {
      metadataMismatchCount++;
      issues.push({ surah: surahNumber, ayah: source.ayahNumber, reason: 'CANONICAL_METADATA_INVALID' });
    }
  }
  if (typeof surahName !== 'string' || !surahName.trim()) issues.push({ surah: surahNumber, reason: 'SURAH_NAME_EMPTY' });
}
for (let s = 1; s <= 114; s++) {
  if (!simpleBySurah[s]) issues.push({ surah: s, reason: 'SURAH_MISSING' });
}
total = Object.values(simpleBySurah).reduce((sum, list) => sum + list.length, 0);
if (total !== 6236) issues.push({ reason: 'TOTAL_AYAH_COUNT', expected: 6236, actual: total });
if (seen.size !== 6236) issues.push({ reason: 'UNIQUE_COORDINATE_COUNT', expected: 6236, actual: seen.size });

const report = {
  source: 'Tanzil Project — Quran Text (Simple), Version 1.1',
  sourceUrl: 'https://tanzil.net',
  license: 'Creative Commons Attribution 3.0 (CC BY 3.0)',
  verification: {
    status: issues.length === 0 ? 'VERIFIED' : 'FAILED',
    surahs: surahMatches.length,
    ayahs: total,
    exactCoordinateMatches,
    missingCoordinates,
    duplicateCoordinates,
    invalidCoordinates,
    emptyTexts,
    metadataMismatchCount,
    unexplainedDifferences: issues.length,
    issueSamples: issues.slice(0, 100),
    examples: {
      '41:7': simpleBySurah[41]?.[6] ?? null,
      '1:1': simpleBySurah[1]?.[0] ?? null,
      '9:1': simpleBySurah[9]?.[0] ?? null
    }
  }
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
if (issues.length) {
  console.error(JSON.stringify(report, null, 2));
  fail('Validation failed with ' + issues.length + ' issue(s). No Simple corpus may be generated or used.');
}
console.log('[Tanzil Simple validation] PASS — 114 surahs, 6,236 ayahs, 6,236 unique coordinate matches. Report: src/data/quranSimpleValidationReport.json');
