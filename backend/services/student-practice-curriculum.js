const crypto = require('node:crypto');

const CURRICULUM_SCHEMA_VERSION = 1;
const DAILY_QUESTION_COUNT = 10;
const ASSIGNMENT_SOURCE = 'student_curriculum';
const CURRICULUM_PLAN_STATUS = 'student_curriculum';

class CurriculumError extends Error {
  constructor(message, code = 'CURRICULUM_INVALID') {
    super(message);
    this.name = 'CurriculumError';
    this.code = code;
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(stableValue(value));
  return crypto.createHash('sha256').update(source).digest('hex');
}

function validDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function datePlus(start, offset) {
  const value = new Date(`${start}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function cleanText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeRender(raw, label, errors) {
  if (raw === undefined || raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`${label} render 必须是对象`);
    return null;
  }
  if (Number(raw.version || 1) !== 1) errors.push(`${label} render.version 仅支持 1`);
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (!blocks.length || blocks.length > 40) errors.push(`${label} render.blocks 数量应为 1-40`);
  const normalized = blocks.map((block, index) => {
    const blockLabel = `${label}第 ${index + 1} 个显示块`;
    const type = cleanText(block?.type, 24);
    if (!['text', 'number', 'operator', 'fraction', 'line_break'].includes(type)) {
      errors.push(`${blockLabel}类型无效`);
      return { type: 'text', value: '' };
    }
    if (type === 'line_break') return { type };
    if (type === 'fraction') {
      const numerator = cleanText(block.numerator, 80);
      const denominator = cleanText(block.denominator, 80);
      if (!numerator || !denominator) errors.push(`${blockLabel}分子或分母为空`);
      if (numerator.includes('/') || denominator.includes('/')) {
        errors.push(`${blockLabel}分数必须使用 numerator/denominator 结构，不能嵌入 /`);
      }
      return { type, numerator, denominator };
    }
    const value = cleanText(block.value, type === 'operator' ? 12 : 160);
    if (!value) errors.push(`${blockLabel}内容为空`);
    if (value.includes('/')) errors.push(`${blockLabel}不能使用 / 表示分数`);
    return { type, value };
  });
  return { version: 1, blocks: normalized };
}

function normalizeQuestion(raw, day, index, errors, signatures) {
  const label = `第 ${day.day_index} 天第 ${index + 1} 题`;
  const signature = cleanText(raw?.signature, 120);
  const templateKey = cleanText(raw?.template_key || day.question_type_key, 120);
  const stem = cleanText(raw?.stem, 1200);
  const answer = cleanText(raw?.answer, 500);
  const estimatedSeconds = Number(raw?.estimated_seconds ?? 90);
  const difficulty = Number(raw?.difficulty ?? 3);
  const provenance = cleanText(raw?.provenance || 'self_authored', 40);
  const render = normalizeRender(raw?.render, label, errors);
  const answerRender = normalizeRender(raw?.answer_render, `${label}答案`, errors);

  if (!/^[a-z0-9][a-z0-9._-]{5,119}$/i.test(signature)) errors.push(`${label} signature 无效`);
  if (signatures.has(signature)) errors.push(`${label} signature 在课程中重复`);
  signatures.add(signature);
  if (!/^[a-z0-9][a-z0-9._-]{2,119}$/i.test(templateKey)) errors.push(`${label} template_key 无效`);
  if (templateKey !== day.question_type_key) {
    errors.push(`${label} template_key 必须与当天唯一 question_type_key 一致`);
  }
  if (!stem) errors.push(`${label}题干为空`);
  if (!answer) errors.push(`${label}答案为空`);
  if (!Number.isInteger(estimatedSeconds) || estimatedSeconds < 30 || estimatedSeconds > 600) {
    errors.push(`${label}预计时长应为 30-600 秒`);
  }
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) errors.push(`${label}难度无效`);
  if (provenance !== 'self_authored') errors.push(`${label}专属练习只接收 self_authored 自编题`);
  if (stem.includes('/')) {
    errors.push(`${label}题干不能用 / 表示分数；请使用 render.blocks.fraction`);
  }
  if (answer.includes('/') && !answerRender?.blocks.some((block) => block.type === 'fraction')) {
    errors.push(`${label}分数答案必须使用 answer_render.blocks.fraction`);
  }

  return {
    position: index + 1,
    signature,
    template_key: templateKey,
    stem,
    answer,
    estimated_seconds: estimatedSeconds,
    difficulty,
    provenance,
    ...(render ? { render } : {}),
    ...(answerRender ? { answer_render: answerRender } : {}),
  };
}

function validateStudentCurriculumManifest(manifest) {
  const errors = [];
  const metadata = manifest?.metadata || {};
  const studentMatch = manifest?.student_match || {};
  const sourceDocument = metadata.source_document || {};
  const schemaVersion = Number(metadata.schema_version);
  const curriculumKey = cleanText(metadata.curriculum_key, 80);
  const title = cleanText(metadata.title, 100);
  const startDate = cleanText(metadata.start_date, 10);
  const endDate = cleanText(metadata.end_date, 10);
  const dailyQuestionCount = Number(metadata.daily_question_count);
  const retireOverlappingAdaptivePlans = metadata.retire_overlapping_adaptive_plans === true;
  const retirementGuard = metadata.retirement_guard;
  const days = Array.isArray(manifest?.days) ? manifest.days : [];

  if (schemaVersion !== CURRICULUM_SCHEMA_VERSION) errors.push('metadata.schema_version 仅支持 1');
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(curriculumKey)) errors.push('metadata.curriculum_key 无效');
  if (!title) errors.push('metadata.title 不能为空');
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    errors.push('metadata.start_date/end_date 无效');
  }
  if (dailyQuestionCount !== DAILY_QUESTION_COUNT) {
    errors.push(`metadata.daily_question_count 必须为 ${DAILY_QUESTION_COUNT}`);
  }
  if (metadata.retire_overlapping_adaptive_plans !== undefined
      && typeof metadata.retire_overlapping_adaptive_plans !== 'boolean') {
    errors.push('metadata.retire_overlapping_adaptive_plans 必须是布尔值');
  }
  if (retireOverlappingAdaptivePlans
      && (!retirementGuard || !Array.isArray(retirementGuard.expected_plans)
        || retirementGuard.expected_plans.length === 0)) {
    errors.push('自动结束旧计划时必须提供 metadata.retirement_guard.expected_plans');
  }
  const expectedRetirementPlans = Array.isArray(retirementGuard?.expected_plans)
    ? retirementGuard.expected_plans.map((raw, index) => {
      const label = `metadata.retirement_guard.expected_plans[${index}]`;
      const planId = Number(raw?.plan_id);
      const planTitle = cleanText(raw?.title, 100);
      const teacherNicknameValue = cleanText(raw?.teacher_nickname, 80);
      const classNameValue = cleanText(raw?.class_name, 100);
      const planStartDate = cleanText(raw?.start_date, 10);
      const planEndDate = cleanText(raw?.end_date, 10);
      const retireTo = cleanText(raw?.retire_to, 10);
      const externalIds = Array.isArray(raw?.active_student_external_ids)
        ? raw.active_student_external_ids.map((value) => cleanText(value, 80))
        : [];
      if (!Number.isInteger(planId) || planId <= 0) errors.push(`${label}.plan_id 无效`);
      if (!planTitle || !teacherNicknameValue || !classNameValue) {
        errors.push(`${label} 必须提供 title、teacher_nickname 和 class_name`);
      }
      if (!validDate(planStartDate) || !validDate(planEndDate) || planStartDate > planEndDate) {
        errors.push(`${label}.start_date/end_date 无效`);
      }
      if (validDate(startDate) && validDate(planStartDate) && validDate(planEndDate)
          && (planStartDate > datePlus(startDate, -1) || planEndDate < startDate)) {
        errors.push(`${label} 必须精确描述一份跨越专属课程开始日的旧计划`);
      }
      if (!validDate(retireTo) || (validDate(startDate) && retireTo !== datePlus(startDate, -1))) {
        errors.push(`${label}.retire_to 必须等于专属课程开始前一天`);
      }
      if (!externalIds.length || externalIds.some((value) => !/^stu_[a-f0-9]{32}$/.test(value))) {
        errors.push(`${label}.active_student_external_ids 必须是非空稳定 external_id 列表`);
      }
      if (new Set(externalIds).size !== externalIds.length) {
        errors.push(`${label}.active_student_external_ids 不能重复`);
      }
      return {
        plan_id: planId,
        title: planTitle,
        teacher_nickname: teacherNicknameValue,
        class_name: classNameValue,
        start_date: planStartDate,
        end_date: planEndDate,
        retire_to: retireTo,
        active_student_external_ids: [...externalIds].sort(),
      };
    })
    : [];
  if (new Set(expectedRetirementPlans.map((plan) => plan.plan_id)).size
      !== expectedRetirementPlans.length) {
    errors.push('metadata.retirement_guard.expected_plans 的 plan_id 不能重复');
  }
  const sourceKey = cleanText(sourceDocument.key, 120);
  const sourceTitle = cleanText(sourceDocument.title, 200);
  if (!sourceKey || !sourceTitle) errors.push('metadata.source_document.key/title 不能为空');

  const externalId = cleanText(studentMatch.external_id, 80);
  const name = cleanText(studentMatch.name, 80);
  const teacherScope = studentMatch.teacher_scope || {};
  const teacherOpenid = cleanText(teacherScope.openid || studentMatch.teacher_openid, 160);
  const teacherNickname = cleanText(teacherScope.nickname || studentMatch.teacher_nickname, 80);
  const className = cleanText(studentMatch.class_name, 100);
  if (externalId && !/^stu_[a-f0-9]{32}$/.test(externalId)) errors.push('student_match.external_id 无效');
  if (!externalId && !name) errors.push('student_match 必须提供 external_id，或提供姓名和教师范围');
  if (!externalId && !teacherOpenid && !teacherNickname) {
    errors.push('按姓名匹配时必须提供 teacher_scope.openid 或 teacher_scope.nickname');
  }

  if (!days.length) errors.push('days 不能为空');
  if (validDate(startDate) && validDate(endDate)) {
    const expectedDays = Math.round(
      (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000,
    ) + 1;
    if (days.length !== expectedDays) errors.push(`days 应连续覆盖 ${expectedDays} 天`);
  }

  const signatures = new Set();
  const dayDates = new Set();
  const dayIndexes = new Set();
  const normalizedDays = days.map((raw, index) => {
    const dayIndex = Number(raw?.day_index);
    const practiceDate = cleanText(raw?.date || raw?.practice_date, 10);
    const sourcePage = Number(raw?.source_page);
    const questionTypeKey = cleanText(raw?.question_type_key, 120);
    const questionTypeLabel = cleanText(raw?.question_type_label, 120);
    const questions = Array.isArray(raw?.questions) ? raw.questions : [];
    const day = {
      day_index: dayIndex,
      date: practiceDate,
      source_page: sourcePage,
      question_type_key: questionTypeKey,
      question_type_label: questionTypeLabel,
    };
    const label = `days[${index}]`;
    if (dayIndex !== index + 1) errors.push(`${label}.day_index 必须连续且从 1 开始`);
    if (dayIndexes.has(dayIndex)) errors.push(`${label}.day_index 重复`);
    dayIndexes.add(dayIndex);
    if (!validDate(practiceDate) || (validDate(startDate) && practiceDate !== datePlus(startDate, index))) {
      errors.push(`${label}.date 必须从 start_date 起逐日连续`);
    }
    if (dayDates.has(practiceDate)) errors.push(`${label}.date 重复`);
    dayDates.add(practiceDate);
    if (!Number.isInteger(sourcePage) || sourcePage < 1) errors.push(`${label}.source_page 无效`);
    if (!/^[a-z0-9][a-z0-9._-]{2,119}$/i.test(questionTypeKey)) {
      errors.push(`${label}.question_type_key 无效`);
    }
    if (!questionTypeLabel) errors.push(`${label}.question_type_label 不能为空`);
    if (questions.length !== DAILY_QUESTION_COUNT) {
      errors.push(`${label}.questions 必须恰好 ${DAILY_QUESTION_COUNT} 道`);
    }
    const normalizedQuestions = questions.map((question, questionIndex) => (
      normalizeQuestion(question, day, questionIndex, errors, signatures)
    ));
    const core = { ...day, questions: normalizedQuestions };
    return { ...core, content_sha256: sha256(core) };
  });

  const normalized = {
    metadata: {
      schema_version: CURRICULUM_SCHEMA_VERSION,
      curriculum_key: curriculumKey,
      title,
      start_date: startDate,
      end_date: endDate,
      daily_question_count: DAILY_QUESTION_COUNT,
      retire_overlapping_adaptive_plans: retireOverlappingAdaptivePlans,
      ...(retireOverlappingAdaptivePlans ? {
        retirement_guard: {
          expected_plans: expectedRetirementPlans,
        },
      } : {}),
      source_document: {
        key: sourceKey,
        title: sourceTitle,
        ...(cleanText(sourceDocument.sha256, 64) ? { sha256: cleanText(sourceDocument.sha256, 64) } : {}),
      },
    },
    student_match: {
      ...(externalId ? { external_id: externalId } : {}),
      ...(name ? { name } : {}),
      ...(teacherOpenid || teacherNickname ? {
        teacher_scope: {
          ...(teacherOpenid ? { openid: teacherOpenid } : {}),
          ...(teacherNickname ? { nickname: teacherNickname } : {}),
        },
      } : {}),
      ...(className ? { class_name: className } : {}),
    },
    days: normalizedDays,
  };
  return {
    ok: errors.length === 0,
    errors,
    manifest: normalized,
    manifest_sha256: sha256(normalized),
  };
}

function resolveStudentMatch(db, rawMatch) {
  const match = rawMatch || {};
  const externalId = cleanText(match.external_id, 80);
  const name = cleanText(match.name, 80);
  const teacherScope = match.teacher_scope || {};
  const teacherOpenid = cleanText(teacherScope.openid, 160);
  const teacherNickname = cleanText(teacherScope.nickname, 80);
  const className = cleanText(match.class_name, 100);
  const clauses = ['s.deleted_at IS NULL'];
  const params = [];
  if (externalId) {
    clauses.push('s.external_id=?');
    params.push(externalId);
  } else {
    clauses.push('s.name=?');
    params.push(name);
    if (teacherOpenid) {
      clauses.push('t.openid=?');
      params.push(teacherOpenid);
    }
    if (teacherNickname) {
      clauses.push('t.nickname=?');
      params.push(teacherNickname);
    }
  }
  if (name && externalId) {
    clauses.push('s.name=?');
    params.push(name);
  }
  if (className) {
    clauses.push('c.name=?');
    params.push(className);
  }
  const matches = db.all(`SELECT s.id,s.external_id,s.name,s.class_id,
      COALESCE(s.teacher_id,c.teacher_id) teacher_id,
      c.name class_name,t.openid teacher_openid,t.nickname teacher_nickname
    FROM students s
    LEFT JOIN classes c ON c.id=s.class_id
    LEFT JOIN users t ON t.id=COALESCE(s.teacher_id,c.teacher_id)
    WHERE ${clauses.join(' AND ')}
    ORDER BY s.id`, params);
  if (matches.length !== 1) {
    throw new CurriculumError(
      matches.length
        ? `学生匹配到 ${matches.length} 条记录，请改用 external_id 或收紧教师范围`
        : '未找到唯一学生，请重新核对 external_id、姓名和教师范围',
      'CURRICULUM_STUDENT_MATCH_FAILED',
    );
  }
  const student = matches[0];
  if (!student.external_id || !/^stu_[a-f0-9]{32}$/.test(String(student.external_id))) {
    throw new CurriculumError('学生缺少有效 external_id，请先完成数据库迁移', 'CURRICULUM_STUDENT_EXTERNAL_ID_MISSING');
  }
  if (!student.class_id || !student.teacher_id) {
    throw new CurriculumError('学生未绑定有效班级或教师', 'CURRICULUM_STUDENT_SCOPE_INVALID');
  }
  return student;
}

function parseMeta(value) {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}

function sameStringList(left, right) {
  return JSON.stringify([...(left || [])].map(String).sort())
    === JSON.stringify([...(right || [])].map(String).sort());
}

function assignmentIsLocked(db, assignment) {
  if (!assignment) return false;
  if (Number(assignment.is_frozen)) return true;
  if (assignment.claimed_at) return true;
  if (String(assignment.status) !== 'ready') return true;
  return Boolean(db.get('SELECT 1 locked FROM practice_submissions WHERE assignment_id=? LIMIT 1', [assignment.id]));
}

function exactCurriculumAssignment(db, assignment, curriculumDayId, day) {
  if (!assignment
      || assignment.assignment_source !== ASSIGNMENT_SOURCE
      || Number(assignment.curriculum_day_id) !== Number(curriculumDayId)) return false;
  const meta = parseMeta(assignment.selection_meta);
  if (meta.content_sha256 !== day.content_sha256) return false;
  const questions = Array.isArray(day.questions)
    ? day.questions
    : JSON.parse(day.questions_json || '[]');
  const rows = db.all(`SELECT * FROM practice_assignment_items
    WHERE assignment_id=? ORDER BY position,id`, [assignment.id]);
  if (rows.length !== questions.length) return false;
  return questions.every((question, index) => {
    const row = rows[index];
    const expectedPayload = {
      render: question.render || null,
      answer_render: question.answer_render || null,
      source_page: Number(day.source_page),
      question_type_key: day.question_type_key,
    };
    return Number(row.position) === Number(question.position)
      && row.question_id === null
      && String(row.snapshot_stem) === String(question.stem)
      && String(row.snapshot_answer) === String(question.answer)
      && String(row.snapshot_module) === '专属计算'
      && String(row.snapshot_type) === String(day.question_type_label)
      && Number(row.snapshot_difficulty) === Number(question.difficulty)
      && Number(row.estimated_seconds) === Number(question.estimated_seconds)
      && String(row.signature) === String(question.signature)
      && String(row.template_key) === String(question.template_key)
      && JSON.stringify(stableValue(parseMeta(row.snapshot_payload)))
        === JSON.stringify(stableValue(expectedPayload));
  });
}

function inspectStudentCurriculum(db, rawManifest) {
  const validated = validateStudentCurriculumManifest(rawManifest);
  if (!validated.ok) return { ...validated, conflicts: [], student: null };
  let student;
  try {
    student = resolveStudentMatch(db, validated.manifest.student_match);
  } catch (error) {
    return {
      ...validated,
      ok: false,
      errors: [error.message],
      conflicts: [],
      student: null,
    };
  }
  const key = validated.manifest.metadata.curriculum_key;
  const existing = db.get('SELECT * FROM practice_student_curricula WHERE curriculum_key=?', [key]);
  const conflicts = [];
  if (existing && Number(existing.student_id) !== Number(student.id)) {
    conflicts.push('curriculum_key 已属于另一名学生');
  }
  const retirablePlans = [];
  const alreadyRetiredPlans = [];
  if (validated.manifest.metadata.retire_overlapping_adaptive_plans) {
    const guardedPlans = validated.manifest.metadata.retirement_guard.expected_plans;
    const guardedPlanIds = new Set(guardedPlans.map((plan) => Number(plan.plan_id)));
    const overlappingPlans = db.all(`SELECT DISTINCT p.*
      FROM practice_plans p
      JOIN practice_student_settings pss ON pss.plan_id=p.id
      WHERE pss.student_id=? AND p.status='published'
        AND p.start_date<=? AND p.end_date>=?
      ORDER BY p.id`, [
      student.id,
      validated.manifest.metadata.start_date,
      validated.manifest.metadata.start_date,
    ]).filter((plan) => Number(plan.id) !== Number(existing?.plan_id || 0));
    for (const plan of overlappingPlans) {
      if (!guardedPlanIds.has(Number(plan.id))) {
        conflicts.push(`发现未列入 retirement_guard 的重叠计划“${plan.title}”(${plan.id})`);
      }
    }
    for (const expected of guardedPlans) {
      const plan = db.get(`SELECT p.*,t.nickname teacher_nickname,c.name class_name
        FROM practice_plans p
        LEFT JOIN users t ON t.id=p.teacher_id
        LEFT JOIN classes c ON c.id=p.class_id
        WHERE p.id=?`, [expected.plan_id]);
      if (!plan) {
        conflicts.push(`retirement_guard 指定的计划 ${expected.plan_id} 不存在`);
        continue;
      }
      const fieldMismatches = [];
      if (String(plan.title) !== expected.title) fieldMismatches.push('title');
      if (String(plan.teacher_nickname || '') !== expected.teacher_nickname) {
        fieldMismatches.push('teacher_nickname');
      }
      if (String(plan.class_name || '') !== expected.class_name) fieldMismatches.push('class_name');
      if (String(plan.start_date) !== expected.start_date) fieldMismatches.push('start_date');
      if (String(plan.status) !== 'published') fieldMismatches.push('status');
      if (Number(plan.teacher_id) !== Number(student.teacher_id)) fieldMismatches.push('teacher_id');
      if (Number(plan.class_id) !== Number(student.class_id)) fieldMismatches.push('class_id');
      if (![expected.end_date, expected.retire_to].includes(String(plan.end_date))) {
        fieldMismatches.push('end_date');
      }
      const settingExternalIds = db.all(`SELECT s.external_id
        FROM practice_student_settings pss
        JOIN students s ON s.id=pss.student_id
        WHERE pss.plan_id=? AND s.deleted_at IS NULL
        ORDER BY s.external_id`, [plan.id]).map((row) => row.external_id);
      const classExternalIds = db.all(`SELECT s.external_id
        FROM students s
        WHERE s.class_id=? AND s.deleted_at IS NULL
        ORDER BY s.external_id`, [plan.class_id]).map((row) => row.external_id);
      if (!sameStringList(settingExternalIds, expected.active_student_external_ids)) {
        fieldMismatches.push('practice_student_settings.external_ids');
      }
      if (!sameStringList(classExternalIds, expected.active_student_external_ids)) {
        fieldMismatches.push('class_student_external_ids');
      }
      if (fieldMismatches.length) {
        conflicts.push(`retirement_guard 计划“${expected.title}”字段已变化：${fieldMismatches.join(',')}`);
        continue;
      }
      const guarded = {
        id: Number(plan.id),
        teacher_id: Number(plan.teacher_id),
        class_id: Number(plan.class_id),
        title: plan.title,
        status: plan.status,
        start_date: plan.start_date,
        previous_end_date: expected.end_date,
        retire_date: expected.retire_to,
      };
      if (String(plan.end_date) === expected.retire_to) alreadyRetiredPlans.push(guarded);
      else retirablePlans.push(guarded);
    }
  }
  const targetDates = new Set(validated.manifest.days.map((day) => day.date));
  let replaceableAssignments = 0;
  let unchangedAssignments = 0;
  for (const day of validated.manifest.days) {
    const existingDay = db.get(`SELECT * FROM practice_student_curriculum_days
      WHERE student_id=? AND practice_date=?`, [student.id, day.date]);
    if (existingDay && (!existing || Number(existingDay.curriculum_id) !== Number(existing.id))) {
      conflicts.push(`${day.date} 已被另一份专属课程占用`);
      continue;
    }
    const assignment = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
      student.id, day.date,
    ]);
    if (!assignment) continue;
    const unchanged = existingDay && exactCurriculumAssignment(db, assignment, existingDay.id, day);
    if (unchanged) unchangedAssignments += 1;
    else if (assignmentIsLocked(db, assignment)) {
      conflicts.push(`${day.date} 题单已领取、提交或进入处理流程，禁止覆盖`);
    } else {
      replaceableAssignments += 1;
    }
  }
  if (existing) {
    const staleDays = db.all('SELECT * FROM practice_student_curriculum_days WHERE curriculum_id=?', [existing.id])
      .filter((day) => !targetDates.has(String(day.practice_date).slice(0, 10)));
    for (const day of staleDays) {
      const assignment = db.get('SELECT * FROM practice_assignments WHERE curriculum_day_id=?', [day.id]);
      if (assignmentIsLocked(db, assignment)) conflicts.push(`${day.practice_date} 已从新清单移除，但旧题单已锁定`);
    }
  }
  return {
    ...validated,
    ok: conflicts.length === 0,
    errors: conflicts.length ? conflicts : [],
    conflicts,
    student,
    existing_curriculum_id: existing?.id || null,
    retirable_plans: retirablePlans,
    already_retired_plans: alreadyRetiredPlans,
    replaceable_assignments: replaceableAssignments,
    unchanged_assignments: unchangedAssignments,
    assignment_count: validated.manifest.days.length,
  };
}

function findStudentCurriculumDay(db, studentId, practiceDate) {
  return db.get(`SELECT d.*,c.curriculum_key,c.plan_id,c.title curriculum_title,
      c.manifest_sha256,c.source_document_key,c.source_document_title
    FROM practice_student_curriculum_days d
    JOIN practice_student_curricula c ON c.id=d.curriculum_id
    WHERE d.student_id=? AND d.practice_date=? AND c.status='active'
    LIMIT 1`, [studentId, practiceDate]);
}

function resolveStudentPracticePlan(db, studentId, practiceDate) {
  return db.get(`SELECT p.* FROM practice_student_curriculum_days d
    JOIN practice_student_curricula c ON c.id=d.curriculum_id
    JOIN practice_plans p ON p.id=c.plan_id
    WHERE d.student_id=? AND d.practice_date=? AND c.status='active'
    LIMIT 1`, [studentId, practiceDate]);
}

function replaceAssignmentWithCurriculumDay(db, day) {
  const assignment = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
    day.student_id, day.practice_date,
  ]);
  if (exactCurriculumAssignment(db, assignment, day.id, day)) return assignment;
  if (assignmentIsLocked(db, assignment)) {
    throw new CurriculumError(
      `${day.practice_date} 题单已领取、提交或进入处理流程，禁止覆盖`,
      'CURRICULUM_ASSIGNMENT_LOCKED',
    );
  }
  const questions = JSON.parse(day.questions_json);
  if (!Array.isArray(questions) || questions.length !== DAILY_QUESTION_COUNT) {
    throw new CurriculumError(`${day.practice_date} 专属题目数据损坏`, 'CURRICULUM_DAY_CORRUPT');
  }
  if (assignment) {
    db.run('DELETE FROM practice_assignment_items WHERE assignment_id=?', [assignment.id]);
    db.run('DELETE FROM practice_assignments WHERE id=?', [assignment.id]);
  }
  const estimated = questions.reduce((sum, question) => sum + Number(question.estimated_seconds || 90), 0);
  const selectionMeta = {
    version: 'student-curriculum-v1',
    curriculum_key: day.curriculum_key,
    day_index: Number(day.day_index),
    source_page: Number(day.source_page),
    question_type_key: day.question_type_key,
    question_type_label: day.question_type_label,
    content_sha256: day.content_sha256,
    question_count: DAILY_QUESTION_COUNT,
  };
  const created = db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta,assignment_source,curriculum_day_id)
    VALUES(?,?,?,?,?,?,?,?)`, [
    day.plan_id, day.student_id, day.practice_date, 'ready', estimated,
    JSON.stringify(selectionMeta), ASSIGNMENT_SOURCE, day.id,
  ]);
  for (const question of questions) {
    const snapshotPayload = {
      render: question.render || null,
      answer_render: question.answer_render || null,
      source_page: Number(day.source_page),
      question_type_key: day.question_type_key,
    };
    db.run(`INSERT INTO practice_assignment_items
      (assignment_id,question_id,position,snapshot_stem,snapshot_answer,snapshot_module,snapshot_type,
       snapshot_difficulty,estimated_seconds,signature,template_key,snapshot_payload)
      VALUES(?,NULL,?,?,?,?,?,?,?,?,?,?)`, [
      created.lastInsertRowid, question.position, question.stem, question.answer, '专属计算',
      day.question_type_label, question.difficulty, question.estimated_seconds, question.signature,
      question.template_key, JSON.stringify(snapshotPayload),
    ]);
  }
  return db.get('SELECT * FROM practice_assignments WHERE id=?', [created.lastInsertRowid]);
}

function generateStudentCurriculumAssignment(db, studentId, practiceDate) {
  const day = findStudentCurriculumDay(db, studentId, practiceDate);
  if (!day) return null;
  return db.transaction(() => {
    const currentDay = findStudentCurriculumDay(db, studentId, practiceDate);
    if (!currentDay) return null;
    return replaceAssignmentWithCurriculumDay(db, currentDay);
  });
}

function applyStudentCurriculum(db, rawManifest, options = {}) {
  const dryRun = options.dryRun !== false;
  const initial = inspectStudentCurriculum(db, rawManifest);
  if (!initial.ok) {
    throw new CurriculumError(
      `专属课程清单校验失败：${initial.errors.join('；')}`,
      initial.conflicts?.length ? 'CURRICULUM_CONFLICT' : 'CURRICULUM_INVALID',
    );
  }
  if (dryRun) return { ...initial, dry_run: true };
  const normalized = initial.manifest;
  return db.transaction(() => {
    const inspection = inspectStudentCurriculum(db, normalized);
    if (!inspection.ok) {
      throw new CurriculumError(
        `专属课程清单状态已变化：${inspection.errors.join('；')}`,
        'CURRICULUM_CONFLICT',
      );
    }
    const student = inspection.student;
    const metadata = normalized.metadata;
    const retiredPlans = [];
    for (const plan of inspection.retirable_plans || []) {
      const retired = db.run(`UPDATE practice_plans SET end_date=?
        WHERE id=? AND teacher_id=? AND class_id=? AND title=? AND status=?
          AND start_date=? AND end_date=?`, [
        plan.retire_date, plan.id, plan.teacher_id, plan.class_id, plan.title, plan.status,
        plan.start_date, plan.previous_end_date,
      ]);
      if (Number(retired.changes) !== 1) {
        throw new CurriculumError(
          `普通计划“${plan.title}”状态已变化，禁止继续应用`,
          'CURRICULUM_CONFLICT',
        );
      }
      retiredPlans.push(plan);
    }
    let curriculum = db.get('SELECT * FROM practice_student_curricula WHERE curriculum_key=?', [
      metadata.curriculum_key,
    ]);
    let planId = curriculum?.plan_id;
    const questionTypes = [...new Set(normalized.days.map((day) => day.question_type_label))];
    const targetSeconds = Math.max(...normalized.days.map((day) => (
      day.questions.reduce((sum, question) => sum + Number(question.estimated_seconds || 90), 0)
    )));
    if (!curriculum) {
      const plan = db.run(`INSERT INTO practice_plans
        (teacher_id,class_id,title,start_date,end_date,grade_band,subject,module,question_types,topic_keys,
         difficulty,target_seconds,auto_advance,status)
        VALUES(?,?,?,?,?,'初中','数学','专属计算',?,'[]',3,?,0,?)`, [
        student.teacher_id, student.class_id, metadata.title, metadata.start_date, metadata.end_date,
        JSON.stringify(questionTypes), targetSeconds, CURRICULUM_PLAN_STATUS,
      ]);
      planId = plan.lastInsertRowid;
      const created = db.run(`INSERT INTO practice_student_curricula
        (curriculum_key,teacher_id,student_id,plan_id,title,start_date,end_date,daily_question_count,
         source_document_key,source_document_title,manifest_version,manifest_sha256,status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        metadata.curriculum_key, student.teacher_id, student.id, planId, metadata.title,
        metadata.start_date, metadata.end_date, DAILY_QUESTION_COUNT,
        metadata.source_document.key, metadata.source_document.title,
        CURRICULUM_SCHEMA_VERSION, inspection.manifest_sha256, 'active',
      ]);
      curriculum = db.get('SELECT * FROM practice_student_curricula WHERE id=?', [created.lastInsertRowid]);
    } else {
      db.run(`UPDATE practice_plans SET teacher_id=?,class_id=?,title=?,start_date=?,end_date=?,
          grade_band='初中',subject='数学',module='专属计算',question_types=?,topic_keys='[]',
          difficulty=3,target_seconds=?,auto_advance=0,status=?
        WHERE id=?`, [
        student.teacher_id, student.class_id, metadata.title, metadata.start_date, metadata.end_date,
        JSON.stringify(questionTypes), targetSeconds, CURRICULUM_PLAN_STATUS, planId,
      ]);
      db.run(`UPDATE practice_student_curricula SET teacher_id=?,student_id=?,title=?,start_date=?,end_date=?,
          daily_question_count=?,source_document_key=?,source_document_title=?,manifest_version=?,
          manifest_sha256=?,status='active',updated_at=CURRENT_TIMESTAMP
        WHERE id=?`, [
        student.teacher_id, student.id, metadata.title, metadata.start_date, metadata.end_date,
        DAILY_QUESTION_COUNT, metadata.source_document.key, metadata.source_document.title,
        CURRICULUM_SCHEMA_VERSION, inspection.manifest_sha256, curriculum.id,
      ]);
    }
    db.run(`INSERT INTO practice_student_settings
      (plan_id,student_id,current_module,difficulty,auto_advance,is_locked)
      VALUES(?,?,'专属计算',3,0,1)
      ON CONFLICT(plan_id,student_id) DO UPDATE SET
        current_module='专属计算',difficulty=3,auto_advance=0,is_locked=1,updated_at=CURRENT_TIMESTAMP`, [
      planId, student.id,
    ]);

    const targetDates = new Set(normalized.days.map((day) => day.date));
    const staleDays = db.all('SELECT * FROM practice_student_curriculum_days WHERE curriculum_id=?', [curriculum.id])
      .filter((day) => !targetDates.has(String(day.practice_date).slice(0, 10)));
    for (const stale of staleDays) {
      const assignment = db.get('SELECT * FROM practice_assignments WHERE curriculum_day_id=?', [stale.id]);
      if (assignment) {
        db.run('DELETE FROM practice_assignment_items WHERE assignment_id=?', [assignment.id]);
        db.run('DELETE FROM practice_assignments WHERE id=?', [assignment.id]);
      }
      db.run('DELETE FROM practice_student_curriculum_days WHERE id=?', [stale.id]);
    }

    for (const day of normalized.days) {
      db.run(`INSERT INTO practice_student_curriculum_days
        (curriculum_id,student_id,practice_date,day_index,source_page,question_type_key,
         question_type_label,question_count,questions_json,content_sha256)
        VALUES(?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(student_id,practice_date) DO UPDATE SET
          curriculum_id=excluded.curriculum_id,day_index=excluded.day_index,source_page=excluded.source_page,
          question_type_key=excluded.question_type_key,question_type_label=excluded.question_type_label,
          question_count=excluded.question_count,questions_json=excluded.questions_json,
          content_sha256=excluded.content_sha256,updated_at=CURRENT_TIMESTAMP`, [
        curriculum.id, student.id, day.date, day.day_index, day.source_page, day.question_type_key,
        day.question_type_label, DAILY_QUESTION_COUNT, JSON.stringify(day.questions), day.content_sha256,
      ]);
    }

    const assignments = [];
    for (const day of normalized.days) {
      const storedDay = findStudentCurriculumDay(db, student.id, day.date);
      assignments.push(replaceAssignmentWithCurriculumDay(db, storedDay));
    }
    db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
      VALUES(?,?,?,?,?)`, [
      student.teacher_id, 'student_practice_curriculum_applied', 'practice_student_curriculum',
      curriculum.id, JSON.stringify({
        curriculum_key: metadata.curriculum_key,
        student_external_id: student.external_id,
        start_date: metadata.start_date,
        end_date: metadata.end_date,
        day_count: normalized.days.length,
        daily_question_count: DAILY_QUESTION_COUNT,
        manifest_sha256: inspection.manifest_sha256,
        retired_plans: retiredPlans.map((plan) => ({
          id: plan.id,
          previous_end_date: plan.previous_end_date,
          new_end_date: plan.retire_date,
        })),
        retired_plan_ids: retiredPlans.map((plan) => plan.id),
        already_retired_plan_ids: (inspection.already_retired_plans || []).map((plan) => plan.id),
      }),
    ]);
    return {
      ok: true,
      dry_run: false,
      curriculum_id: Number(curriculum.id),
      plan_id: Number(planId),
      curriculum_key: metadata.curriculum_key,
      manifest_sha256: inspection.manifest_sha256,
      student: {
        external_id: student.external_id,
        name: student.name,
        teacher_nickname: student.teacher_nickname,
        class_name: student.class_name,
      },
      assignments: assignments.length,
      retired_plans: retiredPlans,
      already_retired_plans: inspection.already_retired_plans || [],
      replaced_assignments: inspection.replaceable_assignments,
      unchanged_assignments: inspection.unchanged_assignments,
    };
  });
}

module.exports = {
  CURRICULUM_SCHEMA_VERSION,
  DAILY_QUESTION_COUNT,
  ASSIGNMENT_SOURCE,
  CURRICULUM_PLAN_STATUS,
  CurriculumError,
  validateStudentCurriculumManifest,
  resolveStudentMatch,
  inspectStudentCurriculum,
  findStudentCurriculumDay,
  resolveStudentPracticePlan,
  generateStudentCurriculumAssignment,
  applyStudentCurriculum,
};
