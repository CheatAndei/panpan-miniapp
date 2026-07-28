import { isAlbumPermissionError, saveImageToAlbum } from './photo-album';

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

function borderedRoundRect(ctx, x, y, width, height, radius, fill, border, lineWidth = 2) {
  roundRect(ctx, x, y, width, height, radius, fill);
  ctx.setStrokeStyle(border);
  ctx.setLineWidth(lineWidth);
  ctx.stroke();
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
  borderedRoundRect(ctx, 42, 372, 666, 300, 22, '#FFFFFF', '#F1D8C8', 3);
  if (question) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(56, 386, 638, 272);
    ctx.clip();
    drawCover(ctx, question, 56, 386, 638, 272);
    ctx.restore();
  } else {
    ctx.setFillStyle('#FFF0E5');
    ctx.fillRect(56, 386, 638, 272);
    ctx.setFillStyle('#9A7561');
    ctx.setTextAlign('center');
    ctx.setFontSize(22);
    ctx.fillText('原题图片', 375, 535);
    ctx.setTextAlign('left');
  }
  roundRect(ctx, 58, 388, 174, 38, 10, '#F39A6B');
  ctx.setFillStyle('#4A2F25');
  ctx.setFontSize(16);
  ctx.fillText('原题节选 · 放大展示', 74, 413);
}

function drawMentalPoster(ctx, item, code) {
  ctx.setFillStyle('#FFF9EC');
  ctx.fillRect(0, 0, 750, 1000);

  ctx.setFillStyle('#EAF4FF');
  ctx.beginPath();
  ctx.arc(694, 112, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.setFillStyle('#F6D77A');
  ctx.beginPath();
  ctx.arc(680, 138, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.setFillStyle('#D7E9FB');
  for (let x = 54; x < 710; x += 44) {
    for (let y = 45; y < 950; y += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.setFillStyle('#6FA9E6');
  ctx.fillRect(0, 0, 14, 1000);

  ctx.setTextAlign('left');
  ctx.setFillStyle('#4C8FD8');
  ctx.setFontSize(18);
  ctx.fillText('PANPAN · WEEKLY MATH STAR', 48, 62);
  ctx.setFillStyle('#1F3A56');
  ctx.setFontSize(50);
  ctx.fillText('本周口算王', 48, 122);

  borderedRoundRect(ctx, 586, 48, 116, 116, 58, '#FFFFFF', '#B9D9F7', 3);
  ctx.setTextAlign('center');
  ctx.setFillStyle('#4C8FD8');
  ctx.setFontSize(50);
  ctx.fillText('01', 644, 112);
  ctx.setFillStyle('#6F8294');
  ctx.setFontSize(12);
  ctx.fillText('WEEKLY', 644, 137);

  ctx.setTextAlign('left');
  roundRect(ctx, 48, 154, 116, 38, 19, '#DDEEFF');
  ctx.setFillStyle('#326FAE');
  ctx.setFontSize(16);
  ctx.fillText(item.battle_label || '口算挑战', 70, 180);
  ctx.setFillStyle('#1F3A56');
  ctx.setFontSize(68);
  ctx.fillText(item.student_name || '同学', 48, 252);
  ctx.setFillStyle('#6F8294');
  ctx.setFontSize(19);
  ctx.fillText('20 题快算 · 排名由真实成绩生成', 50, 282);

  borderedRoundRect(ctx, 40, 312, 670, 254, 28, '#DDEEFF', '#B9D9F7', 3);
  ctx.setFillStyle('#326FAE');
  ctx.setFontSize(16);
  ctx.fillText('本局得分 / SCORE', 66, 350);
  ctx.setFillStyle('#1F3A56');
  ctx.setFontSize(138);
  ctx.fillText(String(item.score || 0), 60, 456);
  borderedRoundRect(ctx, 486, 330, 192, 120, 18, '#FFFFFF', '#B9D9F7', 2);
  ctx.setTextAlign('center');
  ctx.setFillStyle('#4C8FD8');
  ctx.setFontSize(12);
  ctx.fillText('WEEKLY BEST', 582, 356);
  ctx.setFillStyle('#1F3A56');
  ctx.setFontSize(24);
  ctx.fillText('本周榜首', 582, 390);
  ctx.setFillStyle('#6F8294');
  ctx.setFontSize(14);
  ctx.fillText(
    `${Number(item.correct_count || 0)}/${Number(item.total_questions || 20)} 全部答对`,
    582,
    422,
  );
  ctx.setTextAlign('left');

  const metrics = [
    ['正确率', `${Number(item.accuracy || 0)}%`],
    ['答对', `${Number(item.correct_count || 0)}/${Number(item.total_questions || 20)}`],
    ['用时', `${Number(item.elapsed_seconds || 0)}秒`],
  ];
  borderedRoundRect(ctx, 60, 468, 630, 78, 16, '#FFFFFF', '#C9DFF3', 2);
  metrics.forEach((metric, index) => {
    const x = 82 + index * 204;
    if (index) {
      ctx.setFillStyle('#D8E7F4');
      ctx.fillRect(x - 24, 482, 2, 50);
    }
    ctx.setFillStyle('#7B8D9D');
    ctx.setFontSize(14);
    ctx.fillText(metric[0], x, 496);
    ctx.setFillStyle('#1F3A56');
    ctx.setFontSize(28);
    ctx.fillText(metric[1], x, 530);
  });

  roundRect(ctx, 40, 592, 670, 66, 18, '#FFF0BF');
  ctx.setFillStyle('#6A5321');
  ctx.setFontSize(22);
  ctx.fillText('把速度练成底气，每一次认真练习都算数', 66, 633);

  borderedRoundRect(ctx, 40, 688, 670, 254, 24, '#FFFFFF', '#D8E7F4', 2);
  drawCode(ctx, code, 70, 756, 120);
  ctx.setFillStyle('#1F3A56');
  ctx.setFontSize(28);
  ctx.fillText('扫码挑战本周口算王', 224, 780);
  ctx.setFillStyle('#6F8294');
  ctx.setFontSize(19);
  ctx.fillText('20 道题 · 比正确，也比速度', 224, 824);
  ctx.setFillStyle('#4C8FD8');
  ctx.setFontSize(18);
  ctx.fillText('潘潘老师数学课堂', 224, 868);
  ctx.setFillStyle('#8B98A5');
  ctx.setFontSize(15);
  ctx.fillText('公开海报不展示全名、学校和班级', 52, 978);
}

function drawChallengePoster(ctx, item, code, question) {
  ctx.setFillStyle('#FFF8EE');
  ctx.fillRect(0, 0, 750, 1000);
  ctx.setFillStyle('#FFE9DA');
  ctx.beginPath();
  ctx.arc(682, 90, 166, 0, Math.PI * 2);
  ctx.fill();
  ctx.setFillStyle('#FFD8BF');
  ctx.beginPath();
  ctx.arc(698, 96, 72, 0, Math.PI * 2);
  ctx.fill();
  ctx.setStrokeStyle('#F6E3D6');
  ctx.setLineWidth(1);
  for (let x = 44; x < 740; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, 328);
    ctx.lineTo(x, 968);
    ctx.stroke();
  }
  ctx.setFillStyle('#F39A6B');
  ctx.fillRect(0, 0, 14, 1000);

  ctx.setTextAlign('left');
  ctx.setFillStyle('#D36F43');
  ctx.setFontSize(18);
  ctx.fillText('PANPAN · BREAKTHROUGH REPORT', 48, 62);
  ctx.setFillStyle('#4A2F25');
  ctx.setFontSize(50);
  ctx.fillText('压轴通关喜报', 48, 122);

  borderedRoundRect(ctx, 574, 48, 130, 78, 18, '#FFFFFF', '#F2B493', 3);
  ctx.setTextAlign('center');
  ctx.setFillStyle('#D36F43');
  ctx.setFontSize(14);
  ctx.fillText('VERIFIED', 639, 78);
  ctx.setFontSize(23);
  ctx.fillText('通 关', 639, 108);

  ctx.setTextAlign('left');
  roundRect(ctx, 48, 150, 110, 36, 18, '#FFE2D1');
  ctx.setFillStyle('#B95835');
  ctx.setFontSize(16);
  ctx.fillText(item.question_type_label || '压轴题', 70, 175);
  ctx.setFillStyle('#4A2F25');
  ctx.setFontSize(62);
  ctx.fillText(item.student_name || '同学', 48, 244);
  ctx.setFillStyle('#8C6C5D');
  ctx.setFontSize(19);
  ctx.fillText('独立思考 · 完整作答 · 成功通关', 50, 276);

  ctx.setFillStyle('#4A2F25');
  ctx.setFontSize(36);
  wrap(ctx, item.headline || '成功攻下一道压轴题', 630, 1).forEach((line) => ctx.fillText(line, 48, 326));
  ctx.setFillStyle('#8C6C5D');
  ctx.setFontSize(17);
  wrap(ctx, item.question_title || '压轴挑战', 630, 1).forEach((line) => ctx.fillText(line, 48, 356));

  drawChallengeQuestion(ctx, question);
  borderedRoundRect(ctx, 42, 700, 206, 108, 20, '#FFFFFF', '#F1D8C8', 2);
  borderedRoundRect(ctx, 266, 700, 442, 108, 20, '#FFFFFF', '#F1D8C8', 2);
  ctx.setFillStyle('#9A7561');
  ctx.setFontSize(15);
  ctx.fillText('累计通关', 64, 735);
  ctx.fillText('题目来源', 290, 735);
  ctx.setFillStyle('#4A2F25');
  ctx.setFontSize(38);
  ctx.fillText(String(Number(item.passed_count || 1)), 64, 784);
  ctx.setFontSize(17);
  ctx.fillText('道压轴题', 110, 780);
  ctx.setFontSize(20);
  wrap(ctx, item.source_label || '潘潘老师精选', 380, 1).forEach((line) => ctx.fillText(line, 290, 780));

  borderedRoundRect(ctx, 42, 836, 666, 120, 22, '#FFF0E5', '#F2B493', 2);
  drawCode(ctx, code, 62, 854, 84);
  ctx.setFillStyle('#4A2F25');
  ctx.setFontSize(24);
  ctx.fillText('扫码体验真实数学挑战', 184, 876);
  ctx.setFillStyle('#8C6C5D');
  ctx.setFontSize(16);
  ctx.fillText('思路比答案更重要 · 潘潘老师数学课堂', 184, 915);
  ctx.setFillStyle('#9A7561');
  ctx.setFontSize(15);
  ctx.fillText('公开海报不展示全名、学校和班级', 52, 986);
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
  return saveImageToAlbum(filePath);
}

export function promotionPosterPermissionDenied(error) {
  return isAlbumPermissionError(error);
}
