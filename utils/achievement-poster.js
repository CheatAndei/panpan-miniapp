export const ACHIEVEMENT_POSTER_WIDTH = 750;
export const ACHIEVEMENT_POSTER_HEIGHT = 1000;

function getImage(src) {
  return new Promise((resolve, reject) => uni.getImageInfo({
    src, success:(result)=>resolve(result.path || result.tempFilePath || src), fail:reject,
  }));
}

function roundRect(ctx, x, y, width, height, radius, color) {
  const r=Math.min(radius,width/2,height/2);
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+width-r,y);ctx.quadraticCurveTo(x+width,y,x+width,y+r);
  ctx.lineTo(x+width,y+height-r);ctx.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  ctx.lineTo(x+r,y+height);ctx.quadraticCurveTo(x,y+height,x,y+height-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();ctx.setFillStyle(color);ctx.fill();
}

function wrap(ctx, value, maxWidth, maxLines=3) {
  const lines=[];let current='';
  for(const char of Array.from(String(value||''))){
    if(current&&ctx.measureText(current+char).width>maxWidth){lines.push(current);current=char;if(lines.length===maxLines)break;}
    else current+=char;
  }
  if(lines.length<maxLines&&current)lines.push(current);
  return lines;
}

function metricRows(item) {
  if(item.category==='mental') return [
    ['正确率',`${item.accuracy||0}%`],['用时',`${item.elapsed_seconds||0}秒`],['得分',String(item.score||0)],
    ...(item.rank ? [['真实排名',`第${item.rank}名`]] : []),
  ];
  if(item.category==='challenge') return [
    ['累计通关',`${item.passed_count||1}题`],['本题来源',item.source_label||'潘潘老师精选'],
  ];
  return [
    ['累计完成',`${item.completed_count||0}题`],['累计正确',`${item.correct_count||0}题`],['覆盖来源',`${item.source_count||0}份`],
  ];
}

function exportCanvas(canvasId,page){
  return new Promise((resolve,reject)=>uni.canvasToTempFilePath({
    canvasId,x:0,y:0,width:ACHIEVEMENT_POSTER_WIDTH,height:ACHIEVEMENT_POSTER_HEIGHT,
    destWidth:1080,destHeight:1440,fileType:'png',quality:1,
    success:(result)=>resolve(result.tempFilePath),fail:reject,
  },page));
}

export async function renderAchievementPoster({ page, achievement, codePath, canvasId='achievementPosterCanvas' }) {
  if(!achievement)throw new Error('请选择一项真实成就');
  const code=await getImage(codePath);
  const ctx=uni.createCanvasContext(canvasId,page);
  ctx.setFillStyle('#F5F1E8');ctx.fillRect(0,0,750,1000);
  ctx.setFillStyle('#183A36');ctx.fillRect(0,0,750,260);
  ctx.setFillStyle('#B8DDD3');ctx.setFontSize(20);ctx.setTextAlign('left');ctx.fillText('PANPAN LEARNING ACHIEVEMENT',52,68);
  ctx.setFillStyle('#FFFFFF');ctx.setFontSize(34);ctx.fillText(achievement.title||'学习成就',52,122);
  ctx.setFillStyle('#F0C86C');ctx.setFontSize(58);ctx.fillText(achievement.display_name||'同学',52,198);
  ctx.setFillStyle('#D7EAE5');ctx.setFontSize(22);ctx.fillText('真实学习数据 · 隐私友好展示',52,232);

  roundRect(ctx,42,292,666,390,28,'#FFFFFF');
  ctx.setFillStyle('#2F7D6B');ctx.setFontSize(22);ctx.fillText(achievement.category==='choice'?'选择刷题王':achievement.category==='mental'?'口算王':'压轴挑战',76,346);
  ctx.setFillStyle('#183A36');ctx.setFontSize(43);
  wrap(ctx,achievement.headline||'完成新的学习成就',590,2).forEach((line,index)=>ctx.fillText(line,76,410+index*56));
  const rows=metricRows(achievement).slice(0,4);
  const startY=520;
  rows.forEach((row,index)=>{
    const y=startY+index*47;ctx.setFillStyle('#788984');ctx.setFontSize(21);ctx.fillText(row[0],76,y);
    ctx.setFillStyle('#29443E');ctx.setFontSize(25);ctx.fillText(String(row[1]).slice(0,22),220,y);
  });
  if(achievement.category==='challenge'&&achievement.question_title){
    ctx.setFillStyle('#65756F');ctx.setFontSize(20);
    wrap(ctx,achievement.question_title,570,2).forEach((line,index)=>ctx.fillText(line,76,625+index*30));
  }

  roundRect(ctx,42,716,666,218,26,'#183A36');
  roundRect(ctx,66,740,170,170,18,'#FFFFFF');ctx.drawImage(code,76,750,150,150);
  ctx.setFillStyle('#FFFFFF');ctx.setFontSize(31);ctx.fillText('扫码免费体验',274,785);
  ctx.setFillStyle('#CBE3DD');ctx.setFontSize(22);ctx.fillText('选择题、口算不限次数',274,830);
  ctx.fillText('联系潘潘老师加入',274,866);
  ctx.setFillStyle('#F0C86C');ctx.setFontSize(20);ctx.fillText('保存海报分享到朋友圈',274,900);
  ctx.setFillStyle('#756F65');ctx.setFontSize(18);ctx.fillText('番番记录 · 数据来自服务端真实学习记录',42,970);
  await new Promise((resolve)=>ctx.draw(false,()=>setTimeout(resolve,90)));
  return exportCanvas(canvasId,page);
}

export function saveAchievementPoster(filePath){
  return new Promise((resolve,reject)=>uni.saveImageToPhotosAlbum({filePath,success:resolve,fail:reject}));
}

export function albumPermissionDenied(error){
  return /auth deny|authorize|permission|scope\.writePhotosAlbum|用户拒绝|权限/i.test(String(error?.errMsg||error?.message||error||''));
}
