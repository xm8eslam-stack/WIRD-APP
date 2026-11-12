import {
  MAX_ENGINE_PLAN_ARCHIVE_CHUNK_BYTES,
  buildEnginePlanArchiveChunks,
  canonicalizeEnginePlanArchiveRecord,
  materializeEnginePlanArchiveChunks,
  type EnginePlanArchiveChunk
} from './enginePlanArchiveChunkCodec';

export async function runEnginePlanArchiveChunkCodecTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name, error); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const expectReject = async (run: () => Promise<unknown> | unknown, message: string) => {
    let rejected = false;
    try { await run(); } catch { rejected = true; }
    assert(rejected, message);
  };
  const mapChunks = (chunks: EnginePlanArchiveChunk[]) =>
    new Map(chunks.map(chunk => [chunk.descriptor.chunkId, chunk.bytes]));

  await test('splits a single oversized plan across bounded chunks and reconstructs it byte-for-byte', async () => {
    const records = [
      { id: 'plan-large', title: 'خطة حفظ', notes: 'آية '.repeat(900), nested: { order: 3, active: true } }
    ];
    const built = await buildEnginePlanArchiveChunks(records, 'revision-1', 1, 256);
    assert(built.chunks.length > 1, 'A large logical plan should be split into multiple immutable chunks');
    assert(built.chunks.every(chunk => chunk.bytes.byteLength <= 256), 'No chunk may exceed the negotiated byte ceiling');
    const restored = await materializeEnginePlanArchiveChunks<typeof records[number]>(built.manifest, mapChunks(built.chunks));
    assert(canonicalizeEnginePlanArchiveRecord(restored[0]) === canonicalizeEnginePlanArchiveRecord(records[0]),
      'Reconstructed record must exactly match its canonical source');
  });

  await test('preserves record order and creates deterministic IDs and fingerprints', async () => {
    const records = [{ id: 'plan-b', value: 2 }, { id: 'plan-a', value: 1 }];
    const first = await buildEnginePlanArchiveChunks(records, 'stable-revision', 3, 64);
    const second = await buildEnginePlanArchiveChunks(records, 'stable-revision', 3, 64);
    assert(first.manifest.archiveSha256 === second.manifest.archiveSha256, 'Same archive input must produce the same fingerprint');
    assert(first.manifest.chunks.map(item => item.chunkId).join('|') === second.manifest.chunks.map(item => item.chunkId).join('|'),
      'Same revision and record order must produce stable chunk IDs');
    assert(first.manifest.orderedRecordIds.join(',') === 'plan-b,plan-a', 'Manifest must preserve logical record order');
    const restored = await materializeEnginePlanArchiveChunks(builtType<typeof records[number]>(), first.manifest, mapChunks(first.chunks));
    assert(restored.map(record => record.id).join(',') === 'plan-b,plan-a', 'Materialization must preserve record order');
  });

  await test('rejects missing, extra, duplicate, and corrupted chunks', async () => {
    const built = await buildEnginePlanArchiveChunks([{ id: 'plan-1', body: 'س'.repeat(400) }], 'revision-2', 1, 128);
    const missing = mapChunks(built.chunks);
    missing.delete(built.chunks[0].descriptor.chunkId);
    await expectReject(() => materializeEnginePlanArchiveChunks(built.manifest, missing), 'Missing chunk must fail closed');

    const extra = mapChunks(built.chunks);
    extra.set('unexpected-chunk', new Uint8Array([1]));
    await expectReject(() => materializeEnginePlanArchiveChunks(built.manifest, extra), 'Unexpected chunk must fail closed');

    const corrupted = mapChunks(built.chunks);
    const first = built.chunks[0];
    const changed = first.bytes.slice();
    changed[0] ^= 0xff;
    corrupted.set(first.descriptor.chunkId, changed);
    await expectReject(() => materializeEnginePlanArchiveChunks(built.manifest, corrupted), 'Corrupted bytes must fail SHA-256 verification');

    const duplicateManifest = JSON.parse(JSON.stringify(built.manifest));
    duplicateManifest.chunks[1].chunkId = duplicateManifest.chunks[0].chunkId;
    await expectReject(() => materializeEnginePlanArchiveChunks(duplicateManifest, mapChunks(built.chunks)),
      'Duplicate chunk IDs must fail manifest validation');
  });

  await test('binds manifest fingerprint to schema and revision and rejects descriptor tampering', async () => {
    const built = await buildEnginePlanArchiveChunks([{ id: 'plan-x', value: 'data' }], 'revision-3', 1, 128);
    const changedSchema = JSON.parse(JSON.stringify(built.manifest));
    changedSchema.schemaVersion = 2;
    await expectReject(() => materializeEnginePlanArchiveChunks(changedSchema, mapChunks(built.chunks)),
      'Changing schema version must invalidate the archive fingerprint');

    const changedChunkId = JSON.parse(JSON.stringify(built.manifest));
    changedChunkId.chunks[0].chunkId = 'revision-3:other:0';
    await expectReject(() => materializeEnginePlanArchiveChunks(changedChunkId, mapChunks(built.chunks)),
      'Changing chunk identity must fail validation');
  });

  await test('rejects duplicate record IDs, unsupported JSON values and unsafe chunk sizes', async () => {
    await expectReject(() => buildEnginePlanArchiveChunks([{ id: 'same' }, { id: 'same' }], 'revision-4', 1),
      'Duplicate record IDs must be rejected');
    await expectReject(() => buildEnginePlanArchiveChunks([{ id: 'bad', value: undefined } as any], 'revision-4', 1),
      'Undefined values must not be silently dropped');
    await expectReject(() => buildEnginePlanArchiveChunks([{ id: 'bad', value: new Date() } as any], 'revision-4', 1),
      'Non-plain objects must not be silently serialized');
    await expectReject(() => buildEnginePlanArchiveChunks([{ id: 'bad', value: Number.NaN }], 'revision-4', 1),
      'Non-finite numbers must be rejected');
    await expectReject(() => buildEnginePlanArchiveChunks([{ id: 'large' }], 'revision-4', 1, MAX_ENGINE_PLAN_ARCHIVE_CHUNK_BYTES + 1),
      'Chunk size above protocol ceiling must be rejected');
  });

  await test('supports an empty archive with a verifiable manifest', async () => {
    const built = await buildEnginePlanArchiveChunks([], 'empty-revision', 1, 128);
    assert(built.manifest.recordCount === 0 && built.manifest.chunks.length === 0 && built.manifest.totalBytes === 0,
      'Empty archive must have no chunks or records');
    const restored = await materializeEnginePlanArchiveChunks(built.manifest, new Map());
    assert(restored.length === 0, 'Empty archive should round-trip');
  });

  return { passed, failed };
}

// Type helper keeps the test's record generic without duplicating a cast at call sites.
function builtType<T>(): T {
  return undefined as unknown as T;
}
