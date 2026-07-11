// 品牌与展示名称单一来源。
// BRAND = 产品名（导航栏、登录页、页脚等产品语境）。
// 老师名称来自当前登录老师或孩子所属老师，不再写死某一位老师。
export const BRAND = '番番记录';
export const DEFAULT_TEACHER_NAME = '老师';
export const APP_SUBTITLE = '课堂记录与家校反馈助手';
export const FOOTER_TEXT = '番番记录 · 熟人老师共用版';

export function normalizeTeacherName(value, fallback = DEFAULT_TEACHER_NAME) {
  const raw = String(value || '').trim();
  return raw || fallback;
}

export function teacherDisplayName(value, fallback = DEFAULT_TEACHER_NAME) {
  const name = normalizeTeacherName(value, fallback);
  return /老师$/.test(name) ? name : `${name}老师`;
}

export function teacherShortName(value, fallback = DEFAULT_TEACHER_NAME) {
  const name = normalizeTeacherName(value, fallback);
  const shortName = name.replace(/老师$/, '').trim();
  return shortName && shortName !== DEFAULT_TEACHER_NAME ? shortName : '';
}

export function teacherNameFromChild(child, fallback = '孩子的老师') {
  return teacherDisplayName(child?.teacher_name || child?.teacherName, fallback);
}
