const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const rawDir = path.join(root, 'docs', 'manuals', 'assets', 'raw');
const outDir = path.join(root, 'docs', 'manuals', 'assets', 'teacher');

const shots = {
  'T01-login.png': [
    { n: 1, x: 58, y: 382, w: 300, h: 66, bx: 38, by: 365 },
  ],
  'T03-profile.png': [
    { n: 1, x: 28, y: 364, w: 359, h: 52, bx: 18, by: 348 },
    { n: 2, x: 28, y: 474, w: 359, h: 69, bx: 397, by: 459 },
  ],
  'T04-home-classes.png': [
    { n: 1, x: 340, y: 420, w: 55, h: 44, bx: 324, by: 405 },
  ],
  'T05-new-class.png': [
    { n: 1, x: 16, y: 406, w: 384, h: 53, bx: 13, by: 393 },
    { n: 2, x: 16, y: 494, w: 384, h: 53, bx: 405, by: 482 },
    { n: 3, x: 16, y: 581, w: 384, h: 53, bx: 13, by: 568 },
    { n: 4, x: 16, y: 643, w: 384, h: 69, bx: 405, by: 630 },
  ],
  'T06-class-result.png': [
    { n: 1, x: 267, y: 216, w: 48, h: 42, bx: 250, by: 202 },
    { n: 2, x: 15, y: 705, w: 386, h: 69, bx: 12, by: 690 },
  ],
  'T07-new-student-top.png': [
    { n: 1, x: 16, y: 196, w: 384, h: 53, bx: 13, by: 183 },
    { n: 2, x: 16, y: 288, w: 384, h: 55, bx: 405, by: 275 },
    { n: 3, x: 16, y: 384, w: 384, h: 55, bx: 13, by: 371 },
  ],
  'T08-student-traits.png': [
    { n: 1, x: 16, y: 595, w: 120, h: 42, bx: 12, by: 579 },
    { n: 2, x: 16, y: 643, w: 384, h: 70, bx: 405, by: 630 },
  ],
  'T09-student-code.png': [
    { n: 1, x: 279, y: 289, w: 111, h: 34, bx: 396, by: 277 },
    { n: 2, x: 245, y: 327, w: 46, h: 38, bx: 230, by: 315 },
    { n: 3, x: 292, y: 327, w: 46, h: 38, bx: 350, by: 315 },
  ],
};

function overlay(width, height, marks) {
  const red = '#e53935';
  const nodes = marks.map(({ n, x, y, w, h, bx, by }) => {
    const targetX = Math.max(x + 8, Math.min(x + w - 8, bx < x ? x : x + w));
    const targetY = Math.max(y + 8, Math.min(y + h - 8, by < y ? y : y + h));
    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"
        fill="none" stroke="${red}" stroke-width="4"/>
      <line x1="${bx}" y1="${by}" x2="${targetX}" y2="${targetY}"
        stroke="${red}" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)"/>
      <circle cx="${bx}" cy="${by}" r="15" fill="${red}" stroke="#fff" stroke-width="2"/>
      <text x="${bx}" y="${by + 6}" text-anchor="middle" font-family="Arial, Microsoft YaHei, sans-serif"
        font-weight="700" font-size="18" fill="#fff">${n}</text>`;
  }).join('');

  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#fff" flood-opacity="1"/>
      </filter>
      <marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L9,4.5 L0,9 z" fill="${red}"/>
      </marker>
    </defs>
    <g filter="url(#shadow)">${nodes}</g>
  </svg>`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [file, marks] of Object.entries(shots)) {
    const input = path.join(rawDir, file);
    const output = path.join(outDir, file);
    const image = sharp(input);
    const { width, height } = await image.metadata();
    await image
      .composite([{ input: overlay(width, height, marks), left: 0, top: 0 }])
      .png()
      .toFile(output);
    process.stdout.write(`${path.relative(root, output)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
