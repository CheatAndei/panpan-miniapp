const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const dbPath = path.join(rubbish, `student-curriculum-migration-${process.pid}.db`);
fs.mkdirSync(rubbish, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = dbPath;
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';

test('旧库启动迁移先补列再建索引，保留旧题单并标记为 adaptive', async () => {
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    CREATE TABLE practice_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      practice_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      estimated_seconds INTEGER NOT NULL DEFAULT 0,
      selection_meta TEXT NOT NULL DEFAULT '{}',
      claimed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, practice_date)
    );
    CREATE TABLE practice_assignment_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      question_id INTEGER,
      position INTEGER NOT NULL,
      snapshot_stem TEXT NOT NULL,
      snapshot_answer TEXT NOT NULL,
      snapshot_module TEXT NOT NULL,
      snapshot_type TEXT NOT NULL,
      snapshot_difficulty INTEGER NOT NULL,
      estimated_seconds INTEGER NOT NULL,
      signature TEXT NOT NULL,
      template_key TEXT NOT NULL,
      UNIQUE(assignment_id, position),
      UNIQUE(assignment_id, signature)
    );
    INSERT INTO practice_assignments
      (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta)
      VALUES(1,46,'2026-07-27','submitted',1080,'{"version":"adaptive-v1"}');
    INSERT INTO practice_assignment_items
      (assignment_id,position,snapshot_stem,snapshot_answer,snapshot_module,snapshot_type,
       snapshot_difficulty,estimated_seconds,signature,template_key)
      VALUES(1,1,'旧题','1','综合计算','旧混合',3,90,'legacy-migration-q1','legacy');
  `);
  fs.writeFileSync(dbPath, Buffer.from(legacy.export()));
  legacy.close();

  const { initDB, getDB } = require('../db/init');
  await initDB();
  const db = getDB();
  const assignmentColumns = new Set(db.all('PRAGMA table_info(practice_assignments)').map((row) => row.name));
  const itemColumns = new Set(db.all('PRAGMA table_info(practice_assignment_items)').map((row) => row.name));
  assert.ok(assignmentColumns.has('assignment_source'));
  assert.ok(assignmentColumns.has('curriculum_day_id'));
  assert.ok(itemColumns.has('snapshot_payload'));
  assert.ok(db.get(`SELECT 1 ok FROM sqlite_master
    WHERE type='table' AND name='practice_student_curricula'`));
  assert.ok(db.get(`SELECT 1 ok FROM sqlite_master
    WHERE type='table' AND name='practice_student_curriculum_days'`));
  const old = db.get('SELECT * FROM practice_assignments WHERE id=1');
  assert.equal(old.status, 'submitted');
  assert.equal(old.assignment_source, 'adaptive');
  assert.equal(old.curriculum_day_id, null);
  assert.equal(db.get('SELECT snapshot_payload FROM practice_assignment_items WHERE id=1').snapshot_payload, '{}');
});

test.after(() => {
  try { fs.unlinkSync(dbPath); } catch {}
});
