export const MENTAL_POSTER_WIDTH = 750;
export const MENTAL_POSTER_HEIGHT = 1000;

export function mentalArenaAward(accuracy) {
  const value = Number(accuracy || 0);
  if (value >= 100) return { kind: 'crown', symbol: '👑', label: '满分皇冠', headline: '二十题，全数拿下' };
  if (value >= 90) return { kind: 'trophy', symbol: '🏆', label: '金杯战绩', headline: '稳定、迅速、接近满分' };
  if (value >= 80) return { kind: 'medal', symbol: '🥇', label: '进阶奖章', headline: '今天的手感值得记录' };
  return { kind: 'spark', symbol: '✦', label: '突破时刻', headline: '完成挑战，就是新的起点' };
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

function drawCrown(ctx, x, y, scale, color) {
  ctx.beginPath();
  ctx.moveTo(x, y + 58 * scale);
  ctx.lineTo(x + 12 * scale, y + 8 * scale);
  ctx.lineTo(x + 48 * scale, y + 42 * scale);
  ctx.lineTo(x + 78 * scale, y);
  ctx.lineTo(x + 108 * scale, y + 42 * scale);
  ctx.lineTo(x + 144 * scale, y + 8 * scale);
  ctx.lineTo(x + 156 * scale, y + 58 * scale);
  ctx.closePath();
  ctx.setFillStyle(color);
  ctx.fill();
  roundRect(ctx, x + 8 * scale, y + 64 * scale, 140 * scale, 22 * scale, 7 * scale, color);
}

function drawTrophy(ctx, x, y, scale, color) {
  ctx.setStrokeStyle(color);
  ctx.setLineWidth(9 * scale);
  ctx.beginPath();
  ctx.moveTo(x + 18 * scale, y + 24 * scale);
  ctx.quadraticCurveTo(x - 8 * scale, y + 24 * scale, x + 2 * scale, y + 66 * scale);
  ctx.quadraticCurveTo(x + 12 * scale, y + 88 * scale, x + 38 * scale, y + 78 * scale);
  ctx.moveTo(x + 120 * scale, y + 24 * scale);
  ctx.quadraticCurveTo(x + 146 * scale, y + 24 * scale, x + 136 * scale, y + 66 * scale);
  ctx.quadraticCurveTo(x + 126 * scale, y + 88 * scale, x + 100 * scale, y + 78 * scale);
  ctx.stroke();
  roundRect(ctx, x + 18 * scale, y + 10 * scale, 102 * scale, 76 * scale, 17 * scale, color);
  roundRect(ctx, x + 62 * scale, y + 82 * scale, 15 * scale, 34 * scale, 3 * scale, color);
  roundRect(ctx, x + 38 * scale, y + 112 * scale, 63 * scale, 15 * scale, 5 * scale, color);
}

function drawMedal(ctx, x, y, scale, color) {
  ctx.setFillStyle(color);
  ctx.beginPath();
  ctx.moveTo(x + 28 * scale, y);
  ctx.lineTo(x + 62 * scale, y);
  ctx.lineTo(x + 82 * scale, y + 56 * scale);
  ctx.lineTo(x + 46 * scale, y + 72 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 78 * scale, y);
  ctx.lineTo(x + 112 * scale, y);
  ctx.lineTo(x + 94 * scale, y + 72 * scale);
  ctx.lineTo(x + 58 * scale, y + 56 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 70 * scale, y + 88 * scale, 43 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpark(ctx, x, y, scale, color) {
  ctx.setFillStyle(color);
  ctx.beginPath();
  ctx.moveTo(x + 65 * scale, y);
  ctx.lineTo(x + 82 * scale, y + 50 * scale);
  ctx.lineTo(x + 130 * scale, y + 66 * scale);
  ctx.lineTo(x + 82 * scale, y + 82 * scale);
  ctx.lineTo(x + 65 * scale, y + 132 * scale);
  ctx.lineTo(x + 48 * scale, y + 82 * scale);
  ctx.lineTo(x, y + 66 * scale);
  ctx.lineTo(x + 48 * scale, y + 50 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawAward(ctx, kind, x, y, scale, color) {
  if (kind === 'crown') return drawCrown(ctx, x, y, scale, color);
  if (kind === 'trophy') return drawTrophy(ctx, x, y, scale, color);
  if (kind === 'medal') return drawMedal(ctx, x, y, scale, color);
  return drawSpark(ctx, x, y, scale, color);
}

function exportCanvas(canvasId, page) {
  return new Promise((resolve, reject) => uni.canvasToTempFilePath({
    canvasId,
    x: 0,
    y: 0,
    width: MENTAL_POSTER_WIDTH,
    height: MENTAL_POSTER_HEIGHT,
    destWidth: 1080,
    destHeight: 1440,
    fileType: 'png',
    quality: 1,
    success: (result) => resolve(result.tempFilePath),
    fail: reject,
  }, page));
}

function resultDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export async function renderMentalArenaPoster({ page, result, codePath, canvasId = 'mentalArenaPosterCanvas' }) {
  if (!result) throw new Error('缺少本局成绩');
  const code = await getImage(codePath);
  const total = Number(result.total_questions || 20);
  const correct = Number(result.correct_count || 0);
  const accuracy = total ? Math.round(correct * 100 / total) : 0;
  const award = mentalArenaAward(accuracy);
  const ctx = uni.createCanvasContext(canvasId, page);

  const background = ctx.createLinearGradient(0, 0, 750, 1000);
  background.addColorStop(0, '#102D27');
  background.addColorStop(0.58, '#0B211D');
  background.addColorStop(1, '#071714');
  ctx.setFillStyle(background);
  ctx.fillRect(0, 0, 750, 1000);

  ctx.setFillStyle('rgba(236,201,104,0.07)');
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if ((row + col) % 3 === 0) ctx.fillRect(38 + col * 86, 34 + row * 83, 3, 3);
    }
  }
  ctx.setFillStyle('#E7C365');
  ctx.fillRect(0, 0, 14, 1000);
  ctx.fillRect(52, 58, 76, 6);

  ctx.setTextAlign('left');
  ctx.setFillStyle('#9FCBC0');
  ctx.setFontSize(19);
  ctx.fillText('PANPAN · MENTAL ARENA', 52, 100);
  ctx.setFillStyle('#F6F1E4');
  ctx.setFontSize(34);
  ctx.fillText(result.display_name || '同学', 52, 155);
  ctx.setFillStyle('#E7C365');
  ctx.setFontSize(22);
  ctx.fillText(`${result.battle_label || '口算挑战'} · ${award.label}`, 52, 194);

  ctx.setFillStyle('rgba(231,195,101,0.12)');
  ctx.beginPath();
  ctx.arc(590, 176, 126, 0, Math.PI * 2);
  ctx.fill();
  drawAward(ctx, award.kind, 512, 116, 1, '#E7C365');

  ctx.setFillStyle('#9FCBC0');
  ctx.setFontSize(22);
  ctx.fillText('本局得分', 52, 286);
  ctx.setFillStyle('#FFF8E8');
  ctx.setFontSize(154);
  ctx.fillText(String(result.score || 0), 42, 424);
  ctx.setFillStyle('#E7C365');
  ctx.setFontSize(31);
  ctx.fillText(award.headline, 52, 472);

  ctx.setStrokeStyle('rgba(159,203,192,0.22)');
  ctx.setLineWidth(2);
  ctx.beginPath();
  ctx.moveTo(52, 520);
  ctx.lineTo(698, 520);
  ctx.stroke();
  const metrics = [
    ['正确率', `${accuracy}%`],
    ['答对', `${correct}/${total}`],
    ['用时', `${Number(result.elapsed_seconds || 0)}秒`],
  ];
  metrics.forEach((metric, index) => {
    const x = 52 + index * 218;
    ctx.setFillStyle('#82AAA0');
    ctx.setFontSize(19);
    ctx.fillText(metric[0], x, 568);
    ctx.setFillStyle('#F7F1E1');
    ctx.setFontSize(38);
    ctx.fillText(metric[1], x, 618);
  });

  roundRect(ctx, 52, 670, 646, 244, 28, '#F2ECDD');
  roundRect(ctx, 76, 694, 174, 174, 21, '#FFFFFF');
  ctx.drawImage(code, 88, 706, 150, 150);
  ctx.setFillStyle('#173B34');
  ctx.setFontSize(31);
  ctx.fillText('扫码来挑战', 286, 740);
  ctx.setFillStyle('#526B64');
  ctx.setFontSize(21);
  ctx.fillText('20 道题，比正确，也比速度', 286, 784);
  const rankText = result.rank
    ? `历史榜第 ${result.rank} 名${result.participant_count ? ` · 共 ${result.participant_count} 人` : ''}`
    : '完成一局，留下真实学习记录';
  ctx.setFillStyle('#173B34');
  ctx.setFontSize(22);
  ctx.fillText(rankText, 286, 830);
  ctx.setFillStyle('#8A806D');
  ctx.setFontSize(18);
  ctx.fillText(`${resultDate(result.completed_at)} · 数据来自真实挑战`, 286, 870);

  ctx.setFillStyle('#75978F');
  ctx.setFontSize(18);
  ctx.fillText('番番记录 · 公开海报不含全名、学校和班级', 52, 962);
  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 100)));
  return exportCanvas(canvasId, page);
}

export function saveMentalArenaPoster(filePath) {
  return new Promise((resolve, reject) => uni.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject }));
}

export function mentalPosterPermissionDenied(error) {
  return /auth deny|authorize|permission|scope\.writePhotosAlbum|用户拒绝|权限/i.test(String(error?.errMsg || error?.message || error || ''));
}
