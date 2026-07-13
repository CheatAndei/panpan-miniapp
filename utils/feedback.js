import feedbackEmojiConfig from '../shared/feedback-emojis.json';

export const SUPPORTED_FEEDBACK_EMOJIS = Object.freeze([...feedbackEmojiConfig.emojis]);
const FEEDBACK_EMOJI_SET = new Set(SUPPORTED_FEEDBACK_EMOJIS);
const FEEDBACK_EMOJI_PATTERN = new RegExp(SUPPORTED_FEEDBACK_EMOJIS.map(escapeRegExp).join('|'), 'gu');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEmoji(value) {
  let normalizedValue = String(value || '');
  for (const [placeholder, emoji] of Object.entries(feedbackEmojiConfig.placeholders || {})) {
    normalizedValue = normalizedValue.replaceAll(placeholder, emoji);
  }
  return normalizedValue
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, (emoji) => {
      const normalized = emoji.replace(/\uFE0F/g, '');
      return FEEDBACK_EMOJI_SET.has(normalized) ? normalized : '';
    })
    .replace(/[\u200D\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, '');
}

function firstSupportedEmoji(value) {
  for (const character of String(value || '')) {
    if (FEEDBACK_EMOJI_SET.has(character)) return character;
  }
  return feedbackEmojiConfig.fallback;
}

const HOMEWORK_SECTION_PATTERN = /(?:^|\n)(?:\s*---\s*\n)?\s*📚\s*作业说明\s*(?:\n|[：:]\s*)([\s\S]*?)(?=\n\s*---\s*(?:\n|$)|$)/u;

function splitHomeworkSection(value) {
  const source = String(value || '').replace(/\r/g, '').trim();
  const match = HOMEWORK_SECTION_PATTERN.exec(source);
  if (!match) return { homework: '', summary: source };
  const homework = String(match[1] || '').trim();
  const summary = `${source.slice(0, match.index)}${source.slice(match.index + match[0].length)}`
    .replace(/\n\s*---\s*\n\s*---\s*\n/gu, '\n---\n')
    .replace(/^\s*---\s*\n|\n\s*---\s*$/gu, '')
    .trim();
  return { homework, summary };
}

export function feedbackHomework(feedback) {
  const structured = String(feedback?.homework || '').trim();
  return structured || splitHomeworkSection(feedback?.summary).homework;
}

export function feedbackSummaryWithoutHomework(value) {
  return splitHomeworkSection(value).summary;
}

export function formatStudentFeedbackText(studentName, text) {
  const name = String(studentName || '').trim();
  let body = normalizeEmoji(String(text || '').replace(/\r/g, '')).trim();
  const emoji = firstSupportedEmoji(body);
  body = body.replace(FEEDBACK_EMOJI_PATTERN, '');
  body = body
    .replace(new RegExp(`^${escapeRegExp(name)}[：:，,\\s]*`), '')
    .replace(new RegExp(`^${escapeRegExp(name)}[：:，,\\s]*`), '')
    .trim();
  const paragraphs = body.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const normalized = (paragraphs.length ? paragraphs : [body])
    .filter(Boolean)
    .map((part) => `　　${part.replace(/^　+|^\s+/, '')}`)
    .join('\n');
  return `${name}${emoji}\n${normalized}`.trim();
}
