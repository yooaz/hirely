/**
 * P1 generic usability metrics — structure-based, no person-specific expectations.
 */

import { EMAIL_RE, PHONE_RE } from '../../src/core/parsing/field-sanitize.js';
import { isValidIdentityName } from '../../src/core/parsing/identity-extraction.js';
import { GENERIC_EDUCATION_HINT_RE } from '../../src/core/parsing/generic-career-signals.js';

function sourceHasEmail(raw) {
  return EMAIL_RE.test(String(raw || ''));
}

function sourceHasPhone(raw) {
  return PHONE_RE.test(String(raw || ''));
}

function sourceHasEducation(raw) {
  return GENERIC_EDUCATION_HINT_RE.test(String(raw || '')) || /\beducation\b/i.test(raw);
}

function sourceHasLanguages(raw) {
  return /\blanguages?\b/i.test(raw) || /\b(french|english|spanish|german|native|fluent|bilingual)\b/i.test(raw);
}

function countSkills(rd) {
  return (rd?.skills?.length || 0) + (rd?.tools?.length || 0);
}

/**
 * @param {string} rawText
 * @param {object} resumeData
 * @param {object} cvData
 */
export function evaluateGenericUsability(rawText, resumeData, cvData) {
  const raw = String(rawText || '');
  const id = resumeData?.identity || {};
  const name = String(id.name || cvData?.name || '').trim();
  const email = String(id.email || cvData?.email || '').trim();
  const phone = String(id.phone || cvData?.phone || '').trim();

  const checks = [];
  const failures = [];

  const nameOk = name.length >= 2 && isValidIdentityName(name);
  checks.push({ id: 'name', required: true, pass: nameOk, value: name || '(empty)' });
  if (!nameOk) failures.push('name missing or invalid');

  if (sourceHasEmail(raw)) {
    const emailOk = EMAIL_RE.test(email);
    checks.push({ id: 'email', required: true, pass: emailOk, value: email || '(empty)' });
    if (!emailOk) failures.push('email in source but not extracted');
  } else {
    checks.push({ id: 'email', required: false, pass: true, value: email || 'n/a' });
  }

  if (sourceHasPhone(raw)) {
    const phoneOk = PHONE_RE.test(phone);
    checks.push({ id: 'phone', required: true, pass: phoneOk, value: phone || '(empty)' });
    if (!phoneOk) failures.push('phone in source but not extracted');
  } else {
    checks.push({ id: 'phone', required: false, pass: true, value: phone || 'n/a' });
  }

  const expCount = (resumeData?.experiences?.length || cvData?.experience?.length || 0);
  const expOk = expCount >= 1;
  checks.push({ id: 'experience', required: true, pass: expOk, value: String(expCount) });
  if (!expOk) failures.push('experience count < 1');

  if (sourceHasEducation(raw)) {
    const eduCount = (resumeData?.education?.length || cvData?.education?.length || 0);
    const eduOk = eduCount >= 1;
    checks.push({ id: 'education', required: true, pass: eduOk, value: String(eduCount) });
    if (!eduOk) failures.push('education in source but not extracted');
  } else {
    checks.push({ id: 'education', required: false, pass: true, value: 'n/a' });
  }

  const skillCount = countSkills(resumeData) || (cvData?.skills?.length || 0) + (cvData?.tools?.length || 0);
  const skillsOk = skillCount >= 2;
  checks.push({ id: 'skills', required: true, pass: skillsOk, value: String(skillCount) });
  if (!skillsOk) failures.push('skills/tools count < 2');

  if (sourceHasLanguages(raw)) {
    const langCount = (resumeData?.languages?.length || cvData?.languages?.length || 0);
    const langOk = langCount >= 1;
    checks.push({ id: 'languages', required: true, pass: langOk, value: String(langCount) });
    if (!langOk) failures.push('languages in source but not extracted');
  } else {
    checks.push({ id: 'languages', required: false, pass: true, value: 'n/a' });
  }

  const usable = failures.length === 0;
  return { usable, checks, failures };
}
