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
  const workingRoot = path.join(__dirname, '..', '..', 'z-rubbish', 'panpan-g8-exam-bank');
  const pdfRoot = path.resolve(value('--pdf-root', path.join(workingRoot, 'pdfs')));
  const auditPath = path.resolve(value('--audit', path.join(workingRoot, 'pdf-quality-report.json')));
  const publish = !args.includes('--draft');
  await initDB();
  const db = getDB();
  const questions = seedG8SourcePack(db);
  const papers = syncG8ExamPapers(db, {
    pdfRoot,
    auditPath,
    publish,
    strict: true,
  });
  console.log(JSON.stringify({ ok: true, questions, papers }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
