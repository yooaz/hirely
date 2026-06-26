/**
 * CV parse benchmark metrics — pure scoring helpers.
 */

import { CV_SECTION } from '../../src/core/parsing/section-heading-dictionary.js';
import { normalizeCompareString } from '../../src/core/parsing/dedupe-engine.js';
import { isSkillsSectionPollution } from '../../src/core/parsing/skills-section-pollution-filter.js';
import { extractContactFromParseContext } from '../../src/core/parsing/cv-parse-confidence.js';

const SECTION_KEY_MAP = {
  contact: CV_SECTION.CONTACT,
  summary: CV_SECTION.SUMMARY,
  experience: CV_SECTION.EXPERIENCE,
  education: CV_SECTION.EDUCATION,
  skills: CV_SECTION.SKILLS,
  languages: CV_SECTION.LANGUAGES,
  interests: CV_SECTION.INTERESTS,
  certifications: CV_SECTION.CERTIFICATIONS,
  projects: CV_SECTION.PROJECTS,
};

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

function includesFold(hay, needle) {
  return String(hay || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

/**
 * Header region detection — name/email present in top lines or recovered contact.
 * @param {object} contact
 * @param {object[]} extractionLines
 * @param {object} expected
 */
export function measureHeaderDetectionRate(contact = {}, extractionLines = [], expected = {}) {
  const topBlob = (extractionLines || [])
    .slice(0, 10)
    .map((l) => String(l?.text ?? l ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const name = String(contact?.name || '').trim();
  const hasValidName =
    name.length >= 3 && !/confirmer|vérifier|confirm|non détectée|information non/i.test(name);

  const checks = [];
  if (expected.name) {
    const nameInHeader =
      includesFold(topBlob, expected.name) || includesFold(name, expected.name);
    checks.push({
      field: 'name_in_header',
      pass: hasValidName && nameInHeader,
      expected: expected.name,
      actual: name,
      header_snippet: topBlob.slice(0, 120),
    });
  } else if (hasValidName) {
    checks.push({ field: 'name_present', pass: true, actual: name });
  }

  if (expected.email) {
    const email = String(contact?.email || '').toLowerCase();
    checks.push({
      field: 'email_in_contact',
      pass: email === expected.email.toLowerCase(),
      expected: expected.email,
      actual: contact?.email || '',
    });
  }

  const passed = checks.filter((c) => c.pass).length;
  return {
    score: checks.length ? round4(passed / checks.length) : hasValidName ? 1 : 0,
    passed,
    total: checks.length,
    checks,
  };
}

/**
 * @param {object} extracted
 * @param {object} expected
 */
export function measureContactAccuracy(extracted, expected = {}) {
  const checks = [];
  if (expected.name) {
    checks.push({
      field: 'name',
      pass: includesFold(extracted?.name, expected.name),
      expected: expected.name,
      actual: extracted?.name || '',
    });
  }
  if (expected.email) {
    checks.push({
      field: 'email',
      pass: String(extracted?.email || '').toLowerCase() === expected.email.toLowerCase(),
      expected: expected.email,
      actual: extracted?.email || '',
    });
  }
  if (expected.phone_contains) {
    const digits = String(extracted?.phone || '').replace(/\D/g, '');
    checks.push({
      field: 'phone',
      pass: digits.includes(String(expected.phone_contains).replace(/\D/g, '')),
      expected: expected.phone_contains,
      actual: extracted?.phone || '',
    });
  }
  if (expected.address_contains) {
    const loc = extracted?.location || extracted?.address || '';
    checks.push({
      field: 'address',
      pass: includesFold(loc, expected.address_contains),
      expected: expected.address_contains,
      actual: loc,
    });
  }
  const passed = checks.filter((c) => c.pass).length;
  return {
    score: checks.length ? round4(passed / checks.length) : 0,
    passed,
    total: checks.length,
    checks,
  };
}

/**
 * @param {object[]} segments
 * @param {string[]} expectedSectionKeys
 */
export function measureSectionDetectionAccuracy(segments = [], expectedSectionKeys = []) {
  const detected = new Set();
  for (const seg of segments) {
    if (seg.is_heading && seg.section) detected.add(seg.section);
    if (!seg.is_heading && seg.section && seg.section !== CV_SECTION.OTHER) {
      detected.add(seg.section);
    }
  }

  const checks = expectedSectionKeys.map((key) => {
    const sectionId = SECTION_KEY_MAP[key] || key;
    const pass = detected.has(sectionId);
    return { section: key, pass, sectionId };
  });

  const passed = checks.filter((c) => c.pass).length;
  return {
    score: checks.length ? round4(passed / checks.length) : 1,
    passed,
    total: checks.length,
    checks,
    detected_sections: [...detected],
  };
}

/**
 * Match parsed experience items against golden expectations (fuzzy).
 * @param {object[]} items
 * @param {object} [golden]
 * @param {object} [fallback]
 */
export function measureExperienceSegmentationAccuracy(items = [], golden = null, fallback = {}) {
  const expected = golden?.items || [];
  if (!expected.length) {
    const min = fallback.experience_min ?? 1;
    const count = items.length;
    const score = count >= min ? 1 : round4(count / Math.max(min, 1));
    return {
      score,
      matched: count,
      expected: min,
      mode: 'count_only',
      matches: [],
    };
  }

  const matches = [];
  for (const exp of expected) {
    const hit = items.find((item) => {
      const roleOk =
        !exp.job_title &&
        !exp.role_contains &&
        !(exp.company_contains || exp.company);
      const roleText = [item.job_title, item.company, ...(item.client || [])].join(' ');
      const roleMatch =
        roleOk ||
        (exp.job_title && includesFold(item.job_title, exp.job_title)) ||
        (exp.role_contains || []).every((r) => includesFold(roleText, r)) ||
        (exp.company_contains && includesFold(item.company, exp.company_contains));
      const dateOk =
        (!exp.dates_contains || includesFold(item.start_date, exp.dates_contains)) &&
        (!exp.dates_contains_end || includesFold(item.end_date, exp.dates_contains_end));
      return roleMatch && dateOk;
    });
    matches.push({ expected: exp, matched: !!hit, item: hit || null });
  }

  const matched = matches.filter((m) => m.matched).length;
  return {
    score: round4(matched / expected.length),
    matched,
    expected: expected.length,
    mode: 'golden',
    matches,
  };
}

/**
 * @param {object[]} items
 * @param {{ education_count_min?: number, education_count_max?: number, education_dedupe_max_duplicates?: number }} expect
 */
export function measureEducationDedupSuccess(items = [], expect = {}) {
  const min = expect.education_count_min ?? 1;
  const max = expect.education_count_max ?? min + 2;
  const maxDupes = expect.education_dedupe_max_duplicates ?? 0;

  const keys = items.map(
    (e) =>
      `${normalizeCompareString(e.school)}|${normalizeCompareString(e.degree)}|${e.start_date}|${e.end_date}`
  );
  const unique = new Set(keys);
  const duplicateCount = keys.length - unique.size;

  let countScore = 1;
  if (items.length < min) countScore = round4(items.length / min);
  else if (items.length > max) countScore = round4(max / items.length);

  const dedupeScore = duplicateCount <= maxDupes ? 1 : round4(maxDupes / Math.max(duplicateCount, 1));

  return {
    score: round4(countScore * 0.6 + dedupeScore * 0.4),
    count: items.length,
    unique_count: unique.size,
    duplicate_count: duplicateCount,
    count_in_range: items.length >= min && items.length <= max,
    min,
    max,
  };
}

/**
 * @param {object[]} skillItems
 * @param {string[]} [portfolioMarkers]
 */
export function measureSkillsPurity(skillItems = [], portfolioMarkers = []) {
  if (!skillItems.length) {
    return { score: 0, pure: 0, polluted: 0, total: 0, pollutants: [] };
  }

  const pollutants = [];
  for (const skill of skillItems) {
    const name = skill.name || '';
    const pollutedByFilter = isSkillsSectionPollution(name, { isSkillsSection: true });
    const pollutedByPortfolio = portfolioMarkers.some((m) => includesFold(name, m));
    if (pollutedByFilter || pollutedByPortfolio) {
      pollutants.push({ name, pollutedByFilter, pollutedByPortfolio });
    }
  }

  const pure = skillItems.length - pollutants.length;
  return {
    score: round4(pure / skillItems.length),
    pure,
    polluted: pollutants.length,
    total: skillItems.length,
    pollutants,
  };
}

/**
 * @param {object[]} segments
 */
export function measureUnclassifiedBlockRate(segments = []) {
  const contentSegs = segments.filter(
    (s) => !s.is_heading && String(s.text || '').trim().length >= 8
  );
  if (!contentSegs.length) {
    return { rate: 0, unclassified: 0, total: 0, score: 1 };
  }
  const unclassified = contentSegs.filter(
    (s) => s.section === CV_SECTION.OTHER || !s.section
  ).length;
  const rate = round4(unclassified / contentSegs.length);
  return {
    rate,
    unclassified,
    total: contentSegs.length,
    score: round4(1 - rate),
  };
}

/**
 * Portfolio captions leaking into structured resume fields.
 * @param {object} params
 */
export function measurePortfolioLeakage(params = {}) {
  const markers = params.portfolio_markers || [];
  if (!markers.length) {
    return { rate: 0, leaked: 0, total: 0, score: 1, leaks: [] };
  }

  const blobs = [];
  for (const exp of params.experienceItems || []) {
    blobs.push({
      section: 'experience',
      text: [exp.job_title, exp.company, ...(exp.client || []), ...(exp.description || [])].join(' '),
    });
  }
  for (const edu of params.educationItems || []) {
    blobs.push({
      section: 'education',
      text: [edu.school, edu.degree, ...(edu.description || [])].join(' '),
    });
  }
  for (const skill of params.skillItems || []) {
    blobs.push({ section: 'skills', text: skill.name || '' });
  }

  const leaks = blobs.filter((b) => markers.some((m) => includesFold(b.text, m)));
  const rate = blobs.length ? round4(leaks.length / blobs.length) : 0;
  return {
    rate,
    leaked: leaks.length,
    total: blobs.length,
    score: round4(1 - rate),
    leaks,
  };
}

/**
 * @param {object} detected — output from detectSectionBlocks
 * @param {object} fixture — registry fixture
 * @param {object} [goldens]
 */
export function computeFixtureMetrics(detected, fixture, goldens = {}) {
  const expect = fixture.expect || {};
  const segments = detected.sectionSegmentation?.segments || detected.resumeSegments || [];

  const contact =
    detected.parseConfidence?.contact ||
    extractContactFromParseContext({
      resumeSegments: detected.resumeSegments || segments,
      extractionLines: detected._extractionLines || [],
    });

  const contactMetric = measureContactAccuracy(contact, expect.contact || {});
  const headerMetric = measureHeaderDetectionRate(
    contact,
    detected._extractionLines || [],
    expect.contact || {}
  );
  const sectionMetric = measureSectionDetectionAccuracy(segments, expect.sections || []);
  const experienceMetric = measureExperienceSegmentationAccuracy(
    detected.experienceItems || [],
    goldens.experience,
    expect
  );
  const educationMetric = measureEducationDedupSuccess(detected.educationItems || [], expect);
  const skillsMetric = measureSkillsPurity(detected.skillItems || [], expect.portfolio_markers || []);
  const unclassifiedMetric = measureUnclassifiedBlockRate(segments);
  const portfolioMetric = measurePortfolioLeakage({
    experienceItems: detected.experienceItems,
    educationItems: detected.educationItems,
    skillItems: detected.skillItems,
    portfolio_markers: expect.portfolio_markers,
  });

  const metrics = {
    contact_accuracy: contactMetric.score,
    header_detection_rate: headerMetric.score,
    section_detection_accuracy: sectionMetric.score,
    experience_segmentation_accuracy: experienceMetric.score,
    education_deduplication_success: educationMetric.score,
    skills_purity: skillsMetric.score,
    unclassified_block_rate: unclassifiedMetric.rate,
    portfolio_leakage_rate: portfolioMetric.rate,
  };

  const thresholds = {
    contact_accuracy_min: expect.contact_accuracy_min ?? 0.6,
    header_detection_rate_min: expect.header_detection_rate_min ?? expect.contact_accuracy_min ?? 0.6,
    section_detection_accuracy_min: expect.section_detection_accuracy_min ?? 0.6,
    experience_segmentation_accuracy_min:
      expect.experience_segmentation_accuracy_min ?? expect.experience_golden_min_match ?? 0.5,
    education_deduplication_success_min: expect.education_deduplication_success_min ?? 0.7,
    skills_purity_min: expect.skills_purity_min ?? 0.85,
    unclassified_block_rate_max: expect.unclassified_block_rate_max ?? 0.35,
    portfolio_leakage_max: expect.portfolio_leakage_max ?? 0,
  };

  const checks = [
    {
      id: 'contact_accuracy',
      pass: metrics.contact_accuracy >= thresholds.contact_accuracy_min,
      value: metrics.contact_accuracy,
      threshold: thresholds.contact_accuracy_min,
      comparator: '>=',
    },
    {
      id: 'header_detection_rate',
      pass: metrics.header_detection_rate >= thresholds.header_detection_rate_min,
      value: metrics.header_detection_rate,
      threshold: thresholds.header_detection_rate_min,
      comparator: '>=',
    },
    {
      id: 'section_detection_accuracy',
      pass: metrics.section_detection_accuracy >= thresholds.section_detection_accuracy_min,
      value: metrics.section_detection_accuracy,
      threshold: thresholds.section_detection_accuracy_min,
      comparator: '>=',
    },
    {
      id: 'experience_segmentation_accuracy',
      pass: metrics.experience_segmentation_accuracy >= thresholds.experience_segmentation_accuracy_min,
      value: metrics.experience_segmentation_accuracy,
      threshold: thresholds.experience_segmentation_accuracy_min,
      comparator: '>=',
    },
    {
      id: 'education_deduplication_success',
      pass: metrics.education_deduplication_success >= thresholds.education_deduplication_success_min,
      value: metrics.education_deduplication_success,
      threshold: thresholds.education_deduplication_success_min,
      comparator: '>=',
    },
    {
      id: 'skills_purity',
      pass: metrics.skills_purity >= thresholds.skills_purity_min,
      value: metrics.skills_purity,
      threshold: thresholds.skills_purity_min,
      comparator: '>=',
    },
    {
      id: 'unclassified_block_rate',
      pass: metrics.unclassified_block_rate <= thresholds.unclassified_block_rate_max,
      value: metrics.unclassified_block_rate,
      threshold: thresholds.unclassified_block_rate_max,
      comparator: '<=',
    },
    {
      id: 'portfolio_leakage_rate',
      pass: metrics.portfolio_leakage_rate <= thresholds.portfolio_leakage_max,
      value: metrics.portfolio_leakage_rate,
      threshold: thresholds.portfolio_leakage_max,
      comparator: '<=',
    },
  ];

  return {
    metrics,
    thresholds,
    checks,
    pass: checks.every((c) => c.pass),
    details: {
      contact: contactMetric,
      header: headerMetric,
      sections: sectionMetric,
      experience: experienceMetric,
      education: educationMetric,
      skills: skillsMetric,
      unclassified: unclassifiedMetric,
      portfolio: portfolioMetric,
    },
    counts: {
      experience: (detected.experienceItems || []).length,
      education: (detected.educationItems || []).length,
      skills: (detected.skillItems || []).length,
      portfolio_items: (detected.portfolio_items || []).length,
      portfolio_pages: detected.pageDocumentClassification?.portfolio_pages || [],
    },
  };
}
