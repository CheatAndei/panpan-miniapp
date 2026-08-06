'use strict';

const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const { sanitizeChoiceExplanation } = require('../utils/choice-explanation');

function rows(db, sql, params = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const result = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally {
    statement.free();
  }
}

function one(db, sql, params = []) {
  return rows(db, sql, params)[0] || null;
}

function scalar(db, sql, params = []) {
  const row = one(db, sql, params);
  return row ? Object.values(row)[0] : null;
}

function tableExists(db, table) {
  return Number(scalar(db, "SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name=?", [table]) || 0) > 0;
}

function validatePlan(plan) {
  if (Number(plan?.schema_version) !== 1) throw new Error('Unsupported triage plan schema');
  if (!/^[a-z0-9-]+$/u.test(String(plan?.operation_id || ''))) throw new Error('Invalid operation_id');
  if (plan.student_feedback !== false || plan.stop_questions !== false || plan.change_answers !== false) {
    throw new Error('Triage plan must prohibit student feedback, stopping questions, and answer changes');
  }
  if (!Array.isArray(plan.reports) || plan.reports.length < 1) throw new Error('Triage plan has no reports');
  const keys = new Set();
  for (const item of plan.reports) {
    if (!['choice', 'calculation'].includes(item?.kind)) throw new Error('Invalid report kind');
    if (!Number.isInteger(Number(item?.report_id)) || Number(item.report_id) < 1) throw new Error('Invalid report id');
    const key = `${item.kind}:${Number(item.report_id)}`;
    if (keys.has(key)) throw new Error(`Duplicate report target: ${key}`);
    keys.add(key);
    if (!item.expected || typeof item.expected !== 'object') throw new Error(`Missing fingerprint: ${key}`);
    const note = String(item.teacher_note || '').trim();
    if (!note || note.length > 500) throw new Error(`Invalid teacher note: ${key}`);
  }
  return plan;
}

function reportRow(db, item) {
  if (item.kind === 'choice') {
    return one(db, `SELECT r.id,r.status,r.teacher_note,r.selected_answer,
        q.stable_code,q.correct_option,q.is_active,
        COALESCE(c.teacher_id,s.teacher_id) teacher_id
      FROM choice_king_reports r
      JOIN choice_king_questions q ON q.id=r.question_id
      JOIN students s ON s.id=r.student_id
      LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
      WHERE r.id=? AND s.deleted_at IS NULL`, [Number(item.report_id)]);
  }
  return one(db, `SELECT r.id,r.status,r.teacher_note,r.source_type,r.source_id,
      r.source_question_id,r.snapshot_answer,
      COALESCE(c.teacher_id,s.teacher_id) teacher_id
    FROM calculation_question_reports r
    JOIN students s ON s.id=r.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE r.id=? AND s.deleted_at IS NULL`, [Number(item.report_id)]);
}

function assertReportFingerprint(row, item) {
  const key = `${item.kind}:${Number(item.report_id)}`;
  if (!row) throw new Error(`Report not found: ${key}`);
  if (!['open', 'dismissed'].includes(String(row.status))) throw new Error(`Unexpected report status: ${key}:${row.status}`);
  if (!Number.isInteger(Number(row.teacher_id)) || Number(row.teacher_id) < 1) throw new Error(`Missing responsible teacher: ${key}`);
  for (const [field, expected] of Object.entries(item.expected)) {
    const actual = row[field];
    if (actual === expected) continue;
    if (expected !== null && String(actual) === String(expected)) continue;
    throw new Error(`Report fingerprint mismatch: ${key}:${field}`);
  }
  if (row.status === 'dismissed' && String(row.teacher_note || '') !== String(item.teacher_note).trim()) {
    throw new Error(`Dismissed report note mismatch: ${key}`);
  }
}

function monitoredCounts(db) {
  const result = {};
  for (const table of ['feedbacks', 'teacher_alerts']) {
    if (tableExists(db, table)) result[table] = Number(scalar(db, `SELECT COUNT(*) count FROM ${table}`) || 0);
  }
  return result;
}

function assertMonitoredCounts(db, before) {
  for (const [table, count] of Object.entries(before)) {
    const after = Number(scalar(db, `SELECT COUNT(*) count FROM ${table}`) || 0);
    if (after !== count) throw new Error(`Unexpected side effect in ${table}`);
  }
}

function applyQuestionReportTriage(db, rawPlan, { apply = false, now = new Date() } = {}) {
  const plan = validatePlan(rawPlan);
  const matched = plan.reports.map((item) => {
    const row = reportRow(db, item);
    assertReportFingerprint(row, item);
    return { item, row };
  });
  const explanationChanges = plan.clean_choice_explanations === true
    ? rows(db, `SELECT id,explanation FROM choice_king_questions
        WHERE explanation IS NOT NULL AND explanation<>''`)
      .map((row) => ({ ...row, sanitized: sanitizeChoiceExplanation(row.explanation) }))
      .filter((row) => row.sanitized !== row.explanation)
    : [];
  const pending = matched.filter(({ row }) => row.status === 'open');
  const summary = {
    operation_id: plan.operation_id,
    applied: Boolean(apply),
    matched_reports: matched.length,
    reports_to_dismiss: pending.length,
    explanations_to_clean: explanationChanges.length,
    reports_dismissed: 0,
    explanations_cleaned: 0,
    student_feedback_sent: 0,
    questions_stopped: 0,
    answers_changed: 0,
  };
  if (!apply) return summary;

  const before = monitoredCounts(db);
  const timestamp = now.toISOString();
  db.run('BEGIN IMMEDIATE');
  try {
    for (const { item, row } of pending) {
      const table = item.kind === 'choice' ? 'choice_king_reports' : 'calculation_question_reports';
      db.run(`UPDATE ${table}
        SET status='dismissed',teacher_note=?,handled_by=?,handled_at=?,updated_at=?
        WHERE id=? AND status='open'`, [
        String(item.teacher_note).trim(), Number(row.teacher_id), timestamp, timestamp, Number(item.report_id),
      ]);
      summary.reports_dismissed += db.getRowsModified();
    }
    for (const row of explanationChanges) {
      db.run(`UPDATE choice_king_questions SET explanation=?,updated_at=?
        WHERE id=? AND explanation=?`, [row.sanitized, timestamp, Number(row.id), row.explanation]);
      summary.explanations_cleaned += db.getRowsModified();
    }
    for (const item of plan.reports) {
      const current = reportRow(db, item);
      assertReportFingerprint(current, item);
      if (current.status !== 'dismissed' || String(current.teacher_note || '') !== String(item.teacher_note).trim()) {
        throw new Error(`Report was not dismissed: ${item.kind}:${item.report_id}`);
      }
    }
    if (plan.clean_choice_explanations === true) {
      const remaining = rows(db, `SELECT explanation FROM choice_king_questions
        WHERE explanation IS NOT NULL AND explanation<>''`)
        .filter((row) => sanitizeChoiceExplanation(row.explanation) !== row.explanation).length;
      if (remaining !== 0) throw new Error(`Explanation cleanup incomplete: ${remaining}`);
    }
    assertMonitoredCounts(db, before);
    db.run('COMMIT');
  } catch (error) {
    try { db.run('ROLLBACK'); } catch {}
    throw error;
  }
  return summary;
}

function parseArgs(argv) {
  const result = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') result.apply = true;
    else if (arg === '--plan') result.plan = argv[++index];
    else if (arg === '--database') result.database = argv[++index];
    else if (arg === '--confirm') result.confirm = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function writeDatabaseAtomically(SQL, db, databasePath) {
  const exported = db.export();
  const verification = new SQL.Database(exported);
  const integrity = rows(verification, 'PRAGMA integrity_check').map((row) => String(Object.values(row)[0]));
  verification.close();
  if (integrity.length !== 1 || integrity[0] !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity.join(',')}`);
  const stat = fs.statSync(databasePath);
  const temporary = `${databasePath}.${process.pid}.triage.tmp`;
  try {
    fs.writeFileSync(temporary, Buffer.from(exported), { mode: stat.mode });
    fs.renameSync(temporary, databasePath);
  } finally {
    try { fs.unlinkSync(temporary); } catch {}
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const planPath = path.resolve(args.plan || '');
  const databasePath = path.resolve(args.database || process.env.DATABASE_PATH || '');
  if (!args.plan || !fs.existsSync(planPath)) throw new Error('Triage plan not found');
  if (!databasePath || !fs.existsSync(databasePath)) throw new Error('Database not found');
  const plan = validatePlan(JSON.parse(fs.readFileSync(planPath, 'utf8')));
  if (args.apply && args.confirm !== plan.operation_id) throw new Error('Apply confirmation does not match operation_id');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(databasePath));
  try {
    db.run('PRAGMA foreign_keys=ON');
    const summary = applyQuestionReportTriage(db, plan, { apply: args.apply });
    if (args.apply) writeDatabaseAtomically(SQL, db, databasePath);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return summary;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  validatePlan,
  applyQuestionReportTriage,
  parseArgs,
  main,
};
