const express = require('express');
const fs = require('fs');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const { resolvePrivatePath } = require('../utils/private-files');

const router = express.Router();

function canAccessPrivateFile(db, user, file) {
  if (!user || !file) return false;
  if (file.owner_type === 'user') return Number(file.owner_id) === Number(user.id);
  if (file.owner_type === 'homework_draft') {
    return user.role === 'teacher'
      && Number(file.owner_id) === Number(user.id)
      && Number(file.created_by) === Number(user.id);
  }
  if (file.owner_type === 'practice_submission') {
    const owner = db.get(`SELECT ps.parent_id,p.teacher_id FROM practice_submissions ps
      JOIN practice_assignments a ON a.id=ps.assignment_id
      JOIN practice_plans p ON p.id=a.plan_id WHERE ps.id=?`, [file.owner_id]);
    if (!owner) return false;
    if (user.role === 'teacher') return Number(owner.teacher_id) === Number(user.id);
    if (user.role === 'parent') {
      return Number(owner.parent_id) === Number(user.id) && parentBoundStudent(db, user.id, file.student_id);
    }
    return false;
  }
  if (file.owner_type === 'weekly_challenge_submission') {
    const owner = db.get(`SELECT sub.parent_id,a.student_id,
      CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id
      FROM weekly_challenge_submissions sub JOIN weekly_challenge_assignments a ON a.id=sub.assignment_id
      JOIN students s ON s.id=a.student_id
      LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL WHERE sub.id=?`, [file.owner_id]);
    if (!owner) return false;
    if (user.role === 'teacher') return Number(owner.teacher_id) === Number(user.id);
    if (user.role === 'parent') return Number(owner.parent_id) === Number(user.id)
      && parentBoundStudent(db, user.id, Number(owner.student_id));
    return false;
  }
  if (!file.student_id) return false;
  if (file.owner_type === 'homework_submission') {
    const owner = db.get(`SELECT b.teacher_id,b.status FROM homework_submissions s
      JOIN homework_batches b ON b.id=s.batch_id WHERE s.id=?`, [file.owner_id]);
    if (user.role === 'teacher') return Number(owner?.teacher_id) === Number(user.id);
    if (user.role === 'parent') {
      return owner?.status === 'published' && parentBoundStudent(db, user.id, file.student_id);
    }
  }
  return false;
}

router.get('/:token', auth, (req, res) => {
  const db = getDB();
  const file = db.get('SELECT * FROM private_files WHERE token=?', [String(req.params.token || '')]);
  if (!file || !canAccessPrivateFile(db, req.user, file)) return res.status(404).json({ error: '文件不存在' });
  const fullPath = resolvePrivatePath(file.storage_key);
  if (!fullPath || !fs.existsSync(fullPath)) return res.status(404).json({ error: '文件不存在' });
  res.set({
    'Content-Type': file.mime_type,
    'Content-Length': String(file.byte_size),
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename="private-${file.id}"`,
  });
  fs.createReadStream(fullPath).pipe(res);
});

module.exports = router;
module.exports.canAccessPrivateFile = canAccessPrivateFile;
