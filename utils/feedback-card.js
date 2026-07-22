import { SUPPORTED_FEEDBACK_EMOJIS } from './feedback';

export const FEEDBACK_CARD_WIDTH = 750;
export const FEEDBACK_CARD_HEIGHT = 1000;
export const FEEDBACK_CARD_MAX_TEXT = 180;
export const FEEDBACK_CARD_AVATAR = '/static/brand/panpan-feedback-line.jpg';

function cleanLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function cleanFeedbackCardText(value, studentName = '') {
  let text = String(value || '').replace(/\r\n?/g, '\n');
  for (const emoji of SUPPORTED_FEEDBACK_EMOJIS) text = text.split(emoji).join('');
  text = text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\uFE0F\u200D]/g, '')
    .split('\n').map(cleanLine).filter(Boolean).join('\n');
  const name = cleanLine(studentName);
  if (name) text = text.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[：:，,、\\s]*`), '');
  return text.trim();
}

function imageInfo(src) {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({
      src,
      success: (result) => resolve({ path: result.path || result.tempFilePath || src, width: result.width, height: result.height }),
      fail: reject,
    });
  });
}

function roundedPath(ctx, x, y, width, height, radius) {
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
}

function fillRoundedRect(ctx, x, y, width, height, radius, color) {
  roundedPath(ctx, x, y, width, height, radius);
  ctx.setFillStyle(color);
  ctx.fill();
}

function drawCover(ctx, image, x, y, width, height, radius = 0) {
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
    sy = (image.height - sh) / 2;
  }
  ctx.save();
  if (radius) { roundedPath(ctx, x, y, width, height, radius); ctx.clip(); }
  ctx.drawImage(image.path, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();
}

function textWidth(ctx, value, fontSize) {
  try { return ctx.measureText(value).width; } catch { return Array.from(value).length * fontSize; }
}

function wrapText(ctx, value, maxWidth, fontSize) {
  const lines = [];
  for (const paragraph of String(value || '').split('\n')) {
    let current = '';
    for (const char of Array.from(paragraph)) {
      if (current && textWidth(ctx, current + char, fontSize) > maxWidth) {
        lines.push(current);
        current = char;
      } else current += char;
    }
    if (current) lines.push(current);
  }
  return lines;
}

function ellipsis(ctx, value, maxWidth, fontSize) {
  const source = cleanLine(value);
  if (textWidth(ctx, source, fontSize) <= maxWidth) return source;
  let result = '';
  for (const char of Array.from(source)) {
    if (textWidth(ctx, `${result}${char}…`, fontSize) > maxWidth) break;
    result += char;
  }
  return `${result}…`;
}

function drawPhotos(ctx, photos) {
  const x = 58;
  const y = 700;
  const width = 492;
  const height = 176;
  const gap = 12;
  if (!photos.length) {
    fillRoundedRect(ctx, x, y, width, height, 18, '#EEE7DA');
    ctx.setFillStyle('#816F58');
    ctx.setFontSize(24);
    ctx.setTextAlign('center');
    ctx.fillText('每一步认真思考，都值得被看见', x + width / 2, y + 98);
    ctx.setTextAlign('left');
    return;
  }
  if (photos.length === 1) {
    drawCover(ctx, photos[0], x, y, width, height, 16);
    return;
  }
  if (photos.length === 2) {
    const itemWidth = (width - gap) / 2;
    photos.forEach((photo, index) => drawCover(ctx, photo, x + index * (itemWidth + gap), y, itemWidth, height, 16));
    return;
  }
  const largeWidth = 300;
  const smallWidth = width - largeWidth - gap;
  const smallHeight = (height - gap) / 2;
  drawCover(ctx, photos[0], x, y, largeWidth, height, 16);
  drawCover(ctx, photos[1], x + largeWidth + gap, y, smallWidth, smallHeight, 14);
  drawCover(ctx, photos[2], x + largeWidth + gap, y + smallHeight + gap, smallWidth, smallHeight, 14);
}

function exportCanvas(canvasId, page) {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvasId,
      x: 0,
      y: 0,
      width: FEEDBACK_CARD_WIDTH,
      height: FEEDBACK_CARD_HEIGHT,
      destWidth: 1080,
      destHeight: 1440,
      fileType: 'png',
      quality: 1,
      success: (result) => resolve(result.tempFilePath),
      fail: reject,
    }, page);
  });
}

export async function renderFeedbackCard({
  page,
  canvasId = 'feedbackCardCanvas',
  studentName,
  feedbackText,
  classDate,
  lesson,
  topic,
  images = [],
  avatarPath = FEEDBACK_CARD_AVATAR,
}) {
  const name = cleanLine(studentName) || '同学';
  const body = cleanFeedbackCardText(feedbackText, name);
  if (!body) throw new Error('请先填写学生反馈');
  if (Array.from(body).length > FEEDBACK_CARD_MAX_TEXT) throw new Error(`反馈卡文字请控制在 ${FEEDBACK_CARD_MAX_TEXT} 字以内`);
  const photoSources = (Array.isArray(images) ? images : []).filter(Boolean).slice(0, 3);
  const photos = [];
  for (let index = 0; index < photoSources.length; index += 1) {
    try { photos.push(await imageInfo(photoSources[index])); }
    catch { throw new Error(`第 ${index + 1} 张学生照片读取失败，请重新选择`); }
  }
  let avatar = null;
  try { avatar = await imageInfo(avatarPath); } catch {}

  const ctx = uni.createCanvasContext(canvasId, page);
  ctx.setFillStyle('#F7F2E9');
  ctx.fillRect(0, 0, FEEDBACK_CARD_WIDTH, FEEDBACK_CARD_HEIGHT);
  ctx.setFillStyle('#C89446');
  ctx.fillRect(48, 48, 6, 116);
  ctx.setFillStyle('#8A744F');
  ctx.setFontSize(20);
  ctx.setTextAlign('left');
  ctx.fillText('PANPAN CLASS NOTE', 76, 70);
  ctx.setFillStyle('#183A36');
  ctx.setFontSize(48);
  ctx.fillText('课堂反馈', 76, 127);
  ctx.setFontSize(28);
  ctx.fillText(name, 76, 171);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#756F65');
  ctx.setFontSize(20);
  ctx.fillText(cleanLine(classDate) || '课堂记录', 690, 76);
  ctx.fillText(ellipsis(ctx, [lesson, topic].map(cleanLine).filter(Boolean).join(' · ') || '数学课堂', 330, 20), 690, 108);
  ctx.setTextAlign('left');

  fillRoundedRect(ctx, 48, 205, 654, 438, 22, '#FFFCF7');
  ctx.setFillStyle('#C89446');
  ctx.setFontSize(58);
  ctx.fillText('“', 68, 268);
  ctx.setFillStyle('#263B36');
  ctx.setFontSize(28);
  const lines = wrapText(ctx, body, 590, 28);
  if (lines.length > 9) throw new Error(`反馈卡文字排版超过 9 行，请缩短后再保存`);
  lines.forEach((line, index) => ctx.fillText(line, 80, 304 + index * 40));

  drawPhotos(ctx, photos);
  fillRoundedRect(ctx, 570, 700, 132, 176, 16, '#FFFFFF');
  if (avatar) drawCover(ctx, avatar, 576, 706, 120, 142, 12);
  ctx.setFillStyle('#183A36');
  ctx.setTextAlign('center');
  ctx.setFontSize(18);
  ctx.fillText('潘潘老师', 636, 865);
  ctx.setTextAlign('left');

  ctx.setFillStyle('#D9CEBC');
  ctx.fillRect(48, 914, 654, 1);
  ctx.setFillStyle('#183A36');
  ctx.setFontSize(21);
  ctx.fillText('潘潘老师 · 课堂观察', 48, 954);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#8A8174');
  ctx.setFontSize(18);
  ctx.fillText('仅供学生家长查看', 702, 954);
  ctx.setTextAlign('left');

  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 80)));
  return exportCanvas(canvasId, page);
}

export function saveFeedbackCardToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    if (typeof uni.saveImageToPhotosAlbum !== 'function') return reject(new Error('请在微信小程序中保存反馈卡'));
    uni.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject });
  });
}

export function isAlbumPermissionError(error) {
  return /auth deny|authorize|permission|scope\.writePhotosAlbum|用户拒绝|权限/.test(String(error?.errMsg || error?.message || error || ''));
}
