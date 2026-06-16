// 从 classtest JSON 导入数据到 teach-miniapp 数据库
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'teach.db');

const data = JSON.parse(fs.readFileSync('d:/biancheng/qian/classtest/data/classes.json','utf-8'));

// 提取 level
function extractLevel(personality) {
  if (/成绩(好|上|棒|优秀)/.test(personality)) return '好';
  if (/中上/.test(personality)) return '中上';
  if (/中下/.test(personality)) return '中下';
  if (/中/.test(personality)) return '中';
  if (/下|差/.test(personality)) return '下';
  return '';
}

// 提取纯性格（去掉成绩前缀）
function cleanPersonality(text) {
  return text.replace(/成绩[好上棒优秀中下]+/, '').replace(/^\s+/,'').trim();
}

async function main() {
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    db.run(schema);
  }

  // 确保有 teacher（使用 dev openid）
  const teacher = db.exec("SELECT id FROM users WHERE role='teacher' LIMIT 1");
  let teacherId;
  if (teacher.length > 0 && teacher[0].values.length > 0) {
    teacherId = teacher[0].values[0][0];
  } else {
    db.run("INSERT INTO users (openid, role, nickname) VALUES ('dev_panpan_teacher','teacher','潘潘老师')");
    teacherId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  }
  console.log('Teacher ID:', teacherId);

  // 清空旧数据
  db.run('DELETE FROM students');
  db.run('DELETE FROM classes');

  for (const c of data) {
    // 创建班级
    db.run('INSERT INTO classes (teacher_id, name, grade, subject) VALUES (?,?,?,?)',
      [teacherId, c.name, c.grade, c.subject]);
    const classId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    console.log(`班级: ${c.name} (id=${classId})`);

    // 生成邀请码
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (const s of c.students) {
      let code;
      do {
        code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      } while (db.exec(`SELECT id FROM students WHERE invite_code='${code}'`).length > 0);

      const level = extractLevel(s.personality);
      const personality = cleanPersonality(s.personality);

      db.run('INSERT INTO students (class_id, name, level, personality, invite_code) VALUES (?,?,?,?,?)',
        [classId, s.name, level, personality, code]);
      console.log(`  + ${s.name} [${level}] ${personality} 邀请码:${code}`);
    }
  }

  // 保存
  const buffer = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(buffer));
  console.log(`\n导入完成！${data.length}个班级，${data.reduce((s,c)=>s+c.students.length,0)}名学生`);
}

main().catch(console.error);
