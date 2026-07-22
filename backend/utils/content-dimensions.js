const GRADE_CODES = new Set(['g7', 'g8', 'g9']);
const SUBJECT_CODES = new Set(['math', 'chinese', 'english', 'physics', 'chemistry', 'history', 'morality']);

const GRADE_LABELS = { g7: '七年级', g8: '八年级', g9: '冲刺中考' };
const SUBJECT_LABELS = {
  math: '数学', chinese: '语文', english: '英语', physics: '物理',
  chemistry: '化学', history: '历史', morality: '道德与法治',
};

function normalizeGradeCode(value, fallback = 'g7') {
  const text = String(value || '').trim().toLowerCase();
  if (GRADE_CODES.has(text)) return text;
  if (/九|9|初三|中考/.test(text)) return 'g9';
  if (/八|8|初二/.test(text)) return 'g8';
  if (/七|7|初一/.test(text)) return 'g7';
  return GRADE_CODES.has(fallback) ? fallback : 'g7';
}

function normalizeSubjectCode(value, fallback = 'math') {
  const text = String(value || '').trim().toLowerCase();
  if (SUBJECT_CODES.has(text)) return text;
  const mapped = Object.entries(SUBJECT_LABELS).find(([, label]) => label === text || (text === '政治' && label === '道德与法治'));
  return mapped?.[0] || (SUBJECT_CODES.has(fallback) ? fallback : 'math');
}

function studentGradeCode(student) {
  return normalizeGradeCode(student?.grade || student?.class_grade || 'g7');
}

function gradeLabel(code) { return GRADE_LABELS[normalizeGradeCode(code)] || GRADE_LABELS.g7; }
function subjectLabel(code) { return SUBJECT_LABELS[normalizeSubjectCode(code)] || SUBJECT_LABELS.math; }

module.exports = {
  GRADE_CODES, SUBJECT_CODES, GRADE_LABELS, SUBJECT_LABELS,
  normalizeGradeCode, normalizeSubjectCode, studentGradeCode, gradeLabel, subjectLabel,
};
