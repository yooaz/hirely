import type { EducationItem, ExperienceItem, CVCanonical } from '../../types/cv.types.js';

function keyExp(e: ExperienceItem): string {
  return `${e.job_title}|${e.company}|${e.start_date}`.toLowerCase();
}

function keyEdu(e: EducationItem): string {
  return `${e.degree}|${e.school}|${e.start_date}`.toLowerCase();
}

export class DedupeService {
  dedupeExperiences(items: ExperienceItem[]): ExperienceItem[] {
    const seen = new Set<string>();
    const out: ExperienceItem[] = [];
    for (const it of items || []) {
      const k = keyExp(it);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }

  dedupeEducation(items: EducationItem[]): EducationItem[] {
    const seen = new Set<string>();
    const out: EducationItem[] = [];
    for (const it of items || []) {
      const k = keyEdu(it);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }

  dedupeCanonical(cv: CVCanonical): CVCanonical {
    return {
      ...cv,
      experiences: this.dedupeExperiences(cv.experiences),
      education: this.dedupeEducation(cv.education),
      contact: {
        ...cv.contact,
        emails: [...new Set(cv.contact.emails)],
        phones: [...new Set(cv.contact.phones)],
      },
      skills: {
        ...cv.skills,
        technical: [...new Set(cv.skills.technical)],
        tools: [...new Set(cv.skills.tools)],
        languages: [...new Set(cv.skills.languages)],
        soft: [...new Set(cv.skills.soft)],
      },
    };
  }
}

