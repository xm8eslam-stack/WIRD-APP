export interface SeerahSceneIndexEntry {
  id: string;
  title: string;
  order: number;
  anchorId: string;
}

export interface SeerahChapterIndexEntry {
  id: string;
  title: string;
  order: number;
  scenes: SeerahSceneIndexEntry[];
}

export interface SeerahPartIndexEntry {
  id: string;
  title: string;
  order: number;
  chapters: SeerahChapterIndexEntry[];
}

export interface SeerahBookManifest {
  schemaVersion: 1;
  bookId: string;
  contentVersion: string;
  status: 'draft' | 'published';
  parts: SeerahPartIndexEntry[];
}

export interface SeerahManifestValidation {
  valid: boolean;
  publishable: boolean;
  blockers: string[];
}

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/;

function validId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validOrder(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Anchor IDs are derived only from stable internal IDs, never titles or array
 * positions, so editorial title changes and content reordering do not orphan
 * reader bookmarks.
 */
export function createSeerahSceneAnchorId(
  bookId: string,
  partId: string,
  chapterId: string,
  sceneId: string
): string {
  for (const [label, value] of [['book', bookId], ['part', partId], ['chapter', chapterId], ['scene', sceneId]] as const) {
    if (!validId(value)) throw new Error('Invalid stable Seerah ' + label + ' ID.');
  }
  return 'seerah-' + bookId + '--' + partId + '--' + chapterId + '--' + sceneId;
}

export function validateSeerahBookManifest(value: unknown): SeerahManifestValidation {
  const blockers: string[] = [];
  if (!value || typeof value !== 'object') {
    return { valid: false, publishable: false, blockers: ['manifest_invalid'] };
  }

  const manifest = value as Partial<SeerahBookManifest>;
  if (manifest.schemaVersion !== 1) blockers.push('manifest_schema_unsupported');
  if (!validId(manifest.bookId)) blockers.push('book_id_invalid');
  if (typeof manifest.contentVersion !== 'string' || !manifest.contentVersion.trim() || manifest.contentVersion.length > 80) {
    blockers.push('content_version_invalid');
  }
  if (manifest.status !== 'draft' && manifest.status !== 'published') blockers.push('manifest_status_invalid');
  if (!Array.isArray(manifest.parts)) return {
    valid: false,
    publishable: false,
    blockers: [...blockers, 'parts_invalid']
  };

  const partIds = new Set<string>();
  const chapterIds = new Set<string>();
  const sceneIds = new Set<string>();
  const anchorIds = new Set<string>();
  const partOrders = new Set<number>();

  for (const part of manifest.parts) {
    if (!part || typeof part !== 'object') {
      blockers.push('part_record_invalid');
      continue;
    }
    if (!validId(part.id) || !hasText(part.title)) blockers.push('part_metadata_invalid');
    if (partIds.has(part.id)) blockers.push('part_id_duplicate:' + part.id);
    partIds.add(part.id);
    if (!validOrder(part.order) || partOrders.has(part.order)) blockers.push('part_order_invalid:' + part.id);
    partOrders.add(part.order);
    if (!Array.isArray(part.chapters)) {
      blockers.push('part_chapters_invalid:' + part.id);
      continue;
    }

    const chapterOrders = new Set<number>();
    for (const chapter of part.chapters) {
      if (!chapter || typeof chapter !== 'object') {
        blockers.push('chapter_record_invalid:' + part.id);
        continue;
      }
      if (!validId(chapter.id) || !hasText(chapter.title)) blockers.push('chapter_metadata_invalid:' + chapter.id);
      if (chapterIds.has(chapter.id)) blockers.push('chapter_id_duplicate:' + chapter.id);
      chapterIds.add(chapter.id);
      if (!validOrder(chapter.order) || chapterOrders.has(chapter.order)) blockers.push('chapter_order_invalid:' + chapter.id);
      chapterOrders.add(chapter.order);
      if (!Array.isArray(chapter.scenes)) {
        blockers.push('chapter_scenes_invalid:' + chapter.id);
        continue;
      }

      const sceneOrders = new Set<number>();
      for (const scene of chapter.scenes) {
        if (!scene || typeof scene !== 'object') {
          blockers.push('scene_record_invalid:' + chapter.id);
          continue;
        }
        if (!validId(scene.id) || !hasText(scene.title)) blockers.push('scene_metadata_invalid:' + scene.id);
        if (sceneIds.has(scene.id)) blockers.push('scene_id_duplicate:' + scene.id);
        sceneIds.add(scene.id);
        if (!validOrder(scene.order) || sceneOrders.has(scene.order)) blockers.push('scene_order_invalid:' + scene.id);
        sceneOrders.add(scene.order);
        let expectedAnchor: string | null = null;
        try {
          if (validId(manifest.bookId) && validId(part.id) && validId(chapter.id) && validId(scene.id)) {
            expectedAnchor = createSeerahSceneAnchorId(manifest.bookId, part.id, chapter.id, scene.id);
          }
        } catch { /* The corresponding ID blockers below are sufficient. */ }
        if (!expectedAnchor || scene.anchorId !== expectedAnchor) blockers.push('scene_anchor_not_stable:' + scene.id);
        if (anchorIds.has(scene.anchorId)) blockers.push('scene_anchor_duplicate:' + scene.id);
        anchorIds.add(scene.anchorId);
      }
    }
  }

  if (manifest.status === 'published' && manifest.parts.length === 0) blockers.push('published_book_empty');
  const uniqueBlockers = [...new Set(blockers)];
  return {
    valid: uniqueBlockers.length === 0,
    publishable: uniqueBlockers.length === 0 && manifest.status === 'published',
    blockers: uniqueBlockers
  };
}

export function getOrderedSeerahParts(manifest: SeerahBookManifest): SeerahPartIndexEntry[] {
  return [...manifest.parts].sort((a, b) => a.order - b.order);
}

export function getOrderedSeerahChapters(part: SeerahPartIndexEntry): SeerahChapterIndexEntry[] {
  return [...part.chapters].sort((a, b) => a.order - b.order);
}

export function getOrderedSeerahScenes(chapter: SeerahChapterIndexEntry): SeerahSceneIndexEntry[] {
  return [...chapter.scenes].sort((a, b) => a.order - b.order);
}
