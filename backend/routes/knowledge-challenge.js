const express=require('express');
const {getDB}=require('../db/init');
const {authRequired:auth,requireRole}=require('../middleware/auth');
const {parentBoundStudent}=require('../utils/scope');
const {catalog,startAttempt,answerQuestion}=require('../services/knowledge-challenge');

const router=express.Router();
const parentOnly=requireRole('parent');
function boundStudent(db,parentId,raw){const id=Number(raw);return Number.isInteger(id)&&id>0&&parentBoundStudent(db,parentId,id)?id:0;}

router.get('/catalog',auth,parentOnly,(req,res)=>{
  const db=getDB();const studentId=boundStudent(db,req.user.id,req.query.student_id);
  if(!studentId)return res.status(403).json({error:'无权查看该学生的知识点'});
  return res.json(catalog(db,{studentId}));
});
router.post('/topics/:topicKey/start',auth,parentOnly,(req,res)=>{
  const db=getDB();const studentId=boundStudent(db,req.user.id,req.body?.student_id);
  if(!studentId)return res.status(403).json({error:'无权为该学生开始闯关'});
  try{return res.status(201).json({attempt:startAttempt(db,{studentId,parentId:req.user.id,topicKey:String(req.params.topicKey||'')})});}
  catch(error){return res.status(400).json({error:error.message||'闯关创建失败'});}
});
router.post('/attempts/:id/answer',auth,parentOnly,(req,res)=>{
  const db=getDB();const attempt=db.get('SELECT student_id FROM knowledge_attempts WHERE id=?',[Number(req.params.id)]);
  const studentId=attempt?boundStudent(db,req.user.id,attempt.student_id):0;
  if(!studentId)return res.status(404).json({error:'闯关记录不存在'});
  try{return res.json(answerQuestion(db,{attemptId:Number(req.params.id),studentId,questionId:Number(req.body?.question_id),selectedOption:req.body?.selected_option}));}
  catch(error){return res.status(400).json({error:error.message||'答案提交失败'});}
});

module.exports=router;
