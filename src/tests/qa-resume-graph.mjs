#!/usr/bin/env node
/**
 * RESUME_GRAPH_ENGINE — structured → graph → JSON; never raw OCR → JSON.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import {
  buildResumeGraph,
  assertGraphStructuredInput,
} from '../core/parsing/build-resume-graph.js';
import { graphToCvData } from '../core/parsing/graph-to-cv-data.js';
import {
  GRAPH_NODE,
  GRAPH_EDGE,
  RESUME_GRAPH_ENGINE,
} from '../core/parsing/resume-graph-types.js';
import { runResumeGraphEngine } from '../core/parsing/resume-graph-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const sample = existsSync(fixturePath)
  ? readFileSync(fixturePath, 'utf8')
  : `Yohann Azancot\nGraphic Designer\nyoaz@test.com\n2019–Present Nike — Designer\nEDUCATION\nSchool\nSKILLS\nFigma`;

const parsed = runSectionEngineV2(sample, { rawText: sample });
ok(parsed.resumeGraph?.engine === RESUME_GRAPH_ENGINE, 'section engine returns resume graph');
ok(parsed.structured.metadata?.jsonFromGraph === true, 'jsonFromGraph metadata');
ok(parsed.structured.metadata?.neverBuildJsonFromOcr === true, 'neverBuildJsonFromOcr flag');

const graph = parsed.resumeGraph;
ok(graph.nodes.some((n) => n.type === GRAPH_NODE.PERSON), 'person node');
ok(graph.nodes.some((n) => n.type === GRAPH_NODE.EXPERIENCE), 'experience nodes');
ok(
  graph.edges.some((e) => e.type === GRAPH_EDGE.WORKED_AT),
  'worked_at edges'
);
ok(
  graph.edges.some((e) => e.type === GRAPH_EDGE.STUDIED) ||
    graph.nodes.some((n) => n.type === GRAPH_NODE.EDUCATION),
  'education in graph'
);

const cv = parsed.resumeJson;
ok(cv.name?.length > 0, `cv name from graph (${cv.name})`);
ok((cv.experience || []).length > 0, `cv experience from graph (${cv.experience?.length})`);
ok(
  parsed.structured.metadata?.resumeGraph?.engine === RESUME_GRAPH_ENGINE,
  'structured metadata holds graph'
);
ok(graph.stats.experience >= (cv.experience || []).length, 'graph experience nodes >= serialized lines');

let threw = false;
try {
  buildResumeGraph({
    metadata: { fromRawOcrOnly: true },
    identity: {},
    experiences: [],
  });
} catch (e) {
  threw = e.message?.includes('RAW_OCR');
}
ok(threw, 'rejects fromRawOcrOnly structured input');

const manual = {
  identity: {
    name: 'Test User',
    title: 'Designer',
    email: 'a@b.com',
  },
  summary: 'Creative professional.',
  experiences: [
    {
      role: 'Lead Designer',
      company: 'Acme',
      startDate: '2020',
      endDate: 'Present',
      bullets: ['Brand systems'],
      clients: ['Nike'],
    },
  ],
  education: ['Art School — BFA'],
  skills: ['Branding'],
  tools: ['Figma'],
  languages: ['English — Native'],
  projects: ['Portfolio Site'],
  clients: ['Apple'],
  metadata: { neverRawFieldExtract: true, parseSource: 'SECTION_ENGINE_V2' },
};

const g2 = buildResumeGraph(manual);
const cv2 = graphToCvData(g2, { structured: manual });
ok(cv2.skills?.includes('Branding'), 'graph serializer skills');
ok(cv2.tools?.includes('Figma'), 'graph serializer tools');
ok(cv2.clients?.includes('Nike') || cv2.clients?.includes('Apple'), 'graph serializer clients');

const eng = runResumeGraphEngine(manual);
ok(eng.resumeJson.name === 'Test User', 'engine resume JSON name');

console.log('\nRESUME_GRAPH QA OK — nodes', graph.stats);
