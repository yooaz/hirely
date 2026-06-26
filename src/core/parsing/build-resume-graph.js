/**
 * Build resume graph from structured resume (section engine output).
 * Never reads raw OCR / cleanedText for field values.
 */

import {
  RESUME_GRAPH_ENGINE,
  RESUME_GRAPH_VERSION,
  GRAPH_NODE,
  GRAPH_EDGE,
} from './resume-graph-types.js';

/**
 * @param {string} type
 * @param {string} label
 * @param {number} index
 */
function nodeId(type, label, index = 0) {
  const slug = String(label || 'node')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  return `${type}-${index}-${slug || 'x'}`;
}

/**
 * @param {object} structured
 */
export function assertGraphStructuredInput(structured) {
  if (!structured || typeof structured !== 'object') {
    throw new Error('RESUME_GRAPH_REQUIRES_STRUCTURED_RESUME');
  }
  const meta = structured.metadata || {};
  if (meta.fromRawOcrOnly === true) {
    throw new Error('RESUME_GRAPH_REJECTS_RAW_OCR');
  }
  const fromPipeline =
    meta.neverRawFieldExtract === true ||
    String(meta.parseSource || '').includes('SECTION') ||
    String(meta.pipelineVersion || '').includes('p0') ||
    String(meta.pipelineVersion || '').includes('block');
  const hasFields =
    structured.identity?.name ||
    structured.identity?.email ||
    (structured.experiences || []).length > 0 ||
    (structured.skills || []).length > 0;
  if (!fromPipeline && !hasFields) {
    throw new Error('RESUME_GRAPH_REQUIRES_PARSED_STRUCTURE');
  }
}

/**
 * @param {object} structured — structuredResume from SECTION_ENGINE_V2 / blocks path
 * @returns {import('./resume-graph-types.js').ResumeGraph}
 */
export function buildResumeGraph(structured) {
  assertGraphStructuredInput(structured);

  const nodes = [];
  const edges = [];
  let edgeSeq = 0;
  const nodeIndex = new Map();

  const addNode = (type, data, key) => {
    const id = nodeId(type, key || data?.label || data?.name || data?.role, nodes.length);
    if (nodeIndex.has(id)) return nodeIndex.get(id);
    const node = { id, type, data: { ...data } };
    nodes.push(node);
    nodeIndex.set(id, id);
    return id;
  };

  const addEdge = (from, to, type, data = {}) => {
    if (!from || !to || from === to) return;
    edges.push({
      id: `edge-${edgeSeq++}`,
      from,
      to,
      type,
      data,
    });
  };

  const id = structured.identity || {};
  const personId = addNode(GRAPH_NODE.PERSON, {
    name: String(id.name || '').trim(),
    title: String(id.title || '').trim(),
    email: String(id.email || '').trim(),
    phone: String(id.phone || '').trim(),
    location: String(id.location || '').trim(),
    website: String(id.website || '').trim(),
    linkedin: String(id.linkedin || '').trim(),
    summary: String(structured.summary || '').trim(),
  }, id.name || 'person');

  (structured.experiences || []).forEach((exp, i) => {
    const expId = addNode(
      GRAPH_NODE.EXPERIENCE,
      {
        role: String(exp.role || '').trim(),
        company: String(exp.company || '').trim(),
        location: String(exp.location || '').trim(),
        startDate: String(exp.startDate || '').trim(),
        endDate: String(exp.endDate || '').trim(),
        dates: String(exp.dates || '').trim(),
        bullets: [...(exp.bullets || [])].map((b) => String(b || '').trim()).filter(Boolean),
      },
      `${exp.role}-${exp.company}-${i}`
    );
    addEdge(personId, expId, GRAPH_EDGE.WORKED_AT, { order: i });

    (exp.clients || []).forEach((client, ci) => {
      const label = String(client || '').trim();
      if (!label) return;
      const clientId = addNode(GRAPH_NODE.CLIENT, { label }, label);
      addEdge(expId, clientId, GRAPH_EDGE.USED, { context: 'experience_client', order: ci });
    });

    (exp.bullets || []).forEach((bullet) => {
      const toolMatch = String(bullet || '').match(/\b(Photoshop|Illustrator|InDesign|Figma|After Effects)\b/i);
      if (toolMatch) {
        const toolId = addNode(GRAPH_NODE.TOOL, { label: toolMatch[1] }, toolMatch[1]);
        addEdge(expId, toolId, GRAPH_EDGE.USED, { context: 'bullet_tool' });
      }
    });
  });

  (structured.education || []).forEach((edu, i) => {
    const label = typeof edu === 'string' ? edu : edu?.school || edu?.degree || '';
    const text = String(label || '').trim();
    if (!text) return;
    const eduId = addNode(
      GRAPH_NODE.EDUCATION,
      typeof edu === 'object' && edu
        ? { ...edu, label: text }
        : { label: text, school: text },
      text
    );
    addEdge(personId, eduId, GRAPH_EDGE.STUDIED, { order: i });
  });

  (structured.skills || []).forEach((skill, i) => {
    const label = String(skill || '').trim();
    if (!label) return;
    const skillId = addNode(GRAPH_NODE.SKILL, { label }, label);
    addEdge(personId, skillId, GRAPH_EDGE.USED, { order: i, context: 'skill' });
  });

  (structured.tools || []).forEach((tool, i) => {
    const label = String(tool || '').trim();
    if (!label) return;
    const toolId = addNode(GRAPH_NODE.TOOL, { label }, label);
    addEdge(personId, toolId, GRAPH_EDGE.USED, { order: i, context: 'tool' });
  });

  (structured.languages || []).forEach((lang, i) => {
    const label = String(lang || '').trim();
    if (!label) return;
    const langId = addNode(GRAPH_NODE.LANGUAGE, { label }, label);
    addEdge(personId, langId, GRAPH_EDGE.SPEAKS, { order: i });
  });

  (structured.projects || []).forEach((project, i) => {
    const label = String(project || '').trim();
    if (!label) return;
    const projectId = addNode(GRAPH_NODE.PROJECT, { label }, label);
    addEdge(personId, projectId, GRAPH_EDGE.CREATED, { order: i });
  });

  (structured.clients || []).forEach((client, i) => {
    const label = String(client || '').trim();
    if (!label) return;
    const clientId = addNode(GRAPH_NODE.CLIENT, { label }, label);
    addEdge(personId, clientId, GRAPH_EDGE.CREATED, { order: i, context: 'portfolio_client' });
  });

  const stats = {
    person: nodes.filter((n) => n.type === GRAPH_NODE.PERSON).length,
    experience: nodes.filter((n) => n.type === GRAPH_NODE.EXPERIENCE).length,
    education: nodes.filter((n) => n.type === GRAPH_NODE.EDUCATION).length,
    skill: nodes.filter((n) => n.type === GRAPH_NODE.SKILL).length,
    language: nodes.filter((n) => n.type === GRAPH_NODE.LANGUAGE).length,
    tool: nodes.filter((n) => n.type === GRAPH_NODE.TOOL).length,
    project: nodes.filter((n) => n.type === GRAPH_NODE.PROJECT).length,
    client: nodes.filter((n) => n.type === GRAPH_NODE.CLIENT).length,
    edges: edges.length,
  };

  return {
    version: RESUME_GRAPH_VERSION,
    engine: RESUME_GRAPH_ENGINE,
    rootId: personId,
    nodes,
    edges,
    stats,
    source: {
      parseSource: structured.metadata?.parseSource || null,
      pipelineVersion: structured.metadata?.pipelineVersion || null,
      neverFromRawOcr: true,
    },
  };
}
