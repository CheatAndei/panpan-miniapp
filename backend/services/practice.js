const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const MODULES = {
  小学: ['四则运算', '乘除法', '应用题'],
  初中: ['有理数', '一元一次方程', '整式运算'],
};

function practiceDateAt(value = new Date()) {
  const shanghai = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  if (shanghai.getUTCHours() < 1) shanghai.setUTCDate(shanghai.getUTCDate() - 1);
  return shanghai.toISOString().slice(0, 10);
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

function parseJson(value, fallback = []) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
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
  const types = parseJson(plan.question_types, []).filter(Boolean);
  let sql = `SELECT * FROM practice_questions
    WHERE grade_band=? AND subject=? AND difficulty<=? AND is_active=1`;
  const params = [plan.grade_band, plan.subject, setting.difficulty];
  if (module) { sql += ' AND module=?'; params.push(module); }
  if (types.length) {
    sql += ` AND question_type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }
  return db.all(sql, params);
}

function historyTemplates(db, studentId, practiceDate) {
  const rows = db.all(`SELECT r.is_correct,r.reviewed_at,i.snapshot_module,i.template_key,a.practice_date
    FROM practice_reviews r
    JOIN practice_assignment_items i ON i.id=r.assignment_item_id
    JOIN practice_assignments a ON a.id=i.assignment_id
    WHERE a.student_id=?
    ORDER BY r.reviewed_at DESC,a.practice_date DESC LIMIT 240`, [studentId]);
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

function recentSignatures(db, studentId, practiceDate) {
  const from = new Date(`${practiceDate}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 14);
  return new Set(db.all(`SELECT i.signature FROM practice_assignment_items i
    JOIN practice_assignments a ON a.id=i.assignment_id
    WHERE a.student_id=? AND a.practice_date>=? AND a.practice_date<?`, [
    studentId, from.toISOString().slice(0, 10), practiceDate,
  ]).map((row) => row.signature));
}

function selectQuestions(db, plan, setting, studentId, practiceDate) {
  const currentPool = scopedQuestionPool(db, plan, setting, setting.current_module);
  const allScopePool = scopedQuestionPool(db, plan, setting);
  if (!currentPool.length) throw new Error('当前题库范围没有可用题目');
  const targetSeconds = Number(plan.target_seconds || 1200);
  const minSeconds = Math.round(targetSeconds * 0.9);
  const maxSeconds = Math.round(targetSeconds * 1.1);
  const history = historyTemplates(db, studentId, practiceDate);
  const recent = recentSignatures(db, studentId, practiceDate);
  const seed = `${studentId}|${practiceDate}|${plan.id}`;
  const selected = [];
  const picked = new Set();
  const templateCounts = new Map();
  let selectedSeconds = 0;

  const takeSeconds = (source, secondsBudget, allowRecent = false) => {
    let addedSeconds = 0;
    let addedCount = 0;
    for (const question of localityAwareSort(source, seed)) {
      if (addedSeconds >= secondsBudget || selected.length >= 24 || picked.has(question.id)) continue;
      if (!allowRecent && recent.has(question.signature)) continue;
      const template = `${question.module}|${question.template_key}`;
      const used = templateCounts.get(template) || 0;
      if (used >= 2) continue;
      const seconds = Number(question.estimated_seconds || 90);
      if (selectedSeconds + seconds > maxSeconds) continue;
      selected.push(question);
      picked.add(question.id);
      templateCounts.set(template, used + 1);
      selectedSeconds += seconds;
      addedSeconds += seconds;
      addedCount++;
    }
    return { count: addedCount, seconds: addedSeconds };
  };

  const historyKey = (q) => `${q.module}|${q.template_key}`;
  const wrongSelected = takeSeconds(allScopePool.filter((q) => history.wrong.has(historyKey(q))), targetSeconds * 0.25);
  const masteredSelected = takeSeconds(
    allScopePool.filter((q) => history.mastered.has(historyKey(q)) && !history.wrong.has(historyKey(q))),
    targetSeconds * 0.15,
  );
  takeSeconds(currentPool, Math.max(0, targetSeconds - selectedSeconds));
  if (selectedSeconds < minSeconds) takeSeconds(currentPool, targetSeconds - selectedSeconds, true);
  if (selected.length < 8 || selectedSeconds < minSeconds || selectedSeconds > maxSeconds) {
    throw new Error('题库时长不足 18-22 分钟，请扩大模块、题型或难度范围');
  }

  return {
    questions: selected,
    meta: {
      version: 'adaptive-v1',
      target_seconds: targetSeconds,
      actual_seconds: selectedSeconds,
      current_module: setting.current_module,
      wrong_templates: history.wrong.size,
      selected_wrong_review: wrongSelected.count,
      selected_wrong_seconds: wrongSelected.seconds,
      selected_mastered_review: masteredSelected.count,
      selected_mastered_seconds: masteredSelected.seconds,
      selected_current: selected.length - wrongSelected.count - masteredSelected.count,
      selected_current_seconds: selectedSeconds - wrongSelected.seconds - masteredSelected.seconds,
      mastered_interval_days: history.intervalDays,
      recent_exclusion_days: 14,
      template_daily_cap: 2,
      selected_guangzhou: selected.filter((question) => question.source_region === '广州').length,
    },
  };
}

function ensureStudentSetting(db, plan, studentId) {
  db.run(`INSERT OR IGNORE INTO practice_student_settings
    (plan_id,student_id,current_module,difficulty,auto_advance,is_locked)
    VALUES(?,?,?,?,?,0)`, [plan.id, studentId, plan.module, plan.difficulty, plan.auto_advance]);
  return db.get('SELECT * FROM practice_student_settings WHERE plan_id=? AND student_id=?', [plan.id, studentId]);
}

function generateAssignment(db, plan, studentId, practiceDate) {
  const existing = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [studentId, practiceDate]);
  if (existing) return existing;
  try {
    return db.transaction(() => {
      const repeated = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [studentId, practiceDate]);
      if (repeated) return repeated;
      const setting = ensureStudentSetting(db, plan, studentId);
      const selection = selectQuestions(db, plan, setting, studentId, practiceDate);
      const estimated = selection.questions.reduce((sum, q) => sum + Number(q.estimated_seconds || 90), 0);
      const created = db.run(`INSERT INTO practice_assignments
        (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta)
        VALUES(?,?,?,?,?,?)`, [plan.id, studentId, practiceDate, 'ready', estimated, JSON.stringify(selection.meta)]);
      selection.questions.forEach((question, index) => {
        db.run(`INSERT INTO practice_assignment_items
          (assignment_id,question_id,position,snapshot_stem,snapshot_answer,snapshot_module,snapshot_type,
           snapshot_difficulty,estimated_seconds,signature,template_key)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
          created.lastInsertRowid, question.id, index + 1, question.stem, question.answer, question.module,
          question.question_type, question.difficulty, question.estimated_seconds, question.signature, question.template_key,
        ]);
      });
      return db.get('SELECT * FROM practice_assignments WHERE id=?', [created.lastInsertRowid]);
    });
  } catch (error) {
    const concurrent = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [studentId, practiceDate]);
    if (concurrent) return concurrent;
    throw error;
  }
}

function preGenerateDate(db, practiceDate) {
  const plans = db.all(`SELECT * FROM practice_plans
    WHERE status='published' AND start_date<=? AND end_date>=?`, [practiceDate, practiceDate]);
  let generated = 0;
  db.transaction(() => {
    for (const plan of plans) {
      const students = db.all('SELECT id FROM students WHERE class_id=?', [plan.class_id]);
      for (const student of students) {
        const before = db.get('SELECT id FROM practice_assignments WHERE student_id=? AND practice_date=?', [student.id, practiceDate]);
        generateAssignment(db, plan, student.id, practiceDate);
        if (!before) generated++;
      }
    }
  });
  return { plans: plans.length, generated };
}

function evaluateProgression(db, planId, studentId) {
  const setting = db.get('SELECT * FROM practice_student_settings WHERE plan_id=? AND student_id=?', [planId, studentId]);
  if (!setting || !setting.auto_advance || setting.is_locked) return { advanced: false, reason: 'locked' };
  const rows = db.all(`SELECT r.is_correct,a.practice_date FROM practice_reviews r
    JOIN practice_assignment_items i ON i.id=r.assignment_item_id
    JOIN practice_assignments a ON a.id=i.assignment_id
    WHERE a.student_id=? AND a.plan_id=? AND i.snapshot_module=?
    ORDER BY r.reviewed_at DESC LIMIT 60`, [studentId, planId, setting.current_module]);
  const days = new Set(rows.map((row) => row.practice_date));
  if (rows.length < 20 || days.size < 2) return { advanced: false, reason: 'insufficient_reviewed_data' };
  const accuracy = rows.filter((row) => Number(row.is_correct)).length / rows.length;
  const lastFiveWrong = rows.slice(0, 5).filter((row) => !Number(row.is_correct)).length;
  if (accuracy < 0.85 || lastFiveWrong > 1) return { advanced: false, reason: 'not_mastered', accuracy };
  const plan = db.get('SELECT grade_band FROM practice_plans WHERE id=?', [planId]);
  const sequence = MODULES[plan?.grade_band] || [];
  const next = sequence[sequence.indexOf(setting.current_module) + 1];
  if (!next) return { advanced: false, reason: 'last_module', accuracy };
  db.run(`UPDATE practice_student_settings SET current_module=?,updated_at=CURRENT_TIMESTAMP
    WHERE plan_id=? AND student_id=?`, [next, planId, studentId]);
  return { advanced: true, from: setting.current_module, to: next, accuracy };
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

function generatePlanPdf(db, plan, response, requestedStart = plan.start_date) {
  const start = requestedStart < plan.start_date ? plan.start_date : requestedStart;
  const fifth = new Date(`${start}T00:00:00Z`);
  fifth.setUTCDate(fifth.getUTCDate() + 4);
  const end = fifth.toISOString().slice(0, 10) > plan.end_date ? plan.end_date : fifth.toISOString().slice(0, 10);
  const dates = dateRange(start, end, 5);
  const students = db.all('SELECT id,name FROM students WHERE class_id=? ORDER BY name', [plan.class_id]);
  db.transaction(() => {
    for (const date of dates) for (const student of students) generateAssignment(db, plan, student.id, date);
  });

  const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `${plan.title}-五日打卡` } });
  response.type('application/pdf');
  response.set('Content-Disposition', `attachment; filename="practice-plan-${plan.id}.pdf"`);
  response.set('Cache-Control', 'private, no-store');
  doc.pipe(response);
  writePdfText(doc, `${plan.title} · 个性化打卡练习`, { size: 18, characters: 28 });
  writePdfText(doc, `${dates[0]} 至 ${dates[dates.length - 1]}｜${plan.grade_band} ${plan.module}`, { size: 10, color: '#536762' });

  students.forEach((student) => {
    dates.forEach((date) => {
      doc.addPage();
      writePdfText(doc, `${student.name}｜${date}｜约20分钟`, { size: 16, characters: 30 });
      const assignment = db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [student.id, date]);
      const items = db.all('SELECT * FROM practice_assignment_items WHERE assignment_id=? ORDER BY position', [assignment.id]);
      items.forEach((item) => writePdfText(doc, `${item.position}. ${item.snapshot_stem}`, { size: 11, characters: 34 }));
    });
  });

  doc.addPage();
  writePdfText(doc, '教师参考答案', { size: 18, characters: 30 });
  writePdfText(doc, '以下内容位于整份练习末尾，请勿随学生练习页一同发放。', { size: 10, color: '#697B76' });
  students.forEach((student) => {
    doc.addPage();
    writePdfText(doc, `${student.name}｜参考答案（教师版）`, { size: 16, characters: 30 });
    dates.forEach((date) => {
      writePdfText(doc, date, { size: 12, color: '#2F7D6B' });
      const assignment = db.get('SELECT id FROM practice_assignments WHERE student_id=? AND practice_date=?', [student.id, date]);
      const items = db.all('SELECT position,snapshot_answer FROM practice_assignment_items WHERE assignment_id=? ORDER BY position', [assignment.id]);
      writePdfText(doc, items.map((item) => `${item.position}.${item.snapshot_answer}`).join('　'), { size: 10, characters: 40 });
    });
  });
  writePdfText(doc, '题目来源：项目自编参数化题库，不复制教材或真题。答案仅供教师核对。', { size: 9, color: '#697B76' });
  doc.end();
}

module.exports = {
  MODULES,
  practiceDateAt,
  dateRange,
  generateAssignment,
  preGenerateDate,
  evaluateProgression,
  generatePlanPdf,
};
