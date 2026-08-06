const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  ASSIGNMENT_SOURCE: STUDENT_CURRICULUM_SOURCE,
  generateStudentCurriculumAssignment,
  resolveStudentPracticePlan,
} = require('./student-practice-curriculum');
const {
  resolvePracticePdfBlocks,
  drawPracticePdfBlocks,
} = require('./practice-pdf-math');

const FIXED_GRADE = '初中';
const FIXED_MODULE = '综合计算';
const FIXED_DIFFICULTY = 3;
const DAILY_QUESTION_COUNT = 12;
const ENHANCED_QUESTION_COUNT = 6;
const STANDARD_DIFFICULTY = 3;
const ENHANCED_DIFFICULTY = 4;
const TEMPLATE_DAILY_CAP = 4;
const MODULES = { [FIXED_GRADE]: [FIXED_MODULE] };
const G7_TOPICS = Object.freeze({
  rational_numbers: { label: '有理数运算', questionTypes: ['有理数加减', '有理数乘除', '有理数混合', '有理数巧算'] },
  absolute_value: { label: '绝对值计算', questionTypes: ['绝对值计算'] },
  algebra: { label: '整式化简与求值', questionTypes: ['整式化简', '整式求值'] },
  linear_equation: { label: '一元一次方程', questionTypes: ['一元一次方程'] },
});
const G8_TOPICS = Object.freeze({
  g8_powers: { label: '幂的运算', questionTypes: ['幂的运算'] },
  g8_polynomial_multiplication: { label: '整式的乘法', questionTypes: ['整式乘法'] },
  g8_multiplication_formulas: { label: '乘法公式', questionTypes: ['乘法公式'] },
  g8_factorization: { label: '因式分解', questionTypes: ['因式分解'] },
});
const GRADE_TOPICS = Object.freeze({ g7: G7_TOPICS, g8: G8_TOPICS, g9: G7_TOPICS });
const TOPICS = Object.freeze({ ...G7_TOPICS, ...G8_TOPICS });
const DEFAULT_TOPIC_KEYS_BY_GRADE = Object.freeze({
  g7: Object.freeze(Object.keys(G7_TOPICS)),
  g8: Object.freeze(Object.keys(G8_TOPICS)),
  g9: Object.freeze(Object.keys(G7_TOPICS)),
});
const DEFAULT_TOPIC_KEYS = DEFAULT_TOPIC_KEYS_BY_GRADE.g7;

function practiceDateAt(value = new Date()) {
  const shanghai = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  if (shanghai.getUTCHours() < 1) shanghai.setUTCDate(shanghai.getUTCDate() - 1);
  return shanghai.toISOString().slice(0, 10);
}

function oldestPendingPracticeCorrection(db, studentId, throughDate = practiceDateAt()) {
  return db.get(`SELECT a.id assignment_id,a.plan_id,a.student_id,a.practice_date,
      a.status assignment_status,a.estimated_seconds,a.claimed_at,
      p.title plan_title,p.module plan_module,
      ps.id submission_id,ps.status submission_status,ps.current_round,
      ps.needs_correction,ps.reviewed_at
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN students s ON s.id=a.student_id
    WHERE a.student_id=? AND a.practice_date<=?
      AND ps.status='correction_required' AND s.deleted_at IS NULL
    ORDER BY a.practice_date ASC,a.id ASC
    LIMIT 1`, [studentId, throughDate]);
}

function dateRange(start, end, maxDays = 31) {
  const result = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime()) || current > last) return result;
  while (current <= last && result.length < maxDays) {
    result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

function datePlus(start, offset = 1) {
  const date = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + Number(offset || 0));
  return date.toISOString().slice(0, 10);
}

function parseJson(value, fallback = []) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function inferredTopicGrade(source) {
  if (source.some((key) => G8_TOPICS[key])) return 'g8';
  return 'g7';
}

function normalizeTopicKeys(value, gradeCode = '') {
  const source = Array.isArray(value) ? value : parseJson(value, []);
  const grade = GRADE_TOPICS[gradeCode] ? gradeCode : inferredTopicGrade(source.map(String));
  const topics = GRADE_TOPICS[grade];
  const unique = [...new Set(source.map(String).filter((key) => topics[key]))];
  return unique.length ? unique : [...DEFAULT_TOPIC_KEYS_BY_GRADE[grade]];
}

function questionTypesForTopics(topicKeys, gradeCode = '') {
  const normalized = normalizeTopicKeys(topicKeys, gradeCode);
  return normalized.flatMap((key) => TOPICS[key].questionTypes);
}

function deterministicSort(items, seed) {
  return [...items].sort((a, b) => {
    const ah = crypto.createHash('sha256').update(`${seed}|${a.signature}`).digest('hex');
    const bh = crypto.createHash('sha256').update(`${seed}|${b.signature}`).digest('hex');
    return ah.localeCompare(bh);
  });
}

function localityAwareSort(items, seed) {
  const ordered = deterministicSort(items, seed);
  const local = ordered.filter((item) => item.source_region === '广州');
  const general = ordered.filter((item) => item.source_region !== '广州');
  const result = [];
  while (local.length || general.length) {
    if (local.length) result.push(local.shift());
    if (general.length) result.push(general.shift());
  }
  return result;
}

function scopedQuestionPool(db, plan, setting, module = null) {
  const gradeCode = String(plan.grade_code || 'g7');
  const questionTypes = questionTypesForTopics(plan.topic_keys, gradeCode);
  const placeholders = questionTypes.map(() => '?').join(',');
  const sql = `SELECT * FROM practice_questions
    WHERE grade_band=? AND grade_code=? AND subject=? AND module=? AND is_active=1
      AND question_type IN (${placeholders})`;
  const params = [FIXED_GRADE, gradeCode, '数学', FIXED_MODULE, ...questionTypes];
  return db.all(sql, params);
}

function normalizedQuestionText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/gu, '').replace(/[。．]/gu, '');
}

function questionFingerprint(question) {
  return `${normalizedQuestionText(question.stem || question.snapshot_stem)}|${normalizedQuestionText(question.answer || question.snapshot_answer)}`;
}

function historyTemplates(db, studentId, practiceDate) {
  const rows = db.all(`SELECT r.is_correct,r.reviewed_at,i.snapshot_module,i.template_key,a.practice_date
    FROM practice_reviews r
    JOIN practice_assignment_items i ON i.id=r.assignment_item_id
    JOIN practice_assignments a ON a.id=i.assignment_id
    WHERE a.student_id=?
    ORDER BY a.practice_date DESC,r.reviewed_at DESC LIMIT 240`, [studentId]);
  const key = (row) => `${row.snapshot_module}|${row.template_key}`;
  const latest = new Map();
  for (const row of rows) if (!latest.has(key(row))) latest.set(key(row), row);
  const intervalCutoff = new Date(`${practiceDate}T00:00:00Z`);
  intervalCutoff.setUTCDate(intervalCutoff.getUTCDate() - 3);
  const cutoffText = intervalCutoff.toISOString().slice(0, 10);
  const wrong = new Set();
  const mastered = new Set();
  for (const [template, row] of latest.entries()) {
    if (!Number(row.is_correct)) wrong.add(template);
    else if (String(row.practice_date).slice(0, 10) <= cutoffText) mastered.add(template);
  }
  return { wrong, mastered, latestCount: latest.size, intervalDays: 3 };
}

function recentQuestions(db, studentId, practiceDate) {
  const from = new Date(`${practiceDate}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 14);
  const rows = db.all(`SELECT i.signature,i.snapshot_stem,i.snapshot_answer FROM practice_assignment_items i
    JOIN practice_assignments a ON a.id=i.assignment_id
    WHERE a.student_id=? AND a.practice_date>=? AND a.practice_date<?`, [
    studentId, from.toISOString().slice(0, 10), practiceDate,
  ]);
  return {
    signatures: new Set(rows.map((row) => row.signature)),
    fingerprints: new Set(rows.map(questionFingerprint)),
  };
}

function resolvePracticeAbilitySnapshot(db, plan, studentId, beforeDate) {
  const gradeCode = String(plan?.grade_code || 'g7');
  const row = db.get(`SELECT a.id assignment_id,a.practice_date,ps.id submission_id,
      COUNT(i.id) total_count,
      SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) reviewed_count,
      SUM(CASE WHEN r.id IS NOT NULL AND r.is_correct=0 THEN 1 ELSE 0 END) wrong_count
    FROM practice_assignments a
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN practice_submissions ps ON ps.assignment_id=a.id
    JOIN practice_assignment_items i ON i.assignment_id=a.id
    LEFT JOIN practice_review_rounds r ON r.submission_id=ps.id
      AND r.assignment_item_id=i.id AND r.round_no=1
    WHERE a.student_id=? AND p.grade_code=? AND a.assignment_source='adaptive'
      AND a.practice_date<?
    GROUP BY a.id,a.practice_date,ps.id
    HAVING COUNT(i.id)>0
      AND SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END)=COUNT(i.id)
    ORDER BY a.practice_date DESC,a.id DESC LIMIT 1`, [studentId, gradeCode, beforeDate]);
  if (!row) return null;
  const wrongCount = Number(row.wrong_count || 0);
  return {
    source_assignment_id: Number(row.assignment_id),
    source_submission_id: Number(row.submission_id),
    source_date: String(row.practice_date),
    total_count: Number(row.total_count),
    reviewed_count: Number(row.reviewed_count),
    wrong_count: wrongCount,
    review_round: 1,
    enhanced: wrongCount < 2,
  };
}

function prioritizedQuestionPool(pool, history, keyOf, seed) {
  const wrong = deterministicSort(pool.filter((item) => history.wrong.has(keyOf(item))), `${seed}|wrong`);
  const mastered = deterministicSort(pool.filter((item) => !history.wrong.has(keyOf(item))
    && history.mastered.has(keyOf(item))), `${seed}|mastered`);
  const fresh = deterministicSort(pool.filter((item) => !history.wrong.has(keyOf(item))
    && !history.mastered.has(keyOf(item))), `${seed}|fresh`);
  return [...wrong, ...mastered, ...fresh];
}

function selectQuestions(db, plan, setting, studentId, practiceDate, options = {}) {
  const currentPool = scopedQuestionPool(db, plan, setting, setting.current_module);
  if (!currentPool.length) throw new Error('当前题库范围没有可用题目');
  const targetSeconds = Number(plan.target_seconds || 1200);
  const minSeconds = 18 * 60;
  const maxSeconds = 22 * 60;
  const history = historyTemplates(db, studentId, practiceDate);
  const recent = recentQuestions(db, studentId, practiceDate);
  // The rolling 14-day history is a hard exclusion. Batch exclusions are soft
  // so a long frozen plan can reuse older questions after exhausting its pool.
  const batchExcluded = {
    signatures: new Set(Array.from(options.excludedSignatures || [], String)),
    fingerprints: new Set(Array.from(options.excludedFingerprints || [], String)),
  };
  const seed = `${studentId}|${practiceDate}|${plan.id}`;
  const selected = [];
  const picked = new Set();
  const templateCounts = new Map();
  const historyKey = (q) => `${q.module}|${q.template_key}`;
  const forcedAbility = Object.prototype.hasOwnProperty.call(options, 'abilitySnapshot')
    ? options.abilitySnapshot
    : undefined;
  const ability = forcedAbility !== undefined
    ? forcedAbility
    : resolvePracticeAbilitySnapshot(db, plan, studentId, practiceDate);
  const enhancedEnabled = Boolean(ability?.enhanced);
  const standardTarget = enhancedEnabled
    ? DAILY_QUESTION_COUNT - ENHANCED_QUESTION_COUNT
    : DAILY_QUESTION_COUNT;
  const enhancedTarget = enhancedEnabled ? ENHANCED_QUESTION_COUNT : 0;
  const standardPool = currentPool.filter((item) => Number(item.difficulty) === STANDARD_DIFFICULTY);
  const enhancedPool = currentPool.filter((item) => Number(item.difficulty) === ENHANCED_DIFFICULTY);
  const averageSeconds = (source, fallback) => source.length
    ? source.reduce((sum, item) => sum + Number(item.estimated_seconds || fallback), 0) / source.length
    : fallback;
  const standardAverage = enhancedTarget
    ? averageSeconds(standardPool, 90)
    : Math.max(averageSeconds(standardPool, 90), minSeconds / DAILY_QUESTION_COUNT);
  const enhancedAverage = averageSeconds(enhancedPool, 125);
  const rollingStandardDurationQuotas = (() => {
    const cycleDays = 15;
    const cycleQuestionCount = cycleDays * DAILY_QUESTION_COUNT;
    if (enhancedTarget || standardPool.length < cycleQuestionCount) return null;
    const cyclePool = [...standardPool]
      .sort((left, right) => Number(right.estimated_seconds || 90) - Number(left.estimated_seconds || 90))
      .slice(0, cycleQuestionCount);
    const cohorts = Array.from({ length: cycleDays }, (_, index) => ({
      index,
      count: 0,
      seconds: 0,
      quotas: new Map(),
    }));
    for (const question of cyclePool) {
      const seconds = Number(question.estimated_seconds || 90);
      const cohort = cohorts
        .filter((item) => item.count < DAILY_QUESTION_COUNT)
        .sort((left, right) => left.count - right.count
          || left.seconds - right.seconds
          || left.index - right.index)[0];
      if (!cohort) return null;
      cohort.count += 1;
      cohort.seconds += seconds;
      cohort.quotas.set(seconds, Number(cohort.quotas.get(seconds) || 0) + 1);
    }
    if (cohorts.some((cohort) => cohort.count !== DAILY_QUESTION_COUNT
      || cohort.seconds < minSeconds || cohort.seconds > maxSeconds)) return null;
    const planStart = new Date(`${plan.start_date}T00:00:00Z`);
    const currentDate = new Date(`${practiceDate}T00:00:00Z`);
    if (Number.isNaN(planStart.getTime()) || Number.isNaN(currentDate.getTime())) return null;
    const offset = Math.round((currentDate - planStart) / 86_400_000);
    const cohortIndex = ((offset % cycleDays) + cycleDays) % cycleDays;
    return cohorts[cohortIndex].quotas;
  })();

  const takeCount = (source, targetCount, tier, allowBatchReuse = false, relaxDurationQuota = false) => {
    const startCount = selected.length;
    const ordered = prioritizedQuestionPool(source, history, historyKey, `${seed}|${tier}`);
    const difficulty = tier.startsWith('enhanced') ? ENHANCED_DIFFICULTY : STANDARD_DIFFICULTY;
    const targetAverage = difficulty === ENHANCED_DIFFICULTY ? enhancedAverage : standardAverage;
    while (selected.length - startCount < targetCount) {
      const tierItems = selected.filter((item) => Number(item.difficulty) === difficulty);
      const tierSeconds = tierItems.reduce((sum, item) => sum + Number(item.estimated_seconds || 90), 0);
      const desiredCumulative = targetAverage * (tierItems.length + 1);
      let best = null;
      for (let candidateIndex = 0; candidateIndex < ordered.length; candidateIndex += 1) {
        const question = ordered[candidateIndex];
        if (picked.has(question.id)) continue;
        const fingerprint = questionFingerprint(question);
        if (recent.signatures.has(question.signature) || recent.fingerprints.has(fingerprint)) continue;
        if (!allowBatchReuse
            && (batchExcluded.signatures.has(question.signature)
              || batchExcluded.fingerprints.has(fingerprint))) continue;
        const template = historyKey(question);
        const used = templateCounts.get(template) || 0;
        if (used >= TEMPLATE_DAILY_CAP) continue;
        const questionSeconds = Number(question.estimated_seconds || targetAverage);
        if (!relaxDurationQuota && difficulty === STANDARD_DIFFICULTY && rollingStandardDurationQuotas) {
          const quota = Number(rollingStandardDurationQuotas.get(questionSeconds) || 0);
          const selectedAtDuration = tierItems.filter((item) => (
            Number(item.estimated_seconds || 90) === questionSeconds
          )).length;
          if (selectedAtDuration >= quota) continue;
        }
        const nextSeconds = tierSeconds + questionSeconds;
        const deviation = Math.abs(nextSeconds - desiredCumulative);
        if (!best || deviation < best.deviation
            || (deviation === best.deviation && candidateIndex < best.candidateIndex)) {
          best = { question, template, used, deviation, candidateIndex };
        }
      }
      if (!best) break;
      selected.push(best.question);
      picked.add(best.question.id);
      templateCounts.set(best.template, best.used + 1);
    }
    return selected.length - startCount;
  };

  const fillTier = (source, targetCount, tier) => {
    let added = takeCount(source, targetCount, tier, false);
    if (added < targetCount) added += takeCount(source, targetCount - added, `${tier}|batch-reuse`, true);
    if (added < targetCount && tier === 'standard' && rollingStandardDurationQuotas) {
      added += takeCount(source, targetCount - added, `${tier}|quota-relaxed`, false, true);
    }
    if (added < targetCount && tier === 'standard' && rollingStandardDurationQuotas) {
      added += takeCount(source, targetCount - added, `${tier}|all-relaxed`, true, true);
    }
    if (added !== targetCount) throw new Error(`${tier === 'enhanced' ? '加强' : '普通'}题库不足 ${targetCount} 题`);
  };

  fillTier(standardPool, standardTarget, 'standard');
  if (enhancedTarget) fillTier(enhancedPool, enhancedTarget, 'enhanced');

  const rebalanceSelectedSeconds = () => {
    let total = selected.reduce((sum, question) => sum + Number(question.estimated_seconds || 90), 0);
    if (total >= minSeconds && total <= maxSeconds) return total;
    const candidates = prioritizedQuestionPool(currentPool, history, historyKey, `${seed}|time-balance`);
    const tupleLess = (left, right) => left.some((value, index) => (
      value < right[index] && left.slice(0, index).every((part, partIndex) => part === right[partIndex])
    ));
    for (let attempt = 0; attempt < DAILY_QUESTION_COUNT * 4; attempt += 1) {
      if (total >= minSeconds && total <= maxSeconds) break;
      const direction = total < minSeconds ? 1 : -1;
      let best = null;
      for (const allowBatchReuse of [false, true]) {
        for (let selectedIndex = 0; selectedIndex < selected.length; selectedIndex += 1) {
          const current = selected[selectedIndex];
          const currentSeconds = Number(current.estimated_seconds || 90);
          const currentTemplate = historyKey(current);
          for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
            const candidate = candidates[candidateIndex];
            if (picked.has(candidate.id) || Number(candidate.difficulty) !== Number(current.difficulty)) continue;
            const candidateSeconds = Number(candidate.estimated_seconds || 90);
            const delta = candidateSeconds - currentSeconds;
            if ((direction > 0 && delta <= 0) || (direction < 0 && delta >= 0)) continue;
            const nextTotal = total + delta;
            if (nextTotal < minSeconds && direction < 0) continue;
            if (nextTotal > maxSeconds && direction > 0) continue;
            const fingerprint = questionFingerprint(candidate);
            if (recent.signatures.has(candidate.signature) || recent.fingerprints.has(fingerprint)) continue;
            if (!allowBatchReuse
                && (batchExcluded.signatures.has(candidate.signature)
                  || batchExcluded.fingerprints.has(fingerprint))) continue;
            const candidateTemplate = historyKey(candidate);
            if (candidateTemplate !== currentTemplate
                && Number(templateCounts.get(candidateTemplate) || 0) >= TEMPLATE_DAILY_CAP) continue;
            const boundaryDistance = nextTotal < minSeconds
              ? minSeconds - nextTotal
              : nextTotal > maxSeconds
                ? nextTotal - maxSeconds
                : 0;
            const score = [boundaryDistance, Math.abs(nextTotal - targetSeconds), selectedIndex, candidateIndex];
            if (!best || tupleLess(score, best.score)) {
              best = { candidate, current, selectedIndex, nextTotal, score };
            }
          }
        }
        if (best) break;
      }
      if (!best) break;
      const currentTemplate = historyKey(best.current);
      const candidateTemplate = historyKey(best.candidate);
      picked.delete(best.current.id);
      picked.add(best.candidate.id);
      if (candidateTemplate !== currentTemplate) {
        templateCounts.set(currentTemplate, Math.max(0, Number(templateCounts.get(currentTemplate) || 0) - 1));
        templateCounts.set(candidateTemplate, Number(templateCounts.get(candidateTemplate) || 0) + 1);
      }
      selected[best.selectedIndex] = best.candidate;
      total = best.nextTotal;
    }
    return total;
  };

  const selectedSeconds = rebalanceSelectedSeconds();
  if (selected.length !== DAILY_QUESTION_COUNT || selectedSeconds < minSeconds || selectedSeconds > maxSeconds) {
    throw new Error(`题单必须为 ${DAILY_QUESTION_COUNT} 题且保持 18-22 分钟（${practiceDate} 实际 ${selectedSeconds} 秒）`);
  }

  const wrongSelected = selected.filter((question) => history.wrong.has(historyKey(question)));
  const masteredSelected = selected.filter((question) => history.mastered.has(historyKey(question))
    && !history.wrong.has(historyKey(question)));

  return {
    questions: selected,
    meta: {
      version: 'adaptive-v2',
      policy_version: 'adaptive-v2',
      target_seconds: targetSeconds,
      actual_seconds: selectedSeconds,
      current_module: setting.current_module,
      wrong_templates: history.wrong.size,
      selected_wrong_review: wrongSelected.length,
      selected_wrong_seconds: wrongSelected.reduce((sum, item) => sum + Number(item.estimated_seconds || 90), 0),
      selected_mastered_review: masteredSelected.length,
      selected_mastered_seconds: masteredSelected.reduce((sum, item) => sum + Number(item.estimated_seconds || 90), 0),
      selected_current: selected.length - wrongSelected.length - masteredSelected.length,
      standard_target_count: standardTarget,
      standard_selected_count: selected.filter((item) => Number(item.difficulty) === STANDARD_DIFFICULTY).length,
      enhanced_target_count: enhancedTarget,
      enhanced_selected_count: selected.filter((item) => Number(item.difficulty) === ENHANCED_DIFFICULTY).length,
      ability_source_assignment_id: ability?.source_assignment_id || null,
      ability_source_date: ability?.source_date || null,
      ability_wrong_count: ability ? Number(ability.wrong_count) : null,
      ability_review_round: ability?.review_round || null,
      mastered_interval_days: history.intervalDays,
      recent_exclusion_days: 14,
      semantic_recent_exclusion: true,
      template_daily_cap: TEMPLATE_DAILY_CAP,
      selected_guangzhou: selected.filter((question) => question.source_region === '广州').length,
    },
  };
}

function ensureStudentSetting(db, plan, studentId) {
  db.run(`INSERT OR IGNORE INTO practice_student_settings
    (plan_id,student_id,current_module,difficulty,auto_advance,is_locked)
    VALUES(?,?,?,?,0,1)`, [plan.id, studentId, FIXED_MODULE, FIXED_DIFFICULTY]);
  db.run(`UPDATE practice_student_settings
    SET current_module=?,difficulty=?,auto_advance=0,is_locked=1,updated_at=CURRENT_TIMESTAMP
    WHERE plan_id=? AND student_id=?`, [FIXED_MODULE, FIXED_DIFFICULTY, plan.id, studentId]);
  return db.get('SELECT * FROM practice_student_settings WHERE plan_id=? AND student_id=?', [plan.id, studentId]);
}

function saveAdaptiveAssignmentItems(db, assignmentId, questions) {
  questions.forEach((question, index) => {
    db.run(`INSERT INTO practice_assignment_items
      (assignment_id,question_id,position,snapshot_stem,snapshot_answer,snapshot_module,snapshot_type,
       snapshot_difficulty,estimated_seconds,signature,template_key)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
      assignmentId, question.id, index + 1, question.stem, question.answer, question.module,
      question.question_type, question.difficulty, question.estimated_seconds, question.signature, question.template_key,
    ]);
  });
}

function createAdaptiveAssignment(db, plan, studentId, practiceDate, options = {}) {
  const setting = ensureStudentSetting(db, plan, studentId);
  const selection = selectQuestions(db, plan, setting, studentId, practiceDate, options);
  const estimated = selection.questions.reduce((sum, question) => (
    sum + Number(question.estimated_seconds || 90)
  ), 0);
  const created = db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta,assignment_source)
    VALUES(?,?,?,?,?,?,'adaptive')`, [
    plan.id, studentId, practiceDate, 'ready', estimated, JSON.stringify(selection.meta),
  ]);
  saveAdaptiveAssignmentItems(db, created.lastInsertRowid, selection.questions);
  return db.get('SELECT * FROM practice_assignments WHERE id=?', [created.lastInsertRowid]);
}

function generateAssignment(db, plan, studentId, practiceDate, options = {}) {
  const existing = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
    studentId, practiceDate,
  ]);
  // PDF 锁定是永久快照，后续即使导入了专属课程也不能静默覆盖。
  if (existing && Number(existing.is_frozen)) return existing;
  const curriculumAssignment = generateStudentCurriculumAssignment(db, studentId, practiceDate);
  if (curriculumAssignment) return curriculumAssignment;
  if (existing) return existing;
  try {
    return db.transaction(() => {
      const repeated = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
        studentId, practiceDate,
      ]);
      if (repeated) return repeated;
      return createAdaptiveAssignment(db, plan, studentId, practiceDate, options);
    });
  } catch (error) {
    const concurrent = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
      studentId, practiceDate,
    ]);
    if (concurrent) return concurrent;
    throw error;
  }
}

function adaptiveRebuildLockReason(db, assignment, plan) {
  if (!assignment) return '';
  if (Number(assignment.plan_id) !== Number(plan.id)) return 'different_plan';
  if (assignment.assignment_source !== 'adaptive') return 'assignment_source';
  if (Number(assignment.is_frozen)) return 'frozen';
  if (assignment.claimed_at) return 'claimed';
  if (String(assignment.status) !== 'ready') return 'status';
  if (db.get('SELECT 1 locked FROM practice_submissions WHERE assignment_id=? LIMIT 1', [assignment.id])) {
    return 'submission';
  }
  return '';
}

function rebuildAdaptiveAssignment(db, plan, studentId, practiceDate, options = {}) {
  return db.transaction(() => {
    const assignment = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
      studentId, practiceDate,
    ]);
    if (!assignment) {
      const created = generateAssignment(db, plan, studentId, practiceDate, options);
      return { assignment: created, created: true, rebuilt: false, reason: 'created' };
    }
    const lockReason = adaptiveRebuildLockReason(db, assignment, plan);
    if (lockReason) {
      return { assignment, created: false, rebuilt: false, reason: lockReason };
    }
    const setting = ensureStudentSetting(db, plan, studentId);
    const selection = selectQuestions(db, plan, setting, studentId, practiceDate, options);
    const estimated = selection.questions.reduce((sum, question) => (
      sum + Number(question.estimated_seconds || 90)
    ), 0);
    db.run('DELETE FROM practice_assignment_items WHERE assignment_id=?', [assignment.id]);
    db.run(`UPDATE practice_assignments SET status='ready',estimated_seconds=?,selection_meta=?
      WHERE id=?`, [estimated, JSON.stringify(selection.meta), assignment.id]);
    saveAdaptiveAssignmentItems(db, assignment.id, selection.questions);
    return {
      assignment: db.get('SELECT * FROM practice_assignments WHERE id=?', [assignment.id]),
      created: false,
      rebuilt: true,
      reason: 'rebuilt',
    };
  });
}

function assignmentQuestionExclusions(db, assignmentId) {
  const rows = db.all(`SELECT signature,snapshot_stem,snapshot_answer
    FROM practice_assignment_items WHERE assignment_id=?`, [assignmentId]);
  return {
    signatures: rows.map((row) => String(row.signature)),
    fingerprints: rows.map(questionFingerprint),
  };
}

function frozenAbilityFromAssignments(assignments) {
  for (const assignment of assignments) {
    const meta = parseJson(assignment.selection_meta, {});
    if (meta.policy_version !== 'adaptive-v2' || !meta.ability_source_assignment_id) continue;
    const wrongCount = Number(meta.ability_wrong_count || 0);
    return {
      source_assignment_id: Number(meta.ability_source_assignment_id),
      source_date: meta.ability_source_date,
      wrong_count: wrongCount,
      review_round: Number(meta.ability_review_round || 1),
      enhanced: wrongCount < 2,
    };
  }
  return null;
}

function freezeManifestAbility(manifest) {
  if (!manifest || manifest.ability_wrong_count === null || manifest.ability_wrong_count === undefined) {
    return null;
  }
  const wrongCount = Number(manifest.ability_wrong_count);
  return {
    source_assignment_id: manifest.ability_source_assignment_id
      ? Number(manifest.ability_source_assignment_id)
      : null,
    source_date: manifest.ability_source_date || null,
    wrong_count: wrongCount,
    review_round: Number(manifest.ability_review_round || 1),
    enhanced: wrongCount < 2,
  };
}

function studentPdfFreezeState(db, plan, studentId) {
  const manifest = db.get(`SELECT * FROM practice_pdf_freezes
    WHERE plan_id=? AND student_id=?`, [plan.id, studentId]);
  const rows = db.all(`SELECT practice_date,frozen_at FROM practice_assignments
    WHERE plan_id=? AND student_id=? AND is_frozen=1 AND freeze_source='pdf_remaining'
    ORDER BY practice_date,id`, [plan.id, studentId]);
  const expectedDates = manifest
    ? dateRange(String(manifest.from_date), String(manifest.through_date), 31)
    : [];
  const actualDates = new Set(rows.map((row) => String(row.practice_date)));
  const missingDates = expectedDates.filter((date) => !actualDates.has(date));
  const complete = Boolean(manifest && expectedDates.length > 0 && missingDates.length === 0);
  return {
    pdf_frozen: complete,
    pdf_freeze_incomplete: Boolean(manifest || rows.length) && !complete,
    frozen_assignment_count: rows.length,
    expected_frozen_assignment_count: expectedDates.length,
    missing_frozen_dates: missingDates,
    frozen_from_date: manifest?.from_date || rows[0]?.practice_date || null,
    frozen_to_date: manifest?.through_date || rows[rows.length - 1]?.practice_date || null,
    frozen_at: manifest?.created_at || rows.reduce((latest, row) => (
      String(row.frozen_at || '') > String(latest || '') ? row.frozen_at : latest
    ), null),
    freeze_ability: freezeManifestAbility(manifest),
  };
}

function freezeStudentPracticeAssignments(db, plan, studentId, options = {}) {
  return db.transaction(() => {
    const requestedStart = String(options.fromDate || practiceDateAt());
    let manifest = db.get(`SELECT * FROM practice_pdf_freezes
      WHERE plan_id=? AND student_id=?`, [plan.id, studentId]);
    if (!manifest) {
      const legacyFrozen = db.all(`SELECT * FROM practice_assignments
        WHERE plan_id=? AND student_id=? AND is_frozen=1 AND freeze_source='pdf_remaining'
        ORDER BY practice_date,id`, [plan.id, studentId]);
      const startDate = legacyFrozen[0]?.practice_date
        || (requestedStart < plan.start_date ? plan.start_date : requestedStart);
      const plannedDates = dateRange(startDate, plan.end_date, 31);
      if (!plannedDates.length) {
        return {
          assignments: [], frozen_count: 0, dates: [], ability: null,
          from_date: startDate, through_date: plan.end_date, already_frozen: true,
        };
      }
      const initialAbility = legacyFrozen.length
        ? frozenAbilityFromAssignments(legacyFrozen)
        : resolvePracticeAbilitySnapshot(db, plan, studentId, datePlus(startDate, 1));
      db.run(`INSERT OR IGNORE INTO practice_pdf_freezes
        (plan_id,student_id,from_date,through_date,ability_source_assignment_id,
         ability_source_date,ability_wrong_count,ability_review_round,frozen_by)
        VALUES(?,?,?,?,?,?,?,?,?)`, [
        plan.id,
        studentId,
        plannedDates[0],
        plannedDates[plannedDates.length - 1],
        initialAbility?.source_assignment_id || null,
        initialAbility?.source_date || null,
        initialAbility ? Number(initialAbility.wrong_count) : null,
        initialAbility?.review_round || null,
        options.actorId || null,
      ]);
      manifest = db.get(`SELECT * FROM practice_pdf_freezes
        WHERE plan_id=? AND student_id=?`, [plan.id, studentId]);
    }
    const dates = dateRange(String(manifest.from_date), String(manifest.through_date), 31);
    const ability = freezeManifestAbility(manifest);
    const existingRows = db.all(`SELECT a.*,
        EXISTS(SELECT 1 FROM practice_submissions ps WHERE ps.assignment_id=a.id) has_submission
      FROM practice_assignments a
      WHERE a.student_id=? AND a.practice_date>=? AND a.practice_date<=?
      ORDER BY a.practice_date,a.id`, [studentId, dates[0], dates[dates.length - 1]]);
    const existingByDate = new Map(existingRows.map((assignment) => [String(assignment.practice_date), assignment]));
    const alreadyFrozen = dates.every((date) => {
      const assignment = existingByDate.get(date);
      return assignment && Number(assignment.is_frozen) && assignment.freeze_source === 'pdf_remaining';
    });
    if (alreadyFrozen) {
      const assignments = dates.map((date) => existingByDate.get(date));
      return {
        assignments,
        frozen_count: assignments.length,
        dates,
        ability,
        from_date: dates[0],
        through_date: dates[dates.length - 1],
        already_frozen: true,
      };
    }

    const excludedSignatures = new Set();
    const excludedFingerprints = new Set();
    const remember = (assignment) => {
      const exclusions = assignmentQuestionExclusions(db, assignment.id);
      exclusions.signatures.forEach((value) => excludedSignatures.add(value));
      exclusions.fingerprints.forEach((value) => excludedFingerprints.add(value));
    };
    // 先保留所有不可重建快照，随后生成的日期主动避开这些题目。
    existingRows.filter((assignment) => adaptiveRebuildLockReason(db, assignment, plan))
      .forEach(remember);

    const assignments = [];
    for (const date of dates) {
      let assignment = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
        studentId, date,
      ]);
      const lockReason = adaptiveRebuildLockReason(db, assignment, plan);
      if (lockReason === 'different_plan') {
        throw new Error(`${date} 已由其他打卡计划占用，不能锁定当前计划`);
      }
      if (!assignment || !lockReason) {
        const outcome = rebuildAdaptiveAssignment(db, plan, studentId, date, {
          abilitySnapshot: ability,
          excludedSignatures,
          excludedFingerprints,
        });
        assignment = outcome.assignment;
      }
      if (Number(assignment.plan_id) !== Number(plan.id)) {
        throw new Error(`${date} 已由其他打卡计划占用，不能锁定当前计划`);
      }
      if (!Number(assignment.is_frozen) || assignment.freeze_source !== 'pdf_remaining') {
        db.run(`UPDATE practice_assignments SET is_frozen=1,frozen_at=CURRENT_TIMESTAMP,
          freeze_source='pdf_remaining',frozen_by=? WHERE id=?`, [
          options.actorId || null, assignment.id,
        ]);
        assignment = db.get('SELECT * FROM practice_assignments WHERE id=?', [assignment.id]);
      }
      assignments.push(assignment);
      remember(assignment);
    }
    return {
      assignments,
      frozen_count: assignments.length,
      dates,
      ability,
      from_date: dates[0],
      through_date: dates[dates.length - 1],
      already_frozen: false,
    };
  });
}

function preGenerateDate(db, practiceDate) {
  const plans = db.all(`SELECT * FROM practice_plans
    WHERE status='published' AND start_date<=? AND end_date>=?`, [practiceDate, practiceDate]);
  let generated = 0;
  let replaced = 0;
  const curriculumStudents = new Set();
  db.transaction(() => {
    const curriculumDays = db.all(`SELECT d.student_id,c.plan_id
      FROM practice_student_curriculum_days d
      JOIN practice_student_curricula c ON c.id=d.curriculum_id
      WHERE d.practice_date=? AND c.status='active'
      ORDER BY d.student_id`, [practiceDate]);
    for (const day of curriculumDays) {
      const before = db.get('SELECT id,assignment_source,curriculum_day_id FROM practice_assignments WHERE student_id=? AND practice_date=?', [
        day.student_id, practiceDate,
      ]);
      generateStudentCurriculumAssignment(db, day.student_id, practiceDate);
      curriculumStudents.add(Number(day.student_id));
      if (!before) generated++;
      else if (before.assignment_source !== STUDENT_CURRICULUM_SOURCE) replaced++;
    }
    for (const plan of plans) {
      const students = db.all('SELECT id FROM students WHERE class_id=? AND deleted_at IS NULL', [plan.class_id]);
      for (const student of students) {
        if (curriculumStudents.has(Number(student.id))) continue;
        const before = db.get('SELECT id FROM practice_assignments WHERE student_id=? AND practice_date=?', [student.id, practiceDate]);
        generateAssignment(db, plan, student.id, practiceDate);
        if (!before) generated++;
      }
    }
  });
  return { plans: plans.length, curricula: curriculumStudents.size, generated, replaced };
}

function evaluateProgression(db, planId, studentId, sourcePracticeDate = '') {
  const plan = db.get('SELECT * FROM practice_plans WHERE id=?', [planId]);
  if (!plan) return { advanced: false, reason: 'plan_missing' };
  let sourceDate = String(sourcePracticeDate || '');
  if (!sourceDate) {
    sourceDate = resolvePracticeAbilitySnapshot(db, plan, studentId, '9999-12-31')?.source_date || '';
  }
  const nextDate = sourceDate ? datePlus(sourceDate, 1) : '';
  if (!nextDate || nextDate < plan.start_date || nextDate > plan.end_date) {
    return { advanced: false, reason: 'no_next_plan_date', next_date: nextDate || null };
  }
  const existing = db.get(`SELECT id,plan_id FROM practice_assignments
    WHERE student_id=? AND practice_date=?`, [studentId, nextDate]);
  if (!existing) {
    return { advanced: false, reason: 'adaptive_next_day_pending', next_date: nextDate };
  }
  if (Number(existing.plan_id) !== Number(plan.id)) {
    return { advanced: false, reason: 'adaptive_next_day_other_plan', next_date: nextDate };
  }
  let outcome;
  try {
    outcome = rebuildAdaptiveAssignment(db, plan, studentId, nextDate);
  } catch (error) {
    return {
      advanced: false,
      reason: 'adaptive_next_day_unavailable',
      next_date: nextDate,
      error: String(error?.message || error).slice(0, 160),
    };
  }
  return {
    advanced: false,
    reason: outcome.reason === 'rebuilt' || outcome.reason === 'created'
      ? 'adaptive_next_day_refreshed'
      : `adaptive_next_day_${outcome.reason}`,
    next_date: nextDate,
    rebuilt: Boolean(outcome.rebuilt),
    created: Boolean(outcome.created),
  };
}

function practiceItemIds(db, assignmentId) {
  return db.all(`SELECT id FROM practice_assignment_items
    WHERE assignment_id=? ORDER BY position`, [assignmentId])
    .map((item) => Number(item.id));
}

function practiceRoundReviewItemIds(db, submissionId, roundNo, isCorrect = null) {
  const correctSql = isCorrect === null ? '' : ' AND is_correct=?';
  const params = isCorrect === null
    ? [submissionId, roundNo]
    : [submissionId, roundNo, isCorrect ? 1 : 0];
  return db.all(`SELECT assignment_item_id FROM practice_review_rounds
    WHERE submission_id=? AND round_no=?${correctSql}
    ORDER BY assignment_item_id`, params)
    .map((item) => Number(item.assignment_item_id));
}

function practiceFocusItemIds(db, submission) {
  const roundNo = Math.max(1, Number(submission.current_round || 1));
  if (submission.status === 'reviewed') return [];
  if (submission.status === 'correction_required') {
    return practiceRoundReviewItemIds(db, submission.id, roundNo, false);
  }
  if (roundNo === 1) return practiceItemIds(db, submission.assignment_id);
  return practiceRoundReviewItemIds(db, submission.id, roundNo - 1, false);
}

function practiceVisibleItemIds(db, submission) {
  if (submission.status !== 'reviewed') return practiceFocusItemIds(db, submission);
  return practiceRoundReviewItemIds(
    db,
    submission.id,
    Math.max(1, Number(submission.current_round || 1)),
  );
}

function publicPracticeAttachment(file) {
  const roundNo = Math.max(1, Number(file.round_no || 1));
  return {
    id: Number(file.id),
    token: file.token,
    mime_type: file.mime_type,
    byte_size: Number(file.byte_size || 0),
    created_at: file.created_at,
    round_no: roundNo,
    is_correction: roundNo > 1,
    url: `/api/private-files/${file.token}`,
  };
}

function serializePracticeSubmission(db, submission, { includeRounds = true } = {}) {
  if (!submission) return null;
  const roundNo = Math.max(1, Number(submission.current_round || 1));
  const allAttachments = db.all(`SELECT pa.id,pa.round_no,pa.created_at,
      pf.token,pf.mime_type,pf.byte_size
    FROM practice_attachments pa JOIN private_files pf ON pf.id=pa.file_id
    WHERE pa.submission_id=? ORDER BY pa.round_no,pa.created_at,pa.id`, [submission.id])
    .map(publicPracticeAttachment);
  // 待订正时顶层列表代表下一轮正在暂存的照片；尚未上传时仍为空，
  // 既兼容旧家长端继续上传，也让新版家长端能显示“确认提交”。
  const uploadRound = submission.status === 'correction_required' ? roundNo + 1 : roundNo;
  const currentAttachments = allAttachments.filter((file) => file.round_no === uploadRound);
  const focusItemIds = practiceFocusItemIds(db, submission);
  const result = {
    ...submission,
    current_round: roundNo,
    correction_round: roundNo,
    upload_round: uploadRound,
    is_correction: roundNo > 1,
    needs_correction: submission.status === 'correction_required' || Boolean(Number(submission.needs_correction)),
    focus_item_ids: focusItemIds,
    attachments: currentAttachments,
    attachment_count: currentAttachments.length,
    total_attachment_count: allAttachments.length,
  };
  if (!includeRounds) return result;
  const roundRows = db.all(`SELECT * FROM practice_submission_rounds
    WHERE submission_id=? ORDER BY round_no`, [submission.id]);
  const knownRounds = new Map(roundRows.map((round) => [
    Math.max(1, Number(round.round_no || 1)),
    round,
  ]));
  for (const file of allAttachments) {
    if (!knownRounds.has(file.round_no)) {
      knownRounds.set(file.round_no, {
        round_no: file.round_no,
        status: 'uploading',
        teacher_note: null,
        submitted_at: null,
        reviewed_at: null,
      });
    }
  }
  result.rounds = [...knownRounds.values()]
    .sort((a, b) => Number(a.round_no) - Number(b.round_no))
    .map((round) => {
    const value = Math.max(1, Number(round.round_no || 1));
    return {
      round_no: value,
      is_correction: value > 1,
      status: round.status,
      teacher_note: round.teacher_note,
      submitted_at: round.submitted_at,
      reviewed_at: round.reviewed_at,
      wrong_item_ids: practiceRoundReviewItemIds(db, submission.id, value, false),
      attachments: allAttachments.filter((file) => file.round_no === value),
    };
    });
  return result;
}

let fontRanges;
function loadFontRanges() {
  if (fontRanges) return fontRanges;
  const packageDir = path.dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
  const unicode = JSON.parse(fs.readFileSync(path.join(packageDir, 'unicode.json'), 'utf8'));
  fontRanges = Object.entries(unicode).map(([key, value]) => ({
    subset: key.replace(/[\[\]]/g, ''),
    ranges: value.split(',').map((part) => {
      const [start, end] = part.replace(/^U\+/, '').split('-').map((hex) => parseInt(hex, 16));
      return [start, end || start];
    }),
    packageDir,
  }));
  return fontRanges;
}

function fontForCharacter(character) {
  const configured = process.env.PRACTICE_PDF_FONT;
  if (configured && fs.existsSync(configured)) return configured;
  const code = character.codePointAt(0);
  const ranges = loadFontRanges();
  const matched = ranges.find((entry) => entry.ranges.some(([start, end]) => code >= start && code <= end));
  const subset = matched?.subset || 'latin';
  return path.join(ranges[0].packageDir, 'files', `noto-sans-sc-${subset}-400-normal.woff`);
}

function writePdfText(doc, value, options = {}) {
  const width = options.characters || 38;
  const chars = Array.from(String(value || ''));
  const lines = [];
  for (let i = 0; i < chars.length; i += width) lines.push(chars.slice(i, i + width));
  if (!lines.length) lines.push([]);
  for (const line of lines) {
    const runs = [];
    for (const character of line) {
      const font = fontForCharacter(character);
      const last = runs[runs.length - 1];
      if (last?.font === font) last.text += character;
      else runs.push({ font, text: character });
    }
    if (!runs.length) {
      doc.moveDown(0.7);
      continue;
    }
    runs.forEach((run, index) => {
      doc.font(run.font).fontSize(options.size || 11).fillColor(options.color || '#183A36')
        .text(run.text, { continued: index < runs.length - 1, lineGap: options.lineGap || 3 });
    });
  }
}

function drawResolvedPracticeMath(doc, item, kind, options = {}) {
  const x = Number(options.x ?? doc.x);
  const y = Number(options.y ?? doc.y);
  const layout = drawPracticePdfBlocks(doc, resolvePracticePdfBlocks(item, kind), {
    x,
    y,
    width: Number(options.width || (doc.page.width - x - doc.page.margins.right)),
    fontSize: Number(options.fontSize || 10),
    minFontSize: Number(options.minFontSize || options.fontSize || 10),
    maxHeight: Number(options.maxHeight || 0),
    lineGap: Number(options.lineGap ?? 2),
    prefix: options.prefix || '',
    color: options.color || '#183A36',
    fontForCharacter,
  });
  doc.x = x;
  doc.y = y + layout.height;
  return layout;
}

function loadPracticePdfItems(db, assignmentId) {
  return db.all(`SELECT position,snapshot_stem,snapshot_answer,snapshot_payload
    FROM practice_assignment_items WHERE assignment_id=? ORDER BY position`, [assignmentId]);
}

function practiceAnswerCardHeight(itemCount, columns = 5) {
  return 34 + Math.max(1, Math.ceil(Math.max(0, itemCount) / columns)) * 34;
}

function drawPracticeAnswerDay(doc, assignment, dayIndex, options = {}) {
  const x = Number(options.x || 42);
  const width = Number(options.width || 511);
  const columns = Number(options.columns || 5);
  const top = Number(options.y ?? doc.y);
  const rows = Math.max(1, Math.ceil(assignment.items.length / columns));
  const height = practiceAnswerCardHeight(assignment.items.length, columns);
  const background = dayIndex % 2 ? '#F7FAF8' : '#FCF7EE';
  doc.roundedRect(x, top, width, height, 7).fill(background);
  drawPracticePdfBlocks(doc, [{ type: 'text', value: `${assignment.date}（第${dayIndex + 1}天）` }], {
    x: x + 10,
    y: top + 7,
    width: width - 20,
    fontSize: 9.5,
    minFontSize: 9.5,
    color: '#2F7D6B',
    fontForCharacter,
  });
  const gap = 4;
  const cellWidth = (width - 20 - gap * (columns - 1)) / columns;
  assignment.items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawResolvedPracticeMath(doc, item, 'answer', {
      x: x + 10 + column * (cellWidth + gap),
      y: top + 32 + row * 34,
      width: cellWidth,
      maxHeight: 29,
      fontSize: 8.8,
      minFontSize: 6.8,
      lineGap: 1,
      prefix: `${item.position}. `,
      color: '#243D38',
    });
  });
  doc.x = x;
  doc.y = top + height + 8;
  return { height, rows };
}

function generateLegacyPlanPdf(db, plan, response, requestedStart = plan.start_date) {
  const start = requestedStart < plan.start_date ? plan.start_date : requestedStart;
  const fifth = new Date(`${start}T00:00:00Z`);
  fifth.setUTCDate(fifth.getUTCDate() + 4);
  const end = fifth.toISOString().slice(0, 10) > plan.end_date ? plan.end_date : fifth.toISOString().slice(0, 10);
  const dates = dateRange(start, end, 5);
  const students = db.all('SELECT id,name FROM students WHERE class_id=? AND deleted_at IS NULL ORDER BY name', [plan.class_id]);
  db.transaction(() => {
    for (const date of dates) for (const student of students) generateAssignment(db, plan, student.id, date);
  });

  const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `${plan.title}-五日打卡` } });
  response.type('application/pdf');
  response.set('Content-Disposition', `attachment; filename="practice-plan-${plan.id}.pdf"`);
  response.set('Cache-Control', 'private, no-store');
  doc.pipe(response);
  writePdfText(doc, `${plan.title} · 初中计算打卡`, { size: 18, characters: 28 });
  const topicLabel = normalizeTopicKeys(plan.topic_keys, plan.grade_code).map((key) => TOPICS[key].label).join(' · ');
  writePdfText(doc, `${dates[0]} 至 ${dates[dates.length - 1]}｜${topicLabel}`, { size: 10, color: '#536762' });

  students.forEach((student) => {
    dates.forEach((date) => {
      doc.addPage();
      writePdfText(doc, `${student.name}｜${date}｜约20分钟`, { size: 16, characters: 30 });
      const assignment = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [student.id, date]);
      const items = loadPracticePdfItems(db, assignment.id);
      items.forEach((item) => {
        if (doc.y + 58 > 752) {
          doc.addPage();
          writePdfText(doc, `${student.name}｜${date}｜练习续页`, { size: 14, characters: 30 });
        }
        const top = doc.y + 5;
        drawResolvedPracticeMath(doc, item, 'question', {
          x: 44,
          y: top,
          width: 507,
          maxHeight: 46,
          fontSize: 10.5,
          minFontSize: 8,
          lineGap: 2,
          prefix: `${item.position}. `,
        });
        doc.y += 7;
      });
    });
  });

  doc.addPage();
  writePdfText(doc, '教师参考答案', { size: 18, characters: 30 });
  writePdfText(doc, '以下内容位于整份练习末尾，请勿随学生练习页一同发放。', { size: 10, color: '#697B76' });
  students.forEach((student) => {
    doc.addPage();
    writePdfText(doc, `${student.name}｜参考答案（教师版）`, { size: 16, characters: 30 });
    dates.forEach((date, dateIndex) => {
      const assignment = db.get('SELECT id FROM practice_assignments WHERE student_id=? AND practice_date=?', [student.id, date]);
      const items = loadPracticePdfItems(db, assignment.id);
      const cardHeight = practiceAnswerCardHeight(items.length);
      if (doc.y + cardHeight > 752) {
        doc.addPage();
        writePdfText(doc, `${student.name}｜参考答案（续）`, { size: 16, characters: 30 });
      }
      drawPracticeAnswerDay(doc, { date, items }, dateIndex, { y: doc.y + 5 });
    });
  });
  writePdfText(doc, '题目来源：项目自编参数化题库，不复制教材或真题。答案仅供教师核对。', { size: 9, color: '#697B76' });
  doc.end();
}

function preferredPracticeAvatar() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const candidates = [
    path.join(projectRoot, 'static', 'brand', 'panpan-feedback-color-v1.png'),
    path.join(projectRoot, 'static', 'brand', 'panpan-feedback-color-v1.jpg'),
    path.join(projectRoot, 'static', 'brand', 'panpan-feedback-line.jpg'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function drawPracticePdfHeader(doc, { studentName, date, dateRangeText, topicLabel, dayIndex, avatarPath }) {
  doc.rect(0, 0, doc.page.width, 112).fill('#173A35');
  doc.rect(0, 112, doc.page.width, 6).fill('#B9DDD2');
  if (avatarPath) {
    try {
      doc.save().roundedRect(487, 24, 64, 64, 16).clip().image(avatarPath, 487, 24, {
        width: 64, height: 64, fit: [64, 64], align: 'center', valign: 'center',
      }).restore();
    } catch {}
  }
  doc.x = 42;
  doc.y = 27;
  writePdfText(doc, `${studentName}定制计算打卡`, { size: 17, color: '#FFFFFF', characters: 25, lineGap: 1 });
  doc.x = 42;
  doc.y = 67;
  writePdfText(doc, `潘潘老师｜${dateRangeText}｜${topicLabel}`, { size: 8.5, color: '#CDE7DF', characters: 52, lineGap: 1 });
  doc.x = 42;
  doc.y = 139;
  writePdfText(doc, `${date}　DAY ${String(dayIndex).padStart(2, '0')}　约20分钟`, {
    size: 12, color: '#2F7D6B', characters: 42, lineGap: 1,
  });
  doc.moveTo(42, 168).lineTo(553, 168).lineWidth(0.7).strokeColor('#D9E4DF').stroke();
  doc.x = 42;
  doc.y = 185;
}

function writePracticeFooter(doc, text, pageNumber) {
  doc.save();
  doc.moveTo(42, 770).lineTo(553, 770).lineWidth(0.6).strokeColor('#D9E4DF').stroke();
  doc.x = 42;
  doc.y = 780;
  writePdfText(doc, text, { size: 7.5, color: '#73837E', characters: 45, lineGap: 0 });
  doc.font(fontForCharacter(String(pageNumber))).fontSize(8).fillColor('#73837E')
    .text(String(pageNumber), 515, 780, { width: 38, align: 'right', lineBreak: false });
  doc.restore();
}

function drawPracticeQuestionColumn(doc, items, x, rowPitch, width = 243) {
  items.forEach((item, index) => {
    const y = 188 + index * rowPitch;
    drawResolvedPracticeMath(doc, item, 'question', {
      x,
      y,
      width,
      maxHeight: Math.max(28, rowPitch - 8),
      fontSize: 10.2,
      minFontSize: 7.2,
      lineGap: 2,
      prefix: `${item.position}. `,
    });
  });
}

function generateStudentPlanPdf(db, plan, student, response) {
  const freezeState = studentPdfFreezeState(db, plan, student.id);
  if (!freezeState.pdf_frozen) {
    throw new Error(freezeState.pdf_freeze_incomplete
      ? '已锁定题单不完整，暂不能生成 PDF'
      : '请先生成并锁定剩余日期题单');
  }
  const frozenAssignments = db.all(`SELECT id,practice_date FROM practice_assignments
    WHERE plan_id=? AND student_id=? AND is_frozen=1 AND freeze_source='pdf_remaining'
      AND practice_date>=? AND practice_date<=?
    ORDER BY practice_date,id`, [
    plan.id,
    student.id,
    freezeState.frozen_from_date,
    freezeState.frozen_to_date,
  ]);
  const assignments = frozenAssignments.map((assignment) => ({
    date: String(assignment.practice_date),
    items: loadPracticePdfItems(db, assignment.id),
  }));
  const dates = assignments.map((assignment) => assignment.date);
  const topicLabel = normalizeTopicKeys(plan.topic_keys, plan.grade_code).map((key) => TOPICS[key].label).join(' · ');
  const dateRangeText = `${dates[0]}至${dates[dates.length - 1]}`;
  const title = `${student.name}定制计算打卡`;
  const avatarPath = preferredPracticeAvatar();
  const doc = new PDFDocument({
    size: 'A4',
    margin: 42,
    info: { Title: title, Author: '潘潘老师', Subject: `${dateRangeText} ${topicLabel}` },
    autoFirstPage: true,
  });
  response.type('application/pdf');
  response.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${title}.pdf`)}`);
  response.set('Cache-Control', 'private, no-store');
  doc.pipe(response);

  assignments.forEach((assignment, index) => {
    if (index > 0) doc.addPage();
    drawPracticePdfHeader(doc, {
      studentName: student.name,
      date: assignment.date,
      dateRangeText,
      topicLabel: FIXED_MODULE,
      dayIndex: index + 1,
      avatarPath,
    });
    const rowsPerColumn = Math.max(1, Math.ceil(assignment.items.length / 2));
    const rowPitch = Math.min(105, 566 / rowsPerColumn);
    const left = assignment.items.slice(0, rowsPerColumn);
    const right = assignment.items.slice(rowsPerColumn);
    drawPracticeQuestionColumn(doc, left, 42, rowPitch, 243);
    drawPracticeQuestionColumn(doc, right, 310, rowPitch, 243);
    writePracticeFooter(doc, '学生记录 · 每天一点点，进步看得见', index + 1);
  });

  let answerPageNumber = assignments.length;
  const startAnswerPage = () => {
    doc.addPage();
    answerPageNumber += 1;
    doc.rect(0, 0, doc.page.width, 96).fill('#E8F2EE');
    doc.x = 42;
    doc.y = 28;
    writePdfText(doc, `${student.name}｜教师参考答案`, { size: 17, color: '#173A35', characters: 28, lineGap: 1 });
    doc.x = 42;
    doc.y = 67;
    writePdfText(doc, `${dateRangeText}｜多日答案紧凑排版`, { size: 8.5, color: '#536762', characters: 45, lineGap: 1 });
    doc.x = 42;
    doc.y = 124;
  };
  startAnswerPage();
  assignments.forEach((assignment, index) => {
    const cardHeight = practiceAnswerCardHeight(assignment.items.length);
    if (doc.y + cardHeight > 750) {
      writePracticeFooter(doc, '答案仅供教师核对 · 题目来自项目自编参数化题库', answerPageNumber);
      startAnswerPage();
    }
    drawPracticeAnswerDay(doc, assignment, index);
  });
  writePracticeFooter(doc, '答案仅供教师核对 · 题目来自项目自编参数化题库', answerPageNumber);
  doc.end();
}

module.exports = {
  MODULES,
  TOPICS,
  GRADE_TOPICS,
  DEFAULT_TOPIC_KEYS_BY_GRADE,
  DEFAULT_TOPIC_KEYS,
  FIXED_GRADE,
  FIXED_MODULE,
  FIXED_DIFFICULTY,
  practiceDateAt,
  oldestPendingPracticeCorrection,
  dateRange,
  normalizeTopicKeys,
  questionTypesForTopics,
  resolvePracticeAbilitySnapshot,
  generateAssignment,
  rebuildAdaptiveAssignment,
  freezeStudentPracticeAssignments,
  studentPdfFreezeState,
  preGenerateDate,
  resolveStudentPracticePlan,
  evaluateProgression,
  practiceFocusItemIds,
  practiceVisibleItemIds,
  serializePracticeSubmission,
  generatePlanPdf: generateLegacyPlanPdf,
  generateStudentPlanPdf,
  loadPracticePdfItems,
};
