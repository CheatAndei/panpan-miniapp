const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const TARGET_IDS = Object.freeze([10, 20, 25, 26, 27, 30, 34]);
const REPAIR_KEY = 'practice-history-round2-default-correct-v1';
const REPAIR_ACTION = 'practice_submission_history_repaired';
const REQUEUE_ACTION = 'practice_submission_requeued';
const APPLY_CONFIRMATION = 'REPAIR_7_PRACTICE_HISTORIES';
const DEFAULT_REPAIR_NOTE = '教师确认订正全对（历史数据修复）';

function parseArgs(argv) {
  const args = { mode: 'inspect' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--database') args.database = argv[++index];
    else if (value === '--mode') args.mode = argv[++index];
    else if (value === '--confirm') args.confirm = argv[++index];
    else if (value === '--backup-sha256') args.backupSha256 = argv[++index];
    else if (value === '--repair-id') args.repairId = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function assertDatabaseFile(databasePath) {
  if (!databasePath || !fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
    throw new Error(`Database file does not exist: ${databasePath || '(missing)'}`);
  }
  if (fs.readFileSync(databasePath).subarray(0, 16).toString('utf8') !== 'SQLite format 3\0') {
    throw new Error('Database header validation failed');
  }
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function databaseHelpers(db) {
  const all = (sql, params = []) => {
    const statement = db.prepare(sql);
    statement.bind(params);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
    return rows;
  };
  const one = (sql, params = []) => all(sql, params)[0] || null;
  return { all, one };
}

function parseDetail(row) {
  try {
    return JSON.parse(row.detail || '{}');
  } catch {
    throw new Error(`Operation log ${row.id} contains invalid JSON`);
  }
}

function loadRecord(db, submissionId) {
  const { all, one } = databaseHelpers(db);
  const submission = one(`SELECT ps.*,a.plan_id,a.student_id,a.practice_date,
      a.status assignment_status,p.teacher_id,st.name student_name
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN students st ON st.id=a.student_id
    WHERE ps.id=?`, [submissionId]);
  if (!submission) throw new Error(`Submission ${submissionId} does not exist`);
  const items = all(`SELECT id,position FROM practice_assignment_items
    WHERE assignment_id=? ORDER BY position,id`, [submission.assignment_id]);
  const rounds = all(`SELECT round_no,status,teacher_note,submitted_at,reviewed_by,reviewed_at
    FROM practice_submission_rounds WHERE submission_id=? ORDER BY round_no`, [submissionId]);
  const roundReviews = all(`SELECT round_no,assignment_item_id,is_correct,teacher_note,reviewed_at
    FROM practice_review_rounds WHERE submission_id=?
    ORDER BY round_no,assignment_item_id`, [submissionId]);
  const latestReviews = all(`SELECT assignment_item_id,is_correct,teacher_note,reviewed_at
    FROM practice_reviews WHERE submission_id=? ORDER BY assignment_item_id`, [submissionId]);
  const logs = all(`SELECT id,actor_id,action,entity_type,entity_id,detail,created_at
    FROM operation_logs
    WHERE entity_type='practice_submission' AND entity_id=?
      AND action IN (?,?)
    ORDER BY id`, [submissionId, REQUEUE_ACTION, REPAIR_ACTION])
    .map((row) => ({ ...row, parsed_detail: parseDetail(row) }));
  return { submission, items, rounds, roundReviews, latestReviews, logs };
}

function sourceSnapshot(record) {
  const sources = record.logs.filter((log) =>
    log.action === REQUEUE_ACTION
    && log.parsed_detail?.before
    && Array.isArray(log.parsed_detail.before.reviews)
    && Array.isArray(log.parsed_detail.before.rounds));
  if (sources.length !== 1) {
    throw new Error(`Submission ${record.submission.id} must have exactly one usable requeue snapshot; got ${sources.length}`);
  }
  const source = sources[0];
  const before = source.parsed_detail.before;
  if (before.status !== 'correction_required'
      || Number(before.current_round) !== 1
      || Number(before.needs_correction) !== 1) {
    throw new Error(`Submission ${record.submission.id} requeue snapshot has an unexpected original state`);
  }
  const itemIds = new Set(record.items.map((item) => Number(item.id)));
  const reviews = before.reviews
    .filter((review) => Number(review.round_no) === 1)
    .map((review) => ({
      round_no: 1,
      assignment_item_id: Number(review.assignment_item_id),
      is_correct: Number(review.is_correct),
      teacher_note: review.teacher_note ?? '',
      reviewed_at: review.reviewed_at,
    }));
  if (reviews.length !== record.items.length
      || new Set(reviews.map((review) => review.assignment_item_id)).size !== reviews.length
      || reviews.some((review) => !itemIds.has(review.assignment_item_id)
        || ![0, 1].includes(review.is_correct)
        || !review.reviewed_at)) {
    throw new Error(`Submission ${record.submission.id} requeue snapshot does not contain one valid round-one review per item`);
  }
  const wrongItemIds = reviews
    .filter((review) => review.is_correct === 0)
    .map((review) => review.assignment_item_id);
  if (!wrongItemIds.length) {
    throw new Error(`Submission ${record.submission.id} requeue snapshot has no original wrong items`);
  }
  const roundOne = before.rounds.find((round) => Number(round.round_no) === 1);
  if (!roundOne || roundOne.status !== 'correction_required') {
    throw new Error(`Submission ${record.submission.id} requeue snapshot has no correction-required round one`);
  }
  return {
    sourceLogId: Number(source.id),
    before,
    reviews,
    roundOne,
    wrongItemIds,
    expectedRevision: Number(before.review_revision || 0) + 2,
  };
}

function repairLog(record) {
  const matches = record.logs.filter((log) =>
    log.action === REPAIR_ACTION && log.parsed_detail?.repair_key === REPAIR_KEY);
  if (matches.length > 1) {
    throw new Error(`Submission ${record.submission.id} has duplicate ${REPAIR_KEY} logs`);
  }
  return matches[0] || null;
}

function assertReady(record, source) {
  const row = record.submission;
  const commonReady = Number(row.current_round) === 1 && Number(row.needs_correction) === 0;
  const submittedReady = row.status === 'submitted'
    && row.assignment_status === 'submitted'
    && Number(row.review_revision) === Number(source.before.review_revision || 0) + 1;
  const reviewedReady = row.status === 'reviewed'
    && row.assignment_status === 'reviewed'
    && Number(row.reviewed_by) === Number(row.teacher_id)
    && Boolean(row.reviewed_at)
    && Boolean(row.completed_at)
    && Number(row.review_revision) === source.expectedRevision;
  if (!commonReady || (!submittedReady && !reviewedReady)) {
    throw new Error(`Submission ${row.id} is not in the exact teacher-confirmed post-requeue state: ${JSON.stringify({
      status: row.status,
      current_round: row.current_round,
      needs_correction: row.needs_correction,
      assignment_status: row.assignment_status,
      review_revision: row.review_revision,
      expected_review_revision: source.expectedRevision,
    })}`);
  }
  if (record.rounds.length !== 1
      || Number(record.rounds[0].round_no) !== 1
      || record.rounds[0].status !== row.status) {
    throw new Error(`Submission ${row.id} has unexpected submission rounds before repair`);
  }
  if (record.roundReviews.length !== record.items.length
      || record.roundReviews.some((review) => Number(review.round_no) !== 1)
      || record.latestReviews.length !== record.items.length) {
    throw new Error(`Submission ${row.id} has an incomplete or unexpected current review set`);
  }
  if (reviewedReady && (
    record.roundReviews.some((review) => Number(review.is_correct) !== 1)
    || record.latestReviews.some((review) => Number(review.is_correct) !== 1)
  )) {
    throw new Error(`Submission ${row.id} is not the exact all-correct teacher confirmation to move into round two`);
  }
  if (submittedReady) {
    const sourceById = new Map(source.reviews.map((review) => [review.assignment_item_id, review.is_correct]));
    if (record.roundReviews.some((review) =>
      Number(review.is_correct) !== sourceById.get(Number(review.assignment_item_id)))) {
      throw new Error(`Submission ${row.id} submitted review rows no longer match the requeue snapshot`);
    }
  }
}

function assertFinal(record, source) {
  const row = record.submission;
  if (row.status !== 'reviewed'
      || Number(row.current_round) !== 2
      || Number(row.needs_correction) !== 0
      || row.assignment_status !== 'reviewed'
      || Number(row.reviewed_by) !== Number(row.teacher_id)
      || !row.reviewed_at
      || !row.completed_at
      || Number(row.review_revision) !== source.expectedRevision) {
    throw new Error(`Submission ${row.id} final state validation failed`);
  }
  const roundOne = record.rounds.find((round) => Number(round.round_no) === 1);
  const roundTwo = record.rounds.find((round) => Number(round.round_no) === 2);
  if (record.rounds.length !== 2
      || roundOne?.status !== 'correction_required'
      || roundTwo?.status !== 'reviewed'
      || Number(roundTwo.reviewed_by) !== Number(row.teacher_id)) {
    throw new Error(`Submission ${row.id} final round validation failed`);
  }
  const expectedRoundOne = new Map(source.reviews.map((review) => [review.assignment_item_id, review]));
  const actualRoundOne = record.roundReviews.filter((review) => Number(review.round_no) === 1);
  const actualRoundTwo = record.roundReviews.filter((review) => Number(review.round_no) === 2);
  if (actualRoundOne.length !== source.reviews.length
      || actualRoundOne.some((review) => {
        const expected = expectedRoundOne.get(Number(review.assignment_item_id));
        return !expected
          || Number(review.is_correct) !== expected.is_correct
          || String(review.teacher_note || '') !== String(expected.teacher_note || '')
          || String(review.reviewed_at || '') !== String(expected.reviewed_at || '');
      })) {
    throw new Error(`Submission ${row.id} round-one review restoration failed`);
  }
  if (actualRoundTwo.length !== source.wrongItemIds.length
      || actualRoundTwo.some((review) =>
        !source.wrongItemIds.includes(Number(review.assignment_item_id))
        || Number(review.is_correct) !== 1)) {
    throw new Error(`Submission ${row.id} round-two all-correct validation failed`);
  }
  if (record.latestReviews.length !== record.items.length
      || record.latestReviews.some((review) => Number(review.is_correct) !== 1)) {
    throw new Error(`Submission ${row.id} latest-review compatibility rows are not all correct`);
  }
  if (!repairLog(record)) throw new Error(`Submission ${row.id} repair audit log is missing`);
}

function summaryFor(record, source, phase) {
  const positionById = new Map(record.items.map((item) => [Number(item.id), Number(item.position)]));
  return {
    submission_id: Number(record.submission.id),
    student_name: record.submission.student_name,
    practice_date: record.submission.practice_date,
    plan_id: Number(record.submission.plan_id),
    phase,
    current_status: record.submission.status,
    current_round: Number(record.submission.current_round),
    source_log_id: source.sourceLogId,
    original_wrong_item_ids: source.wrongItemIds,
    original_wrong_positions: source.wrongItemIds.map((id) => positionById.get(id)),
    final_status: phase === 'repaired' ? record.submission.status : null,
  };
}

function inspectOpenDatabase(db, { requireFinal = false } = {}) {
  const records = TARGET_IDS.map((id) => loadRecord(db, id));
  if (new Set(records.map((record) => Number(record.submission.teacher_id))).size !== 1) {
    throw new Error('Target submissions no longer belong to one teacher');
  }
  return records.map((record) => {
    const source = sourceSnapshot(record);
    const repaired = Boolean(repairLog(record));
    if (repaired) assertFinal(record, source);
    else if (requireFinal) throw new Error(`Submission ${record.submission.id} has not been repaired`);
    else assertReady(record, source);
    return summaryFor(record, source, repaired ? 'repaired' : 'ready');
  });
}

function upsertRoundOne(db, record, source) {
  const allowedIds = source.reviews.map((review) => review.assignment_item_id);
  const placeholders = allowedIds.map(() => '?').join(',');
  db.run(`DELETE FROM practice_review_rounds
    WHERE submission_id=? AND round_no=1
      AND assignment_item_id NOT IN (${placeholders})`, [record.submission.id, ...allowedIds]);
  for (const review of source.reviews) {
    db.run(`INSERT INTO practice_review_rounds
      (submission_id,round_no,assignment_item_id,is_correct,teacher_note,reviewed_at)
      VALUES(?,1,?,?,?,?)
      ON CONFLICT(submission_id,round_no,assignment_item_id) DO UPDATE SET
        is_correct=excluded.is_correct,
        teacher_note=excluded.teacher_note,
        reviewed_at=excluded.reviewed_at`, [
      record.submission.id, review.assignment_item_id, review.is_correct,
      review.teacher_note, review.reviewed_at,
    ]);
    db.run(`INSERT INTO practice_reviews
      (submission_id,assignment_item_id,is_correct,teacher_note,reviewed_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT(submission_id,assignment_item_id) DO UPDATE SET
        is_correct=excluded.is_correct,
        teacher_note=excluded.teacher_note,
        reviewed_at=excluded.reviewed_at`, [
      record.submission.id, review.assignment_item_id, review.is_correct,
      review.teacher_note, review.reviewed_at,
    ]);
  }
  db.run(`INSERT INTO practice_submission_rounds
    (submission_id,round_no,status,teacher_note,submitted_at,reviewed_by,reviewed_at)
    VALUES(?,1,?,?,?,?,?)
    ON CONFLICT(submission_id,round_no) DO UPDATE SET
      status=excluded.status,
      teacher_note=excluded.teacher_note,
      submitted_at=excluded.submitted_at,
      reviewed_by=excluded.reviewed_by,
      reviewed_at=excluded.reviewed_at`, [
    record.submission.id, source.roundOne.status, source.roundOne.teacher_note ?? '',
    source.roundOne.submitted_at, source.roundOne.reviewed_by, source.roundOne.reviewed_at,
  ]);
}

function applyOne(db, record, source, { backupSha256, repairId, repairedAt }) {
  upsertRoundOne(db, record, source);
  db.run(`INSERT INTO practice_submission_rounds
    (submission_id,round_no,status,teacher_note,submitted_at,reviewed_by,reviewed_at)
    VALUES(?,2,'reviewed',?,?,?,?)`, [
    record.submission.id, DEFAULT_REPAIR_NOTE, repairedAt,
    record.submission.teacher_id, repairedAt,
  ]);
  for (const itemId of source.wrongItemIds) {
    db.run(`INSERT INTO practice_review_rounds
      (submission_id,round_no,assignment_item_id,is_correct,teacher_note,reviewed_at)
      VALUES(?,2,?,1,'',?)`, [record.submission.id, itemId, repairedAt]);
    db.run(`UPDATE practice_reviews SET is_correct=1,teacher_note='',reviewed_at=?
      WHERE submission_id=? AND assignment_item_id=?`, [repairedAt, record.submission.id, itemId]);
  }
  db.run(`UPDATE practice_submissions SET
      status='reviewed',current_round=2,needs_correction=0,teacher_note=?,
      reviewed_by=?,reviewed_at=?,completed_at=?,review_revision=?
    WHERE id=?`, [
    DEFAULT_REPAIR_NOTE, record.submission.teacher_id, repairedAt, repairedAt,
    source.expectedRevision, record.submission.id,
  ]);
  db.run(`UPDATE practice_assignments SET status='reviewed' WHERE id=?`, [
    record.submission.assignment_id,
  ]);
  db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
    VALUES(?,?,?,?,?)`, [
    record.submission.teacher_id,
    REPAIR_ACTION,
    'practice_submission',
    record.submission.id,
    JSON.stringify({
      repair_key: REPAIR_KEY,
      repair_id: repairId,
      backup_sha256: backupSha256,
      source_requeue_log_id: source.sourceLogId,
      policy: {
        round_1: 'restore_original_review_from_requeue_log',
        round_2: 'teacher_confirmed_default_all_correct',
      },
      before: {
        status: record.submission.status,
        current_round: record.submission.current_round,
        needs_correction: record.submission.needs_correction,
        review_revision: record.submission.review_revision,
        assignment_status: record.submission.assignment_status,
      },
      after: {
        status: 'reviewed',
        current_round: 2,
        needs_correction: 0,
        review_revision: source.expectedRevision,
        assignment_status: 'reviewed',
        original_wrong_item_ids: source.wrongItemIds,
      },
    }),
  ]);
}

async function inspectPracticeHistory({ databasePath, requireFinal = false }) {
  assertDatabaseFile(databasePath);
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(databasePath));
  const submissions = inspectOpenDatabase(db, { requireFinal });
  const integrity = databaseHelpers(db).one('PRAGMA integrity_check');
  if (integrity?.integrity_check !== 'ok') throw new Error('SQLite integrity check failed');
  return { ok: true, mode: requireFinal ? 'verify' : 'inspect', submissions };
}

async function repairPracticeHistory({
  databasePath,
  backupSha256,
  repairId,
  confirm,
}) {
  assertDatabaseFile(databasePath);
  if (confirm !== APPLY_CONFIRMATION) throw new Error(`Exact confirmation required: ${APPLY_CONFIRMATION}`);
  if (!/^[a-f0-9]{64}$/.test(String(backupSha256 || ''))) {
    throw new Error('A lowercase 64-character backup SHA-256 is required');
  }
  if (!/^[a-z0-9][a-z0-9._-]{7,80}$/.test(String(repairId || ''))) {
    throw new Error('Repair id is invalid');
  }
  const currentSha256 = sha256File(databasePath);
  if (currentSha256 !== backupSha256) {
    throw new Error(`Backup SHA-256 does not match the database being repaired: ${currentSha256}`);
  }
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(databasePath));
  const before = TARGET_IDS.map((id) => {
    const record = loadRecord(db, id);
    const source = sourceSnapshot(record);
    const repaired = Boolean(repairLog(record));
    if (repaired) assertFinal(record, source);
    else assertReady(record, source);
    return { record, source, repaired };
  });
  const pending = before.filter((entry) => !entry.repaired);
  if (pending.length) {
    db.run('BEGIN IMMEDIATE');
    try {
      const repairedAt = databaseHelpers(db).one('SELECT CURRENT_TIMESTAMP value').value;
      for (const entry of pending) {
        applyOne(db, entry.record, entry.source, { backupSha256, repairId, repairedAt });
      }
      inspectOpenDatabase(db, { requireFinal: true });
      const integrity = databaseHelpers(db).one('PRAGMA integrity_check');
      if (integrity?.integrity_check !== 'ok') throw new Error('SQLite integrity check failed before commit');
      db.run('COMMIT');
    } catch (error) {
      try { db.run('ROLLBACK'); } catch {}
      throw error;
    }
    const tempPath = `${databasePath}.${repairId}.tmp`;
    if (fs.existsSync(tempPath)) throw new Error(`Temporary output already exists: ${tempPath}`);
    try {
      fs.writeFileSync(tempPath, Buffer.from(db.export()), { flag: 'wx' });
      const verifyDb = new SQL.Database(fs.readFileSync(tempPath));
      inspectOpenDatabase(verifyDb, { requireFinal: true });
      const integrity = databaseHelpers(verifyDb).one('PRAGMA integrity_check');
      if (integrity?.integrity_check !== 'ok') throw new Error('Exported SQLite integrity check failed');
      fs.renameSync(tempPath, databasePath);
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch {}
      throw error;
    }
  }
  const result = await inspectPracticeHistory({ databasePath, requireFinal: true });
  return { ...result, mode: 'apply', changed: pending.length, idempotent: pending.length === 0 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databasePath = path.resolve(args.database || process.env.DATABASE_PATH || '');
  let result;
  if (args.mode === 'inspect') {
    result = await inspectPracticeHistory({ databasePath });
  } else if (args.mode === 'verify') {
    result = await inspectPracticeHistory({ databasePath, requireFinal: true });
  } else if (args.mode === 'apply') {
    result = await repairPracticeHistory({
      databasePath,
      backupSha256: String(args.backupSha256 || '').toLowerCase(),
      repairId: args.repairId,
      confirm: args.confirm,
    });
  } else {
    throw new Error(`Unsupported mode: ${args.mode}`);
  }
  console.log(JSON.stringify(result));
}

if (require.main === module || process.env.PANPAN_REPAIR_CLI === '1') {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET_IDS,
  REPAIR_KEY,
  REPAIR_ACTION,
  REQUEUE_ACTION,
  APPLY_CONFIRMATION,
  inspectPracticeHistory,
  repairPracticeHistory,
  sha256File,
};
