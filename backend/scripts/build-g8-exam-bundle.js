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

function normalizedPdfName(sourceName, stableCode, role) {
  const source = path.basename(String(sourceName || '')).replace(/\.(?:pdf|docx?)$/i, '');
  return `${source || `${stableCode}-${role}`}.pdf`;
}

function copyAsset(file, kind, expected, originalName, outputRoot) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`PDF 文件不存在：${file}`);
  if (!expected) throw new Error(`PDF 缺少质检记录：${file}`);
  const stat = fs.statSync(file);
  if (Array.isArray(expected?.errors) && expected.errors.length) throw new Error(`PDF 未通过质检：${file}`);
  if (Number(expected?.bytes) !== stat.size) throw new Error(`PDF 文件大小不符：${file}`);
  const digest = sha256(file);
  if (digest !== String(expected?.sha256 || '').toLowerCase()) throw new Error(`源文件哈希不符：${file}`);
  const extension = path.extname(file).toLowerCase();
  if (extension !== '.pdf' || fs.readFileSync(file).subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error(`试卷 PDF 格式无效：${file}`);
  }
  const target = path.join(outputRoot, kind, digest.slice(0, 2), `${digest}.pdf`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
  return {
    name: originalName,
    sha256: digest,
    byte_size: stat.size,
  };
}

function questionLinks(packRoot, manifest = {}) {
  const {
    mappedTopics,
    normalizePdfMathText,
    hasUnsupportedPdfGlyph,
  } = require('../services/g8-source-pack-seed');
  const sources = [
    { file: path.join(packRoot, 'choice', 'manifest.json'), kind: 'choice' },
    { file: path.join(packRoot, 'terminal', 'manifest.json'), kind: 'terminal' },
  ];
  if (sources.some(({ file }) => !fs.existsSync(file))) {
    return Array.isArray(manifest.question_links) ? manifest.question_links : [];
  }
  return sources.flatMap(({ file, kind }) => (
    (readJson(file).questions || [])
      .filter((item) => {
        if (!mappedTopics(item).length) return false;
        if (kind !== 'choice') return true;
        const values = [
          ...Object.values(item.source_options || {}).map(normalizePdfMathText),
          normalizePdfMathText(item.explanation),
        ];
        return !values.some(hasUnsupportedPdfGlyph);
      })
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
  pdfRoot,
  outputRoot,
  requireQuestionLinks = false,
}) {
  for (const file of [manifestPath, auditPath]) {
    if (!file || !fs.existsSync(file)) throw new Error(`文件不存在：${file || ''}`);
  }
  if (!pdfRoot || !fs.existsSync(pdfRoot)) throw new Error(`八上 PDF 目录不存在：${pdfRoot || ''}`);
  if (!outputRoot) throw new Error('缺少输出目录');

  const manifest = readJson(manifestPath);
  const audit = readJson(auditPath);
  if (Number(audit.summary?.failed) !== 0) throw new Error('八上 PDF 质检未通过');
  if (!Array.isArray(manifest.papers) || manifest.papers.length !== 206) {
    throw new Error(`八上试卷数量异常：${manifest.papers?.length || 0}`);
  }
  const pairedPapers = Number(manifest.summary?.paired_papers ?? manifest.expected?.answers);
  if (pairedPapers !== 202) throw new Error('八上答案配对数量异常');
  const audited = new Map(
    (audit.files || []).map((item) => [`${item.stable_code}:${item.role}`, item]),
  );

  fs.mkdirSync(outputRoot, { recursive: true });
  const papers = manifest.papers.map((paper) => {
    const paperPath = path.join(pdfRoot, 'original', `${paper.stable_code}.pdf`);
    const original = copyAsset(
      paperPath,
      'paper',
      audited.get(`${paper.stable_code}:original`),
      normalizedPdfName(paper.paper?.name, paper.stable_code, '原卷'),
      outputRoot,
    );

    let answer = null;
    if (paper.answer) {
      const answerPath = path.join(pdfRoot, 'answer', `${paper.stable_code}.pdf`);
      answer = copyAsset(
        answerPath,
        'answer',
        audited.get(`${paper.stable_code}:answer`),
        normalizedPdfName(paper.answer.name, paper.stable_code, '解析'),
        outputRoot,
      );
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
      paper: original,
      answer,
    };
  });

  const importManifest = {
    version: 'panpan-g8-exam-pdf-bundle-v2',
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
    question_links: questionLinks(path.dirname(manifestPath), manifest),
    papers,
  };
  importManifest.expected.question_links = importManifest.question_links.length;
  if (importManifest.expected.answers !== 202
    || importManifest.expected.guangzhou_exam !== 192
    || importManifest.expected.mock_or_review !== 14
    || (requireQuestionLinks && importManifest.expected.question_links !== 987)) {
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
  const workingRoot = path.join(__dirname, '..', '..', 'z-rubbish', 'panpan-g8-exam-bank');
  const output = value('--output');
  if (!output) throw new Error('缺少 --output 输出目录');
  const result = buildG8ExamBundle({
    manifestPath: path.resolve(value('--manifest', path.join(packRoot, 'exam-manifest.json'))),
    auditPath: path.resolve(value('--audit', path.join(workingRoot, 'pdf-quality-report.json'))),
    pdfRoot: path.resolve(value('--pdf-root', path.join(workingRoot, 'pdfs'))),
    outputRoot: path.resolve(output),
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
  questionLinks,
};
