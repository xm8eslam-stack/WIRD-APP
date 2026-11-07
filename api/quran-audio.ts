function send(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(payload);
}

/**
 * Quran audio provider intentionally disabled.
 * Re-enable only after verifying reciter identity, exact recording provenance,
 * content integrity, and usage permissions for the selected provider/assets.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const type = String(Array.isArray(req.query?.type) ? req.query.type[0] : req.query?.type || '');
  if (type !== 'reciters') return send(res, 400, { error: 'INVALID_AUDIO_CATALOG_QUERY' });
  return send(res, 503, { error: 'QURAN_AUDIO_SOURCE_NOT_VERIFIED' });
}
