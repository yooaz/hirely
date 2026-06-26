#!/usr/bin/env node
/**
 * CLASSIFICATION_ENGINE_V2 — precision-first; wrong bucket = failure, unknown = OK.
 */
import { classifyLineWithConfidence } from '../core/parsing/section-sanity.js';
import {
  classifySpecialtyLineV2,
  CLASSIFICATION_CONFIDENCE_MIN,
} from '../core/parsing/classification-engine-v2.js';
import { collectSectionsOrderAgnostic } from '../core/parsing/section-mapper.js';
import { enrichBlocksFromTop } from '../core/parsing/rich-parser.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function mustBucket(line, bucket, label) {
  const r = classifyLineWithConfidence(line);
  ok(r.bucket === bucket, `${label}: "${line}" → ${r.bucket} (expected ${bucket}, ${r.confidence}%)`);
  ok(
    r.confidence >= CLASSIFICATION_CONFIDENCE_MIN,
    `${label}: "${line}" confidence ${r.confidence}% >= ${CLASSIFICATION_CONFIDENCE_MIN}%`
  );
}

function mustNotBucket(line, badBucket, label) {
  const r = classifyLineWithConfidence(line);
  ok(r.bucket !== badBucket, `${label}: "${line}" must not be ${badBucket} (got ${r.bucket})`);
}

function mayBeUnknown(line, label) {
  const r = classifyLineWithConfidence(line);
  ok(
    r.bucket === 'unsorted' || r.confidence < CLASSIFICATION_CONFIDENCE_MIN,
    `${label}: "${line}" → ${r.bucket} @ ${r.confidence}% (unknown acceptable)`
  );
}

ok(CLASSIFICATION_CONFIDENCE_MIN === 80, 'confidence threshold is 80%');

// Reported misclassifications — must not leak
mustBucket('Branding, Illustration, Packaging', 'skills', 'skills not clients');
mustNotBucket('Branding, Illustration, Packaging', 'clients', 'skills not clients');

mustBucket('French — native', 'languages', 'language not tools');
mustBucket('English — fluent', 'languages', 'language not tools');
mustNotBucket('French — native', 'tools', 'language not tools');

mustBucket('LISAA — Bachelor Design', 'education', 'education not clients');
mustBucket('Créapole — Master Visual Communication', 'education', 'education not clients');
mustNotBucket('LISAA — Bachelor Design', 'clients', 'education not clients');

mustNotBucket('Music, Movies, Gaming', 'languages', 'interests not languages');
const interestHit = classifySpecialtyLineV2('Music, Movies, Gaming');
ok(
  interestHit?.bucket === 'interests' || interestHit?.bucket === 'unsorted',
  `interests line specialty → ${interestHit?.bucket || 'null'}`
);

// Strict allowlist positives
mustBucket('Nike', 'clients', 'client Nike');
mustBucket('Photoshop', 'tools', 'tool Photoshop');
mustBucket('Figma, Illustrator, Photoshop', 'tools', 'tool list');
mustBucket(
  'Illustration, Graphic Design, Visual Identity, Poster Design, Packaging',
  'skills',
  'skill cluster'
);

// Reject forced wrong categories
mayBeUnknown('Drawing', 'non-listed skill term');
mayBeUnknown('Random vague sentence without structure', 'ambiguous prose');

const CREATIVE = `Yohann Azancot
Graphic Designer & Illustrator

Education
LISAA — Web & Motion Design Créapole — Visual Communication

Skills
Illustration, Graphic Design, Visual Identity, Packaging, Art Direction

Tools
Photoshop, Illustrator, InDesign

Languages
French — native
English — fluent

Clients
Nike, Marvel, Cadillac
`;

const blocks = collectSectionsOrderAgnostic(CREATIVE, enrichBlocksFromTop);
ok(!(blocks.clients || []).some((l) => /illustration/i.test(l) && /packaging/i.test(l)), 'skills block not in clients');
ok(!(blocks.tools || []).some((l) => /french/i.test(l)), 'languages not in tools');
ok((blocks.education || []).some((l) => /LISAA/i.test(l)), 'LISAA in education');
ok(!(blocks.clients || []).some((l) => /LISAA/i.test(l)), 'LISAA not in clients');
ok((blocks.skills || []).some((l) => /Illustration/i.test(l)), 'skills populated');
ok((blocks.languages || []).some((l) => /French/i.test(l)), 'languages populated');
ok((blocks.tools || []).some((l) => /Photoshop/i.test(l)), 'tools populated');
ok((blocks.clients || []).some((l) => /Nike/i.test(l)), 'clients populated');

process.exit(failed ? 1 : 0);
