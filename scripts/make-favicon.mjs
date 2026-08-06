// One-off: pad the wide source icon onto a transparent square canvas so it
// renders crisp (not squished) in the browser tab. Outputs 512x512 PNG.
import sharp from 'sharp';

const SRC = 'public/images/icons/straw-hat-favicon.png';
const OUT = 'public/favicon.png';
const SIZE = 512;

const src = sharp(SRC);
const { width, height } = await src.metadata();
const scale = Math.min(SIZE / width, SIZE / height);
const w = Math.round(width * scale);
const h = Math.round(height * scale);

const resized = await src.resize(w, h, { kernel: 'nearest' }).toBuffer();

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: resized, gravity: 'center' }])
  .png()
  .toFile(OUT);

console.log(`Wrote ${OUT} (${SIZE}x${SIZE}) from ${width}x${height} source.`);
