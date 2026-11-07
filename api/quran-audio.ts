const APPROVED_RECITERS = [
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري', style: 'Murattal', bitrate: 128 },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq al-Minshawi', arabicName: 'محمد صديق المنشاوي', style: 'Murattal', bitrate: 128 },
  { id: 'ar.abdulbasit', name: 'Abdul Basit Abdul Samad', arabicName: 'عبد الباسط عبد الصمد', style: 'Murattal', bitrate: 192 },
  { id: 'ar.sudais', name: 'Abdul Rahman Al-Sudais', arabicName: 'عبدالرحمن السديس', style: 'Murattal', bitrate: 192 },
  { id: 'ar.shuraim', name: 'Saud Al-Shuraim', arabicName: 'سعود الشريم', style: 'Murattal', bitrate: 128 },
  { id: 'ar.ajamy', name: 'Ahmed ibn Ali al-Ajamy', arabicName: 'أحمد بن علي العجمي', style: 'Murattal', bitrate: 128 },
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي', style: 'Murattal', bitrate: 128 }
] as const;

function send(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(payload);
}

/**
 * Curated Al Quran Cloud audio editions.
 * The browser never supplies an upstream URL or reciter identifier to this handler.
 * Recitation audio is streamed directly from the provider's documented CDN.
 */
export default function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const rawType = req.query?.type;
  if (Array.isArray(rawType) && rawType.length !== 1) return send(res, 400, { error: 'INVALID_AUDIO_CATALOG_QUERY' });
  const type = String(Array.isArray(rawType) ? rawType[0] : rawType || '');
  if (type !== 'reciters') return send(res, 400, { error: 'INVALID_AUDIO_CATALOG_QUERY' });

  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return send(res, 200, {
    provider: 'Al Quran Cloud',
    source: 'https://alquran.cloud/cdn',
    reciters: APPROVED_RECITERS
  });
}
