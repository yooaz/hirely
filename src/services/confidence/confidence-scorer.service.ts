import type { ConfidenceReport } from '../../types/cv.types.js';
import type { CVCanonical, ExperienceItem, EducationItem } from '../../types/cv.types.js';
import { EMAIL_PATTERN, PHONE_PATTERN } from '../_internal/block-signals.js';

function avg(items: number[]): number {
  if (!items.length) return 0;
  return items.reduce((a, b) => a + b, 0) / items.length;
}

function emailConf(emails: string[]): number {
  const any = emails.some((e) => EMAIL_PATTERN.test(e));
  return any ? 1 : 0.2;
}

function phoneConf(phones: string[]): number {
  const any = phones.some((p) => PHONE_PATTERN.test(p));
  return any ? 0.95 : 0.2;
}

function fullNameConf(name: string): number {
  return name && name.trim().length >= 3 ? 0.9 : 0.25;
}

function experienceItemsToConfidence(items: ExperienceItem[]): number {
  return avg(items.map((i) => i.confidence));
}

function educationItemsToConfidence(items: EducationItem[]): number {
  return avg(items.map((i) => i.confidence));
}

export class ConfidenceScorerService {
  score(params: {
    cv: CVCanonical;
    unknown_ratio: number;
  }): ConfidenceReport {
    const { cv, unknown_ratio } = params;

    const contactConf =
      cv.contact.confidence ||
      0.35 * fullNameConf(cv.contact.full_name) +
        0.35 * emailConf(cv.contact.emails) +
        0.3 * phoneConf(cv.contact.phones);

    const summaryConf = cv.summary?.trim()?.length
      ? Math.min(1, cv.summary.trim().length / 240)
      : 0.15;

    const expConf = experienceItemsToConfidence(cv.experiences || []);
    const eduConf = educationItemsToConfidence(cv.education || []);

    const skillsConf =
      cv.skills.confidence ||
      (cv.skills.technical.length + cv.skills.tools.length + cv.skills.soft.length + cv.skills.languages.length > 0
        ? 0.85
        : 0.25);

    const certConf = avg((cv.certifications || []).map((c) => c.confidence));
    const projectConf = avg((cv.projects || []).map((p) => p.confidence));

    const otherPenalty = Math.min(0.35, Math.max(0, unknown_ratio - 0.05) * 0.9);
    const global = Math.max(
      0,
      Math.min(
        1,
        0.25 * contactConf +
          0.1 * summaryConf +
          0.35 * expConf +
          0.15 * eduConf +
          0.15 * skillsConf -
          otherPenalty
      )
    );

    const fields: Record<string, number> = {
      'contact.full_name': fullNameConf(cv.contact.full_name),
      'contact.emails': emailConf(cv.contact.emails),
      'contact.phones': phoneConf(cv.contact.phones),
    };

    return {
      global,
      sections: {
        contact: contactConf,
        summary: summaryConf,
        experience: expConf,
        education: eduConf,
        skills: skillsConf,
        certifications: certConf || 0.2,
        projects: projectConf || 0.2,
      },
      fields,
    };
  }
}
