const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const rubbish = path.resolve(__dirname, '..', '..', '..', 'z-rubbish');
const suffix = `${process.pid}-${Date.now()}`;
process.env.NODE_ENV = 'test';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.JWT_SECRET = 'g8-source-pack-test-secret-that-is-long-enough';
process.env.DATABASE_PATH = path.join(rubbish, `g8-source-pack-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `g8-source-pack-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `g8-source-pack-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `g8-source-pack-exams-${suffix}`);

const { initDB, getDB } = require('../db/init');
const {
  packAudit,
  seedG8SourcePack,
} = require('../services/g8-source-pack-seed');
const { syncG8ExamPapers } = require('../services/g8-exam-sync');
const { buildG8ExamBundle } = require('../scripts/build-g8-exam-bundle');

test.before(async () => {
  fs.mkdirSync(rubbish, { recursive: true });
  await initDB();
});

test.after(() => {
  for (const target of [
    process.env.DATABASE_PATH,
    process.env.UPLOAD_DIR,
    process.env.PRIVATE_UPLOAD_DIR,
    process.env.EXAM_LIBRARY_DIR,
    path.join(rubbish, `g8-exam-sync-${suffix}`),
    path.join(rubbish, `g8-exam-bundle-${suffix}`),
  ]) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
  }
});

test('八上整卷部署包校验 206 卷并保留学校、来源和扩展名', () => {
  const root = path.join(rubbish, `g8-exam-bundle-${suffix}`);
  const sourceRoot = path.join(root, 'source');
  const outputRoot = path.join(root, 'output');
  const paperDir = path.join(sourceRoot, '资料');
  fs.mkdirSync(paperDir, { recursive: true });
  const files = Array.from({ length: 206 }, (_, index) => {
    const extension = index === 0 ? '.pdf' : '.docx';
    const paperFile = path.join(paperDir, `原卷-${index}${extension}`);
    fs.writeFileSync(paperFile, Buffer.from(`paper-${index}`));
    const answerFile = index < 202 ? path.join(paperDir, `解析-${index}${extension}`) : null;
    if (answerFile) fs.writeFileSync(answerFile, Buffer.from(`answer-${index}`));
    return { paperFile, answerFile };
  });
  const item = (file) => ({
    name: path.basename(file),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    byte_size: fs.statSync(file).size,
  });
  const papers = files.map(({ paperFile, answerFile }, index) => ({
    stable_code: `GZ8-TEST-${String(index).padStart(3, '0')}`,
    display_title: `八上试卷 ${index}`,
    school_name: `学校 ${index}`,
    district: '广州',
    school_year: '2025-2026',
    exam_year: 2025,
    exam_type: 'final',
    source_kind: index < 14 ? 'mock_or_review' : 'guangzhou_exam',
    source_relative_path: path.join('资料', path.basename(paperFile)),
    paper: item(paperFile),
    answer: answerFile ? item(answerFile) : null,
  }));
  const manifestPath = path.join(root, 'exam-manifest.json');
  const auditPath = path.join(root, 'audit-report.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    summary: { paired_papers: 202 },
    papers,
  })}\n`);
  fs.writeFileSync(auditPath, '{"ok":true}\n');

  const result = buildG8ExamBundle({
    manifestPath,
    auditPath,
    sourceRoot,
    outputRoot,
  });
  assert.deepEqual(result.expected, {
    papers: 206,
    answers: 202,
    guangzhou_exam: 192,
    mock_or_review: 14,
    question_links: 0,
    grade_code: 'g8',
    subject_code: 'math',
  });
  assert.equal(result.papers[0].school_name, '学校 0');
  assert.equal(result.papers[0].exam_type, 'mock');
  assert.match(result.papers[0].display_title, /^模拟\/复习 · /);
  assert.ok(fs.existsSync(path.join(
    outputRoot,
    'paper',
    result.papers[0].paper.sha256.slice(0, 2),
    `${result.papers[0].paper.sha256}.pdf`,
  )));
});

test('八上真题包保守隔离低置信度与固定 12 讲以外内容', () => {
  const audit = packAudit();
  assert.deepEqual(audit.choice, {
    total: 1000,
    eligible: 554,
    low_confidence: 257,
    unmapped_non_low: 189,
  });
  assert.deepEqual(audit.terminal, {
    total: 552,
    eligible: 435,
    low_confidence: 11,
    unmapped_non_low: 106,
  });
  assert.equal(audit.eligible_fill, 149);
  assert.equal(audit.eligible_subjective, 286);
  assert.equal(audit.eligible_multi_topic, 592);
  assert.equal(audit.eligible_guangzhou_exam, 932);
  assert.equal(audit.eligible_mock_or_review, 57);
});

test('八上真题包写入 989 道可用题并保留多标签和来源真实性', () => {
  const db = getDB();
  const first = seedG8SourcePack(db);
  assert.equal(first.choice, 554);
  assert.equal(first.terminal, 435);
  assert.equal(first.total, 989);

  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions
    WHERE grade_code='g8' AND stable_code LIKE 'GZ8-%' AND stable_code NOT LIKE 'GZ8-ORIGINAL-%'
      AND is_active=1`)?.count || 0), 554);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM weekly_challenge_questions
    WHERE grade_code='g8' AND source_key LIKE 'gz8-terminal-GZ8-%' AND is_active=1`)?.count || 0), 435);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM weekly_challenge_questions
    WHERE grade_code='g8' AND source_key LIKE 'gz8-terminal-GZ8-%'
      AND question_type='fill' AND is_active=1`)?.count || 0), 149);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM weekly_challenge_questions
    WHERE grade_code='g8' AND source_key LIKE 'gz8-terminal-GZ8-%'
      AND question_type='subjective' AND is_active=1`)?.count || 0), 286);

  const mock = db.get(`SELECT source_label FROM choice_king_questions
    WHERE stable_code LIKE 'GZ8-%' AND source_label LIKE '模拟/复习 · %' LIMIT 1`);
  assert.ok(mock);
  const sample = db.get(`SELECT id,question_image_url,options_json FROM choice_king_questions
    WHERE stable_code LIKE 'GZ8-%' AND stable_code NOT LIKE 'GZ8-ORIGINAL-%' ORDER BY id LIMIT 1`);
  assert.match(sample.question_image_url, /^\/api\/choice-king\/assets\/g8-source-pack\/choice\/questions\//);
  assert.deepEqual(Object.keys(JSON.parse(sample.options_json)), ['A', 'B', 'C', 'D']);
  const multi = db.get(`SELECT question_id,COUNT(*) count FROM choice_king_question_topics
    GROUP BY question_id HAVING COUNT(*)>1 LIMIT 1`);
  assert.ok(Number(multi.count) > 1);

  const again = seedG8SourcePack(db);
  assert.equal(again.total, 989);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions
    WHERE grade_code='g8' AND stable_code LIKE 'GZ8-%' AND stable_code NOT LIKE 'GZ8-ORIGINAL-%'`)?.count || 0), 554);
});

test('八上试卷同步按来源类型发布，模拟/复习不会标成广州真题', () => {
  const root = path.join(rubbish, `g8-exam-sync-${suffix}`);
  const sourceRoot = path.join(root, 'source');
  const packRoot = path.join(root, 'pack');
  fs.mkdirSync(path.join(sourceRoot, '模拟卷'), { recursive: true });
  fs.mkdirSync(path.join(packRoot, 'choice'), { recursive: true });
  fs.mkdirSync(path.join(packRoot, 'terminal'), { recursive: true });
  const paper = path.join(sourceRoot, '模拟卷', '原卷.docx');
  const answer = path.join(sourceRoot, '模拟卷', '解析版.docx');
  fs.writeFileSync(paper, Buffer.from('g8-paper-fixture'));
  fs.writeFileSync(answer, Buffer.from('g8-answer-fixture'));
  const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(path.join(packRoot, 'choice', 'manifest.json'), '{"questions":[]}\n');
  fs.writeFileSync(path.join(packRoot, 'terminal', 'manifest.json'), '{"questions":[]}\n');
  const examManifest = {
    papers: [{
      stable_code: 'GZ8-MOCK-UNIT0001',
      display_title: '八上综合复习卷',
      school_name: '广州题源',
      district: '广州',
      school_year: '2025-2026',
      exam_year: 2025,
      exam_type: 'final',
      source_kind: 'mock_or_review',
      source_relative_path: path.join('模拟卷', '原卷.docx'),
      paper: { name: '原卷.docx', sha256: digest(paper) },
      answer: { name: '解析版.docx', sha256: digest(answer) },
    }],
  };
  const manifestPath = path.join(packRoot, 'exam-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(examManifest)}\n`);

  const result = syncG8ExamPapers(getDB(), {
    sourceRoot,
    packRoot,
    manifestPath,
    publish: true,
  });
  assert.equal(result.imported, 1);
  assert.equal(result.mock_or_review, 1);
  const stored = getDB().get(`SELECT display_title,exam_type,status,grade_code
    FROM exam_papers WHERE stable_code='GZ8-MOCK-UNIT0001'`);
  assert.equal(stored.exam_type, 'mock');
  assert.equal(stored.status, 'published');
  assert.equal(stored.grade_code, 'g8');
  assert.match(stored.display_title, /^模拟\/复习 · /);
});
