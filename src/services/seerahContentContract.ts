export type SeerahClaimReviewStatus = 'draft' | 'verified' | 'disputed' | 'rejected';
export type SeerahEditorialReviewStatus = 'pending' | 'approved' | 'rejected';
export type SeerahChapterStatus = 'draft' | 'in_review' | 'approved' | 'published';
export type SeerahSourceRightsStatus = 'verified_public_domain' | 'licensed_for_use' | 'link_only' | 'permission_required' | 'unknown';

export interface SeerahSourceReference {
  id: string;
  title: string;
  author: string;
  work: string;
  edition: string;
  locator: string;
  rightsStatus: SeerahSourceRightsStatus;
  rightsNotes?: string;
  url?: string;
}

export interface SeerahClaim {
  id: string;
  statement: string;
  sourceIds: string[];
  reviewStatus: SeerahClaimReviewStatus;
  confidence: 'high' | 'medium' | 'low';
}

export type SeerahBodyBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'paragraph' | 'context_note'; text: string; claimIds: string[] }
  | { id: string; type: 'quote_verified'; text: string; claimIds: string[]; exactWordingVerified: boolean };

export interface SeerahScene {
  id: string;
  title: string;
  bodyBlocks: SeerahBodyBlock[];
}

export interface SeerahEditorialReviews {
  scientific: SeerahEditorialReviewStatus;
  language: SeerahEditorialReviewStatus;
  narrativeContinuity: SeerahEditorialReviewStatus;
  accessibility: SeerahEditorialReviewStatus;
}

export interface SeerahChapterContent {
  id: string;
  contentVersion: string;
  status: SeerahChapterStatus;
  sources: SeerahSourceReference[];
  claims: SeerahClaim[];
  scenes: SeerahScene[];
  reviews: SeerahEditorialReviews;
}

export interface SeerahPublicationValidation {
  publishable: boolean;
  blockers: string[];
}

const REQUIRED_REVIEWS: Array<keyof SeerahEditorialReviews> = [
  'scientific',
  'language',
  'narrativeContinuity',
  'accessibility'
];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

/**
 * Validates the editorial evidence required before a chapter can be published.
 * This is a content contract only: it does not determine historical truth.
 */
export function validateSeerahChapterForPublication(
  chapter: SeerahChapterContent
): SeerahPublicationValidation {
  const blockers: string[] = [];
  if (!chapter || typeof chapter !== 'object' ||
      !Array.isArray(chapter.sources) || !Array.isArray(chapter.claims) ||
      !Array.isArray(chapter.scenes) || !chapter.reviews || typeof chapter.reviews !== 'object') {
    return { publishable: false, blockers: ['chapter_structure_invalid'] };
  }
  const sourceIds = new Set(chapter.sources.map(source => source.id));
  const claimIds = new Set(chapter.claims.map(claim => claim.id));
  const blockIds = new Set<string>();
  const sceneIds = new Set<string>();
  const bodyClaimIds = new Set<string>();

  if (!hasText(chapter.id)) blockers.push('chapter_id_missing');
  if (!hasText(chapter.contentVersion)) blockers.push('content_version_missing');
  if (chapter.scenes.length === 0) blockers.push('chapter_has_no_scenes');
  if (!uniqueIds(chapter.sources.map(source => source.id))) blockers.push('duplicate_source_id');
  if (!uniqueIds(chapter.claims.map(claim => claim.id))) blockers.push('duplicate_claim_id');

  for (const source of chapter.sources) {
    if (!source || typeof source !== 'object') {
      blockers.push('source_record_invalid');
      continue;
    }
    if (!hasText(source.id) || !hasText(source.title) || !hasText(source.author) ||
        !hasText(source.work) || !hasText(source.edition) || !hasText(source.locator)) {
      blockers.push(`source_metadata_incomplete:${source.id || 'unknown'}`);
    }
    if (!['verified_public_domain', 'licensed_for_use', 'link_only', 'permission_required', 'unknown'].includes(source.rightsStatus)) {
      blockers.push(`source_rights_status_invalid:${source.id || 'unknown'}`);
    }
    if (!['verified_public_domain', 'licensed_for_use', 'link_only'].includes(source.rightsStatus)) {
      blockers.push(`source_rights_not_cleared:${source.id}`);
    }
    if (!hasText(source.rightsNotes)) {
      blockers.push(`source_rights_basis_missing:${source.id}`);
    }
  }

  for (const claim of chapter.claims) {
    if (!claim || typeof claim !== 'object') {
      blockers.push('claim_record_invalid');
      continue;
    }
    if (!hasText(claim.id) || !hasText(claim.statement)) blockers.push(`claim_incomplete:${claim.id || 'unknown'}`);
    if (!Array.isArray(claim.sourceIds)) {
      blockers.push(`claim_sources_invalid:${claim.id || 'unknown'}`);
      continue;
    }
    if (!['high', 'medium', 'low'].includes(claim.confidence)) blockers.push(`claim_confidence_invalid:${claim.id || 'unknown'}`);
    if (!['draft', 'verified', 'disputed', 'rejected'].includes(claim.reviewStatus)) blockers.push(`claim_review_status_invalid:${claim.id || 'unknown'}`);
    if (claim.sourceIds.length === 0) blockers.push(`claim_without_sources:${claim.id}`);
    if (!uniqueIds(claim.sourceIds)) blockers.push(`claim_has_duplicate_sources:${claim.id}`);
    for (const sourceId of claim.sourceIds) {
      if (!sourceIds.has(sourceId)) blockers.push(`claim_source_missing:${claim.id}:${sourceId}`);
    }
    if (claim.reviewStatus !== 'verified') blockers.push(`claim_not_verified:${claim.id}`);
  }

  for (const scene of chapter.scenes) {
    if (!scene || typeof scene !== 'object') {
      blockers.push('scene_record_invalid');
      continue;
    }
    if (!hasText(scene.id) || !hasText(scene.title)) blockers.push(`scene_incomplete:${scene.id || 'unknown'}`);
    if (sceneIds.has(scene.id)) blockers.push(`duplicate_scene_id:${scene.id}`);
    sceneIds.add(scene.id);
    if (!Array.isArray(scene.bodyBlocks)) {
      blockers.push(`scene_body_blocks_invalid:${scene.id || 'unknown'}`);
      continue;
    }
    if (scene.bodyBlocks.length === 0) blockers.push(`scene_has_no_body_blocks:${scene.id}`);

    for (const block of scene.bodyBlocks) {
      if (!block || typeof block !== 'object') {
        blockers.push(`body_block_record_invalid:${scene.id || 'unknown'}`);
        continue;
      }
      if (!hasText(block.id) || !hasText(block.text)) blockers.push(`body_block_incomplete:${block.id || 'unknown'}`);
      if (blockIds.has(block.id)) blockers.push(`duplicate_body_block_id:${block.id}`);
      blockIds.add(block.id);

      if (block.type === 'heading') continue;
      const blockType: unknown = (block as { type?: unknown }).type;
      if (blockType !== 'paragraph' && blockType !== 'context_note' && blockType !== 'quote_verified') {
        blockers.push(`body_block_type_invalid:${block.id || 'unknown'}`);
        continue;
      }
      if (!Array.isArray(block.claimIds)) {
        blockers.push(`body_block_claims_invalid:${block.id || 'unknown'}`);
        continue;
      }
      if (block.claimIds.length === 0) blockers.push(`body_block_without_claims:${block.id}`);
      if (!uniqueIds(block.claimIds)) blockers.push(`body_block_duplicate_claims:${block.id}`);
      for (const claimId of block.claimIds) {
        bodyClaimIds.add(claimId);
        if (!claimIds.has(claimId)) blockers.push(`body_block_claim_missing:${block.id}:${claimId}`);
      }
      if (block.type === 'quote_verified') {
        if (block.exactWordingVerified !== true) blockers.push(`quote_wording_not_verified:${block.id}`);
        const quoteSourceIds = block.claimIds.flatMap(claimId =>
          chapter.claims.find(claim => claim.id === claimId)?.sourceIds ?? []
        );
        for (const sourceId of quoteSourceIds) {
          const source = chapter.sources.find(candidate => candidate.id === sourceId);
          if (source && source.rightsStatus !== 'verified_public_domain' && source.rightsStatus !== 'licensed_for_use') {
            blockers.push(`quote_source_rights_not_cleared:${block.id}:${sourceId}`);
          }
        }
      }
    }
  }

  if (chapter.status !== 'approved' && chapter.status !== 'published') blockers.push('chapter_not_approved_for_publication');
  for (const review of REQUIRED_REVIEWS) {
    if (chapter.reviews[review] !== 'approved') blockers.push(`editorial_review_not_approved:${review}`);
  }
  if (chapter.claims.length === 0) blockers.push('published_chapter_has_no_claims');
  for (const claim of chapter.claims) {
    if (!bodyClaimIds.has(claim.id)) blockers.push(`claim_not_used_in_narrative:${claim.id}`);
  }

  const uniqueBlockers = [...new Set(blockers)];
  return { publishable: uniqueBlockers.length === 0, blockers: uniqueBlockers };
}
