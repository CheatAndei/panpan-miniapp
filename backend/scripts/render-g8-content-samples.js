const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { terminals } = require('../resources/g8-content/bank');
const { topics } = require('../resources/g8-content/topics');
const { renderQuestionCardSvg } = require('../services/g8-content-seed');

async function main() {
  const outputDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'z-rubbish', 'g8-content-samples'));
  fs.mkdirSync(outputDir, { recursive: true });
  const samples = topics.map((topic) => terminals.find((item) => item.topic_key === topic.topic_key));
  for (const item of samples) {
    const target = path.join(outputDir, `${item.source_key}.webp`);
    await sharp(renderQuestionCardSvg(item)).webp({ quality: 90, effort: 4 }).toFile(target);
  }
  process.stdout.write(`${samples.length} sample cards rendered to ${outputDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
