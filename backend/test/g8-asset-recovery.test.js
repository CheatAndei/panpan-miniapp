const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rubbish = path.resolve(__dirname, '..', '..', '..', 'z-rubbish');
const suffix = `${process.pid}-${Date.now()}`;
const root = path.join(rubbish, `g8-asset-recovery-${suffix}`);
const packRoot = path.join(root, 'pack');
process.env.NODE_ENV = 'test';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.JWT_SECRET = 'g8-asset-recovery-test-secret-that-is-long-enough';
process.env.DATABASE_PATH = path.join(root, 'teach.db');
process.env.UPLOAD_DIR = path.join(root, 'uploads');
process.env.PRIVATE_UPLOAD_DIR = path.join(root, 'private');
process.env.EXAM_LIBRARY_DIR = path.join(root, 'exams');

const { initDB, getDB } = require('../db/init');
const { seedG8SourcePack } = require('../services/g8-source-pack-seed');
const { resolveExamPath } = require('../utils/exam-files');

test.before(async () => {
  const terminalRoot = path.join(packRoot, 'terminal');
  fs.mkdirSync(path.join(packRoot, 'choice'), { recursive: true });
  fs.mkdirSync(path.join(terminalRoot, 'questions'), { recursive: true });
  fs.mkdirSync(path.join(terminalRoot, 'answers'), { recursive: true });
  fs.writeFileSync(path.join(packRoot, 'choice', 'manifest.json'), '{"questions":[]}\n');
  fs.writeFileSync(path.join(terminalRoot, 'questions', 'sample.webp'), 'question-image');
  fs.writeFileSync(path.join(terminalRoot, 'answers', 'sample.webp'), 'answer-image');
  fs.writeFileSync(path.join(terminalRoot, 'manifest.json'), `${JSON.stringify({
    questions: [{
      source_key: 'gz8-terminal-GZ8-MID-RECOVERY-Q16',
      exam_stable_code: 'GZ8-MID-RECOVERY',
      question_type: 'fill',
      title: '资源恢复测试题',
      question_image: 'questions/sample.webp',
      answer_image: 'answers/sample.webp',
      source_label: '资源恢复测试',
      source_question_no: '16',
      source_kind: 'guangzhou_exam',
      source_year: 2025,
      primary_topic_key: 'g8-05-axis-symmetry',
      topic_keys: ['g8-05-axis-symmetry'],
      scope_confidence: 'high',
      difficulty: 3,
    }],
  })}\n`);
  await initDB();
});

test.after(() => {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
});

test('八年级填空和大题题图在资源卷缺文件时由启动同步自动补回', () => {
  const db = getDB();
  const first = seedG8SourcePack(db, { packRoot });
  assert.equal(first.terminal, 1);
  const assets = db.all(`SELECT a.id,a.storage_key FROM exam_assets a
    JOIN weekly_challenge_questions q
      ON q.question_asset_id=a.id OR q.answer_asset_id=a.id
    WHERE q.source_key='gz8-terminal-GZ8-MID-RECOVERY-Q16'
    ORDER BY a.id`);
  assert.equal(assets.length, 2);
  for (const asset of assets) {
    const file = resolveExamPath(asset.storage_key);
    assert.ok(fs.existsSync(file));
    fs.rmSync(file);
    assert.equal(fs.existsSync(file), false);
  }

  const second = seedG8SourcePack(db, { packRoot });
  assert.equal(second.terminal, 1);
  for (const asset of assets) assert.ok(fs.existsSync(resolveExamPath(asset.storage_key)));
});
