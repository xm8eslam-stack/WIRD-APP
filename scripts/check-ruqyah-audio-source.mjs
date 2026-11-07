const samples = [
  { edition: 'ar.husary', bitrate: 128, ayah: 1, label: 'Al-Husary / Al-Fatihah 1:1' },
  { edition: 'ar.minshawi', bitrate: 128, ayah: 1, label: 'Al-Minshawi / Al-Fatihah 1:1' },
  { edition: 'ar.abdulbasitmurattal', bitrate: 192, ayah: 1, label: 'Abdul Basit / Al-Fatihah 1:1' },
  { edition: 'ar.abdurrahmaansudais', bitrate: 192, ayah: 1, label: 'Al-Sudais / Al-Fatihah 1:1' },
  { edition: 'ar.saoodshuraym', bitrate: 64, ayah: 1, label: 'Al-Shuraim / Al-Fatihah 1:1' },
  { edition: 'ar.ahmedajamy', bitrate: 64, ayah: 1, label: 'Al-Ajamy / Al-Fatihah 1:1' },
  { edition: 'ar.alafasy', bitrate: 128, ayah: 1, label: 'Alafasy / Al-Fatihah 1:1' },
  { edition: 'ar.alafasy', bitrate: 128, ayah: 6236, label: 'Alafasy / final canonical ayah' }
];

const base = 'https://cdn.islamic.network/quran/audio';
let failures = 0;

for (const sample of samples) {
  const url = `${base}/${sample.bitrate}/${sample.cdnEdition}/${sample.ayah}.mp3`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      signal: AbortSignal.timeout(20000)
    });
    const contentType = response.headers.get('content-type') || '';
    const contentRange = response.headers.get('content-range') || '';
    const reader = response.body?.getReader();
    const firstChunk = reader ? await reader.read() : { value: undefined };
    if (reader) await reader.cancel();

    const valid = response.status === 206 &&
      /^audio\/(?:mpeg|mp3)(?:\s*;|$)/i.test(contentType) &&
      /^bytes 0-\d+\/\d+$/i.test(contentRange) &&
      Boolean(firstChunk.value && firstChunk.value.length > 0);

    if (!valid) {
      failures++;
      console.error(`FAIL ${sample.label}: HTTP ${response.status}, type=${contentType}, range=${contentRange}`);
    } else {
      console.log(`PASS ${sample.label}: HTTP 206, ${contentType}, ${contentRange}`);
    }
  } catch (error) {
    failures++;
    console.error(`FAIL ${sample.label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`Quran audio CDN smoke failed: ${failures}/${samples.length} samples`);
  process.exitCode = 1;
} else {
  console.log(`Quran audio CDN smoke passed: ${samples.length}/${samples.length} samples`);
}
