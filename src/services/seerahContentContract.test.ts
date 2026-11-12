import {
  SeerahChapterContent,
  validateSeerahChapterForPublication
} from './seerahContentContract';

function validChapter(): SeerahChapterContent {
  return {
    id: 'chapter-1',
    contentVersion: '1.0.0',
    status: 'published',
    sources: [{
      id: 'source-1',
      title: 'مرجع تجريبي',
      author: 'مؤلف تجريبي',
      work: 'عمل تجريبي',
      edition: 'طبعة تجريبية',
      locator: 'موضع تجريبي'
    }],
    claims: [{
      id: 'claim-1',
      statement: 'ادعاء اختباري لا يمثل معلومة تاريخية.',
      sourceIds: ['source-1'],
      reviewStatus: 'verified',
      confidence: 'high'
    }],
    scenes: [{
      id: 'scene-1',
      title: 'مشهد اختباري',
      bodyBlocks: [{
        id: 'block-1',
        type: 'paragraph',
        text: 'نص اختباري لا ينشر.',
        claimIds: ['claim-1']
      }]
    }],
    reviews: {
      scientific: 'approved',
      language: 'approved',
      narrativeContinuity: 'approved',
      accessibility: 'approved'
    }
  };
}

export function runSeerahContentContractTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };

  test('A fully sourced and reviewed chapter satisfies the publication gate', () => {
    const result = validateSeerahChapterForPublication(validChapter());
    if (!result.publishable || result.blockers.length) throw new Error('Valid chapter was blocked: ' + result.blockers.join(','));
  });

  test('Unverified or disputed claims cannot pass publication validation', () => {
    const chapter = validChapter();
    chapter.claims[0].reviewStatus = 'disputed';
    const result = validateSeerahChapterForPublication(chapter);
    if (result.publishable || !result.blockers.includes('claim_not_verified:claim-1')) throw new Error('Disputed claim was not blocked');
  });

  test('Every body block must point to an existing claim and every claim to a source', () => {
    const chapter = validChapter();
    chapter.scenes[0].bodyBlocks[0].claimIds = ['missing-claim'];
    chapter.claims[0].sourceIds = ['missing-source'];
    const result = validateSeerahChapterForPublication(chapter);
    if (!result.blockers.includes('body_block_claim_missing:block-1:missing-claim')) throw new Error('Missing claim reference was not detected');
    if (!result.blockers.includes('claim_source_missing:claim-1:missing-source')) throw new Error('Missing source reference was not detected');
  });

  test('A quotation is blocked unless exact wording has been verified', () => {
    const chapter = validChapter();
    chapter.scenes[0].bodyBlocks[0] = {
      id: 'quote-1',
      type: 'quote_verified',
      text: 'صياغة مقتبسة للاختبار فقط',
      claimIds: ['claim-1'],
      exactWordingVerified: false
    };
    const result = validateSeerahChapterForPublication(chapter);
    if (!result.blockers.includes('quote_wording_not_verified:quote-1')) throw new Error('Unverified quotation was not blocked');
  });

  test('Publication requires all independent editorial reviews', () => {
    const chapter = validChapter();
    chapter.reviews.narrativeContinuity = 'pending';
    const result = validateSeerahChapterForPublication(chapter);
    if (!result.blockers.includes('editorial_review_not_approved:narrativeContinuity')) throw new Error('Narrative review was not required');
  });

  test('Source references require edition and exact locator metadata', () => {
    const chapter = validChapter();
    chapter.sources[0].locator = '';
    const result = validateSeerahChapterForPublication(chapter);
    if (!result.blockers.includes('source_metadata_incomplete:source-1')) throw new Error('Incomplete citation metadata was accepted');
  });

  return { passed, failed };
}
