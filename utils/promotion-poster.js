export const PROMOTION_POSTER_WIDTH = 750;
export const PROMOTION_POSTER_HEIGHT = 1000;

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

function wrap(ctx, value, maxWidth, maxLines = 3) {
  const lines = [];
  let current = '';
  for (const char of Array.from(String(value || ''))) {
    if (current && ctx.measureText(current + char).width > maxWidth) {
      lines.push(current);
      current = char;
      if (lines.length === maxLines) break;
    } else current += char;
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines;
}

function drawCode(ctx, code, x, y, size) {
  roundRect(ctx, x - 13, y - 13, size + 26, size + 26, 18, '#FFFFFF');
  ctx.drawImage(code, x, y, size, size);
}

function drawCover(ctx, image, x, y, width, height) {
  if (!image?.path || !image.width || !image.height) return;
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = Math.max(0, (image.height - sh) * 0.38);
  }
  ctx.drawImage(image.path, sx, sy, sw, sh, x, y, width, height);
}

function drawChallengeQuestion(ctx, question) {
  roundRect(ctx, 48, 478, 654, 230, 18, '#FFFFFF');
  if (question) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(58, 488, 634, 210);
    ctx.clip();
    drawCover(ctx, question, 58, 488, 634, 210);
    ctx.restore();
  } else {
    ctx.setFillStyle('#E8DED0');
    ctx.fillRect(58, 488, 634, 210);
    ctx.setFillStyle('#806E5E');
    ctx.setTextAlign('center');
    ctx.setFontSize(22);
    ctx.fillText('原题图片', 375, 604);
    ctx.setTextAlign('left');
  }
  roundRect(ctx, 62, 498, 154, 34, 8, 'rgba(23,58,52,.88)');
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(16);
  ctx.fillText('原题节选 · 放大', 78, 522);
}

function drawMentalPoster(ctx, item, code) {
  const bg = ctx.createLinearGradient(0, 0, 750, 1000);
  bg.addColorStop(0, '#0E332D');
  bg.addColorStop(0.62, '#09241F');
  bg.addColorStop(1, '#061714');
  ctx.setFillStyle(bg);
  ctx.fillRect(0, 0, 750, 1000);

  ctx.setStrokeStyle('rgba(196,224,216,.10)');
  ctx.setLineWidth(1);
  for (let x = 30; x < 750; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1000); ctx.stroke(); }
  for (let y = 32; y < 1000; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(750, y); ctx.stroke(); }
  ctx.setFillStyle('#E4BE62');
  ctx.fillRect(0, 0, 13, 1000);
  ctx.fillRect(52, 62, 86, 7);

  ctx.setTextAlign('left');
  ctx.setFillStyle('#A8D0C6');
  ctx.setFontSize(18);
  ctx.fillText('PANPAN WEEKLY MENTAL CHAMPION', 52, 104);
  ctx.setFillStyle('#F5EDDC');
  ctx.setFontSize(39);
  ctx.fillText('本周口算王 · 新榜首', 52, 160);

  ctx.setFillStyle('rgba(228,190,98,.11)');
  ctx.beginPath();
  ctx.arc(579, 236, 154, 0, Math.PI * 2);
  ctx.fill();
  ctx.setStrokeStyle('rgba(228,190,98,.5)');
  ctx.setLineWidth(2);
  ctx.beginPath();
  ctx.arc(579, 236, 122, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setTextAlign('center');
  ctx.setFillStyle('#E4BE62');
  ctx.setFontSize(118);
  ctx.fillText('01', 579, 271);
  ctx.setFontSize(17);
  ctx.fillText('WEEKLY RANK', 579, 316);

  ctx.setTextAlign('left');
  ctx.setFillStyle('#E4BE62');
  ctx.setFontSize(22);
  ctx.fillText(item.battle_label || '口算挑战', 52, 246);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(66);
  ctx.fillText(item.student_name || '同学', 52, 326);
  ctx.setFillStyle('#9FC5BC');
  ctx.setFontSize(22);
  ctx.fillText('凭真实成绩登上本周榜首', 52, 368);

  ctx.setFillStyle('#F8F1E2');
  ctx.setFontSize(142);
  ctx.fillText(String(item.score || 0), 45, 530);
  ctx.setFillStyle('#E4BE62');
  ctx.setFontSize(20);
  ctx.fillText('SCORE / 本局得分', 54, 570);

  const metrics = [
    ['正确率', `${Number(item.accuracy || 0)}%`],
    ['答对', `${Number(item.correct_count || 0)}/${Number(item.total_questions || 20)}`],
    ['用时', `${Number(item.elapsed_seconds || 0)}秒`],
  ];
  metrics.forEach((metric, index) => {
    const x = 52 + index * 216;
    if (index) { ctx.setFillStyle('rgba(168,208,198,.2)'); ctx.fillRect(x - 25, 616, 1, 80); }
    ctx.setFillStyle('#7FA89E');
    ctx.setFontSize(18);
    ctx.fillText(metric[0], x, 640);
    ctx.setFillStyle('#F5EDDC');
    ctx.setFontSize(36);
    ctx.fillText(metric[1], x, 687);
  });

  roundRect(ctx, 42, 746, 666, 190, 26, '#EFE6D4');
  drawCode(ctx, code, 72, 779, 124);
  ctx.setFillStyle('#163A33');
  ctx.setFontSize(29);
  ctx.fillText('扫码挑战本周榜首', 245, 808);
  ctx.setFillStyle('#587069');
  ctx.setFontSize(20);
  ctx.fillText('20 道题 · 比正确，也比速度', 245, 850);
  ctx.setFillStyle('#9C731F');
  ctx.setFontSize(19);
  ctx.fillText('潘潘老师数学课堂', 245, 890);
  ctx.setFillStyle('#76968E');
  ctx.setFontSize(17);
  ctx.fillText('公开海报不展示全名、学校和班级', 52, 972);
}

function drawChallengePoster(ctx, item, code, question) {
  ctx.setFillStyle('#F3EADC');
  ctx.fillRect(0, 0, 750, 1000);
  ctx.setStrokeStyle('rgba(47,66,59,.09)');
  ctx.setLineWidth(1);
  for (let x = 28; x < 750; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1000); ctx.stroke(); }
  for (let y = 28; y < 1000; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(750, y); ctx.stroke(); }
  ctx.setFillStyle('#173A34');
  ctx.fillRect(0, 0, 750, 154);
  ctx.setFillStyle('#C85F3B');
  ctx.fillRect(0, 154, 16, 846);

  ctx.setTextAlign('left');
  ctx.setFillStyle('#A9CFC5');
  ctx.setFontSize(18);
  ctx.fillText('PANPAN · PROBLEM SOLVED', 48, 60);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(38);
  ctx.fillText('压轴挑战 · 通关记录', 48, 113);

  roundRect(ctx, 548, 184, 140, 140, 18, '#C85F3B');
  ctx.setTextAlign('center');
  ctx.setFillStyle('#FFF5E7');
  ctx.setFontSize(25);
  ctx.fillText('已', 618, 235);
  ctx.fillText('攻', 618, 272);
  ctx.fillText('克', 618, 309);

  ctx.setTextAlign('left');
  ctx.setFillStyle('#A84D32');
  ctx.setFontSize(20);
  ctx.fillText(item.question_type_label || '压轴题', 52, 220);
  ctx.setFillStyle('#173A34');
  ctx.setFontSize(67);
  ctx.fillText(item.student_name || '同学', 52, 304);
  ctx.setFillStyle('#5F6E68');
  ctx.setFontSize(23);
  ctx.fillText('独立思考，完整作答，成功通关', 52, 350);

  ctx.setFillStyle('#173A34');
  ctx.setFontSize(42);
  wrap(ctx, item.headline || '成功攻下一道压轴题', 620, 1).forEach((line) => ctx.fillText(line, 52, 425));
  ctx.setFillStyle('#725F4E');
  ctx.setFontSize(18);
  wrap(ctx, item.question_title || '压轴挑战', 620, 1).forEach((line) => ctx.fillText(line, 52, 461));

  drawChallengeQuestion(ctx, question);
  ctx.setFillStyle('#C85F3B');
  ctx.fillRect(52, 735, 104, 6);
  ctx.setFillStyle('#7D6A59');
  ctx.setFontSize(18);
  ctx.fillText('累计通关', 52, 774);
  ctx.setFillStyle('#173A34');
  ctx.setFontSize(48);
  ctx.fillText(String(Number(item.passed_count || 1)), 52, 824);
  ctx.setFontSize(21);
  ctx.fillText('道压轴题', 103, 820);
  ctx.setFillStyle('#7D6A59');
  ctx.setFontSize(18);
  ctx.fillText('题目来源', 285, 774);
  ctx.setFillStyle('#173A34');
  ctx.setFontSize(22);
  wrap(ctx, item.source_label || '潘潘老师精选', 340, 1).forEach((line) => ctx.fillText(line, 285, 816));

  roundRect(ctx, 42, 850, 666, 112, 20, '#173A34');
  drawCode(ctx, code, 66, 870, 72);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(25);
  ctx.fillText('扫码体验真实数学挑战', 178, 893);
  ctx.setFillStyle('#B9D8D0');
  ctx.setFontSize(17);
  ctx.fillText('潘潘老师数学课堂 · 思路比答案更重要', 178, 927);
  ctx.setFillStyle('#806E5E');
  ctx.setFontSize(15);
  ctx.fillText('公开海报不展示全名、学校和班级', 52, 988);
}

function exportCanvas(canvasId, page) {
  return new Promise((resolve, reject) => uni.canvasToTempFilePath({
    canvasId,
    x: 0,
    y: 0,
    width: PROMOTION_POSTER_WIDTH,
    height: PROMOTION_POSTER_HEIGHT,
    destWidth: 1080,
    destHeight: 1440,
    fileType: 'png',
    quality: 1,
    success: (result) => resolve(result.tempFilePath),
    fail: reject,
  }, page));
}

export async function renderPromotionPoster({ page, promotion, codePath, questionImagePath = '', canvasId = 'promotionPosterCanvas' }) {
  if (!promotion) throw new Error('请选择宣传事件');
  if (!codePath) throw new Error('小程序码尚未生成');
  const code = await getImage(codePath);
  let question = null;
  if (promotion.event_type === 'challenge_pass' && questionImagePath) {
    try {
      question = await new Promise((resolve, reject) => uni.getImageInfo({
        src:questionImagePath,
        success:(result) => resolve({
          path:result.path || result.tempFilePath || questionImagePath,
          width:result.width,
          height:result.height,
        }),
        fail:reject,
      }));
    } catch {}
  }
  const ctx = uni.createCanvasContext(canvasId, page);
  if (promotion.event_type === 'mental_first') drawMentalPoster(ctx, promotion, code);
  else drawChallengePoster(ctx, promotion, code, question);
  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 100)));
  return exportCanvas(canvasId, page);
}

export function savePromotionPoster(filePath) {
  return new Promise((resolve, reject) => uni.saveImageToPhotosAlbum({ filePath, success:resolve, fail:reject }));
}

export function promotionPosterPermissionDenied(error) {
  return /auth deny|authorize|permission|scope\.writePhotosAlbum|用户拒绝|权限/i.test(String(error?.errMsg || error?.message || error || ''));
}
