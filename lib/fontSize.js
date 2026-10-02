// 文字の拡大(標準・大・特大)。この端末に覚えておく
export const FONT_SIZES = [
  { key: 'normal', label: '標準', px: 16 },
  { key: 'large', label: '大', px: 18 },
  { key: 'xlarge', label: '特大', px: 20 },
];
const KEY = 'ks-font-size';

export function getFontSize() {
  try { return localStorage.getItem(KEY) || 'normal'; } catch (e) { return 'normal'; }
}

export function applyFontSize(key) {
  const s = FONT_SIZES.find((f) => f.key === key) || FONT_SIZES[0];
  document.documentElement.style.fontSize = s.px + 'px';
  try { localStorage.setItem(KEY, s.key); } catch (e) { /* noop */ }
  return s.key;
}
