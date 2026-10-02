// 画像を縮小・圧縮して dataURL(JPEG)で返す
export function compressImage(fileOrDataUrl, { maxSize = 1600, maxBytes = 650000, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      let size = maxSize;
      let q = quality;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      for (let i = 0; i < 12; i++) {
        const scale = Math.min(1, size / Math.max(width, height));
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', q);
        if (url.length * 0.75 <= maxBytes) return resolve(url);
        if (q > 0.55) q -= 0.08; else size = Math.round(size * 0.85);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.onerror = () => reject(new Error('画像を読み込めませんでした。'));
    if (typeof fileOrDataUrl === 'string') img.src = fileOrDataUrl;
    else {
      const r = new FileReader();
      r.onload = () => (img.src = r.result);
      r.onerror = () => reject(new Error('画像を読み込めませんでした。'));
      r.readAsDataURL(fileOrDataUrl);
    }
  });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('ファイルを読み込めませんでした。'));
    r.readAsDataURL(file);
  });
}

export function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFileName(s) {
  return String(s || 'file').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'file';
}

// 引用符・改行を含むCSVを読む
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function parseList(v) {
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return v ? [v] : []; }
}

export function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

export function fmtDate(ts, withTime = false) {
  const d = toDate(ts);
  if (!d) return '';
  const s = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  return withTime ? `${s} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : s;
}

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function youtubeId(url) {
  const m = /(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/.exec(url || '');
  return m ? m[1] : '';
}

export function normKey(s) {
  return String(s || '').toLowerCase().replace(/\.pdf$/, '').replace(/[^a-z0-9]/g, '');
}
