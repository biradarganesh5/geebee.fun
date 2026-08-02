// One-off: generate responsive hero image tiers + a base64 LQIP placeholder
// from the source photo, written into public/images/hero/.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'images/hero/20240603_180248(1).jpg';
const OUT_DIR = 'public/images/hero';
mkdirSync(OUT_DIR, { recursive: true });

const tiers = [
  { name: 'hero-small.jpg', width: 480 },
  { name: 'hero-medium.jpg', width: 1024 },
  { name: 'hero-large.jpg', width: 2000 },
];

for (const { name, width } of tiers) {
  await sharp(SRC)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${OUT_DIR}/${name}`);
  console.log(`wrote ${OUT_DIR}/${name} (${width}w)`);
}

// Also keep a full-resolution original for reference / max quality.
await sharp(SRC).jpeg({ quality: 86, mozjpeg: true }).toFile(`${OUT_DIR}/hero-full.jpg`);
console.log(`wrote ${OUT_DIR}/hero-full.jpg (3000w)`);

// Tiny blurred LQIP as a base64 data URI (kept small so it inlines cheaply).
const lqipBuf = await sharp(SRC)
  .resize({ width: 24 })
  .blur(1.2)
  .jpeg({ quality: 40 })
  .toBuffer();
const lqip = `data:image/jpeg;base64,${lqipBuf.toString('base64')}`;
console.log('\nLQIP_DATA_URI_START');
console.log(lqip);
console.log('LQIP_DATA_URI_END');
