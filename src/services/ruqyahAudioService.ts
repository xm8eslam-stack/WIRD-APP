export interface QuranReciter {
  id: string;
  name: string;
  arabicName: string;
}

/** Small documented fallback set; the full catalogue is loaded from Al Furqan. */
export const FALLBACK_QURAN_RECITERS: QuranReciter[] = [
  { id: 'husary', name: 'Mahmoud Khalil Al-Hussary', arabicName: 'محمود خليل الحصري' },
  { id: 'minshawy-murattal', name: 'Mohamed Siddiq Al-Minshawi', arabicName: 'محمد صديق المنشاوي' },
  { id: 'abdul-basit-murattal', name: 'Abdul Basit Abdul Samad', arabicName: 'عبد الباسط عبد الصمد' },
  { id: 'maher-almuaiqly', name: 'Maher Al-Muaiqly', arabicName: 'ماهر المعيقلي' },
  { id: 'ghamadi', name: 'Saad Al-Ghamdi', arabicName: 'سعد الغامدي' },
  { id: 'ahmed-al-ajamy', name: 'Ahmed ibn Ali al-Ajamy', arabicName: 'أحمد بن علي العجمي' }
];

/** Audio playback remains disabled until a verified provider and usage rights are approved. */
export function buildQuranAyahAudioUrl(_reciterId: string, _globalAyahNumber: number): string {
  throw new Error('تلاوة الآيات الصوتية موقوفة لحين اعتماد مصدر موثوق وموثق للتسجيلات.');
}
