/**
 * Tiny CSV exporter shared by every "Download" button in the app.
 *
 * - UTF-8 BOM so Excel renders ₦/accents correctly on Windows.
 * - CRLF line endings (Excel on Windows prefers them).
 * - Numbers are written plain (no ₦, no thousands separators) so columns
 *   arrive as real numeric cells that sum and sort correctly.
 */
export function toCSV(rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function downloadCSV(filename, rows) {
  const blob = new Blob(['\uFEFF' + toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
