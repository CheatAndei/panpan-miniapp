const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {initDB,getDB}=require('../db/init');
const {EXAM_LIBRARY_DIR,ensureExamLibraryDir}=require('../utils/exam-files');

const args=process.argv.slice(2);
const value=(name,fallback='')=>{const index=args.indexOf(name);return index>=0&&args[index+1]?args[index+1]:fallback;};
const sourceRoot=path.resolve(value('--source',process.env.MOCK_EXAM_SOURCE_DIR||'E:/teach/近三年全区全科一模真题'));
const manifestPath=path.resolve(value('--manifest',path.join(__dirname,'..','resources','mock-exam-manifest.json')));
const commit=args.includes('--commit');const publish=args.includes('--publish');

function walk(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(entry=>{const full=path.join(root,entry.name);return entry.isDirectory()?walk(full):/\.(?:pdf|docx?)$/i.test(entry.name)?[full]:[];});}
function isAnswer(file){return /解析版|答案版|参考答案|全解全析/.test(path.basename(file))&&!/题目版|原卷版/.test(path.basename(file));}
function pairKey(file){return path.basename(file,path.extname(file)).replace(/[-_—\s]*(?:题目版|原卷版|解析版|答案版|参考答案|全解全析)$/,'').replace(/[（(]?(?:A3|A4)[）)]?/ig,'').trim();}
function prefer(files){return [...files].sort((a,b)=>(/\.pdf$/i.test(b)?1:0)-(/\.pdf$/i.test(a)?1:0)||path.basename(a).length-path.basename(b).length)[0]||null;}
const subjectMap=[['morality',/政治|道德与法治/,'道德与法治'],['chinese',/语文/,'语文'],['math',/数学/,'数学'],['english',/英语/,'英语'],['physics',/物理/,'物理'],['chemistry',/化学/,'化学'],['history',/历史/,'历史']];
function subject(text){return subjectMap.find(([,pattern])=>pattern.test(text))||['math',/数学/,'数学'];}
function district(text){return text.match(/(越秀|海珠|荔湾|天河|白云|黄埔|番禺|花都|南沙|增城|从化)区/)?.[0]||'广州市';}
function year(text){return Number(text.match(/20(?:23|24|25|26)/)?.[0]||0)||null;}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

function buildManifest(withHashes=false){
  const groups=new Map();
  for(const file of walk(sourceRoot)){
    const key=`${path.dirname(file)}|${pairKey(file)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(file);
  }
  const papers=[];const exceptions=[];
  for(const [key,files] of groups){
    const paper=prefer(files.filter(file=>!isAnswer(file)));const answer=prefer(files.filter(isAnswer));
    if(!paper){exceptions.push({key:path.relative(sourceRoot,key),reason:'missing_paper'});continue;}
    const context=`${path.relative(sourceRoot,paper)} ${path.basename(paper)}`;
    const [subjectCode,,subjectLabel]=subject(context);const examYear=year(context);const area=district(context);
    const relative=path.relative(sourceRoot,paper).replace(/\\/g,'/');
    const stable=`GZ9-MOCK-${crypto.createHash('sha1').update(`${examYear}|${subjectCode}|${area}|${pairKey(paper)}`).digest('hex').slice(0,12).toUpperCase()}`;
    papers.push({stable_code:stable,display_title:`${examYear||'年份待核'}年${area}${subjectLabel}一模`,district:area,
      exam_year:examYear,grade:'九年级',grade_code:'g9',subject_code:subjectCode,semester:'下学期',semester_code:'s2',exam_type:'mock',
      source_relative_path:relative,paper:{path:paper,name:path.basename(paper),byte_size:fs.statSync(paper).size,sha256:withHashes?sha256(paper):null},
      answer:answer?{path:answer,name:path.basename(answer),byte_size:fs.statSync(answer).size,sha256:withHashes?sha256(answer):null}:null});
  }
  papers.sort((a,b)=>Number(b.exam_year)-Number(a.exam_year)||a.subject_code.localeCompare(b.subject_code)||a.district.localeCompare(b.district));
  return {version:'mock-exams-v1',generated_at:new Date().toISOString(),source_root:sourceRoot,papers,exceptions,
    summary:{papers:papers.length,with_answer:papers.filter(item=>item.answer).length,missing_answer:papers.filter(item=>!item.answer).length,
      bytes:papers.reduce((sum,item)=>sum+item.paper.byte_size+(item.answer?.byte_size||0),0)}};
}

function mime(file){const ext=path.extname(file).toLowerCase();return ext==='.pdf'?'application/pdf':ext==='.doc'?'application/msword':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
function storeAsset(db,file,kind,hash){const existing=db.get('SELECT id FROM exam_assets WHERE sha256=?',[hash]);if(existing)return Number(existing.id);const ext=path.extname(file).toLowerCase();const storageKey=`${kind}/${hash.slice(0,2)}/${hash}${ext}`;const target=path.join(EXAM_LIBRARY_DIR,storageKey);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.copyFileSync(file,target);return Number(db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256) VALUES(?,?,?,?,?,?)`,[kind,storageKey,path.basename(file),mime(file),fs.statSync(file).size,hash]).lastInsertRowid);}

async function main(){
  if(!fs.existsSync(sourceRoot))throw new Error(`一模源目录不存在：${sourceRoot}`);
  const manifest=buildManifest(commit);fs.mkdirSync(path.dirname(manifestPath),{recursive:true});
  fs.writeFileSync(manifestPath,`${JSON.stringify({...manifest,papers:manifest.papers.map(item=>({...item,paper:{...item.paper,path:undefined},answer:item.answer?{...item.answer,path:undefined}:null}))},null,2)}\n`);
  console.log(JSON.stringify({...manifest.summary,exceptions:manifest.exceptions.length,manifest:manifestPath,commit,publish}));
  if(!commit)return;
  ensureExamLibraryDir();await initDB();const db=getDB();
  db.transaction(()=>{for(const item of manifest.papers){
    const paperAssetId=storeAsset(db,item.paper.path,'paper',item.paper.sha256);const answerAssetId=item.answer?storeAsset(db,item.answer.path,'answer',item.answer.sha256):null;
    db.run(`INSERT INTO exam_papers(stable_code,display_title,school_name,district,school_year,exam_year,grade,grade_code,subject_code,semester,semester_code,exam_type,
      paper_asset_id,answer_asset_id,source_relative_path,license_status,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'teacher_provided',?)
      ON CONFLICT(stable_code) DO UPDATE SET display_title=excluded.display_title,district=excluded.district,exam_year=excluded.exam_year,
      grade=excluded.grade,grade_code=excluded.grade_code,subject_code=excluded.subject_code,semester=excluded.semester,semester_code=excluded.semester_code,
      exam_type=excluded.exam_type,paper_asset_id=excluded.paper_asset_id,answer_asset_id=excluded.answer_asset_id,
      source_relative_path=excluded.source_relative_path,license_status='teacher_provided',status=excluded.status,updated_at=CURRENT_TIMESTAMP`,[
      item.stable_code,item.display_title,item.district,item.district,String(item.exam_year||''),item.exam_year,item.grade,item.grade_code,item.subject_code,
      item.semester,item.semester_code,item.exam_type,paperAssetId,answerAssetId,item.source_relative_path,publish?'published':'draft']);
  }});
  console.log(JSON.stringify({imported:manifest.papers.length,exam_library_dir:EXAM_LIBRARY_DIR}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
