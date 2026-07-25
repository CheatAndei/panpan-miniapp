const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_STATUS = Object.freeze({
  maintenance: false,
  title: '系统升级维护中',
  message: '正在升级题库、批改和反馈功能，数据已安全备份。完成后即可正常使用，请稍后再试。',
  estimated_restore_at: '',
});

function readSetting(db, key, fallback = '') {
  return db.get('SELECT value FROM system_settings WHERE key=?', [key])?.value ?? fallback;
}

function systemStatus(db = getDB()) {
  return {
    maintenance: readSetting(db, 'maintenance_enabled', '0') === '1',
    title: readSetting(db, 'maintenance_title', DEFAULT_STATUS.title),
    message: readSetting(db, 'maintenance_message', DEFAULT_STATUS.message),
    estimated_restore_at: readSetting(db, 'maintenance_estimated_restore_at', ''),
  };
}

router.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(systemStatus());
});

router.put('/maintenance', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可操作' });
  const db = getDB();
  const enabled = req.body?.maintenance === true;
  const values = {
    maintenance_enabled: enabled ? '1' : '0',
    maintenance_title: String(req.body?.title || DEFAULT_STATUS.title).trim().slice(0, 40),
    maintenance_message: String(req.body?.message || DEFAULT_STATUS.message).trim().slice(0, 240),
    maintenance_estimated_restore_at: String(req.body?.estimated_restore_at || '').trim().slice(0, 40),
  };
  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) {
      db.run(`INSERT INTO system_settings(key,value,updated_by,updated_at)
        VALUES(?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, [
        key, value, req.user.id,
      ]);
    }
  });
  res.json({ ok: true, ...systemStatus(db) });
});

module.exports = router;
