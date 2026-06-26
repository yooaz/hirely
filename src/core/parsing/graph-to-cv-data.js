/**
 * Serialize resume graph → legacy cvData JSON (templates/export).
 */

import { GRAPH_NODE, GRAPH_EDGE } from './resume-graph-types.js';
import { normalizeCvData } from './rich-parser.js';
import { isLineCorruptedForExport } from './corruption-detector.js';
import {
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
  isBadTitleCandidate,
} from './parser-recovery.js';
import { slimStructuredResume } from '../pipeline/pipeline-contract.js';

/**
 * @param {import('./resume-graph-types.js').ResumeGraph} graph
 * @param {object} [opts]
 */
export function graphToCvData(graph, opts = {}) {
  const g = graph || { nodes: [], edges: [], rootId: null };
  const byId = new Map((g.nodes || []).map((n) => [n.id, n]));

  const person = g.nodes?.find((n) => n.type === GRAPH_NODE.PERSON) || null;
  const id = person?.data || {};

  const experiences = [];
  for (const edge of g.edges || []) {
    if (edge.type !== GRAPH_EDGE.WORKED_AT || edge.from !== g.rootId) continue;
    const node = byId.get(edge.to);
    if (!node || node.type !== GRAPH_NODE.EXPERIENCE) continue;
    const d = node.data || {};
    experiences.push({
      role: d.role || '',
      company: d.company || '',
      location: d.location || '',
      startDate: d.startDate || '',
      endDate: d.endDate || '',
      bullets: [...(d.bullets || [])],
      clients: [],
    });
  }

  experiences.sort((a, b) => {
    const ya = parseInt(String(a.startDate || '').slice(0, 4), 10) || 0;
    const yb = parseInt(String(b.startDate || '').slice(0, 4), 10) || 0;
    return yb - ya;
  });

  const education = [];
  const skills = [];
  const tools = [];
  const languages = [];
  const projects = [];
  const clients = new Set();

  for (const edge of g.edges || []) {
    if (edge.from !== g.rootId) continue;
    const node = byId.get(edge.to);
    if (!node) continue;
    const label = String(node.data?.label || node.data?.school || '').trim();

    if (edge.type === GRAPH_EDGE.STUDIED && node.type === GRAPH_NODE.EDUCATION) {
      education.push(node.data?.label || label || node.data?.school || '');
    }
    if (edge.type === GRAPH_EDGE.USED && node.type === GRAPH_NODE.SKILL && label) {
      skills.push(label);
    }
    if (edge.type === GRAPH_EDGE.USED && node.type === GRAPH_NODE.TOOL && label) {
      tools.push(label);
    }
    if (edge.type === GRAPH_EDGE.SPEAKS && node.type === GRAPH_NODE.LANGUAGE && label) {
      languages.push(label);
    }
    if (edge.type === GRAPH_EDGE.CREATED && node.type === GRAPH_NODE.PROJECT && label) {
      projects.push(label);
    }
    if (edge.type === GRAPH_EDGE.CREATED && node.type === GRAPH_NODE.CLIENT && label) {
      clients.add(label);
    }
  }

  for (const edge of g.edges || []) {
    if (edge.type !== GRAPH_EDGE.USED) continue;
    const exp = byId.get(edge.from);
    const target = byId.get(edge.to);
    if (exp?.type === GRAPH_NODE.EXPERIENCE && target?.type === GRAPH_NODE.CLIENT) {
      const label = String(target.data?.label || '').trim();
      if (label) clients.add(label);
    }
  }

  const rawName = String(id.name || '').trim();
  const rawTitle = String(id.title || '').trim();
  const displayName =
    rawName && rawName !== NAME_UNCERTAIN_LABEL && !isBadTitleCandidate(rawName) && !/print logo|vector art/i.test(rawName)
      ? rawName
      : rawName === NAME_UNCERTAIN_LABEL
        ? NAME_UNCERTAIN_LABEL
        : '';
  const displayTitle =
    rawTitle && rawTitle !== TITLE_UNCERTAIN_LABEL && !isBadTitleCandidate(rawTitle)
      ? rawTitle
      : rawTitle === TITLE_UNCERTAIN_LABEL
        ? TITLE_UNCERTAIN_LABEL
        : '';

  const cleanedExperiences = experiences
    .map((e) => ({
      ...e,
      role: isLineCorruptedForExport(e.role) ? '' : e.role,
      company: isLineCorruptedForExport(e.company) ? '' : e.company,
      bullets: (e.bullets || []).filter((b) => !isLineCorruptedForExport(b)),
    }))
    .filter((e) => e.role || e.company || e.bullets?.length);

  const structured = opts.structured || null;

  const cv = {
    name: displayName,
    title: displayTitle,
    email: id.email || '',
    phone: id.phone || '',
    linkedin: id.linkedin || '',
    portfolio: id.website || '',
    location: id.location || '',
    summary: id.summary || '',
    experience: cleanedExperiences.map((e) => {
      const head = [e.role, e.company, [e.startDate, e.endDate].filter(Boolean).join('–')]
        .filter(Boolean)
        .join(' — ');
      if (e.bullets?.length) return `${head}: ${e.bullets.join(' · ')}`;
      return head;
    }),
    education: education.filter(Boolean),
    skills: [...new Set(skills)],
    tools: [...new Set(tools)],
    languages: [...new Set(languages)],
    clients: [...clients],
    awards: structured?.awards || [],
    exhibitions: structured?.exhibitions || [],
    publications: structured?.publications || [],
    portfolioLinks: structured?.portfolioLinks || [],
    extra: [],
    interests: structured?.interests || [],
    projects: [...new Set(projects)],
    unsorted: structured?.unsorted || [],
    toClassify: (structured?.toClassify || structured?.unknownExperience || [])
      .map((x) => (typeof x === 'string' ? { text: x } : x))
      .filter((x) => x && String(x.text || '').trim()),
    unknownExperience: (structured?.unknownExperience || [])
      .map((x) => (typeof x === 'string' ? x : x?.text || ''))
      .filter(Boolean),
    sectionConfidence: structured?.sectionConfidence || {},
    needsReview: structured?.needsReview || [],
    nameCandidates: structured?.nameCandidates || [],
    structuredResume: structured ? slimStructuredResume(structured) : null,
    _resumeGraph: {
      version: g.version,
      engine: g.engine,
      rootId: g.rootId,
      stats: g.stats,
    },
  };

  return normalizeCvData(cv);
}
