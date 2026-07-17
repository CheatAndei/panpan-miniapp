const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const { EXAM_LIBRARY_DIR, ensureExamLibraryDir } = require('../utils/exam-files');

const RESOURCE_DIR = path.join(__dirname, '..', 'resources', 'weekly-challenges');
const MANIFEST_PATH = path.join(RESOURCE_DIR, 'manifest.json');

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function storeImage(db, relativePath, kind) {
  const source = path.resolve(RESOURCE_DIR, relativePath);
  if (!source.startsWith(path.resolve(RESOURCE_DIR) + path.sep) || !fs.existsSync(source)) return null;
  const buffer = fs.readFileSync(source);
  const sha256 = hash(buffer);
  const existing = db.get('SELECT id,storage_key FROM exam_assets WHERE sha256=?', [sha256]);
  if (existing) return Number(existing.id);
  const ext = path.extname(source).toLowerCase() || '.png';
  const storageKey = `weekly/${kind}/${sha256.slice(0, 2)}/${sha256}${ext}`;
  const target = path.join(EXAM_LIBRARY_DIR, storageKey);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  const created = db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES(?,?,?,?,?,?)`, [kind, storageKey, path.basename(source), 'image/png', buffer.length, sha256]);
  return Number(created.lastInsertRowid);
}

function seedWeeklyChallenges(db) {
  if (!fs.existsSync(MANIFEST_PATH)) return { seeded: 0 };
  ensureExamLibraryDir();
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  let seeded = 0;
  db.transaction(() => {
    for (const item of manifest.questions || []) {
      if (!['choice', 'fill', 'subjective'].includes(item.question_type)) continue;
      const questionAssetId = storeImage(db, item.question_image, 'question');
      const answerAssetId = item.answer_image ? storeImage(db, item.answer_image, 'answer_image') : null;
      if (!questionAssetId) continue;
      const examId = item.exam_stable_code
        ? db.get('SELECT id FROM exam_papers WHERE stable_code=?', [item.exam_stable_code])?.id || null
        : null;
      db.run(`INSERT INTO weekly_challenge_questions
        (source_key,exam_id,question_type,title,question_asset_id,answer_asset_id,answer_text,source_label,is_active)
        VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT(source_key) DO UPDATE SET
        exam_id=COALESCE(excluded.exam_id,weekly_challenge_questions.exam_id),title=excluded.title,
        question_asset_id=excluded.question_asset_id,answer_asset_id=excluded.answer_asset_id,
        answer_text=excluded.answer_text,source_label=excluded.source_label,is_active=1`, [
        item.source_key, examId, item.question_type, item.title, questionAssetId, answerAssetId,
        item.answer_text || '', item.source_label || '',
      ]);
      seeded += 1;
    }
  });
  return { seeded };
}

module.exports = { seedWeeklyChallenges, RESOURCE_DIR, MANIFEST_PATH };
