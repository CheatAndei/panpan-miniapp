const fs = require('fs');
const path = require('path');

const EXAM_LIBRARY_DIR = process.env.EXAM_LIBRARY_DIR
  || path.join(__dirname, '..', 'exam-library');

function ensureExamLibraryDir() {
  fs.mkdirSync(EXAM_LIBRARY_DIR, { recursive: true });
}

function resolveExamPath(storageKey) {
  const root = path.resolve(EXAM_LIBRARY_DIR);
  const fullPath = path.resolve(root, String(storageKey || ''));
  if (!fullPath.startsWith(root + path.sep)) return null;
  return fullPath;
}

function ensureExamLibraryFile(storageKey, sourceFile, expectedSize = 0) {
  const target = resolveExamPath(storageKey);
  if (!target) throw new Error(`资源存储路径无效：${storageKey || ''}`);
  const size = Number(expectedSize) || Number(fs.statSync(sourceFile).size);
  const current = fs.existsSync(target) && fs.statSync(target).isFile()
    ? fs.statSync(target)
    : null;
  if (current && Number(current.size) === size) return target;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourceFile, target);
  return target;
}

module.exports = {
  EXAM_LIBRARY_DIR,
  ensureExamLibraryDir,
  resolveExamPath,
  ensureExamLibraryFile,
};
