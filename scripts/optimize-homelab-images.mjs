// One-off: the rack diagram/photo were added at full camera resolution
// (3695x6354; the photo alone was ~22MB), but they only ever render inside a
// ~384px-wide compare slider. This downscales them to a display-appropriate
// width and writes efficient WebP (plus a smaller PNG fallback) so the page
// isn't shipping tens of megabytes for a tiny box.
import sharp from 'sharp';

const DIR = 'public/images/homelab';
// ~2x the slider's max CSS width (max-w-sm = 384px) for crisp retina display.
const WIDTH = 800;

const jobs = [
  // Photo: lossy WebP is ideal for a photograph.
  { in: `${DIR}/rack-photo.png`, out: `${DIR}/rack-photo.webp`, opts: { quality: 80 } },
  // Diagram: lossless WebP keeps crisp lines/text legible.
  {
    in: `${DIR}/rack-diagram.png`,
    out: `${DIR}/rack-diagram.webp`,
    opts: { lossless: true },
  },
];

for (const job of jobs) {
  await sharp(job.in)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp(job.opts)
    .toFile(job.out);
  console.log(`Wrote ${job.out}`);
}

console.log('Done.');
