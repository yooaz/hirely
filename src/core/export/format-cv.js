/**
 * Structured cvData → plain text (for export / debug). Not HTML templates.
 */

import { sanitizeCvDataForExport } from '../parsing/corruption-detector.js';

export function formatCvAsStructuredText(cv) {
  const d = sanitizeCvDataForExport(cv || {});
  const lines = [];
  if (d.name) lines.push(d.name);
  if (d.title) lines.push(d.title);
  const contact = [d.location, d.email, d.phone, d.portfolio, d.linkedin].filter(Boolean);
  if (contact.length) lines.push(contact.join(' · '));
  if (d.summary) {
    lines.push('');
    lines.push(d.summary);
  }
  if (d.experience?.length) {
    lines.push('');
    lines.push('Experience');
    d.experience.forEach((x) => lines.push(`- ${x}`));
  }
  if (d.education?.length) {
    lines.push('');
    lines.push('Education');
    lines.push(d.education.join(' · '));
  }
  if (d.skills?.length) {
    lines.push('');
    lines.push('Skills');
    lines.push(d.skills.join(', '));
  }
  if (d.tools?.length) {
    lines.push('');
    lines.push('Tools');
    lines.push(d.tools.join(', '));
  }
  if (d.languages?.length) {
    lines.push('');
    lines.push('Languages');
    lines.push(d.languages.join(', '));
  }
  if (d.clients?.length) {
    lines.push('');
    lines.push('Clients');
    lines.push(d.clients.join(', '));
  }
  if (d.projects?.length) {
    lines.push('');
    lines.push('Projects / Selected Work');
    d.projects.forEach((x) => lines.push(`- ${x}`));
  }
  return lines.join('\n').trim();
}
