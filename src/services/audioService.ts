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
