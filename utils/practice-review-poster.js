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

function drawCover(ctx, photo, x, y, width, height, manualRotation = 0, fit = 'contain') {
  const rotation = ((Number(photo.exifRotation || 0) + Number(manualRotation || 0)) % 360 + 360) % 360;
  const swap = rotation === 90 || rotation === 270;
  const sourceWidth = swap ? photo.height : photo.width;
  const sourceHeight = swap ? photo.width : photo.height;
  const scale = fit === 'cover'
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = photo.width * scale;
  const drawHeight = photo.height * scale;

  ctx.setFillStyle('#FFFFFF');
  ctx.fillRect(x, y, width, height);
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

export function practicePhotoLayouts(count) {
  const total = Math.max(1, Math.min(4, Number.parseInt(count, 10) || 1));
  const x = 48;
  const y = 234;
  const width = 438;
  const height = 638;
  const gap = 12;
  if (total === 1) return [{ x, y, w: width, h: height }];
  if (total === 2) {
    const rowHeight = Math.floor((height - gap) / 2);
    return [
      { x, y, w: width, h: rowHeight },
      { x, y: y + rowHeight + gap, w: width, h: rowHeight },
    ];
  }
  if (total === 3) {
    const topHeight = 370;
    const bottomHeight = height - topHeight - gap;
    const columnWidth = Math.floor((width - gap) / 2);
    return [
      { x, y, w: width, h: topHeight },
      { x, y: y + topHeight + gap, w: columnWidth, h: bottomHeight },
      { x: x + columnWidth + gap, y: y + topHeight + gap, w: columnWidth, h: bottomHeight },
    ];
  }
  const columnWidth = Math.floor((width - gap) / 2);
  const rowHeight = Math.floor((height - gap) / 2);
  return [
    { x, y, w: columnWidth, h: rowHeight },
    { x: x + columnWidth + gap, y, w: columnWidth, h: rowHeight },
    { x, y: y + rowHeight + gap, w: columnWidth, h: rowHeight },
    { x: x + columnWidth + gap, y: y + rowHeight + gap, w: columnWidth, h: rowHeight },
  ];
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

function truncateText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (ctx.measureText(value).width <= maxWidth) return value;
  let output = value;
  while (output && ctx.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
  return output ? `${output}…` : '…';
}

function wrapText(ctx, text, maxWidth, maxLines = Number.POSITIVE_INFINITY) {
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
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = truncateText(
    ctx,
    `${visible[maxLines - 1]}${lines.slice(maxLines).join('')}`,
    maxWidth,
  );
  return visible;
}

function drawPhotoFrame(ctx, photo, layout, rotation, index) {
  ctx.setShadow(0, 8, 18, 'rgba(49,94,168,.12)');
  ctx.setFillStyle('#FFFFFF');
  ctx.fillRect(layout.x - 4, layout.y - 4, layout.w + 8, layout.h + 8);
  ctx.setShadow(0, 0, 0, 'rgba(0,0,0,0)');
  drawCover(
    ctx,
    photo,
    layout.x,
    layout.y,
    layout.w,
    layout.h,
    rotation,
    'contain',
  );
  ctx.setFillStyle('#EAF2FF');
  ctx.fillRect(layout.x + 10, layout.y + 10, 48, 25);
  ctx.setFillStyle('#315EA8');
  ctx.setFontSize(13);
  ctx.fillText(String(index + 1).padStart(2, '0'), layout.x + 21, layout.y + 28);
}

export async function renderPracticeReviewPoster({
  page,
  canvasId = 'practiceReviewPosterCanvas',
  studentName,
  practiceDate,
  wrongNumbers = [],
  photoPaths = [],
  rotations = [],
  isCorrection = false,
  correctionRound = 1,
  totalCount = 0,
  correctCount,
}) {
  if (!photoPaths.length) throw new Error('没有可用于海报的作业照片');
  const photos = await Promise.all(photoPaths.slice(0, 4).map(inspectPracticePhoto));
  const ctx = uni.createCanvasContext(canvasId, page);
  const allCorrect = wrongNumbers.length === 0;
  const correctionComplete = Boolean(isCorrection) && allCorrect;
  const normalizedCorrectionRound = Math.max(1, Number.parseInt(correctionRound, 10) || 1);
  const brandLine = correctionComplete ? 'PANPAN · TIMELY CORRECTION' : 'PANPAN · DAILY PRACTICE';
  const posterTitle = correctionComplete
    ? `${studentName || '同学'}的及时订正`
    : `${studentName || '同学'}的打卡记录`;
  const resultHeading = correctionComplete ? '及时订正' : '批改结果';
  const resultSummary = correctionComplete ? '已订正' : (allCorrect ? '全对' : `错 ${wrongNumbers.length} 题`);
  const detailHeading = correctionComplete
    ? `第 ${normalizedCorrectionRound} 轮`
    : (allCorrect ? '保持节奏' : '错题号');
  const resultText = correctionComplete
    ? '本轮错题已订正'
    : (allCorrect ? '今天完成得很扎实' : wrongNumbers.map((value) => `${value}`).join('、'));
  const encouragement = correctionComplete
    ? '及时订正，进步看得见'
    : (allCorrect ? '认真有回响，坚持会发光' : '发现问题，就是进步的开始');
  const footerLabel = correctionComplete ? '订正记录' : '学生记录';
  const normalizedTotal = Math.max(0, Number.parseInt(totalCount, 10) || 0);
  const parsedCorrect = correctCount === undefined || correctCount === null
    ? normalizedTotal - wrongNumbers.length
    : Number.parseInt(correctCount, 10);
  const normalizedCorrect = normalizedTotal
    ? Math.max(0, Math.min(normalizedTotal, Number.isFinite(parsedCorrect) ? parsedCorrect : 0))
    : 0;
  const countSummary = normalizedTotal ? `${normalizedCorrect} / ${normalizedTotal}` : '— / —';
  const roundLabel = isCorrection ? `订正轮次 ${normalizedCorrectionRound}` : '首次批改';
  const statusLabel = correctionComplete ? '及时订正' : (allCorrect ? '批改通过' : '待订正');
  const statusColor = allCorrect ? '#4FA98F' : '#D66D62';
  const statusSoft = allCorrect ? '#E9F8F3' : '#FFF0ED';

  ctx.setFillStyle('#F6FAFF');
  ctx.fillRect(0, 0, 750, 1000);
  ctx.setFillStyle('#E9F0F8');
  for (let y = 170; y < 930; y += 46) ctx.fillRect(0, y, 750, 1);
  ctx.setFillStyle('#527CC9');
  ctx.fillRect(0, 0, 14, 1000);
  ctx.setFillStyle('#FFFFFF');
  ctx.fillRect(14, 0, 736, 165);
  ctx.setFillStyle('#F4C75B');
  ctx.fillRect(46, 25, 74, 6);
  ctx.setFillStyle('#527CC9');
  ctx.setFontSize(19);
  ctx.fillText(brandLine, 46, 54);
  ctx.setFillStyle('#24324A');
  ctx.setFontSize(46);
  ctx.fillText(truncateText(ctx, posterTitle, 480), 46, 112);
  ctx.setFillStyle('#5C6C84');
  ctx.setFontSize(22);
  ctx.fillText(practiceDate || '', 48, 147);

  ctx.setFillStyle(statusSoft);
  ctx.fillRect(562, 40, 148, 88);
  ctx.setFillStyle(statusColor);
  ctx.fillRect(562, 40, 8, 88);
  ctx.setFontSize(17);
  ctx.fillText('批改状态', 584, 68);
  ctx.setFontSize(27);
  ctx.fillText(statusLabel, 584, 105);

  ctx.setFillStyle('#FFFFFF');
  ctx.fillRect(28, 182, 478, 728);
  ctx.setStrokeStyle('#DDE7F2');
  ctx.setLineWidth(2);
  ctx.strokeRect(28, 182, 478, 728);
  ctx.setFillStyle('#315EA8');
  ctx.setFontSize(19);
  ctx.fillText('作业原图', 48, 216);
  ctx.setFillStyle('#6E7D91');
  ctx.setFontSize(15);
  const photoLabel = photoPaths.length > 4 ? `展示前 4 / ${photoPaths.length} 张` : `${photos.length} 张`;
  ctx.fillText(photoLabel, photoPaths.length > 4 ? 340 : 430, 216);

  const layouts = practicePhotoLayouts(photos.length);
  photos.forEach((photo, index) => {
    const layout = layouts[Math.min(index, layouts.length - 1)];
    drawPhotoFrame(ctx, photo, layout, rotations[index] || 0, index);
  });

  ctx.setFillStyle('#FFFFFF');
  ctx.fillRect(520, 182, 202, 728);
  ctx.setStrokeStyle('#DDE7F2');
  ctx.strokeRect(520, 182, 202, 728);
  ctx.setFillStyle(statusColor);
  ctx.fillRect(520, 182, 202, 7);
  ctx.setFillStyle('#5C6C84');
  ctx.setFontSize(17);
  ctx.fillText(resultHeading, 540, 226);
  ctx.setFillStyle(statusColor);
  ctx.setFontSize(35);
  ctx.fillText(truncateText(ctx, resultSummary, 162), 540, 276);

  ctx.setFillStyle('#EAF2FF');
  ctx.fillRect(538, 306, 166, 120);
  ctx.setFillStyle('#5C6C84');
  ctx.setFontSize(15);
  ctx.fillText('正确 / 总题', 554, 338);
  ctx.setFillStyle('#315EA8');
  ctx.setFontSize(34);
  ctx.fillText(countSummary, 554, 386);

  ctx.setFillStyle('#5C6C84');
  ctx.setFontSize(18);
  ctx.fillText(detailHeading, 540, 472);
  ctx.setFillStyle('#24324A');
  ctx.setFontSize(25);
  const resultLines = wrapText(ctx, resultText, 162, 4);
  resultLines.forEach((line, index) => ctx.fillText(line, 540, 512 + index * 36));

  ctx.setFillStyle('#DDE7F2');
  ctx.fillRect(540, 674, 162, 1);
  ctx.setFillStyle('#5C6C84');
  ctx.setFontSize(17);
  ctx.fillText(roundLabel, 540, 706);

  ctx.setFillStyle(allCorrect ? '#E9F8F3' : '#FFF5D7');
  ctx.fillRect(538, 732, 166, 128);
  ctx.setFillStyle(allCorrect ? '#358E7D' : '#8A651B');
  ctx.setFontSize(21);
  const encouragementLines = wrapText(ctx, encouragement, 130, 3);
  encouragementLines.forEach((line, index) => ctx.fillText(line, 556, 774 + index * 32));

  ctx.setFillStyle('#6E7D91');
  ctx.setFontSize(17);
  ctx.fillText(footerLabel, 540, 892);
  ctx.setFillStyle(statusColor);
  ctx.fillRect(668, 881, 28, 4);

  ctx.setFillStyle('#315EA8');
  ctx.setFontSize(17);
  ctx.fillText('PRIVATE REVIEW · 私密批改记录', 38, 956);
  ctx.setFillStyle('#6E7D91');
  ctx.setFontSize(15);
  ctx.fillText('含姓名与作业原图，仅供私下查看', 464, 956);

  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 120)));
  return exportCanvas(canvasId, page);
}

export function savePracticeReviewPoster(filePath) {
  return saveImageToAlbum(filePath);
}
