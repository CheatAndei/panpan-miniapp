const fs = require('node:fs');
const path = require('node:path');
const { initDB, getDB } = require('../db/init');
const { importQuestionDataset } = require('../services/practice-question-import');

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((value) => !value.startsWith('--'));
  if (!fileArg) throw new Error('用法：npm run practice:import -- <questions.json> [--commit]');
  const file = path.resolve(process.cwd(), fileArg);
  const dataset = JSON.parse(fs.readFileSync(file, 'utf8'));
  await initDB();
  const result = importQuestionDataset(getDB(), dataset, { dryRun: !args.includes('--commit') });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
