const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);

function value(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function safeSourceFile(root, relativePath) {
  const base = path.resolve(root);
  const file = path.resolve(base, String(relativePath || ''));
  if (!file.startsWith(`${base}${path.sep}`)) throw new Error(`试卷路径越界：${relativePath}`);
  return file;
}

function copyAsset(file, kind, expected) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`源文件不存在：${file}`);
  const stat = fs.statSync(file);
  if (Number(expected?.byte_size) !== stat.size) throw new Error(`源文件大小不符：${file}`);
  const digest = sha256(file);
  if (digest !== String(expected?.sha256 || '').toLowerCase()) throw new Error(`源文件哈希不符：${file}`);
  const extension = path.extname(file).toLowerCase();
  if (!['.pdf', '.doc', '.docx'].includes(extension)) throw new Error(`试卷格式无效：${file}`);
  return { stat, digest, extension };
}

function questionLinks(packRoot) {
  const { mappedTopics } = require('../services/g8-source-pack-seed');
  const sources = [
    { file: path.join(packRoot, 'choice', 'manifest.json'), kind: 'choice' },
    { file: path.join(packRoot, 'terminal', 'manifest.json'), kind: 'terminal' },
  ];
  if (sources.some(({ file }) => !fs.existsSync(file))) return [];
  return sources.flatMap(({ file, kind }) => (
    (readJson(file).questions || [])
      .filter((item) => mappedTopics(item).length > 0)
      .map((item) => ({
        kind,
        question_key: item.source_key,
        exam_stable_code: item.exam_stable_code,
      }))
  ));
}

function buildG8ExamBundle({
  manifestPath,
  auditPath,
  sourceRoot,
  outputRoot,
  requireQuestionLinks = false,
}) {
  for (const file of [manifestPath, auditPath]) {
    if (!file || !fs.existsSync(file)) throw new Error(`文件不存在：${file || ''}`);
  }
  if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error(`八上试卷源目录不存在：${sourceRoot || ''}`);
  if (!outputRoot) throw new Error('缺少输出目录');

  const manifest = readJson(manifestPath);
  const audit = readJson(auditPath);
  if (audit.ok !== true) throw new Error('八上题源审计未通过');
  if (!Array.isArray(manifest.papers) || manifest.papers.length !== 206) {
    throw new Error(`八上试卷数量异常：${manifest.papers?.length || 0}`);
  }
  if (Number(manifest.summary?.paired_papers) !== 202) throw new Error('八上答案配对数量异常');

  fs.mkdirSync(outputRoot, { recursive: true });
  const papers = manifest.papers.map((paper) => {
    const paperPath = safeSourceFile(sourceRoot, paper.source_relative_path);
    const original = copyAsset(paperPath, 'paper', paper.paper);
    const paperTarget = path.join(
      outputRoot,
      'paper',
      original.digest.slice(0, 2),
      `${original.digest}${original.extension}`,
    );
    fs.mkdirSync(path.dirname(paperTarget), { recursive: true });
    if (!fs.existsSync(paperTarget)) fs.copyFileSync(paperPath, paperTarget, fs.constants.COPYFILE_EXCL);

    let answer = null;
    if (paper.answer) {
      const answerPath = safeSourceFile(
        sourceRoot,
        path.join(path.dirname(paper.source_relative_path), paper.answer.name),
      );
      const checked = copyAsset(answerPath, 'answer', paper.answer);
      const answerTarget = path.join(
        outputRoot,
        'answer',
        checked.digest.slice(0, 2),
        `${checked.digest}${checked.extension}`,
      );
      fs.mkdirSync(path.dirname(answerTarget), { recursive: true });
      if (!fs.existsSync(answerTarget)) fs.copyFileSync(answerPath, answerTarget, fs.constants.COPYFILE_EXCL);
      answer = {
        name: paper.answer.name,
        sha256: checked.digest,
        byte_size: checked.stat.size,
      };
    }

    const isMock = paper.source_kind === 'mock_or_review';
    const displayTitle = isMock && !String(paper.display_title).startsWith('模拟/复习')
      ? `模拟/复习 · ${paper.display_title}`
      : paper.display_title;
    return {
      stable_code: paper.stable_code,
      display_title: displayTitle,
      school_name: paper.school_name || '',
      district: paper.district || '',
      school_year: paper.school_year || '',
      exam_year: paper.exam_year,
      grade: '八年级',
      grade_code: 'g8',
      subject_code: 'math',
      semester: '上学期',
      semester_code: 's1',
      exam_type: isMock ? 'mock' : paper.exam_type,
      source_kind: paper.source_kind,
      source_relative_path: paper.source_relative_path,
      paper: {
        name: paper.paper.name,
        sha256: original.digest,
        byte_size: original.stat.size,
      },
      answer,
    };
  });

  const importManifest = {
    version: 'panpan-g8-exam-bundle-v1',
    generated_at: new Date().toISOString(),
    source_manifest_sha256: sha256(manifestPath),
    quality_report_sha256: sha256(auditPath),
    expected: {
      papers: papers.length,
      answers: papers.filter((paper) => paper.answer).length,
      guangzhou_exam: papers.filter((paper) => paper.source_kind === 'guangzhou_exam').length,
      mock_or_review: papers.filter((paper) => paper.source_kind === 'mock_or_review').length,
      question_links: 0,
      grade_code: 'g8',
      subject_code: 'math',
    },
    question_links: questionLinks(path.dirname(manifestPath)),
    papers,
  };
  importManifest.expected.question_links = importManifest.question_links.length;
  if (importManifest.expected.answers !== 202
    || importManifest.expected.guangzhou_exam !== 192
    || importManifest.expected.mock_or_review !== 14
    || (requireQuestionLinks && importManifest.expected.question_links !== 989)) {
    throw new Error(`八上来源统计异常：${JSON.stringify(importManifest.expected)}`);
  }
  fs.writeFileSync(
    path.join(outputRoot, 'import-manifest.json'),
    `${JSON.stringify(importManifest, null, 2)}\n`,
  );
  return importManifest;
}

function main() {
  const packRoot = path.join(__dirname, '..', 'resources', 'choice-king', 'g8-source-pack');
  const result = buildG8ExamBundle({
    manifestPath: path.resolve(value('--manifest', path.join(packRoot, 'exam-manifest.json'))),
    auditPath: path.resolve(value('--audit', path.join(packRoot, 'audit', 'audit-report.json'))),
    sourceRoot: path.resolve(value('--source-root')),
    outputRoot: path.resolve(value('--output')),
    requireQuestionLinks: true,
  });
  console.log(JSON.stringify(result.expected));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  buildG8ExamBundle,
};
