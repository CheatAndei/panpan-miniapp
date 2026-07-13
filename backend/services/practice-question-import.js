const crypto = require('node:crypto');

const GRADE_MODULES = {
  小学: new Set(['四则运算', '乘除法', '应用题']),
  初中: new Set(['有理数', '一元一次方程', '整式运算']),
};
const COPY_LICENSES = new Set(['CC0-1.0', 'CC-BY-4.0', 'public-domain']);
const ORIGINAL_LICENSES = new Set(['project-original', ...COPY_LICENSES]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function coreQuestion(item) {
  return {
    grade_band: String(item.grade_band || ''),
    subject: String(item.subject || ''),
    module: String(item.module || ''),
    question_type: String(item.question_type || ''),
    difficulty: Number(item.difficulty),
    template_key: String(item.template_key || ''),
    stem: String(item.stem || ''),
    answer: String(item.answer ?? ''),
    estimated_seconds: Number(item.estimated_seconds),
    signature: String(item.signature || ''),
    provenance: String(item.provenance || ''),
  };
}

function questionContentDigest(item) {
  return sha256(coreQuestion(item));
}

function validateQuestionDataset(dataset) {
  const errors = [];
  const metadata = dataset?.metadata || {};
  const questions = Array.isArray(dataset?.questions) ? dataset.questions : [];
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(String(metadata.batch_key || ''))) errors.push('batch_key 无效');
  if (!String(metadata.source_title || '').trim()) errors.push('缺少 source_title');
  if (!/^https:\/\//.test(String(metadata.source_url || ''))) errors.push('source_url 必须是 HTTPS');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(metadata.source_retrieved_at || ''))) errors.push('source_retrieved_at 无效');
  if (!/^[a-f0-9]{64}$/.test(String(metadata.source_snapshot_sha256 || ''))) errors.push('source_snapshot_sha256 无效');
  if (!ORIGINAL_LICENSES.has(String(metadata.source_license || ''))) errors.push('来源许可不在白名单');
  if (!['self_authored', 'licensed', 'public_domain'].includes(String(metadata.provenance || ''))) errors.push('provenance 无效');
  if (metadata.provenance !== 'self_authored' && !metadata.copy_allowed) errors.push('非自编题必须明确允许复制');
  if (metadata.copy_allowed && metadata.provenance !== 'self_authored' && !COPY_LICENSES.has(metadata.source_license)) {
    errors.push('允许复制的外部题必须是 CC0、CC BY 4.0 或公版');
  }
  if (!questions.length) errors.push('题目为空');

  const signatures = new Set();
  questions.forEach((raw, index) => {
    const item = coreQuestion(raw);
    const label = `第 ${index + 1} 题`;
    if (!GRADE_MODULES[item.grade_band]?.has(item.module)) errors.push(`${label}学段或模块无效`);
    if (item.subject !== '数学') errors.push(`${label}仅支持数学`);
    if (!item.question_type.trim() || !item.template_key.trim()) errors.push(`${label}题型或模板为空`);
    if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5) errors.push(`${label}难度无效`);
    if (!item.stem.trim() || !item.answer.trim()) errors.push(`${label}题干或答案为空`);
    if (!Number.isInteger(item.estimated_seconds) || item.estimated_seconds < 30 || item.estimated_seconds > 600) errors.push(`${label}预计时长无效`);
    if (!/^[a-z0-9][a-z0-9._-]{5,119}$/i.test(item.signature)) errors.push(`${label}签名无效`);
    if (signatures.has(item.signature)) errors.push(`${label}签名重复`);
    signatures.add(item.signature);
    if (item.provenance !== metadata.provenance) errors.push(`${label}provenance 与批次不一致`);
    const contentHash = questionContentDigest(item);
    if (raw.content_sha256 && raw.content_sha256 !== contentHash) errors.push(`${label}内容哈希不匹配`);
  });
  return { errors, metadata, questions };
}

function sameExistingQuestion(existing, item) {
  if (existing.content_sha256) return existing.content_sha256 === questionContentDigest(item);
  return existing.stem === item.stem && existing.answer === item.answer
    && existing.module === item.module && existing.template_key === item.template_key;
}

function inspectQuestionDataset(db, dataset) {
  const validated = validateQuestionDataset(dataset);
  if (validated.errors.length) return { ok: false, errors: validated.errors, insertable: 0, existing: 0 };
  let insertable = 0;
  let existing = 0;
  const conflicts = [];
  for (const raw of validated.questions) {
    const item = coreQuestion(raw);
    const row = db.get('SELECT * FROM practice_questions WHERE signature=?', [item.signature]);
    if (!row) insertable += 1;
    else if (sameExistingQuestion(row, item)) existing += 1;
    else conflicts.push(`签名 ${item.signature} 已被不同内容占用`);
  }
  return { ok: conflicts.length === 0, errors: conflicts, insertable, existing, total: validated.questions.length };
}

function importQuestionDataset(db, dataset, options = {}) {
  const inspection = inspectQuestionDataset(db, dataset);
  if (!inspection.ok) {
    const error = new Error(`题库导入校验失败：${inspection.errors.join('；')}`);
    error.validationErrors = inspection.errors;
    throw error;
  }
  if (options.dryRun !== false) return { ...inspection, dry_run: true, inserted: 0 };
  const metadata = dataset.metadata;
  return db.transaction(() => {
    const existingBatch = db.get('SELECT * FROM practice_question_imports WHERE batch_key=?', [metadata.batch_key]);
    if (existingBatch && existingBatch.source_snapshot_sha256 !== metadata.source_snapshot_sha256) {
      throw new Error('同名题库批次的来源快照已变化，请使用新的 batch_key');
    }
    let inserted = 0;
    for (const raw of dataset.questions) {
      const item = coreQuestion(raw);
      if (db.get('SELECT id FROM practice_questions WHERE signature=?', [item.signature])) continue;
      db.run(`INSERT INTO practice_questions
        (grade_band,subject,module,question_type,difficulty,template_key,stem,answer,estimated_seconds,signature,
         source_type,source_batch,source_title,source_url,source_region,source_license,source_retrieved_at,
         source_snapshot_sha256,content_sha256,copy_allowed)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        item.grade_band, item.subject, item.module, item.question_type, item.difficulty, item.template_key,
        item.stem, item.answer, item.estimated_seconds, item.signature,
        item.provenance === 'self_authored' ? 'self_authored' : 'licensed', metadata.batch_key,
        metadata.source_title, metadata.source_url, metadata.source_region || '', metadata.source_license,
        metadata.source_retrieved_at, metadata.source_snapshot_sha256, questionContentDigest(item),
        metadata.copy_allowed ? 1 : 0,
      ]);
      inserted += 1;
    }
    if (!existingBatch) {
      db.run(`INSERT INTO practice_question_imports
        (batch_key,source_title,source_url,source_region,source_license,source_retrieved_at,source_snapshot_sha256,
         copy_allowed,provenance,imported_count) VALUES(?,?,?,?,?,?,?,?,?,?)`, [
        metadata.batch_key, metadata.source_title, metadata.source_url, metadata.source_region || '', metadata.source_license,
        metadata.source_retrieved_at, metadata.source_snapshot_sha256, metadata.copy_allowed ? 1 : 0,
        metadata.provenance, inserted,
      ]);
    }
    return { ...inspection, dry_run: false, inserted, batch_key: metadata.batch_key };
  });
}

module.exports = {
  COPY_LICENSES,
  questionContentDigest,
  validateQuestionDataset,
  inspectQuestionDataset,
  importQuestionDataset,
};
