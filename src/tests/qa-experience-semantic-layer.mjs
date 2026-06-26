#!/usr/bin/env node
/**
 * Experience semantic layer — role / company / specialties / description split.
 */
import {
  reconstructExperienceSemantics,
  extractSpecialtiesFromText,
} from '../core/parsing/experience-semantic-layer.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function testFreelanceIllustratorCase() {
  const raw =
    'Freelance Illustrator Graphic Designer packaging designer edition logos posters';
  const exp = reconstructExperienceSemantics({
    role: raw,
    company: '',
    bullets: [],
  });

  ok(/\bfreelance illustrator\b/i.test(exp.role), `role contains freelance illustrator (${exp.role})`);
  ok(/\bgraphic designer\b/i.test(exp.role), `role contains graphic designer (${exp.role})`);
  ok(/\//.test(exp.role), `role uses slash separator (${exp.role})`);
  ok(!/packaging|logos?|edition|posters?/i.test(exp.role), `role has no specialties (${exp.role})`);
  ok(exp.company === 'Independent / Freelance', `company is freelance (${exp.company})`);
  ok(exp.specialties.includes('Packaging Design'), 'specialty Packaging Design');
  ok(exp.specialties.includes('Logo Design'), 'specialty Logo Design');
  ok(exp.specialties.includes('Editorial Design'), 'specialty Editorial Design');
  ok(exp.specialties.includes('Poster Design'), 'specialty Poster Design');
  ok(
    /posters,\s*packaging,\s*logos/i.test(exp.description || ''),
    `description lists deliverables (${exp.description})`
  );
}

function testSanitizerIntegration() {
  const resumeData = {
    identity: { name: 'Test User', title: 'Graphic Designer' },
    summary: '',
    experiences: [
      {
        role: 'Freelance Illustrator Graphic Designer packaging designer edition logos posters',
        company: '',
        dates: '2018–2022',
        startDate: '2018',
        endDate: '2022',
        bullets: ['packaging designer edition, logos...'],
      },
    ],
    education: [],
    skills: [],
    tools: [],
    languages: [],
    clients: [],
    unsorted: [],
  };
  const out = sanitizeResumeForDisplay(resumeData);
  const exp = out.experiences?.[0];
  ok(
    (out.skills || []).some((s) => /packaging|logo design|editorial/i.test(s)),
    `sanitizer enriches skills from specialties (${out.skills?.join(', ')})`
  );
  ok(!/packaging/i.test(exp?.role || ''), `sanitizer role clean (${exp?.role})`);
  ok(!(exp?.specialties || []).length, 'sanitizer hides specialty chips from render');
}

function testSpecialtyExtraction() {
  const specs = extractSpecialtiesFromText('packaging designer edition logos posters');
  ok(specs.length >= 4, `extracted ${specs.length} specialties`);
}

testFreelanceIllustratorCase();
testSanitizerIntegration();
testSpecialtyExtraction();

if (failed) {
  process.exit(1);
}
console.log('qa-experience-semantic-layer: all passed');
