const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const iconDir = path.join(root, 'static', 'icons');
const variants = [
  { source: 'home.svg', output: 'home-tab.png', color: '#7A8981' },
  { source: 'home.svg', output: 'home-tab-active.png', color: '#15946D' },
  { source: 'user.svg', output: 'user-tab.png', color: '#7A8981' },
  { source: 'user.svg', output: 'user-tab-active.png', color: '#15946D' },
];

function recolorSvg(source, color) {
  return source
    .replace(/stroke="#[0-9A-Fa-f]{6}"/g, `stroke="${color}"`)
    .replace(/fill="#[0-9A-Fa-f]{6}"/g, `fill="${color}"`);
}

async function main() {
  for (const item of variants) {
    const sourcePath = path.join(iconDir, item.source);
    const outputPath = path.join(iconDir, item.output);
    const source = fs.readFileSync(sourcePath, 'utf8');
    await sharp(Buffer.from(recolorSvg(source, item.color)))
      .resize(64, 64)
      .png()
      .toFile(outputPath);
    process.stdout.write(`${path.relative(root, outputPath)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
