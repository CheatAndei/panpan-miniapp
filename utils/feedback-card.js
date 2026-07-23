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

async function resolvePackagedImage(src) {
  const source = String(src || '').trim();
  if (!source.startsWith('/static/') && !source.startsWith('static/')) return resilientImageInfo(source);
  const uniApi = typeof uni !== 'undefined' ? uni : null;
  const userDataPath = typeof wx !== 'undefined' && wx?.env?.USER_DATA_PATH
    ? wx.env.USER_DATA_PATH
    : uniApi?.env?.USER_DATA_PATH;
  const fileSystem = typeof uniApi?.getFileSystemManager === 'function'
    ? uniApi.getFileSystemManager()
    : (typeof wx !== 'undefined' && typeof wx.getFileSystemManager === 'function' ? wx.getFileSystemManager() : null);
  if (!userDataPath || !fileSystem) return resilientImageInfo(source);
  const packagePath = source.replace(/^\/+/, '');
  const suffix = packagePath.includes('.') ? packagePath.slice(packagePath.lastIndexOf('.')) : '.jpg';
  const targetPath = `${userDataPath}/panpan-feedback-avatar${suffix}`;
  try {
    try { return await imageInfo(targetPath); } catch {}
    const data = fileSystem.readFileSync(packagePath);
    fileSystem.writeFileSync(targetPath, data);
    return await imageInfo(targetPath);
  } catch {
    return resilientImageInfo(source);
  }
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

function drawFittedText(ctx, value, {
  x, y, maxWidth, maxHeight, fontSizes = [28, 26, 24, 22, 20, 18],
  color, weight = 'normal', lineHeightRatio = 1.42,
}) {
  let chosen = { fontSize:fontSizes[fontSizes.length - 1], lineHeight:Math.round(fontSizes[fontSizes.length - 1] * lineHeightRatio), lines:[] };
  for (const fontSize of fontSizes) {
    ctx.setFontSize(fontSize);
    if (typeof ctx.font === 'string') ctx.font = `${weight} ${fontSize}px sans-serif`;
    const lines = wrapText(ctx, value, maxWidth, fontSize);
    const lineHeight = Math.round(fontSize * lineHeightRatio);
    chosen = { fontSize, lineHeight, lines };
    if (lines.length * lineHeight <= maxHeight) break;
  }
  ctx.setFillStyle(color);
  ctx.setFontSize(chosen.fontSize);
  if (typeof ctx.font === 'string') ctx.font = `${weight} ${chosen.fontSize}px sans-serif`;
  chosen.lines.forEach((line, index) => ctx.fillText(line, x, y + index * chosen.lineHeight));
  return chosen;
}

function studentCardLayout(lineCount) {
  const bodyHeight = Math.max(220, Math.min(398, 118 + Math.max(1, lineCount) * 40));
  const mediaY = 210 + bodyHeight + 22;
  return {
    bodyHeight,
    mediaY,
    mediaHeight:Math.max(250, 902 - mediaY),
    photoX:48,
    photoWidth:480,
    avatarX:544,
    avatarWidth:158,
  };
}

function drawStudentPhotos(ctx, photos, layout) {
  const x = layout.photoX;
  const y = layout.mediaY;
  const width = layout.photoWidth;
  const height = layout.mediaHeight;
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
    drawCover(ctx, photos[0], x, y, width, height, 20);
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
  try { avatar = await resolvePackagedImage(avatarPath); } catch {}

  const ctx = uni.createCanvasContext(canvasId, page);
  ctx.setFontSize(28);
  const bodyLineCount = wrapText(ctx, body, 590, 28).length;
  const layout = studentCardLayout(bodyLineCount);
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

  fillRoundedRect(ctx, 48, 210, 654, layout.bodyHeight, 24, '#FFFCF7');
  ctx.setFillStyle('#C89446');
  ctx.setFontSize(58);
  ctx.fillText('“', 69, 270);
  drawFittedText(ctx, body, {
    x:80,
    y:307,
    maxWidth:590,
    maxHeight:layout.bodyHeight - 118,
    fontSizes:[28, 26, 24, 22],
    color:'#263B36',
  });

  drawStudentPhotos(ctx, photos, layout);
  const avatarY = layout.mediaY + Math.max(0, (layout.mediaHeight - 246) / 2);
  fillRoundedRect(ctx, layout.avatarX, avatarY, layout.avatarWidth, 246, 20, '#FFFFFF');
  if (avatar) drawContain(ctx, avatar, layout.avatarX + 8, avatarY + 8, layout.avatarWidth - 16, 190, 15, '#F3F0E9');
  else drawAvatarFallback(ctx, layout.avatarX + 8, avatarY + 8, layout.avatarWidth - 16, 190);
  ctx.setFillStyle('#173A35');
  ctx.setTextAlign('center');
  ctx.setFontSize(19);
  ctx.fillText('潘潘老师', layout.avatarX + layout.avatarWidth / 2, avatarY + 229);
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
  ctx.setFillStyle('#F7F2E8');
  ctx.fillRect(0, 0, FEEDBACK_CARD_WIDTH, FEEDBACK_CARD_HEIGHT);
  ctx.setFillStyle('#173A35');
  ctx.fillRect(0, 0, FEEDBACK_CARD_WIDTH, 226);
  ctx.setFillStyle('#E1BC62');
  ctx.fillRect(48, 52, 78, 5);
  ctx.setFillStyle('#A9D0C5');
  ctx.setFontSize(18);
  ctx.fillText('PANPAN · CLASS BRIEF', 48, 86);
  ctx.setFillStyle('#F5EACF');
  ctx.setFontSize(44);
  ctx.fillText('今日课堂简报', 48, 146);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#B9D5CE');
  ctx.setFontSize(17);
  ctx.fillText(cleanLine(classDate) || '课堂记录', 702, 84);
  ctx.setTextAlign('left');

  ctx.setFillStyle('#D9EEE8');
  ctx.setFontSize(17);
  ctx.fillText('本次课程', 48, 183);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(27);
  ctx.fillText(ellipsis(ctx, [lesson, topic].map(cleanLine).filter(Boolean).join(' · ') || cleanLine(className), 636, 27), 48, 215);

  fillRoundedRect(ctx, 48, 258, 654, 602, 24, '#FFFCF7');
  ctx.setFillStyle('#AD8232');
  ctx.setFontSize(17);
  ctx.fillText('课堂记录', 76, 306);
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(27);
  ctx.fillText('重点 · 表现 · 下一步', 76, 346);
  ctx.setFillStyle('#E4DDD0');
  ctx.fillRect(76, 370, 598, 1);
  drawFittedText(ctx, body, {
    x:76,
    y:414,
    maxWidth:598,
    maxHeight:400,
    fontSizes:[27, 25, 23, 21, 19, 18],
    color:'#2D423D',
    lineHeightRatio:1.48,
  });

  ctx.setFillStyle('#D6C7AC');
  ctx.fillRect(48, 902, 654, 1);
  ctx.setFillStyle('#173A35');
  ctx.setFontSize(20);
  ctx.fillText(cleanLine(className) || '数学课堂', 48, 945);
  ctx.setTextAlign('right');
  ctx.setFillStyle('#8A7654');
  ctx.setFontSize(20);
  ctx.fillText('潘潘老师', 702, 945);
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
