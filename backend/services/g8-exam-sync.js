const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { EXAM_LIBRARY_DIR, ensureExamLibraryDir } = require('../utils/exam-files');
const {
  PACK_ROOT,
  EXAM_MANIFEST,
  mappedTopics,
  sourceLabel,
} = require('./g8-source-pack-seed');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function safeSourceFile(root, relativePath) {
  const base = path.resolve(root);
  const full = path.resolve(base, String(relativePath || ''));
  if (!full.startsWith(`${base}${path.sep}`)) throw new Error(`试卷路径越界：${relativePath}`);
  return full;
}

function mimeType(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.doc') return 'application/msword';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function storeDocument(db, source, kind, expectedHash) {
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`试卷文件缺失：${source}`);
  const existing = db.get('SELECT id FROM exam_assets WHERE sha256=?', [expectedHash]);
  if (existing) return Number(existing.id);
  const digest = sha256File(source);
  if (digest !== expectedHash) throw new Error(`试卷哈希不一致：${source}`);
  const extension = path.extname(source).toLowerCase();
  if (!['.pdf', '.doc', '.docx'].includes(extension)) throw new Error(`试卷格式无效：${source}`);
  const storageKey = `${kind}/g8/${digest.slice(0, 2)}/${digest}${extension}`;
  const target = path.join(EXAM_LIBRARY_DIR, storageKey);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  const created = db.run(`INSERT INTO exam_assets
    (asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES(?,?,?,?,?,?)`, [
    kind, storageKey, path.basename(source), mimeType(source), fs.statSync(source).size, digest,
  ]);
  return Number(created.lastInsertRowid);
}

function linkSourceQuestions(db, packRoot = PACK_ROOT) {
  const manifests = [
    {
      file: path.join(packRoot, 'choice', 'manifest.json'),
      table: 'choice_king_questions',
      keyColumn: 'stable_code',
    },
    {
      file: path.join(packRoot, 'terminal', 'manifest.json'),
      table: 'weekly_challenge_questions',
      keyColumn: 'source_key',
    },
  ];
  let linked = 0;
  for (const config of manifests) {
    if (!fs.existsSync(config.file)) continue;
    for (const item of readJson(config.file).questions || []) {
      if (!mappedTopics(item).length) continue;
      const exam = db.get('SELECT id FROM exam_papers WHERE stable_code=?', [item.exam_stable_code]);
      if (!exam) continue;
      linked += Number(db.run(`UPDATE ${config.table} SET exam_id=?
        WHERE ${config.keyColumn}=? AND COALESCE(exam_id,0)<>?`, [
        exam.id, item.source_key, exam.id,
      ]).changes || 0);
    }
  }
  return linked;
}

function syncG8ExamPapers(db, {
  sourceRoot,
  packRoot = PACK_ROOT,
  manifestPath = path.join(packRoot, path.basename(EXAM_MANIFEST)),
  publish = true,
  strict = true,
} = {}) {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error(`八上试卷源目录不存在：${sourceRoot || ''}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`八上试卷清单不存在：${manifestPath}`);
  ensureExamLibraryDir();
  const manifest = readJson(manifestPath);
  let imported = 0;
  let guangzhouExam = 0;
  let mockOrReview = 0;
  let answers = 0;
  let linkedQuestions = 0;
  const errors = [];

  db.transaction(() => {
    for (const paper of manifest.papers || []) {
      try {
        const paperPath = safeSourceFile(sourceRoot, paper.source_relative_path);
        const answerPath = paper.answer
          ? safeSourceFile(sourceRoot, path.join(path.dirname(paper.source_relative_path), paper.answer.name))
          : null;
        const paperAssetId = storeDocument(db, paperPath, 'paper', paper.paper.sha256);
        const answerAssetId = answerPath
          ? storeDocument(db, answerPath, 'answer', paper.answer.sha256)
          : null;
        const isMock = paper.source_kind === 'mock_or_review';
        const displayTitle = sourceLabel({
          source_label: paper.display_title,
          source_kind: paper.source_kind,
        });
        db.run(`INSERT INTO exam_papers
          (stable_code,display_title,school_name,district,school_year,exam_year,
            grade,grade_code,subject_code,semester,semester_code,exam_type,
            paper_asset_id,answer_asset_id,source_relative_path,license_status,status)
          VALUES(?,?,?,?,?,?,'八年级','g8','math','上学期','s1',?,?,?,?,?,?)
          ON CONFLICT(stable_code) DO UPDATE SET
            display_title=excluded.display_title,school_name=excluded.school_name,
            district=excluded.district,school_year=excluded.school_year,
            exam_year=excluded.exam_year,grade='八年级',grade_code='g8',subject_code='math',
            semester='上学期',semester_code='s1',exam_type=excluded.exam_type,
            paper_asset_id=excluded.paper_asset_id,answer_asset_id=excluded.answer_asset_id,
            source_relative_path=excluded.source_relative_path,
            license_status='teacher_provided',status=excluded.status,updated_at=CURRENT_TIMESTAMP`, [
          paper.stable_code, displayTitle, paper.school_name || '', paper.district || '',
          paper.school_year || '', Number(paper.exam_year) || null,
          isMock ? 'mock' : paper.exam_type, paperAssetId, answerAssetId,
          paper.source_relative_path, 'teacher_provided', publish ? 'published' : 'draft',
        ]);
        imported += 1;
        answers += answerAssetId ? 1 : 0;
        if (isMock) mockOrReview += 1;
        else guangzhouExam += 1;
      } catch (error) {
        errors.push({ stable_code: paper.stable_code, error: error.message });
        if (strict) throw error;
      }
    }
    linkedQuestions = linkSourceQuestions(db, packRoot);
  });
  return {
    imported,
    answers,
    guangzhou_exam: guangzhouExam,
    mock_or_review: mockOrReview,
    linked_questions: linkedQuestions,
    errors,
    published: publish,
  };
}

module.exports = {
  syncG8ExamPapers,
  linkSourceQuestions,
};
