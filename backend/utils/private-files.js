const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PRIVATE_UPLOAD_DIR = process.env.PRIVATE_UPLOAD_DIR
  || path.join(__dirname, '..', 'private-uploads');

const TYPES = [
  { mime: 'image/jpeg', ext: '.jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: '.png', match: (b) => b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { mime: 'image/webp', ext: '.webp', match: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
];

function ensurePrivateDir() {
  fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
}

async function decodePrivateImage(base64, maxBytes = 10 * 1024 * 1024) {
  const raw = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw || !/^[A-Za-z0-9+/=\r\n]+$/.test(raw)) throw new Error('图片数据无效');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('图片数据无效');
  if (buffer.length > maxBytes) throw new Error('图片不能超过 10MB');
  const type = TYPES.find((item) => item.match(buffer));
  if (!type) throw new Error('仅支持 JPG、PNG、WebP 图片');
  let image = sharp(buffer, { failOn: 'warning', limitInputPixels: 20_000_000 });
  let metadata;
  try { metadata = await image.metadata(); }
  catch { throw new Error('图片无法解码或文件已损坏'); }
  if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height) {
    throw new Error('仅支持 JPG、PNG、WebP 图片');
  }
  if (metadata.width * metadata.height > 20_000_000) throw new Error('图片像素不能超过 2000 万');
  image = image.rotate();
  let normalized;
  if (metadata.format === 'jpeg') normalized = await image.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  else if (metadata.format === 'png') normalized = await image.png({ compressionLevel: 9 }).toBuffer();
  else normalized = await image.webp({ quality: 88 }).toBuffer();
  if (normalized.length > maxBytes) throw new Error('处理后的图片不能超过 10MB');
  return {
    buffer: normalized,
    mimeType: type.mime,
    ext: type.ext,
    byteSize: normalized.length,
    sha256: crypto.createHash('sha256').update(normalized).digest('hex'),
  };
}

function storePrivateFile(db, options) {
  ensurePrivateDir();
  const token = crypto.randomUUID().replace(/-/g, '');
  const storageKey = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${options.ext}`;
  const absolutePath = path.join(PRIVATE_UPLOAD_DIR, storageKey);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, options.buffer, { flag: 'wx' });
  try {
    const result = db.run(`INSERT INTO private_files
      (token,student_id,purpose,owner_type,owner_id,storage_key,mime_type,byte_size,sha256,original_name,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
      token, options.studentId, options.purpose, options.ownerType, options.ownerId, storageKey, options.mimeType,
      options.byteSize, options.sha256, String(options.originalName || '').slice(0, 160), options.createdBy || null,
    ]);
    return { id: result.lastInsertRowid, token, storageKey, absolutePath };
  } catch (error) {
    try { fs.unlinkSync(absolutePath); } catch {}
    throw error;
  }
}

function removePrivateFile(db, file) {
  if (!file) return;
  const fullPath = path.resolve(PRIVATE_UPLOAD_DIR, file.storage_key || '');
  const root = path.resolve(PRIVATE_UPLOAD_DIR) + path.sep;
  if (fullPath.startsWith(root)) {
    try { fs.unlinkSync(fullPath); } catch {}
  }
  if (file.id) db.run('DELETE FROM private_files WHERE id=?', [file.id]);
}

function resolvePrivatePath(storageKey) {
  const root = path.resolve(PRIVATE_UPLOAD_DIR);
  const fullPath = path.resolve(root, String(storageKey || ''));
  if (!fullPath.startsWith(root + path.sep)) return null;
  return fullPath;
}

module.exports = {
  PRIVATE_UPLOAD_DIR,
  ensurePrivateDir,
  decodePrivateImage,
  storePrivateFile,
  removePrivateFile,
  resolvePrivatePath,
};
