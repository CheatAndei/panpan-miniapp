const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const suffix = process.pid;
process.env.NODE_ENV = 'test';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.DATABASE_PATH = path.join(rubbish, `g8-content-bank-${suffix}.db`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `g8-content-exams-${suffix}`);
fs.mkdirSync(rubbish, { recursive: true });

const { topics } = require('../resources/g8-content/topics');
const { choices, fills, subjectives, sample } = require('../resources/g8-content/bank');
const { EXPECTED, auditG8ContentBank } = require('../services/g8-content-audit');
const { initDB, getDB } = require('../db/init');
const { seedG8Content } = require('../services/g8-content-seed');

test.before(async () => {
  await initDB();
});

test.after(() => {
  for (const target of [process.env.DATABASE_PATH, process.env.EXAM_LIBRARY_DIR]) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
  }
});

test('48 道样板与 1008 道正式题通过结构、范围、来源、重复和符号审计', () => {
  const report = auditG8ContentBank();
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.deepEqual(report.counts, {
    choice: 720,
    fill: 144,
    subjective: 144,
    total: 1008,
    sample: 48,
    multi_tagged: 336,
  });
  assert.match(report.content_sha256, /^[a-f0-9]{64}$/);
  assert.match(report.sample_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(EXPECTED, {
    topics: 12,
    choice_per_topic: 60,
    fill_per_topic: 12,
    subjective_per_topic: 12,
    choice_total: 720,
    fill_total: 144,
    subjective_total: 144,
    total: 1008,
    sample_total: 48,
  });
});

test('每个固定范围均有 60 客观、12 填空、12 解答及 4 道样板', () => {
  for (const topic of topics) {
    assert.equal(choices.filter((item) => item.topic_key === topic.topic_key).length, 60);
    assert.equal(fills.filter((item) => item.topic_key === topic.topic_key).length, 12);
    assert.equal(subjectives.filter((item) => item.topic_key === topic.topic_key).length, 12);
    assert.equal(sample.filter((item) => item.topic_key === topic.topic_key).length, 4);
  }
});

test('1008 道正式题完整入库，288 张题卡可读且重复同步幂等', async () => {
  const db = getDB();
  const first = await seedG8Content(db);
  assert.equal(first.choice, 720);
  assert.equal(first.terminal, 288);
  assert.equal(first.total, 1008);
  assert.equal(first.rendered_assets, 288);
  assert.equal(first.reused_assets, 0);
  assert.equal(first.deactivated, 0);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions
    WHERE stable_code LIKE 'GZ8-ORIGINAL-%' AND is_active=1`).count), 720);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM weekly_challenge_questions
    WHERE source_key LIKE 'g8-original-%' AND is_active=1`).count), 288);

  for (const topic of topics) {
    assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions q
      JOIN choice_king_question_topics qt ON qt.question_id=q.id
      WHERE q.topic_key=? AND qt.topic_key=? AND q.is_active=1`, [topic.topic_key, topic.topic_key]).count), 60);
    assert.equal(Number(db.get(`SELECT COUNT(*) count FROM weekly_challenge_questions q
      JOIN weekly_challenge_question_topics qt ON qt.question_id=q.id
      WHERE q.topic_key=? AND qt.topic_key=? AND q.question_type='fill' AND q.is_active=1`, [
      topic.topic_key, topic.topic_key,
    ]).count), 12);
    assert.equal(Number(db.get(`SELECT COUNT(*) count FROM weekly_challenge_questions q
      JOIN weekly_challenge_question_topics qt ON qt.question_id=q.id
      WHERE q.topic_key=? AND qt.topic_key=? AND q.question_type='subjective' AND q.is_active=1`, [
      topic.topic_key, topic.topic_key,
    ]).count), 12);
  }

  const asset = db.get(`SELECT a.storage_key,a.mime_type,a.byte_size FROM weekly_challenge_questions q
    JOIN exam_assets a ON a.id=q.question_asset_id
    WHERE q.source_key LIKE 'g8-original-%' ORDER BY q.id LIMIT 1`);
  assert.equal(asset.mime_type, 'image/webp');
  assert.ok(Number(asset.byte_size) > 10000);
  const imagePath = path.join(process.env.EXAM_LIBRARY_DIR, asset.storage_key);
  assert.equal(fs.existsSync(imagePath), true);
  const metadata = await sharp(imagePath).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 900);
  assert.equal(metadata.height, 1200);

  const second = await seedG8Content(db);
  assert.equal(second.rendered_assets, 0);
  assert.equal(second.reused_assets, 288);
  assert.equal(second.deactivated, 0);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM exam_assets
    WHERE storage_key LIKE 'weekly/question/g8-original/%'`).count), 288);
});
