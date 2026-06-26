/**
 * FR/EN date normalization — partial ISO (YYYY-MM or YYYY).
 */

const MONTH_MAP: Record<string, string> = {
  jan: '01', janvier: '01',
  feb: '02', février: '02', fevrier: '02',
  mar: '03', mars: '03',
  apr: '04', avril: '04',
  may: '05', mai: '05',
  jun: '06', juin: '06',
  jul: '07', juillet: '07',
  aug: '08', août: '08', aout: '08',
  sep: '09', septembre: '09',
  oct: '10', octobre: '10',
  nov: '11', novembre: '11',
  dec: '12', décembre: '12', decembre: '12',
};

const PRESENT_RE = /\b(present|current|aujourd'?hui|actuel(?:le)?|en cours|now)\b/i;

export function isPresentToken(s: string): boolean {
  return PRESENT_RE.test(String(s || ''));
}

export function normalizePartialDate(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (isPresentToken(t)) return 'present';

  const ym = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)[a-zéû.]*\s*(\d{4})\b/i);
  if (ym) {
    const mKey = ym[1]!.toLowerCase().replace(/[éû.]/g, (c) => (c === 'é' ? 'e' : c === 'û' ? 'u' : ''));
    const month = MONTH_MAP[mKey] || MONTH_MAP[mKey.slice(0, 3)] || '';
    if (month) return `${ym[2]}-${month}`;
  }

  const my = t.match(/\b(\d{1,2})[/.-](\d{4})\b/);
  if (my) {
    const mm = String(my[1]).padStart(2, '0');
    return `${my[2]}-${mm}`;
  }

  const y = t.match(/\b(19|20)\d{2}\b/);
  if (y) return y[0]!;

  return t;
}

export interface ParsedDateRange {
  start_date: string;
  end_date: string;
  is_current: boolean;
  raw: string;
}

export function parseDateRange(line: string): ParsedDateRange | null {
  const raw = String(line || '').trim();
  if (!raw) return null;

  const parts = raw.split(/\s*(?:-|–|—|à|to|until)\s*/i);
  if (parts.length >= 2) {
    const start = normalizePartialDate(parts[0]!);
    const endRaw = parts.slice(1).join(' ');
    const is_current = isPresentToken(endRaw);
    const end = is_current ? 'present' : normalizePartialDate(endRaw);
    return { start_date: start, end_date: end, is_current, raw };
  }

  const since = raw.match(/\b(?:depuis|since)\s+(.+)$/i);
  if (since) {
    return {
      start_date: normalizePartialDate(since[1]!),
      end_date: 'present',
      is_current: true,
      raw,
    };
  }

  const yearOnly = raw.match(/\b(19|20)\d{2}\b/);
  if (yearOnly) {
    return { start_date: yearOnly[0]!, end_date: '', is_current: false, raw };
  }

  return null;
}
