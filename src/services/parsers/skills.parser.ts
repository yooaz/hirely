import type { LogicalBlock } from '../../types/blocks.types.js';
import type { SkillsGroup, LanguageSkill } from '../../types/cv.types.js';
import { uniqueStrings } from '../_internal/utils.js';

const LANGS = [
  'français',
  'francais',
  'french',
  'english',
  'spanish',
  'espagnol',
  'german',
  'allemand',
  'italian',
  'italien',
  'dutch',
  'néerlandais',
  'netherlands',
];

const TECH = [
  'javascript',
  'typescript',
  'python',
  'react',
  'node',
  'nodejs',
  'next',
  'nextjs',
  'express',
  'nest',
  'sql',
  'postgres',
  'postgresql',
  'mongodb',
  'reactnative',
  'tailwind',
  'aws',
  'azure',
  'gcp',
  'graphql',
  'docker',
  'kubernetes',
  'linux',
];

const TOOLS = ['git', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'linux', 'figma', 'postman', 'jira'];

const SOFT = ['communication', 'teamwork', 'leadership', 'rigueur', 'autonomie', 'esprit', 'collaboration', 'lead', 'planning', 'organisation'];

function normalizeToken(t: string): string {
  return String(t || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[•●▪◦*]/g, '')
    .trim();
}

function splitSkills(text: string): string[] {
  const t = String(text || '');
  return t
    .split(/[\n,;•●▪◦]+/)
    .map((x) => normalizeToken(x))
    .filter(Boolean);
}

function blockSourceIds(block: LogicalBlock): string[] {
  return uniqueStrings((block.lines || []).map((ln) => ln.block_id));
}

function toLanguageSkill(label: string): LanguageSkill {
  return { language: label };
}

export class SkillsParserService {
  parse(blocks: LogicalBlock[]): { skills: SkillsGroup; confidence: number } {
    const ordered = [...(blocks || [])].sort((a, b) => a.reading_order - b.reading_order);
    const joined = ordered.map((b) => b.text).join('\n');
    const tokens = splitSkills(joined);

    const technical: string[] = [];
    const tools: string[] = [];
    const languages: LanguageSkill[] = [];
    const soft: string[] = [];

    for (const tok of tokens) {
      const t = tok.toLowerCase();

      if (LANGS.some((l) => t.includes(l))) {
        languages.push(toLanguageSkill(tok));
        continue;
      }

      if (SOFT.some((s) => t.includes(s))) {
        soft.push(tok);
        continue;
      }

      if (TOOLS.some((s) => t === s || t.includes(s))) {
        tools.push(tok);
        continue;
      }

      if (TECH.some((s) => t.includes(s))) {
        technical.push(tok);
        continue;
      }
    }

    const allEmpty =
      technical.length === 0 && tools.length === 0 && languages.length === 0 && soft.length === 0;
    if (allEmpty) technical.push(...tokens);

    const source_block_ids = uniqueStrings(ordered.flatMap((b) => blockSourceIds(b)));
    const confidence = technical.length ? 0.8 : 0.45;

    return {
      skills: {
        technical: uniqueStrings(technical).slice(0, 50),
        tools: uniqueStrings(tools).slice(0, 40),
        languages: languages.slice(0, 20),
        soft: uniqueStrings(soft).slice(0, 20),
        source_block_ids,
        confidence,
      },
      confidence,
    };
  }
}
