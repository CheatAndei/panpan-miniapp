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

test('八上整卷部署包复用七年级流程，只发布质检后的 PDF', () => {
  const root = path.join(rubbish, `g8-exam-bundle-${suffix}`);
  const pdfRoot = path.join(root, 'pdfs');
  const outputRoot = path.join(root, 'output');
  fs.mkdirSync(path.join(pdfRoot, 'original'), { recursive: true });
  fs.mkdirSync(path.join(pdfRoot, 'answer'), { recursive: true });
  const files = Array.from({ length: 206 }, (_, index) => {
    const stableCode = `GZ8-TEST-${String(index).padStart(3, '0')}`;
    const paperFile = path.join(pdfRoot, 'original', `${stableCode}.pdf`);
    fs.writeFileSync(paperFile, Buffer.from(`%PDF-1.4\npaper-${index}`));
    const answerFile = index < 202 ? path.join(pdfRoot, 'answer', `${stableCode}.pdf`) : null;
    if (answerFile) fs.writeFileSync(answerFile, Buffer.from(`%PDF-1.4\nanswer-${index}`));
    return { stableCode, paperFile, answerFile };
  });
  const item = (file) => ({
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    bytes: fs.statSync(file).size,
    errors: [],
  });
  const papers = files.map(({ stableCode, answerFile }, index) => ({
    stable_code: stableCode,
    display_title: `八上试卷 ${index}`,
    school_name: `学校 ${index}`,
    district: '广州',
    school_year: '2025-2026',
    exam_year: 2025,
    exam_type: 'final',
    source_kind: index < 14 ? 'mock_or_review' : 'guangzhou_exam',
    source_relative_path: path.join('资料', `原卷-${index}.docx`),
    paper: { name: `原卷-${index}.docx` },
    answer: answerFile ? { name: `解析-${index}.docx` } : null,
  }));
  const manifestPath = path.join(root, 'exam-manifest.json');
  const auditPath = path.join(root, 'audit-report.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    summary: { paired_papers: 202 },
    papers,
  })}\n`);
  fs.writeFileSync(auditPath, `${JSON.stringify({
    summary: { failed: 0 },
    files: files.flatMap(({ stableCode, paperFile, answerFile }) => [
      { stable_code: stableCode, role: 'original', ...item(paperFile) },
      ...(answerFile ? [{ stable_code: stableCode, role: 'answer', ...item(answerFile) }] : []),
    ]),
  })}\n`);

  const result = buildG8ExamBundle({
    manifestPath,
    auditPath,
    pdfRoot,
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
  assert.ok(result.papers.every((paper) => paper.paper.name.endsWith('.pdf')));
  assert.ok(result.papers.filter((paper) => paper.answer).every((paper) => paper.answer.name.endsWith('.pdf')));
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

test('八上真题包写入 987 道可用题并清洗 PDF 私有数学字符', () => {
  const db = getDB();
  const first = seedG8SourcePack(db);
  assert.equal(first.choice, 552);
  assert.equal(first.terminal, 435);
  assert.equal(first.total, 987);
  assert.equal(first.quarantined_choice, 2);

  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions
    WHERE grade_code='g8' AND stable_code LIKE 'GZ8-%' AND stable_code NOT LIKE 'GZ8-ORIGINAL-%'
      AND is_active=1`)?.count || 0), 552);
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
  const screenshotQuestion = db.get(`SELECT options_json FROM choice_king_questions
    WHERE stable_code='GZ8-MID-649BDC7D83-Q03'`);
  assert.deepEqual(JSON.parse(screenshotQuestion.options_json), {
    A: 'AB = CD',
    B: 'AC = BD',
    C: '∠ A = ∠ D',
    D: '∠ ABC = ∠ DCB',
  });
  for (const row of db.all(`SELECT options_json,explanation FROM choice_king_questions
    WHERE grade_code='g8' AND stable_code LIKE 'GZ8-%' AND is_active=1`)) {
    assert.doesNotMatch(`${row.options_json}\n${row.explanation || ''}`, /[\uE000-\uF8FF\uFFFD]/u);
  }
  const multi = db.get(`SELECT question_id,COUNT(*) count FROM choice_king_question_topics
    GROUP BY question_id HAVING COUNT(*)>1 LIMIT 1`);
  assert.ok(Number(multi.count) > 1);

  const again = seedG8SourcePack(db);
  assert.equal(again.total, 987);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions
    WHERE grade_code='g8' AND stable_code LIKE 'GZ8-%' AND stable_code NOT LIKE 'GZ8-ORIGINAL-%'`)?.count || 0), 552);
});

test('八上试卷同步按来源类型发布，模拟/复习不会标成广州真题', () => {
  const root = path.join(rubbish, `g8-exam-sync-${suffix}`);
  const pdfRoot = path.join(root, 'pdfs');
  const packRoot = path.join(root, 'pack');
  fs.mkdirSync(path.join(pdfRoot, 'original'), { recursive: true });
  fs.mkdirSync(path.join(pdfRoot, 'answer'), { recursive: true });
  fs.mkdirSync(path.join(packRoot, 'choice'), { recursive: true });
  fs.mkdirSync(path.join(packRoot, 'terminal'), { recursive: true });
  const stableCode = 'GZ8-MOCK-UNIT0001';
  const paper = path.join(pdfRoot, 'original', `${stableCode}.pdf`);
  const answer = path.join(pdfRoot, 'answer', `${stableCode}.pdf`);
  fs.writeFileSync(paper, Buffer.from('%PDF-1.4\ng8-paper-fixture'));
  fs.writeFileSync(answer, Buffer.from('%PDF-1.4\ng8-answer-fixture'));
  const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(path.join(packRoot, 'choice', 'manifest.json'), '{"questions":[]}\n');
  fs.writeFileSync(path.join(packRoot, 'terminal', 'manifest.json'), '{"questions":[]}\n');
  const examManifest = {
    papers: [{
      stable_code: stableCode,
      display_title: '八上综合复习卷',
      school_name: '广州题源',
      district: '广州',
      school_year: '2025-2026',
      exam_year: 2025,
      exam_type: 'final',
      source_kind: 'mock_or_review',
      source_relative_path: path.join('模拟卷', '原卷.docx'),
      paper: { name: '原卷.docx' },
      answer: { name: '解析版.docx' },
    }],
  };
  const manifestPath = path.join(packRoot, 'exam-manifest.json');
  const auditPath = path.join(root, 'pdf-quality-report.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(examManifest)}\n`);
  fs.writeFileSync(auditPath, `${JSON.stringify({
    summary: { failed: 0 },
    files: [
      { stable_code: stableCode, role: 'original', sha256: digest(paper), bytes: fs.statSync(paper).size, errors: [] },
      { stable_code: stableCode, role: 'answer', sha256: digest(answer), bytes: fs.statSync(answer).size, errors: [] },
    ],
  })}\n`);

  const result = syncG8ExamPapers(getDB(), {
    pdfRoot,
    auditPath,
    packRoot,
    manifestPath,
    publish: true,
  });
  assert.equal(result.imported, 1);
  assert.equal(result.mock_or_review, 1);
  const stored = getDB().get(`SELECT p.display_title,p.exam_type,p.status,p.grade_code,a.mime_type,a.original_name
    FROM exam_papers p JOIN exam_assets a ON a.id=p.paper_asset_id
    WHERE p.stable_code='GZ8-MOCK-UNIT0001'`);
  assert.equal(stored.exam_type, 'mock');
  assert.equal(stored.status, 'published');
  assert.equal(stored.grade_code, 'g8');
  assert.equal(stored.mime_type, 'application/pdf');
  assert.equal(stored.original_name, '原卷.pdf');
  assert.match(stored.display_title, /^模拟\/复习 · /);
});
