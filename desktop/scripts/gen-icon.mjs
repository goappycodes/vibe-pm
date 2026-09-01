// Generates the app/tray icons as real PNGs from code (no binary assets checked
// in). A simple stopwatch mark: emerald disc, white hand, white center dot.
// Run automatically before packaging; also: `node scripts/gen-icon.mjs`.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// --- tiny PNG encoder (RGBA, 8-bit) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // raw scanlines with filter byte 0 per row
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4); // transparent
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46; // disc radius
  const handW = size * 0.05;
  const handLen = size * 0.3;
  const dotR = size * 0.06;
  const emerald = [16, 185, 129];
  const white = [255, 255, 255];

  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > R + 0.75) continue;
      // soft edge on the disc
      const edge = Math.min(1, Math.max(0, R + 0.5 - dist));
      set(x, y, emerald, Math.round(255 * edge));
    }
  }
  // white hand pointing up (12 o'clock) + center dot
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const inHand =
        Math.abs(dx) <= handW && dy <= 0 && dy >= -handLen;
      const inDot = Math.hypot(dx, dy) <= dotR;
      if (inHand || inDot) set(x, y, white, 255);
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync(join(root, "resources"), { recursive: true });
mkdirSync(join(root, "build"), { recursive: true });

writeFileSync(join(root, "build", "icon.png"), draw(512));
writeFileSync(join(root, "resources", "icon.png"), draw(256));
writeFileSync(join(root, "resources", "tray.png"), draw(32));
console.log("Icons written: build/icon.png, resources/icon.png, resources/tray.png");
