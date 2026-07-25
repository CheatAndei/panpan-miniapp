const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
function value(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const manifestPath = path.resolve(value('--manifest'));
const auditPath = path.resolve(value('--audit'));
const pdfRoot = path.resolve(value('--pdf-root'));
const outputRoot = path.resolve(value('--output'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyAsset(file, kind, expectedHash) {
  const hash = sha256(file);
  if (expectedHash && hash !== expectedHash) throw new Error(`质检后文件发生变化：${file}`);
  const target = path.join(outputRoot, kind, hash.slice(0, 2), `${hash}.pdf`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
  return {
    name: path.basename(file),
    sha256: hash,
    byte_size: fs.statSync(file).size,
  };
}

function main() {
  for (const file of [manifestPath, auditPath]) {
    if (!fs.existsSync(file)) throw new Error(`文件不存在：${file}`);
  }
  const manifest = readJson(manifestPath);
  const audit = readJson(auditPath);
  const audited = new Map(
    (audit.files || []).map((item) => [`${item.stable_code}:${item.role}`, item]),
  );
  fs.mkdirSync(outputRoot, { recursive: true });
  const excludedAnswers = [];
  const papers = (manifest.papers || []).map((paper) => {
    const originalPath = path.join(pdfRoot, 'original', `${paper.stable_code}.pdf`);
    const originalAudit = audited.get(`${paper.stable_code}:original`);
    if (!originalAudit || originalAudit.errors?.length) throw new Error(`原卷未通过质检：${paper.stable_code}`);
    let answer = null;
    if (paper.answer) {
      const answerPath = path.join(pdfRoot, 'answer', `${paper.stable_code}.pdf`);
      const answerAudit = audited.get(`${paper.stable_code}:answer`);
      if (!answerAudit || answerAudit.errors?.length) {
        excludedAnswers.push({
          stable_code: paper.stable_code,
          errors: answerAudit?.errors || ['missing_audit'],
        });
      } else {
        answer = copyAsset(answerPath, 'answer', answerAudit.sha256);
      }
    }
    return {
      stable_code: paper.stable_code,
      display_title: paper.display_title,
      school_name: paper.school_name,
      district: paper.school_name,
      school_year: paper.school_year,
      exam_year: paper.exam_year,
      grade: '七年级',
      grade_code: 'g7',
      subject_code: 'math',
      semester: '上学期',
      semester_code: 's1',
      exam_type: paper.exam_type,
      source_relative_path: paper.source_relative_path,
      paper: copyAsset(originalPath, 'paper', originalAudit.sha256),
      answer,
    };
  });
  const importManifest = {
    version: 'panpan-exam-pdf-bundle-v1',
    generated_at: new Date().toISOString(),
    source_manifest_sha256: sha256(manifestPath),
    quality_report_sha256: sha256(auditPath),
    expected: {
      papers: papers.length,
      answers: papers.filter((paper) => paper.answer).length,
      grade_code: 'g7',
      subject_code: 'math',
    },
    excluded_answers: excludedAnswers,
    papers,
  };
  fs.writeFileSync(
    path.join(outputRoot, 'import-manifest.json'),
    `${JSON.stringify(importManifest, null, 2)}\n`,
  );
  console.log(JSON.stringify(importManifest.expected));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
