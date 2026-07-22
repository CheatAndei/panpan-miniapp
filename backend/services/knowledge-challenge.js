const dataset=require('../resources/knowledge/g8-math-v1');

function parseJson(value,fallback){try{return JSON.parse(value||'');}catch{return fallback;}}

function seedKnowledgeBank(db){
  let topics=0,questions=0;
  db.transaction(()=>{
    for(const item of dataset.topics){
      db.run(`INSERT INTO knowledge_topics(topic_key,grade_code,subject_code,chapter_name,title,knowledge_card,sort_order,is_active)
        VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(topic_key) DO UPDATE SET chapter_name=excluded.chapter_name,title=excluded.title,
        knowledge_card=excluded.knowledge_card,sort_order=excluded.sort_order,is_active=1,updated_at=CURRENT_TIMESTAMP`,
      [item.topic_key,'g8','math',item.chapter_name,item.title,item.knowledge_card,item.sort_order]);topics+=1;
    }
    for(const item of dataset.questions){
      if(!item.options||!['A','B','C','D'].every(key=>Object.hasOwn(item.options,key))||!item.options[item.correct_option])throw new Error(`知识题 ${item.stable_code} 选项无效`);
      db.run(`INSERT INTO knowledge_questions(stable_code,topic_key,stem,options_json,correct_option,explanation,difficulty,is_active)
        VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(stable_code) DO UPDATE SET topic_key=excluded.topic_key,stem=excluded.stem,
        options_json=excluded.options_json,correct_option=excluded.correct_option,explanation=excluded.explanation,
        difficulty=excluded.difficulty,is_active=1,updated_at=CURRENT_TIMESTAMP`,
      [item.stable_code,item.topic_key,item.stem,JSON.stringify(item.options),item.correct_option,item.explanation,item.difficulty]);questions+=1;
    }
  });
  return {topics,questions,version:dataset.version};
}

function publicQuestion(row,index){return {id:Number(row.id),position:index+1,stable_code:row.stable_code,stem:row.stem,options:parseJson(row.options_json,{}),difficulty:Number(row.difficulty||2)};}

function catalog(db,{studentId}){
  const topics=db.all(`SELECT * FROM knowledge_topics WHERE grade_code='g8' AND subject_code='math' AND is_active=1 ORDER BY sort_order,id`);
  return {grade_code:'g8',subject_code:'math',topics:topics.map(topic=>{
    const latest=db.get(`SELECT score,correct_count,completed_at FROM knowledge_attempts WHERE student_id=? AND topic_key=? AND status='completed' ORDER BY id DESC LIMIT 1`,[studentId,topic.topic_key]);
    const best=Number(db.get(`SELECT MAX(score) score FROM knowledge_attempts WHERE student_id=? AND topic_key=? AND status='completed'`,[studentId,topic.topic_key])?.score||0);
    return {topic_key:topic.topic_key,chapter_name:topic.chapter_name,title:topic.title,knowledge_card:topic.knowledge_card,
      question_count:Number(db.get('SELECT COUNT(*) count FROM knowledge_questions WHERE topic_key=? AND is_active=1',[topic.topic_key])?.count||0),
      latest_score:latest?Number(latest.score):null,best_score:best,mastered:best>=75};
  })};
}

function startAttempt(db,{studentId,parentId,topicKey}){
  const topic=db.get("SELECT * FROM knowledge_topics WHERE topic_key=? AND is_active=1",[topicKey]);
  if(!topic)throw new Error('知识点不存在');
  let attempt=db.get(`SELECT * FROM knowledge_attempts WHERE student_id=? AND topic_key=? AND status='active' ORDER BY id DESC LIMIT 1`,[studentId,topicKey]);
  if(!attempt){
    const rows=db.all(`SELECT id FROM knowledge_questions WHERE topic_key=? AND is_active=1 ORDER BY RANDOM() LIMIT 8`,[topicKey]);
    if(rows.length<8)throw new Error('该知识点题目不足 8 道');
    const created=db.run(`INSERT INTO knowledge_attempts(student_id,parent_id,topic_key,question_ids_json,answers_json,status)
      VALUES(?,?,?,?,'[]','active')`,[studentId,parentId,topicKey,JSON.stringify(rows.map(item=>Number(item.id)))]);
    attempt=db.get('SELECT * FROM knowledge_attempts WHERE id=?',[created.lastInsertRowid]);
  }
  return serializeAttempt(db,attempt);
}

function serializeAttempt(db,attempt){
  if(!attempt)return null;
  const ids=parseJson(attempt.question_ids_json,[]).map(Number).filter(Boolean);
  const byId=new Map(ids.length?db.all(`SELECT * FROM knowledge_questions WHERE id IN (${ids.map(()=>'?').join(',')})`,ids).map(item=>[Number(item.id),item]):[]);
  const answers=parseJson(attempt.answers_json,[]);
  return {id:Number(attempt.id),student_id:Number(attempt.student_id),topic_key:attempt.topic_key,status:attempt.status,
    correct_count:Number(attempt.correct_count||0),score:attempt.score===null?null:Number(attempt.score),answers,
    questions:ids.map((id,index)=>publicQuestion(byId.get(id),index)).filter(Boolean)};
}

function answerQuestion(db,{attemptId,studentId,questionId,selectedOption}){
  const option=String(selectedOption||'').trim().toUpperCase();
  if(!['A','B','C','D'].includes(option))throw new Error('请选择 A、B、C 或 D');
  const attempt=db.get('SELECT * FROM knowledge_attempts WHERE id=? AND student_id=?',[attemptId,studentId]);
  if(!attempt)throw new Error('闯关记录不存在');
  const answers=parseJson(attempt.answers_json,[]);
  const existing=answers.find(item=>Number(item.question_id)===Number(questionId));
  if(existing)return {idempotent:true,...existing,attempt:serializeAttempt(db,attempt)};
  if(attempt.status==='completed')throw new Error('本轮闯关已完成');
  const ids=parseJson(attempt.question_ids_json,[]).map(Number);
  if(!ids.includes(Number(questionId)))throw new Error('题目不属于本轮闯关');
  const question=db.get('SELECT * FROM knowledge_questions WHERE id=? AND is_active=1',[questionId]);
  if(!question)throw new Error('题目已暂停');
  const result={question_id:Number(questionId),selected_option:option,is_correct:option===question.correct_option,
    correct_option:question.correct_option,explanation:question.explanation};
  answers.push(result);
  const correct=answers.filter(item=>item.is_correct).length;
  const completed=answers.length>=ids.length;
  const score=completed?Math.round(correct/ids.length*100):null;
  db.run(`UPDATE knowledge_attempts SET answers_json=?,correct_count=?,status=?,score=?,completed_at=? WHERE id=?`,[
    JSON.stringify(answers),correct,completed?'completed':'active',score,completed?new Date().toISOString():null,attempt.id]);
  return {...result,completed,score,mastered:completed&&score>=75,attempt:serializeAttempt(db,db.get('SELECT * FROM knowledge_attempts WHERE id=?',[attempt.id]))};
}

module.exports={seedKnowledgeBank,catalog,startAttempt,serializeAttempt,answerQuestion};
