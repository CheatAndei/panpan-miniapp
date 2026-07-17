const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
function arg(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const sourceRoot = path.resolve(arg('--source', process.env.EXAM_SOURCE_DIR || ''));
const manifestPath = path.resolve(arg('--manifest', path.join(__dirname, '..', 'resources', 'exam-library-manifest.json')));
const apiBase = String(arg('--api', process.env.EXAM_IMPORT_API || 'https://panpan.xpytt.com/api')).replace(/\/$/, '');
const token = String(process.env.EXAM_IMPORT_TOKEN || '');
const concurrency = Math.max(1, Math.min(4, Number.parseInt(arg('--concurrency', '2'), 10) || 2));

function payload(file) {
  const buffer = fs.readFileSync(file);
  return { original_name: path.basename(file), sha256: crypto.createHash('sha256').update(buffer).digest('hex'), base64: buffer.toString('base64') };
}

async function upload(paper) {
  const paperPath = path.join(sourceRoot, paper.source_relative_path);
  const answerPath = paper.answer?.name ? path.join(path.dirname(paperPath), paper.answer.name) : '';
  const body = {
    metadata: {
      stable_code: paper.stable_code, display_title: paper.display_title, school_name: paper.school_name,
      district: paper.district || '', school_year: paper.school_year, exam_year: paper.exam_year,
      grade: '七年级', exam_type: paper.exam_type, source_relative_path: paper.source_relative_path,
    },
    paper: payload(paperPath),
    answer: answerPath && fs.existsSync(answerPath) ? payload(answerPath) : null,
  };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/exams/admin/import-batch`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-exam-import-token': token }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(`${paper.stable_code}: ${lastError?.message || '上传失败'}`);
}

async function main() {
  if (token.length < 32) throw new Error('EXAM_IMPORT_TOKEN 未配置或长度不足');
  if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error(`试卷源目录不存在：${sourceRoot}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const queue = [...(manifest.papers || [])];
  let completed = 0;
  const failures = [];
  async function worker() {
    while (queue.length) {
      const paper = queue.shift();
      try { await upload(paper); }
      catch (error) { failures.push(error.message); }
      completed += 1;
      if (completed % 10 === 0 || completed === manifest.papers.length) {
        console.log(JSON.stringify({ phase: 'upload', completed, total: manifest.papers.length, failures: failures.length }));
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const statusResponse = await fetch(`${apiBase}/exams/admin/status`, { headers: { 'x-exam-import-token': token } });
  const status = await statusResponse.json().catch(() => ({}));
  console.log(JSON.stringify({ ok: failures.length === 0, completed, failures, status }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
