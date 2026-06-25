// 从 classtest 导入真实班级和学生数据
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, 'db', 'teach.db');
const SRC = path.join(__dirname, '..', '..', 'classtest', 'data', 'classes.json');

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * 32)];
  return c;
}

initSqlJs().then(SQL => {
  const db = new SQL.Database(fs.readFileSync(DB));

  function all(sql, params = []) {
    const s = db.prepare(sql);
    if (params.length) s.bind(params);
    const rows = [];
    while (s.step()) rows.push(s.getAsObject());
    s.free();
    return rows;
  }

  const teachers = all("SELECT id FROM users WHERE role='teacher'");
  if (!teachers.length) { console.log('NO TEACHER USER — 请先用 PANPAN 登录+升级'); process.exit(1); }
  const tid = teachers[0].id;

  // 清空旧数据
  db.run('DELETE FROM students');
  db.run('DELETE FROM classes');

  const data = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  let n = 0;
  const codes = [];

  data.forEach(c => {
    db.run('INSERT INTO classes(teacher_id,name,grade,subject)VALUES(?,?,?,?)', [tid, c.name, c.grade, c.subject]);
    const cid = all('SELECT last_insert_rowid() as id')[0].id;

    codes.push({ class: c.name, students: [] });

    c.students.forEach(s => {
      const code = genCode();
      db.run('INSERT INTO students(teacher_id,class_id,name,personality,gender,invite_code)VALUES(?,?,?,?,?,?)',
        [tid, cid, s.name, s.personality || '', 'boy', code]);
      codes[codes.length - 1].students.push({ name: s.name, code });
      n++;
    });
  });

  fs.writeFileSync(DB, Buffer.from(db.export()));

  // 输出
  let out = '';
  codes.forEach(c => {
    out += `【${c.class}】\n`;
    c.students.forEach(s => out += `  ${s.name}  ${s.code}\n`);
    out += '\n';
  });
  console.log(out);
  fs.writeFileSync(path.join(__dirname, 'invite-codes.txt'), out);
  console.log(`${data.length} 班 ${n} 学生 · 已保存 invite-codes.txt`);
});
