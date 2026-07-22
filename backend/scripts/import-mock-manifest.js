const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {initDB,getDB}=require('../db/init');
const {EXAM_LIBRARY_DIR}=require('../utils/exam-files');

const args=process.argv.slice(2);
const value=(name,fallback='')=>{const i=args.indexOf(name);return i>=0&&args[i+1]?args[i+1]:fallback;};
const manifestPath=path.resolve(value('--manifest',path.join(__dirname,'..','resources','mock-exam-manifest.json')));
const publish=args.includes('--publish');

function ext(name){return path.extname(String(name||'')).toLowerCase();}
function mime(name){const suffix=ext(name);return suffix==='.pdf'?'application/pdf':suffix==='.doc'?'application/msword':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
function asset(db,item,kind){
  if(!item)return null;
  if(!/^[a-f0-9]{64}$/i.test(String(item.sha256||'')))throw new Error(`${item.name||kind} 缺少 SHA-256`);
  const existing=db.get('SELECT id FROM exam_assets WHERE sha256=?',[item.sha256]);
  if(existing)return Number(existing.id);
  const storageKey=`${kind}/${item.sha256.slice(0,2)}/${item.sha256}${ext(item.name)}`;
  const full=path.resolve(EXAM_LIBRARY_DIR,storageKey);
  if(!full.startsWith(path.resolve(EXAM_LIBRARY_DIR)+path.sep)||!fs.existsSync(full))throw new Error(`资源未同步：${storageKey}`);
  const stat=fs.statSync(full);
  if(Number(item.byte_size)!==stat.size)throw new Error(`资源大小不符：${storageKey}`);
  const actual=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if(actual!==String(item.sha256).toLowerCase())throw new Error(`资源哈希不符：${storageKey}`);
  return Number(db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES(?,?,?,?,?,?)`,[kind,storageKey,item.name,mime(item.name),stat.size,item.sha256]).lastInsertRowid);
}

async function main(){
  if(!fs.existsSync(manifestPath))throw new Error(`manifest 不存在：${manifestPath}`);
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(!Array.isArray(manifest.papers)||!manifest.papers.length)throw new Error('manifest 无试卷');
  await initDB();const db=getDB();let imported=0;
  db.transaction(()=>{for(const item of manifest.papers){
    const paperAssetId=asset(db,item.paper,'paper');const answerAssetId=asset(db,item.answer,'answer');
    db.run(`INSERT INTO exam_papers(stable_code,display_title,school_name,district,school_year,exam_year,grade,grade_code,subject_code,semester,semester_code,exam_type,
      paper_asset_id,answer_asset_id,source_relative_path,license_status,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'teacher_provided',?)
      ON CONFLICT(stable_code) DO UPDATE SET display_title=excluded.display_title,district=excluded.district,exam_year=excluded.exam_year,
      grade=excluded.grade,grade_code=excluded.grade_code,subject_code=excluded.subject_code,semester=excluded.semester,semester_code=excluded.semester_code,
      exam_type=excluded.exam_type,paper_asset_id=excluded.paper_asset_id,answer_asset_id=excluded.answer_asset_id,
      source_relative_path=excluded.source_relative_path,license_status='teacher_provided',status=excluded.status,updated_at=CURRENT_TIMESTAMP`,[
      item.stable_code,item.display_title,item.district,item.district,String(item.exam_year||''),item.exam_year,item.grade,item.grade_code,item.subject_code,
      item.semester,item.semester_code,item.exam_type,paperAssetId,answerAssetId,item.source_relative_path,publish?'published':'draft']);
    imported+=1;
  }});
  console.log(JSON.stringify({ok:true,imported,published:publish,manifest:manifestPath,exam_library_dir:EXAM_LIBRARY_DIR}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
