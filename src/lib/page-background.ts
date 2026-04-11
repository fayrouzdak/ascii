/** Canvas / export fill; keep in sync with `--page-bg` in global.css */
const FALLBACK = '#141314';

export function getPageBackgroundColor(): string {
  if (typeof document === 'undefined') return FALLBACK;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim();
  return v || FALLBACK;
}
