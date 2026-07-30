const path = require('node:path');
const { initDB, getDB } = require('../db/init');
const { seedG8SourcePack } = require('../services/g8-source-pack-seed');
const { syncG8ExamPapers } = require('../services/g8-exam-sync');

const args = process.argv.slice(2);
function value(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function main() {
  const sourceRoot = path.resolve(value('--source', process.env.G8_EXAM_SOURCE_DIR || ''));
  const publish = !args.includes('--draft');
  await initDB();
  const db = getDB();
  const questions = seedG8SourcePack(db);
  const papers = syncG8ExamPapers(db, { sourceRoot, publish, strict: true });
  console.log(JSON.stringify({ ok: true, questions, papers }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
