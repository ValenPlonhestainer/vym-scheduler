'use strict';
// Genera build/icon.ico con el BookOpen exacto de lucide-react (solo contorno, stroke-only)
const { deflateSync } = require('zlib');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

// Fondo blanco, tinta azul primario #2563EB (igual que el navbar)
const BG  = [255, 255, 255, 255];
const INK = [37, 99, 235, 255];

// ── PNG encoder ──────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = (c >>> 8) ^ CRC_TABLE[(c ^ b) & 0xFF];
  return ((c ^ 0xFFFFFFFF) >>> 0);
}

function pngChunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const db = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const lb = Buffer.allocUnsafe(4); lb.writeUInt32BE(db.length);
  const cb = Buffer.allocUnsafe(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, db])));
  return Buffer.concat([lb, tb, db, cb]);
}

function encodePNG(pixels, w, h) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const raw = Buffer.allocUnsafe(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y*(1+w*4)] = 0;
    for (let x = 0; x < w; x++) {
      const s=(y*w+x)*4, d=y*(1+w*4)+1+x*4;
      raw[d]=pixels[s]; raw[d+1]=pixels[s+1]; raw[d+2]=pixels[s+2]; raw[d+3]=pixels[s+3];
    }
  }
  return Buffer.concat([SIG, pngChunk('IHDR',ihdr), pngChunk('IDAT',deflateSync(raw,{level:9})), pngChunk('IEND',Buffer.alloc(0))]);
}

// ── Primitivas de trazo ───────────────────────────────────────────────────────

function drawLine(pix, sz, x1, y1, x2, y2, hw) {
  const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
  if (len < 0.3) return;
  const nx=-dy/len, ny=dx/len;
  const steps = Math.ceil(len*2);
  for (let i=0; i<=steps; i++) {
    const t=i/steps, cx=x1+t*dx, cy=y1+t*dy;
    for (let w=-hw; w<=hw; w+=0.5) {
      const ix=Math.round(cx+w*nx), iy=Math.round(cy+w*ny);
      if (ix>=0 && ix<sz && iy>=0 && iy<sz) {
        const idx=(iy*sz+ix)*4;
        pix[idx]=INK[0]; pix[idx+1]=INK[1]; pix[idx+2]=INK[2]; pix[idx+3]=255;
      }
    }
  }
}

// a0→a1 en radianes; si a1<a0 va CCW (decreasing)
function drawArc(pix, sz, cx, cy, r, a0, a1, hw) {
  const span = Math.abs(a1-a0);
  const segs = Math.max(8, Math.ceil(span * r * 3));
  for (let i=0; i<segs; i++) {
    const t0=i/segs, t1=(i+1)/segs;
    const ax=cx+r*Math.cos(a0+(a1-a0)*t0), ay=cy+r*Math.sin(a0+(a1-a0)*t0);
    const bx=cx+r*Math.cos(a0+(a1-a0)*t1), by=cy+r*Math.sin(a0+(a1-a0)*t1);
    drawLine(pix, sz, ax, ay, bx, by, hw);
  }
}

// ── Construcción del ícono ───────────────────────────────────────────────────

function createPixels(sz) {
  const pix = new Uint8Array(sz * sz * 4);

  // Fondo blanco con esquinas redondeadas
  const rr = Math.round(sz * 0.18);
  for (let y=0; y<sz; y++) for (let x=0; x<sz; x++) {
    const dx=Math.max(0, rr-x, x-(sz-1-rr)), dy=Math.max(0, rr-y, y-(sz-1-rr));
    if (dx*dx+dy*dy <= rr*rr) {
      const i=(y*sz+x)*4; pix[i]=255; pix[i+1]=255; pix[i+2]=255; pix[i+3]=255;
    }
  }

  // BookOpen lucide-react — viewport 24×24, margen 15%
  // paths exactos:
  //   M12 7v14                                        → lomo
  //   M3 18 a1 1 0 0 1 -1 -1 V4 a1 1 0 0 1 1 -1 h5
  //     a4 4 0 0 1 4 4  4 4 0 0 1 4 -4  h5
  //     a1 1 0 0 1 1 1  v13  a1 1 0 0 1 -1 1  h-6
  //     a3 3 0 0 0 -3 3  3 3 0 0 0 -3 -3  z

  const mg = sz * 0.15;
  const sc = (sz - 2*mg) / 24;
  const vx = x => mg + x * sc;
  const vy = y => mg + y * sc;
  // grosor = stroke-width 2 en viewport 24, escalado al tamaño del ícono
  const hw = Math.max(1, (2/24) * (sz - 2*mg) / 2);
  const D = Math.PI / 180;

  // ── Centros de los arcos (calculados con la fórmula SVG arc-to-center) ──
  // Arc (3,18)→(2,17)  r=1 CW  : centro (3,17)
  // Arc (2,4) →(3,3)   r=1 CW  : centro (3,4)
  // Arc (8,3) →(12,7)  r=4 CW  : centro (8,7)
  // Arc (12,7)→(16,3)  r=4 CW  : centro (16,7)
  // Arc (21,3)→(22,4)  r=1 CW  : centro (21,4)
  // Arc (22,17)→(21,18)r=1 CW  : centro (21,17)
  // Arc (15,18)→(12,21)r=3 CCW : centro (15,21)
  // Arc (12,21)→(9,18) r=3 CCW : centro (9,21)

  // Contorno exterior del libro
  drawArc (pix, sz, vx(3), vy(17), 1*sc,  90*D, 180*D, hw); // (3,18)→(2,17)
  drawLine(pix, sz, vx(2), vy(17), vx(2), vy(4),        hw); // (2,17)→(2,4)
  drawArc (pix, sz, vx(3), vy(4),  1*sc, 180*D, 270*D,  hw); // (2,4)→(3,3)
  drawLine(pix, sz, vx(3), vy(3),  vx(8), vy(3),        hw); // (3,3)→(8,3)
  drawArc (pix, sz, vx(8), vy(7),  4*sc, 270*D, 360*D,  hw); // (8,3)→(12,7) — curva sup izq
  drawArc (pix, sz, vx(16),vy(7),  4*sc, 180*D, 270*D,  hw); // (12,7)→(16,3) — curva sup der
  drawLine(pix, sz, vx(16),vy(3),  vx(21),vy(3),        hw); // (16,3)→(21,3)
  drawArc (pix, sz, vx(21),vy(4),  1*sc, 270*D, 360*D,  hw); // (21,3)→(22,4)
  drawLine(pix, sz, vx(22),vy(4),  vx(22),vy(17),       hw); // (22,4)→(22,17)
  drawArc (pix, sz, vx(21),vy(17), 1*sc,   0*D,  90*D,  hw); // (22,17)→(21,18)
  drawLine(pix, sz, vx(21),vy(18), vx(15),vy(18),       hw); // (21,18)→(15,18)
  drawArc (pix, sz, vx(15),vy(21), 3*sc, 270*D, 180*D,  hw); // (15,18)→(12,21) CCW
  drawArc (pix, sz, vx(9), vy(21), 3*sc,   0*D, -90*D,  hw); // (12,21)→(9,18)  CCW
  drawLine(pix, sz, vx(9), vy(18), vx(3), vy(18),       hw); // (9,18)→(3,18) cierre

  // Lomo (spine): M12 7v14
  drawLine(pix, sz, vx(12),vy(7),  vx(12),vy(21),       hw);

  return pix;
}

// ── Downsample (box filter) para anti-aliasing ───────────────────────────────

function downsample(srcPix, srcSz, dstSz) {
  if (srcSz === dstSz) return srcPix;
  const dst = new Uint8Array(dstSz * dstSz * 4);
  const ratio = srcSz / dstSz;
  for (let dy = 0; dy < dstSz; dy++) {
    for (let dx = 0; dx < dstSz; dx++) {
      const sx0 = Math.floor(dx * ratio), sx1 = Math.min(srcSz, Math.floor((dx+1)*ratio));
      const sy0 = Math.floor(dy * ratio), sy1 = Math.min(srcSz, Math.floor((dy+1)*ratio));
      let r=0,g=0,b=0,a=0,n=0;
      for (let sy=sy0; sy<sy1; sy++) for (let sx=sx0; sx<sx1; sx++) {
        const i=(sy*srcSz+sx)*4; r+=srcPix[i]; g+=srcPix[i+1]; b+=srcPix[i+2]; a+=srcPix[i+3]; n++;
      }
      const di=(dy*dstSz+dx)*4;
      dst[di]=r/n|0; dst[di+1]=g/n|0; dst[di+2]=b/n|0; dst[di+3]=a/n|0;
    }
  }
  return dst;
}

// ── BMP-in-ICO encoder ───────────────────────────────────────────────────────

function encodeBMPForICO(pixels, w, h) {
  const rowBytes=w*4, andRowBytes=Math.ceil(w/32)*4;
  const buf=Buffer.alloc(40+rowBytes*h+andRowBytes*h);
  buf.writeUInt32LE(40,0); buf.writeInt32LE(w,4); buf.writeInt32LE(h*2,8);
  buf.writeUInt16LE(1,12); buf.writeUInt16LE(32,14);
  for (let y=0;y<h;y++) {
    const srcY=h-1-y;
    for (let x=0;x<w;x++) {
      const s=(srcY*w+x)*4, d=40+y*rowBytes+x*4;
      buf[d]=pixels[s+2]; buf[d+1]=pixels[s+1]; buf[d+2]=pixels[s]; buf[d+3]=pixels[s+3];
    }
  }
  return buf;
}

function encodeICO(entries) {
  const count=entries.length;
  const hdr=Buffer.allocUnsafe(6);
  hdr.writeUInt16LE(0,0); hdr.writeUInt16LE(1,2); hdr.writeUInt16LE(count,4);
  const dir=Buffer.allocUnsafe(count*16);
  let offset=6+count*16;
  for (let i=0;i<count;i++) {
    const {sz,bmp}=entries[i], s=sz>=256?0:sz;
    dir[i*16+0]=s; dir[i*16+1]=s; dir[i*16+2]=0; dir[i*16+3]=0;
    dir.writeUInt16LE(1,i*16+4); dir.writeUInt16LE(32,i*16+6);
    dir.writeUInt32LE(bmp.length,i*16+8); dir.writeUInt32LE(offset,i*16+12);
    offset+=bmp.length;
  }
  return Buffer.concat([hdr,dir,...entries.map(e=>e.bmp)]);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const SIZES=[16,32,48,256];
const outDir=join(__dirname,'..','build');
mkdirSync(outDir,{recursive:true});

const entries=SIZES.map(sz=>{
  // Renderizar a 8x para tamaños chicos, 4x para medianos, 2x para grandes
  const scale = sz <= 32 ? 8 : sz <= 64 ? 4 : 2;
  const renderSz = sz * scale;
  const srcPix = createPixels(renderSz);
  const pix = downsample(srcPix, renderSz, sz);
  const bmp = encodeBMPForICO(pix,sz,sz);
  console.log(`  ${String(sz).padStart(3)}×${sz}: renderizado a ${renderSz}×${renderSz}, ${bmp.length} bytes`);
  return {sz,bmp};
});
writeFileSync(join(outDir,'icon.ico'), encodeICO(entries));

const pix512=createPixels(512);
writeFileSync(join(outDir,'icon.png'), encodePNG(pix512,512,512));
console.log('\nListo → build/icon.ico  build/icon.png');
