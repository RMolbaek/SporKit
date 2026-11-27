/** Indlæsning og download af filer i browseren (alt bliver lokalt). */

/**
 * Læs en tekstfil med det rigtige tegnsæt: XML-erklæringens encoding, ellers UTF-8 med
 * fald tilbage til Windows-1252 (dansk Excel gemmer CSV i det tegnsæt).
 */
export async function laesTekstfil(f: Blob): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  const hoved = new TextDecoder('latin1').decode(buf.subarray(0, 200));
  const m = /^\s*<\?xml[^>]*encoding\s*=\s*["']([\w.-]+)["']/i.exec(hoved);
  if (m) {
    try { return new TextDecoder(m[1].toLowerCase()).decode(buf); } catch { /* ukendt tegnsæt */ }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export function download(navn: string, data: string | Uint8Array, type = 'application/octet-stream'): void {
  const a = document.createElement('a');
  const blob = typeof data === 'string' ? new Blob([data], { type }) : new Blob([data as BlobPart], { type });
  a.href = URL.createObjectURL(blob);
  a.download = navn;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
