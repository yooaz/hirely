import { cleanOcrNoise, normalizeLineText } from '../_internal/ocr-noise.js';

export class OcrNoiseCleanerService {
  clean(text: string): string {
    return cleanOcrNoise(text);
  }

  normalize(text: string): string {
    return normalizeLineText(text);
  }
}

