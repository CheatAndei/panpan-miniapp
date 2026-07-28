const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const dbPath = path.join(rubbish, `student-curriculum-test-${process.pid}.db`);
fs.mkdirSync(rubbish, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.UPLOAD_DIR = path.join(rubbish, `student-curriculum-uploads-${process.pid}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `student-curriculum-private-${process.pid}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `student-curriculum-exams-${process.pid}`);
process.env.JWT_SECRET = 'student-curriculum-test-secret-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';

const { start } = require('../server');
const { getDB } = require('../db/init');
const { practiceDateAt, generateAssignment, preGenerateDate } = require('../services/practice');
const {
  validateStudentCurriculumManifest,
  inspectStudentCurriculum,
  applyStudentCurriculum,
  resolveStudentPracticePlan,
} = require('../services/student-practice-curriculum');

let server;
let base;
let teacherId;
let classId;
let studentId;
let studentExternalId;
let parentId;
let ordinaryPlanId;

function token(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

function addDays(date, offset) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function makeManifest({
  key = 'student-curriculum-test-v1',
  externalId = studentExternalId,
  name,
  teacherNickname,
  start = '2026-07-28',
  days = 2,
  pageStart = 4,
  retireOverlappingAdaptivePlans = false,
  retirementExpectedPlans = null,
} = {}) {
  const expectedPlans = retirementExpectedPlans || (retireOverlappingAdaptivePlans ? [{
    plan_id: Number(ordinaryPlanId),
    title: '普通混合计划',
    teacher_nickname: '潘潘测试',
    class_name: '专属课程测试班',
    start_date: '2026-07-01',
    end_date: '2026-12-31',
    retire_to: addDays(start, -1),
    active_student_external_ids: [externalId],
  }] : []);
  return {
    metadata: {
      schema_version: 1,
      curriculum_key: key,
      title: `${key} 专属练习`,
      start_date: start,
      end_date: addDays(start, days - 1),
      daily_question_count: 10,
      retire_overlapping_adaptive_plans: retireOverlappingAdaptivePlans,
      ...(retireOverlappingAdaptivePlans ? {
        retirement_guard: { expected_plans: expectedPlans },
      } : {}),
      source_document: {
        key: 'calculation-100-test-source',
        title: '计算100题测试来源',
      },
    },
    student_match: externalId
      ? { external_id: externalId }
      : { name, teacher_scope: { nickname: teacherNickname } },
    days: Array.from({ length: days }, (_, dayOffset) => ({
      day_index: dayOffset + 1,
      date: addDays(start, dayOffset),
      source_page: pageStart + dayOffset,
      question_type_key: `page-${pageStart + dayOffset}-single-type`,
      question_type_label: `第${pageStart + dayOffset}页单一题型`,
      questions: Array.from({ length: 10 }, (_, questionOffset) => ({
        signature: `${key}.d${dayOffset + 1}.q${questionOffset + 1}`,
        template_key: `page-${pageStart + dayOffset}-single-type`,
        stem: `第${dayOffset + 1}天第${questionOffset + 1}题：计算结构化分数`,
        answer: `${questionOffset + 1}/12`,
        answer_render: {
          version: 1,
          blocks: [
            {
              type: 'fraction',
              numerator: String(questionOffset + 1),
              denominator: '12',
            },
          ],
        },
        estimated_seconds: 75 + questionOffset,
        difficulty: 3,
        provenance: 'self_authored',
        render: {
          version: 1,
          blocks: [
            { type: 'text', value: '计算：' },
            { type: 'fraction', numerator: String(questionOffset + 1), denominator: '12' },
            { type: 'operator', value: '+' },
            { type: 'fraction', numerator: '1', denominator: '6' },
          ],
        },
      })),
    })),
  };
}

function createOrdinaryPlan(db, start, end, suffix = '') {
  return db.run(`INSERT INTO practice_plans
    (teacher_id,class_id,title,start_date,end_date,grade_band,subject,module,question_types,topic_keys,
     difficulty,target_seconds,auto_advance,status)
    VALUES(?,?,?,?,?,'初中','数学','综合计算','[]','[]',3,1200,0,'published')`, [
    teacherId, classId, `普通混合计划${suffix}`, start, end,
  ]).lastInsertRowid;
}

function createLegacyAssignment(db, targetStudentId, planId, date, {
  count = 13, claimed = false, submitted = false,
} = {}) {
  const created = db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta,claimed_at)
    VALUES(?,?,?,'ready',1200,'{"version":"adaptive-v1"}',?)`, [
    planId, targetStudentId, date, claimed ? '2026-07-28 02:00:00' : null,
  ]);
  for (let index = 1; index <= count; index += 1) {
    db.run(`INSERT INTO practice_assignment_items
      (assignment_id,position,snapshot_stem,snapshot_answer,snapshot_module,snapshot_type,
       snapshot_difficulty,estimated_seconds,signature,template_key)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, [
      created.lastInsertRowid, index, `旧混合题${index}`, String(index), '综合计算',
      index % 2 ? '有理数混合' : '一元一次方程', 3, 90,
      `legacy-${targetStudentId}-${date}-${index}`, `legacy-${index}`,
    ]);
  }
  if (submitted) {
    db.run(`INSERT INTO practice_submissions(assignment_id,parent_id,status)
      VALUES(?,?,'submitted')`, [created.lastInsertRowid, parentId]);
  }
  return created.lastInsertRowid;
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  teacherId = db.run("INSERT INTO users(openid,role,nickname) VALUES('curriculum-teacher','teacher','潘潘测试')").lastInsertRowid;
  parentId = db.run("INSERT INTO users(openid,role,nickname) VALUES('curriculum-parent','parent','课程家长')").lastInsertRowid;
  classId = db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,?,?,?)`, [teacherId, '专属课程测试班', '数学', '初一']).lastInsertRowid;
  studentId = db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURR01')`, [teacherId, classId, '冯测试']).lastInsertRowid;
  studentExternalId = db.get('SELECT external_id FROM students WHERE id=?', [studentId]).external_id;
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parentId, studentId]);
  ordinaryPlanId = createOrdinaryPlan(db, '2026-07-01', '2026-12-31');
  db.run(`INSERT INTO practice_student_settings
    (plan_id,student_id,current_module,difficulty,auto_advance,is_locked)
    VALUES(?,?,'综合计算',3,0,0)`, [ordinaryPlanId, studentId]);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
  for (const directory of [process.env.UPLOAD_DIR, process.env.PRIVATE_UPLOAD_DIR, process.env.EXAM_LIBRARY_DIR]) {
    try { fs.rmSync(directory, { recursive: true, force: true }); } catch {}
  }
});

test('清单严格校验连续日期、每天 10 题和结构化分数', () => {
  const valid = validateStudentCurriculumManifest(makeManifest());
  assert.equal(valid.ok, true, valid.errors.join('；'));
  assert.equal(valid.manifest.days.length, 2);
  assert.equal(valid.manifest.days[0].questions.length, 10);
  assert.equal(valid.manifest.days[0].questions[0].render.blocks[1].type, 'fraction');

  const wrongCount = makeManifest();
  wrongCount.days[0].questions.pop();
  const invalidCount = validateStudentCurriculumManifest(wrongCount);
  assert.equal(invalidCount.ok, false);
  assert.match(invalidCount.errors.join(' '), /恰好 10 道/);

  const mixedDate = makeManifest();
  mixedDate.days[1].date = '2026-08-01';
  assert.match(validateStudentCurriculumManifest(mixedDate).errors.join(' '), /逐日连续/);

  const slashFraction = makeManifest();
  slashFraction.days[0].questions[0].stem = '1/2 + 1/3';
  delete slashFraction.days[0].questions[0].render;
  assert.match(validateStudentCurriculumManifest(slashFraction).errors.join(' '), /render\.blocks\.fraction/);

  const missingAnswerRender = makeManifest();
  delete missingAnswerRender.days[0].questions[0].answer_render;
  assert.match(
    validateStudentCurriculumManifest(missingAnswerRender).errors.join(' '),
    /answer_render\.blocks\.fraction/,
  );

  const mixedTemplate = makeManifest();
  mixedTemplate.days[0].questions[0].template_key = 'another-question-type';
  assert.match(
    validateStudentCurriculumManifest(mixedTemplate).errors.join(' '),
    /question_type_key/,
  );

  const missingRetirementGuard = makeManifest({ retireOverlappingAdaptivePlans: true });
  delete missingRetirementGuard.metadata.retirement_guard;
  assert.match(
    validateStudentCurriculumManifest(missingRetirementGuard).errors.join(' '),
    /retirement_guard/,
  );
});

test('预检后原子替换未领取混合题单，逐日固定 10 题且重复应用幂等', () => {
  const db = getDB();
  const manifest = makeManifest({ retireOverlappingAdaptivePlans: true });
  const historicalDay = createLegacyAssignment(db, studentId, ordinaryPlanId, '2026-07-27', {
    count: 12, submitted: true,
  });
  const oldDay1 = createLegacyAssignment(db, studentId, ordinaryPlanId, '2026-07-28', { count: 13 });
  const oldDay2 = createLegacyAssignment(db, studentId, ordinaryPlanId, '2026-07-29', { count: 14 });

  const preview = applyStudentCurriculum(db, manifest);
  assert.equal(preview.dry_run, true);
  assert.equal(preview.replaceable_assignments, 2);
  assert.deepEqual(preview.retirable_plans.map((plan) => Number(plan.id)), [Number(ordinaryPlanId)]);
  assert.equal(db.get('SELECT id FROM practice_assignments WHERE id=?', [oldDay1]).id, oldDay1);

  const applied = applyStudentCurriculum(db, manifest, { dryRun: false });
  assert.equal(applied.assignments, 2);
  assert.equal(applied.replaced_assignments, 2);
  assert.deepEqual(applied.retired_plans.map((plan) => Number(plan.id)), [Number(ordinaryPlanId)]);
  assert.equal(db.get('SELECT end_date FROM practice_plans WHERE id=?', [ordinaryPlanId]).end_date, '2026-07-27');
  const rows = db.all(`SELECT a.*,d.day_index,d.source_page,d.question_type_label
    FROM practice_assignments a
    JOIN practice_student_curriculum_days d ON d.id=a.curriculum_day_id
    WHERE a.student_id=? AND a.practice_date BETWEEN '2026-07-28' AND '2026-07-29'
    ORDER BY a.practice_date`, [studentId]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => Number(row.source_page)), [4, 5]);
  assert.ok(rows.every((row) => row.assignment_source === 'student_curriculum'));
  assert.ok(rows.every((row) => Number(db.get(
    'SELECT COUNT(*) count FROM practice_assignment_items WHERE assignment_id=?', [row.id],
  ).count) === 10));
  assert.equal(db.get('SELECT id FROM practice_assignments WHERE id=?', [oldDay1]), null);
  assert.equal(db.get('SELECT id FROM practice_assignments WHERE id=?', [oldDay2]), null);
  assert.equal(Number(db.get('SELECT id FROM practice_assignments WHERE id=?', [historicalDay]).id), Number(historicalDay));
  assert.equal(db.get('SELECT status FROM practice_submissions WHERE assignment_id=?', [historicalDay]).status, 'submitted');
  assert.equal(Number(db.get(
    'SELECT COUNT(*) count FROM practice_assignment_items WHERE assignment_id=?', [historicalDay],
  ).count), 12);
  const typeCounts = db.all(`SELECT a.practice_date,COUNT(DISTINCT i.snapshot_type) count
    FROM practice_assignments a JOIN practice_assignment_items i ON i.assignment_id=a.id
    WHERE a.student_id=? AND a.practice_date BETWEEN '2026-07-28' AND '2026-07-29'
    GROUP BY a.practice_date`, [studentId]);
  assert.deepEqual(typeCounts.map((row) => Number(row.count)), [1, 1]);

  const competing = makeManifest({ key: 'competing-curriculum-v1' });
  const competingInspection = inspectStudentCurriculum(db, competing);
  assert.equal(competingInspection.ok, false);
  assert.match(competingInspection.errors.join(' '), /另一份专属课程占用/);
  assert.throws(
    () => applyStudentCurriculum(db, competing, { dryRun: false }),
    (error) => error.code === 'CURRICULUM_CONFLICT',
  );
  assert.equal(db.get(`SELECT id FROM practice_student_curricula
    WHERE curriculum_key='competing-curriculum-v1'`), null);

  db.run('UPDATE practice_assignments SET claimed_at=CURRENT_TIMESTAMP WHERE id=?', [rows[0].id]);
  const repeated = applyStudentCurriculum(db, manifest, { dryRun: false });
  assert.equal(repeated.unchanged_assignments, 2);
  const repeatedIds = db.all(`SELECT id FROM practice_assignments
    WHERE student_id=? AND practice_date BETWEEN '2026-07-28' AND '2026-07-29'
    ORDER BY practice_date`, [studentId]).map((row) => Number(row.id));
  assert.deepEqual(repeatedIds, rows.map((row) => Number(row.id)));

  const changed = makeManifest();
  changed.days[0].questions[0].answer = 'changed';
  assert.throws(
    () => applyStudentCurriculum(db, changed, { dryRun: false }),
    (error) => error.code === 'CURRICULUM_CONFLICT' && /禁止覆盖/.test(error.message),
  );
  const firstAnswer = db.get(`SELECT i.snapshot_answer answer
    FROM practice_assignments a JOIN practice_assignment_items i ON i.assignment_id=a.id
    WHERE a.id=? AND i.position=1`, [rows[0].id]).answer;
  assert.notEqual(firstAnswer, 'changed');
});

test('claimed 与已有 submission 都会使整批迁移中止且不留下半成品', () => {
  const db = getDB();
  const claimedStudent = db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURR02')`, [teacherId, classId, '已领取学生']).lastInsertRowid;
  const claimedExternal = db.get('SELECT external_id FROM students WHERE id=?', [claimedStudent]).external_id;
  const claimedManifest = makeManifest({
    key: 'claimed-curriculum-v1', externalId: claimedExternal, start: '2026-08-05', days: 1,
  });
  createLegacyAssignment(db, claimedStudent, ordinaryPlanId, '2026-08-05', { claimed: true });
  assert.throws(
    () => applyStudentCurriculum(db, claimedManifest, { dryRun: false }),
    (error) => error.code === 'CURRICULUM_CONFLICT',
  );
  assert.equal(db.get(`SELECT id FROM practice_student_curricula
    WHERE curriculum_key='claimed-curriculum-v1'`), null);

  const submittedStudent = db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURR03')`, [teacherId, classId, '已提交学生']).lastInsertRowid;
  const submittedExternal = db.get('SELECT external_id FROM students WHERE id=?', [submittedStudent]).external_id;
  const submittedManifest = makeManifest({
    key: 'submitted-curriculum-v1', externalId: submittedExternal, start: '2026-08-06', days: 1,
  });
  createLegacyAssignment(db, submittedStudent, ordinaryPlanId, '2026-08-06', { submitted: true });
  assert.throws(
    () => applyStudentCurriculum(db, submittedManifest, { dryRun: false }),
    (error) => error.code === 'CURRICULUM_CONFLICT',
  );
  assert.equal(db.get(`SELECT id FROM practice_student_curricula
    WHERE curriculum_key='submitted-curriculum-v1'`), null);
});

test('自动结束旧类别计划时拒绝影响仍在使用同一计划的其他学生', () => {
  const db = getDB();
  const targetStudent = db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURRSHARE1')`, [teacherId, classId, '共享计划目标学生']).lastInsertRowid;
  const otherStudent = db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURRSHARE2')`, [teacherId, classId, '共享计划其他学生']).lastInsertRowid;
  const sharedPlan = createOrdinaryPlan(db, '2026-09-01', '2026-10-10', '共享');
  for (const id of [targetStudent, otherStudent]) {
    db.run(`INSERT INTO practice_student_settings
      (plan_id,student_id,current_module,difficulty,auto_advance,is_locked)
      VALUES(?,?,'综合计算',3,0,0)`, [sharedPlan, id]);
  }
  const targetExternal = db.get('SELECT external_id FROM students WHERE id=?', [targetStudent]).external_id;
  const otherExternal = db.get('SELECT external_id FROM students WHERE id=?', [otherStudent]).external_id;
  const manifest = makeManifest({
    key: 'shared-plan-curriculum-v1',
    externalId: targetExternal,
    start: '2026-10-01',
    days: 1,
    retireOverlappingAdaptivePlans: true,
    retirementExpectedPlans: [{
      plan_id: Number(sharedPlan),
      title: '普通混合计划共享',
      teacher_nickname: '潘潘测试',
      class_name: '专属课程测试班',
      start_date: '2026-09-01',
      end_date: '2026-10-10',
      retire_to: '2026-09-30',
      active_student_external_ids: [targetExternal, otherExternal],
    }],
  });
  const inspection = inspectStudentCurriculum(db, manifest);
  assert.equal(inspection.ok, false);
  assert.match(inspection.errors.join(' '), /external_ids/);
  assert.throws(
    () => applyStudentCurriculum(db, manifest, { dryRun: false }),
    (error) => error.code === 'CURRICULUM_CONFLICT',
  );
  assert.equal(db.get('SELECT end_date FROM practice_plans WHERE id=?', [sharedPlan]).end_date, '2026-10-10');
});

test('姓名迁移必须受教师范围约束且唯一，最终仍绑定稳定 external_id', () => {
  const db = getDB();
  const unique = makeManifest({
    key: 'name-scope-curriculum-v1',
    externalId: '',
    name: '姓名匹配学生',
    teacherNickname: '潘潘测试',
    start: '2026-09-01',
    days: 1,
  });
  const matchedId = db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURR04')`, [teacherId, classId, '姓名匹配学生']).lastInsertRowid;
  const inspection = inspectStudentCurriculum(db, unique);
  assert.equal(inspection.ok, true, inspection.errors.join('；'));
  assert.equal(Number(inspection.student.id), Number(matchedId));
  assert.match(inspection.student.external_id, /^stu_[a-f0-9]{32}$/);

  db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURR05')`, [teacherId, classId, '姓名匹配学生']);
  const ambiguous = inspectStudentCurriculum(db, unique);
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.errors.join(' '), /匹配到 2 条/);
});

test('专属日期优先于普通计划，预生成幂等且今日接口只返回结构化题面不返回答案', async () => {
  const db = getDB();
  const today = practiceDateAt();
  const routeStudent = db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,?,'CURR06')`, [teacherId, classId, '接口学生']).lastInsertRowid;
  const routeExternal = db.get('SELECT external_id FROM students WHERE id=?', [routeStudent]).external_id;
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parentId, routeStudent]);
  const manifest = makeManifest({
    key: 'route-curriculum-v1', externalId: routeExternal, start: today, days: 1, pageStart: 8,
  });
  applyStudentCurriculum(db, manifest, { dryRun: false });
  const customPlan = resolveStudentPracticePlan(db, routeStudent, today);
  assert.equal(customPlan.status, 'student_curriculum');
  const ordinaryPlan = db.get('SELECT * FROM practice_plans WHERE id=?', [ordinaryPlanId]);
  const generated = generateAssignment(db, ordinaryPlan, routeStudent, today);
  assert.equal(generated.assignment_source, 'student_curriculum');
  const beforeId = Number(generated.id);
  const preGenerated = preGenerateDate(db, today);
  assert.ok(preGenerated.curricula >= 1);
  assert.equal(Number(db.get('SELECT id FROM practice_assignments WHERE student_id=? AND practice_date=?', [
    routeStudent, today,
  ]).id), beforeId);

  const plansResponse = await fetch(`${base}/practice/plans?status=current`, {
    headers: { Authorization: `Bearer ${token(teacherId, 'teacher')}` },
  });
  assert.equal(plansResponse.status, 200);
  const plansPayload = await plansResponse.json();
  assert.ok(plansPayload.plans.some((plan) => Number(plan.id) === Number(customPlan.id)));

  const response = await fetch(`${base}/practice/today?student_id=${routeStudent}`, {
    headers: { Authorization: `Bearer ${token(parentId, 'parent')}` },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.assignment.assignment_source, 'student_curriculum');
  assert.equal(payload.assignment.items.length, 10);
  assert.equal(payload.assignment.items[0].render.blocks[1].type, 'fraction');
  assert.equal(Object.hasOwn(payload.assignment.items[0], 'answer'), false);
  assert.equal(Object.hasOwn(payload.assignment.items[0], 'answer_render'), false);
  assert.equal(Object.hasOwn(payload.assignment.items[0], 'snapshot_answer'), false);
  assert.equal(payload.plan.id, customPlan.id);

  db.run(`INSERT INTO practice_submissions(assignment_id,parent_id,status,current_round)
    VALUES(?,?,'submitted',1)`, [beforeId, parentId]);
  const reviewResponse = await fetch(
    `${base}/practice/submissions?plan_id=${customPlan.id}&status=submitted`,
    { headers: { Authorization: `Bearer ${token(teacherId, 'teacher')}` } },
  );
  assert.equal(reviewResponse.status, 200);
  const reviewPayload = await reviewResponse.json();
  assert.equal(reviewPayload.submissions[0].items[0].render.blocks[1].type, 'fraction');
  assert.equal(reviewPayload.submissions[0].items[0].answer_render.blocks[0].type, 'fraction');
  assert.equal(Object.hasOwn(reviewPayload.submissions[0].items[0], 'snapshot_payload'), false);
});
