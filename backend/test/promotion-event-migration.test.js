const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const dbPath = path.join(rubbish, `promotion-event-migration-${process.pid}.db`);

process.env.NODE_ENV = 'test';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.DATABASE_PATH = dbPath;

const { getDB, initDB } = require('../db/init');

test.after(() => {
  try { fs.rmSync(dbPath, { force:true }); } catch {}
});

test('旧宣传事件约束升级后保留历史素材并允许攻坚通关事件', async () => {
  fs.mkdirSync(rubbish, { recursive:true });
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const currentSchema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const legacySchema = currentSchema.replace(
    "'mental_first','challenge_pass','weekend_mastery_pass'",
    "'mental_first','challenge_pass'",
  );
  assert.notEqual(legacySchema, currentSchema, '测试库必须使用旧宣传事件约束');
  raw.run(legacySchema);
  raw.run("INSERT INTO users(id,openid,role,nickname) VALUES(1,'migration-teacher','teacher','潘老师')");
  raw.run("INSERT INTO students(id,teacher_id,name,grade,invite_code) VALUES(1,1,'严木','七年级','MIG001')");
  raw.run(`INSERT INTO teacher_promotion_events
    (teacher_id,student_id,event_key,event_type,source_id,payload_json,scene_token)
    VALUES(1,1,'mental:first:1','mental_first',1,'{}','legacy-scene-token')`);
  fs.writeFileSync(dbPath, Buffer.from(raw.export()));
  raw.close();

  await initDB();
  const db = getDB();
  const table = db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='teacher_promotion_events'");
  assert.match(String(table?.sql || ''), /weekend_mastery_pass/);
  assert.equal(db.get("SELECT COUNT(*) count FROM teacher_promotion_events WHERE event_key='mental:first:1'").count, 1);
  db.run(`INSERT INTO teacher_promotion_events
    (teacher_id,student_id,event_key,event_type,source_id,payload_json,scene_token)
    VALUES(1,1,'weekend-mastery:pass:1','weekend_mastery_pass',1,'{}','mastery-scene-token')`);
  assert.equal(db.get("SELECT COUNT(*) count FROM teacher_promotion_events WHERE event_type='weekend_mastery_pass'").count, 1);
});
