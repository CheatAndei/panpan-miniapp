import { isAlbumPermissionError, saveImageToAlbum } from './photo-album';

export const WEEKEND_MASTERY_POSTER_WIDTH = 720;
export const WEEKEND_MASTERY_POSTER_HEIGHT = 960;

const COLORS = Object.freeze({
  background: '#070707',
  paper: '#111111',
  ink: '#FFF8E8',
  secondary: '#D8C999',
  muted: '#A9956B',
  yellow: '#F6C445',
  yellowSoft: '#2A2110',
  sky: '#D94A3A',
  skySoft: '#251313',
  rule: '#2C2518',
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
  strokeRoundRect(ctx, 132, y, 520, 138, 18, index === 0 ? COLORS.yellow : COLORS.sky, 3);

  ctx.setFillStyle(index === 0 ? COLORS.yellow : COLORS.sky);
  ctx.setFontSize(17);
  ctx.fillText(index === 0 ? 'STAGE 01 · 方法熟练' : 'STAGE 02 · 难度升级', 158, y + 33);

  roundRect(ctx, 542, y + 17, 84, 34, 17, index === 0 ? COLORS.yellow : COLORS.sky);
  ctx.setFillStyle(index === 0 ? COLORS.background : COLORS.ink);
  ctx.setFontSize(16);
  ctx.setTextAlign('center');
  ctx.fillText(stage.difficulty, 584, y + 40);
  ctx.setTextAlign('left');

  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(27);
  wrapText(ctx, stage.topic, 425, 2)
    .forEach((line, lineIndex) => ctx.fillText(line, 158, y + 78 + lineIndex * 31));

  roundRect(ctx, 602, y + 84, 32, 32, 16, COLORS.yellow);
  drawCheck(ctx, 618, y + 100, COLORS.background);
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
  for (let y = 36; y < 930; y += 44) ctx.fillRect(0, y, WEEKEND_MASTERY_POSTER_WIDTH, 1);
  for (let x = 38; x < 700; x += 54) ctx.fillRect(x, 0, 1, WEEKEND_MASTERY_POSTER_HEIGHT);
  ctx.setFillStyle(COLORS.yellow);
  ctx.fillRect(0, 0, 15, WEEKEND_MASTERY_POSTER_HEIGHT);
  ctx.setFillStyle(COLORS.sky);
  ctx.fillRect(15, 0, 6, WEEKEND_MASTERY_POSTER_HEIGHT);

  roundRect(ctx, 42, 36, 636, 250, 22, COLORS.paper);
  strokeRoundRect(ctx, 42, 36, 636, 250, 22, COLORS.yellow, 3);
  ctx.setFillStyle(COLORS.yellow);
  ctx.fillRect(42, 36, 636, 10);
  roundRect(ctx, 64, 66, 294, 34, 17, COLORS.yellowSoft);
  ctx.setFillStyle(COLORS.yellow);
  ctx.setFontSize(16);
  ctx.fillText('PANPAN // WEEKEND MASTERY', 82, 89);

  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(60);
  ctx.fillText('周末攻坚战', 64, 158);
  roundRect(ctx, 472, 112, 178, 58, 10, COLORS.sky);
  ctx.setFillStyle(COLORS.ink);
  ctx.setFontSize(24);
  ctx.setTextAlign('center');
  ctx.fillText('双关制霸', 561, 149);
  ctx.setTextAlign('left');

  ctx.setFillStyle(COLORS.yellow);
  drawAdaptiveText(ctx, fullName, 64, 220, 350, 42, 20);
  ctx.setFillStyle(COLORS.secondary);
  ctx.setFontSize(18);
  ctx.fillText('两关全破 · 本周方法彻底拿下', 64, 255);
  ctx.setTextAlign('right');
  ctx.fillText(period, 650, 255);
  ctx.setTextAlign('left');

  ctx.setFillStyle(COLORS.yellow);
  ctx.setFontSize(22);
  ctx.fillText('BATTLE ROUTE / 通关路线', 64, 330);
  ctx.setFillStyle(COLORS.muted);
  ctx.setFontSize(16);
  ctx.fillText('同法进阶 · 两级难度', 314, 330);

  ctx.setStrokeStyle(COLORS.yellow);
  ctx.setLineWidth(10);
  ctx.beginPath();
  ctx.moveTo(92, 384);
  ctx.lineTo(92, 624);
  ctx.stroke();
  drawRouteNode(ctx, 92, 406, 1);
  drawRouteNode(ctx, 92, 584, 2);
  drawStageCard(ctx, routeStages[0], 0, 354);
  drawStageCard(ctx, routeStages[1], 1, 532);

  roundRect(ctx, 42, 708, 636, 174, 22, COLORS.yellow);
  roundRect(ctx, 52, 718, 616, 154, 15, COLORS.background);
  strokeRoundRect(ctx, 52, 718, 616, 154, 15, COLORS.sky, 3);
  ctx.setFillStyle(COLORS.yellow);
  ctx.setFontSize(18);
  ctx.fillText('WEEKEND VICTORY REPORT', 82, 758);
  ctx.setFontSize(39);
  ctx.fillText('方法拿稳，难题拿下', 82, 810);
  ctx.setFillStyle(COLORS.secondary);
  ctx.setFontSize(18);
  ctx.fillText('双关均由老师确认通过，这一仗值得被记录。', 82, 848);

  ctx.setFillStyle(COLORS.secondary);
  ctx.setFontSize(16);
  ctx.fillText('番番记录 · 每一步有解法，每一关有战果', 42, 922);
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
