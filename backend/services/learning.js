const crypto = require('node:crypto');
const { QUESTION_BANK } = require('../resources/mental-arena/questions');
const { answersEqual, isJuniorStudent, shanghaiWeekStart } = require('./mental-arena');
const { practiceDateAt } = require('./practice');

const TASKS = {
  warmup: { title: '每日 5 题热身', count: 5, description: '短时启动，保持计算手感' },
  basics: { title: '计算基础', count: 10, description: '按当前学段巩固基础计算' },
  wrong: { title: '错题清零', count: 3, description: '同类题连续答对 2 次即掌握' },
  weekly: { title: '每周挑战', count: 12, description: '一组有梯度的综合计算' },
  context: { title: '广州情境题', count: 8, description: '结合本地命题方向练习' },
  weekend: { title: '周末小测', count: 10, description: '用 10 题检查本周掌握情况' },
};

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function studentProfile(db, studentId) {
  return db.get(`SELECT s.*,c.name class_name,c.grade class_grade
    FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?`, [studentId]);
}

function battleForStudent(student) {
  return isJuniorStudent(student) ? 'junior' : 'primary';
}

function gradeForBattle(battle) {
  return battle === 'junior' ? '初中' : '小学';
}

function hashValue(seed) {
  return crypto.createHash('sha256').update(String(seed)).digest('hex');
}

function deterministicPick(items, count, seed) {
  return [...items]
    .sort((left, right) => hashValue(`${seed}|${left.id}`).localeCompare(hashValue(`${seed}|${right.id}`)))
    .slice(0, count);
}

function publicQuestions(questions) {
  return questions.map(({ id, type, stem }, index) => ({ id, position: index + 1, type, stem }));
}

function serializeAttempt(attempt) {
  if (!attempt) return null;
  const questions = parseJson(attempt.questions_json, []);
  return {
    id: Number(attempt.id),
    student_id: Number(attempt.student_id),
    task_type: attempt.task_type,
    task_title: attempt.task_title,
    logical_date: attempt.logical_date,
    status: attempt.status,
    battle: attempt.battle,
    started_at: attempt.started_at,
    completed_at: attempt.completed_at,
    elapsed_seconds: attempt.elapsed_seconds === null ? null : Number(attempt.elapsed_seconds),
    correct_count: attempt.correct_count === null ? null : Number(attempt.correct_count),
    total_questions: Number(attempt.total_questions),
    score: attempt.score === null ? null : Number(attempt.score),
    questions: publicQuestions(questions),
    answers: attempt.status === 'completed' ? parseJson(attempt.answer_detail, []) : undefined,
  };
}

function insertWrong(db, item) {
  db.run(`INSERT OR IGNORE INTO wrong_item_progress
    (student_id,source_type,source_id,grade_band,module,question_type,snapshot_stem,snapshot_answer)
    VALUES(?,?,?,?,?,?,?,?)`, [
    item.studentId, item.sourceType, String(item.sourceId), item.gradeBand,
    item.module || '', item.questionType || '', item.stem || '', item.answer ?? null,
  ]);
}

function syncWrongSources(db, studentId) {
  const student = studentProfile(db, studentId);
  if (!student) throw new Error('学生不存在');
  const gradeBand = gradeForBattle(battleForStudent(student));
  db.transaction(() => {
    const practices = db.all(`SELECT ps.id submission_id,i.id item_id,i.snapshot_module module,
      i.snapshot_type question_type,i.snapshot_stem stem,i.snapshot_answer answer
      FROM practice_reviews r
      JOIN practice_submissions ps ON ps.id=r.submission_id
      JOIN practice_assignments a ON a.id=ps.assignment_id
      JOIN practice_assignment_items i ON i.id=r.assignment_item_id
      WHERE a.student_id=? AND r.is_correct=0`, [studentId]);
    for (const item of practices) insertWrong(db, {
      studentId, sourceType: 'practice_review', sourceId: `${item.submission_id}:${item.item_id}`,
      gradeBand, module: item.module, questionType: item.question_type, stem: item.stem, answer: item.answer,
    });

    const challenges = db.all(`SELECT id,battle,questions_json,answer_detail FROM mental_challenges
      WHERE student_id=? AND status='completed' AND answer_detail IS NOT NULL`, [studentId]);
    for (const challenge of challenges) {
      const byId = new Map(parseJson(challenge.questions_json, []).map((item) => [String(item.id), item]));
      for (const detail of parseJson(challenge.answer_detail, []).filter((item) => !item.is_correct)) {
        const question = byId.get(String(detail.question_id)) || {};
        insertWrong(db, {
          studentId, sourceType: 'mental_arena', sourceId: `${challenge.id}:${detail.question_id}`,
          gradeBand: gradeForBattle(challenge.battle), module: '口算挑战',
          questionType: question.type, stem: detail.stem, answer: detail.correct_answer,
        });
      }
    }

    const homework = db.all(`SELECT wq.id wrong_id,ha.question_no,ha.error_type,ha.comment,ha.teacher_note
      FROM wrong_questions wq JOIN homework_answers ha ON ha.id=wq.answer_id
      WHERE wq.student_id=? AND wq.status='open'`, [studentId]);
    for (const item of homework) insertWrong(db, {
      studentId, sourceType: 'homework', sourceId: item.wrong_id, gradeBand,
      module: item.error_type || '作业订正', questionType: item.error_type || '综合计算',
      stem: `作业第 ${item.question_no} 题 · ${item.teacher_note || item.comment || '需要巩固同类知识'}`,
      answer: null,
    });
  });
  return db.all(`SELECT * FROM wrong_item_progress WHERE student_id=? ORDER BY
    CASE status WHEN 'open' THEN 0 ELSE 1 END,last_attempt_at ASC,id ASC`, [studentId]);
}

function mentalQuestions(battle, count, seed, preferredTypes = []) {
  const bank = QUESTION_BANK[battle] || [];
  const preferred = preferredTypes.length
    ? bank.filter((item) => preferredTypes.includes(item.type))
    : bank;
  const chosen = deterministicPick(preferred.length >= count ? preferred : bank, count, seed);
  return chosen.map((item) => ({
    id: `mental:${item.id}`, type: item.type, stem: item.stem, answer: item.answer,
  }));
}

function practiceBankQuestions(db, battle, count, seed, regionOnly = false) {
  const grade = gradeForBattle(battle);
  const regionSql = regionOnly ? " AND source_region='广州'" : '';
  const rows = db.all(`SELECT id,question_type,stem,answer FROM practice_questions
    WHERE grade_band=? AND is_active=1${regionSql}`, [grade]);
  if (rows.length < count) return mentalQuestions(battle, count, seed);
  return deterministicPick(rows, count, seed).map((item) => ({
    id: `practice:${item.id}`, type: item.question_type, stem: item.stem, answer: item.answer,
  }));
}

function retryQuestions(db, studentId, battle, count, seed) {
  const wrongs = syncWrongSources(db, studentId).filter((item) => item.status === 'open');
  if (!wrongs.length) return mentalQuestions(battle, count, seed);
  const pickedWrongs = deterministicPick(wrongs, count, `${seed}|wrongs`);
  const bank = QUESTION_BANK[battle] || [];
  return pickedWrongs.map((wrong, index) => {
    const sameType = bank.filter((item) => item.type === wrong.question_type);
    const pool = sameType.length ? sameType : bank;
    const question = deterministicPick(pool, 1, `${seed}|${wrong.id}|${index}`)[0];
    return {
      id: `retry:${wrong.id}:${question.id}`,
      type: wrong.question_type || question.type,
      stem: question.stem,
      answer: question.answer,
      wrong_progress_id: Number(wrong.id),
    };
  });
}

function questionsForTask(db, { studentId, battle, taskType, logicalDate }) {
  const config = TASKS[taskType];
  const seed = `${studentId}|${taskType}|${logicalDate}`;
  if (taskType === 'wrong') return retryQuestions(db, studentId, battle, config.count, seed);
  if (taskType === 'basics') return practiceBankQuestions(db, battle, config.count, seed);
  if (taskType === 'context') return practiceBankQuestions(db, battle, config.count, seed, true);
  return mentalQuestions(battle, config.count, seed);
}

function createOrGetAttempt(db, { studentId, parentId, taskType, now = new Date() }) {
  const config = TASKS[taskType];
  if (!config) throw new Error('学习任务不存在');
  const student = studentProfile(db, studentId);
  if (!student) throw new Error('学生不存在');
  const logicalDate = practiceDateAt(now);
  let attempt = db.get(`SELECT * FROM learning_attempts
    WHERE student_id=? AND task_type=? AND logical_date=?`, [studentId, taskType, logicalDate]);
  if (!attempt) {
    const battle = battleForStudent(student);
    const questions = questionsForTask(db, { studentId, battle, taskType, logicalDate });
    const created = db.run(`INSERT OR IGNORE INTO learning_attempts
      (student_id,parent_id,task_type,task_title,logical_date,status,battle,questions_json,total_questions,started_at)
      VALUES(?,?,?,?,?,'active',?,?,?,?)`, [
      studentId, parentId, taskType, config.title, logicalDate, battle,
      JSON.stringify(questions), questions.length, now.toISOString(),
    ]);
    attempt = created.lastInsertRowid
      ? db.get('SELECT * FROM learning_attempts WHERE id=?', [created.lastInsertRowid])
      : db.get(`SELECT * FROM learning_attempts WHERE student_id=? AND task_type=? AND logical_date=?`, [studentId, taskType, logicalDate]);
    db.run(`INSERT OR IGNORE INTO engagement_events(student_id,parent_id,event_name,event_key,detail_json)
      VALUES(?,?,?,?,?)`, [studentId, parentId, 'learning_started', `learning_started:${attempt.id}`, JSON.stringify({ task_type: taskType })]);
  }
  return serializeAttempt(attempt);
}

function completeAttempt(db, { attemptId, answers, elapsedSeconds, now = new Date() }) {
  const attempt = db.get('SELECT * FROM learning_attempts WHERE id=?', [attemptId]);
  if (!attempt) throw new Error('学习任务不存在');
  if (attempt.status === 'completed') return serializeAttempt(attempt);
  const submitted = new Map((Array.isArray(answers) ? answers : [])
    .map((item) => [String(item?.question_id || ''), String(item?.answer ?? '').trim().slice(0, 48)]));
  const questions = parseJson(attempt.questions_json, []);
  if (!questions.length) throw new Error('学习任务没有题目');
  const detail = questions.map((question, index) => {
    const answer = submitted.get(String(question.id)) || '';
    return {
      question_id: question.id,
      position: index + 1,
      type: question.type,
      stem: question.stem,
      answer,
      correct_answer: question.answer,
      is_correct: answersEqual(question.answer, answer),
    };
  });
  const correctCount = detail.filter((item) => item.is_correct).length;
  const seconds = Math.max(1, Math.min(7200, Number.parseInt(elapsedSeconds || '1', 10) || 1));
  const score = Math.round(correctCount / questions.length * 100);
  db.transaction(() => {
    db.run(`UPDATE learning_attempts SET status='completed',answer_detail=?,completed_at=?,elapsed_seconds=?,
      correct_count=?,score=? WHERE id=? AND status='active'`, [
      JSON.stringify(detail), now.toISOString(), seconds, correctCount, score, attempt.id,
    ]);
    questions.forEach((question, index) => {
      const result = detail[index];
      if (question.wrong_progress_id) {
        const wrong = db.get('SELECT * FROM wrong_item_progress WHERE id=? AND student_id=?', [question.wrong_progress_id, attempt.student_id]);
        if (wrong) {
          const streak = result.is_correct ? Number(wrong.consecutive_correct || 0) + 1 : 0;
          const mastered = streak >= 2;
          db.run(`UPDATE wrong_item_progress SET consecutive_correct=?,total_attempts=total_attempts+1,
            status=?,last_attempt_at=?,mastered_at=? WHERE id=?`, [
            streak, mastered ? 'mastered' : 'open', now.toISOString(), mastered ? now.toISOString() : null, wrong.id,
          ]);
        }
      } else if (!result.is_correct) {
        insertWrong(db, {
          studentId: attempt.student_id, sourceType: 'learning', sourceId: `${attempt.id}:${question.id}`,
          gradeBand: gradeForBattle(attempt.battle), module: attempt.task_title,
          questionType: question.type, stem: question.stem, answer: question.answer,
        });
      }
    });
    db.run(`INSERT OR IGNORE INTO engagement_events(student_id,parent_id,event_name,event_key,detail_json)
      VALUES(?,?,?,?,?)`, [attempt.student_id, attempt.parent_id, 'learning_completed', `learning_completed:${attempt.id}`,
      JSON.stringify({ task_type: attempt.task_type, correct_count: correctCount, total_questions: questions.length, elapsed_seconds: seconds })]);
  });
  return serializeAttempt(db.get('SELECT * FROM learning_attempts WHERE id=?', [attempt.id]));
}

function completedDateSet(db, studentId) {
  const dates = db.all(`SELECT DISTINCT logical_date date FROM learning_attempts
    WHERE student_id=? AND status='completed'
    UNION SELECT DISTINCT a.practice_date date FROM practice_submissions ps
      JOIN practice_assignments a ON a.id=ps.assignment_id WHERE a.student_id=?
    UNION SELECT DISTINCT substr(completed_at,1,10) date FROM mental_challenges
      WHERE student_id=? AND status='completed'`, [studentId, studentId, studentId]);
  return new Set(dates.map((item) => item.date).filter(Boolean));
}

function dateOffset(dateKey, amount) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function learningStreak(db, studentId, now = new Date()) {
  const completed = completedDateSet(db, studentId);
  let cursor = practiceDateAt(now);
  if (!completed.has(cursor)) cursor = dateOffset(cursor, -1);
  let count = 0;
  while (completed.has(cursor) && count < 366) {
    count += 1;
    cursor = dateOffset(cursor, -1);
  }
  return count;
}

function todayOverview(db, { studentId, now = new Date() }) {
  const student = studentProfile(db, studentId);
  if (!student) throw new Error('学生不存在');
  const logicalDate = practiceDateAt(now);
  const wrongs = syncWrongSources(db, studentId);
  const openWrongs = wrongs.filter((item) => item.status === 'open').length;
  const attempts = db.all(`SELECT task_type,status,correct_count,total_questions,elapsed_seconds FROM learning_attempts
    WHERE student_id=? AND logical_date=?`, [studentId, logicalDate]);
  const byType = new Map(attempts.map((item) => [item.task_type, item]));
  const practice = db.get(`SELECT p.id plan_id,p.title,a.id assignment_id,a.status,
    ps.status submission_status,ps.reviewed_at
    FROM practice_plans p JOIN students s ON s.class_id=p.class_id
    LEFT JOIN practice_assignments a ON a.plan_id=p.id AND a.student_id=s.id AND a.practice_date=?
    LEFT JOIN practice_submissions ps ON ps.assignment_id=a.id
    WHERE s.id=? AND p.status='published' AND p.start_date<=? AND p.end_date>=?
    ORDER BY p.created_at DESC LIMIT 1`, [logicalDate, studentId, logicalDate, logicalDate]);
  const fallbackThird = openWrongs > 0 ? 'wrong' : (Number(logicalDate.slice(-2)) % 2 ? 'weekly' : 'context');
  const taskTypes = ['warmup', practice ? 'practice' : 'basics', fallbackThird];
  const tasks = taskTypes.map((type, index) => {
    if (type === 'practice') {
      const completed = Boolean(practice.reviewed_at || practice.submission_status === 'reviewed');
      return {
        key: 'practice', position: index + 1, title: practice.title || '老师每日练习',
        description: practice.submission_status === 'submitted' ? '已提交，等待老师批改' : '完成后拍照提交，由老师逐题复核',
        route: 'practice', status: completed ? 'completed' : (practice.submission_status === 'submitted' ? 'pending_review' : 'ready'),
        completed,
      };
    }
    const config = TASKS[type];
    const attempt = byType.get(type);
    return {
      key: type, position: index + 1, title: type === 'wrong' ? `${Math.min(3, openWrongs)} 道错题再练` : config.title,
      description: type === 'wrong' ? '连续答对 2 次后移入已掌握' : config.description,
      route: 'session', session_type: type, status: attempt?.status || 'ready', completed: attempt?.status === 'completed',
      result: attempt?.status === 'completed' ? {
        correct_count: Number(attempt.correct_count), total_questions: Number(attempt.total_questions), elapsed_seconds: Number(attempt.elapsed_seconds),
      } : null,
    };
  });
  const completedCount = tasks.filter((item) => item.completed).length;
  const recent = db.all(`SELECT correct_count,total_questions,elapsed_seconds FROM learning_attempts
    WHERE student_id=? AND status='completed' ORDER BY completed_at DESC LIMIT 20`, [studentId]);
  const correct = recent.reduce((sum, item) => sum + Number(item.correct_count || 0), 0);
  const total = recent.reduce((sum, item) => sum + Number(item.total_questions || 0), 0);
  return {
    logical_date: logicalDate,
    tasks,
    progress: { completed: completedCount, total: tasks.length, percent: Math.round(completedCount / tasks.length * 100) },
    stats: {
      streak_days: learningStreak(db, studentId, now),
      accuracy: total ? Math.round(correct / total * 100) : null,
      open_wrong_count: openWrongs,
    },
  };
}

function catalog(db, { studentId, now = new Date() }) {
  const overview = todayOverview(db, { studentId, now });
  const weekday = new Date(`${overview.logical_date}T00:00:00+08:00`).getDay();
  return {
    logical_date: overview.logical_date,
    open_wrong_count: overview.stats.open_wrong_count,
    sections: [
      { type: 'warmup', ...TASKS.warmup, accent: 'mint' },
      { type: 'basics', ...TASKS.basics, accent: 'blue' },
      { type: 'wrong', ...TASKS.wrong, title: overview.stats.open_wrong_count ? `错题清零 · ${overview.stats.open_wrong_count} 待掌握` : '错题清零 · 今日巩固', accent: 'amber' },
      { type: 'weekly', ...TASKS.weekly, accent: 'navy' },
      { type: 'context', ...TASKS.context, accent: 'rose' },
      { type: 'weekend', ...TASKS.weekend, accent: 'purple', locked: ![0, 6].includes(weekday), lock_text: '周末开放' },
      { type: 'practice', title: '老师每日打卡', description: '完成老师发布的练习，拍照等待复核', route: 'practice', accent: 'green' },
      { type: 'arena', title: '口算王', description: '20 题限时挑战与本周排行', route: 'arena', accent: 'gold' },
    ],
  };
}

function weekStartKey(now = new Date()) {
  const shanghaiStart = new Date(shanghaiWeekStart(now).getTime() + 8 * 60 * 60 * 1000);
  return shanghaiStart.toISOString().slice(0, 10);
}

function growthSummary(db, { studentId, now = new Date() }) {
  const weekStart = weekStartKey(now);
  const attempts = db.all(`SELECT * FROM learning_attempts WHERE student_id=? AND status='completed'
    AND logical_date>=? ORDER BY completed_at`, [studentId, weekStart]);
  const mental = db.all(`SELECT * FROM mental_challenges WHERE student_id=? AND status='completed'
    AND completed_at>=?`, [studentId, `${weekStart}T00:00:00+08:00`]);
  const practice = db.all(`SELECT a.practice_date,r.is_correct,i.snapshot_type question_type
    FROM practice_assignments a JOIN practice_submissions ps ON ps.assignment_id=a.id
    JOIN practice_reviews r ON r.submission_id=ps.id
    JOIN practice_assignment_items i ON i.id=r.assignment_item_id
    WHERE a.student_id=? AND a.practice_date>=?`, [studentId, weekStart]);
  let correct = attempts.reduce((sum, item) => sum + Number(item.correct_count || 0), 0)
    + mental.reduce((sum, item) => sum + Number(item.correct_count || 0), 0)
    + practice.filter((item) => Number(item.is_correct) === 1).length;
  let total = attempts.reduce((sum, item) => sum + Number(item.total_questions || 0), 0)
    + mental.reduce((sum, item) => sum + Number(item.total_questions || 0), 0)
    + practice.length;
  const activeDates = new Set([
    ...attempts.map((item) => item.logical_date),
    ...mental.map((item) => String(item.completed_at || '').slice(0, 10)),
    ...practice.map((item) => item.practice_date),
  ].filter(Boolean));
  const topicErrors = new Map();
  for (const attempt of attempts) {
    for (const item of parseJson(attempt.answer_detail, []).filter((answer) => !answer.is_correct)) {
      const type = item.type || '综合计算';
      topicErrors.set(type, (topicErrors.get(type) || 0) + 1);
    }
  }
  for (const item of practice.filter((row) => Number(row.is_correct) === 0)) {
    const type = item.question_type || '综合计算';
    topicErrors.set(type, (topicErrors.get(type) || 0) + 1);
  }
  const mastered = Number(db.get(`SELECT COUNT(*) count FROM wrong_item_progress
    WHERE student_id=? AND status='mastered'`, [studentId])?.count || 0);
  const streak = learningStreak(db, studentId, now);
  const accuracy = total ? Math.round(correct / total * 100) : null;
  const best = db.get(`SELECT MAX(score) score,MIN(elapsed_seconds) fastest FROM mental_challenges
    WHERE student_id=? AND status='completed'`, [studentId]);
  const completedTasks = attempts.length + mental.length + new Set(practice.map((item) => item.practice_date)).size;
  const badgeDefs = [
    ['first_step', '初次启程', '完成第 1 次学习', completedTasks > 0],
    ['three_day', '三日连学', '连续学习 3 天', streak >= 3],
    ['seven_day', '一周坚持', '连续学习 7 天', streak >= 7],
    ['accuracy_90', '精准之星', '累计 20 题且正确率达到 90%', total >= 20 && accuracy >= 90],
    ['wrong_clear', '错题猎手', '掌握 3 道错题', mastered >= 3],
    ['speed_star', '速度新星', '完成一次口算王挑战', mental.length > 0 || Number(best?.score || 0) > 0],
  ];
  db.transaction(() => {
    for (const [code, , , unlocked] of badgeDefs) {
      if (unlocked) db.run('INSERT OR IGNORE INTO achievement_awards(student_id,badge_code) VALUES(?,?)', [studentId, code]);
    }
  });
  const awarded = new Set(db.all('SELECT badge_code FROM achievement_awards WHERE student_id=?', [studentId]).map((item) => item.badge_code));
  const weakTopics = [...topicErrors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([name, errors]) => ({ name, errors }));
  const metrics = {
    active_days: activeDates.size,
    completed_tasks: completedTasks,
    accuracy,
    total_questions: total,
    correct_questions: correct,
    learning_minutes: Math.round(attempts.reduce((sum, item) => sum + Number(item.elapsed_seconds || 0), 0) / 60),
    streak_days: streak,
    mastered_wrong_count: mastered,
  };
  const summary = completedTasks === 0
    ? '本周数据还不够，完成一次今日任务后就会生成个性化周报。'
    : `本周学习 ${activeDates.size} 天，完成 ${completedTasks} 次任务${accuracy === null ? '' : `，综合正确率 ${accuracy}%`}。${weakTopics.length ? `接下来重点巩固：${weakTopics.map((item) => item.name).join('、')}。` : '当前基础表现稳定，继续保持节奏。'}`;
  db.run(`INSERT INTO weekly_reports(student_id,week_start,metrics_json,summary,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(student_id,week_start) DO UPDATE SET metrics_json=excluded.metrics_json,
      summary=excluded.summary,updated_at=CURRENT_TIMESTAMP`, [studentId, weekStart, JSON.stringify(metrics), summary]);
  const completedDates = completedDateSet(db, studentId);
  const calendar = Array.from({ length: 14 }, (_, index) => {
    const date = dateOffset(practiceDateAt(now), index - 13);
    return { date, completed: completedDates.has(date), day: Number(date.slice(-2)) };
  });
  return {
    week_start: weekStart,
    metrics,
    weak_topics: weakTopics,
    personal_best: { score: Number(best?.score || 0), fastest_seconds: Number(best?.fastest || 0) },
    badges: badgeDefs.map(([code, title, description]) => ({ code, title, description, unlocked: awarded.has(code) })),
    calendar,
    report: { sufficient: completedTasks > 0, summary },
    share: { title: '本周学习成长卡', subtitle: `坚持 ${streak} 天 · 已掌握 ${mastered} 道错题`, anonymous: true },
  };
}

module.exports = {
  TASKS,
  parseJson,
  battleForStudent,
  serializeAttempt,
  syncWrongSources,
  createOrGetAttempt,
  completeAttempt,
  todayOverview,
  catalog,
  learningStreak,
  weekStartKey,
  growthSummary,
};
