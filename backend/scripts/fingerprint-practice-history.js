const fs = require('node:fs');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--database') result.database = argv[++index];
    else if (value === '--student-external-id') result.externalId = argv[++index];
    else if (value === '--date') result.date = argv[++index];
    else throw new Error(`未知参数：${value}`);
  }
  return result;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const database = args.database || process.env.DATABASE_PATH;
  if (!database || !fs.existsSync(database)) throw new Error('数据库不存在');
  if (!/^stu_[a-f0-9]{32}$/.test(String(args.externalId || ''))) throw new Error('external_id 无效');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.date || ''))) throw new Error('日期无效');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(database));
  const all = (sql, params = []) => {
    const statement = db.prepare(sql);
    statement.bind(params);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
    return rows;
  };
  const one = (sql, params = []) => all(sql, params)[0] || null;
  const student = one('SELECT id,external_id FROM students WHERE external_id=?', [args.externalId]);
  if (!student) throw new Error('学生不存在');
  const assignment = one(`SELECT id,plan_id,student_id,practice_date,status,estimated_seconds,
      selection_meta,claimed_at,created_at
    FROM practice_assignments
    WHERE student_id=? AND practice_date=?`, [student.id, args.date]);
  if (!assignment) throw new Error('历史题单不存在');
  const submission = one(`SELECT id,assignment_id,parent_id,status,teacher_note,submitted_at,
      reviewed_by,reviewed_at,current_round,needs_correction,completed_at
    FROM practice_submissions WHERE assignment_id=?`, [assignment.id]);
  const submissionId = submission?.id || -1;
  const snapshot = {
    student_external_id: student.external_id,
    assignment,
    items: all(`SELECT id,assignment_id,question_id,position,snapshot_stem,snapshot_answer,
        snapshot_module,snapshot_type,snapshot_difficulty,estimated_seconds,signature,template_key
      FROM practice_assignment_items
      WHERE assignment_id=? ORDER BY position,id`, [assignment.id]),
    submission,
    submission_rounds: submission
      ? all(`SELECT id,submission_id,round_no,status,teacher_note,submitted_at,reviewed_by,
          reviewed_at,created_at
        FROM practice_submission_rounds WHERE submission_id=? ORDER BY round_no,id`, [submissionId])
      : [],
    attachments: submission
      ? all(`SELECT pa.id,pa.submission_id,pa.owner_parent_id,pa.file_id,pa.sha256,pa.created_at,
            pa.round_no,pf.token,pf.student_id file_student_id,pf.purpose,pf.owner_type,pf.owner_id,
            pf.storage_key,pf.mime_type,pf.byte_size,pf.sha256,pf.original_name,pf.created_by,pf.created_at file_created_at
          FROM practice_attachments pa
          JOIN private_files pf ON pf.id=pa.file_id
          WHERE pa.submission_id=? ORDER BY pa.round_no,pa.id`, [submissionId])
      : [],
    reviews: submission
      ? all(`SELECT submission_id,assignment_item_id,is_correct,teacher_note,reviewed_at
        FROM practice_reviews WHERE submission_id=? ORDER BY assignment_item_id`, [submissionId])
      : [],
    review_rounds: submission
      ? all(`SELECT id,submission_id,round_no,assignment_item_id,is_correct,teacher_note,reviewed_at
          FROM practice_review_rounds
          WHERE submission_id=? ORDER BY round_no,assignment_item_id`, [submissionId])
      : [],
  };
  const canonical = JSON.stringify(stableValue(snapshot));
  console.log(JSON.stringify({
    student_external_id: student.external_id,
    practice_date: args.date,
    assignment_id: Number(assignment.id),
    submission_id: submission ? Number(submission.id) : null,
    submission_status: submission?.status || null,
    item_count: snapshot.items.length,
    attachment_count: snapshot.attachments.length,
    review_count: snapshot.reviews.length,
    review_round_count: snapshot.review_rounds.length,
    sha256: crypto.createHash('sha256').update(canonical).digest('hex'),
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
