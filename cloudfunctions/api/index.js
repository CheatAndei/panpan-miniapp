// 番番记录 云函数 API
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// JWT-like token (简化版：用 openid)
async function getUser(openid) {
  const res = await db.collection('users').where({ openid }).get();
  if (res.data.length === 0) {
    const r = await db.collection('users').add({ data: { openid, role: 'parent', createdAt: new Date() } });
    return { _id: r._id, openid, role: 'parent' };
  }
  return res.data[0];
}

function auth(event) {
  if (!event.openid) throw new Error('未登录');
  return event.openid;
}

// 生成6位邀请码
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

exports.main = async (event, context) => {
  const { action, data = {} } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    const user = await getUser(openid);
    event.openid = openid;
    event.userId = user._id;
    event.userRole = user.role;

    switch (action) {

      // === AUTH ===
      case 'login':
        return { token: openid, user };

      // === CLASSES ===
      case 'getClasses': {
        const classes = await db.collection('classes').where({ teacherId: user._id }).get();
        for (let c of classes.data) {
          const cnt = await db.collection('students').where({ classId: c._id }).count();
          c.studentCount = cnt.total;
        }
        return { classes: classes.data };
      }
      case 'createClass': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const r = await db.collection('classes').add({ data: { teacherId: user._id, name: data.name, grade: data.grade||'', subject: data.subject||'', createdAt: new Date() } });
        return { ok: true, class: { _id: r._id, name: data.name, grade: data.grade, subject: data.subject } };
      }
      case 'updateClass': {
        await db.collection('classes').doc(data.id).update({ data: { name: data.name, grade: data.grade, subject: data.subject } });
        return { ok: true };
      }
      case 'deleteClass': {
        await db.collection('classes').doc(data.id).remove();
        return { ok: true };
      }

      // === STUDENTS ===
      case 'getStudents': {
        let students;
        if (user.role === 'teacher') {
          const q = data.classId ? { classId: data.classId } : {};
          students = await db.collection('students').where(q).get();
        } else {
          const bindings = await db.collection('bindings').where({ parentId: user._id }).get();
          const ids = bindings.data.map(b => b.studentId);
          if (ids.length === 0) return { students: [] };
          students = await db.collection('students').where({ _id: _.in(ids) }).get();
        }
        return { students: students.data };
      }
      case 'createStudent': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const code = genCode();
        const r = await db.collection('students').add({ data: { classId: data.class_id, name: data.name, level: data.level||'', personality: data.personality||'', gender: data.gender||'boy', inviteCode: code, createdAt: new Date() } });
        return { ok: true, student: { _id: r._id, name: data.name, level: data.level, inviteCode: code } };
      }
      case 'deleteStudent': {
        await db.collection('students').doc(data.id).remove();
        return { ok: true };
      }
      case 'getStudent': {
        const s = await db.collection('students').doc(data.id).get();
        if (!s.data) return { student: null };
        const cls = await db.collection('classes').doc(s.data.classId).get().catch(() => ({ data: null }));
        return { student: { ...s.data, className: cls.data?.name } };
      }
      case 'updateStudent': {
        const upd = {};
        if (data.personality !== undefined) upd.personality = data.personality;
        if (data.level !== undefined) upd.level = data.level;
        if (data.name !== undefined) upd.name = data.name;
        await db.collection('students').doc(data.id).update({ data: upd });
        return { ok: true };
      }

      // === BIND ===
      case 'bind': {
        const code = (data.invite_code || '').toUpperCase().trim();
        if (process.env.TEACHER_INVITE_CODE && code === process.env.TEACHER_INVITE_CODE) {
          await db.collection('users').doc(user._id).update({ data: { role: 'teacher' } });
          return { ok: true, role: 'teacher' };
        }
        const s = await db.collection('students').where({ inviteCode: code }).get();
        if (s.data.length === 0) throw new Error('邀请码无效');
        const student = s.data[0];
        const exist = await db.collection('bindings').where({ parentId: user._id, studentId: student._id }).get();
        if (exist.data.length === 0) {
          await db.collection('bindings').add({ data: { parentId: user._id, studentId: student._id } });
        }
        const cls = await db.collection('classes').doc(student.classId).get().catch(() => ({ data: null }));
        return { ok: true, student: { ...student, className: cls.data?.name } };
      }
      case 'getBoundStudents': {
        const bindings = await db.collection('bindings').where({ parentId: user._id }).get();
        if (bindings.data.length === 0) return { students: [] };
        const ids = bindings.data.map(b => b.studentId);
        const students = await db.collection('students').where({ _id: _.in(ids) }).get();
        for (let s of students.data) {
          const cls = await db.collection('classes').doc(s.classId).get().catch(() => ({ data: null }));
          s.className = cls.data?.name;
        }
        return { students: students.data };
      }

      // === SCHEDULES ===
      case 'getSchedules': {
        const schedules = await db.collection('schedules').where({ teacherId: user._id, isActive: true }).get();
        return { schedules: schedules.data };
      }
      case 'getSchedulesParent': {
        const bindings = await db.collection('bindings').where({ parentId: user._id }).get();
        if (bindings.data.length === 0) return { schedules: [], myClassIds: [] };
        const sIds = bindings.data.map(b => b.studentId);
        const students = await db.collection('students').where({ _id: _.in(sIds) }).get();
        const myClassIds = [...new Set(students.data.map(s => s.classId))];
        const teacherId = students.data[0]?.teacherId;
        if (!teacherId) {
          const cls = await db.collection('classes').doc(students.data[0]?.classId).get();
          if (!cls.data) return { schedules: [], myClassIds };
        }
        const schedules = await db.collection('schedules').where({ isActive: true }).get();
        for (let s of schedules.data) {
          const cls = await db.collection('classes').doc(s.classId).get().catch(() => ({ data: {} }));
          s.class_name = cls.data?.name;
          const cnt = await db.collection('students').where({ classId: s.classId }).count();
          s.student_count = cnt.total;
        }
        return { schedules: schedules.data, myClassIds };
      }
      case 'createSchedule': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const r = await db.collection('schedules').add({ data: { teacherId: user._id, classId: data.class_id, title: data.class_name||'未命名', dayOfWeek: data.day_of_week, startTime: data.start_time, endTime: data.end_time, location: data.location||'', isActive: true, createdAt: new Date() } });
        return { ok: true, schedule: { _id: r._id } };
      }
      case 'deleteSchedule': {
        await db.collection('schedules').doc(data.id).remove();
        return { ok: true };
      }
      case 'publishSessions': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const { ids } = data;
        const q = ids?.length > 0 ? { _id: _.in(ids) } : {};
        const schedules = await db.collection('schedules').where(q).get();
        let count = 0;
        const now = new Date();
        for (let sc of schedules.data) {
          const today = now.getDay();
          let diff = sc.dayOfWeek - today;
          if (diff < 0) diff += 7;
          const target = new Date(now);
          target.setDate(target.getDate() + diff);
          const dateStr = target.toISOString().slice(0, 10);
          const cls = await db.collection('classes').doc(sc.classId).get().catch(() => ({ data: {} }));
          await db.collection('sessions').add({ data: { teacherId: user._id, classId: sc.classId, title: cls.data?.name||'课程', classDate: dateStr, startTime: sc.startTime, endTime: sc.endTime, status: 'published', createdAt: new Date() } });
          count++;
        }
        await db.collection('feedbacks').where({ teacherId: user._id }).remove();
        return { ok: true, count };
      }
      case 'specialPublish': {
        if (user.role !== 'teacher') throw new Error('无权限');
        if (!data.class_id || !data.class_date || !data.start_time) throw new Error('缺少信息');
        const cls = await db.collection('classes').doc(data.class_id).get().catch(() => ({ data: {} }));
        await db.collection('sessions').add({ data: { teacherId: user._id, classId: data.class_id, title: cls.data?.name||'特殊课程', classDate: data.class_date, startTime: data.start_time, endTime: data.end_time, status: 'published', createdAt: new Date() } });
        return { ok: true };
      }
      case 'getSessions': {
        if (user.role !== 'teacher') return { sessions: [] };
        const sessions = await db.collection('sessions').where({ teacherId: user._id, status: 'published' }).orderBy('classDate', 'asc').get();
        return { sessions: sessions.data };
      }
      case 'getCompletedSessions': {
        if (user.role !== 'teacher') return { sessions: [] };
        const sessions = await db.collection('sessions').where({ teacherId: user._id, status: 'completed' }).orderBy('classDate', 'desc').get();
        return { sessions: sessions.data };
      }
      case 'completeSession': {
        await db.collection('sessions').doc(data.id).update({ data: { status: data.status || 'completed' } });
        return { ok: true };
      }
      case 'deleteSession': {
        await db.collection('sessions').doc(data.id).remove();
        return { ok: true };
      }

      // === CHECKINS ===
      case 'checkIn': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const now = new Date().toISOString();
        const exist = await db.collection('checkins').where({ studentId: data.studentId, classDate: data.classDate }).get();
        if (exist.data.length > 0) {
          await db.collection('checkins').doc(exist.data[0]._id).update({ data: { checkInTime: now, status: 'checked_in' } });
        } else {
          await db.collection('checkins').add({ data: { studentId: data.studentId, classDate: data.classDate, checkInTime: now, status: 'checked_in', createdAt: new Date() } });
        }
        return { ok: true };
      }
      case 'checkOut': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const now = new Date().toISOString();
        const today = new Date().toISOString().slice(0, 10);
        const date = data.classDate || today;
        await db.collection('checkins').where({ studentId: data.studentId, classDate: date, status: 'checked_in' }).update({ data: { checkOutTime: now, status: 'checked_out' } });
        return { ok: true };
      }
      case 'checkinStatus': {
        const ci = await db.collection('checkins').where({ studentId: data.student_id, classDate: data.date }).get();
        if (ci.data.length === 0) return { checkedIn: false, checkedOut: false, onLeave: false };
        const c = ci.data[0];
        const leave = await db.collection('leaves').where({ studentId: data.student_id, classDate: data.date, status: 'approved' }).get();
        return { checkedIn: c.status === 'checked_in' || c.status === 'checked_out', checkedOut: c.status === 'checked_out', checkInTime: c.checkInTime, checkOutTime: c.checkOutTime, onLeave: leave.data.length > 0 };
      }
      case 'todayCheckin': {
        const today = new Date().toISOString().slice(0, 10);
        const bindings = await db.collection('bindings').where({ parentId: user._id }).get();
        if (bindings.data.length === 0) return { checkedIn: false };
        const sIds = bindings.data.map(b => b.studentId);
        const ci = await db.collection('checkins').where({ studentId: _.in(sIds), classDate: today }).orderBy('checkInTime', 'desc').limit(1).get();
        if (ci.data.length === 0) return { checkedIn: false };
        const c = ci.data[0];
        return { checkedIn: c.status !== 'absent', checkInTime: c.checkInTime, status: c.status };
      }

      // === FEEDBACKS ===
      case 'publishFeedback': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const r = await db.collection('feedbacks').add({ data: { teacherId: user._id, classId: data.class_id, classDate: data.class_date, summary: data.class_feedback, homework: data.homework||'', studentFeedbacks: JSON.stringify(data.students||[]), createdAt: new Date() } });
        await db.collection('sessions').where({ classId: data.class_id, status: 'completed' }).update({ data: { status: 'feedbacked' } });
        return { ok: true, id: r._id };
      }
      case 'getFeedbacksList': {
        let feedbacks;
        if (user.role === 'teacher') {
          feedbacks = await db.collection('feedbacks').where({ teacherId: user._id }).orderBy('createdAt', 'desc').limit(30).get();
        } else {
          const bindings = await db.collection('bindings').where({ parentId: user._id }).get();
          if (bindings.data.length === 0) return { feedbacks: [] };
          const sIds = bindings.data.map(b => b.studentId);
          const students = await db.collection('students').where({ _id: _.in(sIds) }).get();
          const classIds = [...new Set(students.data.map(s => s.classId))];
          if (data.class_id) {
            feedbacks = await db.collection('feedbacks').where({ classId: data.class_id }).orderBy('createdAt', 'desc').limit(30).get();
          } else {
            feedbacks = await db.collection('feedbacks').where({ classId: _.in(classIds) }).orderBy('createdAt', 'desc').limit(30).get();
          }
        }
        return { feedbacks: feedbacks.data };
      }
      case 'getLatestFeedback': {
        const bindings = await db.collection('bindings').where({ parentId: user._id }).get();
        if (bindings.data.length === 0) return { feedback: null };
        const fb = await db.collection('feedbacks').where(data.class_id ? { classId: data.class_id } : {}).orderBy('createdAt', 'desc').limit(1).get();
        return { feedback: fb.data[0] || null };
      }

      // === PROFILES ===
      case 'getProfile': {
        const prof = await db.collection('profiles').where({ studentId: data.student_id }).get();
        return { profile: prof.data[0] || null };
      }
      case 'generateProfile': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const s = await db.collection('students').doc(data.studentId).get();
        if (!s.data) throw new Error('学生不存在');
        // AI生成
        const prompt = `你是教育心理学家，为学生生成个性画像。学生：${s.data.name}，成绩：${s.data.level||'未知'}，性格：${s.data.personality||'无'}。生成JSON：{"tags":["标签1","标签2","标签3","标签4","标签5"],"personality":"150字温暖描述","strengths":"优势80字","weaknesses":"成长空间80字"}。用孩子名字称呼，tags有趣不套话。`;
        let result;
        try {
          const axios = require('axios');
          const { data: aiRes } = await axios.post('https://api.deepseek.com/v1/chat/completions', { model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 1000 }, { headers: { Authorization: 'Bearer YOUR_DEEPSEEK_API_KEY', 'Content-Type': 'application/json' } });
          const json = aiRes.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          result = JSON.parse(json);
        } catch (e) { result = { tags: ['专注力强', '思维活跃', '细心认真'], personality: '暂无AI生成', strengths: '暂无', weaknesses: '暂无' }; }
        const exist = await db.collection('profiles').where({ studentId: data.studentId }).get();
        if (exist.data.length > 0) {
          await db.collection('profiles').doc(exist.data[0]._id).update({ data: { tags: JSON.stringify(result.tags), personality: result.personality, strengths: result.strengths, weaknesses: result.weaknesses, updatedAt: new Date() } });
        } else {
          await db.collection('profiles').add({ data: { studentId: data.studentId, tags: JSON.stringify(result.tags), personality: result.personality, strengths: result.strengths, weaknesses: result.weaknesses, createdAt: new Date() } });
        }
        return { ok: true, profile: { ...result, student_id: data.studentId } };
      }
      case 'updateProfile': {
        if (user.role !== 'teacher') throw new Error('无权限');
        const exist = await db.collection('profiles').where({ studentId: data.student_id }).get();
        if (exist.data.length > 0) {
          await db.collection('profiles').doc(exist.data[0]._id).update({ data: { personality: data.personality||'', strengths: data.strengths||'', weaknesses: data.weaknesses||'' } });
        } else {
          await db.collection('profiles').add({ data: { studentId: data.student_id, personality: data.personality||'', strengths: data.strengths||'', weaknesses: data.weaknesses||'', tags: '[]', createdAt: new Date() } });
        }
        return { ok: true };
      }

      // === LEAVES ===
      case 'createLeave': {
        if (user.role !== 'parent') throw new Error('无权限');
        await db.collection('leaves').add({ data: { studentId: data.student_id, parentId: user._id, classDate: data.class_date, reason: data.reason, status: 'pending', createdAt: new Date() } });
        return { ok: true };
      }
      case 'getLeaves': {
        let leaves;
        if (user.role === 'teacher') {
          leaves = await db.collection('leaves').orderBy('createdAt', 'desc').limit(50).get();
          for (let l of leaves.data) {
            const s = await db.collection('students').doc(l.studentId).get().catch(() => ({ data: {} }));
            l.student_name = s.data?.name;
          }
        } else {
          leaves = await db.collection('leaves').where({ parentId: user._id }).orderBy('createdAt', 'desc').limit(50).get();
        }
        return { leaves: leaves.data };
      }
      case 'approveLeave': {
        if (user.role !== 'teacher') throw new Error('无权限');
        await db.collection('leaves').doc(data.id).update({ data: { status: data.status, reply: data.reply||'' } });
        return { ok: true };
      }

      // === AI FEEDBACK ===
      case 'generateClassFeedback': {
        const prompt = `你是教培老师，写一段发家长群的课后反馈。无空行。信息：${data.grade||''} ${data.subject||''} ${data.lesson||''} ${data.topic||''} 表现${data.perfScore||5}/10 作业:${data.homework||'无'}。200-300字，用---分隔模块。返回纯文本。`;
        try {
          const axios=require('axios');const r=await axios.post('https://api.deepseek.com/v1/chat/completions',{model:'deepseek-chat',messages:[{role:'user',content:prompt}],temperature:0.9,max_tokens:1000},{headers:{Authorization:'Bearer YOUR_DEEPSEEK_API_KEY','Content-Type':'application/json'}});
          return {text:r.data.choices[0].message.content.replace(/\*/g,'').split('\n').filter(l=>l.trim()).join('\n')};
        }catch(e){throw new Error('AI生成失败');}
      }
      case 'generateStudentFeedback': {
        const prompt = `为${data.name}写课后反馈。成绩${data.level||'未知'}性格${data.personality||'无'}出门测${data.quizScore||5}/10。180字，emoji+名字+换行+正文+鼓励emoji。返回纯文本。`;
        try {
          const axios=require('axios');const r=await axios.post('https://api.deepseek.com/v1/chat/completions',{model:'deepseek-chat',messages:[{role:'user',content:prompt}],temperature:0.9,max_tokens:500},{headers:{Authorization:'Bearer YOUR_DEEPSEEK_API_KEY','Content-Type':'application/json'}});
          return {text:r.data.choices[0].message.content.replace(/\*/g,'').trim()};
        }catch(e){throw new Error('AI生成失败');}
      }
      case 'generateBatchStudentFeedback': {
        const list = data.students.map((s,i)=>`[${i}] ${s.name} | 成绩${s.level||'未知'} | 出门测${s.quizScore||5}/10 | ${s.note||''} | 性格:${s.personality||'无'}`).join('\n');
        const prompt = `为${data.students.length}位学生写课后反馈。课程:${data.classInfo?.content||''}表现${data.classInfo?.perfScore||5}/10。\n学生:\n${list}\n要求:每人180字，格式emoji+名字+正文+鼓励emoji。每人emoji不同，切入角度不同。返回JSON:{"results":[{"id":0,"feedback":"..."}]}`;
        try {
          const axios=require('axios');const r=await axios.post('https://api.deepseek.com/v1/chat/completions',{model:'deepseek-chat',messages:[{role:'user',content:prompt}],temperature:0.9,max_tokens:2000},{headers:{Authorization:'Bearer YOUR_DEEPSEEK_API_KEY','Content-Type':'application/json'}});
          const json=r.data.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
          return JSON.parse(json);
        }catch(e){throw new Error('批量生成失败');}
      }

      // === NOTIFY ===
      case 'getNotifyTemplates': { return {}; }
      case 'leaveFeedback': { console.log('[家长反馈]',data.content?.slice(0,50)); return { ok: true }; }

      default: return { error: '未知操作: '+action };
    }
  } catch (e) {
    return { error: e.message || '服务器错误' };
  }
};
