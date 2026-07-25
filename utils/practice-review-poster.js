import { saveImageToAlbum } from './photo-album';

export const PRACTICE_REVIEW_POSTER_WIDTH = 750;
export const PRACTICE_REVIEW_POSTER_HEIGHT = 1000;

function imageInfo(src) {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({ src, success: resolve, fail: reject });
  });
}

function orientationDegrees(orientation) {
  const value = String(orientation || '').toLowerCase();
  if (value === 'right' || value === 'right-mirrored') return 90;
  if (value === 'down' || value === 'down-mirrored') return 180;
  if (value === 'left' || value === 'left-mirrored') return 270;
  return 0;
}

export async function inspectPracticePhoto(src) {
  const info = await imageInfo(src);
  return {
    path: info.path || info.tempFilePath || src,
    width: Number(info.width || 1),
    height: Number(info.height || 1),
    exifRotation: orientationDegrees(info.orientation),
    exifMirrored: String(info.orientation || '').toLowerCase().includes('mirrored'),
  };
}

function drawCover(ctx, photo, x, y, width, height, manualRotation = 0) {
  const rotation = ((Number(photo.exifRotation || 0) + Number(manualRotation || 0)) % 360 + 360) % 360;
  const swap = rotation === 90 || rotation === 270;
  const sourceWidth = swap ? photo.height : photo.width;
  const sourceHeight = swap ? photo.width : photo.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = photo.width * scale;
  const drawHeight = photo.height * scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation * Math.PI / 180);
  if (photo.exifMirrored) ctx.scale(-1, 1);
  ctx.drawImage(photo.path, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
  ctx.setStrokeStyle('#FFFFFF');
  ctx.setLineWidth(8);
  ctx.strokeRect(x, y, width, height);
}

function exportCanvas(canvasId, page) {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvasId,
      x: 0,
      y: 0,
      width: PRACTICE_REVIEW_POSTER_WIDTH,
      height: PRACTICE_REVIEW_POSTER_HEIGHT,
      destWidth: 1500,
      destHeight: 2000,
      fileType: 'png',
      quality: 1,
      success: (result) => resolve(result.tempFilePath),
      fail: reject,
    }, page);
  });
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const character of Array.from(String(text || ''))) {
    const next = line + character;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = character;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderPracticeReviewPoster({
  page,
  canvasId = 'practiceReviewPosterCanvas',
  studentName,
  practiceDate,
  wrongNumbers = [],
  photoPaths = [],
  rotations = [],
}) {
  if (!photoPaths.length) throw new Error('没有可用于海报的作业照片');
  const photos = await Promise.all(photoPaths.slice(0, 4).map(inspectPracticePhoto));
  const ctx = uni.createCanvasContext(canvasId, page);
  const allCorrect = wrongNumbers.length === 0;
  const encouragement = allCorrect ? '认真有回响，坚持会发光' : '发现问题，就是进步的开始';

  ctx.setFillStyle('#F7F0E5');
  ctx.fillRect(0, 0, 750, 1000);
  ctx.setFillStyle('#173A35');
  ctx.fillRect(0, 0, 750, 165);
  ctx.setFillStyle('#B9DDD2');
  ctx.setFontSize(19);
  ctx.fillText('PANPAN · DAILY PRACTICE', 46, 54);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(46);
  ctx.fillText(`${studentName || '同学'}的打卡记录`, 46, 112);
  ctx.setFillStyle('#D7EBE5');
  ctx.setFontSize(22);
  ctx.fillText(practiceDate || '', 48, 147);

  ctx.setFillStyle('#E9D8BC');
  ctx.fillRect(0, 165, 520, 835);
  const layouts = [
    { x: 42, y: 225, w: 430, h: 650, r: -2 },
    { x: 62, y: 245, w: 410, h: 620, r: 2 },
    { x: 45, y: 265, w: 420, h: 590, r: -1 },
    { x: 70, y: 285, w: 390, h: 560, r: 1 },
  ];
  photos.forEach((photo, index) => {
    const layout = layouts[Math.min(index, layouts.length - 1)];
    ctx.save();
    ctx.translate(layout.x + layout.w / 2, layout.y + layout.h / 2);
    ctx.rotate(layout.r * Math.PI / 180);
    ctx.translate(-(layout.x + layout.w / 2), -(layout.y + layout.h / 2));
    ctx.setShadow(0, 10, 20, 'rgba(63,48,30,.18)');
    ctx.setFillStyle('#FFFFFF');
    ctx.fillRect(layout.x - 7, layout.y - 7, layout.w + 14, layout.h + 22);
    ctx.setShadow(0, 0, 0, 'rgba(0,0,0,0)');
    drawCover(ctx, photo, layout.x, layout.y, layout.w, layout.h, rotations[index] || 0);
    ctx.restore();
  });

  ctx.setFillStyle('#FFFCF6');
  ctx.fillRect(520, 165, 230, 835);
  ctx.setFillStyle(allCorrect ? '#2F7D6B' : '#C75D54');
  ctx.fillRect(548, 224, 62, 7);
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(23);
  ctx.fillText('批改结果', 548, 274);
  ctx.setFontSize(40);
  ctx.setFillStyle(allCorrect ? '#2F7D6B' : '#C75D54');
  ctx.fillText(allCorrect ? '全对' : `错 ${wrongNumbers.length} 题`, 548, 330);

  ctx.setFillStyle('#697B76');
  ctx.setFontSize(21);
  ctx.fillText(allCorrect ? '保持节奏' : '错题号', 548, 390);
  ctx.setFillStyle('#183A36');
  ctx.setFontSize(28);
  const resultText = allCorrect ? '今天完成得很扎实' : wrongNumbers.map((value) => `${value}`).join('、');
  const resultLines = wrapText(ctx, resultText, 156).slice(0, 7);
  resultLines.forEach((line, index) => ctx.fillText(line, 548, 430 + index * 42));

  ctx.setFillStyle('#E6F1ED');
  ctx.fillRect(540, 742, 184, 168);
  ctx.setFillStyle('#2B6257');
  ctx.setFontSize(24);
  const encouragementLines = wrapText(ctx, encouragement, 142).slice(0, 4);
  encouragementLines.forEach((line, index) => ctx.fillText(line, 561, 790 + index * 38));

  ctx.setFillStyle('#746F66');
  ctx.setFontSize(19);
  ctx.fillText('学生记录', 548, 955);
  ctx.setFillStyle('#2F7D6B');
  ctx.fillRect(665, 944, 35, 4);

  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 120)));
  return exportCanvas(canvasId, page);
}

export function savePracticeReviewPoster(filePath) {
  return saveImageToAlbum(filePath);
}
