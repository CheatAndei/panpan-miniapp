import { saveImageToAlbum } from './photo-album';

export const PRACTICE_REVIEW_POSTER_WIDTH = 750;
export const PRACTICE_REVIEW_POSTER_HEIGHT = 1000;

const POSTER_COLORS = Object.freeze({
  green: '#20B486',
  greenStrong: '#15946D',
  greenSoft: '#E7F8F1',
  coral: '#FF7468',
  coralSoft: '#FFF0EE',
  paper: '#F8FCF9',
  photoPaper: '#FFFFFF',
  ink: '#26352F',
  secondary: '#5A6A62',
  muted: '#718078',
  border: '#D9E7DF',
  white: '#FFFFFF',
});

function buildMessagePool(openings, endings) {
  const messages = [];
  for (const opening of openings) {
    for (const ending of endings) messages.push(`${opening}${ending}`);
  }
  return Object.freeze(messages);
}

export const PRACTICE_ALL_CORRECT_MESSAGES = buildMessagePool(
  [
    '基础步骤清楚，',
    '计算过程稳当，',
    '审题抓得准确，',
    '书写与思路都很清楚，',
    '今天的状态很在线，',
    '每一步都经得起检查，',
    '知识点掌握得很扎实，',
    '节奏把握得刚刚好，',
    '答题习惯越来越成熟，',
    '这次完成得很漂亮，',
  ],
  [
    '继续保持这份细心。',
    '把好状态带到下一次。',
    '稳稳积累就会越来越强。',
    '下一组题也照这个节奏来。',
    '这份认真值得表扬。',
    '好习惯正在变成实力。',
    '继续向更难的题目进发。',
    '今天的努力已经有了答案。',
    '保持检查，你会更可靠。',
    '每一次全对都来自真功夫。',
  ],
);

export const PRACTICE_NEEDS_WORK_MESSAGES = buildMessagePool(
  [
    '已经找到需要补强的地方，',
    '错题把下一步方向指出来了，',
    '这次失误很有价值，',
    '关键卡点已经被看见，',
    '距离全对只差一次订正，',
    '把错题拆开看一遍，',
    '先把这几个小问题收好，',
    '今天的难点已经浮出来了，',
    '不怕出现错题，',
    '每一道错题都在提醒我们，',
  ],
  [
    '订正后就会更稳。',
    '慢一步检查会有新发现。',
    '改对它，就是实打实的进步。',
    '把原因弄懂比只记答案更重要。',
    '再练一遍就更有把握。',
    '下次遇见同类题会更从容。',
    '把过程补完整，答案会自己出现。',
    '这正是能力向上生长的起点。',
    '认真回看，你一定能拿下。',
    '现在修正，下一次就少走弯路。',
  ],
);

export const PRACTICE_ENCOURAGEMENT_MESSAGES = buildMessagePool(
  [
    '今天认真完成，',
    '把每一步写清楚，',
    '稳稳做题，',
    '愿意订正，',
    '坚持打卡，',
    '认真检查，',
    '不急着求快，',
    '一题一题积累，',
    '把难题留在纸上，',
    '今天比昨天更进一步，',
  ],
  [
    '好习惯正在发生。',
    '你的努力看得见。',
    '进步会慢慢长出来。',
    '这份坚持很珍贵。',
    '下一次会更从容。',
    '每一次练习都有意义。',
    '继续保持自己的节奏。',
    '扎实就是最好的速度。',
    '你正在变得更可靠。',
    '小小积累也会汇成实力。',
  ],
);

const messageBags = Object.create(null);

export function pickPracticeReviewMessage(pool, key) {
  if (!Array.isArray(pool) || !pool.length) return '';
  let state = messageBags[key];
  if (!state || !state.remaining.length) {
    const remaining = pool.map((_message, index) => index);
    for (let index = remaining.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [remaining[index], remaining[target]] = [remaining[target], remaining[index]];
    }
    if (state && remaining.length > 1 && remaining[0] === state.lastIndex) {
      [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
    }
    state = { remaining, lastIndex: state?.lastIndex ?? -1 };
    messageBags[key] = state;
  }
  const index = state.remaining.shift();
  state.lastIndex = index;
  return pool[index];
}

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

  ctx.setFillStyle(POSTER_COLORS.photoPaper);
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
  ctx.setStrokeStyle(POSTER_COLORS.photoPaper);
  ctx.setLineWidth(4);
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

function drawPhotoFrame(ctx, photo, layout, rotation, index, allCorrect) {
  ctx.setShadow(0, 8, 18, 'rgba(36,48,41,.12)');
  ctx.setFillStyle(POSTER_COLORS.green);
  ctx.fillRect(layout.x - 6, layout.y - 6, layout.w + 12, layout.h + 12);
  ctx.setFillStyle(POSTER_COLORS.photoPaper);
  ctx.fillRect(layout.x - 2, layout.y - 2, layout.w + 4, layout.h + 4);
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
  ctx.setStrokeStyle(POSTER_COLORS.greenStrong);
  ctx.setLineWidth(3);
  ctx.strokeRect(layout.x, layout.y, layout.w, layout.h);
  ctx.setFillStyle(allCorrect ? POSTER_COLORS.greenStrong : POSTER_COLORS.coral);
  ctx.fillRect(layout.x + 10, layout.y + 10, 54, 31);
  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.setFontSize(14);
  ctx.fillText(String(index + 1).padStart(2, '0'), layout.x + 23, layout.y + 31);
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
  teacherName,
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
  const resultHeading = correctionComplete ? '订正结果' : '批改结果';
  const resultSummary = correctionComplete ? '已订正' : (allCorrect ? '全对' : `错 ${wrongNumbers.length} 题`);
  const detailHeading = correctionComplete
    ? `第 ${normalizedCorrectionRound} 轮`
    : (allCorrect ? '作答情况' : '错题号');
  const resultText = correctionComplete
    ? '本轮错题已订正'
    : (allCorrect ? '本次题目全部正确' : wrongNumbers.map((value) => `${value}`).join('、'));
  const resultMessage = pickPracticeReviewMessage(
    allCorrect ? PRACTICE_ALL_CORRECT_MESSAGES : PRACTICE_NEEDS_WORK_MESSAGES,
    allCorrect ? 'all-correct' : 'needs-work',
  );
  const encouragement = pickPracticeReviewMessage(
    PRACTICE_ENCOURAGEMENT_MESSAGES,
    'encouragement',
  );
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
  const statusColor = allCorrect ? POSTER_COLORS.green : POSTER_COLORS.coral;
  const statusSoft = allCorrect ? POSTER_COLORS.greenSoft : POSTER_COLORS.coralSoft;
  const badgeColor = allCorrect ? POSTER_COLORS.greenSoft : POSTER_COLORS.coral;
  const statusInk = allCorrect ? POSTER_COLORS.greenStrong : POSTER_COLORS.white;
  const commentColor = allCorrect ? POSTER_COLORS.white : POSTER_COLORS.coralSoft;
  const commentInk = POSTER_COLORS.ink;
  const rawTeacherName = String(teacherName || '任课老师').trim() || '任课老师';
  const teacherLabel = /老师$/.test(rawTeacherName) ? rawTeacherName : `${rawTeacherName}老师`;
  const signature = `${teacherLabel}批改`;

  ctx.setFillStyle(POSTER_COLORS.paper);
  ctx.fillRect(0, 0, 750, 1000);
  ctx.setFillStyle('#E3EEE8');
  for (let y = 170; y < 928; y += 46) ctx.fillRect(0, y, 750, 1);

  ctx.setFillStyle(POSTER_COLORS.greenStrong);
  ctx.fillRect(0, 0, 750, 166);
  ctx.setFillStyle(POSTER_COLORS.green);
  ctx.fillRect(0, 0, 520, 166);
  ctx.setFillStyle(POSTER_COLORS.coral);
  ctx.fillRect(0, 0, 186, 12);
  ctx.setFillStyle(POSTER_COLORS.greenSoft);
  ctx.setFontSize(18);
  ctx.fillText(brandLine, 40, 57);
  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.setFontSize(44);
  ctx.fillText(truncateText(ctx, posterTitle, 485), 40, 112);
  ctx.setFillStyle(POSTER_COLORS.greenSoft);
  ctx.setFontSize(21);
  ctx.fillText(practiceDate || '', 42, 147);

  ctx.setFillStyle(badgeColor);
  ctx.fillRect(558, 36, 154, 96);
  ctx.setFillStyle(statusInk);
  ctx.setFontSize(16);
  ctx.fillText('批改状态', 578, 72);
  ctx.setFillStyle(statusInk);
  ctx.setFontSize(25);
  ctx.fillText(statusLabel, 578, 110);

  ctx.setFillStyle(POSTER_COLORS.photoPaper);
  ctx.fillRect(28, 182, 478, 728);
  ctx.setFillStyle(POSTER_COLORS.greenSoft);
  ctx.fillRect(28, 182, 478, 52);
  ctx.setFillStyle(POSTER_COLORS.coral);
  ctx.fillRect(28, 182, 12, 52);
  ctx.setFillStyle(POSTER_COLORS.greenStrong);
  ctx.setFontSize(19);
  ctx.fillText('作业原图', 48, 216);
  ctx.setFillStyle(POSTER_COLORS.muted);
  ctx.setFontSize(15);
  const photoLabel = photoPaths.length > 4 ? `展示前 4 / ${photoPaths.length} 张` : `${photos.length} 张`;
  ctx.fillText(photoLabel, photoPaths.length > 4 ? 340 : 430, 216);

  const layouts = practicePhotoLayouts(photos.length);
  photos.forEach((photo, index) => {
    const layout = layouts[Math.min(index, layouts.length - 1)];
    drawPhotoFrame(ctx, photo, layout, rotations[index] || 0, index, allCorrect);
  });

  ctx.setFillStyle(statusSoft);
  ctx.fillRect(520, 182, 202, 728);
  ctx.setFillStyle(statusColor);
  ctx.fillRect(520, 182, 202, 120);
  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.setFontSize(17);
  ctx.fillText(resultHeading, 540, 226);
  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.setFontSize(35);
  ctx.fillText(truncateText(ctx, resultSummary, 162), 540, 276);

  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.fillRect(538, 320, 166, 112);
  ctx.setFillStyle(POSTER_COLORS.secondary);
  ctx.setFontSize(15);
  ctx.fillText('正确 / 总题', 554, 352);
  ctx.setFillStyle(POSTER_COLORS.greenStrong);
  ctx.setFontSize(34);
  ctx.fillText(countSummary, 554, 400);

  ctx.setFillStyle(POSTER_COLORS.photoPaper);
  ctx.fillRect(538, 450, 166, 142);
  ctx.setFillStyle(POSTER_COLORS.secondary);
  ctx.setFontSize(17);
  ctx.fillText(detailHeading, 554, 482);
  ctx.setFillStyle(POSTER_COLORS.ink);
  ctx.setFontSize(23);
  const resultLines = wrapText(ctx, resultText, 162, 4);
  resultLines.forEach((line, index) => ctx.fillText(line, 554, 520 + index * 29));

  ctx.setFillStyle(commentColor);
  ctx.fillRect(538, 610, 166, 214);
  ctx.setFillStyle(statusColor);
  ctx.fillRect(538, 610, 8, 214);
  ctx.setFillStyle(commentInk);
  ctx.setFontSize(15);
  ctx.fillText('老师的话', 558, 642);
  ctx.setFillStyle(commentInk);
  ctx.setFontSize(18);
  const resultMessageLines = wrapText(ctx, resultMessage, 128, 6);
  resultMessageLines.forEach((line, index) => ctx.fillText(line, 558, 678 + index * 27));

  ctx.setFillStyle(POSTER_COLORS.greenStrong);
  ctx.fillRect(538, 844, 166, 46);
  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.setFontSize(16);
  ctx.fillText(roundLabel, 554, 874);

  ctx.setFillStyle(POSTER_COLORS.greenStrong);
  ctx.fillRect(0, 928, 525, 72);
  ctx.setFillStyle(POSTER_COLORS.coral);
  ctx.fillRect(525, 928, 225, 72);
  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.setFontSize(15);
  const encouragementLines = wrapText(ctx, encouragement, 460, 2);
  encouragementLines.forEach((line, index) => ctx.fillText(line, 38, 953 + index * 22));
  ctx.setFillStyle(POSTER_COLORS.white);
  ctx.setFontSize(16);
  const safeSignature = truncateText(ctx, signature, 180);
  const signatureWidth = ctx.measureText(safeSignature).width;
  ctx.fillText(safeSignature, 712 - signatureWidth, 970);

  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 120)));
  return exportCanvas(canvasId, page);
}

export function savePracticeReviewPoster(filePath) {
  return saveImageToAlbum(filePath);
}
