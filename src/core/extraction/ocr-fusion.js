/**
 * Multi-pass OCR fusion — internal only; winner selection by quality scores.
 */

import {
  isGarbageLine,
  isOcrNameGarbage,
  isBrokenWordLine,
  isRandomOcrSymbolLine,
} from '../../data/dictionaries/garbagePatterns.js';
import { corruptionScoreText } from '../parsing/corruption-detector.js';

const SECTION_WORDS = new Set([
  'experience',
  'expérience',
  'formation',
  'education',
  'compétences',
  'competences',
  'skills',
  'profil',
  'profile',
  'summary',
  'sommaire',
  'langues',
  'languages',
  'contact',
]);

export function normalizeFusionLineKey(line) {
  return String(line || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s@.+#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function linesSimilar(a, b) {
  const ka = normalizeFusionLineKey(a);
  const kb = normalizeFusionLineKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length > 12 && kb.length > 12 && (ka.includes(kb) || kb.includes(ka))) return true;
  const wa = ka.split(' ').filter((w) => w.length > 1);
  const wb = kb.split(' ').filter((w) => w.length > 1);
  if (!wa.length || !wb.length) return false;
  const common = wa.filter((w) => wb.includes(w)).length;
  return common / Math.max(wa.length, wb.length, 1) >= 0.68;
}

/** Heuristic line quality (V27-compatible). */
export function lineQuality(line) {
  const t = String(line || '').trim();
  if (!t || t.length < 2) return -100;
  let s = 0;
  if (/@/.test(t) && /\.\w{2,}/.test(t)) s += 12;
  if (/\+\d|[\d]{2}[\s.-][\d]/.test(t)) s += 8;
  const head = t.split(/\s+/)[0]?.toLowerCase() || '';
  if (SECTION_WORDS.has(head)) s += 10;
  const words = t.split(/\s+/).filter(Boolean);
  s += Math.min(words.length * 2.5, 14);
  s += Math.min(t.length / 6, 18);
  const letters = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  s += (letters / Math.max(t.length, 1)) * 12;
  if (/^[A-ZÀ-Ÿ][a-zà-ÿ'’-]+(\s+[A-ZÀ-Ÿ][a-zà-ÿ'’-]+){1,4}$/.test(t)) s += 8;
  if (/[^\x20-\x7E\u00C0-\u024F]/.test(t)) s -= 15;
  if ((t.match(/[a-zà-ÿ]/g) || []).length < 2 && (t.match(/[A-Z]/g) || []).length > 10) s -= 12;
  if (words.length === 1 && words[0].length > 28) s -= 8;
  if (isOcrNameGarbage(t)) s -= 40;
  if (isBrokenWordLine(t)) s -= 25;
  if (isRandomOcrSymbolLine(t)) s -= 30;
  return s;
}

/**
 * Corruption ratio 0 (clean) – 100 (heavily corrupted).
 * @param {string} text
 */
export function corruptionScore(text) {
  return corruptionScoreText(text);
}

/**
 * Language plausibility 0–100 (French/English CV heuristics).
 * @param {string} text
 */
export function languageScore(text) {
  const s = String(text || '').trim();
  if (s.length < 20) return 0;
  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const alphaRatio = letters / Math.max(s.length, 1);
  if (alphaRatio < 0.35) return Math.round(alphaRatio * 80);

  const words = s
    .toLowerCase()
    .split(/[\s,;|]+/)
    .map((w) => w.replace(/[^a-zà-ÿ@.+-]/g, ''))
    .filter((w) => w.length >= 2);
  if (!words.length) return 0;

  let plausible = 0;
  for (const w of words) {
    if (/@/.test(w) && /\./.test(w)) {
      plausible++;
      continue;
    }
    if (/^\d{4}$/.test(w) || /^(19|20)\d{2}$/.test(w)) {
      plausible++;
      continue;
    }
    if (w.length <= 2 && /^[a-z]{1,2}$/.test(w)) continue;
    if (/[aeiouyàâéèêëïîôùûüœ]{1,}/i.test(w) || SECTION_WORDS.has(w)) plausible++;
    else if (w.length >= 4 && /[bcdfghjklmnpqrstvwxyz]{2,}/i.test(w)) plausible += 0.4;
  }
  const wordRatio = plausible / words.length;
  let score = Math.round(alphaRatio * 40 + wordRatio * 60);
  if (/[àâéèêëïîôùûüœ]/i.test(s)) score = Math.min(100, score + 8);
  return Math.min(100, score);
}

/**
 * @param {{ text?: string, lines?: Array<{ text?: string, confidence?: number }> }} candidate
 */
export function scoreOcrCandidate(candidate) {
  const text = String(candidate?.text || '').trim();
  const lines = candidate?.lines || [];
  const lineList = lines.length
    ? lines.map((l) => String(l.text || '').trim()).filter(Boolean)
    : text.split('\n').map((l) => l.trim()).filter(Boolean);

  const confidences = lines.map((l) => Number(l.confidence) || 0).filter((c) => c > 0);
  const confidence = confidences.length
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : Math.min(85, Math.max(40, Math.round(languageScore(text) * 0.85)));

  const corruption = corruptionScore(text || lineList.join('\n'));
  const language = languageScore(text || lineList.join('\n'));

  const qualitySum = lineList.reduce((s, l) => s + Math.max(0, lineQuality(l)), 0);
  const qualityBonus = lineList.length ? Math.min(15, qualitySum / lineList.length / 4) : 0;

  const total =
    confidence * 0.42 +
    (100 - corruption) * 0.38 +
    language * 0.2 +
    qualityBonus;

  return {
    confidence,
    corruption,
    language,
    qualityBonus: Math.round(qualityBonus * 10) / 10,
    total: Math.round(total * 10) / 10,
    lineCount: lineList.length,
    charCount: text.length,
  };
}

/**
 * @param {Record<'A'|'B'|'C'|'D', { text: string, lines?: unknown[], scores?: object }>} candidates
 * @returns {{ winnerId: string, winner: object, scores: Record<string, object>, ranked: string[] }}
 */
export function pickFusionWinner(candidates) {
  const ids = ['A', 'B', 'C', 'D'];
  const scored = {};
  for (const id of ids) {
    const c = candidates[id];
    if (!c) continue;
    scored[id] = c.scores || scoreOcrCandidate(c);
  }

  const ranked = ids
    .filter((id) => scored[id] && (candidates[id]?.text || candidates[id]?.lines?.length))
    .sort((a, b) => {
      const sa = scored[a];
      const sb = scored[b];
      if (sb.total !== sa.total) return sb.total - sa.total;
      if (sa.corruption !== sb.corruption) return sa.corruption - sb.corruption;
      return sb.confidence - sa.confidence;
    });

  const winnerId = ranked[0] || 'A';
  const winner = candidates[winnerId] || { text: '', lines: [] };

  return { winnerId, winner, scores: scored, ranked };
}

/**
 * Line-level fusion fallback when scores are tied (internal).
 * @param {string[]} texts
 */
export function fuseOcrPageTexts(texts) {
  const valid = (texts || [])
    .map((t) => String(t || '').trim())
    .filter((t) => t.length > 4);
  if (!valid.length) return '';
  if (valid.length === 1) return valid[0];

  const entries = [];
  const lineSets = valid.map((t) =>
    t
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 1)
  );

  lineSets.forEach((lines, passIdx) => {
    lines.forEach((line, lineIdx) => {
      if (isGarbageLine(line) || isOcrNameGarbage(line)) return;
      const qi = lineQuality(line);
      if (qi < -80) return;
      let ei = -1;
      for (let i = 0; i < entries.length; i++) {
        if (linesSimilar(entries[i].line, line)) {
          ei = i;
          break;
        }
      }
      if (ei < 0) {
        entries.push({ line, score: qi, votes: 1, order: passIdx * 10000 + lineIdx });
      } else {
        entries[ei].votes += 1;
        entries[ei].score = Math.max(entries[ei].score, qi) + entries[ei].votes * 2;
        if (line.length > entries[ei].line.length && lineQuality(line) >= entries[ei].score - 3) {
          entries[ei].line = line;
        }
        entries[ei].order = Math.min(entries[ei].order, passIdx * 10000 + lineIdx);
      }
    });
  });

  const primary = lineSets.reduce((best, cur) => (cur.length > best.length ? cur : best), []);
  const ordered = [];
  const used = new Set();

  primary.forEach((line) => {
    if (isGarbageLine(line) || isOcrNameGarbage(line)) return;
    for (const e of entries) {
      if (!linesSimilar(e.line, line)) continue;
      if (isGarbageLine(e.line) || isOcrNameGarbage(e.line)) continue;
      const key = normalizeFusionLineKey(e.line);
      if (used.has(key)) return;
      ordered.push(e.line);
      used.add(key);
    }
  });

  entries
    .sort((a, b) => a.order - b.order || b.score - a.score)
    .forEach((e) => {
      if (isGarbageLine(e.line) || isOcrNameGarbage(e.line)) return;
      const key = normalizeFusionLineKey(e.line);
      if (!used.has(key)) {
        ordered.push(e.line);
        used.add(key);
      }
    });

  return ordered.join('\n');
}

/**
 * Build internal fusion record (not for UI).
 */
export function buildFusionRecord(candidates, pick) {
  return {
    winnerId: pick.winnerId,
    candidateA: summarizeCandidate(candidates.A),
    candidateB: summarizeCandidate(candidates.B),
    candidateC: summarizeCandidate(candidates.C),
    candidateD: summarizeCandidate(candidates.D),
    scores: pick.scores,
    ranked: pick.ranked,
    at: new Date().toISOString(),
  };
}

function summarizeCandidate(c) {
  if (!c) return null;
  return {
    charCount: c.text?.length || 0,
    lineCount: c.lines?.length || 0,
    scores: c.scores || null,
    textPreview: String(c.text || '').slice(0, 120),
  };
}

/**
 * Line-level fusion across passes A–D with per-line candidate + confidence + source.
 * @param {Record<string, { text?: string, lines?: Array<{ text?: string, confidence?: number, page?: number, line?: number, x?: number, y?: number }>, scores?: object, id?: string }>} candidates
 * @param {{ winnerId?: string, scores?: Record<string, object> }} [pick]
 * @param {{ page?: number, defaultConfidence?: number }} [opts]
 * @returns {import('./extracted-line.js').ExtractedLine[]}
 */
export function fuseOcrCandidatesToLines(candidates, pick = {}, opts = {}) {
  const ids = ['A', 'B', 'C', 'D'];
  const passTexts = ids
    .map((id) => String(candidates[id]?.text || '').trim())
    .filter((t) => t.length > 4);
  const fusedText = fuseOcrPageTexts(passTexts.length ? passTexts : []);
  const fusedLines = fusedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && !isGarbageLine(l) && !isOcrNameGarbage(l));

  const page = opts.page || 1;
  const fallbackConf = opts.defaultConfidence ?? 68;

  return fusedLines.map((lineText, lineIndex) => {
    let bestId = pick.winnerId || 'A';
    let bestLine = lineText;
    let bestConf = fallbackConf;
    let bestScore = -Infinity;

    for (const id of ids) {
      const c = candidates[id];
      if (!c?.lines?.length) continue;
      const passScores = c.scores || pick.scores?.[id] || scoreOcrCandidate(c);
      for (const ln of c.lines) {
        const t = String(ln.text || '').trim();
        if (!t || !linesSimilar(t, lineText)) continue;
        const conf = Number(ln.confidence) || passScores.confidence || fallbackConf;
        const total =
          conf * 0.45 +
          (100 - (passScores.corruption ?? corruptionScore(t))) * 0.25 +
          (passScores.language ?? languageScore(t)) * 0.15 +
          Math.max(0, lineQuality(t)) * 0.15;
        if (total > bestScore) {
          bestScore = total;
          bestId = id;
          bestLine = t.length >= lineText.length ? t : lineText;
          bestConf = Math.round(conf);
        }
      }
    }

    if (bestScore === -Infinity) {
      const passScores = pick.scores?.[bestId] || scoreOcrCandidate(candidates[bestId] || { text: lineText });
      bestConf = Math.round(passScores.confidence || fallbackConf);
    }

    return {
      text: bestLine,
      rawExtraction: lineText,
      cleanedText: bestLine,
      confidence: Math.min(100, Math.max(0, bestConf)),
      source: 'ocr',
      candidate: bestId,
      page,
      line: lineIndex,
      x: 0,
      y: 0,
    };
  });
}
