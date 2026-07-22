const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const source = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'teach.db'));
const configuredBackupDir = String(process.env.BACKUP_DIR || '').trim();
if (process.env.NODE_ENV === 'production' && !configuredBackupDir) {
  throw new Error('生产备份必须设置 BACKUP_DIR，并指向数据库 volume 之外的持久目录');
}
const backupDir = path.resolve(configuredBackupDir || path.join(__dirname, '..', '..', '..', 'z-rubbish', 'panpan-db-backups'));
if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`数据库文件不存在：${source}`);
const header = fs.readFileSync(source).subarray(0, 16).toString('utf8');
if (header !== 'SQLite format 3\u0000') throw new Error('数据库文件头校验失败，已停止备份');

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const base = `teach-${stamp}`;
const temp = path.join(backupDir, `${base}.db.tmp`);
const target = path.join(backupDir, `${base}.db`);
fs.copyFileSync(source, temp, fs.constants.COPYFILE_EXCL);
fs.renameSync(temp, target);
const bytes = fs.statSync(target).size;
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
const manifest = { created_at: new Date().toISOString(), source, backup: target, bytes, sha256 };
fs.writeFileSync(path.join(backupDir, `${base}.json`), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(manifest));
