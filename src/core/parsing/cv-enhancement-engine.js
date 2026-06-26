/**
 * CV Enhancement Engine — post-extraction quality improvement.
 * Detects weak copy, repetitions, missing verbs, bad formatting, thin achievements.
 * Produces before/after snapshots — rewrites existing content only (never invents).
 */

import {
  rewriteResumeExperiences,
  rewriteExperienceDescription,
  collectOriginalDescription,
  CV_EXPERIENCE_REWRITE,
  PROFESSIONAL_DESCRIPTION_MIN_LEN,
} from './cv-experience-rewrite.js';
import {
  buildSafeRewriteRecord,
  applySafeRewriteGate,
  SAFE_REWRITE_CONFIDENCE_MIN,
} from './safe-rewrite-validation.js';

export const CV_ENHANCEMENT_ENGINE = 'CV_ENHANCEMENT_ENGINE_V2';

export const ISSUE_TYPES = Object.freeze({
  WEAK_DESCRIPTION: 'weak_description',
  REPETITION: 'repetition',
  MISSING_ACTION_VERB: 'missing_action_verb',
  BAD_FORMATTING: 'bad_formatting',
  MISSING_ACHIEVEMENT: 'missing_achievement',
});

const VERB_START_RE =
  /^(led|built|shipped|managed|created|collaborated|directed|produced|delivered|launched|scaled|facilitated|reduced|improved|designed|developed|implemented|oversaw|coordinated|spearheaded|drove|optimized|established|mentored|supported|analyzed|conducted|prepared|executed|handled|maintained|streamlined|crafted|illustrated|edited|advised|guided|partnered|owned|grew|increased|decreased|transformed|automated|migrated|served|held)\b/i;

const BAD_FORMAT_RE =
  /—\s*—\s*—|\s{3,}|\.\.|,\s*,|;\s*;|[-–—]{3,}|^\s*[-•*]\s*$/m;

function cleanLine(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeFormatting(text) {
  let s = String(text || '');
  if (!s.trim()) return s;
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/\.{2,}/g, '.');
  s = s.replace(/,\s*,/g, ', ');
  s = s.replace(/—\s*—+/g, '—');
  s = s.replace(/[-–]\s*[-–]/g, '–');
  s = s.replace(/\s*([,;])\s*/g, '$1 ');
  s = s.replace(/\s+([.!?])/g, '$1');
  if (s.length > 12 && !/[.!?]$/.test(s) && !/\d{4}\s*[-–—]/.test(s)) {
    s += '.';
  }
  return s.trim();
}

function hasActionVerb(text) {
  const s = cleanLine(text);
  if (!s) return false;
  if (VERB_START_RE.test(s)) return true;
  return /\b(led|built|managed|created|delivered|designed|developed|implemented|oversaw|coordinated|spearheaded|drove|optimized|established|increased|reduced|improved)\b/i.test(s);
}

function isWeakDescription(text) {
  const s = cleanLine(text);
  if (!s) return true;
  if (s.length < PROFESSIONAL_DESCRIPTION_MIN_LEN) return true;
  if (!hasActionVerb(s) && s.split(/[.!?]/).filter(Boolean).every((frag) => frag.trim().split(/\s+/).length <= 4)) {
    return true;
  }
  return false;
}

function experienceLabel(exp) {
  return [exp?.role, exp?.company, exp?.dates].filter(Boolean).join(' · ') || 'Experience';
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 */
export function detectCvEnhancementIssues(resumeData = {}) {
  /** @type {Array<{ type: string, section: string, field: string, message: string, before?: string }>} */
  const issues = [];

  const summary = cleanLine(resumeData.summary);
  if (summary) {
    if (isWeakDescription(summary)) {
      issues.push({
        type: ISSUE_TYPES.WEAK_DESCRIPTION,
        section: 'summary',
        field: 'summary',
        message: 'Summary is short or lacks professional framing',
        before: summary,
      });
    }
    if (!hasActionVerb(summary) && summary.length >= 20) {
      issues.push({
        type: ISSUE_TYPES.MISSING_ACTION_VERB,
        section: 'summary',
        field: 'summary',
        message: 'Summary has no action verb',
        before: summary,
      });
    }
    if (BAD_FORMAT_RE.test(summary)) {
      issues.push({
        type: ISSUE_TYPES.BAD_FORMATTING,
        section: 'summary',
        field: 'summary',
        message: 'Summary has formatting noise',
        before: summary,
      });
    }
  }

  const listFields = ['skills', 'tools', 'languages', 'clients'];
  for (const field of listFields) {
    const items = (resumeData[field] || []).map((x) => cleanLine(x)).filter(Boolean);
    const seen = new Map();
    for (const item of items) {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        issues.push({
          type: ISSUE_TYPES.REPETITION,
          section: field,
          field,
          message: `Duplicate ${field} entry`,
          before: item,
        });
      } else {
        seen.set(key, item);
      }
    }
  }

  for (const exp of resumeData.experiences || []) {
    const label = experienceLabel(exp);
    const original = collectOriginalDescription(exp);
    const rewritten = cleanLine(exp.rewrittenDescription || exp.description || '');

    if (BAD_FORMAT_RE.test(`${exp.role || ''} ${exp.company || ''} ${exp.dates || ''} ${original}`)) {
      issues.push({
        type: ISSUE_TYPES.BAD_FORMATTING,
        section: 'experience',
        field: label,
        message: 'Experience line has formatting noise',
        before: original || label,
      });
    }

    const hasBullets = (exp.bullets || []).some((b) => cleanLine(b).length >= 8);
    if (!hasBullets && isWeakDescription(original || rewritten)) {
      issues.push({
        type: ISSUE_TYPES.MISSING_ACHIEVEMENT,
        section: 'experience',
        field: label,
        message: 'Experience lacks achievement bullets or professional description',
        before: original || label,
      });
    }

    if (original && isWeakDescription(original)) {
      issues.push({
        type: ISSUE_TYPES.WEAK_DESCRIPTION,
        section: 'experience',
        field: label,
        message: 'Experience description is fragmentary or too short',
        before: original,
      });
    }

    if (original && !hasActionVerb(original) && original.length >= 12) {
      issues.push({
        type: ISSUE_TYPES.MISSING_ACTION_VERB,
        section: 'experience',
        field: label,
        message: 'Experience description missing action verb',
        before: original,
      });
    }

    const bulletSeen = new Set();
    for (const bullet of exp.bullets || []) {
      const b = cleanLine(bullet);
      if (!b) continue;
      const key = b.toLowerCase();
      if (bulletSeen.has(key)) {
        issues.push({
          type: ISSUE_TYPES.REPETITION,
          section: 'experience',
          field: label,
          message: 'Duplicate experience bullet',
          before: b,
        });
      } else {
        bulletSeen.add(key);
      }
    }
  }

  return issues;
}

function dedupeList(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const s = cleanLine(item);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Rewrite summary using only words from source (join fragments, add verbs via safe gate).
 * @param {string} summary
 */
export function enhanceSummaryText(summary) {
  const before = cleanLine(summary);
  if (!before) return { before: '', after: '', changed: false, record: null };

  let candidate = normalizeFormatting(before);

  if (isWeakDescription(candidate)) {
    const fragments = candidate
      .split(/\n+|\s*[-•*]\s+|\s*[.·;]\s+/)
      .map(cleanLine)
      .filter((s) => s.length > 1);

    if (fragments.length >= 2 && fragments.every((f) => f.split(/\s+/).length <= 6)) {
      const joined = fragments
        .map((f, i) => (i === 0 ? f.charAt(0).toUpperCase() + f.slice(1) : f.toLowerCase()))
        .join(', ')
        .replace(/,\s*and\b/i, ' and');
      candidate = `Delivered work spanning ${joined}.`;
    } else if (!VERB_START_RE.test(candidate)) {
      candidate = `Led ${candidate.charAt(0).toLowerCase() + candidate.slice(1)}`;
      if (!/[.!?]$/.test(candidate)) candidate += '.';
      candidate = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  } else {
    candidate = normalizeFormatting(candidate);
  }

  const record = buildSafeRewriteRecord({
    originalText: before,
    rewrittenText: candidate,
    sourceSection: 'summary',
    sourceConfidence: before.length >= 40 ? 82 : 68,
    context: {},
  });
  const gated = applySafeRewriteGate(record);
  const after = gated.text;
  return {
    before,
    after,
    changed: after !== before,
    record: gated.record,
    suggestion: gated.suggestion,
  };
}

function snapshotResumeContent(resumeData) {
  return {
    summary: cleanLine(resumeData.summary),
    experiences: (resumeData.experiences || []).map((exp) => ({
      role: cleanLine(exp.role),
      company: cleanLine(exp.company),
      dates: cleanLine(exp.dates),
      description: cleanLine(exp.description || exp.rewrittenDescription),
      originalDescription: cleanLine(exp.originalDescription || collectOriginalDescription(exp)),
      bullets: (exp.bullets || []).map(cleanLine).filter(Boolean),
    })),
    skills: [...(resumeData.skills || [])].map(cleanLine).filter(Boolean),
    tools: [...(resumeData.tools || [])].map(cleanLine).filter(Boolean),
  };
}

function countIssueTypes(issues) {
  const counts = {};
  for (const type of Object.values(ISSUE_TYPES)) counts[type] = 0;
  for (const issue of issues) {
    counts[issue.type] = (counts[issue.type] || 0) + 1;
  }
  return counts;
}

/**
 * Run full CV enhancement — detect, fix, produce before/after report.
 * @param {import('../resume-data.js').ResumeData} resumeData
 */
export function runCvEnhancementEngine(resumeData) {
  if (!resumeData || typeof resumeData !== 'object') return resumeData;

  const beforeSnapshot = snapshotResumeContent(resumeData);
  const issuesBefore = detectCvEnhancementIssues(resumeData);

  /** @type {Array<{ section: string, field: string, before: string, after: string, type: string }>} */
  const changes = [];

  if (resumeData.summary) {
    const summaryFix = enhanceSummaryText(resumeData.summary);
    if (summaryFix.changed) {
      changes.push({
        section: 'summary',
        field: 'summary',
        type: ISSUE_TYPES.WEAK_DESCRIPTION,
        before: summaryFix.before,
        after: summaryFix.after,
      });
      resumeData.summary = summaryFix.after;
    } else if (summaryFix.before !== normalizeFormatting(summaryFix.before)) {
      resumeData.summary = normalizeFormatting(summaryFix.before);
    }
  }

  resumeData.skills = dedupeList(resumeData.skills);
  resumeData.tools = dedupeList(resumeData.tools);
  resumeData.languages = dedupeList(resumeData.languages);
  resumeData.clients = dedupeList(resumeData.clients);

  for (const exp of resumeData.experiences || []) {
    if (exp.role) exp.role = normalizeFormatting(exp.role);
    if (exp.company) exp.company = normalizeFormatting(exp.company);
    if (exp.dates) exp.dates = normalizeFormatting(exp.dates);
    if (exp.bullets?.length) {
      exp.bullets = dedupeList(exp.bullets).map(normalizeFormatting);
    }
  }

  rewriteResumeExperiences(resumeData);

  for (const exp of resumeData.experiences || []) {
    const beforeDesc = beforeSnapshot.experiences.find(
      (e) => e.role === cleanLine(exp.role) && e.company === cleanLine(exp.company)
    );
    const beforeText = beforeDesc?.originalDescription || beforeDesc?.description || '';
    const afterText = cleanLine(exp.rewrittenDescription || exp.description || '');
    if (beforeText && afterText && beforeText !== afterText) {
      changes.push({
        section: 'experience',
        field: experienceLabel(exp),
        type: ISSUE_TYPES.WEAK_DESCRIPTION,
        before: beforeText,
        after: afterText,
      });
    }
  }

  const afterSnapshot = snapshotResumeContent(resumeData);
  const issuesAfter = detectCvEnhancementIssues(resumeData);

  resumeData.meta = {
    ...(resumeData.meta || {}),
    cvEnhancement: {
      engine: CV_ENHANCEMENT_ENGINE,
      experienceRewriteEngine: CV_EXPERIENCE_REWRITE,
      safeRewriteMin: SAFE_REWRITE_CONFIDENCE_MIN,
      enhancedAt: new Date().toISOString(),
      issuesDetected: issuesBefore.length,
      issuesRemaining: issuesAfter.length,
      issuesFixed: Math.max(0, issuesBefore.length - issuesAfter.length),
      issueCountsBefore: countIssueTypes(issuesBefore),
      issueCountsAfter: countIssueTypes(issuesAfter),
      changes,
      before: beforeSnapshot,
      after: afterSnapshot,
      issues: issuesBefore,
      remainingIssues: issuesAfter,
    },
  };

  return resumeData;
}

export {
  rewriteExperienceDescription,
  rewriteResumeExperiences,
  collectOriginalDescription,
};
