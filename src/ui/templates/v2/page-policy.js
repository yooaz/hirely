/**
 * Template V2 page policy — A4 safe, PDF safe, 1-page priority, 2-page max.
 */

import {
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  PDF_PAGE_BREAK_AVOID_SELECTORS,
} from '../../../core/export/pdf-export-config.js';
import { TEMPLATE_V2_PAGE_POLICY } from './contract.js';

export { TEMPLATE_V2_PAGE_POLICY };

/**
 * @param {{ pageCount?: number, overflowPx?: number, widthPx?: number }} metrics
 * @param {object} [policy]
 */
export function evaluateTemplatePagePolicy(metrics = {}, policy = TEMPLATE_V2_PAGE_POLICY) {
  const pages = Number(metrics.pageCount ?? 1);
  const overflow = Number(metrics.overflowPx ?? 0);
  const width = Number(metrics.widthPx ?? A4_WIDTH_PX);

  const withinMax = pages <= policy.maxPages;
  const onePagePriority = pages <= policy.priorityPages;
  const a4Safe = Math.abs(width - policy.widthPx) <= 2;
  const pdfSafe = overflow <= 4;

  return {
    ok: withinMax && a4Safe,
    withinMax,
    onePagePriority,
    a4Safe,
    pdfSafe,
    pages,
    overflowPx: overflow,
    policy,
  };
}

export const TEMPLATE_V2_A4 = Object.freeze({
  widthPx: A4_WIDTH_PX,
  heightPx: A4_HEIGHT_PX,
  widthMm: A4_WIDTH_MM,
  heightMm: A4_HEIGHT_MM,
  pageBreakAvoid: PDF_PAGE_BREAK_AVOID_SELECTORS,
});

/**
 * Recommended DOM classes for export-ready CV shell.
 * @param {string} templateId
 * @param {object} [opts]
 */
export function templateV2ShellClasses(templateId, opts = {}) {
  const spacing = opts.spacing || 'normal';
  return [
    'cv',
    'cv-page',
    'cv--live',
    `template-${templateId}`,
    `spacing-${spacing}`,
    'cvLayout-professional',
  ];
}
