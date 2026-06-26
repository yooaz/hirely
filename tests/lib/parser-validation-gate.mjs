/**
 * Clean-text parser validation — paste → parse → preview → export readiness.
 * No OCR. No PDF extraction.
 */

import { isLanguageProficiencyLine } from '../../src/core/parsing/line-cleaner.js';
import { TOOLS } from '../../src/data/dictionaries/tools.js';
import { textContainsAny } from '../../src/data/dictionaries/match-utils.js';
import { hasOcrGarbageInStructured } from './quality-gate.mjs';
import { formatCvAsStructuredText } from '../../src/core/export/format-cv.js';
import { cvDataIsRenderable } from '../../src/core/parsing/rich-parser.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

export const PARSER_VALIDATION_PROFILES = [
  {
    id: 'designer-cv',
    fixture: 'creative-cv',
    label: 'Designer CV',
    expect: {
      name: /yohann\s+azancot/i,
      title: /graphic designer|illustrator/i,
      email: /yoaz@hotmail\.fr/i,
      phone: /\+33\s*6\s*49\s*43\s*48\s*39|\+33649434839/,
      experienceMin: 1,
      educationPattern: /lisaa|créapole|creapole/i,
      skillPattern: /illustration|graphic design/i,
      toolPattern: /photoshop|illustrator|indesign/i,
      languagePattern: /french|english/i,
      clientMin: 3,
    },
  },
  {
    id: 'developer-cv',
    fixture: 'developer-cv',
    label: 'Developer CV',
    expect: {
      name: /alex\s+chen/i,
      title: /software engineer/i,
      email: /alex\.chen@email\.com/i,
      phone: /\+1\s*415\s*555\s*0192|415.*555/,
      experienceMin: 2,
      educationPattern: /mit|computer science/i,
      skillPattern: /system design|api design/i,
      toolPattern: /typescript|python|react/i,
      languagePattern: /english|mandarin/i,
      interestPattern: /running|chess|open source/i,
      clientMin: 0,
    },
  },
  {
    id: 'consultant-cv',
    fixture: 'consultant-cv',
    label: 'Consultant CV',
    expect: {
      name: /sophie\s+martin/i,
      title: /consultant/i,
      email: /sophie\.martin@consult\.fr/i,
      phone: /\+33\s*6\s*11\s*22\s*33\s*44|\+33611223344/,
      experienceMin: 2,
      educationPattern: /hec|sciences po/i,
      skillPattern: /strategy|operations/i,
      toolPattern: /excel|powerpoint|tableau/i,
      languagePattern: /french|english|german/i,
      clientMin: 0,
    },
  },
  {
    id: 'student-cv',
    fixture: 'student-cv',
    label: 'Student CV',
    expect: {
      name: /emma\s+johnson/i,
      title: /student/i,
      email: /emma\.johnson@university\.edu/i,
      phone: /\+44\s*7700\s*900123|7700\s*900123/,
      experienceMin: 1,
      educationPattern: /university college london|westminster/i,
      skillPattern: /algorithms|databases/i,
      toolPattern: /python|java|git/i,
      languagePattern: /english|spanish/i,
      interestPattern: /hackathons|hiking|photography/i,
      clientMin: 0,
    },
  },
];

export const PASTE_FLOW_STAGES = [
  'paste',
  'parse',
  'preview',
  'template',
  'export',
];

function hasConfirmedName(name) {
  const n = String(name || '').trim();
  if (!n || n === 'Name to confirm') return false;
  if (n.includes(' · ')) return false;
  return n.split(/\s+/).filter(Boolean).length >= 2;
}

function toolsInEducation(cv, structured) {
  const edu = [...(cv?.education || []), ...(structured?.education || [])];
  return edu.some((line) => textContainsAny(line, TOOLS).length > 0);
}

function languagesInEducation(cv, structured) {
  const edu = [...(cv?.education || []), ...(structured?.education || [])];
  return edu.some((line) => isLanguageProficiencyLine(line));
}

function interestsInSkills(cv, structured) {
  const skills = [...(cv?.skills || []), ...(structured?.skills || [])].map((s) =>
    String(s).toLowerCase()
  );
  const interests = [...(cv?.interests || []), ...(structured?.interests || [])].map((s) =>
    String(s).toLowerCase()
  );
  const hobbyWords = ['running', 'chess', 'hackathons', 'hiking', 'photography', 'music', 'movies'];
  return hobbyWords.some(
    (w) => skills.includes(w) && !interests.some((i) => i.includes(w))
  );
}

/**
 * @param {{ cv: object, structured: object, profile: object, pipe?: object, previewText?: string }} input
 */
export function evaluateCleanTextParser({ cv, structured, profile, pipe = {}, previewText = '' }) {
  const failures = [];
  const exp = profile.expect || {};
  const preview = previewText || formatCvAsStructuredText(cv);

  if (!hasConfirmedName(cv?.name)) {
    failures.push('name not confirmed (missing or "Name to confirm" / candidate list)');
  } else if (exp.name && !exp.name.test(String(cv.name || ''))) {
    failures.push(`name mismatch (expected ${exp.name})`);
  }

  const title = String(cv?.title || structured?.identity?.title || '').trim();
  if (!title) failures.push('title not detected');
  else if (exp.title && !exp.title.test(title)) {
    failures.push(`title mismatch (expected ${exp.title})`);
  }

  if (exp.email) {
    if (!cv?.email || !EMAIL_RE.test(cv.email)) failures.push('email not detected');
    else if (!exp.email.test(cv.email)) failures.push(`email mismatch (expected ${exp.email})`);
  }

  if (exp.phone) {
    if (!cv?.phone || !PHONE_RE.test(cv.phone)) failures.push('phone not detected');
    else if (!exp.phone.test(cv.phone.replace(/\s/g, '')) && !exp.phone.test(cv.phone)) {
      failures.push(`phone mismatch (expected ${exp.phone})`);
    }
  }

  if ((cv?.experience || []).length < (exp.experienceMin ?? 1)) {
    failures.push('experience not detected');
  }

  const eduText = [...(cv?.education || []), ...(structured?.education || [])].join(' ');
  if (!eduText.trim()) failures.push('education not detected');
  else if (exp.educationPattern && !exp.educationPattern.test(eduText)) {
    failures.push(`education mismatch (expected ${exp.educationPattern})`);
  }

  if (languagesInEducation(cv, structured)) {
    failures.push('languages mixed into education');
  }

  if (toolsInEducation(cv, structured)) {
    failures.push('tools mixed into education');
  }

  const skills = [...(cv?.skills || []), ...(structured?.skills || [])];
  if (!skills.length) failures.push('skills not detected');
  else if (exp.skillPattern && !exp.skillPattern.test(skills.join(' '))) {
    failures.push(`skills mismatch (expected ${exp.skillPattern})`);
  }

  const tools = [...(cv?.tools || []), ...(structured?.tools || [])];
  if (exp.toolPattern && !exp.toolPattern.test(tools.join(' '))) {
    failures.push(`tools not separated (expected ${exp.toolPattern})`);
  }

  const languages = [...(cv?.languages || []), ...(structured?.languages || [])];
  if (!languages.length && exp.languagePattern) {
    failures.push('languages not detected');
  } else if (exp.languagePattern && !exp.languagePattern.test(languages.join(' '))) {
    failures.push(`languages mismatch (expected ${exp.languagePattern})`);
  }

  const clients = [...(cv?.clients || []), ...(structured?.clients || [])];
  if ((exp.clientMin ?? 0) > 0 && clients.length < exp.clientMin) {
    failures.push(`clients not separated (need ≥${exp.clientMin})`);
  }

  if (exp.interestPattern) {
    const ints = [...(cv?.interests || []), ...(structured?.interests || [])].join(' ');
    if (!exp.interestPattern.test(ints)) {
      failures.push(`interests not separated (expected ${exp.interestPattern})`);
    }
  }

  if (interestsInSkills(cv, structured)) {
    failures.push('interests still in skills');
  }

  if (hasOcrGarbageInStructured(cv)) {
    failures.push('OCR garbage in structured output');
  }

  if (!pipe.canGenerate) {
    failures.push('pipeline cannot generate CV');
  }

  if (!cvDataIsRenderable(cv)) {
    failures.push('cvData not renderable for preview');
  }

  if (!preview || preview.length < 180) {
    failures.push('CV preview text empty or too short');
  } else if (cv?.name && !preview.includes(String(cv.name).split(' ')[0])) {
    failures.push('CV preview missing candidate name');
  }

  if ((cv?.experience || []).length && !/experience/i.test(preview)) {
    failures.push('CV preview missing experience section');
  }

  return {
    status: failures.length ? 'FAIL' : 'PASS',
    failures,
    previewLength: preview.length,
    summary: {
      name: cv?.name,
      title: cv?.title,
      email: cv?.email,
      phone: cv?.phone,
      experience: (cv?.experience || []).length,
      education: (cv?.education || []).length,
      skills: skills.length,
      tools: tools.length,
      languages: languages.length,
      clients: clients.length,
      interests: [...(cv?.interests || []), ...(structured?.interests || [])].length,
      canGenerate: !!pipe.canGenerate,
      previewChars: preview.length,
    },
  };
}
