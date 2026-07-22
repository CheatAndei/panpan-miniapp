const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const jwt=require('jsonwebtoken');
const sharp=require('sharp');

const rubbish=path.join(__dirname,'..','..','..','..','z-rubbish');
const suffix=process.pid;
process.env.NODE_ENV='test';process.env.PORT='0';process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED='1';
process.env.DATABASE_PATH=path.join(rubbish,`multigrade-${suffix}.db`);
process.env.UPLOAD_DIR=path.join(rubbish,`multigrade-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR=path.join(rubbish,`multigrade-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR=path.join(rubbish,`multigrade-exams-${suffix}`);
process.env.JWT_SECRET='multigrade-test-secret-that-is-long-enough';process.env.CORS_ORIGIN='http://localhost';process.env.DISABLE_REMINDER='true';
fs.mkdirSync(rubbish,{recursive:true});

const {start}=require('../server');
const {getDB}=require('../db/init');
let server,base,parentToken,teacherToken,parentId,teacherId,studentId;
const token=(id,role)=>jwt.sign({id,role},process.env.JWT_SECRET,{algorithm:'HS256'});
async function request(method,url,authToken,body){
  const response=await fetch(base+url,{method,headers:{...(authToken?{authorization:`Bearer ${authToken}`}:{ }),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await response.json();return {response,payload};
}

test.before(async()=>{
  server=await start();await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}/api`;const db=getDB();
  const teacher=db.run("INSERT INTO users(openid,role,nickname) VALUES('mg-teacher','teacher','潘老师')");
  const parent=db.run("INSERT INTO users(openid,role,nickname) VALUES('mg-parent','parent','测试家长')");
  db.run("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,'teacher')",[teacher.lastInsertRowid]);
  db.run("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,'parent')",[parent.lastInsertRowid]);
  const cls=db.run("INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)",[teacher.lastInsertRowid,'八年级数学','八年级','数学']);
  const student=db.run("INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)",[teacher.lastInsertRowid,cls.lastInsertRowid,'欧阳明','八年级','MG001A']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)',[parent.lastInsertRowid,student.lastInsertRowid]);
  teacherId=teacher.lastInsertRowid;parentId=parent.lastInsertRowid;studentId=student.lastInsertRowid;
  teacherToken=token(teacherId,'teacher');parentToken=token(parentId,'parent');
});

test.after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const target of [process.env.DATABASE_PATH,process.env.UPLOAD_DIR,process.env.PRIVATE_UPLOAD_DIR,process.env.EXAM_LIBRARY_DIR])try{fs.rmSync(target,{recursive:true,force:true});}catch{}
});

test('三学段入口保存偏好，八上知识库为 9 个主题 72 道原创题',async()=>{
  const catalog=await request('GET',`/learning/catalog?student_id=${studentId}&grade=g8`,parentToken);
  assert.equal(catalog.response.status,200);assert.equal(catalog.payload.grade_code,'g8');
  assert.ok(catalog.payload.features.knowledge_challenge);
  const saved=await request('PUT','/learning/preferences',parentToken,{student_id:studentId,grade:'g9',subject:'math'});
  assert.equal(saved.payload.preference.grade_code,'g9');
  const knowledge=await request('GET',`/knowledge-challenge/catalog?student_id=${studentId}`,parentToken);
  assert.equal(knowledge.payload.topics.length,9);
  assert.equal(knowledge.payload.topics.reduce((sum,item)=>sum+item.question_count,0),72);
});

test('知识点闯关不提前泄露答案，服务端判题并达到掌握门槛',async()=>{
  const catalog=await request('GET',`/knowledge-challenge/catalog?student_id=${studentId}`,parentToken);
  const topic=catalog.payload.topics[0];
  const started=await request('POST',`/knowledge-challenge/topics/${topic.topic_key}/start`,parentToken,{student_id:studentId});
  assert.equal(started.response.status,201);assert.equal(started.payload.attempt.questions.length,8);
  assert.equal('correct_option' in started.payload.attempt.questions[0],false);
  const db=getDB();let last;
  for(const question of started.payload.attempt.questions){
    const answer=db.get('SELECT correct_option FROM knowledge_questions WHERE id=?',[question.id]).correct_option;
    last=await request('POST',`/knowledge-challenge/attempts/${started.payload.attempt.id}/answer`,parentToken,{question_id:question.id,selected_option:answer});
    assert.equal(last.payload.is_correct,true);
  }
  assert.equal(last.payload.completed,true);assert.equal(last.payload.score,100);assert.equal(last.payload.mastered,true);
});

test('连续压轴挑战支持拍照、批改通过、进度累计与手动下一题',async()=>{
  const db=getDB();
  const asset=db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES('question','test/q.png','q.png','image/png',10,?)`,['a'.repeat(64)]);
  for(let i=1;i<=2;i++)db.run(`INSERT INTO weekly_challenge_questions(source_key,question_type,title,question_asset_id,source_label,grade_code,subject_code,is_active)
    VALUES(?,?,?,?,?,'g8','math',1)`,[`mg-fill-${i}`,'fill',`八上压轴${i}`,asset.lastInsertRowid,'原创测试']);
  const claimed=await request('POST','/weekly-challenge/v2/assignments',parentToken,{student_id:studentId,grade:'g8',subject:'math',question_type:'fill'});
  assert.equal(claimed.response.status,201);assert.equal(claimed.payload.assignment.status,'active');
  const image=await sharp({create:{width:20,height:20,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
  const uploaded=await request('POST',`/weekly-challenge/v2/assignments/${claimed.payload.assignment.id}/upload`,parentToken,{base64:image.toString('base64'),fileName:'answer.jpg'});
  assert.equal(uploaded.response.status,201);
  const queue=await request('GET','/weekly-challenge/v2/teacher/submissions?status=submitted',teacherToken);
  assert.equal(queue.payload.count,1);
  const reviewed=await request('PUT',`/weekly-challenge/v2/teacher/submissions/${queue.payload.submissions[0].submission.id}/review`,teacherToken,{is_correct:true,teacher_note:'步骤完整'});
  assert.equal(reviewed.response.status,200);assert.equal(reviewed.payload.is_correct,true);
  assert.equal(reviewed.payload.promotion.event_type,'challenge_pass');
  assert.equal(reviewed.payload.promotion.student_name,'欧阳同学');
  const promotions=await request('GET','/promotions?unseen=1',teacherToken);
  assert.equal(promotions.payload.unseen,1);assert.equal(promotions.payload.promotions[0].passed_count,1);
  const seen=await request('POST',`/promotions/${promotions.payload.promotions[0].id}/seen`,teacherToken,{});
  assert.equal(seen.payload.ok,true);
  assert.equal((await request('GET','/promotions?unseen=1',teacherToken)).payload.unseen,0);
  const current=await request('GET',`/weekly-challenge/v2/current?student_id=${studentId}&grade=g8&subject=math`,parentToken);
  assert.equal(current.payload.assignment,null);assert.equal(current.payload.progress.fill,1);assert.equal(current.payload.last_passed.status,'passed');
});

test('三类成就只取真实记录，公开姓名为姓加同学且里程碑可配置',async()=>{
  const db=getDB();
  for(let i=1;i<=30;i++){
    const q=db.run(`INSERT INTO choice_king_questions(stable_code,stem,options_json,correct_option,source_label,grade_code,subject_code)
      VALUES(?,?,?,'A',?,'g8','math')`,[`GZ8-ACH-${i}`,`题${i}`,JSON.stringify({A:'1',B:'2',C:'3',D:'4'}),`来源${i%3}`]);
    db.run(`INSERT INTO choice_king_attempts(student_id,parent_id,question_id,selected_option,is_correct,is_review,client_request_id,answered_at)
      VALUES(?,?,?,'A',1,0,?,?)`,[studentId,parentId,q.lastInsertRowid,`ach-${i}`,new Date(Date.now()+i*1000).toISOString()]);
  }
  db.run(`INSERT INTO mental_challenges(student_id,parent_id,battle,status,questions_json,answer_detail,started_at,completed_at,elapsed_seconds,correct_count,total_questions,speed_bonus,score)
    VALUES(?,?,'junior','completed','[]','[]',?,?,?,?,20,88,1988)`,[studentId,parentId,new Date(Date.now()-60000).toISOString(),new Date().toISOString(),55,19]);
  const result=await request('GET',`/achievements?student_id=${studentId}`,parentToken);
  assert.equal(result.response.status,200);assert.equal(result.payload.student_name,'欧阳同学');
  assert.ok(result.payload.achievements.some(item=>item.category==='choice'&&item.metric_key==='correct'&&item.metric_value===30));
  assert.ok(result.payload.achievements.some(item=>item.category==='mental'&&item.score===1988));
  assert.ok(result.payload.achievements.some(item=>item.category==='challenge'&&item.passed_count===1));
  assert.deepEqual(result.payload.config.choice_correct.slice(0,3),[30,100,300]);
  assert.ok(result.payload.achievements.every(item=>item.display_name==='欧阳同学'));
  const first=result.payload.achievements[0];
  const seen=await request('POST',`/achievements/${first.id}/seen`,parentToken,{student_id:studentId});
  assert.equal(seen.payload.ok,true);
});
