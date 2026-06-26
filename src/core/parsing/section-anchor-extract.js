/**
 * Section-anchor routing — experience / education / skills by header blocks.
 * Experience recovery uses strict parser only (no employer-specific blocks).
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { titleCaseProfessional } from './parser-recovery.js';
import { parseStrictExperiencesFromLines } from './experience-parser.js';

const STOP_SECTIONS = new Set([
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'interests',
  'contact',
  'summary',
  'awards',
  'projects',
]);

function normalizeHeader(line) {
  const t = String(line || '')
    .trim()
    .replace(/^[#*]+\s*/, '')
    .replace(/[:：|#•]+\s*$/, '');
  return fuzzySectionKey(t) || null;
}

/**
 * @param {string[]} lines
 */
export function splitLinesBySectionAnchors(lines) {
  const sections = { top: [] };
  let current = 'top';

  for (const raw of lines || []) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const key = normalizeHeader(line);
    if (key) {
      current = key;
      sections[current] = sections[current] || [];
      continue;
    }
    (sections[current] = sections[current] || []).push(line);
  }
  return sections;
}

/**
 * Recover experience blocks from WORK EXPERIENCE section via strict date+role/company rules.
 * @param {string[]} lines
 * @param {string} [_blob]
 */
export function extractExperiencesFromSectionAnchors(lines, _blob = '') {
  const list = (lines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const sections = splitLinesBySectionAnchors(list);
  const expLines = [
    ...(sections.experience || []),
    ...(sections.top || []).filter((l) =>
      /\b(freelanc|illustrator|graphic\s+designer|internship|agency|work experience)\b/i.test(l)
    ),
  ];

  const source = expLines.length ? expLines : list;
  const { experiences } = parseStrictExperiencesFromLines(source, {
    experienceSectionLines: expLines.length ? expLines : undefined,
  });

  const out = [];
  const seen = new Set();
  for (const entry of experiences) {
    const key = `${entry.role}|${entry.company}|${entry.startDate}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      role: titleCaseProfessional(entry.role || ''),
      company: String(entry.company || '').trim(),
      location: entry.location || '',
      startDate: entry.startDate || '',
      endDate: entry.endDate || '',
      dates: entry.dates || '',
      bullets: (entry.bullets || []).slice(0, 4),
      clients: entry.clients || [],
    });
  }

  return out.slice(0, 12);
}

/**
 * Education lines between EDUCATION and SKILLS / INTEREST / CONTACT.
 * @param {string[]} lines
 */
export function extractEducationFromSectionAnchors(lines) {
  const sections = splitLinesBySectionAnchors(lines);
  const edu = (sections.education || [])
    .map((l) => String(l || '').trim())
    .filter((l) => l.length >= 3 && l.length <= 160);
  return [...new Set(edu)].slice(0, 8);
}

/**
 * Skills / tools from SKILLS section and following lines until next header.
 * @param {string[]} lines
 */
export function extractSkillsFromSectionAnchors(lines) {
  const sections = splitLinesBySectionAnchors(lines);
  const raw = [...(sections.skills || []), ...(sections.tools || [])];
  const skills = [];
  const tools = [];
  for (const line of raw) {
    const l = String(line || '').trim();
    if (!l || l.length < 2) continue;
    const parts = l.split(/[,;|·•]/).map((p) => p.trim()).filter((p) => p.length > 1);
    for (const p of parts.length ? parts : [l]) {
      if (/\b(photoshop|illustrator|indesign|figma|after effects|premiere)\b/i.test(p)) {
        tools.push(p);
      } else if (p.length <= 48) {
        skills.push(p);
      }
    }
  }
  return {
    skills: [...new Set(skills)].slice(0, 24),
    tools: [...new Set(tools)].slice(0, 16),
  };
}

/**
 * @param {string[]} lines
 * @param {string} [blob]
 */
export function resolveCreativeProfessionalTitle(lines, blob = '') {
  const hay = `${(lines || []).join('\n')}\n${blob}`;
  const hasDesigner = /\bgraphic\s*designer\b/i.test(hay);
  const hasIllustrator = /\billustrator\b/i.test(hay);
  if (hasDesigner && hasIllustrator) return 'Graphic Designer & Illustrator';
  if (hasDesigner) return 'Graphic Designer';
  if (hasIllustrator) return 'Illustrator';
  return '';
}
