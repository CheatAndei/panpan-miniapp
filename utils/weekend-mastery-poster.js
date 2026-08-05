import { isAlbumPermissionError, saveImageToAlbum } from './photo-album';

export const WEEKEND_MASTERY_POSTER_WIDTH = 720;
export const WEEKEND_MASTERY_POSTER_HEIGHT = 960;

const COLORS = Object.freeze({
  background: '#F5F3E8',
  paper: '#FFFFFF',
  ink: '#050505',
  secondary: '#3E4A4E',
  muted: '#6B7477',
  yellow: '#FFF48A',
  yellowSoft: '#FFF9C9',
  sky: '#99DEF4',
  skySoft: '#E7F7FC',
  rule: '#D9D7CC',
});

function roundRect(ctx, x, y, width, height, radius, color) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.setFillStyle(color);
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius, color, lineWidth = 2) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.setStrokeStyle(color);
  ctx.setLineWidth(lineWidth);
  ctx.stroke();
}

function cleanText(value) {
  return String(value || '').trim();
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function resolvePeriod({ periodLabel, periodStart, periodEnd }) {
  if (cleanText(periodLabel)) return cleanText(periodLabel);
  const start = formatDate(periodStart);
  const end = formatDate(periodEnd);
  if (start && end) return `${start} — ${end}`;
  return start || end || '本周训练周期';
}

function normalizeStage(value, index) {
  const source = typeof value === 'string' ? { topic: value } : (value || {});
  return {
    topic: cleanText(source.topic || source.title || source.label)
      || (index === 0 ? '方法熟练训练' : '难度升级训练'),
    difficulty: cleanText(source.difficulty)
      || (index === 0 ? '适中' : '偏难'),
  };
}

function resolveStages(stages, stageOne, stageTwo) {
  const values = Array.isArray(stages) ? stages : [];
  return [
    normalizeStage(values[0] || stageOne, 0),
    normalizeStage(values[1] || stageTwo, 1),
  ];
}

function drawAdaptiveText(ctx, value, x, y, maxWidth, preferredSize, minimumSize = 18) {
  const text = cleanText(value);
  let size = preferredSize;
  ctx.setFontSize(size);
  while (size > minimumSize && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.setFontSize(size);
  }
  ctx.fillText(text, x, y);
}

function wrapText(ctx, value, maxWidth, maxLines = 2) {
  const text = cleanText(value);
  if (!text) return [];
  const lines = [];
  let current = '';
  for (const character of Array.from(text)) {
    const next = current + character;
    if (current && ctx.measureText(next).width > maxWidth && lines.length < maxLines - 1) {
      lines.push(current);
      current = character;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCheck(ctx, centerX, centerY, color) {
  ctx.setStrokeStyle(color);
  ctx.setLineWidth(6);
  ctx.beginPath();
  ctx.moveTo(centerX - 12, centerY);
  ctx.lineTo(centerX - 3, centerY + 10);
  ctx.lineTo(centerX + 15, centerY - 12);
  ctx.stroke();
}

function drawRouteNode(ctx, centerX, centerY, number) {
  ctx.setFillStyle(COLORS.ink);
  ctx.beginPath();
  ctx.arc(centerX, centerY, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.setFillStyle(COLORS.paper);
  ctx.setFontSize(22);
  ctx.setTextAlign('center');
  ctx.fillText(String(number), centerX, centerY + 8);
  ctx.setTextAlign('left');
}

function drawStageCard(ctx, stage, index, y) {
  const cardColor = index === 0 ? COLORS.yellowSoft : COLORS.skySoft;
  roundRect(ctx, 132, y, 520, 138, 18, cardColor);
  strokeRoundRect(ctx, 132, y, 520, 138, 18, COLORS.ink, 2);

  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(17);
  ctx.fillText(index === 0 ? '第一关 · 方法熟练' : '第二关 · 难度升级', 158, y + 33);

  roundRect(ctx, 542, y + 17, 84, 34, 17, index === 0 ? COLORS.yellow : COLORS.sky);
  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(16);
  ctx.setTextAlign('center');
  ctx.fillText(stage.difficulty, 584, y + 40);
  ctx.setTextAlign('left');

  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(27);
  wrapText(ctx, stage.topic, 425, 2)
    .forEach((line, lineIndex) => ctx.fillText(line, 158, y + 78 + lineIndex * 31));

  roundRect(ctx, 602, y + 84, 32, 32, 16, COLORS.ink);
  drawCheck(ctx, 618, y + 100, COLORS.paper);
}

function exportCanvas(canvasId, page) {
  return new Promise((resolve, reject) => uni.canvasToTempFilePath({
    canvasId,
    x: 0,
    y: 0,
    width: WEEKEND_MASTERY_POSTER_WIDTH,
    height: WEEKEND_MASTERY_POSTER_HEIGHT,
    destWidth: 1080,
    destHeight: 1440,
    fileType: 'png',
    quality: 1,
    success: (result) => resolve(result.tempFilePath),
    fail: reject,
  }, page));
}

export async function renderWeekendMasteryPoster({
  page,
  canvasId = 'weekendMasteryPosterCanvas',
  studentName,
  periodLabel,
  periodStart,
  periodEnd,
  stages = [],
  stageOne,
  stageTwo,
} = {}) {
  const fullName = cleanText(studentName);
  if (!fullName) throw new Error('缺少学生完整姓名');
  const period = resolvePeriod({ periodLabel, periodStart, periodEnd });
  const routeStages = resolveStages(stages, stageOne, stageTwo);
  const ctx = uni.createCanvasContext(canvasId, page);

  ctx.setTextAlign('left');
  ctx.setFillStyle(COLORS.background);
  ctx.fillRect(0, 0, WEEKEND_MASTERY_POSTER_WIDTH, WEEKEND_MASTERY_POSTER_HEIGHT);

  ctx.setFillStyle(COLORS.rule);
  for (let y = 60; y < 930; y += 48) ctx.fillRect(0, y, WEEKEND_MASTERY_POSTER_WIDTH, 1);
  ctx.setFillStyle(COLORS.ink);
  ctx.fillRect(0, 0, 14, WEEKEND_MASTERY_POSTER_HEIGHT);
  ctx.setFillStyle(COLORS.sky);
  ctx.fillRect(14, 0, 7, WEEKEND_MASTERY_POSTER_HEIGHT);

  roundRect(ctx, 42, 36, 636, 250, 22, COLORS.paper);
  ctx.setFillStyle(COLORS.sky);
  ctx.fillRect(42, 36, 636, 12);
  roundRect(ctx, 64, 66, 276, 34, 17, COLORS.skySoft);
  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(16);
  ctx.fillText('PANPAN · WEEKEND TRAINING CAMP', 82, 89);

  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(54);
  ctx.fillText('周末攻坚战', 64, 158);
  roundRect(ctx, 486, 113, 164, 54, 12, COLORS.yellow);
  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(21);
  ctx.setTextAlign('center');
  ctx.fillText('两关均通过', 568, 147);
  ctx.setTextAlign('left');

  ctx.setFillStyle(COLORS.ink);
  drawAdaptiveText(ctx, fullName, 64, 220, 350, 42, 20);
  ctx.setFillStyle(COLORS.secondary);
  ctx.setFontSize(18);
  ctx.fillText('完成本周两段式训练路线', 64, 255);
  ctx.setTextAlign('right');
  ctx.fillText(period, 650, 255);
  ctx.setTextAlign('left');

  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(22);
  ctx.fillText('通关路线', 64, 330);
  ctx.setFillStyle(COLORS.muted);
  ctx.setFontSize(16);
  ctx.fillText('先练方法，再升难度', 166, 330);

  ctx.setStrokeStyle(COLORS.sky);
  ctx.setLineWidth(10);
  ctx.beginPath();
  ctx.moveTo(92, 384);
  ctx.lineTo(92, 624);
  ctx.stroke();
  drawRouteNode(ctx, 92, 406, 1);
  drawRouteNode(ctx, 92, 584, 2);
  drawStageCard(ctx, routeStages[0], 0, 354);
  drawStageCard(ctx, routeStages[1], 1, 532);

  roundRect(ctx, 42, 708, 636, 174, 22, COLORS.ink);
  roundRect(ctx, 58, 724, 604, 142, 15, COLORS.yellow);
  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(18);
  ctx.fillText('训练营通关证书', 82, 758);
  ctx.setFontSize(36);
  ctx.fillText('方法拿稳，难题拿下', 82, 808);
  ctx.setFontSize(18);
  ctx.fillText('两道同型大题均已完成，认真思考值得被记录。', 82, 844);

  ctx.setFillStyle(COLORS.secondary);
  ctx.setFontSize(16);
  ctx.fillText('番番记录 · 每一步都有解法，每一关都有成长', 42, 922);
  ctx.setTextAlign('right');
  ctx.fillText(period, 678, 922);
  ctx.setTextAlign('left');

  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 100)));
  return exportCanvas(canvasId, page);
}

export function saveWeekendMasteryPoster(filePath) {
  return saveImageToAlbum(filePath);
}

export function albumPermissionDenied(error) {
  return isAlbumPermissionError(error);
}
