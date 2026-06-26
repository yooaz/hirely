import { isExtensionConsoleNoise } from '../../lib/qa-console-filter.mjs';

/** Playwright E2E — ignore extension / DevTools noise; fail on real app errors. */
const E2E_IGNORE_PATTERNS = [
  /tabs:outgoing\.message\.ready/i,
  /extension-cdn/i,
  /download the react devtools/i,
  /react devtools/i,
];

export function isIgnoredConsoleNoise(text: string): boolean {
  if (!text) return false;
  if (isExtensionConsoleNoise(text)) return true;
  return E2E_IGNORE_PATTERNS.some((re) => re.test(text));
}

export function isFatalAppConsoleError(text: string): boolean {
  if (!text || isIgnoredConsoleNoise(text)) return false;
  return (
    /CORE_BOOT_FAILED|HIRELY_ENGINE_FAILED/i.test(text) ||
    /does not provide an export named/i.test(text) ||
    /SyntaxError/i.test(text)
  );
}

export type RecordedConsole = {
  consoleErrors: string[];
  pageErrors: string[];
  fatalErrors: string[];
};

export function attachConsoleErrorRecorder(page: import('@playwright/test').Page): RecordedConsole {
  const recorded: RecordedConsole = {
    consoleErrors: [],
    pageErrors: [],
    fatalErrors: [],
  };

  const push = (text: string) => {
    if (isIgnoredConsoleNoise(text)) return;
    if (/CORE_BOOT_FAILED|HIRELY_ENGINE_FAILED|does not provide an export named/i.test(text)) {
      recorded.fatalErrors.push(text);
    }
  };

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || msg.type() === 'warning') {
      if (!isIgnoredConsoleNoise(text)) recorded.consoleErrors.push(`[${msg.type()}] ${text}`);
      push(text);
    }
  });

  page.on('pageerror', (err) => {
    const text = String(err?.message || err);
    if (!isIgnoredConsoleNoise(text)) recorded.pageErrors.push(text);
    push(text);
  });

  return recorded;
}
