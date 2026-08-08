const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseServerUtcDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const isoText = text.includes('T') ? text : text.replace(' ', 'T');
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoText) ? isoText : `${isoText}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatChinaSubmissionTime(value, practiceDate = '') {
  const date = parseServerUtcDateTime(value);
  if (!date) return '提交时间未知';
  const chinaDate = new Date(date.getTime() + CHINA_TIME_OFFSET_MS);
  const year = chinaDate.getUTCFullYear();
  const month = pad2(chinaDate.getUTCMonth() + 1);
  const day = pad2(chinaDate.getUTCDate());
  const time = `${pad2(chinaDate.getUTCHours())}:${pad2(chinaDate.getUTCMinutes())}`;
  const submittedDate = `${year}-${month}-${day}`;
  return submittedDate === String(practiceDate || '').slice(0, 10)
    ? `提交 ${time}`
    : `提交 ${month}-${day} ${time}`;
}
