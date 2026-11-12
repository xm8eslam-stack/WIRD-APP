export const ENGINE_PLAN_ARCHIVE_CHUNK_PROTOCOL_VERSION = 1;
export const MAX_ENGINE_PLAN_ARCHIVE_CHUNK_BYTES = 192_000;

export interface EnginePlanArchiveChunkDescriptor {
  chunkId: string;
  recordId: string;
  recordOrdinal: number;
  fragmentIndex: number;
  fragmentCount: number;
  byteLength: number;
  recordByteLength: number;
  sha256: string;
  recordSha256: string;
}

export interface EnginePlanArchiveManifest {
  protocolVersion: number;
  schemaVersion: number;
  archiveRevisionId: string;
  recordCount: number;
  totalBytes: number;
  archiveSha256: string;
  orderedRecordIds: string[];
  maxChunkBytes: number;
  chunks: EnginePlanArchiveChunkDescriptor[];
}

export interface EnginePlanArchiveChunk {
  descriptor: EnginePlanArchiveChunkDescriptor;
  bytes: Uint8Array;
}

export interface BuiltEnginePlanArchive {
  manifest: EnginePlanArchiveManifest;
  chunks: EnginePlanArchiveChunk[];
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type EnginePlanArchiveRecord = { id: string; [key: string]: unknown };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value: unknown, path = '$'): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`قيمة رقمية غير صالحة في ${path}.`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0 || Object.keys(value).length !== value.length) {
      throw new Error(`مصفوفة غير متصلة أو تحتوي خصائص إضافية في ${path}.`);
    }
    const result: JsonValue[] = [];
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) throw new Error(`عنصر مفقود في ${path}[${index}].`);
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor)) throw new Error(`خاصية مصفوفة غير مدعومة في ${path}[${index}].`);
      result.push(canonicalize(descriptor.value, `${path}[${index}]`));
    }
    return result;
  }
  if (isPlainRecord(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(key => typeof key !== 'string') || ownKeys.length !== Object.keys(value).length) {
      throw new Error(`خصائص غير قابلة للتسلسل في ${path}.`);
    }
    const result: Record<string, JsonValue> = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new Error(`خاصية كائن غير مدعومة في ${path}.${key}.`);
      }
      result[key] = canonicalize(descriptor.value, `${path}.${key}`);
    }
    return result;
  }
  throw new Error(`نوع بيانات غير قابل للأرشفة في ${path}.`);
}

export function canonicalizeEnginePlanArchiveRecord(record: EnginePlanArchiveRecord): string {
  if (!isPlainRecord(record) || typeof record.id !== 'string' || !record.id.trim() || record.id.length > 256) {
    throw new Error('كل خطة تحتاج إلى record ID ثابت وصالح.');
  }
  return JSON.stringify(canonicalize(record));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('يتطلب التحقق من أرشيف الخطط دعم Web Crypto SHA-256.');
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function validateRevisionId(value: string): void {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(value)) {
    throw new Error('معرّف إصدار أرشيف الخطط غير صالح.');
  }
}

function concatBytes(parts: Uint8Array[], totalBytes: number): Uint8Array {
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function equalString(left: string, right: string): boolean {
  return left === right;
}

export async function buildEnginePlanArchiveChunks(
  records: readonly EnginePlanArchiveRecord[],
  archiveRevisionId: string,
  schemaVersion: number,
  maxChunkBytes = MAX_ENGINE_PLAN_ARCHIVE_CHUNK_BYTES
): Promise<BuiltEnginePlanArchive> {
  validateRevisionId(archiveRevisionId);
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) throw new RangeError('إصدار مخطط أرشيف الخطط غير صالح.');
  if (!Number.isSafeInteger(maxChunkBytes) || maxChunkBytes < 1 || maxChunkBytes > MAX_ENGINE_PLAN_ARCHIVE_CHUNK_BYTES) {
    throw new RangeError('حجم جزء المزامنة يتجاوز الحد الآمن للبروتوكول.');
  }
  if (!Array.isArray(records)) throw new TypeError('قائمة الخطط غير صالحة.');

  const ids = new Set<string>();
  const orderedRecordIds: string[] = [];
  const chunks: EnginePlanArchiveChunk[] = [];
  let totalBytes = 0;

  for (let ordinal = 0; ordinal < records.length; ordinal++) {
    const record = records[ordinal];
    const canonical = canonicalizeEnginePlanArchiveRecord(record);
    if (ids.has(record.id)) throw new Error(`معرّف خطة مكرر: ${record.id}`);
    ids.add(record.id);
    orderedRecordIds.push(record.id);

    const bytes = new TextEncoder().encode(canonical);
    const recordSha256 = await sha256(bytes);
    const fragmentCount = Math.max(1, Math.ceil(bytes.byteLength / maxChunkBytes));
    totalBytes += bytes.byteLength;
    if (!Number.isSafeInteger(totalBytes)) throw new RangeError('الحجم الإجمالي للأرشيف تجاوز النطاق الآمن.');

    for (let fragmentIndex = 0; fragmentIndex < fragmentCount; fragmentIndex++) {
      const start = fragmentIndex * maxChunkBytes;
      const fragment = bytes.slice(start, Math.min(start + maxChunkBytes, bytes.byteLength));
      const chunkId = `${archiveRevisionId}:${encodeURIComponent(record.id)}:${fragmentIndex}`;
      const descriptor: EnginePlanArchiveChunkDescriptor = {
        chunkId,
        recordId: record.id,
        recordOrdinal: ordinal,
        fragmentIndex,
        fragmentCount,
        byteLength: fragment.byteLength,
        recordByteLength: bytes.byteLength,
        sha256: await sha256(fragment),
        recordSha256
      };
      chunks.push({ descriptor, bytes: fragment });
    }
  }

  const archiveBytes = new TextEncoder().encode(JSON.stringify(canonicalize({
    protocolVersion: ENGINE_PLAN_ARCHIVE_CHUNK_PROTOCOL_VERSION,
    schemaVersion,
    archiveRevisionId,
    orderedRecordIds,
    records
  })));
  const manifest: EnginePlanArchiveManifest = {
    protocolVersion: ENGINE_PLAN_ARCHIVE_CHUNK_PROTOCOL_VERSION,
    schemaVersion,
    archiveRevisionId,
    recordCount: records.length,
    totalBytes,
    archiveSha256: await sha256(archiveBytes),
    orderedRecordIds,
    maxChunkBytes,
    chunks: chunks.map(chunk => ({ ...chunk.descriptor }))
  };
  return { manifest, chunks };
}

function validateManifest(manifest: EnginePlanArchiveManifest): void {
  if (!manifest || manifest.protocolVersion !== ENGINE_PLAN_ARCHIVE_CHUNK_PROTOCOL_VERSION) {
    throw new Error('إصدار بروتوكول أجزاء الأرشيف غير مدعوم.');
  }
  validateRevisionId(manifest.archiveRevisionId);
  if (!Number.isSafeInteger(manifest.schemaVersion) || manifest.schemaVersion < 1 ||
      !Number.isSafeInteger(manifest.recordCount) || manifest.recordCount < 0 ||
      !Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes < 0 ||
      !Number.isSafeInteger(manifest.maxChunkBytes) || manifest.maxChunkBytes < 1 ||
      manifest.maxChunkBytes > MAX_ENGINE_PLAN_ARCHIVE_CHUNK_BYTES ||
      !Array.isArray(manifest.orderedRecordIds) || !Array.isArray(manifest.chunks) ||
      manifest.recordCount !== manifest.orderedRecordIds.length ||
      !/^[a-f0-9]{64}$/.test(manifest.archiveSha256)) {
    throw new Error('بيانات Manifest أرشيف الخطط غير صالحة.');
  }
  if (new Set(manifest.orderedRecordIds).size !== manifest.orderedRecordIds.length ||
      manifest.orderedRecordIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('ترتيب أو معرّفات سجلات الأرشيف غير صالحة.');
  }
  if ((manifest.recordCount === 0) !== (manifest.chunks.length === 0)) {
    throw new Error('عدد أجزاء الأرشيف لا يتوافق مع عدد السجلات.');
  }
  const chunkIds = new Set<string>();
  for (const chunk of manifest.chunks) {
    if (!chunk || typeof chunk.chunkId !== 'string' || chunkIds.has(chunk.chunkId) ||
        !manifest.orderedRecordIds.includes(chunk.recordId) ||
        chunk.chunkId !== `${manifest.archiveRevisionId}:${encodeURIComponent(chunk.recordId)}:${chunk.fragmentIndex}` ||
        !Number.isSafeInteger(chunk.recordOrdinal) || manifest.orderedRecordIds[chunk.recordOrdinal] !== chunk.recordId ||
        !Number.isSafeInteger(chunk.fragmentIndex) || !Number.isSafeInteger(chunk.fragmentCount) ||
        chunk.fragmentCount < 1 || chunk.fragmentIndex < 0 || chunk.fragmentIndex >= chunk.fragmentCount ||
        !Number.isSafeInteger(chunk.byteLength) || chunk.byteLength < 1 || chunk.byteLength > manifest.maxChunkBytes ||
        !Number.isSafeInteger(chunk.recordByteLength) || chunk.recordByteLength < 1 ||
        !/^[a-f0-9]{64}$/.test(chunk.sha256) || !/^[a-f0-9]{64}$/.test(chunk.recordSha256)) {
      throw new Error('وصف جزء من أرشيف الخطط غير صالح أو مكرر.');
    }
    chunkIds.add(chunk.chunkId);
  }
}

export async function materializeEnginePlanArchiveChunks<T extends EnginePlanArchiveRecord>(
  manifest: EnginePlanArchiveManifest,
  chunkBytesById: ReadonlyMap<string, Uint8Array>
): Promise<T[]> {
  validateManifest(manifest);
  if (!chunkBytesById || typeof chunkBytesById.get !== 'function' || typeof chunkBytesById.has !== 'function' ||
      chunkBytesById.size !== manifest.chunks.length) {
    throw new Error('مجموعة أجزاء الأرشيف ناقصة أو تحتوي أجزاء غير متوقعة.');
  }

  const descriptorsByRecord = new Map<string, EnginePlanArchiveChunkDescriptor[]>();
  for (const descriptor of manifest.chunks) {
    if (!chunkBytesById.has(descriptor.chunkId)) throw new Error(`جزء مفقود من الأرشيف: ${descriptor.chunkId}`);
    const list = descriptorsByRecord.get(descriptor.recordId) ?? [];
    list.push(descriptor);
    descriptorsByRecord.set(descriptor.recordId, list);
  }

  const records: T[] = [];
  let totalBytes = 0;
  for (let ordinal = 0; ordinal < manifest.orderedRecordIds.length; ordinal++) {
    const recordId = manifest.orderedRecordIds[ordinal];
    const descriptors = (descriptorsByRecord.get(recordId) ?? []).sort((a, b) => a.fragmentIndex - b.fragmentIndex);
    if (descriptors.length === 0) throw new Error(`لا توجد أجزاء للسجل ${recordId}.`);
    const first = descriptors[0];
    const expectedFragmentCount = Math.max(1, Math.ceil(first.recordByteLength / manifest.maxChunkBytes));
    if (first.fragmentCount !== expectedFragmentCount || descriptors.length !== first.fragmentCount ||
        descriptors.some((item, index) => {
          const expectedLength = index < expectedFragmentCount - 1
            ? manifest.maxChunkBytes
            : first.recordByteLength - manifest.maxChunkBytes * (expectedFragmentCount - 1);
          return item.recordOrdinal !== ordinal || item.fragmentCount !== first.fragmentCount ||
            item.recordByteLength !== first.recordByteLength || item.recordSha256 !== first.recordSha256 ||
            item.fragmentIndex !== index || item.byteLength !== expectedLength;
        })) {
      throw new Error(`تسلسل أجزاء السجل ${recordId} غير مكتمل أو غير متسق.`);
    }

    const parts: Uint8Array[] = [];
    let recordLength = 0;
    for (const descriptor of descriptors) {
      const bytes = chunkBytesById.get(descriptor.chunkId)!;
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== descriptor.byteLength ||
          !equalString(await sha256(bytes), descriptor.sha256)) {
        throw new Error(`فشل التحقق من سلامة الجزء ${descriptor.chunkId}.`);
      }
      parts.push(bytes);
      recordLength += bytes.byteLength;
    }
    if (recordLength !== first.recordByteLength) throw new Error(`حجم سجل الأرشيف ${recordId} غير متطابق.`);
    const recordBytes = concatBytes(parts, recordLength);
    if (!equalString(await sha256(recordBytes), first.recordSha256)) {
      throw new Error(`فشل التحقق من بصمة سجل الأرشيف ${recordId}.`);
    }

    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(recordBytes)); }
    catch { throw new Error(`تعذر فك سجل الأرشيف ${recordId}.`); }
    if (!isPlainRecord(parsed) || parsed.id !== recordId ||
        canonicalizeEnginePlanArchiveRecord(parsed as EnginePlanArchiveRecord) !== new TextDecoder().decode(recordBytes)) {
      throw new Error(`محتوى سجل الأرشيف ${recordId} لا يطابق معرّفه أو ترميزه المعياري.`);
    }
    records.push(parsed as T);
    totalBytes += recordLength;
  }

  if (totalBytes !== manifest.totalBytes) throw new Error('الحجم الإجمالي للأرشيف لا يطابق Manifest.');
  const archiveBytes = new TextEncoder().encode(JSON.stringify(canonicalize({
    protocolVersion: manifest.protocolVersion,
    schemaVersion: manifest.schemaVersion,
    archiveRevisionId: manifest.archiveRevisionId,
    orderedRecordIds: manifest.orderedRecordIds,
    records
  })));
  if (!equalString(await sha256(archiveBytes), manifest.archiveSha256)) {
    throw new Error('فشلت بصمة الأرشيف الكاملة؛ لن يتم إظهار أي سجل.');
  }
  return records;
}
