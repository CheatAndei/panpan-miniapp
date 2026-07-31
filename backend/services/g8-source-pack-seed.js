const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { EXAM_LIBRARY_DIR, ensureExamLibraryDir } = require('../utils/exam-files');
const { replaceQuestionTopics } = require('./content-progress');

const PACK_ROOT = path.join(__dirname, '..', 'resources', 'choice-king', 'g8-source-pack');
const CHOICE_MANIFEST = path.join(PACK_ROOT, 'choice', 'manifest.json');
const TERMINAL_MANIFEST = path.join(PACK_ROOT, 'terminal', 'manifest.json');
const EXAM_MANIFEST = path.join(PACK_ROOT, 'exam-manifest.json');
const SOURCE_SCOPE_TO_TOPIC = Object.freeze({
  'g8-01-triangle-lines': 'g8-summer-01-triangle-lines',
  'g8-02-triangle-angles': 'g8-summer-02-triangle-angles',
  'g8-03-congruence-basics': 'g8-summer-03-congruence',
  'g8-04-congruence-bisector-foundation': 'g8-summer-04-congruence-bisector-basic',
  'g8-05-axis-symmetry': 'g8-summer-05-axis-symmetry',
  'g8-06-isosceles-equilateral': 'g8-summer-06-isosceles-equilateral',
  'g8-07-powers-polynomial-products': 'g8-summer-07-powers-polynomials',
  'g8-08-identities-factorization': 'g8-summer-08-formulas-factorization',
  'g8-09-angle-models': 'g8-summer-09-angle-models',
  'g8-10-congruence-bisector-advanced': 'g8-summer-10-congruence-bisector-advanced',
  'g8-11-one-line-three-equal-angles': 'g8-summer-11-one-line-three-angles',
  'g8-12-hand-in-hand': 'g8-summer-12-hand-in-hand',
});
const MANAGED_CHOICE_CODE = /^GZ8-(?:MID|FIN|MON)-/;
const MANAGED_TERMINAL_CODE = /^gz8-terminal-GZ8-/;
const imageCache = new Map();
const LEGACY_PDF_MATH_SYMBOLS = Object.freeze({
  '\uF021': '△',
  '\uF028': '(',
  '\uF029': ')',
  '\uF02B': '+',
  '\uF02D': '−',
  '\uF03C': '<',
  '\uF03D': '=',
  '\uF03E': '>',
  '\uF040': '≌',
  '\uF044': '△',
  '\uF04C': '…',
  '\uF050': '∥',
  '\uF051': '∵',
  '\uF056': '△',
  '\uF05C': '∴',
  '\uF05E': '⊥',
  '\uF061': 'α',
  '\uF062': 'β',
  '\uF067': '·',
  '\uF06E': '■',
  '\uF06F': '°',
  '\uF070': 'π',
  '\uF0A2': '′',
  '\uF0A3': '≤',
  '\uF0B0': '°',
  '\uF0B1': '±',
  '\uF0B3': '≥',
  '\uF0B4': '×',
  '\uF0B7': '•',
  '\uF0B8': '÷',
  '\uF0B9': '≠',
  '\uF0BB': '≈',
  '\uF0D0': '∠',
  '\uF0D7': '×',
  '\uF0E6': '⎛',
  '\uF0E7': '⎜',
  '\uF0E8': '⎝',
  '\uF0EC': '⎧',
  '\uF0ED': '⎨',
  '\uF0EE': '⎩',
  '\uF0EF': '⎪',
  '\uF0F6': '⎞',
  '\uF0F7': '⎟',
  '\uF0F8': '⎠',
});
const UNSUPPORTED_PDF_GLYPH = /[\uE000-\uF8FF\uFFFD]/u;

function normalizePdfMathText(value) {
  return Array.from(String(value || ''))
    .map((character) => LEGACY_PDF_MATH_SYMBOLS[character] || character)
    .join('')
    .trim();
}

function hasUnsupportedPdfGlyph(value) {
  return UNSUPPORTED_PDF_GLYPH.test(String(value || ''));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function mappedTopics(item) {
  const raw = Array.isArray(item?.topic_keys) ? item.topic_keys : [];
  if (!raw.length || item?.scope_confidence === 'low') return [];
  const mapped = raw.map((key) => SOURCE_SCOPE_TO_TOPIC[key]);
  if (mapped.some((key) => !key)) return [];
  return [...new Set(mapped)];
}

function sourceLabel(item) {
  const label = String(item?.source_label || '八上题源').trim();
  return item?.source_kind === 'mock_or_review' && !label.startsWith('模拟/复习')
    ? `模拟/复习 · ${label}`
    : label;
}

function choiceImageUrl(relativePath) {
  const relative = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relative || relative.split('/').includes('..')) throw new Error(`客观题图片路径无效：${relativePath}`);
  return `/api/choice-king/assets/g8-source-pack/choice/${relative.split('/').map(encodeURIComponent).join('/')}`;
}

function safeSourceFile(root, relativePath) {
  const base = path.resolve(root);
  const full = path.resolve(base, String(relativePath || ''));
  if (!full.startsWith(`${base}${path.sep}`)) throw new Error(`资源路径越界：${relativePath}`);
  return full;
}

function storeImage(db, root, relativePath, assetKind) {
  const source = safeSourceFile(root, relativePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`题图缺失：${source}`);
  const stat = fs.statSync(source);
  const cacheKey = `${source}:${stat.size}:${stat.mtimeMs}`;
  const cached = imageCache.get(cacheKey);
  if (cached && db.get('SELECT id FROM exam_assets WHERE id=?', [cached])) return cached;
  const digest = sha256File(source);
  const existing = db.get('SELECT id,storage_key FROM exam_assets WHERE sha256=?', [digest]);
  if (existing) {
    const id = Number(existing.id);
    imageCache.set(cacheKey, id);
    return id;
  }
  const extension = path.extname(source).toLowerCase();
  if (!['.webp', '.png', '.jpg', '.jpeg'].includes(extension)) throw new Error(`题图格式无效：${source}`);
  const storageKey = `weekly/${assetKind}/g8-source/${digest.slice(0, 2)}/${digest}${extension}`;
  const target = path.join(EXAM_LIBRARY_DIR, storageKey);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.copyFileSync(source, target);
  const mimeType = extension === '.webp' ? 'image/webp'
    : extension === '.png' ? 'image/png' : 'image/jpeg';
  const created = db.run(`INSERT INTO exam_assets
    (asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES(?,?,?,?,?,?)`, [
    assetKind, storageKey, path.basename(source), mimeType, stat.size, digest,
  ]);
  const id = Number(created.lastInsertRowid);
  imageCache.set(cacheKey, id);
  return id;
}

function packAudit(packRoot = PACK_ROOT) {
  const choiceManifest = readJson(path.join(packRoot, 'choice', 'manifest.json'));
  const terminalManifest = readJson(path.join(packRoot, 'terminal', 'manifest.json'));
  const choices = choiceManifest.questions || [];
  const terminals = terminalManifest.questions || [];
  const eligibleChoices = choices.filter((item) => mappedTopics(item).length);
  const eligibleTerminals = terminals.filter((item) => mappedTopics(item).length);
  const summarize = (rows) => ({
    total: rows.length,
    eligible: rows.filter((item) => mappedTopics(item).length).length,
    low_confidence: rows.filter((item) => item.scope_confidence === 'low').length,
    unmapped_non_low: rows.filter((item) => item.scope_confidence !== 'low'
      && !mappedTopics(item).length).length,
  });
  return {
    choice: summarize(choices),
    terminal: summarize(terminals),
    eligible_choice: eligibleChoices.length,
    eligible_fill: eligibleTerminals.filter((item) => item.question_type === 'fill').length,
    eligible_subjective: eligibleTerminals.filter((item) => item.question_type === 'subjective').length,
    eligible_multi_topic: [...eligibleChoices, ...eligibleTerminals]
      .filter((item) => mappedTopics(item).length > 1).length,
    eligible_guangzhou_exam: [...eligibleChoices, ...eligibleTerminals]
      .filter((item) => item.source_kind === 'guangzhou_exam').length,
    eligible_mock_or_review: [...eligibleChoices, ...eligibleTerminals]
      .filter((item) => item.source_kind === 'mock_or_review').length,
  };
}

function seedG8SourcePack(db, { packRoot = PACK_ROOT } = {}) {
  const choicePath = path.join(packRoot, 'choice', 'manifest.json');
  const terminalPath = path.join(packRoot, 'terminal', 'manifest.json');
  if (!fs.existsSync(choicePath) || !fs.existsSync(terminalPath)) {
    return { missing: true, choice: 0, terminal: 0 };
  }
  const choiceRows = readJson(choicePath).questions || [];
  const terminalRows = readJson(terminalPath).questions || [];
  const audit = packAudit(packRoot);
  ensureExamLibraryDir();
  let seededChoices = 0;
  let seededTerminals = 0;
  let quarantinedChoices = 0;
  let deactivated = 0;
  const eligibleChoiceCodes = new Set();
  const eligibleTerminalCodes = new Set();

  db.transaction(() => {
    for (const item of choiceRows) {
      const topicKeys = mappedTopics(item);
      if (!topicKeys.length) continue;
      const stableCode = String(item.source_key || '').trim();
      const primaryTopic = SOURCE_SCOPE_TO_TOPIC[item.primary_topic_key] || topicKeys[0];
      const options = Object.fromEntries(Object.entries(item.source_options || {})
        .map(([key, value]) => [key, normalizePdfMathText(value)]));
      const explanation = normalizePdfMathText(item.explanation);
      if (!MANAGED_CHOICE_CODE.test(stableCode)
        || !['A', 'B', 'C', 'D'].every((key) => String(options?.[key] || '').trim())
        || !/^[A-D]$/.test(String(item.correct_option || ''))) {
        throw new Error(`客观题数据无效：${stableCode || 'missing-code'}`);
      }
      if ([...Object.values(options), explanation].some(hasUnsupportedPdfGlyph)) {
        quarantinedChoices += 1;
        continue;
      }
      const examId = db.get('SELECT id FROM exam_papers WHERE stable_code=?', [item.exam_stable_code])?.id || null;
      db.run(`INSERT INTO choice_king_questions
        (stable_code,exam_id,stem,options_json,correct_option,explanation,question_image_url,
          source_label,source_year,source_period,original_question_no,
          grade_code,subject_code,topic_key,difficulty,is_active)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,'g8','math',?,?,1)
        ON CONFLICT(stable_code) DO UPDATE SET
          exam_id=COALESCE(excluded.exam_id,choice_king_questions.exam_id),
          stem=excluded.stem,options_json=excluded.options_json,
          correct_option=excluded.correct_option,explanation=excluded.explanation,
          question_image_url=excluded.question_image_url,source_label=excluded.source_label,
          source_year=excluded.source_year,source_period=excluded.source_period,
          original_question_no=excluded.original_question_no,grade_code='g8',subject_code='math',
          topic_key=excluded.topic_key,difficulty=excluded.difficulty,is_active=1,
          updated_at=CURRENT_TIMESTAMP`, [
        stableCode, examId, '', JSON.stringify(options), item.correct_option,
        explanation, choiceImageUrl(item.question_image),
        sourceLabel(item), Number(item.source_year) || null,
        item.recent_bucket === 'recent' ? 'recent' : 'older',
        String(item.source_question_no || ''), primaryTopic,
        Math.max(1, Math.min(5, Number(item.difficulty) || 2)),
      ]);
      const stored = db.get('SELECT id FROM choice_king_questions WHERE stable_code=?', [stableCode]);
      replaceQuestionTopics(db, {
        relationTable: 'choice_king_question_topics',
        questionId: stored.id,
        topicKeys,
        primaryTopicKey: primaryTopic,
      });
      eligibleChoiceCodes.add(stableCode);
      seededChoices += 1;
    }

    for (const item of terminalRows) {
      const topicKeys = mappedTopics(item);
      if (!topicKeys.length) continue;
      const sourceKey = String(item.source_key || '').trim();
      if (!MANAGED_TERMINAL_CODE.test(sourceKey)
        || !['fill', 'subjective'].includes(item.question_type)) {
        throw new Error(`压轴题数据无效：${sourceKey || 'missing-code'}`);
      }
      const primaryTopic = SOURCE_SCOPE_TO_TOPIC[item.primary_topic_key] || topicKeys[0];
      const questionAssetId = storeImage(
        db, path.join(packRoot, 'terminal'), item.question_image, 'question',
      );
      const answerAssetId = storeImage(
        db, path.join(packRoot, 'terminal'), item.answer_image, 'answer_image',
      );
      const examId = db.get('SELECT id FROM exam_papers WHERE stable_code=?', [item.exam_stable_code])?.id || null;
      db.run(`INSERT INTO weekly_challenge_questions
        (source_key,exam_id,question_type,title,question_asset_id,answer_asset_id,
          answer_text,source_label,grade_code,subject_code,topic_key,difficulty,is_active)
        VALUES(?,?,?,?,?,?,?,?,'g8','math',?,?,1)
        ON CONFLICT(source_key) DO UPDATE SET
          exam_id=COALESCE(excluded.exam_id,weekly_challenge_questions.exam_id),
          question_type=excluded.question_type,title=excluded.title,
          question_asset_id=excluded.question_asset_id,answer_asset_id=excluded.answer_asset_id,
          answer_text=excluded.answer_text,source_label=excluded.source_label,
          grade_code='g8',subject_code='math',topic_key=excluded.topic_key,
          difficulty=excluded.difficulty,is_active=1`, [
        sourceKey, examId, item.question_type, item.title,
        questionAssetId, answerAssetId, item.answer_text || '', sourceLabel(item),
        primaryTopic, Math.max(1, Math.min(5, Number(item.difficulty) || 3)),
      ]);
      const stored = db.get('SELECT id FROM weekly_challenge_questions WHERE source_key=?', [sourceKey]);
      replaceQuestionTopics(db, {
        relationTable: 'weekly_challenge_question_topics',
        questionId: stored.id,
        topicKeys,
        primaryTopicKey: primaryTopic,
      });
      eligibleTerminalCodes.add(sourceKey);
      seededTerminals += 1;
    }

    for (const row of db.all(`SELECT stable_code,is_active FROM choice_king_questions
      WHERE grade_code='g8'`)) {
      if (!MANAGED_CHOICE_CODE.test(row.stable_code)
        || eligibleChoiceCodes.has(row.stable_code)
        || Number(row.is_active) === 0) continue;
      deactivated += Number(db.run(`UPDATE choice_king_questions
        SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE stable_code=?`, [row.stable_code]).changes || 0);
    }
    for (const row of db.all(`SELECT source_key,is_active FROM weekly_challenge_questions
      WHERE grade_code='g8'`)) {
      if (!MANAGED_TERMINAL_CODE.test(row.source_key)
        || eligibleTerminalCodes.has(row.source_key)
        || Number(row.is_active) === 0) continue;
      deactivated += Number(db.run('UPDATE weekly_challenge_questions SET is_active=0 WHERE source_key=?', [
        row.source_key,
      ]).changes || 0);
    }
  });

  return {
    missing: false,
    choice: seededChoices,
    terminal: seededTerminals,
    total: seededChoices + seededTerminals,
    quarantined_choice: quarantinedChoices,
    deactivated,
    audit,
  };
}

module.exports = {
  PACK_ROOT,
  CHOICE_MANIFEST,
  TERMINAL_MANIFEST,
  EXAM_MANIFEST,
  SOURCE_SCOPE_TO_TOPIC,
  mappedTopics,
  sourceLabel,
  normalizePdfMathText,
  hasUnsupportedPdfGlyph,
  packAudit,
  seedG8SourcePack,
};
