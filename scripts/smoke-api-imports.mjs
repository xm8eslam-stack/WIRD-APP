const [metadata, tafsir, ruqyah, hadithReferences] = await Promise.all([
  import('../src/data/quranMeta.ts'),
  import('../api/tafsir.ts'),
  import('../api/ruqyah.ts'),
  import('../api/hadith-references.ts')
]);

if (metadata.ALL_SURAHS.length !== 114) {
  throw new Error(`Expected 114 Quran surahs, received ${metadata.ALL_SURAHS.length}`);
}

for (const [name, route] of Object.entries({ tafsir, ruqyah, hadithReferences })) {
  if (typeof route.default !== 'function') {
    throw new Error(`Expected ${name} route to export a handler`);
  }
}

async function request(route, query) {
  const response = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
  await route.default({ method: 'GET', query, ip: '127.0.0.1' }, response);
  return response;
}

for (const [name, response] of [
  ['tafsir', await request(tafsir, { surah: '0', ayah: '0' })],
  ['ruqyah', await request(ruqyah, { type: 'unsupported' })],
  ['hadith references', await request(hadithReferences, { surah: '0', ayah: '0' })]
]) {
  if (response.statusCode !== 400) {
    throw new Error(`Expected ${name} route to return HTTP 400 for invalid input, received ${response.statusCode}`);
  }
}

console.log('Native Node imports and invalid-input responses passed for metadata-backed API routes.');
