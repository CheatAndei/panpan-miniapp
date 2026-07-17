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

module.exports = { EXAM_LIBRARY_DIR, ensureExamLibraryDir, resolveExamPath };
