import {
  createSeerahSceneAnchorId,
  getOrderedSeerahChapters,
  getOrderedSeerahParts,
  getOrderedSeerahScenes,
  SeerahBookManifest,
  validateSeerahBookManifest
} from './seerahBookManifest';

function validManifest(): SeerahBookManifest {
  const bookId = 'seerah-book';
  const partId = 'part-one';
  const chapterId = 'chapter-one';
  const sceneId = 'scene-one';
  return {
    schemaVersion: 1,
    bookId,
    contentVersion: '2026.11.12.1',
    status: 'published',
    parts: [{
      id: partId,
      title: 'جزء اختباري',
      order: 1,
      chapters: [{
        id: chapterId,
        title: 'فصل اختباري',
        order: 1,
        scenes: [{
          id: sceneId,
          title: 'مشهد اختباري',
          order: 1,
          anchorId: createSeerahSceneAnchorId(bookId, partId, chapterId, sceneId)
        }]
      }]
    }]
  };
}

export function runSeerahBookManifestTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };

  test('A structurally valid published book manifest passes', () => {
    const result = validateSeerahBookManifest(validManifest());
    if (!result.valid || !result.publishable || result.blockers.length) throw new Error(result.blockers.join(','));
  });

  test('Stable anchors depend on IDs rather than titles or content version', () => {
    const before = validManifest();
    const after = validManifest();
    after.contentVersion = '2026.12.01.1';
    after.parts[0].title = 'عنوان محرر جديد';
    after.parts[0].chapters[0].scenes[0].title = 'عنوان مشهد جديد';
    const a = before.parts[0].chapters[0].scenes[0].anchorId;
    const b = after.parts[0].chapters[0].scenes[0].anchorId;
    if (a !== b) throw new Error('Title/version changes must not change a stable scene anchor');
  });

  test('Duplicate IDs, order values and anchors are rejected', () => {
    const manifest = validManifest();
    manifest.parts.push({ ...manifest.parts[0], id: 'part-two' });
    const result = validateSeerahBookManifest(manifest);
    if (!result.blockers.includes('scene_anchor_duplicate:scene-one') ||
        !result.blockers.includes('chapter_id_duplicate:chapter-one') ||
        !result.blockers.includes('part_order_invalid:part-two')) {
      throw new Error('Duplicate manifest identities/order were not rejected');
    }
  });

  test('Malformed imported manifests fail closed', () => {
    for (const value of [null, {}, { ...validManifest(), parts: null }, {
      ...validManifest(),
      parts: [{ ...validManifest().parts[0], chapters: [{ id: 'bad', title: 'bad', order: 1, scenes: null }] }]
    }]) {
      const result = validateSeerahBookManifest(value);
      if (result.valid || result.blockers.length === 0) throw new Error('Malformed manifest passed');
    }
  });

  test('Published books cannot contain empty parts or chapters', () => {
    const manifest = validManifest();
    manifest.parts[0].chapters[0].scenes = [];
    const result = validateSeerahBookManifest(manifest);
    if (result.publishable || !result.blockers.includes('published_chapter_empty:chapter-one')) {
      throw new Error('A published empty chapter was accepted');
    }
    manifest.parts[0].chapters = [];
    const emptyPart = validateSeerahBookManifest(manifest);
    if (!emptyPart.blockers.includes('published_part_empty:part-one')) {
      throw new Error('A published empty part was accepted');
    }
  });

  test('Draft manifests are valid drafts but cannot be published', () => {
    const manifest = validManifest();
    manifest.status = 'draft';
    const result = validateSeerahBookManifest(manifest);
    if (!result.valid || result.publishable) throw new Error('Draft manifest publication status is incorrect');
  });

  test('Reader order is explicit and independent from source array order', () => {
    const manifest = validManifest();
    manifest.parts.push({ ...manifest.parts[0], id: 'part-two', order: 2, chapters: [] });
    manifest.parts.reverse();
    if (getOrderedSeerahParts(manifest)[0].id !== 'part-one') throw new Error('Part order was not normalized');
    const chapters = [...manifest.parts[0].chapters, { id: 'chapter-two', title: 'فصل 2', order: 2, scenes: [] }];
    const sortedChapters = getOrderedSeerahChapters({ ...manifest.parts[0], chapters: chapters.reverse() });
    if (sortedChapters[0].id !== 'chapter-one') throw new Error('Chapter order was not normalized');
    const scenes = [{ id: 'scene-two', title: 'مشهد 2', order: 2, anchorId: 'anchor-2' }, ...manifest.parts[0].chapters[0].scenes];
    if (getOrderedSeerahScenes({ ...manifest.parts[0].chapters[0], scenes })[0].id !== 'scene-one') {
      throw new Error('Scene order was not normalized');
    }
  });

  test('Unsafe stable IDs cannot create anchors', () => {
    let rejected = false;
    try { createSeerahSceneAnchorId('book id', 'part', 'chapter', 'scene'); }
    catch { rejected = true; }
    if (!rejected) throw new Error('Unsafe IDs were accepted');
  });

  return { passed, failed };
}
