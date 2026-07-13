const VALID_ROLES = new Set(['parent', 'teacher']);

function isValidRole(role) {
  return VALID_ROLES.has(role);
}

function ensureRole(db, userId, role) {
  if (!isValidRole(role)) return false;
  if (db.get('SELECT 1 ok FROM user_roles WHERE user_id=? AND role=?', [userId, role])) return true;
  db.run('INSERT OR IGNORE INTO user_roles(user_id, role) VALUES(?,?)', [userId, role]);
  return true;
}

function syncFactRoles(db, userId) {
  const user = db.get('SELECT role FROM users WHERE id=?', [userId]);
  if (!user) return [];
  ensureRole(db, userId, user.role);
  if (db.get('SELECT 1 ok FROM bindings WHERE parent_id=? LIMIT 1', [userId])) {
    ensureRole(db, userId, 'parent');
  }
  if (db.get('SELECT 1 ok FROM classes WHERE teacher_id=? LIMIT 1', [userId])
    || db.get('SELECT 1 ok FROM students WHERE teacher_id=? LIMIT 1', [userId])) {
    ensureRole(db, userId, 'teacher');
  }
  return getRoles(db, userId);
}

function getRoles(db, userId) {
  return db.all(`SELECT role FROM user_roles WHERE user_id=?
    ORDER BY CASE role WHEN 'parent' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END`, [userId])
    .map((row) => row.role);
}

function getUserWithRoles(db, userId, requestedActiveRole) {
  const user = db.get('SELECT id,openid,nickname,avatar_url,role FROM users WHERE id=?', [userId]);
  if (!user) return null;
  let roles = getRoles(db, userId);
  if (roles.length === 0) roles = syncFactRoles(db, userId);
  const activeRole = roles.includes(requestedActiveRole)
    ? requestedActiveRole
    : roles.includes(user.role) ? user.role : roles[0];
  return { ...user, role: activeRole, roles };
}

function setActiveRole(db, userId, role) {
  if (!isValidRole(role)) return null;
  const roles = syncFactRoles(db, userId);
  if (!roles.includes(role)) return null;
  db.run('UPDATE users SET role=? WHERE id=?', [role, userId]);
  return getUserWithRoles(db, userId, role);
}

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    role: user.role,
    roles: user.roles,
  };
}

module.exports = {
  VALID_ROLES,
  isValidRole,
  ensureRole,
  syncFactRoles,
  getRoles,
  getUserWithRoles,
  setActiveRole,
  toPublicUser,
};
