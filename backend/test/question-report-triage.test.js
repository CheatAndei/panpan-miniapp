const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const {
  validatePlan,
  applyQuestionReportTriage,
} = require('../scripts/triage-question-reports');

const plan = JSON.parse(fs.readFileSync(path.join(
  __dirname, '..', 'resources', 'operations', 'question-report-triage-20260806.json',
), 'utf8'));

async function fixture() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE classes(id INTEGER PRIMARY KEY,teacher_id INTEGER,deleted_at TEXT);
    CREATE TABLE students(id INTEGER PRIMARY KEY,teacher_id INTEGER,class_id INTEGER,deleted_at TEXT);
    CREATE TABLE choice_king_questions(
      id INTEGER PRIMARY KEY,stable_code TEXT,correct_option TEXT,explanation TEXT,
      is_active INTEGER DEFAULT 1,updated_at TEXT
    );
    CREATE TABLE choice_king_reports(
      id INTEGER PRIMARY KEY,question_id INTEGER,student_id INTEGER,status TEXT DEFAULT 'open',
      teacher_note TEXT,selected_answer TEXT,handled_by INTEGER,handled_at TEXT,updated_at TEXT
    );
    CREATE TABLE calculation_question_reports(
      id INTEGER PRIMARY KEY,student_id INTEGER,status TEXT DEFAULT 'open',teacher_note TEXT,
      source_type TEXT,source_id INTEGER,source_question_id TEXT,snapshot_answer TEXT,
      handled_by INTEGER,handled_at TEXT,updated_at TEXT
    );
    CREATE TABLE feedbacks(id INTEGER PRIMARY KEY);
    CREATE TABLE teacher_alerts(id INTEGER PRIMARY KEY);
    INSERT INTO classes(id,teacher_id) VALUES(5,11);
    INSERT INTO students(id,teacher_id,class_id) VALUES(7,11,5);
    INSERT INTO feedbacks(id) VALUES(1);
    INSERT INTO teacher_alerts(id) VALUES(1);
  `);
  const ad = '小初高期中末 中考高考真题 加微咨询 天猫：hece.tmall.com';
  const watermark = '1 原创精品资源学科网独家享有版权，侵权必究！ {#{QQABAQqUogCgAgBA=}#}';
  const choiceRows = [
    [23773, 'GZ8-MID-5EC93498FF-Q02', 'B', `10<x<50 ${ad} 故选 B。`],
    [23785, 'GZ8-MID-AD10E1190F-Q03', 'C', '3<x<7，故选 C。'],
    [23805, 'GZ8-FIN-2EC43E8188-Q02', 'C', `点 M 的对称点是 (1,-2)。${watermark}`],
    [24075, 'GZ8-MON-DC5914062F-Q03', 'A', '角平分线性质，故选 A。'],
  ];
  for (const row of choiceRows) {
    db.run(`INSERT INTO choice_king_questions(id,stable_code,correct_option,explanation,is_active)
      VALUES(?,?,?,?,1)`, row);
  }
  const selected = [null, 'D', 'B', null];
  for (let index = 0; index < choiceRows.length; index += 1) {
    db.run(`INSERT INTO choice_king_reports(id,question_id,student_id,status,selected_answer)
      VALUES(?,?,7,'open',?)`, [index + 1, choiceRows[index][0], selected[index]]);
  }
  db.run(`INSERT INTO calculation_question_reports
    (id,student_id,status,source_type,source_id,source_question_id,snapshot_answer)
    VALUES(1,7,'open','learning_attempt',123,'retry:13613:junior-056-a4f51068','-0.2')`);
  db.run(`INSERT INTO calculation_question_reports
    (id,student_id,status,source_type,source_id,source_question_id,snapshot_answer)
    VALUES(2,7,'open','learning_attempt',229,'mental:junior-047-9f8583da','8')`);
  return db;
}

function count(db, sql) {
  return Number(db.exec(sql)[0]?.values?.[0]?.[0] || 0);
}

test('六条误报只在教师端归档，题目、答案和反馈表不变', async () => {
  const db = await fixture();
  const dryRun = applyQuestionReportTriage(db, plan);
  assert.deepEqual({
    applied: dryRun.applied,
    reports: dryRun.reports_to_dismiss,
    explanations: dryRun.explanations_to_clean,
  }, { applied: false, reports: 6, explanations: 2 });
  assert.equal(count(db, "SELECT COUNT(*) FROM choice_king_reports WHERE status='open'"), 4);

  const result = applyQuestionReportTriage(db, plan, {
    apply: true,
    now: new Date('2026-08-06T06:30:00.000Z'),
  });
  assert.equal(result.reports_dismissed, 6);
  assert.equal(result.explanations_cleaned, 2);
  assert.equal(result.student_feedback_sent, 0);
  assert.equal(result.questions_stopped, 0);
  assert.equal(result.answers_changed, 0);
  assert.equal(count(db, "SELECT COUNT(*) FROM choice_king_reports WHERE status='dismissed'"), 4);
  assert.equal(count(db, "SELECT COUNT(*) FROM calculation_question_reports WHERE status='dismissed'"), 2);
  assert.equal(count(db, 'SELECT COUNT(*) FROM choice_king_questions WHERE is_active=1'), 4);
  assert.equal(count(db, "SELECT COUNT(*) FROM choice_king_questions WHERE correct_option IN ('A','B','C')"), 4);
  assert.equal(count(db, 'SELECT COUNT(*) FROM feedbacks'), 1);
  assert.equal(count(db, 'SELECT COUNT(*) FROM teacher_alerts'), 1);
  const explanations = db.exec('SELECT explanation FROM choice_king_questions')[0].values.flat().join('\n');
  assert.doesNotMatch(explanations, /hece\.tmall\.com|学科网|侵权必究|\{#\{/u);

  const repeated = applyQuestionReportTriage(db, plan, { apply: true });
  assert.equal(repeated.reports_dismissed, 0);
  assert.equal(repeated.explanations_cleaned, 0);
  db.close();
});

test('归档计划拒绝学生反馈、停题或改答案开关', () => {
  for (const field of ['student_feedback', 'stop_questions', 'change_answers']) {
    assert.throws(() => validatePlan({ ...plan, [field]: true }), /must prohibit/u);
  }
});
