const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initDB, getDB } = require('../db/init');
const { EXAM_LIBRARY_DIR, ensureExamLibraryDir } = require('../utils/exam-files');

const args = process.argv.slice(2);
function arg(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const commit = args.includes('--commit');
const publish = args.includes('--publish');
const sourceRoot = path.resolve(arg('--source', process.env.EXAM_SOURCE_DIR || ''));
const manifestPath = path.resolve(arg('--manifest', path.join(__dirname, '..', 'resources', 'exam-library-manifest.json')));

function walk(root) {
  const rows = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) rows.push(...walk(full));
    else if (/\.(docx?|pdf)$/i.test(entry.name)) rows.push(full);
  }
  return rows;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function examType(relativePath) {
  if (relativePath.includes('期中')) return 'midterm';
  if (relativePath.includes('期末')) return 'final';
  return 'monthly';
}

function examTypeLabel(type) {
  return type === 'midterm' ? '期中' : type === 'final' ? '期末' : '月考';
}

function schoolYear(text) {
  const match = text.match(/(20\d{2})\s*[-~—至]\s*(20\d{2})/);
  if (!match) return { label: '', year: null, short: '' };
  return { label: `${match[1]}-${match[2]}`, year: Number(match[1]), short: `${match[1].slice(2)}–${match[2].slice(2)}` };
}

function schoolName(text) {
  const normalized = text.replace(/精品解析\s*[：:]?/g, '').replace(/广东省/g, '').replace(/广州市广州市/g, '广州市');
  const match = normalized.match(/(?:广州市|广州)([^0-9（）()]{2,36}?(?:中学|学校|书院|教育集团|联考))/);
  if (match) return match[1].replace(/^市/, '').trim();
  const fallback = normalized.split(/20\d{2}|七年级|数学|试题|试卷/)[0]
    .replace(/[：:（）()]/g, '').replace(/^广州市?/, '').trim();
  return fallback.slice(0, 28) || '广州真题';
}

function classifyFiles(files) {
  const isAnswer = (file) => /解析版|答案|参考答案|全解全析|精品解析/i.test(path.basename(file))
    && !/原卷版/i.test(path.basename(file));
  const isAnswerCard = (file) => /答题卡/i.test(path.basename(file));
  const originals = files.filter((file) => !isAnswer(file) && !isAnswerCard(file)
    && /原卷|试题|试卷|真卷|考试版|练习|复习卷|模拟卷/i.test(path.basename(file)));
  const answers = files.filter(isAnswer);
  const paperScore = (file) => {
    const name = path.basename(file);
    return (/\.pdf$/i.test(name) ? 0 : 20) + (/A4/i.test(name) ? 0 : 2) + (/A3/i.test(name) ? 5 : 0) + name.length / 1000;
  };
  const answerScore = (file) => (/全解全析|解析版|精品解析/i.test(path.basename(file)) ? 0 : 5)
    + (/\.pdf$/i.test(file) ? 0 : 1);
  return {
    paper: originals.sort((a, b) => paperScore(a) - paperScore(b))[0] || null,
    answer: answers.sort((a, b) => answerScore(a) - answerScore(b))[0] || null,
  };
}

function buildManifest({ withHashes = false } = {}) {
  const files = walk(sourceRoot);
  const groups = new Map();
  files.forEach((file) => {
    const dir = path.dirname(file);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(file);
  });
  const papers = [];
  const exceptions = [];
  let processed = 0;
  for (const [dir, group] of groups.entries()) {
    const pair = classifyFiles(group);
    if (!pair.paper) {
      exceptions.push({ directory: path.relative(sourceRoot, dir), reason: 'missing_paper', files: group.map((file) => path.basename(file)) });
      continue;
    }
    const relative = path.relative(sourceRoot, pair.paper);
    const type = examType(relative);
    const context = `${path.basename(dir)} ${path.basename(pair.paper)}`;
    const year = schoolYear(context);
    const school = schoolName(context);
    const paperStat = fs.statSync(pair.paper);
    const answerStat = pair.answer ? fs.statSync(pair.answer) : null;
    const paperHash = withHashes ? sha256(pair.paper) : null;
    const answerHash = withHashes && pair.answer ? sha256(pair.answer) : null;
    const stableCode = `GZ7-${type.slice(0, 3).toUpperCase()}-${crypto.createHash('sha1').update(relative).digest('hex').slice(0, 10).toUpperCase()}`;
    papers.push({
      stable_code: stableCode,
      display_title: `${school} · ${year.short || '年份待核'} · 七上${examTypeLabel(type)}`,
      school_name: school,
      school_year: year.label,
      exam_year: year.year,
      exam_type: type,
      source_relative_path: relative,
      paper: { path: pair.paper, name: path.basename(pair.paper), sha256: paperHash, byte_size: paperStat.size, modified_at: paperStat.mtime.toISOString() },
      answer: pair.answer ? { path: pair.answer, name: path.basename(pair.answer), sha256: answerHash, byte_size: answerStat.size, modified_at: answerStat.mtime.toISOString() } : null,
    });
    processed += 1;
    if (withHashes && processed % 25 === 0) console.log(JSON.stringify({ phase: 'hashing', processed, groups: groups.size }));
  }
  papers.sort((a, b) => a.exam_type.localeCompare(b.exam_type) || Number(b.exam_year || 0) - Number(a.exam_year || 0) || a.display_title.localeCompare(b.display_title));
  return { generated_at: new Date().toISOString(), source_root: sourceRoot, papers, exceptions };
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function storeAsset(db, file, kind, hash) {
  const existing = db.get('SELECT * FROM exam_assets WHERE sha256=?', [hash]);
  if (existing) return existing.id;
  const ext = path.extname(file).toLowerCase();
  const storageKey = `${kind}/${hash.slice(0, 2)}/${hash}${ext}`;
  const target = path.join(EXAM_LIBRARY_DIR, storageKey);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
  const result = db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES(?,?,?,?,?,?)`, [kind, storageKey, path.basename(file), mime(file), fs.statSync(file).size, hash]);
  return result.lastInsertRowid;
}

async function main() {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error(`试卷源目录不存在：${sourceRoot}`);
  const manifest = buildManifest({ withHashes: commit });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    ...manifest,
    papers: manifest.papers.map((paper) => ({ ...paper, paper: { ...paper.paper, path: undefined }, answer: paper.answer ? { ...paper.answer, path: undefined } : null })),
  }, null, 2)}\n`);
  console.log(JSON.stringify({ papers: manifest.papers.length, exceptions: manifest.exceptions.length, manifest: manifestPath, commit, publish }));
  if (!commit) return;
  ensureExamLibraryDir();
  await initDB();
  const db = getDB();
  for (const paper of manifest.papers) {
    const paperAssetId = storeAsset(db, paper.paper.path, 'paper', paper.paper.sha256);
    const answerAssetId = paper.answer ? storeAsset(db, paper.answer.path, 'answer', paper.answer.sha256) : null;
    db.run(`INSERT INTO exam_papers(stable_code,display_title,school_name,school_year,exam_year,exam_type,
      paper_asset_id,answer_asset_id,source_relative_path,license_status,status)
      VALUES(?,?,?,?,?,?,?,?,?,'teacher_provided',?) ON CONFLICT(stable_code) DO UPDATE SET
      display_title=excluded.display_title,school_name=excluded.school_name,school_year=excluded.school_year,
      exam_year=excluded.exam_year,paper_asset_id=excluded.paper_asset_id,answer_asset_id=excluded.answer_asset_id,
      source_relative_path=excluded.source_relative_path,updated_at=CURRENT_TIMESTAMP`, [
      paper.stable_code, paper.display_title, paper.school_name, paper.school_year, paper.exam_year,
      paper.exam_type, paperAssetId, answerAssetId, paper.source_relative_path, publish ? 'published' : 'draft',
    ]);
  }
  console.log(JSON.stringify({ imported: manifest.papers.length, exam_library_dir: EXAM_LIBRARY_DIR }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
