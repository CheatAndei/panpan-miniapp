import { SUPPORTED_FEEDBACK_EMOJIS } from './feedback';

export const FEEDBACK_CARD_WIDTH = 750;
export const FEEDBACK_CARD_HEIGHT = 1000;
export const FEEDBACK_CARD_MAX_TEXT = 180;
export const FEEDBACK_CARD_AVATAR = '/static/brand/panpan-feedback-line.jpg';

const FALLBACK_FEEDBACK_EMOJI = '🌟';

function cleanLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function firstFeedbackEmoji(value) {
  for (const character of String(value || '')) {
    if (SUPPORTED_FEEDBACK_EMOJIS.includes(character)) return character;
  }
  return FALLBACK_FEEDBACK_EMOJI;
}

export function feedbackCardStudentLabel(studentName, feedbackText) {
  return `${cleanLine(studentName) || '同学'}${firstFeedbackEmoji(feedbackText)}`;
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

function cleanShareText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/^\s*-{3,}\s*$/gmu, '')
    .split('\n')
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .join('\n')
    .trim();
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

async function resilientImageInfo(src) {
  const source = String(src || '').trim();
  if (!source) throw new Error('图片地址为空');
  const candidates = [source];
  if (source.startsWith('/static/')) candidates.push(source.slice(1));
  else if (source.startsWith('static/')) candidates.push(`/${source}`);
  let lastError;
  for (const candidate of [...new Set(candidates)]) {
    try { return await imageInfo(candidate); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('图片读取失败');
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

function strokeRoundedRect(ctx, x, y, width, height, radius, color, lineWidth = 1) {
  roundedPath(ctx, x, y, width, height, radius);
  ctx.setStrokeStyle(color);
  ctx.setLineWidth(lineWidth);
  ctx.stroke();
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

function drawContain(ctx, image, x, y, width, height, radius = 0, background = '#EEE8DD') {
  fillRoundedRect(ctx, x, y, width, height, radius, background);
  if (!image?.path || !image.width || !image.height) return;
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.save();
  if (radius) { roundedPath(ctx, x, y, width, height, radius); ctx.clip(); }
  ctx.drawImage(image.path, 0, 0, image.width, image.height, dx, dy, drawWidth, drawHeight);
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

function drawWrappedText(ctx, value, { x, y, maxWidth, fontSize, lineHeight, maxLines, color, weight = 'normal' }) {
  ctx.setFillStyle(color);
  ctx.setFontSize(fontSize);
  if (typeof ctx.font === 'string') ctx.font = `${weight} ${fontSize}px sans-serif`;
  const lines = wrapText(ctx, value, maxWidth, fontSize);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) visible[visible.length - 1] = ellipsis(ctx, visible[visible.length - 1], maxWidth - fontSize, fontSize);
  visible.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return visible.length;
}

function drawStudentPhotos(ctx, photos) {
  const x = 48;
  const y = 650;
  const width = 462;
  const height = 246;
  const gap = 12;
  if (!photos.length) {
    fillRoundedRect(ctx, x, y, width, height, 22, '#EDE6D9');
    ctx.setFillStyle('#C7933D');
    ctx.setFontSize(34);
    ctx.fillText('“', x + 26, y + 54);
    ctx.setFillStyle('#776A59');
    ctx.setFontSize(23);
    ctx.setTextAlign('center');
    ctx.fillText('每一步认真思考，都值得被看见', x + width / 2, y + 134);
    ctx.setTextAlign('left');
    return;
  }
  if (photos.length === 1) {
    // 单张照片完整展示，不再强制裁掉上下或左右内容。
    drawContain(ctx, photos[0], x, y, width, height, 20, '#E9E2D7');
    return;
  }
  if (photos.length === 2) {
    const itemWidth = (width - gap) / 2;
    photos.forEach((photo, index) => drawCover(ctx, photo, x + index * (itemWidth + gap), y, itemWidth, height, 18));
    return;
  }
  const largeWidth = 276;
  const smallWidth = width - largeWidth - gap;
  const smallHeight = (height - gap) / 2;
  drawCover(ctx, photos[0], x, y, largeWidth, height, 18);
  drawCover(ctx, photos[1], x + largeWidth + gap, y, smallWidth, smallHeight, 16);
  drawCover(ctx, photos[2], x + largeWidth + gap, y + smallHeight + gap, smallWidth, smallHeight, 16);
}

function drawAvatarFallback(ctx, x, y, width, height) {
  fillRoundedRect(ctx, x, y, width, height, 18, '#173A35');
  ctx.setFillStyle('#E8C16C');
  ctx.setTextAlign('center');
  ctx.setFontSize(62);
  ctx.fillText('潘', x + width / 2, y + height / 2 + 19);
  ctx.setTextAlign('left');
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

async function finishCanvas(ctx, canvasId, page) {
  await new Promise((resolve) => ctx.draw(false, () => setTimeout(resolve, 120)));
  return exportCanvas(canvasId, page);
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
  const displayName = feedbackCardStudentLabel(name, feedbackText);
  const body = cleanFeedbackCardText(feedbackText, name);
  if (!body) throw new Error('请先填写学生反馈');
  if (Array.from(body).length > FEEDBACK_CARD_MAX_TEXT) throw new Error(`反馈卡文字请控制在 ${FEEDBACK_CARD_MAX_TEXT} 字以内`);
  const photoSources = (Array.isArray(images) ? images : []).filter(Boolean).slice(0, 3);
  const photos = [];
  for (let index = 0; index < photoSources.length; index += 1) {
    try { photos.push(await resilientImageInfo(photoSources[index])); }
    catch { throw new Error(`第 ${index + 1} 张学生照片读取失败，请重新选择`); }
  }
  let avatar = null;
  try { avatar = await resilientImageInfo(avatarPath); } catch {}

  const ctx = uni.createCanvasContext(canvasId, page);
  ctx.setFillStyle('#F5EFE4');
  ctx.fillRect(0, 0, FEEDBACK_CARD_WIDTH, FEEDBACK_CARD_HEIGHT);
  ctx.setFillStyle('#C89446');
  ctx.fillRect(48, 48, 7, 118);
  ctx.setFillStyle('#8B7654');
  ctx.setFontSize(19);
  ctx.fillText('PANPAN · STUDENT NOTE', 77, 71);
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(48);
  ctx.fillText('课堂反馈', 77, 127);
  ctx.setFontSize(29);
  ctx.fillText(displayName, 77, 172);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#756F65');
  ctx.setFontSize(19);
  ctx.fillText(cleanLine(classDate) || '课堂记录', 700, 76);
  ctx.fillText(ellipsis(ctx, [lesson, topic].map(cleanLine).filter(Boolean).join(' · ') || '数学课堂', 330, 19), 700, 108);
  ctx.setTextAlign('left');

  fillRoundedRect(ctx, 48, 210, 654, 400, 24, '#FFFCF7');
  ctx.setFillStyle('#C89446');
  ctx.setFontSize(58);
  ctx.fillText('“', 69, 270);
  drawWrappedText(ctx, body, { x: 80, y: 307, maxWidth: 590, fontSize: 28, lineHeight: 40, maxLines: 7, color: '#263B36' });

  drawStudentPhotos(ctx, photos);
  fillRoundedRect(ctx, 526, 650, 176, 246, 20, '#FFFFFF');
  if (avatar) drawContain(ctx, avatar, 534, 658, 160, 190, 15, '#F3F0E9');
  else drawAvatarFallback(ctx, 534, 658, 160, 190);
  ctx.setFillStyle('#173A35');
  ctx.setTextAlign('center');
  ctx.setFontSize(19);
  ctx.fillText('潘潘老师', 614, 879);
  ctx.setTextAlign('left');

  ctx.setFillStyle('#D7CCBB');
  ctx.fillRect(48, 928, 654, 1);
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(20);
  ctx.fillText('潘潘老师 · 课堂观察', 48, 968);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#8A8174');
  ctx.setFontSize(17);
  ctx.fillText('仅供学生家长查看', 702, 968);
  ctx.setTextAlign('left');

  return finishCanvas(ctx, canvasId, page);
}

export async function renderClassFeedbackCard({
  page,
  canvasId = 'feedbackCardCanvas',
  feedbackText,
  classDate,
  lesson,
  topic,
  className = '数学课堂',
}) {
  const body = cleanShareText(feedbackText);
  if (!body) throw new Error('请先填写学习小组总反馈');

  const ctx = uni.createCanvasContext(canvasId, page);
  ctx.setFillStyle('#123B34');
  ctx.fillRect(0, 0, FEEDBACK_CARD_WIDTH, FEEDBACK_CARD_HEIGHT);
  ctx.setStrokeStyle('rgba(185,220,209,.12)');
  ctx.setLineWidth(1);
  for (let x = 0; x <= 750; x += 62) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1000); ctx.stroke(); }
  for (let y = 0; y <= 1000; y += 62) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(750, y); ctx.stroke(); }

  ctx.setFillStyle('#A7D3C5');
  ctx.setFontSize(18);
  ctx.fillText('PANPAN / CLASS BRIEF  •  课堂纪要', 48, 59);
  ctx.setFillStyle('#F5EACF');
  ctx.setFontSize(53);
  ctx.fillText('今日课堂简报', 48, 130);
  ctx.setFillStyle('#DEB963');
  ctx.fillRect(50, 157, 86, 5);
  ctx.setTextAlign('right');
  fillRoundedRect(ctx, 540, 96, 162, 60, 30, '#E6C674');
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(18);
  ctx.fillText(cleanLine(classDate) || '课堂记录', 676, 134);
  ctx.setTextAlign('left');

  ctx.setFillStyle('#9BC7BA');
  ctx.setFontSize(18);
  ctx.fillText('THIS LESSON', 50, 220);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(35);
  ctx.fillText(ellipsis(ctx, [lesson, topic].map(cleanLine).filter(Boolean).join(' · ') || cleanLine(className), 650, 35), 50, 267);

  fillRoundedRect(ctx, 48, 308, 654, 530, 28, '#F4F0E4');
  ctx.setFillStyle('#C39A43');
  ctx.setFontSize(72);
  ctx.fillText('01', 76, 389);
  ctx.setFillStyle('#6B7D77');
  ctx.setFontSize(17);
  ctx.fillText('CLASS OBSERVATION', 164, 364);
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(26);
  ctx.fillText('今天学了什么 · 课堂发生了什么', 164, 398);
  ctx.setFillStyle('#D8D3C6');
  ctx.fillRect(76, 430, 598, 1);
  drawWrappedText(ctx, body, { x: 76, y: 477, maxWidth: 598, fontSize: 27, lineHeight: 39, maxLines: 8, color: '#2D423D' });

  ctx.setFillStyle('#E5C46E');
  ctx.fillRect(48, 884, 5, 61);
  ctx.setFillStyle('#F4EEDC');
  ctx.setFontSize(21);
  ctx.fillText(cleanLine(className) || '数学课堂', 71, 907);
  ctx.setFillStyle('#A7C7BE');
  ctx.setFontSize(17);
  ctx.fillText('清楚记录每一次真实进步', 71, 938);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#E8C96F');
  ctx.setFontSize(21);
  ctx.fillText('潘潘老师', 702, 927);
  ctx.setTextAlign('left');

  return finishCanvas(ctx, canvasId, page);
}

export async function renderHomeworkCard({
  page,
  canvasId = 'feedbackCardCanvas',
  homework,
  classDate,
  lesson,
  topic,
}) {
  const body = cleanShareText(homework);
  if (!body) throw new Error('请先填写课后作业');

  const ctx = uni.createCanvasContext(canvasId, page);
  ctx.setFillStyle('#EEF1E8');
  ctx.fillRect(0, 0, FEEDBACK_CARD_WIDTH, FEEDBACK_CARD_HEIGHT);
  ctx.setStrokeStyle('#D5DDD2');
  ctx.setLineWidth(1);
  for (let x = 52; x <= 750; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1000); ctx.stroke(); }
  for (let y = 52; y <= 1000; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(750, y); ctx.stroke(); }
  ctx.setFillStyle('#D35F4D');
  ctx.fillRect(0, 0, 20, 1000);

  ctx.setFillStyle('#263F59');
  ctx.setFontSize(18);
  ctx.fillText('PANPAN · AFTER CLASS', 58, 68);
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(57);
  ctx.fillText('课后任务单', 56, 145);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#73817B');
  ctx.setFontSize(19);
  ctx.fillText(cleanLine(classDate) || '今日作业', 696, 70);
  ctx.fillText(ellipsis(ctx, [lesson, topic].map(cleanLine).filter(Boolean).join(' · ') || '数学课堂', 350, 19), 696, 106);
  ctx.setTextAlign('left');

  fillRoundedRect(ctx, 55, 202, 640, 578, 18, '#FFFDF7');
  strokeRoundedRect(ctx, 55, 202, 640, 578, 18, '#C9D0C6', 1);
  ctx.setFillStyle('#D35F4D');
  ctx.fillRect(55, 202, 10, 578);
  ctx.setFillStyle('#D35F4D');
  ctx.setFontSize(18);
  ctx.fillText('TODAY’S ASSIGNMENT', 92, 258);
  ctx.setFillStyle('#263F59');
  ctx.setFontSize(32);
  ctx.fillText('把今天的思路，写进明天的底气', 92, 304);
  ctx.setFillStyle('#D9DDD5');
  ctx.fillRect(92, 340, 558, 1);

  fillRoundedRect(ctx, 91, 388, 39, 39, 6, '#F4EAE4');
  strokeRoundedRect(ctx, 91, 388, 39, 39, 6, '#D35F4D', 2);
  drawWrappedText(ctx, body, { x: 153, y: 419, maxWidth: 484, fontSize: 30, lineHeight: 48, maxLines: 6, color: '#243A35', weight: 'bold' });

  fillRoundedRect(ctx, 91, 690, 558, 56, 12, '#E9EFEA');
  ctx.setFillStyle('#61736C');
  ctx.setFontSize(19);
  ctx.fillText('□ 完成后检查步骤   □ 圈出还不确定的题', 113, 726);

  ctx.setFillStyle('#173A35');
  ctx.setFontSize(23);
  ctx.fillText('完成比完美更重要，步骤比答案更重要。', 58, 849);
  ctx.setFillStyle('#D35F4D');
  ctx.fillRect(58, 878, 122, 4);
  ctx.setFillStyle('#6F7E78');
  ctx.setFontSize(18);
  ctx.fillText('请家长协助提醒，作业由学生独立完成', 58, 926);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#263F59');
  ctx.setFontSize(22);
  ctx.fillText('潘潘老师', 696, 927);
  ctx.setTextAlign('left');

  return finishCanvas(ctx, canvasId, page);
}

export function saveFeedbackCardToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    if (typeof uni.saveImageToPhotosAlbum !== 'function') return reject(new Error('请在微信小程序中保存分享卡'));
    uni.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject });
  });
}

export function isAlbumPermissionError(error) {
  return /auth deny|authorize|permission|scope\.writePhotosAlbum|用户拒绝|权限/.test(String(error?.errMsg || error?.message || error || ''));
}
