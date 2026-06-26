import { parseDateRange, normalizePartialDate } from '../_internal/date-patterns.js';

export class DateNormalizerService {
  parseRange(line: string) {
    return parseDateRange(line);
  }

  normalizePartial(line: string) {
    return normalizePartialDate(line);
  }
}

