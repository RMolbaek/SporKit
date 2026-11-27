/** Minimal ZIP-skriver (én eller flere filer) til ifcZIP – DEFLATE via CompressionStream, ellers ukomprimeret. */

let crcTabel: Uint32Array | null = null;
export function crc32(d: Uint8Array): number {
  if (!crcTabel) {
    crcTabel = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTabel[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = crcTabel[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(d: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('deflate-raw' as CompressionFormat);
    const buf = await new Response(new Blob([d as BlobPart]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function zip(filer: { navn: string; data: Uint8Array }[], tid = new Date()): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const dosTid = ((tid.getHours() & 31) << 11) | ((tid.getMinutes() & 63) << 5) | ((tid.getSeconds() >> 1) & 31);
  const dosDato = (((tid.getFullYear() - 1980) & 127) << 9) | (((tid.getMonth() + 1) & 15) << 5) | (tid.getDate() & 31);
  const lokale: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const f of filer) {
    const navn = enc.encode(f.navn);
    const crc = crc32(f.data);
    const komp = await deflateRaw(f.data);
    const metode = komp && komp.length < f.data.length ? 8 : 0;
    const data = metode ? komp! : f.data;
    const lh = new Uint8Array(30 + navn.length);
    const v = new DataView(lh.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, metode, true);
    v.setUint16(10, dosTid, true); v.setUint16(12, dosDato, true); v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true); v.setUint32(22, f.data.length, true); v.setUint16(26, navn.length, true); v.setUint16(28, 0, true);
    lh.set(navn, 30);
    const ch = new Uint8Array(46 + navn.length);
    const c = new DataView(ch.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, metode, true);
    c.setUint16(12, dosTid, true); c.setUint16(14, dosDato, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, f.data.length, true);
    c.setUint16(28, navn.length, true); c.setUint32(42, off, true);
    ch.set(navn, 46);
    lokale.push(lh, data); central.push(ch);
    off += lh.length + data.length;
  }
  const cLen = central.reduce((s, x) => s + x.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, filer.length, true); e.setUint16(10, filer.length, true); e.setUint32(12, cLen, true); e.setUint32(16, off, true);
  const ud = new Uint8Array(off + cLen + 22);
  let p = 0;
  for (const x of [...lokale, ...central, end]) { ud.set(x, p); p += x.length; }
  return ud;
}
