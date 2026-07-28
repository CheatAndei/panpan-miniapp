import { isAlbumPermissionError, saveImageToAlbum } from './photo-album';

export const ACHIEVEMENT_POSTER_WIDTH = 750;
export const ACHIEVEMENT_POSTER_HEIGHT = 1000;

const COMMON_COLORS = Object.freeze({
  background: '#F8FCF9',
  paper: '#FFFFFF',
  ink: '#26352F',
  secondary: '#5A6A62',
  muted: '#7A8A82',
  border: '#D7EAE2',
  rule: '#EAF4F0',
});

const CATEGORY_THEMES = Object.freeze({
  choice: Object.freeze({
    primary: '#15946D',
    soft: '#E7F8F1',
    accent: '#FF7468',
    accentSoft: '#FFF0EE',
    label: '选择刷题王',
    note: '稳稳积累，每一道题都算数',
  }),
  mental: Object.freeze({
    primary: '#20B486',
    soft: '#E7F8F1',
    accent: '#D94B45',
    accentSoft: '#FFF0EE',
    label: '口算王',
    note: '又快又准，专注力正在发光',
  }),
  challenge: Object.freeze({
    primary: '#D94B45',
    soft: '#FFF0EE',
    accent: '#20B486',
    accentSoft: '#E7F8F1',
    label: '压轴挑战',
    note: '敢啃难题，思路比答案更珍贵',
  }),
});

function posterTheme(category) {
  return CATEGORY_THEMES[category] || CATEGORY_THEMES.choice;
}

function getImage(src) {
  return new Promise((resolve, reject) => uni.getImageInfo({
    src,
    success: (result) => resolve(result.path || result.tempFilePath || src),
    fail: reject,
  }));
}

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

function fillLine(ctx, x, y, width, color, height = 1) {
  ctx.setFillStyle(color);
  ctx.fillRect(x, y, width, height);
}

function wrap(ctx, value, maxWidth, maxLines = 3) {
  const lines = [];
  let current = '';
  for (const char of Array.from(String(value || ''))) {
    if (current && ctx.measureText(current + char).width > maxWidth) {
      lines.push(current);
      current = char;
      if (lines.length === maxLines) break;
    } else {
      current += char;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines;
}

function fitText(ctx, value, maxWidth) {
  const text = String(value || '');
  if (ctx.measureText(text).width <= maxWidth) return text;
  let visible = text;
  while (visible && ctx.measureText(`${visible}…`).width > maxWidth) {
    visible = visible.slice(0, -1);
  }
  return visible ? `${visible}…` : '…';
}

function metricRows(item) {
  if (item.category === 'mental') {
    return [
      ['正确率', `${item.accuracy || 0}%`],
      ['用时', `${item.elapsed_seconds || 0}秒`],
      ['得分', String(item.score || 0)],
      ...(item.rank ? [['真实排名', `第${item.rank}名`]] : []),
    ];
  }
  if (item.category === 'challenge') {
    return [
      ['累计通关', `${item.passed_count || 1}题`],
      ['本题来源', item.source_label || '潘潘老师精选'],
    ];
  }
  return [
    ['累计完成', `${item.completed_count || 0}题`],
    ['累计正确', `${item.correct_count || 0}题`],
    ['覆盖来源', `${item.source_count || 0}份`],
  ];
}

function drawNotebookBackground(ctx, theme) {
  ctx.setFillStyle(COMMON_COLORS.background);
  ctx.fillRect(0, 0, ACHIEVEMENT_POSTER_WIDTH, ACHIEVEMENT_POSTER_HEIGHT);
  for (let y = 52; y < 960; y += 42) {
    fillLine(ctx, 28, y, 694, COMMON_COLORS.rule);
  }
  ctx.setFillStyle(theme.primary);
  ctx.fillRect(0, 0, 16, ACHIEVEMENT_POSTER_HEIGHT);
  ctx.setFillStyle(theme.accent);
  ctx.fillRect(16, 0, 6, ACHIEVEMENT_POSTER_HEIGHT);
  roundRect(ctx, 668, 24, 48, 18, 9, theme.accentSoft);
  roundRect(ctx, 634, 48, 82, 18, 9, theme.soft);
}

function drawHeader(ctx, achievement, theme) {
  roundRect(ctx, 34, 28, 682, 224, 28, COMMON_COLORS.paper);
  roundRect(ctx, 54, 47, 260, 38, 19, theme.soft);
  ctx.setFillStyle(theme.primary);
  ctx.setFontSize(18);
  ctx.fillText('PANPAN · LEARNING NOTE', 72, 73);

  roundRect(ctx, 548, 47, 142, 42, 21, theme.accentSoft);
  ctx.setFillStyle(theme.primary);
  ctx.setFontSize(19);
  ctx.setTextAlign('center');
  ctx.fillText(theme.label, 619, 75);
  ctx.setTextAlign('left');

  ctx.setFillStyle(COMMON_COLORS.ink);
  ctx.setFontSize(52);
  ctx.fillText(fitText(ctx, achievement.display_name || '同学', 620), 56, 151);
  ctx.setFillStyle(COMMON_COLORS.secondary);
  ctx.setFontSize(25);
  ctx.fillText(fitText(ctx, achievement.title || '学习成就', 610), 58, 190);
  ctx.setFillStyle(theme.primary);
  ctx.setFontSize(20);
  ctx.fillText('真实学习数据 · 隐私友好展示', 58, 224);
}

function drawMetricCell(ctx, row, index, theme) {
  const column = index % 2;
  const line = Math.floor(index / 2);
  const x = column === 0 ? 58 : 382;
  const y = 480 + line * 84;
  roundRect(ctx, x, y, 310, 70, 14, index % 2 === 0 ? theme.soft : theme.accentSoft);
  ctx.setFillStyle(COMMON_COLORS.secondary);
  ctx.setFontSize(17);
  ctx.fillText(row[0], x + 17, y + 24);
  ctx.setFillStyle(COMMON_COLORS.ink);
  ctx.setFontSize(25);
  ctx.fillText(fitText(ctx, row[1], 276), x + 17, y + 56);
}

function drawAchievementBody(ctx, achievement, theme) {
  roundRect(ctx, 34, 278, 682, 418, 28, COMMON_COLORS.paper);
  roundRect(ctx, 54, 301, 12, 54, 6, theme.accent);
  ctx.setFillStyle(theme.primary);
  ctx.setFontSize(20);
  ctx.fillText('本次成长记录', 82, 326);
  ctx.setFillStyle(COMMON_COLORS.muted);
  ctx.setFontSize(18);
  ctx.fillText(theme.note, 82, 352);

  ctx.setFillStyle(COMMON_COLORS.ink);
  ctx.setFontSize(42);
  wrap(ctx, achievement.headline || '完成新的学习成就', 600, 2)
    .forEach((line, index) => ctx.fillText(line, 58, 402 + index * 49));
  fillLine(ctx, 58, 464, 634, COMMON_COLORS.border, 2);

  const rows = metricRows(achievement).slice(0, 4);
  rows.forEach((row, index) => drawMetricCell(ctx, row, index, theme));

  if (achievement.category === 'challenge' && achievement.question_title) {
    roundRect(ctx, 58, 574, 634, 86, 14, '#FFF9F7');
    ctx.setFillStyle(theme.primary);
    ctx.setFontSize(17);
    ctx.fillText('挑战题目', 75, 601);
    ctx.setFillStyle(COMMON_COLORS.secondary);
    ctx.setFontSize(19);
    wrap(ctx, achievement.question_title, 585, 2)
      .forEach((line, index) => ctx.fillText(line, 75, 626 + index * 23));
  }
}

function drawQrFooter(ctx, code, theme) {
  roundRect(ctx, 34, 724, 682, 222, 28, COMMON_COLORS.paper);
  roundRect(ctx, 54, 744, 182, 182, 22, theme.soft);
  roundRect(ctx, 67, 757, 156, 156, 16, COMMON_COLORS.paper);
  ctx.drawImage(code, 75, 765, 140, 140);

  ctx.setFillStyle(COMMON_COLORS.ink);
  ctx.setFontSize(30);
  ctx.fillText('扫码免费体验', 266, 780);
  ctx.setFillStyle(COMMON_COLORS.secondary);
  ctx.setFontSize(21);
  ctx.fillText('选择题、口算不限次数', 266, 823);
  ctx.fillText('联系潘潘老师加入', 266, 856);
  roundRect(ctx, 266, 878, 380, 38, 19, theme.accentSoft);
  ctx.setFillStyle(theme.primary);
  ctx.setFontSize(18);
  ctx.fillText('保存海报分享到朋友圈', 286, 903);

  ctx.setFillStyle(COMMON_COLORS.muted);
  ctx.setFontSize(17);
  ctx.fillText('公开海报仅显示匿名学习数据', 36, 974);
  ctx.setTextAlign('right');
  ctx.fillText('番番记录 · 数据来自服务端真实学习记录', 716, 974);
  ctx.setTextAlign('left');
}

function exportCanvas(canvasId, page) {
  return new Promise((resolve, reject) => uni.canvasToTempFilePath({
    canvasId,
    x: 0,
    y: 0,
    width: ACHIEVEMENT_POSTER_WIDTH,
    height: ACHIEVEMENT_POSTER_HEIGHT,
    destWidth: 1080,
    destHeight: 1440,
    fileType: 'png',
    quality: 1,
    success: (result) => resolve(result.tempFilePath),
    fail: reject,
  }, page));
}

export async function renderAchievementPoster({
  page,
  achievement,
  codePath,
  canvasId = 'achievementPosterCanvas',
}) {
  if (!achievement) throw new Error('请选择一项真实成就');
  const code = await getImage(codePath);
  const theme = posterTheme(achievement.category);
  const ctx = uni.createCanvasContext(canvasId, page);
  ctx.setTextAlign('left');
  drawNotebookBackground(ctx, theme);
  drawHeader(ctx, achievement, theme);
  drawAchievementBody(ctx, achievement, theme);
  drawQrFooter(ctx, code, theme);
  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 90)));
  return exportCanvas(canvasId, page);
}

export function saveAchievementPoster(filePath) {
  return saveImageToAlbum(filePath);
}

export function albumPermissionDenied(error) {
  return isAlbumPermissionError(error);
}
